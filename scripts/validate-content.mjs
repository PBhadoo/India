#!/usr/bin/env node
// Validates every action, developing item and dossier. Exits non-zero on errors; warnings never fail.
import {
  ACTIONS_DIR, DEVELOPING_DIR, DOSSIERS_DIR, CRITERIA, listMd, loadEntry, loadTaxonomy, loadGovernments,
  loadLoadedWords, isoDate, daysSince,
} from './lib.mjs';
import { nonStringTextFields, hasPrimarySource, checkDossier } from './audit-lib.mjs';

const STATUSES = ['proposed', 'passed', 'implemented', 'stalled', 'repealed', 'struck-down'];
const SOURCE_TYPES = ['primary', 'official-data', 'court', 'reputable-media', 'academic'];
const CONFIDENCE = ['low', 'medium', 'high'];
const STALE_DAYS = 180;

const errors = [];
const warnings = [];
const err = (e, m) => errors.push(`${e.slug}: ${m}`);
const warn = (e, m) => warnings.push(`${e.slug}: ${m}`);

const categories = loadTaxonomy();
const catById = new Map(categories.map((c) => [c.id, c]));
const govs = loadGovernments();
const words = loadLoadedWords().map((w) => w.toLowerCase());
const governmentsMissing = govs.size === 0;
if (governmentsMissing) warnings.push('(global): no governments data found; government id checks skipped');

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isArr = (v) => Array.isArray(v);

