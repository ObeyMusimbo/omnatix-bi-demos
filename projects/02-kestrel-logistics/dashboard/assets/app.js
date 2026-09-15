/*
  Kestrel Logistics, Control Tower.

  Opens on the network, because in freight the map is the argument: four corridors light up
  red and everything after that is explaining why. Every chart carries a table twin so no
  value is only reachable through a tooltip.
*/

import { connect, q, meta } from './db.js';
import {
  waterfall, columns, barsH, lines, legend, table, figure, wireTableToggles, mount,
  fmtR, fmtRc, fmtR2, fmtNum, fmtPct, fmtMonth,
} from './charts.js';
import { networkMap } from './map.js';

const el = (id) => document.getElementById(id);
const v = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const signed = (n, dp = 1) =>
  n === null || n === undefined || Number.isNaN(n) ? '-' : (n >= 0 ? '+' : '') + n.toFixed(dp) + '%';

// ---------------------------------------------------------------- freshness

const DAY_MS = 86400000;
const asDate = (iso) => new Date(iso.length === 10 ? iso + 'T00:00:00Z' : iso);
const longDate = (iso) => asDate(iso).toLocaleDateString('en-ZA',
  { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

async function renderFreshness() {
  const m = await meta();
  const today = new Date();
  const daysBehind = Math.max(0, Math.floor((today - asDate(m.data_through)) / DAY_MS));
  const buildAge = Math.max(0, Math.floor((today - asDate(m.built_at)) / DAY_MS));

  const state = daysBehind <= 2 ? 'is-current' : daysBehind <= 14 ? 'is-lagging' : 'is-stale';
  const label = daysBehind === 0 ? 'Up to date'
    : daysBehind <= 2 ? `Current, ${plural(daysBehind, 'day')} behind`
    : `${plural(daysBehind, 'day')} behind`;

  const box = el('freshness');
  box.classList.remove('is-current', 'is-lagging', 'is-stale');
  box.classList.add(state);
  box.title = `Newest trip ${longDate(m.data_through)}. Pipeline last run ${longDate(m.built_at)}.`;
  el('fresh-label').textContent = label;
  el('data-through').textContent = `Data to ${longDate(m.data_through)}`;
  el('last-run').textContent = buildAge === 0 ? 'Pipeline run today'
    : `Pipeline run ${longDate(m.built_at)}`;
}

// ---------------------------------------------------------------- render

async function render() {
  const [bridge, lanesTtm, depots, cities, sites, thirsty, sla, slaContract, air, monthly] =
    await Promise.all([
      q(`select * from mart_opportunity_bridge order by step_order`),

      q(`select lane_id, lane_name, lane_type, origin_depot_name, origin_lat, origin_lon,
                destination_city, destination_lat, destination_lon,
                round_trips, empty_returns, distance_km, revenue_zar, cost_zar,
                contribution_zar, outbound_only_contribution_zar, empty_return_cost_zar,
                actual_backhaul_pct, assumed_backhaul_pct, backhaul_shortfall_pts,
                contribution_margin_pct, is_backhaul_trap, is_loss_making
         from mart_lane_economics where period_order = 1`),

      q(`select distinct origin_depot_name as name, origin_lat as lat, origin_lon as lon
         from mart_lane_economics where origin_lat is not null`),

      q(`select destination_city as name, any_value(destination_lat) as lat,
                any_value(destination_lon) as lon
         from mart_lane_economics where lane_type = 'Line-haul' group by 1`),

      q(`select customer_name, contract_type, sum(drops) as drops, sum(failed_drops) as failed,
                round(sum(failed_drops) * 100.0 / nullif(sum(drops), 0), 1) as failure_rate_pct,
                round(sum(failed_cost_zar), 2) as failed_cost_zar,
                any_value(top_failure_reason) as reason,
                bool_or(is_problem_site) as is_problem_site
         from mart_failed_deliveries group by 1, 2 order by failed_cost_zar desc`),

      q(`select registration, vehicle_class, depot_name, trips, distance_km,
                litres_per_100km, class_median_l100, excess_pct, excess_cost_zar, is_outlier
         from mart_fuel_outliers order by excess_cost_zar desc`),

      q(`select dispatch_day_bucket,
                sum(drops) as drops, sum(on_time_drops) as on_time_drops,
                round(sum(on_time_drops) * 100.0 / nullif(sum(drops), 0), 1) as on_time_pct,
                round(sum(penalty_exposure_zar), 2) as penalty_zar
         from mart_sla_performance group by 1`),

      q(`select contract_type, dispatch_day_bucket,
                round(sum(on_time_drops) * 100.0 / nullif(sum(drops), 0), 1) as on_time_pct
         from mart_sla_performance group by 1, 2`),

      q(`select vehicle_class, sum(air_trips) as air_trips, sum(trips) as trips,
                round(avg(avg_weight_utilisation_pct), 1) as weight_pct,
                round(avg(avg_volume_utilisation_pct), 1) as volume_pct,
                round(sum(air_trip_cost_zar), 2) as air_cost_zar
         from mart_load_factor group by 1 having sum(air_trips) > 0 order by air_cost_zar desc`),

      // Return legs on the long corridors can leave a day or two after the outbound, so the
      // window closes on a stub month carrying a handful of trips, most of them empty. Left
      // in, it renders as a spike to 100% that is an artefact of the window rather than
      // anything about the fleet. Months under a third of the median are dropped.
      q(`with m as (
           select month_start_date, year_month,
                  sum(distance_km) as distance_km,
                  sum(empty_distance_km) as empty_distance_km,
                  sum(revenue_zar) as revenue_zar,
                  sum(contribution_zar) as contribution_zar
           from agg_trip_monthly group by 1, 2)
         select month_start_date, year_month, distance_km, empty_distance_km,
                round(empty_distance_km * 100.0 / nullif(distance_km, 0), 2) as empty_pct,
                revenue_zar, contribution_zar
         from m
         where distance_km > (select median(distance_km) from m) * 0.3
         order by month_start_date`),
    ]);

  const h = bridge[0];
  const linehaul = lanesTtm.filter((l) => l.lane_type === 'Line-haul');
  const traps = linehaul.filter((l) => l.is_backhaul_trap)
    .sort((a, b) => a.contribution_zar - b.contribution_zar);
  const emptyKm = monthly.reduce((a, m) => a + m.empty_distance_km, 0);
  const totalKm = monthly.reduce((a, m) => a + m.distance_km, 0);
  const emptyPct = emptyKm / totalKm * 100;
  const trapLoss = traps.reduce((a, l) => a + l.contribution_zar, 0);

  el('main').innerHTML =
    sectionNetwork(h, emptyPct, emptyKm, traps, trapLoss) +
    sectionCorridors(traps, linehaul) +
    sectionDoors(sites) +
    sectionThirsty(thirsty) +
    sectionFriday(sla, slaContract) +
    sectionAir(air) +
    sectionClose(h, bridge);

  drawMap(lanesTtm, depots, cities);
  drawCorridors(traps);
  drawDoors(sites);
  drawThirsty(thirsty);
  drawFriday(sla);
  drawEmptyTrend(monthly);
  drawBridge(bridge);
  wireTableToggles();
}

// ---------------------------------------------------------------- sections

const head = (num, title, lede) => `
  <div class="section-head">
    <div class="section-num">${num}</div>
    <h2>${title}</h2>
  </div>
  <p class="lede">${lede}</p>`;

function sectionNetwork(h, emptyPct, emptyKm, traps, trapLoss) {
  const tiles = [
    ['Revenue', fmtRc(h.ttm_revenue_zar), `${fmtR2(h.ttm_revenue_per_km_zar)} per km`],
    ['Cost', fmtRc(h.ttm_cost_zar), `${fmtR2(h.ttm_cost_per_km_zar)} per km`],
    ['Contribution', fmtRc(h.ttm_contribution_zar), `${fmtPct(h.ttm_contribution_margin_pct)} of revenue`],
    ['Distance', fmtNum(h.ttm_km) + ' km', `${traps.length} corridors losing money`],
  ].map(([l, val, d]) => `
    <div class="tile">
      <div class="tile-label">${l}</div>
      <div class="tile-value">${val}</div>
      <div class="tile-delta">${d}</div>
    </div>`).join('');

  return `<section id="network">
    ${head('00', 'The network', `Kestrel turned <b>${fmtNum(h.ttm_km)} kilometres</b> in the last
      twelve months and earned <b>${fmtRc(h.ttm_revenue_zar)}</b> doing it. Nearly a quarter of
      those kilometres carried nothing. Some of that is unavoidable, but
      <b>${traps.length} corridors</b> are priced as though the truck comes home loaded when it
      does not, and they lose <b>${fmtRc(Math.abs(trapLoss))}</b> a year between them.`)}
    <div class="hero">
      <div class="hero-value">${fmtPct(emptyPct)}</div>
      <div class="hero-label">of every kilometre this fleet turned was carrying nothing at all</div>
    </div>
    <div class="tiles">${tiles}</div>
    ${legend([
      { name: 'Loses money as a round trip', color: v('--breach') },
      { name: 'Thin', color: v('--warn') },
      { name: 'Healthy', color: v('--s1') },
    ], true)}
    ${figure({
      id: 'c-map', title: 'Corridors by round trip contribution',
      note: 'Line thickness is revenue. Colour is what the corridor contributes once the return leg it caused is charged to it. Hover any line for the detail. Drawn from coordinates in the data, so nothing is fetched from a map provider.',
    })}
    ${figure({
      id: 'c-empty', title: 'Share of kilometres run empty, by month',
      note: 'It moves a few points either way and never trends down. This is structural, not a bad quarter.',
      tableHtml: table([
        { key: 'year_month', label: 'Month' },
        { key: 'distance_km', label: 'Kilometres', align: 'right', fmt: fmtNum },
        { key: 'empty_distance_km', label: 'Empty', align: 'right', fmt: fmtNum },
        { key: 'empty_pct', label: 'Empty share', align: 'right', fmt: (x) => fmtPct(x) },
      ], [], { caption: 'Monthly running' }),
    })}
  </section>`;
}

function sectionCorridors(traps, linehaul) {
  const worst = traps[0];
  return `<section id="corridors">
    ${head('01', 'Corridors that fund their own empty return', `Every lane was priced assuming
      <b>60%</b> of the return leg would sell. Nobody revisited that corridor by corridor. On
      ${worst.lane_name} the real fill is <b>${fmtPct(worst.actual_backhaul_pct)}</b>. Measured
      one way, that lane looks like <b>${fmtRc(worst.outbound_only_contribution_zar)}</b> of
      contribution. Charged with the empty truck it sends home, it is
      <b class="breach">${fmtRc(worst.contribution_zar)}</b>.`)}
    ${figure({
      id: 'c-corridors', title: 'What the outbound leg looks like, against the round trip',
      note: 'The reveal is one join: pair an outbound trip with the return it caused, and charge both legs against the revenue they jointly earned. Kestrel reports on legs, so the empty return has never been charged to anything.',
      tableHtml: table([
        { key: 'lane_name', label: 'Corridor' },
        { key: 'round_trips', label: 'Round trips', align: 'right', fmt: fmtNum },
        { key: 'actual_backhaul_pct', label: 'Backhaul actual', align: 'right', fmt: (x) => fmtPct(x) },
        { key: 'assumed_backhaul_pct', label: 'Assumed', align: 'right', fmt: (x) => fmtPct(x, 0) },
        { key: 'revenue_zar', label: 'Revenue', align: 'right', fmt: fmtRc },
        { key: 'outbound_only_contribution_zar', label: 'Looks like', align: 'right', fmt: fmtRc, cls: () => 'pos' },
        { key: 'contribution_zar', label: 'Actually', align: 'right', fmt: fmtRc, cls: () => 'breach' },
      ], traps, { caption: 'Loss making corridors, trailing twelve months' }),
    })}
    <h3 class="figure-title" style="margin-top:2rem">Every line-haul corridor</h3>
    <p class="figure-note">Sorted by what the round trip contributes. The healthy lanes are the
      ones where the return leg actually sells, which is what the rate card assumed everywhere.</p>
    ${table([
      { key: 'lane_name', label: 'Corridor' },
      { key: 'round_trips', label: 'Round trips', align: 'right', fmt: fmtNum },
      { key: 'actual_backhaul_pct', label: 'Backhaul', align: 'right', fmt: (x) => fmtPct(x),
        cls: (x) => (x < 40 ? 'breach' : x < 55 ? 'warn' : 'pos') },
      { key: 'backhaul_shortfall_pts', label: 'Short by', align: 'right',
        fmt: (x) => (x > 0 ? x.toFixed(1) + ' pts' : '-') },
      { key: 'revenue_zar', label: 'Revenue', align: 'right', fmt: fmtRc },
      { key: 'contribution_zar', label: 'Contribution', align: 'right', fmt: fmtRc,
        cls: (x) => (x < 0 ? 'breach' : 'pos') },
      { key: 'contribution_margin_pct', label: 'Margin', align: 'right', fmt: (x) => fmtPct(x),
        cls: (x) => (x < 0 ? 'breach' : '') },
    ], [...linehaul].sort((a, b) => a.contribution_zar - b.contribution_zar))}
  </section>`;
}

function sectionDoors(sites) {
  const problem = sites.filter((s) => s.is_problem_site);
  const totalFailed = sites.reduce((a, s) => a + s.failed, 0);
  const totalDrops = sites.reduce((a, s) => a + s.drops, 0);
  const totalCost = sites.reduce((a, s) => a + s.failed_cost_zar, 0);
  const problemCost = problem.reduce((a, s) => a + s.failed_cost_zar, 0);
  return `<section id="doors">
    ${head('02', 'Deliveries that had to be done twice', `<b>${fmtNum(totalFailed)}</b> drops were
      refused on first attempt, <b>${fmtPct(totalFailed / totalDrops * 100)}</b> of everything
      delivered, costing <b>${fmtRc(totalCost)}</b> in journeys that earned nothing. It does not
      appear in a revenue report, because a failed delivery has no revenue to report.
      <b>${problem.length} sites</b> account for <b>${fmtRc(problemCost)}</b> of it.`)}
    ${figure({
      id: 'c-doors', title: 'Sites refusing more than 15% of deliveries',
      note: 'These are not having bad luck. No booked receiving slot, a yard that shuts early, or a goods-in desk with one person on it. This is a conversation with six customers, not an analysis.',
      tableHtml: table([
        { key: 'customer_name', label: 'Site' },
        { key: 'contract_type', label: 'Contract' },
        { key: 'drops', label: 'Drops', align: 'right', fmt: fmtNum },
        { key: 'failed', label: 'Refused', align: 'right', fmt: fmtNum },
        { key: 'failure_rate_pct', label: 'Failure rate', align: 'right', fmt: (x) => fmtPct(x), cls: () => 'breach' },
        { key: 'failed_cost_zar', label: 'Wasted', align: 'right', fmt: fmtR, cls: () => 'breach' },
        { key: 'reason', label: 'Usual reason' },
      ], problem, { caption: 'Problem receiving sites, full period' }),
    })}
  </section>`;
}

function sectionThirsty(rows) {
  const out = rows.filter((r) => r.is_outlier);
  const total = out.reduce((a, r) => a + r.excess_cost_zar, 0);
  return `<section id="thirsty">
    ${head('03', 'Seven vehicles drinking', `Compared against the median of their own class, on
      the same lanes and the same loads, <b>${out.length} vehicles</b> burn
      <b>${fmtPct(Math.min(...out.map((r) => r.excess_pct)), 0)} to
      ${fmtPct(Math.max(...out.map((r) => r.excess_pct)), 0)}</b> more diesel than they should.
      That gap is worth <b>${fmtRc(total)}</b> a year.`)}
    ${figure({
      id: 'c-thirsty', title: 'Excess fuel cost by vehicle',
      note: 'Compared within class, never against the fleet, because a rigid and a superlink are not doing the same work. Excess litres are valued at the price each vehicle actually paid, since diesel moved across the window. The dashboard cannot say whether this is injectors, dragging brakes, or diesel walking off the forecourt. It can say these seven are worth a workshop booking to find out.',
      tableHtml: table([
        { key: 'registration', label: 'Registration' },
        { key: 'vehicle_class', label: 'Class' },
        { key: 'depot_name', label: 'Hub' },
        { key: 'distance_km', label: 'Kilometres', align: 'right', fmt: fmtNum },
        { key: 'litres_per_100km', label: 'L/100km', align: 'right', fmt: (x) => x.toFixed(1) },
        { key: 'class_median_l100', label: 'Class median', align: 'right', fmt: (x) => x.toFixed(1) },
        { key: 'excess_pct', label: 'Excess', align: 'right', fmt: (x) => signed(x, 1), cls: () => 'breach' },
        { key: 'excess_cost_zar', label: 'Cost', align: 'right', fmt: fmtR, cls: () => 'breach' },
      ], out, { caption: 'Vehicles more than 15% above their class median' }),
    })}
  </section>`;
}

function sectionFriday(sla, contract) {
  const by = Object.fromEntries(sla.map((r) => [r.dispatch_day_bucket, r]));
  const normal = by['Normal day'] || {};
  const friday = by['Friday'] || {};
  const monthEnd = by['Month end run'] || {};
  const penalty = sla.reduce((a, r) => a + r.penalty_zar, 0);

  const order = { Dedicated: 0, Contract: 1, Spot: 2 };
  const grid = contract.length ? `
    <h3 class="figure-title" style="margin-top:2rem">Who it lands on</h3>
    <p class="figure-note">A dedicated account books a two hour window, a contract account four,
      a spot load eight. So the customers paying most for service are the ones failed first, and
      the ones on the loosest terms barely notice.</p>
    ${table([
      { key: 'contract_type', label: 'Contract' },
      { key: 'Normal day', label: 'Normal day', align: 'right', fmt: (x) => fmtPct(x) },
      { key: 'Friday', label: 'Friday', align: 'right', fmt: (x) => fmtPct(x),
        cls: (x) => (x < 60 ? 'breach' : x < 85 ? 'warn' : '') },
      { key: 'Month end run', label: 'Month end run', align: 'right', fmt: (x) => fmtPct(x),
        cls: (x) => (x < 60 ? 'breach' : x < 85 ? 'warn' : '') },
    ], Object.values(contract.reduce((acc, r) => {
      (acc[r.contract_type] ||= { contract_type: r.contract_type })[r.dispatch_day_bucket] = r.on_time_pct;
      return acc;
    }, {})).sort((a, b) => order[a.contract_type] - order[b.contract_type]))}` : '';

  return `<section id="friday">
    ${head('04', 'Friday, and the last two days of the month', `On an ordinary day
      <b>${fmtPct(normal.on_time_pct)}</b> of drops land inside the window the customer was
      promised. On a Friday it is <b class="breach">${fmtPct(friday.on_time_pct)}</b>, and during
      the month end run <b class="breach">${fmtPct(monthEnd.on_time_pct)}</b>. Dispatch batches
      whatever is still standing into one run, trucks leave hours late, and every drop on the
      route is late together. On the one account whose contract carries a service clause, that
      is worth <b>${fmtRc(penalty)}</b>.`)}
    ${figure({
      id: 'c-friday', title: 'On time delivery by dispatch day',
      note: 'Nothing about the road changed. The trucks left late.',
      tableHtml: table([
        { key: 'dispatch_day_bucket', label: 'Dispatch day' },
        { key: 'drops', label: 'Drops', align: 'right', fmt: fmtNum },
        { key: 'on_time_drops', label: 'On time', align: 'right', fmt: fmtNum },
        { key: 'on_time_pct', label: 'On time', align: 'right', fmt: (x) => fmtPct(x),
          cls: (x) => (x < 80 ? 'breach' : 'pos') },
        { key: 'penalty_zar', label: 'Penalty exposure', align: 'right', fmt: fmtR,
          cls: (x) => (x > 0 ? 'breach' : 'muted') },
      ], sla, { caption: 'Full period' }),
    })}
    ${grid}
  </section>`;
}

function sectionAir(rows) {
  const total = rows.reduce((a, r) => a + r.air_cost_zar, 0);
  const trips = rows.reduce((a, r) => a + r.air_trips, 0);
  return `<section id="air">
    ${head('05', 'Paying to move air', `Freight is billed by weight, but a trailer runs out of deck
      space long before it runs out of axle allowance on light, bulky cargo.
      <b>${fmtNum(trips)} trips</b> ran over 85% full by volume and under 55% by weight. The truck
      was full. The invoice was not.`)}
    <p class="figure-note" style="max-width:74ch">Unlike the four findings above, this is not
      money sitting on the table today. It is the case for consolidating loads onto fewer, fuller
      trucks, and it is the one item here that needs an operations change rather than a phone
      call. ${fmtRc(total)} of running cost went into these trips.</p>
    ${table([
      { key: 'vehicle_class', label: 'Class' },
      { key: 'trips', label: 'Laden trips', align: 'right', fmt: fmtNum },
      { key: 'air_trips', label: 'Full of air', align: 'right', fmt: fmtNum, cls: () => 'warn' },
      { key: 'weight_pct', label: 'Weight used', align: 'right', fmt: (x) => fmtPct(x) },
      { key: 'volume_pct', label: 'Volume used', align: 'right', fmt: (x) => fmtPct(x) },
      { key: 'air_cost_zar', label: 'Running cost', align: 'right', fmt: fmtRc },
    ], rows)}
  </section>`;
}

function sectionClose(h, bridge) {
  return `<section id="close">
    ${head('06', 'What this is worth', `Kestrel earned <b>${fmtRc(h.ttm_contribution_zar)}</b> of
      contribution on <b>${fmtRc(h.ttm_revenue_zar)}</b> of revenue. The four findings above are
      worth <b>${fmtRc(h.identified_zar)}</b> between them, or
      <b>${fmtPct(h.identified_pct_of_contribution)}</b> of everything the business currently
      makes, on the same fleet serving the same customers with nothing new bought.`)}
    ${figure({
      id: 'c-bridge', title: 'Earned today, against what is available',
      note: 'These are what the findings are worth in full. Nobody recovers all of a number like this: a lane can be repriced or dropped, a receiving problem is a conversation, an injector is a workshop booking. Half of it inside a year would still roughly double the margin.',
      tableHtml: table([
        { key: 'driver', label: 'Driver' },
        { key: 'effect_zar', label: 'Worth', align: 'right', fmt: fmtR,
          cls: (x, r) => (r.step_type === 'increase' ? 'pos' : '') },
        { key: 'pct_of_identified', label: 'Share', align: 'right', fmt: (x) => (x == null ? '' : fmtPct(x)) },
        { key: 'finding_ref', label: 'Finding', fmt: (x) => (x ? `See ${x}` : '') },
      ], bridge, { caption: 'Trailing twelve months' }),
    })}
  </section>`;
}

// ---------------------------------------------------------------- draw

function drawMap(lanes, depots, cities) {
  const linehaul = lanes.filter((l) => l.lane_type === 'Line-haul');
  const maxRev = Math.max(...linehaul.map((l) => l.revenue_zar));
  const render = networkMap(el('c-map'), {
    lanes: linehaul.map((l) => ({
      origin_lat: l.origin_lat, origin_lon: l.origin_lon,
      destination_lat: l.destination_lat, destination_lon: l.destination_lon,
      weight: l.revenue_zar / maxRev,
      status: l.contribution_zar < 0 ? 'loss'
        : l.contribution_margin_pct < 6 ? 'thin' : 'healthy',
      tip: `<b>${l.lane_name}</b>`
        + `<div class="tip-row"><span>Round trips</span><span>${fmtNum(l.round_trips)}</span></div>`
        + `<div class="tip-row"><span>Backhaul</span><span>${fmtPct(l.actual_backhaul_pct)} vs ${fmtPct(l.assumed_backhaul_pct, 0)}</span></div>`
        + `<div class="tip-row"><span>Revenue</span><span>${fmtRc(l.revenue_zar)}</span></div>`
        + `<div class="tip-row"><span>Looks like</span><span>${fmtRc(l.outbound_only_contribution_zar)}</span></div>`
        + `<div class="tip-row"><span>Actually</span><span>${fmtRc(l.contribution_zar)}</span></div>`,
    })),
    depots, cities, height: 560,
  });
  mount(el('c-map'), render);
}

function drawCorridors(traps) {
  // Two bars per corridor: what the outbound leg looks like, and what the round trip is.
  const rows = [];
  for (const t of traps.slice(0, 6)) {
    rows.push({
      x: t.destination_city, y: t.outbound_only_contribution_zar, color: v('--s1'),
      tip: `<b>${t.lane_name}</b><div class="tip-row"><span>Outbound leg alone</span><span>${fmtR(t.outbound_only_contribution_zar)}</span></div>`,
    });
    rows.push({
      x: '', y: t.contribution_zar, color: v('--breach'),
      tip: `<b>${t.lane_name}</b><div class="tip-row"><span>Round trip</span><span>${fmtR(t.contribution_zar)}</span></div>`,
    });
  }
  columns(el('c-corridors'), { rows, height: 320, valueFmt: fmtRc, xEvery: 1, yLabel: 'contribution' });
}

function drawDoors(sites) {
  barsH(el('c-doors'), {
    rows: sites.filter((s) => s.is_problem_site).slice(0, 8).map((s) => ({
      label: s.customer_name, value: s.failed_cost_zar, color: v('--breach'),
      tip: `<b>${s.customer_name}</b>`
        + `<div class="tip-row"><span>Failure rate</span><span>${fmtPct(s.failure_rate_pct)}</span></div>`
        + `<div class="tip-row"><span>Refused</span><span>${fmtNum(s.failed)} of ${fmtNum(s.drops)}</span></div>`
        + `<div class="tip-row"><span>Wasted</span><span>${fmtR(s.failed_cost_zar)}</span></div>`
        + `<div class="tip-row"><span>Usual reason</span><span>${s.reason || 'n/a'}</span></div>`,
    })),
    valueFmt: fmtRc, rowHeight: 50,
  });
}

function drawThirsty(rows) {
  barsH(el('c-thirsty'), {
    rows: rows.filter((r) => r.is_outlier).map((r) => ({
      label: `${r.registration}  ${r.vehicle_class}`, value: r.excess_cost_zar, color: v('--breach'),
      tip: `<b>${r.registration}</b>`
        + `<div class="tip-row"><span>Class</span><span>${r.vehicle_class}</span></div>`
        + `<div class="tip-row"><span>Burn</span><span>${r.litres_per_100km.toFixed(1)} vs ${r.class_median_l100.toFixed(1)} L/100km</span></div>`
        + `<div class="tip-row"><span>Excess</span><span>${signed(r.excess_pct)}</span></div>`
        + `<div class="tip-row"><span>Cost</span><span>${fmtR(r.excess_cost_zar)}</span></div>`,
    })),
    valueFmt: fmtRc, rowHeight: 48, labelWidth: 260,
  });
}

function drawFriday(sla) {
  const order = { 'Normal day': 0, 'Friday': 1, 'Month end run': 2 };
  columns(el('c-friday'), {
    rows: [...sla].sort((a, b) => order[a.dispatch_day_bucket] - order[b.dispatch_day_bucket]).map((r) => ({
      x: r.dispatch_day_bucket, y: r.on_time_pct,
      color: r.on_time_pct < 80 ? v('--breach') : v('--ok'),
      tip: `<b>${r.dispatch_day_bucket}</b>`
        + `<div class="tip-row"><span>On time</span><span>${fmtPct(r.on_time_pct)}</span></div>`
        + `<div class="tip-row"><span>Drops</span><span>${fmtNum(r.drops)}</span></div>`,
    })),
    height: 260, valueFmt: (x) => x.toFixed(0) + '%', yLabel: 'on time',
    refLine: { value: 90, label: 'penalty threshold, 90%' },
  });
}

function drawEmptyTrend(monthly) {
  const tbody = el('c-empty-table')?.querySelector('tbody');
  if (tbody) {
    tbody.innerHTML = monthly.map((m) =>
      `<tr><td>${m.year_month}</td><td class="num">${fmtNum(m.distance_km)}</td>` +
      `<td class="num">${fmtNum(m.empty_distance_km)}</td>` +
      `<td class="num">${fmtPct(m.empty_pct)}</td></tr>`).join('');
  }
  lines(el('c-empty'), {
    series: [{
      name: 'Empty kilometres', color: v('--breach'),
      points: monthly.map((m) => ({ x: m.month_start_date, y: m.empty_pct })),
    }],
    height: 240, valueFmt: (x, dp = 1) => fmtPct(x, dp), xFmt: fmtMonth, xEvery: 3,
  });
}

function drawBridge(bridge) {
  waterfall(el('c-bridge'), {
    rows: bridge.map((r) => ({
      label: r.driver_short, value: r.effect_zar,
      type: r.step_type === 'anchor' ? 'anchor' : r.step_type === 'total' ? 'total' : 'increase',
      tip: `<b>${r.driver}</b>`
        + `<div class="tip-row"><span>Worth</span><span>${fmtR(r.effect_zar)}</span></div>`
        + (r.pct_of_identified != null
          ? `<div class="tip-row"><span>Share</span><span>${fmtPct(r.pct_of_identified)}</span></div>` : ''),
    })),
    height: 340, zeroBaseline: false,
  });
}

// ---------------------------------------------------------------- boot
//
// Last in the file on purpose: the module body runs top to bottom, so starting the render
// before the const helpers above are initialised throws a temporal dead zone error.

try {
  await renderFreshness().catch((e) => {
    el('fresh-label').textContent = 'Freshness unknown';
    console.warn('freshness', e);
  });
  await connect((msg) => { el('loading-msg').textContent = msg; });
  await render();
} catch (err) {
  el('main').innerHTML =
    `<div class="err"><b>Could not load the warehouse.</b><br>${String(err.message || err)}
     <br><br>This page must be served over HTTP. Opening the file directly will not work,
     because the browser blocks the worker and the Parquet fetches.</div>`;
  console.error(err);
}
