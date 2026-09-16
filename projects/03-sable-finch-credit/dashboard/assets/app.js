/*
  Sable & Finch Credit, Portfolio Risk Review.

  Opens on the one thing a portfolio at risk number cannot tell you: whether the business is
  writing better or worse loans than it was a year ago. Every chart carries a table twin,
  which matters more here than anywhere else in this suite, because a credit committee is
  going to want the row.
*/

import { connect, q, meta } from './db.js';
import {
  waterfall, columns, barsH, lines, legend, table, figure, wireTableToggles,
  showTip, hideTip, esc, fmtR, fmtRc, fmtR2, fmtNum, fmtPct, fmtMonth,
} from './charts.js';

const el = (id) => document.getElementById(id);
const v = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const signed = (n, dp = 1) =>
  n === null || n === undefined || Number.isNaN(n) ? '-' : (n >= 0 ? '+' : '') + n.toFixed(dp) + '%';
const COHORT_RAMP = ['--c1', '--c2', '--c3', '--c4', '--c5', '--c6'];
const RISK = { 'Current': '--risk-0', '1-30': '--risk-1', '31-60': '--risk-2', '61-90': '--risk-3', '90+': '--risk-4' };

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
  const state = behind <= 2 ? 'is-current' : behind <= 14 ? 'is-lagging' : 'is-stale';
  const box = el('freshness');
  box.classList.remove('is-current', 'is-lagging', 'is-stale');
  box.classList.add(state);
  box.title = `Newest arrears file ${longDate(m.data_through)}. Pipeline last run ${longDate(m.built_at)}.`;
  el('fresh-label').textContent = behind === 0 ? 'Up to date'
    : behind <= 2 ? `Current, ${plural(behind, 'day')} behind` : `${plural(behind, 'day')} behind`;
  el('data-through').textContent = `Data to ${longDate(m.data_through)}`;
  el('last-run').textContent = buildAge === 0 ? 'Pipeline run today' : `Pipeline run ${longDate(m.built_at)}`;
}

// ---------------------------------------------------------------- render

