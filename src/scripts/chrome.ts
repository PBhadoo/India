// Theme toggle, mobile menu and shared tooltips. No dependencies.

const root = document.documentElement;

function effectiveTheme(): 'light' | 'dark' {
  const t = root.getAttribute('data-theme');
  if (t === 'light' || t === 'dark') return t;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function syncToggle() {
  const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
  document.querySelectorAll<HTMLElement>('[data-theme-toggle]').forEach((b) => {
    b.setAttribute('aria-label', `Switch to ${next} theme`);
    b.title = `Switch to ${next} theme`;
  });
}
syncToggle();
document.querySelectorAll('[data-theme-toggle]').forEach((b) =>
  b.addEventListener('click', () => {
    const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* storage unavailable: theme still applies for this visit */
    }
    syncToggle();
    document.dispatchEvent(new CustomEvent('themechange'));
  }),
);

// Mobile menu
const btn = document.querySelector<HTMLButtonElement>('[data-menu-btn]');
const list = document.getElementById('nav-list');
if (btn && list) {
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!open));
    list.setAttribute('data-collapsed', String(open));
  });
}

// Tooltips: any element with data-tip. First line is the title.
const tip = document.createElement('div');
tip.className = 'tip';
tip.setAttribute('role', 'tooltip');
tip.id = 'global-tip';
document.body.appendChild(tip);
let current: HTMLElement | null = null;

function show(el: HTMLElement, x?: number, y?: number) {
  const text = el.getAttribute('data-tip');
  if (!text) return;
  current = el;
  const [first, ...rest] = text.split('\n');
  tip.textContent = '';
  const b = document.createElement('b');
  b.textContent = first;
  tip.appendChild(b);
  rest.forEach((line) => {
    const s = document.createElement('span');
    s.className = 'mono';
    s.style.display = 'block';
    s.textContent = line;
    tip.appendChild(s);
  });
  tip.classList.add('on');
  const r = el.getBoundingClientRect();
  const px = x ?? r.left + r.width / 2;
  const py = y ?? r.top;
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  let left = Math.min(Math.max(8, px - tw / 2), window.innerWidth - tw - 8);
  let top = py - th - 12;
  if (top < 8) top = (y ?? r.bottom) + 16;
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}
function hide() {
  current = null;
  tip.classList.remove('on');
}
document.addEventListener('pointerover', (e) => {
  const el = (e.target as HTMLElement).closest?.('[data-tip]') as HTMLElement | null;
  if (el && e.pointerType !== 'touch') show(el, e.clientX, e.clientY);
});
document.addEventListener('pointermove', (e) => {
  if (!current || e.pointerType === 'touch') return;
  const el = (e.target as HTMLElement).closest?.('[data-tip]') as HTMLElement | null;
  if (el === current) show(el, e.clientX, e.clientY);
});
document.addEventListener('pointerout', (e) => {
  const el = (e.target as HTMLElement).closest?.('[data-tip]');
  if (el && el === current) hide();
});
document.addEventListener('focusin', (e) => {
  const el = (e.target as HTMLElement).closest?.('[data-tip]') as HTMLElement | null;
  if (el) show(el);
});
document.addEventListener('focusout', hide);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hide();
});
window.addEventListener('scroll', hide, { passive: true });
