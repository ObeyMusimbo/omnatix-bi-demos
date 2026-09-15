# Setup

Checked against this machine on 2026-09-15.

## 1. Software

| Tool | Why | Status |
|---|---|---|
| **Git** | version control, everything is code | ✅ 2.51.2 |
| **Node.js 20+** | the data generators and the local preview server | ✅ 22.21.1 |
| **Python 3.12** | dbt Core runs on Python | ✅ 3.12.10 |
| **dbt-core + dbt-duckdb** | the transformation engine | ✅ in `.venv` |
| **VS Code** | editor | check |
| **DuckDB CLI** | query the warehouse without opening a notebook | optional |
| **Power BI Desktop** | free, for clients who ask for Power BI by name | optional |

### Python

Installed with winget:

```bash
winget install --id Python.Python.3.12 --source winget --accept-package-agreements --silent
```

It lands at `%LOCALAPPDATA%\Programs\Python\Python312`. **Terminals opened before the install
will not see it**, open a fresh one, or prepend the path for that session.

### The Python side of the stack

A virtualenv at the repo root holds dbt, so nothing is installed globally:

```bash
python -m venv .venv
.venv/Scripts/python.exe -m pip install dbt-core dbt-duckdb duckdb
```

Run dbt through the venv rather than activating it:

```bash
.venv/Scripts/dbt.exe --version
```

### VS Code extensions

- **dbt Power User**, model preview, lineage, compiled SQL
- **Python**
- **Rainbow CSV**, makes the raw drops readable
- **DuckDB SQL Tools** *(optional)*

### DuckDB CLI (optional but recommended)

```bash
winget install DuckDB.cli
```

## 2. Accounts

| Account | For | Status |
|---|---|---|
| **GitHub** | the repo, plus GitHub Actions as the scheduler | ✅ |
| **Cloudflare** | Pages, hosts the dashboards at a public URL | ✅ |
| **Anthropic Console** | API key for the dashboard chat | later |
| **Microsoft for Startups Founders Hub** | Azure credits, M365 | not needed yet |
| **Google for Startups Cloud** | BigQuery credits | not needed yet |
| **Power BI Desktop** | the `.pbix` deliverable for Microsoft-shop clients | when a client asks |

**Nothing in this stack touches Azure.** DuckDB is a file, dbt runs locally,
the dashboard is static files, Cloudflare Pages serves them, GitHub Actions schedules the
refresh. The cloud credit programmes matter at the "right way" stage: a client already on
Fabric or Synapse, or an app that needs a real backend. Not for demos. Apply when there is a
reason to, not before.

## 3. Refreshing after new data

One command does the whole chain, stopping at the first failure so an unchecked number never
reaches the dashboard:

```bash
.venv/Scripts/python.exe scripts/refresh.py
```

See [REFRESH.md](REFRESH.md) for what it does, what to do when a test fails, and how the
dashboard reports its own freshness.

## 4. Rebuild everything from scratch

```bash
node projects/01-meridian-provisions/generator/generate.js
```

Nine CSVs in `data/raw`, about 22 MB, plus a regenerated `ANSWER_KEY.md`. Deterministic, same
seed, same numbers, every time.

```bash
cd projects/01-meridian-provisions/dbt
../../../.venv/Scripts/dbt.exe build --profiles-dir .
```

Builds `meridian.duckdb` through bronze, silver and gold, and runs every test.

Then refresh what the dashboard and the reveal script read:

```bash
cd projects/01-meridian-provisions
../../.venv/Scripts/python.exe generator/export_parquet.py
../../.venv/Scripts/python.exe generator/build_answer_key.py
```

## 5. Run the dashboard

It is a static site, but it must be served over HTTP, because a browser refuses to start a
worker or fetch Parquet from a `file://` page.

```bash
.venv/Scripts/python.exe scripts/build_site.py
npx --yes http-server dist -p 4321 -c-1
```

Then open http://localhost:4321 for the landing page, or http://localhost:4321/meridian/ for
the demo itself.

To iterate on a single dashboard without reassembling, serve its folder directly:

```bash
npx --yes http-server projects/01-meridian-provisions/dashboard -p 4321 -c-1
```

### Deploying it

One Cloudflare Pages project serves all four demos under their own paths. Build command
`python scripts/build_site.py`, output directory `dist`. See [REFRESH.md](REFRESH.md).

## 6. What gets built next, in order

1. ~~Bronze models, raw CSVs read as-is, one model per source file~~ ✅
2. ~~Silver models, the nine planted data quality issues resolved, with tests~~ ✅
3. ~~Gold models, dimensions, `fct_sales_line`, and one mart per finding~~ ✅
4. ~~Dashboard in the Meridian "Ledger" theme~~ ✅
5. The chat endpoint, grounded in the gold layer
6. Deploy to Cloudflare Pages
7. Repeat for projects 02–04

## Notes

- **All money is South African rand, excluding VAT.** Money columns carry a `_zar` suffix from
  silver onwards. Trade prices are quoted ex-VAT because the 15% output tax is a billing
  concern, not a margin one.
- The generators are written in Node so datasets rebuild without a Python environment. dbt is
  the only part that needs Python.
- `data/raw` is committed on purpose. It is synthetic, it is small, and a demo repo that clones
  and runs is worth more than a tidy one.
- `ANSWER_KEY.md` is the reveal script. Never ship it with a demo.
- Never point any of this at real client data.
