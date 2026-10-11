/** Small pure formatters shared by Astro pages and browser islands. */

export const MINUS = '−';

export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Signed one-decimal number with a true minus sign. */
export function fmtSigned(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return '–';
  const v = Math.abs(n) < 0.05 * 10 ** (1 - digits) ? 0 : n;
  const s = Math.abs(v).toFixed(digits);
  return (v < 0 ? MINUS : v > 0 ? '+' : '') + s;
}

export function fmtNum(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return '–';
  const s = Math.abs(n).toFixed(digits);
  return (n < 0 && Number(s) !== 0 ? MINUS : '') + s;
}

export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('en-IN');
}

export function fmtYears(n: number): string {
  return n.toFixed(1);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "21 Jun 1991" from an ISO date or Date (UTC). */
export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '';
  const iso = d instanceof Date ? d.toISOString().slice(0, 10) : d.slice(0, 10);
  const [y, m, day] = iso.split('-').map(Number);
  return `${day} ${MONTHS[m - 1]} ${y}`;
}

export const isoDate = (d: Date | string): string => (d instanceof Date ? d.toISOString().slice(0, 10) : d.slice(0, 10));
export const yearOf = (d: Date | string): number => Number(isoDate(d).slice(0, 4));

/** "5 y 2 m" style duration from days. */
export function fmtDuration(days: number): string {
  if (days < 60) return `${days} ${days === 1 ? 'day' : 'days'}`;
  const years = Math.floor(days / 365.25);
  const months = Math.round((days - years * 365.25) / 30.44);
  const y = months === 12 ? years + 1 : years;
  const m = months === 12 ? 0 : months;
  if (y === 0) return `${m} months`;
  return m ? `${y} y ${m} m` : `${y} y`;
}

export const GOV_TYPE_LABEL: Record<string, string> = {
  majority: 'Majority government',
  coalition: 'Coalition government',
  'minority-outside-support': 'Minority, outside support',
  caretaker: 'Caretaker',
};

export const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  passed: 'Passed',
  implemented: 'Implemented',
  stalled: 'Stalled',
  repealed: 'Repealed',
  'struck-down': 'Struck down',
};

export const SOURCE_TYPE_LABEL: Record<string, string> = {
  primary: 'Primary',
  'official-data': 'Official data',
  court: 'Court',
  'reputable-media': 'Media',
  academic: 'Academic',
};

export const CONFIDENCE_LABEL: Record<string, string> = { low: 'Low confidence', medium: 'Medium confidence', high: 'High confidence' };

/** Initials + surname: "Atal Bihari Vajpayee" -> "A.B. Vajpayee". */
export function shortLeader(name: string): string {
  const t = name.replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(Boolean);
  if (t.length < 2) return name;
  const last = t[t.length - 1];
  const ini = t.slice(0, -1).map((w) => w.replace(/\./g, '')[0]?.toUpperCase() + '.').join('');
  return `${ini} ${last}`;
}
