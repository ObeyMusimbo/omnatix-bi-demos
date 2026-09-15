// Meridian Provisions Co. - synthetic FMCG distributor dataset
// Deterministic: same seed always produces the same files.
// Node 18+, no dependencies.  Run: node generator/generate.js

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'data', 'raw');
const SEED = 20260915;

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

// ---------------------------------------------------------------- dates

const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
function dmy(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}
const dow = (ms) => new Date(ms).getUTCDay();          // 0 Sun .. 6 Sat
const monthIdx = (ms) => new Date(ms).getUTCMonth();

// ---------------------------------------------------------------- reference data

// All money is South African rand, excluding VAT. Distributor trade prices are quoted ex-VAT
// and the 15% output tax is a billing concern, not a margin one, so it stays out of the model.
const ZAR = 9;

const WAREHOUSES = [
  { code: 'WH-01', name: 'Meridian Gauteng DC', region: 'Gauteng' },
  { code: 'WH-02', name: 'Meridian Coastal DC', region: 'KwaZulu-Natal' },
  { code: 'WH-03', name: 'Meridian Cape DC', region: 'Western Cape' },
];

const REGIONS = ['Gauteng', 'KwaZulu-Natal', 'Western Cape', 'Eastern Cape', 'Free State', 'Mpumalanga'];
// Rand per kg of outbound freight, plus a fixed cost per drop. Gauteng is cheapest because
// most volume ships from the Gauteng DC; the outlying provinces carry a line-haul premium.
const FREIGHT_RATE = {
  'Gauteng': 0.99, 'KwaZulu-Natal': 1.26, 'Western Cape': 1.31,
  'Eastern Cape': 1.53, 'Free State': 1.44, 'Mpumalanga': 1.35,
};
const DROP_FEE = {
  'Gauteng': 49.5, 'KwaZulu-Natal': 58.5, 'Western Cape': 63.0,
  'Eastern Cape': 72.0, 'Free State': 67.5, 'Mpumalanga': 61.0,
};

// orderShare controls how many orders a channel gets; baseQty and lines control how big
// each one is. Together they set the revenue mix directly rather than emergently.
const CHANNELS = [
  { name: 'Modern Trade', orderShare: 0.30, baseQty: 16, baseDisc: [0.06, 0.12], lines: [4, 8] },
  { name: 'General Trade', orderShare: 0.43, baseQty: 12, baseDisc: [0.01, 0.05], lines: [3, 6] },
  { name: 'Wholesale', orderShare: 0.15, baseQty: 19, baseDisc: [0.08, 0.14], lines: [4, 7] },
  { name: 'HoReCa', orderShare: 0.12, baseQty: 12, baseDisc: [0.00, 0.04], lines: [2, 5] },
];

