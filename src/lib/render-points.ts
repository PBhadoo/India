import type { PartyResult } from './scoring-core.ts';
import { esc, fmtNum, fmtSigned } from './format.ts';

export interface PointsCtx {
  parties: Record<string, { name: string; short: string; slot: number }>;
  categories: { id: string; name: string }[];
}

export type SortKey = 'ppy' | 'total' | 'years' | 'actions' | 'party';

export function sortParties(rows: PartyResult[], ctx: PointsCtx, key: SortKey = 'ppy', dir: 1 | -1 = -1): PartyResult[] {
  const val = (r: PartyResult): number | string => {
    switch (key) {
      case 'party': return ctx.parties[r.partyId]?.short ?? r.partyId;
      case 'total': return r.points;
      case 'years': return r.yearsInPower;
      case 'actions': return r.scoredActions;
      default: return r.pointsPerYear ?? Number.NEGATIVE_INFINITY;
    }
  };
  return [...rows].sort((a, b) => {
    const x = val(a), y = val(b);
    const c = typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number);
    return c * dir || (ctx.parties[a.partyId]?.short ?? '').localeCompare(ctx.parties[b.partyId]?.short ?? '');
  });
}

export function swatch(slot: number): string {
  return `<span class="sw p${slot} pat${slot}" aria-hidden="true"></span>`;
}

export function partyChipHtml(id: string, ctx: PointsCtx, href?: string): string {
  const p = ctx.parties[id] ?? { name: id, short: id.toUpperCase(), slot: 0 };
  const inner = `${swatch(p.slot)}<span>${esc(p.short)}</span>`;
  return href ? `<a class="chip" href="${esc(href)}" title="${esc(p.name)}">${inner}</a>` : `<span class="chip" title="${esc(p.name)}">${inner}</span>`;
}

/** Table rows for the Evidence points table. Shared by the build and the browser. */
export function pointsRowsHtml(rows: PartyResult[], ctx: PointsCtx, base = '/'): string {
  const ppys = rows.flatMap((r) => (r.pointsPerYear == null ? [] : [r.lowPerYear ?? 0, r.highPerYear ?? 0, r.pointsPerYear]));
  const lo = Math.min(0, ...ppys), hi = Math.max(0, ...ppys);
  const span = hi - lo || 1;
  const pos = (v: number) => (((v - lo) / span) * 100).toFixed(1);
  return rows
    .map((r) => {
      const p = ctx.parties[r.partyId] ?? { name: r.partyId, short: r.partyId.toUpperCase(), slot: 0 };
      const has = r.pointsPerYear != null;
      const whisker = has
        ? `<span class="whisk" aria-hidden="true"><i class="z" style="left:${pos(0)}%"></i><i class="r" style="left:${pos(r.lowPerYear ?? 0)}%;width:${(Number(pos(r.highPerYear ?? 0)) - Number(pos(r.lowPerYear ?? 0))).toFixed(1)}%"></i><i class="d" style="left:${pos(r.pointsPerYear!)}%"></i></span>`
        : '';
      const range = has ? `${fmtSigned(r.lowPerYear)} to ${fmtSigned(r.highPerYear)}` : '';
      const badge = r.hasLowData || r.scoredActions < 2 ? ` <span class="badge badge-low" title="Some party and category cells have fewer than 2 scored actions">Low data</span>` : '';
      return `<tr>
<th scope="row"><a class="chip" href="${base}parties/${esc(r.partyId)}/" title="${esc(p.name)}">${swatch(p.slot)}<span>${esc(p.short)}</span></a><span class="sub">${esc(p.name)}</span></th>
<td class="num strong"><span class="fig">${has ? fmtSigned(r.pointsPerYear) : '–'}</span>${has ? `<span class="sub">${range}</span>` : ''}${whisker}</td>
<td class="num">${fmtSigned(r.points)}</td>
<td class="num">${fmtNum(r.yearsInPower)}<span class="sub">led ${fmtNum(r.yearsLed)}</span></td>
<td class="num">${r.scoredActions ? `${fmtSigned(r.low)} to ${fmtSigned(r.high)}` : '–'}</td>
<td class="num">${r.scoredActions}${badge}</td>
</tr>`;
    })
    .join('\n');
}

/** Heat grid body: categories as rows, parties as columns (in the given order). */
export function heatGridHtml(rows: PartyResult[], ctx: PointsCtx, base = '/'): string {
  const cols = rows;
  const cells = cols.flatMap((r) => ctx.categories.map((c) => r.categories[c.id]?.pointsPerYear).filter((v): v is number => v != null));
  const min = Math.min(...cells), max = Math.max(...cells);
  const span = max - min || 1;
  const head = `<tr><td class="corner"><span class="vh">Category</span></td>${cols
    .map((r) => {
      const p = ctx.parties[r.partyId] ?? { name: r.partyId, short: r.partyId.toUpperCase(), slot: 0 };
      return `<th scope="col" class="colh"><a class="chip" href="${base}parties/${esc(r.partyId)}/" title="${esc(p.name)}">${swatch(p.slot)}<span>${esc(p.short)}</span></a></th>`;
    })
    .join('')}</tr>`;
  const body = ctx.categories
    .map((c) => {
      const tds = cols
        .map((r) => {
          const cell = r.categories[c.id];
          const p = ctx.parties[r.partyId];
          const label = `${p?.short ?? r.partyId}, ${c.name}`;
          if (!cell || cell.pointsPerYear == null || cell.scoredActions === 0) {
            return `<td class="hm hm-none" data-tip="${esc(label)}: no scored actions"><span class="vh">No scored actions</span></td>`;
          }
          const t = (cell.pointsPerYear - min) / span;
          const cls = ['hm', t > 0.58 ? 'hm-hi' : 'hm-lo', cell.lowData ? 'hm-low' : ''].filter(Boolean).join(' ');
          const tip = `${label}: ${fmtSigned(cell.pointsPerYear, 2)} points per year, ${cell.scoredActions} scored ${cell.scoredActions === 1 ? 'action' : 'actions'}, range ${fmtSigned(cell.low * cell.weight)} to ${fmtSigned(cell.high * cell.weight)} in total${cell.lowData ? ' (low data)' : ''}`;
          return `<td class="${cls}" style="--t:${t.toFixed(3)}" data-tip="${esc(tip)}">${fmtSigned(cell.pointsPerYear)}${cell.lowData ? '<span class="vh"> low data</span>' : ''}</td>`;
        })
        .join('');
      return `<tr><th scope="row" class="rowh"><a href="${base}categories/${esc(c.id)}/">${esc(c.name)}</a></th>${tds}</tr>`;
    })
    .join('\n');
  return `<thead>${head}</thead><tbody>${body}</tbody>`;
}

/** Min and max of heat cells, for the legend. */
export function heatRange(rows: PartyResult[], ctx: PointsCtx): [number, number] | null {
  const v = rows.flatMap((r) => ctx.categories.map((c) => r.categories[c.id]).filter((x) => x && x.scoredActions > 0 && x.pointsPerYear != null).map((x) => x!.pointsPerYear as number));
  return v.length ? [Math.min(...v), Math.max(...v)] : null;
}
