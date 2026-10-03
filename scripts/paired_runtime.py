"""Measure the shipping native workload in alternating, source-identified baseline/candidate pairs."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import statistics
import subprocess
from pathlib import Path

from verification_run import source_digest

ROOT = Path(__file__).resolve().parents[1]
HARNESS = (
    "tests/shipping_runtime_tests.gd",
    "tests/weekend_lifecycle_tests.gd",
    "tests/support/runtime_probe.gd",
)
IDENTITY = (
    "engine",
    "cpu",
    "renderer",
    "adapter",
    "viewport",
    "text_scale",
    "fps_limit",
    "vsync_requested",
    "vsync_reported",
    "seed",
    "track",
    "cars",
    "initial_sporting_hash",
    "preparation_steps",
)


def _validate_report(label: str, report: dict) -> None:
    if (
        not isinstance(report, dict)
        or report.get("passed") is not True
        or type(report.get("checks")) is not int
        or report["checks"] <= 0
    ):
        raise ValueError(f"{label} benchmark failed or has no checks")
    if any(key not in report for key in IDENTITY):
        raise ValueError(f"{label} benchmark identity is incomplete")
    if (
        not isinstance(report.get("controlled"), list)
        or not report["controlled"]
        or not isinstance(report.get("simulation"), dict)
        or not report["simulation"].get("outcome_hash")
    ):
        raise ValueError(f"{label} deterministic outcome evidence is missing")
    timings = report.get("timings")
    if not isinstance(timings, list) or not timings:
        raise ValueError(f"{label} timing workloads are missing")
    for row in timings:
        _validate_timing(row)


def _validate_timing(row: dict) -> None:
    if not isinstance(row, dict) or not isinstance(row.get("workload"), str) or not row["workload"]:
        raise ValueError("Timing workload must have an explicit name")
    for field in ("samples", "measured_calls", "warmup_calls"):
        minimum = 0 if field == "warmup_calls" else 1
        if type(row.get(field)) is not int or row[field] < minimum:
            raise ValueError(f"Invalid timing work: {row['workload']}/{field}")


def validate_pair(base: dict, candidate: dict) -> None:
    """A timing number without equivalent work and hardware is not a comparison."""
    _validate_report("baseline", base)
    _validate_report("candidate", candidate)
    for key in IDENTITY:
        if base[key] != candidate[key]:
            raise ValueError(f"Non-comparable benchmark {key}")
    if base["controlled"] != candidate["controlled"]:
        raise ValueError("Controlled frame outcomes or workloads differ")
    for key in ("steps", "simulated_seconds", "outcome_hash"):
        if base["simulation"].get(key) != candidate["simulation"].get(key):
            raise ValueError("Simulation-only workloads or outcomes differ")
    before = {row["workload"]: row for row in base["timings"]}
    after = {row["workload"]: row for row in candidate["timings"]}
    if (
        len(before) != len(base["timings"])
        or len(after) != len(candidate["timings"])
        or before.keys() != after.keys()
    ):
        raise ValueError("Missing or duplicate timing workloads")
    for name in before:
        for key in ("samples", "warmup_calls", "measured_calls"):
            if before[name].get(key) != after[name].get(key):
                raise ValueError(f"Unequal sample work: {name}/{key}")
        for row in (before[name], after[name]):
            if (
                type(row.get("median_us")) not in (int, float)
                or not math.isfinite(row["median_us"])
                or row["median_us"] <= 0
            ):
                raise ValueError(f"Invalid timing: {name}")


def summarize(pairs: list[dict]) -> list[dict]:
    if not pairs:
        raise ValueError("No completed baseline/candidate pairs")
    for pair in pairs:
        validate_pair(pair["baseline"], pair["candidate"])
    names = [row["workload"] for row in pairs[0]["baseline"]["timings"]]
    result = []
    for name in names:
        values = {}
        for role in ("baseline", "candidate"):
            values[role] = [
                next(row["median_us"] for row in pair[role]["timings"] if row["workload"] == name)
                for pair in pairs
            ]
        before, after = (statistics.median(values[role]) for role in ("baseline", "candidate"))
        result.append(
            {
                "workload": name,
                "baseline_median_us": before,
                "candidate_median_us": after,
                "reduction_percent": 100 * (1 - after / before),
                "paired_medians_us": values,
            }
        )
    return result


def execute(
    root: Path, role: str, engine: Path, output: Path, duration: float, revision: str
) -> dict:
    output.mkdir(parents=True)
    arguments = [
        "python3",
        str(root / "scripts/verify.py"),
        "--godot",
        str(engine),
        "--suite",
        "shipping_runtime_tests",
        "--output",
        str(output),
    ]
    # Use the existing fail-closed importer/isolation/report runner, not another test engine.
    environment = dict(
        os.environ,
        LP_NUM_THREADS="2",
        MOTORSPORT_RUNTIME_SECONDS=str(duration),
        MOTORSPORT_SOURCE_REVISION=revision,
    )
    with (output / "launcher.log").open("w", encoding="utf-8") as stream:
        subprocess.run(
            arguments,
            cwd=root,
            env=environment,
            stdout=stream,
            stderr=subprocess.STDOUT,
            check=True,
            timeout=1200,
        )
    report = json.loads(
        (output / "shipping_runtime_tests/shipping-runtime-tests.json").read_text(encoding="utf-8")
    )
    print(f"{role}: {report['checks']} checks; evidence {output}", flush=True)
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", type=Path, required=True)
    parser.add_argument("--candidate", type=Path, default=ROOT)
    parser.add_argument("--godot", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--baseline-revision", required=True)
    parser.add_argument("--candidate-revision", required=True)
    parser.add_argument("--pairs", type=int, default=3)
    parser.add_argument("--seconds", type=float, default=8.0)
    args = parser.parse_args()
    roots = {"baseline": args.baseline.resolve(), "candidate": args.candidate.resolve()}
    output = args.output.resolve()
    result = {"passed": False, "pairs": [], "summary": []}
    writable = False
    try:
        if not 1 <= args.pairs <= 5 or not 2 <= args.seconds <= 60:
            raise ValueError("Use 1–5 pairs and 2–60 measured seconds per sustained state")
        if roots["baseline"] == roots["candidate"]:
            raise ValueError("Baseline and candidate must be separate source directories")
        if any(output.is_relative_to(root) for root in roots.values()):
            raise ValueError("Keep paired evidence outside both source trees")
        if output.exists() and any(output.iterdir()):
            raise ValueError("Evidence output must be empty")
        for path in HARNESS:
            if (roots["baseline"] / path).read_bytes() != (roots["candidate"] / path).read_bytes():
                raise ValueError("Benchmark harness differs: " + path)
        result["sources"] = {
            role: {
                "revision": getattr(args, role + "_revision"),
                "source_digest": source_digest(root),
            }
            for role, root in roots.items()
        }
        result["harness_sha256"] = {
            path: hashlib.sha256((roots["candidate"] / path).read_bytes()).hexdigest()
            for path in HARNESS
        }
        result["engine_sha256"] = hashlib.sha256(args.godot.read_bytes()).hexdigest()
        result["seconds_per_state"] = args.seconds
        result["note"] = (
            "Alternating paired samples, not a confidence interval or universal FPS claim. Raw workloads and frame intervals are retained."
        )
        output.mkdir(parents=True, exist_ok=True)
        writable = True
        for index in range(args.pairs):
            pair = {}
            order = ("baseline", "candidate") if index % 2 == 0 else ("candidate", "baseline")
            for role in order:
                if source_digest(roots[role]) != result["sources"][role]["source_digest"]:
                    raise ValueError("Source changed during paired experiment: " + role)
                pair[role] = execute(
                    roots[role],
                    role,
                    args.godot.resolve(),
                    output / f"pair-{index}-{role}",
                    args.seconds,
                    result["sources"][role]["revision"],
                )
                if source_digest(roots[role]) != result["sources"][role]["source_digest"]:
                    raise ValueError("Source changed while benchmark ran: " + role)
            validate_pair(pair["baseline"], pair["candidate"])
            result["pairs"].append(pair)
            (output / "paired-runtime.json").write_text(
                json.dumps(result, indent=2) + "\n", encoding="utf-8"
            )
        result["summary"] = summarize(result["pairs"])
        result["passed"] = True
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError) as error:
        result["error"] = str(error)
    if writable:
        (output / "paired-runtime.json").write_text(
            json.dumps(result, indent=2) + "\n", encoding="utf-8"
        )
    print(json.dumps({key: value for key, value in result.items() if key != "pairs"}, indent=2))
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
