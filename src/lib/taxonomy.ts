import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';

export interface Category {
  id: string;
  name: string;
  blurb: string;
  subs: string[];
}

export interface Taxonomy {
  categories: Category[];
  subNames: Record<string, string>;
}

const DATA_DIR = path.join(process.cwd(), 'src', 'data');

function readJsonIfExists<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

export function loadTaxonomy(dataDir: string = DATA_DIR): Taxonomy {
  let categories: Category[] = [];
  try {
    const doc = yaml.load(fs.readFileSync(path.join(dataDir, 'taxonomy.yaml'), 'utf8')) as {
      categories?: Category[];
    } | null;
    categories = doc?.categories ?? [];
  } catch {
    categories = [];
  }
  const subNames = readJsonIfExists<Record<string, string>>(path.join(dataDir, 'sub-names.json'), {});
  return { categories, subNames };
}

let cached: Taxonomy | undefined;
function tax(): Taxonomy {
  return (cached ??= loadTaxonomy());
}

export function categories(): Category[] {
  return tax().categories;
}

export function getCategory(id: string, t: Taxonomy = tax()): Category | undefined {
  return t.categories.find((c) => c.id === id);
}

/** Title-cases a slug: "budget-taxation" -> "Budget Taxation". */
export function titleCaseSlug(slug: string): string {
  return slug
    .split('-')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export function subDisplayName(subId: string, t: Taxonomy = tax()): string {
  return t.subNames[subId] ?? titleCaseSlug(subId);
}

/** Returns the sub-category with its display name if it belongs to the category. */
export function getSub(
  categoryId: string,
  subId: string,
  t: Taxonomy = tax(),
): { id: string; name: string; category: string } | undefined {
  const cat = getCategory(categoryId, t);
  if (!cat || !cat.subs.includes(subId)) return undefined;
  return { id: subId, name: subDisplayName(subId, t), category: categoryId };
}

export function subsOf(categoryId: string, t: Taxonomy = tax()) {
  return (getCategory(categoryId, t)?.subs ?? []).map((id) => ({ id, name: subDisplayName(id, t) }));
}

export function categoryIds(t: Taxonomy = tax()): string[] {
  return t.categories.map((c) => c.id);
}
