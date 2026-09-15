# Omnatix BI demo suite — working notes

Four analytics demos for prospects and investors. Read [README.md](README.md) for the projects
and their visual identities, [SETUP.md](SETUP.md) for the toolchain.

## Non-negotiables

- **All money is South African rand, excluding VAT.** Money columns carry a `_zar` suffix from
  the silver layer onwards. Never mix currencies, never introduce a USD column.
- **All data is synthetic.** Never point any project at real client data, even anonymised.
- **`ANSWER_KEY.md` never ships.** It is the reveal script for the demo, not a deliverable.
- **Every dataset has planted findings.** A demo dashboard must *discover* something, not just
  display numbers. If a change makes a planted finding uncomputable, the change is wrong.

## Running things

Python lives in a venv at the repo root; call it directly rather than activating:

```bash
.venv/Scripts/dbt.exe --version
```

Rebuild a project's source data (deterministic, seeded):

```bash
node projects/01-meridian-provisions/generator/generate.js
```

Build the warehouse and run every test:

```bash
cd projects/01-meridian-provisions/dbt
../../../.venv/Scripts/dbt.exe build --profiles-dir .
```

## Architecture

```
CSV drops → dbt bronze → silver → gold → dashboard
             (as landed) (cleaned) (measures)
```

One DuckDB file per project, at `projects/NN-name/meridian.duckdb`. **Bronze is materialised as
tables, not views** — a view bakes in a relative path to the CSVs and the warehouse file stops
working from any other directory. Keeping bronze as tables makes the `.duckdb` self-contained,
which matters because the dashboard, the chat endpoint and CI all read it from elsewhere.

### Layer rules

- **Bronze** — `select *` from the source. No renaming, no casting, no filtering. If a
  correction appears here it is in the wrong place.
- **Silver** — every data-quality defect is fixed here, visibly, with a comment naming which
  defect and a test proving it. Cast before deduplicating: the duplicate rows in Meridian are
  not byte-identical, they differ in number formatting, so a text-level `distinct` leaves 260
  duplicate keys behind.
- **Gold** — dimensions, one central fact table, and one mart per finding. Gold column
  descriptions in `_gold__models.yml` are doing double duty: they become the dbt docs site shown
  to prospects, *and* the context pack that grounds the AI chat. Write them as definitions of
  what a measure means, not restatements of its name.

### Known source quirks

- `sl_order_lines.discount_pct` is on a 0–100 scale; `sl_promotions.planned_discount_pct` is a
  fraction (0–1). The two source systems disagree. Preserved as recorded and documented rather
  than silently normalised — comparing planned against realised discount needs a ×100 on one side.
- ~140 order lines reference SKUs absent from the product master. They are kept and flagged, and
  the relationship test is deliberately `severity: warn`. The warning is the point: it proves the
  pipeline surfaces referential breaks instead of hiding the revenue.

## Style

- SQL: lowercase keywords, trailing commas, one column per line, named CTEs, end on
  `select * from final`
- dbt: `data_tests:` not the deprecated `tests:` key (dbt-core 1.12+)
- YAML: quote any description containing a colon followed by a space, or dbt's parser fails
- Comment where intent is non-obvious — especially allocation rules and defect fixes
