/*
  Sable & Finch Credit, Portfolio Risk Review.

  A credit committee pack, turned a page at a time: a cover, one matter per page, and a
  sign-off page of resolutions. Opens on the one thing a portfolio at risk number cannot tell
  you: whether the business is writing better or worse loans than it was a year ago. Every
  chart carries a table twin, which matters more here than anywhere else in this suite,
  because a credit committee is going to want the row.
*/

import { connect, q, meta } from './db.js';
import {
  waterfall, columns, barsH, lines, legend, table, figure, wireTableToggles,
  showTip, hideTip, esc, fmtR, fmtRc, fmtR2, fmtNum, fmtPct, fmtMonth,
} from './charts.js';
import {
  renderNav, onFilterChange, readParam, writeParam, scope, keepScroll, fmtAny,
  wireTheme, views, insights, attachInsights, aiCredit,
} from './shell.js';

// The AI recommendations and draft resolutions, loaded once beside meta.json, and the pager.
let INS = null;
let V = null;

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
  box.title = `Newest arrears file ${longDate(m.data_through)}. Pipeline last run ${longDate(m.built_at)}.`;
  el('fresh-label').textContent = behind === 0 ? 'Up to date'
    : behind <= 2 ? `Current, ${plural(behind, 'day')} behind` : `${plural(behind, 'day')} behind`;
  el('data-through').textContent = `Data to ${longDate(m.data_through)}`;
  el('last-run').textContent = buildAge === 0 ? 'Pipeline run today' : `Pipeline run ${longDate(m.built_at)}`;
}

// ---------------------------------------------------------------- the branch filter
//
// Branch is the cut the credit story turns on, and four of its marts carry it: the cohort
// curves, the branch comparison, affordability and top-ups. PAR, debit orders, collections and
// the exposure bridge are book-wide, and their figures say "All branches" rather than
// appearing to follow a filter they cannot follow. The headline and the summary stay book-wide.

// One page each, numbered as pages. The matters keep their own numbers inside the page.
const SECTIONS = [
  ['ox-top', '1', 'Cover'],
  ['book', '2', 'The book'],
  ['branch', '3', 'The branch'],
  ['afford', '4', 'Affordability'],
  ['topups', '5', 'Top-ups'],
  ['debit', '6', 'Debit orders'],
  ['collections', '7', 'Collections'],
  ['close', '8', 'What it adds up to'],
  ['signoff', '9', 'Resolutions'],
];
const pageOf = (id) => SECTIONS.findIndex(([x]) => x === id) + 1;
const ALL_BRANCHES = 'All branches';
const branch = { code: '', label: '' };

// The code arrives in the query string, so it is checked against the published options and
// only a known code ever reaches SQL.
function setBranch(code, options = []) {
  const o = options.find((x) => x.value === code);
  branch.code = o ? o.value : '';
  branch.label = o ? o.label : '';
}
const byBranch = (col) => (branch.code ? ` and ${col} = '${branch.code}'` : '');
const sc = (applies) => scope(branch.label, applies, ALL_BRANCHES);
const atBranch = (sentence) => (branch.code ? `At ${branch.label}, ${sentence}` : sentence);

// ---------------------------------------------------------------- render