// Product lines: [brand, category, subcategory, variants[[packLabel, kgPerCase, costPerCase, listPerCase]]]
const LINES = [
  ['Cascade Springs', 'Beverages', 'Bottled Water', [
    ['Still 12x1.5L', 19.2, 12.40, 16.30], ['Still 6x5L', 30.6, 17.90, 23.60],
    ['Sparkling 12x1.5L', 19.4, 13.10, 17.20], ['Still 24x500ml', 12.8, 9.60, 12.80],
  ]],
  ['Zesta', 'Beverages', 'Juice', [
    ['Orange 12x1L', 13.1, 17.40, 25.90], ['Mango 12x1L', 13.1, 17.80, 26.40],
    ['Apple 24x330ml', 9.4, 14.20, 21.80], ['Tropical 6x2L', 13.0, 16.10, 24.60],
  ]],
  ['Kopje Cola', 'Beverages', 'Carbonates', [
    ['Original 24x330ml', 9.8, 11.20, 17.90], ['Zero 24x330ml', 9.8, 11.40, 18.10],
    ['Original 12x2L', 25.4, 18.60, 28.40], ['Lemon 24x330ml', 9.8, 11.30, 18.00],
  ]],
  ['Dawnbrew', 'Beverages', 'Hot Beverages', [
    ['Tea 100s x12', 4.6, 21.30, 34.20], ['Instant Coffee 200g x12', 3.1, 38.40, 61.50],
    ['Rooibos 80s x12', 3.8, 19.70, 31.80],
  ]],
  ['Brightwash', 'Household Care', 'Laundry', [
    ['Powder 2kg x6', 12.4, 21.10, 28.60], ['Powder 5kg x4', 20.6, 33.80, 45.20],
    ['Liquid 2L x6', 13.0, 24.90, 34.10], ['Fabric Softener 2L x6', 13.0, 19.40, 27.30],
  ]],
  ['Citrona', 'Household Care', 'Dishwashing', [
    ['Liquid 750ml x12', 9.8, 16.20, 24.80], ['Liquid 2L x6', 13.0, 20.10, 30.60],
    ['Scourers 10pk x24', 3.2, 12.40, 19.90],
  ]],
  ['Halo Shine', 'Household Care', 'Glass & Surface Aerosol', [
    ['Glass 400ml x12', 6.1, 18.60, 27.40], ['Multi 400ml x12', 6.1, 18.90, 27.80],
    ['Furniture 300ml x12', 4.9, 17.20, 25.60], ['Kitchen 400ml x12', 6.1, 19.10, 28.10],
  ]],
  ['Verdelle', 'Personal Care', 'Bath & Body', [
    ['Bath Soap 6x175g x8', 8.6, 15.80, 25.40], ['Body Wash 400ml x12', 5.4, 26.30, 41.90],
    ['Lotion 400ml x12', 5.4, 24.10, 38.60], ['Handwash 500ml x12', 6.4, 21.70, 34.80],
  ]],
  ['Minta', 'Personal Care', 'Oral Care', [
    ['Toothpaste 100ml x24', 3.1, 28.40, 46.20], ['Toothbrush 12pk x12', 1.9, 19.60, 32.70],
    ['Mouthwash 500ml x12', 6.6, 27.10, 43.50],
  ]],
  ['Sunveld', 'Dry Goods', 'Staples', [
    ['Maize Meal 10kg', 10.3, 8.90, 11.70], ['Maize Meal 5kg x2', 10.3, 9.20, 12.10],
    ['Rice 5kg x4', 20.4, 26.80, 35.40], ['Flour 2.5kg x8', 20.3, 18.90, 25.10],
  ]],
  ['Pantri', 'Dry Goods', 'Pasta & Sauce', [
    ['Pasta 500g x20', 10.2, 14.60, 23.10], ['Tomato Sauce 700g x12', 8.8, 17.30, 27.20],
    ['Baked Beans 410g x24', 10.1, 16.40, 25.80], ['Cooking Oil 2L x6', 11.4, 22.70, 31.60],
  ]],
  ['Meadowvale', 'Dairy & Chilled', 'Milk & Yoghurt', [
    ['Full Cream Milk 6x1L', 6.3, 7.80, 10.90], ['Low Fat Milk 6x1L', 6.3, 7.70, 10.80],
    ['Yoghurt 1kg x6', 6.4, 13.90, 21.40], ['Spread 500g x12', 6.3, 18.20, 28.70],
  ]],
  ['Crunchpop', 'Snacks & Confectionery', 'Savoury Snacks', [
    ['Chips 125g x24', 3.2, 19.80, 33.60], ['Nuts 200g x18', 3.8, 24.60, 41.20],
    ['Popcorn 100g x24', 2.6, 16.40, 28.90],
  ]],
  ['Sweetwell', 'Snacks & Confectionery', 'Confectionery', [
    ['Biscuits 200g x24', 5.1, 21.30, 35.80], ['Sweets 150g x30', 4.8, 18.70, 32.40],
    ['Chocolate 90g x36', 3.4, 27.90, 47.10],
  ]],
  ['Little Fern', 'Baby & Infant', 'Baby Care', [
    ['Nappies M 44s x4', 9.2, 41.60, 63.80], ['Nappies L 40s x4', 9.6, 42.90, 65.40],
    ['Wipes 80s x12', 7.1, 22.40, 36.10], ['Baby Lotion 400ml x12', 5.4, 26.80, 42.30],
  ]],
  ['Softleaf', 'Paper & Hygiene', 'Paper Products', [
    ['Toilet Tissue 9pk x6', 8.4, 23.10, 33.20], ['Kitchen Towel 2pk x12', 7.2, 18.60, 28.40],
    ['Facial Tissue 150s x24', 6.1, 20.40, 32.10], ['Serviettes 100s x20', 5.4, 14.80, 23.60],
  ]],
];

// Hero SKUs the planted findings hang off
const P1_FAMILY = new Set();   // bulk water - negative contribution after freight + rebate
let P2_SKU = null;             // Brightwash Powder 2kg - value-destroying promo
const P4_SKUS = [];            // Modern Trade heroes that stock out on weekends
const P5_SKUS = new Set();     // Halo Shine aerosol - discontinued dead stock

// ---------------------------------------------------------------- build products

