import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEntry, loadTaxonomy, loadLoadedWords } from '../scripts/lib.mjs';
import { checkDossier, dossierNonStringFields } from '../scripts/audit-lib.mjs';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'dossiers');
const ctx = (now = '2026-10-12') => ({ categories: loadTaxonomy(), words: loadLoadedWords().map((w) => w.toLowerCase()), now: new Date(now + 'T00:00:00Z') });
const load = (f) => loadEntry(path.join(dir, f));
const has = (list, re) => list.some((m) => re.test(m));

test('valid fixture dossiers pass with no errors', () => {
  for (const f of fs.readdirSync(dir).filter((x) => x.startsWith('dossier-') && !x.includes('invalid'))) {
    const r = checkDossier(load(f), ctx());
    assert.deepEqual(r.errors, [], `${f}: ${r.errors.join('; ')}`);
  }
});

test('invalid fixture reports every rule it breaks', () => {
  const e = load('dossier-invalid.md');
  const r = checkDossier(e, ctx());
  const want = [
    /unknown category/,
    /kind must be one of/,
    /lastReviewed must be YYYY-MM-DD/,
    /summary is 241 chars/,
    /needs at least 5 sources/,
    /needs at least 2 primary/,
    /sources\[0\]\.url must be https/,
    /timeline\[0\]\.source 9 is not a source index/,
    /claims\[0\]\.type must be one of/,
    /claims\[1\] is an allegation and needs madeBy/,
    /claims\[1\] is an allegation and needs status/,
    /claims\[2\]\.claim is not a string/,
    /tables\[0\]\.rows\[0\] has 1 cells but there are 2 columns/,
    /notShown needs at least 2 items/,
    /body cites \[7\]/,
  ];
  for (const re of want) assert.ok(has(r.errors, re), `missing error ${re}\n${r.errors.join('\n')}`);
  assert.ok(has(r.warnings, /loaded word "disastrous"/));
  assert.ok(has(r.warnings, /allegation with no recorded response/));
});

test('allegation without a response is a warning, with madeBy and status it is not an error', () => {
  const e = load('dossier-ongoing-example-roll-revision.md');
  e.data.claims[2] = { ...e.data.claims[2] };
  delete e.data.claims[2].response;
  const r = checkDossier(e, ctx());
  assert.deepEqual(r.errors, []);
  assert.ok(has(r.warnings, /claims\[2\] is an allegation with no recorded response/));
});

test('stale asOf warns only for ongoing dossiers older than 45 days', () => {
  const ongoing = load('dossier-ongoing-example-roll-revision.md'); // asOf 2026-10-10
  assert.ok(!has(checkDossier(ongoing, ctx('2026-11-24')).warnings, /days old/)); // 45 days: ok
  assert.ok(has(checkDossier(ongoing, ctx('2026-11-25')).warnings, /46 days old/));
  const settled = load('dossier-settled-example-press-council.md'); // asOf 2026-08-01, settled
  assert.ok(!has(checkDossier(settled, ctx('2026-10-12')).warnings, /days old/));
});

test('source index lists and the 5-source / 2-primary thresholds', () => {
  const e = load('dossier-ongoing-example-roll-revision.md');
  e.data.claims[0].source = [1, 3];
  assert.deepEqual(checkDossier(e, ctx()).errors, []);
  e.data.claims[0].source = [1, 7];
  assert.ok(has(checkDossier(e, ctx()).errors, /claims\[0\]\.source 7/));
  e.data.claims[0].source = 3;
  e.data.sources = e.data.sources.slice(0, 4);
  assert.ok(has(checkDossier(e, ctx()).errors, /at least 5 sources \(has 4\)/));
  e.data.sources = e.data.sources.map((s) => ({ ...s, type: 'reputable-media' }));
  e.data.sources.push(e.data.sources[0]);
  assert.ok(has(checkDossier(e, ctx()).errors, /primary, official-data or court sources \(has 0\)/));
});

test('dossierNonStringFields finds object-valued text', () => {
  assert.deepEqual(dossierNonStringFields({ summary: 's', claims: [{ claim: { a: 1 }, madeBy: 'x' }], notShown: ['ok', { a: 1 }] }), ['claims[0].claim', 'notShown[1]']);
  assert.deepEqual(dossierNonStringFields({ title: 't', timeline: [{ event: 'e', actor: 'a' }] }), []);
});

test('partial timeline dates (YYYY, YYYY-MM) are accepted; free text is warned', () => {
  const e = load('dossier-ongoing-example-roll-revision.md');
  e.data.timeline[0].date = '2026';
  e.data.timeline[1].date = '2026-05';
  assert.ok(!has(checkDossier(e, ctx()).warnings, /not YYYY/));
  e.data.timeline[1].date = 'May-ish';
  assert.ok(has(checkDossier(e, ctx()).warnings, /not YYYY, YYYY-MM or YYYY-MM-DD/));
});
