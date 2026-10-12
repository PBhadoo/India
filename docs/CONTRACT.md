# Data contract

Every agent works against this file. Do not change a schema without updating this file and `src/content.config.ts` together.

## Principles
- Neutral: the same template and depth for every party and era. No loaded adjectives. Facts and interpretation are separate.
- Every claim has a source. Prefer primary sources (Gazette, Lok Sabha/PRS, CAG, RBI, NSO/MoSPI, NFHS, Supreme Court judgments, Election Commission) over media.
- Dates are ISO `YYYY-MM-DD`. Years are plain numbers.

## `src/data/taxonomy.yaml`
Categories with `id`, `name`, `blurb`, `subs` (list of sub-category slugs). Sub-category display names are derived by title-casing the slug unless `src/data/sub-names.json` overrides it.

## `src/data/parties.json`
```json
[{ "id": "inc", "name": "Indian National Congress", "short": "INC", "founded": 1885 }]
```

## `src/data/governments.json`  (Centre)
```json
{
  "centre": [{
    "id": "centre-1991-narasimha-rao",
    "pm": "P. V. Narasimha Rao",
    "label": "INC government",
    "leadParty": "inc",
    "type": "majority | coalition | minority-outside-support | caretaker",
    "start": "1991-06-21",
    "end": "1996-05-16",
    "lokSabha": 10,
    "partners": [{ "party": "inc", "share": 1.0, "note": "optional" }],
    "sources": [{ "title": "...", "url": "https://..." }]
  }]
}
```
- `end: null` means the government is in office today.
- `partners[].share` sums to 1.0 and is each party's share of the governing coalition's Lok Sabha seats at formation (document the basis in `note`). Outside-support parties are not partners; list them in `outsideSupport`: `[{ "party": "...", "note": "..." }]`.
- Caretaker or acting PMs (e.g. Gulzarilal Nanda) are included with `type: "caretaker"`.

## `src/data/states/<state-id>.json`
Same shape as the centre list but under `"governments"`, with `cm` in place of `pm` and a top-level `"state"` (id) and `"name"`.

## Action entries: `src/content/actions/<slug>.md`
Front-matter (all fields required unless marked optional):
```yaml
title: Goods and Services Tax (GST)
summary: One neutral sentence, max 220 chars.
category: economy                  # taxonomy category id
subcategories: [budget-taxation]   # taxonomy sub ids
date: 2017-07-01                   # date it took effect or was decided
level: centre                      # centre | state
state: delhi                       # optional, state id, when level is state
governmentId: centre-2014-modi-1   # government that implemented it (must exist in governments data)
originGovernmentId: centre-2004-manmohan-1  # optional, government that originated the idea
status: implemented                # proposed | passed | implemented | stalled | repealed | struck-down
developing: false
lastReviewed: 2026-10-11
facts:                             # neutral bullets: what happened, who, when, numbers
  - ...
why:
  stated: [ ... ]                  # reasons given by those who did it, attributed
  criticism: [ ... ]               # optional: challenges to that rationale
benefits:                          # one object per point
  - point: ...
    evidence: ...                  # optional but strongly preferred, with source index e.g. [1]
concerns:
  - point: ...
    evidence: ...
sources:
  - { title: ..., url: https://..., publisher: ..., type: primary | official-data | court | reputable-media | academic }
scoring:
  era_baseline: one sentence on what "normal" looked like then (growth, peers, previous decade)
  lag_years: 3                     # years before outcomes could reasonably show
  shocks: [ ... ]                  # optional, e.g. covid-2020
  confidence: low | medium | high
  scorers:                         # exactly two, scored blind to party, using src/data/rubric.json
    - { id: A, reach: 4, outcome: 2, sustainability: 1, process: 0, delivery: 3, note: "..." }
    - { id: B, reach: 4, outcome: 1, sustainability: 2, process: -1, delivery: 3, note: "..." }
```
Markdown body (optional): a short "In depth" explainer, neutral.

## Developing items: `src/content/developing/<slug>.md`
```yaml
title: ...
date: 2026-10-10
category: economy
summary: ...
status: developing | settled
knownFacts: [ ... ]
unknowns: [ ... ]
sources: [ { title, url, publisher, type } ]
relatedAction: optional action slug
```

