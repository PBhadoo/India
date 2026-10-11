// Live recompute for the Evidence points table: weights, period filter, sorting.
// Uses the same pure functions as the build (src/lib/scoring-core.ts).
import { computePoints } from '../lib/scoring-core.ts';
import { heatGridHtml, heatRange, noDataHtml, pointsRowsHtml, sortParties, type PointsCtx, type SortKey } from '../lib/render-points.ts';
import { fmtSigned } from '../lib/format.ts';

const dataEl = document.getElementById('points-data');
if (dataEl) {
  const data = JSON.parse(dataEl.textContent || '{}');
  const ctx: PointsCtx = data.ctx;
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
  const table = $('pts-table') as HTMLTableElement;
  const tbody = table.tBodies[0];
  const heat = $('heat-table')!;
  const live = $('pts-live')!;
  const era = $<HTMLSelectElement>('era')!;
  const from = $<HTMLInputElement>('era-from')!;
  const to = $<HTMLInputElement>('era-to')!;
  const reset = $<HTMLButtonElement>('reset-all')!;
  const customFields = document.querySelectorAll<HTMLElement>('[data-custom]');
  const sliders = Array.from(document.querySelectorAll<HTMLInputElement>('input[type=range][data-cat]'));
  const heads = Array.from(document.querySelectorAll<HTMLTableCellElement>('#pts-table th[data-key]'));
  let sortKey: SortKey = 'ppy';
  let dir: 1 | -1 = -1;

  const period = (): { from?: number; to?: number; label: string } => {
    switch (era.value) {
      case 'pre': return { to: 1990, label: 'before 1991' };
      case 'post': return { from: 1991, label: '1991 onward' };
      case 'custom': {
        const f = Math.max(data.yearMin, Math.min(data.yearMax, parseInt(from.value, 10) || data.yearMin));
        const t = Math.max(f, Math.min(data.yearMax, parseInt(to.value, 10) || data.yearMax));
        return { from: f, to: t, label: `${f} to ${t}` };
      }
      default: return { label: `${data.yearMin} to ${data.yearMax}` };
    }
  };

  function update() {
    const p = period();
    const weights: Record<string, number> = {};
    let changed = 0;
    sliders.forEach((s) => {
      weights[s.dataset.cat!] = Number(s.value);
      if (Number(s.value) !== 1) changed++;
      const out = document.getElementById(`wo-${s.dataset.cat}`);
      if (out) out.textContent = s.value;
    });
    const rows = sortParties(
      computePoints({
        credits: data.credits,
        governments: data.governments,
        asOf: data.asOf,
        weights,
        categoryIds: data.categoryIds,
        yearFrom: p.from,
        yearTo: p.to,
        lowDataMin: data.lowDataMin,
      }),
      ctx,
      sortKey,
      dir,
    );
    tbody.innerHTML = pointsRowsHtml(rows, ctx);
    const nShort = tbody.querySelectorAll('tr.short-row').length;
    const wrap = $('pts-short-wrap');
    const tgl = $<HTMLButtonElement>('pts-short-toggle');
    if (wrap && tgl) {
      wrap.hidden = nShort === 0;
      const open = table.hasAttribute('data-short-open');
      tgl.textContent = open ? 'Hide short-tenure parties' : `Show ${nShort} short-tenure ${nShort === 1 ? 'party' : 'parties'}`;
      tgl.setAttribute('aria-expanded', String(open));
    }
    const nd = $('pts-nodata');
    if (nd) {
      const h = noDataHtml(rows, ctx);
      nd.innerHTML = h;
      nd.hidden = !h;
    }
    // Heat grid follows the headline ordering (points per year) so columns stay predictable.
    heat.innerHTML = heatGridHtml(sortParties(rows, ctx, 'ppy', -1), ctx);
    const hr = heatRange(rows, ctx);
    const hrEl = $('heat-range');
    if (hrEl) hrEl.textContent = hr ? `${fmtSigned(hr[0])} to ${fmtSigned(hr[1])} points per year` : '';
    const slugs = new Set(
      (data.credits as { slug: string; year?: number }[])
        .filter((c) => c.year == null || ((p.from == null || c.year >= p.from) && (p.to == null || c.year <= p.to)))
        .map((c) => c.slug),
    );
    live.textContent = `Table updated for ${p.label}. ${changed ? `${changed} ${changed === 1 ? 'category weight' : 'category weights'} changed. ` : ''}${slugs.size} scored ${slugs.size === 1 ? 'action' : 'actions'} counted.`;
    reset.hidden = era.value === 'all' && changed === 0;
    heads.forEach((th) => th.setAttribute('aria-sort', th.dataset.key === sortKey ? (dir === 1 ? 'ascending' : 'descending') : 'none'));
  }

  heads.forEach((th) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sort-btn';
    btn.textContent = th.textContent?.trim() ?? '';
    th.textContent = '';
    th.appendChild(btn);
    btn.addEventListener('click', () => {
      const key = th.dataset.key as SortKey;
      if (key === sortKey) dir = (dir === 1 ? -1 : 1);
      else { sortKey = key; dir = key === 'party' ? 1 : -1; }
      update();
    });
  });
  $('pts-short-toggle')?.addEventListener('click', () => {
    if (table.hasAttribute('data-short-open')) table.removeAttribute('data-short-open');
    else table.setAttribute('data-short-open', '');
    update();
  });
  sliders.forEach((s) => s.addEventListener('input', update));
  era.addEventListener('change', () => {
    customFields.forEach((f) => (f.hidden = era.value !== 'custom'));
    update();
  });
  from.addEventListener('input', update);
  to.addEventListener('input', update);
  reset.addEventListener('click', () => {
    era.value = 'all';
    from.value = String(data.yearMin);
    to.value = String(data.yearMax);
    customFields.forEach((f) => (f.hidden = true));
    sliders.forEach((s) => (s.value = '1'));
    update();
  });
}
