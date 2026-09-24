"""
Export the gold layer to Parquet for the browser.

The dashboard is a static site: DuckDB-WASM loads these files over HTTP and queries them
client-side, so there is no server and no database to host. Only gold is exported, the
browser has no business seeing bronze or silver, and the marts are small enough that the
whole dashboard is a few hundred kilobytes.

Run after `dbt build`:
    ../../.venv/Scripts/python.exe generator/export_parquet.py
"""

from datetime import datetime, timezone
from pathlib import Path
import json
import duckdb

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parent
DB = PROJECT / "meridian.duckdb"
OUT = PROJECT / "dashboard" / "data"

# Everything the dashboard or a grounded chat needs. Deliberately not fct_sales_line:
# 288k rows would dominate the payload and nothing on the page needs line grain.
TABLES = [
    "mart_gp_bridge",
    "mart_margin_waterfall",
    "mart_promo_performance",
    "mart_discount_trend",
    "mart_stockout_impact",
    "mart_dead_stock",
    "agg_sales_monthly",
    "agg_product_month",
    "dim_product",
    "dim_customer",
]

OUT.mkdir(parents=True, exist_ok=True)
con = duckdb.connect(str(DB), read_only=True)

total = 0
manifest = []
for t in TABLES:
    dest = OUT / f"{t}.parquet"
    con.execute(
        f"copy (select * from main_gold.{t}) to '{dest.as_posix()}' "
        "(format parquet, compression zstd)"
    )
    rows = con.execute(f"select count(*) from main_gold.{t}").fetchone()[0]
    size = dest.stat().st_size
    total += size
    manifest.append((t, rows, size))
    print(f"  {t:<26} {rows:>8,} rows   {size / 1024:>8.1f} KB")

print(f"\n  {len(TABLES)} files, {total / 1024:.0f} KB total -> {OUT}")
if total > 5 * 1024 * 1024:
    print("  WARNING: over 5 MB. Trim a table or pre-aggregate further before shipping.")

# ---------------------------------------------------------------- freshness
#
# The dashboard states how current it is, because a number with no date on it is worth
# very little to whoever has to act on it. Two facts matter and they are different:
# how recent the newest transaction is (source latency, usually someone else's problem),
# and when this pipeline last ran (our problem).

data_from, data_through = con.execute(
    "select min(order_date), max(order_date) from main_gold.fct_sales_line"
).fetchone()
order_rows, line_rows = con.execute(
    "select count(distinct order_id), count(*) from main_gold.fct_sales_line"
).fetchone()

meta = {
    "built_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
    "data_from": data_from.isoformat(),
    "data_through": data_through.isoformat(),
    # Synthetic demo data covers a closed period and never advances, so the dashboard tracks
    # the nightly rebuild rather than counting days since the newest row. A client deployment
    # on live data leaves this out and gets the days-behind alarm.
    "fixed_period": True,
    "orders": order_rows,
    "sales_lines": line_rows,
    "tables": {t: {"rows": r, "bytes": b} for t, r, b in manifest},
    "currency": "ZAR",
    "vat": "excluded",
}

# ---------------------------------------------------------------- summary
#
# The headline and one figure per finding, painted from this file in the first second, before
# the in-browser query engine has downloaded. Every number is read from the same gold column
# the page itself reads for that section, so the strip and the section cannot disagree. The
# page formats them, by the name in "f", with the same functions it uses everywhere else.


def one(sql):
    return con.execute(sql).fetchone()


gap = one("""
    select total_gap_zar,
           (ttm_revenue_zar / prior_revenue_zar - 1) * 100,
           (ttm_gross_profit_zar / prior_gross_profit_zar - 1) * 100
    from main_gold.mart_gp_bridge where step_order = 1
""")
water = one("""
    select any_value(contribution_zar) from main_gold.mart_margin_waterfall
    where brand = 'Cascade Springs' and period_order = 1
""")[0]
promo = dict(con.execute("""
    select promo_phase, sum(gross_profit_zar) / nullif(sum(units), 0)
    from main_gold.mart_promo_performance where product_name like 'Brightwash Powder 2kg%'
    group by 1
""").fetchall())
creep = -one("select effect_zar from main_gold.mart_gp_bridge where finding_ref = '3'")[0]
stockout = one("select sum(lost_revenue_zar) from main_gold.mart_stockout_impact")[0]
dead = one("select sum(dead_stock_value_zar) from main_gold.mart_dead_stock where is_dead_stock")[0]

meta["summary"] = {
    "hero": {
        "kicker": ["Revenue grew ", {"v": gap[1], "f": "signedPct"},
                   ". Gross profit grew ", {"v": gap[2], "f": "signedPct"}, "."],
        "v": gap[0], "f": "Rc",
        "label": "of gross profit did not arrive, despite the revenue that should have carried it",
    },
    "findings": [
        {"n": "01", "id": "water", "title": "The range sold at a loss",
         "v": water, "f": "Rc", "note": "contribution on bottled water, after freight and rebates"},
        {"n": "02", "id": "promo", "title": "The promotion that loses money",
         "v": promo["On promotion"], "f": "R",
         "note": f"gross profit per case on deal, against R{promo['Baseline']:.0f} off it"},
        {"n": "03", "id": "discount", "title": "The discount nobody reset",
         "v": creep, "f": "Rc", "note": "revenue forgone in twelve months on one account"},
        {"n": "04", "id": "stock", "title": "Sales that never happened",
         "v": stockout, "f": "Rc", "note": "revenue lost to weekend stock-outs"},
        {"n": "05", "id": "dead", "title": "Stock nobody is buying",
         "v": dead, "f": "Rc", "note": "of discontinued stock sitting at cost"},
    ],
    # Warehouse is the one cut the stock marts carry. The bridge, the waterfall, the promotion
    # and the discount marts are company-wide, and say so when the filter is set.
    "filter": {
        "param": "dc", "label": "Warehouse", "all": "All warehouses",
        "options": [{"value": c, "label": n.replace("Meridian ", "")} for c, n in con.execute(
            "select distinct warehouse_code, warehouse_name from main_gold.mart_dead_stock "
            "order by 1").fetchall()],
    },
}

(OUT / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
print(f"  data through {meta['data_through']}, built {meta['built_at']}")
