/*
  Chart primitives for the Ledger theme.

  Hand-rolled SVG rather than a charting library, because the mark specs are the design:
  thin marks capped at 24px, 4px rounded data-ends, 2px lines, hairline solid gridlines,
  a 2px surface gap between touching bars, and labels placed only where they fit. A
  general-purpose library fights all of that.

  Every chart here renders at the container's true pixel width (no viewBox scaling), so
  measured text width is the width that ships. Charts re-render on resize.
*/

const NS = 'http://www.w3.org/2000/svg';
const M = { top: 16, right: 24, bottom: 38, left: 78 };
const BAR_MAX = 24;
const GAP = 2;

// ------------------------------------------------------------------ format

// Null-tolerant on purpose: a mart can legitimately return null (a brand with no shipped
// weight has no revenue-per-kg), and a dashboard must render the gap, not throw.
const nil = (n) => n === null || n === undefined || Number.isNaN(n);

export const fmtR = (n) =>
  nil(n) ? '-' : (n < 0 ? '-R' : 'R') + Math.round(Math.abs(n)).toLocaleString('en-ZA');

export function fmtRc(n) {
  if (nil(n)) return '-';
  const a = Math.abs(n), s = n < 0 ? '-R' : 'R';
  if (a >= 1e9) return s + (a / 1e9).toFixed(a / 1e9 >= 10 ? 0 : 1) + 'bn';
  if (a >= 1e6) return s + (a / 1e6).toFixed(a / 1e6 >= 100 ? 0 : 1) + 'm';
  if (a >= 1e3) return s + Math.round(a / 1e3) + 'k';
  return s + Math.round(a);
}

export const fmtNum = (n) => (nil(n) ? '-' : Math.round(n).toLocaleString('en-ZA'));
export const fmtPct = (n, dp = 1) => (nil(n) ? '-' : n.toFixed(dp) + '%');
export const fmtR2 = (n) => (nil(n) ? '-' : (n < 0 ? '-R' : 'R') + Math.abs(n).toFixed(2));
export const fmtMonth = (iso) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString('en-ZA', { month: 'short', year: '2-digit', timeZone: 'UTC' });

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ------------------------------------------------------------------ tooltip

let tipEl = null;
function tip() {
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.className = 'tip';
    tipEl.setAttribute('role', 'status');
    document.body.appendChild(tipEl);
  }
  return tipEl;
}
function showTip(html, ev) {
  const t = tip();
  t.innerHTML = html;
  t.setAttribute('data-show', '');
  const pad = 14, r = t.getBoundingClientRect();
  let x = ev.clientX + pad, y = ev.clientY + pad;
  if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - pad;
  if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - pad;
  t.style.left = Math.max(8, x) + 'px';
  t.style.top = Math.max(8, y) + 'px';
}
function hideTip() { if (tipEl) tipEl.removeAttribute('data-show'); }

const tipRow = (k, v) => `<div class="tip-row"><span>${esc(k)}</span><span>${esc(v)}</span></div>`;

// ------------------------------------------------------------------ helpers

/** Read a CSS custom property off :root so charts follow the theme, including dark mode. */
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Bar path: square at the baseline, rounded at the data end. */
function barPath(x, y, w, h, r, allRound = false) {
  if (h <= 0.5) return `M${x} ${y}h${w}`;
  const rad = Math.min(r, w / 2, h);
  if (allRound) {
    return `M${x} ${y + rad}a${rad} ${rad} 0 0 1 ${rad} ${-rad}h${w - 2 * rad}` +
           `a${rad} ${rad} 0 0 1 ${rad} ${rad}v${h - 2 * rad}` +
           `a${rad} ${rad} 0 0 1 ${-rad} ${rad}h${-(w - 2 * rad)}` +
           `a${rad} ${rad} 0 0 1 ${-rad} ${-rad}z`;
  }
  return `M${x} ${y + h}v${-(h - rad)}a${rad} ${rad} 0 0 1 ${rad} ${-rad}` +
         `h${w - 2 * rad}a${rad} ${rad} 0 0 1 ${rad} ${rad}v${h - rad}z`;
}

/** Nice round tick values covering [lo, hi]. */
function ticks(lo, hi, count = 5) {
  if (lo === hi) { lo -= 1; hi += 1; }
  const span = hi - lo;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 7.5 ? 10 : norm >= 3.5 ? 5 : norm >= 1.5 ? 2 : 1) * mag;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(v);
  return out;
}

