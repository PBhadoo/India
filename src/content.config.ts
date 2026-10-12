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

export const collections = { actions, developing };
