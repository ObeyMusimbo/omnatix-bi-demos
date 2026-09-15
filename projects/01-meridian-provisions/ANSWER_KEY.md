# Meridian Provisions Co. demo answer key

Derived from `meridian.duckdb` after `dbt build`. Every figure here is what the dashboard
will show, because it is read from the same gold models the dashboard reads.

Data covers 2024-09-02 to 2026-08-31. TTM means the twelve months to 2026-08-31.
Cancelled orders are excluded throughout; returns are included as negative quantities.

**Do not ship this file with the demo.** It is the script for the reveal.

## The headline that makes them lean in

| | TTM | Prior year | Change |
|---|---|---|---|
| Revenue | R640,935,182 | R572,909,808 | +11.9% |
| Gross profit | R168,057,174 | R161,497,166 | **+4.1%** |
| Gross margin | 26.2% | 28.2% | -2.0 pts |
| Net contribution | R107,739,047 | R113,292,739 | -4.9% |

Open with this and stop talking. Revenue up 11.9%, gross profit up 4.1%.
Ask the room why. Nobody will know.

Had margin merely held at last year's 28.2%, gross profit would have been
R180,672,793. The gap to explain is **R12,615,619**.

### Bridging the gap

Close the demo on this table, not on the individual findings. It is the difference between
showing a client five charts and telling them why their profit is flat.

Read straight from `mart_gold.mart_gp_bridge`, which is also what the dashboard draws, so
the two can never disagree.

| Driver | Gross profit effect | Share of gap | Finding |
|---|---|---|---|
| _Gross profit at last year's margin_ | _R180,672,793_ | | |
| Promotion sold below cost | -R3,659,274 | 29.0% | 2 |
| Discount creep on the largest account | -R4,805,686 | 38.1% | 3 |
| Bulk water taking share at a low margin | -R2,046,619 | 16.2% | 1 |
| Other discount drift and mix | -R2,104,041 | 16.7% |  |
| **Actual gross profit** | **R168,057,174** | **7.5% below** | |

Note the bulk water line carefully. That range did not lose gross profit, its gross profit
is positive. It dragged the blend down by growing from 1.9% to
4.3% of revenue at 12.9% margin against a book average of
26.2%. Finding 1 then shows that once freight and rebates are allocated, that
growth was actively destroying value rather than merely diluting it.

## Finding 1: The bulk water range is sold at a loss

Cascade Springs is a top revenue line at 12.9% gross margin, which looks unremarkable.
It is heavy, low value density (R6.45 of revenue per kilogram shipped), and moves
mostly through Wholesale accounts that earn a volume rebate.

| Waterfall step | TTM |
|---|---|
| Revenue | R27,651,744 |
| Cost of goods sold | -R24,079,254 |
| **Gross profit** | **R3,572,490** (12.9%) |
| Allocated freight | -R5,887,585 |
| Allocated handling | -R139,940 |
| Allocated customer rebate | -R1,394,368 |
| **Net contribution** | **-R3,849,403** (-13.9%) |

Prior year for contrast: R10,963,112 revenue, -R1,237,324 contribution. The
range grew into the loss.

Freight is allocated to the line by its share of the order's total weight; rebate by its share
of the order's revenue. Those two allocation rules are the whole trick, and they are why this
is invisible in Meridian's current reporting, the costs sit at order level in the finance
export and never reach a product report.

Brands flagged `is_margin_trap` (positive gross profit, negative contribution) this period:

| Brand | Revenue | Contribution |
|---|---|---|
| Cascade Springs | R27,651,744 | -R3,849,403 |
| Sunveld | R43,560,633 | -R342,015 |

## Finding 2: The quarterly laundry promotion destroys value

Brightwash Powder 2kg runs Buy 2 Get 1 Free 8 times over the window at a planned
33.3% discount, against a gross margin under 27%. Volume roughly triples, then
collapses for four weeks afterwards because customers pantry-load.

