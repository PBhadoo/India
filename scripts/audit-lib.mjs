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
export const DOSSIER_KINDS = ['topic', 'institution', 'organisation', 'party', 'company-group', 'debate'];
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

// ---------------------------------------------------------------------------------------------
// Indicators and promises (Addendum v3). Pure: take parsed JSON, return { errors, warnings }.
// ---------------------------------------------------------------------------------------------
export const PROMISE_PARTIES = ['inc', 'bjp'];
export const PROMISE_ELECTIONS = [1998, 1999, 2004, 2009, 2014, 2019, 2024];
export const PROMISE_STATUSES = ['delivered', 'partly-delivered', 'not-delivered', 'abandoned', 'ongoing', 'unclear'];
export const PROMISES_PER_PARTY_ELECTION = 8;
export const INDICATOR_BLOCS = ['INC', 'BJP', 'Other'];
export const INDICATOR_MIN_VALUES = 3;
const GLOBAL_CONTEXT_RE = /oil|2008|financial crisis|covid|pandemic|global|world|monsoon|drought|commodity|revis|base year|rebas/i;
const isHttps = (v) => typeof v === 'string' && /^https:\/\/[^\s/]+/i.test(v);
const isIsoDay = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v + 'T00:00:00Z'));
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function checkSourceObj(s, where, err) {
  if (!s || typeof s !== 'object') return err(`${where} missing`);
  if (!isStr(s.title)) err(`${where}.title missing`);
  if (!isStr(s.url)) err(`${where}.url missing`);
  else if (!isHttps(s.url)) err(`${where}.url must be https (${s.url})`);
  if (s.publisher !== undefined && !isStr(s.publisher)) err(`${where}.publisher must be a non-empty string`);
  if (s.type !== undefined && !SOURCE_TYPES.includes(s.type)) err(`${where}.type must be one of ${SOURCE_TYPES.join('|')}`);
}

