import type { Government, Party } from './types.ts';
import { toTime } from './tenure.ts';

/** Number of categorical colour slots with a validated palette (see styles/global.css). */
export const PALETTE_SLOTS = 8;

/**
 * Fixed chronological slot per party: the order in which parties first appear in
 * any government (by start date). Slot 0 is the neutral "other" fallback.
 * New parties only ever append, so existing parties never change colour.
 */
export function partySlots(governments: Government[], parties: Party[]): Record<string, number> {
  const order: string[] = [];
  const seen = new Set<string>();
  const add = (id: string) => {
    if (!seen.has(id)) {
      seen.add(id);
      order.push(id);
    }
  };
  const centre = governments.filter((g) => g.level === 'centre');
  const pool = centre.length ? centre : governments;
  for (const g of [...pool].sort((a, b) => toTime(a.start) - toTime(b.start))) {
    add(g.leadParty);
    for (const p of g.partners) add(p.party);
  }
  for (const g of [...governments].sort((a, b) => toTime(a.start) - toTime(b.start))) {
    add(g.leadParty);
    for (const p of g.partners) add(p.party);
  }
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
