import { CRITERIA } from './types.ts';
import type { CriterionId, Government, ScorableAction, ScorerEntry } from './types.ts';
import { partyYears, todayISO, yearsInOffice } from './tenure.ts';

export const IMPLEMENTER_CREDIT = 1.0;
export const ORIGINATOR_CREDIT = 0.25;
export const DISAGREEMENT_THRESHOLD = 2;
/** A party-category cell with fewer scored actions than this is "low data". */
export const LOW_DATA_MIN_ACTIONS = 2;
/** Fewer scored actions than this overall marks results "preliminary". */
export const PRELIMINARY_MIN_SCORED = 30;
/**
 * Prior tenure, in years, added to the divisor of the shrunk per-year figure:
 * shrunkPerYear = points / (yearsInPower + PRIOR_YEARS). A short tenure is pulled toward zero.
 */
export const PRIOR_YEARS = 5;

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
  // Independent institutions (courts, regulators, the Election Commission) earn or lose no party points.
  if (action.credit === 'none') return [];
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
  /**
   * Mean weighted points per scored action: points / avgActions, with low and high from the
   * scorer totals. avgActions counts distinct scored actions in categories whose weight is above 0.
   * null (never NaN) when avgActions is 0.
   */
  avgPerAction: number | null;
  avgLow: number | null;
  avgHigh: number | null;
  avgActions: number;
  /** points / (yearsInPower + PRIOR_YEARS), with the same range. null when no scored actions. */
  shrunkPerYear: number | null;
  shrunkLow: number | null;
  shrunkHigh: number | null;
  categories: Record<string, CategoryCell>;
  /** Any listed category cell with data below the threshold. */
  hasLowData: boolean;
  /** Action slugs credited, with flagged criteria for review. */
  flaggedActions: string[];
}

export interface ScoringResult {
  parties: PartyResult[];
  /** Same credits rolled up into INC-led, BJP-led and Other governments (Addendum v3). */
  blocs: BlocResult[];
  /** Scored actions that carry party credit (credit 'party'). */
  scoredActionCount: number;
  /** Scored actions with credit 'none': shown, never added to a party total. */
  noCreditScoredCount: number;
  /** Actions in scope, whether scored or not and whatever their credit. */
  totalActionCount: number;
  preliminary: boolean;
  flagged: { slug: string; criteria: CriterionId[] }[];
  /** Unweighted per-party credits (used to recompute in the browser). */
  credits: Credit[];
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

export interface AggregateOptions {
  categoryIds?: string[];
  weights?: Record<string, number>;
  lowDataMin?: number;
  flaggedSlugs?: Set<string>;
}

/**
 * Pure aggregation shared by the build (computeScoring) and the browser
 * (live weights and era filter): credits + years in power -> party results.
 */
export function aggregateParties(
  credits: Credit[],
  years: Record<string, { weighted: number; led: number }>,
  opts: AggregateOptions = {},
): PartyResult[] {
  const lowMin = opts.lowDataMin ?? LOW_DATA_MIN_ACTIONS;
  const flaggedSlugs = opts.flaggedSlugs ?? new Set<string>();
  const partyIds = new Set<string>([...Object.keys(years), ...credits.map((c) => c.partyId)]);
  const parties: PartyResult[] = [];
  for (const partyId of partyIds) {
    const mine = credits.filter((c) => c.partyId === partyId);
    const catIds = new Set<string>([...(opts.categoryIds ?? []), ...mine.map((c) => c.category)]);
    const yrs = years[partyId]?.weighted ?? 0;
    const cells: Record<string, CategoryCell> = {};
    let points = 0, low = 0, high = 0;
    const weightedSlugs = new Set<string>();
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
      if (w > 0) for (const c of cs) weightedSlugs.add(c.slug);
    }
    const nAvg = weightedSlugs.size;
    const shrinkDiv = yrs + PRIOR_YEARS;
    const slugs = [...new Set(mine.map((c) => c.slug))];
    parties.push({
      partyId, points, low, high,
      yearsInPower: yrs,
      yearsLed: years[partyId]?.led ?? 0,
      pointsPerYear: yrs > 0 ? points / yrs : null,
      lowPerYear: yrs > 0 ? low / yrs : null,
      highPerYear: yrs > 0 ? high / yrs : null,
      scoredActions: slugs.length,
      avgPerAction: nAvg > 0 ? points / nAvg : null,
      avgLow: nAvg > 0 ? low / nAvg : null,
      avgHigh: nAvg > 0 ? high / nAvg : null,
      avgActions: nAvg,
      shrunkPerYear: nAvg > 0 ? points / shrinkDiv : null,
      shrunkLow: nAvg > 0 ? low / shrinkDiv : null,
      shrunkHigh: nAvg > 0 ? high / shrinkDiv : null,
      categories: cells,
      hasLowData: Object.values(cells).some((c) => c.lowData),
      flaggedActions: slugs.filter((s) => flaggedSlugs.has(s)),
    });
  }
  parties.sort((a, b) => (b.pointsPerYear ?? -Infinity) - (a.pointsPerYear ?? -Infinity));
  return parties;
}