async function render() {
  const [bridge, book, vintageBook, vintageBranch, branchRisk, afford, topups, debit, coll] =
    await Promise.all([
      q(`select * from mart_exposure_bridge order by step_order`),

      q(`select year_month, month_start_date, gross_book_zar, par30_pct, par60_pct, par90_pct,
                loans_disbursed, disbursed_zar, topup_share_pct, accounts
         from agg_book_monthly order by month_start_date`),

      // Whole book cohort curves. Every cohort is only drawn for the months it has actually
      // been observed, so a young cohort stops rather than flattening into a false zero.
      q(`select cohort_label, months_on_book,
                round(sum(bad_principal_zar) / nullif(sum(cohort_principal_zar), 0) * 100, 3) as bad_rate_pct,
                sum(cohort_loans) as loans
         from mart_vintage group by 1, 2 order by 1, 2`),

      q(`select cohort_label, months_on_book,
                round(sum(case when branch_code = 'SF-MAH' then bad_principal_zar end)
                      / nullif(sum(case when branch_code = 'SF-MAH' then cohort_principal_zar end), 0) * 100, 3) as mahikeng_pct,
                round(sum(case when branch_code <> 'SF-MAH' then bad_principal_zar end)
                      / nullif(sum(case when branch_code <> 'SF-MAH' then cohort_principal_zar end), 0) * 100, 3) as rest_pct
         from mart_vintage group by 1, 2 order by 1, 2`),

      q(`select branch_code, branch_name, province,
                sum(loans) as loans,
                round(sum(principal_ever_90) / nullif(sum(principal_zar), 0) * 100, 2) as bad_rate_pct,
                round(avg(bad_rate_vs_book_x), 2) as vs_book_x,
                round(sum(loans_income_inflated) * 100.0 / nullif(sum(loans), 0), 1) as income_inflated_pct,
                sum(loans_breaching_floor) as loans_breaching_floor,
                round(sum(net_loss_zar), 2) as net_loss_zar
         from mart_branch_risk where cohort_month >= date '2025-05-01'
         group by 1, 2, 3 order by vs_book_x desc`),

      q(`select affordability_band,
                sum(loans) as loans,
                round(sum(principal_zar), 2) as principal_zar,
                round(sum(outstanding_zar), 2) as outstanding_zar,
                round(sum(principal_ever_90) / nullif(sum(principal_zar), 0) * 100, 2) as bad_rate_pct,
                round(sum(net_loss_zar), 2) as net_loss_zar,
                round(avg(avg_headroom_zar), 2) as avg_headroom_zar
         from mart_affordability group by 1`),

      q(`select count(*) as topups,
                count(*) filter (where settled_account_was_delinquent) as settled_delinquent,
                round(avg(instalment_increase_zar), 2) as avg_instalment_increase_zar,
                round(avg(principal_multiple), 2) as avg_principal_multiple,
                round(count(*) filter (where topup_ever_90) * 100.0 / count(*), 2) as topup_bad_pct,
                round(sum(topup_net_loss_zar), 2) as topup_loss_zar,
                round(avg(settled_peak_dpd), 0) as avg_settled_peak_dpd
         from mart_topup_masking`),

      q(`select timing_band, min(days_after_payday) as gap_from,
                sum(loans) as loans, sum(principal_zar) as principal_zar,
                round(sum(first_payment_defaults) * 100.0 / nullif(sum(loans), 0), 2) as fpd_pct,
                round(sum(principal_ever_90) / nullif(sum(principal_zar), 0) * 100, 2) as bad_rate_pct,
                round(sum(net_loss_zar), 2) as net_loss_zar
         from mart_debit_order group by 1 order by gap_from`),

      q(`select arrears_bucket, activities, cost_zar, share_of_spend_pct, cure_rate_pct,
                cost_per_cure_zar, balance_in_bucket_zar, accounts_worked
         from mart_collections`),
    ]);

  const h = bridge[0];

  el('main').innerHTML =
    sectionBook(h, book, vintageBook) +
    sectionBranch(branchRisk) +
    sectionAfford(afford, h) +
    sectionTopups(topups[0], h) +
    sectionDebit(debit) +
    sectionCollections(coll) +
    sectionClose(h, bridge);

  drawVintage(vintageBook);
  drawPar(book);
  drawBranchVintage(vintageBranch);
  drawAfford(afford);
  drawDebit(debit);
  drawCollections(coll);
  drawBridge(bridge);
  wireTableToggles();
}

// ---------------------------------------------------------------- sections

const head = (num, title, lede) => `
  <div class="section-head"><div class="section-num">${num}</div><h2>${title}</h2></div>
  <p class="lede">${lede}</p>`;

const scaleLegend = (from, to, steps) => `
  <div class="scale-legend"><span>${from}</span>
    <span class="scale-swatches">${steps.map((s) => `<span style="background:${v(s)}"></span>`).join('')}</span>
    <span>${to}</span></div>`;

