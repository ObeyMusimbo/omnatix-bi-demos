# Meridian Provisions in Power BI Desktop

The same warehouse as the web dashboard, reshaped for a user who wants to slice it themselves.
Read [the Lumen guide](../../04-lumen-health/powerbi/README.md) first if you have not: it
explains why the export differs from the web one (row level star, snappy compression, 128 bit
sums cast down) and those reasons apply identically here.

Meridian is the largest of the four: 282,650 order lines and 82,137 inventory snapshots, about
21 MB of Parquet. Still nothing for Power BI, which will compress it to a few MB in memory.

## Build it

### 1. Export

```bash
.venv/Scripts/python.exe scripts/export_powerbi.py --project 01-meridian-provisions
```

### 2. Parameter and queries

Create a text parameter `DataFolder` pointing at `projects/01-meridian-provisions/powerbi/data`,
then paste each block from `queries.pq` into a blank query.

The star is five tables:

```
dim_date   dim_customer   dim_product
fct_sales_line   fct_inventory_snapshot
```

The `agg_*` and `mart_*` tables are optional and pre-aggregated. Import one only to reproduce a
specific web visual exactly; they do not respond to slicers.

### 3. Relationships

All one-to-many, single direction, dimension to fact.

| From | To |
|---|---|
| `dim_date[date_day]` | `fct_sales_line[order_date]` |
| `dim_date[date_day]` | `fct_inventory_snapshot[snapshot_date]` |
| `dim_customer[customer_id]` | `fct_sales_line[customer_id]` |
| `dim_product[sku]` | `fct_sales_line[sku]` |
| `dim_product[sku]` | `fct_inventory_snapshot[sku]` |

**Do not relate the two facts to each other.** They already share `dim_date` and `dim_product`,
which is how a star is supposed to connect them.

`warehouse_code` has no dimension table of its own. Use it straight off the fact as a
degenerate dimension; building a one column lookup for it would add nothing.

### 4. Expect a blank row on dim_product, and leave it there

134 order lines quote a SKU that is not in the product master, carrying **R536,696** of real
revenue. Power BI will show a blank row on the product side of that relationship. That is
correct and it is the point: the pipeline surfaces referential breaks instead of hiding the
money. The web dashboard does the same thing, and its dbt test for it is deliberately set to
warn rather than fail.

Do not switch the relationship to "assume referential integrity" to make it disappear. That
setting tells Power BI to use an inner join, and the R536,696 silently leaves every total.

### 5. Model settings

- **Mark `dim_date` as a date table** on `date_day`. The year on year measures need it.
- **Sort `dim_date[month_short]` by `month_num`** and `day_name` by `day_of_week`.
- **Hide** `customer_id`, `sku`, `order_date`, `snapshot_date` and the denormalised copies on
  the fact (`channel`, `region`, `brand`, `category`, `subcategory`, `product_name`). They are
  on the fact for the web layer's convenience; in Power BI a user should slice the dimension.
- **Regional settings: English (South Africa).**

### 6. Measures

Paste from `measures.dax`.

Two are worth reading before you use them. `Margin Change pts` returns percentage **points**,
not a percentage change of a percentage, because a margin moving 28% to 26% is down two points
and calling that "down 7%" will get you challenged. And `Stock Value` wraps `LASTDATE`, because
a stock balance summed across a quarter is three times the stock that exists.

## Check it before you show it

| Measure | Expected, whole window |
|---|---|
| Revenue | R1,213,844,990 |
| COGS | R884,290,650 |
| Gross Profit | R329,554,340 |
| Gross Margin % | 27.15% |
| Contribution | R221,031,785 |
| Lines | 282,650 |
| Return Lines | 4,040 |
| Lines With Unknown SKU | 134 |
| Revenue With Unknown SKU | R536,696 |

And filtered to the trailing twelve months, which is what the web page reports:

| Measure | Expected |
|---|---|
| Revenue | R640,935,182 |
| Gross Profit | R168,057,174 |
| Margin Gap | about R12,615,619 |

`Margin Gap` will not land on exactly R12,615,619. The web bridge anchors on the prior period's
margin rate computed in SQL over a fixed window; the DAX version recomputes it from whatever is
in filter context. Set the page filter to the twelve months ending 2026-08-31 and it agrees to
rounding. If it is out by more than a few thousand rand, the date filter is the thing to check,
not the measure.

## Refreshing

```bash
.venv/Scripts/python.exe scripts/export_powerbi.py --project 01-meridian-provisions
```

Then **Home → Refresh**. Filenames and columns do not change, so the model survives.
