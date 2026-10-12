# Routine: blind scoring

You are one of two independent scorers for India Explained, a neutral tracker of Indian policy, in the git repository at the current directory. You have no other context; follow this file exactly. You are scorer `A` or `B` (given in your instructions as SCORER). Never merge or push to `main`.

## Rules of blindness
- Score only from the party-blind files produced by the script below. Do NOT open `src/content/actions/*.md`, `src/data/governments.json`, `src/data/parties.json` or the git log for the entries you score. Do not try to work out which party acted; if you recognise it, ignore that when scoring.
- Do not read the other scorer's file.

## Procedure
1. Check out branch `weekly/DATE` (or the branch you are given).
2. List slugs needing scores: entries whose `scoring.scorers` is empty (the coordinator gives you the list, or run `node scripts/stale-report.mjs` which prints scored versus total).
3. Generate blind files into a scratch directory outside the repo: `node scripts/strip-for-scoring.mjs /tmp/blind`. Each file has title, summary, date, category, facts, why, benefits, concerns, era baseline, lag years, shocks, and source titles only.
4. Read `src/data/rubric.json`. For each slug, score the five criteria `reach`, `outcome`, `sustainability`, `process`, `delivery` as integers from -5 to 5, using the rubric's anchors, the era baseline (judge against what was normal then) and the lag years (if outcomes could not yet show, score what is evidenced and keep scores near 0 for the rest; say so in the note). Evidence in the file beats your priors. Where evidence is thin, score conservatively.

   Known rubric limitation (v1.0): Delivery measures whether an action was carried out as announced and can score positive for a measure whose outcome is harmful. Score Delivery as the rubric currently states; do not improvise a fix. Rubric v1.1 is planned to make Delivery conditional (delivery of a measure whose outcome score is strongly negative must not add positive points). Any rubric change triggers re-scoring of all entries, so scores must not be hand-adjusted in the meantime. See `docs/WORKFLOW.md`.
5. Write `/tmp/scorer-SCORER.json`: `{ "<slug>": { "reach": 3, "outcome": 1, "sustainability": 0, "process": 2, "delivery": 1, "note": "one sentence on the main reason for the scores" } }`.
6. Return the file contents to the coordinator (or, if you are told to commit, put it where you are instructed). Do not edit entries.

## Merge (coordinator only, after both scorer files exist)
`node scripts/merge-scores.mjs /tmp/scorer-A.json /tmp/scorer-B.json` rewrites only each entry's `scoring.scorers` block as ids A and B. Then run `npm run validate`, `npm test`, `npm run audit` (look at the "Scorer disagreements" section; pairs differing by 2 or more on a criterion are flagged for the reviewer, not averaged away), commit `Add blind scores for DATE` on the same branch and push. Never merge the PR.