function sectionBook(h, book, vintage) {
  const last = book[book.length - 1];
  const tenAgo = book[Math.max(0, book.length - 11)];
  // Width of the PAR 30 band over the window the copy talks about, measured rather than
  // asserted. An earlier version of this lede claimed arrears were within a point of a year
  // earlier; they are nearly two points above it. The ten month window is the one that is
  // genuinely flat, and the number below says how flat.
  const window = book.slice(-11);
  const bandLo = Math.min(...window.map((r) => r.par30_pct));
  const bandHi = Math.max(...window.map((r) => r.par30_pct));
  const bandWidth = bandHi - bandLo;
  // Cohorts old enough to have a month six reading, which is the only fair comparison.
  const atSix = {};
  for (const r of vintage) if (r.months_on_book === 6) atSix[r.cohort_label] = r.bad_rate_pct;
  const labels = Object.keys(atSix).sort();
  const early = labels.slice(0, 3).map((l) => atSix[l]);
  const recent = labels.slice(-3).map((l) => atSix[l]);
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;

  const tiles = [
    ['Gross book', fmtRc(last.gross_book_zar), `${fmtNum(last.accounts)} accounts`],
    ['PAR 30', fmtPct(last.par30_pct), `${signed(last.par30_pct - tenAgo.par30_pct)} pts over ten months`],
    ['PAR 90', fmtPct(last.par90_pct), `${signed(last.par90_pct - tenAgo.par90_pct)} pts over ten months`],
    ['Net credit loss', fmtRc(h.total_loss_zar), `${fmtPct(h.loss_rate_pct)} of principal lent`],
  ].map(([l, val, d]) => `
    <div class="tile"><div class="tile-label">${l}</div>
      <div class="tile-value">${val}</div><div class="tile-delta">${d}</div></div>`).join('');

  return `<section id="book">
    ${head('01', 'The book, and what it is not telling you', `Arrears have barely moved for
      ten months. PAR 30 sits at <b>${fmtPct(last.par30_pct)}</b> and has stayed inside a
      <b>${fmtPct(bandWidth)}</b> band the whole time, between ${fmtPct(bandLo)} and
      ${fmtPct(bandHi)}. On that number alone this book looks stable. It is not. Every cohort
      written this year is losing more by month six than the cohorts written a year ago:
      <b>${fmtPct(avg(recent))}</b> against <b>${fmtPct(avg(early))}</b>.`)}
    <div class="hero">
      <div class="hero-value">${signed((avg(recent) / avg(early) - 1) * 100, 0)}</div>
      <div class="hero-label">worse at month six than the cohorts written a year ago, on the same product</div>
    </div>
    <div class="tiles">${tiles}</div>
    <div class="callout">
      <b>Why arrears cannot answer this.</b> Portfolio at risk is a snapshot of loans of every
      age mixed together. It improves when you write off the worst accounts, when you refinance
      the delinquent ones, and when you simply grow fast enough that new lending dilutes the
      denominator. None of those mean the credit is better. A cohort curve cannot be moved that
      way: it fixes each month of lending at the month the money went out and follows only
      that cohort, so month six of one is compared with month six of another and nothing else.
    </div>
    ${scaleLegend('older cohorts', 'newer cohorts', COHORT_RAMP)}
    ${figure({
      id: 'c-vintage', title: 'Cumulative reaching 90 days, by month of disbursement',
      note: 'Each line is one month of lending, followed across its own life. A line is only drawn for the months that cohort has actually been on book, because extending a young cohort with zeroes draws a flat line that reads as excellent performance and is the most common way a vintage chart lies.',
      tableHtml: table([
        { key: 'cohort_label', label: 'Cohort' },
        { key: 'm3', label: 'Month 3', align: 'right', fmt: (x) => fmtPct(x, 1) },
        { key: 'm6', label: 'Month 6', align: 'right', fmt: (x) => fmtPct(x, 1) },
        { key: 'm9', label: 'Month 9', align: 'right', fmt: (x) => fmtPct(x, 1) },
        { key: 'm12', label: 'Month 12', align: 'right', fmt: (x) => fmtPct(x, 1) },
        { key: 'loans', label: 'Loans', align: 'right', fmt: fmtNum },
      ], [], { caption: 'Cumulative share of cohort principal that reached 90 days' }),
    })}
    ${figure({
      id: 'c-par', title: 'Portfolio at risk, month by month',
      note: 'The number the board sees. It ends the window close to where it started while the cohort curves above climb steadily. Both charts are true. Only one of them is about the credit being written.',
      tableHtml: table([
        { key: 'year_month', label: 'Month' },
        { key: 'gross_book_zar', label: 'Gross book', align: 'right', fmt: fmtRc },
        { key: 'par30_pct', label: 'PAR 30', align: 'right', fmt: (x) => fmtPct(x) },
        { key: 'par90_pct', label: 'PAR 90', align: 'right', fmt: (x) => fmtPct(x) },
        { key: 'topup_share_pct', label: 'Top-up share', align: 'right', fmt: (x) => fmtPct(x) },
      ], book, { caption: 'Monthly book position' }),
    })}
  </section>`;
}

