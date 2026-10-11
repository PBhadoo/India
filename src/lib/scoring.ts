import { CRITERIA } from './types.ts';
import type { CriterionId, Government, ScorableAction, ScorerEntry } from './types.ts';
import { partyYears, todayISO } from './tenure.ts';

export const IMPLEMENTER_CREDIT = 1.0;
export const ORIGINATOR_CREDIT = 0.25;
export const DISAGREEMENT_THRESHOLD = 2;
/** A party-category cell with fewer scored actions than this is "low data". */
export const LOW_DATA_MIN_ACTIONS = 2;
/** Fewer scored actions than this overall marks results "preliminary". */
export const PRELIMINARY_MIN_SCORED = 30;

export interface ActionScore {
  scored: boolean;
  /** Mean of the two scorers' totals; range -25..25. 0 when unscored. */
  points: number;
  low: number;
  high: number;
  means: Record<CriterionId, number>;
  scorerTotals: number[];
  /** Criteria where scorers differ by >= DISAGREEMENT_THRESHOLD. */
  flags: CriterionId[];
}

export const scorerTotal = (s: ScorerEntry): number => CRITERIA.reduce((n, c) => n + s[c], 0);

export function scoreAction(scorers: ScorerEntry[]): ActionScore {
  const means = Object.fromEntries(CRITERIA.map((c) => [c, 0])) as Record<CriterionId, number>;
  if (scorers.length === 0) {
    return { scored: false, points: 0, low: 0, high: 0, means, scorerTotals: [], flags: [] };
  }
  for (const c of CRITERIA) means[c] = scorers.reduce((n, s) => n + s[c], 0) / scorers.length;
  const totals = scorers.map(scorerTotal);
  const flags = CRITERIA.filter((c) => {
    const vals = scorers.map((s) => s[c]);
    return Math.max(...vals) - Math.min(...vals) >= DISAGREEMENT_THRESHOLD;
  });
  return {
    scored: true,
    points: CRITERIA.reduce((n, c) => n + means[c], 0),
    low: Math.min(...totals),
    high: Math.max(...totals),
    means,
    scorerTotals: totals,
    flags,
  };
}

export interface Credit {
  slug: string;
  category: string;
  partyId: string;
  governmentId: string;
  role: 'implementer' | 'originator';
  points: number;
  low: number;
  high: number;
}

/** Splits an action's credit: implementer x1.0, a different originator x0.25, each divided by coalition share. */
export function creditAction(
  action: ScorableAction,
  score: ActionScore,
  getGov: (id: string) => Government | undefined,
): Credit[] {
  if (!score.scored) return [];
  const out: Credit[] = [];
  const give = (govId: string | undefined, role: Credit['role'], factor: number) => {
    const g = govId ? getGov(govId) : undefined;
    if (!g) return;
    const partners = g.partners.length ? g.partners : [{ party: g.leadParty, share: 1 }];
    for (const p of partners) {
      const f = factor * p.share;
      out.push({
        slug: action.slug,
        category: action.category,
        partyId: p.party,
        governmentId: g.id,
        role,
        points: score.points * f,
        low: score.low * f,
        high: score.high * f,
      });
    }
  };
  give(action.governmentId, 'implementer', IMPLEMENTER_CREDIT);
  if (action.originGovernmentId && action.originGovernmentId !== action.governmentId) {
    give(action.originGovernmentId, 'originator', ORIGINATOR_CREDIT);
  }
  return out;
}

/** Category weight vector; unspecified categories default to 1. */
export function makeWeights(categoryIds: string[], overrides: Record<string, number> = {}): Record<string, number> {
  return Object.fromEntries(categoryIds.map((id) => [id, overrides[id] ?? 1]));
}

export const isLowData = (scoredActions: number, min = LOW_DATA_MIN_ACTIONS) => scoredActions < min;

export interface CategoryCell {
  category: string;
  /** Unweighted credited points and range. */
  points: number;
  low: number;
  high: number;
  /** Distinct scored actions credited to this party in this category. */
  scoredActions: number;
  lowData: boolean;
  weight: number;
  /** points x weight / yearsInPower (null if no years). */
  pointsPerYear: number | null;
}

export interface PartyResult {
  partyId: string;
  /** Weighted totals. */
  points: number;
  low: number;
  high: number;
  yearsInPower: number;
  yearsLed: number;
  pointsPerYear: number | null;
  lowPerYear: number | null;
  highPerYear: number | null;
  scoredActions: number;
  categories: Record<string, CategoryCell>;
  /** Any listed category cell with data below the threshold. */
  hasLowData: boolean;
  /** Action slugs credited, with flagged criteria for review. */
  flaggedActions: string[];
}

