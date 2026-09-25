# Deploying the demo suite

One Cloudflare Pages project serves all four demos: a landing page at the root and each demo
under its own path. Cloudflare builds the site itself on every push, so `dist/` is never
committed.

```
omnatix-demos.pages.dev/              the landing page
omnatix-demos.pages.dev/meridian      Meridian Provisions Co.
omnatix-demos.pages.dev/kestrel       Kestrel Logistics
omnatix-demos.pages.dev/sable-finch   Sable & Finch Credit
omnatix-demos.pages.dev/lumen         Lumen Health Network
```

## The repository must be private

`ANSWER_KEY.md` sits in each project folder. It is the reveal script: the planted findings,
the numbers, and what to say out loud. It never ships to `dist/`, which is why a prospect
cannot reach it on the live site, but anyone who can read the repository can read it.

So the GitHub repository is **private**. Cloudflare Pages connects to private repositories
through the GitHub app without any extra work.

## One time setup

### 1. Sign in to GitHub

This is the only step that needs your own credentials, so it is yours to run. In a terminal:

```bash
gh auth login
```

Choose GitHub.com, HTTPS, and authenticate in the browser. That also configures git, so
pushing afterwards needs no further sign in.

### 2. Create the repository and push

```bash
gh repo create omnatix-bi-demos --private --source . --remote origin --push
```

### 3. Connect Cloudflare Pages

In the Cloudflare dashboard: **Workers & Pages** → **Create** → **Pages** → **Connect to Git**,
pick the repository, and set:

| Setting | Value |
|---|---|
| Framework preset | None |
| Build command | `python scripts/build_site.py` |
| Build output directory | `dist` |
| Root directory | `/` |

Then under **Settings** → **Environment variables**, add one for the production environment:

| Variable | Value |
|---|---|
| `PYTHON_VERSION` | `3.12` |

Cloudflare's build image ships an older Python by default and `build_site.py` is written for a
current one. Setting it explicitly is the difference between a build that works and a build
that fails on a syntax error in a script that runs fine locally.

`build_site.py` imports nothing outside the standard library, on purpose. The build image needs
no `pip install`, no dbt and no DuckDB: the Parquet files the browser reads are committed, and
the build is a file copy plus a rendered index.

## What happens on a push

```
push to GitHub
   ├─ Cloudflare Pages runs build_site.py and redeploys      (about 30 seconds)
   └─ GitHub Actions runs the nightly refresh workflow only when
      projects/*/data/raw/** or projects/*/dbt/** changed
```

The scheduled refresh runs at 04:00 SAST daily. It rebuilds each warehouse from whatever is in
`data/raw`, runs every test, re-exports the Parquet, rebuilds the answer keys, and commits.
A failing test fails that project's job and commits nothing, so the live dashboard keeps
serving the last numbers that passed rather than publishing unchecked ones.

## Checking a deploy

The dashboards state their own freshness in the masthead, against the reader's clock. After a
deploy, open any of the four and confirm:

- the freshness label and the "data to" date match what you expect
- the AI panels are present and name the model and date that wrote them
- the hero figure is populated rather than a dash
- no chart is an empty box

The pages need to be served over HTTP. Opening `dist/index.html` from the file system will not
work, because the browser blocks the DuckDB worker and the Parquet fetches. To check a build
locally:

```bash
npx --yes http-server dist -p 4321 -c-1 --cors
```

## AI insights: which model writes them

The nightly workflow runs `scripts/ai_insights.py` after the refresh. With nothing configured it
uses GitHub Models through the job's own token, which is free and needs no setup. To use a
different provider, add one repository secret under **Settings** → **Secrets and variables** →
**Actions**. The first one found wins, in this order:

| Secret | Provider | Where to get a key |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude | console.anthropic.com, paid per use |
| `GEMINI_API_KEY` | Google Gemini | aistudio.google.com, free tier |
| `GROQ_API_KEY` | Groq | console.groq.com, free tier |
| `OPENROUTER_API_KEY` | OpenRouter | openrouter.ai, free models |

Set a repository variable `AI_PROVIDER` to force one of `anthropic`, `gemini`, `groq`,
`openrouter` or `github`, and `AI_MODEL` to choose the model. Keys are only ever read from
secrets; none is committed. To regenerate by hand, run the workflow from the **Actions** tab.

## Custom domain, when you want one

Cloudflare Pages → the project → **Custom domains** → add e.g. `demos.omnatix.co.za`. If the
domain is already on Cloudflare the DNS record is created for you. Until then the
`*.pages.dev` address is a perfectly good thing to send a prospect.

## What is deliberately not automated

Nothing in this repository holds a credential. There is no API token, no service account and no
`.env` committed. The GitHub Actions workflow uses the token GitHub issues to the job itself,
and Cloudflare authenticates through its own GitHub app. Adding a long lived token to make one
step slightly shorter would be the wrong trade.
