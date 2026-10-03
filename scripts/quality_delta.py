#!/usr/bin/env python3
"""Compare complete advisory inventories without hiding debt or creating a gate."""

from __future__ import annotations

import argparse
import html
import json
import sys
from collections import defaultdict
from copy import deepcopy
from pathlib import Path


def identity(report: dict) -> dict:
    return {
        key: report.get(key)
        for key in (
            "commit",
            "source_sha256",
            "analysis_complete",
            "analyzer_sha256",
            "tool_versions",
        )
    }


def validate(report: object) -> dict:
    if not isinstance(report, dict) or report.get("schema_version") != 1:
        raise ValueError("Expected a version-1 advisory quality report")
    if not isinstance(report.get("findings"), list):
        raise ValueError("Report has no complete findings inventory")
    for finding in report["findings"]:
        if not isinstance(finding, dict) or not all(
            isinstance(finding.get(key), str) for key in ("path", "rule", "message")
        ):
            raise ValueError("Malformed finding identity")
        if type(finding.get("line")) is not int or finding["line"] < 1:
            raise ValueError("Malformed finding location")
    return report


def compare(base: dict, candidate: dict) -> dict:
    base, candidate = validate(base), validate(candidate)
    reasons = []
    for label, report in (("base", base), ("candidate", candidate)):
        if report.get("analysis_complete") is not True:
            reasons.append(f"{label} analysis is incomplete")
        if not report.get("analyzer_sha256") or not report.get("tool_versions"):
            reasons.append(f"{label} analyzer/tool provenance is missing")
        if not report.get("source_sha256") or not report.get("commit"):
            reasons.append(f"{label} source identity is missing")
        versions = report.get("tool_versions", {})
        if not isinstance(versions, dict) or not all(
            isinstance(key, str) and isinstance(value, str) for key, value in versions.items()
        ):
            reasons.append(f"{label} tool provenance is malformed")
        elif "unavailable" in versions.values():
            reasons.append(f"{label} tool versions are unavailable")
    for key in ("policy", "analyzer_sha256", "tool_versions"):
        if base.get(key) != candidate.get(key):
            reasons.append(f"{key} differs; inventories are not directly comparable")
    result = {
        "schema_version": 1,
        "mode": "advisory",
        "comparable": not reasons,
        "reasons": reasons,
        "base": identity(base),
        "candidate": identity(candidate),
        "base_findings": len(base["findings"]),
        "candidate_findings": len(candidate["findings"]),
        "new": [],
        "resolved": [],
        "unchanged": [],
        "matching": "Multiset of exact path, rule and message; line movement alone is not new debt. Renames/message changes are new/resolved findings, not inferred equivalence.",
    }
    if reasons:
        # Never turn an unavailable tool or changed policy into 'resolved' debt.
        return result

    def groups(report: dict) -> dict:
        rows = defaultdict(list)
        for finding in report["findings"]:
            key = (finding["path"], finding["rule"], finding["message"])
            rows[key].append(deepcopy(finding))
        for findings in rows.values():
            findings.sort(key=lambda finding: finding["line"])
        return rows

    before, after = groups(base), groups(candidate)
    for key in sorted(before.keys() | after.keys()):
        old, new = before[key], after[key]
        count = min(len(old), len(new))
        result["unchanged"].extend(
            {"base": a, "candidate": b} for a, b in zip(old[:count], new[:count], strict=True)
        )
        result["resolved"].extend(old[count:])
        result["new"].extend(new[count:])
    return result


def markdown(delta: dict) -> str:
    lines = [
        "# Advisory findings comparison",
        "",
        "The complete base and candidate inventories remain retained. This comparison is not a blocking gate.",
        "",
        f"Base: `{html.escape(str(delta['base']['commit']))}`; candidate: `{html.escape(str(delta['candidate']['commit']))}`.",
        "",
    ]
    if not delta["comparable"]:
        lines += [
            "**Not comparable. No resolved-debt claim is made.**",
            "",
            "; ".join(html.escape(reason) for reason in delta["reasons"]),
        ]
    else:
        lines += [
            "| New | Resolved | Unchanged |",
            "|---:|---:|---:|",
            f"| {len(delta['new'])} | {len(delta['resolved'])} | {len(delta['unchanged'])} |",
            "",
            delta["matching"],
            "",
            "Location changes are retained in each unchanged finding's base/candidate pair.",
        ]
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-report", type=Path, required=True)
    parser.add_argument("--candidate-report", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        base = json.loads(args.base_report.read_text(encoding="utf-8"))
        candidate = json.loads(args.candidate_report.read_text(encoding="utf-8"))
        delta = compare(base, candidate)
        args.output.mkdir(parents=True, exist_ok=True)
        (args.output / "delta.json").write_text(
            json.dumps(delta, indent=2) + "\n", encoding="utf-8"
        )
        (args.output / "delta.md").write_text(markdown(delta), encoding="utf-8")
        print(markdown(delta))
        return 0  # Incomparability is explicit evidence, never a covert blocking ratchet.
    except (OSError, ValueError, TypeError, KeyError) as error:
        print(f"Quality comparison unavailable: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
