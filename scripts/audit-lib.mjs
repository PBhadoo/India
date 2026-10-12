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
