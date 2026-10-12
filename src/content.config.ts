import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const source = z.object({
  title: z.string().min(1),
  url: z.string().url().startsWith('https://'),
  publisher: z.string().min(1),
  type: z.enum(['primary', 'official-data', 'court', 'reputable-media', 'academic']),
});

const point = z.object({
  point: z.string().min(1),
  evidence: z.string().optional(),
});

const criterion = z.number().int().min(-5).max(5);

export const scorerSchema = z.object({
  id: z.string(),
  reach: criterion,
  outcome: criterion,
  sustainability: criterion,
  process: criterion,
  delivery: criterion,
  note: z.string().optional(),
});

const actions = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/actions' }),
  schema: z.object({
    title: z.string().min(1),
    summary: z.string().min(1).max(220),
    category: z.string(),
    subcategories: z.array(z.string()).min(1),
    date: z.coerce.date(),
    level: z.enum(['centre', 'state']),
    state: z.string().optional(),
    governmentId: z.string(),
    originGovernmentId: z.string().optional(),
    status: z.enum(['proposed', 'passed', 'implemented', 'stalled', 'repealed', 'struck-down']),
    developing: z.boolean().default(false),
    /** 'none' = decided by an independent institution: scored and shown, but earns no party credit. */
    credit: z.enum(['party', 'none']).default('party'),
    institution: z.string().optional(),
    lastReviewed: z.coerce.date(),
    facts: z.array(z.string()).min(1),
    why: z.object({
      stated: z.array(z.string()),
      criticism: z.array(z.string()).optional(),
    }),
    benefits: z.array(point),
    concerns: z.array(point),
    sources: z.array(source).min(2),
    scoring: z.object({
      era_baseline: z.string(),
      lag_years: z.number().min(0),
      shocks: z.array(z.string()).optional(),
      confidence: z.enum(['low', 'medium', 'high']),
      // empty = unscored; otherwise exactly two scorers
      scorers: z.array(scorerSchema).refine((a) => a.length === 0 || a.length === 2, {
        message: 'scorers must be empty (unscored) or have exactly two entries',
      }),
    }),
  }),
});

const developing = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/developing' }),
  schema: z.object({
    title: z.string().min(1),
    date: z.coerce.date(),
    category: z.string(),
    summary: z.string().min(1).max(220),
    status: z.enum(['developing', 'settled']),
    knownFacts: z.array(z.string()),
    unknowns: z.array(z.string()),
    sources: z.array(source).min(1),
    relatedAction: z.string().optional(),
  }),
});

export const CLAIM_TYPES = ['finding', 'official-statement', 'allegation', 'data', 'event'] as const;
export const DOSSIER_KINDS = ['topic', 'institution', 'organisation', 'party', 'company-group'] as const;

// Dossiers are unscored reference files (Addendum v2). The schema is deliberately tolerant of optional
// fields; scripts/validate-content.mjs enforces the editorial rules (source counts, allegation fields...).
const looseDate = z.union([z.date(), z.string().min(1)]);
const srcRef = z.union([z.number().int().min(1), z.array(z.number().int().min(1))]);
const cell = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const dossiers = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/dossiers' }),
  schema: z.object({
    title: z.string().min(1),
    summary: z.string().min(1).max(240),
    category: z.string(),
    subcategories: z.array(z.string()).default([]),
    kind: z.enum(DOSSIER_KINDS),
    asOf: z.coerce.date(),
    status: z.enum(['ongoing', 'settled']),
    lastReviewed: z.coerce.date(),
    timeline: z
      .array(
        z.object({
          date: looseDate,
          event: z.string().min(1),
          actor: z.string().optional(),
          type: z.enum(CLAIM_TYPES).optional(),
          source: srcRef.optional(),
        }),
      )
      .default([]),
    claims: z
      .array(
        z.object({
          claim: z.string().min(1),
          type: z.enum(CLAIM_TYPES),
          madeBy: z.string().optional(),
          status: z.string().optional(),
          response: z.string().optional(),
          source: srcRef.optional(),
        }),
      )
      .default([]),
    positions: z
      .array(z.object({ holder: z.string().min(1), position: z.string().min(1), source: srcRef.optional() }))
      .default([]),
    tables: z
      .array(
        z.object({
          title: z.string().min(1),
          caption: z.string().optional(),
          columns: z.array(z.union([z.string(), z.number()])).min(1),
          rows: z.array(z.array(cell)).default([]),
          source: srcRef.optional(),
        }),
      )
      .default([]),
    notShown: z.array(z.string()).default([]),
    sources: z.array(source).min(1),
  }),
});

export const collections = { actions, developing, dossiers };