function sectionBranch(rows) {
  const worst = rows[0];
  return `<section id="branch">
    ${head('02', 'One branch stopped writing the same business', `From May 2025,
      <b>${worst.branch_name}</b> has been running at <b>${worst.vs_book_x}x</b> the book loss
      rate on the same product, in the same months, under the same economy. The mechanism is
      not a mystery and it is not an accusation: income recorded on its affordability
      assessments sits above the income on the client record for
      <b>${fmtPct(worst.income_inflated_pct)}</b> of the loans it wrote, against
      <b>${fmtPct(rows[1].income_inflated_pct)}</b> at the next branch.`)}
    ${legend([
      { name: worst.branch_name, color: v('--s2') },
      { name: 'Every other branch', color: v('--s1') },
    ], true)}
    ${figure({
      id: 'c-branch', title: 'Month six loss rate by cohort, one branch against the rest',
      note: 'Before May 2025 this branch was writing better business than the book. The turn is not a drift, it is a step, and it starts in a particular month.',
      tableHtml: table([
        { key: 'branch_name', label: 'Branch' },
        { key: 'province', label: 'Province' },
        { key: 'loans', label: 'Loans', align: 'right', fmt: fmtNum },
        { key: 'bad_rate_pct', label: 'Reached 90 days', align: 'right', fmt: (x) => fmtPct(x) },
        { key: 'vs_book_x', label: 'Against book', align: 'right', fmt: (x) => x + 'x',
          cls: (x) => (x >= 1.4 ? 'neg' : '') },
        { key: 'income_inflated_pct', label: 'Income above file', align: 'right', fmt: (x) => fmtPct(x),
          cls: (x) => (x > 20 ? 'neg' : 'muted') },
        { key: 'loans_breaching_floor', label: 'Outside policy', align: 'right', fmt: fmtNum },
        { key: 'net_loss_zar', label: 'Net loss', align: 'right', fmt: fmtRc, cls: () => 'neg' },
      ], rows, { caption: 'Cohorts disbursed from May 2025' }),
    })}
  </section>`;
}

function sectionAfford(rows, h) {
  const breach = rows.find((r) => r.affordability_band === 'Breaches floor') || {};
  const within = rows.find((r) => r.affordability_band === 'Within policy') || {};
  return `<section id="afford">
    ${head('03', 'Loans written with nothing left over', `<b>${fmtNum(breach.loans)}</b> loans were
      written where the affordability assessment itself shows the client had nothing left after
      the instalment. They reach 90 days at <b>${fmtPct(breach.bad_rate_pct)}</b> against
      <b>${fmtPct(within.bad_rate_pct)}</b> for loans written inside policy, which is the
      smaller half of the problem.`)}
    <div class="callout statute">
      <b>This is a compliance exposure before it is a credit one.</b> Section 81 of the National
      Credit Act obliges the lender to establish that the consumer can meet the obligation.
      An agreement entered into without that assessment is reckless credit, and under section 83
      a court may set the consumer's obligations aside in whole or in part. The number at risk
      is therefore not the expected loss on these loans. It is the entire outstanding balance:
      <b>${fmtRc(h.reckless_exposure_zar)}</b> across ${fmtNum(h.reckless_loans)} live agreements.
      Nothing here is legal advice, and a real review would be done with counsel.
    </div>
    ${figure({
      id: 'c-afford', title: 'Loss rate by affordability headroom at origination',
      note: 'Headroom is what the assessment recorded as left over after the new instalment. The band under R500 is not a breach, but it is one unexpected expense away from one.',
      tableHtml: table([
        { key: 'affordability_band', label: 'Headroom at origination' },
        { key: 'loans', label: 'Loans', align: 'right', fmt: fmtNum },
        { key: 'avg_headroom_zar', label: 'Average headroom', align: 'right', fmt: fmtR },
        { key: 'principal_zar', label: 'Advanced', align: 'right', fmt: fmtRc },
        { key: 'outstanding_zar', label: 'Outstanding', align: 'right', fmt: fmtRc },
        { key: 'bad_rate_pct', label: 'Reached 90 days', align: 'right', fmt: (x) => fmtPct(x),
          cls: (x) => (x > 18 ? 'neg' : '') },
        { key: 'net_loss_zar', label: 'Net loss', align: 'right', fmt: fmtRc, cls: () => 'neg' },
      ], rows, { caption: 'Whole book' }),
    })}
  </section>`;
}

function sectionTopups(t, h) {
  return `<section id="topups">
    ${head('04', 'Arrears that were refinanced rather than collected', `<b>${fmtNum(t.topups)}</b>
      loans on this book were written to settle another loan, and
      <b>${fmtNum(t.settled_delinquent)}</b> of them settled an account that was already in
      arrears, on average <b>${fmtNum(t.avg_settled_peak_dpd)} days</b> down. The old account
      closed as settled. Its arrears left the portfolio at risk number without a cent being
      collected, and the client walked out owing <b>${t.avg_principal_multiple}x</b> the
      principal at <b>${fmtR(t.avg_instalment_increase_zar)}</b> more a month against the same
      income.`)}
    <div class="callout">
      <b>These loans then fail at ${fmtPct(t.topup_bad_pct)}</b>, more than double the rest of
      the book, for <b>${fmtRc(t.topup_loss_zar)}</b> of loss. None of this is hidden: every
      top-up names the loan it settled, in a column that has always been there. Nobody had
      joined the two.
    </div>
  </section>`;
}