const products = [];
let skuN = 1000;
for (const [brand, category, subcat, variants] of LINES) {
  for (const [packLabel, kg, cost, list] of variants) {
    skuN += 1;
    const sku = 'MP-' + skuN;
    const discontinued = subcat === 'Glass & Surface Aerosol';
    const p = {
      sku,
      product_name: `${brand} ${packLabel}`,
      brand, category, subcategory: subcat,
      pack_size: packLabel,
      weight_kg: kg,
      unit_cost: r2(cost * ZAR),
      list_price: r2(list * ZAR),
      status: discontinued ? 'Discontinued' : 'Active',
      launch_date: iso(START - ri(200, 2200) * DAY),
      pop: Math.exp(gauss(0, 0.55)),
    };
    if (brand === 'Cascade Springs') { P1_FAMILY.add(sku); p.pop *= 2.6; }
    if (p.product_name === 'Brightwash Powder 2kg x6') { P2_SKU = sku; p.pop *= 2.2; }
    if (discontinued) { P5_SKUS.add(sku); p.pop *= 0.7; }
    if (['Meadowvale Full Cream Milk 6x1L', 'Sunveld Maize Meal 10kg', 'Softleaf Toilet Tissue 9pk x6']
      .includes(p.product_name)) { P4_SKUS.push(sku); p.pop *= 3.0; }
    products.push(p);
  }
}
// Flavour and variant siblings give the range a realistic long tail
const FLAVOURS = {
  'Juice': ['Guava', 'Pineapple', 'Mixed Berry'],
  'Carbonates': ['Cream Soda', 'Ginger', 'Orange'],
  'Savoury Snacks': ['Salt & Vinegar', 'Cheese', 'Barbecue', 'Chilli'],
  'Confectionery': ['Caramel', 'Mint', 'Berry'],
  'Bath & Body': ['Aloe', 'Coconut', 'Lavender'],
  'Laundry': ['Spring Fresh', 'Floral'],
  'Dishwashing': ['Lemon', 'Green Apple'],
  'Pasta & Sauce': ['Wholewheat', 'Chilli'],
  'Milk & Yoghurt': ['Strawberry', 'Vanilla'],
  'Hot Beverages': ['Decaf', 'Strong'],
  'Staples': ['Premium', 'Value'],
  'Paper Products': ['Scented', 'Extra Soft'],
  'Baby Care': ['Sensitive', 'Night'],
  'Oral Care': ['Whitening', 'Herbal'],
  'Glass & Surface Aerosol': ['Lemon', 'Ocean'],
};
const baseProducts = products.slice();
for (const p of baseProducts.filter((x) => x.pack_size === LINES.find((l) => l[0] === x.brand)[3][0][0]
  || x.pack_size === (LINES.find((l) => l[0] === x.brand)[3][1] || [''])[0])) {
  for (const fl of FLAVOURS[p.subcategory] || []) {
    skuN += 1;
    const jitter = 1 + gauss(0, 0.05);
    const child = {
      ...p,
      sku: 'MP-' + skuN,
      product_name: `${p.brand} ${fl} ${p.pack_size}`,
      pack_size: `${fl} ${p.pack_size}`,
      unit_cost: r2(p.unit_cost * jitter),
      list_price: r2(p.list_price * jitter * (1 + gauss(0, 0.02))),
      launch_date: iso(START - ri(60, 1400) * DAY),
      pop: p.pop * (0.22 + rnd() * 0.45),
    };
    if (p.status === 'Discontinued') P5_SKUS.add(child.sku);
    products.push(child);
  }
}

const bySku = new Map(products.map((p) => [p.sku, p]));
const P4_SET = new Set(P4_SKUS);

// Category x channel affinity
const AFFINITY = {
  'Modern Trade': { 'Dairy & Chilled': 1.6, 'Paper & Hygiene': 1.4, 'Baby & Infant': 1.4, 'Personal Care': 1.3, 'Snacks & Confectionery': 1.2, 'Beverages': 1.0, 'Household Care': 1.1, 'Dry Goods': 1.2 },
  'General Trade': { 'Dry Goods': 1.7, 'Beverages': 1.3, 'Snacks & Confectionery': 1.4, 'Household Care': 1.1, 'Personal Care': 0.9, 'Dairy & Chilled': 0.8, 'Paper & Hygiene': 0.9, 'Baby & Infant': 0.6 },
  'Wholesale': { 'Beverages': 1.9, 'Dry Goods': 1.6, 'Household Care': 1.3, 'Paper & Hygiene': 1.2, 'Snacks & Confectionery': 1.0, 'Personal Care': 0.8, 'Dairy & Chilled': 0.5, 'Baby & Infant': 0.7 },
  'HoReCa': { 'Dry Goods': 1.6, 'Beverages': 1.4, 'Dairy & Chilled': 1.3, 'Paper & Hygiene': 1.5, 'Household Care': 1.0, 'Snacks & Confectionery': 0.7, 'Personal Care': 0.4, 'Baby & Infant': 0.2 },
};

// ---------------------------------------------------------------- reps and customers

const FIRST = ['Thabo', 'Lerato', 'Sipho', 'Nomsa', 'Zanele', 'Bongani', 'Naledi', 'Mpho', 'Refilwe', 'Tebogo', 'Kagiso', 'Dineo', 'Andile', 'Lindiwe', 'Sizwe', 'Palesa'];
const LAST = ['Dlamini', 'Nkosi', 'Mokoena', 'Khumalo', 'Naidoo', 'Botha', 'Pillay', 'Mahlangu', 'Sithole', 'Molefe', 'Jacobs', 'Ndlovu', 'Van Wyk', 'Maseko', 'Adams'];

