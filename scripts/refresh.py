"""
Refresh a project end to end after new source data lands.

This is the command to run when a new CSV drop arrives. It does not touch the generator:
the generator invents synthetic data, whereas a refresh takes whatever is sitting in
data/raw and pushes it through the warehouse to the dashboard.

    .venv/Scripts/python.exe scripts/refresh.py
    .venv/Scripts/python.exe scripts/refresh.py --project 01-meridian-provisions
    .venv/Scripts/python.exe scripts/refresh.py --regenerate   (demo data only)

Steps, in order, stopping at the first failure:

  1. dbt build      bronze, silver, gold, and every test. A failing test stops the refresh
                    rather than publishing numbers nobody has checked.
  2. export_parquet what the browser downloads, plus meta.json carrying the freshness dates
  3. build_answer_key  the reveal script, regenerated so it can never disagree with the page

Exit code is non-zero if any step fails, so CI can gate a deploy on it.
"""

from __future__ import annotations
import argparse
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VENV_PY = ROOT / ".venv" / "Scripts" / "python.exe"
VENV_DBT = ROOT / ".venv" / "Scripts" / "dbt.exe"
if not VENV_PY.exists():                      # posix layout
    VENV_PY = ROOT / ".venv" / "bin" / "python"
    VENV_DBT = ROOT / ".venv" / "bin" / "dbt"


def run(label: str, cmd: list[str], cwd: Path) -> None:
    print(f"\n=== {label}")
    print(f"    {' '.join(str(c) for c in cmd)}")
    started = time.time()
    result = subprocess.run(cmd, cwd=cwd)
    if result.returncode != 0:
        print(f"\nFAILED at: {label} (exit {result.returncode})")
        print("Nothing downstream has been published. Fix the cause and run again.")
        sys.exit(result.returncode)
    print(f"    ok in {time.time() - started:.1f}s")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", default="01-meridian-provisions")
    ap.add_argument("--regenerate", action="store_true",
                    help="rebuild the synthetic source CSVs first (demo projects only)")
    args = ap.parse_args()

    project = ROOT / "projects" / args.project
    if not project.exists():
        print(f"No such project: {project}")
        return 1

    print(f"Refreshing {args.project}")

    if args.regenerate:
        run("regenerate synthetic source data",
            ["node", "generator/generate.js"], project)

    run("dbt build",
        [str(VENV_DBT), "build", "--profiles-dir", "."], project / "dbt")

    run("export parquet for the browser",
        [str(VENV_PY), "generator/export_parquet.py"], project)

    run("rebuild the answer key",
        [str(VENV_PY), "generator/build_answer_key.py"], project)

    print("\nRefresh complete.")
    print("Commit and push to publish: Cloudflare Pages redeploys on push to the default branch.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
