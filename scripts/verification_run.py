"""One suite registry for local runs and bounded CI shards. Missing evidence fails closed."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import time
import uuid

import verify

ROOT = Path(__file__).resolve().parents[1]


def suites() -> list[dict]:
    records = json.loads((ROOT / "scripts/verification_suites.json").read_text())
    ids = [item["id"] for item in records]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate verification suite identity")
    for item in records:
        if not (ROOT / item["script"]).is_file() or not item["reports"]:
            raise ValueError(f"Incomplete suite contract: {item['id']}")
    return records


def partition(records: list[dict], index: int, count: int) -> list[dict]:
    if not 1 <= count <= 64 or not 0 <= index < count:
        raise ValueError("Shard requires 0 <= index < count <= 64")
    return records[index::count]


def source_digest() -> str:
    digest = hashlib.sha256()
    for path in sorted(ROOT.rglob("*")):
        relative = path.relative_to(ROOT)
        if any(part in {".git", ".godot", "reports", "builds", "__pycache__"} for part in relative.parts):
            continue
        if path.is_file():
            digest.update(str(relative).encode() + b"\0" + path.read_bytes() + b"\0")
    return digest.hexdigest()


def validate_aggregate(reports: list[dict], count: int, expected: list[dict]) -> dict:
    if len(reports) != count or {r.get("index") for r in reports} != set(range(count)):
        raise ValueError("Missing or duplicated shard evidence")
    if len({r.get("source") for r in reports}) != 1 or not reports[0].get("source"):
        raise ValueError("Shard source identities differ or are absent")
    seen = []
    for report in reports:
        if report.get("passed") is not True or report.get("count") != count or report.get("mode") != "full":
            raise ValueError("Failed, partial or mismatched shard")
        planned = [s["id"] for s in partition(expected, report["index"], count)]
        actual = [s["id"] for s in report["suites"]]
        if actual != planned or any(s.get("passed") is not True for s in report["suites"]):
            raise ValueError("Suite coverage differs from the registered plan")
        seen.extend(actual)
    if sorted(seen) != sorted(s["id"] for s in expected):
        raise ValueError("Incomplete registered suite coverage")
    return {"passed": True, "source": reports[0]["source"], "suites": len(seen),
            "checks": sum(s.get("checks", 0) for r in reports for s in r["suites"]), "shards": count}


def execute(args: argparse.Namespace, records: list[dict]) -> int:
    executable = args.godot or os.environ.get("GODOT_BINARY") or shutil.which("godot") or shutil.which("godot4")
    if not executable:
        raise ValueError("Supply --godot or GODOT_BINARY")
    executable = str(Path(executable).resolve())
    chosen = [s for s in partition(records, args.shard_index, args.shard_count) if not args.headless_only or not s["native"]]
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    verify.REPORTS = output
    report = {"source": source_digest(), "index": args.shard_index, "count": args.shard_count,
              "mode": "headless-only" if args.headless_only else "full", "passed": False, "suites": []}
    env = dict(os.environ, VERIFICATION_TEST_GODOT=executable, GODOT_SILENCE_ROOT_WARNING="1", LIBGL_ALWAYS_SOFTWARE="1")
    env.pop("MOTORSPORT_VERIFY_ROOT", None)
    try:
        for label, script in [("guard-tests", "tests/test_architecture_guard.py"),
                              ("registry-tests", "tests/test_verification_plan.py"),
                              ("runner-isolation", "tests/test_verify_runner.py"),
                              ("architecture-guard", "scripts/check_architecture.py")]:
            verify.run_phase(label, [sys.executable, str(ROOT / script)], env)
        with tempfile.TemporaryDirectory(prefix="motorsport-manager-verification-") as temporary:
            project = Path(temporary) / "project"
            shutil.copytree(ROOT, project, ignore=shutil.ignore_patterns(".git", ".godot", "reports", "builds", "__pycache__"))
            configuration = project / "project.godot"
            configuration.write_text(configuration.read_text().replace('config/name="Motorsport Manager"',
                                      f'config/name="MotorsportManagerVerification-{uuid.uuid4().hex}"'))
            evidence = project / "reports"
            evidence.mkdir(); (evidence / ".gdignore").touch()
            env.update(MOTORSPORT_VERIFY_ROOT=temporary, XDG_DATA_HOME=temporary, APPDATA=temporary)
            base = [executable, "--path", str(project)]
            verify.run_phase("import", base + ["--headless", "--editor", "--quit"], env)
            verify.run_phase("script-load", base + ["--headless", "--script", "res://tests/script_load_tests.gd"], env)
            script_load = json.loads((evidence / "script-load.json").read_text())
            if script_load.get("passed") is not True:
                raise ValueError("Production script loads failed")
            report["script_loads"] = script_load.get("checks", 0)
            for suite in chosen:
                for old in evidence.iterdir():
                    if old.is_file() and not old.name.startswith("."):
                        old.unlink()
                target = output / suite["id"]; target.mkdir(exist_ok=True)
                verify.REPORTS = target
                command = base + (["--audio-driver", "Dummy"] if suite["native"] else ["--headless"])
                command += ["--script", "res://" + suite["script"]]
                if suite["native"]:
                    command += ["--", "--pitwall-layout=" + suite["layout"]]
                    if sys.platform.startswith("linux") and shutil.which("xvfb-run"):
                        command = [shutil.which("xvfb-run"), "-a", "-s", "-screen 0 2000x1200x24"] + command
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
                    report["suites"].append(entry)
                    (output / "verification.json").write_text(json.dumps(report, indent=2) + "\n")
            report["passed"] = all(s["passed"] for s in report["suites"]) and len(report["suites"]) == len(chosen)
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
    parser.add_argument("--headless-only", action="store_true")
    parser.add_argument("--shard-index", type=int, default=0)
    parser.add_argument("--shard-count", type=int, default=1)
    parser.add_argument("--output", default=str(ROOT / "reports"))
    parser.add_argument("--aggregate", type=Path)
    args = parser.parse_args()
    try:
        registered = suites()
        if args.aggregate:
            evidence = [json.loads(p.read_text()) for p in sorted(args.aggregate.glob("*/verification.json"))]
            result = validate_aggregate(evidence, args.shard_count, registered)
            print(json.dumps(result, indent=2)); return 0
        partition(registered, args.shard_index, args.shard_count)
        return execute(args, registered)
    except (OSError, ValueError) as error:
        print(str(error), file=sys.stderr); return 1


if __name__ == "__main__":
    raise SystemExit(main())
