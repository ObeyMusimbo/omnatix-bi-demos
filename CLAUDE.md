# Omnatix BI demo suite, working notes

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
tables, not views**, a view bakes in a relative path to the CSVs and the warehouse file stops
working from any other directory. Keeping bronze as tables makes the `.duckdb` self-contained,
which matters because the dashboard, the chat endpoint and CI all read it from elsewhere.

### Layer rules

- **Bronze**, `select *` from the source. No renaming, no casting, no filtering. If a
  correction appears here it is in the wrong place.
- **Silver**, every data-quality defect is fixed here, visibly, with a comment naming which
  defect and a test proving it. Cast before deduplicating: the duplicate rows in Meridian are
  not byte-identical, they differ in number formatting, so a text-level `distinct` leaves 260
  duplicate keys behind.
- **Gold**, dimensions, one central fact table, and one mart per finding. Gold column
  descriptions in `_gold__models.yml` are doing double duty: they become the dbt docs site shown
  to prospects, *and* the context pack that grounds the AI chat. Write them as definitions of
  what a measure means, not restatements of its name.

### Known source quirks

- `sl_order_lines.discount_pct` is on a 0–100 scale; `sl_promotions.planned_discount_pct` is a
  fraction (0–1). The two source systems disagree. Preserved as recorded and documented rather
  than silently normalised, comparing planned against realised discount needs a ×100 on one side.
- ~140 order lines reference SKUs absent from the product master. They are kept and flagged, and
  the relationship test is deliberately `severity: warn`. The warning is the point: it proves the
  pipeline surfaces referential breaks instead of hiding the revenue.

## The dashboard layer

Static HTML plus DuckDB-WASM. Gold tables export to Parquet, the browser fetches them and runs
SQL client-side. No server, no API, no database to host, and "this is running entirely in your
browser" is a line worth saying in a demo.

Evidence.dev was the original plan and was dropped: it has become a hosted product with a
separate CLI, a login step and a ClickHouse dialect. Hand-rolled charts also give the four
projects genuinely different visual identities, which a constrained theme token set cannot.

### Chart rules, these are the design, not preferences

- Bars capped at 24px with a 4px rounded data end, square at the baseline; 2px lines;
  markers at least 8px with a 2px surface ring; hairline **solid** gridlines, never dashed
- A legend whenever there are two or more series; none for a single series (the title names it)
- Label selectively, never a value on every point
- Every chart ships a table twin behind a "Show data" toggle, so no value is reachable only
  through a tooltip
- The hero figure is sans, never the serif, and uses proportional figures; `tabular-nums`
  belongs in table columns and axis ticks only
- **Never a dual-axis chart.** Two measures of different scale means two charts.

### The palette is validated, not chosen

Series colours passed a six-check validation (lightness band, chroma floor, CVD separation,
normal-vision separation, surface contrast) independently in light and dark mode. Dark mode has
its own darker steps, it is not a flip of the light ones. Do not substitute a colour without
re-running the check; the ordering matters too, because adjacency is what is tested.

Light on `#FBF9F4`: `#B5502C` `#1A5FB4` `#96690A` `#0A7D5E`
Dark on `#16140F`: `#CB7645` `#5A90D4` `#AE8A2A` `#1F9C79`

### House style

No em dashes anywhere. `scripts/no_em_dashes.py` checks (exit 1 on any) and `--fix` rewrites.
CI runs the check before the refresh.

**Run the syntax checks after any `--fix`.** A blanket punctuation rewrite over source code is
sharper than it looks: an early version of that script ate the comma in `{ a: 1, ...rest }`,
in `barPath(x, y, w, h, 4, !flag)`, and inside the Python format spec `{n:,.0f}`, which silently
dropped thousands separators from the answer key. Two of those three still parsed. After a fix
run: `node --check` every JS file, `py_compile` every Python file, `dbt parse`, and load the page.

### Gotchas already paid for

- DuckDB-WASM returns DATE columns as **epoch milliseconds**, not Date objects. `db.js` reads
  the Arrow schema and converts them; do not assume ISO strings elsewhere.
- Module top-level `await` runs before `const` declarations further down the file. The boot
  block lives at the **end** of `app.js` for that reason.
- A waterfall whose anchor dwarfs its steps needs `zeroBaseline: false`, and the axis must be
  labelled as truncated. The Cascade waterfall keeps a zero baseline because crossing zero is
  the finding.
- **Do not preload the query engine on a demo page.** A `modulepreload` of DuckDB-WASM is
  compiled on the main thread the moment it lands, and it held the summary back by three
  seconds. The page paints its frame from `meta.json` first, then starts the engine.
- A closing bridge and the sections it summarises must read **the same months**. Kestrel's
  fuel step and Meridian's promotion and discount steps once summed two years inside a
  one-year total. Kestrel carries an `is_trailing_twelve_months` flag for this; Meridian takes
  its windows from `period_end`.

### The Omnatix frame

Every demo sits inside the same frame: `shell.js` and `omnatix-frame.css` (shared and kept
identical, like `charts.js`), plus the static Omnatix bar in each `index.html`. It draws the
bar, the sticky section nav, the one filter each demo offers, and the summary strip.

- The summary paints from `meta.summary`, written by each `export_parquet.py` from the same gold
  columns the page reads, so it appears before the engine loads. Each page compares its headline
  with the warehouse after the first render and warns in the console if they differ.
- A figure that cannot follow the filter says so with a scope label ("All clinics"). Never let
  a figure look filtered when its mart does not carry the dimension.
- The filter value comes from the query string, so it is checked against the published options
  before it reaches SQL.

## Style

- SQL: lowercase keywords, trailing commas, one column per line, named CTEs, end on
  `select * from final`
- dbt: `data_tests:` not the deprecated `tests:` key (dbt-core 1.12+)
- YAML: quote any description containing a colon followed by a space, or dbt's parser fails
- Comment where intent is non-obvious, especially allocation rules and defect fixes
