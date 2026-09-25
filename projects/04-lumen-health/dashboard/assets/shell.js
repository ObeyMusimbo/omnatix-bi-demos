/*
  The Omnatix frame around a demo: the summary that paints before the query engine has
  started, the section navigation, the one filter each demo offers, the light and dark switch,
  the one-view-at-a-time router, and the AI insight panels.

  Shared by all four demos and kept identical, like charts.js. It emits markup and behaviour
  only; how any of it looks is decided by each demo's own stylesheet, which is how four pages
  built on one frame can have four different layouts.

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

// ---------------------------------------------------------------- theme
//
// Every demo has a light and a dark mode, each with its own validated palette. The first paint
// is set by a one line script in the page head, so there is no flash of the wrong theme; this
// only wires the switch. The choice is remembered per demo, because each has its own default.

export function wireTheme(button, { key, onChange = () => {} } = {}) {
  if (!button) return;
  const root = document.documentElement;
  const label = () => {
    const dark = root.getAttribute('data-theme') === 'dark';
    button.textContent = dark ? 'Light mode' : 'Dark mode';
    button.setAttribute('aria-pressed', String(dark));
  };
  label();
  button.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem(key, next); } catch { /* private mode */ }
    label();
    // Charts, heat grids and legends resolve their colours when drawn, so a theme change
    // redraws the page rather than leaving the old palette on screen.
    onChange(next);
  });
}

// ---------------------------------------------------------------- views
//
// Three of the four demos show one section at a time: a sidebar, a pager, or tabs. The
// section is named in the hash, so every view is a link that can be sent, and the browser's
// back button walks back through them. Printing shows every section regardless.
//
// Charts are drawn while every section is visible and hidden afterwards, so a hidden view is
// already drawn at its true width when it is opened, and a printed pack has every chart in it.

export function views({ ids, fallback = ids[0], anchor = null, onShow = () => {} }) {
  let current = null;
  const valid = (id) => ids.includes(id);
  const apply = (id, { scroll = true } = {}) => {
    const prev = current;
    current = valid(id) ? id : valid(current) ? current : fallback;
    for (const x of ids) document.getElementById(x)?.classList.toggle('ox-off', x !== current);
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      const on = a.getAttribute('href') === `#${current}`;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
    document.documentElement.dataset.view = current;
    onShow(current, ids.indexOf(current), ids.length);
    if (scroll && prev !== current) {
      // Land at the top of the view. anchor is whatever sits above the views and may scroll
      // away, a header, so a sticky bar below it ends up at the top of the screen. Measured on
      // the header rather than the bar, because a stuck bar reports where it is stuck.
      const top = anchor ? anchor.getBoundingClientRect().bottom + window.scrollY : 0;
      if (window.scrollY > top) window.scrollTo({ top });
    }
  };
  window.addEventListener('hashchange', () => apply(location.hash.slice(1)));
  const go = (id) => {
    if (!valid(id)) return;
    if (location.hash.slice(1) === id) apply(id); else location.hash = id;
  };
  apply(location.hash.slice(1), { scroll: false });
  return {
    go,
    get current() { return current; },
    get index() { return ids.indexOf(current); },
    step(d) {
      const i = ids.indexOf(current) + d;
      if (i >= 0 && i < ids.length) go(ids[i]);
    },
    /** Re-apply after a redraw has replaced the sections. */
    refresh() { apply(current, { scroll: false }); },
  };
}

// ---------------------------------------------------------------- AI insights
//
// data/insights.json is written by scripts/ai_insights.py after each refresh, from the same
// gold tables this page reads, by whichever model the pipeline has a key for. The page says
// which model wrote it and when, and the figures above every panel are the ones to check it
// against. No file, no panels: the page never invents an insight of its own.

export async function insights() {
  try {
    const res = await fetch(new URL('data/insights.json', location.href), { cache: 'no-store' });
    if (!res.ok) return null;
    const ins = await res.json();
    return ins && ins.sections ? ins : null;
  } catch {
    return null;
  }
}

