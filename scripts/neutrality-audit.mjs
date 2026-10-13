#!/usr/bin/env node
// Neutrality audit over all actions. Always exits 0. `--md` also writes docs/NEUTRALITY-REPORT.md.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, ACTIONS_DIR, DOSSIERS_DIR, listMd, loadEntry, loadTaxonomy, loadGovernments, loadLoadedWords, readJson, isoDate, daysSince, LOW_DATA_MIN_ACTIONS } from './lib.mjs';
import {
  promiseMatrix, indicatorCoverage, PROMISE_PARTIES, PROMISE_STATUSES, PROMISES_PER_PARTY_ELECTION,
  countBy, DOSSIER_STALE_DAYS, eraOf, hasPrimarySource, loadedHits, scorerDisagreements, asymmetry, partiesOf, mean, round,
} from './audit-lib.mjs';

const MIN_PER_PARTY = 3;
const entries = listMd(ACTIONS_DIR).map(loadEntry).filter((e) => !e.error).map((e) => ({ slug: e.slug, ...e.data, date: isoDate(e.data.date), body: e.content }));
const dossiers = listMd(DOSSIERS_DIR).map(loadEntry).filter((e) => !e.error).map((e) => ({ slug: e.slug, ...e.data }));
const govs = loadGovernments();
const parties = readJson(path.join(ROOT, 'src', 'data', 'parties.json'), []);
const partyName = new Map(parties.map((p) => [p.id, p.short ?? p.id]));
const pn = (id) => partyName.get(id) ?? id;
const cats = loadTaxonomy();
const words = loadLoadedWords();

const lines = [];
const out = (s = '') => lines.push(s);
const table = (head, rows) => {
  out(`| ${head.join(' | ')} |`);
  out(`|${head.map(() => '---').join('|')}|`);
  for (const r of rows) out(`| ${r.join(' | ')} |`);
  out();
};
const pct = (n, total) => (total ? `${round((100 * n) / total, 1)}%` : '0%');
const total = entries.length;

// credit: none actions earn no party credit, so they are left out of the party breakdowns below.
const lead = (e) => (e.credit === 'none' ? undefined : govs.get(e.governmentId)?.leadParty);
const credited = (e) => (e.credit === 'none' ? [] : partiesOf(govs.get(e.governmentId)));

out('# Neutrality report');
out();
out(`Generated ${new Date().toISOString().slice(0, 10)} from ${total} actions. Counts show coverage, not merit; an imbalance prompts a look at what is missing, not a conclusion.`);
out();

const noCredit = entries.filter((e) => e.credit === 'none');
out(`Actions with \`credit: none\` (independent institution, scored but earning no party points): ${noCredit.length} of ${total}.`);
out(noCredit.length ? noCredit.map((e) => `- ${e.slug}${e.institution ? ` (${e.institution})` : ''}`).join('\n') : 'None.');
out();

out('## Entries by lead party of the implementing government');
const byLead = countBy(entries, lead);
table(['Lead party', 'Entries', 'Share'], [...byLead].map(([k, v]) => [pn(k) ?? 'unknown', v, pct(v, total)]));

out('## Entries by any party in the implementing coalition');
const byParty = countBy(entries, credited);
const allParties = parties.map((p) => p.id);
table(['Party', 'Entries', 'Share'], [...byParty].map(([k, v]) => [pn(k), v, pct(v, total)]));

out('## Entries by government');
table(['Government', 'Label', 'Entries'], [...countBy(entries, (e) => e.governmentId)].map(([k, v]) => [k, govs.get(k)?.label ?? '?', v]));

out('## Entries by decade of action');
table(['Decade', 'Entries'], [...countBy(entries, (e) => eraOf(e.date))].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => [k, v]));

out('## Entries by level');
table(['Level', 'Entries'], [...countBy(entries, (e) => e.level)].map(([k, v]) => [k, v]));

out('## Entries by category');
const byCat = countBy(entries, (e) => e.category);
table(['Category', 'Entries'], cats.map((c) => [c.id, byCat.get(c.id) ?? 0]).sort((a, b) => b[1] - a[1]));

const thinCats = cats.filter((c) => (byCat.get(c.id) ?? 0) < LOW_DATA_MIN_ACTIONS);
out(`## Categories with fewer than ${LOW_DATA_MIN_ACTIONS} entries (${thinCats.length})`);
out(thinCats.length ? thinCats.map((c) => `- ${c.id} (${byCat.get(c.id) ?? 0})`).join('\n') : 'None.');
out();

const ledParties = [...new Set([...govs.values()].map((g) => g.leadParty))].filter(Boolean);
const thinParties = ledParties.filter((p) => (byLead.get(p) ?? 0) < MIN_PER_PARTY);
out(`## Parties that have led a government but have fewer than ${MIN_PER_PARTY} entries (${thinParties.length})`);
out(thinParties.length ? thinParties.map((p) => `- ${pn(p)} (${byLead.get(p) ?? 0})`).join('\n') : 'None.');
out();

const noPrimary = entries.filter((e) => !hasPrimarySource(e.sources));
out(`## Entries without a primary, official-data or court source (${noPrimary.length})`);
out(noPrimary.length ? noPrimary.map((e) => `- ${e.slug} (${pn(lead(e))})`).join('\n') : 'None.');
out();

out('## Sources');
out(`Average sources per entry: ${round(mean(entries.map((e) => e.sources?.length ?? 0)))}`);
out();
table(['Lead party', 'Avg sources', 'Share with a primary-grade source'], [...byLead.keys()].map((p) => {
  const g = entries.filter((e) => lead(e) === p);
  return [pn(p), round(mean(g.map((e) => e.sources?.length ?? 0))), pct(g.filter((e) => hasPrimarySource(e.sources)).length, g.length)];
}));

