# Routine: monthly stale refresh

You are refreshing existing entries of India Explained, a neutral, source-backed tracker of Indian policy, in the git repository at the current directory. You have no other context; follow this file exactly. Never merge or push to `main`.

## Setup
1. Today is `TODAY`. Create branch `refresh/YYYY-MM` from the latest `main`.
2. Read `docs/CONTRACT.md` and `scripts/loaded-words.json`.
3. Run `node scripts/stale-report.mjs` (entries not reviewed in over 90 days; thin coverage). Take the oldest 10 entries, mixing parties and eras as listed (do not pick only one side's). Also list `src/content/developing/` items and treat all of them as due.

## For each entry
1. Re-open every source URL. Fix or replace dead links (prefer primary sources; the Wayback Machine URL is acceptable as a replacement).
2. Search for developments since `lastReviewed` that change a fact: amendments, court rulings, repeal, new official data, new audits. Update `facts`, `status` (`proposed|passed|implemented|stalled|repealed|struck-down`) and numbers, citing sources. Add new benefits or concerns only with evidence, and keep both sides at similar depth.
3. Keep wording neutral and attributed. Do not edit scores. If a fact changed enough that the scores may no longer fit (for example a repeal, or new outcome data), list the slug in the PR for re-scoring through `docs/routines/score.md`.
4. Set `lastReviewed` to TODAY only for entries you actually re-checked.
5. Developing items: update `knownFacts` and `unknowns` with dated, sourced facts. If the matter has concluded, set `status: settled`, and propose in the PR a full action via the intake process (do not draft it here).

## Finish
1. `npm run validate`, `npm test`, `npm run build`, `npm run audit` must pass.
2. Commit `Refresh stale entries YYYY-MM`, push `refresh/YYYY-MM`, open a PR using `.github/pull_request_template.md` listing each entry, what changed, links that were dead, and entries needing re-scoring. Never merge.
