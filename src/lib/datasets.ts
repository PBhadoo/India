// Typed, tolerant loaders and pure view helpers for src/data/indicators.json and src/data/promises.json
// (Addendum v3). Missing files give empty data, never an error, so the pages build before the data exists.
// No Astro-only imports except the zod re-export, so node --test can load this file.
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'astro/zod';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');

export const SOURCE_TYPES = ['primary', 'official-data', 'court', 'reputable-media', 'academic'] as const;
/** Indicator sources may also be modelled series from an international agency (World Bank, UN, ...). */
export const INDICATOR_SOURCE_TYPES = [...SOURCE_TYPES, 'international-estimate'] as const;
export const INDICATOR_SOURCE_LABEL: Record<string, string> = {
  primary: 'Primary',
  'official-data': 'Official data',
  court: 'Court',
  'reputable-media': 'Media',
  academic: 'Academic',
  'international-estimate': 'International estimate',
};
export const INTERNATIONAL_ESTIMATE_NOTE = 'Modelled series published by an international agency such as the World Bank or the UN; they can differ from official national statistics.';
export const BLOCS = ['INC', 'BJP', 'Other'] as const;
export const PROMISE_PARTIES = ['inc', 'bjp'] as const;
export const PROMISE_ELECTIONS = [1998, 1999, 2004, 2009, 2014, 2019, 2024] as const;
export const PROMISE_STATUSES = ['delivered', 'partly-delivered', 'not-delivered', 'abandoned', 'ongoing', 'unclear', 'not-in-power'] as const;
export type PromiseStatus = (typeof PROMISE_STATUSES)[number];
export type PromiseParty = (typeof PROMISE_PARTIES)[number];

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const httpsUrl = z.string().url().startsWith('https://');

export const sourceSchema = z.object({
  title: z.string().min(1),
  url: httpsUrl,
  publisher: z.string().min(1).optional(),
  type: z.enum(SOURCE_TYPES).optional(),
});

export const periodSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  bloc: z.enum(BLOCS),
  start: isoDay,
  end: isoDay.nullable().optional(),
});

const indicatorSourceSchema = sourceSchema.extend({ type: z.enum(INDICATOR_SOURCE_TYPES).optional() });

export const indicatorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  unit: z.string().min(1),
  domain: z.string().min(1),
  basis: z.string().min(1),
  source: indicatorSourceSchema,
  caveats: z.array(z.string().min(1)).min(1),
  values: z.array(z.object({ period: z.string().min(1), value: z.number().finite(), note: z.string().optional() })),
});

export const indicatorsFileSchema = z.object({
  periods: z.array(periodSchema),
  indicators: z.array(indicatorSchema),
});

export const promiseSchema = z.object({
  id: z.string().min(1),
  party: z.enum(PROMISE_PARTIES),
  election: z.number().int(),
  text: z.string().min(1),
  domain: z.string().min(1),
  status: z.enum(PROMISE_STATUSES),
  evidence: z.string().min(1),
  evidenceSource: sourceSchema,
  manifestoSource: sourceSchema,
  asOf: isoDay,
});

export type Period = z.infer<typeof periodSchema>;
export type Indicator = z.infer<typeof indicatorSchema>;
export type IndicatorsData = z.infer<typeof indicatorsFileSchema>;
export type PromiseRecord = z.infer<typeof promiseSchema>;

export interface Loaded<T> {
  data: T;
  /** False when the file does not exist (the page shows its empty state). */
  present: boolean;
  /** Entries that failed the schema and were left out; `npm run validate` reports them as errors. */
  issues: string[];
}