export interface ScoringResult {
  parties: PartyResult[];
  scoredActionCount: number;
  totalActionCount: number;
  preliminary: boolean;
  flagged: { slug: string; criteria: CriterionId[] }[];
  actionScores: Record<string, ActionScore>;
}

export interface ScoringOptions {
  asOf?: string;
  weights?: Record<string, number>;
  /** Limit to a level; default 'centre'. Governments and actions are filtered alike. */
  level?: 'centre' | 'state' | 'all';
  /** Categories to include as cells even when empty. */
  categoryIds?: string[];
  lowDataMin?: number;
  preliminaryMin?: number;
}

export function computeScoring(
  actions: ScorableAction[],
  governments: Government[],
  opts: ScoringOptions = {},
): ScoringResult {
  const asOf = opts.asOf ?? todayISO();
  const level = opts.level ?? 'centre';
  const lowMin = opts.lowDataMin ?? LOW_DATA_MIN_ACTIONS;
  const govs = level === 'all' ? governments : governments.filter((g) => g.level === level);
  const acts = level === 'all' ? actions : actions.filter((a) => a.level === level);
  const govById = new Map(governments.map((g) => [g.id, g]));
  const getGov = (id: string) => govById.get(id);

  const actionScores: Record<string, ActionScore> = {};
  const flagged: ScoringResult['flagged'] = [];
  const credits: Credit[] = [];
  let scoredCount = 0;
  for (const a of acts) {
    const s = scoreAction(a.scorers);
    actionScores[a.slug] = s;
    if (!s.scored) continue;
    scoredCount++;
    if (s.flags.length) flagged.push({ slug: a.slug, criteria: s.flags });
    credits.push(...creditAction(a, s, getGov));
  }

  const years = partyYears(govs, asOf);
  const partyIds = new Set<string>([...Object.keys(years), ...credits.map((c) => c.partyId)]);
  const flaggedSlugs = new Set(flagged.map((f) => f.slug));
  const parties: PartyResult[] = [];

  for (const partyId of partyIds) {
    const mine = credits.filter((c) => c.partyId === partyId);
    const catIds = new Set<string>([...(opts.categoryIds ?? []), ...mine.map((c) => c.category)]);
    const yrs = years[partyId]?.weighted ?? 0;
    const cells: Record<string, CategoryCell> = {};
    let points = 0, low = 0, high = 0;
    for (const cat of catIds) {
      const cs = mine.filter((c) => c.category === cat);
      const w = opts.weights?.[cat] ?? 1;
      const p = cs.reduce((n, c) => n + c.points, 0);
      const lo = cs.reduce((n, c) => n + c.low, 0);
      const hi = cs.reduce((n, c) => n + c.high, 0);
      const n = new Set(cs.map((c) => c.slug)).size;
      cells[cat] = {
        category: cat, points: p, low: lo, high: hi, scoredActions: n,
        lowData: isLowData(n, lowMin), weight: w,
        pointsPerYear: yrs > 0 ? (p * w) / yrs : null,
      };
      points += p * w; low += lo * w; high += hi * w;
    }
    const slugs = [...new Set(mine.map((c) => c.slug))];
    parties.push({
      partyId, points, low, high,
      yearsInPower: yrs,
      yearsLed: years[partyId]?.led ?? 0,
      pointsPerYear: yrs > 0 ? points / yrs : null,
      lowPerYear: yrs > 0 ? low / yrs : null,
      highPerYear: yrs > 0 ? high / yrs : null,
      scoredActions: slugs.length,
      categories: cells,
      hasLowData: Object.values(cells).some((c) => c.lowData),
      flaggedActions: slugs.filter((s) => flaggedSlugs.has(s)),
    });
  }
  parties.sort((a, b) => (b.pointsPerYear ?? -Infinity) - (a.pointsPerYear ?? -Infinity));

  return {
    parties,
    scoredActionCount: scoredCount,
    totalActionCount: acts.length,
    preliminary: scoredCount < (opts.preliminaryMin ?? PRELIMINARY_MIN_SCORED),
    flagged,
    actionScores,
  };
}

/** Real-data wrapper: reads collections, governments and taxonomy. Returns an empty result on any missing data. */
export async function getScoring(opts: ScoringOptions = {}): Promise<ScoringResult> {
  const [{ getScorableActions }, { allGovernments }, { categoryIds }] = await Promise.all([
    import('./collections.ts'),
    import('./governments.ts'),
    import('./taxonomy.ts'),
  ]);
  const actions = await getScorableActions();
  return computeScoring(actions, allGovernments(), { categoryIds: categoryIds(), ...opts });
}
