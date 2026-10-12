#!/usr/bin/env node
// Writes one party-blind JSON per action so scorers rate without knowing who did it.
import fs from 'node:fs';
import path from 'node:path';
import { ACTIONS_DIR, listMd, loadEntry, isoDate } from './lib.mjs';

const outDir = process.argv[2];
if (!outDir) {
  console.error('usage: node scripts/strip-for-scoring.mjs <outDir>');
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

let n = 0;
for (const file of listMd(ACTIONS_DIR)) {
  const e = loadEntry(file);
  if (e.error) { console.error(`skip ${e.slug}: ${e.error}`); continue; }
  const d = e.data;
  const blind = {
    slug: e.slug,
    title: d.title,
    summary: d.summary,
    date: isoDate(d.date),
    category: d.category,
    facts: d.facts,
    why: d.why,
    benefits: d.benefits,
    concerns: d.concerns,
    scoring: {
      era_baseline: d.scoring?.era_baseline,
      lag_years: d.scoring?.lag_years,
      shocks: d.scoring?.shocks ?? [],
    },
    sources: (d.sources ?? []).map((s) => ({ title: s.title })),
  };
  fs.writeFileSync(path.join(outDir, `${e.slug}.json`), JSON.stringify(blind, null, 2) + '\n');
  n++;
}
console.log(`Wrote ${n} blind files to ${outDir}`);