const reps = [];
for (let i = 0; i < 12; i++) {
  reps.push({
    rep_id: 'REP-' + String(101 + i),
    rep_name: `${FIRST[i % FIRST.length]} ${LAST[i % LAST.length]}`,
    region: REGIONS[i % REGIONS.length],
    team: i % 2 === 0 ? 'Trade Sales' : 'Key Accounts',
  });
}

const MT_NAMES = ['Kloofview Foods', 'Highveld Grocer', 'Baywater Market', 'Umdoni Fresh', 'Sandhurst Provisions', 'Table Bay Foods', 'Midvaal Super', 'Ridgecrest Market'];
const WS_NAMES = ['Summit Cash & Carry', 'Boksburg Bulk Traders', 'Ironstone Wholesale', 'Apex Depot', 'Karoo Supply Co'];
const GT_NAMES = ['Spaza', 'Superette', 'Trading Store', 'Mini Market', 'Corner Store', 'Tuck Shop', 'General Dealer', 'Kwikshop'];
const HR_NAMES = ['Lodge', 'Bistro', 'Cafe', 'Grill', 'Guest House', 'Shisanyama', 'Takeaway', 'Canteen'];
const CITY = ['Johannesburg', 'Pretoria', 'Cape Town', 'Durban', 'Gqeberha', 'Bloemfontein', 'Polokwane', 'Mbombela', 'East London', 'Rustenburg', 'Soweto', 'Tembisa', 'Umlazi', 'Khayelitsha', 'Vereeniging'];

const customers = [];
let custN = 5000;
function addCustomer(name, channel, sizeMul) {
  custN += 1;
  const region = pick(REGIONS);
  const ch = CHANNELS.find((c) => c.name === channel);
  const c = {
    customer_id: 'CUS-' + custN,
    customer_name: name,
    channel,
    region,
    city: pick(CITY),
    credit_terms_days: pick([14, 30, 30, 30, 45, 60]),
    rep_id: pick(reps.filter((r) => r.region === region) .length ? reps.filter((r) => r.region === region) : reps).rep_id,
    onboarded_date: iso(START - ri(30, 2600) * DAY),
    // size drives how often they order; qty_mul drives how much per line. Keeping them
    // separate stops one large account from compounding into an implausible share.
    size: sizeMul * Math.min(2.2, Math.exp(gauss(0, 0.45))),
    qty_mul: Math.min(2.0, Math.max(0.5, Math.exp(gauss(0, 0.30)))),
    baseDisc: ch.baseDisc[0] + rnd() * (ch.baseDisc[1] - ch.baseDisc[0]),
    rebate_pct: 0,
  };
  // Volume rebates are concentrated in Wholesale and the big Modern Trade banners
  if (channel === 'Wholesale') c.rebate_pct = r2(0.03 + rnd() * 0.04);
  if (channel === 'Modern Trade' && rnd() < 0.55) c.rebate_pct = r2(0.02 + rnd() * 0.035);
  customers.push(c);
  return c;
}

for (const n of MT_NAMES) for (let b = 1; b <= 5; b++) addCustomer(`${n} #${String(b).padStart(2, '0')}`, 'Modern Trade', 1.6);
for (const n of WS_NAMES) for (let b = 1; b <= 3; b++) addCustomer(`${n} ${['Depot', 'Branch', 'Hub'][b - 1]}`, 'Wholesale', 1.8);
for (let i = 0; i < 340; i++) addCustomer(`${pick(CITY)} ${pick(GT_NAMES)} ${ri(1, 99)}`, 'General Trade', 1.0);
for (let i = 0; i < 90; i++) addCustomer(`${pick(CITY)} ${pick(HR_NAMES)} ${ri(1, 40)}`, 'HoReCa', 1.0);

// PLANT 3: the top wholesale account whose discount quietly ratchets up
const SUMMIT = customers.find((c) => c.customer_name.startsWith('Summit Cash & Carry'));
SUMMIT.size *= 1.5;
SUMMIT.qty_mul = 1.35;
const SUMMIT_GROUP = new Set(customers.filter((c) => c.customer_name.startsWith('Summit')).map((c) => c.customer_id));
for (const c of customers) if (SUMMIT_GROUP.has(c.customer_id)) c.rebate_pct = 0.06;

const byChannel = {};
for (const c of customers) (byChannel[c.channel] = byChannel[c.channel] || []).push(c);

// Wholesale takes share from General Trade across the window. That mix shift is the
// single biggest reason blended margin falls while revenue climbs.
function pickChannel(t) {
  const shift = 0.15 * t;
  let tot = 0; const w = [];
  for (const c of CHANNELS) {
    const v = c.orderShare + (c.name === 'Wholesale' ? shift : c.name === 'General Trade' ? -shift : 0);
    w.push(v); tot += v;
  }
  let r = rnd() * tot;
  for (let i = 0; i < CHANNELS.length; i++) { r -= w[i]; if (r <= 0) return CHANNELS[i]; }
  return CHANNELS[0];
}

// ---------------------------------------------------------------- promotions

