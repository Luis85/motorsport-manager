#!/usr/bin/env python3
"""Read-only, warning-only quality checks. --strict is an explicit local opt-in."""
from __future__ import annotations

import argparse
import hashlib
from importlib import metadata
import json
import re
import subprocess
import sys
from pathlib import Path

from quality_loc import measure
from quality_report import publish

ROOT = Path(__file__).resolve().parent.parent


def finding(rule: str, message: str, path: str = "", line: int = 1) -> dict:
    return {"rule": rule, "message": message, "path": path, "line": line}


def inventory(root: Path, policy: dict) -> list[Path]:
    # Includes untracked, nonignored work during local authoring; only tracked CI checkout otherwise.
    result = subprocess.run(["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
                            cwd=root, capture_output=True, check=True, timeout=30)
    paths = {Path(name.decode("utf-8")) for name in result.stdout.split(b"\0") if name}
    return sorted(path for path in paths if path.suffix in policy["extensions"]
                  and not set(path.parts).intersection(policy["excluded_directories"]))


def execute(name: str, command: list[str], root: Path, output: Path, timeout: int) -> tuple[dict, str]:
    log = output / f"{name}.log"
    try:
        # Tool output is an artifact, never forwarded as untrusted Actions commands.
        with log.open("w", encoding="utf-8") as stream:
            result = subprocess.run(command, cwd=root, stdout=stream, stderr=subprocess.STDOUT,
                                    timeout=timeout, check=False, text=True)
        text = log.read_text(encoding="utf-8", errors="replace")
        return {"name": name, "command": command, "exit_code": result.returncode,
                "status": "clean" if result.returncode == 0 else "findings", "log": log.name}, text
    except (OSError, subprocess.TimeoutExpired) as error:
        with log.open("a", encoding="utf-8") as stream:
            stream.write(f"\n{type(error).__name__}: {error}\n")
        return {"name": name, "command": command, "status": "unavailable", "log": log.name}, ""


def tool_findings(tool: dict, text: str, root: Path, complexity: int) -> list[dict]:
    name = tool["name"]
    if tool["status"] == "unavailable":
        return [finding("tool-unavailable", f"{name} did not complete. See {tool['log']}.")]
    records = []
    try:
        if name == "ruff":
            for item in json.loads(text):
                path = Path(item["filename"]).relative_to(root).as_posix()
                records.append(finding("ruff/" + str(item["code"]), item["message"], path, item["location"]["row"]))
        elif name == "gdlint":
            for match in re.finditer(r"^(.+\.gd):(\d+):(?:\d+:)? (?:Error|Warning): (.+)$", text, re.M):
                records.append(finding("gdlint", match[3], match[1], int(match[2])))
        elif name == "gdradon":
            path = ""
            for line in text.splitlines():
                if line.strip().endswith(".gd"):
                    path = line.strip()
                match = re.search(r"\b[FCM] (\d+):\d+ (.+) - [A-F] \((\d+)\)", line)
                if match and int(match[3]) > complexity:
                    records.append(finding("complexity", f"{match[2]}: complexity {match[3]} exceeds {complexity}.", path, int(match[1])))
        elif tool["exit_code"] == 1:
            records.append(finding(name, f"Formatting changes recommended. See {tool['log']}; no files were changed."))
        if tool["exit_code"] not in (0, 1) or (tool["exit_code"] == 1 and not records):
            raise ValueError("Unexpected tool failure/output; no reliable findings parsed")
        if name == "gdradon" and ("Traceback" in text or not re.search(r"\b[FCM] \d+:\d+", text)):
            raise ValueError("Complexity analysis produced no usable records")
    except (ValueError, KeyError, TypeError) as error:
        tool["status"] = "unavailable"
        records.append(finding("tool-unavailable", f"{name}: {error}. See {tool['log']}."))
    if records and tool["status"] != "unavailable":
        tool["status"] = "findings"
    return records


def provenance() -> dict:
    analyzer = hashlib.sha256()
    for name in ("quality.py", "quality_loc.py", "quality_report.py"):
        analyzer.update(name.encode() + b"\0" + (ROOT / "scripts" / name).read_bytes() + b"\0")
    versions = {}
    for package in ("ruff", "gdtoolkit"):
        try:
            versions[package] = metadata.version(package)
        except metadata.PackageNotFoundError:
            versions[package] = "unavailable"
    return {"analyzer_sha256": analyzer.hexdigest(), "tool_versions": versions}


def collect(root: Path, output: Path, run_tools: bool = True) -> dict:
    policy = json.loads((root / "quality-policy.json").read_text(encoding="utf-8"))
    report = {"schema_version": 1, "mode": "advisory", "analysis_complete": True,
              "policy": policy, "files": [], "findings": [], "tools": [], **provenance()}
    paths = inventory(root, policy)
    if not paths:
        raise ValueError("No source files found; refusing an empty quality report")
    digest = hashlib.sha256()
    for path in paths:
        try:
            absolute = root / path
            if absolute.is_symlink():
                raise ValueError("Source symlinks are not scanned")
            data = absolute.read_bytes()
            digest.update(path.as_posix().encode() + b"\0" + data + b"\0")
            item = measure(path, data.decode("utf-8-sig"), policy)
            report["files"].append(item)
            if item["over_limit"]:
                report["findings"].append(finding("code-lines", f"{item['code_lines']} code lines; "
                    f"{item['category']} limit is {item['limit']}. Split by responsibility, not arbitrary line count.",
                    item["path"], item["line"]))
        except (OSError, ValueError, SyntaxError) as error:
            report["analysis_complete"] = False
            report["findings"].append(finding("measurement-unavailable", str(error), path.as_posix()))
    report["source_sha256"] = digest.hexdigest()
    report["commit"] = subprocess.run(["git", "rev-parse", "HEAD"], cwd=root, text=True,
                                      capture_output=True, timeout=10, check=True).stdout.strip()
    output.mkdir(parents=True, exist_ok=True)
    gd = [p.as_posix() for p in paths if p.suffix == ".gd"]
    py = [p.as_posix() for p in paths if p.suffix == ".py"]
    commands = [("ruff", ["ruff", "check", "--no-fix", "--output-format=json", *py]),
                ("ruff-format", ["ruff", "format", "--check", *py]),
                ("gdlint", ["gdlint", *gd]), ("gdformat", ["gdformat", "--check", *gd]),
                ("gdradon", ["gdradon", "cc", *gd])]
    for name, command in commands:
        if run_tools:
            tool, text = execute(name, command, root, output, policy["tool_timeout_seconds"])
            report["findings"] += tool_findings(tool, text, root, policy["complexity_limit"])
        else:
            tool = {"name": name, "status": "not-requested"}
        report["tools"].append(tool)
        if tool["status"] in ("unavailable", "not-requested"):
            report["analysis_complete"] = False
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT, help="Read-only checkout to scan using this analyzer")
    parser.add_argument("--output", type=Path, default=ROOT / "reports" / "quality")
    parser.add_argument("--loc-only", action="store_true", help="Explicit partial report without external tools")
    parser.add_argument("--annotations", action="store_true")
    parser.add_argument("--strict", action="store_true", help="Opt-in local failure on warnings/incomplete analysis")
    args = parser.parse_args(argv)
    try:
        report = collect(args.root.resolve(), args.output.resolve(), not args.loc_only)
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError) as error:
        report = {"schema_version": 1, "mode": "advisory", "analysis_complete": False,
                  "files": [], "tools": [], "findings": [finding("quality-runner", str(error))]}
    publish(report, args.output, args.annotations, 30)
    return int(args.strict and (bool(report["findings"]) or not report["analysis_complete"]))


if __name__ == "__main__":
    sys.exit(main())