function sectionDebit(rows) {
  const best = rows[0], worst = rows[rows.length - 1];
  return `<section id="debit">
    ${head('05', 'Debit orders presented on the wrong day', `Where collection is set within a day
      of payday, <b>${fmtPct(best.fpd_pct)}</b> of first instalments fail. Where it is set more
      than a week after, <b>${fmtPct(worst.fpd_pct)}</b> do. Same product, same branches, same
      credit policy. A debit order presented after the household has spent its salary fails for
      reasons that have nothing to do with willingness to pay.`)}
    ${figure({
      id: 'c-debit', title: 'First instalment failure by days between payday and collection',
      note: 'This is the cheapest item on this page to fix. It is a diary change, not a credit policy change, and it does not require declining a single additional application.',
      tableHtml: table([
        { key: 'timing_band', label: 'Collection timing' },
        { key: 'loans', label: 'Loans', align: 'right', fmt: fmtNum },
        { key: 'principal_zar', label: 'Advanced', align: 'right', fmt: fmtRc },
        { key: 'fpd_pct', label: 'First instalment failed', align: 'right', fmt: (x) => fmtPct(x),
          cls: (x) => (x > 12 ? 'neg' : '') },
        { key: 'bad_rate_pct', label: 'Reached 90 days', align: 'right', fmt: (x) => fmtPct(x),
          cls: (x) => (x > 18 ? 'neg' : '') },
        { key: 'net_loss_zar', label: 'Net loss', align: 'right', fmt: fmtRc, cls: () => 'neg' },
      ], rows, { caption: 'Whole book' }),
    })}
  </section>`;
}

function sectionCollections(rows) {
  const by = Object.fromEntries(rows.map((r) => [r.arrears_bucket, r]));
  const early = by['1-30'] || {};
  const late = by['90+'] || {};
  const lateShare = (by['61-90']?.share_of_spend_pct || 0) + (late.share_of_spend_pct || 0);
  return `<section id="collections">
    ${head('06', 'Collections effort, against where it works', `<b>${fmtPct(lateShare)}</b> of the
      collections budget is spent on accounts already 60 days down or worse, where roughly one
      in nine comes back. An account one month down comes back
      <b>${fmtPct(early.cure_rate_pct)}</b> of the time and costs
      <b>${fmtR(early.cost_per_cure_zar)}</b> to recover. At 90 days it costs
      <b>${fmtR(late.cost_per_cure_zar)}</b>.`)}
    ${scaleLegend('current', '90+ days', ['--risk-0', '--risk-1', '--risk-2', '--risk-3', '--risk-4'])}
    ${figure({
      id: 'c-coll', title: 'Cost of bringing one account back to current',
      note: 'The dialler works the oldest queue first, which is the queue where almost nothing can be recovered. Reading this chart the other way round is the entire recommendation.',
      tableHtml: table([
        { key: 'arrears_bucket', label: 'Bucket' },
        { key: 'accounts_worked', label: 'Accounts worked', align: 'right', fmt: fmtNum },
        { key: 'activities', label: 'Contacts', align: 'right', fmt: fmtNum },
        { key: 'cost_zar', label: 'Spend', align: 'right', fmt: fmtR },
        { key: 'share_of_spend_pct', label: 'Share of spend', align: 'right', fmt: (x) => fmtPct(x),
          cls: (x) => (x > 30 ? 'neg' : '') },
        { key: 'cure_rate_pct', label: 'Returned to current', align: 'right', fmt: (x) => fmtPct(x),
          cls: (x) => (x > 40 ? 'pos' : x < 15 ? 'neg' : '') },
        { key: 'cost_per_cure_zar', label: 'Cost per recovery', align: 'right', fmt: fmtR,
          cls: (x) => (x > 500 ? 'neg' : 'pos') },
        { key: 'balance_in_bucket_zar', label: 'Balance in bucket', align: 'right', fmt: fmtRc },
      ], rows, { caption: 'Whole period' }),
    })}
  </section>`;
}

