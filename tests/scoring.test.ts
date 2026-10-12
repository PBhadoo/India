import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { scoreAction, creditAction, computeScoring, makeWeights, isLowData } from '../src/lib/scoring.ts';
import type { Government, ScorableAction, ScorerEntry } from '../src/lib/types.ts';

const raw = JSON.parse(fs.readFileSync(new URL('./fixtures/governments.json', import.meta.url), 'utf8'));
const govs: Government[] = raw.centre.map((g: any) => ({ ...g, level: 'centre', leader: g.pm }));
const byId = (id: string) => govs.find((g) => g.id === id);
const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

const sc = (id: string, v: [number, number, number, number, number]): ScorerEntry => ({
  id, reach: v[0], outcome: v[1], sustainability: v[2], process: v[3], delivery: v[4],
});
// A totals 10, B totals 6 -> mean 8, range 6..10. Outcome differs by 2 -> flagged.
const scorers = [sc('A', [4, 3, 1, 0, 2]), sc('B', [4, 1, 1, 0, 0])];

const action = (slug: string, over: Partial<ScorableAction> = {}): ScorableAction => ({
  slug, category: 'economy', level: 'centre', governmentId: 'c2', scorers, ...over,
});

test('action points, range and disagreement flag', () => {
  const s = scoreAction(scorers);
  near(s.points, 8);
  assert.equal(s.low, 6);
  assert.equal(s.high, 10);
  assert.deepEqual(s.flags.sort(), ['delivery', 'outcome']);
  near(s.means.outcome, 2);
});

test('single-point disagreement is not flagged', () => {
  const s = scoreAction([sc('A', [1, 1, 1, 1, 1]), sc('B', [2, 2, 2, 2, 2])]);
  assert.deepEqual(s.flags, []);
});

test('unscored action yields no credit', () => {
  const s = scoreAction([]);
  assert.equal(s.scored, false);
  assert.deepEqual(creditAction(action('x', { scorers: [] }), s, byId), []);
});

test('originator gets 25 percent, split by coalition share', () => {
  const a = action('gst', { governmentId: 'c2', originGovernmentId: 'c1' });
  const credits = creditAction(a, scoreAction(scorers), byId);
  const get = (party: string, role: string) => credits.find((c) => c.partyId === party && c.role === role)!;
  near(get('bbb', 'implementer').points, 8);
  near(get('aaa', 'originator').points, 8 * 0.25 * 0.75);
  near(get('bbb', 'originator').points, 8 * 0.25 * 0.25);
  near(get('aaa', 'originator').high, 10 * 0.25 * 0.75);
});

test('same origin and implementer is not double counted', () => {
  const a = action('x', { originGovernmentId: 'c2' });
  assert.equal(creditAction(a, scoreAction(scorers), byId).length, 1);
});

test('party totals, per-year, low-data and preliminary', () => {
  const actions = [
    action('a1', { governmentId: 'c2', originGovernmentId: 'c1' }),
    action('a2', { governmentId: 'c2' }),
    action('a3', { governmentId: 'c1', category: 'health' }),
  ];
  const r = computeScoring(actions, govs, { asOf: '2004-01-01', categoryIds: ['economy', 'health', 'defence'] });
  const bbb = r.parties.find((p) => p.partyId === 'bbb')!;
  const aaa = r.parties.find((p) => p.partyId === 'aaa')!;
  // bbb: a1 8 + a2 8 + a1 origin (2*0.25) + a3 (8*0.25)
  near(bbb.points, 8 + 8 + 8 * 0.25 * 0.25 + 8 * 0.25);
  const bbbYears = (731 * 0.25 + 730) / 365.25;
  near(bbb.yearsInPower, bbbYears);
  near(bbb.pointsPerYear!, bbb.points / bbbYears);
  near(aaa.points, 8 * 0.25 * 0.75 + 8 * 0.75);
  assert.equal(bbb.categories.economy.scoredActions, 2);
  assert.equal(bbb.categories.economy.lowData, false);
  assert.equal(bbb.categories.health.lowData, true);
  assert.equal(bbb.categories.defence.scoredActions, 0);
  assert.equal(r.preliminary, true);
  assert.equal(r.scoredActionCount, 3);
  assert.equal(r.flagged.length, 3);
});

test('category weights scale totals', () => {
  const actions = [action('a1'), action('a2', { category: 'health' })];
  const w = makeWeights(['economy', 'health'], { health: 0 });
  const r = computeScoring(actions, govs, { asOf: '2004-01-01', weights: w });
  near(r.parties.find((p) => p.partyId === 'bbb')!.points, 8);
});

test('empty inputs do not crash', () => {
  const r = computeScoring([], [], {});
  assert.deepEqual(r.parties, []);
  assert.equal(r.preliminary, true);
  assert.equal(isLowData(1), true);
  assert.equal(isLowData(2), false);
});

// ---- Per-action average and shrunk per-year figures ----
import { PRIOR_YEARS, aggregateParties } from '../src/lib/scoring.ts';