/** Greedy word wrap to a pixel width, at a given font size. */
function wrap(text, maxPx, fontPx = 11, maxLines = 2) {
  const per = fontPx * 0.55;
  const max = Math.max(4, Math.floor(maxPx / per));
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (next.length <= max) { cur = next; continue; }
    if (cur) lines.push(cur);
    cur = w;
    if (lines.length === maxLines - 1) break;
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) lines.length = maxLines;
  const used = lines.join(' ').split(/\s+/).length;
  if (used < words.length && lines.length) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] = last.length + 1 >= max ? last.slice(0, max - 1) + '…' : last + '…';
  }
  return lines;
}

/** Mount a render function, re-running it when the container resizes. */
export function mount(el, render) {
  let last = 0;
  const run = () => {
    const w = el.clientWidth;
    if (!w) return;
    if (Math.abs(w - last) < 2) return;
    last = w;
    el.innerHTML = render(w);
    bind(el);
  };
  run();
  const ro = new ResizeObserver(() => run());
  ro.observe(el);
  // Theme changes alter the palette, so redraw on toggle.
  new MutationObserver(() => { last = 0; run(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

/** Wire hover on any element carrying data-tip. */
function bind(el) {
  el.querySelectorAll('[data-tip]').forEach((node) => {
    node.addEventListener('mousemove', (ev) => showTip(node.getAttribute('data-tip'), ev));
    node.addEventListener('mouseleave', hideTip);
    node.addEventListener('focus', (ev) => {
      const r = node.getBoundingClientRect();
      showTip(node.getAttribute('data-tip'), { clientX: r.left + r.width / 2, clientY: r.top });
    });
    node.addEventListener('blur', hideTip);
  });
}

const axisText = (x, y, s, anchor = 'middle', cls = '') =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}" fill="${cssVar('--ink-3')}" ` +
  `font-size="11" font-family="${cssVar('--font-sans')}" style="font-variant-numeric:tabular-nums">${esc(s)}</text>`;

// ------------------------------------------------------------------ waterfall

/**
 * rows: [{ label, value, type: 'anchor'|'total'|'increase'|'decrease', tip? }]
 * Anchor and total bars sit on the baseline; steps float between running totals.
 */
export function waterfall(el, { rows, height = 320, valueFmt = fmtRc, showValues = true, zeroBaseline = true }) {
  mount(el, (W) => {
    const iw = W - M.left - M.right;
    const ih = height - M.top - M.bottom;
    const slot = iw / rows.length;
    const bw = Math.min(BAR_MAX * 2.2, slot - 18);

    // running geometry
    let run = 0;
    const geo = rows.map((r) => {
      let lo, hi;
      if (r.type === 'anchor' || r.type === 'total') { lo = 0; hi = r.value; run = r.value; }
      else { lo = run; hi = run + r.value; run = hi; }
      return { ...r, lo: Math.min(lo, hi), hi: Math.max(lo, hi) };
    });

    /*
      A bridge whose anchor dwarfs its steps (R181m against R3.7m) renders every step as an
      invisible sliver on a zero baseline. With zeroBaseline off, the domain is taken from
      the running totals instead, so the steps are legible and the anchors run off the
      bottom of the plot. That is honest here because a waterfall asks the reader to compare
      the steps, not the absolute height of the anchors, and the axis is labelled as
      truncated so nobody reads a full-height bar as a full-magnitude one.
    */
    // Anchors span from zero, so their lo would drag a truncated domain back down to zero.
    // Only their value participates; the floating steps contribute both ends.
    const domainVals = geo.flatMap((g) =>
      g.type === 'anchor' || g.type === 'total' ? [g.hi] : [g.lo, g.hi]);
    const vals = zeroBaseline ? geo.flatMap((g) => [g.lo, g.hi]).concat(0) : domainVals;
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (!zeroBaseline) { const pad = (hi - lo) * 0.35 || 1; lo -= pad; hi += pad * 0.3; }

    const tks = ticks(lo, hi, 5).filter((t) => t >= lo && t <= hi);
    const yLo = zeroBaseline ? Math.min(...tks, ...vals) : lo;
    const yHi = zeroBaseline ? Math.max(...tks, ...vals) : hi;
    const y = (v) => M.top + ih - ((v - yLo) / (yHi - yLo)) * ih;
    const floorY = M.top + ih;

    let s = `<svg width="${W}" height="${height}" role="img" aria-label="Waterfall chart">`;

    for (const t of tks) {
      s += `<line x1="${M.left}" y1="${y(t)}" x2="${W - M.right}" y2="${y(t)}" stroke="${cssVar('--rule')}" stroke-width="1"/>`;
      s += axisText(M.left - 10, y(t) + 4, valueFmt(t), 'end');
    }
    if (yLo < 0 && yHi > 0) {
      s += `<line x1="${M.left}" y1="${y(0)}" x2="${W - M.right}" y2="${y(0)}" stroke="${cssVar('--rule-strong')}" stroke-width="1"/>`;
    }

    geo.forEach((g, i) => {
      const cx = M.left + slot * i + slot / 2;
      const x = cx - bw / 2;
      const anchored = g.type === 'anchor' || g.type === 'total';
      // On a truncated axis the anchors run off the bottom rather than floating.
      const top = y(g.hi);
      const bot = anchored && !zeroBaseline ? floorY : y(g.lo);
      const h = Math.max(1, bot - top);
      const fill = anchored ? cssVar('--neutral')
        : g.value < 0 ? cssVar('--neg') : cssVar('--pos');
      const t = g.tip || `<b>${esc(g.label)}</b>${tipRow('Effect', fmtR(g.value))}`;

      s += `<path d="${barPath(x, top, bw, h, 4, !anchored)}" fill="${fill}"/>`;
      // Generous hit target, bigger than the mark
      s += `<rect x="${cx - slot / 2 + 1}" y="${M.top}" width="${slot - 2}" height="${ih}" fill="transparent" ` +
           `tabindex="0" data-tip="${esc(t)}"/>`;

      if (showValues) {
        // Floating steps always label above their top edge. Labelling a short negative step
        // below its bottom puts the text straight into the x-axis label band.
        const above = anchored ? g.value >= 0 : true;
        s += `<text x="${cx}" y="${above ? top - 7 : bot + 14}" text-anchor="middle" font-size="11.5" ` +
             `font-weight="600" fill="${cssVar('--ink-2')}" font-family="${cssVar('--font-sans')}" ` +
             `style="font-variant-numeric:tabular-nums">${esc(valueFmt(g.value))}</text>`;
      }

      wrap(g.label, slot - 6, 11, 2).forEach((ln, k) => {
        s += axisText(cx, height - M.bottom + 16 + k * 13, ln);
      });
    });

    return s + '</svg>';
  });
}

// ------------------------------------------------------------------ columns

/**
 * rows: [{ x, y, color, tip? }], x is a label, color a CSS var name or hex.
 * refLine: optional { value, label }
 */
export function columns(el, { rows, height = 300, valueFmt = fmtNum, refLine = null, xEvery = 1, yLabel = '' }) {
  mount(el, (W) => {
    const iw = W - M.left - M.right;
    const ih = height - M.top - M.bottom;
    const slot = iw / rows.length;
    const bw = Math.max(1.5, Math.min(BAR_MAX, slot - GAP));

    const maxV = Math.max(...rows.map((r) => r.y), refLine ? refLine.value : 0);
    const tks = ticks(0, maxV, 4);
    const yHi = Math.max(...tks, maxV);
    const y = (v) => M.top + ih - (v / yHi) * ih;

    let s = `<svg width="${W}" height="${height}" role="img" aria-label="Column chart">`;
    for (const t of tks) {
      s += `<line x1="${M.left}" y1="${y(t)}" x2="${W - M.right}" y2="${y(t)}" stroke="${cssVar('--rule')}" stroke-width="1"/>`;
      s += axisText(M.left - 10, y(t) + 4, valueFmt(t), 'end');
    }
    if (yLabel) {
      s += `<text x="${M.left - 10}" y="${M.top - 4}" text-anchor="end" font-size="10.5" ` +
           `fill="${cssVar('--ink-3')}" font-family="${cssVar('--font-sans')}">${esc(yLabel)}</text>`;
    }

    rows.forEach((r, i) => {
      const cx = M.left + slot * i + slot / 2;
      const top = y(r.y);
      const h = Math.max(1, M.top + ih - top);
      s += `<path d="${barPath(cx - bw / 2, top, bw, h, 4)}" fill="${r.color}"/>`;
      s += `<rect x="${cx - slot / 2}" y="${M.top}" width="${slot}" height="${ih}" fill="transparent" ` +
           `tabindex="0" data-tip="${esc(r.tip || `<b>${esc(r.x)}</b>${tipRow('Value', valueFmt(r.y))}`)}"/>`;
      if (i % xEvery === 0) s += axisText(cx, height - M.bottom + 16, r.x);
    });

    if (refLine) {
      const ry = y(refLine.value);
      s += `<line x1="${M.left}" y1="${ry}" x2="${W - M.right}" y2="${ry}" stroke="${cssVar('--ink-3')}" stroke-width="1"/>`;
      s += `<text x="${W - M.right}" y="${ry - 6}" text-anchor="end" font-size="10.5" ` +
           `fill="${cssVar('--ink-3')}" font-family="${cssVar('--font-sans')}">${esc(refLine.label)}</text>`;
    }
    return s + '</svg>';
  });
}

// ------------------------------------------------------------------ horizontal bars

/**
 * rows: [{ label, value, color, tip? }]
 * The right form when there are few categories with long names, the label reads
 * horizontally at full length instead of being truncated under a column.
 */
export function barsH(el, { rows, valueFmt = fmtRc, rowHeight = 46, labelWidth = 240 }) {
  mount(el, (W) => {
    const height = rows.length * rowHeight + 28;
    const left = Math.min(labelWidth, W * 0.34);
    const iw = W - left - 96;
    const maxV = Math.max(...rows.map((r) => r.value));
    const bh = Math.min(BAR_MAX, rowHeight - 18);

    let s = `<svg width="${W}" height="${height}" role="img" aria-label="Bar chart">`;
    rows.forEach((r, i) => {
      const cy = 14 + i * rowHeight + rowHeight / 2;
      const w = Math.max(2, (r.value / maxV) * iw);
      // Rotated 90deg: the data end is the right edge, square at the left baseline.
      s += `<g transform="translate(${left + w} ${cy - bh / 2}) rotate(90)">` +
           `<path d="${barPath(0, 0, bh, w, 4)}" fill="${r.color}"/></g>`;
      s += `<text x="${left - 12}" y="${cy + 4}" text-anchor="end" font-size="12.5" ` +
           `fill="${cssVar('--ink')}" font-family="${cssVar('--font-sans')}">${esc(r.label)}</text>`;
      s += `<text x="${left + w + 10}" y="${cy + 4}" font-size="12" font-weight="600" ` +
           `fill="${cssVar('--ink-2')}" font-family="${cssVar('--font-sans')}" ` +
           `style="font-variant-numeric:tabular-nums">${esc(valueFmt(r.value))}</text>`;
      s += `<rect x="0" y="${cy - rowHeight / 2}" width="${W}" height="${rowHeight}" ` +
           `fill="transparent" tabindex="0" data-tip="${esc(r.tip || `<b>${esc(r.label)}</b>${tipRow('Value', valueFmt(r.value))}`)}"/>`;
    });
    return s + '</svg>';
  });
}

// ------------------------------------------------------------------ lines

/**
 * series: [{ name, color, points: [{x, y}] }], x values shared and ordered.
 * Crosshair tooltip reads every series at the hovered index.
 */
export function lines(el, { series, height = 300, valueFmt = fmtPct, xFmt = (v) => v, xEvery = 3, endLabels = true }) {
  mount(el, (W) => {
    const iw = W - M.left - M.right;
    const ih = height - M.top - M.bottom;
    const xs = series[0].points.map((p) => p.x);
    const n = xs.length;
    const xAt = (i) => M.left + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);

    const all = series.flatMap((s) => s.points.map((p) => p.y)).filter((v) => v != null);
    const tks = ticks(Math.min(...all), Math.max(...all), 4);
    const yLo = Math.min(...tks, ...all), yHi = Math.max(...tks, ...all);
    const y = (v) => M.top + ih - ((v - yLo) / (yHi - yLo || 1)) * ih;

    let s = `<svg width="${W}" height="${height}" role="img" aria-label="Line chart">`;
    for (const t of tks) {
      s += `<line x1="${M.left}" y1="${y(t)}" x2="${W - M.right}" y2="${y(t)}" stroke="${cssVar('--rule')}" stroke-width="1"/>`;
      s += axisText(M.left - 10, y(t) + 4, valueFmt(t, 0), 'end');
    }
    xs.forEach((xv, i) => { if (i % xEvery === 0) s += axisText(xAt(i), height - M.bottom + 16, xFmt(xv)); });

    s += `<g id="crosshair" style="display:none"><line y1="${M.top}" y2="${M.top + ih}" stroke="${cssVar('--rule-strong')}" stroke-width="1"/></g>`;

    for (const ser of series) {
      const d = ser.points.map((p, i) => (p.y == null ? null : `${i ? 'L' : 'M'}${xAt(i)} ${y(p.y)}`))
        .filter(Boolean).join('');
      s += `<path d="${d}" fill="none" stroke="${ser.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
      const lastIdx = ser.points.length - 1;
      const lp = ser.points[lastIdx];
      if (lp.y != null) {
        s += `<circle cx="${xAt(lastIdx)}" cy="${y(lp.y)}" r="4.5" fill="${ser.color}" stroke="${cssVar('--paper')}" stroke-width="2"/>`;
        if (endLabels) {
          s += `<text x="${xAt(lastIdx) + 9}" y="${y(lp.y) + 4}" font-size="11" font-weight="600" ` +
               `fill="${cssVar('--ink-2')}" font-family="${cssVar('--font-sans')}" ` +
               `style="font-variant-numeric:tabular-nums">${esc(valueFmt(lp.y))}</text>`;
        }
      }
    }

    // One wide hit band per x index
    xs.forEach((xv, i) => {
      const half = iw / Math.max(1, n - 1) / 2;
      const rows = series.map((ser) => tipRow(ser.name, ser.points[i].y == null ? '-' : valueFmt(ser.points[i].y))).join('');
      s += `<rect x="${xAt(i) - half}" y="${M.top}" width="${half * 2}" height="${ih}" fill="transparent" ` +
           `tabindex="0" data-x="${xAt(i)}" data-tip="${esc(`<b>${xFmt(xv)}</b>${rows}`)}"/>`;
    });

    return s + '</svg>';
  });

  // Crosshair follows the hovered band
  el.addEventListener('mouseover', (ev) => {
    const t = ev.target.closest('[data-x]');
    const g = el.querySelector('#crosshair');
    if (!t || !g) return;
    g.style.display = '';
    g.querySelector('line').setAttribute('x1', t.getAttribute('data-x'));
    g.querySelector('line').setAttribute('x2', t.getAttribute('data-x'));
  });
  el.addEventListener('mouseleave', () => {
    const g = el.querySelector('#crosshair');
    if (g) g.style.display = 'none';
  });
}

// ------------------------------------------------------------------ legend + table

export function legend(items, asLine = false) {
  return `<div class="legend">` + items.map((i) =>
    `<span class="legend-item"><span class="legend-key${asLine ? ' line' : ''}" style="background:${i.color}"></span>${esc(i.name)}</span>`
  ).join('') + `</div>`;
}

/**
 * Table-view twin for a chart. cols: [{ key, label, align?, fmt?, cls? }]
 * Every chart ships one so no value is gated behind a tooltip.
 */
export function table(cols, rows, { caption = '', totalRow = null } = {}) {
  let s = `<table>`;
  if (caption) s += `<caption>${esc(caption)}</caption>`;
  s += `<thead><tr>` + cols.map((c) =>
    `<th class="${c.align === 'right' ? 'num' : ''}">${esc(c.label)}</th>`).join('') + `</tr></thead><tbody>`;
  for (const r of rows) {
    s += `<tr>` + cols.map((c) => {
      const raw = r[c.key];
      const v = c.fmt ? c.fmt(raw, r) : raw;
      const cls = [c.align === 'right' ? 'num' : '', c.cls ? c.cls(raw, r) : ''].filter(Boolean).join(' ');
      return `<td class="${cls}">${v == null ? '-' : esc(v)}</td>`;
    }).join('') + `</tr>`;
  }
  if (totalRow) {
    s += `<tr class="total">` + cols.map((c) => {
      const raw = totalRow[c.key];
      const v = c.fmt && raw != null ? c.fmt(raw, totalRow) : raw;
      return `<td class="${c.align === 'right' ? 'num' : ''}">${v == null ? '' : esc(v)}</td>`;
    }).join('') + `</tr>`;
  }
  return s + `</tbody></table>`;
}

/**
 * A figure block: title, note, chart mount point, legend, and a toggleable table twin.
 *
 * hasChart exists for the figures that are only a table. Emitting the mount point anyway
 * leaves an empty div behind, which is invisible but is exactly the shape of the bug where a
 * chart was meant to be drawn and never was, so the two cases are declared apart.
 */
export function figure({ id, title, note, legendHtml = '', tableHtml = '', hasChart = true }) {
  return `
  <div class="figure">
    <div class="figure-head">
      <h3 class="figure-title">${esc(title)}</h3>
      ${tableHtml ? `<button class="tbl-toggle" data-table="${id}" aria-expanded="false">Show data</button>` : ''}
    </div>
    ${note ? `<p class="figure-note">${note}</p>` : ''}
    ${legendHtml}
    ${hasChart ? `<div class="chart" id="${id}"></div>` : ''}
    ${tableHtml ? `<div class="data-table" id="${id}-table" hidden>${tableHtml}</div>` : ''}
  </div>`;
}

/** Wire every Show data toggle on the page. */
export function wireTableToggles(root = document) {
  root.querySelectorAll('.tbl-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const t = document.getElementById(btn.dataset.table + '-table');
      const open = !t.hidden;
      t.hidden = open;
      btn.textContent = open ? 'Show data' : 'Hide data';
      btn.setAttribute('aria-expanded', String(!open));
    });
  });
}