async function render() {
  const [bridge, book, vintageBook, vintageChart, branchSix, branchRisk, afford, topups, debit, coll] =
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

      // The same curves for the chart, following the branch filter. The lede and the
      // headline above keep reading the whole book.
      q(`select cohort_label, months_on_book,
                round(sum(bad_principal_zar) / nullif(sum(cohort_principal_zar), 0) * 100, 3) as bad_rate_pct,
                sum(cohort_loans) as loans
         from mart_vintage where true${byBranch('branch_code')} group by 1, 2 order by 1, 2`),

      // Month six by branch, so any branch can be set against the rest in the browser. This
      // used to be one query hardcoded to Mahikeng.
      q(`select cohort_label, branch_code,
                sum(bad_principal_zar) as bad_zar, sum(cohort_principal_zar) as principal_zar
         from mart_vintage where months_on_book = 6 group by 1, 2 order by 1`),

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
         from mart_affordability where true${byBranch('branch_code')} group by 1`),

      q(`select count(*) as topups,
                count(*) filter (where settled_account_was_delinquent) as settled_delinquent,
                round(avg(instalment_increase_zar), 2) as avg_instalment_increase_zar,
                round(avg(principal_multiple), 2) as avg_principal_multiple,
                round(count(*) filter (where topup_ever_90) * 100.0 / count(*), 2) as topup_bad_pct,
                round(sum(topup_net_loss_zar), 2) as topup_loss_zar,
                round(avg(settled_peak_dpd), 0) as avg_settled_peak_dpd
         from mart_topup_masking where true${byBranch('branch_code')}`),

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
  // The branch set against the rest: the one selected, or the one that turned.
  const compare = branchRisk.find((r) => r.branch_code === branch.code) || branchRisk[0];

  el('main').innerHTML =
    sectionBook(h, book, vintageBook) +
    sectionBranch(branchRisk, compare) +
    sectionAfford(afford, h) +
    sectionTopups(topups[0], h) +
    sectionDebit(debit) +
    sectionCollections(coll) +
    sectionClose(h, bridge);

  // Each matter closes on its recommendation to the committee, the way a board paper does.
  attachInsights(el('main'), INS, {
    where: 'end', label: 'Recommendation to the committee · AI', cls: 'pack-rec', scope: sc(false),
  });

  // The headline painted from meta.json in the first second must be the number the
  // warehouse gives. If they ever drift, say so in the console rather than on a prospect's screen.
  const m = await meta().catch(() => ({}));
  const live = bookHeadline(vintageBook);
  if (m.summary && Math.abs(m.summary.hero.v - live) > 0.5) {
    console.warn('Headline differs from the warehouse', m.summary.hero.v, live);
  }

  drawVintage(vintageChart);
  drawPar(book);
  drawBranchVintage(branchSix, compare);
  drawAfford(afford);
  drawDebit(debit);
  drawCollections(coll);
  drawBridge(bridge);
  wireTableToggles();
  V?.refresh();
}

// ---------------------------------------------------------------- the cover and the sign-off
//
// Both paint from meta.json and insights.json in the first second, before the query engine,
// so the pack can be opened, read and turned to its resolutions while the book is loading.

function renderCover(target, m) {
  const s = m.summary;
  if (!target || !s) return;
  const rows = [
    { id: 'book', title: 'The book', v: s.hero.v, f: s.hero.f, note: s.hero.label },
    ...s.findings,
  ];
  const contents = rows.map((r) => `
    <tr>
      <td class="pg">${pageOf(r.id)}</td>
      <td><a href="#${esc(r.id)}">${esc(r.title)}</a></td>
      <td class="num">${esc(fmtAny(r.v, r.f))}</td>
      <td class="muted">${esc(r.note)}</td>
    </tr>`).join('');
  const o = INS?.overview;
  target.innerHTML = `
    <p class="cover-kicker">Credit Committee Pack</p>
    <h1 class="cover-title">Portfolio Risk Review</h1>
    <p class="cover-sub">Sable &amp; Finch Credit · unsecured lending · nine branches</p>
    <dl class="cover-meta">
      <div><dt>Period</dt><dd>${esc(longDate(m.data_from))} to ${esc(longDate(m.data_through))}</dd></div>
      <div><dt>Loans written</dt><dd>${esc(fmtNum(m.loans))}</dd></div>
      <div><dt>Disbursed</dt><dd>${esc(fmtRc(m.disbursed_zar))}</dd></div>
      <div><dt>Prepared by</dt><dd>Omnatix</dd></div>
    </dl>
    <div class="hero"><div class="hero-value">${esc(fmtAny(s.hero.v, s.hero.f))}</div>
      <div class="hero-label">${esc(s.hero.label)}</div></div>
    ${o ? `
    <h2>Executive summary</h2>
    <div class="cover-exec">
      <p class="ai-headline">${esc(o.headline || '')}</p>
      ${o.summary ? `<p>${esc(o.summary)}</p>` : ''}
      <p class="ai-credit">${esc(aiCredit(INS))} The resolutions it proposes are on page ${pageOf('signoff')}.</p>
    </div>` : ''}
    <h2>Matters for the committee</h2>
    <div class="table-scroll contents"><table>
      <thead><tr><th>Page</th><th>Matter</th><th class="num">Figure</th><th>What it measures</th></tr></thead>
      <tbody>${contents}</tbody>
    </table></div>`;
}

function renderSignoff(target) {
  if (!target) return;
  const pris = INS?.overview?.priorities || [];
  const rows = pris.map((p, i) => `
    <tr>
      <td>R${i + 1}</td>
      <td>${esc(p.action || '')}${p.section ? ` <a class="muted" href="#${esc(p.section)}">(page ${pageOf(p.section)})</a>` : ''}</td>
      <td>${esc(p.owner || '')}</td>
      <td>${esc(p.horizon || '')}</td>
      <td class="num">${p.value_zar != null ? esc(fmtRc(p.value_zar)) : '-'}</td>
    </tr>`).join('');
  target.innerHTML = `
    <div class="section-head"><div class="section-num">Resolutions</div><h2>Resolutions proposed to the committee</h2></div>
    <p class="lede">Drafted from the matters in this pack, in the order to take them. Each is a
      proposal to test against the page it cites, not a decision: the committee amends,
      adopts or rejects.</p>
    ${rows ? `
    <div class="table-scroll"><table class="resolutions">
      <thead><tr><th>No.</th><th>Resolution</th><th>Owner</th><th>By</th><th class="num">Worth</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <p class="ai-credit">${esc(aiCredit(INS))} Worth is what the matter is sized at in this pack,
      not a forecast of what will be recovered, and the figures are not to be added together.</p>`
    : '<p class="muted">No draft resolutions were written for this build.</p>'}
    <h2>Committee sign-off</h2>
    <div class="sign-grid">
      <div class="sign-line"><b>Chief Risk Officer</b>Signature and date</div>
      <div class="sign-line"><b>Chief Executive Officer</b>Signature and date</div>
      <div class="sign-line"><b>Chair, Credit Committee</b>Signature and date</div>
    </div>`;
}

// ---------------------------------------------------------------- sections

const head = (num, title, lede) => `
  <div class="section-head"><div class="section-num">Matter ${num}</div><h2>${title}</h2></div>
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

  // The headline itself now paints from meta.json above this section; the lede keeps the
  // two month six figures it is built from.
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
      id: 'c-vintage', title: 'Cumulative reaching 90 days, by month of disbursement', scope: sc(true),
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
      id: 'c-par', title: 'Portfolio at risk, month by month', scope: sc(false),
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

function sectionBranch(rows, compare) {
  const worst = rows[0];
  // With no branch chosen, the section tells the story of the branch that turned. Choose
  // another and it sets that branch against the rest instead, and says where the problem is.
  const lede = compare === worst
    ? `From May 2025,
      <b>${worst.branch_name}</b> has been running at <b>${worst.vs_book_x}x</b> the book loss
      rate on the same product, in the same months, under the same economy. The mechanism is
      not a mystery and it is not an accusation: income recorded on its affordability
      assessments sits above the income on the client record for
      <b>${fmtPct(worst.income_inflated_pct)}</b> of the loans it wrote, against
      <b>${fmtPct(rows[1].income_inflated_pct)}</b> at the next branch.`
    : `From May 2025, <b>${compare.branch_name}</b> has run at <b>${compare.vs_book_x}x</b> the
      book loss rate, and <b>${fmtPct(compare.income_inflated_pct)}</b> of its loans carry
      income above the client record. The branch that turned is <b>${worst.branch_name}</b>, at
      <b>${worst.vs_book_x}x</b>, with income above file on
      <b>${fmtPct(worst.income_inflated_pct)}</b> of what it wrote.`;
  const note = compare === worst
    ? 'Before May 2025 this branch was writing better business than the book. The turn is not a drift, it is a step, and it starts in a particular month.'
    : `The same comparison, for ${compare.branch_name}. Choose ${worst.branch_name} in the branch filter to see what a step looks like.`;
  return `<section id="branch">
    ${head('02', 'One branch stopped writing the same business', lede)}
    ${legend([
      { name: compare.branch_name, color: v('--s2') },
      { name: 'Every other branch', color: v('--s1') },
    ], true)}
    ${figure({
      id: 'c-branch', title: 'Month six loss rate by cohort, one branch against the rest', scope: sc(true),
      note,
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
    ${head('03', 'Loans written with nothing left over', atBranch(`<b>${fmtNum(breach.loans)}</b> loans were
      written where the affordability assessment itself shows the client had nothing left after
      the instalment. They reach 90 days at <b>${fmtPct(breach.bad_rate_pct)}</b> against
      <b>${fmtPct(within.bad_rate_pct)}</b> for loans written inside policy, which is the
      smaller half of the problem.`))}
    <!-- Three bars across the full width read as three bars and a lot of paper, so the chart
         sits beside the statute it is about. -->
    <div class="ox-split">
    <div class="callout statute">
      <b>This is a compliance exposure before it is a credit one.</b> Section 81 of the National
      Credit Act obliges the lender to establish that the consumer can meet the obligation.
      An agreement entered into without that assessment is reckless credit, and under section 83
      a court may set the consumer's obligations aside in whole or in part. The number at risk
      is therefore not the expected loss on these loans. It is the entire outstanding balance:
      <b>${fmtRc(h.reckless_exposure_zar)}</b> across ${fmtNum(h.reckless_loans)} live agreements
      on the whole book. Nothing here is legal advice, and a real review would be done with counsel.
    </div>
    ${figure({
      id: 'c-afford', title: 'Loss rate by affordability headroom at origination', scope: sc(true),
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
      ], rows, { caption: branch.code ? branch.label : 'Whole book' }),
    })}
    </div>
  </section>`;
}

function sectionTopups(t, h) {
  if (!t.topups) {
    return `<section id="topups">
      ${head('04', 'Arrears that were refinanced rather than collected',
        `${branch.label} wrote no top-ups in the window.`)}
    </section>`;
  }
  // Against the whole book the top-ups fail at more than double the rate. That comparison is
  // a book-wide fact, so it is only stated when the figures on screen are book-wide.
  const versus = branch.code ? '' : ', more than double the rest of the book';
  return `<section id="topups">
    ${head('04', 'Arrears that were refinanced rather than collected', atBranch(`<b>${fmtNum(t.topups)}</b>
      loans${branch.code ? '' : ' on this book'} were written to settle another loan, and
      <b>${fmtNum(t.settled_delinquent)}</b> of them settled an account that was already in
      arrears, on average <b>${fmtNum(t.avg_settled_peak_dpd)} days</b> down. The old account
      closed as settled. Its arrears left the portfolio at risk number without a cent being
      collected, and the client walked out owing <b>${t.avg_principal_multiple}x</b> the
      principal at <b>${fmtR(t.avg_instalment_increase_zar)}</b> more a month against the same
      income.`))}
    <div class="callout">
      <b>These loans then fail at ${fmtPct(t.topup_bad_pct)}</b>${versus}, for
      <b>${fmtRc(t.topup_loss_zar)}</b> of loss. None of this is hidden: every
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
      id: 'c-debit', title: 'First instalment failure by days between payday and collection', scope: sc(false),
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
      id: 'c-coll', title: 'Cost of bringing one account back to current', scope: sc(false),
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
      id: 'c-bridge', title: 'Net credit loss, against a book without these four conditions', scope: sc(false),
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

function drawBranchVintage(rows, compare) {
  // Month six bad rate for one branch against every other branch, weighted by principal,
  // cohort by cohort. Only cohorts the chosen branch actually wrote are drawn.
  const by = {};
  for (const r of rows) {
    const c = (by[r.cohort_label] ||= { sel: [0, 0], rest: [0, 0] });
    const side = r.branch_code === compare.branch_code ? c.sel : c.rest;
    side[0] += r.bad_zar; side[1] += r.principal_zar;
  }
  const at6 = Object.entries(by).sort(([a], [b]) => a.localeCompare(b))
    .filter(([, c]) => c.sel[1] > 0)
    .map(([label, c]) => ({
      cohort_label: label,
      sel_pct: c.sel[0] / c.sel[1] * 100,
      rest_pct: c.rest[1] ? c.rest[0] / c.rest[1] * 100 : null,
    }));
  lines(el('c-branch'), {
    series: [
      { name: compare.branch_name, color: v('--s2'), points: at6.map((r) => ({ x: r.cohort_label, y: r.sel_pct })) },
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
  barsH(el('c-afford'), {
    rows: [...rows].sort((a, b) => order[a.affordability_band] - order[b.affordability_band]).map((r) => ({
      label: r.affordability_band, value: r.bad_rate_pct,
      color: r.affordability_band === 'Breaches floor' ? v('--risk-4')
        : r.affordability_band === 'Under R500 headroom' ? v('--risk-2') : v('--risk-0'),
      tip: `<b>${r.affordability_band}</b>`
        + `<div class="tip-row"><span>Loans</span><span>${fmtNum(r.loans)}</span></div>`
        + `<div class="tip-row"><span>Reached 90 days</span><span>${fmtPct(r.bad_rate_pct)}</span></div>`
        + `<div class="tip-row"><span>Outstanding</span><span>${fmtRc(r.outstanding_zar)}</span></div>`,
    })),
    valueFmt: (x) => fmtPct(x), rowHeight: 48, labelWidth: 200,
  });
}

function drawDebit(rows) {
  barsH(el('c-debit'), {
    rows: rows.map((r) => ({
      label: r.timing_band, value: r.fpd_pct,
      color: r.fpd_pct > 12 ? v('--risk-4') : v('--risk-0'),
      tip: `<b>${r.timing_band}</b>`
        + `<div class="tip-row"><span>Loans</span><span>${fmtNum(r.loans)}</span></div>`
        + `<div class="tip-row"><span>First instalment failed</span><span>${fmtPct(r.fpd_pct)}</span></div>`
        + `<div class="tip-row"><span>Reached 90 days</span><span>${fmtPct(r.bad_rate_pct)}</span></div>`,
    })),
    valueFmt: (x) => fmtPct(x), rowHeight: 48, labelWidth: 240,
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

    let s = `<svg width="${W}" height="${height}" viewBox="0 0 ${W} ${height}" role="img" aria-label="Vintage curves by cohort">`;
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
  if (!series.length) { el.innerHTML = '<p class="chart-empty">Nothing to show for this selection.</p>'; return; }
  let last = 0;
  // A filter redraws the page, so this observer disconnects once its chart is gone rather
  // than accumulating one per filter change.
  const run = () => {
    if (!el.isConnected) { ro.disconnect(); return; }
    const w = el.clientWidth;
    if (!w || Math.abs(w - last) < 2) return;
    last = w;
    el.innerHTML = render(w);
    el.querySelectorAll('[data-tip]').forEach((n) => {
      n.addEventListener('mousemove', (ev) => showTip(n.getAttribute('data-tip'), ev));
      n.addEventListener('mouseleave', hideTip);
    });
  };
  const ro = new ResizeObserver(run);
  run();
  ro.observe(el);
}

/** The book headline, computed the way export_parquet.py computes it for the summary. */
function bookHeadline(vintage) {
  const atSix = {};
  for (const r of vintage) if (r.months_on_book === 6) atSix[r.cohort_label] = r.bad_rate_pct;
  const labels = Object.keys(atSix).sort();
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  return (avg(labels.slice(-3).map((l) => atSix[l])) / avg(labels.slice(0, 3).map((l) => atSix[l])) - 1) * 100;
}

// ---------------------------------------------------------------- boot

// Renders are queued, so a filter changed while the engine is still loading waits its turn
// instead of running beside the first render.
let queue = Promise.resolve();
const rerender = () => {
  queue = queue.then(() => keepScroll(render)).catch((e) => console.error(e));
  return queue;
};

try {
  performance.mark('ox-start');
  // The summary paints first and the engine starts straight after. Starting the engine first
  // was measured slower: parsing its modules held the main thread while the tiny meta.json
  // waited behind it, and the summary appeared three seconds late.
  const [m, ins] = await Promise.all([meta().catch(() => ({})), insights()]);
  INS = ins;
  await renderFreshness().catch((e) => {
    el('fresh-label').textContent = 'Freshness unknown';
    console.warn('freshness', e);
  });

  const nav = el('ox-nav');
  const f = m.summary?.filter;
  if (f) setBranch(readParam(f.param), f.options);
  renderCover(el('ox-top'), m);
  renderSignoff(el('signoff'));
  renderNav(nav, { sections: SECTIONS, filter: f && { ...f, value: branch.code } });
  // The page strip shows numbers only, so each carries its name as a tooltip.
  nav.querySelectorAll('.ox-sections a').forEach((a) => {
    const [, , label] = SECTIONS.find(([id]) => id === a.dataset.id) || [];
    if (label) { a.title = label; a.setAttribute('aria-label', `Page ${pageOf(a.dataset.id)}, ${label}`); }
  });

  // One page at a time, named in the hash, turned by the buttons or the arrow keys.
  V = views({
    ids: SECTIONS.map(([id]) => id),
    fallback: 'ox-top',
    // Turning a page lands on the top of the sheet, with the pack bar stuck above it.
    anchor: document.querySelector('.ox-bar'),
    onShow: (id, i, n) => {
      const label = SECTIONS[i]?.[2] || '';
      el('page-count').textContent = `Page ${i + 1} of ${n}`;
      el('page-name').textContent = label;
      el('page-foot').textContent = `${label} · page ${i + 1} of ${n}`;
      el('prev').disabled = i === 0;
      el('next').disabled = i === n - 1;
    },
  });
  el('prev').addEventListener('click', () => V.step(-1));
  el('next').addEventListener('click', () => V.step(1));
  document.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); V.step(1); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); V.step(-1); }
  });
  wireTheme(el('theme-toggle'), { key: 'ox-theme-sable', onChange: () => rerender() });

  onFilterChange(nav, (code) => {
    setBranch(code, f.options);
    writeParam(f.param, branch.code);
    rerender();
  });
  // Marks, so how long a prospect waits can be measured rather than guessed.
  performance.mark('ox-summary');
  const engine = connect((msg) => { const n = el('loading-msg'); if (n) n.textContent = msg; });

  await engine;
  // The first render is awaited directly, so a failure reaches the message below instead of
  // being swallowed by the queue.
  queue = render().then(() => { performance.mark('ox-ready'); });
  await queue;
} catch (err) {
  el('main').innerHTML =
    `<div class="err"><b>Could not load the warehouse.</b><br>${String(err.message || err)}
     <br><br>This page must be served over HTTP. Opening the file directly will not work,
     because the browser blocks the worker and the Parquet fetches.</div>`;
  console.error(err);
}
