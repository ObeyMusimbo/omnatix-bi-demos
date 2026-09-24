/*
  Meridian Provisions, Margin & Revenue Intelligence.

  The page is a narrative, not a grid of widgets. It opens on a number nobody in the room
  can explain, bridges the gap, then takes each driver in turn. Every chart carries a table
  twin so no value is only reachable through a tooltip.
*/

import { connect, q, meta } from './db.js';
import {
  waterfall, columns, barsH, lines, legend, table, figure, wireTableToggles,
  fmtR, fmtRc, fmtR2, fmtNum, fmtPct, fmtMonth,
} from './charts.js';

const el = (id) => document.getElementById(id);
const v = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const signed = (n, dp = 1) =>
  n === null || n === undefined || Number.isNaN(n) ? '-' : (n >= 0 ? '+' : '') + n.toFixed(dp) + '%';

// ---------------------------------------------------------------- theme

const toggle = el('theme-toggle');
const stored = (() => { try { return localStorage.getItem('ledger-theme'); } catch { return null; } })();
const initial = stored || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.documentElement.setAttribute('data-theme', initial);
toggle.textContent = initial === 'dark' ? 'Light' : 'Dark';
toggle.addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  toggle.textContent = next === 'dark' ? 'Light' : 'Dark';
  try { localStorage.setItem('ledger-theme', next); } catch { /* private mode */ }
});

// ---------------------------------------------------------------- freshness

