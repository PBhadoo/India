// Shared helpers for the tooling scripts (plain Node ESM).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import * as yaml from 'js-yaml';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA = path.join(ROOT, 'src', 'data');
export const ACTIONS_DIR = path.join(ROOT, 'src', 'content', 'actions');
export const DEVELOPING_DIR = path.join(ROOT, 'src', 'content', 'developing');
export const DOSSIERS_DIR = path.join(ROOT, 'src', 'content', 'dossiers');

export const LOW_DATA_MIN_ACTIONS = 2; // keep in sync with src/lib/scoring.ts
export const CRITERIA = ['reach', 'outcome', 'sustainability', 'process', 'delivery'];

export function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

export function listMd(dir) {
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map((f) => path.join(dir, f));
  } catch { return []; }
}

/** Parses a markdown file. Returns { file, slug, data, content, error }. */
export function loadEntry(file) {
  const slug = path.basename(file, '.md');
  try {
    const parsed = matter(fs.readFileSync(file, 'utf8'), {
      engines: { yaml: (s) => yaml.load(s, { schema: yaml.JSON_SCHEMA }) },
    });
    return { file, slug, data: parsed.data ?? {}, content: parsed.content };
  } catch (e) {
    return { file, slug, data: {}, content: '', error: e.message };
  }
}

export function loadTaxonomy() {
  const doc = yaml.load(fs.readFileSync(path.join(DATA, 'taxonomy.yaml'), 'utf8'));
  return doc?.categories ?? [];
}

/** All government ids (centre + states) with their level/start/end/partners. */
export function loadGovernments() {
  const out = new Map();
  const gov = readJson(path.join(DATA, 'governments.json'), {});
  for (const g of gov.centre ?? []) out.set(g.id, { ...g, level: 'centre' });
  const dir = path.join(DATA, 'states');
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')); } catch {}
  for (const f of files) {
    const doc = readJson(path.join(dir, f), {});
    for (const g of doc.governments ?? []) out.set(g.id, { ...g, level: 'state', state: doc.state });
  }
  return out;
}

export function loadLoadedWords() {
  const w = readJson(path.join(ROOT, 'scripts', 'loaded-words.json'), { words: [] });
  return Array.isArray(w) ? w : w.words ?? [];
}

/** Normalises a front-matter date (Date or string) to YYYY-MM-DD, or null. */
export function isoDate(v) {
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return null;
}

export function daysSince(iso, now = new Date()) {
  return Math.floor((now - new Date(iso + 'T00:00:00Z')) / 86_400_000);
}