const promos = [];
let promoN = 300;
function addPromo(sku, name, mechanic, startMs, weeks, disc, funder, uplift, hangover) {
  promoN += 1;
  const id = 'PROMO-' + promoN;
  promos.push({
    promo_id: id, promo_name: name, sku, mechanic,
    start_date: iso(startMs), end_date: iso(startMs + (weeks * 7 - 1) * DAY),
    planned_discount_pct: disc, funding_source: funder,
    _s: startMs, _e: startMs + (weeks * 7 - 1) * DAY, _d: disc, _u: uplift,
    _hs: startMs + weeks * 7 * DAY, _he: startMs + (weeks * 7 + 28) * DAY, _h: hangover,
  });
}

// PLANT 2: quarterly "Buy 2 Get 1 Free" on Brightwash Powder 2kg.
// 33% effective discount against a ~26% gross margin, plus four weeks of pantry loading afterwards.
for (let q = 0; q < 8; q++) {
  const s = START + (35 + q * 91) * DAY;
  if (s > END) break;
  addPromo(P2_SKU, `Brightwash Buy 2 Get 1 Free - Q${(q % 4) + 1}`, 'Buy 2 Get 1 Free', s, 3, 0.333, 'Supplier co-funded', 3.4, 0.45);
}
// Ordinary, healthy promos for contrast
const NORMAL_PROMO_SKUS = products.filter((p) => !P1_FAMILY.has(p.sku) && p.sku !== P2_SKU && p.status === 'Active');
for (let i = 0; i < 26; i++) {
  const p = pick(NORMAL_PROMO_SKUS);
  const s = START + ri(10, N_DAYS - 30) * DAY;
  addPromo(p.sku, `${p.brand} price promotion`, pick(['10% off', '15% off', 'Multibuy 3 for 2']), s, ri(2, 4), pick([0.10, 0.12, 0.15]), pick(['Supplier co-funded', 'Meridian funded']), 1.9, 0.88);
}
const promoBySku = new Map();
for (const pr of promos) {
  if (!promoBySku.has(pr.sku)) promoBySku.set(pr.sku, []);
  promoBySku.get(pr.sku).push(pr);
}

// ---------------------------------------------------------------- stock-out weeks (PLANT 4)

const stockoutWeeks = new Set();
for (let w = 0; w < Math.ceil(N_DAYS / 7); w++) if (rnd() < 0.35) stockoutWeeks.add(w);
const weekOf = (ms) => Math.floor((ms - START) / DAY / 7);

// ---------------------------------------------------------------- simulate orders

const SEASON = [0.88, 0.86, 0.97, 1.00, 1.03, 0.99, 1.01, 1.04, 1.02, 1.06, 1.12, 1.29]; // Jan..Dec
const YOY = 0.07;

const orders = [];
const lines = [];
const costs = [];
let orderN = 700000, lineN = 0;

const ledger = { lostUnits: 0, lostRevenue: 0 };