const DAY_MS = 86400000;
const asDate = (iso) => new Date(iso.length === 10 ? iso + 'T00:00:00Z' : iso);
const longDate = (iso) => asDate(iso).toLocaleDateString('en-ZA',
  { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * State how current the page is, measured against the reader's clock rather than a value
 * baked in at build time, so it stays honest as the page sits open or gets bookmarked.
 *
 * Two separate facts, because they fail separately. Data latency is how old the newest
 * transaction is: if that grows, the source feed has stopped arriving. Pipeline age is when
 * this site was last rebuilt: if that grows while the data is fine, the refresh job is broken.
 */
async function renderFreshness() {
  const m = await meta();
  const today = new Date();

  const daysBehind = Math.max(0, Math.floor((today - asDate(m.data_through)) / DAY_MS));
  const buildAge = Math.max(0, Math.floor((today - asDate(m.built_at)) / DAY_MS));

  // A demo covers a closed, synthetic period, so its newest row never moves and a days-behind
  // count would only measure how long ago the demo was made: it went red within a fortnight of
  // launch and read as a broken pipeline. What is live is the nightly rebuild, so on a fixed
  // period the badge tracks that and names the period plainly. Live client data carries no
  // fixed_period flag and gets the days-behind alarm below.
  if (m.fixed_period) {
    const box = el('freshness');
    box.classList.remove('is-current', 'is-lagging', 'is-stale');
    box.classList.add(buildAge <= 2 ? 'is-current' : buildAge <= 14 ? 'is-lagging' : 'is-stale');
    box.title = `Demonstration data for a fixed period, ${longDate(m.data_from)} to `
      + `${longDate(m.data_through)}. The badge tracks the nightly rebuild. On live data it `
      + `counts the days since the newest transaction.`;
    el('fresh-label').textContent = buildAge === 0 ? 'Rebuilt today'
      : buildAge === 1 ? 'Rebuilt yesterday' : `Rebuilt ${plural(buildAge, 'day')} ago`;
    el('data-through').textContent = `Demo period to ${longDate(m.data_through)}`;
    el('last-run').textContent = 'Fixed data, rebuilt and tested nightly';
    return m;
  }

  const state = daysBehind <= 2 ? 'is-current' : daysBehind <= 14 ? 'is-lagging' : 'is-stale';
  const label = daysBehind === 0 ? 'Up to date'
    : daysBehind <= 2 ? `Current, ${plural(daysBehind, 'day')} behind`
    : `${plural(daysBehind, 'day')} behind`;

  const box = el('freshness');
  box.classList.remove('is-current', 'is-lagging', 'is-stale');
  box.classList.add(state);
  box.title = `Newest transaction ${longDate(m.data_through)}. `
    + `Pipeline last run ${longDate(m.built_at)}.`;
  el('fresh-label').textContent = label;

  el('data-through').textContent = `Data to ${longDate(m.data_through)}`;
  el('last-run').textContent = buildAge === 0
    ? 'Pipeline run today'
    : `Pipeline run ${longDate(m.built_at)}`;

  return m;
}

// ---------------------------------------------------------------- render

async function render() {
  const [bridge, monthly, brands, cascadeSteps, promoWeekly, discount, stock, dead] = await Promise.all([
    q(`select * from mart_gp_bridge order by step_order`),
    q(`select month_start_date, year_month,
              sum(revenue_zar) as revenue_zar,
              sum(gross_profit_zar) as gross_profit_zar,
              sum(gross_profit_zar) / nullif(sum(revenue_zar),0) * 100 as margin_pct
       from agg_sales_monthly group by 1, 2 order by 1`),
    q(`select brand,
              any_value(revenue_zar) as revenue_zar,
              any_value(gross_profit_zar) as gross_profit_zar,
              any_value(allocated_freight_zar) as freight_zar,
              any_value(allocated_rebate_zar) as rebate_zar,
              any_value(contribution_zar) as contribution_zar,
              any_value(brand_gross_margin_pct) as gm_pct,
              any_value(brand_contribution_margin_pct) as cm_pct,
              any_value(revenue_per_kg_zar) as rev_per_kg,
              any_value(is_margin_trap) as is_trap
       from mart_margin_waterfall where period_order = 1
       group by brand order by any_value(contribution_zar)`),
    q(`select step_order, step_label, step_type, step_value_zar, running_total_zar
       from mart_margin_waterfall
       where brand = 'Cascade Springs' and period_order = 1 order by step_order`),
    q(`select week_start_date, promo_phase, units, gross_profit_zar, gp_per_unit_zar,
              volume_index_vs_baseline_pct
       from mart_promo_performance where product_name like 'Brightwash Powder 2kg%'
       order by week_start_date`),
    q(`select month_start_date, year_month, realised_discount_pct,
              channel_excl_group_realised_discount_pct as channel_pct,
              revenue_zar, revenue_forgone_vs_baseline_zar
       from mart_discount_trend where customer_group = 'Summit Cash & Carry'
       order by month_start_date`),
    q(`select product_name, count(*) as weeks, sum(lost_units_est) as units,
              sum(lost_revenue_zar) as revenue_zar, sum(lost_gross_profit_zar) as gp_zar,
              max(stockout_week_pct) as week_pct
       from mart_stockout_impact group by 1 order by 4 desc`),
    q(`select product_name, warehouse_name, units_on_hand, unit_cost_zar,
              dead_stock_value_zar, days_since_last_sale, dead_stock_reason
       from mart_dead_stock where is_dead_stock
       order by dead_stock_value_zar desc`),
  ]);

  const h = bridge[0];
  const revGrowth = (h.ttm_revenue_zar / h.prior_revenue_zar - 1) * 100;
  const gpGrowth = (h.ttm_gross_profit_zar / h.prior_gross_profit_zar - 1) * 100;

  // The masthead carries the period now, written by renderFreshness from meta.json.

  el('main').innerHTML =
    sectionGap(h, revGrowth, gpGrowth, bridge) +
    sectionWater(cascadeSteps, brands) +
    sectionPromo(promoWeekly, promoDetail(promoWeekly)) +
    sectionDiscount(discount, bridge) +
    sectionStock(stock) +
    sectionDead(dead);

  drawGap(bridge, monthly);
  drawWater(cascadeSteps);
  drawPromo(promoWeekly);
  drawDiscount(discount);
  drawStock(stock);

  wireTableToggles();
}

function promoDetail(rows) {
  const by = {};
  for (const r of rows) {
    const p = (by[r.promo_phase] ||= { promo_phase: r.promo_phase, units: 0, gp: 0, n: 0, vi: 0 });
    p.units += r.units; p.gp += r.gross_profit_zar; p.vi += r.volume_index_vs_baseline_pct || 0; p.n++;
  }
  return Object.values(by).map((p) => ({
    promo_phase: p.promo_phase, units: p.units, gross_profit_zar: p.gp,
    gp_per_unit: p.units ? p.gp / p.units : 0, vol_index: p.n ? p.vi / p.n : 0,
  })).sort((a, b) => order(a.promo_phase) - order(b.promo_phase));
}
const order = (p) => (p === 'Baseline' ? 0 : p === 'On promotion' ? 1 : 2);
const phaseColor = (p) => (p === 'Baseline' ? v('--neutral') : p === 'On promotion' ? v('--s1') : v('--s3'));

// ---------------------------------------------------------------- sections

const head = (num, title, lede) => `
  <div class="section-head">
    <div class="section-num">${num}</div>
    <h2>${title}</h2>
  </div>
  <p class="lede">${lede}</p>`;

function sectionGap(h, revGrowth, gpGrowth, bridge) {
  const tiles = [
    ['Revenue', fmtRc(h.ttm_revenue_zar), `${signed(revGrowth)} on last year`, revGrowth >= 0 ? 'up' : 'down'],
    ['Gross profit', fmtRc(h.ttm_gross_profit_zar), `${signed(gpGrowth)} on last year`, gpGrowth >= 0 ? 'up' : 'down'],
    ['Gross margin', fmtPct(h.ttm_margin_pct), `${signed(h.ttm_margin_pct - h.prior_margin_pct).replace('%','')} pts vs ${fmtPct(h.prior_margin_pct)} last year`, 'down'],
  ].map(([l, val, d, dir]) => `
    <div class="tile">
      <div class="tile-label">${l}</div>
      <div class="tile-value">${val}</div>
      <div class="tile-delta"><span class="${dir}">${d}</span></div>
    </div>`).join('');

  // Computed from the bridge rather than typed. The note used to say four drivers accounted for
  // the gap and each had its own section; the residual has no section, and once every step was
  // put on the same twelve months it became the largest of the four.
  const named = bridge.filter((r) => r.step_type === 'decrease' && r.finding_ref);
  const namedShare = named.reduce((a, r) => a + r.pct_of_gap, 0);
  const namedCount = ['No', 'One', 'Two', 'Three', 'Four', 'Five'][named.length] ?? named.length;

  const bridgeTable = table(
    [
      { key: 'driver', label: 'Driver' },
      { key: 'effect_zar', label: 'Gross profit effect', align: 'right', fmt: fmtR,
        cls: (x, r) => (r.step_type === 'decrease' ? 'neg' : '') },
      { key: 'pct_of_gap', label: 'Share of gap', align: 'right',
        fmt: (x, r) => (r.step_type === 'decrease' ? fmtPct(x) : '') },
      { key: 'finding_ref', label: 'Finding', fmt: (x) => (x ? `See ${x}` : '') },
    ],
    bridge, { caption: 'Gross profit bridge, trailing twelve months against last year’s margin rate' }
  );

  return `<section id="gap">
    ${head('00', 'The gap', `Revenue grew <b>${signed(revGrowth)}</b>. Gross profit grew <b>${signed(gpGrowth)}</b>.
      Had margin simply held at last year’s rate, gross profit would have been
      <b>${fmtRc(bridge[0].effect_zar)}</b>. It did not.`)}
    <div class="hero">
      <div class="hero-value">${fmtRc(bridge[0].total_gap_zar)}</div>
      <div class="hero-label">of gross profit did not arrive, despite the revenue that should have carried it</div>
    </div>
    <div class="tiles">${tiles}</div>
    ${figure({
      id: 'c-bridge', title: 'Where the gross profit went',
      note: `${namedCount} named drivers account for ${fmtPct(namedShare, 0)} of the gap, and each is examined in the sections that follow. The rest is discount drift and mix spread across the wider book. Every step covers the same twelve months as the gap. Bars run from last year’s margin rate applied to this year’s revenue, down to what was actually earned. The vertical axis is truncated so the steps stay legible, the two dark bars continue below the plot.`,
      tableHtml: bridgeTable,
    })}
    ${figure({
      id: 'c-margin', title: 'Gross margin by month',
      note: 'The erosion is gradual and never shows up as a bad month, which is exactly why it went unnoticed.',
      tableHtml: table([
        { key: 'year_month', label: 'Month' },
        { key: 'revenue_zar', label: 'Revenue', align: 'right', fmt: fmtR },
        { key: 'gross_profit_zar', label: 'Gross profit', align: 'right', fmt: fmtR },
        { key: 'margin_pct', label: 'Margin', align: 'right', fmt: (x) => fmtPct(x) },
      ], [], { caption: 'Monthly trading' }),
    })}
  </section>`;
}

function sectionWater(steps, allBrands) {
  // The 140 order lines quoting SKUs absent from the product master roll up as a synthetic
  // "Unknown brand" with no cost, so a 100% gross margin. That is a data-quality signal, not
  // a commercial one, it belongs in the note below the table, not ranked among real brands.
  const orphan = allBrands.find((b) => b.brand === 'Unknown brand');
  const brands = allBrands.filter((b) => b.brand !== 'Unknown brand');
  const traps = brands.filter((b) => b.is_trap);
  return `<section id="water">
    ${head('01', 'The range that is sold at a loss', `Cascade Springs bottled water carries a
      <b>${fmtPct(steps.length ? brands.find((b) => b.brand === 'Cascade Springs').gm_pct : 0)}</b>
      gross margin, which looks unremarkable on a product report. It is heavy, cheap, and moves
      through wholesale accounts that earn a volume rebate. Allocate the freight by weight and
      the rebate by revenue, and the range turns negative.`)}
    ${figure({
      id: 'c-water', title: 'Cascade Springs, from gross profit to contribution',
      note: 'Freight is allocated to each line by its share of the order’s total weight; rebate by its share of the order’s revenue. Those two rules are the whole trick, and they are why this is invisible in the current reporting, the costs sit at order level in the finance export and never reach a product report.',
      tableHtml: table([
        { key: 'step_label', label: 'Step' },
        { key: 'step_value_zar', label: 'Amount', align: 'right', fmt: fmtR,
          cls: (x) => (x < 0 ? 'neg' : '') },
        { key: 'running_total_zar', label: 'Running total', align: 'right', fmt: fmtR,
          cls: (x) => (x < 0 ? 'neg' : '') },
      ], steps, { caption: 'Trailing twelve months' }),
    })}
    <h3 class="figure-title" style="margin-top:2.5rem">Every brand, ranked by contribution</h3>
    <p class="figure-note">A margin trap is a brand with positive gross profit and negative
      contribution, it looks profitable until delivery and rebates are counted.</p>
    ${table([
      { key: 'brand', label: 'Brand' },
      { key: 'revenue_zar', label: 'Revenue', align: 'right', fmt: fmtRc },
      { key: 'gm_pct', label: 'Gross margin', align: 'right', fmt: (x) => fmtPct(x) },
      { key: 'rev_per_kg', label: 'Revenue per kg', align: 'right', fmt: fmtR2 },
      { key: 'contribution_zar', label: 'Contribution', align: 'right', fmt: fmtRc,
        cls: (x) => (x < 0 ? 'neg' : 'pos') },
      { key: 'cm_pct', label: 'Contribution margin', align: 'right', fmt: (x) => fmtPct(x),
        cls: (x) => (x < 0 ? 'neg' : '') },
      { key: 'is_trap', label: '', fmt: (x) => (x ? 'Margin trap' : ''), cls: (x) => (x ? 'neg' : '') },
    ], brands)}
    <p class="figure-note" style="margin-top:0.9rem">
      ${traps.length} of ${brands.length} brands are margin traps this period.${orphan ? `
      A further <b>${fmtRc(orphan.revenue_zar)}</b> of revenue sits on order lines quoting
      product codes that are absent from the product master, so no cost can be attached to
      them. Those lines are kept rather than dropped, and the pipeline raises a warning on
      every build until someone reconciles them, a silent inner join here would simply have
      made that revenue disappear.` : ''}</p>
  </section>`;
}

function sectionPromo(weekly, phases) {
  const on = phases.find((p) => p.promo_phase === 'On promotion') || {};
  const base = phases.find((p) => p.promo_phase === 'Baseline') || {};
  const post = phases.find((p) => p.promo_phase === 'Post-promotion (4 weeks)') || {};
  return `<section id="promo">
    ${head('02', 'The promotion that destroys value', `Brightwash Powder 2kg runs Buy 2 Get 1
      Free every quarter. Volume roughly triples, which is why everyone believes it works.
      Each promoted case earns <b class="neg">${fmtR(on.gp_per_unit || 0)}</b> of gross profit
      against <b class="pos">${fmtR(base.gp_per_unit || 0)}</b> off deal, and for four weeks
      afterwards the line sells at about <b>${Math.round(post.vol_index || 0)}%</b> of baseline
      because customers have loaded their pantries.`)}
    ${legend([
      { name: 'Baseline', color: v('--neutral') },
      { name: 'On promotion', color: v('--s1') },
      { name: 'Post-promotion (4 weeks)', color: v('--s3') },
    ])}
    ${figure({
      id: 'c-promo', title: 'Weekly cases sold, by promotion phase',
      note: 'The shape tells the story before any number is read: a spike, then a trough of almost exactly the same size.',
      tableHtml: table([
        { key: 'promo_phase', label: 'Phase' },
        { key: 'units', label: 'Cases', align: 'right', fmt: fmtNum },
        { key: 'gross_profit_zar', label: 'Gross profit', align: 'right', fmt: fmtR,
          cls: (x) => (x < 0 ? 'neg' : 'pos') },
        { key: 'gp_per_unit', label: 'Per case', align: 'right', fmt: (x) => fmtR(x),
          cls: (x) => (x < 0 ? 'neg' : 'pos') },
        { key: 'vol_index', label: 'Volume vs baseline', align: 'right', fmt: (x) => fmtPct(x, 0) },
      ], phases, { caption: 'Brightwash Powder 2kg x6, full period' }),
    })}
  </section>`;
}

function sectionDiscount(rows, bridge) {
  const lastRow = rows[rows.length - 1];
  const firstRow = rows[0];
  const forgone = rows.reduce((a, r) => a + (r.revenue_forgone_vs_baseline_zar || 0), 0);
  // The twelve month figure is read off the bridge step itself, so this section and the
  // closing bar can never quote different numbers for the same finding.
  const creepStep = bridge.find((r) => r.finding_ref === '3');
  const forgoneTtm = creepStep ? -creepStep.effect_zar : null;
  const ownCreep = lastRow.realised_discount_pct - firstRow.realised_discount_pct;
  const chanCreep = lastRow.channel_pct - firstRow.channel_pct;
  return `<section id="discount">
    ${head('03', 'The discount nobody reset', `Summit Cash &amp; Carry is the largest account on
      the book. Its realised discount drifted from <b>${fmtPct(firstRow.realised_discount_pct)}</b>
      to <b>${fmtPct(lastRow.realised_discount_pct)}</b> over two years,
      <b>${signed(ownCreep).replace('%', '')} points</b>, and nobody reset it. Held at the opening
      rate, it would have kept <b>${fmtRc(forgoneTtm)}</b> of revenue in the last twelve months
      alone, and ${fmtRc(forgone)} across the two years. Some of
      the drift is market-wide: the rest of Wholesale moved
      <b>${signed(chanCreep).replace('%', '')} points</b>. The
      <b>${(ownCreep - chanCreep).toFixed(1)} points</b> above that are this account's alone.`)}
    ${legend([
      { name: 'Summit Cash & Carry', color: v('--s1') },
      { name: 'Rest of Wholesale', color: v('--s2') },
    ], true)}
    ${figure({
      id: 'c-discount', title: 'Realised discount by month',
      note: 'Both lines climb, which is why this was never questioned, discounting is drifting across the whole channel. The point is the widening space between them: the comparison is the same channel with this group excluded, so it is like for like, and the gap is the part that is specific to this account rather than to the market.',
      tableHtml: table([
        { key: 'year_month', label: 'Month' },
        { key: 'realised_discount_pct', label: 'Summit', align: 'right', fmt: (x) => fmtPct(x) },
        { key: 'channel_pct', label: 'Rest of Wholesale', align: 'right', fmt: (x) => fmtPct(x) },
        { key: 'revenue_zar', label: 'Revenue', align: 'right', fmt: fmtR },
        { key: 'revenue_forgone_vs_baseline_zar', label: 'Forgone', align: 'right', fmt: fmtR, cls: () => 'neg' },
      ], rows, { caption: 'Summit Cash & Carry group' }),
    })}
  </section>`;
}

function sectionStock(rows) {
  const tot = rows.reduce((a, r) => ({
    units: a.units + r.units, revenue_zar: a.revenue_zar + r.revenue_zar, gp_zar: a.gp_zar + r.gp_zar,
  }), { units: 0, revenue_zar: 0, gp_zar: 0 });
  return `<section id="stock">
    ${head('04', 'The sales that never happened', `Replenishment into the Gauteng DC runs Monday
      to Wednesday. Three Modern Trade hero lines reach zero on hand on a Thursday in up to
      <b>${fmtPct(Math.max(...rows.map((r) => r.week_pct)), 0)}</b> of weeks and cannot be supplied
      on the Friday or Saturday. <b>${fmtRc(tot.revenue_zar)}</b> of revenue was never earned, and none of it appears anywhere in a sales report, because you cannot see sales that did
      not happen.`)}
    ${figure({
      id: 'c-stock', title: 'Revenue forgone to weekend stock-outs',
      note: 'Lost volume is estimated from each line’s own normal Friday and Saturday demand in weeks when stock was available, then valued at the realised Modern Trade price, not list.',
      tableHtml: table([
        { key: 'product_name', label: 'Product' },
        { key: 'weeks', label: 'Weeks affected', align: 'right', fmt: fmtNum },
        { key: 'units', label: 'Cases not supplied', align: 'right', fmt: fmtNum },
        { key: 'revenue_zar', label: 'Revenue forgone', align: 'right', fmt: fmtR, cls: () => 'neg' },
        { key: 'gp_zar', label: 'Gross profit forgone', align: 'right', fmt: fmtR, cls: () => 'neg' },
      ], rows, { caption: 'Full period', totalRow: { product_name: 'Total', ...tot, weeks: null } }),
    })}
  </section>`;
}

function sectionDead(rows) {
  const total = rows.reduce((a, r) => a + r.dead_stock_value_zar, 0);
  return `<section id="dead">
    ${head('05', 'Money sitting in the Coastal DC', `The Halo Shine aerosol range was
      discontinued. <b>${fmtRc(total)}</b> of it is still on a shelf and has not moved in over
      ${Math.min(...rows.map((r) => r.days_since_last_sale))} days. This is working capital rather
      than profit, which makes it the easiest item on this page to act on.`)}
    <h3 class="figure-title">Dead stock at cost</h3>
    <p class="figure-note">Discontinued lines with no sale in the last 180 days.</p>
    ${table([
      { key: 'product_name', label: 'Product' },
      { key: 'warehouse_name', label: 'Warehouse' },
      { key: 'units_on_hand', label: 'Cases', align: 'right', fmt: fmtNum },
      { key: 'days_since_last_sale', label: 'Days since last sale', align: 'right', fmt: fmtNum },
      { key: 'dead_stock_value_zar', label: 'Value at cost', align: 'right', fmt: fmtR, cls: () => 'neg' },
    ], rows, { totalRow: { product_name: 'Total', dead_stock_value_zar: total } })}
  </section>`;
}

// ---------------------------------------------------------------- draw

function drawGap(bridge, monthly) {
  waterfall(el('c-bridge'), {
    rows: bridge.map((r) => ({
      label: r.driver_short || r.driver, value: r.effect_zar,
      type: r.step_type === 'anchor' ? 'anchor' : r.step_type === 'total' ? 'total' : 'decrease',
      tip: `<b>${r.driver}</b>` +
        `<div class="tip-row"><span>Effect</span><span>${fmtR(r.effect_zar)}</span></div>` +
        (r.step_type === 'decrease'
          ? `<div class="tip-row"><span>Share of gap</span><span>${fmtPct(r.pct_of_gap)}</span></div>` : ''),
    })),
    height: 340, zeroBaseline: false,
  });

  const tbody = el('c-margin-table').querySelector('tbody');
  tbody.innerHTML = monthly.map((m) =>
    `<tr><td>${m.year_month}</td><td class="num">${fmtR(m.revenue_zar)}</td>` +
    `<td class="num">${fmtR(m.gross_profit_zar)}</td><td class="num">${fmtPct(m.margin_pct)}</td></tr>`).join('');

  lines(el('c-margin'), {
    series: [{
      name: 'Gross margin', color: v('--s1'),
      points: monthly.map((m) => ({ x: m.month_start_date, y: m.margin_pct })),
    }],
    height: 260, valueFmt: (x) => fmtPct(x, 1), xFmt: fmtMonth, xEvery: 3,
  });
}

function drawWater(steps) {
  waterfall(el('c-water'), {
    rows: steps.map((s) => ({
      label: s.step_label, value: s.step_value_zar,
      type: s.step_type === 'subtotal' || /gross profit|revenue|contribution/i.test(s.step_label)
        ? (/^revenue$/i.test(s.step_label) ? 'anchor' : 'total') : 'decrease',
      tip: `<b>${s.step_label}</b>` +
        `<div class="tip-row"><span>Amount</span><span>${fmtR(s.step_value_zar)}</span></div>` +
        `<div class="tip-row"><span>Running</span><span>${fmtR(s.running_total_zar)}</span></div>`,
    })),
    height: 340,
  });
}

function drawPromo(weekly) {
  columns(el('c-promo'), {
    rows: weekly.map((w) => ({
      x: fmtMonth(w.week_start_date), y: w.units, color: phaseColor(w.promo_phase),
      tip: `<b>Week of ${w.week_start_date}</b>` +
        `<div class="tip-row"><span>Phase</span><span>${w.promo_phase}</span></div>` +
        `<div class="tip-row"><span>Cases</span><span>${fmtNum(w.units)}</span></div>` +
        `<div class="tip-row"><span>Gross profit</span><span>${fmtR(w.gross_profit_zar)}</span></div>` +
        `<div class="tip-row"><span>Per case</span><span>${fmtR(w.gp_per_unit_zar || 0)}</span></div>`,
    })),
    height: 300, valueFmt: fmtNum, xEvery: 6, yLabel: 'cases',
  });
}

function drawDiscount(rows) {
  lines(el('c-discount'), {
    series: [
      { name: 'Summit Cash & Carry', color: v('--s1'),
        points: rows.map((r) => ({ x: r.month_start_date, y: r.realised_discount_pct })) },
      { name: 'Rest of Wholesale', color: v('--s2'),
        points: rows.map((r) => ({ x: r.month_start_date, y: r.channel_pct })) },
    ],
    height: 300, valueFmt: (x, dp = 1) => fmtPct(x, dp), xFmt: fmtMonth, xEvery: 3,
  });
}

function drawStock(rows) {
  barsH(el('c-stock'), {
    rows: rows.map((r) => ({
      label: r.product_name, value: r.revenue_zar, color: v('--s1'),
      tip: `<b>${r.product_name}</b>` +
        `<div class="tip-row"><span>Weeks affected</span><span>${fmtNum(r.weeks)}</span></div>` +
        `<div class="tip-row"><span>Cases not supplied</span><span>${fmtNum(r.units)}</span></div>` +
        `<div class="tip-row"><span>Revenue forgone</span><span>${fmtR(r.revenue_zar)}</span></div>` +
        `<div class="tip-row"><span>Gross profit forgone</span><span>${fmtR(r.gp_zar)}</span></div>`,
    })),
    valueFmt: fmtRc, rowHeight: 52,
  });
}

// ---------------------------------------------------------------- boot
//
// Last in the file on purpose. The module body runs top to bottom, so starting the
// render before the const helpers below are initialised throws a temporal dead zone
// error rather than anything that looks like a data problem.

try {
  // Freshness first: it is one small fetch, and if the warehouse fails to load the reader
  // should still be told how old the thing in front of them is.
  await renderFreshness().catch((e) => {
    el('fresh-label').textContent = 'Freshness unknown';
    console.warn('freshness', e);
  });
  await connect((msg) => { el('loading-msg').textContent = msg; });
  await render();
} catch (err) {
  el('main').innerHTML =
    `<div class="err"><b>Could not load the warehouse.</b><br>${String(err.message || err)}
     <br><br>This page must be served over HTTP, opening the file directly will not work,
     because the browser blocks the worker and the Parquet fetches.</div>`;
  console.error(err);
}
