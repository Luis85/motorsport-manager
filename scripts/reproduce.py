#!/usr/bin/env python3
"""Inspect an existing replay plus bounded developer evidence; never execute bundle code."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

from verification_process import execute_process

ROOT = Path(__file__).resolve().parents[1]
MAX_BYTES = 16 * 1024 * 1024


def reject_constant(value: str) -> None:
    raise ValueError(f"Non-finite JSON number: {value}")


def read_bundle(path: Path) -> dict:
    with path.open("rb") as source:
        raw = source.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise ValueError("Reproduction bundle exceeds 16 MiB")
    value = json.loads(raw.decode("utf-8"), parse_constant=reject_constant)
    if not isinstance(value, dict) or value.get("kind") != "motorsport-manager-reproduction":
        raise ValueError("Expected a developer reproduction bundle, not a sporting save")
    return value


def describe(result: dict, bundle_path: Path, engine: str) -> str:
    difference = result.get("first_divergence", {})
    lines = [f"Recorded source: {result.get('source_revision', 'unavailable')}",
             f"Recorded engine: {result.get('engine', 'unavailable')}"]
    if difference:
        lines += [f"First retained divergence: fixed step {difference['step']}, input cursor {difference['cursor']}",
                  f"Affected value: {difference['path']}",
                  f"Expected (recorded): {json.dumps(difference['expected'], ensure_ascii=False)}",
                  f"Observed (replay): {json.dumps(difference['observed'], ensure_ascii=False)}",
                  f"Last accepted input (not inferred cause): {json.dumps(difference.get('last_input', {}), ensure_ascii=False)}"]
    else:
        lines.append("Retained boundaries match." if result.get("matched") else "Replay could not establish equivalence.")
    lines += [f"Checked boundaries: {result.get('checked', 0)}; dropped: {result.get('dropped_boundaries', 0)}",
              f"Replay error: {result.get('replay_error', result.get('error', ''))}",
              "Reproduce: " + subprocess.list2cmdline([sys.executable, "scripts/reproduce.py", str(bundle_path), "--godot", engine])]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=Path)
    parser.add_argument("--godot", default="godot")
    parser.add_argument("--output", type=Path, default=ROOT / "reports/reproduction-result.json")
    args = parser.parse_args()
    try:
        read_bundle(args.bundle)
        engine = shutil.which(args.godot)
        if not engine:
            raise ValueError("Godot is unavailable; supply --godot with the pinned engine path")
        # Import and execution are isolated from developer/player state and checkout cache.
        with tempfile.TemporaryDirectory(prefix="motorsport reproduction ") as temporary:
            root = Path(temporary)
            project = root / "project"
            shutil.copytree(ROOT, project, ignore=shutil.ignore_patterns(".git", ".godot", "reports", "builds", "__pycache__"))
            env = dict(os.environ, XDG_DATA_HOME=str(root / "user"), APPDATA=str(root / "user"), LOCALAPPDATA=str(root / "user"))
            config = project / "project.godot"
            text = config.read_text(encoding="utf-8")
            text = re.sub(r'^config/name=.*$', 'config/name="MotorsportReproduction-' + root.name + '"', text, flags=re.M)
            config.write_text(text, encoding="utf-8")
            command = [engine, "--headless", "--path", str(project)]
            imported = execute_process(command + ["--editor", "--quit"], cwd=project, env=env, timeout=120)
            if imported.returncode or re.search(r"SCRIPT ERROR:|Parse Error:|(?:^|\n)ERROR:", imported.stdout):
                raise ValueError("Clean Godot import failed: " + imported.stdout[-3000:])
            args.output = args.output.resolve()
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.unlink(missing_ok=True)
            run = execute_process(command + ["--script", "res://tests/reproduce_cli.gd", "--", str(args.bundle.resolve()), str(args.output)], cwd=project, env=env, timeout=600)
            if re.search(r"SCRIPT ERROR:|Parse Error:|(?:^|\n)ERROR:", run.stdout):
                raise ValueError("Godot execution failed: " + run.stdout[-3000:])
            if not args.output.is_file():
                raise ValueError("No reproduction report was produced: " + run.stdout[-3000:])
            result = json.loads(args.output.read_text(encoding="utf-8"))
            print(describe(result, args.bundle.resolve(), engine))
            return 0 if run.returncode == 0 and result.get("matched") else 1
    except (OSError, ValueError, subprocess.TimeoutExpired) as error:
        print(f"Reproduction failed: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
