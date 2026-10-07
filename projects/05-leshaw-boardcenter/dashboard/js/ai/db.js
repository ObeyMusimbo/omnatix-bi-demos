/*
  Leshaw Business Hub: the query engine behind Ask the data.

  The other four demos read Parquet files published from a warehouse. Leshaw's hub keeps its
  data in the page, generated from a seed and changed by whatever happens in a demo: an order
  marked paid, a quote accepted, stock received. So this turns that live data into tables in
  the same in-browser DuckDB engine, and rebuilds them whenever the data has changed. The AI
  therefore answers from exactly what the hub shows, and its SQL runs right here.

  Definitions match the hub's own (js/app.js): an order's total is its goods plus cutting and
  edging, prices include 15% VAT, revenue excludes cancelled orders, and a product is low on
  stock at or below its reorder level and critical at or below half of it.
*/

const DUCKDB_ESM = 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.32.0/+esm';
const DAY = 864e5;

let db = null;
let conn = null;
let connecting = null;
let loadedKey = '';

async function start() {
  const duckdb = await import(DUCKDB_ESM);
  const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' }));
  const worker = new Worker(workerUrl);
  db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(workerUrl);
  conn = await db.connect();
  return conn;
}

export function connect() {
  connecting ||= start();
  return connecting;
}

// ---------------------------------------------------------------- the live data as tables

