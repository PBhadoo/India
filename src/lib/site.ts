import { getActionEntries, getDevelopingEntries, toScorable } from './collections.ts';
import { allGovernments, centreGovernments, getGovernment, listStates, parties as allParties, stateGovernments } from './governments.ts';
import { categories, categoryIds } from './taxonomy.ts';
import { computeScoring, type ActionScore, type ScoringResult } from './scoring-core.ts';
import { partySlots, type PartyMeta } from './viz.ts';
import { yearOf, isoDate } from './format.ts';
import { todayISO } from './tenure.ts';
import type { Government, Party } from './types.ts';

export interface ActionRow {
  slug: string;
  data: any;
  score: ActionScore;
  year: number;
  gov?: Government;
  originGov?: Government;
  partyId: string;
  /** Pre-rendered markdown body is read via astro:content render() on the detail page only. */
  entry: any;
}

export interface DevRow {
  slug: string;
  data: any;
  entry: any;
}

export interface Site {
  actions: ActionRow[];
  developing: DevRow[];
  scoring: ScoringResult;
  slots: Record<string, number>;
  partyList: Party[];
  partyMeta: Record<string, PartyMeta>;
  asOf: string;
  lastUpdated: string | null;
}

let cache: Promise<Site> | undefined;

export function getSite(): Promise<Site> {
  return (cache ??= build());
}

async function build(): Promise<Site> {
  const entries = (await getActionEntries().catch(() => [])) as any[];
  const dev = (await getDevelopingEntries().catch(() => [])) as any[];
  const govs = allGovernments();
  const plist = allParties();
  const slots = partySlots(govs, plist);

  const actions: ActionRow[] = entries
    .map((e) => {
      const gov = getGovernment(e.data.governmentId);
      return {
        slug: e.id,
        data: e.data,
        entry: e,
        year: yearOf(e.data.date),
        gov,
        originGov: e.data.originGovernmentId ? getGovernment(e.data.originGovernmentId) : undefined,
        partyId: gov?.leadParty ?? '',
        score: undefined as unknown as ActionScore,
      } satisfies ActionRow;
    })
    .sort((a, b) => +new Date(b.data.date) - +new Date(a.data.date) || a.slug.localeCompare(b.slug));

  const scoring = computeScoring(entries.map(toScorable), govs, { categoryIds: categoryIds(), level: 'centre' });
  // Scores for state-level actions too
  const all = computeScoring(entries.map(toScorable), govs, { categoryIds: categoryIds(), level: 'all' });
  for (const a of actions) a.score = all.actionScores[a.slug] ?? scoring.actionScores[a.slug];

  const developing: DevRow[] = dev
    .map((e) => ({ slug: e.id, data: e.data, entry: e }))
    .sort((a, b) => +new Date(b.data.date) - +new Date(a.data.date));

  const stamps = [...actions.map((a) => isoDate(a.data.lastReviewed)), ...developing.map((d) => isoDate(d.data.date))].sort();
  const partyMetaMap: Record<string, PartyMeta> = {};
  const ids = new Set<string>([...plist.map((p) => p.id), ...Object.keys(slots)]);
  for (const id of ids) {
    const p = plist.find((x) => x.id === id);
    partyMetaMap[id] = { id, name: p?.name ?? id.toUpperCase(), short: p?.short ?? id.toUpperCase(), slot: slots[id] ?? 0 };
  }
  return {
    actions,
    developing,
    scoring,
    slots,
    partyList: plist,
    partyMeta: partyMetaMap,
    asOf: todayISO(),
    lastUpdated: stamps.length ? stamps[stamps.length - 1] : null,
  };
}

export const cats = categories;
export { centreGovernments, stateGovernments, listStates, allGovernments, getGovernment };

export function pm(site: Site, id: string): PartyMeta {
  return site.partyMeta[id] ?? { id, name: id.toUpperCase(), short: id.toUpperCase(), slot: 0 };
}

export function ctxFor(site: Site) {
  return {
    parties: Object.fromEntries(Object.values(site.partyMeta).map((p) => [p.id, { name: p.name, short: p.short, slot: p.slot }])),
    categories: categories().map((c) => ({ id: c.id, name: c.name })),
  };
}

/** JSON safe to inline in a script tag. */
export function jsonForScript(v: unknown): string {
  return JSON.stringify(v).replace(/</g, '\\u003c').replace(/ | /g, '');
}