function sectionClose(h, bridge) {
  return `<section id="close">
    ${head('07', 'What it adds up to', `Net credit loss on this book is
      <b>${fmtRc(h.total_loss_zar)}</b>, or <b>${fmtPct(h.loss_rate_pct)}</b> of everything
      advanced. <b>${fmtRc(h.total_excess_zar)}</b> of that, <b>${fmtPct(h.excess_pct_of_loss)}</b>,
      sits with the four conditions above rather than with ordinary credit risk.`)}
    ${figure({
      id: 'c-bridge', title: 'Net credit loss, against a book without these four conditions',
      note: 'Each loan is counted once, attributed to the most serious condition it meets, so nothing is double counted. Excess is measured against what the same money would have lost at the rate the clean part of the book actually achieved.',
      tableHtml: table([
        { key: 'driver', label: 'Driver' },
        { key: 'effect_zar', label: 'Loss', align: 'right', fmt: fmtR,
          cls: (x, r) => (r.step_type === 'increase' ? 'neg' : '') },
        { key: 'pct_of_excess', label: 'Share of excess', align: 'right',
          fmt: (x) => (x == null ? '' : fmtPct(x)) },
        { key: 'finding_ref', label: 'Section', fmt: (x) => (x ? `See ${x}` : '') },
      ], bridge, { caption: 'Whole book' }),
    })}
    <div class="callout statute">
      <b>Reported separately, and deliberately not added in.</b> The
      <b>${fmtRc(h.reckless_exposure_zar)}</b> outstanding on agreements written outside
      affordability policy is not a credit loss estimate. It is balance on contracts whose
      enforceability could be challenged. Credit loss and regulatory exposure are different
      quantities, and adding them together produces a number that is wrong in both directions.
    </div>
  </section>`;
}

// ---------------------------------------------------------------- draw

function drawVintage(rows) {
  const byCohort = {};
  for (const r of rows) (byCohort[r.cohort_label] ||= []).push(r);
  const labels = Object.keys(byCohort).sort();
  // Cohort is an ordered dimension, so it takes one hue running light to dark rather than a
  // set of unrelated colours. Eighteen categorical hues would be unreadable and wrong.
  const series = labels.map((label, i) => ({
    name: label,
    color: v(COHORT_RAMP[Math.min(COHORT_RAMP.length - 1, Math.floor(i / labels.length * COHORT_RAMP.length))]),
    points: byCohort[label].map((r) => ({ x: r.months_on_book, y: r.bad_rate_pct })),
  }));
  // Two lines are labelled, not eighteen. The oldest cohort, and the newest one that has
  // actually reached six months: a cohort two months old ends near the origin, so labelling
  // it puts the text in the middle of every other line rather than at a readable end.
  const newestMature = series.reduce(
    (best, s, i) => (s.points.some((p) => p.x >= 6) ? i : best), 0);
  multiLine(el('c-vintage'), series, { labelEnds: [0, newestMature], height: 340 });

  const tbody = el('c-vintage-table')?.querySelector('tbody');
  if (tbody) {
    tbody.innerHTML = labels.map((l) => {
      const at = (m) => byCohort[l].find((r) => r.months_on_book === m)?.bad_rate_pct;
      const cell = (m) => `<td class="num">${at(m) == null ? '-' : fmtPct(at(m), 1)}</td>`;
      return `<tr><td>${l}</td>${cell(3)}${cell(6)}${cell(9)}${cell(12)}` +
             `<td class="num">${fmtNum(byCohort[l][0].loans)}</td></tr>`;
    }).join('');
  }
}

function drawBranchVintage(rows) {
  const at6 = rows.filter((r) => r.months_on_book === 6 && r.mahikeng_pct != null);
  lines(el('c-branch'), {
    series: [
      { name: 'Mahikeng', color: v('--s2'), points: at6.map((r) => ({ x: r.cohort_label, y: r.mahikeng_pct })) },
      { name: 'Every other branch', color: v('--s1'), points: at6.map((r) => ({ x: r.cohort_label, y: r.rest_pct })) },
    ],
    height: 300, valueFmt: (x, dp = 1) => fmtPct(x, dp), xFmt: (x) => x, xEvery: 3,
  });
}

