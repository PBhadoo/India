import type { ScorableAction } from './types.ts';

/** Thin reader over the Astro content collections (only usable inside Astro). */
export async function getActionEntries() {
  const { getCollection } = await import('astro:content');
  return getCollection('actions');
}

export async function getDevelopingEntries() {
  const { getCollection } = await import('astro:content');
  return getCollection('developing');
}

/** Maps a collection entry onto the pure-scoring input shape. */
export function toScorable(entry: { id: string; data: any }): ScorableAction {
  const d = entry.data;
  return {
    slug: entry.id,
    title: d.title,
    category: d.category,
    level: d.level,
    governmentId: d.governmentId,
    originGovernmentId: d.originGovernmentId,
    scorers: d.scoring?.scorers ?? [],
  };
}

export async function getScorableActions(): Promise<ScorableAction[]> {
  try {
    return (await getActionEntries()).map(toScorable);
  } catch {
    return [];
  }
}