const shortDate = (iso) => new Date(iso).toLocaleDateString('en-ZA',
  { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Who wrote the insights, and when, in one sentence. */
export function aiCredit(ins) {
  if (!ins) return '';
  const g = ins.generator || {};
  const who = g.model_label || g.model || 'an AI model';
  const via = g.provider ? ` via ${g.provider}` : '';
  const when = ins.generated_at ? `, ${shortDate(ins.generated_at)}` : '';
  return `Written by ${who}${via} from this dashboard's data${when}.`;
}

// An action is either a sentence, or { do, owner, when } so the owner and the deadline can be
// set apart from the instruction.
const action = (a) => (typeof a === 'string'
  ? `<li><span class="ai-do">${esc(a)}</span></li>`
  : `<li><span class="ai-do">${esc(a.do || '')}</span>${a.owner || a.when
    ? `<span class="ai-meta">${esc([a.owner, a.when].filter(Boolean).join(' · '))}</span>` : ''}</li>`);

const worth = (value, note) => (value == null ? '' : `
  <div class="ai-value">
    <span class="ai-value-n">${esc(fmtRc(value))}</span>
    ${note ? `<span class="ai-value-note">${esc(note)}</span>` : ''}
  </div>`);

/** The panel for one section: what the data says, why, what to do, and what it is worth. */
export function aiPanel(ins, id, { label = 'AI analyst', scope: sc = '', cls = '' } = {}) {
  const s = ins?.sections?.[id];
  if (!s) return '';
  return `
  <aside class="ai${cls ? ` ${cls}` : ''}" aria-label="${esc(label)}">
    <div class="ai-head">
      <span class="ai-badge">${esc(label)}</span>${sc}
      ${s.confidence ? `<span class="ai-conf">${esc(s.confidence)} confidence</span>` : ''}
    </div>
    <p class="ai-insight">${esc(s.insight || '')}</p>
    ${s.why ? `<p class="ai-why">${esc(s.why)}</p>` : ''}
    ${s.actions?.length ? `<ol class="ai-actions">${s.actions.map(action).join('')}</ol>` : ''}
    ${worth(s.value_zar, s.value_note)}
    <p class="ai-credit">${esc(aiCredit(ins))}</p>
  </aside>`;
}

/** Put a panel into every section that has one: after the lede, or at the end. */
export function attachInsights(root, ins, { where = 'lede', ...opts } = {}) {
  if (!root || !ins?.sections) return;
  root.querySelectorAll('section[id]').forEach((sec) => {
    const html = aiPanel(ins, sec.id, opts);
    if (!html) return;
    const lede = where === 'lede' ? sec.querySelector('.lede') : null;
    if (lede) lede.insertAdjacentHTML('afterend', html);
    else sec.insertAdjacentHTML('beforeend', html);
  });
}

/**
 * The overview: one headline, a paragraph, and the priorities in the order to do them, each
 * linking to the section that proves it.
 */
export function aiBrief(ins, { label = 'AI briefing', title = '', cls = '' } = {}) {
  const o = ins?.overview;
  if (!o) return '';
  const items = (o.priorities || []).map((p, i) => `
    <li>
      <a class="ai-pri" href="#${esc(p.section || '')}">
        <span class="ai-pri-n">${String(i + 1).padStart(2, '0')}</span>
        <span class="ai-pri-body">
          <span class="ai-do">${esc(p.action || '')}</span>
          <span class="ai-meta">${esc([p.owner, p.horizon].filter(Boolean).join(' · '))}</span>
        </span>
        ${p.value_zar != null ? `<span class="ai-pri-v">${esc(fmtRc(p.value_zar))}</span>` : ''}
      </a>
    </li>`).join('');
  return `
  <aside class="ai-brief${cls ? ` ${cls}` : ''}" aria-label="${esc(label)}">
    <div class="ai-head"><span class="ai-badge">${esc(label)}</span></div>
    ${title ? `<h2 class="ai-brief-title">${esc(title)}</h2>` : ''}
    <p class="ai-headline">${esc(o.headline || '')}</p>
    ${o.summary ? `<p class="ai-why">${esc(o.summary)}</p>` : ''}
    ${items ? `<ol class="ai-pris">${items}</ol>` : ''}
    <p class="ai-credit">${esc(aiCredit(ins))}</p>
  </aside>`;
}
