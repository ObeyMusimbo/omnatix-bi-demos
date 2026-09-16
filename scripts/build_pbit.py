"""
Build a Power BI template (.pbit) for a project.

A .pbix is a compiled binary and Power BI Desktop has no scripting interface, so a report
cannot be authored directly. A .pbit can: it is a zip of JSON parts describing the model and
the report, and Desktop builds the rest when you open it. That is the whole reason this file
exists rather than a set of instructions.

What the template carries:

    the queries, one per table, reading the Parquet this repo exports
    a DataFolder parameter, prompted on open, so the file works wherever the repo lives
    every relationship, so nobody has to draw them
    the measures, with format strings
    a report with several pages of visuals

Encoding matters and is easy to get wrong. Power BI writes the JSON parts as UTF-16 LE with a
byte order mark, and refuses a file that uses UTF-8. [Content_Types].xml is the exception and
is UTF-8.

    .venv/Scripts/python.exe scripts/build_pbit.py --project 04-lumen-health
"""

from __future__ import annotations

import argparse
import json
import sys
import uuid
import zipfile
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent.parent

DB_NAME = {
    "01-meridian-provisions": "meridian.duckdb",
    "02-kestrel-logistics": "kestrel.duckdb",
    "03-sable-finch-credit": "sable.duckdb",
    "04-lumen-health": "lumen.duckdb",
}

# DuckDB catalogue type to Tabular data type.
TYPE_MAP = {
    "VARCHAR": "string",
    "DATE": "dateTime",
    "TIMESTAMP": "dateTime",
    "BOOLEAN": "boolean",
    "DOUBLE": "double",
    "BIGINT": "int64",
    "INTEGER": "int64",
    "HUGEINT": "int64",     # the exporter narrows these, so they arrive as int64
    "SMALLINT": "int64",
    "TINYINT": "int64",
}


def utf16(obj) -> bytes:
    """UTF-16 LE with a BOM, which is what Power BI writes and what it will accept back."""
    text = obj if isinstance(obj, str) else json.dumps(obj, ensure_ascii=False)
    return b"\xff\xfe" + text.encode("utf-16-le")


def m_expression(table: str) -> list[str]:
    """One query per table. Kept to three lines so a human can read it in the editor."""
    return [
        "let",
        f'    Source = Parquet.Document(File.Contents(DataFolder & "\\{table}.parquet"))',
        "in",
        "    Source",
    ]


