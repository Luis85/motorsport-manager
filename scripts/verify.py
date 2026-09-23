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


def run_phase(name: str, command: list[str], env: dict[str, str], timeout: int = 240) -> None:
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
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--godot", default=os.environ.get("GODOT_BINARY"),
                        help="Path to the Godot 4.7.2 standard editor executable")
    parser.add_argument("--headless-only", action="store_true",
                        help="Run import and domain tests only; explicitly skips native UI verification")
    args = parser.parse_args()
    executable = args.godot or shutil.which("godot") or shutil.which("godot4")
    if not executable:
        parser.error("Godot not found. Set GODOT_BINARY or pass --godot /path/to/godot")
    REPORTS.mkdir(exist_ok=True)
    for name in ("domain-tests.json", "ui-smoke.json", "verification.json"):
        (REPORTS / name).unlink(missing_ok=True)
    executable = str(Path(executable).resolve())
    try:
        with tempfile.TemporaryDirectory(prefix="motorsport-manager-verification-") as user_dir:
            # A clean copy proves fresh-import behavior; a unique app name isolates user://
            # even on platforms whose user-data resolver does not honor XDG/APPDATA.
            project = Path(user_dir) / "project"
            shutil.copytree(ROOT, project, ignore=shutil.ignore_patterns(
                ".git", ".godot", "reports", "builds", "__pycache__"))
            configuration = project / "project.godot"
            configuration.write_text(configuration.read_text(encoding="utf-8").replace(
                'config/name="Motorsport Manager"',
                f'config/name="MotorsportManagerVerification-{uuid.uuid4().hex}"'), encoding="utf-8")
            (project / "reports").mkdir()
            (project / "reports" / ".gdignore").touch()
            base = [executable, "--path", str(project)]
            env = dict(os.environ, GODOT_SILENCE_ROOT_WARNING="1", LIBGL_ALWAYS_SOFTWARE="1",
                       XDG_DATA_HOME=user_dir, APPDATA=user_dir)
            run_phase("import", base + ["--headless", "--editor", "--quit"], env)
            run_phase("domain", base + ["--headless", "--script", "res://tests/run_tests.gd"], env)
            shutil.copy2(project / "reports" / "domain-tests.json", REPORTS / "domain-tests.json")
            domain = require_report("domain-tests.json")
            ui = None
            if not args.headless_only:
                command = base + ["--audio-driver", "Dummy", "--script", "res://tests/ui_smoke.gd"]
                if sys.platform.startswith("linux"):
                    xvfb = shutil.which("xvfb-run")
                    if xvfb:
                        command = [xvfb, "-a", "-s", "-screen 0 1600x1100x24"] + command
                    elif not env.get("DISPLAY"):
                        raise RuntimeError("Native UI verification needs a display or xvfb-run. "
                                           "Install xvfb and xauth, or explicitly use --headless-only.")
                try:
                    run_phase("ui", command, env)
                finally:
                    for artifact in (project / "reports").iterdir():
                        if artifact.is_file() and not artifact.name.startswith("."):
                            shutil.copy2(artifact, REPORTS / artifact.name)
                ui = require_report("ui-smoke.json")
            summary = {"passed": True, "mode": "headless-only" if args.headless_only else "full",
                       "engine": domain["engine"], "domain_checks": domain["checks"],
                       "ui_checks": ui.get("checks", 0) if ui else None,
                       "screenshots": ui["screenshots"] if ui else 0}
            (REPORTS / "verification.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
            print(json.dumps(summary, indent=2))
            return 0
    except (RuntimeError, OSError, ValueError, KeyError) as exc:
        print(f"VERIFICATION FAILED: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
