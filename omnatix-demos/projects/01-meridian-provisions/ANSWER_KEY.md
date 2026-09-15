# Meridian Provisions Co. - demo answer key

Generated 2026-09-15 from seed 20260915. Period 2024-09-01 to 2026-08-31.
Trailing twelve months (TTM) = 2025-09-01 to 2026-08-31.

**Do not ship this file with the demo.** It is the script for the reveal.

## The headline that makes them lean in

| | TTM | Prior year | Change |
|---|---|---|---|
| Revenue | $72,975,535 | $65,231,031 | 11.9% |
| Gross profit | $19,149,995 | $18,403,842 | 4.1% |
| Gross margin | 26.2% | 28.2% | -2.0 pts |

Open with this. Revenue is up double digits, gross profit is flat. Ask the room why. Nobody
in the room knows. The next three findings are the answer.

## Finding 1 - the bulk water range is sold at a loss

Cascade Springs (four SKUs, 12x1.5L through 6x5L) is a top revenue line and looks fine on
gross margin. It is heavy, low value density, and moves almost entirely through Wholesale
accounts that earn a volume rebate.

| Measure | TTM |
|---|---|
| Revenue | $3,155,782 |
| Gross profit | $407,697 (12.9%) |
| Allocated freight | $661,931 |
| Allocated rebates | $376,073 |
| **Net contribution** | **-$630,307** |

Reveal with: margin waterfall, gross profit then freight then rebate, ending below zero.
Freight must be allocated to the line by weight share of the order. That allocation is the
whole trick and it is why this is invisible in their current reporting.

## Finding 2 - the quarterly laundry promotion destroys value

Brightwash Powder 2kg runs Buy 2 Get 1 Free four times a year. Effective discount 33.3%
against a gross margin under 27%. Volume roughly triples, then collapses to ~45% of baseline
for four weeks afterwards because customers pantry-load.

| | Units | Revenue | Gross profit | GP per unit |
|---|---|---|---|---|
| On promotion | 27,009 | $515,086 | -$54,804 | -$2.03 |
| Off promotion | 22,624 | $581,158 | $103,792 | $4.59 |

Gross profit forgone on promoted units, valued at the off-promotion rate:
**$178,712**

Reveal with: weekly units and GP for this SKU, promo windows shaded. The shape tells the
story before anyone reads a number. Then show the four-week trough after every window.

## Finding 3 - discount creep on the largest account

The Summit Cash & Carry group is the biggest customer. Nobody ever reset their discount, so
it ratcheted from 8% to roughly 15.5% over two years while revenue kept growing.

| Measure | TTM |
|---|---|
| Revenue | $6,571,238 (9.0% of company) |
| Revenue forgone vs holding 8% | **$450,963** |

Reveal with: average realised discount by month for this customer against all other Wholesale
accounts. One line climbs, the other is flat.

## Finding 4 - weekend stock-outs in the growth channel

Replenishment to WH-01 runs Monday to Wednesday. Three Modern Trade hero SKUs
(Golden Acre Maize Meal 10kg, Meadowvale Full Cream Milk 6x1L, Softleaf Toilet Tissue 9pk x6) hit zero on hand on Thursdays in
about 35% of weeks and cannot be supplied Friday or Saturday.

| Measure | Full period |
|---|---|
| Units not supplied | 8,058 |
| Estimated revenue forgone | **$145,007** |

This one is invisible in any sales report because you cannot see sales that did not happen.
It only appears when you join the Thursday inventory snapshot to expected demand. Say that
out loud in the demo - it is the single best argument for owning the whole pipeline.

## Finding 5 - dead stock

The Halo Shine aerosol range was discontinued and has not sold in over 180 days.
8 SKUs still sitting in WH-02, valued at cost: **$44,001**.

Working capital, not P&L. Good closing item because the fix is immediate.

## Data quality issues planted for the silver layer

1. `orders.order_date` mixes ISO (`2025-03-14`) and `DD/MM/YYYY` formats
2. Leading and trailing whitespace on `customers.customer_name` and `products.category`
3. `customers.channel` casing is inconsistent (Modern Trade / MODERN TRADE / modern trade)
4. ~0.5% exact duplicate rows in `order_lines`
5. ~3% of `products.unit_cost` are blank and need a category fallback
6. Large numbers in `order_lines.line_revenue` and `cost_allocations.rebate_amount` are
   sometimes quoted with thousand separators
7. Returns arrive as negative quantities - they are real, do not filter them out
8. ~140 order lines reference SKUs absent from the product master (referential integrity test)
