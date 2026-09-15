// Kestrel Logistics, synthetic South African road freight dataset
// Deterministic: same seed always produces the same files.
// Node 18+, no dependencies.  Run: node generator/generate.js
//
// All money is South African rand, excluding VAT.

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'data', 'raw');
const SEED = 20260916;

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

// ---------------------------------------------------------------- dates

const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const isoTs = (ms) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
function dmyTs(ms) {
  const d = new Date(ms), p = (n) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
const dow = (ms) => new Date(ms).getUTCDay();          // 0 Sun .. 6 Sat
const monthIdx = (ms) => new Date(ms).getUTCMonth();
function isMonthEndRun(ms) {
  // Last two business days of the month, when dispatch batches everything out
  const d = new Date(ms);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  let businessLeft = 0;
  for (let t = ms; t <= last.getTime(); t += DAY) {
    const w = dow(t);
    if (w !== 0 && w !== 6) businessLeft += 1;
  }
  return businessLeft <= 2;
}

// ---------------------------------------------------------------- geography

// Real coordinates. The dashboard draws these on a map, so they have to be right.
const CITIES = {
  'Johannesburg':    [-26.2041, 28.0473],
  'Pretoria':        [-25.7479, 28.2293],
  'Durban':          [-29.8587, 31.0218],
  'Cape Town':       [-33.9249, 18.4241],
  'Gqeberha':        [-33.9608, 25.6022],
  'Bloemfontein':    [-29.0852, 26.1596],
  'Polokwane':       [-23.9045, 29.4689],
  'Mbombela':        [-25.4753, 30.9694],
  'Rustenburg':      [-25.6672, 27.2424],
  'Kimberley':       [-28.7282, 24.7499],
  'Pietermaritzburg':[-29.6006, 30.3794],
  'George':          [-33.9628, 22.4619],
  'East London':     [-33.0292, 27.8546],
  'Richards Bay':    [-28.7807, 32.0383],
  'Welkom':          [-27.9770, 26.7350],
  'Klerksdorp':      [-26.8521, 26.6667],
  'Newcastle':       [-27.7580, 29.9318],
  'Upington':        [-28.4478, 21.2561],
  'Worcester':       [-33.6465, 19.4485],
  'Paarl':           [-33.7342, 18.9621],
};

const DEPOTS = [
  { code: 'KES-JHB', name: 'Kestrel Gauteng Hub', suburb: 'City Deep', city: 'Johannesburg', province: 'Gauteng', lat: -26.2341, lon: 28.1073 },
  { code: 'KES-DBN', name: 'Kestrel KZN Hub', suburb: 'Prospecton', city: 'Durban', province: 'KwaZulu-Natal', lat: -29.9550, lon: 30.9330 },
  { code: 'KES-CPT', name: 'Kestrel Cape Hub', suburb: 'Epping', city: 'Cape Town', province: 'Western Cape', lat: -33.9350, lon: 18.5400 },
];

// [depot, destination, km, toll R, hours, weekly outbound trips, backhaul fill actually achieved]
//
// backhaul_fill is the share of return legs that find paying freight. The tariff on every
// lane was set assuming TARIFF_ASSUMED_BACKHAUL. Where the real fill falls a long way short
// of that assumption, the lane is quietly funding its own empty return. That is finding 1.
const TARIFF_ASSUMED_BACKHAUL = 0.60;

const LINEHAUL = [
  ['KES-JHB', 'Durban',            568,  380,  7.5, 22, 0.68],
  ['KES-JHB', 'Cape Town',        1398,  520, 17.0, 14, 0.21],
  ['KES-JHB', 'Gqeberha',         1040,  290, 13.0, 10, 0.19],
  ['KES-JHB', 'Bloemfontein',      398,  180,  5.0, 12, 0.61],
  ['KES-JHB', 'Polokwane',         328,  145,  4.0, 11, 0.58],
  ['KES-JHB', 'Mbombela',          358,  165,  4.5,  9, 0.55],
  ['KES-JHB', 'Rustenburg',        120,   60,  1.8, 14, 0.64],
  ['KES-JHB', 'Kimberley',         472,  150,  5.5,  6, 0.49],
  ['KES-JHB', 'East London',       985,  250, 12.0,  5, 0.23],
  ['KES-JHB', 'Newcastle',         305,  190,  4.0,  7, 0.62],
  ['KES-JHB', 'Klerksdorp',        168,   70,  2.2,  8, 0.66],
  ['KES-JHB', 'Welkom',            265,  120,  3.3,  6, 0.59],
  ['KES-DBN', 'Johannesburg',      568,  380,  7.5, 20, 0.71],
  ['KES-DBN', 'Cape Town',        1660,  600, 20.0,  5, 0.34],
  ['KES-DBN', 'Gqeberha',          984,  300, 12.0,  6, 0.42],
  ['KES-DBN', 'Pietermaritzburg',   80,   45,  1.2, 16, 0.70],
  ['KES-DBN', 'Richards Bay',      178,   95,  2.4, 10, 0.57],
  ['KES-DBN', 'Bloemfontein',      634,  260,  7.8,  4, 0.46],
  ['KES-CPT', 'Johannesburg',     1398,  520, 17.0, 13, 0.74],
  ['KES-CPT', 'Gqeberha',          750,  180,  9.0,  7, 0.52],
  ['KES-CPT', 'George',            430,   95,  5.0,  8, 0.60],
  ['KES-CPT', 'Worcester',         110,   40,  1.5, 11, 0.63],
  ['KES-CPT', 'Paarl',              60,   25,  0.9, 12, 0.67],
  ['KES-CPT', 'Upington',          790,  140,  9.5,  3, 0.26],
  ['KES-CPT', 'Bloemfontein',     1004,  300, 12.0,  4, 0.31],
];

// Metro distribution runs: one trip, many drops, back to the same depot.
const METRO = [
  ['KES-JHB', 'Johannesburg metro', 185, 40, 9.0, 46],
  ['KES-JHB', 'Pretoria metro',     210, 55, 9.5, 22],
  ['KES-DBN', 'Durban metro',       165, 35, 8.5, 30],
  ['KES-CPT', 'Cape Town metro',    150, 30, 8.0, 34],
];

// ---------------------------------------------------------------- fleet

const CLASSES = [
  // name, capacity kg, capacity m3, L/100km laden, maintenance R/km, fixed R/day, tariff R/km
  { name: 'LDV 1.5t',      kg:  1500, m3:   8, lp100: 11, maint: 0.95, fixed:  380, tariff:  9.40 },
  { name: 'Rigid 8t',      kg:  8000, m3:  38, lp100: 22, maint: 1.85, fixed:  620, tariff: 14.20 },
  { name: 'Rigid 14t',     kg: 14000, m3:  60, lp100: 28, maint: 2.35, fixed:  850, tariff: 17.60 },
  { name: 'Tri-axle 24t',  kg: 24000, m3:  82, lp100: 38, maint: 2.90, fixed: 1350, tariff: 22.80 },
  { name: 'Superlink 34t', kg: 34000, m3: 120, lp100: 48, maint: 3.20, fixed: 1950, tariff: 26.40 },
];
const byClass = Object.fromEntries(CLASSES.map((c) => [c.name, c]));

// Diesel drifts across the window. Everything fuel-related keys off this.
const dieselPrice = (d) => r2(20.50 + 3.10 * (d / N_DAYS) + Math.sin(d / 47) * 0.55);
const DRIVER_RATE_PER_HOUR = 145;

const PROV_PLATE = { 'Gauteng': 'GP', 'KwaZulu-Natal': 'ND', 'Western Cape': 'CA' };

const vehicles = [];
let vehN = 0;
function addVehicles(depot, className, n) {
  for (let i = 0; i < n; i++) {
    vehN += 1;
    const c = byClass[className];
    vehicles.push({
      vehicle_id: 'VEH-' + (2000 + vehN),
      registration: `${PROV_PLATE[depot.province]} ${ri(100, 999)}-${ri(100, 999)}`,
      vehicle_class: className,
      capacity_kg: c.kg,
      capacity_m3: c.m3,
      depot_code: depot.code,
      acquired_date: iso(START - ri(120, 2400) * DAY),
      status: 'Active',
      // Per-vehicle efficiency drift around the class norm. A handful are planted well
      // above it in PLANT 3 below.
      fuelFactor: clamp(1 + gauss(0, 0.045), 0.90, 1.12),
    });
  }
}
// Fleet sized against the work, not picked out of the air. A line-haul unit covers roughly
// 180,000 km a year in South Africa and a distribution rigid about 55,000, so the heavy count
// has to carry the line-haul kilometres the lane table above implies.
for (const d of DEPOTS) {
  const jhb = d.code === 'KES-JHB';
  addVehicles(d, 'Superlink 34t', jhb ? 20 : 12);
  addVehicles(d, 'Tri-axle 24t', jhb ? 12 : 8);
  addVehicles(d, 'Rigid 14t', jhb ? 9 : 6);
  addVehicles(d, 'Rigid 8t', jhb ? 8 : 5);
  addVehicles(d, 'LDV 1.5t', jhb ? 5 : 4);
}

// PLANT 3: a handful of vehicles burning far more than their class norm on the same work.
// Overdue injectors, dragging brakes, or fuel walking off the forecourt. The dashboard
// cannot say which, only that these seven are costing money and nobody has looked.
const THIRSTY = new Set();
{
  const heavy = vehicles.filter((v) => v.vehicle_class === 'Superlink 34t' || v.vehicle_class === 'Tri-axle 24t');
  for (let i = 0; i < 7; i++) {
    const v = heavy[Math.floor((i + 0.5) * heavy.length / 7)];
    v.fuelFactor = 1.22 + rnd() * 0.10;
    THIRSTY.add(v.vehicle_id);
  }
}

const byDepotClass = {};
for (const v of vehicles) ((byDepotClass[v.depot_code] ||= {})[v.vehicle_class] ||= []).push(v);

// ---------------------------------------------------------------- drivers

const FIRST = ['Thabo', 'Sipho', 'Andile', 'Bongani', 'Kagiso', 'Tebogo', 'Sizwe', 'Mpho', 'Lucky', 'Themba', 'Johan', 'Pieter', 'Riaan', 'Shaun', 'Ashwin', 'Rajesh', 'Nkosi', 'Vusi', 'Lungile', 'Dumisani'];
const LAST = ['Dlamini', 'Nkosi', 'Mokoena', 'Khumalo', 'Naidoo', 'Botha', 'Pillay', 'Mahlangu', 'Sithole', 'Molefe', 'Jacobs', 'Ndlovu', 'Van Wyk', 'Maseko', 'Adams', 'Fourie', 'Govender', 'Zwane', 'Malan', 'Mthembu'];

const drivers = [];
let drvN = 0;
for (const d of DEPOTS) {
  const n = d.code === 'KES-JHB' ? 52 : 30;
  for (let i = 0; i < n; i++) {
    drvN += 1;
    drivers.push({
      driver_id: 'DRV-' + (400 + drvN),
      driver_name: `${pick(FIRST)} ${pick(LAST)}`,
      depot_code: d.code,
      licence_code: pick(['EC', 'EC', 'EC', 'C1', 'C']),
      hired_date: iso(START - ri(60, 2900) * DAY),
    });
  }
}
const driversByDepot = {};
for (const d of drivers) (driversByDepot[d.depot_code] ||= []).push(d);

// ---------------------------------------------------------------- customers

const SECTORS = ['Retail', 'FMCG', 'Building materials', 'Agriculture', 'Automotive', 'Pharmaceutical', 'Industrial'];
const CUST_STEM = ['Highveld', 'Cape Union', 'Umgeni', 'Boland', 'Karoo', 'Zambezi', 'Drakens', 'Sandton', 'Midrand', 'Pinetown', 'Epping', 'Silverton', 'Isando', 'Bellville', 'Germiston', 'Springfield', 'Montague', 'Riverhorse', 'Alrode', 'Atlantis'];
const CUST_TAIL = ['Distributors', 'Wholesalers', 'Manufacturing', 'Trading', 'Supplies', 'Holdings', 'Industries', 'Foods', 'Logistics Partners', 'Steel'];

const customers = [];
let custN = 0;
function addCustomer(name, contract, size, depot) {
  custN += 1;
  customers.push({
    customer_id: 'CUS-' + (7000 + custN),
    customer_name: name,
    sector: pick(SECTORS),
    contract_type: contract,
    home_depot: depot,
    sla_hours: contract === 'Dedicated' ? 24 : contract === 'Contract' ? 48 : 72,
    billing_terms_days: pick([30, 30, 45, 60]),
    size,
    // PLANT 2: a few customers have no receiving discipline. Set below.
    failRate: 0.022 + rnd() * 0.02,
  });
  return customers[customers.length - 1];
}

// The anchor contract customer, with a penalty clause. Finding 4 hangs off this one.
const ANCHOR = addCustomer('Highveld Retail Group', 'Dedicated', 9.0, 'KES-JHB');
addCustomer('Cape Union Foods', 'Dedicated', 5.5, 'KES-CPT');
addCustomer('Umgeni Building Supplies', 'Dedicated', 5.0, 'KES-DBN');
for (let i = 0; i < 34; i++) {
  addCustomer(`${pick(CUST_STEM)} ${pick(CUST_TAIL)}`, 'Contract', 1.4 + rnd() * 2.2, pick(DEPOTS).code);
}
for (let i = 0; i < 205; i++) {
  addCustomer(`${pick(CUST_STEM)} ${pick(CUST_TAIL)}`, 'Spot', 0.25 + rnd() * 0.8, pick(DEPOTS).code);
}

// PLANT 2: six sites that routinely refuse a first delivery. No booked receiving slot, a
// yard that shuts at three, or a goods-in desk with one person on it.
const BAD_RECEIVERS = new Set();
for (let i = 0; i < 6; i++) {
  const c = customers[Math.floor((i + 0.5) * customers.length / 6)];
  c.failRate = 0.24 + rnd() * 0.09;
  BAD_RECEIVERS.add(c.customer_id);
}

const custByDepot = {};
for (const c of customers) (custByDepot[c.home_depot] ||= []).push(c);

// ---------------------------------------------------------------- lanes

const lanes = [];
let laneN = 0;
for (const [depotCode, dest, km, toll, hours, weekly, backhaul] of LINEHAUL) {
  laneN += 1;
  const depot = DEPOTS.find((d) => d.code === depotCode);
  lanes.push({
    lane_id: 'LN-' + (100 + laneN),
    lane_name: `${depot.city} to ${dest}`,
    lane_type: 'Line-haul',
    origin_depot_code: depotCode,
    destination_city: dest,
    destination_lat: CITIES[dest][0],
    destination_lon: CITIES[dest][1],
    distance_km: km,
    toll_cost_zar: toll,
    planned_hours: hours,
    weekly_trips: weekly,
    backhaul_fill: backhaul,
  });
}
for (const [depotCode, name, km, toll, hours, weekly] of METRO) {
  laneN += 1;
  const depot = DEPOTS.find((d) => d.code === depotCode);
  lanes.push({
    lane_id: 'LN-' + (100 + laneN),
    lane_name: name,
    lane_type: 'Distribution',
    origin_depot_code: depotCode,
    destination_city: depot.city,
    destination_lat: depot.lat,
    destination_lon: depot.lon,
    distance_km: km,
    toll_cost_zar: toll,
    planned_hours: hours,
    weekly_trips: weekly,
    backhaul_fill: 0,
  });
}

// ---------------------------------------------------------------- simulate

// Global dial on trip volume, used to keep fleet utilisation inside what a real vehicle can do.
const TRIP_SCALE = 0.80;

const SEASON = [0.86, 0.90, 1.00, 1.02, 1.01, 0.98, 1.00, 1.03, 1.01, 1.06, 1.10, 1.22]; // Jan..Dec
const YOY = 0.075;

const trips = [];
const consignments = [];
const tripCosts = [];
const fuelTxns = [];
const maintenance = [];

let tripN = 0, consN = 0, fuelN = 0, maintN = 0;
const odo = {};
for (const v of vehicles) odo[v.vehicle_id] = ri(120000, 780000);

const ledger = { emptyKm: 0, ladenKm: 0, emptyCost: 0, redeliveryCost: 0, redeliveries: 0 };

function classForLane(lane) {
  if (lane.lane_type === 'Distribution') return pick(['Rigid 8t', 'Rigid 14t', 'LDV 1.5t', 'Rigid 14t']);
  if (lane.distance_km > 600) return rnd() < 0.78 ? 'Superlink 34t' : 'Tri-axle 24t';
  if (lane.distance_km > 250) return rnd() < 0.45 ? 'Superlink 34t' : 'Tri-axle 24t';
  return pick(['Rigid 14t', 'Tri-axle 24t', 'Rigid 8t']);
}

function makeTrip(ms, d, lane, direction, isEmpty, className) {
  const depot = DEPOTS.find((x) => x.code === lane.origin_depot_code);
  const pool = byDepotClass[lane.origin_depot_code][className];
  if (!pool || !pool.length) return null;
  const vehicle = pick(pool);
  const driver = pick(driversByDepot[lane.origin_depot_code]);
  const c = byClass[className];

  tripN += 1;
  const trip_id = 'TRP-' + (500000 + tripN);

  // Dispatch batching: Fridays and the month-end run go out late and arrive late.
  const pressure = (dow(ms) === 5 ? 1 : 0) + (isMonthEndRun(ms) ? 1 : 0);
  const plannedDepart = ms + (5 + ri(0, 9)) * 3600000;
  const departDelayH = Math.max(0, gauss(0.35 + pressure * 1.9, 0.5 + pressure * 0.8));
  const actualDepart = plannedDepart + departDelayH * 3600000;

  const baseHours = lane.planned_hours * (1 + gauss(0, 0.07));
  const actualArrive = actualDepart + baseHours * 3600000;
  const plannedArrive = plannedDepart + lane.planned_hours * 3600000;

  // Distance wanders a little from the lane's nominal figure
  const distance = Math.round(lane.distance_km * (1 + gauss(0, 0.018)));

  // Load. Distribution runs fill by drop count; line-haul is a single consignment.
  let loadKg = 0, loadM3 = 0;
  if (!isEmpty) {
    if (lane.lane_type === 'Distribution') {
      loadKg = Math.round(c.kg * clamp(gauss(0.66, 0.14), 0.2, 0.97));
      loadM3 = r2(c.m3 * clamp(gauss(0.71, 0.15), 0.2, 0.99));
    } else {
      // PLANT 5: some heavy units run volume-limited freight and never reach weight.
      const volumeLimited = (className === 'Superlink 34t' || className === 'Tri-axle 24t') && rnd() < 0.34;
      const wf = volumeLimited ? clamp(gauss(0.40, 0.08), 0.2, 0.62) : clamp(gauss(0.84, 0.10), 0.35, 0.99);
      loadKg = Math.round(c.kg * wf);
      loadM3 = r2(c.m3 * clamp(volumeLimited ? gauss(0.92, 0.06) : gauss(0.78, 0.12), 0.25, 1.0));
    }
  }

  const laden = !isEmpty;
  const lp100 = c.lp100 * (laden ? 1 : 0.80) * vehicle.fuelFactor * (1 + gauss(0, 0.03));
  const litres = r2(distance * lp100 / 100);
  const price = dieselPrice(d);

  trips.push({
    trip_id,
    trip_date: ms,
    lane_id: lane.lane_id,
    direction,
    vehicle_id: vehicle.vehicle_id,
    driver_id: driver.driver_id,
    origin_depot_code: lane.origin_depot_code,
    planned_depart: plannedDepart,
    actual_depart: actualDepart,
    planned_arrive: plannedArrive,
    actual_arrive: actualArrive,
    distance_km: distance,
    load_kg: loadKg,
    load_m3: loadM3,
    is_empty: isEmpty ? 'Y' : 'N',
  });

  const hours = (actualArrive - actualDepart) / 3600000;
  tripCosts.push({
    trip_id,
    driver_hours: r2(hours),
    driver_cost_zar: r2(hours * DRIVER_RATE_PER_HOUR),
    toll_cost_zar: r2(lane.toll_cost_zar * (1 + gauss(0, 0.04))),
    fixed_cost_zar: r2(c.fixed * clamp(hours / 10, 0.35, 2.2)),
  });

  odo[vehicle.vehicle_id] += distance;
  fuelN += 1;
  fuelTxns.push({
    fuel_txn_id: 'FUEL-' + (800000 + fuelN),
    txn_datetime: actualArrive - ri(1, 5) * 3600000,
    vehicle_id: vehicle.vehicle_id,
    driver_id: driver.driver_id,
    litres,
    price_per_litre: price,
    cost_zar: r2(litres * price),
    odometer_km: odo[vehicle.vehicle_id],
    site: pick(['Highway 1 Stop', 'N3 Truck Plaza', 'Depot Bulk Tank', 'Engen Ultra', 'Sasol Truck Stop']),
  });

  if (isEmpty) {
    ledger.emptyKm += distance;
    ledger.emptyCost += litres * price + hours * DRIVER_RATE_PER_HOUR + lane.toll_cost_zar + c.maint * distance;
  } else {
    ledger.ladenKm += distance;
  }

  return { trip_id, vehicle, driver, c, distance, actualArrive, plannedArrive, lane, ms, d };
}

function addConsignment(t, customer, dropSeq, windowStart, weightKg, volM3, revenue, statusOverride) {
  consN += 1;
  const id = 'CON-' + (900000 + consN);
  // PLANT 4: on Fridays and the month-end run, arrival slips and the SLA window is missed.
  const late = t.actualArrive > t.plannedArrive + 2 * 3600000;
  const delivered = t.actualArrive + ri(10, 90) * 60000 * (dropSeq + 1) / 3;

  let status = statusOverride || 'Delivered';
  let failureReason = '';
  if (!statusOverride && rnd() < customer.failRate) {
    status = 'Failed';
    failureReason = BAD_RECEIVERS.has(customer.customer_id)
      ? pick(['No booked slot', 'Receiving closed', 'Goods-in queue timeout'])
      : pick(['Site closed', 'No one to offload', 'Access restricted', 'Incorrect address']);
  }

  consignments.push({
    consignment_id: id,
    trip_id: t.trip_id,
    customer_id: customer.customer_id,
    drop_sequence: dropSeq,
    sla_window_start: windowStart,
    sla_window_end: windowStart + customer.sla_hours * 3600000,
    delivered_at: status === 'Failed' ? '' : delivered,
    weight_kg: weightKg,
    volume_m3: volM3,
    revenue_zar: status === 'Failed' ? 0 : revenue,
    status,
    failure_reason: failureReason,
    _late: late,
  });
  return status;
}

for (let d = 0; d < N_DAYS; d++) {
  const ms = START + d * DAY;
  const w = dow(ms);
  if (w === 0) continue;                                   // no Sunday line-haul
  const wdMul = w === 6 ? 0.38 : 1.0;
  const trend = Math.pow(1 + YOY, d / 365);
  const season = SEASON[monthIdx(ms)];

  for (const lane of lanes) {
    const perDay = lane.weekly_trips * TRIP_SCALE / 6 * season * wdMul * trend * (0.82 + rnd() * 0.36);
    let n = Math.floor(perDay);
    if (rnd() < perDay - n) n += 1;

    for (let i = 0; i < n; i++) {
      const className = classForLane(lane);
      const c = byClass[className];

      if (lane.lane_type === 'Distribution') {
        const t = makeTrip(ms, d, lane, 'Outbound', false, className);
        if (!t) continue;
        const drops = ri(7, 17);
        const pool = custByDepot[lane.origin_depot_code] || customers;
        for (let k = 0; k < drops; k++) {
          const cust = weighted(pool, 'size');
          const kg = Math.round(clamp(gauss(t.c.kg / drops, t.c.kg / drops * 0.4), 40, t.c.kg));
          const m3 = r2(kg / 260 * (1 + gauss(0, 0.2)));
          // Distribution is billed per drop plus a weight component
          const revenue = r2(185 + kg * 0.62 * (1 + gauss(0, 0.06)));
          const windowStart = ms + (7 + k) * 3600000;
          const status = addConsignment(t, cust, k + 1, windowStart, kg, m3, revenue);
          if (status === 'Failed') {
            // The redelivery is a real cost with no revenue against it
            ledger.redeliveries += 1;
            ledger.redeliveryCost += 185 + t.c.maint * 22 + 1.4 * DRIVER_RATE_PER_HOUR;
          }
        }
      } else {
        // Outbound leg, always carrying
        const t = makeTrip(ms, d, lane, 'Outbound', false, className);
        if (!t) continue;
        const cust = weighted(custByDepot[lane.origin_depot_code] || customers, 'size');
        const kg = trips[trips.length - 1].load_kg;
        const m3 = trips[trips.length - 1].load_m3;
        const revenue = r2(c.tariff * lane.distance_km * (1 + gauss(0, 0.05)));
        addConsignment(t, cust, 1, ms + 6 * 3600000, kg, m3, revenue);

        // Return leg. It runs whether or not there is freight for it.
        const back = { ...lane, lane_id: lane.lane_id };
        const hasBackhaul = rnd() < lane.backhaul_fill;
        const rt = makeTrip(ms + Math.round(lane.planned_hours + 6) * 3600000, d, back, 'Return', !hasBackhaul, className);
        if (rt && hasBackhaul) {
          const bcust = weighted(customers, 'size');
          const bkg = trips[trips.length - 1].load_kg;
          const bm3 = trips[trips.length - 1].load_m3;
          // Backhaul sells at a discount; an empty truck going home is the alternative
          const brev = r2(c.tariff * 0.62 * lane.distance_km * (1 + gauss(0, 0.07)));
          addConsignment(rt, bcust, 1, ms + 20 * 3600000, bkg, bm3, brev);
        }
      }
    }
  }

  // Maintenance happens on its own schedule
  if (rnd() < 0.85) {
    const v = pick(vehicles);
    const c = byClass[v.vehicle_class];
    maintN += 1;
    const type = pick(['Service', 'Service', 'Repair', 'Tyres', 'Repair']);
    maintenance.push({
      maintenance_id: 'MNT-' + (300000 + maintN),
      vehicle_id: v.vehicle_id,
      job_date: iso(ms),
      job_type: type,
      cost_zar: r2((type === 'Tyres' ? 5200 : type === 'Service' ? 3400 : 6100) * (c.kg / 14000) * (1 + gauss(0, 0.3))),
      downtime_hours: r2(clamp(gauss(type === 'Repair' ? 14 : 5, 6), 1, 72)),
      odometer_km: odo[v.vehicle_id],
    });
  }
}

// ---------------------------------------------------------------- deliberate mess

function messyReg(s) {
  const r = rnd();
  if (r < 0.07) return s.replace(/[ -]/g, '');
  if (r < 0.12) return s.toLowerCase();
  if (r < 0.15) return '  ' + s;
  return s;
}
function messyStatus(s) {
  const r = rnd();
  return r < 0.07 ? s.toUpperCase() : r < 0.12 ? s.toLowerCase() : s;
}
function messyName(s) {
  const r = rnd();
  if (r < 0.05) return s + ' (Pty) Ltd';
  if (r < 0.09) return '  ' + s;
  if (r < 0.12) return s + ' ';
  return s;
}
// Some fuel exports come out of a system with a comma decimal separator
const messyLitres = (n) => (rnd() < 0.09 ? `"${String(n).replace('.', ',')}"` : n);

// ~2% of consignments arrive with no weight captured
for (const c of consignments) if (rnd() < 0.02) c.weight_kg = '';
// A GPS glitch leaves a few trips with a nonsense distance
for (let i = 0; i < 40; i++) trips[ri(0, trips.length - 1)].distance_km = pick([0, -1]);
// Double-swiped fuel cards
const dupFuel = [];
for (let i = 0; i < Math.round(fuelTxns.length * 0.006); i++) dupFuel.push({ ...fuelTxns[ri(0, fuelTxns.length - 1)] });
for (const f of dupFuel) fuelTxns.push(f);
// Odometer typos: a digit dropped on capture
for (let i = 0; i < 120; i++) {
  const f = fuelTxns[ri(0, fuelTxns.length - 1)];
  f.odometer_km = Math.round(f.odometer_km / 10);
}
// Consignments quoting trips that are not in the trip file
for (let i = 0; i < 90; i++) consignments[ri(0, consignments.length - 1)].trip_id = 'TRP-' + ri(400000, 499999);

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
counts['depots.csv'] = writeCsv('depots.csv',
  ['depot_code', 'depot_name', 'suburb', 'city', 'province', 'latitude', 'longitude'],
  DEPOTS, (d) => [d.code, q(d.name), q(d.suburb), q(d.city), q(d.province), d.lat, d.lon]);

counts['vehicles.csv'] = writeCsv('vehicles.csv',
  ['vehicle_id', 'registration', 'vehicle_class', 'capacity_kg', 'capacity_m3', 'depot_code', 'acquired_date', 'status'],
  vehicles, (v) => [v.vehicle_id, q(messyReg(v.registration)), q(v.vehicle_class), v.capacity_kg, v.capacity_m3, v.depot_code, v.acquired_date, v.status]);

counts['drivers.csv'] = writeCsv('drivers.csv',
  ['driver_id', 'driver_name', 'depot_code', 'licence_code', 'hired_date'],
  drivers, (d) => [d.driver_id, q(d.driver_name), d.depot_code, d.licence_code, d.hired_date]);

counts['customers.csv'] = writeCsv('customers.csv',
  ['customer_id', 'customer_name', 'sector', 'contract_type', 'home_depot_code', 'sla_hours', 'billing_terms_days'],
  customers, (c) => [c.customer_id, q(messyName(c.customer_name)), q(c.sector), c.contract_type, c.home_depot, c.sla_hours, c.billing_terms_days]);

counts['lanes.csv'] = writeCsv('lanes.csv',
  ['lane_id', 'lane_name', 'lane_type', 'origin_depot_code', 'destination_city', 'destination_lat', 'destination_lon', 'distance_km', 'toll_cost_zar', 'planned_hours', 'assumed_backhaul_pct'],
  lanes, (l) => [l.lane_id, q(l.lane_name), q(l.lane_type), l.origin_depot_code, q(l.destination_city), l.destination_lat, l.destination_lon, l.distance_km, l.toll_cost_zar, l.planned_hours, Math.round(TARIFF_ASSUMED_BACKHAUL * 100)]);

counts['trips.csv'] = writeCsv('trips.csv',
  ['trip_id', 'trip_date', 'lane_id', 'direction', 'vehicle_id', 'driver_id', 'origin_depot_code', 'planned_depart', 'actual_depart', 'planned_arrive', 'actual_arrive', 'distance_km', 'load_kg', 'load_m3', 'is_empty'],
  trips, (t) => {
    const f = rnd() < 0.28 ? dmyTs : isoTs;          // two systems, two timestamp formats
    return [t.trip_id, iso(t.trip_date), t.lane_id, t.direction, t.vehicle_id, t.driver_id, t.origin_depot_code,
      f(t.planned_depart), f(t.actual_depart), f(t.planned_arrive), f(t.actual_arrive),
      t.distance_km, t.load_kg, t.load_m3, t.is_empty];
  });

counts['consignments.csv'] = writeCsv('consignments.csv',
  ['consignment_id', 'trip_id', 'customer_id', 'drop_sequence', 'sla_window_start', 'sla_window_end', 'delivered_at', 'weight_kg', 'volume_m3', 'revenue_zar', 'status', 'failure_reason'],
  consignments, (c) => [c.consignment_id, c.trip_id, c.customer_id, c.drop_sequence,
    isoTs(c.sla_window_start), isoTs(c.sla_window_end), c.delivered_at === '' ? '' : isoTs(c.delivered_at),
    c.weight_kg, c.volume_m3, c.revenue_zar, messyStatus(c.status), q(c.failure_reason)]);

counts['trip_costs.csv'] = writeCsv('trip_costs.csv',
  ['trip_id', 'driver_hours', 'driver_cost_zar', 'toll_cost_zar', 'fixed_cost_zar'],
  tripCosts, (c) => [c.trip_id, c.driver_hours, c.driver_cost_zar, c.toll_cost_zar, c.fixed_cost_zar]);

counts['fuel_transactions.csv'] = writeCsv('fuel_transactions.csv',
  ['fuel_txn_id', 'txn_datetime', 'vehicle_id', 'driver_id', 'litres', 'price_per_litre', 'cost_zar', 'odometer_km', 'site'],
  fuelTxns, (f) => [f.fuel_txn_id, isoTs(f.txn_datetime), f.vehicle_id, f.driver_id, messyLitres(f.litres), f.price_per_litre, f.cost_zar, f.odometer_km, q(f.site)]);

counts['maintenance.csv'] = writeCsv('maintenance.csv',
  ['maintenance_id', 'vehicle_id', 'job_date', 'job_type', 'cost_zar', 'downtime_hours', 'odometer_km'],
  maintenance, (m) => [m.maintenance_id, m.vehicle_id, m.job_date, m.job_type, m.cost_zar, m.downtime_hours, m.odometer_km]);

// ---------------------------------------------------------------- shape report

const R = (n) => (n < 0 ? '-R' : 'R') + Math.round(Math.abs(n)).toLocaleString('en-ZA');
const pct = (n) => (n * 100).toFixed(1) + '%';

const TTM = END - 364 * DAY;
const tripById = new Map(trips.map((t) => [t.trip_id, t]));
let ttmRev = 0, ttmKm = 0, ttmEmptyKm = 0, pyRev = 0, pyKm = 0;
for (const c of consignments) {
  const t = tripById.get(c.trip_id); if (!t) continue;
  if (t.trip_date >= TTM) ttmRev += c.revenue_zar; else pyRev += c.revenue_zar;
}
for (const t of trips) {
  const km = Math.max(0, t.distance_km);
  if (t.trip_date >= TTM) { ttmKm += km; if (t.is_empty === 'Y') ttmEmptyKm += km; } else pyKm += km;
}

console.log('Kestrel Logistics, generated\n');
for (const [f, n] of Object.entries(counts)) {
  const sz = fs.statSync(path.join(OUT, f)).size;
  console.log(`  ${f.padEnd(24)} ${String(n).padStart(9)} rows   ${(sz / 1048576).toFixed(1)} MB`);
}
console.log(`\n  vehicles ${vehicles.length}   drivers ${drivers.length}   customers ${customers.length}   lanes ${lanes.length}`);
console.log(`  TTM revenue      ${R(ttmRev)}   (${pct(ttmRev / pyRev - 1)} YoY)`);
console.log(`  TTM kilometres   ${Math.round(ttmKm).toLocaleString('en-ZA')}   empty ${pct(ttmEmptyKm / ttmKm)}`);
console.log(`  Revenue per km   R${(ttmRev / ttmKm).toFixed(2)}`);
console.log(`\n  Empty running cost, full period  ${R(ledger.emptyCost)}`);
console.log(`  Redeliveries                     ${ledger.redeliveries.toLocaleString('en-ZA')}  costing ${R(ledger.redeliveryCost)}`);
console.log(`  Thirsty vehicles                 ${THIRSTY.size}`);
console.log(`  Poor receiving sites             ${BAD_RECEIVERS.size}`);
console.log('\n  The findings are measured from the warehouse, not from here.');
console.log('  Next: dbt build, then generator/build_answer_key.py');
