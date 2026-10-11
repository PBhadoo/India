import type { PartyResult } from './scoring-core.ts';
import { esc, fmtNum, fmtSigned } from './format.ts';
import { LOW_DATA_MIN_ACTIONS } from './scoring-core.ts';

export interface PointsCtx {
  parties: Record<string, { name: string; short: string; slot: number }>;
  categories: { id: string; name: string }[];
}

/** Parties with fewer weighted years in power than this get a per-year figure that swings widely; they are shown in a separate group. */
export const MIN_YEARS_FOR_RATE = 2;

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
    if ((key === 'ppy' || key === 'total') && (a.scoredActions === 0) !== (b.scoredActions === 0)) return a.scoredActions === 0 ? 1 : -1;
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
export function pointsRowsHtml(allRows: PartyResult[], ctx: PointsCtx, base = '/'): string {
  const rows = allRows.filter((r) => r.scoredActions > 0);
  if (rows.length === 0) return `<tr><td colspan="6" class="nodata-row">No actions are scored in this period yet, so there are no figures to show.</td></tr>`;
  const main = rows.filter((r) => r.yearsInPower >= MIN_YEARS_FOR_RATE);
  const short = rows.filter((r) => r.yearsInPower < MIN_YEARS_FOR_RATE);
  const ppys = main.flatMap((r) => (r.pointsPerYear == null ? [] : [r.lowPerYear ?? 0, r.highPerYear ?? 0, r.pointsPerYear]));
  const lo = Math.min(0, ...ppys), hi = Math.max(0, ...ppys);
  const span = hi - lo || 1;
  const pos = (v: number) => (((v - lo) / span) * 100).toFixed(1);
  const row = (r: PartyResult, withWhisker: boolean, cls = '') => {
    const p = ctx.parties[r.partyId] ?? { name: r.partyId, short: r.partyId.toUpperCase(), slot: 0 };
    const has = r.pointsPerYear != null;
    const whisker = has && withWhisker
      ? `<span class="whisk" aria-hidden="true"><i class="z" style="left:${pos(0)}%"></i><i class="r" style="left:${pos(r.lowPerYear ?? 0)}%;width:${(Number(pos(r.highPerYear ?? 0)) - Number(pos(r.lowPerYear ?? 0))).toFixed(1)}%"></i><i class="d" style="left:${pos(r.pointsPerYear!)}%"></i></span>`
      : '';
    const range = has ? `${fmtSigned(r.lowPerYear)} to ${fmtSigned(r.highPerYear)}` : '';
    const badge = r.scoredActions < LOW_DATA_MIN_ACTIONS ? ` <span class="badge badge-low" title="Fewer than ${LOW_DATA_MIN_ACTIONS} scored actions">Low data</span>` : '';
    const covered = Object.values(r.categories).filter((c) => !c.lowData).length;
    return `<tr${cls ? ` class="${cls}"` : ''}>
<th scope="row"><a class="chip" href="${base}parties/${esc(r.partyId)}/" title="${esc(p.name)}">${swatch(p.slot)}<span>${esc(p.short)}</span></a><span class="sub">${esc(p.name)}</span></th>
<td class="num strong"><span class="fig">${has ? fmtSigned(r.pointsPerYear) : '\u2013'}</span>${has ? `<span class="sub">${range}</span>` : ''}${whisker}</td>
<td class="num">${fmtSigned(r.points)}</td>
<td class="num">${fmtNum(r.yearsInPower)}<span class="sub">led ${fmtNum(r.yearsLed)}</span></td>
<td class="num">${fmtSigned(r.low)} to ${fmtSigned(r.high)}</td>
<td class="num">${r.scoredActions}${badge}<span class="sub">${covered} of ${ctx.categories.length} categories with ${LOW_DATA_MIN_ACTIONS}+</span></td>
</tr>`;
  };
  let html = main.map((r) => row(r, true)).join('\n');
  if (short.length) {
    html += `\n<tr class="grp"><th scope="colgroup" colspan="6">Under ${MIN_YEARS_FOR_RATE} years in power. Per-year figures for short tenures swing widely, so these are listed apart and drawn without a scale.</th></tr>\n`;
    html += short.map((r) => row(r, false, 'short-row')).join('\n');
  }
  return html;
}

/** Parties that held office in the period but have no scored actions: listed, never given a figure. */
export function noDataHtml(rows: PartyResult[], ctx: PointsCtx, base = '/'): string {
  const none = rows.filter((r) => r.scoredActions === 0 && r.yearsInPower > 0).sort((a, b) => b.yearsInPower - a.yearsInPower);
  if (!none.length) return '';
  return `<strong>${none.length} ${none.length === 1 ? 'party has' : 'parties have'} held office in this period but ${none.length === 1 ? 'has' : 'have'} no scored actions yet, so no figure is shown:</strong> ${none
    .map((r) => partyChipHtml(r.partyId, ctx, `${base}parties/${r.partyId}/`) + ` <span class="mono small">${fmtNum(r.yearsInPower)} y</span>`)
    .join('<span class="sep"> </span> ')}`;
}

/** Heat grid body: categories as rows, parties as columns (in the given order). */
export function heatGridHtml(rows: PartyResult[], ctx: PointsCtx, base = '/'): string {
  const cols = rows.filter((r) => r.scoredActions > 0 && r.yearsInPower >= MIN_YEARS_FOR_RATE);
  if (cols.length === 0) return `<tbody><tr><td class="nodata-row">No party with at least ${MIN_YEARS_FOR_RATE} years in power has scored actions in this period yet, so the grid is empty.</td></tr></tbody>`;
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
          const cls = ['hm', t > 0.64 ? 'hl' : '', t > 0.57 ? 'hd' : '', cell.lowData ? 'hm-low' : ''].filter(Boolean).join(' ');
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
  const v = rows.filter((r) => r.yearsInPower >= MIN_YEARS_FOR_RATE).flatMap((r) => ctx.categories.map((c) => r.categories[c.id]).filter((x) => x && x.scoredActions > 0 && x.pointsPerYear != null).map((x) => x!.pointsPerYear as number));
  return v.length ? [Math.min(...v), Math.max(...v)] : null;
}
