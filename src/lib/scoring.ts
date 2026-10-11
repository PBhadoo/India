export * from './scoring-core.ts';
import { computeScoring } from './scoring-core.ts';
import type { ScoringOptions, ScoringResult } from './scoring-core.ts';

/** Real-data wrapper: reads collections, governments and taxonomy. Returns an empty result on any missing data. */
export async function getScoring(opts: ScoringOptions = {}): Promise<ScoringResult> {
  const [{ getScorableActions }, { allGovernments }, { categoryIds }] = await Promise.all([
    import('./collections.ts'),
    import('./governments.ts'),
    import('./taxonomy.ts'),
  ]);
  const actions = await getScorableActions();
  return computeScoring(actions, allGovernments(), { categoryIds: categoryIds(), ...opts });
}
