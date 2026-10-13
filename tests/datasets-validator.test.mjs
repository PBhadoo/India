import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLoadedWords } from '../scripts/lib.mjs';
import { SOURCE_TYPES as audit_types, checkIndicators, checkPromises, indicatorCoverage, promiseMatrix, DOSSIER_KINDS } from '../scripts/audit-lib.mjs';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'data');
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const ctx = { words: loadLoadedWords().map((w) => w.toLowerCase()) };
const has = (list, re) => list.some((m) => re.test(m));
const clone = (x) => JSON.parse(JSON.stringify(x));

test('debate is an allowed dossier kind', () => assert.ok(DOSSIER_KINDS.includes('debate')));

test('fixture indicators pass with no errors', () => {
  const r = checkIndicators(read('indicators.json'), ctx);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test('indicator rules: periods exist, numeric values, source, caveats, at least 3 values', () => {
  const d = clone(read('indicators.json'));
  const i = d.indicators[0];
  i.values[0].period = 'nope';
  i.values[1].value = '8.4';
  i.source.url = 'http://example.org/x';
  i.caveats = [];
  d.indicators[1].values = d.indicators[1].values.slice(0, 1);
  delete d.indicators[2].source;
  const r = checkIndicators(d, ctx);
  for (const re of [/period "nope" is not in periods/, /values\[1\]\.value must be a number/, /source\.url must be https/, /caveats must be a non-empty list/, /needs at least 2 period values \(has 1\)/, /source missing/]) {
    assert.ok(has(r.errors, re), `missing ${re}\n${r.errors.join('\n')}`);
  }
});

test('indicator rules: duplicate ids and periods, bad bloc and dates, no global caveat, one-sided coverage, loaded words', () => {
  const d = clone(read('indicators.json'));
  d.periods.push({ ...d.periods[0] });
  d.periods[1].bloc = 'Congress';
  d.periods[2].end = '2000-01-01';
  d.indicators.push({ ...d.indicators[0] });
  d.indicators[0].caveats = ['The series is published monthly.'];
  d.indicators[3].values = d.indicators[3].values.filter((v) => ['upa1', 'upa2', 'modi2'].includes(v.period)).slice(0, 2).concat([{ period: 'upa1', value: 1 }]);
  d.indicators[4].values = d.indicators[4].values.filter((v) => ['upa1', 'upa2', 'rao'].includes(v.period));
  d.indicators[5].name = 'A disastrous poverty series';
  const r = checkIndicators(d, ctx);
  assert.ok(has(r.errors, /periods\[8\]\.id "rao" is duplicated/));
  assert.ok(has(r.errors, /bloc must be one of INC\|BJP\|Other/));
  assert.ok(has(r.errors, /ends before it starts/));
  assert.ok(has(r.errors, /id is duplicated/));
  assert.ok(has(r.errors, /appears twice/));
  assert.ok(has(r.warnings, /no global-context caveat/));
  assert.ok(has(r.warnings, /only one of the INC-led and BJP-led groups/));
  assert.ok(has(r.warnings, /loaded word "disastrous"/));
});

test('indicators: non-object input is an error, and coverage counts values per period', () => {
  assert.ok(has(checkIndicators(null).errors, /must be an object/));
  assert.ok(has(checkIndicators({ periods: 1, indicators: {} }).errors, /periods must be a list/));
  const cov = indicatorCoverage(read('indicators.json'));
  assert.equal(cov.length, 8);
  assert.equal(cov.find((c) => c.id === 'upa1').n, 6);
  assert.equal(cov.find((c) => c.id === 'modi3').n, 3);
  assert.equal(cov.find((c) => c.id === 'rao').of, 6);
});

test('fixture promises pass: 8 per party per election, ids unique', () => {
  const list = read('promises.json');
  assert.equal(list.length, 112);
  const r = checkPromises(list, ctx);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  for (const [, row] of promiseMatrix(list)) assert.deepEqual(row, { inc: 8, bjp: 8 });
});

test('promise rules: unique ids, party, election, status, https evidence source, required text', () => {
  const list = clone(read('promises.json'));
  list[1].id = list[0].id;
  list[2].party = 'sp';
  list[3].election = 2001;
  list[4].status = 'won';
  list[5].evidenceSource.url = 'http://example.org/e';
  list[6].manifestoSource.url = 'not a url';
  list[7].evidence = '';
  list[8].asOf = '13/10/2026';
  delete list[9].evidenceSource;
  const r = checkPromises(list, ctx);
  for (const re of [/id is duplicated/, /party must be one of inc\|bjp/, /election must be one of/, /status must be one of delivered\|partly-delivered.*not-in-power/, /evidenceSource\.url must be https/, /manifestoSource\.url must be https/, /evidence missing/, /asOf must be YYYY-MM-DD/, /evidenceSource missing/]) {
    assert.ok(has(r.errors, re), `missing ${re}\n${r.errors.join('\n')}`);
  }
});

test('promise counts: unequal or non-8 counts per election warn, never error', () => {
  const list = clone(read('promises.json'));
  const drop = list.findIndex((p) => p.party === 'bjp' && p.election === 2014);
  list.splice(drop, 1);
  let r = checkPromises(list, ctx);
  assert.deepEqual(r.errors, []);
  assert.ok(has(r.warnings, /2014: unequal promise counts \(inc 8, bjp 7\)/));
  const only = ['inc', 'bjp'].flatMap((party) => list.filter((p) => p.election === 1998 && p.party === party).slice(0, 7));
  r = checkPromises(only, ctx);
  assert.ok(has(r.warnings, /1998: 7 promises per party \(expected 8\)/));
});

test('promise wording: loaded words warn; id prefix mismatch warns', () => {
  const list = clone(read('promises.json'));
  list[0].text = 'A glorious pledge on prices.';
  list[1].id = 'inc-1999-001';
  const r = checkPromises(list, ctx);
  assert.ok(has(r.warnings, /loaded word "glorious"/));
  assert.ok(has(r.warnings, /id should start with "inc-1998-"/));
});

test('absent data is the caller\'s case: a non-list promises file is an error', () => {
  assert.ok(has(checkPromises({}).errors, /must be a list/));
});

test('not-in-power: valid status; warns when used for a party-election the party governed, or missing for one it did not', () => {
  const list = clone(read('promises.json'));
  assert.ok(list.some((p) => p.status === 'not-in-power' && p.party === 'inc' && p.election === 2014));
  assert.ok(!list.some((p) => p.status === 'not-in-power' && p.party === 'bjp' && p.election === 2014));
  const a = list.find((p) => p.party === 'bjp' && p.election === 2014);
  a.status = 'not-in-power';
  const b = list.find((p) => p.party === 'inc' && p.election === 1998);
  b.status = 'delivered';
  const r = checkPromises(list, ctx);
  assert.deepEqual(r.errors, []);
  assert.ok(has(r.warnings, /bjp-2014-001.*not-in-power but bjp governed after 2014/) || has(r.warnings, /not-in-power but bjp governed after 2014/));
  assert.ok(has(r.warnings, /should be not-in-power: inc did not form the Union government after 1998/));
});

test('indicator source types: international-estimate allowed for indicators only; two values warn, one errors', () => {
  const d = clone(read('indicators.json'));
  d.indicators[0].source.type = 'international-estimate';
  d.indicators[1].values = d.indicators[1].values.filter((v) => ['upa1', 'modi2'].includes(v.period));
  let r = checkIndicators(d, ctx);
  assert.deepEqual(r.errors, []);
  assert.ok(has(r.warnings, /fixture-inflation\) has only 2 period values.*two data points only/));
  d.indicators[2].source.type = 'blog';
  r = checkIndicators(d, ctx);
  assert.ok(has(r.errors, /source\.type must be one of .*international-estimate/));
  assert.ok(!audit_types.includes('international-estimate'));
});
