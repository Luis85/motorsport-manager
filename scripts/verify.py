#!/usr/bin/env python3
"""Import the project and run domain plus native-rendered UI tests in isolated user data."""
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
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / "reports"
ERROR = re.compile(r"SCRIPT ERROR:|Parse Error:|(?:^|\n)ERROR:")


def isolate_phase(name: str, command: list[str], env: dict[str, str]) -> dict[str, str]:
    """Keep saved preferences/checkpoints inside one suite, not the next suite.

    The clean source copy and imported class cache remain shared. Only the runner's
    private copy may be renamed; the real game configuration and user data are never
    edited or deleted. A unique name also protects OS resolvers that ignore XDG.
    """
    root = env.get("MOTORSPORT_VERIFY_ROOT")
    if not root:
        return env
    if "--path" not in command or command.index("--path") + 1 >= len(command):
        raise RuntimeError("Isolated Godot phase requires an explicit copied project path")
    project = Path(command[command.index("--path") + 1]).resolve()
    if not project.is_relative_to(Path(root).resolve()):
        raise RuntimeError("Refusing to modify a project outside the verification directory")
    configuration = project / "project.godot"
    original = configuration.read_text(encoding="utf-8")
    if not re.search(r'^config/name="MotorsportManagerVerification-[^"\n]+"$', original, re.M):
        raise RuntimeError("Refusing to rename a non-verification project")
    identity = uuid.uuid4().hex
    safe_name = re.sub(r"[^a-zA-Z0-9_-]", "_", name)
    user_dir = Path(root) / "suite-users" / f"{safe_name}-{identity}"
    user_dir.mkdir(parents=True)
    configuration.write_text(re.sub(
        r'^config/name="MotorsportManagerVerification-[^"\n]+"$',
        f'config/name="MotorsportManagerVerification-{safe_name}-{identity}"',
        original, count=1, flags=re.M), encoding="utf-8")
    return dict(env, XDG_DATA_HOME=str(user_dir), APPDATA=str(user_dir), LOCALAPPDATA=str(user_dir))


def run_phase(name: str, command: list[str], env: dict[str, str], timeout: int = 360) -> None:
    env = isolate_phase(name, command, env)
    print(f"[{name}] {' '.join(command)}", flush=True)
    started = time.monotonic()
    try:
        result = subprocess.run(command, cwd=ROOT, env=env, text=True,
                                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                timeout=timeout, check=False)
    except subprocess.TimeoutExpired as exc:
        output = exc.stdout or b""
        if isinstance(output, bytes):
            output = output.decode("utf-8", "replace")
        (REPORTS / f"{name}.log").write_text(output, encoding="utf-8")
        raise RuntimeError(f"{name} exceeded {timeout} seconds") from exc
    (REPORTS / f"{name}.log").write_text(result.stdout, encoding="utf-8")
    print(result.stdout, end="", flush=True)
    if result.returncode != 0 or ERROR.search(result.stdout):
        raise RuntimeError(f"{name} failed (exit {result.returncode}); see reports/{name}.log")
    print(f"[{name}] passed in {time.monotonic() - started:.1f}s", flush=True)


def require_report(filename: str) -> dict:
    path = REPORTS / filename
    if not path.is_file():
        raise RuntimeError(f"Required report was not produced: {filename}")
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("passed") is not True:
        raise RuntimeError(f"Failed report: {filename}")
    return data


def main() -> int:
    from verification_run import main as run
    return run()


if __name__ == "__main__":
    raise SystemExit(main())
