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

It opens on the map. **23.7% of every kilometre carried nothing**, and twelve corridors are
priced as though the truck comes home loaded when it does not. The close: **R21.9m identified
against R27.6m earned**, which is 79.5% of everything the business currently makes.

## Visual identity per project

Deliberately distinct. The point is to show range, not a template.

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
| Type | Source Serif 4 headings · Inter body · tabular figures in tables only |

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
| Type | Barlow Condensed labels · JetBrains Mono figures · Inter body |

Series colours validated against this exact surface, worst adjacent pair clearing delta E 11.9.
Status colours are reserved and always ship with a label, never colour alone.

Signature visual: the network map. Twelve corridors that look profitable one way and lose money
as a round trip, drawn from coordinates in the data rather than from map tiles, so the page
still fetches nothing from anyone.

### 03, Sable & Finch Credit · theme "Institutional"

A regulator-ready pack. Navy and bone, dense, auditable, no decoration.

| Token | Value |
|---|---|
| Page | `#F7F6F3` |
| Navy | `#1E3A5F` |
| Bone | `#E8E4DC` |
| Risk ramp | `#15803D` → `#CA8A04` → `#B91C1C` for arrears buckets |
| Type | Inter throughout · tight leading · heavy table use |

Signature visual: vintage curves by disbursement cohort, one branch diverging from the book.

### 04, Lumen Health Network · theme "Clinical"

Calm and glanceable, readable from across a ward. WCAG AA on every pairing, large number tiles,
generous whitespace.

| Token | Value |
|---|---|
| Page | `#FFFFFF` |
| Surface | `#F1F5F9` |
| Slate | `#334155` |
| Teal | `#0D9488` |
| Alert | `#DC2626` |
| Type | Inter · 18px base · large tiles |

Signature visual: no-show rate by appointment slot, Monday mornings empty, Thursdays queueing.

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
| 03 Sable & Finch | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 04 Lumen | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

Meridian: 31 models, 97 data tests. Kestrel: 35 models, 57 tests. Each has one warning by
design, the orphan reference test. A full build of either takes under 25 seconds.

The dashboard is a static site: gold tables export to Parquet and DuckDB-WASM runs the SQL in
the browser. No server, no database to host. Meridian ships 1.2 MB of Parquet, Kestrel 268 KB.

See [SETUP.md](SETUP.md) to install and run it, and [REFRESH.md](REFRESH.md) for what happens
when new data arrives and how the dashboard reports its own freshness.