for (let d = 0; d < N_DAYS; d++) {
  const ms = START + d * DAY;
  const wd = dow(ms);
  if (wd === 0) continue;                                  // no Sunday trading
  const wdMul = wd === 6 ? 0.42 : 1.0;
  const trend = Math.pow(1 + YOY, d / 365);
  const nOrders = Math.max(0, Math.round(92 * SEASON[monthIdx(ms)] * wdMul * trend * (0.86 + rnd() * 0.28)));
  const t = d / N_DAYS;

  for (let o = 0; o < nOrders; o++) {
    const ch = pickChannel(t);
    const cust = weighted(byChannel[ch.name], 'size');

    orderN += 1;
    const order_id = 'SO-' + orderN;
    const wh = cust.region === 'KwaZulu-Natal' ? WAREHOUSES[1] : cust.region === 'Western Cape' ? WAREHOUSES[2] : WAREHOUSES[0];
    const nLines = ri(ch.lines[0], ch.lines[1]);

    // Build a candidate basket weighted by popularity and channel affinity
    const chosen = new Set();
    const basket = [];
    for (let l = 0; l < nLines; l++) {
      let p = null;
      for (let attempt = 0; attempt < 8; attempt++) {
        const cand = weighted(products, 'pop');
        if (chosen.has(cand.sku)) continue;
        const aff = AFFINITY[cust.channel][cand.category] || 1;
        if (cand.status === 'Discontinued' && ms > END - 190 * DAY) continue;   // PLANT 5: stops selling
        // PLANT 1: the bulk water range is pushed hard into Wholesale and grows over the window
        if (P1_FAMILY.has(cand.sku)) {
          if (cust.channel !== 'Wholesale' && rnd() < 0.88) continue;
          if (rnd() > 0.18 + 0.55 * t) continue;
        }
        if (rnd() < aff / 2.0) { p = cand; break; }
      }
      if (!p) continue;
      chosen.add(p.sku);
      basket.push(p);
    }
    if (!basket.length) continue;

    let orderWeight = 0, orderRev = 0;
    const pending = [];

    for (const p of basket) {
      // PLANT 4: hero SKUs cannot be supplied Fri/Sat in a stock-out week
      if (P4_SET.has(p.sku) && stockoutWeeks.has(weekOf(ms)) && (wd === 5 || wd === 6) && cust.channel === 'Modern Trade') {
        const lostQty = Math.max(1, Math.round(ch.baseQty * cust.qty_mul * (0.8 + rnd() * 0.5)));
        ledger.lostUnits += lostQty;
        ledger.lostRevenue += lostQty * p.list_price * (1 - cust.baseDisc);
        continue;
      }

      const active = (promoBySku.get(p.sku) || []).find((pr) => ms >= pr._s && ms <= pr._e);
      const hang = (promoBySku.get(p.sku) || []).find((pr) => ms > pr._e && ms <= pr._he);

      let qty = Math.max(1, Math.round(ch.baseQty * cust.qty_mul * Math.exp(gauss(0, 0.38))));
      if (active) qty = Math.round(qty * active._u);
      else if (hang) qty = Math.max(1, Math.round(qty * hang._h));
      if (P1_FAMILY.has(p.sku) && cust.channel === 'Wholesale') qty = Math.round(qty * 1.4);

      // Discount stack: channel base, a slow company-wide drift from competitive pressure,
      // the promo floor, and PLANT 3 discount creep on the Summit group
      let disc = cust.baseDisc + 0.030 * t + gauss(0, 0.008);
      if (SUMMIT_GROUP.has(cust.customer_id)) disc = 0.08 + 0.075 * t + gauss(0, 0.006);
      if (active) disc = Math.max(disc, active._d);
      disc = Math.min(0.55, Math.max(0, disc));

      const unit_price = r2(p.list_price * (1 + gauss(0, 0.012)));
      const revenue = r2(qty * unit_price * (1 - disc));
      orderWeight += qty * p.weight_kg;
      orderRev += revenue;

      lineN += 1;
      pending.push({
        order_line_id: 'SOL-' + (900000 + lineN),
        order_id, sku: p.sku, quantity: qty,
        unit_price, discount_pct: r2(disc * 100),
        line_revenue: revenue,
        promo_id: active ? active.promo_id : '',
      });
    }
    if (!pending.length) { orderN -= 1; continue; }

    // ~1.4% of orders are returns booked as negative lines
    const isReturn = rnd() < 0.014;
    if (isReturn) for (const l of pending) { l.quantity = -Math.max(1, Math.round(l.quantity * 0.3)); l.line_revenue = r2(-Math.abs(l.line_revenue) * 0.3); }

    orders.push({
      order_id,
      order_date: ms,
      customer_id: cust.customer_id,
      warehouse_code: wh.code,
      rep_id: cust.rep_id,
      order_status: isReturn ? 'Returned' : (rnd() < 0.02 ? 'Cancelled' : 'Delivered'),
      payment_terms_days: cust.credit_terms_days,
      channel_raw: cust.channel,
    });
    for (const l of pending) lines.push(l);

    const rate = FREIGHT_RATE[cust.region], fee = DROP_FEE[cust.region];
    costs.push({
      order_id,
      freight_cost: r2(Math.abs(orderWeight) * rate + fee + Math.abs(gauss(0, 1.1))),
      handling_cost: r2((1.85 * pending.length + 3.2) * ZAR),
      rebate_amount: r2(orderRev * cust.rebate_pct),
    });
  }
}

// ---------------------------------------------------------------- inventory snapshots

const demandBySkuWh = new Map();
const custById = new Map(customers.map((c) => [c.customer_id, c]));
const ordById = new Map(orders.map((o) => [o.order_id, o]));
for (const l of lines) {
  const o = ordById.get(l.order_id);
  const k = l.sku + '|' + o.warehouse_code;
  demandBySkuWh.set(k, (demandBySkuWh.get(k) || 0) + Math.max(0, l.quantity));
}

const snapshots = [];
for (let d = 0; d < N_DAYS; d++) {
  const ms = START + d * DAY;
  const wd = dow(ms);
  if (wd !== 1 && wd !== 4) continue;                       // Monday and Thursday snapshots
  const w = weekOf(ms);
  for (const p of products) {
    for (const wh of WAREHOUSES) {
      const k = p.sku + '|' + wh.code;
      const weekly = (demandBySkuWh.get(k) || 0) / (N_DAYS / 7);
      if (weekly < 0.05 && !P5_SKUS.has(p.sku)) continue;

      let onHand;
      if (P5_SKUS.has(p.sku)) {
        // PLANT 5: discontinued aerosol range frozen in the Northern DC
        onHand = wh.code === 'WH-02' ? Math.round(180 + (p.sku.charCodeAt(4) % 40) * 6) : Math.max(0, Math.round(weekly * 0.4));
      } else if (P4_SET.has(p.sku) && wh.code === 'WH-01' && wd === 4 && stockoutWeeks.has(w)) {
        onHand = 0;                                          // PLANT 4 made visible in the snapshot
      } else {
        onHand = Math.max(0, Math.round(weekly * (1.4 + rnd() * 1.6)));
      }
      snapshots.push({
        snapshot_date: iso(ms), warehouse_code: wh.code, sku: p.sku,
        units_on_hand: onHand,
        units_in_transit: Math.max(0, Math.round(weekly * rnd() * 0.9)),
      });
    }
  }
}

