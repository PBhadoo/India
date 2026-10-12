# Routine: drafting approved candidates

You are drafting entries for India Explained, a neutral, source-backed tracker of Indian politics and policy, in the git repository at the current directory. You have no other context; follow this file exactly. Never merge or push to `main`.

## Input
The intake file `src/data/intake/DATE.md` on branch `weekly/DATE` (check it out; if you are given a different date, use that). Only draft candidates whose `decision:` is `approve` (full action) or `developing`. Skip `pending` and `skip`.

## Setup
Read `docs/CONTRACT.md` fully, `src/data/taxonomy.yaml`, `src/data/rubric.json`, `src/data/governments.json` and `src/data/states/`, `scripts/loaded-words.json`, and two existing entries in `src/content/actions/` from different parties and eras to match house style and depth.

## Writing an action (`src/content/actions/<kebab-slug>.md`)
- All front-matter fields per CONTRACT.md. `governmentId` must be the government in office on the effective date (check start/end in the governments data); add `originGovernmentId` only where a different government originated the idea and a source says so. `lastReviewed` is today. `developing: false`. `scoring.scorers: []`.
- `summary` at most 220 characters, one neutral sentence.
- `facts`: checkable statements with dates and numbers, each ending with source indices like `[1]`. Say what a source does not state rather than guessing.
- `why.stated`: reasons given by those who acted, attributed. `why.criticism`: challenges to that rationale, attributed.
- `benefits` and `concerns`: both present, each with `evidence` citing sources. Use the same depth you would for any party: roughly the same number of points, similar evidence. Interpretation belongs here and in `why`, never in `facts`.
- At least two https sources; at least one `primary`, `official-data` or `court` where one exists. Open every URL and confirm it supports the claim. Do not invent URLs.
- `scoring.era_baseline` (what normal looked like then), `lag_years`, `shocks`, `confidence`.
- Language: no loaded words; no "landmark", "controversial" or similar unless quoting and attributing. Do not mention scores.
- Optional body: a short "In depth" explainer, neutral, with caveats about unverified items.

## Writing a developing item (`src/content/developing/<slug>.md`)
Front-matter per CONTRACT.md: `status: developing`, `knownFacts` (dated, sourced `[n]`), `unknowns` (what is not yet known, including what you could not verify), at least two sources, `date` of the latest development. Describe; do not predict or judge.

## Checks and finish
1. `npm run validate` and `npm test` and `npm run build` must pass.
2. Commit only your new files on branch `weekly/DATE`: `git commit -m "Draft entries from intake DATE"`; `git push`.
3. Update the PR (or open one titled `Weekly DATE: <n> new, <m> developing` using `.github/pull_request_template.md`). List the entries and anything unverified. Do not merge.
