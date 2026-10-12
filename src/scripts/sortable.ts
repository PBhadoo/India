// Progressive enhancement: click-to-sort for <table data-sortable>. Cells carry data-sort values.
document.querySelectorAll<HTMLTableElement>('table[data-sortable]').forEach((table) => {
  const heads = Array.from(table.tHead?.rows[0]?.cells ?? []);
  const body = table.tBodies[0];
  if (!body) return;
  heads.forEach((th, idx) => {
    const label = th.textContent?.trim() ?? '';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sort-btn';
    btn.textContent = label;
    th.textContent = '';
    th.appendChild(btn);
    if (!th.hasAttribute('aria-sort')) th.setAttribute('aria-sort', 'none');
    btn.addEventListener('click', () => {
      const numeric = th.dataset.sortType === 'num';
      const cur = th.getAttribute('aria-sort');
      const dir = cur === 'descending' ? 'ascending' : cur === 'ascending' ? 'descending' : numeric ? 'descending' : 'ascending';
      heads.forEach((h) => h.setAttribute('aria-sort', 'none'));
      th.setAttribute('aria-sort', dir);
      const sign = dir === 'ascending' ? 1 : -1;
      const val = (tr: HTMLTableRowElement) => {
        const c = tr.cells[idx];
        const v = c?.dataset.sort ?? c?.textContent ?? '';
        return numeric ? parseFloat(v) || 0 : v.toLowerCase();
      };
      const rows = Array.from(body.rows).sort((a, b) => {
        const x = val(a), y = val(b);
        return (x < y ? -1 : x > y ? 1 : 0) * sign;
      });
      rows.forEach((r) => body.appendChild(r));
      table.dispatchEvent(new Event('sorted'));
    });
  });
});

// Long tables: show the first N rows, with a button for the rest. Without JS every row is visible.
document.querySelectorAll<HTMLTableElement>('table[data-collapse]').forEach((table) => {
  const limit = Number(table.dataset.collapse) || 10;
  const body = table.tBodies[0];
  if (!body || body.rows.length <= limit + 2) return;
  let open = false;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn';
  const apply = () => {
    Array.from(body.rows).forEach((r, i) => (r.hidden = !open && i >= limit));
    btn.textContent = open ? 'Show fewer parties' : `Show all ${body.rows.length} parties`;
    btn.setAttribute('aria-expanded', String(open));
  };
  btn.addEventListener('click', () => { open = !open; apply(); });
  table.addEventListener('sorted', apply);
  const wrap = document.createElement('p');
  wrap.className = 'collapse-row';
  wrap.appendChild(btn);
  table.closest('.table-wrap')?.after(wrap);
  apply();
});
