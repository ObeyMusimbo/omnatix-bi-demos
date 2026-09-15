# Omnatix — BI demo suite

Four self-contained analytics demos, each a different industry, a different core business
problem, and a deliberately different visual identity. Built on a zero-cost stack so they can
be shown to investors and prospects before any licence is bought.

All four are South African businesses. **Money is rand, excluding VAT**, and money columns carry
a `_zar` suffix from the silver layer onwards.

```
DuckDB  +  dbt Core  +  Evidence.dev  +  GitHub Actions  →  Cloudflare Pages
```

Each project follows the same shape, so a fifth one is a new folder, not a new platform:

```
projects/NN-name/
  generator/generate.js     synthetic source data, deterministic from a seed
  data/raw/                 the CSV "drops" — the bronze landing zone
  dbt/                      bronze → silver → gold → semantic
  evidence/                 the dashboard itself
  ANSWER_KEY.md             the planted findings (never ship this)
```

## The four projects

| # | Client | Industry | Core problem | Buyer |
|---|---|---|---|---|
| 01 | **Meridian Provisions Co.** | FMCG distribution | Profit leakage — "revenue is up, profit isn't" | CFO / Commercial Director |
| 02 | **Kestrel Logistics** | Freight & fleet | Cost-to-serve — "which routes lose me money?" | COO |
| 03 | **Sable & Finch Credit** | Microfinance | Credit risk — "we find out about bad loans too late" | CRO / Board |
| 04 | **Lumen Health Network** | Clinic group | Capacity & cash — "we're full but not profitable" | Hospital MD / Finance |

### 01 — Meridian Provisions Co., at a glance

A Gauteng-based FMCG distributor: R657m turnover, 485 trade customers across Modern Trade,
General Trade, Wholesale and HoReCa, 131 SKUs, three DCs (Gauteng, KwaZulu-Natal, Western Cape),
24 months of data to 2026-08-31.

The opening line of the demo: **revenue up 11.9%, gross profit up 4.1%.** Five planted findings
explain the gap. The reveal script is in `projects/01-meridian-provisions/ANSWER_KEY.md`.

## Visual identity per project

Deliberately distinct. The point is to show range, not a template.

### 01 — Meridian Provisions · theme "Ledger"

A printed financial report. Warm paper, hairline rules, dense tabular figures, restrained colour
used only where it carries meaning.

| Token | Value |
|---|---|
| Page | `#FBF9F4` |
| Ink | `#1C1917` |
| Accent (negative) | `#7C2D12` oxblood |
| Accent (positive) | `#166534` |
| Rule | `#E7E2D8` hairline, 0.5px |
| Type | Source Serif 4 headings · Inter body · tabular numerals |

Signature visual: the margin waterfall. Gross profit, then freight, then rebate, ending below zero.

### 02 — Kestrel Logistics · theme "Control Tower"

A live operations screen. Dark, map-first, monospace numerics, status as colour.

| Token | Value |
|---|---|
| Page | `#0B0F14` |
| Panel | `#131A22` |
| Primary | `#22D3EE` cyan |
| Warn | `#F59E0B` amber |
| Breach | `#EF4444` |
| Type | Barlow Condensed labels · JetBrains Mono figures |

Signature visual: the route map with three red corridors burning 22% of fleet cost.

### 03 — Sable & Finch Credit · theme "Institutional"

A regulator-ready pack. Navy and bone, dense, auditable, no decoration.

| Token | Value |
|---|---|
| Page | `#F7F6F3` |
| Navy | `#1E3A5F` |
| Bone | `#E8E4DC` |
| Risk ramp | `#15803D` → `#CA8A04` → `#B91C1C` for arrears buckets |
| Type | Inter throughout · tight leading · heavy table use |

Signature visual: vintage curves by disbursement cohort, one branch diverging from the book.

### 04 — Lumen Health Network · theme "Clinical"

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

Signature visual: no-show rate by appointment slot — Monday mornings empty, Thursdays queueing.

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
| 01 Meridian | ✅ | ✅ | ✅ | ✅ | ⬜ | ⬜ |
| 02 Kestrel | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 03 Sable & Finch | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 04 Lumen | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

Meridian: 28 models, 125 dbt tests, one warning by design. Build takes about 20 seconds.

The dashboard layer is an open decision — Evidence has moved to a hosted product model since
this stack was chosen. See [SETUP.md](SETUP.md) for what to install before starting.
