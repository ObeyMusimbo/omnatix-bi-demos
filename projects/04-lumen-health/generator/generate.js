// Lumen Health Network, synthetic South African private clinic group dataset
// Deterministic: same seed always produces the same files.
// Node 18+, no dependencies.  Run: node generator/generate.js
//
// All money is South African rand. No patient identifiers of any kind exist in this data:
// patients are a reference number, an age band and a scheme. There are no names, no dates of
// birth and no identity numbers, because a demo dataset for healthcare should not contain a
// shape that could ever be mistaken for the real thing.

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'data', 'raw');
const SEED = 20260918;

const START = Date.UTC(2024, 8, 1);   // 2024-09-01
const END = Date.UTC(2026, 7, 31);    // 2026-08-31
const DAY = 86400000;
const N_DAYS = Math.round((END - START) / DAY) + 1;

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

const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const isoTs = (ms) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
function dmy(ms) {
  const d = new Date(ms), p = (n) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}
const dow = (ms) => new Date(ms).getUTCDay();   // 0 Sun .. 6 Sat
const hhmm = (ms) => new Date(ms).toISOString().slice(11, 16);

// ---------------------------------------------------------------- clinics

const CLINICS = [
  ['LUM-SAN', 'Lumen Sandton',        'Johannesburg', 'Gauteng',       7, 1.00],
  ['LUM-PTA', 'Lumen Brooklyn',       'Pretoria',     'Gauteng',        6, 0.82],
  ['LUM-UMH', 'Lumen Umhlanga',       'Durban',       'KwaZulu-Natal',  6, 0.78],
  ['LUM-CLR', 'Lumen Claremont',      'Cape Town',    'Western Cape',   6, 0.86],
  ['LUM-GQE', 'Lumen Summerstrand',   'Gqeberha',     'Eastern Cape',   4, 0.54],
  ['LUM-BFN', 'Lumen Westdene',       'Bloemfontein', 'Free State',     4, 0.46],
];

// How reliably the front desk actually sends the reminder. Not in any source file: it is a
// habit, and the only trace of it is the reminder flag on the bookings each site takes.
const REMINDER_DISCIPLINE = {
  'LUM-SAN': 1.00, 'LUM-PTA': 0.92, 'LUM-UMH': 0.71,
  'LUM-CLR': 0.96, 'LUM-GQE': 0.48, 'LUM-BFN': 0.55,
};

const clinics = CLINICS.map(([code, name, city, province, rooms, weight]) => ({
  clinic_code: code, clinic_name: name, city, province, consulting_rooms: rooms, weight,
  opened_date: iso(START - ri(500, 4200) * DAY),
  reminderDiscipline: REMINDER_DISCIPLINE[code],
}));

// ---------------------------------------------------------------- disciplines

const DISCIPLINES = [
  { name: 'General practice',  w: 0.42, slot: 20, tariff: 620,  sessional: 4200 },
  { name: 'Dentistry',         w: 0.16, slot: 30, tariff: 1150, sessional: 5600 },
  { name: 'Physiotherapy',     w: 0.14, slot: 30, tariff: 540,  sessional: 3100 },
  { name: 'Radiology',         w: 0.10, slot: 25, tariff: 1480, sessional: 7400 },
  { name: 'Dietetics',         w: 0.06, slot: 30, tariff: 610,  sessional: 2900 },
  { name: 'Occupational health', w: 0.07, slot: 20, tariff: 720, sessional: 3400 },
  { name: 'Minor procedures',  w: 0.05, slot: 45, tariff: 2350, sessional: 6800 },
];
const byDiscipline = Object.fromEntries(DISCIPLINES.map((d) => [d.name, d]));

// ---------------------------------------------------------------- schemes
//
// South African medical schemes. Fictional names, but the mechanics are the real ones: the
// scheme pays its tariff, the practice charges its own, and the patient owes the gap.

