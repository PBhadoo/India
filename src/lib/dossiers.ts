// Pure helpers for dossiers (Addendum v2). No Astro imports, so node --test can load this file.
import { fmtDate } from './format.ts';

export type ClaimType = 'finding' | 'official-statement' | 'allegation' | 'data' | 'event';

export const CLAIM_TYPE_ORDER: ClaimType[] = ['finding', 'official-statement', 'allegation', 'data', 'event'];

/** Labels and definitions; the definitions are the Addendum v2 wording and are reused on the methodology page. */
export const CLAIM_TYPE_INFO: Record<ClaimType, { label: string; short: string; definition: string }> = {
  finding: {
    label: 'Finding',
    short: 'Recorded by a court, regulator or statutory body',
    definition: "A court, regulator or statutory body's recorded finding or order. The order or judgment is cited.",
  },
  'official-statement': {
    label: 'Official statement',
    short: 'Said or filed officially',
    definition: 'What a government, ministry, constitutional body or company officially said or filed.',
  },
  allegation: {
    label: 'Allegation',
    short: 'Claimed; not established by a finding',
    definition:
      'A claim by a party, petitioner, journalist, NGO or analyst that has not been established by a finding. Its current status and the named party’s response are always stated.',
  },
  data: {
    label: 'Data',
    short: 'Measured figure from an official or audited source',
    definition: 'A measured figure from an official or audited source, with its period and unit.',
  },
  event: {
    label: 'Event',
    short: 'Dated, uncontested occurrence',
    definition: 'A dated, uncontested occurrence, such as a notification issued, a bill passed or an arrest made.',
  },
};

export const KIND_LABEL: Record<string, string> = {
  topic: 'Topic',
  institution: 'Institution',
  organisation: 'Organisation',
  party: 'Party',
  'company-group': 'Company group',
  debate: 'Debate',
};

export const DOSSIER_STATUS_LABEL: Record<string, string> = { ongoing: 'Ongoing', settled: 'Settled' };

export const isClaimType = (t: unknown): t is ClaimType => typeof t === 'string' && t in CLAIM_TYPE_INFO;

/** Normalises a `source` field (number, list of numbers or absent) to a sorted unique list of 1-based indices. */
export function srcList(ref: unknown): number[] {
  const raw = Array.isArray(ref) ? ref : ref == null ? [] : [ref];
  return [...new Set(raw.filter((n): n is number => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);
}

/** Dates may be ISO dates, Dates, or partial strings such as "2025-06" or "2025"; partial values are shown as written. */
export function fmtLooseDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  if (d instanceof Date) return fmtDate(d);
  return /^\d{4}-\d{2}-\d{2}/.test(d) ? fmtDate(d) : d;
}

export function looseDateIso(d: Date | string | null | undefined): string | undefined {
  if (!d) return undefined;
  const s = d instanceof Date ? d.toISOString().slice(0, 10) : d;
  return /^\d{4}(-\d{2}(-\d{2})?)?/.test(s) ? s.slice(0, 10) : undefined;
}

/** Whole days from `asOf` (ISO date or Date) to `now`. */
export function daysBetween(asOf: Date | string, now: Date = new Date()): number {
  const iso = asOf instanceof Date ? asOf.toISOString().slice(0, 10) : asOf.slice(0, 10);
  return Math.floor((+now - +new Date(iso + 'T00:00:00Z')) / 86_400_000);
}

export interface DossierLike {
  slug: string;
  data: { category: string; subcategories?: string[]; asOf: Date | string };
}

/** Dossiers that share a category with the target, those sharing a sub-category first, then newest asOf. */
export function dossiersInCategory<T extends DossierLike>(all: T[], category: string, subs: string[] = []): T[] {
  return all
    .filter((d) => d.data.category === category)
    .map((d) => ({ d, shared: (d.data.subcategories ?? []).filter((s) => subs.includes(s)).length }))
    .sort((a, b) => b.shared - a.shared || +new Date(b.d.data.asOf) - +new Date(a.d.data.asOf) || a.d.slug.localeCompare(b.d.slug))
    .map((x) => x.d);
}

/** Dossiers sharing at least one of the given sub-categories within the category. */
export function dossiersForSubs<T extends DossierLike>(all: T[], category: string, subs: string[]): T[] {
  return dossiersInCategory(all, category, subs).filter((d) => (d.data.subcategories ?? []).some((s) => subs.includes(s)));
}
