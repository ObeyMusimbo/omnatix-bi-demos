/* Leshaw Business Hub: application */
(function () {
  'use strict';
  const L = window.LESHAW;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const DAY = 864e5;
  const STORE = 'leshaw-hub-v1';

  /* ------------------------------------------------------------------ Icons */
  const ICONS = {
    grid: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8M16 13H8M16 17H8"/>',
    saw: '<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>',
    layers: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/>',
    external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    plus: '<path d="M5 12h14M12 5v14"/>',
    minus: '<path d="M5 12h14"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    up: '<path d="M7 17 17 7M7 7h10v10"/>',
    down: '<path d="M7 7l10 10M17 7v10H7"/>',
    cash: '<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    chart: '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    arrow: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>',
    box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
    ruler: '<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2M11.5 9.5l2-2M8.5 6.5l2-2M17.5 15.5l2-2"/>',
    square: '<rect width="18" height="18" x="3" y="3" rx="2"/>',
    trash: '<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>',
    calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
    percent: '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    store: '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M2 7h20v3a2 2 0 0 1-2 2 2.7 2.7 0 0 1-2-1 2.7 2.7 0 0 1-4 0 2.7 2.7 0 0 1-4 0 2.7 2.7 0 0 1-4 0 2.7 2.7 0 0 1-2 1 2 2 0 0 1-2-2Z"/>',
  };
  const icon = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;
  const hydrateIcons = (root = document) => $$('[data-icon]', root).forEach(e => { if (!e.firstChild) e.innerHTML = icon(e.dataset.icon); });

  /* ------------------------------------------------------------------ State */
  let S = load();
  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const s = JSON.parse(raw);
        // Kept for the rest of the day it was generated, so demo changes survive a reload. A day
        // later it is generated afresh: the sample data runs up to now, and a hub kept from
        // yesterday would open on "0 orders so far today", and so would its AI.
        if (s && s.v === 1 && new Date(s.generated).toDateString() === new Date().toDateString()) return s;
      }
    } catch (e) { /* storage unavailable, so fall through */ }
    return L.generate();
  }
  let saveT;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) {} }, 150);
  }
  let pIndex, cIndex;
  function reindex() {
    pIndex = Object.fromEntries(S.products.map(p => [p.id, p]));
    cIndex = Object.fromEntries(S.customers.map(c => [c.id, c]));
  }
  reindex();
  // Read-only window onto the live data for Ask the data (js/ai/), so the AI answers from
  // exactly what the hub shows, demo changes and resets included. A getter, because a reset
  // replaces S with a fresh object.
  window.LeshawHub = { state: () => S };
  const prod = id => pIndex[id];
  const cust = id => cIndex[id];

  /* ------------------------------------------------------------------ Format */
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = new Intl.NumberFormat('en-ZA', { maximumFractionDigits: 0 });
  const money = v => 'R ' + nf.format(Math.round(v));
  const moneyC = v => {
    const a = Math.abs(v);
    if (a >= 1e6) return 'R ' + (v / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + 'm';
    if (a >= 1e3) return 'R ' + (v / 1e3).toFixed(a >= 1e5 ? 0 : 1).replace(/\.0$/, '') + 'k';
    return 'R ' + Math.round(v);
  };
  const num = v => nf.format(Math.round(v));
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const fmtDate = (iso, withYear) => { const d = new Date(iso); return d.getDate() + ' ' + MONTHS[d.getMonth()] + (withYear || d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''); };
  const fmtTime = iso => { const d = new Date(iso); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const daysAgo = iso => Math.floor((today0() - new Date(new Date(iso).toDateString())) / DAY);
  const relDate = iso => { const n = daysAgo(iso); return n === 0 ? 'Today, ' + fmtTime(iso) : n === 1 ? 'Yesterday, ' + fmtTime(iso) : n < 7 ? WD[new Date(iso).getDay()] + ', ' + fmtTime(iso) : fmtDate(iso); };
  const initials = name => name.replace(/[^A-Za-z ]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const pct = (a, b) => (b ? (a / b - 1) * 100 : 0);
  const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

  /* ------------------------------------------------------------------ Domain */
  const linesTotal = o => o.lines.reduce((s, l) => s + l.qty * l.price, 0);
  const svcTotal = o => (o.services || []).reduce((s, l) => s + l.qty * l.price, 0);
  const total = o => linesTotal(o) + svcTotal(o);
  const vatOf = t => t * 15 / 115;
  const isBoard = p => p && !['Hardware', 'Edging'].includes(p.category);
  const sheetsIn = o => o.lines.reduce((s, l) => { const p = prod(l.pid); return s + (isBoard(p) && p.category !== 'Counter Tops' ? l.qty : 0); }, 0);
  const valid = o => o.status !== 'Cancelled';
  const lowStock = () => S.products.filter(p => p.stock <= p.reorder).sort((a, b) => a.stock / a.reorder - b.stock / b.reorder);

  function window_(P, offset = 0) {
    const end = new Date(today0().getTime() + DAY - offset * P * DAY);
    const start = new Date(end.getTime() - P * DAY);
    return [start, end];
  }
  function ordersIn(P, offset = 0) {
    const [s, e] = window_(P, offset);
    return S.orders.filter(o => { const d = new Date(o.date); return d >= s && d < e && valid(o); });
  }

  const STATUS_CLS = { 'Awaiting payment': 'warn', 'Paid': 'info', 'In production': 'prod', 'Ready for collection': 'good', 'Completed': 'neutral', 'Cancelled': 'crit' };
  const Q_CLS = { Draft: 'neutral', Sent: 'info', Accepted: 'good', Declined: 'crit', Expired: 'warn' };
  const STAGE_COLOR = { Received: 'var(--muted)', Optimising: 'var(--warn)', Cutting: 'var(--blue)', 'Edge banding': '#7a5af0', Ready: 'var(--good)' };
  const pill = (s, map = STATUS_CLS) => `<span class="pill ${map[s] || 'neutral'}">${esc(s)}</span>`;

  function flow(o) {
    return (o.services && o.services.length)
      ? ['Awaiting payment', 'Paid', 'In production', 'Ready for collection', 'Completed']
      : ['Awaiting payment', 'Paid', 'Ready for collection', 'Completed'];
  }
  function nextStatus(o) {
    const f = flow(o); const i = f.indexOf(o.status);
    return i >= 0 && i < f.length - 1 ? f[i + 1] : null;
  }
  function setStatus(o, status) {
    o.status = status;
    let job = S.jobs.find(j => j.oid === o.id);
    if ((status === 'Paid' || status === 'In production') && o.services.length && !job) {
      const board = o.lines.map(l => prod(l.pid)).find(isBoard);
      const cut = o.services.find(s => s.key === 'cut'); const edge = o.services.find(s => s.key === 'edge');
      if (board) {
        job = { id: 'JC-' + (5100 + S.jobs.length + Math.floor(Math.random() * 900)), oid: o.id, cid: o.cid, pid: board.id, sheets: cut ? cut.qty : 0, panels: (cut ? cut.qty : 0) * 9, edgeM: edge ? edge.qty : 0, stage: 'Received', due: new Date(Date.now() + 2 * DAY).toISOString(), machine: 'Panel saw 1', priority: false };
        S.jobs.push(job);
      }
    }
    if (job) {
      if (status === 'In production' && job.stage === 'Received') job.stage = 'Optimising';
      if (status === 'Ready for collection') job.stage = 'Ready';
    }
    if (status === 'Completed' || status === 'Cancelled') S.jobs = S.jobs.filter(j => j.oid !== o.id);
    save();
  }
  function setStage(job, stage) {
    job.stage = stage;
    if (stage === 'Edge banding') job.machine = 'Edge bander';
    else if (stage === 'Cutting' && job.machine === 'Edge bander') job.machine = 'Panel saw 1';
    const o = S.orders.find(x => x.id === job.oid);
    if (o) {
      if (stage === 'Ready') o.status = 'Ready for collection';
      else if (stage !== 'Received' && ['Paid', 'Awaiting payment', 'Ready for collection'].includes(o.status)) o.status = 'In production';
      else if (stage === 'Received' && o.status === 'Ready for collection') o.status = 'In production';
    }
    save();
  }
  const activeJobs = () => S.jobs.filter(j => { const o = S.orders.find(x => x.id === j.oid); return o && !['Completed', 'Cancelled'].includes(o.status); });

  /* ------------------------------------------------------------------ UI utils */
  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = icon('check') + '<span>' + msg + '</span>';
    $('#toasts').appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 3200);
  }
  function delta(v, invert) {
    if (!isFinite(v)) return '';
    const up = v >= 0;
    const good = invert ? !up : up;
    return `<span class="delta ${good ? 'up' : 'down'}">${icon(up ? 'up' : 'down')}${Math.abs(v).toFixed(1)}%</span>`;
  }
  function csv(rows, name) {
    const text = rows.map(r => r.map(v => /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : v).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const thumb = p => `<img class="thumb" src="${p.img}" alt="" loading="lazy" />`;

  /* ------------------------------------------------------------------ Router */
  const ROUTES = {
    overview: { title: 'Overview', sub: () => `${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()]}, ${fmtDate(new Date().toISOString(), true)} · Spruitview branch`, render: viewOverview },
    orders: { title: 'Orders', sub: () => 'Every sale, from counter to cut list', render: viewOrders },
    quotes: { title: 'Quotes', sub: () => 'Build, send and convert quotes in minutes', render: viewQuotes },
    production: { title: 'Cut & Edge', sub: () => 'Live factory board · drag jobs between stages', render: viewProduction },
    inventory: { title: 'Inventory', sub: () => 'Boards, tops, edging and hardware in stock', render: viewInventory },
    customers: { title: 'Customers', sub: () => 'Trade accounts and walk-in sales', render: viewCustomers },
  };
  const ui = { period: 30, orderFilter: 'All', orderQ: '', orderPage: 0, orderSort: ['date', -1], quoteFilter: 'All', invCat: 'All', invQ: '', invLow: false, invSort: 'popular', custQ: '', custSort: ['ltv', -1], prodFilter: 'All' };
  try { Object.assign(ui, JSON.parse(localStorage.getItem('leshaw-ui') || '{}'), { orderPage: 0 }); } catch (e) {}
  const saveUi = () => { try { localStorage.setItem('leshaw-ui', JSON.stringify({ period: ui.period, invSort: ui.invSort })); } catch (e) {} };

  function route() {
    const key = (location.hash.replace(/^#\/?/, '').split('?')[0]) || 'overview';
    const r = ROUTES[key] || ROUTES.overview;
    $$('.nav a').forEach(a => a.classList.toggle('active', a.dataset.route === key));
    $('#pageTitle').textContent = r.title;
    $('#pageSub').textContent = r.sub();
    document.title = r.title + ' · Leshaw Business Hub';
    Charts.hideTip();
    const v = $('#view');
    v.innerHTML = '';
    r.render(v);
    hydrateIcons(v);
    updateBadges();
    closeSidebar();
  }
  function rerender() { const y = window.scrollY; route(); window.scrollTo(0, y); }

  function updateBadges() {
    const awaiting = S.orders.filter(o => ['Awaiting payment', 'Paid'].includes(o.status)).length;
    $('#nb-orders').textContent = awaiting || '';
    $('#nb-quotes').textContent = S.quotes.filter(q => q.status === 'Sent' || q.status === 'Draft').length || '';
    $('#nb-prod').textContent = activeJobs().filter(j => j.stage !== 'Ready').length || '';
    $('#nb-stock').textContent = lowStock().length || '';
    $('#bellDot').hidden = notifications().filter(n => !S.readNotifs.includes(n.id)).length === 0;
  }

  /* ================================================================== OVERVIEW */
  function viewOverview(v) {
    const P = ui.period;
    const cur = ordersIn(P), prev = ordersIn(P, 1);
    const rev = cur.reduce((s, o) => s + total(o), 0), revP = prev.reduce((s, o) => s + total(o), 0);
    const aov = cur.length ? rev / cur.length : 0, aovP = prev.length ? revP / prev.length : 0;
    const sheets = cur.reduce((s, o) => s + (o.services.find(x => x.key === 'cut')?.qty || 0), 0);
    const sheetsP = prev.reduce((s, o) => s + (o.services.find(x => x.key === 'cut')?.qty || 0), 0);
    const low = lowStock();
    const jobs = activeJobs();
    const todayOrders = ordersIn(1);
    const ready = S.orders.filter(o => o.status === 'Ready for collection').length;
    const periodLabel = { 7: 'last 7 days', 30: 'last 30 days', 90: 'last 90 days', 365: 'last 12 months' }[P];
    const vsLabel = P === 365 ? 'vs last year' : 'vs prev. ' + P + ' days';

    // Trend buckets
    const trend = buildTrend(P);

    v.innerHTML = `
      <section class="hero">
        <div>
          <span class="hero-eyebrow">Leshaw · Boards &amp; Hardware</span>
          <h2>${greeting()}, Barnabas</h2>
          <p>${todayOrders.length} orders so far today, <b>${jobs.filter(j => j.stage !== 'Ready').length}</b> cut &amp; edge jobs on the factory floor and <b>${ready}</b> orders waiting for collection.</p>
        </div>
        <div class="hero-stats">
          <div class="hero-chip"><small>Today's sales</small><strong>${moneyC(todayOrders.reduce((s, o) => s + total(o), 0))}</strong></div>
          <div class="hero-chip"><small>Open quotes</small><strong>${moneyC(S.quotes.filter(q => q.status === 'Sent').reduce((s, q) => s + total(q), 0))}</strong></div>
        </div>
      </section>

      <div class="toolbar">
        <h2>Performance</h2>
        <div class="seg" role="tablist" aria-label="Period">
          ${[[7, '7D'], [30, '30D'], [90, '90D'], [365, '12M']].map(([d, l]) => `<button role="tab" data-period="${d}" class="${P === d ? 'on' : ''}" aria-selected="${P === d}">${l}</button>`).join('')}
        </div>
      </div>

      <section class="grid g-kpi">
        <div class="card kpi">
          <div class="kpi-top"><span class="kpi-label">Revenue</span><span class="kpi-ico">${icon('cash')}</span></div>
          <div class="kpi-value">${moneyC(rev)}</div>
          <div class="kpi-foot">${delta(pct(rev, revP))}<span>${vsLabel}</span></div>
        </div>
        <div class="card kpi clickable" data-go="orders">
          <div class="kpi-top"><span class="kpi-label">Orders</span><span class="kpi-ico">${icon('bag')}</span></div>
          <div class="kpi-value">${num(cur.length)}</div>
          <div class="kpi-foot">${delta(pct(cur.length, prev.length))}<span>${vsLabel}</span></div>
        </div>
        <div class="card kpi">
          <div class="kpi-top"><span class="kpi-label">Avg. order value</span><span class="kpi-ico">${icon('chart')}</span></div>
          <div class="kpi-value">${money(aov)}</div>
          <div class="kpi-foot">${delta(pct(aov, aovP))}<span>${vsLabel}</span></div>
        </div>
        <div class="card kpi clickable" data-go="production">
          <div class="kpi-top"><span class="kpi-label">Sheets cut &amp; edged</span><span class="kpi-ico red">${icon('saw')}</span></div>
          <div class="kpi-value">${num(sheets)}</div>
          <div class="kpi-foot">${delta(pct(sheets, sheetsP))}<span>${vsLabel}</span></div>
        </div>
        <div class="card kpi clickable" data-go="inventory?low">
          <div class="kpi-top"><span class="kpi-label">Low-stock items</span><span class="kpi-ico warn">${icon('alert')}</span></div>
          <div class="kpi-value">${low.length}</div>
          <div class="kpi-foot"><span>${low.filter(p => p.stock === 0).length ? low.filter(p => p.stock === 0).length + ' out of stock · ' : ''}below reorder level</span></div>
        </div>
      </section>

      <section class="grid g-main mt">
        <div class="card">
          <div class="card-head">
            <div><h3>${trend.cumulative ? 'Revenue pace' : 'Revenue trend'}</h3><p>${trend.cumulative ? 'Running total' : trend.unit + ' revenue'}, ${P === 365 ? 'last 12 full months' : periodLabel} vs ${P === 365 ? 'last year' : 'previous period'} (incl. VAT)</p></div>
            <div class="legend"><span><i style="background:var(--series-1)"></i>This period</span><span><i style="background:var(--series-2)"></i>${P === 365 ? 'Last year' : 'Previous period'}</span></div>
          </div>
          <div class="card-body"><div class="chart" id="trendChart"></div></div>
        </div>
        <div class="card">
          <div class="card-head"><div><h3>Sales by category</h3><p>Share of revenue, ${periodLabel}</p></div></div>
          <div class="card-body">${categoryBars(cur)}</div>
        </div>
      </section>

      <section class="grid g-main mt">
        <div class="card">
          <div class="card-head"><div><h3>Recent orders</h3><p>Latest activity across all channels</p></div><button class="link-btn" data-go="orders">View all ${icon('arrow')}</button></div>
          <div class="card-body" style="padding:8px 6px 6px"><div class="table-wrap">${orderTable(S.orders.slice(0, 7), true)}</div></div>
        </div>
        <div class="card">
          <div class="card-head"><div><h3>Cut &amp; edge pipeline</h3><p>Live jobs on the factory floor</p></div><button class="link-btn" data-go="production">Open board ${icon('arrow')}</button></div>
          <div class="card-body">${pipeline(jobs)}</div>
        </div>
      </section>

      <section class="grid g-3 mt">
        <div class="card">
          <div class="card-head"><div><h3>Best sellers</h3><p>By revenue, ${periodLabel}</p></div></div>
          <div class="card-body">${topProducts(cur)}</div>
        </div>
        <div class="card">
          <div class="card-head"><div><h3>Stock alerts</h3><p>At or below reorder level</p></div><button class="link-btn" data-go="inventory?low">Inventory ${icon('arrow')}</button></div>
          <div class="card-body">${stockAlerts(low)}</div>
        </div>
        <div class="card">
          <div class="card-head"><div><h3>Busiest days</h3><p>Average orders per trading day</p></div></div>
          <div class="card-body"><div class="chart" id="dowChart"></div></div>
        </div>
      </section>`;

    $$('[data-period]', v).forEach(b => b.onclick = () => { ui.period = +b.dataset.period; saveUi(); rerender(); });
    Charts.line($('#trendChart', v), {
      labels: trend.labels, tipLabels: trend.tips, height: 290, aria: 'Revenue trend',
      series: [
        { name: 'This period', values: trend.cur, color: 'var(--series-1)', area: true },
        { name: P === 365 ? 'Last year' : 'Previous', values: trend.prev, color: 'var(--series-2)', weight: 2 },
      ],
      fmt: money, axisFmt: moneyC,
    });
    // Orders by weekday over the selected period (min 28 days for a stable average)
    const span = Math.max(P, 28);
    const dowOrders = ordersIn(span);
    const counts = [1, 2, 3, 4, 5, 6].map(d => dowOrders.filter(o => new Date(o.date).getDay() === d).length / (span / 7));
    Charts.columns($('#dowChart', v), { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], tipLabels: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], values: counts, color: 'var(--series-1)', name: 'Orders / day', fmt: v => v.toFixed(1), height: 214, aria: 'Average orders by weekday' });
  }

  function buildTrend(P) {
    const t0 = today0();
    const sumRange = (s, e) => S.orders.reduce((acc, o) => { const d = new Date(o.date); return d >= s && d < e && valid(o) ? acc + total(o) : acc; }, 0);
    const labels = [], tips = [], cur = [], prev = [];
    if (P <= 30) {
      // Trading days only (Leshaw is closed Sundays)
      for (let i = P - 1; i >= 0; i--) {
        const s = new Date(t0.getTime() - i * DAY);
        if (s.getDay() === 0) continue;
        const e = new Date(s.getTime() + DAY);
        labels.push(P === 7 ? WD[s.getDay()] : s.getDate() + ' ' + MONTHS[s.getMonth()]);
        tips.push(WD[s.getDay()] + ' ' + s.getDate() + ' ' + MONTHS[s.getMonth()]);
        cur.push(sumRange(s, e));
        const ps = new Date(s.getTime() - P * DAY);
        prev.push(sumRange(ps, new Date(ps.getTime() + DAY)));
      }
      // Running total reads far better than noisy daily values: "are we ahead of last period?"
      const cum = a => a.reduce((acc, v, i) => (acc.push(v + (i ? acc[i - 1] : 0)), acc), []);
      return { labels, tips, cur: cum(cur), prev: cum(prev), unit: 'Cumulative', cumulative: true };
    }
    if (P === 90) {
      for (let w = 12; w >= 0; w--) {
        const e = new Date(t0.getTime() + DAY - w * 7 * DAY), s = new Date(e.getTime() - 7 * DAY);
        labels.push(s.getDate() + ' ' + MONTHS[s.getMonth()]);
        tips.push('Week of ' + s.getDate() + ' ' + MONTHS[s.getMonth()]);
        cur.push(sumRange(s, e));
        prev.push(sumRange(new Date(s.getTime() - 91 * DAY), new Date(e.getTime() - 91 * DAY)));
      }
      return { labels, tips, cur, prev, unit: 'Weekly' };
    }
    // Last 12 complete months, so a half-finished month never looks like a slump
    for (let m = 12; m >= 1; m--) {
      const s = new Date(t0.getFullYear(), t0.getMonth() - m, 1);
      const e = new Date(t0.getFullYear(), t0.getMonth() - m + 1, 1);
      const ps = new Date(s.getFullYear() - 1, s.getMonth(), 1);
      const pe = new Date(e.getFullYear() - 1, e.getMonth(), 1);
      labels.push(MONTHS[s.getMonth()]);
      tips.push(MONTHS[s.getMonth()] + ' ' + s.getFullYear() + ' vs ' + ps.getFullYear());
      cur.push(sumRange(s, e));
      prev.push(sumRange(ps, pe));
    }
    return { labels, tips, cur, prev, unit: 'Monthly' };
  }

  function categoryBars(orders) {
    const by = {};
    L.CATEGORIES.forEach(c => by[c] = 0);
    by['Cut & edge services'] = 0;
    orders.forEach(o => {
      o.lines.forEach(l => { const p = prod(l.pid); if (p) by[p.category] += l.qty * l.price; });
      by['Cut & edge services'] += svcTotal(o);
    });
    const sum = Object.values(by).reduce((a, b) => a + b, 0) || 1;
    const rows = Object.entries(by).sort((a, b) => b[1] - a[1]);
    const max = rows[0][1] || 1;
    return `<div class="hbar">${rows.map(([k, val]) => `
      <div class="hbar-row" title="${esc(k)}: ${money(val)}">
        <span class="name">${esc(k)}</span>
        <span class="val">${moneyC(val)}<small>${(val / sum * 100).toFixed(0)}%</small></span>
        <div class="hbar-track"><div class="hbar-fill" style="width:${(val / max * 100).toFixed(1)}%"></div></div>
      </div>`).join('')}</div>`;
  }

  function pipeline(jobs) {
    const counts = L.STAGES.map(s => jobs.filter(j => j.stage === s).length);
    const max = Math.max(...counts, 1);
    const open = jobs.filter(j => j.stage !== 'Ready');
    const late = open.filter(j => new Date(j.due) < today0()).length;
    const next = open.slice().sort((a, b) => (b.priority - a.priority) || a.due.localeCompare(b.due)).slice(0, 3);
    return `<div class="pipe">${L.STAGES.map((s, i) => `
        <div class="pipe-row" data-go="production" title="${s}: ${counts[i]} jobs">
          <span class="lane-dot" style="background:${STAGE_COLOR[s]}"></span>
          <span class="pipe-name">${s}</span>
          <div class="pipe-track"><i style="width:${counts[i] / max * 100}%"></i></div>
          <b>${counts[i]}</b>
        </div>`).join('')}</div>
      <div class="pipe-meta">
        <span>Sheets <b>${num(open.reduce((s, j) => s + j.sheets, 0))}</b></span>
        <span>Edging <b>${num(open.reduce((s, j) => s + j.edgeM, 0))} m</b></span>
        <span>${late ? `<b style="color:var(--crit-ink)">${late} overdue</b>` : '<b style="color:var(--good-ink)">All on time</b>'}</span>
      </div>
      <div class="section-title" style="margin-top:18px">Next up</div>
      <div class="list">${next.map(j => { const p = prod(j.pid); const lateJ = new Date(j.due) < today0(); return `
        <div class="list-item" data-order="${j.oid}" style="cursor:pointer">
          ${thumb(p)}
          <div class="grow"><strong>${esc(cust(j.cid).name)}</strong><small>${esc(p.name)} · ${j.sheets} sheets · ${j.stage}</small></div>
          <div class="end">${j.priority ? '<span class="prio">Rush</span>' : ''}<small style="${lateJ ? 'color:var(--crit-ink);font-weight:600' : ''}">${lateJ ? 'Overdue' : -daysAgo(j.due) === 0 ? 'Due today' : 'Due ' + fmtDate(j.due)}</small></div>
        </div>`; }).join('') || '<div class="empty">Factory floor is clear</div>'}</div>`;
  }

  function topProducts(orders) {
    const by = {};
    orders.forEach(o => o.lines.forEach(l => { by[l.pid] = by[l.pid] || { rev: 0, qty: 0 }; by[l.pid].rev += l.qty * l.price; by[l.pid].qty += l.qty; }));
    const top = Object.entries(by).sort((a, b) => b[1].rev - a[1].rev).slice(0, 5);
    if (!top.length) return `<div class="empty">No sales in this period</div>`;
    return `<div class="list">${top.map(([id, d]) => { const p = prod(id); return `
      <div class="list-item" data-product="${id}" style="cursor:pointer">
        ${thumb(p)}
        <div class="grow"><strong>${esc(p.name)}</strong><small>${esc(p.range)} · ${num(d.qty)} ${p.unit}s</small></div>
        <div class="end"><b>${moneyC(d.rev)}</b></div>
      </div>`; }).join('')}</div>`;
  }

  function stockAlerts(low) {
    if (!low.length) return `<div class="empty">${icon('check')}All items above reorder level</div>`;
    return `<div class="list">${low.slice(0, 5).map(p => {
      const r = p.stock / p.reorder;
      const col = p.stock === 0 ? 'var(--crit)' : r < 0.5 ? 'var(--serious)' : 'var(--warn)';
      return `<div class="list-item" data-product="${p.id}" style="cursor:pointer">
        ${thumb(p)}
        <div class="grow"><strong>${esc(p.name)}</strong><small>${esc(p.category)} · reorder at ${p.reorder}</small></div>
        <div class="end"><b>${p.stock}</b> <small style="display:inline">${p.unit}s</small><div class="stockbar"><i style="width:${Math.min(100, r * 100)}%;background:${col}"></i></div></div>
      </div>`; }).join('')}</div>`;
  }

  function orderTable(rows, compact) {
    if (!rows.length) return `<div class="empty">${icon('search')}No orders match these filters</div>`;
    return `<table>
      <thead><tr><th>Order</th><th>Customer</th>${compact ? '' : '<th>Date</th><th>Items</th><th>Services</th><th>Channel</th>'}<th>Status</th><th class="r">Total</th></tr></thead>
      <tbody>${rows.map(o => { const c = cust(o.cid); return `
        <tr class="row-link" data-order="${o.id}">
          <td><span class="mono">${o.id}</span>${compact ? `<br><small class="muted">${relDate(o.date)}</small>` : ''}</td>
          <td><div class="cell-main"><span class="initials">${initials(c.name)}</span><div><strong>${esc(c.name)}</strong><small>${esc(c.type)}</small></div></div></td>
          ${compact ? '' : `<td>${relDate(o.date)}</td><td>${o.lines.reduce((s, l) => s + l.qty, 0)} <span class="muted">(${o.lines.length} lines)</span></td>
          <td>${o.services.length ? o.services.map(s => `<span class="tag">${s.key === 'cut' ? 'Cut' : 'Edge'}</span>`).join(' ') : '<span class="muted">-</span>'}</td><td>${o.channel}</td>`}
          <td>${pill(o.status)}</td>
          <td class="r"><b>${money(total(o))}</b></td>
        </tr>`; }).join('')}</tbody></table>`;
  }

  /* ================================================================== ORDERS */
  function viewOrders(v) {
    const statuses = ['All', ...L.ORDER_STATUSES];
    const counts = Object.fromEntries(statuses.map(s => [s, s === 'All' ? S.orders.length : S.orders.filter(o => o.status === s).length]));
    v.innerHTML = `
      <section class="card stat-strip">${(() => {
        const t = ordersIn(1), w = ordersIn(7);
        const awaiting = S.orders.filter(o => o.status === 'Awaiting payment');
        return `
        <div><small>Today</small><strong>${money(t.reduce((s, o) => s + total(o), 0))}</strong><div class="sub">${t.length} orders</div></div>
        <div><small>Last 7 days</small><strong>${money(w.reduce((s, o) => s + total(o), 0))}</strong><div class="sub">${w.length} orders</div></div>
        <div><small>Awaiting payment</small><strong>${money(awaiting.reduce((s, o) => s + total(o), 0))}</strong><div class="sub">${awaiting.length} orders</div></div>
        <div><small>Ready for collection</small><strong>${S.orders.filter(o => o.status === 'Ready for collection').length}</strong><div class="sub">customers to notify</div></div>`; })()}
      </section>
      <div class="toolbar">
        <div class="chips">${statuses.map(s => `<button class="chip ${ui.orderFilter === s ? 'on' : ''}" data-f="${s}">${s}<span class="count">${num(counts[s])}</span></button>`).join('')}</div>
      </div>
      <div class="toolbar" style="margin-top:-4px">
        <label class="input">${icon('search')}<input id="oq" placeholder="Search order no. or customer…" value="${esc(ui.orderQ)}" /></label>
        <span style="margin-left:auto"></span>
        <button class="btn" id="exportCsv">${icon('download')}Export CSV</button>
      </div>
      <section class="card"><div class="table-wrap" id="otable"></div><div id="opager"></div></section>`;

    const draw = () => {
      const q = ui.orderQ.trim().toLowerCase();
      let rows = S.orders.filter(o => (ui.orderFilter === 'All' || o.status === ui.orderFilter) && (!q || o.id.toLowerCase().includes(q) || cust(o.cid).name.toLowerCase().includes(q)));
      const [k, dir] = ui.orderSort;
      rows = rows.slice().sort((a, b) => dir * (k === 'total' ? total(a) - total(b) : a.date.localeCompare(b.date)));
      const per = 15, pages = Math.max(1, Math.ceil(rows.length / per));
      ui.orderPage = Math.min(ui.orderPage, pages - 1);
      const page = rows.slice(ui.orderPage * per, ui.orderPage * per + per);
      $('#otable', v).innerHTML = orderTable(page, false);
      // sortable headers
      const ths = $$('#otable th', v);
      [['Date', 'date'], ['Total', 'total']].forEach(([lbl, key]) => {
        const th = ths.find(t => t.textContent === lbl);
        if (!th) return;
        th.classList.add('sortable');
        th.innerHTML = lbl + (ui.orderSort[0] === key ? `<span class="arrow">${ui.orderSort[1] < 0 ? ' ↓' : ' ↑'}</span>` : '');
        th.onclick = () => { ui.orderSort = [key, ui.orderSort[0] === key ? -ui.orderSort[1] : -1]; draw(); };
      });
      $('#opager', v).innerHTML = rows.length ? `<div class="toolbar" style="margin:0;padding:12px 16px;border-top:1px solid var(--border)">
        <span class="muted" style="margin-right:auto">Showing ${num(ui.orderPage * per + 1)}–${num(Math.min(rows.length, ui.orderPage * per + per))} of ${num(rows.length)}</span>
        <button class="btn btn-sm" id="pprev" ${ui.orderPage === 0 ? 'disabled' : ''}>${icon('left')}Prev</button>
        <button class="btn btn-sm" id="pnext" ${ui.orderPage >= pages - 1 ? 'disabled' : ''}>Next${icon('right')}</button></div>` : '';
      $('#pprev', v) && ($('#pprev', v).onclick = () => { ui.orderPage--; draw(); });
      $('#pnext', v) && ($('#pnext', v).onclick = () => { ui.orderPage++; draw(); });
      v._rows = rows;
    };
    draw();
    $$('[data-f]', v).forEach(b => b.onclick = () => { ui.orderFilter = b.dataset.f; ui.orderPage = 0; $$('[data-f]', v).forEach(x => x.classList.toggle('on', x === b)); draw(); });
    $('#oq', v).oninput = e => { ui.orderQ = e.target.value; ui.orderPage = 0; draw(); };
    $('#exportCsv', v).onclick = () => {
      csv([['Order', 'Date', 'Customer', 'Type', 'Channel', 'Status', 'Items', 'Services (R)', 'Total (R)', 'VAT (R)'],
        ...v._rows.map(o => { const c = cust(o.cid); return [o.id, new Date(o.date).toISOString().slice(0, 10), c.name, c.type, o.channel, o.status, o.lines.reduce((s, l) => s + l.qty, 0), svcTotal(o), Math.round(total(o)), Math.round(vatOf(total(o)))]; })],
        'leshaw-orders.csv');
      toast(`Exported ${num(v._rows.length)} orders to CSV`);
    };
  }

  function orderDrawer(id) {
    const o = S.orders.find(x => x.id === id);
    if (!o) return;
    const c = cust(o.cid);
    const f = flow(o);
    const idx = f.indexOf(o.status);
    const nxt = nextStatus(o);
    const job = S.jobs.find(j => j.oid === o.id);
    const t = total(o);
    openDrawer(`
      <div class="drawer-head">
        <div><h2 id="drawerTitle">${o.id}</h2><p>${relDate(o.date)} · ${o.channel} · ${o.delivery}</p></div>
        <button class="icon-btn" data-close aria-label="Close">${icon('x')}</button>
      </div>
      <div class="drawer-body">
        ${o.status === 'Cancelled' ? `<div>${pill('Cancelled')}</div>` : `<div class="stepper">${f.map((s, i) => `<div class="st ${i < idx ? 'done' : i === idx ? 'now' : ''}"><b>${i < idx ? icon('check') : i + 1}</b>${s.replace(' for collection', '')}</div>`).join('')}</div>`}
        <div>
          <div class="section-title">Customer</div>
          <div class="list-item" style="padding:0;border:0;cursor:pointer" data-customer="${c.id}">
            <span class="initials" style="width:40px;height:40px">${initials(c.name)}</span>
            <div class="grow"><strong>${esc(c.name)}</strong><small>${esc(c.contact)} · ${esc(c.phone)}</small></div>
            ${c.account ? '<span class="tag">Trade account</span>' : '<span class="tag">Cash</span>'}
          </div>
        </div>
        ${job ? `<div class="card card-pad" style="box-shadow:none;background:var(--surface-2)">
          <div style="display:flex;align-items:center;gap:10px"><span class="kpi-ico red">${icon('saw')}</span><div style="flex:1"><b>Cut &amp; edge job ${job.id}</b><div class="muted" style="font-size:12.5px">${job.sheets} sheets · ${job.panels} panels · ${job.edgeM} m edging · ${job.machine}</div></div><span class="pill ${job.stage === 'Ready' ? 'good' : 'prod'}">${job.stage}</span></div></div>` : ''}
        <div>
          <div class="section-title">Items</div>
          <div class="lines">
            ${o.lines.map(l => { const p = prod(l.pid); return `<div class="line">${thumb(p)}<div class="grow"><strong>${esc(p.name)}</strong><small>${esc(p.range)} · ${esc(p.spec)}</small></div><div class="end tabular" style="text-align:right"><b>${money(l.qty * l.price)}</b><br><small class="muted">${l.qty} × ${money(l.price)}</small></div></div>`; }).join('')}
            ${o.services.map(s => `<div class="line"><span class="kpi-ico" style="width:36px;height:36px">${icon(s.key === 'cut' ? 'saw' : 'ruler')}</span><div class="grow"><strong>${L.SERVICES[s.key].label}</strong><small>${s.qty} ${L.SERVICES[s.key].unit}s × ${money(s.price)}</small></div><b class="tabular">${money(s.qty * s.price)}</b></div>`).join('')}
          </div>
        </div>
        <div class="totals">
          <div><span class="muted">Subtotal (excl. VAT)</span><span>${money(t - vatOf(t))}</span></div>
          <div><span class="muted">VAT 15%</span><span>${money(vatOf(t))}</span></div>
          <div class="grand"><span>Total</span><span>${money(t)}</span></div>
        </div>
      </div>
      <div class="drawer-foot">
        ${!['Completed', 'Cancelled'].includes(o.status) ? `<button class="btn btn-ghost" id="cancelOrder">Cancel order</button>` : ''}
        <button class="btn" id="emailInv">${icon('mail')}Email invoice</button>
        ${nxt ? `<button class="btn btn-primary" id="advance">${icon('check')}Mark as ${nxt.toLowerCase()}</button>` : ''}
      </div>`);
    const d = $('#drawer');
    $('#advance', d) && ($('#advance', d).onclick = () => { setStatus(o, nxt); toast(`${o.id} marked as ${nxt.toLowerCase()}`); orderDrawer(id); rerender(); });
    $('#cancelOrder', d) && ($('#cancelOrder', d).onclick = () => { if (confirm(`Cancel order ${o.id}?`)) { setStatus(o, 'Cancelled'); toast(`${o.id} cancelled`); orderDrawer(id); rerender(); } });
    $('#emailInv', d).onclick = () => toast(`Invoice for ${o.id} prepared for ${esc(c.email)}`);
  }

  /* ================================================================== QUOTES */
  function viewQuotes(v) {
    const statuses = ['All', 'Draft', 'Sent', 'Accepted', 'Declined', 'Expired'];
    const open = S.quotes.filter(q => q.status === 'Sent' || q.status === 'Draft');
    const decided = S.quotes.filter(q => ['Accepted', 'Declined', 'Expired'].includes(q.status));
    const win = decided.length ? S.quotes.filter(q => q.status === 'Accepted').length / decided.length * 100 : 0;
    const expiring = S.quotes.filter(q => q.status === 'Sent' && (new Date(q.valid) - today0()) / DAY <= 3);
    v.innerHTML = `
      <section class="card stat-strip">
        <div><small>Open pipeline</small><strong>${money(open.reduce((s, q) => s + total(q), 0))}</strong><div class="sub">${open.length} draft &amp; sent quotes</div></div>
        <div><small>Win rate</small><strong>${win.toFixed(0)}%</strong><div class="util"><i style="width:${win}%"></i></div></div>
        <div><small>Avg. quote value</small><strong>${money(S.quotes.reduce((s, q) => s + total(q), 0) / (S.quotes.length || 1))}</strong><div class="sub">across ${S.quotes.length} quotes</div></div>
        <div><small>Expiring in 3 days</small><strong style="color:${expiring.length ? 'var(--warn-ink)' : 'inherit'}">${expiring.length}</strong><div class="sub">follow up to close</div></div>
      </section>
      <div class="toolbar">
        <div class="chips">${statuses.map(s => `<button class="chip ${ui.quoteFilter === s ? 'on' : ''}" data-f="${s}">${s}<span class="count">${s === 'All' ? S.quotes.length : S.quotes.filter(q => q.status === s).length}</span></button>`).join('')}</div>
        <span style="margin-left:auto"></span>
        <button class="btn btn-primary" data-newquote>${icon('plus')}New quote</button>
      </div>
      <section class="card"><div class="table-wrap">${quoteTable(S.quotes.filter(q => ui.quoteFilter === 'All' || q.status === ui.quoteFilter))}</div></section>`;
    $$('[data-f]', v).forEach(b => b.onclick = () => { ui.quoteFilter = b.dataset.f; rerender(); });
  }
  function quoteTable(rows) {
    if (!rows.length) return `<div class="empty">${icon('file')}No quotes here yet</div>`;
    return `<table><thead><tr><th>Quote</th><th>Customer</th><th>Project</th><th>Created</th><th>Valid until</th><th>Status</th><th class="r">Value</th></tr></thead><tbody>
      ${rows.map(q => { const c = cust(q.cid); const left = Math.ceil((new Date(q.valid) - today0()) / DAY); return `
      <tr class="row-link" data-quote="${q.id}">
        <td><span class="mono">${q.id}</span></td>
        <td><div class="cell-main"><span class="initials">${initials(c.name)}</span><div><strong>${esc(c.name)}</strong><small>${esc(c.contact)}</small></div></div></td>
        <td>${esc(q.project)}</td>
        <td>${fmtDate(q.date)}</td>
        <td>${fmtDate(q.valid)}${q.status === 'Sent' ? `<br><small class="${left <= 3 ? '' : 'muted'}" style="${left <= 3 ? 'color:var(--warn-ink);font-weight:600' : ''}">${left < 0 ? 'expired' : left === 0 ? 'expires today' : left + ' days left'}</small>` : ''}</td>
        <td>${pill(q.status, Q_CLS)}</td>
        <td class="r"><b>${money(total(q))}</b></td>
      </tr>`; }).join('')}</tbody></table>`;
  }

  function quoteDrawer(id) {
    const q = S.quotes.find(x => x.id === id);
    if (!q) return;
    const c = cust(q.cid);
    const t = total(q);
    openDrawer(`
      <div class="drawer-head">
        <div><h2 id="drawerTitle">${q.id}</h2><p>${esc(q.project)} · created ${fmtDate(q.date)} · valid until ${fmtDate(q.valid)}</p></div>
        <button class="icon-btn" data-close aria-label="Close">${icon('x')}</button>
      </div>
      <div class="drawer-body">
        <div style="display:flex;align-items:center;gap:10px">${pill(q.status, Q_CLS)}${q.orderId ? `<button class="link-btn" data-order="${q.orderId}">Converted to ${q.orderId} ${icon('arrow')}</button>` : ''}</div>
        <div class="list-item" style="padding:0;border:0;cursor:pointer" data-customer="${c.id}">
          <span class="initials" style="width:40px;height:40px">${initials(c.name)}</span>
          <div class="grow"><strong>${esc(c.name)}</strong><small>${esc(c.contact)} · ${esc(c.email)}</small></div>
        </div>
        <div><div class="section-title">Quoted items</div><div class="lines">
          ${q.lines.map(l => { const p = prod(l.pid); return `<div class="line">${thumb(p)}<div class="grow"><strong>${esc(p.name)}</strong><small>${esc(p.range)} · ${esc(p.spec)}</small></div><div style="text-align:right" class="tabular"><b>${money(l.qty * l.price)}</b><br><small class="muted">${l.qty} × ${money(l.price)}</small></div></div>`; }).join('')}
          ${q.services.map(s => `<div class="line"><span class="kpi-ico" style="width:36px;height:36px">${icon(s.key === 'cut' ? 'saw' : 'ruler')}</span><div class="grow"><strong>${L.SERVICES[s.key].label}</strong><small>${s.qty} ${L.SERVICES[s.key].unit}s × ${money(s.price)}</small></div><b class="tabular">${money(s.qty * s.price)}</b></div>`).join('')}
        </div></div>
        ${q.notes ? `<div><div class="section-title">Notes</div><p style="margin:0" class="ink2">${esc(q.notes)}</p></div>` : ''}
        <div class="totals">
          <div><span class="muted">Subtotal (excl. VAT)</span><span>${money(t - vatOf(t))}</span></div>
          <div><span class="muted">VAT 15%</span><span>${money(vatOf(t))}</span></div>
          <div class="grand"><span>Quote total</span><span>${money(t)}</span></div>
        </div>
      </div>
      <div class="drawer-foot">
        ${['Draft', 'Sent'].includes(q.status) ? `<button class="btn btn-ghost" id="qDecline">Mark declined</button>` : ''}
        ${q.status === 'Draft' ? `<button class="btn" id="qSend">${icon('send')}Send to customer</button>` : ''}
        ${q.status === 'Sent' ? `<button class="btn" id="qResend">${icon('send')}Resend</button>` : ''}
        ${['Draft', 'Sent'].includes(q.status) ? `<button class="btn btn-primary" id="qAccept">${icon('check')}Accept &amp; create order</button>` : ''}
        ${q.status === 'Expired' ? `<button class="btn btn-primary" id="qRenew">${icon('refresh')}Renew for 14 days</button>` : ''}
      </div>`);
    const d = $('#drawer');
    const on = (sel, fn) => { const b = $(sel, d); if (b) b.onclick = fn; };
    on('#qSend', () => { q.status = 'Sent'; save(); toast(`${q.id} sent to ${esc(c.email)}`); quoteDrawer(id); rerender(); });
    on('#qResend', () => toast(`${q.id} resent to ${esc(c.email)}`));
    on('#qDecline', () => { q.status = 'Declined'; save(); quoteDrawer(id); rerender(); });
    on('#qRenew', () => { q.status = 'Sent'; q.valid = new Date(Date.now() + 14 * DAY).toISOString(); save(); toast(`${q.id} renewed until ${fmtDate(q.valid)}`); quoteDrawer(id); rerender(); });
    on('#qAccept', () => {
      const o = { id: 'LSW-' + (Math.max(...S.orders.map(x => +x.id.slice(4))) + 1), cid: q.cid, date: new Date().toISOString(), lines: q.lines.map(l => ({ ...l })), services: q.services.map(s => ({ ...s })), status: 'Awaiting payment', channel: 'Email', delivery: 'Collection' };
      S.orders.unshift(o);
      q.status = 'Accepted'; q.orderId = o.id;
      save();
      toast(`${q.id} accepted, order ${o.id} created`);
      orderDrawer(o.id);
      rerender();
    });
  }

  /* Quote builder */
  function quoteBuilder(prefillCid) {
    const draft = { cid: prefillCid || '', project: '', lines: [], cut: true, edge: true, cutQty: null, edgeQty: null, notes: '' };
    const sheets = () => draft.lines.reduce((s, l) => { const p = prod(l.pid); return s + (isBoard(p) && p.category !== 'Counter Tops' ? l.qty : 0); }, 0);
    const services = () => {
      const sh = sheets(); const out = [];
      if (draft.cut && sh) out.push({ key: 'cut', qty: draft.cutQty ?? sh, price: L.SERVICES.cut.price });
      if (draft.edge && sh) out.push({ key: 'edge', qty: draft.edgeQty ?? sh * 18, price: L.SERVICES.edge.price });
      return out;
    };
    openModal(`
      <div class="drawer-head">
        <div><h2>New quote</h2><p>Pick boards and hardware, add cutting &amp; edging, and totals update live.</p></div>
        <button class="icon-btn" data-close aria-label="Close">${icon('x')}</button>
      </div>
      <div class="drawer-body">
        <div class="form-grid">
          <div class="field"><label for="qCust">Customer</label>
            <select id="qCust"><option value="">Select a customer…</option>${S.customers.map(c => `<option value="${c.id}" ${c.id === draft.cid ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
          <div class="field"><label for="qProj">Project</label><input id="qProj" placeholder="e.g. Kitchen renovation, 12 units" /></div>
        </div>
        <div class="field picker">
          <label for="qSearch">Add products</label>
          <label class="input" style="min-width:0">${icon('search')}<input id="qSearch" placeholder="Search boards, tops, edging, hardware…" autocomplete="off" /></label>
          <div class="picker-list" id="qPick" hidden></div>
        </div>
        <div class="lines" id="qLines"></div>
        <div class="svc" id="qSvc"></div>
        <div class="field"><label for="qNotes">Notes for customer</label><textarea id="qNotes" rows="2" placeholder="Cutting list attached, delivery to site…"></textarea></div>
        <div class="totals" id="qTotals"></div>
      </div>
      <div class="drawer-foot">
        <button class="btn btn-ghost" data-close>Cancel</button>
        <button class="btn" id="qDraft">Save draft</button>
        <button class="btn btn-primary" id="qSave">${icon('send')}Save &amp; send</button>
      </div>`);
    const m = $('#modal');
    const linesEl = $('#qLines', m), pickEl = $('#qPick', m), searchEl = $('#qSearch', m);

    const drawLines = () => {
      linesEl.innerHTML = draft.lines.length ? draft.lines.map((l, i) => { const p = prod(l.pid); return `
        <div class="qline">${thumb(p)}<div style="min-width:0"><strong style="font-size:13px">${esc(p.name)}</strong><br><small class="muted">${esc(p.range)} · ${money(p.price)} / ${p.unit}</small></div>
        <input type="number" min="1" value="${l.qty}" data-qty="${i}" aria-label="Quantity" /><span class="amt">${money(l.qty * l.price)}</span>
        <button class="icon-btn" style="width:32px;height:32px" data-rm="${i}" aria-label="Remove">${icon('trash')}</button></div>`; }).join('')
        : `<div class="empty" style="padding:24px">${icon('layers')}Search above to add boards and hardware</div>`;
      $$('[data-qty]', linesEl).forEach(inp => inp.oninput = () => { draft.lines[+inp.dataset.qty].qty = Math.max(1, +inp.value || 1); draft.cutQty = draft.edgeQty = null; drawTotals(); inp.closest('.qline').querySelector('.amt').textContent = money(draft.lines[+inp.dataset.qty].qty * draft.lines[+inp.dataset.qty].price); drawSvc(); });
      $$('[data-rm]', linesEl).forEach(b => b.onclick = () => { draft.lines.splice(+b.dataset.rm, 1); draft.cutQty = draft.edgeQty = null; drawLines(); });
      drawSvc(); drawTotals();
    };
    const drawSvc = () => {
      const sh = sheets();
      const el = $('#qSvc', m);
      if (!sh) { el.innerHTML = ''; return; }
      const sv = services();
      const q = k => (sv.find(s => s.key === k) || {}).qty ?? (k === 'cut' ? sh : sh * 18);
      el.innerHTML = `
        <label><input type="checkbox" id="svCut" ${draft.cut ? 'checked' : ''} /><span class="svc-text"><b>Precision cutting</b><small>${money(L.SERVICES.cut.price)} per sheet</small></span><input type="number" id="svCutQ" value="${q('cut')}" min="0" aria-label="Sheets to cut" /></label>
        <label><input type="checkbox" id="svEdge" ${draft.edge ? 'checked' : ''} /><span class="svc-text"><b>Edge banding</b><small>${money(L.SERVICES.edge.price)} per metre</small></span><input type="number" id="svEdgeQ" value="${q('edge')}" min="0" aria-label="Metres of edging" /></label>`;
      $('#svCut', m).onchange = e => { draft.cut = e.target.checked; drawTotals(); };
      $('#svEdge', m).onchange = e => { draft.edge = e.target.checked; drawTotals(); };
      $('#svCutQ', m).oninput = e => { draft.cutQty = Math.max(0, +e.target.value || 0); drawTotals(); };
      $('#svEdgeQ', m).oninput = e => { draft.edgeQty = Math.max(0, +e.target.value || 0); drawTotals(); };
    };
    const drawTotals = () => {
      const t = draft.lines.reduce((s, l) => s + l.qty * l.price, 0) + services().reduce((s, x) => s + x.qty * x.price, 0);
      $('#qTotals', m).innerHTML = `
        <div><span class="muted">Materials</span><span>${money(draft.lines.reduce((s, l) => s + l.qty * l.price, 0))}</span></div>
        <div><span class="muted">Cutting &amp; edging</span><span>${money(services().reduce((s, x) => s + x.qty * x.price, 0))}</span></div>
        <div><span class="muted">VAT 15% (included)</span><span>${money(vatOf(t))}</span></div>
        <div class="grand"><span>Quote total</span><span>${money(t)}</span></div>`;
    };
    let hl = 0, results = [];
    const drawPick = () => {
      const q = searchEl.value.trim().toLowerCase();
      results = S.products.filter(p => !q || (p.name + ' ' + p.range + ' ' + p.category + ' ' + p.id).toLowerCase().includes(q)).slice(0, 8);
      hl = Math.min(hl, Math.max(0, results.length - 1));
      pickEl.hidden = !results.length;
      pickEl.innerHTML = results.map((p, i) => `<div class="picker-item ${i === hl ? 'hl' : ''}" data-add="${p.id}">${thumb(p)}<div class="grow"><b>${esc(p.name)}</b><small>${esc(p.range)} · ${esc(p.spec)} · ${p.stock} in stock</small></div><b class="tabular">${money(p.price)}</b></div>`).join('');
      $$('[data-add]', pickEl).forEach(it => it.onmousedown = e => { e.preventDefault(); add(it.dataset.add); });
    };
    const add = pid => {
      const ex = draft.lines.find(l => l.pid === pid);
      const p = prod(pid);
      if (ex) ex.qty += 1; else draft.lines.push({ pid, qty: isBoard(p) && p.category !== 'Counter Tops' ? 4 : 1, price: p.price });
      draft.cutQty = draft.edgeQty = null;
      searchEl.value = ''; pickEl.hidden = true; drawLines();
    };
    searchEl.onfocus = drawPick;
    searchEl.oninput = () => { hl = 0; drawPick(); };
    searchEl.onblur = () => setTimeout(() => pickEl.hidden = true, 120);
    searchEl.onkeydown = e => {
      if (e.key === 'ArrowDown') { hl = Math.min(results.length - 1, hl + 1); drawPick(); e.preventDefault(); }
      if (e.key === 'ArrowUp') { hl = Math.max(0, hl - 1); drawPick(); e.preventDefault(); }
      if (e.key === 'Enter' && results[hl]) { add(results[hl].id); e.preventDefault(); }
    };
    const commit = status => {
      const cid = $('#qCust', m).value;
      if (!cid) { $('#qCust', m).focus(); $('#qCust', m).style.borderColor = 'var(--crit)'; return; }
      if (!draft.lines.length) { searchEl.focus(); return; }
      const now = new Date();
      const q = {
        id: 'Q-' + (Math.max(...S.quotes.map(x => +x.id.slice(2)), 3300) + 1), cid, date: now.toISOString(),
        valid: new Date(now.getTime() + 14 * DAY).toISOString(), lines: draft.lines.map(l => ({ ...l })), services: services(), status,
        project: $('#qProj', m).value.trim() || 'Custom project', notes: $('#qNotes', m).value.trim(),
      };
      S.quotes.unshift(q);
      save();
      closeModal();
      toast(status === 'Sent' ? `${q.id} sent to ${esc(cust(cid).email)}` : `${q.id} saved as draft`);
      if (location.hash !== '#/quotes') location.hash = '#/quotes'; else rerender();
      setTimeout(() => quoteDrawer(q.id), 60);
    };
    $('#qDraft', m).onclick = () => commit('Draft');
    $('#qSave', m).onclick = () => commit('Sent');
    drawLines();
    setTimeout(() => (prefillCid ? searchEl : $('#qCust', m)).focus(), 50);
  }

  /* ================================================================== PRODUCTION */
  function viewProduction(v) {
    const jobs = activeJobs();
    const open = jobs.filter(j => j.stage !== 'Ready');
    const cutting = jobs.filter(j => j.stage === 'Cutting').reduce((s, j) => s + j.sheets, 0);
    const util = Math.min(100, Math.round(cutting / 60 * 100));
    const late = open.filter(j => new Date(j.due) < today0()).length;
    const filters = ['All', 'Priority', 'Due today', 'Overdue'];
    const match = j => ui.prodFilter === 'All' || (ui.prodFilter === 'Priority' && j.priority) || (ui.prodFilter === 'Due today' && daysAgo(j.due) === 0) || (ui.prodFilter === 'Overdue' && j.stage !== 'Ready' && new Date(j.due) < today0());
    v.innerHTML = `
      <section class="card stat-strip">
        <div><small>Jobs in progress</small><strong>${open.length}</strong><div class="sub">${jobs.filter(j => j.stage === 'Ready').length} ready for collection</div></div>
        <div><small>Sheets to cut</small><strong>${num(open.reduce((s, j) => s + j.sheets, 0))}</strong><div class="sub">${num(open.reduce((s, j) => s + j.panels, 0))} panels</div></div>
        <div><small>Edging to apply</small><strong>${num(open.reduce((s, j) => s + j.edgeM, 0))} m</strong><div class="sub">on the edge bander</div></div>
        <div><small>Panel saw load</small><strong>${util}%</strong><div class="util"><i style="width:${util}%;background:${util > 85 ? 'var(--serious)' : 'var(--series-1)'}"></i></div></div>
      </section>
      <div class="toolbar">
        <div class="chips">${filters.map(f => `<button class="chip ${ui.prodFilter === f ? 'on' : ''}" data-f="${f}">${f}${f === 'Overdue' && late ? `<span class="count">${late}</span>` : ''}</button>`).join('')}</div>
        <span class="muted" style="margin-left:auto;font-size:12.5px">Drag cards between columns, or use <b>Next</b> to advance</span>
      </div>
      <section class="kanban">${L.STAGES.map(s => {
        const list = jobs.filter(j => j.stage === s && match(j)).sort((a, b) => (b.priority - a.priority) || a.due.localeCompare(b.due));
        return `<div class="lane" data-lane="${s}">
          <div class="lane-head"><span class="lane-dot" style="background:${STAGE_COLOR[s]}"></span><h4>${s}</h4><span class="count">${list.length}</span></div>
          <div class="lane-body">${list.map(jobCard).join('') || `<div class="empty" style="padding:24px 8px;font-size:12.5px">No jobs</div>`}</div>
        </div>`; }).join('')}</section>`;

    $$('[data-f]', v).forEach(b => b.onclick = () => { ui.prodFilter = b.dataset.f; rerender(); });
    // Drag & drop
    $$('.job', v).forEach(card => {
      card.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', card.dataset.job); e.dataTransfer.effectAllowed = 'move'; card.classList.add('dragging'); });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
    });
    $$('.lane', v).forEach(lane => {
      lane.addEventListener('dragover', e => { e.preventDefault(); lane.classList.add('drop'); });
      lane.addEventListener('dragleave', e => { if (!lane.contains(e.relatedTarget)) lane.classList.remove('drop'); });
      lane.addEventListener('drop', e => {
        e.preventDefault(); lane.classList.remove('drop');
        const job = S.jobs.find(j => j.id === e.dataTransfer.getData('text/plain'));
        if (job && job.stage !== lane.dataset.lane) { setStage(job, lane.dataset.lane); toast(`${job.id} moved to ${lane.dataset.lane.toLowerCase()}`); rerender(); }
      });
    });
    $$('[data-next]', v).forEach(b => b.onclick = e => {
      e.stopPropagation();
      const job = S.jobs.find(j => j.id === b.dataset.next);
      const i = L.STAGES.indexOf(job.stage);
      if (job.stage === 'Ready') {
        const o = S.orders.find(x => x.id === job.oid);
        setStatus(o, 'Completed'); toast(`${o.id} collected, job closed`);
      } else { setStage(job, L.STAGES[i + 1]); toast(`${job.id} moved to ${L.STAGES[i + 1].toLowerCase()}`); }
      rerender();
    });
  }
  function jobCard(j) {
    const c = cust(j.cid), p = prod(j.pid);
    const late = j.stage !== 'Ready' && new Date(j.due) < today0();
    const dd = -daysAgo(j.due);
    const dueTxt = late ? 'Overdue ' + fmtDate(j.due) : dd === 0 ? 'Due today' : dd === 1 ? 'Due tomorrow' : 'Due ' + fmtDate(j.due);
    return `<article class="job" draggable="true" data-job="${j.id}" data-order="${j.oid}" tabindex="0">
      <div class="job-top"><img class="job-swatch" src="${p.img}" alt="" /><div style="min-width:0;flex:1"><div class="job-title">${esc(c.name)}</div><div class="job-sub">${j.oid} · ${esc(p.name)}</div></div>${j.priority ? `<span class="prio">Rush</span>` : ''}</div>
      <div class="job-stats"><span>${icon('square')}${j.sheets} sheets</span><span>${icon('layers')}${j.panels} panels</span>${j.edgeM ? `<span>${icon('ruler')}${j.edgeM} m</span>` : ''}</div>
      <div class="job-foot"><span class="due ${late ? 'late' : ''}">${icon('clock')}${dueTxt}</span><button class="mini-btn" data-next="${j.id}">${j.stage === 'Ready' ? 'Collected' : 'Next'}${icon('right')}</button></div>
    </article>`;
  }

  /* ================================================================== INVENTORY */
  function viewInventory(v) {
    if (location.hash.includes('?low')) { ui.invLow = true; history.replaceState(null, '', '#/inventory'); }
    const cats = ['All', ...L.CATEGORIES];
    const value = S.products.reduce((s, p) => s + p.cost * p.stock, 0);
    const sold30 = {};
    ordersIn(30).forEach(o => o.lines.forEach(l => sold30[l.pid] = (sold30[l.pid] || 0) + l.qty));
    v._sold = sold30;
    v.innerHTML = `
      <section class="card stat-strip">
        <div><small>Stock value (at cost)</small><strong>${moneyC(value)}</strong><div class="sub">${S.products.length} active SKUs</div></div>
        <div><small>Boards on hand</small><strong>${num(S.products.filter(isBoard).reduce((s, p) => s + p.stock, 0))}</strong><div class="sub">sheets &amp; tops</div></div>
        <div><small>Below reorder level</small><strong style="color:var(--warn-ink)">${lowStock().length}</strong><div class="sub">items to reorder</div></div>
        <div><small>Units sold (30 days)</small><strong>${num(Object.values(sold30).reduce((a, b) => a + b, 0))}</strong><div class="sub">across all categories</div></div>
      </section>
      <div class="toolbar">
        <div class="chips">${cats.map(c => `<button class="chip ${ui.invCat === c ? 'on' : ''}" data-cat="${c}">${c}<span class="count">${c === 'All' ? S.products.length : S.products.filter(p => p.category === c).length}</span></button>`).join('')}</div>
      </div>
      <div class="toolbar" style="margin-top:-4px">
        <label class="input">${icon('search')}<input id="iq" placeholder="Search products…" value="${esc(ui.invQ)}" /></label>
        <button class="chip ${ui.invLow ? 'on' : ''}" id="lowToggle">${icon('alert')}Low stock only</button>
        <span style="margin-left:auto"></span>
        <label class="input" style="min-width:0"><span class="muted" style="white-space:nowrap">Sort</span><select id="isort">
          ${[['popular', 'Best sellers'], ['name', 'Name A–Z'], ['stock', 'Stock (low first)'], ['price', 'Price (high first)']].map(([k, l]) => `<option value="${k}" ${ui.invSort === k ? 'selected' : ''}>${l}</option>`).join('')}
        </select></label>
      </div>
      <section class="products" id="pgrid"></section>`;
    const draw = () => {
      const q = ui.invQ.trim().toLowerCase();
      let list = S.products.filter(p => (ui.invCat === 'All' || p.category === ui.invCat) && (!ui.invLow || p.stock <= p.reorder) && (!q || (p.name + ' ' + p.range + ' ' + p.id + ' ' + p.category).toLowerCase().includes(q)));
      const sorters = { popular: (a, b) => (sold30[b.id] || 0) * b.price - (sold30[a.id] || 0) * a.price, name: (a, b) => a.name.localeCompare(b.name), stock: (a, b) => a.stock / a.reorder - b.stock / b.reorder, price: (a, b) => b.price - a.price };
      list.sort(sorters[ui.invSort]);
      $('#pgrid', v).innerHTML = list.length ? list.map(p => productCard(p, sold30[p.id] || 0)).join('') : `<div class="card empty" style="grid-column:1/-1">${icon('search')}No products match</div>`;
    };
    draw();
    $$('[data-cat]', v).forEach(b => b.onclick = () => { ui.invCat = b.dataset.cat; $$('[data-cat]', v).forEach(x => x.classList.toggle('on', x === b)); draw(); });
    $('#iq', v).oninput = e => { ui.invQ = e.target.value; draw(); };
    $('#lowToggle', v).onclick = e => { ui.invLow = !ui.invLow; e.currentTarget.classList.toggle('on', ui.invLow); draw(); };
    $('#isort', v).onchange = e => { ui.invSort = e.target.value; saveUi(); draw(); };
  }
  function stockState(p) {
    if (p.stock === 0) return ['crit', 'Out of stock'];
    if (p.stock <= p.reorder * 0.5) return ['serious', 'Critical'];
    if (p.stock <= p.reorder) return ['warn', 'Reorder'];
    return ['good', 'In stock'];
  }
  function productCard(p, sold) {
    const [cls, lbl] = stockState(p);
    const col = { crit: 'var(--crit)', serious: 'var(--serious)', warn: 'var(--warn)', good: 'var(--good)' }[cls];
    return `<article class="card product" data-product="${p.id}" tabindex="0">
      <div class="product-img"><img src="${p.img}" alt="${esc(p.name)}" loading="lazy" />${cls !== 'good' ? `<span class="pill ${cls}">${lbl}</span>` : ''}<span class="tag">${esc(p.range)}</span></div>
      <div class="product-body">
        <h4>${esc(p.name)}</h4>
        <span class="spec">${esc(p.spec)}</span>
        <div class="product-row">
          <span class="price">${money(p.price)}<small> / ${p.unit}</small></span>
          <span class="stock-meter"><b>${num(p.stock)}</b> in stock<div class="stockbar"><i style="width:${Math.min(100, p.stock / (p.reorder * 2.5) * 100)}%;background:${col}"></i></div></span>
        </div>
      </div>
    </article>`;
  }
  function productModal(id) {
    const p = prod(id);
    if (!p) return;
    const [cls, lbl] = stockState(p);
    // Monthly units, last 6 months
    const t0 = today0(); const labels = [], tips = [], vals = [];
    for (let m = 5; m >= 0; m--) {
      const s = new Date(t0.getFullYear(), t0.getMonth() - m, 1), e = new Date(t0.getFullYear(), t0.getMonth() - m + 1, 1);
      labels.push(MONTHS[s.getMonth()]); tips.push(MONTHS[s.getMonth()] + ' ' + s.getFullYear() + (m === 0 ? ' (to date)' : ''));
      vals.push(S.orders.reduce((acc, o) => { const d = new Date(o.date); return d >= s && d < e && valid(o) ? acc + o.lines.filter(l => l.pid === id).reduce((a, l) => a + l.qty, 0) : acc; }, 0));
    }
    const margin = (1 - p.cost / p.price) * 100;
    openModal(`
      <div class="drawer-head">
        <div><h2>${esc(p.name)}</h2><p>${esc(p.range)} · ${esc(p.category)} · <span class="mono">${p.id}</span></p></div>
        <button class="icon-btn" data-close aria-label="Close">${icon('x')}</button>
      </div>
      <div class="drawer-body">
        <div class="grid g-2" style="gap:20px">
          <img src="${p.img}" alt="${esc(p.name)}" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:12px;border:1px solid var(--border)" />
          <div style="display:flex;flex-direction:column;gap:14px">
            <div>${pill(lbl, { [lbl]: cls })}</div>
            <div class="kv">
              <div><small>Size / spec</small><b>${esc(p.spec)}</b></div>
              <div><small>Selling price</small><b>${money(p.price)} / ${p.unit}</b></div>
              <div><small>On hand</small><b id="pmStock">${num(p.stock)} ${p.unit}s</b></div>
              <div><small>Reorder level</small><b>${p.reorder}</b></div>
              <div><small>Gross margin</small><b>${margin.toFixed(0)}%</b></div>
              <div><small>Stock value</small><b id="pmVal">${money(p.stock * p.cost)}</b></div>
            </div>
            <div class="field"><label for="recvQty">Receive stock</label>
              <div style="display:flex;gap:8px"><input id="recvQty" type="number" min="1" value="${Math.max(p.reorder * 2 - p.stock, p.reorder)}" style="flex:1" /><button class="btn btn-navy" id="recvBtn">${icon('box')}Receive</button></div>
            </div>
          </div>
        </div>
        <div><div class="section-title">Units sold · last 6 months</div><div class="chart" id="pmChart"></div></div>
      </div>
      <div class="drawer-foot">
        <button class="btn" data-close>Close</button>
        <button class="btn btn-primary" id="pmQuote">${icon('file')}Add to new quote</button>
      </div>`);
    const m = $('#modal');
    Charts.columns($('#pmChart', m), { labels, tipLabels: tips, values: vals, color: 'var(--series-1)', name: 'Units sold', fmt: v => num(v), height: 170 });
    $('#recvBtn', m).onclick = () => {
      const n = Math.max(1, +$('#recvQty', m).value || 0);
      p.stock += n; save();
      toast(`Received ${n} × ${esc(p.name)}, ${num(p.stock)} now on hand`);
      productModal(id);
      rerender();
    };
    $('#pmQuote', m).onclick = () => { closeModal(); quoteBuilder(); setTimeout(() => { const s = $('#qSearch'); s.value = p.name; s.dispatchEvent(new Event('input')); }, 80); };
  }

  /* ================================================================== CUSTOMERS */
  function custStats() {
    const st = {};
    S.customers.forEach(c => st[c.id] = { orders: 0, ltv: 0, last: null, y: 0 });
    const yr = window_(365)[0];
    S.orders.forEach(o => {
      if (!valid(o)) return;
      const s = st[o.cid]; s.orders++; const t = total(o); s.ltv += t;
      if (new Date(o.date) >= yr) s.y += t;
      if (!s.last || o.date > s.last) s.last = o.date;
    });
    return st;
  }
  function viewCustomers(v) {
    const st = custStats();
    const active = S.customers.filter(c => st[c.id].last && daysAgo(st[c.id].last) <= 90).length;
    const trade = S.customers.filter(c => c.type !== 'Retail / DIY');
    const top = trade.slice().sort((a, b) => st[b.id].y - st[a.id].y)[0];
    v.innerHTML = `
      <section class="card stat-strip">
        <div><small>Active customers (90 days)</small><strong>${active}</strong><div class="sub">of ${S.customers.length} on file</div></div>
        <div><small>Trade accounts</small><strong>${S.customers.filter(c => c.account).length}</strong><div class="sub">on 30-day terms</div></div>
        <div><small>Top customer (12 months)</small><strong style="font-size:17px">${esc(top.name)}</strong><div class="sub">${money(st[top.id].y)}</div></div>
        <div><small>Trade share of sales</small><strong>${(trade.reduce((s, c) => s + st[c.id].y, 0) / S.customers.reduce((s, c) => s + st[c.id].y, 0) * 100).toFixed(0)}%</strong><div class="sub">last 12 months</div></div>
      </section>
      <div class="toolbar">
        <label class="input">${icon('search')}<input id="cq" placeholder="Search customers, contacts, areas…" value="${esc(ui.custQ)}" /></label>
      </div>
      <section class="card"><div class="table-wrap" id="ctable"></div></section>`;
    const draw = () => {
      const q = ui.custQ.trim().toLowerCase();
      const [k, dir] = ui.custSort;
      const list = S.customers.filter(c => !q || (c.name + c.contact + c.area + c.type).toLowerCase().includes(q))
        .sort((a, b) => dir * (k === 'name' ? a.name.localeCompare(b.name) : k === 'orders' ? st[a.id].orders - st[b.id].orders : k === 'last' ? (st[a.id].last || '').localeCompare(st[b.id].last || '') : st[a.id].y - st[b.id].y));
      const head = (lbl, key, r) => `<th class="sortable ${r ? 'r' : ''}" data-sort="${key}">${lbl}${k === key ? `<span class="arrow">${dir < 0 ? ' ↓' : ' ↑'}</span>` : ''}</th>`;
      $('#ctable', v).innerHTML = `<table><thead><tr>${head('Customer', 'name')}<th>Type</th><th>Area</th>${head('Orders', 'orders', 1)}${head('Sales (12m)', 'ltv', 1)}${head('Last order', 'last')}<th>Terms</th></tr></thead><tbody>
        ${list.map(c => `<tr class="row-link" data-customer="${c.id}">
          <td><div class="cell-main"><span class="initials">${initials(c.name)}</span><div><strong>${esc(c.name)}</strong><small>${esc(c.contact)}</small></div></div></td>
          <td>${esc(c.type)}</td><td>${esc(c.area)}</td>
          <td class="r">${num(st[c.id].orders)}</td><td class="r"><b>${money(st[c.id].y)}</b></td>
          <td>${st[c.id].last ? relDate(st[c.id].last) : '-'}</td>
          <td>${c.account ? '<span class="tag">30-day account</span>' : '<span class="muted">Cash / EFT</span>'}</td>
        </tr>`).join('')}</tbody></table>`;
      $$('[data-sort]', v).forEach(th => th.onclick = () => { const key = th.dataset.sort; ui.custSort = [key, ui.custSort[0] === key ? -ui.custSort[1] : (key === 'name' ? 1 : -1)]; draw(); });
    };
    draw();
    $('#cq', v).oninput = e => { ui.custQ = e.target.value; draw(); };
  }
  function customerDrawer(id) {
    const c = cust(id);
    if (!c) return;
    const st = custStats()[id];
    const orders = S.orders.filter(o => o.cid === id);
    const quotes = S.quotes.filter(q => q.cid === id && ['Draft', 'Sent'].includes(q.status));
    const t0 = today0(); const labels = [], tips = [], vals = [];
    for (let m = 11; m >= 0; m--) {
      const s = new Date(t0.getFullYear(), t0.getMonth() - m, 1), e = new Date(t0.getFullYear(), t0.getMonth() - m + 1, 1);
      labels.push(MONTHS[s.getMonth()].slice(0, 1)); tips.push(MONTHS[s.getMonth()] + ' ' + s.getFullYear());
      vals.push(orders.reduce((a, o) => { const d = new Date(o.date); return d >= s && d < e && valid(o) ? a + total(o) : a; }, 0));
    }
    openDrawer(`
      <div class="drawer-head">
        <span class="initials" style="width:48px;height:48px;font-size:16px">${initials(c.name)}</span>
        <div><h2 id="drawerTitle">${esc(c.name)}</h2><p>${esc(c.type)} · ${esc(c.area)} · customer since ${fmtDate(orders[orders.length - 1]?.date || new Date().toISOString(), true)}</p></div>
        <button class="icon-btn" data-close aria-label="Close">${icon('x')}</button>
      </div>
      <div class="drawer-body">
        <div class="kv">
          <div><small>Contact</small><b>${esc(c.contact)}</b></div>
          <div><small>Terms</small><b>${c.account ? '30-day trade account' : 'Cash / EFT'}</b></div>
          <div><small>Phone</small><b>${esc(c.phone)}</b></div>
          <div><small>Email</small><b style="word-break:break-all">${esc(c.email)}</b></div>
        </div>
        <div class="grid g-3 keep" style="gap:10px">
          <div class="card card-pad" style="box-shadow:none;padding:14px"><small class="muted">Sales (12m)</small><div class="kpi-value" style="font-size:19px">${moneyC(st.y)}</div></div>
          <div class="card card-pad" style="box-shadow:none;padding:14px"><small class="muted">Orders</small><div class="kpi-value" style="font-size:19px">${num(st.orders)}</div></div>
          <div class="card card-pad" style="box-shadow:none;padding:14px"><small class="muted">Avg. order</small><div class="kpi-value" style="font-size:19px">${moneyC(st.orders ? st.ltv / st.orders : 0)}</div></div>
        </div>
        <div><div class="section-title">Monthly spend</div><div class="chart" id="cChart"></div></div>
        ${quotes.length ? `<div><div class="section-title">Open quotes</div><div class="lines">${quotes.map(q => `<div class="line" data-quote="${q.id}" style="cursor:pointer"><span class="mono">${q.id}</span><div class="grow"><strong>${esc(q.project)}</strong><small>valid until ${fmtDate(q.valid)}</small></div>${pill(q.status, Q_CLS)}<b class="tabular">${money(total(q))}</b></div>`).join('')}</div></div>` : ''}
        <div><div class="section-title">Recent orders</div><div class="lines">${orders.slice(0, 6).map(o => `<div class="line" data-order="${o.id}" style="cursor:pointer"><span class="mono">${o.id}</span><div class="grow"><small>${relDate(o.date)}</small></div>${pill(o.status)}<b class="tabular">${money(total(o))}</b></div>`).join('') || '<div class="empty">No orders yet</div>'}</div></div>
      </div>
      <div class="drawer-foot">
        <button class="btn" id="cCall">${icon('phone')}Call</button>
        <button class="btn btn-primary" id="cQuote">${icon('file')}New quote for ${esc(c.name.split(' ')[0])}</button>
      </div>`);
    const d = $('#drawer');
    Charts.columns($('#cChart', d), { labels, tipLabels: tips, values: vals, color: 'var(--series-1)', name: 'Spend', fmt: moneyC, height: 160 });
    $('#cCall', d).onclick = () => toast(`Calling ${esc(c.contact)} on ${esc(c.phone)}…`);
    $('#cQuote', d).onclick = () => { closeDrawer(); quoteBuilder(id); };
  }

  /* ================================================================== Overlays */
  let lastFocus;
  function openDrawer(html) {
    const w = $('#drawer');
    if (w.hidden) lastFocus = document.activeElement;
    $('.drawer', w).innerHTML = html;
    w.hidden = false;
    document.body.style.overflow = 'hidden';
    $('.drawer [data-close]', w)?.focus();
  }
  function closeDrawer() { $('#drawer').hidden = true; if ($('#modal').hidden) document.body.style.overflow = ''; lastFocus?.focus?.(); }
  function openModal(html) {
    const w = $('#modal');
    if (w.hidden) lastFocus = document.activeElement;
    $('.modal', w).innerHTML = html;
    w.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeModal() { $('#modal').hidden = true; Charts.hideTip(); if ($('#drawer').hidden) document.body.style.overflow = ''; }

  /* ================================================================== Notifications */
  function notifications() {
    const out = [];
    const low = lowStock();
    if (low.length) out.push({ id: 'low-' + low.length, ico: 'alert', cls: 'warn', title: `${low.length} items below reorder level`, sub: low.slice(0, 3).map(p => p.name).join(', ') + (low.length > 3 ? '…' : ''), go: '#/inventory?low' });
    const late = activeJobs().filter(j => j.stage !== 'Ready' && new Date(j.due) < today0());
    if (late.length) out.push({ id: 'late-' + late.length, ico: 'clock', cls: 'red', title: `${late.length} cut & edge jobs overdue`, sub: late.slice(0, 2).map(j => cust(j.cid).name).join(', '), go: '#/production' });
    const exp = S.quotes.filter(q => q.status === 'Sent' && (new Date(q.valid) - today0()) / DAY <= 3);
    if (exp.length) out.push({ id: 'exp-' + exp.length, ico: 'file', cls: '', title: `${exp.length} quotes expiring soon`, sub: `${money(exp.reduce((s, q) => s + total(q), 0))} at stake, follow up`, go: '#/quotes' });
    const ready = S.orders.filter(o => o.status === 'Ready for collection');
    if (ready.length) out.push({ id: 'ready-' + ready.length, ico: 'truck', cls: '', title: `${ready.length} orders ready for collection`, sub: 'Let customers know their boards are cut', go: '#/orders', filter: 'Ready for collection' });
    const unpaid = S.orders.filter(o => o.status === 'Awaiting payment' && daysAgo(o.date) >= 2);
    if (unpaid.length) out.push({ id: 'unpaid-' + unpaid.length, ico: 'cash', cls: 'warn', title: `${unpaid.length} orders unpaid after 2 days`, sub: money(unpaid.reduce((s, o) => s + total(o), 0)) + ' outstanding', go: '#/orders', filter: 'Awaiting payment' });
    return out;
  }
  function toggleNotifs(force) {
    const pop = $('#notifPop');
    const show = force ?? pop.hidden;
    if (!show) { pop.hidden = true; return; }
    const list = notifications();
    pop.innerHTML = `<div class="popover-head"><h4>Notifications</h4><button class="link-btn" id="markRead">Mark all read</button></div>
      ${list.map((n, i) => `<div class="notif" data-n="${i}"><span class="kpi-ico ${n.cls}">${icon(n.ico)}</span><div><strong>${esc(n.title)}</strong><small>${esc(n.sub)}</small></div></div>`).join('') || '<div class="empty">You’re all caught up</div>'}`;
    pop.hidden = false;
    $$('[data-n]', pop).forEach(el => el.onclick = () => {
      const n = list[+el.dataset.n];
      if (n.filter) ui.orderFilter = n.filter;
      pop.hidden = true;
      if (location.hash === n.go) rerender(); else location.hash = n.go;
    });
    $('#markRead', pop).onclick = () => { S.readNotifs = list.map(n => n.id); save(); updateBadges(); pop.hidden = true; };
  }

  /* ================================================================== Command palette */
  let palItems = [], palHl = 0;
  function openPalette() {
    $('#palette').hidden = false;
    const inp = $('#paletteInput');
    inp.value = '';
    drawPalette('');
    setTimeout(() => inp.focus(), 10);
  }
  function closePalette() { $('#palette').hidden = true; }
  function drawPalette(q) {
    q = q.trim().toLowerCase();
    const groups = [];
    const pages = Object.entries(ROUTES).filter(([k, r]) => !q || r.title.toLowerCase().includes(q)).map(([k, r]) => ({ ico: 'arrow', title: r.title, sub: r.sub(), run: () => location.hash = '#/' + k }));
    pages.unshift(...(!q || 'new quote'.includes(q) ? [{ ico: 'plus', title: 'Create new quote', sub: 'Open the quote builder', run: () => quoteBuilder() }] : []));
    groups.push(['Actions & pages', pages.slice(0, q ? 6 : 7)]);
    if (q) {
      groups.push(['Orders', S.orders.filter(o => o.id.toLowerCase().includes(q) || cust(o.cid).name.toLowerCase().includes(q)).slice(0, 5).map(o => ({ ico: 'receipt', title: o.id + ' · ' + cust(o.cid).name, sub: relDate(o.date) + ' · ' + o.status + ' · ' + money(total(o)), run: () => orderDrawer(o.id) }))]);
      groups.push(['Customers', S.customers.filter(c => (c.name + c.contact + c.area).toLowerCase().includes(q)).slice(0, 4).map(c => ({ ico: 'users', title: c.name, sub: c.contact + ' · ' + c.area, run: () => customerDrawer(c.id) }))]);
      groups.push(['Products', S.products.filter(p => (p.name + p.range + p.id + p.category).toLowerCase().includes(q)).slice(0, 5).map(p => ({ ico: 'layers', title: p.name + ' · ' + p.range, sub: p.spec + ' · ' + p.stock + ' in stock · ' + money(p.price), run: () => productModal(p.id) }))]);
      groups.push(['Quotes', S.quotes.filter(x => (x.id + cust(x.cid).name + x.project).toLowerCase().includes(q)).slice(0, 4).map(x => ({ ico: 'file', title: x.id + ' · ' + cust(x.cid).name, sub: x.project + ' · ' + x.status + ' · ' + money(total(x)), run: () => quoteDrawer(x.id) }))]);
    }
    palItems = groups.flatMap(g => g[1]);
    palHl = 0;
    let i = 0;
    $('#paletteResults').innerHTML = groups.filter(g => g[1].length).map(([name, items]) => `<div class="pr-group">${name}</div>` + items.map(it => `<div class="pr-item ${i === 0 ? 'hl' : ''}" data-pi="${i++}">${icon(it.ico)}<div class="grow"><b>${esc(it.title)}</b><small>${esc(it.sub)}</small></div></div>`).join('')).join('') || `<div class="empty">No results for “${esc(q)}”</div>`;
    $$('[data-pi]', $('#paletteResults')).forEach(el => {
      el.onmousemove = () => setPalHl(+el.dataset.pi);
      el.onclick = () => runPal(+el.dataset.pi);
    });
  }
  function setPalHl(i) { palHl = i; $$('.pr-item').forEach(e => e.classList.toggle('hl', +e.dataset.pi === i)); $(`[data-pi="${i}"]`)?.scrollIntoView({ block: 'nearest' }); }
  function runPal(i) { const it = palItems[i]; if (!it) return; closePalette(); it.run(); }

  /* ================================================================== Theme */
  function effectiveDark() {
    const t = document.documentElement.dataset.theme;
    return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function syncThemeIcon() { $('#themeBtn').innerHTML = icon(effectiveDark() ? 'sun' : 'moon'); }

  /* ================================================================== Global events */
  function closeSidebar() { $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('show'); }
  document.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('[data-close]')) {
      if (t.closest('#drawer')) closeDrawer();
      else if (t.closest('#modal')) closeModal();
      else if (t.closest('#palette')) closePalette();
      return;
    }
    const go = t.closest('[data-go]');
    if (go) { location.hash = '#/' + go.dataset.go; return; }
    if (t.closest('[data-next]')) return;
    const ord = t.closest('[data-order]'); if (ord) { orderDrawer(ord.dataset.order); return; }
    const cu = t.closest('[data-customer]'); if (cu) { customerDrawer(cu.dataset.customer); return; }
    const qu = t.closest('[data-quote]'); if (qu) { quoteDrawer(qu.dataset.quote); return; }
    const pr = t.closest('[data-product]'); if (pr) { productModal(pr.dataset.product); return; }
    if (t.closest('[data-newquote]')) { quoteBuilder(); return; }
    if (!t.closest('.pop-wrap')) $('#notifPop').hidden = true;
  });
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#palette').hidden ? openPalette() : closePalette(); return; }
    if (e.key === 'Escape') {
      if (!$('#palette').hidden) return closePalette();
      if (!$('#modal').hidden) return closeModal();
      if (!$('#drawer').hidden) return closeDrawer();
      $('#notifPop').hidden = true; closeSidebar();
    }
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); openPalette(); }
    if (e.key === 'Enter' && document.activeElement.matches('.job, .product')) document.activeElement.click();
    if (!$('#palette').hidden) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setPalHl(Math.min(palItems.length - 1, palHl + 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setPalHl(Math.max(0, palHl - 1)); }
      if (e.key === 'Enter') { e.preventDefault(); runPal(palHl); }
    }
  });
  $('#paletteInput').addEventListener('input', e => drawPalette(e.target.value));
  $('#searchBtn').onclick = openPalette;
  $('#newQuoteBtn').onclick = () => quoteBuilder();
  $('#bellBtn').onclick = e => { e.stopPropagation(); toggleNotifs(); };
  $('#menuBtn').onclick = () => { $('#sidebar').classList.add('open'); $('#scrim').classList.add('show'); };
  $('#scrim').onclick = closeSidebar;
  $('#themeBtn').onclick = () => {
    const next = effectiveDark() ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('leshaw-theme', next); } catch (e) {}
    syncThemeIcon();
    rerender();
  };
  $('#resetDemo').onclick = () => {
    if (!confirm('Reset all demo data to its original state?')) return;
    try { localStorage.removeItem(STORE); } catch (e) {}
    S = L.generate(); reindex(); save();
    toast('Demo data reset');
    rerender();
  };
  window.addEventListener('hashchange', () => {
    if (!$('#drawer').hidden) closeDrawer();
    if (!$('#modal').hidden) closeModal();
    route(); window.scrollTo(0, 0);
  });
  window.addEventListener('scroll', () => $('.topbar').classList.toggle('scrolled', window.scrollY > 4), { passive: true });
  if (navigator.platform && !/Mac|iPhone|iPad/.test(navigator.platform)) $('.search-trigger kbd').textContent = 'Ctrl K';

  hydrateIcons();
  syncThemeIcon();
  save();
  route();
})();