const SCHEMES = [
  ['SCH-AUR', 'Aurum Health',     0.30, 32, 0.94],
  ['SCH-VER', 'Veritas Medical',  0.19, 29, 0.97],
  ['SCH-KOP', 'Koppie Health',    0.14, 74, 0.88],   // the slow payer
  ['SCH-NDL', 'Ndlela Scheme',    0.12, 35, 0.92],
  ['SCH-STL', 'Stellar Med',      0.09, 31, 0.95],
  ['SCH-GOV', 'Public Service Med', 0.08, 44, 0.90],
  ['SELF',    'Self funded',      0.08, 0,  1.00],
];
const schemes = SCHEMES.map(([code, name, share, terms, tariffFactor]) => ({
  scheme_code: code, scheme_name: name, share,
  payment_terms_days: terms,
  tariff_factor: tariffFactor,   // what the scheme pays against the practice tariff
}));
const SLOW_SCHEME = 'SCH-KOP';

// ---------------------------------------------------------------- practitioners

const FIRST = ['Thandi', 'Sipho', 'Anita', 'Riaan', 'Nomsa', 'Yusuf', 'Karabo', 'Michelle', 'Pieter', 'Zanele', 'Farhaan', 'Lerato', 'Johan', 'Priya', 'Sizwe', 'Elmarie', 'Tebogo', 'Deon', 'Naledi', 'Imraan'];
const LAST = ['Dlamini', 'Naidoo', 'Botha', 'Khumalo', 'Pillay', 'Mahlangu', 'Van Wyk', 'Molefe', 'Adams', 'Ndlovu', 'Fourie', 'Govender', 'Zwane', 'Malan', 'Maseko', 'Jacobs', 'Sithole', 'Nkosi', 'Du Toit', 'Patel'];

const practitioners = [];
let pracN = 0;
for (const c of clinics) {
  const n = Math.max(4, Math.round(c.weight * 7));
  for (let i = 0; i < n; i++) {
    pracN += 1;
    const d = weighted(DISCIPLINES, 'w');
    practitioners.push({
      practitioner_id: 'PR-' + (3000 + pracN),
      practitioner_name: `Dr ${pick(FIRST)} ${pick(LAST)}`,
      discipline: d.name,
      clinic_code: c.clinic_code,
      practice_number: 'PN-' + ri(1000000, 9999999),
      sessional_cost_zar: Math.round(d.sessional * (1 + gauss(0, 0.07))),
      joined_date: iso(START - ri(60, 3000) * DAY),
      // PLANT 4: demand is not spread evenly across the roster. Some practitioners are
      // booked solid and others are not, on near identical sessional cost.
      demandPull: clamp(Math.exp(gauss(0, 0.42)), 0.42, 2.1),
    });
  }
}
const pracByClinic = {};
for (const p of practitioners) (pracByClinic[p.clinic_code] ||= []).push(p);

// ---------------------------------------------------------------- patients

const patients = [];
let patN = 0;
for (const c of clinics) {
  const n = Math.round(c.weight * 9000);
  for (let i = 0; i < n; i++) {
    patN += 1;
    const s = weighted(schemes, 'share');
    patients.push({
      patient_ref: 'PT-' + (200000 + patN),
      home_clinic_code: c.clinic_code,
      province: c.province,
      age_band: pick(['0-17', '18-34', '18-34', '35-49', '35-49', '50-64', '65+']),
      gender: rnd() < 0.55 ? 'F' : 'M',
      scheme_code: s.scheme_code,
      scheme_plan: pick(['Essential', 'Classic', 'Comprehensive', 'Saver', 'Core']),
      // Whether this patient tends to settle the gap at reception
      gapDiscipline: clamp(gauss(0.45, 0.22), 0.02, 0.95),
    });
  }
}
const patByClinic = {};
for (const p of patients) (patByClinic[p.home_clinic_code] ||= []).push(p);

