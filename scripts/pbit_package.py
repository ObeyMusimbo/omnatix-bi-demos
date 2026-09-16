"""
Assemble the .pbit package, calibrated against a real file from the installed Power BI.

Three rounds were lost guessing at this format, so it no longer guesses. Point it at any
.pbix saved by the Power BI Desktop on this machine and it lifts the parts that are the
product's business rather than ours, verbatim:

    Version              the package format number. 1.22 and 1.28 were both refused with
                         "incompatible with your current version". The build here writes 1.32.
    Settings, Metadata   versioned structures with more in them than a stub.
    DiagramLayout        the model diagram.
    Report/definition    report.json and version.json, plus whatever theme they reference.

Only two things are ours: the semantic model, and the pages. Everything else is copied, which
means the next Power BI release needs a fresh reference file rather than another guess.

Encodings are not uniform and that matters:

    [Content_Types].xml        UTF-8, with a BOM
    Version, Settings,
    Metadata, DataModelSchema  UTF-16 LE, no BOM
    Report/definition/**       UTF-8, no BOM

A BOM in the UTF-16 parts is read as a character rather than skipped, which is what made the
first attempt fail as "encrypted or corrupted".
"""

from __future__ import annotations

import json
import re
import zipfile
from pathlib import Path

# Parts taken from the reference file exactly as they are.
COPY_VERBATIM = ("Version", "Settings", "Metadata", "DiagramLayout")
COPY_PREFIXES = ("Report/StaticResources/", "Report/definition/version.json",
                 "Report/definition/report.json")


def utf16(obj) -> bytes:
    """UTF-16 LE, no byte order mark. Power BI reads these with Encoding.Unicode.GetString,
    which does not strip a mark, so one becomes a stray character inside the value."""
    text = obj if isinstance(obj, str) else json.dumps(obj, ensure_ascii=False)
    return text.encode("utf-16-le")


def utf8(obj) -> bytes:
    text = obj if isinstance(obj, str) else json.dumps(obj, ensure_ascii=False)
    return text.encode("utf-8")


def read_reference(path: Path) -> dict:
    """Pull the parts worth copying out of a real Power BI file."""
    out = {}
    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        for n in names:
            if n in COPY_VERBATIM or n.startswith(COPY_PREFIXES) or n == "[Content_Types].xml":
                out[n] = z.read(n)
    missing = [p for p in ("Version", "[Content_Types].xml") if p not in out]
    if missing:
        raise SystemExit(f"reference file is missing {missing}, is it really a .pbix?")
    return out


def content_types_for_template(reference_xml: bytes) -> bytes:
    """The reference is a .pbix, which stores a compiled DataModel. A template stores
    DataModelSchema instead, and carries no SecurityBindings because it holds no credentials."""
    xml = reference_xml.decode("utf-8-sig")
    xml = xml.replace('<Override PartName="/DataModel" ContentType="" />',
                      '<Override PartName="/DataModelSchema" ContentType="" />')
    xml = xml.replace('<Override PartName="/SecurityBindings" ContentType="" />', "")
    # The declaration keeps its BOM, which is how Power BI writes this one part.
    return b"\xef\xbb\xbf" + xml.lstrip("﻿").encode("utf-8")


def page_parts(pages: list[dict]) -> dict[str, bytes]:
    """PBIR keeps each page in its own folder, with a metadata file listing the order.

    Legacy Report/Layout, one JSON blob with visual configs encoded as strings inside it, is
    not what this build writes any more. Matching what it writes is the point of this module.
    """
    parts: dict[str, bytes] = {}
    ids = []
    for i, page in enumerate(pages):
        pid = f"page{i:04d}{'0' * 12}"[:20]
        ids.append(pid)
        parts[f"Report/definition/pages/{pid}/page.json"] = utf8({
            "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report"
                       "/definition/page/2.1.0/schema.json",
            "name": pid,
            "displayName": page["name"],
            "displayOption": "FitToPage",
            "height": 1080,
            "width": 1920,
        })
    parts["Report/definition/pages/pages.json"] = utf8({
        "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report"
                   "/definition/pagesMetadata/1.1.0/schema.json",
        "pageOrder": ids,
        "activePageName": ids[0],
    })
    return parts


def write_template(out: Path, model: dict, pages: list[dict], reference: dict) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml",
                   content_types_for_template(reference["[Content_Types].xml"]))

        for name, raw in reference.items():
            if name == "[Content_Types].xml":
                continue
            z.writestr(name, raw)

        z.writestr("DataModelSchema", utf16(model))
        for name, raw in page_parts(pages).items():
            z.writestr(name, raw)


def describe(path: Path) -> str:
    with zipfile.ZipFile(path) as z:
        v = z.read("Version").decode("utf-16-le")
        n = len(z.namelist())
    return f"format version {v}, {n} parts"