## Scoring maths (implemented in `src/lib/scoring.ts`)
- Per action: criterion mean across the two scorers; action points = sum of the five criterion means (range -25 to +25). Low/high = lowest and highest scorer totals.
- Credit: implementer government gets 1.0 x points; a different `originGovernmentId` gets 0.25 x points. Each government's credit is split across `partners` by `share`.
- Party totals are the sum of credits. Years in power: sum over governments of `(days in office / 365.25) x partner.share` for each party, with a separate whole-years count where the party led. Points per year = points / years in power, computed with a category weight vector (default all 1).
- Flag a criterion for review when the two scorers differ by 2 or more.
- A party-category cell with fewer than 2 scored actions is labelled "low data".

---

# Addendum v2: Dossiers, institution actions, new categories

## Claim types (use these exact labels everywhere)
- `finding`: a court, regulator or statutory body's recorded finding or order (cite the order/judgment).
- `official-statement`: what a government, ministry, constitutional body or company officially said or filed.
- `allegation`: a claim by a party, petitioner, journalist, NGO or analyst that has not been established by a finding. Always state its current status and the named party's response.
- `data`: a measured figure from an official or audited source, with period and unit.
- `event`: a dated, uncontested occurrence (a notification issued, a bill passed, an arrest made).

## Dossiers: `src/content/dossiers/<slug>.md` (not scored, no party points)
```yaml
title: Special Intensive Revision of electoral rolls
summary: One neutral sentence, max 240 chars.
category: elections                 # taxonomy id
subcategories: [electoral-rolls]
kind: topic | institution | organisation | party | company-group
asOf: 2026-10-12                    # date the facts were last checked
status: ongoing | settled
lastReviewed: 2026-10-12
timeline:                           # chronological, each item sourced
  - { date: 2025-06-24, event: "...", actor: "Election Commission of India", type: event, source: 1 }
claims:                             # contested or notable assertions
  - claim: "..."
    type: allegation | finding | official-statement | data
    madeBy: "who said it (named)"
    status: "e.g. pending before Supreme Court / upheld / dismissed / denied / unverified"
    response: "the named party's stated response, if any"   # required for allegations about a named person or company
    source: 3
positions:                          # who says what, in their own words (paraphrase with attribution)
  - { holder: "Election Commission of India", position: "...", source: 2 }
tables:                             # measured data
  - title: "..."
    caption: "what it measures, period, unit"
    columns: [Year, Registered, Convicted]
    rows: [[2019, 1, 2]]
    source: 4
notShown:                           # what the facts here do NOT establish (required, at least 2 items)
  - "..."
sources:                            # same shape as actions; index = position in this list, starting at 1
  - { title: ..., url: https://..., publisher: ..., type: primary | official-data | court | reputable-media | academic }
```
Markdown body (optional, 150-400 words): a neutral explainer. At least 5 sources, at least 2 primary/official-data/court. Cite `[n]` source indices.

Rules for dossiers:
- No verdicts ("biased", "captured", "corrupt", "controls") and no motive attribution. Report findings, figures, statements and statuses; end with `notShown`.
- Every allegation names who made it, its legal status, and the response of any named person, company or body.
- Named private people and companies: use only court/regulator/government/company-filing facts or reputable journalism, labelled as such; give their stated response.
- Counterfactual questions ("what if X were removed") are answered only with documented exposure data and documented precedents, never predictions.
- Parties in power are named by government id and date, not by adjectives. Parity: the same questions are asked of every government and party.

## Action entries by independent institutions
Add `credit: none` to the front-matter of an Action whose decision-maker is an independent institution (Election Commission, a court, a regulator) rather than a party government. It is still scored on the rubric and shown, but earns or loses no party points. Default is `credit: party`. Optional `institution: "Election Commission of India"`. `governmentId` is still required (the government in office at the time) for context.

## New categories (added to taxonomy.yaml)
- `business-power`: Business & Public Power (subs: big-business-groups, regulators-markets, competition-concentration, business-political-funding, state-contracts-privatisation)
- `parties-movements`: Parties, Movements & Civil Society (subs: new-parties, ngos-civil-society, protests-movements, arrests-prosecutions)
