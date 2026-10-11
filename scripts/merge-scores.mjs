#!/usr/bin/env node
// Merges two scorer files ({ slug: {reach,outcome,sustainability,process,delivery,note} })
// into each action's scoring.scorers block as ids A and B. Only that block is rewritten.
import fs from 'node:fs';
import path from 'node:path';
import { ACTIONS_DIR, CRITERIA, readJson } from './lib.mjs';

/** Pure: replaces the scorers block in file text. Throws if the block can't be found. */
export function replaceScorersBlock(text, scorers) {
  const nl = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  if (lines[0].trim() !== '---') throw new Error('no front-matter');
  const end = lines.indexOf('---', 1);
  if (end < 0) throw new Error('unterminated front-matter');
  const keyIdx = lines.findIndex((l, i) => i < end && /^\s*scorers:/.test(l));
  if (keyIdx < 0) throw new Error('no scoring.scorers key in front-matter');
  const indent = lines[keyIdx].match(/^(\s*)/)[1].length;
  let last = keyIdx;
  for (let i = keyIdx + 1; i < end; i++) {
    const l = lines[i];
    if (l.trim() === '') continue;
    const ind = l.match(/^(\s*)/)[1].length;
    if (ind > indent || (ind === indent && l.trimStart().startsWith('- '))) last = i;
    else break;
  }
  const pad = ' '.repeat(indent + 2);
  const items = scorers.map((s) => {
    const nums = CRITERIA.map((c) => `${c}: ${s[c]}`).join(', ');
    return `${pad}- { id: ${s.id}, ${nums}, note: ${JSON.stringify(s.note ?? '')} }`;
  });
  lines.splice(keyIdx, last - keyIdx + 1, `${' '.repeat(indent)}scorers:`, ...items);
  return lines.join(nl);
}

export function validateScore(slug, s, who) {
  if (!s || typeof s !== 'object') throw new Error(`${who}: ${slug}: not an object`);
  for (const c of CRITERIA) {
    if (!Number.isInteger(s[c]) || s[c] < -5 || s[c] > 5) throw new Error(`${who}: ${slug}: ${c} must be an integer -5..5 (got ${s[c]})`);
  }
}

function main() {
  const [fa, fb] = process.argv.slice(2);
  if (!fa || !fb) {
    console.error('usage: node scripts/merge-scores.mjs <scorerAFile> <scorerBFile>');
    process.exit(2);
  }
  const A = readJson(fa), B = readJson(fb);
  if (!A || !B) { console.error('could not read/parse scorer files'); process.exit(2); }
  const slugs = Object.keys(A);
  const problems = [];
  for (const slug of slugs) {
    if (!(slug in B)) problems.push(`${slug}: missing from scorer B file`);
    if (!fs.existsSync(path.join(ACTIONS_DIR, `${slug}.md`))) problems.push(`${slug}: no such action file`);
    try { validateScore(slug, A[slug], 'A'); if (B[slug]) validateScore(slug, B[slug], 'B'); }
    catch (e) { problems.push(e.message); }
  }
  for (const slug of Object.keys(B)) if (!(slug in A)) problems.push(`${slug}: missing from scorer A file`);
  if (problems.length) {
    console.error(problems.join('\n'));
    console.error('\nNothing written.');
    process.exit(1);
  }
  for (const slug of slugs) {
    const file = path.join(ACTIONS_DIR, `${slug}.md`);
    const next = replaceScorersBlock(fs.readFileSync(file, 'utf8'), [
      { id: 'A', ...A[slug] },
      { id: 'B', ...B[slug] },
    ]);
    fs.writeFileSync(file, next);
  }
  console.log(`Merged scores into ${slugs.length} actions.`);
}

import { fileURLToPath } from 'node:url';
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