// ---------------------------------------------------------------- sessions
//
// The capacity grid. A session is a practitioner sitting in a room for a block of hours, and
// it costs the same whether anybody walks through the door or not.

const sessions = [];
const appointments = [];
const encounters = [];
const claims = [];
const payments = [];

let sessN = 0, apptN = 0, encN = 0, claimN = 0, payN = 0;

// PLANT 1: demand across the working week is nothing like flat. Monday mornings are quiet and
// late week afternoons are heaving, and the roster is identical on both.
const DAY_DEMAND  = [0, 0.62, 0.92, 1.02, 1.18, 1.22, 0.55, 0];   // index by getUTCDay, Sat low
const HOUR_DEMAND = { 8: 0.55, 9: 0.72, 10: 0.86, 11: 0.95, 12: 0.80, 13: 0.74, 14: 1.06, 15: 1.18, 16: 1.20, 17: 0.92 };
const MONDAY_MORNING_PENALTY = 0.56;

const ICD10 = ['J06.9', 'M54.5', 'K02.1', 'R51', 'E11.9', 'I10', 'J45.9', 'L23.9', 'N39.0', 'M25.5', 'Z00.0', 'B34.9'];
const PROCEDURES = ['0190', '0191', '0192', '8101', '8102', '1211', '3007', '0146'];

const REJECTION_REASONS = [
  { reason: 'Missing referral', fixable: true, w: 0.20 },
  { reason: 'Incorrect ICD-10 code', fixable: true, w: 0.22 },
  { reason: 'Authorisation not obtained', fixable: true, w: 0.17 },
  { reason: 'Membership lapsed at date of service', fixable: false, w: 0.14 },
  { reason: 'Benefit exhausted', fixable: false, w: 0.15 },
  { reason: 'Practice number incorrect', fixable: true, w: 0.07 },
  { reason: 'Service not covered on plan', fixable: false, w: 0.05 },
];

// PLANT 2: two clinics never work their rejections. The scheme allows four months to
// resubmit; past that the money is simply gone.
const POOR_REWORK = new Set(['LUM-GQE', 'LUM-BFN']);
const RESUBMIT_DEADLINE_DAYS = 120;

const ledger = {
  slotsOffered: 0, slotsBooked: 0, noShows: 0,
  deniedZar: 0, neverResubmittedZar: 0, gapBilledZar: 0, gapCollectedZar: 0,
};

