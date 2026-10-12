import type { Government } from './types.ts';

const MS_PER_DAY = 86_400_000;
const DAYS_PER_YEAR = 365.25;

/** Parses YYYY-MM-DD (or a Date) to a UTC timestamp. */
export function toTime(d: string | Date): number {
  if (d instanceof Date) return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, day);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Days in office from start to end (or asOf if open-ended / end after asOf). 0 if not yet started. */
export function daysInOffice(g: Pick<Government, 'start' | 'end'>, asOf: string | Date = todayISO()): number {
  const start = toTime(g.start);
  const limit = toTime(asOf);
  const end = g.end ? Math.min(toTime(g.end), limit) : limit;
  return Math.max(0, Math.round((end - start) / MS_PER_DAY));
}

export const yearsInOffice = (g: Pick<Government, 'start' | 'end'>, asOf?: string | Date) =>
  daysInOffice(g, asOf) / DAYS_PER_YEAR;

export interface PartyYears {
  /** Sum of years in office x coalition share. */
  weighted: number;
  /** Full years of governments this party led (no share weighting). */
  led: number;
}

/**
 * Years in power per party. Shares fall back to the lead party at 1.0 when
 * a government has no partners.
 */
export function partyYears(
  governments: Government[],
  asOf: string | Date = todayISO(),
): Record<string, PartyYears> {
  const out: Record<string, PartyYears> = {};
  const slot = (p: string) => (out[p] ??= { weighted: 0, led: 0 });
  for (const g of governments) {
    const years = yearsInOffice(g, asOf);
    if (years <= 0) continue;
    if (!g.leadParty && !g.partners.length) continue; // e.g. President's rule: no governing party
    const partners = g.partners.length ? g.partners : [{ party: g.leadParty, share: 1 }];
    for (const p of partners) slot(p.party).weighted += years * p.share;
    slot(g.leadParty).led += years;
  }
  return out;
}

export interface TimelineSegment {
  governmentId: string;
  leader: string;
  leadParty: string;
  type: Government['type'];
  start: string;
  /** Effective end (asOf for open-ended governments). */
  end: string;
  days: number;
  /** Position/width as percentages of the overall span. */
  startPct: number;
  widthPct: number;
  ongoing: boolean;
}

/** Segments for a horizontal timeline, positioned across [rangeStart, rangeEnd] (defaults to first start .. asOf). */
export function timelineSegments(
  governments: Government[],
  asOf: string | Date = todayISO(),
  range?: { start?: string; end?: string },
): TimelineSegment[] {
  const sorted = [...governments].sort((a, b) => toTime(a.start) - toTime(b.start));
  if (!sorted.length) return [];
  const asOfT = toTime(asOf);
  const t0 = range?.start ? toTime(range.start) : toTime(sorted[0].start);
  const t1 = range?.end ? toTime(range.end) : asOfT;
  const span = Math.max(1, t1 - t0);
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
  return sorted.map((g) => {
    const s = Math.max(toTime(g.start), t0);
    const e = Math.min(g.end ? Math.min(toTime(g.end), asOfT) : asOfT, t1);
    return {
      governmentId: g.id,
      leader: g.leader,
      leadParty: g.leadParty,
      type: g.type,
      start: g.start,
      end: iso(e),
      days: daysInOffice(g, asOf),
      startPct: ((s - t0) / span) * 100,
      widthPct: (Math.max(0, e - s) / span) * 100,
      ongoing: g.end === null,
    };
  });
}
