# Lumen Health in Power BI Desktop

The same warehouse, the same tested numbers, a different front end. The web dashboard and this
model read the identical gold layer; only the shape of what gets exported differs.

The point of offering both is not that Power BI is better or worse. It is that a prospect who
already owns Microsoft licensing can ask "can you deliver this in Power BI?" and the answer is
a file rather than a proposal.

## What is different from the web export, and why

|  | Web dashboard | Power BI |
|---|---|---|
| Grain | marts, pre-aggregated to exactly what each page draws | the star: row level facts and dimensions |
| Compression | zstd | snappy |
| Integer width | 128 bit sums are fine | cast down to 64 bit |
| Committed to git | yes, about 1.5 MB | no |

**Grain.** A web page draws a fixed chart, so the mart can be aggregated. A Power BI user
slices for themselves, which is the whole reason they wanted Power BI, so they need the rows.

**Compression.** Power Query's Parquet reader has been reliable with snappy for years and
support for newer codecs has varied by Desktop version. If the import works, this was cheap
insurance. If it ever fails, this is the first thing to suspect.

**Integer width.** DuckDB's `sum()` over an integer returns a 128 bit integer, which Parquet
can only store as a 38 digit decimal. Power Query either refuses it or quietly turns it into a
float. There are 27 such columns in Lumen's gold layer, every one a count of something small,
so the exporter casts them to 64 bit.

**Not committed.** A `.pbix` stores its own copy of the data, so the workbook opens and demos
standalone. These files are only needed to refresh it, and regenerating them takes ten seconds.

## The quick way: open the template

`Lumen Health Network.pbit` builds the whole model for you. Double click it, or File > Open in
Power BI Desktop.

It will prompt for **DataFolder** and default to the right path on this machine. Accept it and
Power BI loads the Parquet, creates the seven tables, draws all ten relationships, adds the 28
measures with their format strings, and opens on a five page report.

The data folder has to exist first, and it is not committed, so on a fresh clone run the
export before opening the template:

```bash
.venv/Scripts/python.exe scripts/export_powerbi.py --project 04-lumen-health
```

Regenerate the template itself, after changing measures or pages, with:

```bash
.venv/Scripts/python.exe scripts/build_pbit.py --project 04-lumen-health
```

The pages are written for Power BI rather than copied from the web dashboard, because a report
with pages and cross filtering is a different medium from one scrolling page: **Where the money
went**, **The consulting week**, **Claims nobody worked**, **Patients who never arrived**, and
**Schemes and capacity**.

Save as `.pbix` once it opens and you have a workbook that no longer needs the template.

Everything below is the manual route, and it is also the reference for what the template
actually built, which is worth reading before changing anything.

## Build it by hand

### 1. Export

```bash
.venv/Scripts/python.exe scripts/export_powerbi.py
```

18 tables, about 12 MB, into `powerbi/data/`. It also writes `queries.pq`.

### 2. Create the folder parameter

In Power BI Desktop: **Home → Transform data → Manage Parameters → New**

| | |
|---|---|
| Name | `DataFolder` |
| Type | Text |
| Current Value | the full path to `projects/04-lumen-health/powerbi/data` |

Every query references this, so moving the repository means changing one value rather than
eighteen.

### 3. Load the tables

Open `queries.pq`. For each block: **Home → Get Data → Blank Query → Advanced Editor**, paste,
and rename the query to the table name in the comment.

Import these seven for the star:

```
dim_date   dim_clinic   dim_practitioner   dim_scheme
fct_appointment   fct_session   fct_capacity_hour
```

The eleven `mart_*` tables are optional. Import one only if you want a page that reproduces a
specific web visual exactly. They are pre-aggregated, so they do not respond to slicers, and
mixing them with the star on one page is how a user ends up comparing two numbers that were
never meant to line up.

### 4. Relationships

All one-to-many, single direction, from the dimension to the fact.

