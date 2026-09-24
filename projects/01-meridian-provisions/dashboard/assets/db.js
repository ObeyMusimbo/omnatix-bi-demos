/*
  DuckDB-WASM bootstrap.

  The whole warehouse query engine runs in the browser. Parquet files are fetched over
  plain HTTP from the same static host, registered with DuckDB, and queried with ordinary
  SQL, no server, no API, no database to operate. That is the point of this architecture
  and it is worth saying out loud in a demo.
*/

// Loaded on demand rather than imported at the top. A static import made the whole page wait
// for this module before any of it could run, so nothing painted until the engine arrived.
// Now the page draws its frame and summary first and the engine loads alongside.
const DUCKDB_ESM = 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.32.0/+esm';

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
let metaCache = null;

/**
 * Build metadata written by export_parquet.py: when the pipeline last ran and how recent
 * the newest transaction in it is. Read separately from the Parquet so the page can state
 * its own freshness even if a query later fails.
 */
export async function meta() {
  if (metaCache) return metaCache;
  const res = await fetch(new URL('data/meta.json', location.href), { cache: 'no-store' });
  if (!res.ok) throw new Error(`meta.json ${res.status}`);
  metaCache = await res.json();
  return metaCache;
}

let connecting = null;

/**
 * Start the engine once. The page calls this early, before it has anything to query, and
 * every query calls it again; they all share the one promise instead of racing to start two
 * engines.
 */
export function connect(onProgress = () => {}) {
  connecting ||= start(onProgress);
  return connecting;
}

async function start(onProgress) {
  onProgress('Starting the query engine');
  const duckdb = await import(DUCKDB_ESM);
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
 * Arrow hands a DECIMAL column to JavaScript as a 128 bit integer in a Uint32Array plus a
 * scale on the field, not as a number. It looks like an object, it fails silently on
 * arithmetic, and the first sign of trouble is toFixed throwing inside a formatter several
 * layers away. So decimals are converted here, once, at the boundary.
 *
 * Any SQL that produces a decimal is worth fixing in the model as well, because a double is
 * what the rest of the page expects. This is the safety net, not the answer.
 */
function decimalToNumber(words, scale) {
  let n = 0n;
  for (let i = words.length - 1; i >= 0; i--) n = (n << 32n) | BigInt(words[i] >>> 0);
  // Two's complement: the top bit of the most significant word is the sign.
  const bits = BigInt(words.length * 32);
  if (n >= 1n << (bits - 1n)) n -= 1n << bits;
  return Number(n) / 10 ** scale;
}

/**
 * Run SQL and return plain JS objects.
 *
 * Three conversions matter. BigInt is narrowed to Number so values can be charted and
 * formatted. DECIMAL is converted from its Arrow representation, as above. And DATE columns
 * come back as epoch milliseconds rather than Date objects or strings, so they are read off
 * the schema by name and turned into ISO date strings, which sort correctly and format
 * predictably.
 */
export async function q(sql) {
  const c = await connect();
  const result = await c.query(sql);

  const dateFields = new Set(
    result.schema.fields
      .filter((f) => f.type?.typeId === 8 || /^Date/i.test(String(f.type)))
      .map((f) => f.name)
  );
  const decimalScale = new Map(
    result.schema.fields
      .filter((f) => f.type?.typeId === 7 || /^Decimal/i.test(String(f.type)))
      .map((f) => [f.name, f.type?.scale ?? 0])
  );

  return result.toArray().map((row) => {
    const o = row.toJSON();
    for (const k of Object.keys(o)) {
      let val = o[k];
      if (typeof val === 'bigint') val = Number(val);
      if (val != null && decimalScale.has(k) && typeof val === 'object' && 'length' in val) {
        val = decimalToNumber(val, decimalScale.get(k));
      }
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