/** Checks the parsed src/data/indicators.json. ctx: { words: string[] }. */
export function checkIndicators(doc, ctx = {}) {
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    err('must be an object with "periods" and "indicators"');
    return { errors, warnings };
  }
  if (!Array.isArray(doc.periods)) err('periods must be a list');
  if (!Array.isArray(doc.indicators)) err('indicators must be a list');
  const periods = Array.isArray(doc.periods) ? doc.periods : [];
  const indicators = Array.isArray(doc.indicators) ? doc.indicators : [];
  const periodIds = new Set();
  periods.forEach((p, i) => {
    if (!p || typeof p !== 'object') return err(`periods[${i}] must be an object`);
    if (!isStr(p.id) || !KEBAB.test(p.id)) err(`periods[${i}].id must be lowercase kebab-case`);
    else if (periodIds.has(p.id)) err(`periods[${i}].id "${p.id}" is duplicated`);
    else periodIds.add(p.id);
    if (!isStr(p.label)) err(`periods[${i}].label missing`);
    if (!INDICATOR_BLOCS.includes(p.bloc)) err(`periods[${i}].bloc must be one of ${INDICATOR_BLOCS.join('|')}`);
    if (!isIsoDay(p.start)) err(`periods[${i}].start must be YYYY-MM-DD`);
    if (p.end !== null && p.end !== undefined && !isIsoDay(p.end)) err(`periods[${i}].end must be YYYY-MM-DD or null`);
    else if (isIsoDay(p.start) && isIsoDay(p.end) && p.end <= p.start) err(`periods[${i}] ends before it starts`);
  });
  const ids = new Set();
  const used = new Set();
  indicators.forEach((ind, i) => {
    if (!ind || typeof ind !== 'object') return err(`indicators[${i}] must be an object`);
    const tag = `indicators[${i}]${isStr(ind.id) ? ` (${ind.id})` : ''}`;
    if (!isStr(ind.id) || !KEBAB.test(ind.id)) err(`${tag}.id must be lowercase kebab-case`);
    else if (ids.has(ind.id)) err(`${tag}.id is duplicated`);
    else ids.add(ind.id);
    for (const f of ['name', 'unit', 'domain', 'basis']) if (!isStr(ind[f])) err(`${tag}.${f} missing`);
    checkSourceObj(ind.source, `${tag}.source`, err);
    if (!Array.isArray(ind.caveats) || ind.caveats.length === 0) err(`${tag}.caveats must be a non-empty list`);
    else {
      ind.caveats.forEach((c, j) => { if (!isStr(c)) err(`${tag}.caveats[${j}] must be a non-empty string`); });
      if (!ind.caveats.some((c) => typeof c === 'string' && GLOBAL_CONTEXT_RE.test(c))) {
        warn(`${tag} has no global-context caveat (oil shocks, 2008, COVID, data revisions)`);
      }
    }
    const vals = Array.isArray(ind.values) ? ind.values : [];
    if (!Array.isArray(ind.values)) err(`${tag}.values must be a list`);
    else if (vals.length < INDICATOR_MIN_VALUES) err(`${tag} needs at least ${INDICATOR_MIN_VALUES} period values (has ${vals.length})`);
    const seen = new Set();
    const blocs = new Set();
    vals.forEach((v, j) => {
      if (!v || typeof v !== 'object') return err(`${tag}.values[${j}] must be an object`);
      if (!periodIds.has(v.period)) err(`${tag}.values[${j}].period "${v.period}" is not in periods`);
      else {
        if (seen.has(v.period)) err(`${tag}.values[${j}].period "${v.period}" appears twice`);
        seen.add(v.period);
        used.add(v.period);
        blocs.add(periods.find((p) => p.id === v.period)?.bloc);
      }
      if (typeof v.value !== 'number' || !Number.isFinite(v.value)) err(`${tag}.values[${j}].value must be a number`);
      if (v.note !== undefined && !isStr(v.note)) err(`${tag}.values[${j}].note must be a non-empty string`);
    });
    if (vals.length >= INDICATOR_MIN_VALUES && !(blocs.has('INC') && blocs.has('BJP'))) {
      warn(`${tag} has values for only one of the INC-led and BJP-led groups, so it cannot be compared across them`);
    }
    for (const t of [ind.name, ind.basis, ...(Array.isArray(ind.caveats) ? ind.caveats : []), ...vals.map((v) => v?.note)]) {
      if (typeof t === 'string') for (const w of loadedHits(t, ctx.words ?? [])) warn(`${tag}: loaded word "${w}" in: "${t.slice(0, 70)}"`);
    }
  });
  for (const p of periodIds) if (indicators.length && !used.has(p)) warn(`period "${p}" has no indicator values`);
  return { errors, warnings };
}

/** Number of indicators with a value, per period id. Returns [{ id, label, bloc, n, of }]. */
export function indicatorCoverage(doc) {
  const periods = Array.isArray(doc?.periods) ? doc.periods : [];
  const indicators = Array.isArray(doc?.indicators) ? doc.indicators : [];
  return periods.map((p) => ({
    id: p.id, label: p.label, bloc: p.bloc, of: indicators.length,
    n: indicators.filter((i) => (i.values ?? []).some((v) => v.period === p.id && typeof v.value === 'number')).length,
  }));
}

/** Counts of promises per election and party: Map election -> { inc: n, bjp: n }. */
export function promiseMatrix(list) {
  const m = new Map();
  for (const p of Array.isArray(list) ? list : []) {
    if (!p || !PROMISE_PARTIES.includes(p.party)) continue;
    const row = m.get(p.election) ?? Object.fromEntries(PROMISE_PARTIES.map((x) => [x, 0]));
    row[p.party]++;
    m.set(p.election, row);
  }
  return new Map([...m].sort((a, b) => a[0] - b[0]));
}