| From | To |
|---|---|
| `dim_date[date_day]` | `fct_appointment[scheduled_date]` |
| `dim_date[date_day]` | `fct_session[session_date]` |
| `dim_date[date_day]` | `fct_capacity_hour[session_date]` |
| `dim_clinic[clinic_code]` | `fct_appointment[clinic_code]`, `fct_session[clinic_code]`, `fct_capacity_hour[clinic_code]` |
| `dim_practitioner[practitioner_id]` | `fct_appointment[practitioner_id]`, `fct_session[practitioner_id]`, `fct_capacity_hour[practitioner_id]` |
| `dim_scheme[scheme_code]` | `fct_appointment[scheme_code]` |

**Do not relate the fact tables to each other.** `fct_appointment` and `fct_capacity_hour` both
carry `session_id` and it is tempting to join them. Do not. They already share three
dimensions, so adding a fact to fact relationship creates two paths between the same tables and
Power BI will either refuse it or pick one silently. Filter both through the dimensions
instead, which is what a star is for.

### 5. Model settings that are easy to skip and annoying to debug later

- **Mark `dim_date` as a date table** on `date_day`. Table tools → Mark as date table. Without
  it, time intelligence silently misbehaves.
- **Sort `dim_date[day_short]` by `dim_date[day_of_week]`**, or Monday sorts after Friday
  because F comes before M.
- **Sort `agg_monthly[month_label]` by `month_start`** for the same reason, if you import it.
- **Hide the key columns** on the fact tables once relationships exist: `clinic_code`,
  `practitioner_id`, `scheme_code`, `scheduled_date`, `session_date`. A user should slice on
  the dimension, not on a code buried in a fact.
- **Set the locale to English (South Africa)** under Options → Regional settings, so dates read
  day first and thousands separate the way the audience expects.

### 6. Measures

Paste from `measures.dax`. Create a blank table called `_Measures` first (Home → Enter Data)
and put them all there, so they live in one place rather than scattered across three facts.

Format strings are given per measure and they matter. A rand figure shown without its unit is
the easiest way to have a room stop trusting a page.

## Check it before you show it

Build a card for each of these and confirm the number. If one is out, the model is wrong and
it is far better to find out now.

| Measure | Expected |
|---|---|
| Billed | R160,784,568 |
| Scheme Paid | R127,089,714 |
| Patient Paid | R16,269,463 |
| Scheme Shortfall | R11,041,079 |
| Appointments | 232,558 |
| Attended | 187,464 |
| No Shows | 36,922 |
| No Show % | 15.9% |
| Slots Offered | 354,570 |
| Fill % | 65.6% |
| Empty % | 44.8% |
| Clinician Cost | R69,219,684 |
| Empty Chair Cost | R32,527,173 |
| Ever Rejected | 21,397 |
| Recovered Claims | 4,118 |

## One number that will not match the web, and should not

The web page reports total leakage of **R17,417,434.82**. This model will report
**R17,425,391.32**, which is **R7,956.50** higher.

That gap is real and it is the right answer in both places. Ninety five payment rows in the
source quote an appointment that does not exist in the appointment file, and they carry
R7,956.50 of receipts between them: the difference to the cent. The web bridge is built from
the payment ledger, so it counts that money. The star is built from `fct_appointment`, so it
cannot: there is no visit to hang those rows on.

That the difference reconciles exactly to a known defect, rather than being a rounding drift
nobody can account for, is the point. If it is ever some other number, something is wrong.

Do not reconcile it away. It is on the data quality panel of the web dashboard for exactly
this reason, and being able to explain a R7,956 difference between two views of the same
business is a better demonstration of the pipeline than having them agree by accident.

## Refreshing

Whenever the warehouse rebuilds:

```bash
.venv/Scripts/python.exe scripts/export_powerbi.py
```

Then **Home → Refresh** in Power BI. The Parquet filenames and columns do not change, so the
model, the relationships and the measures all survive.

## What this does not do

It does not publish anywhere. Power BI Desktop is free and opening a `.pbix` on a prospect's
laptop costs nothing. Publishing to the Power BI Service and sharing with other people needs a
per user licence, and that is a decision to make when somebody is paying, not before.
