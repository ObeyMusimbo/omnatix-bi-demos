# Omnatix, BI demo suite

Four self-contained analytics demos, each a different industry, a different core business
problem, and a deliberately different visual identity. Built on a zero-cost stack so they can
be shown to investors and prospects before any licence is bought.

All four are South African businesses. **Money is rand, excluding VAT**, and money columns carry
a `_zar` suffix from the silver layer onwards.

```
DuckDB  +  dbt Core  +  DuckDB-WASM  +  GitHub Actions  →  Cloudflare Pages
```

Each project follows the same shape, so a fifth one is a new folder, not a new platform:

```
projects/NN-name/
  generator/generate.js     synthetic source data, deterministic from a seed
  data/raw/                 the CSV "drops", the bronze landing zone
  dbt/                      bronze → silver → gold → semantic
  dashboard/                static site: HTML, CSS, JS modules and Parquet
  ANSWER_KEY.md             the planted findings (never ship this)

site/                       the Omnatix landing page
scripts/build_site.py       assembles everything into dist/
scripts/refresh.py          rebuild after new data lands
```

All four publish from one Cloudflare Pages project, each under its own path, with the landing
page at the root:

```
demos.omnatix.co.za              all four, with the headline finding on each card
demos.omnatix.co.za/meridian     FMCG distribution
demos.omnatix.co.za/kestrel      freight and fleet
demos.omnatix.co.za/sable-finch  microfinance
demos.omnatix.co.za/lumen        clinic group
```

Adding a demo is one entry in the `PROJECTS` list in `scripts/build_site.py`.

## The four projects

| # | Client | Industry | Core problem | Buyer |
|---|---|---|---|---|
| 01 | **Meridian Provisions Co.** | FMCG distribution | Profit leakage, "revenue is up, profit isn't" | CFO / Commercial Director |
| 02 | **Kestrel Logistics** | Freight & fleet | Cost-to-serve, "which routes lose me money?" | COO |
| 03 | **Sable & Finch Credit** | Microfinance | Credit risk, "we find out about bad loans too late" | CRO / Board |
| 04 | **Lumen Health Network** | Clinic group | Capacity & cash, "we're full but not profitable" | Hospital MD / Finance |

### At a glance

**Meridian Provisions Co.** is a Gauteng-based FMCG distributor: R657m turnover, 485 trade customers across Modern Trade,
General Trade, Wholesale and HoReCa, 131 SKUs, three DCs (Gauteng, KwaZulu-Natal, Western Cape),
24 months of data to 2026-08-31.

The opening line of the demo: **revenue up 11.9%, gross profit up 4.1%.** Five planted findings
explain the gap. The reveal script is in `projects/01-meridian-provisions/ANSWER_KEY.md`.

**Kestrel Logistics** is a road freight operator: R243m revenue, 124 vehicles, 12.4m kilometres
a year, three hubs, 25 line-haul corridors and 4 metro distribution runs.

It opens on the map. **23.9% of every kilometre carried nothing**, and twelve corridors are
priced as though the truck comes home loaded when it does not. The close: **R19.7m identified
against R27.6m earned**, which is 71.5% of everything the business currently makes, every step
measured over the same twelve months.

**Sable & Finch Credit** is an unsecured lender: R602m disbursed over 19,880 loans through nine
branches, 24 months to 2026-08-31. 16.0% of loans ever reach 90 days past due and 7.7% are
written off, which is a normal looking book until it is cut by cohort.

It opens on vintage curves, because a portfolio-at-risk snapshot cannot tell you whether the
business is writing better or worse loans than it was a year ago. The close: **net credit loss
R37.5m, of which R10.3m is above what the same money would have lost at the clean book rate.**
Reported alongside it and never added to it: **R34.8m outstanding on 3,201 agreements written
outside the affordability floor**, which is a regulatory exposure rather than an expected loss.

**Lumen Health Network** is a private primary care group: six sites, 32 practitioners, 232,558
booked appointments and R160.8m billed over 24 months to 2026-08-31.

It opens on a number the group cannot explain: it billed R160.8m for care it delivered and
collected R143.4m. The close: **R17.4m never collected, 10.8% of everything invoiced**, every
rand of it attributed to one of three people who could do something about it. Reported
separately and never summed with it: R31.1m of clinician time in chairs nobody sat in, because
cost incurred and revenue foregone are different quantities.

## Visual identity per project

Deliberately distinct. The point is to show range, not a template.