def build_model(project: str, spec: dict, columns: dict) -> dict:
    tables = []

    date_table, date_key = spec.get("date_table", (None, None))

    for t in spec["tables"]:
        sort_by = spec.get("sort_by", {}).get(t, {})
        cols = [
            {
                "name": c,
                "dataType": TYPE_MAP.get(dt, "string"),
                "sourceColumn": c,
                "summarizeBy": "none",
                **({"isHidden": True} if c in spec.get("hide", {}).get(t, []) else {}),
                **({"formatString": "0"} if TYPE_MAP.get(dt) == "int64" else {}),
                **({"formatString": "General Date"} if TYPE_MAP.get(dt) == "dateTime" else {}),
                # Without this a weekday column sorts alphabetically and Monday lands after
                # Friday, which looks like a data problem and is not.
                **({"sortByColumn": sort_by[c]} if c in sort_by else {}),
            }
            for c, dt in columns[t]
        ]
        table = {
            "name": t,
            "columns": cols,
            "partitions": [{
                "name": t,
                "mode": "import",
                "source": {"type": "m", "expression": m_expression(t)},
            }],
        }
        # Marking the date table is what makes time intelligence behave. Skipping it is the
        # classic way for a year on year measure to be quietly wrong.
        if t == date_table:
            table["dataCategory"] = "Time"
            for c in table["columns"]:
                if c["name"] == date_key:
                    c["isKey"] = True
        tables.append(table)

    # Measures live on their own table so they are not buried inside a fact. A calculated
    # table of one blank row is the standard way to make somewhere to put them.
    tables.append({
        "name": "_Measures",
        "columns": [{
            "name": "Value",
            "dataType": "int64",
            "isHidden": True,
            "type": "calculatedTableColumn",
            "sourceColumn": "[Value]",
            "summarizeBy": "none",
        }],
        "partitions": [{
            "name": "_Measures",
            "mode": "import",
            "source": {"type": "calculated", "expression": "{BLANK()}"},
        }],
        "measures": [
            {
                "name": m["name"],
                "expression": m["dax"],
                **({"formatString": m["format"]} if m.get("format") else {}),
                **({"description": m["note"]} if m.get("note") else {}),
            }
            for m in spec["measures"]
        ],
    })

    # A disconnected helper table where the spec asks for one, such as the months on book axis
    # a vintage curve needs. It is an age, not a date, so it cannot come from a calendar.
    for helper in spec.get("helper_tables", []):
        tables.append({
            "name": helper["name"],
            "columns": [{
                "name": helper["column"],
                "dataType": "int64",
                "sourceColumn": f"[{helper['column']}]",
                "type": "calculatedTableColumn",
                "summarizeBy": "none",
                "formatString": "0",
            }],
            "partitions": [{
                "name": helper["name"],
                "mode": "import",
                "source": {"type": "calculated", "expression": helper["expression"]},
            }],
        })

    relationships = [
        {
            "name": str(uuid.uuid5(uuid.NAMESPACE_URL, f"{project}{r}")),
            "fromTable": r[0],
            "fromColumn": r[1],
            "toTable": r[2],
            "toColumn": r[3],
        }
        for r in spec["relationships"]
    ]

    return {
        "name": spec["model_name"],
        "compatibilityLevel": 1550,
        "model": {
            "culture": "en-ZA",
            "dataAccessOptions": {
                "legacyRedirects": True,
                "returnErrorValuesAsNull": True,
            },
            "defaultPowerBIDataSourceVersion": "powerBI_V3",
            "sourceQueryCulture": "en-ZA",
            "tables": tables,
            "relationships": relationships,
            "expressions": [{
                "name": "DataFolder",
                "kind": "m",
                # The meta block is what makes Desktop prompt for it on open.
                "expression": (
                    f'"{spec["default_folder"]}" meta '
                    '[IsParameterQuery=true, Type="Text", IsParameterQueryRequired=true]'
                ),
            }],
            "annotations": [{"name": "__PBI_TimeIntelligenceEnabled", "value": "0"}],
        },
    }


# ---------------------------------------------------------------- report

def visual(x, y, w, h, vtype, fields, title=None):
    """One visual container.

    fields is a list of (role, table, name, is_measure). Power BI needs two descriptions of
    the same thing: projections, which say which field sits in which well, and prototypeQuery,
    which is the query it actually runs. A visual with only projections renders as an empty
    box, so both are generated from one list rather than written twice and drifted apart.

    config is JSON encoded inside JSON. That is not a mistake here, it is how the format works.
    """
    entities, froms = {}, []
    for _role, table, _name, _is_m in fields:
        if table not in entities:
            alias = chr(ord("a") + len(entities))
            entities[table] = alias
            froms.append({"Name": alias, "Entity": table, "Type": 0})

    select, projections = [], {}
    for role, table, name, is_m in fields:
        ref = f"{table}.{name}"
        key = "Measure" if is_m else "Column"
        select.append({
            key: {"Expression": {"SourceRef": {"Source": entities[table]}}, "Property": name},
            "Name": ref,
        })
        projections.setdefault(role, []).append({"queryRef": ref})

    single = {
        "visualType": vtype,
        "projections": projections,
        "prototypeQuery": {"Version": 2, "From": froms, "Select": select},
        "drillFilterOtherVisuals": True,
        "objects": {},
    }
    if title:
        single["vcObjects"] = {
            "title": [{"properties": {
                "show": {"expr": {"Literal": {"Value": "true"}}},
                "text": {"expr": {"Literal": {"Value": f"'{title}'"}}},
            }}]
        }

    name_id = uuid.uuid4().hex[:20]
    cfg = {
        "name": name_id,
        "layouts": [{"id": 0, "position": {"x": x, "y": y, "width": w, "height": h, "z": 0}}],
        "singleVisual": single,
    }
    return {"x": x, "y": y, "width": w, "height": h, "z": 0,
            "config": json.dumps(cfg, ensure_ascii=False)}