test('avgPerAction: mean with scorer range and count', () => {
  const actions = [
    action('a1'),
    action('a2', { scorers: [sc('A', [2, 2, 0, 0, 0]), sc('B', [4, 2, 0, 0, 0])] }), // mean 5, range 4..6
  ];
  const r = computeScoring(actions, govs, { asOf: '2004-01-01' });
  const bbb = r.parties.find((p) => p.partyId === 'bbb')!;
  assert.equal(bbb.avgActions, 2);
  near(bbb.avgPerAction!, (8 + 5) / 2);
  near(bbb.avgLow!, (6 + 4) / 2);
  near(bbb.avgHigh!, (10 + 6) / 2);
});

test('avgPerAction respects category weights (weight 0 drops the action from the count)', () => {
  const actions = [action('a1'), action('a2', { category: 'health', scorers: [sc('A', [1, 1, 0, 0, 0]), sc('B', [1, 1, 0, 0, 0])] })];
  const off = computeScoring(actions, govs, { asOf: '2004-01-01', weights: makeWeights(['economy', 'health'], { health: 0 }) });
  const b0 = off.parties.find((p) => p.partyId === 'bbb')!;
  assert.equal(b0.avgActions, 1);
  near(b0.avgPerAction!, 8);
  const dbl = computeScoring(actions, govs, { asOf: '2004-01-01', weights: makeWeights(['economy', 'health'], { health: 2 }) });
  near(dbl.parties.find((p) => p.partyId === 'bbb')!.avgPerAction!, (8 + 2 * 2) / 2);
});

test('shrunkPerYear = points / (years + PRIOR_YEARS), with range and weights', () => {
  assert.equal(PRIOR_YEARS, 5);
  const r = computeScoring([action('a1')], govs, { asOf: '2004-01-01' });
  const b = r.parties.find((p) => p.partyId === 'bbb')!;
  near(b.shrunkPerYear!, 8 / (b.yearsInPower + PRIOR_YEARS));
  near(b.shrunkLow!, 6 / (b.yearsInPower + PRIOR_YEARS));
  near(b.shrunkHigh!, 10 / (b.yearsInPower + PRIOR_YEARS));
  const w = computeScoring([action('a1')], govs, { asOf: '2004-01-01', weights: { economy: 2 } });
  near(w.parties.find((p) => p.partyId === 'bbb')!.shrunkPerYear!, 16 / (b.yearsInPower + PRIOR_YEARS));
});

test('tiny-tenure party: shrunk figure stays small while raw per-year explodes', () => {
  const tiny: Government = { id: 't1', leadParty: 'ccc', start: '2003-01-01', end: '2003-01-08', partners: [{ party: 'ccc', share: 1 }], level: 'centre' } as any;
  const r = computeScoring([action('t', { governmentId: 't1' })], [...govs, tiny], { asOf: '2004-01-01' });
  const c = r.parties.find((p) => p.partyId === 'ccc')!;
  assert.ok(c.yearsInPower < 0.05);
  assert.ok(c.pointsPerYear! > 300);
  assert.ok(c.shrunkPerYear! < 1.7);
  near(c.avgPerAction!, 8);
});

test('party with 0 scored actions has no per-action or shrunk figure (not NaN)', () => {
  const r = computeScoring([action('u', { scorers: [] })], govs, { asOf: '2004-01-01' });
  for (const p of r.parties) {
    assert.equal(p.avgPerAction, null);
    assert.equal(p.avgLow, null);
    assert.equal(p.avgHigh, null);
    assert.equal(p.shrunkPerYear, null);
    assert.equal(p.avgActions, 0);
  }
  const empty = aggregateParties([], { zzz: { weighted: 1, led: 1 } });
  assert.equal(empty[0].avgPerAction, null);
  assert.equal(empty[0].shrunkPerYear, null);
});

test("credit 'none' keeps the action score but gives no party credit", () => {
  const s = scoreAction(scorers);
  const inst = action('inst', { credit: 'none' });
  assert.deepEqual(creditAction(inst, s, byId), []);
  assert.equal(creditAction(action('party', { credit: 'party' }), s, byId).length > 0, true);
  assert.equal(creditAction(action('dflt'), s, byId).length > 0, true);
  // origin credit is skipped too
  assert.deepEqual(creditAction(action('inst2', { credit: 'none', originGovernmentId: 'c1' }), s, byId), []);
});

test("computeScoring counts 'none' actions separately and excludes them from party totals", () => {
  const base = computeScoring([action('p1')], govs, { level: 'all', asOf: '2020-01-01' });
  const withNone = computeScoring([action('p1'), action('n1', { credit: 'none' }), action('n2', { credit: 'none', scorers: [] })], govs, { level: 'all', asOf: '2020-01-01' });
  assert.equal(withNone.scoredActionCount, 1);
  assert.equal(withNone.noCreditScoredCount, 1);
  assert.equal(withNone.totalActionCount, 3);
  assert.equal(withNone.actionScores['n1'].scored, true);
  near(withNone.actionScores['n1'].points, 8);
  assert.equal(withNone.credits.some((c) => c.slug === 'n1'), false);
  assert.deepEqual(withNone.parties.map((p) => [p.partyId, p.points, p.scoredActions]), base.parties.map((p) => [p.partyId, p.points, p.scoredActions]));
  assert.equal(base.noCreditScoredCount, 0);
});
