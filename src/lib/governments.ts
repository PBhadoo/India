import fs from 'node:fs';
import path from 'node:path';
import type { Government, GovernmentsData, Party } from './types.ts';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function normalise(raw: any, level: 'centre' | 'state', state?: string): Government {
  const { pm, cm, ...rest } = raw;
  return {
    ...rest,
    level,
    state,
    leader: pm ?? cm ?? rest.leader ?? '',
    partners: rest.partners ?? [],
  } as Government;
}

/** Loads centre, state and party data. Missing or malformed files yield empty data, never throw. */
export function loadGovernmentsData(dataDir: string = DATA_DIR): GovernmentsData {
  const gov = readJson<{ centre?: any[] }>(path.join(dataDir, 'governments.json'), {});
  const centre = (gov.centre ?? []).map((g) => normalise(g, 'centre'));
  const parties = readJson<Party[]>(path.join(dataDir, 'parties.json'), []);
  const states: GovernmentsData['states'] = {};
  const statesDir = path.join(dataDir, 'states');
  let files: string[] = [];
  try {
    files = fs.readdirSync(statesDir).filter((f) => f.endsWith('.json')).sort();
  } catch {
    files = [];
  }
  for (const f of files) {
    const doc = readJson<{ state?: string; name?: string; governments?: any[] }>(path.join(statesDir, f), {});
    const id = doc.state ?? f.replace(/\.json$/, '');
    states[id] = {
      name: doc.name ?? id,
      governments: (doc.governments ?? []).map((g) => normalise(g, 'state', id)),
    };
  }
  return { centre, states, parties: Array.isArray(parties) ? parties : [] };
}

export interface GovernmentIndex {
  data: GovernmentsData;
  all: Government[];
  get(id: string): Government | undefined;
  party(id: string): Party | undefined;
}

export function buildIndex(data: GovernmentsData): GovernmentIndex {
  const all = [...data.centre, ...Object.values(data.states).flatMap((s) => s.governments)];
  const byId = new Map(all.map((g) => [g.id, g]));
  const partyById = new Map(data.parties.map((p) => [p.id, p]));
  return { data, all, get: (id) => byId.get(id), party: (id) => partyById.get(id) };
}

let cached: GovernmentIndex | undefined;
function idx(): GovernmentIndex {
  return (cached ??= buildIndex(loadGovernmentsData()));
}

export const getGovernment = (id: string) => idx().get(id);
export const centreGovernments = (): Government[] => idx().data.centre;
export const stateGovernments = (stateId: string): Government[] => idx().data.states[stateId]?.governments ?? [];
export const listStates = (): { id: string; name: string }[] =>
  Object.entries(idx().data.states).map(([id, s]) => ({ id, name: s.name }));
export const allGovernments = (): Government[] => idx().all;
export const parties = (): Party[] => idx().data.parties;
export const getParty = (id: string) => idx().party(id);
/** Display short name, falling back to the id. */
export const partyShort = (id: string) => idx().party(id)?.short ?? id.toUpperCase();
export const governmentsOfParty = (partyId: string, lead = false): Government[] =>
  idx().all.filter((g) => (lead ? g.leadParty === partyId : g.partners.some((p) => p.party === partyId)));
