// Live recompute for the Evidence points table: weights, period filter, sorting.
// Uses the same pure functions as the build (src/lib/scoring-core.ts).
import { computePoints, computeBlocPoints } from '../lib/scoring-core.ts';
import { heatGridHtml, heatRange, noDataHtml, pointsRowsHtml, sortParties, blocRowsHtml, blocHeatHtml, blocHeatRange, type BlocCtx, type Metric, type PointsCtx, type SortKey } from '../lib/render-points.ts';
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
  const metricBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('#metric-toggle button[data-metric]'));
  const metricToggle = $('metric-toggle');
  const caption = $('pts-caption');
  const bctx: BlocCtx = data.blocCtx;
  const viewBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('#view-toggle button[data-view]'));
  const viewToggle = $('view-toggle');
  let view: 'blocs' | 'parties' = 'blocs';
  let metric: Metric = 'avg';
  let sortKey: SortKey = 'avg';
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

  function update(silent = false) {
    const p = period();
    const weights: Record<string, number> = {};
    let changed = 0;
    sliders.forEach((s) => {
      weights[s.dataset.cat!] = Number(s.value);
      if (Number(s.value) !== 1) changed++;
      const out = document.getElementById(`wo-${s.dataset.cat}`);
      if (out) out.textContent = s.value;
    });
    const input = {
      credits: data.credits,
      governments: data.governments,
      asOf: data.asOf,
      weights,
      categoryIds: data.categoryIds,
      yearFrom: p.from,
      yearTo: p.to,
      lowDataMin: data.lowDataMin,
    };
    const blocView = view === 'blocs';
    const blocs = computeBlocPoints(input);
    const rows = sortParties(computePoints(input), ctx, sortKey, dir);
    tbody.innerHTML = blocView ? blocRowsHtml(blocs, ctx, bctx, metric) : pointsRowsHtml(rows, ctx, '/', metric);
    const nShort = tbody.querySelectorAll('tr.short-row').length;
    const wrap = $('pts-short-wrap');
    const tgl = $<HTMLButtonElement>('pts-short-toggle');
    if (wrap && tgl) {
      const hasGroup = blocView ? blocs.some((b) => b.blocId === 'other' && (b.yearsInPower > 0 || b.scoredActions > 0)) : nShort > 0;
      wrap.hidden = !hasGroup;
      const open = table.hasAttribute('data-short-open');
      tgl.textContent = blocView
        ? (open ? 'Hide Other governments' : 'Show Other governments and the governments in them')
        : (open ? 'Hide short-tenure parties' : `Show ${nShort} short-tenure ${nShort === 1 ? 'party' : 'parties'}`);
      tgl.setAttribute('aria-expanded', String(open));
    }
    const nd = $('pts-nodata');
    if (nd) {
      const h = blocView ? '' : noDataHtml(rows, ctx);
      nd.innerHTML = h;
      nd.hidden = !h;
    }
    const title = $('pts-title');
    if (title) title.textContent = blocView ? 'Evidence points by bloc' : 'Evidence points by party';
    const first = table.tHead?.querySelector<HTMLElement>('th[data-key="party"] .sort-btn');
    if (first) first.textContent = blocView ? 'Bloc' : 'Party';
    const hdesc = $('heat-desc');
    const htitle = $('heat-title');
    if (blocView) {
      if (htitle) htitle.textContent = 'Points per year (shrunk) by category';
      if (hdesc) hdesc.textContent = `Each cell is one bloc's points in one category divided by (the bloc's years in power + ${data.priorYears}), so it depends on how many entries are included for that cell. Cells are shaded from lowest to highest across the grid; shading shows the relative size of a figure, not quality. Numbers are always shown; hatched cells have fewer than ${data.lowDataMin} scored actions, dashed cells have none. Other governments are left out of the grid; their rows are in the table above.`;
      heat.innerHTML = blocHeatHtml(blocs, ctx);
      const br = blocHeatRange(blocs, ctx);
      const hrEl = $('heat-range');
      if (hrEl) hrEl.textContent = br ? `${fmtSigned(br[0], 2)} to ${fmtSigned(br[1], 2)} points per year` : '';
    } else {
      if (htitle) htitle.textContent = 'Points per year by category';
      if (hdesc) hdesc.textContent = `Each cell is one party's raw points per year in one category (no shrinkage), so it depends on how many entries are included for that cell. Cells are shaded from lowest to highest across the grid. Columns are ordered by years in power. Shading shows the relative size of a figure, not quality. Numbers are always shown; hatched cells have fewer than ${data.lowDataMin} scored actions, dashed cells have none. Only parties with at least 2 years in power and a scored action are shown as columns.`;
      // Heat grid columns are ordered by years in power, independent of the headline metric.
      heat.innerHTML = heatGridHtml(sortParties(rows, ctx, 'years', -1), ctx);
      const hr = heatRange(rows, ctx);
      const hrEl = $('heat-range');
      if (hrEl) hrEl.textContent = hr ? `${fmtSigned(hr[0])} to ${fmtSigned(hr[1])} points per year` : '';
    }
    const slugs = new Set(
      (data.credits as { slug: string; year?: number }[])
        .filter((c) => c.year == null || ((p.from == null || c.year >= p.from) && (p.to == null || c.year <= p.to)))
        .map((c) => c.slug),
    );
    if (!silent) live.textContent = `Table updated for ${p.label}. ${changed ? `${changed} ${changed === 1 ? 'category weight' : 'category weights'} changed. ` : ''}${slugs.size} scored ${slugs.size === 1 ? 'action' : 'actions'} counted.`;
    reset.hidden = era.value === 'all' && changed === 0;
    metricBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.metric === metric)));
    if (caption) {
      const names: Record<string, string> = { avg: 'average points per action', shrunk: 'points per year (shrunk)', total: 'total points', years: 'years in power', party: 'party name' };
      const dot = `Dot: ${metric === 'avg' ? 'average points per action' : 'points per year (shrunk)'}; line: low to high from the two scorers.`;
      caption.textContent = blocView
        ? `INC-led and BJP-led are always listed in this fixed order; the order does not follow any figure. ${dot} Ranges overlap.`
        : `Sorted by ${names[sortKey] ?? sortKey}, ${dir === -1 ? 'highest' : 'lowest'} first. The order reflects a figure, not a verdict, and ranges overlap. ${dot}`;
    }
    viewBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
    heads.forEach((th) => th.setAttribute('aria-sort', blocView ? 'none' : th.dataset.key === sortKey ? (dir === 1 ? 'ascending' : 'descending') : 'none'));
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
      if (view === 'blocs') {
        // Blocs keep a fixed order; only the highlighted figure changes.
        if (key === 'avg' || key === 'shrunk') metric = key;
        update();
        return;
      }
      if (key === sortKey) dir = (dir === 1 ? -1 : 1);
      else { sortKey = key; dir = key === 'party' ? 1 : -1; }
      if (key === 'avg' || key === 'shrunk') metric = key;
      update();
    });
  });
  if (viewToggle) {
    viewToggle.hidden = false;
    viewBtns.forEach((b) => b.addEventListener('click', () => {
      view = b.dataset.view as 'blocs' | 'parties';
      table.removeAttribute('data-short-open');
      update();
    }));
  }
  if (metricToggle) {
    metricToggle.hidden = false;
    metricBtns.forEach((b) => b.addEventListener('click', () => {
      metric = b.dataset.metric as Metric;
      sortKey = metric;
      dir = -1;
      update();
    }));
  }
  $('pts-short-toggle')?.addEventListener('click', () => {
    if (table.hasAttribute('data-short-open')) table.removeAttribute('data-short-open');
    else table.setAttribute('data-short-open', '');
    update();
  });
  sliders.forEach((s) => s.addEventListener('input', () => update()));
  era.addEventListener('change', () => {
    customFields.forEach((f) => (f.hidden = era.value !== 'custom'));
    update();
  });
  from.addEventListener('input', () => update());
  to.addEventListener('input', () => update());
  reset.addEventListener('click', () => {
    era.value = 'all';
    from.value = String(data.yearMin);
    to.value = String(data.yearMax);
    customFields.forEach((f) => (f.hidden = true));
    sliders.forEach((s) => (s.value = '1'));
    update();
  });
  update(true);
}