function drawPar(book) {
  lines(el('c-par'), {
    series: [
      { name: 'PAR 30', color: v('--s1'), points: book.map((r) => ({ x: r.month_start_date, y: r.par30_pct })) },
      { name: 'PAR 90', color: v('--s3'), points: book.map((r) => ({ x: r.month_start_date, y: r.par90_pct })) },
    ],
    height: 260, valueFmt: (x, dp = 1) => fmtPct(x, dp), xFmt: fmtMonth, xEvery: 3,
  });
}

function drawAfford(rows) {
  const order = { 'Breaches floor': 0, 'Under R500 headroom': 1, 'Within policy': 2 };
  columns(el('c-afford'), {
    rows: [...rows].sort((a, b) => order[a.affordability_band] - order[b.affordability_band]).map((r) => ({
      x: r.affordability_band, y: r.bad_rate_pct,
      color: r.affordability_band === 'Breaches floor' ? v('--risk-4')
        : r.affordability_band === 'Under R500 headroom' ? v('--risk-2') : v('--risk-0'),
      tip: `<b>${r.affordability_band}</b>`
        + `<div class="tip-row"><span>Loans</span><span>${fmtNum(r.loans)}</span></div>`
        + `<div class="tip-row"><span>Reached 90 days</span><span>${fmtPct(r.bad_rate_pct)}</span></div>`
        + `<div class="tip-row"><span>Outstanding</span><span>${fmtRc(r.outstanding_zar)}</span></div>`,
    })),
    height: 260, valueFmt: (x) => x.toFixed(0) + '%', yLabel: 'reached 90 days',
  });
}

function drawDebit(rows) {
  columns(el('c-debit'), {
    rows: rows.map((r) => ({
      x: r.timing_band, y: r.fpd_pct,
      color: r.fpd_pct > 12 ? v('--risk-4') : v('--risk-0'),
      tip: `<b>${r.timing_band}</b>`
        + `<div class="tip-row"><span>Loans</span><span>${fmtNum(r.loans)}</span></div>`
        + `<div class="tip-row"><span>First instalment failed</span><span>${fmtPct(r.fpd_pct)}</span></div>`
        + `<div class="tip-row"><span>Reached 90 days</span><span>${fmtPct(r.bad_rate_pct)}</span></div>`,
    })),
    height: 260, valueFmt: (x) => x.toFixed(0) + '%', yLabel: 'first instalment failed',
  });
}

function drawCollections(rows) {
  const order = { '1-30': 0, '31-60': 1, '61-90': 2, '90+': 3 };
  barsH(el('c-coll'), {
    rows: [...rows].sort((a, b) => order[a.arrears_bucket] - order[b.arrears_bucket]).map((r) => ({
      label: `${r.arrears_bucket} days`, value: r.cost_per_cure_zar, color: v(RISK[r.arrears_bucket]),
      tip: `<b>${r.arrears_bucket} days</b>`
        + `<div class="tip-row"><span>Cost per recovery</span><span>${fmtR(r.cost_per_cure_zar)}</span></div>`
        + `<div class="tip-row"><span>Returned to current</span><span>${fmtPct(r.cure_rate_pct)}</span></div>`
        + `<div class="tip-row"><span>Share of spend</span><span>${fmtPct(r.share_of_spend_pct)}</span></div>`,
    })),
    valueFmt: fmtR, rowHeight: 48, labelWidth: 150,
  });
}

function drawBridge(bridge) {
  waterfall(el('c-bridge'), {
    rows: bridge.map((r) => ({
      label: r.driver_short, value: r.effect_zar,
      type: r.step_type === 'anchor' ? 'anchor' : r.step_type === 'total' ? 'total' : 'increase',
      tip: `<b>${r.driver}</b>`
        + `<div class="tip-row"><span>Loss</span><span>${fmtR(r.effect_zar)}</span></div>`
        + (r.pct_of_excess != null
          ? `<div class="tip-row"><span>Share of excess</span><span>${fmtPct(r.pct_of_excess)}</span></div>` : ''),
    })),
    height: 330, zeroBaseline: false,
  });
}

