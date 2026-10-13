// Category picker and period filter for /compare/blocs/. Every category is pre-rendered, so the page works
// without JavaScript; this script shows one category and recomputes each summary row with the same pure code.
import { computeBlocPoints, summarizeActions } from '../lib/scoring-core.ts';
import { fmtNum, fmtSigned } from '../lib/format.ts';

const dataEl = document.getElementById('bc-data');
const ctl = document.getElementById('bc-controls');
const catSel = document.getElementById('bc-cat') as HTMLSelectElement | null;
if (dataEl && ctl && catSel) {
  const data = JSON.parse(dataEl.textContent || '{}');
  const era = document.getElementById('bc-era') as HTMLSelectElement;
  const from = document.getElementById('bc-from') as HTMLInputElement;
  const to = document.getElementById('bc-to') as HTMLInputElement;
  const live = document.getElementById('bc-live')!;
  const custom = document.querySelectorAll<HTMLElement>('#bc-controls [data-custom]');
  const secs = Array.from(document.querySelectorAll<HTMLElement>('section[data-cat]'));

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

  function update(announce: boolean) {
    const p = period();
    const years = Object.fromEntries(
      computeBlocPoints({ credits: [], governments: data.governments, asOf: data.asOf, yearFrom: p.from, yearTo: p.to }).map((b) => [b.blocId, b.yearsInPower]),
    );
    let shown = 0;
    for (const sec of secs) {
      const on = sec.dataset.cat === catSel!.value;
      sec.hidden = !on;
      if (!on) continue;
      sec.querySelectorAll<HTMLElement>('.bloc-col').forEach((col) => {
        const lis = Array.from(col.querySelectorAll<HTMLLIElement>('ul[data-list] > li'));
        const kept = lis.filter((li) => {
          const y = Number(li.dataset.year);
          const ok = (p.from == null || y >= p.from) && (p.to == null || y <= p.to);
          li.hidden = !ok;
          return ok;
        });
        const s = summarizeActions(kept.map((li) => ({ points: Number(li.dataset.points), low: Number(li.dataset.low), high: Number(li.dataset.high), scored: li.dataset.scored === '1' })), data.lowDataMin);
        const set = (f: string, t: string) => { const el = col.querySelector<HTMLElement>(`[data-f="${f}"]`); if (el) el.textContent = t; };
        set('count', String(s.count));
        set('count-l', `${s.count === 1 ? 'action' : 'actions'}${s.scored !== s.count ? `, ${s.scored} scored` : ''}`);
        set('avg', s.avg == null ? '–' : fmtSigned(s.avg));
        set('range', s.avg == null ? '' : `range ${fmtSigned(s.avgLow)} to ${fmtSigned(s.avgHigh)}`);
        set('years', fmtNum(years[col.dataset.bloc!] ?? 0));
        const low = col.querySelector<HTMLElement>('[data-f="low"]');
        if (low) low.hidden = !s.lowData;
        const empty = col.querySelector<HTMLElement>('[data-empty]');
        if (empty) empty.hidden = kept.length > 0;
        shown += kept.length;
      });
    }
    if (announce) live.textContent = `Showing ${catSel!.selectedOptions[0]?.textContent}, ${p.label}: ${shown} actions across both columns.`;
  }

  ctl.hidden = false;
  const fromHash = decodeURIComponent(location.hash.replace(/^#(bc-)?/, ''));
  if (fromHash && Array.from(catSel.options).some((o) => o.value === fromHash)) catSel.value = fromHash;
  catSel.addEventListener('change', () => {
    try { history.replaceState(null, '', `#${catSel.value}`); } catch { /* ignore */ }
    update(true);
  });
  era.addEventListener('change', () => { custom.forEach((f) => (f.hidden = era.value !== 'custom')); update(true); });
  from.addEventListener('input', () => update(true));
  to.addEventListener('input', () => update(true));
  update(false);
}