| Phase | Units | Revenue | Gross profit | GP per unit | Volume vs baseline |
|---|---|---|---|---|---|
| Baseline | 32,192 | R7,524,147 | R1,410,887 | R43.83 | 100% |
| On promotion | 52,383 | R8,995,844 | -R951,688 | -R18.17 | 332% |
| Post-promotion (4 weeks) | 9,515 | R2,214,846 | R407,948 | R42.87 | 45% |

Gross profit forgone on promoted units, valued at the baseline rate:
**R3,247,490**.

Promoted units carry a **negative** gross profit per unit. Every case sold on deal costs money,
and the four weeks after each window sell at roughly
45% of baseline, so the volume was never incremental, it was borrowed from the following month.

Reveal with weekly units and GP for this SKU, promo windows shaded. The shape tells the story
before anyone reads a number.

## Finding 3: Discount creep on the largest account

| Measure | TTM |
|---|---|
| Share of company revenue | 7.9% |
| Discount at the start of the window | 8.1% |
| Discount now | 15.7% |
| Creep | **+7.6 percentage points** |
| Revenue forgone vs holding the opening rate | **R4,805,686** |

Nobody ever reset it. Revenue kept growing, so nobody looked.

For contrast, the same measure across the largest groups:

| Customer group | Revenue forgone | Creep |
|---|---|---|
| Summit Cash & Carry | R4,805,686 | +7.6 pts |
| Apex Depot | R2,483,770 | +3.4 pts |
| Ironstone Wholesale | R1,754,863 | +3.2 pts |
| Karoo Supply Co | R1,451,649 | +3.5 pts |

Reveal with realised discount by month for this group against the channel average excluding
them. One line climbs, the other is flat.

## Finding 4: Weekend stock-outs in the growth channel

Replenishment into the Gauteng DC runs Monday to Wednesday. Three Modern Trade hero lines hit
zero on hand on Thursdays in up to 35% of weeks and cannot be supplied Friday or
Saturday.

| SKU | Units not supplied | Revenue forgone |
|---|---|---|
| Softleaf Toilet Tissue 9pk x6 | 2,486 | R661,554 |
| Sunveld Maize Meal 10kg | 2,222 | R208,602 |
| Meadowvale Full Cream Milk 6x1L | 2,340 | R204,790 |
| **Total** | **7,049** | **R1,074,945** |

Gross profit forgone: R215,794.

This one is invisible in any sales report because you cannot see sales that did not happen. It
only appears by joining the Thursday inventory snapshot to the same SKU's normal Friday and
Saturday demand in weeks when stock was available. Say that out loud in the demo, it is the
single best argument for owning the whole pipeline rather than buying a chart tool.

## Finding 5: Dead stock

The Halo Shine aerosol range was discontinued and has not sold in
196 days. 8 SKUs across 24 stock rows.

| Measure | Value |
|---|---|
| Dead stock at cost | **R401,258** |
| Total stock on hand at cost | R18,404,826 |
| Dead as a share of stock | 2.2% |

Working capital rather than P&L, which makes it a good closing item, the fix is immediate and
needs no analysis to act on.

## Data quality issues resolved in the silver layer

These are planted on purpose. Walk a technical buyer through them; it is the difference between
a dashboard and a data platform.

1. `orders.order_date` mixes ISO and `DD/MM/YYYY`, 17,083 of 57,334 rows
2. Leading and trailing whitespace on customer names and product categories
3. `customers.channel` arrives in 11 spellings of 4 channels
4. 1,441 duplicate order lines, and the pairs are **not** byte-identical, they differ only in
   number formatting, so money must be cast before the rows are deduplicated
5. 7 products with a blank standard cost, imputed from the category's cost-to-list ratio
6. 27,674 revenue values written with thousand separators
7. 4,040 return lines arriving as negative quantities, kept rather than filtered
8. 140 order lines quoting SKUs absent from the product master, kept, flagged, and covered by
   a deliberately warning test rather than silently dropped
9. 1,117 cancelled orders, flagged and excluded from revenue
