import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getSite } from '../lib/site.ts';

export async function GET(context: APIContext) {
  const site = await getSite();
  const items = [
    ...site.actions.map((a) => ({ title: a.data.title, description: a.data.summary, pubDate: a.data.lastReviewed as Date, link: `/actions/${a.slug}/`, categories: ['action'] })),
    ...site.dossiers.map((x) => ({ title: `Dossier: ${x.data.title}`, description: x.data.summary, pubDate: x.data.asOf as Date, link: `/dossiers/${x.slug}/`, categories: ['dossier'] })),
    ...site.developing.map((d) => ({ title: `Developing: ${d.data.title}`, description: d.data.summary, pubDate: d.data.date as Date, link: `/developing/${d.slug}/`, categories: ['developing'] })),
  ]
    .sort((a, b) => +b.pubDate - +a.pubDate)
    .slice(0, 50);
  return rss({
    title: 'India Explained: new actions, dossiers and developing items',
    description: 'Newly reviewed government actions, updated dossiers and developing items, with sources.',
    site: context.site!,
    items,
    customData: '<language>en-IN</language>',
  });
}