All four set type in **Verdana**, which is a system font on Windows and macOS. That is a
deliberate trade: the four themes used to be separated partly by typeface, and now they are
separated by colour, density and layout alone. In exchange the pages fetch no webfonts at all,
so they render immediately, never flash, and make one fewer external request.

### 01, Meridian Provisions · theme "Ledger"

A printed financial report. Warm paper, hairline rules, dense tabular figures, restrained colour
used only where it carries meaning.

| Token | Light | Dark |
|---|---|---|
| Page | `#FBF9F4` | `#16140F` |
| Ink | `#1C1917` | `#F5F1E8` |
| Series 1, oxblood | `#B5502C` | `#CB7645` |
| Series 2, blue | `#1A5FB4` | `#5A90D4` |
| Series 3, ochre | `#96690A` | `#AE8A2A` |
| Series 4, teal | `#0A7D5E` | `#1F9C79` |
| Rule | `#E5DFD3` | `#332E25` |
| Type | Verdana throughout · tabular figures in tables only |

The series colours are **validated, not chosen**, lightness band, chroma floor, colour-vision
separation, normal-vision separation and surface contrast, checked independently per mode. Dark
mode carries its own darker steps rather than a flip of the light ones. Re-validate before
substituting any of them; the ordering matters too, because adjacency is what gets tested.

Signature visual: the margin waterfall. Gross profit, then freight, then rebate, ending below zero.

### 02, Kestrel Logistics · theme "Control Tower"

A live operations screen. Dark, map-first, monospace numerics, status as colour.

| Token | Value |
|---|---|
| Page | `#0B0F14` |
| Panel | `#121820` |
| Land | `#151D26` |
| Series 1 to 4 | `#1C9DB8` cyan · `#A88818` gold · `#D65F92` rose · `#8478DE` violet |
| Status | `#34D399` ok · `#FBBF24` warn · `#F87171` breach |
| Type | Verdana throughout · tabular figures in tables and axis ticks |

Series colours validated against this exact surface, worst adjacent pair clearing delta E 11.9.
Status colours are reserved and always ship with a label, never colour alone.

Signature visual: the network map. Twelve corridors that look profitable one way and lose money
as a round trip, drawn from coordinates in the data rather than from map tiles, so the page
still fetches nothing from anyone.

### 03, Sable & Finch Credit · theme "Institutional"

A credit committee pack. Bone paper, navy ink, tight leading, dense tables, no decoration. It
should look like it expects to be checked, because somebody is going to have to defend it line
by line to a board or to the National Credit Regulator.

| Token | Value |
|---|---|
| Page | `#F7F6F3` · panel `#FFFFFF` |
| Navy | `#1A3A5C` · ink `#14212E` |
| Series 1 to 4 | `#1F6392` navy blue · `#B04F14` rust · `#77419A` plum · `#3C7C33` moss |
| Cohort ramp | `#94ADC8` `#7797B6` `#5A7CA2` `#405F87` `#2A4769` `#16354F` |
| Risk heat | `#3C7C33` current · `#7D8A22` 1-30 · `#B0821A` 31-60 · `#B35A16` 61-90 · `#A3271F` 90+ |
| Type | Verdana throughout · tight leading · heavy table use |

Three separate colour jobs and they are not interchangeable. The categorical series are
validated as a set, worst adjacent pair clearing delta E 17.9. Disbursement month is an ordered
dimension, so cohorts take a single hue running light to dark rather than unrelated colours, and
it is validated as an ordinal ramp. Arrears buckets are semantic heat, which is the one case
where a multi-hue sequential scale is right, and it always ships with a scale legend.

Signature visual: vintage curves by disbursement cohort, one branch diverging from the book.

### 04, Lumen Health Network · theme "Clinical"

Calm, white and wide. A briefing for a clinician and a finance director sitting in the same
room, read on a laptop between patients with the blinds open. Nothing dense, nothing rounded
past 6px, nothing that moves.

| Token | Value |
|---|---|
| Page | `#F2F6F7` · panel `#FFFFFF` |
| Ink | `#10222B` · accent `#00919A` |
| Series 1 to 4 | `#00919A` teal · `#C0521C` rust · `#6B46C6` violet · `#57802C` moss |
| Fill ramp | `#83BEC6` `#62AAB6` `#4395A3` `#277D8E` `#126474` `#004C59` |
| Wait ramp | `#E3A882` `#D48E63` `#C17447` `#A95A2D` `#8E4218` `#732706` |
| Status | `#1C7A44` good · `#9A6200` watch · `#B3261E` poor |
| Type | Verdana · 16px base · large tiles |

