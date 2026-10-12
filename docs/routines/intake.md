# Routine: weekly news intake

You are running the weekly intake for India Explained, a neutral, source-backed tracker of Indian politics and policy in the git repository at the current directory. You have no other context; follow this file exactly. Do not merge, do not push to `main`.

## Goal
Find policy-relevant developments in India from the past 7 days and write a candidate list for a human to approve. You do not write entries.

## Setup
1. Today's date is `TODAY` (YYYY-MM-DD). `git checkout -b weekly/TODAY` from the latest `main`.
2. Read `docs/CONTRACT.md`, `docs/WORKFLOW.md` (intake file format), `src/data/taxonomy.yaml`, `src/data/governments.json` (and `src/data/states/*.json`) so you can use real category and government ids.
3. List existing slugs in `src/content/actions/` and `src/content/developing/` so you do not propose duplicates.

## Finding developments
- Window: the 7 days ending today.
- Use reputable and primary sources only: Gazette of India, PIB, Lok Sabha/Rajya Sabha and PRS Legislative Research, Supreme Court and High Court orders, Election Commission, RBI, MoSPI, CAG, ministry and state government sites, and established national newspapers and wires. Do not use social media, partisan blogs, or unattributed aggregators.
- Cover the Centre and states, and governments of all parties. Check both ruling and opposition-run states. Do not let one party's activity set the agenda; search by subject (courts, Parliament, schemes, elections, economy, welfare, security, environment, technology) rather than by party.
- Include: laws passed or notified, bills introduced or cleared by committees, Cabinet decisions, scheme launches or changes, court rulings with policy effect, election-process changes, treaties. Exclude: speeches, rumours, party rows, arrests without policy content, opinion pieces.
- For each candidate, verify the key fact in at least two sources, one primary where one exists. If you cannot verify, say so in `notes` or drop it.

## Output
Write `src/data/intake/TODAY.md` in the format in `docs/WORKFLOW.md`. For each candidate: neutral one-line description (no loaded words, see `scripts/loaded-words.json`), category id, subcategories, level, government id, event date, sources with publisher and type, `type:` (`developing` for pending/contested/facts incomplete, `action` only for something decided and in effect), and `decision: pending`. At the end, add a tally of candidates by party of the responsible government and by level. Aim for 5 to 15 candidates; fewer is fine.

## Finish
1. `npm run validate` must still pass (the intake file is not validated, but do not break anything else).
2. `git add src/data/intake/TODAY.md && git commit -m "Weekly intake TODAY"`; `git push -u origin weekly/TODAY`.
3. Open a pull request titled `Weekly TODAY: intake` using `.github/pull_request_template.md`, with the candidate titles listed. State that candidates await human `decision:` edits. Never merge.