// ---------------------------------------------------------------- deliberate mess

const CASE_VARIANTS = (s) => [s, s.toUpperCase(), s.toLowerCase()];
function messyChannel(s) { const r = rnd(); return r < 0.08 ? s.toUpperCase() : r < 0.14 ? s.toLowerCase() : s; }
function messyPad(s) { const r = rnd(); return r < 0.05 ? '  ' + s : r < 0.08 ? s + ' ' : s; }
function messyNum(n) { return rnd() < 0.10 && Math.abs(n) >= 1000 ? `"${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}"` : n; }

// ~3% of products lose their standard cost
for (const p of products) if (rnd() < 0.03 && !P1_FAMILY.has(p.sku)) p.unit_cost = '';
// a few order lines reference SKUs that never made it into the product master
for (let i = 0; i < 140; i++) lines[ri(0, lines.length - 1)].sku = 'MP-' + ri(9000, 9400);
// ~0.5% exact duplicate lines
const dupes = [];
for (let i = 0; i < Math.round(lines.length * 0.005); i++) dupes.push({ ...lines[ri(0, lines.length - 1)] });
for (const d of dupes) lines.push(d);

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
counts['products.csv'] = writeCsv('products.csv',
  ['sku', 'product_name', 'brand', 'category', 'subcategory', 'pack_size', 'weight_kg', 'unit_cost', 'list_price', 'status', 'launch_date'],
  products, (p) => [p.sku, q(p.product_name), q(p.brand), q(messyPad(p.category)), q(p.subcategory), q(p.pack_size), p.weight_kg, p.unit_cost, p.list_price, p.status, p.launch_date]);

counts['customers.csv'] = writeCsv('customers.csv',
  ['customer_id', 'customer_name', 'channel', 'region', 'city', 'credit_terms_days', 'rep_id', 'rebate_pct', 'onboarded_date'],
  customers, (c) => [c.customer_id, q(messyPad(c.customer_name)), q(messyChannel(c.channel)), c.region, c.city, c.credit_terms_days, c.rep_id, c.rebate_pct, c.onboarded_date]);

counts['sales_reps.csv'] = writeCsv('sales_reps.csv',
  ['rep_id', 'rep_name', 'region', 'team'], reps, (r) => [r.rep_id, q(r.rep_name), r.region, q(r.team)]);

counts['warehouses.csv'] = writeCsv('warehouses.csv',
  ['warehouse_code', 'warehouse_name', 'region'], WAREHOUSES, (w) => [w.code, q(w.name), w.region]);

counts['orders.csv'] = writeCsv('orders.csv',
  ['order_id', 'order_date', 'customer_id', 'warehouse_code', 'rep_id', 'order_status', 'payment_terms_days'],
  orders, (o) => [o.order_id, rnd() < 0.30 ? dmy(o.order_date) : iso(o.order_date), o.customer_id, o.warehouse_code, o.rep_id, o.order_status, o.payment_terms_days]);

counts['order_lines.csv'] = writeCsv('order_lines.csv',
  ['order_line_id', 'order_id', 'sku', 'quantity', 'unit_price', 'discount_pct', 'line_revenue', 'promo_id'],
  lines, (l) => [l.order_line_id, l.order_id, l.sku, l.quantity, l.unit_price, l.discount_pct, messyNum(l.line_revenue), l.promo_id]);

counts['cost_allocations.csv'] = writeCsv('cost_allocations.csv',
  ['order_id', 'freight_cost', 'handling_cost', 'rebate_amount'],
  costs, (c) => [c.order_id, c.freight_cost, c.handling_cost, messyNum(c.rebate_amount)]);

counts['promotions.csv'] = writeCsv('promotions.csv',
  ['promo_id', 'promo_name', 'sku', 'mechanic', 'start_date', 'end_date', 'planned_discount_pct', 'funding_source'],
  promos, (p) => [p.promo_id, q(p.promo_name), p.sku, q(p.mechanic), p.start_date, p.end_date, p.planned_discount_pct, q(p.funding_source)]);

counts['inventory_snapshots.csv'] = writeCsv('inventory_snapshots.csv',
  ['snapshot_date', 'warehouse_code', 'sku', 'units_on_hand', 'units_in_transit'],
  snapshots, (s) => [s.snapshot_date, s.warehouse_code, s.sku, s.units_on_hand, s.units_in_transit]);

// ---------------------------------------------------------------- answer key

const TTM_START = END - 364 * DAY;
const PY_START = END - 729 * DAY;
const costById = new Map(costs.map((c) => [c.order_id, c]));