const local = (iso) => {
  // The hub works in local South African time, so dates are the shop's dates, not UTC's.
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    time: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:00`,
    month: `${d.getFullYear()}-${p(d.getMonth() + 1)}`,
    weekday: d.toLocaleDateString('en-ZA', { weekday: 'long' }),
  };
};
const r2 = (n) => Math.round(n * 100) / 100;
const exVat = (t) => r2(t - (t * 15) / 115);
const isBoard = (p) => p && !['Hardware', 'Edging'].includes(p.category);

function tables(S) {
  const pIndex = Object.fromEntries(S.products.map((p) => [p.id, p]));
  const cIndex = Object.fromEntries(S.customers.map((c) => [c.id, c]));
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const products = S.products.map((p) => ({
    product_id: p.id, product_name: p.name, range_name: p.range, category: p.category,
    spec: p.spec, unit: p.unit, price_incl_vat_zar: p.price, cost_zar: p.cost,
    stock_on_hand: p.stock, reorder_level: p.reorder,
    stock_status: p.stock <= p.reorder * 0.5 ? 'Critical' : p.stock <= p.reorder ? 'Reorder' : 'OK',
    stock_value_at_cost_zar: r2(p.stock * p.cost),
  }));

  const customers = S.customers.map((c) => ({
    customer_id: c.id, customer_name: c.name, contact_person: c.contact, customer_type: c.type,
    area: c.area, has_trade_account: !!c.account,
  }));

  const orders = [];
  const orderLines = [];
  for (const o of S.orders) {
    const t = local(o.date);
    const c = cIndex[o.cid] || {};
    const goods = o.lines.reduce((s, l) => s + l.qty * l.price, 0);
    const services = (o.services || []).reduce((s, l) => s + l.qty * l.price, 0);
    const total = goods + services;
    const cut = (o.services || []).find((s) => s.key === 'cut');
    const edge = (o.services || []).find((s) => s.key === 'edge');
    orders.push({
      order_id: o.id, customer_id: o.cid, customer_name: c.name || '', customer_type: c.type || '',
      order_date: t.date, placed_at: t.time, order_month: t.month, weekday: t.weekday,
      status: o.status, channel: o.channel, fulfilment: o.delivery,
      goods_incl_vat_zar: r2(goods), cutting_edging_incl_vat_zar: r2(services),
      total_incl_vat_zar: r2(total), total_excl_vat_zar: exVat(total), vat_zar: r2(total - exVat(total)),
      sheets_cut: cut ? cut.qty : 0, edging_metres: edge ? edge.qty : 0,
      counts_as_revenue: o.status !== 'Cancelled',
    });
    // Lines of cancelled orders are left out: every product question is about what sold, and
    // a model that forgets to filter them (seen live) would otherwise count them.
    if (o.status === 'Cancelled') continue;
    for (const l of o.lines) {
      const p = pIndex[l.pid] || {};
      orderLines.push({
        order_id: o.id, order_date: t.date, order_month: t.month, status: o.status,
        product_id: l.pid, product_name: p.name || l.pid, category: p.category || '',
        quantity: l.qty, unit_price_incl_vat_zar: l.price, line_total_incl_vat_zar: r2(l.qty * l.price),
        line_total_excl_vat_zar: exVat(l.qty * l.price), line_cost_zar: r2(l.qty * (p.cost || 0)),
        is_board_sheet: isBoard(p) && p.category !== 'Counter Tops',
      });
    }
  }

  const quotes = [];
  const quoteLines = [];
  for (const q of S.quotes) {
    const t = local(q.date);
    const c = cIndex[q.cid] || {};
    const total = q.lines.reduce((s, l) => s + l.qty * l.price, 0)
      + (q.services || []).reduce((s, l) => s + l.qty * l.price, 0);
    const valid = local(q.valid);
    quotes.push({
      quote_id: q.id, customer_id: q.cid, customer_name: c.name || '', quote_date: t.date,
      valid_until: valid.date, status: q.status, project: q.project,
      total_incl_vat_zar: r2(total), total_excl_vat_zar: exVat(total),
      days_until_expiry: Math.round((new Date(q.valid) - today) / DAY),
    });
    for (const l of q.lines) {
      const p = pIndex[l.pid] || {};
      quoteLines.push({
        quote_id: q.id, product_id: l.pid, product_name: p.name || l.pid, category: p.category || '',
        quantity: l.qty, unit_price_incl_vat_zar: l.price, line_total_incl_vat_zar: r2(l.qty * l.price),
      });
    }
  }

  const jobs = S.jobs.map((j) => {
    const due = local(j.due);
    const c = cIndex[j.cid] || {};
    const p = pIndex[j.pid] || {};
    return {
      job_id: j.id, order_id: j.oid, customer_name: c.name || '', board: p.name || j.pid,
      sheets: j.sheets, panels: j.panels, edging_metres: j.edgeM, stage: j.stage,
      due_date: due.date, machine: j.machine, is_rush: !!j.priority,
      is_overdue: j.stage !== 'Ready' && new Date(j.due) < today,
    };
  });

  return { products, customers, orders, order_lines: orderLines, quotes, quote_lines: quoteLines, production_jobs: jobs };
}

// A cheap fingerprint of everything a demo can change, so the tables are rebuilt only when
// something did: a status, a stage, a stock level, a new order or quote.
function fingerprint(S) {
  const s = [S.generated, S.orders.length, S.quotes.length, S.jobs.length,
    S.orders.map((o) => o.status).join(','),
    S.quotes.map((q) => q.status + q.valid).join(','),
    S.jobs.map((j) => j.stage + j.machine + j.priority + j.due).join(','),
    S.products.map((p) => `${p.stock}/${p.reorder}/${p.price}`).join(',')].join('|');
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h);
}

/** A key that changes whenever the hub's data does, for caching what was written from it. */
export function dataKey() {
  const S = window.LeshawHub?.state?.();
  return S ? fingerprint(S) : '';
}

async function ensureTables() {
  const S = window.LeshawHub?.state?.();
  if (!S) throw new Error('The hub data has not loaded yet. Try again in a moment.');
  const key = fingerprint(S);
  if (key === loadedKey) return;
  const c = await connect();
  for (const [name, rows] of Object.entries(tables(S))) {
    const file = `${name}.json`;
    await db.registerFileText(file, JSON.stringify(rows));
    await c.query(`create or replace table ${name} as select * from read_json_auto('${file}')`);
  }
  // Typed dates, so date arithmetic and month functions work in the model's SQL.
  await c.query(`create or replace table orders as select * replace (cast(order_date as date) as order_date, cast(placed_at as timestamp) as placed_at) from orders`);
  await c.query(`create or replace table order_lines as select * replace (cast(order_date as date) as order_date) from order_lines`);
  await c.query(`create or replace table quotes as select * replace (cast(quote_date as date) as quote_date, cast(valid_until as date) as valid_until) from quotes`);
  await c.query(`create or replace table production_jobs as select * replace (cast(due_date as date) as due_date) from production_jobs`);
  loadedKey = key;
}

// Arrow hands a DECIMAL to JavaScript as a 128 bit integer in a Uint32Array, with the scale on
// the field. Converted here, once, as the warehouse demos' db.js does.
function decimalToNumber(words, scale) {
  let n = 0n;
  for (let i = words.length - 1; i >= 0; i--) n = (n << 32n) | BigInt(words[i] >>> 0);
  const bits = BigInt(words.length * 32);
  if (n >= 1n << (bits - 1n)) n -= 1n << bits;
  return Number(n) / 10 ** scale;
}

/**
 * Run SQL against the live hub data and return plain objects: BigInt and DECIMAL as numbers,
 * dates as ISO strings, times as "YYYY-MM-DD HH:MM". The tables hold the shop's local times as
 * they are, so they are read back without a timezone shift.
 */
export async function q(sql) {
  const c = await connect();
  await ensureTables();
  const result = await c.query(sql);
  const fields = result.schema.fields;
  const dateFields = new Set(fields.filter((f) => f.type?.typeId === 8 || /^Date/i.test(String(f.type))).map((f) => f.name));
  const timeFields = new Set(fields.filter((f) => f.type?.typeId === 10 || /^Timestamp/i.test(String(f.type))).map((f) => f.name));
  const decimalScale = new Map(fields.filter((f) => f.type?.typeId === 7 || /^Decimal/i.test(String(f.type)))
    .map((f) => [f.name, f.type?.scale ?? 0]));
  return result.toArray().map((row) => {
    const o = row.toJSON();
    for (const k of Object.keys(o)) {
      let v = o[k];
      if (typeof v === 'bigint') v = Number(v);
      if (v != null && decimalScale.has(k) && typeof v === 'object' && 'length' in v) v = decimalToNumber(v, decimalScale.get(k));
      if (v instanceof Date) v = v.toISOString().slice(0, timeFields.has(k) ? 16 : 10).replace('T', ' ');
      else if (dateFields.has(k) && typeof v === 'number') v = new Date(v).toISOString().slice(0, 10);
      else if (timeFields.has(k) && typeof v === 'number') v = new Date(v).toISOString().slice(0, 16).replace('T', ' ');
      o[k] = v;
    }
    return o;
  });
}
