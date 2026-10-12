// Pure helpers for neutrality-audit.mjs (no I/O), unit-tested in tests/audit-lib.test.mjs.
import { CRITERIA } from './lib.mjs';

export const PRIMARY_TYPES = ['primary', 'official-data', 'court'];

export const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

/** Counts items by key(item); returns Map sorted by count desc then key. */
export function countBy(items, key) {
  const m = new Map();
  for (const it of items) {
    const ks = [].concat(key(it)).filter((k) => k !== undefined && k !== null);
    for (const k of ks) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return new Map([...m].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))));
}

export const eraOf = (iso) => (iso ? `${Math.floor(Number(iso.slice(0, 4)) / 10) * 10}s` : 'unknown');

export const hasPrimarySource = (sources) => (sources ?? []).some((s) => PRIMARY_TYPES.includes(s?.type));

/** Number of distinct [n] citations in a string. */
export const citationCount = (text) => new Set(String(text ?? '').match(/\[\d+\]/g) ?? []).size;

/** Phrases from `words` found in `text` (whole-word, case-insensitive). */
export function loadedHits(text, words) {
  const low = String(text ?? '').toLowerCase();
  return words.filter((w) => new RegExp(`(^|[^a-z])${w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z])`).test(low));
}

/** Criteria where scorers A and B differ by >= threshold. Returns [{criterion, a, b}]. */
export function scorerDisagreements(scorers, threshold = 2) {
  if (!Array.isArray(scorers) || scorers.length !== 2) return [];
  const [a, b] = scorers;
  return CRITERIA.filter((c) => Math.abs(a[c] - b[c]) >= threshold).map((c) => ({ criterion: c, a: a[c], b: b[c] }));
}

/** Per-group asymmetry: avg benefit points, avg concern points, avg citations per bullet. */
export function asymmetry(entries) {
  const benefits = entries.map((e) => e.benefits?.length ?? 0);
  const concerns = entries.map((e) => e.concerns?.length ?? 0);
  const bullets = entries.flatMap((e) => [...(e.benefits ?? []), ...(e.concerns ?? [])]);
  return {
    n: entries.length,
    avgBenefits: round(mean(benefits)),
    avgConcerns: round(mean(concerns)),
    avgEvidencePerBullet: round(mean(bullets.map((b) => citationCount(b.evidence)))),
    bulletsWithEvidence: bullets.length ? round(bullets.filter((b) => b.evidence).length / bullets.length) : 0,
  };
}

/** Parties credited by a government: lead party plus partners with share > 0. */
export function partiesOf(gov) {
  if (!gov) return [];
  return [...new Set((gov.partners ?? []).filter((p) => p.share > 0).map((p) => p.party))];
}

/**
 * Lists text fields that are not strings (for example a YAML bullet with an unquoted
 * "word: text" that parses as an object). Returns paths such as "facts[2]".
 */
export function nonStringTextFields(d) {
  const bad = [];
  const chk = (path, v) => { if (typeof v !== 'string') bad.push(path); };
  const list = (path, arr) => {
    if (arr === undefined || arr === null) return;
    if (!Array.isArray(arr)) { bad.push(path); return; }
    arr.forEach((v, i) => chk(`${path}[${i}]`, v));
  };
  list('facts', d?.facts);
  list('why.stated', d?.why?.stated);
  list('why.criticism', d?.why?.criticism);
  list('notes', d?.notes);
  for (const k of ['benefits', 'concerns']) {
    if (!Array.isArray(d?.[k])) continue;
    d[k].forEach((p, i) => {
      if (p === null || typeof p !== 'object') return; // shape errors are reported elsewhere
      chk(`${k}[${i}].point`, p.point);
      if (p.evidence !== undefined) chk(`${k}[${i}].evidence`, p.evidence);
    });
  }
  return bad;
}

