"""Deterministic advisory report and bounded, escaped GitHub annotations."""

from __future__ import annotations

import html
import json
import os
from collections import Counter
from pathlib import Path


def escape(value: object, property_value: bool = False) -> str:
    result = str(value).replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
    if property_value:
        result = result.replace(":", "%3A").replace(",", "%2C")
    return result


def annotation(finding: dict) -> str:
    props = f"title={escape(finding['rule'], True)}"
    if finding.get("path"):
        props += f",file={escape(finding['path'], True)},line={max(1, finding.get('line', 1))}"
    return f"::warning {props}::{escape(finding['message'])}"


def language_table(files: list[dict]) -> list[str]:
    rows: dict[tuple[str, str], list[int]] = {}
    for item in files:
        key = (item.get("language", "unknown"), item["category"])
        row = rows.setdefault(key, [0, 0, 0])
        row[0] += 1
        row[1] += int(item["over_limit"])
        row[2] += len(item.get("long_lines", []))
    lines = ["", "## Languages", "", "| Language | Category | Files | Over budget | Long lines |"]
    lines.append("|---|---|---:|---:|---:|")
    for (language, category), (count, over, wide) in sorted(rows.items()):
        lines.append(f"| {html.escape(language)} | {category} | {count} | {over} | {wide} |")
    return lines


def summary(report: dict) -> str:
    counts = Counter(item["rule"] for item in report["findings"])
    lines = [
        "# Advisory code quality",
        "",
        "**Warning-only. The existing Godot regression gate is unchanged.**",
        "",
        f"Analysis complete: **{report['analysis_complete']}**. "
        f"Measured files: **{len(report['files'])}**. Findings: **{len(report['findings'])}**.",
        "",
        "Source budget: **400** code lines; tests: **450**. Blank/comment lines and Python docstrings excluded.",
        "TypeScript lines over the advisory width are reported as `long-line` warnings.",
        "",
        "| Check | Findings |",
        "|---|---:|",
    ]
    for rule, count in sorted(counts.items()):
        lines.append(f"| {html.escape(rule)} | {count} |")
    lines += language_table(report["files"])
    lines += ["", "## Tools", "", "| Tool | Outcome |", "|---|---|"]
    for tool in report["tools"]:
        lines.append(f"| {html.escape(tool['name'])} | {tool['status']} |")
    lines += ["", "## Largest files", "", "| File | Code lines | Budget |", "|---|---:|---:|"]
    for item in sorted(report["files"], key=lambda row: (-row["code_lines"], row["path"]))[:20]:
        path = html.escape(item["path"]).replace("|", "&#124;").replace("`", "&#96;")
        lines.append(f"| `{path}` | {item['code_lines']} | {item['limit']} |")
    lines += [
        "",
        "Full findings, file inventory, source identity and tool logs are in the quality-report artifact.",
        "An unavailable/crashed tool is incomplete analysis, not a clean result.",
        "LOC and complexity identify review candidates; they do not prove correctness or design quality.",
        "",
    ]
    return "\n".join(lines)


def publish(report: dict, output: Path, annotations: bool, max_annotations: int) -> None:
    output.mkdir(parents=True, exist_ok=True)
    (output / "quality.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    markdown = summary(report)
    (output / "summary.md").write_text(markdown, encoding="utf-8")
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as target:
            target.write(markdown)
    if annotations:
        # Round-robin rules avoids thousands of style findings hiding LOC/tool errors.
        groups: dict[str, list] = {}
        for finding in report["findings"]:
            groups.setdefault(finding["rule"], []).append(finding)
        emitted = 0
        while groups and emitted < max_annotations:
            for rule in sorted(list(groups)):
                print(annotation(groups[rule].pop(0)))
                emitted += 1
                if not groups[rule]:
                    del groups[rule]
                if emitted >= max_annotations:
                    break
        if emitted < len(report["findings"]):
            print(
                annotation(
                    {
                        "rule": "quality-summary",
                        "message": f"{len(report['findings']) - emitted} additional warnings retained in quality-report/quality.json.",
                    }
                )
            )
    else:
        print(
            f"Advisory quality: {len(report['files'])} files, {len(report['findings'])} warnings; "
            f"complete={report['analysis_complete']}. Report: {output / 'summary.md'}"
        )
