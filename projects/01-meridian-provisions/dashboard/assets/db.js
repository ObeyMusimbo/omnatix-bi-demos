/*
  DuckDB-WASM bootstrap.

  The whole warehouse query engine runs in the browser. Parquet files are fetched over
  plain HTTP from the same static host, registered with DuckDB, and queried with ordinary
  SQL — no server, no API, no database to operate. That is the point of this architecture
  and it is worth saying out loud in a demo.
*/

import * as duckdb from 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.32.0/+esm';

const TABLES = [
  'mart_gp_bridge',
  'mart_margin_waterfall',
  'mart_promo_performance',
  'mart_discount_trend',
  'mart_stockout_impact',
  'mart_dead_stock',
  'agg_sales_monthly',
  'agg_product_month',
  'dim_product',
  'dim_customer',
];

let conn = null;

export async function connect(onProgress = () => {}) {
  if (conn) return conn;

  onProgress('Starting the query engine');
  const bundles = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(bundles);

  // The worker has to be same-origin, so wrap the CDN script in a blob that imports it.
  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' })
  );
  const worker = new Worker(workerUrl);
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(workerUrl);

  onProgress('Loading the gold layer');
  await Promise.all(
    TABLES.map((t) =>
      db.registerFileURL(
        `${t}.parquet`,
        new URL(`data/${t}.parquet`, location.href).href,
        duckdb.DuckDBDataProtocol.HTTP,
        false
      )
    )
  );

  conn = await db.connect();

  // Views so queries read as ordinary table names rather than quoted file paths.
  for (const t of TABLES) {
    await conn.query(`create or replace view ${t} as select * from '${t}.parquet'`);
  }

  return conn;
}

/**
 * Run SQL and return plain JS objects.
 *
 * Two conversions matter. BigInt is narrowed to Number so values can be charted and
 * formatted. DATE columns come back from Arrow as epoch milliseconds rather than Date
 * objects or strings, so they are read off the schema by name and turned into ISO date
 * strings — which sort correctly and format predictably.
 */
export async function q(sql) {
  const c = await connect();
  const result = await c.query(sql);

  const dateFields = new Set(
    result.schema.fields
      .filter((f) => f.type?.typeId === 8 || /^Date/i.test(String(f.type)))
      .map((f) => f.name)
  );

  return result.toArray().map((row) => {
    const o = row.toJSON();
    for (const k of Object.keys(o)) {
      let val = o[k];
      if (typeof val === 'bigint') val = Number(val);
      if (val instanceof Date) val = val.toISOString().slice(0, 10);
      else if (dateFields.has(k) && typeof val === 'number') {
        val = new Date(val).toISOString().slice(0, 10);
      }
      o[k] = val;
    }
    return o;
  });
}

/** First row of a query, or null. */
export async function q1(sql) {
  const rows = await q(sql);
  return rows.length ? rows[0] : null;
}