// ---------------------------------------------------------------------------------------------
// Dossier checks (Addendum v2). Pure: takes a loaded entry and a context, returns messages.
// ---------------------------------------------------------------------------------------------
export const CLAIM_TYPES = ['finding', 'official-statement', 'allegation', 'data', 'event'];
export const DOSSIER_KINDS = ['topic', 'institution', 'organisation', 'party', 'company-group'];
export const DOSSIER_STATUSES = ['ongoing', 'settled'];
export const SOURCE_TYPES = ['primary', 'official-data', 'court', 'reputable-media', 'academic'];
export const DOSSIER_STALE_DAYS = 45;
export const DOSSIER_MIN_SOURCES = 5;
export const DOSSIER_MIN_PRIMARY = 2;
export const DOSSIER_MIN_NOT_SHOWN = 2;
export const DOSSIER_SUMMARY_MAX = 240;

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isIso = (v) => (v instanceof Date && !isNaN(v)) || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v));
const toIso = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v);
const refs = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);

/** Text-bearing fields of a dossier that must be strings (an unquoted "word: text" parses as an object). */
export function dossierNonStringFields(d) {
  const bad = [];
  const chk = (path, v, optional = false) => { if (v === undefined && optional) return; if (typeof v !== 'string') bad.push(path); };
  for (const k of ['title', 'summary']) chk(k, d?.[k], true);
  const rows = (key, fields, optionalFields = []) => {
    if (!Array.isArray(d?.[key])) return;
    d[key].forEach((it, i) => {
      if (it === null || typeof it !== 'object' || Array.isArray(it)) { bad.push(`${key}[${i}]`); return; }
      for (const f of fields) chk(`${key}[${i}].${f}`, it[f]);
      for (const f of optionalFields) chk(`${key}[${i}].${f}`, it[f], true);
    });
  };
  rows('timeline', ['event'], ['actor']);
  rows('claims', ['claim'], ['madeBy', 'status', 'response']);
  rows('positions', ['holder', 'position']);
  rows('tables', ['title'], ['caption']);
  if (Array.isArray(d?.tables)) {
    d.tables.forEach((t, i) => {
      if (Array.isArray(t?.columns)) t.columns.forEach((c, j) => { if (typeof c !== 'string' && typeof c !== 'number') bad.push(`tables[${i}].columns[${j}]`); });
    });
  }
  if (d?.notShown !== undefined) {
    if (!Array.isArray(d.notShown)) bad.push('notShown');
    else d.notShown.forEach((v, i) => chk(`notShown[${i}]`, v));
  }
  return bad;
}

/**
 * Checks one dossier. `entry` is { slug, data, content, error? }.
 * ctx: { categories: [{id, subs}], words: string[] (lowercase loaded phrases), now?: Date }.
 * Returns { errors: string[], warnings: string[] } (messages without the slug prefix).
 */