/** Checks the parsed src/data/promises.json. ctx: { words: string[] }. */
export function checkPromises(list, ctx = {}) {
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);
  if (!Array.isArray(list)) {
    err('must be a list of promises');
    return { errors, warnings };
  }
  const ids = new Set();
  list.forEach((p, i) => {
    if (!p || typeof p !== 'object') return err(`[${i}] must be an object`);
    const tag = `[${i}]${isStr(p.id) ? ` (${p.id})` : ''}`;
    if (!isStr(p.id)) err(`${tag}.id missing`);
    else if (ids.has(p.id)) err(`${tag}.id is duplicated`);
    else ids.add(p.id);
    if (!PROMISE_PARTIES.includes(p.party)) err(`${tag}.party must be one of ${PROMISE_PARTIES.join('|')}`);
    if (!PROMISE_ELECTIONS.includes(p.election)) err(`${tag}.election must be one of ${PROMISE_ELECTIONS.join(', ')}`);
    if (isStr(p.id) && PROMISE_PARTIES.includes(p.party) && !p.id.startsWith(`${p.party}-${p.election}-`)) {
      warn(`${tag}.id should start with "${p.party}-${p.election}-"`);
    }
    for (const f of ['text', 'domain', 'evidence']) if (!isStr(p[f])) err(`${tag}.${f} missing`);
    if (!PROMISE_STATUSES.includes(p.status)) err(`${tag}.status must be one of ${PROMISE_STATUSES.join('|')}`);
    if (!p.evidenceSource || typeof p.evidenceSource !== 'object') err(`${tag}.evidenceSource missing`);
    else {
      checkSourceObj(p.evidenceSource, `${tag}.evidenceSource`, err);
      if (!isStr(p.evidenceSource.publisher)) err(`${tag}.evidenceSource.publisher missing`);
      if (!SOURCE_TYPES.includes(p.evidenceSource.type)) err(`${tag}.evidenceSource.type must be one of ${SOURCE_TYPES.join('|')}`);
    }
    checkSourceObj(p.manifestoSource, `${tag}.manifestoSource`, err);
    if (!isIsoDay(p.asOf)) err(`${tag}.asOf must be YYYY-MM-DD`);
    if (isStr(p.text) && p.text.length > 280) warn(`${tag}.text is ${p.text.length} chars; keep it a short paraphrase`);
    for (const t of [p.text, p.evidence]) {
      if (typeof t === 'string') for (const w of loadedHits(t, ctx.words ?? [])) warn(`${tag}: loaded word "${w}" in: "${t.slice(0, 70)}"`);
    }
  });
  for (const [election, row] of promiseMatrix(list)) {
    const counts = PROMISE_PARTIES.map((x) => row[x]);
    if (new Set(counts).size > 1) warn(`${election}: unequal promise counts (${PROMISE_PARTIES.map((x) => `${x} ${row[x]}`).join(', ')}); both parties get the same number`);
    else if (counts[0] !== PROMISES_PER_PARTY_ELECTION) warn(`${election}: ${counts[0]} promises per party (expected ${PROMISES_PER_PARTY_ELECTION})`);
  }
  return { errors, warnings };
}

// ---------------------------------------------------------------------------------------------
// Reform arguments (Addendum v3): optional `reform` block on actions. Pure checks and coverage.
// ---------------------------------------------------------------------------------------------
export const REFORM_STANCES = ['keep', 'change', 'repeal'];
/** Quotas once a reform block is present. Missing quota is a warning while the rollout is in progress. */
export const REFORM_MIN = { keep: 2, change: 2 };
export const BLOC_IDS = ['inc', 'bjp', 'other'];
/** Keep in sync with blocOf in src/lib/scoring-core.ts. */
export const blocOfLead = (leadParty) => (leadParty === 'inc' ? 'inc' : leadParty === 'bjp' ? 'bjp' : 'other');

/** All text fields of a reform block as [path, value] pairs (strings only, for the neutrality lint). */
export function reformTexts(d) {
  const out = [];
  const r = d?.reform;
  if (!r || typeof r !== 'object') return out;
  for (const k of REFORM_STANCES) {
    if (!Array.isArray(r[k])) continue;
    r[k].forEach((p, i) => {
      if (p && typeof p === 'object') for (const f of ['point', 'madeBy']) if (typeof p[f] === 'string') out.push([`reform.${k}[${i}].${f}`, p[f]]);
    });
  }
  return out;
}

