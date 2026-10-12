# India Explained

A neutral, source-backed tracker of Indian politics and policy. Every government action is described with the same template, scored on a public rubric by two scorers who do not see which party acted, and credited to the governments (and coalition partners) responsible. It is a static [Astro](https://astro.build) site deployed on Cloudflare Pages, with [Pagefind](https://pagefind.app) search.

- Data contract: [`docs/CONTRACT.md`](docs/CONTRACT.md)
- Scoring rubric: `src/data/rubric.json`
- Categories: `src/data/taxonomy.yaml`

## Run it

Requires Node 22+.

```sh
npm install
npm run dev        # local dev server
npm run build      # astro build, then pagefind indexes dist/
npm run preview    # serve dist/
npm run validate   # lint all content (schema, ids, sources, neutrality)
npm test           # unit tests for tenure and scoring maths
```

## Layout

- `src/content/actions/*.md`, `src/content/developing/*.md`: content collections (schemas in `src/content.config.ts`)
- `src/data/`: taxonomy, rubric, governments, parties, states
- `src/lib/`: typed data and scoring logic (`taxonomy`, `governments`, `tenure`, `scoring`, `collections`)
- `scripts/`: content tooling
- `tests/`: `node --test` suites and fixtures

## Adding an action

1. Copy the front-matter shape from [`docs/CONTRACT.md`](docs/CONTRACT.md) into `src/content/actions/<kebab-slug>.md`.
2. Use real taxonomy ids and government ids (see `src/data`). At least two sources, all `https`.
3. Keep the summary under 220 characters and the language neutral. Leave `scoring.scorers: []` until scored.
4. Run `npm run validate`.

Scoring workflow:

```sh
node scripts/strip-for-scoring.mjs out/blind        # party-blind JSON per action
# each scorer produces { "<slug>": {reach,outcome,sustainability,process,delivery,note} }
node scripts/merge-scores.mjs scorerA.json scorerB.json
node scripts/stale-report.mjs                       # entries >90 days old, thin coverage
```

## Deploy on Cloudflare Pages

1. In the Cloudflare dashboard go to Workers & Pages, Create, Pages, Connect to Git, and pick this repository.
2. Framework preset: Astro.
3. Build command: `npm run build`
4. Build output directory: `dist`
5. Environment variable (Production and Preview): `NODE_VERSION` = `22`
6. Save and deploy. Update `site` in `astro.config.mjs` once the final domain is known.

Headers are set in `public/_headers`. Optional CLI deploy (after `npm run build`):

```sh
npx wrangler pages deploy dist --project-name indiareview
```

## Automatic deploys (GitHub Actions)

`.github/workflows/deploy.yml` builds and deploys to the Cloudflare Pages project `indiareview` on every push to `main`. It reads these repository secrets: `CF_API_TOKEN` (required, Cloudflare API token with Pages edit permission) and `CF_ACCOUNT_ID` (your Cloudflare account ID, required when the token can see more than one account).
