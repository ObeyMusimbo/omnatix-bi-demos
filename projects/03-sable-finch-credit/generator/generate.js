// Sable & Finch Credit, synthetic South African unsecured lending dataset
// Deterministic: same seed always produces the same files.
// Node 18+, no dependencies.  Run: node generator/generate.js
//
// All money is South African rand. Fee structure follows the National Credit Act caps for
// unsecured credit, because a South African lender will check those numbers first.

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'data', 'raw');
const SEED = 20260917;

const START = Date.UTC(2024, 8, 1);   // 2024-09-01
const END = Date.UTC(2026, 7, 31);    // 2026-08-31
const DAY = 86400000;
const N_DAYS = Math.round((END - START) / DAY) + 1;
const N_MONTHS = 24;

// ---------------------------------------------------------------- rng

let _s = SEED >>> 0;
function rnd() {
  _s |= 0; _s = (_s + 0x6D2B79F5) | 0;
  let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (a) => a[Math.floor(rnd() * a.length)];
function gauss(mu, sd) {
  const u = Math.max(rnd(), 1e-9), v = Math.max(rnd(), 1e-9);
  return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function weighted(items, wKey) {
  let tot = 0;
  for (const it of items) tot += it[wKey];
  let r = rnd() * tot;
  for (const it of items) { r -= it[wKey]; if (r <= 0) return it; }
  return items[items.length - 1];
}
const r2 = (n) => Math.round(n * 100) / 100;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

// ---------------------------------------------------------------- dates

const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
function dmy(ms) {
  const d = new Date(ms), p = (n) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}
const monthStart = (m) => Date.UTC(2024, 8 + m, 1);
const monthEnd = (m) => Date.UTC(2024, 9 + m, 0);
const addMonths = (ms, n) => {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate());
};
const ymOf = (ms) => iso(ms).slice(0, 7);

// ---------------------------------------------------------------- NCA pricing
//
// Unsecured credit under the National Credit Act. Interest is capped at the repo rate plus
// 21% a year. The initiation fee is R1,207.50 plus 10% of the amount above R1,000, capped at
// R5,175 including VAT. The monthly service fee is R69 including VAT. Credit life is charged
// at R4.50 per R1,000 of the deferred amount each month. These are the real caps, and they
// are the first thing a lender in this market will check.

const REPO_RATE = 0.0725;
const RATE_CAP = REPO_RATE + 0.21;
const SERVICE_FEE_MONTHLY = 69;
const CREDIT_LIFE_PER_1000 = 4.50;

function initiationFee(principal) {
  const raw = 1207.50 + 0.10 * Math.max(0, principal - 1000);
  return r2(Math.min(raw, 5175));
}

/** Level instalment on an amortising loan, plus the monthly fees that ride alongside it. */
function instalmentFor(principal, annualRate, termMonths) {
  const capitalised = principal + initiationFee(principal);
  const i = annualRate / 12;
  const capital = i === 0
    ? capitalised / termMonths
    : capitalised * i / (1 - Math.pow(1 + i, -termMonths));
  const creditLife = capitalised / 1000 * CREDIT_LIFE_PER_1000;
  return {
    capitalised: r2(capitalised),
    instalment: r2(capital + SERVICE_FEE_MONTHLY + creditLife),
    capital_portion: r2(capital),
    credit_life: r2(creditLife),
  };
}

// ---------------------------------------------------------------- branches

const BRANCHES = [
  ['SF-JHB', 'Johannesburg CBD',  'Gauteng',       'Johannesburg', 1.00],
  ['SF-PTA', 'Pretoria Central',  'Gauteng',       'Pretoria',     0.78],
  ['SF-DBN', 'Durban Point',      'KwaZulu-Natal', 'Durban',       0.82],
  ['SF-PMB', 'Pietermaritzburg',  'KwaZulu-Natal', 'Pietermaritzburg', 0.46],
  ['SF-CPT', 'Cape Town Parade',  'Western Cape',  'Cape Town',    0.74],
  ['SF-GQE', 'Gqeberha Govan Mbeki', 'Eastern Cape', 'Gqeberha',   0.52],
  ['SF-BFN', 'Bloemfontein',      'Free State',    'Bloemfontein', 0.44],
  ['SF-PLK', 'Polokwane',         'Limpopo',       'Polokwane',    0.49],
  ['SF-MAH', 'Mahikeng',          'North West',    'Mahikeng',     0.38],
];

// PLANT 1: from mid 2025 this branch starts writing materially worse business. The cause is
// visible in the data rather than asserted: its affordability assessments begin recording
// declared income well above what the client profile supports, so loans clear the policy
// floor on paper that never should have.
const BAD_BRANCH = 'SF-MAH';
const BAD_BRANCH_FROM = Date.UTC(2025, 4, 1);   // 2025-05-01

const branches = BRANCHES.map(([code, name, province, city, weight]) => ({
  branch_code: code, branch_name: name, province, city, weight,
  opened_date: iso(START - ri(400, 3600) * DAY),
}));

// ---------------------------------------------------------------- agents

const FIRST = ['Thabo', 'Lerato', 'Sipho', 'Nomsa', 'Zanele', 'Bongani', 'Naledi', 'Mpho', 'Refilwe', 'Tebogo', 'Kagiso', 'Dineo', 'Andile', 'Lindiwe', 'Sizwe', 'Palesa', 'Johan', 'Anita', 'Fatima', 'Yusuf'];
const LAST = ['Dlamini', 'Nkosi', 'Mokoena', 'Khumalo', 'Naidoo', 'Botha', 'Pillay', 'Mahlangu', 'Sithole', 'Molefe', 'Jacobs', 'Ndlovu', 'Van Wyk', 'Maseko', 'Adams', 'Fourie', 'Govender', 'Zwane', 'Malan', 'Mthembu'];

const agents = [];
let agentN = 0;
for (const b of branches) {
  const n = Math.max(4, Math.round(b.weight * 11));
  for (let i = 0; i < n; i++) {
    agentN += 1;
    agents.push({
      agent_id: 'AG-' + (600 + agentN),
      agent_name: `${pick(FIRST)} ${pick(LAST)}`,
      branch_code: b.branch_code,
      hired_date: iso(START - ri(30, 2600) * DAY),
    });
  }
}
const agentsByBranch = {};
for (const a of agents) (agentsByBranch[a.branch_code] ||= []).push(a);

// ---------------------------------------------------------------- clients

const EMPLOYMENT = [
  { type: 'Permanent',  w: 0.62, stability: 1.00 },
  { type: 'Contract',   w: 0.20, stability: 0.80 },
  { type: 'Government', w: 0.13, stability: 1.14 },
  { type: 'Pensioner',  w: 0.05, stability: 1.06 },
];
const SECTORS = ['Retail', 'Mining', 'Manufacturing', 'Public sector', 'Security', 'Transport', 'Healthcare', 'Education', 'Hospitality', 'Construction'];

const clients = [];
let clientN = 0;
function addClient(branch) {
  clientN += 1;
  const emp = weighted(EMPLOYMENT, 'w');
  // Monthly income skewed low, which is the market this product serves
  const income = Math.round(clamp(Math.exp(gauss(Math.log(11500), 0.48)), 4200, 62000) / 50) * 50;
  // Payday is the 25th for most salaried South Africans, month end for the rest
  const payday = rnd() < 0.62 ? 25 : rnd() < 0.7 ? 30 : ri(1, 28);
  return {
    client_ref: 'CL-' + (100000 + clientN),
    home_branch_code: branch.branch_code,
    province: branch.province,
    gender: rnd() < 0.53 ? 'F' : 'M',
    age_band: pick(['18-24', '25-34', '25-34', '35-44', '35-44', '45-54', '55-64']),
    employment_type: emp.type,
    employer_sector: pick(SECTORS),
    monthly_income_zar: income,
    payday_day: payday,
    _stability: emp.stability,
  };
}
for (const b of branches) {
  const n = Math.round(b.weight * 3400);
  for (let i = 0; i < n; i++) clients.push(addClient(b));
}
const clientsByBranch = {};
for (const c of clients) (clientsByBranch[c.home_branch_code] ||= []).push(c);

// ---------------------------------------------------------------- affordability
//
// The National Credit Act obliges the lender to assess whether the client can service the
// loan. The regulations set a minimum monthly expense norm by income band; anything the
// client has left after that norm and their existing obligations is what is available for a
// new instalment. Writing a loan that breaches the floor is reckless lending, and the
// contract is voidable.

function expenseNorm(income) {
  if (income <= 800) return income;
  if (income <= 6250) return 1167.88 + (income - 800) * 0.0775;
  if (income <= 25000) return 1601.32 + (income - 6250) * 0.068;
  if (income <= 50000) return 2849.83 + (income - 25000) * 0.0691;
  return 4579.32 + (income - 50000) * 0.0664;
}

// ---------------------------------------------------------------- loans

const TERMS = [
  { months: 6,  w: 0.14, riskMul: 0.78 },
  { months: 12, w: 0.32, riskMul: 1.00 },
  { months: 18, w: 0.22, riskMul: 1.18 },
  { months: 24, w: 0.24, riskMul: 1.34 },
  { months: 36, w: 0.08, riskMul: 1.62 },
];
const PURPOSES = ['Debt consolidation', 'School fees', 'Home improvement', 'Medical', 'Funeral', 'Vehicle repair', 'Business', 'Other'];

const loans = [];
const affordability = [];
const repayments = [];
const arrears = [];
const collections = [];
const writeoffs = [];

let loanN = 0, assessN = 0, payN = 0, actN = 0;

const ledger = {
  floorBreaches: 0, badBranchLoans: 0, topups: 0, paydayMismatch: 0,
  collectionsCost: { '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 },
  cures: { '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 },
  entered: { '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 },
};

// Loans that fell into arrears and are waiting to be refinanced away (PLANT 4)
const arrearsPool = [];

const MONTH_VOLUME = [];
for (let m = 0; m < N_MONTHS; m++) {
  // Book grows through the window, with the January collapse every SA lender sees
  const season = [0.72, 0.88, 1.04, 1.00, 0.98, 0.96, 1.00, 1.02, 1.00, 1.04, 1.08, 1.16][(8 + m) % 12];
  MONTH_VOLUME.push(Math.round(880 * season * Math.pow(1.055, m / 12) * (0.94 + rnd() * 0.12)));
}

function originate(m, branch, settledLoan) {
  const disbursedMs = monthStart(m) + ri(0, 27) * DAY;
  if (disbursedMs > END) return null;

  const pool = clientsByBranch[branch.branch_code];
  const client = settledLoan
    ? clients.find((c) => c.client_ref === settledLoan.client_ref)
    : pick(pool);
  if (!client) return null;

  const agent = pick(agentsByBranch[branch.branch_code]);
  const term = weighted(TERMS, 'w');

  const isBadBranchPeriod = branch.branch_code === BAD_BRANCH && disbursedMs >= BAD_BRANCH_FROM;

  // Principal scales with income, and a top-up has to clear the balance it is settling
  let principal = Math.round(clamp(client.monthly_income_zar * (1.0 + rnd() * 3.2), 3000, 50000) / 500) * 500;
  if (settledLoan) principal = Math.max(principal, Math.round((settledLoan._balance + 2500) / 500) * 500);
  principal = clamp(principal, 3000, 50000);

  const annualRate = r2(clamp(gauss(RATE_CAP - 0.015, 0.012), 0.19, RATE_CAP));
  const quote = instalmentFor(principal, annualRate, term.months);

  // ---- affordability assessment
  const norm = expenseNorm(client.monthly_income_zar);
  const net = Math.round(client.monthly_income_zar * (0.82 + rnd() * 0.1));
  const existing = Math.round(client.monthly_income_zar * clamp(gauss(0.30, 0.15), 0, 0.64));
  // PLANT 1: the bad branch records income above what the client profile supports, so the
  // assessment clears a floor the real numbers would not.
  const inflation = isBadBranchPeriod && rnd() < 0.62 ? 1.18 + rnd() * 0.22 : 1.0;
  const declaredGross = Math.round(client.monthly_income_zar * inflation);
  const declaredNet = Math.round(net * inflation);
  const declaredExpenses = Math.round(norm * (0.92 + rnd() * 0.2));
  const disposable = r2(declaredNet - declaredExpenses - existing);
  const disposableAfter = r2(disposable - quote.instalment);

  // PLANT 2: a slice of the book is written with nothing left after the instalment. Some of
  // that is the bad branch, some is ordinary pressure to hit a target.
  const breachesFloor = disposableAfter < 0;
  if (breachesFloor && !isBadBranchPeriod && rnd() < 0.42) return null;   // many are declined

  loanN += 1;
  const loan_id = 'LN-' + (500000 + loanN);
  assessN += 1;

  affordability.push({
    assessment_id: 'AF-' + (700000 + assessN),
    loan_id,
    assessed_at: iso(disbursedMs - ri(0, 3) * DAY),
    assessor_agent_id: agent.agent_id,
    declared_gross_income_zar: declaredGross,
    declared_net_income_zar: declaredNet,
    declared_expenses_zar: declaredExpenses,
    existing_obligations_zar: existing,
    regulated_expense_norm_zar: r2(norm),
    disposable_income_zar: disposable,
    disposable_after_instalment_zar: disposableAfter,
  });

  // PLANT 3: the debit order is set for a day that does not follow the client's payday
  const offset = rnd() < 0.78 ? ri(0, 2) : ri(4, 12);
  const debitDay = ((client.payday_day - 1 + offset) % 28) + 1;
  const paydayGap = offset;
  const mismatched = paydayGap > 3;
  if (mismatched) ledger.paydayMismatch += 1;
  if (breachesFloor) ledger.floorBreaches += 1;
  if (isBadBranchPeriod) ledger.badBranchLoans += 1;
  if (settledLoan) ledger.topups += 1;

  // ---- latent credit risk for this loan
  //
  // Everything that drives default is a property recorded somewhere in the source files, so
  // the warehouse can find it. Nothing here is asserted in a column the analyst cannot see.
  let hazard = 0.038;
  hazard *= term.riskMul;
  hazard /= client._stability;
  if (breachesFloor) hazard *= 2.2;
  else if (disposableAfter < norm * 0.15) hazard *= 1.45;
  if (mismatched) hazard *= 1.55 + paydayGap * 0.06;
  if (isBadBranchPeriod) hazard *= 3.40;
  if (settledLoan) hazard *= 2.75;           // PLANT 4: a top-up hides yesterday's problem
  hazard *= Math.exp(gauss(0, 0.30));
  hazard = clamp(hazard, 0.004, 0.62);

  const loan = {
    loan_id,
    client_ref: client.client_ref,
    branch_code: branch.branch_code,
    agent_id: agent.agent_id,
    disbursement_date: disbursedMs,
    principal_zar: principal,
    initiation_fee_zar: initiationFee(principal),
    capitalised_amount_zar: quote.capitalised,
    interest_rate_annual: annualRate,
    term_months: term.months,
    monthly_service_fee_zar: SERVICE_FEE_MONTHLY,
    credit_life_monthly_zar: quote.credit_life,
    instalment_zar: quote.instalment,
    debit_order_day: debitDay,
    purpose: pick(PURPOSES),
    is_topup: settledLoan ? 'Y' : 'N',
    settles_loan_id: settledLoan ? settledLoan.loan_id : '',
    status: 'Active',
    _hazard: hazard,
    _balance: quote.capitalised,
    _client: client,
    _term: term.months,
    _dpd: 0,
    _missed: 0,
    _cohort: m,
    _everWrittenOff: false,
    _ever90: false,
  };
  loans.push(loan);
  return loan;
}

// ---------------------------------------------------------------- simulate

const COLLECTION_CHANNELS = [
  { channel: 'SMS',   cost: 1.20,  effect: 0.05 },
  { channel: 'Call',  cost: 28.00, effect: 0.22 },
  { channel: 'Letter', cost: 46.00, effect: 0.08 },
  { channel: 'Field', cost: 320.00, effect: 0.30 },
];

function bucketFor(dpd) {
  if (dpd <= 0) return 'Current';
  if (dpd <= 30) return '1-30';
  if (dpd <= 60) return '31-60';
  if (dpd <= 90) return '61-90';
  return '90+';
}

for (let m = 0; m < N_MONTHS; m++) {
  // ---- originate this month's book
  const volume = MONTH_VOLUME[m];
  for (let i = 0; i < volume; i++) {
    // PLANT 4: roughly one loan in sixteen is a top-up written to settle an account already
    // in arrears. The old loan closes as Settled, which reads as a good outcome and pulls the
    // arrears number down, while the risk simply moves into a bigger, newer loan.
    let settled = null;
    if (arrearsPool.length > 40 && rnd() < 0.065) {
      const idx = ri(0, arrearsPool.length - 1);
      settled = arrearsPool.splice(idx, 1)[0];
      if (settled.status !== 'Active') settled = null;
    }
    const branch = settled
      ? branches.find((b) => b.branch_code === settled.branch_code)
      : weighted(branches, 'weight');
    const created = originate(m, branch, settled);
    if (created && settled) {
      settled.status = 'Settled';
      settled._settledBy = created.loan_id;
      settled._balance = 0;
      settled._dpd = 0;
    }
  }

  // ---- run the book forward one month
  const asOf = monthEnd(m);
  for (const loan of loans) {
    if (loan.status !== 'Active') continue;
    if (loan.disbursement_date > asOf) continue;

    const monthsOnBook = Math.max(0, (m - loan._cohort));
    if (monthsOnBook === 0) continue;              // first instalment falls the following month
    if (monthsOnBook > loan._term) { loan.status = 'Settled'; loan._balance = 0; continue; }

    const dueDate = Math.min(addMonths(loan.disbursement_date, monthsOnBook), END + 60 * DAY);
    const bucketBefore = bucketFor(loan._dpd);

    // Collections effort is aimed at the oldest bucket, which is also where almost nothing
    // can be recovered. PLANT 5.
    let collectionLift = 0;
    if (loan._dpd > 0) {
      const b = bucketFor(loan._dpd);
      const attempts = b === '90+' ? ri(2, 5) : b === '61-90' ? ri(1, 3) : b === '31-60' ? ri(0, 2) : (rnd() < 0.35 ? 1 : 0);
      for (let k = 0; k < attempts; k++) {
        const ch = b === '90+' || b === '61-90'
          ? weighted([{ ...COLLECTION_CHANNELS[1], w: 4 }, { ...COLLECTION_CHANNELS[3], w: 3 }, { ...COLLECTION_CHANNELS[2], w: 2 }], 'w')
          : weighted([{ ...COLLECTION_CHANNELS[0], w: 6 }, { ...COLLECTION_CHANNELS[1], w: 3 }], 'w');
        actN += 1;
        const outcome = rnd() < ch.effect ? pick(['Promise to pay', 'Paid in full', 'Partial payment'])
          : pick(['No answer', 'Number unobtainable', 'Refused', 'Left message']);
        collections.push({
          activity_id: 'CA-' + (800000 + actN),
          loan_id: loan.loan_id,
          activity_date: iso(asOf - ri(0, 25) * DAY),
          channel: ch.channel,
          outcome,
          cost_zar: r2(ch.cost * (1 + gauss(0, 0.08))),
          arrears_bucket_at_time: b,
        });
        ledger.collectionsCost[b] += ch.cost;
        if (outcome === 'Paid in full') collectionLift += 0.45;
        else if (outcome === 'Promise to pay') collectionLift += 0.12;
      }
    }

    // ---- did the instalment arrive
    //
    // An account already in arrears does not behave like a performing one. Each month it
    // either clears the arrears and comes back to current, or misses again and rolls into the
    // next bucket. Letting a delinquent loan simply resume paying, which an earlier version of
    // this did, produces a book where almost nothing ever reaches 90 days, and that is not
    // what this market looks like.
    //
    // There is deliberately no middle case where the client pays the current instalment and
    // stays in the same bucket. Payment allocation is oldest first, so a full instalment
    // always advances the oldest outstanding one. Modelling a hold made days past due
    // disagree with the payment history on thousands of rows, which buried the one place
    // those two systems are supposed to disagree.
    //
    // The roll rates below give roughly half the book missing an instalment at some point
    // over its life and about a fifth reaching 90 days, which is where South African
    // unsecured lending actually sits.
    const ageFactor = 1 + Math.max(0, 6 - monthsOnBook) * 0.06;   // early months are riskiest
    const cureChance = loan._dpd > 90 ? 0.07 : loan._dpd > 60 ? 0.16 : loan._dpd > 30 ? 0.30 : 0.52;
    const missProb = clamp(loan._hazard * ageFactor - collectionLift * 0.5, 0.002, 0.95);

    let paid, status, amountPaid;
    if (loan._dpd > 0) {
      const roll = rnd();
      const cure = clamp(cureChance + collectionLift, 0, 0.95);
      if (roll < cure) {
        // Arrears cleared: this month's instalment plus what was outstanding
        paid = true; status = 'Paid'; amountPaid = r2(loan.instalment_zar * (1 + loan._dpd / 30));
        ledger.cures[bucketBefore] = (ledger.cures[bucketBefore] || 0) + 1;
        loan._dpd = 0;
      } else {
        paid = false;
        status = rnd() < 0.24 ? 'Partial' : 'Failed';
        amountPaid = status === 'Partial' ? r2(loan.instalment_zar * (0.2 + rnd() * 0.5)) : 0;
        loan._dpd += 30;
        loan._missed += 1;
      }
    } else if (rnd() < missProb) {
      paid = false;
      status = rnd() < 0.24 ? 'Partial' : 'Failed';
      amountPaid = status === 'Partial' ? r2(loan.instalment_zar * (0.2 + rnd() * 0.5)) : 0;
      loan._dpd = 30;
      loan._missed += 1;
    } else {
      paid = true; status = 'Paid'; amountPaid = loan.instalment_zar;
    }

    payN += 1;
    repayments.push({
      payment_id: 'RP-' + (900000 + payN),
      loan_id: loan.loan_id,
      instalment_no: monthsOnBook,
      due_date: dueDate,
      paid_date: paid || status === 'Partial' ? dueDate + ri(0, 9) * DAY : '',
      amount_due_zar: loan.instalment_zar,
      amount_paid_zar: amountPaid,
      payment_method: rnd() < 0.86 ? 'Debit order' : rnd() < 0.7 ? 'EFT' : 'Cash',
      status,
      failure_reason: status === 'Failed'
        ? pick(['Insufficient funds', 'Account closed', 'Debit order disputed', 'No authority', 'Payment stopped'])
        : '',
    });

    loan._balance = r2(Math.max(0, loan._balance - (amountPaid - loan.monthly_service_fee_zar - loan.credit_life_monthly_zar) * 0.86));

    const bucketAfter = bucketFor(loan._dpd);
    if (bucketAfter !== 'Current' && bucketAfter !== bucketBefore) {
      ledger.entered[bucketAfter] = (ledger.entered[bucketAfter] || 0) + 1;
    }
    if (loan._dpd >= 90 && !loan._ever90) {
      loan._ever90 = true;
      loan._first90_month = m;
    }
    // Once an account is properly delinquent it becomes a candidate to be refinanced away
    if (loan._dpd >= 30 && loan._dpd <= 90 && loan.is_topup === 'N' && !arrearsPool.includes(loan)) {
      arrearsPool.push(loan);
    }

    // ---- write off at 150 days, five missed instalments, which is where most South
    // African unsecured lenders sit
    if (loan._dpd >= 150) {
      loan.status = 'Written off';
      loan._everWrittenOff = true;
      writeoffs.push({
        loan_id: loan.loan_id,
        writeoff_date: iso(asOf),
        outstanding_at_writeoff_zar: r2(loan._balance),
        recovery_to_date_zar: r2(loan._balance * clamp(gauss(0.07, 0.05), 0, 0.3)),
      });
      loan._balance = 0;
    }

    // ---- month end arrears snapshot
    if (loan.status === 'Active' || loan._dpd > 0) {
      arrears.push({
        snapshot_date: iso(asOf),
        loan_id: loan.loan_id,
        days_past_due: loan._dpd,
        outstanding_balance_zar: r2(loan._balance),
        arrears_amount_zar: r2(Math.min(loan._dpd / 30, loan._term) * loan.instalment_zar),
        arrears_bucket: bucketFor(loan._dpd),
      });
    }
  }
}

for (const loan of loans) {
  if (loan.status === 'Active' && loan._balance <= 1) loan.status = 'Settled';
}

// ---------------------------------------------------------------- deliberate mess

function messyBranch(s) {
  const r = rnd();
  return r < 0.06 ? s.toUpperCase() : r < 0.10 ? '  ' + s : r < 0.13 ? s + ' ' : s;
}
function messyStatus(s) {
  const r = rnd();
  return r < 0.07 ? s.toUpperCase() : r < 0.12 ? s.toLowerCase() : s;
}
const messyAmount = (n) =>
  rnd() < 0.08 && Math.abs(n) >= 1000
    ? `"${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}"`
    : n;

// ~2.5% of loans lost their rate on migration and need the product default
for (const l of loans) if (rnd() < 0.025) l.interest_rate_annual = '';
// Double-posted receipts
const dupPay = [];
for (let i = 0; i < Math.round(repayments.length * 0.004); i++) dupPay.push({ ...repayments[ri(0, repayments.length - 1)] });
for (const d of dupPay) repayments.push(d);
// Reversals: a receipt captured then backed out. Real, and must not be dropped.
for (let i = 0; i < 260; i++) {
  const src = repayments[ri(0, repayments.length - 1)];
  repayments.push({ ...src, payment_id: 'RP-' + (900000 + (++payN)), amount_paid_zar: -Math.abs(src.amount_paid_zar), status: 'Reversed', failure_reason: 'Receipt reversed' });
}
// Repayments quoting loans that are not in the loan book
for (let i = 0; i < 110; i++) repayments[ri(0, repayments.length - 1)].loan_id = 'LN-' + ri(400000, 499999);
// PLANT, defect 10: the arrears file and the repayment history disagree for a slice of rows.
// Two systems of record, one reconciliation nobody runs.
let conflicted = 0;
for (const a of arrears) {
  if (rnd() < 0.018) { a.days_past_due = Math.max(0, a.days_past_due + pick([-30, 30, 30, 60])); a.arrears_bucket = bucketFor(a.days_past_due); conflicted += 1; }
}

// ---------------------------------------------------------------- write

function writeCsv(file, header, rows, mapper) {
  const fd = fs.openSync(path.join(OUT, file), 'w');
  let buf = header.join(',') + '\n';
  for (const r of rows) {
    buf += mapper(r).join(',') + '\n';
    if (buf.length > 1 << 22) { fs.writeSync(fd, buf); buf = ''; }
  }
  if (buf) fs.writeSync(fd, buf);
  fs.closeSync(fd);
  return rows.length;
}
const q = (v) => (typeof v === 'string' && (v.includes(',') || v.includes('"')) && !v.startsWith('"') ? `"${v.replace(/"/g, '""')}"` : v);

const counts = {};
counts['branches.csv'] = writeCsv('branches.csv',
  ['branch_code', 'branch_name', 'province', 'city', 'opened_date'],
  branches, (b) => [b.branch_code, q(messyBranch(b.branch_name)), q(b.province), q(b.city), b.opened_date]);

counts['agents.csv'] = writeCsv('agents.csv',
  ['agent_id', 'agent_name', 'branch_code', 'hired_date'],
  agents, (a) => [a.agent_id, q(a.agent_name), a.branch_code, a.hired_date]);

counts['clients.csv'] = writeCsv('clients.csv',
  ['client_ref', 'home_branch_code', 'province', 'gender', 'age_band', 'employment_type', 'employer_sector', 'monthly_income_zar', 'payday_day'],
  clients, (c) => [c.client_ref, c.home_branch_code, q(c.province), c.gender, c.age_band, q(c.employment_type), q(c.employer_sector), c.monthly_income_zar, c.payday_day]);

counts['loans.csv'] = writeCsv('loans.csv',
  ['loan_id', 'client_ref', 'branch_code', 'agent_id', 'disbursement_date', 'principal_zar', 'initiation_fee_zar', 'capitalised_amount_zar', 'interest_rate_annual', 'term_months', 'monthly_service_fee_zar', 'credit_life_monthly_zar', 'instalment_zar', 'debit_order_day', 'purpose', 'is_topup', 'settles_loan_id', 'status'],
  loans, (l) => [l.loan_id, l.client_ref, l.branch_code, l.agent_id,
    rnd() < 0.27 ? dmy(l.disbursement_date) : iso(l.disbursement_date),
    l.principal_zar, l.initiation_fee_zar, messyAmount(l.capitalised_amount_zar), l.interest_rate_annual,
    l.term_months, l.monthly_service_fee_zar, l.credit_life_monthly_zar, messyAmount(l.instalment_zar),
    l.debit_order_day, q(l.purpose), l.is_topup, l.settles_loan_id, messyStatus(l.status)]);

counts['affordability.csv'] = writeCsv('affordability.csv',
  ['assessment_id', 'loan_id', 'assessed_at', 'assessor_agent_id', 'declared_gross_income_zar', 'declared_net_income_zar', 'declared_expenses_zar', 'existing_obligations_zar', 'regulated_expense_norm_zar', 'disposable_income_zar', 'disposable_after_instalment_zar'],
  affordability, (a) => [a.assessment_id, a.loan_id, a.assessed_at, a.assessor_agent_id,
    a.declared_gross_income_zar, a.declared_net_income_zar, a.declared_expenses_zar,
    a.existing_obligations_zar, a.regulated_expense_norm_zar,
    messyAmount(a.disposable_income_zar), a.disposable_after_instalment_zar]);

counts['repayments.csv'] = writeCsv('repayments.csv',
  ['payment_id', 'loan_id', 'instalment_no', 'due_date', 'paid_date', 'amount_due_zar', 'amount_paid_zar', 'payment_method', 'status', 'failure_reason'],
  repayments, (p) => [p.payment_id, p.loan_id, p.instalment_no,
    rnd() < 0.27 ? dmy(p.due_date) : iso(p.due_date),
    p.paid_date === '' ? '' : iso(p.paid_date),
    p.amount_due_zar, messyAmount(p.amount_paid_zar), q(p.payment_method), messyStatus(p.status), q(p.failure_reason)]);

counts['arrears_snapshots.csv'] = writeCsv('arrears_snapshots.csv',
  ['snapshot_date', 'loan_id', 'days_past_due', 'outstanding_balance_zar', 'arrears_amount_zar', 'arrears_bucket'],
  arrears, (a) => [a.snapshot_date, a.loan_id, a.days_past_due, messyAmount(a.outstanding_balance_zar), a.arrears_amount_zar, a.arrears_bucket]);

counts['collections_activity.csv'] = writeCsv('collections_activity.csv',
  ['activity_id', 'loan_id', 'activity_date', 'channel', 'outcome', 'cost_zar', 'arrears_bucket_at_time'],
  collections, (c) => [c.activity_id, c.loan_id, c.activity_date, c.channel, q(c.outcome), c.cost_zar, c.arrears_bucket_at_time]);

counts['writeoffs.csv'] = writeCsv('writeoffs.csv',
  ['loan_id', 'writeoff_date', 'outstanding_at_writeoff_zar', 'recovery_to_date_zar'],
  writeoffs, (w) => [w.loan_id, w.writeoff_date, w.outstanding_at_writeoff_zar, w.recovery_to_date_zar]);

// ---------------------------------------------------------------- shape report

const R = (n) => (n < 0 ? '-R' : 'R') + Math.round(Math.abs(n)).toLocaleString('en-ZA');
const pct = (n) => (n * 100).toFixed(1) + '%';

const disbursed = loans.reduce((a, l) => a + l.principal_zar, 0);
const wo = writeoffs.reduce((a, w) => a + w.outstanding_at_writeoff_zar, 0);
const ever90 = loans.filter((l) => l._ever90).length;
const badBranch90 = loans.filter((l) => l.branch_code === BAD_BRANCH && l.disbursement_date >= BAD_BRANCH_FROM && l._ever90).length;
const badBranchTot = loans.filter((l) => l.branch_code === BAD_BRANCH && l.disbursement_date >= BAD_BRANCH_FROM).length;
const topups = loans.filter((l) => l.is_topup === 'Y');
const topup90 = topups.filter((l) => l._ever90).length;
const breach = loans.filter((l, i) => affordability[i] && affordability[i].disposable_after_instalment_zar < 0);

console.log('Sable & Finch Credit, generated\n');
for (const [f, n] of Object.entries(counts)) {
  const sz = fs.statSync(path.join(OUT, f)).size;
  console.log(`  ${f.padEnd(26)} ${String(n).padStart(9)} rows   ${(sz / 1048576).toFixed(1)} MB`);
}
console.log(`\n  branches ${branches.length}   agents ${agents.length}   clients ${clients.length.toLocaleString('en-ZA')}   loans ${loans.length.toLocaleString('en-ZA')}`);
console.log(`  disbursed        ${R(disbursed)}   average ${R(disbursed / loans.length)}`);
console.log(`  written off      ${R(wo)}  (${pct(wo / disbursed)} of disbursed)`);
console.log(`  ever 90+ DPD     ${pct(ever90 / loans.length)} of loans`);
console.log(`\n  ${BAD_BRANCH} after ${iso(BAD_BRANCH_FROM)}  ${pct(badBranch90 / Math.max(1, badBranchTot))} ever 90+  (book ${pct(ever90 / loans.length)})`);
console.log(`  top-ups          ${topups.length.toLocaleString('en-ZA')}  ${pct(topup90 / Math.max(1, topups.length))} ever 90+`);
console.log(`  affordability floor breaches  ${ledger.floorBreaches.toLocaleString('en-ZA')}`);
console.log(`  debit order mismatches        ${ledger.paydayMismatch.toLocaleString('en-ZA')}`);
console.log(`  arrears file conflicts        ${conflicted.toLocaleString('en-ZA')}`);
console.log('\n  collections cost by bucket:');
for (const b of ['1-30', '31-60', '61-90', '90+']) {
  const c = ledger.collectionsCost[b], cures = ledger.cures[b] || 0, ent = ledger.entered[b] || 1;
  console.log(`    ${b.padEnd(6)} ${R(c).padStart(12)}   cure rate ${pct(cures / ent)}`);
}
console.log('\n  The findings are measured from the warehouse, not from here.');
console.log('  Next: dbt build, then generator/build_answer_key.py');
