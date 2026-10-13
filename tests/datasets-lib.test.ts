import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  loadIndicators, loadPromises, promiseSummary, indicatorBars, indicatorDomains, PROMISE_STATUSES, PROMISE_STATUS_RULES,
  PROMISE_ELECTIONS, PROMISE_PARTIES, BLOC_SLOT, GOVERNED_ELECTIONS, GOVERNED_RULE, governedBy, PROMISE_STATUS_LABEL,
} from '../src/lib/datasets.ts';
import * as audit from '../scripts/audit-lib.mjs';

const fixtures = path.join(import.meta.dirname, 'fixtures', 'data');

test('missing data files give empty data and never throw', () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'nodata-'));
  const i = loadIndicators(empty);
  const p = loadPromises(empty);
  assert.equal(i.present, false);
  assert.deepEqual(i.data, { periods: [], indicators: [] });
  assert.equal(p.present, false);
  assert.deepEqual(p.data, []);
  assert.deepEqual([...i.issues, ...p.issues], []);
});

test('malformed files are tolerated and reported as issues', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'baddata-'));
  fs.writeFileSync(path.join(d, 'indicators.json'), '{ not json');
  fs.writeFileSync(path.join(d, 'promises.json'), '{"a":1}');
  assert.equal(loadIndicators(d).issues.length, 1);
  assert.equal(loadPromises(d).issues.length, 1);
  assert.deepEqual(loadPromises(d).data, []);
});

test('fixture files load fully; invalid entries and repeated ids are dropped one by one', () => {
  const i = loadIndicators(fixtures);
  assert.equal(i.issues.length, 0);
  assert.equal(i.data.periods.length, 8);
  assert.equal(i.data.indicators.length, 6);
  assert.deepEqual(indicatorDomains(i.data.indicators), ['economy', 'health', 'education', 'social-welfare']);
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mixed-'));
  const list = JSON.parse(fs.readFileSync(path.join(fixtures, 'promises.json'), 'utf8'));
  list[1].id = list[0].id;
  list[2].status = 'won';
  fs.writeFileSync(path.join(d, 'promises.json'), JSON.stringify(list));
  const p = loadPromises(d);
  assert.equal(p.data.length, 110);
  assert.equal(p.issues.length, 2);
});

test('promise summary: same shape and denominator for both parties', () => {
  const p = loadPromises(fixtures).data;
  const s = promiseSummary(p);
  for (const party of PROMISE_PARTIES) {
    assert.deepEqual([...s[party].keys()], [...PROMISE_ELECTIONS]);
    for (const c of s[party].values()) {
      assert.equal(c.total, 8);
      assert.equal(Object.values(c.byStatus).reduce((a, b) => a + b, 0), 8);
    }
  }
  const none = promiseSummary([]);
  assert.equal(none.inc.get(2014)!.total, 0);
});

test('status rules are the Addendum v3 wording', () => {
  assert.equal(PROMISE_STATUS_RULES['delivered'], 'enacted/implemented at the scope promised, per official data or law');
  assert.equal(PROMISE_STATUS_RULES['abandoned'], 'officially dropped');
  assert.equal(PROMISE_STATUS_RULES['unclear'], 'evidence insufficient');
  assert.deepEqual(Object.keys(PROMISE_STATUS_RULES), [...PROMISE_STATUSES]);
});

test('page constants agree with the validator constants', () => {
  assert.deepEqual([...PROMISE_STATUSES], audit.PROMISE_STATUSES);
  assert.deepEqual([...PROMISE_ELECTIONS], audit.PROMISE_ELECTIONS);
  assert.deepEqual([...PROMISE_PARTIES], audit.PROMISE_PARTIES);
  assert.deepEqual(GOVERNED_ELECTIONS, audit.GOVERNED_ELECTIONS);
});

test('bars: chronological, missing periods are null (not zero), scale includes zero, negatives go left', () => {
  const { data } = loadIndicators(fixtures);
  const growth = indicatorBars(data.indicators[0], data.periods);
  assert.equal(growth.rows.length, 8);
  assert.ok(growth.rows.every((r, i, a) => i === 0 || a[i - 1].period.start <= r.period.start));
  const infl = indicatorBars(data.indicators[1], data.periods);
  assert.equal(infl.rows.find((r) => r.period.id === 'rao')!.value, null);
  assert.equal(infl.rows.find((r) => r.period.id === 'rao')!.width, 0);
  const deficit = indicatorBars(data.indicators[2], data.periods);
  assert.ok(deficit.zero > 0 && deficit.lo < 0);
  for (const r of deficit.rows) assert.ok(r.left + r.width <= deficit.zero + 1e-9 && r.left >= 0);
  const pos = indicatorBars(data.indicators[0], data.periods);
  assert.equal(pos.zero, 0);
  for (const r of pos.rows) assert.ok(r.left + r.width <= 100 && r.left + r.width >= 0);
  const peak = Math.max(...pos.rows.map((r) => r.left + r.width));
  assert.ok(peak <= 80 + 1e-9, 'room is left for the value label');
});

test('bloc colours reuse the site slots: INC slot 1, BJP slot 6, Other neutral 0', () => {
  assert.deepEqual(BLOC_SLOT, { inc: 1, bjp: 6, other: 0 });
});

test('not-in-power: labelled, ruled, and kept apart from delivery counts', () => {
  assert.equal(PROMISE_STATUS_LABEL['not-in-power'], 'Not in power: untested');
  assert.match(PROMISE_STATUS_RULES['not-in-power'], /did not form \(or lead\) the Union government after that election/);
  assert.match(GOVERNED_RULE, /INC-led 2004 and 2009; BJP-led 1998, 1999, 2014, 2019 and 2024/);
  assert.ok(governedBy('inc', 2004) && governedBy('inc', 2009) && !governedBy('inc', 2014));
  assert.ok(governedBy('bjp', 1998) && governedBy('bjp', 2024) && !governedBy('bjp', 2004));
  const s = promiseSummary(loadPromises(fixtures).data);
  for (const party of PROMISE_PARTIES) for (const [year, c] of s[party]) {
    if (governedBy(party, year)) assert.equal(c.byStatus['not-in-power'], 0);
    else assert.equal(c.byStatus['not-in-power'], 8);
  }
});
