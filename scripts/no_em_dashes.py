"""
House style: no em dashes, anywhere.

They are a tell, and in a document a client reads they look like machine output. This both
checks and fixes. Run with --fix to rewrite, without to report and exit non-zero, which is
what CI uses.

    .venv/Scripts/python.exe scripts/no_em_dashes.py --fix
    .venv/Scripts/python.exe scripts/no_em_dashes.py

Handles the literal character and the backslash-u escape that appears inside JS string
literals. Both are built with chr() rather than written out, so this file never contains the
characters it hunts for and can never rewrite itself. It is skipped by name as well.

Generated files are left alone: ANSWER_KEY.md is rewritten by build_answer_key.py, and dbt's
target directory is build output.
"""

from __future__ import annotations
import argparse
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SUFFIXES = {".js", ".html", ".css", ".py", ".sql", ".yml", ".yaml", ".md", ".json"}
SKIP_DIRS = {".venv", "node_modules", "target", ".git", "dbt_packages", "logs", "data"}
SKIP_FILES = {"ANSWER_KEY.md", "no_em_dashes.py"}

EM = chr(0x2014)
ESC = "\\" + "u2014"


def files():
    for p in ROOT.rglob("*"):
        if not p.is_file() or p.suffix not in SUFFIXES:
            continue
        if any(part in SKIP_DIRS for part in p.parts):
            continue
        if p.name in SKIP_FILES:
            continue
        yield p


def count(text: str) -> int:
    return text.count(EM) + text.count(ESC)


def fix(text: str) -> str:
    """
    Replace an em dash with the punctuation the sentence actually wanted.

    A dash between two spaces is nearly always doing a comma's job, so that is the default.
    Anything that leaves doubled or orphaned punctuation behind is repaired afterwards.
    """
    for token in (ESC, EM):
        text = re.sub(r"[ \t]*" + re.escape(token) + r"[ \t]*", ", ", text)

    text = re.sub(r",[ \t]*,+", ", ", text)
    text = re.sub(r"\([ \t]*,[ \t]*", "(", text)
    text = re.sub(r",[ \t]*\)", ")", text)
    # Drop a comma stranded before a full stop, but never in front of a spread operator or an
    # ellipsis. Without the lookahead this turns `{ a: 1, ...rest }` into `{ a: 1...rest }`,
    # which is a syntax error that the file will not reveal until something runs it.
    text = re.sub(r",[ \t]*([.;:!?])(?![.])", r"\1", text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    return text


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fix", action="store_true", help="rewrite files in place")
    args = ap.parse_args()

    offenders = []
    changed = 0
    for p in files():
        try:
            text = p.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        n = count(text)
        if not n:
            continue
        rel = p.relative_to(ROOT)
        if args.fix:
            new = fix(text)
            if new != text:
                p.write_text(new, encoding="utf-8")
                changed += 1
                print(f"  fixed {n:>3}  {rel}")
        else:
            offenders.append((n, str(rel)))

    if args.fix:
        print(f"\n{changed} files rewritten")
        return 0

    if offenders:
        print("Em dashes found. Run with --fix.\n")
        for n, rel in sorted(offenders, reverse=True):
            print(f"  {n:>3}  {rel}")
        return 1

    print("No em dashes.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