/**
 * Checks the optional `reform` block of an action's front-matter. Returns { errors, warnings } (no slug prefix).
 * Errors: structure, source index outside the action's sources, empty or non-string point or madeBy.
 * Warnings: fewer than 2 keep or 2 change points (rollout in progress), unknown keys.
 */
export function checkReform(d) {
  const errors = [];
  const warnings = [];
  const r = d?.reform;
  if (r === undefined || r === null) return { errors, warnings };
  if (typeof r !== 'object' || Array.isArray(r)) {
    errors.push('reform must be an object with asOf, keep, change and (optionally) repeal');
    return { errors, warnings };
  }
  const nSources = Array.isArray(d.sources) ? d.sources.length : 0;
  if (!isIso(r.asOf)) errors.push('reform.asOf must be YYYY-MM-DD');
  for (const k of Object.keys(r)) if (k !== 'asOf' && !REFORM_STANCES.includes(k)) warnings.push(`reform.${k} is not a known key (asOf, keep, change, repeal)`);
  for (const k of REFORM_STANCES) {
    const arr = r[k];
    if (arr === undefined) continue;
    if (!Array.isArray(arr)) { errors.push(`reform.${k} must be a list`); continue; }
    arr.forEach((p, i) => {
      const at = `reform.${k}[${i}]`;
      if (p === null || typeof p !== 'object' || Array.isArray(p)) { errors.push(`${at} must be an object with point, madeBy and source (quote lines that contain a colon)`); return; }
      if (typeof p.point !== 'string') errors.push(`${at}.point is not a string (quote lines that contain a colon)`);
      else if (!p.point.trim()) errors.push(`${at}.point is empty`);
      if (typeof p.madeBy !== 'string') errors.push(`${at}.madeBy is not a string`);
      else if (!p.madeBy.trim()) errors.push(`${at}.madeBy is empty (name the person or body)`);
      if (!Number.isInteger(p.source) || p.source < 1 || p.source > nSources) errors.push(`${at}.source ${JSON.stringify(p.source)} is not a source index (1 to ${nSources})`);
    });
  }
  for (const k of ['keep', 'change']) {
    const n = Array.isArray(r[k]) ? r[k].length : 0;
    if (n < REFORM_MIN[k]) warnings.push(`reform has ${n} ${k} ${n === 1 ? 'point' : 'points'} (at least ${REFORM_MIN[k]} expected; rollout in progress)`);
  }
  return { errors, warnings };
}

const countOf = (e, k) => (Array.isArray(e?.reform?.[k]) ? e.reform[k].length : 0);

/**
 * Reform coverage and per-bloc average points per stance.
 * entries: [{ slug, governmentId, credit?, reform? }]; govs: Map id -> { leadParty }.
 * Averages are over actions that have a reform block; actions without one are counted separately.
 */
export function reformCoverage(entries, govs) {
  const blank = () => ({ actions: 0, withReform: 0, keep: 0, change: 0, repeal: 0 });
  const by = { inc: blank(), bjp: blank(), other: blank(), institution: blank() };
  for (const e of entries) {
    const key = e.credit === 'none' ? 'institution' : blocOfLead(govs.get(e.governmentId)?.leadParty);
    const b = by[key];
    b.actions++;
    if (e.reform && typeof e.reform === 'object') {
      b.withReform++;
      for (const k of REFORM_STANCES) b[k] += countOf(e, k);
    }
  }
  const out = {};
  for (const [k, b] of Object.entries(by)) {
    const n = b.withReform;
    out[k] = { ...b, avgKeep: n ? round(b.keep / n) : null, avgChange: n ? round(b.change / n) : null, avgRepeal: n ? round(b.repeal / n) : null };
  }
  const total = entries.length;
  const withReform = Object.values(by).reduce((n, b) => n + b.withReform, 0);
  return { total, withReform, blocs: out };
}