function readJson(file: string): { present: boolean; value: unknown } {
  try {
    return { present: true, value: JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch (e: any) {
    return { present: e?.code !== 'ENOENT', value: undefined };
  }
}

/** Loads indicators.json; invalid indicators or periods are dropped one by one. Never throws. */
export function loadIndicators(dataDir: string = DATA_DIR): Loaded<IndicatorsData> {
  const { present, value } = readJson(path.join(dataDir, 'indicators.json'));
  const out: IndicatorsData = { periods: [], indicators: [] };
  const issues: string[] = [];
  const doc = value as any;
  if (!doc || typeof doc !== 'object') return { data: out, present: false, issues: present ? ['indicators.json is not valid JSON'] : [] };
  for (const [i, p] of (Array.isArray(doc.periods) ? doc.periods : []).entries()) {
    const r = periodSchema.safeParse(p);
    if (r.success) out.periods.push(r.data);
    else issues.push(`periods[${i}]: ${r.error.issues[0]?.message}`);
  }
  const known = new Set(out.periods.map((p) => p.id));
  for (const [i, ind] of (Array.isArray(doc.indicators) ? doc.indicators : []).entries()) {
    const r = indicatorSchema.safeParse(ind);
    if (!r.success) { issues.push(`indicators[${i}]: ${r.error.issues[0]?.message}`); continue; }
    out.indicators.push({ ...r.data, values: r.data.values.filter((v) => known.has(v.period)) });
  }
  return { data: out, present: true, issues };
}

/** Loads promises.json; invalid entries and repeated ids are dropped. Never throws. */
export function loadPromises(dataDir: string = DATA_DIR): Loaded<PromiseRecord[]> {
  const { present, value } = readJson(path.join(dataDir, 'promises.json'));
  if (!Array.isArray(value)) return { data: [], present: false, issues: present ? ['promises.json is not a list'] : [] };
  const out: PromiseRecord[] = [];
  const issues: string[] = [];
  const ids = new Set<string>();
  for (const [i, p] of value.entries()) {
    const r = promiseSchema.safeParse(p);
    if (!r.success) { issues.push(`[${i}]: ${r.error.issues[0]?.message}`); continue; }
    if (ids.has(r.data.id)) { issues.push(`[${i}]: duplicate id ${r.data.id}`); continue; }
    ids.add(r.data.id);
    out.push(r.data);
  }
  return { data: out, present: true, issues };
}

// ------------------------------------------------------------------------------ view helpers

export type BlocKey = 'inc' | 'bjp' | 'other';
export const BLOC_KEY: Record<(typeof BLOCS)[number], BlocKey> = { INC: 'inc', BJP: 'bjp', Other: 'other' };
/** Same slots/patterns as the party colours used on the timeline: INC slot 1, BJP slot 6, neutral slot 0. */
export const BLOC_SLOT: Record<BlocKey, number> = { inc: 1, bjp: 6, other: 0 };
export const BLOC_LABEL: Record<BlocKey, string> = { inc: 'INC-led', bjp: 'BJP-led', other: 'Other' };

export const PROMISE_STATUS_LABEL: Record<PromiseStatus, string> = {
  delivered: 'Delivered',
  'partly-delivered': 'Partly delivered',
  'not-delivered': 'Not delivered',
  abandoned: 'Abandoned',
  ongoing: 'Ongoing',
  unclear: 'Unclear',
  'not-in-power': 'Not in power: untested',
};

/** Addendum v3 wording, shown verbatim on /promises/ and the methodology page. */
export const PROMISE_STATUS_RULES: Record<PromiseStatus, string> = {
  delivered: 'enacted/implemented at the scope promised, per official data or law',
  'partly-delivered': 'enacted or implemented in part or at lower scope',
  'not-delivered': 'no enactment/implementation by the party while in office afterwards (or no longer in office)',
  abandoned: 'officially dropped',
  ongoing: 'within the promised timeline and in progress',
  unclear: 'evidence insufficient',
  'not-in-power':
    'the party did not form (or lead) the Union government after that election, so the promise could not be tested at the Centre (used for every promise of that party-election; not counted as delivered or not delivered)',
};

/** Elections after which each party formed or led the Union government (Addendum v3). Delivery is compared only for these. */
export const GOVERNED_ELECTIONS: Record<PromiseParty, readonly number[]> = {
  inc: [2004, 2009],
  bjp: [1998, 1999, 2014, 2019, 2024],
};
export const GOVERNED_RULE =
  'The tracker compares delivery only for elections after which each party governed: INC-led 2004 and 2009; BJP-led 1998, 1999, 2014, 2019 and 2024.';
export const governedBy = (party: PromiseParty, election: number) => GOVERNED_ELECTIONS[party].includes(election);

export const PROMISE_SELECTION_RULE =
  'Same number of promises per party per election (8), chosen by prominence in the manifesto (headline pledges), not by outcome.';

export interface StatusCounts {
  total: number;
  byStatus: Record<PromiseStatus, number>;
}

export const emptyCounts = (): StatusCounts => ({ total: 0, byStatus: Object.fromEntries(PROMISE_STATUSES.map((s) => [s, 0])) as Record<PromiseStatus, number> });

/** Counts by status for each party and election. Same shape for every party; an election with none gives total 0. */
export function promiseSummary(list: Pick<PromiseRecord, 'party' | 'election' | 'status'>[], elections: readonly number[] = PROMISE_ELECTIONS) {
  const out = {} as Record<PromiseParty, Map<number, StatusCounts>>;
  for (const party of PROMISE_PARTIES) {
    out[party] = new Map(elections.map((e) => [e, emptyCounts()]));
  }
  for (const p of list) {
    const c = out[p.party]?.get(p.election);
    if (!c) continue;
    c.total++;
    c.byStatus[p.status]++;
  }
  return out;
}

export interface BarRow {
  period: Period;
  bloc: BlocKey;
  value: number | null;
  note?: string;
  /** Left edge and width of the bar, as percentages of the plot track. */
  left: number;
  width: number;
}

/**
 * Bars for one indicator across all periods in chronological order. A period with no value gets
 * value null (shown as "no comparable value", never as zero). The scale always includes zero.
 * Positive values leave `padEnd` percent free for the value label; negative values leave `padStart`.
 */
export function indicatorBars(ind: Indicator, periods: Period[], padEnd = 20, padStart = 20) {
  const vals = ind.values.map((v) => v.value);
  const lo = Math.min(0, ...vals);
  const hi = Math.max(0, ...vals);
  const hasNeg = lo < 0;
  const hasPos = hi > 0;
  const x0 = hasNeg ? padStart : 0;
  const x1 = 100 - (hasPos ? padEnd : 0);
  const span = hi - lo || 1;
  const pos = (v: number) => x0 + ((v - lo) / span) * (x1 - x0);
  const zero = pos(0);
  const sorted = [...periods].sort((a, b) => a.start.localeCompare(b.start));
  const rows: BarRow[] = sorted.map((period) => {
    const v = ind.values.find((x) => x.period === period.id);
    const bloc = BLOC_KEY[period.bloc];
    if (!v) return { period, bloc, value: null, left: zero, width: 0 };
    const p = pos(v.value);
    return { period, bloc, value: v.value, note: v.note, left: Math.min(p, zero), width: Math.max(Math.abs(p - zero), 0.6) };
  });
  return { rows, zero, lo, hi };
}

/** Domains present, in first-seen order. */
export const indicatorDomains = (inds: Indicator[]) => [...new Set(inds.map((i) => i.domain))];

export const titleCase = (slug: string) => slug.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