function checkSources(e, sources, min) {
  if (!isArr(sources)) return err(e, 'sources must be a list');
  if (sources.length < min) err(e, `needs at least ${min} sources (has ${sources.length})`);
  sources.forEach((s, i) => {
    if (!s || !isStr(s.title)) err(e, `sources[${i}].title missing`);
    if (!s || !isStr(s.url)) err(e, `sources[${i}].url missing`);
    else if (!/^https:\/\//i.test(s.url)) err(e, `sources[${i}].url must be https (${s.url})`);
    if (!s || !isStr(s.publisher)) err(e, `sources[${i}].publisher missing`);
    if (!s || !SOURCE_TYPES.includes(s.type)) err(e, `sources[${i}].type must be one of ${SOURCE_TYPES.join('|')}`);
  });
}

function checkCategory(e, d) {
  if (!catById.has(d.category)) err(e, `unknown category "${d.category}"`);
  return catById.get(d.category);
}

function lint(e, texts) {
  for (const t of texts) {
    const low = String(t).toLowerCase();
    for (const w of words) {
      if (new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z])`).test(low)) {
        warn(e, `loaded word "${w}" in: "${String(t).slice(0, 70)}"`);
      }
    }
  }
}

function checkGov(e, field, id, level, state) {
  if (governmentsMissing) return;
  const g = govs.get(id);
  if (!g) return err(e, `${field} "${id}" not found in governments data`);
  if (field === 'governmentId') {
    if (level && g.level !== level) err(e, `governmentId "${id}" is ${g.level} but level is ${level}`);
    if (level === 'state' && state && g.state !== state) err(e, `governmentId "${id}" belongs to state ${g.state}, not ${state}`);
  }
}

const slugs = new Map();
function trackSlug(e, kind) {
  const prev = slugs.get(`${kind}:${e.slug}`);
  if (prev) err(e, 'duplicate slug');
  slugs.set(`${kind}:${e.slug}`, true);
}

function checkReviewed(e, d) {
  const iso = isoDate(d.lastReviewed);
  if (!iso) return err(e, 'lastReviewed must be YYYY-MM-DD');
  const age = daysSince(iso);
  if (age > STALE_DAYS) warn(e, `lastReviewed is ${age} days old (> ${STALE_DAYS})`);
}

function validateAction(e) {
  const d = e.data;
  trackSlug(e, 'action');
  if (e.error) return err(e, `front-matter does not parse: ${e.error}`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.slug)) err(e, 'slug should be lowercase kebab-case');
  for (const f of ['title', 'summary', 'category', 'level', 'governmentId', 'status']) {
    if (!isStr(d[f])) err(e, `missing required field "${f}"`);
  }
  if (isStr(d.summary) && d.summary.length > 220) err(e, `summary is ${d.summary.length} chars (max 220)`);
  if (!isoDate(d.date)) err(e, 'date must be YYYY-MM-DD');
  checkReviewed(e, d);
  if (isStr(d.level) && !['centre', 'state'].includes(d.level)) err(e, `level must be centre|state`);
  if (d.level === 'state' && !isStr(d.state)) err(e, 'state is required when level is state');
  if (isStr(d.status) && !STATUSES.includes(d.status)) err(e, `status must be one of ${STATUSES.join('|')}`);
  if (typeof d.developing !== 'boolean') err(e, 'developing must be true/false');
  if (d.credit !== undefined && !['party', 'none'].includes(d.credit)) err(e, 'credit must be party|none');
  if (d.institution !== undefined && !isStr(d.institution)) err(e, 'institution must be a non-empty string');
  if (d.credit === 'none' && !isStr(d.institution)) warn(e, 'credit is none but no institution is named');
  if (d.institution !== undefined && d.credit !== 'none') warn(e, 'institution is set but credit is not none');

  const cat = checkCategory(e, d);
  if (!isArr(d.subcategories) || d.subcategories.length === 0) err(e, 'subcategories must be a non-empty list');
  else if (cat) for (const s of d.subcategories) {
    if (!cat.subs.includes(s)) err(e, `subcategory "${s}" is not under category "${d.category}"`);
  }

  if (isStr(d.governmentId)) checkGov(e, 'governmentId', d.governmentId, d.level, d.state);
  if (d.originGovernmentId !== undefined) {
    if (!isStr(d.originGovernmentId)) err(e, 'originGovernmentId must be a string');
    else checkGov(e, 'originGovernmentId', d.originGovernmentId);
  }

  if (!isArr(d.facts) || d.facts.length === 0) err(e, 'facts must be a non-empty list');
  if (!d.why || !isArr(d.why.stated) || d.why.stated.length === 0) err(e, 'why.stated must be a non-empty list');
  for (const k of ['benefits', 'concerns']) {
    if (!isArr(d[k])) err(e, `${k} must be a list`);
    else d[k].forEach((p, i) => { if (!p || !isStr(p.point)) err(e, `${k}[${i}].point missing`); });
  }
  if (isArr(d.benefits) && isArr(d.concerns) && d.benefits.length + d.concerns.length === 0) {
    err(e, 'needs at least one benefit or concern');
  }
  if (isArr(d.benefits) && d.benefits.length === 0) warn(e, 'no benefits listed (balance check)');
  if (isArr(d.concerns) && d.concerns.length === 0) warn(e, 'no concerns listed (balance check)');
  checkSources(e, d.sources, 2);
  for (const path of nonStringTextFields(d)) err(e, `${path} is not a string (an unquoted "word: text" in YAML reads as an object; quote the line)`);
  if (d.scoring?.confidence && d.scoring.confidence !== 'low' && isArr(d.sources) && !hasPrimarySource(d.sources)) {
    warn(e, `confidence is ${d.scoring.confidence} but no primary, official-data or court source is listed`);
  }

  const sc = d.scoring;
  if (!sc || typeof sc !== 'object') err(e, 'scoring block missing');
  else {
    if (!isStr(sc.era_baseline)) err(e, 'scoring.era_baseline missing');
    if (typeof sc.lag_years !== 'number') err(e, 'scoring.lag_years must be a number');
    if (!CONFIDENCE.includes(sc.confidence)) err(e, `scoring.confidence must be ${CONFIDENCE.join('|')}`);
    if (!isArr(sc.scorers)) err(e, 'scoring.scorers must be a list (may be empty)');
    else if (sc.scorers.length !== 0 && sc.scorers.length !== 2) err(e, 'scoring.scorers must be empty or have exactly 2 entries');
    else {
      for (const s of sc.scorers) for (const c of CRITERIA) {
        if (!Number.isInteger(s?.[c]) || s[c] < -5 || s[c] > 5) err(e, `scorer ${s?.id}: ${c} must be an integer -5..5`);
      }
      if (sc.scorers.length === 2 && sc.scorers[0].id === sc.scorers[1].id) err(e, 'scorer ids must differ');
    }
  }

  lint(e, [d.title, d.summary, ...(d.facts ?? []), ...(d.why?.stated ?? []), ...(d.why?.criticism ?? []),
    ...(d.benefits ?? []).flatMap((p) => [p?.point, p?.evidence]).filter(Boolean),
    ...(d.concerns ?? []).flatMap((p) => [p?.point, p?.evidence]).filter(Boolean), e.content]);
}

function validateDeveloping(e, actionSlugs) {
  const d = e.data;
  trackSlug(e, 'developing');
  if (e.error) return err(e, `front-matter does not parse: ${e.error}`);
  for (const f of ['title', 'summary', 'category', 'status']) if (!isStr(d[f])) err(e, `missing required field "${f}"`);
  if (isStr(d.summary) && d.summary.length > 220) err(e, `summary is ${d.summary.length} chars (max 220)`);
  if (!isoDate(d.date)) err(e, 'date must be YYYY-MM-DD');
  if (isStr(d.status) && !['developing', 'settled'].includes(d.status)) err(e, 'status must be developing|settled');
  checkCategory(e, d);
  if (!isArr(d.knownFacts)) err(e, 'knownFacts must be a list');
  else d.knownFacts.forEach((v, i) => { if (typeof v !== 'string') err(e, `knownFacts[${i}] is not a string (quote lines containing a colon)`); });
  if (!isArr(d.unknowns)) err(e, 'unknowns must be a list');
  else d.unknowns.forEach((v, i) => { if (typeof v !== 'string') err(e, `unknowns[${i}] is not a string (quote lines containing a colon)`); });
  checkSources(e, d.sources, 1);
  if (d.relatedAction && !actionSlugs.has(d.relatedAction)) err(e, `relatedAction "${d.relatedAction}" is not an action slug`);
  lint(e, [d.title, d.summary, ...(d.knownFacts ?? []), ...(d.unknowns ?? []), e.content]);
}

function validateDossier(e) {
  trackSlug(e, 'dossier');
  const r = checkDossier(e, { categories, words });
  r.errors.forEach((m) => err(e, m));
  r.warnings.forEach((m) => warn(e, m));
}

const actions = listMd(ACTIONS_DIR).map(loadEntry);
const developing = listMd(DEVELOPING_DIR).map(loadEntry);
actions.forEach(validateAction);
const actionSlugs = new Set(actions.map((a) => a.slug));
developing.forEach((e) => validateDeveloping(e, actionSlugs));
const dossiers = listMd(DOSSIERS_DIR).map(loadEntry);
dossiers.forEach((e) => validateDossier(e));

for (const w of warnings) console.warn(`WARN  ${w}`);
for (const x of errors) console.error(`ERROR ${x}`);
console.log(`\nChecked ${actions.length} actions, ${developing.length} developing items, ${dossiers.length} dossiers: ${errors.length} errors, ${warnings.length} warnings.`);
process.exit(errors.length ? 1 : 0);
