/* Lightweight SVG charts: line/area with crosshair tooltip, sparkline, columns. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const tip = () => document.getElementById('tooltip');

  function el(tag, attrs = {}, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function niceMax(v) {
    if (v <= 0) return 1;
    const mag = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / mag;
    const step = n <= 1 ? 1 : n <= 1.5 ? 1.5 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 3 ? 3 : n <= 4 ? 4 : n <= 5 ? 5 : n <= 6 ? 6 : n <= 8 ? 8 : 10;
    return step * mag;
  }

  function showTip(html, x, y) {
    const t = tip();
    t.innerHTML = html;
    t.hidden = false;
    const w = t.offsetWidth;
    const cx = Math.min(Math.max(x, w / 2 + 8), window.innerWidth - w / 2 - 8);
    t.style.left = cx + 'px';
    t.style.top = Math.max(y, t.offsetHeight + 20) + 'px';
  }
  function hideTip() { tip().hidden = true; }

  /* Line chart. opts: { labels, tipLabels, series:[{name, values, color, area}], fmt, axisFmt, height } */
  function line(container, opts) {
    const draw = () => {
      container.innerHTML = '';
      const W = container.clientWidth || 600;
      const H = opts.height || 280;
      const m = { t: 12, r: 12, b: 28, l: 56 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b;
      const n = opts.labels.length;
      const all = opts.series.flatMap(s => s.values);
      const max = niceMax(Math.max(...all) * 1.08);
      const x = i => m.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
      const y = v => m.t + ih - (v / max) * ih;

      const svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': opts.aria || 'Line chart' }, container);

      // Grid + y ticks
      const ticks = 4;
      for (let i = 0; i <= ticks; i++) {
        const v = (max / ticks) * i;
        const yy = Math.round(y(v)) + 0.5;
        el('line', { x1: m.l, x2: W - m.r, y1: yy, y2: yy, class: i === 0 ? 'baseline' : 'gridline' }, svg);
        const t = el('text', { x: m.l - 10, y: yy + 4, 'text-anchor': 'end' }, svg);
        t.textContent = (opts.axisFmt || opts.fmt)(v);
      }
      // X labels — thin out to avoid collisions
      const maxLabels = Math.max(2, Math.floor(iw / 64));
      const every = Math.ceil(n / maxLabels);
      opts.labels.forEach((lb, i) => {
        if (i % every !== 0 && i !== n - 1) return;
        if (i !== n - 1 && n - 1 - i < every && i % every === 0 && n - 1 - i < every * 0.6) return;
        const t = el('text', { x: x(i), y: H - 8, 'text-anchor': i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle' }, svg);
        t.textContent = lb;
      });

      // Series (draw last-listed first so series[0] is on top)
      [...opts.series].reverse().forEach(s => {
        const pts = s.values.map((v, i) => [x(i), y(v)]);
        const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
        if (s.area) {
          const grad = 'g' + Math.random().toString(36).slice(2, 8);
          const defs = el('defs', {}, svg);
          const lg = el('linearGradient', { id: grad, x1: 0, x2: 0, y1: 0, y2: 1 }, defs);
          el('stop', { offset: '0%', 'stop-color': s.color, 'stop-opacity': 0.16 }, lg);
          el('stop', { offset: '100%', 'stop-color': s.color, 'stop-opacity': 0.0 }, lg);
          el('path', { d: d + ` L ${x(n - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`, fill: `url(#${grad})` }, svg);
        }
        const p = el('path', { d, fill: 'none', stroke: s.color, 'stroke-width': s.weight || 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
        if (s.area) {
          const len = p.getTotalLength ? p.getTotalLength() : 0;
          if (len && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
            p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
            p.getBoundingClientRect();
            p.style.transition = 'stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1)';
            p.style.strokeDashoffset = 0;
          }
        }
      });
      // End-point marker + label on the primary series
      const s0 = opts.series[0];
      const last = s0.values[n - 1];
      el('circle', { cx: x(n - 1), cy: y(last), r: 4.5, fill: s0.color, stroke: 'var(--surface)', 'stroke-width': 2 }, svg);

      // Crosshair
      const ch = el('line', { y1: m.t, y2: m.t + ih, class: 'crosshair', visibility: 'hidden' }, svg);
      const dots = opts.series.map(s => el('circle', { r: 4.5, fill: s.color, stroke: 'var(--surface)', 'stroke-width': 2, visibility: 'hidden' }, svg));
      const hit = el('rect', { x: m.l, y: m.t, width: iw, height: ih, fill: 'transparent' }, svg);
      const move = ev => {
        const r = svg.getBoundingClientRect();
        const px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
        const i = Math.max(0, Math.min(n - 1, Math.round(((px - m.l) / iw) * (n - 1))));
        const cx = x(i);
        ch.setAttribute('x1', cx); ch.setAttribute('x2', cx); ch.setAttribute('visibility', 'visible');
        opts.series.forEach((s, k) => { dots[k].setAttribute('cx', cx); dots[k].setAttribute('cy', y(s.values[i])); dots[k].setAttribute('visibility', 'visible'); });
        const rows = opts.series.map(s => `<div class="tt-row"><span><i style="background:${s.color}"></i>${s.name}</span><b>${opts.fmt(s.values[i])}</b></div>`).join('');
        let delta = '';
        if (opts.series.length > 1 && opts.series[1].values[i]) {
          const ch2 = (opts.series[0].values[i] / opts.series[1].values[i] - 1) * 100;
          delta = `<div class="tt-row" style="margin-top:4px"><span>Change</span><b style="color:var(${ch2 >= 0 ? '--good-ink' : '--crit-ink'})">${ch2 >= 0 ? '+' : ''}${ch2.toFixed(1)}%</b></div>`;
        }
        showTip(`<div class="tt-title">${(opts.tipLabels || opts.labels)[i]}</div>${rows}${delta}`, r.left + cx, r.top + Math.min(...opts.series.map(s => y(s.values[i]))));
      };
      const leave = () => { ch.setAttribute('visibility', 'hidden'); dots.forEach(d => d.setAttribute('visibility', 'hidden')); hideTip(); };
      hit.addEventListener('mousemove', move);
      hit.addEventListener('touchmove', move, { passive: true });
      hit.addEventListener('mouseleave', leave);
      hit.addEventListener('touchend', leave);
    };
    draw();
    observe(container, draw);
  }

  /* Column chart: opts { labels, values, color, fmt, height, highlight } */
  function columns(container, opts) {
    const draw = () => {
      container.innerHTML = '';
      const W = container.clientWidth || 400;
      const H = opts.height || 200;
      const m = { t: 18, r: 4, b: 26, l: 4 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b;
      const n = opts.values.length;
      const max = Math.max(...opts.values) * 1.1 || 1;
      const band = iw / n;
      const bw = Math.min(24, band * 0.62);
      const svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': opts.aria || 'Column chart' }, container);
      el('line', { x1: m.l, x2: W - m.r, y1: m.t + ih + 0.5, y2: m.t + ih + 0.5, class: 'baseline' }, svg);
      const peak = opts.values.indexOf(Math.max(...opts.values));
      opts.values.forEach((v, i) => {
        const h = Math.max(2, (v / max) * ih);
        const cx = m.l + band * i + band / 2;
        const x0 = cx - bw / 2, y0 = m.t + ih - h, r = Math.min(4, bw / 2, h);
        const d = `M${x0} ${m.t + ih} V${y0 + r} Q${x0} ${y0} ${x0 + r} ${y0} H${x0 + bw - r} Q${x0 + bw} ${y0} ${x0 + bw} ${y0 + r} V${m.t + ih} Z`;
        const bar = el('path', { d, fill: i === peak ? opts.color : opts.dim || opts.color, opacity: i === peak ? 1 : 0.55 }, svg);
        const t = el('text', { x: cx, y: H - 8, 'text-anchor': 'middle' }, svg);
        t.textContent = opts.labels[i];
        if (i === peak) {
          const vt = el('text', { x: cx, y: y0 - 6, 'text-anchor': 'middle', class: 'lbl-strong' }, svg);
          vt.textContent = opts.fmt(v);
        }
        const hit = el('rect', { x: m.l + band * i, y: m.t, width: band, height: ih, fill: 'transparent' }, svg);
        hit.addEventListener('mousemove', () => {
          bar.setAttribute('opacity', 1);
          const r = svg.getBoundingClientRect();
          showTip(`<div class="tt-title">${(opts.tipLabels || opts.labels)[i]}</div><div class="tt-row"><span><i style="background:${opts.color}"></i>${opts.name}</span><b>${opts.fmt(v)}</b></div>`, r.left + cx, r.top + y0);
        });
        hit.addEventListener('mouseleave', () => { bar.setAttribute('opacity', i === peak ? 1 : 0.55); hideTip(); });
      });
    };
    draw();
    observe(container, draw);
  }

  function spark(values, color, w = 84, h = 30) {
    const max = Math.max(...values), min = Math.min(...values);
    const x = i => (i / (values.length - 1)) * (w - 4) + 2;
    const y = v => h - 3 - ((v - min) / (max - min || 1)) * (h - 6);
    const d = values.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
    return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d} L ${x(values.length - 1)} ${h} L 2 ${h} Z" fill="${color}" opacity=".10"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  const observers = new WeakMap();
  function observe(node, fn) {
    if (!('ResizeObserver' in window)) return;
    let w = node.clientWidth, raf;
    const ro = new ResizeObserver(() => {
      if (Math.abs(node.clientWidth - w) < 2) return;
      w = node.clientWidth;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(fn);
    });
    ro.observe(node);
    observers.set(node, ro);
  }

  window.Charts = { line, columns, spark, showTip, hideTip };
})();
