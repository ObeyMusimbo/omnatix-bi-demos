/*
  Lumen Health Network, Capacity and Collection Review.

  The page is built around a complaint the group actually makes: we are full, and we are not
  making money. So it opens on the money that was billed and never arrived, and then shows
  why the practice feels full while nearly half the clinician time it buys has nobody in it.

  Two numbers are kept apart on purpose and the page says so in words, more than once.
  Revenue billed and never collected is not the same quantity as clinician cost paid for an
  empty room, and neither is the same as cash that arrives six weeks late. Add any two of
  them and the total is wrong in both directions.
*/

import { connect, q, meta } from './db.js';
import {
  waterfall, columns, barsH, lines, legend, table, figure, wireTableToggles,
  showTip, hideTip, esc, fmtR, fmtRc, fmtR2, fmtNum, fmtPct,
} from './charts.js';

const el = (id) => document.getElementById(id);
const v = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const FILL_RAMP = ['--f1', '--f2', '--f3', '--f4', '--f5', '--f6'];
const WAIT_RAMP = ['--w1', '--w2', '--w3', '--w4', '--w5', '--w6'];
const DAYS = [
  [1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'],
];

// ---------------------------------------------------------------- freshness

const DAY_MS = 86400000;
const asDate = (iso) => new Date(iso.length === 10 ? iso + 'T00:00:00Z' : iso);
const longDate = (iso) => asDate(iso).toLocaleDateString('en-ZA',
  { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

async function renderFreshness() {
  const m = await meta();
  const today = new Date();
  const behind = Math.max(0, Math.floor((today - asDate(m.data_through)) / DAY_MS));
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
  const state = behind <= 2 ? 'is-current' : behind <= 14 ? 'is-lagging' : 'is-stale';
  const box = el('freshness');
  box.classList.remove('is-current', 'is-lagging', 'is-stale');
  box.classList.add(state);
  box.title = `Newest appointment ${longDate(m.data_through)}. Pipeline last run ${longDate(m.built_at)}.`;
  el('fresh-label').textContent = behind === 0 ? 'Up to date'
    : behind <= 2 ? `Current, ${plural(behind, 'day')} behind` : `${plural(behind, 'day')} behind`;
  el('data-through').textContent = `Data to ${longDate(m.data_through)}`;
  el('last-run').textContent = buildAge === 0 ? 'Pipeline run today' : `Pipeline run ${longDate(m.built_at)}`;
}

// ---------------------------------------------------------------- the heat grid
//
// Hand built rather than pushed through a chart primitive, because a heat grid is a table.
// Built as one it keeps its row and column headers, it is readable by a screen reader, it
// copies into a spreadsheet, and it needs no separate table twin.

function heatGrid(cells, { key, ramp, domain, fmt, label }) {
  const hours = [...new Set(cells.map((c) => c.slot_hour))].sort((a, b) => a - b);
  const [lo, hi] = domain;
  const step = (val) => {
    if (val == null) return null;
    const t = Math.max(0, Math.min(0.999, (val - lo) / (hi - lo || 1)));
    return Math.floor(t * ramp.length);
  };
  const byCell = new Map(cells.map((c) => [`${c.day_of_week}|${c.slot_hour}`, c]));

  let s = `<div class="grid-wrap"><table class="heat">`;
  s += `<caption>${esc(label)}</caption>`;
  s += `<thead><tr><th class="rowhead"></th>`
     + DAYS.map(([, name]) => `<th scope="col">${name}</th>`).join('')
     + `</tr></thead><tbody>`;

  for (const h of hours) {
    s += `<tr><th scope="row" class="rowhead">${String(h).padStart(2, '0')}:00</th>`;
    for (const [dow] of DAYS) {
      const c = byCell.get(`${dow}|${h}`);
      if (!c || c.slots_offered == null || c.slots_offered === 0) {
        s += `<td class="closed">&middot;</td>`;
        continue;
      }
      const i = step(c[key]);
      // White text clears 4.5:1 from the fourth step of either ramp upward and fails below it,
      // so the bottom three steps carry dark ink instead. Measured against the actual hexes
      // rather than guessed: step three is 3.5:1 under white and 4.7:1 under ink.
      const cls = i <= 2 ? ' on-light' : '';
      const tip = `<b>${DAYS.find(([d]) => d === dow)[1]} ${String(h).padStart(2, '0')}:00</b>`
        + `<div class="tip-row"><span>Slots offered</span><span>${fmtNum(c.slots_offered)}</span></div>`
        + `<div class="tip-row"><span>Booked</span><span>${fmtNum(c.slots_booked)}</span></div>`
        + `<div class="tip-row"><span>Fill</span><span>${fmtPct(c.fill_pct)}</span></div>`
        + `<div class="tip-row"><span>Did not arrive</span><span>${fmtNum(c.slots_no_show)}</span></div>`
        + (c.avg_wait_minutes != null
            ? `<div class="tip-row"><span>Average wait</span><span>${c.avg_wait_minutes} min</span></div>` : '')
        + (c.avg_booking_lead_days != null
            ? `<div class="tip-row"><span>Booked ahead</span><span>${c.avg_booking_lead_days} days</span></div>` : '')
        + `<div class="tip-row"><span>Empty chairs cost</span><span>${fmtR(c.unfilled_cost_zar)}</span></div>`;
      s += `<td class="${cls.trim()}" style="background:${v(ramp[i])}" tabindex="0" `
         + `data-tip="${esc(tip)}">${esc(fmt(c[key]))}</td>`;
    }
    s += `</tr>`;
  }
  return s + `</tbody></table></div>`;
}

function scaleLegend(ramp, loLabel, hiLabel) {
  return `<div class="scale-legend"><span>${esc(loLabel)}</span>`
    + `<span class="scale-swatches">`
    + ramp.map((t) => `<span style="background:${v(t)}"></span>`).join('')
    + `</span><span>${esc(hiLabel)}</span></div>`;
}

function wireHeat(root) {
  root.querySelectorAll('.heat [data-tip]').forEach((n) => {
    n.addEventListener('mousemove', (ev) => showTip(n.getAttribute('data-tip'), ev));
    n.addEventListener('mouseleave', hideTip);
    n.addEventListener('focus', (ev) => showTip(n.getAttribute('data-tip'), ev));
    n.addEventListener('blur', hideTip);
  });
}

// ---------------------------------------------------------------- render

async function render() {
  const [bridge, grid, capacity, noShow, recovery, charges, schemes, practitioners, clinics,
         quality, monthly] =
    await Promise.all([
      q(`select * from mart_collection_bridge order by step_order`),
      q(`select * from mart_slot_grid order by day_of_week, slot_hour`),
      q(`select * from mart_capacity_cost order by day_of_week, slot_hour`),
      q(`select * from mart_no_show order by booking_lead_order, reminder_sent`),
      q(`select * from mart_claim_recovery`),
      q(`select * from mart_patient_charges order by payment_type, collected_pct`),
      q(`select * from mart_scheme order by claimed_zar desc`),
      q(`select * from mart_practitioner order by discipline, fill_pct desc`),
      q(`select * from mart_clinic order by billed_zar desc`),
      q(`select * from mart_data_quality order by issue_order`),
      q(`select * from agg_monthly order by month_start`),
    ]);

  const b = bridge[0];
  const cap = capacity[0];
  const ns = noShow[0];
  const rec = recovery[0];
  const m = await meta();

  // ---- derived once, used in copy. Nothing on this page states a number the warehouse
  // cannot produce, which is why these are computed here rather than typed.
  const weekdayGrid = grid.filter((g) => g.day_of_week >= 1 && g.day_of_week <= 5);
  const quietest = weekdayGrid.reduce((a, c) => (c.fill_pct < a.fill_pct ? c : a));
  const busiest = weekdayGrid.reduce((a, c) => (c.fill_pct > a.fill_pct ? c : a));
  const byDay = DAYS.map(([dow, name]) => {
    const rows = grid.filter((g) => g.day_of_week === dow);
    const offered = rows.reduce((t, r) => t + r.slots_offered, 0);
    const booked = rows.reduce((t, r) => t + r.slots_booked, 0);
    return {
      dow, name, offered, booked,
      fill_pct: offered ? (booked / offered) * 100 : 0,
      unfilled_cost_zar: rows.reduce((t, r) => t + r.unfilled_cost_zar, 0),
    };
  });

  const recoveryBySite = [...clinics]
    .map((c) => ({ ...c }))
    .sort((a, b2) => a.recovery_pct - b2.recovery_pct);
  const poorSites = recoveryBySite.filter((c) => c.recovery_pct < 10);
  const goodSites = recoveryBySite.filter((c) => c.recovery_pct >= 10);
  const avg = (xs, k) => xs.reduce((t, x) => t + x[k], 0) / xs.length;

  const byReason = [...recovery]
    .reduce((acc, r) => {
      const hit = acc.find((a) => a.rejection_reason === r.rejection_reason);
      if (hit) {
        hit.ever_rejected += r.ever_rejected;
        hit.recovered_claims += r.recovered_claims;
        hit.outstanding_zar += r.outstanding_zar;
      } else {
        acc.push({
          rejection_reason: r.rejection_reason,
          rejection_class: r.rejection_class,
          ever_rejected: r.ever_rejected,
          recovered_claims: r.recovered_claims,
          outstanding_zar: r.outstanding_zar,
        });
      }
      return acc;
    }, [])
    .map((r) => ({ ...r, recovery_pct: (r.recovered_claims / r.ever_rejected) * 100 }))
    .sort((a, b2) => b2.outstanding_zar - a.outstanding_zar);

  const unreminded = noShow.filter((r) => !r.reminder_sent);
  const reminded = noShow.filter((r) => r.reminder_sent);
  const bestCell = reminded.reduce((a, c) => (c.no_show_pct < a.no_show_pct ? c : a));
  const worstCell = unreminded.reduce((a, c) => (c.no_show_pct > a.no_show_pct ? c : a));

  // Split by charge type, never blended. Averaging the two gives about seventy per cent at
  // every site, which is a number that describes neither of the behaviours inside it.
  const chargeType = (name) => {
    const rows = charges.filter((c) => c.payment_type === name);
    const due = rows.reduce((t, r) => t + r.due_zar, 0);
    const lines = rows.reduce((t, r) => t + r.charge_lines, 0);
    return {
      name,
      collected_pct: rows[0].type_collected_pct,
      due,
      paid: rows.reduce((t, r) => t + r.paid_zar, 0),
      lo: Math.min(...rows.map((r) => r.collected_pct)),
      hi: Math.max(...rows.map((r) => r.collected_pct)),
      avg_charge: due / lines,
    };
  };
  const selfFunded = chargeType('Self funded');
  const schemeGap = chargeType('Scheme gap');
  const gapTotals = clinics.reduce((t, c) => ({
    due: t.due + c.patient_due_zar, paid: t.paid + c.patient_paid_zar,
  }), { due: 0, paid: 0 });

  const disciplines = [...new Set(practitioners.map((p) => p.discipline))]
    .map((d) => {
      const rows = practitioners.filter((p) => p.discipline === d);
      return {
        discipline: d, n: rows.length,
        lo: Math.min(...rows.map((r) => r.fill_pct)),
        hi: Math.max(...rows.map((r) => r.fill_pct)),
        cheap: Math.min(...rows.map((r) => r.cost_per_attended_zar)),
        dear: Math.max(...rows.map((r) => r.cost_per_attended_zar)),
      };
    })
    .filter((d) => d.n >= 3)
    .sort((a, b2) => b2.n - a.n);

  // Both of these are stated in the copy below, so they are measured rather than remembered.
  // An earlier draft called the lead time effect "roughly three" no-shows per hundred and the
  // practitioner spread "roughly twice"; the data says 3.6 and 2.5.
  const leadCells = weekdayGrid.filter(
    (g) => g.avg_booking_lead_days != null && g.no_show_pct != null);
  const meanLead = leadCells.reduce((t, g) => t + g.avg_booking_lead_days, 0) / leadCells.length;
  const meanNoShow = leadCells.reduce((t, g) => t + g.no_show_pct, 0) / leadCells.length;
  const noShowPerSixDays = 6 *
    leadCells.reduce((t, g) => t + (g.avg_booking_lead_days - meanLead) * (g.no_show_pct - meanNoShow), 0) /
    leadCells.reduce((t, g) => t + (g.avg_booking_lead_days - meanLead) ** 2, 0);

  const gps = practitioners.filter((x) => x.discipline === 'General practice');
  const gpCostSpread = Math.max(...gps.map((x) => x.cost_per_attended_zar))
    / Math.min(...gps.map((x) => x.cost_per_attended_zar));

  const slowest = [...schemes].sort((a, b2) => b2.avg_days_to_settle - a.avg_days_to_settle)[0];
  const workingCapital = schemes.reduce((t, s) => t + s.working_capital_zar, 0);

  // ---------------------------------------------------------------- markup

  el('main').innerHTML = `

  <section>
    <div class="section-head"><span class="section-num">01</span><h2>Where the money went</h2></div>
    <p class="lede">
      Over the ${monthly.length} months to ${longDate(m.data_through)} the group saw patients
      <b>${fmtNum(clinics.reduce((t, c) => t + c.attended, 0))}</b> times across six sites and
      billed <b>${fmtR(b.billed_zar)}</b> for the care it delivered. It collected
      <b>${fmtR(b.cash_received_zar)}</b> of that. Nothing was stolen and nobody was negligent.
      It leaked out through a claims inbox nobody opens and a card machine nobody reaches for.
    </p>

    <div class="hero">
      <div class="hero-value">${fmtR(b.total_leakage_zar)}</div>
      <div class="hero-label">
        billed for care already delivered and never collected, which is
        <b>${fmtPct(b.leakage_pct_of_billed, 1)}</b> of everything the group invoiced.
      </div>
    </div>

    <div class="tiles">
      <div class="tile">
        <div class="tile-label">Billed</div>
        <div class="tile-value">${fmtR(b.billed_zar)}</div>
        <div class="tile-delta">for care delivered</div>
      </div>
      <div class="tile">
        <div class="tile-label">Owed by schemes</div>
        <div class="tile-value">${fmtR(b.scheme_shortfall_zar)}</div>
        <div class="tile-delta">rejected or short paid, never recovered</div>
      </div>
      <div class="tile">
        <div class="tile-label">Owed by patients</div>
        <div class="tile-value">${fmtR(b.patient_shortfall_zar)}</div>
        <div class="tile-delta">gap and self funded, never collected</div>
      </div>
      <div class="tile">
        <div class="tile-label">Cash received</div>
        <div class="tile-value">${fmtR(b.cash_received_zar)}</div>
        <div class="tile-delta">${fmtPct(100 - b.leakage_pct_of_billed, 1)} of billings</div>
      </div>
    </div>

    ${figure({
      id: 'fig-bridge',
      title: 'From care delivered to cash received',
      note: `Every rand of the shortfall lands in exactly one bucket, and the buckets are set by
             who has to do something about it. The three steps belong to three different people:
             the billing clerk works the rejections, the practice manager raises an account when
             the scheme says there was no cover, and reception asks for the gap before the
             patient stands up. Anchor less every step equals the cash received to the rand, and
             the model asserts it on a column: the reconciliation gap is
             ${fmtR(b.reconciliation_gap_zar)}.`,
      tableHtml: table(
        [
          { key: 'step_label', label: 'Step' },
          { key: 'effect_zar', label: 'Effect', align: 'right', fmt: fmtR,
            cls: (val, r) => (r.step_type === 'decrease' ? 'neg' : '') },
          { key: 'running_total_zar', label: 'Running total', align: 'right', fmt: fmtR },
        ],
        bridge,
        { caption: 'Collection bridge over the whole window' }
      ),
    })}

    <div class="callout caution">
      <b>Two numbers that must not be added together.</b> The ${fmtR(b.total_leakage_zar)} above is
      revenue that was billed and never arrived. Section 02 puts a figure on clinician time the
      group paid for and nobody sat in, and section 05 puts a figure on cash that arrives late.
      Those are three different quantities: revenue foregone, cost incurred, and working capital.
      Adding any two of them produces a total that is wrong in both directions, and the first
      person in the room who knows the business will say so.
    </div>
  </section>

  <section>
    <div class="section-head"><span class="section-num">02</span><h2>The week is lopsided, and the roster is not</h2></div>
    <p class="lede">
      The roster barely changes from Monday to Friday. Demand is nothing like it. On a
      <b>${quietest.day_name} at ${quietest.slot_label}</b> the rooms are
      <b>${fmtPct(quietest.fill_pct)}</b> full and the patients who come are seen in
      ${quietest.avg_wait_minutes} minutes. On a <b>${busiest.day_name} at ${busiest.slot_label}</b>
      they are <b>${fmtPct(busiest.fill_pct)}</b> full and the wait is
      <b>${busiest.avg_wait_minutes} minutes</b>. Same practice, same clinicians, same rooms.
    </p>

    ${figure({
      id: 'fig-grid',
      title: 'Slot fill by weekday and hour',
      note: `Every consulting slot the group offered over the window, placed in the hour it
             starts in. A slot that crosses the hour is counted in the hour it begins, because
             that is where the diary puts it. Hover or tab a cell for the wait, the no-shows and
             what the empty chairs in it cost.`,
      legendHtml: scaleLegend(FILL_RAMP, 'Empty', 'Full'),
    })}

    ${figure({
      id: 'fig-wait',
      title: 'Average wait by weekday and hour',
      note: `The same grid measured the other way, and a deliberately different hue: waiting
             time and slot fill are different quantities, and sharing a ramp would invite you to
             read them as one. Compare the two and they are almost the same shape, which is
             the finding: the hours that fill are the hours people queue in, and the hours
             nobody wants have no wait at all. Capacity is not short, it is in the wrong
             place.`,
      legendHtml: scaleLegend(WAIT_RAMP, 'Seen on time', 'Long wait'),
    })}

    ${figure({
      id: 'fig-day',
      title: 'What the empty chairs cost, by weekday',
      note: `A session is bought whole. The group pays the sessional rate whether twenty
             patients come through it or four, so an unfilled slot is money that left the bank
             and bought nothing.`,
      tableHtml: table(
        [
          { key: 'name', label: 'Weekday' },
          { key: 'offered', label: 'Slots offered', align: 'right', fmt: fmtNum },
          { key: 'booked', label: 'Booked', align: 'right', fmt: fmtNum },
          { key: 'fill_pct', label: 'Fill', align: 'right', fmt: (n) => fmtPct(n) },
          { key: 'unfilled_cost_zar', label: 'Cost of the empty ones', align: 'right', fmt: fmtR },
        ],
        byDay
      ),
    })}

    <div class="tiles">
      <div class="tile">
        <div class="tile-label">Slots offered</div>
        <div class="tile-value">${fmtNum(cap.all_slots)}</div>
        <div class="tile-delta">${fmtPct(cap.all_fill_pct)} of them booked</div>
      </div>
      <div class="tile">
        <div class="tile-label">Chairs with nobody in them</div>
        <div class="tile-value">${fmtPct(cap.all_empty_pct)}</div>
        <div class="tile-delta">${fmtNum(cap.all_unfilled)} never booked, ${fmtNum(cap.all_no_show)} did not arrive</div>
      </div>
      <div class="tile">
        <div class="tile-label">Clinician cost of that</div>
        <div class="tile-value">${fmtR(cap.all_unfilled_cost_zar + cap.all_no_show_cost_zar)}</div>
        <div class="tile-delta">of ${fmtR(cap.all_cost_zar)} spent on the roster</div>
      </div>
      <div class="tile">
        <div class="tile-label">Roster above a ${fmtPct(cap.target_fill_pct, 0)} diary</div>
        <div class="tile-value">${fmtR(cap.all_excess_cost_zar)}</div>
        <div class="tile-delta">${fmtNum(cap.all_excess_slots)} slots, assuming no patient moves</div>
      </div>
    </div>

    <div class="callout method">
      <b>Why the target is ${fmtPct(cap.target_fill_pct, 0)} and not 100%.</b> A diary with no slack
      cannot take an urgent case, and a practice that books to the last slot is the practice with
      the ${busiest.avg_wait_minutes} minute waits in the grid above. The excess figure is
      deliberately the conservative one: cell by cell it asks how much capacity a diary at
      ${fmtPct(cap.target_fill_pct, 0)} would need to serve the demand that <em>already falls in
      that cell</em>, and counts only what is above it. It assumes not one patient moves to a
      quieter hour. Moving them is the better answer, and the grid says exactly how many and when.
    </div>
  </section>

  <section>
    <div class="section-head"><span class="section-num">03</span><h2>Rejected claims that nobody worked</h2></div>
    <p class="lede">
      <b>${fmtNum(rec.all_rejected)}</b> claims came back rejected or short paid,
      ${fmtPct(rec.all_rejection_pct)} of everything submitted. ${fmtR(rec.all_recovered_zar)} was
      recovered by fixing and resubmitting. <b>${fmtR(rec.all_outstanding_zar)} was not.</b> The
      scheme allows four months from the date of service, and after that the money is gone
      whoever was at fault, which is what makes an unworked rejection different from a slow one.
    </p>

    ${figure({
      id: 'fig-recovery',
      title: 'Share of rejections recovered, by site',
      note: `The denominator is every claim that ever came back, including the ones that were
             fixed and paid. Measuring against the claims still outstanding would flatter the
             sites that work their inbox, because they have fewer left.`,
      tableHtml: table(
        [
          { key: 'clinic_name', label: 'Site' },
          { key: 'ever_rejected', label: 'Ever rejected', align: 'right', fmt: fmtNum },
          { key: 'recovered_claims', label: 'Recovered', align: 'right', fmt: fmtNum },
          { key: 'recovery_pct', label: 'Recovery rate', align: 'right', fmt: (n) => fmtPct(n) },
          { key: 'scheme_shortfall_zar', label: 'Still outstanding', align: 'right', fmt: fmtR },
        ],
        recoveryBySite
      ),
    })}

    <p class="lede">
      ${poorSites.length === 2 ? 'Two sites' : `${poorSites.length} sites`} recover about one
      rejection in ${Math.round(100 / avg(poorSites, 'recovery_pct'))}. The other
      ${goodSites.length} recover about one in ${Math.round(100 / avg(goodSites, 'recovery_pct'))}.
      Same schemes, same claim types, same software. The difference is whether anybody opens the
      inbox.
    </p>

    ${figure({
      id: 'fig-reasons',
      title: 'What is still outstanding, and what it would take to get it',
      note: `Split by the work required rather than by what the scheme said, because a claim
             rejected for a missing referral and a claim rejected because the member had no cover
             are the same rand and completely different jobs.`,
      legendHtml: legend([
        { name: 'Fixable at the practice', color: v('--s1') },
        { name: 'No cover, becomes a patient account', color: v('--s2') },
      ]),
      tableHtml: table(
        [
          { key: 'rejection_reason', label: 'Reason' },
          { key: 'rejection_class', label: 'What it would take' },
          { key: 'ever_rejected', label: 'Claims', align: 'right', fmt: fmtNum },
          { key: 'recovery_pct', label: 'Recovered', align: 'right', fmt: (n) => fmtPct(n) },
          { key: 'outstanding_zar', label: 'Outstanding', align: 'right', fmt: fmtR },
        ],
        byReason
      ),
    })}

    <div class="callout">
      <b>${fmtR(rec.all_fixable_outstanding_zar)} is fixable at the practice.</b> A diagnosis code,
      a referral, an authorisation, a practice number. That is one clerk and a working week.
      <br><br>
      <b>${fmtR(rec.all_no_cover_outstanding_zar)} was never the scheme's to pay.</b> The member had
      no cover, the benefit was exhausted, the service was not on the plan. The scheme is right to
      refuse it. But the patient was treated, and nobody ever raised an account. That money is not
      a claims problem at all, and it is the half of this finding most people miss.
    </div>
  </section>

  <section>
    <div class="section-head"><span class="section-num">04</span><h2>The patients who never arrived</h2></div>
    <p class="lede">
      <b>${fmtNum(ns.all_no_shows)}</b> booked appointments were no-shows,
      ${fmtPct(ns.all_no_show_pct)} of everything booked. Read the two drivers together rather
      than separately: a booking made
      <b>${bestCell.booking_lead_band.toLowerCase()}</b> ahead with a reminder fails
      <b>${fmtPct(bestCell.no_show_pct)}</b> of the time, and one made
      <b>${worstCell.booking_lead_band.toLowerCase()}</b> ahead with no reminder fails
      <b>${fmtPct(worstCell.no_show_pct)}</b> of the time. Same practice, same patients.
    </p>

    ${figure({
      id: 'fig-noshow',
      title: 'No-show rate by booking lead time and reminder',
      note: `Each pair of bars is one lead band: the bookings that got a reminder beside the ones
             that did not. The gap between them is the lever.`,
      legendHtml: legend([
        { name: 'Reminder sent', color: v('--s1') },
        { name: 'No reminder', color: v('--s2') },
      ]) + legend([
        { name: `Group average, ${fmtPct(ns.all_no_show_pct)}`, color: v('--ink-3') },
      ], true),
      tableHtml: table(
        [
          { key: 'booking_lead_band', label: 'Lead time' },
          { key: 'reminder_sent', label: 'Reminder', fmt: (x) => (x ? 'yes' : 'no') },
          { key: 'appointments', label: 'Bookings', align: 'right', fmt: fmtNum },
          { key: 'no_show_pct', label: 'No-show rate', align: 'right', fmt: (n) => fmtPct(n) },
          { key: 'recoverable_visits', label: 'Recoverable visits', align: 'right', fmt: (n) => (n ? fmtNum(n) : '') },
          { key: 'recoverable_zar', label: 'Worth', align: 'right', fmt: (n) => (n ? fmtR(n) : '') },
        ],
        noShow
      ),
    })}

    <div class="tiles">
      <div class="tile">
        <div class="tile-label">Never reminded</div>
        <div class="tile-value">${fmtPct(ns.unreminded_pct)}</div>
        <div class="tile-delta">${fmtNum(ns.unreminded_appointments)} of ${fmtNum(ns.all_appointments)}</div>
      </div>
      <div class="tile">
        <div class="tile-label">Visits recoverable</div>
        <div class="tile-value">${fmtNum(ns.all_recoverable_visits)}</div>
        <div class="tile-delta">held to the reminded rate already observed</div>
      </div>
      <div class="tile">
        <div class="tile-label">Worth</div>
        <div class="tile-value">${fmtR(ns.all_recoverable_zar)}</div>
        <div class="tile-delta">at ${fmtR2(ns.revenue_per_visit_zar)} an average visit</div>
      </div>
      <div class="tile">
        <div class="tile-label">Cost of the reminder</div>
        <div class="tile-value">cents</div>
        <div class="tile-delta">one SMS per booking</div>
      </div>
    </div>

    ${figure({
      id: 'fig-reminders',
      title: 'Reminder coverage by site',
      note: `Reminder discipline is a front desk habit and it is in no source file. The only
             trace of it is the flag on the bookings each site takes. Mind the range: front desk
             habit moves a site's no-show rate by a few points, while lead time and the reminder
             itself move it by thirty. This chart says who to talk to, not how big the prize is.`,
      tableHtml: table(
        [
          { key: 'clinic_name', label: 'Site' },
          { key: 'appointments', label: 'Bookings', align: 'right', fmt: fmtNum },
          { key: 'reminded_pct', label: 'Reminders sent', align: 'right', fmt: (n) => fmtPct(n) },
          { key: 'no_show_pct', label: 'No-show rate', align: 'right', fmt: (n) => fmtPct(n) },
          { key: 'avg_lead_days', label: 'Average lead', align: 'right', fmt: (n) => `${n} days` },
        ],
        [...clinics].sort((a, b2) => a.reminded_pct - b2.reminded_pct)
      ),
    })}

    <div class="callout method">
      <b>What the recoverable figure does and does not claim.</b> Within each lead band it takes
      the no-show rate already observed on the bookings that <em>did</em> get a reminder, and
      applies it to the ones that did not. It is this practice's own behaviour, not a benchmark
      from somewhere else. It assumes nothing whatsoever about shortening lead times, which is
      the larger effect and the harder change.
      <br><br>
      The link back to section 02, in this order. How full an hour is and how far ahead it gets
      booked move together almost exactly. The busy cells are taken weeks out because they are
      the only ones left, and the bookings made weeks out are the ones that do not arrive. The
      relationship is tight and the size of it is modest: six extra days of lead time is worth
      about <b>${noShowPerSixDays.toFixed(1)} no-shows in every hundred</b>. The diary imbalance
      is a contributor, not the main cause. The reminder is the main cause.
    </div>
  </section>

  <section>
    <div class="section-head"><span class="section-num">05</span><h2>The gap at reception, and the scheme that pays late</h2></div>
    <p class="lede">
      A patient with no scheme owes the whole bill, an average of
      <b>${fmtR(selfFunded.avg_charge)}</b>, and pays it
      <b>${fmtPct(selfFunded.collected_pct)}</b> of the time. A patient whose scheme covers most
      of it owes only the remainder, an average of <b>${fmtR(schemeGap.avg_charge)}</b>, and pays
      that <b>${fmtPct(schemeGap.collected_pct)}</b> of the time. Same desk, same card machine,
      same staff. The smaller the amount, the less likely anybody asks for it, and
      <b>${fmtR(gapTotals.due - gapTotals.paid)}</b> is sitting uncollected because of it.
    </p>

    ${figure({
      id: 'fig-gap',
      title: 'Share of the patient charge collected, by site and charge type',
      note: `Every site, both charge types, sorted by collection rate. The two clusters do not
             overlap and they do not cross: the gap runs between ${fmtPct(schemeGap.lo)} and
             ${fmtPct(schemeGap.hi)} everywhere, the self funded charge between
             ${fmtPct(selfFunded.lo)} and ${fmtPct(selfFunded.hi)}. That is what makes this a
             process and not a site. Blending the two gives about
             ${fmtPct(100 * gapTotals.paid / gapTotals.due)} at every site, which describes
             neither behaviour, and is why that figure is nowhere on this page.`,
      legendHtml: legend([
        { name: 'Self funded, whole bill owed', color: v('--s1') },
        { name: 'Scheme gap, the part not covered', color: v('--s3') },
      ]),
      tableHtml: table(
        [
          { key: 'clinic_name', label: 'Site' },
          { key: 'payment_type', label: 'Charge type' },
          { key: 'charge_lines', label: 'Charges', align: 'right', fmt: fmtNum },
          { key: 'avg_charge_zar', label: 'Average charge', align: 'right', fmt: fmtR2 },
          { key: 'due_zar', label: 'Charged', align: 'right', fmt: fmtR },
          { key: 'paid_zar', label: 'Collected', align: 'right', fmt: fmtR },
          { key: 'collected_pct', label: 'Rate', align: 'right', fmt: (n) => fmtPct(n) },
          { key: 'uncollected_zar', label: 'Left on the table', align: 'right', fmt: fmtR, cls: () => 'neg' },
        ],
        charges
      ),
    })}

    ${figure({
      id: 'fig-schemes',
      title: 'How long each scheme takes to settle',
      note: `Measured from submission to payment, not from the date of service, so a slow scheme
             and a slow practice stay two different numbers.`,
      legendHtml: legend([
        { name: `Group median, ${Math.round(schemes[0].group_median_days)} days`, color: v('--ink-3') },
      ], true),
      tableHtml: table(
        [
          { key: 'scheme_name', label: 'Scheme' },
          { key: 'claims', label: 'Claims', align: 'right', fmt: fmtNum },
          { key: 'claimed_zar', label: 'Claimed', align: 'right', fmt: fmtR },
          { key: 'denial_pct', label: 'Denial rate', align: 'right', fmt: (n) => fmtPct(n) },
          { key: 'avg_days_to_settle', label: 'Settles in', align: 'right', fmt: (n) => `${n} days` },
          { key: 'working_capital_zar', label: 'Working capital', align: 'right', fmt: fmtR },
        ],
        schemes
      ),
    })}

    <div class="callout caution">
      <b>${slowest.scheme_name} settles about
      ${Math.round(slowest.days_beyond_group_median / 7)} weeks later than the rest.</b> At this
      practice's own claim volume that one scheme ties up ${fmtR(slowest.working_capital_zar)},
      and every payer running beyond the group median adds to ${fmtR(workingCapital)} the group is
      permanently financing.
      <br><br>
      That money is <b>not lost</b>. It arrives. It just arrives late, and in the meantime
      somebody is paying for the overdraft. It is a balance sheet number, and it is never added
      to the ${fmtR(b.total_leakage_zar)} at the top of this page.
    </div>
  </section>

  <section>
    <div class="section-head"><span class="section-num">06</span><h2>The same session rate, very different diaries</h2></div>
    <p class="lede">
      Compare within a discipline and never across one. A radiologist and a dietician are bought
      at different prices and see patients at different rates, so a single league table of all of
      them says nothing except which discipline is expensive.
    </p>

    ${figure({
      id: 'fig-prac',
      title: 'Sessional cost per patient actually seen',
      note: `What the group paid in clinician time for each patient who sat down, against the
             median of that practitioner's own discipline. Across general practice alone, where
             the session rates sit within a few per cent of each other, the dearest patient
             costs <b>${gpCostSpread.toFixed(1)} times</b> the cheapest.`,
      legendHtml: legend(disciplines.map((d, i) => ({
        name: d.discipline, color: v(['--s1', '--s2', '--s3', '--s4'][i % 4]),
      }))),
      tableHtml: table(
        [
          { key: 'practitioner_name', label: 'Practitioner' },
          { key: 'discipline', label: 'Discipline' },
          { key: 'clinic_name', label: 'Site' },
          { key: 'session_rate_zar', label: 'Session rate', align: 'right', fmt: fmtR },
          { key: 'fill_pct', label: 'Fill', align: 'right', fmt: (n) => fmtPct(n) },
          { key: 'cost_per_attended_zar', label: 'Cost per visit', align: 'right', fmt: fmtR },
          { key: 'cost_ratio_vs_peers', label: 'Against peers', align: 'right', fmt: (n) => `${n}x` },
        ],
        practitioners.filter((p) => p.peers >= 3)
      ),
    })}

    <div class="callout">
      <b>Say the caveat before somebody else does.</b> A low fill rate is usually a statement
      about when somebody was rostered, not about the clinician. That is why the weekday grid
      comes first on this page. This section says where the money goes. The grid says why.
    </div>
  </section>

  <section>
    <div class="section-head"><span class="section-num">07</span><h2>The trend, and the state of the data</h2></div>

    ${figure({
      id: 'fig-monthly',
      title: 'Slot fill, no-shows and collection, month by month',
      note: `Partial months at either end of the export are dropped rather than plotted short: a
             partial month beside a whole one reads as a collapse. Every rate is against its own
             month's denominator.`,
      legendHtml: legend([
        { name: 'Slot fill', color: v('--s1') },
        { name: 'Patient charges collected', color: v('--s3') },
        { name: 'No-show rate', color: v('--s2') },
      ], true),
      tableHtml: table(
        [
          { key: 'month_label', label: 'Month' },
          { key: 'appointments', label: 'Bookings', align: 'right', fmt: fmtNum },
          { key: 'fill_pct', label: 'Fill', align: 'right', fmt: (n) => fmtPct(n) },
          { key: 'no_show_pct', label: 'No-show', align: 'right', fmt: (n) => fmtPct(n) },
          { key: 'gap_collected_pct', label: 'Patient charges collected', align: 'right', fmt: (n) => fmtPct(n) },
          { key: 'billed_zar', label: 'Billed', align: 'right', fmt: fmtR },
          { key: 'clinician_cost_pct', label: 'Clinician cost', align: 'right', fmt: (n) => fmtPct(n) },
        ],
        monthly
      ),
    })}

    ${figure({
      id: 'fig-quality',
      hasChart: false,
      title: 'Defects in the source files, and what was done about each',
      note: `Every one of these exists in the exports and every one survives into the warehouse
             as a flag rather than a deletion. Publishing it is the whole argument: a dashboard
             that quietly drops the rows it cannot reconcile is how a practice comes to believe a
             number that is several per cent short, with no way of finding out. The zero row
             belongs here too, because a quality panel that only lists failures cannot tell you
             what was checked.`,
      tableHtml: table(
        [
          { key: 'issue', label: 'Defect' },
          { key: 'source_table', label: 'Source' },
          { key: 'rows_affected', label: 'Rows', align: 'right', fmt: fmtNum },
          { key: 'impact_zar', label: 'Value touched', align: 'right', fmt: (n) => (n ? fmtR(n) : '') },
          { key: 'treatment', label: 'Treatment' },
        ],
        quality
      ),
    })}
  </section>
  `;

  // ---------------------------------------------------------------- charts

  waterfall(el('fig-bridge'), {
    rows: bridge.map((r) => ({
      label: r.step_short,
      value: r.effect_zar,
      type: r.step_type,
      tip: `<b>${esc(r.step_label)}</b>`
        + `<div class="tip-row"><span>Effect</span><span>${fmtRc(r.effect_zar)}</span></div>`
        + `<div class="tip-row"><span>Running total</span><span>${fmtR(r.running_total_zar)}</span></div>`,
    })),
    height: 340,
    zeroBaseline: false,
  });

  el('fig-grid').innerHTML = heatGrid(grid, {
    key: 'fill_pct',
    ramp: FILL_RAMP,
    domain: [
      Math.min(...grid.map((g) => g.fill_pct)),
      Math.max(...grid.map((g) => g.fill_pct)),
    ],
    fmt: (n) => Math.round(n) + '%',
    label: 'Percentage of offered slots that were booked',
  });
  el('fig-wait').innerHTML = heatGrid(grid, {
    key: 'avg_wait_minutes',
    ramp: WAIT_RAMP,
    domain: [
      Math.min(...grid.filter((g) => g.avg_wait_minutes != null).map((g) => g.avg_wait_minutes)),
      Math.max(...grid.filter((g) => g.avg_wait_minutes != null).map((g) => g.avg_wait_minutes)),
    ],
    fmt: (n) => (n == null ? '' : Math.round(n) + 'm'),
    label: 'Average minutes between the appointment time and being seen',
  });
  wireHeat(el('fig-grid'));
  wireHeat(el('fig-wait'));

  barsH(el('fig-day'), {
    rows: byDay.map((d) => ({
      label: d.name,
      value: d.unfilled_cost_zar,
      color: v('--s1'),
      tip: `<b>${esc(d.name)}</b>`
        + `<div class="tip-row"><span>Slots offered</span><span>${fmtNum(d.offered)}</span></div>`
        + `<div class="tip-row"><span>Booked</span><span>${fmtNum(d.booked)}</span></div>`
        + `<div class="tip-row"><span>Fill</span><span>${fmtPct(d.fill_pct)}</span></div>`
        + `<div class="tip-row"><span>Empty chairs cost</span><span>${fmtR(d.unfilled_cost_zar)}</span></div>`,
    })),
    valueFmt: fmtR,
    labelWidth: 110,
  });

  barsH(el('fig-recovery'), {
    rows: recoveryBySite.map((c) => ({
      label: c.clinic_name.replace('Lumen ', ''),
      value: c.recovery_pct,
      color: v(c.recovery_pct < 10 ? '--s2' : '--s1'),
      tip: `<b>${esc(c.clinic_name)}</b>`
        + `<div class="tip-row"><span>Ever rejected</span><span>${fmtNum(c.ever_rejected)}</span></div>`
        + `<div class="tip-row"><span>Recovered</span><span>${fmtNum(c.recovered_claims)}</span></div>`
        + `<div class="tip-row"><span>Still outstanding</span><span>${fmtR(c.scheme_shortfall_zar)}</span></div>`,
    })),
    valueFmt: (n) => fmtPct(n),
    labelWidth: 150,
  });

  barsH(el('fig-reasons'), {
    rows: byReason.map((r) => ({
      label: r.rejection_reason,
      value: r.outstanding_zar,
      color: v(r.rejection_class === 'Fixable at the practice' ? '--s1' : '--s2'),
      tip: `<b>${esc(r.rejection_reason)}</b>`
        + `<div class="tip-row"><span>What it takes</span><span>${esc(r.rejection_class)}</span></div>`
        + `<div class="tip-row"><span>Claims</span><span>${fmtNum(r.ever_rejected)}</span></div>`
        + `<div class="tip-row"><span>Recovered</span><span>${fmtPct(r.recovery_pct)}</span></div>`
        + `<div class="tip-row"><span>Outstanding</span><span>${fmtR(r.outstanding_zar)}</span></div>`,
    })),
    valueFmt: fmtR,
    labelWidth: 280,
  });

  // No-show: paired columns, reminded beside unreminded, in lead-band order.
  columns(el('fig-noshow'), {
    rows: noShow.map((r) => ({
      x: r.reminder_sent ? '' : r.booking_lead_band,
      y: r.no_show_pct,
      color: v(r.reminder_sent ? '--s1' : '--s2'),
      tip: `<b>${esc(r.booking_lead_band)}</b>, ${r.reminder_sent ? 'reminder sent' : 'no reminder'}`
        + `<div class="tip-row"><span>Bookings</span><span>${fmtNum(r.appointments)}</span></div>`
        + `<div class="tip-row"><span>No-show rate</span><span>${fmtPct(r.no_show_pct)}</span></div>`
        + (r.recoverable_visits
            ? `<div class="tip-row"><span>Recoverable</span><span>${fmtNum(r.recoverable_visits)} visits</span></div>`
              + `<div class="tip-row"><span>Worth</span><span>${fmtR(r.recoverable_zar)}</span></div>`
            : ''),
    })),
    height: 300,
    valueFmt: (n) => fmtPct(n, 0),
    refLine: { value: ns.all_no_show_pct, label: '' },
    yLabel: 'No-show rate',
  });

  barsH(el('fig-gap'), {
    rows: [...charges]
      .sort((a, b2) => a.collected_pct - b2.collected_pct)
      .map((c) => ({
        label: `${c.clinic_name.replace('Lumen ', '')} \u00b7 ${c.payment_type}`,
        value: c.collected_pct,
        color: v(c.payment_type === 'Self funded' ? '--s1' : '--s3'),
        tip: `<b>${esc(c.clinic_name)}</b>, ${esc(c.payment_type.toLowerCase())}`
          + `<div class="tip-row"><span>Charges raised</span><span>${fmtNum(c.charge_lines)}</span></div>`
          + `<div class="tip-row"><span>Average charge</span><span>${fmtR2(c.avg_charge_zar)}</span></div>`
          + `<div class="tip-row"><span>Charged</span><span>${fmtR(c.due_zar)}</span></div>`
          + `<div class="tip-row"><span>Collected</span><span>${fmtR(c.paid_zar)}</span></div>`
          + `<div class="tip-row"><span>Left on the table</span><span>${fmtR(c.uncollected_zar)}</span></div>`,
      })),
    valueFmt: (n) => fmtPct(n),
    rowHeight: 30,
    labelWidth: 230,
  });

  const medianDays = schemes[0].group_median_days;
  columns(el('fig-schemes'), {
    rows: schemes.map((s) => ({
      x: s.scheme_name.replace(' Health', '').replace(' Medical', '').replace(' Scheme', ''),
      y: s.avg_days_to_settle,
      color: v(s.days_beyond_group_median > 7 ? '--s2' : '--s1'),
      tip: `<b>${esc(s.scheme_name)}</b>`
        + `<div class="tip-row"><span>Claims</span><span>${fmtNum(s.claims)}</span></div>`
        + `<div class="tip-row"><span>Claimed</span><span>${fmtR(s.claimed_zar)}</span></div>`
        + `<div class="tip-row"><span>Settles in</span><span>${s.avg_days_to_settle} days</span></div>`
        + `<div class="tip-row"><span>Stated terms</span><span>${s.payment_terms_days} days</span></div>`
        + `<div class="tip-row"><span>Working capital</span><span>${fmtR(s.working_capital_zar)}</span></div>`,
    })),
    height: 280,
    valueFmt: (n) => `${Math.round(n)}d`,
    refLine: { value: medianDays, label: '' },
    yLabel: 'Days to settle',
  });

  const discColor = Object.fromEntries(
    disciplines.map((d, i) => [d.discipline, v(['--s1', '--s2', '--s3', '--s4'][i % 4])])
  );
  barsH(el('fig-prac'), {
    rows: practitioners
      .filter((p) => p.peers >= 3)
      .sort((a, b2) => b2.cost_per_attended_zar - a.cost_per_attended_zar)
      .map((p) => ({
        label: `${p.practitioner_name.replace('Dr ', '')} · ${p.clinic_name.replace('Lumen ', '')}`,
        value: p.cost_per_attended_zar,
        color: discColor[p.discipline],
        tip: `<b>${esc(p.practitioner_name)}</b>, ${esc(p.discipline)}`
          + `<div class="tip-row"><span>Session rate</span><span>${fmtR(p.session_rate_zar)}</span></div>`
          + `<div class="tip-row"><span>Fill</span><span>${fmtPct(p.fill_pct)}</span></div>`
          + `<div class="tip-row"><span>Cost per visit</span><span>${fmtR(p.cost_per_attended_zar)}</span></div>`
          + `<div class="tip-row"><span>Discipline median</span><span>${fmtR(p.peer_median_cost_per_attended_zar)}</span></div>`
          + `<div class="tip-row"><span>Against peers</span><span>${p.cost_ratio_vs_peers}x</span></div>`,
      })),
    valueFmt: fmtR,
    rowHeight: 30,
    labelWidth: 260,
  });

  barsH(el('fig-reminders'), {
    rows: [...clinics].sort((a, b2) => a.reminded_pct - b2.reminded_pct).map((c) => ({
      label: c.clinic_name.replace('Lumen ', ''),
      value: c.reminded_pct,
      color: v('--s1'),
      tip: `<b>${esc(c.clinic_name)}</b>`
        + `<div class="tip-row"><span>Bookings</span><span>${fmtNum(c.appointments)}</span></div>`
        + `<div class="tip-row"><span>Reminders sent</span><span>${fmtPct(c.reminded_pct)}</span></div>`
        + `<div class="tip-row"><span>No-show rate</span><span>${fmtPct(c.no_show_pct)}</span></div>`
        + `<div class="tip-row"><span>Average lead</span><span>${c.avg_lead_days} days</span></div>`,
    })),
    valueFmt: (n) => fmtPct(n),
    labelWidth: 150,
  });

  lines(el('fig-monthly'), {
    series: [
      { name: 'Slot fill', color: v('--s1'),
        points: monthly.map((r) => ({ x: r.month_label, y: r.fill_pct })) },
      { name: 'Patient charges collected', color: v('--s3'),
        points: monthly.map((r) => ({ x: r.month_label, y: r.gap_collected_pct })) },
      { name: 'No-show rate', color: v('--s2'),
        points: monthly.map((r) => ({ x: r.month_label, y: r.no_show_pct })) },
    ],
    height: 300,
    xEvery: 3,
  });

  wireTableToggles(el('main'));

  // The quality panel is the one table on the page that opens by default. Hiding the defects
  // behind a toggle would defeat the reason for publishing them. Wired first, then clicked:
  // the other way round the handler does not exist yet and the click silently does nothing.
  const qToggle = document.querySelector('[data-table="fig-quality"]');
  if (qToggle) qToggle.click();
}

// ---------------------------------------------------------------- boot

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