/**
 * Many series on one plot, which a vintage chart needs and the shared line primitive does not
 * do well: eighteen end labels collide into noise. Only the named indices get a label.
 */
function multiLine(el, series, { labelEnds = [], height = 320 }) {
  const M = { top: 16, right: 76, bottom: 38, left: 58 };
  const render = (W) => {
    const iw = W - M.left - M.right;
    const ih = height - M.top - M.bottom;
    const allX = series.flatMap((s) => s.points.map((p) => p.x));
    const allY = series.flatMap((s) => s.points.map((p) => p.y)).filter((y) => y != null);
    const xMax = Math.max(...allX), yMax = Math.max(...allY);
    const step = yMax > 20 ? 5 : yMax > 10 ? 2.5 : 1;
    const ticks = [];
    for (let t = 0; t <= yMax + step; t += step) ticks.push(t);
    const yHi = Math.max(...ticks);
    const X = (x) => M.left + (x / Math.max(1, xMax)) * iw;
    const Y = (y) => M.top + ih - (y / yHi) * ih;
    const ink3 = v('--ink-3'), rule = v('--rule'), font = v('--font-sans');

    let s = `<svg width="${W}" height="${height}" role="img" aria-label="Vintage curves by cohort">`;
    for (const t of ticks) {
      s += `<line x1="${M.left}" y1="${Y(t)}" x2="${W - M.right}" y2="${Y(t)}" stroke="${rule}" stroke-width="1"/>`;
      s += `<text x="${M.left - 8}" y="${Y(t) + 4}" text-anchor="end" font-size="11" fill="${ink3}" font-family="${font}" style="font-variant-numeric:tabular-nums">${t}%</text>`;
    }
    for (let m = 0; m <= xMax; m += 3) {
      s += `<text x="${X(m)}" y="${height - M.bottom + 16}" text-anchor="middle" font-size="11" fill="${ink3}" font-family="${font}">${m}</text>`;
    }
    s += `<text x="${X(xMax / 2)}" y="${height - M.bottom + 32}" text-anchor="middle" font-size="10.5" fill="${ink3}" font-family="${font}">months on book</text>`;

    series.forEach((ser, i) => {
      const d = ser.points.map((p, k) => `${k ? 'L' : 'M'}${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`).join('');
      const emphasised = labelEnds.includes(i);
      s += `<path d="${d}" fill="none" stroke="${ser.color}" stroke-width="${emphasised ? 2.4 : 1.6}" `
        + `stroke-linejoin="round" stroke-linecap="round" opacity="${emphasised ? 1 : 0.75}"/>`;
      const last = ser.points[ser.points.length - 1];
      if (emphasised && last) {
        s += `<circle cx="${X(last.x)}" cy="${Y(last.y)}" r="4" fill="${ser.color}" stroke="${v('--paper')}" stroke-width="2"/>`;
        s += `<text x="${X(last.x) + 9}" y="${Y(last.y) + 4}" font-size="11" font-weight="600" fill="${v('--ink-2')}" font-family="${font}">${ser.name}</text>`;
      }
      // A wide transparent hit path so any cohort can be inspected
      // The tooltip body is HTML, so it has to be escaped before it goes into an attribute.
      // Unescaped, its own quotes close the attribute early, which breaks the SVG from that
      // point on and spills the markup into the page as text.
      const tipHtml = `<b>Cohort ${ser.name}</b>`
        + ser.points.filter((p) => [3, 6, 12].includes(p.x))
            .map((p) => `<div class="tip-row"><span>Month ${p.x}</span><span>${p.y.toFixed(1)}%</span></div>`)
            .join('');
      s += `<path d="${d}" fill="none" stroke="transparent" stroke-width="12" tabindex="0" `
        + `data-tip="${esc(tipHtml)}"/>`;
    });
    return s + '</svg>';
  };
  let last = 0;
  const run = () => {
    const w = el.clientWidth;
    if (!w || Math.abs(w - last) < 2) return;
    last = w;
    el.innerHTML = render(w);
    el.querySelectorAll('[data-tip]').forEach((n) => {
      n.addEventListener('mousemove', (ev) => showTip(n.getAttribute('data-tip'), ev));
      n.addEventListener('mouseleave', hideTip);
    });
  };
  run();
  new ResizeObserver(run).observe(el);
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
