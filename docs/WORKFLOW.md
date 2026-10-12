# Maintenance workflow

The tracker is kept current by a fixed cycle. Agents do the legwork; a human approves every change through a pull request. Nothing is merged or pushed to `main` by an agent.

## Weekly cycle

| Step | Who | Prompt | Output |
|---|---|---|---|
| 1. Intake | agent | [`routines/intake.md`](routines/intake.md) | `src/data/intake/YYYY-MM-DD.md` on branch `weekly/YYYY-MM-DD` |
| 2. Candidate approval | human | edits the intake file: sets `decision:` to `approve`, `developing` or `skip` | the same file |
| 3. Drafting | agent | [`routines/draft.md`](routines/draft.md) | new files in `src/content/actions/` and `src/content/developing/`, unscored |
| 4. Blind double scoring | two separate agent sessions | [`routines/score.md`](routines/score.md) | `scorerA.json`, `scorerB.json`, merged into the entries |
| 5. Neutrality review | a third agent session | [`routines/review.md`](routines/review.md) | review notes in the PR, fixes pushed to the same branch |
| 6. Human review | human | PR template checklist | approval or requested changes |
| 7. Publish | human | merge the PR | Cloudflare Pages builds `main` |

Steps 1 to 5 happen on one branch named `weekly/YYYY-MM-DD` (the date the cycle starts) and one pull request. Agents open the PR and stop. They never merge, never force-push and never push to `main`.

Why the steps are separate: the scorers must not see which party acted (`scripts/strip-for-scoring.mjs` removes it) and must not see each other's scores; the reviewer must not be the drafter.

## Monthly: stale refresh

First week of each month, run [`routines/refresh.md`](routines/refresh.md) on branch `refresh/YYYY-MM`. It works through `node scripts/stale-report.mjs` (entries not reviewed in over 90 days; `npm run validate` warns after 180 days), re-checks facts and sources, updates `lastReviewed`, and moves settled `developing` items. Re-scoring is needed only where outcomes or facts changed materially, and uses the same blind procedure.

## Quarterly: coverage audit

Run `npm run audit -- --md` and read `docs/NEUTRALITY-REPORT.md`. It reports entries per party, lead coalition, government, decade and category; categories with fewer than 2 entries; parties that have led a government but have fewer than 3 entries; entries lacking a primary, official-data or court source; average source counts; loaded-word hits; benefit versus concern asymmetry and citations per bullet by party; and scorer pairs that differ by 2 or more points. The human owner picks the biggest gaps and adds them to the next weekly intake as priority candidates. The audit never fails the build; it is a prompt for judgement. A gap in coverage is fixed by adding entries, not by editing existing ones.

## File formats

### Intake file: `src/data/intake/YYYY-MM-DD.md`

```markdown
---
date: 2026-10-12            # day the intake was run
window: 2026-10-05..2026-10-12
searched: [list of queries or sites checked]
---

## Candidates

### 1. Neutral title
- decision: pending          # human sets: approve | developing | skip
- type: developing           # agent's proposal: developing | action
- description: One neutral sentence, no adjectives of judgement.
- category: governance       # taxonomy id
- subcategories: [centre-state-relations]
- level: centre              # centre | state (and state: id)
- government: centre-2024-modi-3     # id from governments data, or "unknown"
- date: 2026-10-08           # event date
- sources:
  - [Title](https://...) (publisher, primary | official-data | court | reputable-media)
  - [Title](https://...) (...)
- why-this-type: One line: why a full action (decided, implemented, effect measurable) or developing (pending, contested, facts incomplete).
- notes: Optional: what could not be verified.
```

Rules: at least two sources per candidate, at least one primary where one exists; candidates are chosen by whether a development is policy-relevant, not by which party is involved; the file records how many candidates fall under each party so the human can see skew.

### Action and developing entries

Exactly as in [`CONTRACT.md`](CONTRACT.md). New actions start with `scoring.scorers: []`. Sub-category display names come from `src/data/sub-names.json`.

### Scorer files

`{ "<slug>": { "reach": 3, "outcome": 1, "sustainability": 0, "process": 2, "delivery": 1, "note": "one sentence" } }`, integers -5 to 5, per `src/data/rubric.json`. One file per scorer.

## Conventions

- Branches: `weekly/YYYY-MM-DD`, `refresh/YYYY-MM`. PR title `Weekly YYYY-MM-DD: <n> new, <m> developing`. Use `.github/pull_request_template.md`.
- Before pushing: `npm run validate`, `npm test`, `npm run build`. CI runs the same.
- Commit only files for the task. Never edit `src/lib`, `src/styles`, `src/components` or `src/pages` as part of a content cycle.
- Corrections from readers arrive as issues using `.github/ISSUE_TEMPLATE/correction.yml` and are handled in the next weekly or refresh PR, favouring no side.
