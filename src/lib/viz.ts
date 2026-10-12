import type { Government, Party } from './types.ts';
import { toTime } from './tenure.ts';

/** Number of categorical colour slots with a validated palette (see styles/global.css). */
export const PALETTE_SLOTS = 8;

/**
 * Fixed chronological slot per party: the order in which parties first lead, then join,
 * a government (by start date). Slot 0 is the neutral "other" fallback.
 * New parties only ever append, so existing parties never change colour.
 */
export function partySlots(governments: Government[], parties: Party[]): Record<string, number> {
  const order: string[] = [];
  const seen = new Set<string>();
  const add = (id: string | null | undefined) => {
    if (id && !seen.has(id)) {
      seen.add(id);
      order.push(id);
    }
  };
  const byStart = (list: Government[]) => [...list].sort((a, b) => toTime(a.start) - toTime(b.start));
  const centre = byStart(governments.filter((g) => g.level === 'centre'));
  const states = byStart(governments.filter((g) => g.level !== 'centre'));
  // Lead parties first (they colour the timeline), then coalition partners, centre before states.
  for (const g of centre) add(g.leadParty);
  for (const g of centre) g.partners.forEach((p) => add(p.party));
  for (const g of states) add(g.leadParty);
  for (const g of states) g.partners.forEach((p) => add(p.party));
  for (const p of [...parties].sort((a, b) => (a.founded ?? 9999) - (b.founded ?? 9999))) add(p.id);
  const out: Record<string, number> = {};
  order.forEach((id, i) => (out[id] = i < PALETTE_SLOTS ? i + 1 : 0));
  return out;
}

export interface PartyMeta {
  id: string;
  name: string;
  short: string;
  slot: number;
}

export function partyMeta(id: string, parties: Party[], slots: Record<string, number>): PartyMeta {
  const p = parties.find((x) => x.id === id);
  return { id, name: p?.name ?? id.toUpperCase(), short: p?.short ?? id.toUpperCase(), slot: slots[id] ?? 0 };
}

export interface LabelItem {
  id: string;
  startPct: number;
  widthPct: number;
  text: string;
  priority: number;
}
export interface LabelPlacement {
  id: string;
  lane: number;
  align: 'left' | 'right';
}

/**
 * Greedy collision-free placement of direct labels on staggered lanes under a
 * timeline. Each label has a leader tick up to the bar, so a lane assignment is
 * valid only if no label text or leader tick crosses another. Items that cannot
 * be placed are omitted (they remain reachable via tooltip, legend and table).
 */
export function layoutLabels(items: LabelItem[], widthPx = 992, maxLanes = 5, charPx = 6.3, pad = 24): LabelPlacement[] {
  type Placed = { id: string; lane: number; x0: number; x1: number; tickX: number; align: 'left' | 'right' };
  const placed: Placed[] = [];
  for (const it of [...items].sort((a, b) => b.priority - a.priority)) {
    const w = it.text.length * charPx + pad;
    const startX = (it.startPct / 100) * widthPx;
    const align: 'left' | 'right' = startX + w > widthPx ? 'right' : 'left';
    const x0 = align === 'left' ? startX : startX - w;
    const x1 = align === 'left' ? startX + w : startX;
    if (x0 < 0) continue;
    for (let lane = 0; lane < maxLanes; lane++) {
      const clash = placed.some((p) => {
        if (p.lane === lane) return !(x1 + 6 < p.x0 || x0 - 6 > p.x1);
        if (p.lane > lane) return p.tickX >= x0 - 3 && p.tickX <= x1 + 3;
        return startX >= p.x0 - 3 && startX <= p.x1 + 3;
      });
      if (!clash) {
        placed.push({ id: it.id, lane, x0, x1, tickX: startX, align });
        break;
      }
    }
  }
  return placed.map((p) => ({ id: p.id, lane: p.lane, align: p.align }));
}