let ttmRev = 0, ttmCogs = 0, pyRev = 0, pyCogs = 0;
let p1Rev = 0, p1Gp = 0, p1Freight = 0, p1Rebate = 0, p1Units = 0;
let p2Rev = 0, p2Gp = 0, p2Units = 0, p2BaseRev = 0, p2BaseGp = 0, p2BaseUnits = 0;
let sumRev = 0, sumDiscLost = 0;
let orderWeightCache = new Map();

for (const l of lines) {
  const o = ordById.get(l.order_id); if (!o) continue;
  const p = bySku.get(l.sku); if (!p) continue;
  const cost = p.unit_cost === '' ? p.list_price * 0.68 : p.unit_cost;
  const gp = l.line_revenue - l.quantity * cost;
  const inTtm = o.order_date >= TTM_START;
  const inPy = o.order_date >= PY_START && o.order_date < TTM_START;
  if (inTtm) { ttmRev += l.line_revenue; ttmCogs += l.quantity * cost; }
  if (inPy) { pyRev += l.line_revenue; pyCogs += l.quantity * cost; }
  if (!inTtm) continue;

  const w = Math.abs(l.quantity) * p.weight_kg;
  orderWeightCache.set(l.order_id, (orderWeightCache.get(l.order_id) || 0) + w);

  if (P1_FAMILY.has(l.sku)) { p1Rev += l.line_revenue; p1Gp += gp; p1Units += l.quantity; }
  if (l.sku === P2_SKU) {
    if (l.promo_id) { p2Rev += l.line_revenue; p2Gp += gp; p2Units += l.quantity; }
    else { p2BaseRev += l.line_revenue; p2BaseGp += gp; p2BaseUnits += l.quantity; }
  }
  if (SUMMIT_GROUP.has(o.customer_id)) {
    sumRev += l.line_revenue;
    const atEight = l.quantity * l.unit_price * 0.92;
    sumDiscLost += atEight - l.line_revenue;
  }
}
// allocate order-level freight and rebate to the bulk-water family by weight share
for (const l of lines) {
  const o = ordById.get(l.order_id); if (!o || o.order_date < TTM_START) continue;
  if (!P1_FAMILY.has(l.sku)) continue;
  const p = bySku.get(l.sku); const c = costById.get(l.order_id); if (!c) continue;
  const share = (Math.abs(l.quantity) * p.weight_kg) / Math.max(1, orderWeightCache.get(l.order_id));
  p1Freight += c.freight_cost * share;
  p1Rebate += c.rebate_amount * share;
}

let deadValue = 0;
const lastSnapDate = snapshots[snapshots.length - 1].snapshot_date;
for (const s of snapshots) {
  if (s.snapshot_date !== lastSnapDate) continue;
  if (!P5_SKUS.has(s.sku)) continue;
  const p = bySku.get(s.sku);
  deadValue += s.units_on_hand * (p.unit_cost === '' ? p.list_price * 0.68 : p.unit_cost);
}

const m = (n) => (n < 0 ? '-R' : 'R') + Math.round(Math.abs(n)).toLocaleString('en-US');
const m2 = (n) => (n < 0 ? '-R' : 'R') + Math.abs(n).toFixed(2);
const pct = (n) => (n * 100).toFixed(1) + '%';

console.log('Meridian Provisions Co. - generated\n');
for (const [f, n] of Object.entries(counts)) {
  const sz = fs.statSync(path.join(OUT, f)).size;
  console.log(`  ${f.padEnd(26)} ${String(n).padStart(9)} rows   ${(sz / 1048576).toFixed(1)} MB`);
}
const chRev = {};
for (const l of lines) {
  const o = ordById.get(l.order_id); if (!o || o.order_date < TTM_START) continue;
  const c = custById.get(o.customer_id);
  chRev[c.channel] = (chRev[c.channel] || 0) + l.line_revenue;
}
const ttmOrders = orders.filter((o) => o.order_date >= TTM_START).length;

console.log(`\n  SKUs ${products.length}   customers ${customers.length}   TTM orders ${ttmOrders.toLocaleString('en-US')}`);
console.log(`  TTM revenue      ${m(ttmRev)}   (${pct(ttmRev / pyRev - 1)} YoY)`);
console.log(`  TTM gross profit ${m(ttmRev - ttmCogs)}   (${pct((ttmRev - ttmCogs) / (pyRev - pyCogs) - 1)} YoY, margin ${pct((ttmRev - ttmCogs) / ttmRev)})`);
console.log(`  Avg order value  ${m(ttmRev / ttmOrders)}`);
console.log('  Channel mix     ' + Object.entries(chRev).map(([k, v]) => `${k} ${pct(v / ttmRev)}`).join('   '));
console.log(`  Top account      ${pct(sumRev / ttmRev)} of revenue`);
console.log('\n  The five planted findings are measured from the warehouse, not from here -');
console.log('  the allocation rules that make them true live in the gold layer.');
console.log('  Next: dbt build, then generator/build_answer_key.py for ANSWER_KEY.md');