for (let d = 0; d < N_DAYS; d++) {
  const ms = START + d * DAY;
  const w = dow(ms);
  if (w === 0) continue;                                    // closed Sundays
  const season = [0.92, 0.95, 1.06, 1.02, 1.04, 1.08, 1.10, 1.06, 1.00, 0.98, 0.96, 0.82][new Date(ms).getUTCMonth()];
  const growth = Math.pow(1.06, d / 365);

  for (const clinic of clinics) {
    for (const prac of pracByClinic[clinic.clinic_code]) {
      if (w === 6 && rnd() < 0.62) continue;                // partial Saturday roster
      if (rnd() < 0.10) continue;                           // leave, study, theatre lists
      const disc = byDiscipline[prac.discipline];
      const startHour = 8;
      const endHour = w === 6 ? 13 : 17;

      sessN += 1;
      const session_id = 'SE-' + (400000 + sessN);
      const slotMinutes = disc.slot;
      const slotsInSession = Math.floor((endHour - startHour) * 60 / slotMinutes);

      sessions.push({
        session_id,
        clinic_code: clinic.clinic_code,
        practitioner_id: prac.practitioner_id,
        session_date: ms,
        start_time: `${String(startHour).padStart(2, '0')}:00`,
        end_time: `${String(endHour).padStart(2, '0')}:00`,
        slot_minutes: slotMinutes,
        slots_offered: slotsInSession,
        sessional_cost_zar: r2(prac.sessional_cost_zar * (endHour - startHour) / 9),
      });
      ledger.slotsOffered += slotsInSession;

      for (let s = 0; s < slotsInSession; s++) {
        const slotStart = ms + (startHour * 60 + s * slotMinutes) * 60000;
        const hour = startHour + Math.floor(s * slotMinutes / 60);

        let fill = 0.78 * DAY_DEMAND[w] * (HOUR_DEMAND[hour] ?? 0.8) * prac.demandPull * season * growth;
        if (w === 1 && hour < 12) fill *= MONDAY_MORNING_PENALTY;
        fill = clamp(fill, 0.04, 0.98);
        if (rnd() > fill) continue;                         // slot goes unfilled

        const patient = pick(patByClinic[clinic.clinic_code]);
        const scheme = schemes.find((x) => x.scheme_code === patient.scheme_code);

        // PLANT 3: how far ahead the booking was made, and whether a reminder went out,
        // drive whether the patient turns up at all.
        //
        // Lead time is not independent of the diary. A slot in a cell everybody wants is
        // taken weeks ahead because it is the only one left; a Monday morning is booked
        // yesterday because it is always there. That is what ties plant 1 to plant 3: the
        // imbalance in the roster manufactures the long leads, and the long leads are what
        // do not arrive.
        const queue = clamp((fill - 0.45) / 0.5, 0, 1);
        const lr = rnd();
        const leadDays = lr < 0.58 - 0.30 * queue ? ri(0, 6)
          : lr < 0.80 - 0.12 * queue ? ri(7, 20)
          : ri(21, 70);
        const bookedAt = slotStart - leadDays * DAY - ri(0, 8) * 3600000;
        // PLANT 3b: reminder discipline is a front desk habit, and it differs by site.
        const reminderSent = leadDays <= 6
          ? rnd() < 0.88 * clinic.reminderDiscipline
          : rnd() < 0.46 * clinic.reminderDiscipline;

        let noShowRate = 0.055;
        if (leadDays > 20) noShowRate = 0.20;
        else if (leadDays > 6) noShowRate = 0.105;
        if (!reminderSent) noShowRate *= 1.75;
        noShowRate = clamp(noShowRate, 0.02, 0.55);

        const roll = rnd();
        const status = roll < noShowRate ? 'No show'
          : roll < noShowRate + 0.035 ? 'Cancelled'
          : 'Attended';

        apptN += 1;
        const appointment_id = 'AP-' + (600000 + apptN);
        ledger.slotsBooked += 1;
        if (status === 'No show') ledger.noShows += 1;

        // Waiting time climbs when the clinic is running at the top of its capacity
        const pressure = clamp((fill - 0.7) / 0.3, 0, 1);
        const waitMinutes = status === 'Attended'
          ? Math.max(0, Math.round(gauss(6 + pressure * 34, 7 + pressure * 12))) : null;
        const arrivedAt = status === 'Attended' ? slotStart - ri(2, 18) * 60000 : null;
        const seenAt = status === 'Attended' ? slotStart + waitMinutes * 60000 : null;

        appointments.push({
          appointment_id,
          session_id,
          clinic_code: clinic.clinic_code,
          practitioner_id: prac.practitioner_id,
          patient_ref: patient.patient_ref,
          booked_at: bookedAt,
          scheduled_at: slotStart,
          duration_minutes: slotMinutes,
          arrived_at: arrivedAt,
          seen_at: seenAt,
          status,
          reminder_sent: reminderSent ? 'Y' : 'N',
          booking_lead_days: leadDays,
        });

        if (status !== 'Attended') continue;

        // ---- what was done, and what it was billed at
        const items = rnd() < 0.34 ? 2 : 1;
        let visitBilled = 0;
        for (let k = 0; k < items; k++) {
          encN += 1;
          const tariff = r2(disc.tariff * (k === 0 ? 1 : 0.42) * (1 + gauss(0, 0.10)));
          visitBilled += tariff;
          encounters.push({
            encounter_id: 'EN-' + (700000 + encN),
            appointment_id,
            icd10_code: pick(ICD10),
            procedure_code: pick(PROCEDURES),
            billed_zar: tariff,
          });
        }
        visitBilled = r2(visitBilled);

        if (scheme.scheme_code === 'SELF') {
          // Self funded: the whole amount is owed by the patient at reception
          payN += 1;
          const collected = rnd() < 0.86 ? visitBilled : r2(visitBilled * (rnd() < 0.5 ? 0 : 0.5));
          payments.push({
            payment_id: 'PY-' + (800000 + payN),
            appointment_id,
            amount_due_zar: visitBilled,
            amount_paid_zar: collected,
            payment_type: 'Self funded',
            collected_at: collected > 0 ? iso(slotStart) : '',
          });
          ledger.gapBilledZar += visitBilled;
          ledger.gapCollectedZar += collected;
          continue;
        }

        // ---- the scheme claim
        const schemeShare = r2(visitBilled * scheme.tariff_factor);
        const patientGap = r2(visitBilled - schemeShare);

        claimN += 1;
        const submittedAt = slotStart + ri(0, 4) * DAY;

        // PLANT 2: roughly one claim in eight comes back rejected or short paid.
        const denyRoll = rnd();
        let status2, paidZar, reason = '', resubmitted = 'N', paidAt = '';
        if (denyRoll < 0.079) {
          status2 = 'Rejected';
          paidZar = 0;
          reason = weighted(REJECTION_REASONS, 'w').reason;
        } else if (denyRoll < 0.125) {
          status2 = 'Short paid';
          paidZar = r2(schemeShare * (0.35 + rnd() * 0.4));
          reason = weighted(REJECTION_REASONS, 'w').reason;
        } else {
          status2 = 'Paid';
          paidZar = schemeShare;
          paidAt = iso(submittedAt + Math.round(clamp(gauss(scheme.payment_terms_days, 7), 5, 180)) * DAY);
        }

        if (status2 !== 'Paid') {
          const paidBefore = paidZar;
          ledger.deniedZar += schemeShare - paidBefore;
          // Whether anybody went back and fixed it. Two clinics essentially never do.
          const reworkChance = POOR_REWORK.has(clinic.clinic_code) ? 0.13 : 0.62;
          const fixable = REJECTION_REASONS.find((r) => r.reason === reason)?.fixable;
          if (fixable && rnd() < reworkChance) {
            resubmitted = 'Y';
            const resubDays = ri(12, 150);
            if (resubDays <= RESUBMIT_DEADLINE_DAYS && rnd() < 0.74) {
              paidZar = schemeShare;
              status2 = 'Paid on resubmission';
              paidAt = iso(submittedAt + (resubDays + Math.round(scheme.payment_terms_days)) * DAY);
              ledger.deniedZar -= schemeShare - paidBefore;
            } else {
              ledger.neverResubmittedZar += schemeShare - paidBefore;
            }
          } else {
            ledger.neverResubmittedZar += schemeShare - paidBefore;
          }
        }

        claims.push({
          claim_id: 'CL-' + (900000 + claimN),
          appointment_id,
          scheme_code: scheme.scheme_code,
          submitted_at: submittedAt,
          claimed_zar: schemeShare,
          paid_zar: paidZar,
          status: status2,
          rejection_reason: reason,
          resubmitted,
          paid_at: paidAt,
        });

        // ---- the gap the patient owes
        if (patientGap > 1) {
          payN += 1;
          // PLANT 5: the gap is very often simply never collected. The patient has already
          // left, and nobody chases forty rand.
          const collected = rnd() < patient.gapDiscipline ? patientGap
            : rnd() < 0.18 ? r2(patientGap * 0.5) : 0;
          payments.push({
            payment_id: 'PY-' + (800000 + payN),
            appointment_id,
            amount_due_zar: patientGap,
            amount_paid_zar: collected,
            payment_type: 'Scheme gap',
            collected_at: collected > 0 ? iso(slotStart + ri(0, 40) * DAY) : '',
          });
          ledger.gapBilledZar += patientGap;
          ledger.gapCollectedZar += collected;
        }
      }
    }
  }
}

