# Sable & Finch Credit in Power BI Desktop

Read [the Lumen guide](../../04-lumen-health/powerbi/README.md) first if you have not: it
explains why this export differs from the web one, and those reasons apply identically here.

Sable is the smallest export of the four, 3.6 MB, and the one most easily modelled wrongly.
Two decisions carry the whole thing, and both are below.

## The two things to get right

### A balance is a snapshot

`fct_loan_month` has one row per loan per month it was on the book. Outstanding balance is a
**stock**, not a flow. Sum it across a quarter and you report three times the book that exists.

Every balance measure in `measures.dax` pins itself with `LASTDATE`. If you write your own,
do the same. The fastest way to check: put `Gross Book` on a card, drag a year onto the page,
and confirm the number does not multiply.

### Cohort month and snapshot month are different questions

This is the model, and it is the demo.

- **Snapshot month** asks *which observations*. It is how the board's arrears report is built.
- **Cohort month** asks *which loans*. It is how a vintage curve is built.

Portfolio at risk is flat while every cohort written this year performs worse at month six than
the cohorts written a year ago. Both are true. They are different questions, and a model with
one date table cannot ask the second one.

So Sable needs a **role playing date dimension**: two date tables, one per role.

## Build it

### 1. Export

```bash
.venv/Scripts/python.exe scripts/export_powerbi.py --project 03-sable-finch-credit
```

### 2. Parameter and queries

Create a text parameter `DataFolder` pointing at `projects/03-sable-finch-credit/powerbi/data`,
then paste each block from `queries.pq` into a blank query.

Import these six:

```
dim_date   dim_branch   dim_agent   dim_client
dim_loan   fct_loan_month
```

Note `dim_date` here is at **month** grain, 24 rows, not daily. The reporting cycle is monthly
and the arrears file is a month end position, so a daily calendar would add nothing but rows.

### 3. Add the cohort date table

In Power Query: right click `dim_date` → **Reference** → rename it `dim_cohort`. Then rename
its columns with a Cohort prefix so nobody confuses the two on a report canvas: `Cohort Month
Start`, `Cohort Label`, and so on.

It is a reference, not a duplicate, so it refreshes from the same file.

### 4. Relationships

All one-to-many, single direction, dimension to fact.

| From | To | Role |
|---|---|---|
| `dim_date[month_start_date]` | `fct_loan_month[month_start_date]` | snapshot month |
| `dim_cohort[Cohort Month Start]` | `dim_loan[cohort_month]` | month the loan was written |
| `dim_loan[loan_id]` | `fct_loan_month[loan_id]` | |
| `dim_branch[branch_code]` | `dim_loan[branch_code]` | |
| `dim_agent[agent_id]` | `dim_loan[agent_id]` | |
| `dim_client[client_ref]` | `dim_loan[client_ref]` | |

`dim_loan` sits in the middle: a fact when you count loans and sum principal, a dimension when
it filters `fct_loan_month`. That is fine and it is why the cohort filter reaches the monthly
panel. Filtering by cohort flows `dim_cohort → dim_loan → fct_loan_month`, which is exactly
what a vintage analysis needs.

**Do not** relate `dim_branch` directly to `fct_loan_month`, even though the fact carries
`branch_code`. It would create a second path to the same rows alongside `dim_branch → dim_loan
→ fct_loan_month`. Hide the column on the fact instead.

### 5. Add the Months on Book table

**Home → Enter Data**, one whole number column called `Month`, values 0 to 24. Name the table
`Months on Book`. Leave it **disconnected**, with no relationships.

`Vintage Bad %` reads the selected value off it. That is how a vintage x axis works: months
since disbursement is not a date, it is an age.

### 6. Model settings

- **Mark `dim_date` as a date table** on `month_start_date`, and `dim_cohort` on its own.
- **Sort `month_short` by `month_num`** on both.
- **Hide** on `fct_loan_month`: `branch_code`, `branch_name`, `agent_id`, `cohort_month`,
  `cohort_label`, `principal_zar`. They are denormalised for the web layer; in Power BI the
  user should reach them through `dim_loan`.
- **Regional settings: English (South Africa).**

### 7. Measures

Paste from `measures.dax`.

## Check it before you show it

| Measure | Expected |
|---|---|
| Loans | 19,880 |
| Disbursed | R602,356,500 |
| Current Balance | R239,515,743 |
| Ever 90 | 3,176 |
| Ever 90 % | 16.0% |
| Written Off % | 7.7% |
| Net Loss | R37,454,692 |
| Loss Rate % | 6.22% |
| Top Ups | 852 |
| Loans Breaching Affordability | 3,511 |
| Reckless Exposure | R34,848,047 |
| Gross Book (last month) | R212,857,051 |
| PAR 90 % (last month) | 4.3% |

If `Gross Book` comes out at R3.6bn you have summed the snapshot across every month. That is
the error this model is most likely to make and the one that looks most plausible on a card.

## The two visuals worth building first

**The vintage curves.** `Months on Book[Month]` on the x axis, `Vintage Bad %` as the value,
`dim_cohort[Cohort Label]` on the legend. Lines stop where the cohort's observation ends rather
than running flat to the right, because the measure returns blank past that point.

**The arrears report beside them.** `dim_date[year_month]` on the x axis, `PAR 90 %` as the
value. Flat, while the chart next to it climbs.

Put them on one page. That contrast is the entire pitch, and it only exists because the two
date roles are separate.

## One number that will not match the web, and should not

The web page reports reckless exposure of R34,848,047 and net credit loss of R37,454,692 as two
figures that are never added together. Do the same here. There is no measure in `measures.dax`
that sums them, deliberately, and if somebody asks for one the answer is that the total would
be wrong in both directions: an expected loss and a balance at legal risk are different
quantities.

## Refreshing

```bash
.venv/Scripts/python.exe scripts/export_powerbi.py --project 03-sable-finch-credit
```

Then **Home → Refresh**.
