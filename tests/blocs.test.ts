import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  blocOf, BLOC_LABEL, BLOC_IDS, HEADLINE_BLOCS, aggregateBlocs, computeBlocPoints, computeScoring, summarizeActions, PRIOR_YEARS,
} from '../src/lib/scoring.ts';
import { yearsInOffice } from '../src/lib/tenure.ts';
import { blocRowsHtml, blocHeatHtml, type PointsCtx, type BlocCtx } from '../src/lib/render-points.ts';
import type { Government, ScorableAction, ScorerEntry } from '../src/lib/types.ts';

const raw = JSON.parse(fs.readFileSync(new URL('./fixtures/governments-blocs.json', import.meta.url), 'utf8'));
const govs: Government[] = raw.centre.map((g: any) => ({ ...g, level: 'centre', leader: g.pm }));
const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const AS_OF = '2012-01-01';

const sc = (id: string, v: [number, number, number, number, number]): ScorerEntry => ({ id, reach: v[0], outcome: v[1], sustainability: v[2], process: v[3], delivery: v[4] });
// totals 10 and 6 -> mean 8, range 6..10
const scorers = [sc('A', [4, 3, 1, 0, 2]), sc('B', [4, 1, 1, 0, 0])];
const act = (slug: string, governmentId: string, over: Partial<ScorableAction> = {}): ScorableAction => ({ slug, category: 'economy', level: 'centre', governmentId, scorers, ...over });

test('blocOf follows the lead party', () => {
  assert.equal(blocOf({ leadParty: 'inc' }), 'inc');
  assert.equal(blocOf({ leadParty: 'bjp' }), 'bjp');
  for (const p of ['janata-party', 'jd', 'sjp', 'jp-s', '', null, undefined]) assert.equal(blocOf({ leadParty: p as any }), 'other');
  assert.equal(blocOf(undefined), 'other');
  assert.deepEqual([...BLOC_IDS], ['inc', 'bjp', 'other']);
  assert.deepEqual(HEADLINE_BLOCS, ['inc', 'bjp']);
  assert.equal(BLOC_LABEL.inc, 'INC-led');
  assert.equal(BLOC_LABEL.bjp, 'BJP-led');
});

test('partner credit and years roll up into the lead bloc; other-bloc partner credit stays in Other', () => {
  const actions = [act('a1', 'g-inc-upa'), act('a2', 'g-bjp-nda'), act('a3', 'g-oth', { category: 'health' })];
  const r = computeScoring(actions, govs, { asOf: AS_OF, categoryIds: ['economy', 'health'] });
  const by = Object.fromEntries(r.blocs.map((b) => [b.blocId, b]));
  // UPA: abc and inc credits both land in INC-led, so the bloc gets the full 8 points
  near(by.inc.points, 8);
  near(by.bjp.points, 8);
  // The Janata-led government's BJP partner share (0.4) stays in Other: bloc follows the lead party
  near(by.other.points, 8);
  assert.equal(by.inc.scoredActions, 1);
  // The party view is unchanged: partners are credited separately
  const inc = r.parties.find((p) => p.partyId === 'inc')!;
  near(inc.points, 8 * 0.6);
  const bjp = r.parties.find((p) => p.partyId === 'bjp')!;
  near(bjp.points, 8 * 0.7 + 8 * 0.4);
  // All years are kept: bloc years sum to the years in office of all governments
  const total = govs.reduce((n, g) => n + yearsInOffice(g, AS_OF), 0);
  near(r.blocs.reduce((n, b) => n + b.yearsInPower, 0), total);
  near(by.inc.yearsInPower, yearsInOffice(govs[0], AS_OF) + yearsInOffice(govs[3], AS_OF));
  assert.deepEqual(by.other.governmentIds, ['g-oth']);
  assert.deepEqual(by.inc.governmentIds, ['g-inc-a', 'g-inc-upa']);
});

test('average per action, range, shrunk per year and category cells', () => {
  const actions = [act('a1', 'g-inc-a'), act('a2', 'g-inc-a', { scorers: [sc('A', [1, 1, 1, 1, 1]), sc('B', [1, 1, 1, 1, 1])] }), act('h1', 'g-inc-a', { category: 'health' })];
  const [inc, bjp, other] = computeScoring(actions, govs, { asOf: AS_OF, categoryIds: ['economy', 'health'] }).blocs;
  assert.equal(inc.blocId, 'inc');
  assert.equal(inc.avgActions, 3);
  near(inc.avgPerAction!, (8 + 5 + 8) / 3);
  near(inc.avgLow!, (6 + 5 + 6) / 3);
  near(inc.avgHigh!, (10 + 5 + 10) / 3);
  near(inc.shrunkPerYear!, 21 / (inc.yearsInPower + PRIOR_YEARS));
  assert.equal(inc.categories.economy.scoredActions, 2);
  assert.equal(inc.categories.economy.lowData, false);
  assert.equal(inc.categories.health.lowData, true);
  near(inc.categories.economy.shrunkPerYear!, 13 / (inc.yearsInPower + PRIOR_YEARS));
  near(inc.categories.economy.avgPerAction!, 6.5);
  // blocs without scored actions have no figure, never NaN
  for (const b of [bjp, other]) {
    assert.equal(b.avgPerAction, null);
    assert.equal(b.shrunkPerYear, null);
    assert.equal(b.scoredActions, 0);
  }
  assert.equal(bjp.categories.economy.shrunkPerYear, null);
  assert.equal(inc.hasLowData, true);
});

