#!/usr/bin/env node
// Reports stale entries (lastReviewed > 90 days) and thin coverage.
import { ACTIONS_DIR, LOW_DATA_MIN_ACTIONS, listMd, loadEntry, loadTaxonomy, loadGovernments, isoDate, daysSince } from './lib.mjs';

const STALE = 90;
const entries = listMd(ACTIONS_DIR).map(loadEntry).filter((e) => !e.error);
const govs = loadGovernments();

console.log(`Entries not reviewed in over ${STALE} days:`);
const stale = entries
  .map((e) => ({ slug: e.slug, last: isoDate(e.data.lastReviewed) }))
  .map((x) => ({ ...x, age: x.last ? daysSince(x.last) : Infinity }))
  .filter((x) => x.age > STALE)
  .sort((a, b) => b.age - a.age);
if (!stale.length) console.log('  none');
for (const s of stale) console.log(`  ${s.slug}  (${s.last ?? 'no date'}, ${Number.isFinite(s.age) ? s.age + ' days' : 'unknown'})`);

const scored = entries.filter((e) => e.data.scoring?.scorers?.length === 2);
console.log(`\nScored actions: ${scored.length} of ${entries.length}`);

const count = new Map(); // party -> category -> set of slugs
const bump = (party, cat, slug) => {
  if (!count.has(party)) count.set(party, new Map());
  const m = count.get(party);
  if (!m.has(cat)) m.set(cat, new Set());
  m.get(cat).add(slug);
};
for (const e of scored) {
  for (const id of [e.data.governmentId, e.data.originGovernmentId]) {
    const g = id && govs.get(id);
    if (!g) continue;
    const partners = g.partners?.length ? g.partners : [{ party: g.leadParty }];
    for (const p of partners) bump(p.party, e.data.category, e.slug);
  }
}

const cats = loadTaxonomy().map((c) => c.id);
console.log(`\nThin coverage (fewer than ${LOW_DATA_MIN_ACTIONS} scored actions per party and category):`);
if (!count.size) console.log('  no scored actions yet');
for (const [party, m] of [...count].sort()) {
  const thin = cats.filter((c) => (m.get(c)?.size ?? 0) < LOW_DATA_MIN_ACTIONS);
  console.log(`  ${party}: ${thin.length}/${cats.length} categories thin${thin.length ? ' -> ' + thin.join(', ') : ''}`);
}

const catTotals = cats.map((c) => [c, entries.filter((e) => e.data.category === c).length]).filter(([, n]) => n < LOW_DATA_MIN_ACTIONS);
console.log(`\nCategories with fewer than ${LOW_DATA_MIN_ACTIONS} actions overall:`);
console.log(catTotals.length ? catTotals.map(([c, n]) => `  ${c} (${n})`).join('\n') : '  none');
