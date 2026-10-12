export type GovernmentType = 'majority' | 'coalition' | 'minority-outside-support' | 'caretaker' | 'presidents-rule';
export type Level = 'centre' | 'state';

export interface Partner {
  party: string;
  share: number;
  note?: string;
}

export interface Source {
  title: string;
  url: string;
  publisher?: string;
  type?: string;
}

/** A government as normalised by governments.ts (pm/cm collapsed into `leader`). */
export interface Government {
  id: string;
  level: Level;
  /** State id for state governments. */
  state?: string;
  leader: string;
  label: string;
  leadParty: string;
  type: GovernmentType;
  start: string;
  end: string | null;
  lokSabha?: number;
  partners: Partner[];
  outsideSupport?: { party: string; note?: string }[];
  sources?: Source[];
}

export interface Party {
  id: string;
  name: string;
  short: string;
  founded?: number;
  [key: string]: unknown;
}

export interface GovernmentsData {
  centre: Government[];
  states: Record<string, { name: string; governments: Government[] }>;
  parties: Party[];
}

export const CRITERIA = ['reach', 'outcome', 'sustainability', 'process', 'delivery'] as const;
export type CriterionId = (typeof CRITERIA)[number];

export interface ScorerEntry {
  id: string;
  reach: number;
  outcome: number;
  sustainability: number;
  process: number;
  delivery: number;
  note?: string;
}

/** The minimum an action needs for scoring; real collection entries map onto this. */
export interface ScorableAction {
  slug: string;
  title?: string;
  category: string;
  level: Level;
  governmentId: string;
  originGovernmentId?: string;
  /** 'none': independent institution; scored but earns no party credit. Default 'party'. */
  credit?: 'party' | 'none';
  scorers: ScorerEntry[];
}
