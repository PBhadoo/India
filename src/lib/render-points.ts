import type { PartyResult, BlocResult, BlocId } from './scoring-core.ts';
import { esc, fmtNum, fmtSigned } from './format.ts';
import { LOW_DATA_MIN_ACTIONS, HEADLINE_BLOCS, BLOC_LABEL, BLOC_NOTE } from './scoring-core.ts';

export interface PointsCtx {
  parties: Record<string, { name: string; short: string; slot: number }>;
  categories: { id: string; name: string }[];
}

/** Parties with fewer weighted years in power than this get a per-year figure that swings widely; they are shown in a separate group. */
export const MIN_YEARS_FOR_RATE = 2;

export type SortKey = 'avg' | 'shrunk' | 'ppy' | 'total' | 'years' | 'actions' | 'party';
/** Headline metrics offered by the segmented control. */
export type Metric = 'avg' | 'shrunk';

interface Fig { v: number | null; lo: number | null; hi: number | null }
function figOf(r: PartyResult, m: Metric): Fig {
  return m === 'avg' ? { v: r.avgPerAction, lo: r.avgLow, hi: r.avgHigh } : { v: r.shrunkPerYear, lo: r.shrunkLow, hi: r.shrunkHigh };
}

export function sortParties(rows: PartyResult[], ctx: PointsCtx, key: SortKey = 'avg', dir: 1 | -1 = -1): PartyResult[] {
  const val = (r: PartyResult): number | string => {
    switch (key) {
      case 'party': return ctx.parties[r.partyId]?.short ?? r.partyId;
      case 'total': return r.points;
      case 'years': return r.yearsInPower;
      case 'actions': return r.scoredActions;
      case 'avg': return r.avgPerAction ?? Number.NEGATIVE_INFINITY;
      case 'shrunk': return r.shrunkPerYear ?? Number.NEGATIVE_INFINITY;
      default: return r.pointsPerYear ?? Number.NEGATIVE_INFINITY;
    }
  };
  return [...rows].sort((a, b) => {
    if ((key === 'ppy' || key === 'total' || key === 'avg' || key === 'shrunk') && (a.scoredActions === 0) !== (b.scoredActions === 0)) return a.scoredActions === 0 ? 1 : -1;
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

/** Table rows for the Evidence points table. Shared by the build and the browser. `metric` picks which figure is drawn with the range scale. */
export function pointsRowsHtml(allRows: PartyResult[], ctx: PointsCtx, base = '/', metric: Metric = 'avg'): string {
  const rows = allRows.filter((r) => r.scoredActions > 0);
  if (rows.length === 0) return `<tr><td colspan="5" class="nodata-row">No actions are scored in this period yet, so there are no figures to show.</td></tr>`;
  const main = rows.filter((r) => r.yearsInPower >= MIN_YEARS_FOR_RATE);
  const short = rows.filter((r) => r.yearsInPower < MIN_YEARS_FOR_RATE);
  const vals = main.flatMap((r) => [figOf(r, metric)]).flatMap((f) => (f.v == null ? [] : [f.lo ?? 0, f.hi ?? 0, f.v]));
  const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
  const span = hi - lo || 1;
  const pos = (v: number) => (((v - lo) / span) * 100).toFixed(1);
  const whiskerOf = (f: Fig) =>
    `<span class="whisk" aria-hidden="true"><i class="z" style="left:${pos(0)}%"></i><i class="r" style="left:${pos(f.lo ?? 0)}%;width:${(Number(pos(f.hi ?? 0)) - Number(pos(f.lo ?? 0))).toFixed(1)}%"></i><i class="d" style="left:${pos(f.v!)}%"></i></span>`;
  const cell = (r: PartyResult, m: Metric, withWhisker: boolean, extra = '') => {
    const f = figOf(r, m);
    const head = m === metric;
    const has = f.v != null;
    const range = has ? `${fmtSigned(f.lo)} to ${fmtSigned(f.hi)}` : '';
    return `<td class="num${head ? ' strong' : ''}"><span class="fig">${has ? fmtSigned(f.v) : '\u2013'}</span>${has ? `<span class="sub">range ${range}</span>` : ''}${extra}${head && has && withWhisker ? whiskerOf(f) : ''}</td>`;
  };
  const row = (r: PartyResult, withWhisker: boolean, cls = '') => {
    const p = ctx.parties[r.partyId] ?? { name: r.partyId, short: r.partyId.toUpperCase(), slot: 0 };
    const badge = r.scoredActions < LOW_DATA_MIN_ACTIONS ? ` <span class="badge badge-low" title="Fewer than ${LOW_DATA_MIN_ACTIONS} scored actions">Low data</span>` : '';
    const covered = Object.values(r.categories).filter((c) => !c.lowData).length;
    const n = `<span class="sub">${r.avgActions} scored ${r.avgActions === 1 ? 'action' : 'actions'}${badge}</span><span class="sub">${covered} of ${ctx.categories.length} categories with ${LOW_DATA_MIN_ACTIONS}+</span>`;
    return `<tr${cls ? ` class="${cls}"` : ''}>
<th scope="row"><a class="chip" href="${base}parties/${esc(r.partyId)}/" title="${esc(p.name)}">${swatch(p.slot)}<span>${esc(p.short)}</span></a><span class="sub">${esc(p.name)}</span></th>
${cell(r, 'avg', withWhisker, n)}
${cell(r, 'shrunk', withWhisker)}
<td class="num">${fmtSigned(r.points)}<span class="sub">range ${fmtSigned(r.low)} to ${fmtSigned(r.high)}</span></td>
<td class="num">${fmtNum(r.yearsInPower)}<span class="sub">led ${fmtNum(r.yearsLed)}</span></td>
</tr>`;
  };
  let html = main.map((r) => row(r, true)).join('\n');
  if (short.length) {
    html += `\n<tr class="grp"><th scope="colgroup" colspan="5">Under ${MIN_YEARS_FOR_RATE} years in power. Figures for short tenures swing widely, so these are listed apart and drawn without a scale.</th></tr>\n`;
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

// ---------------------------------------------------------------------------------------------
// Bloc view (Addendum v3). Same columns as the party table; INC-led then BJP-led in a fixed order
// (never sorted by a figure), Other governments in a collapsed group with their governments listed.
// ---------------------------------------------------------------------------------------------
export interface BlocCtx {
  governments: Record<string, { leader: string; start: string; end: string | null; lead: string }>;
}

export const blocSwatch = (b: BlocId) => `<span class="sw b-${b} pat-b-${b}" aria-hidden="true"></span>`;

const yr = (iso: string) => iso.slice(0, 4);
function govSpan(g: { start: string; end: string | null }): string {
  const a = yr(g.start), b = g.end ? yr(g.end) : 'present';
  return a === b ? a : `${a} to ${b}`;
}

export function blocRowsHtml(allBlocs: BlocResult[], ctx: PointsCtx, bctx: BlocCtx, metric: Metric = 'avg', base = '/'): string {
  const byId = new Map(allBlocs.map((b) => [b.blocId, b]));
  const head = HEADLINE_BLOCS.map((id) => byId.get(id)).filter((b): b is BlocResult => !!b);
  const other = byId.get('other');
  const showOther = !!other && (other.yearsInPower > 0 || other.scoredActions > 0);
  const vals = head.flatMap((r) => { const f = figOf(r, metric); return f.v == null ? [] : [f.lo ?? 0, f.hi ?? 0, f.v]; });
  const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
  const span = hi - lo || 1;
  const pos = (v: number) => (((v - lo) / span) * 100).toFixed(1);
  const whiskerOf = (f: Fig) =>
    `<span class="whisk" aria-hidden="true"><i class="z" style="left:${pos(0)}%"></i><i class="r" style="left:${pos(f.lo ?? 0)}%;width:${(Number(pos(f.hi ?? 0)) - Number(pos(f.lo ?? 0))).toFixed(1)}%"></i><i class="d" style="left:${pos(f.v!)}%"></i></span>`;
  const cell = (r: BlocResult, m: Metric, withWhisker: boolean, extra = '') => {
    const f = figOf(r, m);
    const has = f.v != null;
    return `<td class="num${m === metric ? ' strong' : ''}"><span class="fig">${has ? fmtSigned(f.v) : '\u2013'}</span>${has ? `<span class="sub">range ${fmtSigned(f.lo)} to ${fmtSigned(f.hi)}</span>` : ''}${extra}${m === metric && has && withWhisker ? whiskerOf(f) : ''}</td>`;
  };
  const row = (r: BlocResult, withWhisker: boolean, cls = '') => {
    const id = r.blocId;
    const badge = r.scoredActions < LOW_DATA_MIN_ACTIONS ? ` <span class="badge badge-low" title="Fewer than ${LOW_DATA_MIN_ACTIONS} scored actions">Low data</span>` : '';
    const covered = Object.values(r.categories).filter((c) => !c.lowData).length;
    const n = r.avgActions === 0
      ? `<span class="sub">No scored actions yet${badge}</span>`
      : `<span class="sub">${r.avgActions} scored ${r.avgActions === 1 ? 'action' : 'actions'}${badge}</span><span class="sub">${covered} of ${ctx.categories.length} categories with ${LOW_DATA_MIN_ACTIONS}+</span>`;
    const gl = r.governmentIds
      .map((gid) => bctx.governments[gid])
      .filter(Boolean);
    const detail = id === 'other'
      ? `<span class="sub">${esc(BLOC_NOTE.other)}</span><ul class="gov-list">${r.governmentIds.map((gid) => { const g = bctx.governments[gid]; return g ? `<li><a href="${base}governments/${esc(gid)}/">${esc(g.leader)}</a> <span class="mono">${govSpan(g)}</span></li>` : ''; }).join('')}</ul>`
      : `<span class="sub">${gl.length} ${gl.length === 1 ? 'government' : 'governments'}, partners included</span>`;
    return `<tr${cls ? ` class="${cls}"` : ''}>
<th scope="row"><span class="chip bloc-chip" title="${esc(BLOC_NOTE[id])}">${blocSwatch(id)}<span>${esc(BLOC_LABEL[id])}</span></span>${detail}</th>
${cell(r, 'avg', withWhisker, n)}
${cell(r, 'shrunk', withWhisker)}
<td class="num">${r.scoredActions ? fmtSigned(r.points) : '\u2013'}${r.scoredActions ? `<span class="sub">range ${fmtSigned(r.low)} to ${fmtSigned(r.high)}</span>` : ''}</td>
<td class="num">${fmtNum(r.yearsInPower)}<span class="sub">all years kept</span></td>
</tr>`;
  };
  let html = head.map((r) => row(r, true)).join('\n');
  if (showOther && other) {
    html += `\n<tr class="grp short-row"><th scope="colgroup" colspan="5">Other governments. Led by other parties, so listed apart and drawn without a scale. Their years are included in every tenure total.</th></tr>\n`;
    html += row(other, false, 'short-row');
  }
  return html;
}

/** Heat grid for blocs: categories as rows, INC-led and BJP-led as columns, shrunk points per year. */
export function blocHeatHtml(blocs: BlocResult[], ctx: PointsCtx, base = '/'): string {
  const cols = HEADLINE_BLOCS.map((id) => blocs.find((b) => b.blocId === id)).filter((b): b is BlocResult => !!b);
  const cells = cols.flatMap((r) => ctx.categories.map((c) => r.categories[c.id]).filter((x) => x && x.scoredActions > 0 && x.shrunkPerYear != null).map((x) => x!.shrunkPerYear as number));
  if (cells.length === 0) return `<tbody><tr><td class="nodata-row">No scored actions in this period yet, so the grid is empty.</td></tr></tbody>`;
  const min = Math.min(...cells), max = Math.max(...cells);
  const span = max - min || 1;
  const head = `<tr><td class="corner"><span class="vh">Category</span></td>${cols.map((r) => `<th scope="col" class="colh"><span class="chip bloc-chip" title="${esc(BLOC_NOTE[r.blocId])}">${blocSwatch(r.blocId)}<span>${esc(r.label)}</span></span></th>`).join('')}</tr>`;
  const body = ctx.categories
    .map((c) => {
      const tds = cols
        .map((r) => {
          const cell = r.categories[c.id];
          const label = `${r.label}, ${c.name}`;
          if (!cell || cell.shrunkPerYear == null || cell.scoredActions === 0) {
            return `<td class="hm hm-none" data-tip="${esc(label)}: no scored actions"><span class="vh">No scored actions</span></td>`;
          }
          const t = (cell.shrunkPerYear - min) / span;
          const cls = ['hm', t > 0.64 ? 'hl' : '', t > 0.57 ? 'hd' : '', cell.lowData ? 'hm-low' : ''].filter(Boolean).join(' ');
          const tip = `${label}: ${fmtSigned(cell.shrunkPerYear, 2)} points per year (shrunk), ${cell.scoredActions} scored ${cell.scoredActions === 1 ? 'action' : 'actions'}, average ${fmtSigned(cell.avgPerAction)} per action, range ${fmtSigned(cell.low * cell.weight)} to ${fmtSigned(cell.high * cell.weight)} in total${cell.lowData ? ' (low data)' : ''}`;
          return `<td class="${cls}" style="--t:${t.toFixed(3)}" data-tip="${esc(tip)}">${fmtSigned(cell.shrunkPerYear, 2)}${cell.lowData ? '<span class="vh"> low data</span>' : ''}</td>`;
        })
        .join('');
      return `<tr><th scope="row" class="rowh"><a href="${base}categories/${esc(c.id)}/">${esc(c.name)}</a></th>${tds}</tr>`;
    })
    .join('\n');
  return `<thead>${head}</thead><tbody>${body}</tbody>`;
}

export function blocHeatRange(blocs: BlocResult[], ctx: PointsCtx): [number, number] | null {
  const v = blocs.filter((b) => HEADLINE_BLOCS.includes(b.blocId)).flatMap((b) => ctx.categories.map((c) => b.categories[c.id]).filter((x) => x && x.scoredActions > 0 && x.shrunkPerYear != null).map((x) => x!.shrunkPerYear as number));
  return v.length ? [Math.min(...v), Math.max(...v)] : null;
}
