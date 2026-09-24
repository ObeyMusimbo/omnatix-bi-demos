# What happens when new data arrives

Short answer: drop the new files in, run one command, commit. The dashboard redeploys itself
and tells the reader how current it is.

```bash
.venv/Scripts/python.exe scripts/refresh.py
git add -A && git commit -m "Refresh Meridian to <date>" && git push
```

That is the whole loop. The rest of this page is what it does and what to do when it fails.

## The three ways data lands

### 1. A CSV drop (where you are now)

Someone exports from the ERP and the files land in `projects/NN-name/data/raw/`. Same filenames,
same columns. Run the refresh. The medallion does the rest: bronze reads whatever is there,
silver cleans it, gold recalculates every measure, and the marts recompute the findings.

Nothing about the pipeline is date-aware, so a fuller file simply produces a longer history.
You do not edit any SQL to take in a new month.

### 2. On a schedule

`.github/workflows/refresh.yml` runs the same script on a cron and commits the result. Use this
once a client is sending files to a folder or a bucket on a regular cadence. It is also the
honest demo answer to "how often does this update?" because the answer is visible in the repo
rather than promised in a meeting.

### 3. A live source (the paid stage)

Replace the CSV sources in `models/bronze/_bronze__sources.yml` with a real connection: a
database, an API pulled by `dlt`, a bucket. Everything from silver upward is untouched, because
bronze is the only layer that knows where data comes from. That separation is the reason the
medallion is worth the ceremony.

## What the refresh actually does

| Step | What it does | If it fails |
|---|---|---|
| `dbt build` | Rebuilds bronze, silver and gold, and runs all 97 tests | **Stops.** Nothing downstream runs, so a broken number never reaches the page |
| `export_parquet.py` | Writes the 10 Parquet files the browser reads, plus `meta.json` | Stops |
| `build_answer_key.py` | Rewrites `ANSWER_KEY.md` from the rebuilt warehouse | Stops |

The ordering is the safety. A failing test means the refresh exits non-zero and the previously
published dashboard stays up, still serving the last numbers that passed. You never publish a
number nobody has checked.

Typical run: about 25 seconds for Meridian's 290k lines.

Useful flags:

```bash
.venv/Scripts/python.exe scripts/refresh.py --project 02-kestrel-logistics
.venv/Scripts/python.exe scripts/refresh.py --regenerate    # synthetic demo data only
```

`--regenerate` re-rolls the synthetic source data. Never use it on a project backed by real
files: it overwrites `data/raw`.

## How the dashboard reports its own freshness

The masthead states two separate things, because they break separately.

| What it says | What it means | What it means when it goes wrong |
|---|---|---|
| **15 days behind** | Age of the newest transaction in the data | The source feed has stopped arriving. Not our pipeline. |
| **Data to 31 Aug 2026** | The last date with transactions | |
| **Pipeline run today** | When this site was last rebuilt | If this ages while the data is fine, the refresh job is broken. That is ours. |

The dot is green within 2 days, amber to 14 days, red beyond that. The label carries the same
information in words, so it survives colour blindness and a black-and-white printout.

The days-behind figure is computed in the browser against the reader's own clock, not baked in
at build time. A page left open overnight, or opened from a bookmark next month, tells the truth
rather than the truth as of the build.

### The demos: a fixed period

The four demos run on synthetic data for a closed period, September 2024 to August 2026, and
it never advances. Counted the live way, the badge went red within a fortnight of launch and
read as a broken pipeline, when all it measured was how long ago the demo was made.

So each demo's `meta.json` carries `"fixed_period": true`, written by `export_parquet.py`. With
that flag the badge tracks the nightly rebuild instead (**Rebuilt today**, green within 2 days,
amber to 14, red beyond), and the second line names the period: **Demo period to 31 Aug 2026**.
A client deployment on live data leaves the flag out and gets the days-behind behaviour above.

**Say this out loud in a demo.** Most dashboards a prospect has seen do not admit how old they
are, and several of them are quietly stale. A dashboard that volunteers "15 days behind" is
making an argument about your engineering.

## Deploying

One Cloudflare Pages project serves everything, with each demo under its own path:

```
demos.omnatix.co.za              the landing page, all four
demos.omnatix.co.za/meridian     FMCG distribution
demos.omnatix.co.za/kestrel      freight and fleet
demos.omnatix.co.za/sable-finch  microfinance
demos.omnatix.co.za/lumen        clinic group
```

Cloudflare settings:

| Setting | Value |
|---|---|
| Build command | `python scripts/build_site.py` |
| Output directory | `dist` |
| Root directory | leave blank |

`scripts/build_site.py` copies each project's `dashboard/` into `dist/<slug>/` and renders the
landing page. It imports nothing outside the standard library, so it runs on a clean build
image. A project with no dashboard yet renders as a card without a link, so the landing page is
never advertising a 404.

`dist/` is generated and not committed. What *is* committed is the Parquet under each project,
which is what the tests ran against, so a rollback is still `git revert`.

Adding a demo is one entry in the `PROJECTS` list at the top of that script.

### Sending a link to a prospect

A deep link works on its own: `demos.omnatix.co.za/kestrel` opens straight into the logistics
demo. They can navigate up to the landing page and see the others, which for an investor is the
whole point. If a specific client ever needs a demo nobody else can reach, that one gets its own
Cloudflare project with Access in front of it, rather than changing this structure.

## When the shape of the data changes

A new column, a renamed field, a new SKU range. The tests fail loudly rather than the numbers
drifting quietly, which is the point of having them.

1. `dbt build` fails, and names the model and the test
2. Fix it in **silver**, never in bronze. Bronze is the record of what arrived.
3. Add a test that would have caught it earlier
4. Re-run the refresh

If a *source file* is missing entirely, bronze fails at read time and nothing else runs.
