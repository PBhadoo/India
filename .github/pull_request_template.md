## What this PR changes

<!-- New action / developing item / correction / refresh / tooling. Link the intake file or issue if any. -->

## Neutrality checklist

- [ ] Same template and comparable depth as entries for other parties and eras (facts, why, benefits, concerns, sources, scoring block).
- [ ] Every claim is sourced; facts cite a source index, and gaps are stated rather than filled.
- [ ] Facts and interpretation are kept apart (facts are checkable; criticism and praise are attributed to who said them).
- [ ] No loaded words (see `scripts/loaded-words.json`); no adjectives that carry a verdict.
- [ ] Benefits and concerns are both present, with evidence where it exists.
- [ ] At least two sources, at least one primary / official-data / court source where one exists.
- [ ] Two blind scores are present (scorers A and B scored from `strip-for-scoring.mjs` output, without party or government), or `scorers: []` is deliberate for a new draft.
- [ ] `lastReviewed` is set to today's date.
- [ ] `governmentId` / `originGovernmentId` / `level` / `state` are correct and exist in the governments data.

## Checks run

- [ ] `npm run validate`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run audit` (for content PRs; paste any new imbalance below)

## Notes for the reviewer

<!-- Anything uncertain, sources that could not be verified, scorer disagreements of 2+ points. -->