type GovLite = Pick<Government, 'id' | 'leadParty' | 'start' | 'end' | 'partners'>;

/** Clips governments to a calendar-year window (inclusive); governments wholly outside drop out. */
export function clipGovernments<T extends GovLite>(govs: T[], yearFrom?: number, yearTo?: number, asOf: string = todayISO()): T[] {
  const from = yearFrom != null ? `${yearFrom}-01-01` : undefined;
  const to = yearTo != null ? `${yearTo}-12-31` : undefined;
  const out: T[] = [];
  for (const g of govs) {
    let start = g.start;
    let end = g.end ?? asOf;
    if (from && from > start) start = from;
    if (to && to < end) end = to;
    if (end <= start) continue;
    out.push({ ...g, start, end });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Blocs (Addendum v3): a Centre government's bloc comes from its lead party. Coalition partners'
// credit and years roll up into the lead bloc (UPA = INC-led, NDA = BJP-led).
// ---------------------------------------------------------------------------------------------
export const BLOC_IDS = ['inc', 'bjp', 'other'] as const;
export type BlocId = (typeof BLOC_IDS)[number];
/** Blocs shown in the headline table and the side-by-side page, in this fixed order (not ranked). */
export const HEADLINE_BLOCS: BlocId[] = ['inc', 'bjp'];
export const BLOC_LABEL: Record<BlocId, string> = { inc: 'INC-led', bjp: 'BJP-led', other: 'Other governments' };
export const BLOC_NOTE: Record<BlocId, string> = {
  inc: 'Governments led by the Indian National Congress, with their coalition partners (for example UPA).',
  bjp: 'Governments led by the Bharatiya Janata Party, with their coalition partners (for example NDA).',
  other: 'Governments led by any other party (Janata Party, Janata Dal, National Front, United Front, Samajwadi Janata and similar).',
};
const LEAD_TO_BLOC: Record<string, BlocId> = { inc: 'inc', bjp: 'bjp' };

/** `inc` -> INC-led, `bjp` -> BJP-led, anything else (including no lead party) -> Other. */
export function blocOf(government: { leadParty?: string | null } | null | undefined): BlocId {
  return LEAD_TO_BLOC[government?.leadParty ?? ''] ?? 'other';
}

export interface BlocCell extends CategoryCell {
  /** Weighted points / (bloc years in power + PRIOR_YEARS). null when the cell has no scored actions. */
  shrunkPerYear: number | null;
  /** Unweighted mean credited points per scored action in this category. null when none. */
  avgPerAction: number | null;
}

export interface BlocResult extends PartyResult {
  /** Equal to partyId; kept so callers read naturally. */
  blocId: BlocId;
  label: string;
  /** Governments of this bloc with time in office inside the period (all of them: nothing is dropped). */
  governmentIds: string[];
  categories: Record<string, BlocCell>;
}

/** Bloc totals from credits and governments (already clipped to the period if needed). */
export function aggregateBlocs(
  credits: Credit[],
  governments: GovLite[],
  opts: AggregateOptions & { asOf?: string } = {},
): BlocResult[] {
  const asOf = opts.asOf ?? todayISO();
  const blocOfGov = new Map<string, BlocId>(governments.map((g) => [g.id, blocOf(g)]));
  const years: Record<string, { weighted: number; led: number }> = Object.fromEntries(BLOC_IDS.map((b) => [b, { weighted: 0, led: 0 }]));
  const govIds: Record<BlocId, string[]> = { inc: [], bjp: [], other: [] };
  for (const g of governments) {
    const y = yearsInOffice(g, asOf);
    if (y <= 0) continue;
    const b = blocOf(g);
    years[b].weighted += y;
    years[b].led += y;
    govIds[b].push(g.id);
  }
  const rolled = credits
    .filter((c) => blocOfGov.has(c.governmentId))
    .map((c) => ({ ...c, partyId: blocOfGov.get(c.governmentId)! }));
  const base = aggregateParties(rolled, years, opts);
  const out: BlocResult[] = [];
  for (const id of BLOC_IDS) {
    const r = base.find((p) => p.partyId === id);
    if (!r) continue;
    const div = r.yearsInPower + PRIOR_YEARS;
    const categories: Record<string, BlocCell> = {};
    for (const [cat, c] of Object.entries(r.categories)) {
      categories[cat] = {
        ...c,
        shrunkPerYear: c.scoredActions > 0 ? (c.points * c.weight) / div : null,
        avgPerAction: c.scoredActions > 0 ? c.points / c.scoredActions : null,
      };
    }
    out.push({ ...r, blocId: id, label: BLOC_LABEL[id], governmentIds: govIds[id], categories });
  }
  return out;
}

export interface BlocPointsInput extends Omit<PointsInput, 'governments'> {
  governments: GovLite[];
}

/** Browser-side recompute for blocs: same period clipping as computePoints, then aggregateBlocs. */
export function computeBlocPoints(input: BlocPointsInput): BlocResult[] {
  const asOf = input.asOf ?? todayISO();
  const { yearFrom, yearTo } = input;
  const credits = input.credits.filter(
    (c) => c.year == null || ((yearFrom == null || c.year >= yearFrom) && (yearTo == null || c.year <= yearTo)),
  );
  const govs = clipGovernments(input.governments, yearFrom, yearTo, asOf);
  return aggregateBlocs(credits, govs, {
    asOf,
    categoryIds: input.categoryIds,
    weights: input.weights,
    lowDataMin: input.lowDataMin,
    flaggedSlugs: new Set(credits.filter((c) => c.flagged).map((c) => c.slug)),
  });
}

export interface ActionSummary {
  /** Actions listed. */
  count: number;
  /** Of those, scored. */
  scored: number;
  /** Plain mean of the scored actions' own points (not credit-weighted); null when none. */
  avg: number | null;
  avgLow: number | null;
  avgHigh: number | null;
  lowData: boolean;
}

/** Summary row for a list of actions: count, mean points with the mean of the scorers' low and high totals. */
export function summarizeActions(
  items: { points: number; low: number; high: number; scored: boolean }[],
  lowDataMin = LOW_DATA_MIN_ACTIONS,
): ActionSummary {
  const s = items.filter((i) => i.scored);
  const m = (f: (i: (typeof s)[number]) => number) => (s.length ? s.reduce((n, i) => n + f(i), 0) / s.length : null);
  return { count: items.length, scored: s.length, avg: m((i) => i.points), avgLow: m((i) => i.low), avgHigh: m((i) => i.high), lowData: isLowData(s.length, lowDataMin) };
}

export interface PointsInput {
  credits: (Credit & { year?: number; flagged?: boolean })[];
  governments: GovLite[];
  asOf?: string;
  weights?: Record<string, number>;
  categoryIds?: string[];
  yearFrom?: number;
  yearTo?: number;
  lowDataMin?: number;
}

/** Recomputes party results from raw credits, with optional weights and a calendar-year window on action date and tenure. */
export function computePoints(input: PointsInput): PartyResult[] {
  const asOf = input.asOf ?? todayISO();
  const { yearFrom, yearTo } = input;
  const credits = input.credits.filter(
    (c) => c.year == null || ((yearFrom == null || c.year >= yearFrom) && (yearTo == null || c.year <= yearTo)),
  );
  const govs = clipGovernments(input.governments as Government[], yearFrom, yearTo, asOf);
  return aggregateParties(credits, partyYears(govs, asOf), {
    categoryIds: input.categoryIds,
    weights: input.weights,
    lowDataMin: input.lowDataMin,
    flaggedSlugs: new Set(credits.filter((c) => c.flagged).map((c) => c.slug)),
  });
}

export function computeScoring(
  actions: ScorableAction[],
  governments: Government[],
  opts: ScoringOptions = {},
): ScoringResult {
  const asOf = opts.asOf ?? todayISO();
  const level = opts.level ?? 'centre';
  const govs = level === 'all' ? governments : governments.filter((g) => g.level === level);
  const acts = level === 'all' ? actions : actions.filter((a) => a.level === level);
  const govById = new Map(governments.map((g) => [g.id, g]));
  const getGov = (id: string) => govById.get(id);

  const actionScores: Record<string, ActionScore> = {};
  const flagged: ScoringResult['flagged'] = [];
  const credits: Credit[] = [];
  let scoredCount = 0;
  let noCreditCount = 0;
  for (const a of acts) {
    const s = scoreAction(a.scorers);
    actionScores[a.slug] = s;
    if (!s.scored) continue;
    if (a.credit === 'none') noCreditCount++;
    else scoredCount++;
    if (s.flags.length) flagged.push({ slug: a.slug, criteria: s.flags });
    credits.push(...creditAction(a, s, getGov));
  }

  const parties = aggregateParties(credits, partyYears(govs, asOf), {
    categoryIds: opts.categoryIds,
    weights: opts.weights,
    lowDataMin: opts.lowDataMin,
    flaggedSlugs: new Set(flagged.map((f) => f.slug)),
  });

  const blocs = aggregateBlocs(credits, govs, {
    asOf,
    categoryIds: opts.categoryIds,
    weights: opts.weights,
    lowDataMin: opts.lowDataMin,
    flaggedSlugs: new Set(flagged.map((f) => f.slug)),
  });

  return {
    parties,
    blocs,
    credits,
    scoredActionCount: scoredCount,
    noCreditScoredCount: noCreditCount,
    totalActionCount: acts.length,
    preliminary: scoredCount < (opts.preliminaryMin ?? PRELIMINARY_MIN_SCORED),
    flagged,
    actionScores,
  };
}