Four colour jobs. The categorical set clears delta E 25.4 in normal vision and 8.3 under
tritanopia. Both ramps are validated as ordinal: monotone lightness, every adjacent gap above
0.06, and a light end clearing 2:1 against white, which is why neither starts near white. Slot
fill and waiting time get separate hues on purpose, because they are different quantities and a
shared ramp would invite reading them as one.

Signature visual: the consulting week as a grid of weekday against hour, built as a real table
so it keeps its headers and reads to a screen reader. Monday at eight is 17% full, Friday at
four is 92% full with a 33 minute wait.

## Demo craft rules

Applied to every project in this repo.

1. **Plant the findings.** Each dataset contains deliberate, quantified anomalies. The dashboard
   discovers them live in front of the prospect. A dashboard that only displays numbers is
   forgettable; one that finds a problem sells itself.
2. **Open with the gap, not the tour.** Lead with a headline nobody in the room can explain.
   Revenue up 11.9%, gross profit up 4.1%. Then answer it.
3. **Every screen answers "so what → now what."** The number, what it means, the recommended
   action and its value.
4. **Show the pipeline for investors.** Two minutes on the dbt lineage graph and the data tests.
   That is what separates this from a freelancer with a spreadsheet.
5. **Never demo with real client data.** Not even anonymised.
6. **The AI chat always shows its SQL.** Buyers trust what they can audit.

## Status

| Project | Data | Bronze | Silver | Gold | Dashboard | Chat |
|---|---|---|---|---|---|---|
| 01 Meridian | ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ |
| 02 Kestrel | ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ |
| 03 Sable & Finch | ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ |
| 04 Lumen | ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ |

| Project | Models | Tests | Parquet shipped |
|---|---|---|---|
| 01 Meridian | 31 | 97 | 1.2 MB |
| 02 Kestrel | 35 | 60 | 228 KB |
| 03 Sable & Finch | 32 | 158 | 140 KB |
| 04 Lumen | 36 | 125 | 84 KB |

Each project carries at least one warning by design rather than a failure, because the defect it
catches is meant to be in the data: an orphan reference, a missing diagnosis code, a payment
against a visit that is not in the file. A dashboard that deletes what it cannot reconcile is
how a business ends up believing a number that is several per cent short.

A full build of any one project takes under 30 seconds.

The dashboard is a static site: gold tables export to Parquet and DuckDB-WASM runs the SQL in
the browser. No server, no database to host, and the whole four-demo site is under 2 MB.

See [SETUP.md](SETUP.md) to install and run it, [REFRESH.md](REFRESH.md) for what happens when
new data arrives and how the dashboard reports its own freshness, and [DEPLOY.md](DEPLOY.md) to
put it on a live URL.

## The same warehouse in Power BI

Every project also exports a Power BI model, because the objection this whole suite answers is
"do we need Microsoft for this?" and the strongest answer is not "no". It is: the pipeline is
the product, the front end is a choice, and here is the identical analysis in both.

```bash
.venv/Scripts/python.exe scripts/export_powerbi.py --all
```

That writes the row level star per project, snappy compressed, with 128 bit sums cast down,
because Power Query reads Parquet differently from DuckDB-WASM. Each project then has a
`powerbi/` folder with the Power Query to paste, the relationships to build, a DAX file with a
format string per measure, and a table of figures to check before showing anyone.

| Project | Guide | The modelling decision that matters |
|---|---|---|
| 01 Meridian | [powerbi/README.md](projects/01-meridian-provisions/powerbi/README.md) | Margin change in points, never a percentage of a percentage |
| 02 Kestrel | [powerbi/README.md](projects/02-kestrel-logistics/powerbi/README.md) | Three facts at three grains, and never joining fact to fact |
| 03 Sable & Finch | [powerbi/README.md](projects/03-sable-finch-credit/powerbi/README.md) | Cohort month and snapshot month as two date roles |
| 04 Lumen | [powerbi/README.md](projects/04-lumen-health/powerbi/README.md) | Costing empty capacity at the rate of the session it sat in |

Power BI Desktop is free and opening a `.pbix` on a prospect's laptop costs nothing. Publishing
and sharing needs a per user licence, which is a decision for when somebody is paying.

The exported Parquet is not committed. A `.pbix` holds its own copy of the data, so a workbook
demos standalone, and regenerating the files takes seconds.