out('## Wording lint (scripts/loaded-words.json)');
const hits = [];
for (const e of entries) {
  const texts = [e.title, e.summary, ...(e.facts ?? []), ...(e.why?.stated ?? []), ...(e.why?.criticism ?? []),
    ...[...(e.benefits ?? []), ...(e.concerns ?? [])].flatMap((p) => [p.point, p.evidence]), e.body];
  const found = [...new Set(texts.flatMap((t) => loadedHits(t, words)))];
  if (found.length) hits.push(`- ${e.slug}: ${found.join(', ')}`);
}
out(hits.length ? hits.join('\n') : 'No hits.');
out();

out('## Asymmetry by lead party (benefit vs concern points, evidence)');
out('Evidence per bullet is the average number of distinct [n] citations in each benefit or concern.');
out();
table(['Lead party', 'n', 'Avg benefits', 'Avg concerns', 'Avg citations/bullet', 'Bullets with evidence'],
  [...byLead.keys()].map((p) => {
    const a = asymmetry(entries.filter((e) => lead(e) === p));
    return [pn(p), a.n, a.avgBenefits, a.avgConcerns, a.avgEvidencePerBullet, pct(a.bulletsWithEvidence * 100, 100)];
  }));
const all = asymmetry(entries);
out(`All entries: ${all.avgBenefits} benefits vs ${all.avgConcerns} concerns on average; ${all.avgEvidencePerBullet} citations per bullet.`);
out();

out('## Scorer disagreements (>= 2 points on a criterion)');
const dis = [];
let scored = 0;
for (const e of entries) {
  const sc = e.scoring?.scorers;
  if (sc?.length === 2) scored++;
  const d = scorerDisagreements(sc);
  if (d.length) dis.push(`- ${e.slug}: ${d.map((x) => `${x.criterion} (A ${x.a}, B ${x.b})`).join('; ')}`);
}
out(`Scored entries: ${scored} of ${total}.`);
out();
out(dis.length ? dis.join('\n') : 'None.');
out();

out('## Dossier coverage');
out(`Dossiers: ${dossiers.length}. Dossiers are unscored and carry no party points.`);
out();
const dCat = countBy(dossiers, (e) => e.category);
table(['Category', 'Dossiers', 'Actions'], cats.map((c) => [c.id, dCat.get(c.id) ?? 0, byCat.get(c.id) ?? 0]));
const noDossier = cats.filter((c) => !dCat.has(c.id));
out(`Categories with no dossier (${noDossier.length} of ${cats.length}): ${noDossier.length ? noDossier.map((c) => c.id).join(', ') : 'none'}.`);
out();
const dSub = countBy(dossiers, (e) => [].concat(e.subcategories ?? []));
const allSubs = cats.flatMap((c) => c.subs.map((s) => `${c.id}/${s}`));
const coveredSubs = allSubs.filter((k) => dSub.has(k.split('/')[1]));
out(`Sub-categories with at least one dossier: ${coveredSubs.length} of ${allSubs.length}.`);
out();
table(['Kind', 'Dossiers'], [...countBy(dossiers, (e) => e.kind)].map(([k, v]) => [k, v]));
table(['Status', 'Dossiers'], [...countBy(dossiers, (e) => e.status)].map(([k, v]) => [k, v]));
const staleD = dossiers.filter((e) => e.status === 'ongoing' && isoDate(e.asOf) && daysSince(isoDate(e.asOf)) > DOSSIER_STALE_DAYS);
out(`Ongoing dossiers with asOf older than ${DOSSIER_STALE_DAYS} days (${staleD.length}): ${staleD.length ? staleD.map((e) => e.slug).join(', ') : 'none'}.`);
out();

out('## Promises and indicators (Addendum v3)');
const readOpt = (f) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', f), 'utf8')); } catch { return null; } };
const promisesDoc = readOpt('promises.json');
const indicatorsDoc = readOpt('indicators.json');
if (!Array.isArray(promisesDoc)) out('promises.json: not present.');
else {
  out(`Promises: ${promisesDoc.length}. Each party should have ${PROMISES_PER_PARTY_ELECTION} per election.`);
  out();
  table(['Election', ...PROMISE_PARTIES.map((p) => `${pn(p)} promises`), 'Equal?'], [...promiseMatrix(promisesDoc)].map(([e, row]) => [e, ...PROMISE_PARTIES.map((p) => row[p]), PROMISE_PARTIES.every((p) => row[p] === PROMISES_PER_PARTY_ELECTION) ? 'yes' : 'NO']));
  table(['Status', ...PROMISE_PARTIES.map((p) => pn(p))], PROMISE_STATUSES.map((st) => [st, ...PROMISE_PARTIES.map((p) => promisesDoc.filter((x) => x.party === p && x.status === st).length)]));
}
if (!indicatorsDoc || !Array.isArray(indicatorsDoc.indicators)) out('indicators.json: not present.');
else {
  out(`Indicators: ${indicatorsDoc.indicators.length}. Coverage per period (indicators with a value):`);
  out();
  table(['Period', 'Group', 'Indicators with a value'], indicatorCoverage(indicatorsDoc).map((c) => [c.label, c.bloc, `${c.n} of ${c.of}`]));
}
out();

const report = lines.join('\n');
console.log(report);
if (process.argv.includes('--md')) {
  fs.writeFileSync(path.join(ROOT, 'docs', 'NEUTRALITY-REPORT.md'), report + '\n');
  console.error('Wrote docs/NEUTRALITY-REPORT.md');
}