def textbox(x, y, w, h, text, size=14, bold=False):
    """A plain text box, for the sentence that tells somebody what they are looking at."""
    name_id = uuid.uuid4().hex[:20]
    runs = [{"value": text, "textStyle": {
        "fontSize": f"{size}pt",
        "fontWeight": "bold" if bold else "normal",
        "color": "#10222B"}}]
    cfg = {
        "name": name_id,
        "layouts": [{"id": 0, "position": {"x": x, "y": y, "width": w, "height": h, "z": 0}}],
        "singleVisual": {
            "visualType": "textbox",
            "drillFilterOtherVisuals": True,
            "objects": {"general": [{"properties": {"paragraphs": [
                {"textRuns": runs}]}}]},
        },
    }
    return {"x": x, "y": y, "width": w, "height": h, "z": 0,
            "config": json.dumps(cfg, ensure_ascii=False)}


def build_report(spec: dict) -> dict:
    sections = []
    for i, page in enumerate(spec["pages"]):
        sections.append({
            "name": f"page{i}",
            "displayName": page["name"],
            "filters": "[]",
            "ordinal": i,
            "visualContainers": page["visuals"],
            "config": json.dumps({"visibility": 0}),
            "width": 1280,
            "height": 720,
            "displayOption": 1,
        })
    return {
        "id": 0,
        "resourcePackages": [{
            "resourcePackage": {
                "name": "SharedResources",
                "type": 2,
                "items": [{"type": 202, "path": "BaseThemes/CY24SU02.json", "name": "CY24SU02"}],
                "disabled": False,
            }
        }],
        "sections": sections,
        "config": json.dumps({
            "version": "5.43",
            "themeCollection": {"baseTheme": {
                "name": "CY24SU02", "version": "5.43", "type": 2}},
            "activeSectionIndex": 0,
            "defaultDrillFilterOtherVisuals": True,
        }),
        "layoutOptimization": 0,
    }


def write_pbit(project: str, spec: dict, columns: dict, out: Path) -> None:
    model = build_model(project, spec, columns)
    report = build_report(spec)

    content_types = (
        '<?xml version="1.0" encoding="utf-8"?>\r\n'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="json" ContentType="" />'
        '<Override PartName="/Version" ContentType="" />'
        '<Override PartName="/Settings" ContentType="" />'
        '<Override PartName="/Metadata" ContentType="" />'
        '<Override PartName="/DataModelSchema" ContentType="" />'
        '<Override PartName="/Report/Layout" ContentType="" />'
        "</Types>"
    )

    out.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", content_types.encode("utf-8"))
        z.writestr("Version", utf16("1.28"))
        z.writestr("Settings", utf16({}))
        z.writestr("Metadata", utf16({"Version": 3, "AutoCreatedRelationships": []}))
        z.writestr("DataModelSchema", utf16(model))
        z.writestr("Report/Layout", utf16(report))

    kb = out.stat().st_size / 1024
    n_meas = len(spec["measures"])
    n_rel = len(spec["relationships"])
    n_tab = len(spec["tables"])
    print(f"  {out.name}  {kb:.0f} KB")
    print(f"  {n_tab} tables, {n_rel} relationships, {n_meas} measures, "
          f"{len(spec['pages'])} report pages")


def columns_for(project: str, tables: list[str]) -> dict:
    con = duckdb.connect(str(ROOT / "projects" / project / DB_NAME[project]), read_only=True)
    out = {}
    for t in tables:
        out[t] = con.execute(
            "select column_name, data_type from information_schema.columns "
            "where table_schema = 'main_gold' and table_name = ? order by ordinal_position",
            [t]).fetchall()
        if not out[t]:
            raise SystemExit(f"table {t} not found in {project} gold layer")
    con.close()
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", default="04-lumen-health", choices=sorted(DB_NAME))
    args = ap.parse_args()

    sys.path.insert(0, str(ROOT / "scripts"))
    from pbit_specs import SPECS                                     # noqa: PLC0415

    spec = SPECS[args.project]
    spec["default_folder"] = str(ROOT / "projects" / args.project / "powerbi" / "data")
    cols = columns_for(args.project, spec["tables"])

    out = ROOT / "projects" / args.project / "powerbi" / f"{spec['file_name']}.pbit"
    print(f"\n{args.project}")
    write_pbit(args.project, spec, cols, out)
    print(f"\n  Open it in Power BI Desktop. It will prompt for the folder and default to:")
    print(f"  {spec['default_folder']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
