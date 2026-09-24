/*
  The Omnatix frame around a demo: the summary that paints before the query engine has
  started, the section navigation that stays on screen, and the one filter each demo offers.

  Shared by all four demos and kept identical, like charts.js. It reads only token names every
  theme already declares, so each demo keeps its own identity inside the frame.

  Why the summary comes from meta.json rather than from a query: the query engine is a 6.8 MB
  download, and for the first five to twelve seconds of a first visit there is nothing to query.
  export_parquet.py computes the headline and one figure per finding from the same gold
  columns the page reads, and writes them beside the freshness dates. The prospect sees the
  finding in the first second instead of a loading message.
*/

import { fmtR, fmtRc, fmtNum, fmtPct, esc } from './charts.js';

const FMT = {
  Rc: fmtRc,
  R: fmtR,
  num: fmtNum,
  pct: (v) => fmtPct(v),
  pct0: (v) => fmtPct(v, 0),
  signedPct: (v) => (v >= 0 ? '+' : '') + fmtPct(v),
  signedPct0: (v) => (v >= 0 ? '+' : '') + fmtPct(v, 0),
  x: (v) => `${v.toFixed(2)}x`,
  text: (v) => String(v),
};

/** Format a summary value by the name export_parquet.py gave it. */
export const fmtAny = (v, f) => (v == null ? '-' : (FMT[f] || FMT.text)(v));

// A kicker is a list of plain strings and {v, f} numbers, so the words live in Python beside
// the SQL that produced the numbers, and the formatting still happens here, in one place.
const kicker = (parts = []) => parts
  .map((p) => (typeof p === 'string' ? esc(p) : `<b>${esc(fmtAny(p.v, p.f))}</b>`))
  .join('');

/**
 * The headline and one card per finding. Each card links to its section, so the strip is
 * both the executive summary and the table of contents.
 */
export function renderSummary(target, s) {
  if (!target || !s) return;
  const cards = (s.findings || []).map((c) => `
    <a class="ox-card${c.close ? ' is-close' : ''}" href="#${esc(c.id)}">
      <span class="ox-card-n">${esc(c.n)}</span>
      <span class="ox-card-title">${esc(c.title)}</span>
      <span class="ox-card-value">${esc(fmtAny(c.v, c.f))}</span>
      <span class="ox-card-note">${esc(c.note)}</span>
    </a>`).join('');
  target.innerHTML = `
    ${s.hero.kicker ? `<p class="ox-kicker">${kicker(s.hero.kicker)}</p>` : ''}
    <div class="hero">
      <div class="hero-value">${esc(fmtAny(s.hero.v, s.hero.f))}</div>
      <div class="hero-label">${esc(s.hero.label)}</div>
    </div>
    <div class="ox-findings">${cards}</div>`;
}

/**
 * The sticky bar: one link per section, and the filter when the demo has one.
 * sections: [[id, number, short label]]
 * filter:   { param, label, all, options: [{ value, label }], value }
 */
export function renderNav(nav, { sections, filter = null }) {
  if (!nav) return;
  const links = sections.map(([id, n, label]) =>
    `<a href="#${esc(id)}" data-id="${esc(id)}">${n ? `<span class="n">${esc(n)}</span>` : ''}${esc(label)}</a>`
  ).join('');
  const select = filter ? `
    <label class="ox-filter${filter.value ? ' is-set' : ''}">
      <span>${esc(filter.label)}</span>
      <select id="ox-filter">
        ${[{ value: '', label: filter.all }, ...filter.options].map((o) =>
          `<option value="${esc(o.value)}"${o.value === filter.value ? ' selected' : ''}>${esc(o.label)}</option>`
        ).join('')}
      </select>
    </label>` : '';
  nav.innerHTML = `<div class="ox-nav-in"><div class="ox-sections">${links}</div>${select}</div>`;
  nav.hidden = false;
}

/** Call back with the new value whenever the filter changes. */
export function onFilterChange(nav, cb) {
  const sel = nav?.querySelector('#ox-filter');
  if (!sel) return;
  sel.addEventListener('change', () => {
    sel.closest('.ox-filter').classList.toggle('is-set', !!sel.value);
    cb(sel.value);
  });
}

// The filter lives in the query string, so a filtered view is a link that can be sent:
// "here is your Mahikeng branch" is a better follow-up than a screenshot.
export const readParam = (name) => new URLSearchParams(location.search).get(name) || '';
export function writeParam(name, value) {
  const u = new URL(location.href);
  if (value) u.searchParams.set(name, value); else u.searchParams.delete(name);
  history.replaceState(null, '', u);
}

/**
 * Which slice a figure shows. Nothing at all when no filter is set; the selection in the
 * accent colour when the figure follows the filter; a quiet "all" label when its data does
 * not break down that way, so a figure never looks filtered when it is not.
 */
export function scope(filterLabel, applies, allLabel) {
  if (!filterLabel) return '';
  return applies
    ? `<span class="ox-scope is-on">${esc(filterLabel)}</span>`
    : `<span class="ox-scope">${esc(allLabel)}</span>`;
}

let spyObserver = null;

/** Highlight the section on screen in the nav, and keep that link scrolled into view. */
export function spy(nav) {
  if (!nav || !('IntersectionObserver' in window)) return;
  spyObserver?.disconnect();
  const links = new Map([...nav.querySelectorAll('.ox-sections a')].map((a) => [a.dataset.id, a]));
  const visible = new Set();
  spyObserver = new IntersectionObserver((entries) => {
    for (const e of entries) (e.isIntersecting ? visible.add : visible.delete).call(visible, e.target.id);
    const first = [...links.keys()].find((id) => visible.has(id));
    if (!first) return;
    for (const [id, a] of links) a.classList.toggle('is-active', id === first);
    const a = links.get(first);
    const strip = a.parentElement;
    const left = a.offsetLeft - strip.clientWidth / 2 + a.clientWidth / 2;
    strip.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }, { rootMargin: '-72px 0px -60% 0px' });
  for (const id of links.keys()) {
    const target = document.getElementById(id);
    if (target) spyObserver.observe(target);
  }
}

/** Redraw without the page jumping: keep the reader where they were. */
export async function keepScroll(fn) {
  const y = window.scrollY;
  await fn();
  window.scrollTo(0, y);
}
