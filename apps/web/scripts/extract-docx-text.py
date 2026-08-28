"""Extract docx (paragraphs + tables) to JSON for market research import."""

from __future__ import annotations

import json
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def para_text(el: ET.Element) -> str:
    return "".join(t.text or "" for t in el.findall(".//w:t", NS)).strip()


def table_md(tbl: ET.Element) -> str:
    rows: list[list[str]] = []
    for row in tbl.findall("./w:tr", NS):
        cells = [para_text(cell) or " " for cell in row.findall("./w:tc", NS)]
        rows.append(cells)
    if not rows:
        return ""
    header = rows[0]
    lines = [
        "| " + " | ".join(header) + " |",
        "| " + " | ".join(["---"] * len(header)) + " |",
    ]
    for row in rows[1:]:
        while len(row) < len(header):
            row.append("")
        lines.append("| " + " | ".join(row[: len(header)]) + " |")
    return "\n".join(lines)


def extract_docx(path: Path) -> str:
    with zipfile.ZipFile(path) as zf:
        root = ET.fromstring(zf.read("word/document.xml"))
    body = root.find("w:body", NS)
    if body is None:
        return ""
    blocks: list[str] = []
    for child in body:
        tag = child.tag.split("}")[-1]
        if tag == "p":
            text = para_text(child)
            if text:
                blocks.append(text)
        elif tag == "tbl":
            blocks.append(table_md(child))
    return "\n\n".join(blocks)


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: extract-docx-text.py <file.docx> [output.json]", file=sys.stderr)
        sys.exit(1)

    src = Path(sys.argv[1]).expanduser()
    body = extract_docx(src)
    stem = src.stem
    slug = stem.lower().replace("_", "-").replace(" ", "-")[:80]

    payload = {
        "slug": slug,
        "title": stem.replace("_", " "),
        "summary": "",
        "countryCode": None,
        "tags": ["市场调研"],
        "body": body,
    }

    out = sys.stdout if len(sys.argv) < 3 else open(Path(sys.argv[2]).expanduser(), "w")
    json.dump(payload, out, ensure_ascii=False, indent=2)
    if out is not sys.stdout:
        out.close()
        print(f"wrote {sys.argv[2]}")


if __name__ == "__main__":
    main()