// ---------------------------------------------------------------- deliberate mess

function messyClinic(s) {
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

// ~2% of encounters lost their ICD-10 code in the migration from the old practice system
for (const e of encounters) if (rnd() < 0.02) e.icd10_code = '';
// Duplicate submissions from the claims switch retrying on a timer. These are exact copies
// of a claim already in the file, deduplicated on claim id in silver. They are a transport
// artefact, not a reason a scheme gives, which is why no rejection reason mentions them.
const dupClaims = [];
for (let i = 0; i < Math.round(claims.length * 0.005); i++) dupClaims.push({ ...claims[ri(0, claims.length - 1)] });
for (const c of dupClaims) claims.push(c);
// Payments captured against appointments that are not in the appointment file
for (let i = 0; i < 95; i++) payments[ri(0, payments.length - 1)].appointment_id = 'AP-' + ri(500000, 599999);
// Negative payment lines: a refund, which is real and must not be dropped. A credit note
// reverses cash, it does not re-raise the charge, so amount_due is zero on these rows.
for (let i = 0; i < 180; i++) {
  const src = payments[ri(0, payments.length - 1)];
  payments.push({
    ...src,
    payment_id: 'PY-' + (800000 + (++payN)),
    amount_due_zar: 0,
    amount_paid_zar: -Math.abs(src.amount_paid_zar),
    payment_type: 'Refund',
  });
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
counts['clinics.csv'] = writeCsv('clinics.csv',
  ['clinic_code', 'clinic_name', 'city', 'province', 'consulting_rooms', 'opened_date'],
  clinics, (c) => [c.clinic_code, q(messyClinic(c.clinic_name)), q(c.city), q(c.province), c.consulting_rooms, c.opened_date]);

counts['practitioners.csv'] = writeCsv('practitioners.csv',
  ['practitioner_id', 'practitioner_name', 'discipline', 'clinic_code', 'practice_number', 'sessional_cost_zar', 'joined_date'],
  practitioners, (p) => [p.practitioner_id, q(p.practitioner_name), q(p.discipline), p.clinic_code, p.practice_number, p.sessional_cost_zar, p.joined_date]);

counts['schemes.csv'] = writeCsv('schemes.csv',
  ['scheme_code', 'scheme_name', 'payment_terms_days', 'tariff_factor'],
  schemes, (s) => [s.scheme_code, q(s.scheme_name), s.payment_terms_days, s.tariff_factor]);

counts['patients.csv'] = writeCsv('patients.csv',
  ['patient_ref', 'home_clinic_code', 'province', 'age_band', 'gender', 'scheme_code', 'scheme_plan'],
  patients, (p) => [p.patient_ref, p.home_clinic_code, q(p.province), p.age_band, p.gender, p.scheme_code, q(p.scheme_plan)]);

counts['sessions.csv'] = writeCsv('sessions.csv',
  ['session_id', 'clinic_code', 'practitioner_id', 'session_date', 'start_time', 'end_time', 'slot_minutes', 'slots_offered', 'sessional_cost_zar'],
  sessions, (s) => [s.session_id, s.clinic_code, s.practitioner_id,
    rnd() < 0.26 ? dmy(s.session_date) : iso(s.session_date),
    s.start_time, s.end_time, s.slot_minutes, s.slots_offered, s.sessional_cost_zar]);

counts['appointments.csv'] = writeCsv('appointments.csv',
  ['appointment_id', 'session_id', 'clinic_code', 'practitioner_id', 'patient_ref', 'booked_at', 'scheduled_at', 'duration_minutes', 'arrived_at', 'seen_at', 'status', 'reminder_sent', 'booking_lead_days'],
  appointments, (a) => [a.appointment_id, a.session_id, a.clinic_code, a.practitioner_id, a.patient_ref,
    isoTs(a.booked_at), isoTs(a.scheduled_at), a.duration_minutes,
    a.arrived_at ? isoTs(a.arrived_at) : '', a.seen_at ? isoTs(a.seen_at) : '',
    messyStatus(a.status), a.reminder_sent, a.booking_lead_days]);

counts['encounters.csv'] = writeCsv('encounters.csv',
  ['encounter_id', 'appointment_id', 'icd10_code', 'procedure_code', 'billed_zar'],
  encounters, (e) => [e.encounter_id, e.appointment_id, e.icd10_code, e.procedure_code, messyAmount(e.billed_zar)]);

counts['claims.csv'] = writeCsv('claims.csv',
  ['claim_id', 'appointment_id', 'scheme_code', 'submitted_at', 'claimed_zar', 'paid_zar', 'status', 'rejection_reason', 'resubmitted', 'paid_at'],
  claims, (c) => [c.claim_id, c.appointment_id, c.scheme_code,
    rnd() < 0.26 ? dmy(c.submitted_at) : iso(c.submitted_at),
    messyAmount(c.claimed_zar), c.paid_zar, messyStatus(c.status), q(c.rejection_reason), c.resubmitted, c.paid_at]);

counts['patient_payments.csv'] = writeCsv('patient_payments.csv',
  ['payment_id', 'appointment_id', 'amount_due_zar', 'amount_paid_zar', 'payment_type', 'collected_at'],
  payments, (p) => [p.payment_id, p.appointment_id, p.amount_due_zar, p.amount_paid_zar, q(p.payment_type), p.collected_at]);

// ---------------------------------------------------------------- shape report

const R = (n) => (n < 0 ? '-R' : 'R') + Math.round(Math.abs(n)).toLocaleString('en-ZA');
const pct = (n) => (n * 100).toFixed(1) + '%';

const billed = encounters.reduce((a, e) => a + e.billed_zar, 0);
const claimPaid = claims.reduce((a, c) => a + c.paid_zar, 0);
const attended = appointments.filter((a) => a.status === 'Attended').length;

console.log('Lumen Health Network, generated\n');
for (const [f, n] of Object.entries(counts)) {
  const sz = fs.statSync(path.join(OUT, f)).size;
  console.log(`  ${f.padEnd(26)} ${String(n).padStart(9)} rows   ${(sz / 1048576).toFixed(1)} MB`);
}
console.log(`\n  clinics ${clinics.length}   practitioners ${practitioners.length}   patients ${patients.length.toLocaleString('en-ZA')}`);
console.log(`  slots offered    ${ledger.slotsOffered.toLocaleString('en-ZA')}   booked ${pct(ledger.slotsBooked / ledger.slotsOffered)}`);
console.log(`  appointments     ${appointments.length.toLocaleString('en-ZA')}   attended ${attended.toLocaleString('en-ZA')}   no shows ${pct(ledger.noShows / appointments.length)}`);
console.log(`  billed           ${R(billed)}`);
console.log(`  scheme paid      ${R(claimPaid)}`);
console.log(`\n  scheme shortfall still outstanding             ${R(ledger.deniedZar)}`);
console.log(`    of which never recovered in the window       ${R(ledger.neverResubmittedZar)}`);
console.log(`  patient gap billed                              ${R(ledger.gapBilledZar)}`);
console.log(`  patient gap collected                           ${R(ledger.gapCollectedZar)}  (${pct(ledger.gapCollectedZar / ledger.gapBilledZar)})`);
console.log('\n  The findings are measured from the warehouse, not from here.');
console.log('  Next: dbt build, then generator/build_answer_key.py');
