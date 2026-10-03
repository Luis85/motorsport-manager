"""One suite registry for local runs and bounded CI shards. Missing evidence fails closed."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import sys
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any

import verify

ROOT = Path(__file__).resolve().parents[1]


SUITE_ID = re.compile(r"[a-z][a-z0-9_]*")
REPORT_FILE = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]*\.json")


def _read_registry_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except ValueError as error:
        raise ValueError(f"{path}: invalid JSON: {error}") from error


def _validate_suite_paths(item: dict, where: str, root: Path) -> None:
    script = item.get("script")
    if (
        not isinstance(script, str)
        or not script.startswith("tests/")
        or not script.endswith(".gd")
        or "\\" in script
        or any(part in ("", ".", "..") for part in script.split("/"))
    ):
        raise ValueError(f"{where}: script must be a relative .gd path under tests/")
    try:
        path = (root / script).resolve()
        valid = path.is_relative_to(root) and path.is_file()
    except (OSError, RuntimeError, ValueError) as error:
        raise ValueError(f"{where}: script cannot be resolved: {error}") from error
    if not valid:
        raise ValueError(f"{where}: script is missing or escapes the source checkout: {script}")
    reports = item.get("reports")
    if (
        not isinstance(reports, list)
        or not reports
        or any(
            not isinstance(report, str) or not REPORT_FILE.fullmatch(report) for report in reports
        )
    ):
        raise ValueError(f"{where}: reports must be a non-empty array of JSON filenames")
    if len(set(reports)) != len(reports):
        raise ValueError(f"{where}: reports must not contain duplicate filenames")


def _validate_suite(item: object, where: str, root: Path) -> str:
    if not isinstance(item, dict):
        raise ValueError(f"{where}: expected a suite object")
    name = item.get("id")
    if not isinstance(name, str) or not SUITE_ID.fullmatch(name):
        raise ValueError(f"{where}: id must be a non-empty lowercase snake_case name")
    where += f" ({name})"
    if type(item.get("native")) is not bool:
        raise ValueError(f"{where}: native must be a Boolean")
    if type(item.get("timeout")) is not int or item["timeout"] <= 0:
        raise ValueError(f"{where}: timeout must be a positive integer in seconds")
    if item.get("layout") not in ("minimal", "engineering", "director"):
        raise ValueError(f"{where}: layout must be minimal, engineering, or director")
    _validate_suite_paths(item, where, root)
    return name


def suites(root: Path | None = None) -> list[dict]:
    """Validate the execution registry and its monotonic regression floor before running."""
    root = (ROOT if root is None else root).resolve()
    registry = root / "scripts/verification_suites.json"
    floor = root / "tests/fixtures/required_verification_suites.json"
    records = _read_registry_json(registry)
    if not isinstance(records, list) or not records:
        raise ValueError(f"{registry}: expected a non-empty array of suite contracts")
    ids = set()
    for index, item in enumerate(records):
        name = _validate_suite(item, f"{registry}: entry {index + 1}", root)
        if name in ids:
            raise ValueError(f"{registry}: Duplicate suite identity {name}")
        ids.add(name)
    required = _read_registry_json(floor)
    if (
        not isinstance(required, list)
        or not required
        or any(not isinstance(name, str) or not SUITE_ID.fullmatch(name) for name in required)
        or len(set(required)) != len(required)
    ):
        raise ValueError(f"{floor}: expected a non-empty array of unique suite identities")
    missing = set(required) - ids
    if missing:
        raise ValueError(f"{registry}: Missing required suites: " + ", ".join(sorted(missing)))
    return records


def partition(records: list[dict], index: int, count: int) -> list[dict]:
    if (
        type(index) is not int
        or type(count) is not int
        or not 1 <= count <= 64
        or not 0 <= index < count
    ):
        raise ValueError("Shard requires 0 <= index < count <= 64")
    return records[index::count]


def source_digest(root: Path = ROOT) -> str:
    digest = hashlib.sha256()
    for path in sorted(root.rglob("*")):
        relative = path.relative_to(root)
        if any(
            part in {".git", ".godot", "reports", "builds", "__pycache__", ".ruff_cache"}
            for part in relative.parts
        ):
            continue
        if path.is_file():
            digest.update(relative.as_posix().encode() + b"\0" + path.read_bytes() + b"\0")
    return digest.hexdigest()


def validate_aggregate(
    reports: list[dict], count: int, expected: list[dict], expected_source: str
) -> dict:
    partition(expected, 0, count)
    if not isinstance(expected_source, str) or not expected_source or not isinstance(reports, list):
        raise ValueError("Malformed shard evidence or missing expected source")
    for report in reports:
        if not isinstance(report, dict):
            raise ValueError("Malformed shard evidence")
        if type(report.get("index")) is not int or type(report.get("count")) is not int:
            raise ValueError("Shard indices and counts must be integers")
        if not isinstance(report.get("source"), str) or not report["source"]:
            raise ValueError("Shard source identity must be a non-empty string")
    if len(reports) != count or {r.get("index") for r in reports} != set(range(count)):
        raise ValueError("Missing or duplicated shard evidence")
    if len({r.get("source") for r in reports}) != 1 or not reports[0].get("source"):
        raise ValueError("Shard source identities differ or are absent")
    if reports[0]["source"] != expected_source:
        raise ValueError("Shard evidence belongs to another source checkout")
    seen = []
    for report in reports:
        if (
            report.get("passed") is not True
            or report.get("count") != count
            or report.get("mode") != "full"
        ):
            raise ValueError("Failed, partial or mismatched shard")
        planned = [s["id"] for s in partition(expected, report["index"], count)]
        entries = report.get("suites")
        if not isinstance(entries, list) or any(
            not isinstance(s, dict) or not isinstance(s.get("id"), str) for s in entries
        ):
            raise ValueError("Malformed suite evidence")
        actual = [s["id"] for s in entries]
        if actual != planned or any(s.get("passed") is not True for s in report["suites"]):
            raise ValueError("Suite coverage differs from the registered plan")
        if any(type(s.get("checks")) is not int or s["checks"] < 0 for s in entries):
            raise ValueError("Check counts must be non-negative integers")
        seen.extend(actual)
    if sorted(seen) != sorted(s["id"] for s in expected):
        raise ValueError("Incomplete registered suite coverage")
    return {
        "passed": True,
        "source": reports[0]["source"],
        "suites": len(seen),
        "checks": sum(s.get("checks", 0) for r in reports for s in r["suites"]),
        "shards": count,
    }


def select_suites(
    records: list[dict],
    index: int,
    count: int,
    headless_only: bool = False,
    requested: list[str] | None = None,
) -> tuple[list[dict], str]:
    requested = requested or []
    unknown = set(requested) - {s["id"] for s in records}
    if unknown:
        raise ValueError("Unknown suite IDs: " + ", ".join(sorted(unknown)))
    if requested and (count != 1 or index != 0):
        raise ValueError("Focused suite selection cannot be combined with CI sharding")
    chosen = [
        s
        for s in partition(records, index, count)
        if (not headless_only or not s["native"]) and (not requested or s["id"] in requested)
    ]
    if not chosen and (requested or headless_only):
        raise ValueError("The selection contains no executable suites")
    return chosen, "focused" if requested else ("headless-only" if headless_only else "full")


def _execute_suite(suite: dict, base: list[str], env: dict, evidence: Path, output: Path) -> dict:
    for old in evidence.iterdir():
        if old.is_file() and not old.name.startswith("."):
            old.unlink()
    target = output / suite["id"]
    target.mkdir(exist_ok=True)
    verify.REPORTS = target
    command = base + (["--audio-driver", "Dummy"] if suite["native"] else ["--headless"])
    command += ["--script", "res://" + suite["script"]]
    if suite["native"]:
        command += ["--", "--pitwall-layout=" + suite["layout"]]
        if sys.platform.startswith("linux") and shutil.which("xvfb-run"):
            command = [
                shutil.which("xvfb-run"),
                "-a",
                "-s",
                "-screen 0 2000x1200x24",
            ] + command
    entry = {"id": suite["id"], "passed": False}
    started = time.monotonic()
    try:
        verify.run_phase(suite["id"], command, env, timeout=suite["timeout"])
        values = [json.loads((evidence / name).read_text()) for name in suite["reports"]]
        if any(not isinstance(v, dict) or v.get("passed") is not True for v in values):
            raise ValueError("Missing or failed primary/secondary report")
        entry.update(passed=True, checks=values[0].get("checks", 0))
    except (RuntimeError, ValueError, OSError) as error:
        entry["error"] = str(error)
    finally:
        entry["seconds"] = round(time.monotonic() - started, 3)
        for artifact in evidence.iterdir():
            if artifact.is_file() and not artifact.name.startswith("."):
                shutil.copy2(artifact, target / artifact.name)
    return entry


def execute(args: argparse.Namespace, records: list[dict]) -> int:
    executable = (
        args.godot
        or os.environ.get("GODOT_BINARY")
        or shutil.which("godot")
        or shutil.which("godot4")
    )
    if not executable:
        raise ValueError("Supply --godot or GODOT_BINARY")
    executable = str(Path(executable).resolve())
    chosen, mode = select_suites(
        records, args.shard_index, args.shard_count, args.headless_only, args.suite
    )
    output = Path(args.output).resolve()
    if output.is_relative_to(ROOT) and not output.is_relative_to(ROOT / "reports"):
        raise ValueError(
            "Output inside the checkout must be under reports/ to keep source identity reproducible"
        )
    output.mkdir(parents=True, exist_ok=True)
    verify.REPORTS = output
    report = {
        "source": source_digest(),
        "index": args.shard_index,
        "count": args.shard_count,
        "mode": mode,
        "passed": False,
        "suites": [],
    }
    env = dict(
        os.environ,
        VERIFICATION_TEST_GODOT=executable,
        GODOT_SILENCE_ROOT_WARNING="1",
        LIBGL_ALWAYS_SOFTWARE="1",
    )
    env.pop("MOTORSPORT_VERIFY_ROOT", None)
    try:
        for label, script in [
            ("guard-tests", "tests/test_architecture_guard.py"),
            ("registry-tests", "tests/test_verification_plan.py"),
            ("mechanics-tool-tests", "tests/test_mechanics_tool.py"),
            ("runner-isolation", "tests/test_verify_runner.py"),
            ("architecture-guard", "scripts/check_architecture.py"),
        ]:
            verify.run_phase(label, [sys.executable, str(ROOT / script)], env)
        with tempfile.TemporaryDirectory(prefix="motorsport-manager-verification-") as temporary:
            project = Path(temporary) / "project"
            shutil.copytree(
                ROOT,
                project,
                ignore=shutil.ignore_patterns(
                    ".git", ".godot", "reports", "builds", "__pycache__", ".ruff_cache"
                ),
            )
            if source_digest(project) != report["source"]:
                raise ValueError("Source changed while creating the isolated verification copy")
            configuration = project / "project.godot"
            configuration.write_text(
                configuration.read_text().replace(
                    'config/name="Motorsport Manager"',
                    f'config/name="MotorsportManagerVerification-{uuid.uuid4().hex}"',
                )
            )
            evidence = project / "reports"
            evidence.mkdir()
            (evidence / ".gdignore").touch()
            env.update(MOTORSPORT_VERIFY_ROOT=temporary, XDG_DATA_HOME=temporary, APPDATA=temporary)
            base = [executable, "--path", str(project)]
            verify.run_phase("import", base + ["--headless", "--editor", "--quit"], env)
            verify.run_phase(
                "script-load",
                base + ["--headless", "--script", "res://tests/script_load_tests.gd"],
                env,
            )
            script_load = json.loads((evidence / "script-load.json").read_text())
            if script_load.get("passed") is not True:
                raise ValueError("Production script loads failed")
            report["script_loads"] = script_load.get("checks", 0)
            for suite in chosen:
                report["suites"].append(_execute_suite(suite, base, env, evidence, output))
                (output / "verification.json").write_text(json.dumps(report, indent=2) + "\n")
            report["passed"] = all(s["passed"] for s in report["suites"]) and len(
                report["suites"]
            ) == len(chosen)
    except (RuntimeError, ValueError, OSError) as error:
        report["error"] = str(error)
    finally:
        verify.REPORTS = output
        (output / "verification.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2), flush=True)
    return 0 if report["passed"] else 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--godot")
    parser.add_argument(
        "--suite",
        action="append",
        help="Run one registered suite; repeat for more. Never accepted as full CI evidence.",
    )
    parser.add_argument(
        "--list-suites",
        action="store_true",
        help="List the authoritative suite IDs without running Godot",
    )
    parser.add_argument("--headless-only", action="store_true")
    parser.add_argument("--shard-index", type=int, default=0)
    parser.add_argument("--shard-count", type=int, default=1)
    parser.add_argument("--output", default=str(ROOT / "reports"))
    parser.add_argument("--aggregate", type=Path)
    args = parser.parse_args()
    try:
        registered = suites()
        if args.list_suites:
            print(json.dumps(registered, indent=2))
            return 0
        if args.aggregate:
            if args.suite or args.headless_only:
                raise ValueError("An aggregate cannot accept a focused or headless-only run")
            evidence = [
                json.loads(p.read_text())
                for p in sorted(args.aggregate.glob("*/verification.json"))
            ]
            result = validate_aggregate(evidence, args.shard_count, registered, source_digest())
            print(json.dumps(result, indent=2))
            return 0
        partition(registered, args.shard_index, args.shard_count)
        return execute(args, registered)
    except (OSError, ValueError) as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
