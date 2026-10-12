import test from 'node:test';
import assert from 'node:assert/strict';
import { srcList, fmtLooseDate, looseDateIso, daysBetween, dossiersInCategory, dossiersForSubs, CLAIM_TYPE_INFO, CLAIM_TYPE_ORDER, isClaimType } from '../src/lib/dossiers.ts';

test('srcList normalises numbers, lists and junk', () => {
  assert.deepEqual(srcList(3), [3]);
  assert.deepEqual(srcList([3, 1, 3]), [1, 3]);
  assert.deepEqual(srcList(undefined), []);
  assert.deepEqual(srcList(['a', 0, 2]), [2]);
});

test('loose dates', () => {
  assert.equal(fmtLooseDate('2025-06-24'), '24 Jun 2025');
  assert.equal(fmtLooseDate('2025-06'), '2025-06');
  assert.equal(fmtLooseDate(new Date('2025-06-24T00:00:00Z')), '24 Jun 2025');
  assert.equal(looseDateIso('2025'), '2025');
  assert.equal(looseDateIso('later'), undefined);
  assert.equal(daysBetween('2026-10-01', new Date('2026-10-12T00:00:00Z')), 11);
});

test('claim types: five, each with a label and definition', () => {
  assert.deepEqual([...CLAIM_TYPE_ORDER].sort(), ['allegation', 'data', 'event', 'finding', 'official-statement']);
  for (const t of CLAIM_TYPE_ORDER) assert.ok(CLAIM_TYPE_INFO[t].label && CLAIM_TYPE_INFO[t].definition);
  assert.ok(isClaimType('allegation') && !isClaimType('rumour'));
});

test('dossier selection by category and sub-category', () => {
  const mk = (slug: string, category: string, subcategories: string[], asOf: string) => ({ slug, data: { category, subcategories, asOf } });
  const all = [mk('a', 'elections', ['x'], '2026-01-01'), mk('b', 'elections', ['y'], '2026-05-01'), mk('c', 'media', ['x'], '2026-06-01'), mk('d', 'elections', ['x', 'y'], '2026-02-01')];
  assert.deepEqual(dossiersInCategory(all, 'elections', ['x']).map((d) => d.slug), ['d', 'a', 'b']);
  assert.deepEqual(dossiersForSubs(all, 'elections', ['y']).map((d) => d.slug), ['b', 'd']);
  assert.deepEqual(dossiersForSubs(all, 'elections', []).map((d) => d.slug), []);
});