export function checkDossier(entry, ctx) {
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);
  const d = entry.data ?? {};
  if (entry.error) { err(`front-matter does not parse: ${entry.error}`); return { errors, warnings }; }
  const now = ctx.now ?? new Date();

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(entry.slug)) err('slug should be lowercase kebab-case');
  for (const f of ['title', 'summary', 'category', 'kind', 'status']) if (!isStr(d[f])) err(`missing required field "${f}"`);
  if (isStr(d.summary) && d.summary.length > DOSSIER_SUMMARY_MAX) err(`summary is ${d.summary.length} chars (max ${DOSSIER_SUMMARY_MAX})`);
  if (isStr(d.kind) && !DOSSIER_KINDS.includes(d.kind)) err(`kind must be one of ${DOSSIER_KINDS.join('|')}`);
  if (isStr(d.status) && !DOSSIER_STATUSES.includes(d.status)) err(`status must be one of ${DOSSIER_STATUSES.join('|')}`);

  const cat = (ctx.categories ?? []).find((c) => c.id === d.category);
  if (isStr(d.category) && !cat) err(`unknown category "${d.category}"`);
  if (!Array.isArray(d.subcategories) || d.subcategories.length === 0) err('subcategories must be a non-empty list');
  else if (cat) for (const s of d.subcategories) if (!cat.subs.includes(s)) err(`subcategory "${s}" is not under category "${d.category}"`);

  if (!isIso(d.asOf)) err('asOf must be YYYY-MM-DD');
  else {
    const iso = toIso(d.asOf);
    const age = Math.floor((now - new Date(iso + 'T00:00:00Z')) / 86_400_000);
    if (age < 0) warn(`asOf ${iso} is in the future`);
    if (d.status === 'ongoing' && age > DOSSIER_STALE_DAYS) warn(`asOf is ${age} days old for an ongoing dossier (> ${DOSSIER_STALE_DAYS}); re-check the facts`);
  }
  if (!isIso(d.lastReviewed)) err('lastReviewed must be YYYY-MM-DD');

  // sources
  const sources = d.sources;
  let nSources = 0;
  if (!Array.isArray(sources)) err('sources must be a list');
  else {
    nSources = sources.length;
    if (sources.length < DOSSIER_MIN_SOURCES) err(`needs at least ${DOSSIER_MIN_SOURCES} sources (has ${sources.length})`);
    const primary = sources.filter((s) => PRIMARY_TYPES.includes(s?.type)).length;
    if (primary < DOSSIER_MIN_PRIMARY) err(`needs at least ${DOSSIER_MIN_PRIMARY} primary, official-data or court sources (has ${primary})`);
    sources.forEach((s, i) => {
      if (!s || !isStr(s.title)) err(`sources[${i}].title missing`);
      if (!s || !isStr(s.url)) err(`sources[${i}].url missing`);
      else if (!/^https:\/\//i.test(s.url)) err(`sources[${i}].url must be https (${s.url})`);
      if (!s || !isStr(s.publisher)) err(`sources[${i}].publisher missing`);
      if (!s || !SOURCE_TYPES.includes(s.type)) err(`sources[${i}].type must be one of ${SOURCE_TYPES.join('|')}`);
    });
  }

  for (const p of dossierNonStringFields(d)) err(`${p} is not a string (an unquoted "word: text" in YAML reads as an object; quote the line)`);

  const checkRef = (where, v) => {
    for (const n of refs(v)) {
      if (!Number.isInteger(n) || n < 1 || n > nSources) err(`${where}.source ${JSON.stringify(n)} is not a source index (1 to ${nSources})`);
    }
  };

  // timeline
  if (d.timeline !== undefined && !Array.isArray(d.timeline)) err('timeline must be a list');
  const tl = Array.isArray(d.timeline) ? d.timeline : [];
  if (Array.isArray(d.timeline) && tl.length === 0) warn('timeline is empty');
  let prev = '';
  tl.forEach((t, i) => {
    if (!t || typeof t !== 'object') return err(`timeline[${i}] must be an object`);
    if (!isStr(t.event) && typeof t.event !== 'string') err(`timeline[${i}].event missing`);
    const ds = t.date instanceof Date ? toIso(t.date) : typeof t.date === 'string' ? t.date : '';
    if (!ds) err(`timeline[${i}].date missing`);
    else {
      // A year or a month (YYYY, YYYY-MM) is allowed when the exact day is not documented.
      if (!/^\d{4}(-\d{2}(-\d{2})?)?$/.test(ds)) warn(`timeline[${i}].date "${ds}" is not YYYY, YYYY-MM or YYYY-MM-DD`);
      if (prev && ds < prev) warn(`timeline[${i}] (${ds}) is earlier than the item before it (${prev}); keep the list chronological`);
      prev = ds;
    }
    if (t.type !== undefined && !CLAIM_TYPES.includes(t.type)) err(`timeline[${i}].type must be one of ${CLAIM_TYPES.join('|')}`);
    if (t.source === undefined || t.source === null) warn(`timeline[${i}] has no source`);
    checkRef(`timeline[${i}]`, t.source);
  });

  // claims
  if (d.claims !== undefined && !Array.isArray(d.claims)) err('claims must be a list');
  (Array.isArray(d.claims) ? d.claims : []).forEach((c, i) => {
    if (!c || typeof c !== 'object') return err(`claims[${i}] must be an object`);
    if (typeof c.claim !== 'string' || !c.claim.trim()) err(`claims[${i}].claim missing`);
    if (!CLAIM_TYPES.includes(c.type)) err(`claims[${i}].type must be one of ${CLAIM_TYPES.join('|')}`);
    if (c.source === undefined || c.source === null) warn(`claims[${i}] has no source`);
    checkRef(`claims[${i}]`, c.source);
    if (c.type === 'allegation') {
      if (!isStr(c.madeBy)) err(`claims[${i}] is an allegation and needs madeBy`);
      if (!isStr(c.status)) err(`claims[${i}] is an allegation and needs status`);
      if (!isStr(c.response)) warn(`claims[${i}] is an allegation with no recorded response; say "no response found" if none was published`);
    }
  });

  // positions and tables
  if (d.positions !== undefined && !Array.isArray(d.positions)) err('positions must be a list');
  (Array.isArray(d.positions) ? d.positions : []).forEach((p, i) => {
    if (!p || typeof p !== 'object') return err(`positions[${i}] must be an object`);
    if (typeof p.holder !== 'string' || !p.holder.trim()) err(`positions[${i}].holder missing`);
    if (typeof p.position !== 'string' || !p.position.trim()) err(`positions[${i}].position missing`);
    checkRef(`positions[${i}]`, p.source);
  });
  if (d.tables !== undefined && !Array.isArray(d.tables)) err('tables must be a list');
  (Array.isArray(d.tables) ? d.tables : []).forEach((t, i) => {
    if (!t || typeof t !== 'object') return err(`tables[${i}] must be an object`);
    if (typeof t.title !== 'string' || !t.title.trim()) err(`tables[${i}].title missing`);
    if (!Array.isArray(t.columns) || t.columns.length === 0) err(`tables[${i}].columns must be a non-empty list`);
    if (!Array.isArray(t.rows)) err(`tables[${i}].rows must be a list of rows`);
    else if (Array.isArray(t.columns)) t.rows.forEach((r, j) => {
      if (!Array.isArray(r)) err(`tables[${i}].rows[${j}] must be a list`);
      else if (r.length !== t.columns.length) err(`tables[${i}].rows[${j}] has ${r.length} cells but there are ${t.columns.length} columns`);
    });
    if (!isStr(t.caption)) warn(`tables[${i}] has no caption (say what it measures, period and unit)`);
    if (t.source === undefined || t.source === null) warn(`tables[${i}] has no source`);
    checkRef(`tables[${i}]`, t.source);
  });

  // notShown
  const ns = Array.isArray(d.notShown) ? d.notShown.filter((x) => typeof x === 'string' && x.trim()) : [];
  if (ns.length < DOSSIER_MIN_NOT_SHOWN) err(`notShown needs at least ${DOSSIER_MIN_NOT_SHOWN} items (has ${ns.length})`);

  // body: citations and length
  const body = entry.content ?? '';
  for (const m of new Set(body.match(/\[\d+\]/g) ?? [])) {
    const n = Number(m.slice(1, -1));
    if (n < 1 || n > nSources) err(`body cites ${m} but there are ${nSources} sources`);
  }
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  if (words === 0) warn('no explainer body (150 to 400 words recommended)');
  else if (words < 150 || words > 400) warn(`explainer body is ${words} words (150 to 400 recommended)`);

  // neutrality lint
  const texts = [d.title, d.summary, body,
    ...tl.flatMap((t) => [t?.event, t?.actor]),
    ...(Array.isArray(d.claims) ? d.claims : []).flatMap((c) => [c?.claim, c?.madeBy, c?.status, c?.response]),
    ...(Array.isArray(d.positions) ? d.positions : []).flatMap((p) => [p?.holder, p?.position]),
    ...(Array.isArray(d.tables) ? d.tables : []).flatMap((t) => [t?.title, t?.caption]),
    ...ns].filter((t) => typeof t === 'string' && t);
  for (const t of texts) for (const w of loadedHits(t, ctx.words ?? [])) warn(`loaded word "${w}" in: "${t.slice(0, 70)}"`);

  return { errors, warnings };
}