test('weights apply and a zero weight drops a category from the average', () => {
  const actions = [act('a1', 'g-inc-a'), act('h1', 'g-inc-a', { category: 'health', scorers: [sc('A', [1, 1, 1, 1, 1]), sc('B', [1, 1, 1, 1, 1])] })];
  const [inc] = aggregateBlocs(computeScoring(actions, govs, { asOf: AS_OF }).credits, govs, { asOf: AS_OF, weights: { health: 0 } });
  assert.equal(inc.avgActions, 1);
  near(inc.avgPerAction!, 8);
});

test('client recompute with a period matches build-time maths and keeps only years inside the window', () => {
  const actions = [act('a1', 'g-inc-a'), act('a2', 'g-inc-upa'), act('a3', 'g-bjp-nda')];
  const res = computeScoring(actions, govs, { asOf: AS_OF });
  const credits = res.credits.map((c) => ({ ...c, year: c.slug === 'a1' ? 2001 : c.slug === 'a2' ? 2010 : 2006 }));
  const all = computeBlocPoints({ credits, governments: govs, asOf: AS_OF });
  assert.deepEqual(all.map((b) => b.points), res.blocs.map((b) => b.points));
  const post = computeBlocPoints({ credits, governments: govs, asOf: AS_OF, yearFrom: 2005 });
  const inc = post.find((b) => b.blocId === 'inc')!;
  assert.equal(inc.scoredActions, 1);
  near(inc.yearsInPower, yearsInOffice({ start: '2009-01-01', end: null }, AS_OF));
  // clipped: g-inc-a lies wholly before 2005
  assert.ok(!inc.governmentIds.includes('g-inc-a'));
});

test('credit: none actions earn no bloc credit', () => {
  const res = computeScoring([act('i1', 'g-inc-a', { credit: 'none' })], govs, { asOf: AS_OF });
  assert.equal(res.blocs[0].scoredActions, 0);
  assert.equal(res.blocs[0].avgPerAction, null);
});

test('originator credit goes to the originating government bloc', () => {
  const res = computeScoring([act('o1', 'g-inc-upa', { originGovernmentId: 'g-bjp-nda' })], govs, { asOf: AS_OF });
  const by = Object.fromEntries(res.blocs.map((b) => [b.blocId, b]));
  near(by.inc.points, 8);
  near(by.bjp.points, 2);
});

test('summarizeActions: mean of the listed actions, never NaN', () => {
  const s = summarizeActions([{ points: 8, low: 6, high: 10, scored: true }, { points: 2, low: 0, high: 4, scored: true }, { points: 0, low: 0, high: 0, scored: false }]);
  assert.equal(s.count, 3);
  assert.equal(s.scored, 2);
  near(s.avg!, 5);
  near(s.avgLow!, 3);
  near(s.avgHigh!, 7);
  assert.equal(s.lowData, false);
  const e = summarizeActions([]);
  assert.equal(e.avg, null);
  assert.equal(e.lowData, true);
});

const ctx: PointsCtx = { parties: {}, categories: [{ id: 'economy', name: 'Economy' }, { id: 'health', name: 'Health' }] };
const bctx: BlocCtx = { governments: Object.fromEntries(govs.map((g) => [g.id, { leader: g.leader, start: g.start, end: g.end, lead: g.leadParty }])) };

test('bloc table: INC-led then BJP-led, Other collapsed with its governments listed, no ranking words', () => {
  const res = computeScoring([act('a1', 'g-inc-a'), act('a2', 'g-bjp-nda'), act('a3', 'g-oth')], govs, { asOf: AS_OF, categoryIds: ['economy', 'health'] });
  const html = blocRowsHtml(res.blocs, ctx, bctx);
  assert.ok(html.indexOf('INC-led') < html.indexOf('BJP-led'));
  assert.ok(html.indexOf('BJP-led') < html.indexOf('Other governments'));
  assert.match(html, /class="[^"]*short-row/);
  assert.match(html, /PM Other/);
  assert.doesNotMatch(html, /\b(winner|best|worst|rank(ed|ing)?)\b/i);
  const heat = blocHeatHtml(res.blocs, ctx);
  assert.match(heat, /INC-led/);
  assert.match(heat, /BJP-led/);
  assert.doesNotMatch(heat, /NaN/);
  assert.doesNotMatch(html, /NaN/);
});

test('bloc table with no scored actions says so instead of showing figures', () => {
  const res = computeScoring([], govs, { asOf: AS_OF });
  const html = blocRowsHtml(res.blocs, ctx, bctx);
  assert.doesNotMatch(html, /NaN/);
  assert.match(html, /No scored actions/);
});
