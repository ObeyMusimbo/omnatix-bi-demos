"""
Assemble the public site into dist/.

One Cloudflare Pages project serves everything: a landing page at the root, and each demo
under its own path. Adding a project is one entry in PROJECTS below.

    .venv/Scripts/python.exe scripts/build_site.py

    dist/
      index.html          the Omnatix landing page
      omnatix.css
      meridian/           projects/01-meridian-provisions/dashboard, copied
      kestrel/
      sable-finch/
      lumen/

This is a pure file copy plus a rendered index, with no third-party imports, so Cloudflare can
run it as the build command on a clean image. dist/ is therefore not committed: the committed
artefacts are the Parquet files under each project, which is what the tests ran against.

A project with no built dashboard yet renders as a card without a link, so the landing page is
honest about what exists rather than linking into a 404.
"""

from __future__ import annotations
import html
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
DIST = ROOT / "dist"

PROJECTS = [
    {
        "slug": "meridian",
        "dir": "01-meridian-provisions",
        "client": "Meridian Provisions Co.",
        "industry": "FMCG distribution",
        "problem": "Revenue is up double digits. Gross profit is flat. Nobody can say why.",
        "headline_value": "R12.6m",
        "headline_label": "of gross profit that did not arrive",
        # The signature colour of that demo's theme, on a dark surface
        "accent": "#CB7645",
    },
    {
        "slug": "kestrel",
        "dir": "02-kestrel-logistics",
        "client": "Kestrel Logistics",
        "industry": "Freight and fleet",
        "problem": "Delivery is treated as fixed overhead, so nobody knows which routes lose money.",
        "headline_value": "R21.9m",
        "headline_label": "identified against R27.6m of contribution",
        "accent": "#22D3EE",
    },
    {
        "slug": "sable-finch",
        "dir": "03-sable-finch-credit",
        "client": "Sable & Finch Credit",
        "industry": "Microfinance",
        "problem": "Arrears are reported monthly and backward looking. By then the money is gone.",
        "headline_value": "R10.3m",
        "headline_label": "of credit loss above the clean book rate",
        "accent": "#5A90D4",
    },
    {
        "slug": "lumen",
        "dir": "04-lumen-health",
        "client": "Lumen Health Network",
        "industry": "Clinic group",
        "problem": "Every clinic is full and the group still loses money. Capacity and cash are managed apart.",
        "headline_value": "R17.4m",
        "headline_label": "billed for care delivered and never collected",
        "accent": "#00919A",
    },
]


def dashboard_dir(project: dict) -> Path:
    return ROOT / "projects" / project["dir"] / "dashboard"


def read_meta(project: dict) -> dict | None:
    meta = dashboard_dir(project) / "data" / "meta.json"
    if not meta.exists():
        return None
    try:
        return json.loads(meta.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def card(project: dict, built: bool, meta: dict | None) -> str:
    e = html.escape
    accent = project["accent"]
    industry = e(project["industry"])
    client = e(project["client"])
    problem = e(project["problem"])

    if built:
        through = meta.get("data_through", "") if meta else ""
        foot_right = f"Data to {e(through)}" if through else ""
        head = (
            f'<a class="card" href="{project["slug"]}/" style="--accent:{accent}">'
        )
        foot = f'<div class="card-foot"><span class="open">Open demo</span><span>{foot_right}</span></div>'
    else:
        head = f'<div class="card pending" style="--accent:{accent}">'
        foot = '<div class="card-foot"><span class="badge">In build</span><span></span></div>'

    value = project.get("headline_value")
    headline = (
        f'<div class="headline"><div class="headline-value">{e(value)}</div>'
        f'<div class="headline-label">{e(project["headline_label"])}</div></div>'
        if value else
        f'<div class="headline"><div class="headline-label">{e(project["headline_label"])}</div></div>'
    )

    return (
        f"    {head}\n"
        f'      <div class="card-industry">{industry}</div>\n'
        f"      <h2>{client}</h2>\n"
        f'      <p class="problem"><q>{problem}</q></p>\n'
        f"      {headline}\n"
        f"      {foot}\n"
        f'    {"</a>" if built else "</div>"}'
    )


def main() -> int:
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)

    cards, built_count = [], 0
    for project in PROJECTS:
        src = dashboard_dir(project)
        built = (src / "index.html").exists()
        meta = read_meta(project) if built else None

        if built:
            shutil.copytree(src, DIST / project["slug"])
            built_count += 1
            size = sum(f.stat().st_size for f in (DIST / project["slug"]).rglob("*") if f.is_file())
            through = meta.get("data_through", "unknown") if meta else "no meta.json"
            print(f"  {project['slug']:<14} copied   {size / 1024:>7.0f} KB   data to {through}")
        else:
            print(f"  {project['slug']:<14} not built yet, card will render without a link")

        cards.append(card(project, built, meta))

    template = (SITE / "index.html").read_text(encoding="utf-8")
    (DIST / "index.html").write_text(template.replace("{{CARDS}}", "\n".join(cards)), encoding="utf-8")
    shutil.copy2(SITE / "omnatix.css", DIST / "omnatix.css")

    total = sum(f.stat().st_size for f in DIST.rglob("*") if f.is_file())
    print(f"\n  {built_count} of {len(PROJECTS)} demos live, {total / 1024 / 1024:.1f} MB -> {DIST}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
