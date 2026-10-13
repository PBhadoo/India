import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEntry } from '../scripts/lib.mjs';
import { checkReform, reformCoverage, reformTexts, blocOfLead } from '../scripts/audit-lib.mjs';

const fx = (n) => loadEntry(path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', n));

test('a complete reform block passes with no messages', () => {
  const e = fx('reform-valid.md');
  assert.equal(e.error, undefined);
  assert.deepEqual(checkReform(e.data), { errors: [], warnings: [] });
  assert.equal(reformTexts(e.data).length, 10);
});

test('an absent reform block is not an error and not a per-entry warning', () => {
  assert.deepEqual(checkReform({ sources: [{}, {}] }), { errors: [], warnings: [] });
});

test('structure errors: asOf, empty madeBy, source index range and type, non-string point, bare strings, non-list', () => {
  const { errors } = checkReform(fx('reform-invalid.md').data);
  const has = (re) => assert.ok(errors.some((m) => re.test(m)), `expected ${re} in ${JSON.stringify(errors)}`);
  has(/reform\.asOf must be YYYY-MM-DD/);
  has(/reform\.keep\[0\]\.madeBy is empty/);
  has(/reform\.keep\[1\]\.source 7 is not a source index \(1 to 2\)/);
  has(/reform\.keep\[2\]\.source "1" is not a source index/);
  has(/reform\.change\[0\] must be an object/);
  has(/reform\.change\[1\]\.point is not a string/);
  has(/reform\.repeal must be a list/);
});

test('quota shortfalls and unknown keys are warnings, not errors', () => {
  const r = checkReform(fx('reform-thin.md').data);
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.some((m) => /1 keep point /.test(m)));
  assert.ok(r.warnings.some((m) => /0 change points/.test(m)));
  assert.ok(r.warnings.some((m) => /reform\.extra is not a known key/.test(m)));
});

test('a reform that is not an object is an error', () => {
  assert.equal(checkReform({ reform: [] }).errors.length, 1);
  assert.equal(checkReform({ reform: 'x' }).errors.length, 1);
});

test('blocOfLead mirrors the scoring rule', () => {
  assert.equal(blocOfLead('inc'), 'inc');
  assert.equal(blocOfLead('bjp'), 'bjp');
  assert.equal(blocOfLead('jd'), 'other');
  assert.equal(blocOfLead(undefined), 'other');
});

test('reformCoverage averages per stance by bloc and counts actions without a block', () => {
  const govs = new Map([['g1', { leadParty: 'inc' }], ['g2', { leadParty: 'bjp' }], ['g3', { leadParty: 'jd' }]]);
  const r = (k, c, p) => ({ keep: Array(k).fill({}), change: Array(c).fill({}), repeal: Array(p).fill({}) });
  const cov = reformCoverage([
    { slug: 'a', governmentId: 'g1', reform: r(3, 2, 1) },
    { slug: 'b', governmentId: 'g1', reform: r(1, 4, 0) },
    { slug: 'c', governmentId: 'g1' },
    { slug: 'd', governmentId: 'g2', reform: r(2, 2, 0) },
    { slug: 'e', governmentId: 'g3' },
    { slug: 'f', governmentId: 'g2', credit: 'none', reform: r(1, 1, 1) },
  ], govs);
  assert.equal(cov.total, 6);
  assert.equal(cov.withReform, 4);
  assert.equal(cov.blocs.inc.actions, 3);
  assert.equal(cov.blocs.inc.withReform, 2);
  assert.equal(cov.blocs.inc.avgKeep, 2);
  assert.equal(cov.blocs.inc.avgChange, 3);
  assert.equal(cov.blocs.inc.avgRepeal, 0.5);
  assert.equal(cov.blocs.bjp.avgKeep, 2);
  assert.equal(cov.blocs.other.avgKeep, null);
  assert.equal(cov.blocs.institution.withReform, 1);
});
