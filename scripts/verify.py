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


def run_phase(name: str, command: list[str], env: dict[str, str], timeout: int = 360) -> None:
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
    for name in ("domain-tests.json", "ui-smoke.json", "weekend-strategy-tests.json", "strategy-scenarios.json", "strategy-ui.json", "living-racecraft-tests.json", "living-racecraft-ui.json", "weather-tests.json", "weather-scenario.json", "weather-ui.json", "recovery-tests.json", "recovery-scenarios.json", "recovery-ui.json", "compact-ui.json", "pitwall-ux.json", "ux-performance-current.json", "practice-tests.json", "practice-scenario.json", "practice-ui.json", "rival-styles-tests.json", "rival-scenarios.json", "rivals-ui.json", "workspace-performance.json", "verification.json", "replay-tests.json", "replay-scenario.json", "replay-ui.json", "replay-performance.json", "scenario-authoring-runs.json", "scenario-authoring-ui.json", "notebook-tests.json", "notebook-ui.json", "notebook-performance.json"):
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
            run_phase("strategy", base + ["--headless", "--script", "res://tests/weekend_strategy_tests.gd"], env)
            shutil.copy2(project / "reports" / "weekend-strategy-tests.json", REPORTS / "weekend-strategy-tests.json")
            strategy = require_report("weekend-strategy-tests.json")
            run_phase("scenarios", base + ["--headless", "--script", "res://tests/strategy_scenario_runs.gd"], env)
            shutil.copy2(project / "reports" / "strategy-scenarios.json", REPORTS / "strategy-scenarios.json")
            scenarios = require_report("strategy-scenarios.json")
            run_phase("living-racecraft", base + ["--headless", "--script", "res://tests/living_racecraft_tests.gd"], env)
            shutil.copy2(project / "reports" / "living-racecraft-tests.json", REPORTS / "living-racecraft-tests.json")
            living = require_report("living-racecraft-tests.json")
            run_phase("weather", base + ["--headless", "--script", "res://tests/weather_tests.gd"], env)
            shutil.copy2(project / "reports" / "weather-tests.json", REPORTS / "weather-tests.json")
            weather = require_report("weather-tests.json")
            run_phase("weather-scenario", base + ["--headless", "--script", "res://tests/weather_scenario_runs.gd"], env)
            shutil.copy2(project / "reports" / "weather-scenario.json", REPORTS / "weather-scenario.json")
            weather_scenario = require_report("weather-scenario.json")
            run_phase("recovery", base + ["--headless", "--script", "res://tests/recovery_tests.gd"], env)
            shutil.copy2(project / "reports" / "recovery-tests.json", REPORTS / "recovery-tests.json")
            recovery = require_report("recovery-tests.json")
            run_phase("recovery-scenarios", base + ["--headless", "--script", "res://tests/recovery_scenario_runs.gd"], env)
            shutil.copy2(project / "reports" / "recovery-scenarios.json", REPORTS / "recovery-scenarios.json")
            recovery_scenarios = require_report("recovery-scenarios.json")
            run_phase("practice", base + ["--headless", "--script", "res://tests/practice_tests.gd"], env)
            shutil.copy2(project / "reports" / "practice-tests.json", REPORTS / "practice-tests.json")
            practice = require_report("practice-tests.json")
            run_phase("practice-scenario", base + ["--headless", "--script", "res://tests/practice_scenario_runs.gd"], env)
            shutil.copy2(project / "reports" / "practice-scenario.json", REPORTS / "practice-scenario.json")
            practice_scenario = require_report("practice-scenario.json")
            for phase, script, report in [("rival-styles", "rival_styles_tests.gd", "rival-styles-tests.json"), ("rival-scenarios", "rival_scenario_runs.gd", "rival-scenarios.json")]:
                run_phase(phase, base + ["--headless", "--script", "res://tests/" + script], env)
                shutil.copy2(project / "reports" / report, REPORTS / report)
            rivals = require_report("rival-styles-tests.json")
            rival_scenarios = require_report("rival-scenarios.json")
            for phase, script, report in [("replay-domain", "replay_tests.gd", "replay-tests.json"), ("replay-scenario", "replay_scenario_runs.gd", "replay-scenario.json"), ("replay-performance", "replay_performance.gd", "replay-performance.json")]:
                run_phase(phase, base + ["--headless", "--script", "res://tests/" + script], env)
                shutil.copy2(project / "reports" / report, REPORTS / report)
            replay = require_report("replay-tests.json")
            replay_scenario = require_report("replay-scenario.json")
            replay_performance = require_report("replay-performance.json")
            run_phase("scenario-authoring", base + ["--headless", "--script", "res://tests/scenario_authoring_runs.gd"], env, timeout=600)
            shutil.copy2(project / "reports" / "scenario-authoring-runs.json", REPORTS / "scenario-authoring-runs.json")
            authoring = require_report("scenario-authoring-runs.json")
            authoring_ui = None
            # Keep notebook coverage alongside the merged scenario-authoring suites.
            run_phase("notebook", base + ["--headless", "--script", "res://tests/notebook_tests.gd"], env)
            for report in ["notebook-tests.json", "notebook-performance.json"]:
                shutil.copy2(project / "reports" / report, REPORTS / report)
            notebook = require_report("notebook-tests.json")
            notebook_ui = None
            replay_ui = None
            rivals_ui = None
            workspace_performance = None
            practice_ui = None
            recovery_ui = None
            weather_ui = None
            compact_ui = None
            pitwall_ui = None
            performance = None
            living_ui = None
            ui = None
            strategy_ui = None
            if not args.headless_only:
                command = base + ["--audio-driver", "Dummy", "--script", "res://tests/ui_smoke.gd"]
                if sys.platform.startswith("linux"):
                    xvfb = shutil.which("xvfb-run")
                    if xvfb:
                        command = [xvfb, "-a", "-s", "-screen 0 2000x1200x24"] + command
                    elif not env.get("DISPLAY"):
                        raise RuntimeError("Native UI verification needs a display or xvfb-run. "
                                           "Install xvfb and xauth, or explicitly use --headless-only.")
                try:
                    run_phase("ui", command, env)
                    strategy_command = [part.replace("res://tests/ui_smoke.gd", "res://tests/strategy_ui_smoke.gd") for part in command]
                    run_phase("strategy-ui", strategy_command, env)
                    living_command = [part.replace("res://tests/ui_smoke.gd", "res://tests/living_racecraft_ui.gd") for part in command]
                    run_phase("living-racecraft-ui", living_command, env)
                    weather_command = [part.replace("res://tests/ui_smoke.gd", "res://tests/weather_ui_smoke.gd") for part in command]
                    run_phase("weather-ui", weather_command, env)
                    recovery_command = [part.replace("res://tests/ui_smoke.gd", "res://tests/recovery_ui_smoke.gd") for part in command]
                    run_phase("recovery-ui", recovery_command, env)
                    compact_command = [part.replace("res://tests/ui_smoke.gd", "res://tests/compact_ui_tests.gd") for part in command]
                    run_phase("compact-ui", compact_command, env)
                    pitwall_command = [part.replace("res://tests/ui_smoke.gd", "res://tests/pitwall_ux_tests.gd") for part in command]
                    run_phase("pitwall-ux", pitwall_command, env)
                    practice_command = [part.replace("res://tests/ui_smoke.gd", "res://tests/practice_ui_smoke.gd") for part in command]
                    run_phase("practice-ui", practice_command, env)
                    for phase, script in [("rivals-ui", "rivals_ui_tests.gd"), ("workspace-performance", "workspace_performance.gd"), ("replay-ui", "replay_ui_tests.gd"), ("scenario-authoring-ui", "scenario_authoring_ui.gd"), ("notebook-ui", "notebook_ui_tests.gd")]:
                        run_phase(phase, [part.replace("res://tests/ui_smoke.gd", "res://tests/" + script) for part in command], env)
                    performance_command = [part.replace("res://tests/ui_smoke.gd", "res://tests/ux_performance.gd") for part in command]
                    run_phase("ux-performance", performance_command, env)
                finally:
                    for artifact in (project / "reports").iterdir():
                        if artifact.is_file() and not artifact.name.startswith("."):
                            shutil.copy2(artifact, REPORTS / artifact.name)
                ui = require_report("ui-smoke.json")
                strategy_ui = require_report("strategy-ui.json")
                living_ui = require_report("living-racecraft-ui.json")
                weather_ui = require_report("weather-ui.json")
                recovery_ui = require_report("recovery-ui.json")
                compact_ui = require_report("compact-ui.json")
                pitwall_ui = require_report("pitwall-ux.json")
                practice_ui = require_report("practice-ui.json")
                performance = require_report("ux-performance-current.json")
                replay_ui = require_report("replay-ui.json")
                authoring_ui = require_report("scenario-authoring-ui.json")
                notebook_ui = require_report("notebook-ui.json")
                rivals_ui = require_report("rivals-ui.json")
                workspace_performance = require_report("workspace-performance.json")
            summary = {"notebook_checks": notebook["checks"],
                       "notebook_ui_checks": notebook_ui["checks"] if notebook_ui else None,
                       "authoring_checks": authoring["checks"],
                       "authoring_ui_checks": authoring_ui["checks"] if authoring_ui else None,
                       "passed": True, "mode": "headless-only" if args.headless_only else "full",
                       "replay_checks": replay["checks"], "replay_scenario_checks": replay_scenario["checks"],
                       "replay_performance_checks": replay_performance["checks"], "replay_ui_checks": replay_ui["checks"] if replay_ui else None,
                       "engine": domain["engine"], "domain_checks": domain["checks"],
                       "ui_checks": ui.get("checks", 0) if ui else None,
                       "strategy_checks": strategy["checks"], "scenario_checks": scenarios["checks"],
                       "strategy_ui_checks": strategy_ui["checks"] if strategy_ui else None,
                       "living_racecraft_checks": living["checks"],
                       "living_ui_checks": living_ui["checks"] if living_ui else None,
                       "weather_checks": weather["checks"], "weather_scenario_checks": weather_scenario["checks"],
                       "weather_ui_checks": weather_ui["checks"] if weather_ui else None,
                       "recovery_checks": recovery["checks"],
                       "recovery_scenario_checks": recovery_scenarios["checks"],
                       "recovery_ui_checks": recovery_ui["checks"] if recovery_ui else None,
                       "compact_ui_checks": compact_ui["checks"] if compact_ui else None,
                       "pitwall_ux_checks": pitwall_ui["checks"] if pitwall_ui else None,
                       "practice_checks": practice["checks"],
                       "practice_scenario_checks": practice_scenario["checks"],
                       "practice_ui_checks": practice_ui["checks"] if practice_ui else None,
                       "rival_style_checks": rivals["checks"], "rival_scenario_checks": rival_scenarios["checks"],
                       "rivals_ui_checks": rivals_ui["checks"] if rivals_ui else None,
                       "workspace_performance_checks": workspace_performance["checks"] if workspace_performance else None,
                       "performance_observational": performance["observational"] if performance else None,
                       "screenshots": (notebook_ui["screenshots"] + authoring_ui["screenshots"] + replay_ui["screenshots"] + rivals_ui["screenshots"] + practice_ui["screenshots"] + recovery_ui["screenshots"] + pitwall_ui["screenshots"] + compact_ui["screenshots"] + ui["screenshots"] + strategy_ui["screenshots"] + living_ui["screenshots"] + weather_ui["screenshots"]) if ui else 0}
            (REPORTS / "verification.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
            print(json.dumps(summary, indent=2))
            return 0
    except (RuntimeError, OSError, ValueError, KeyError) as exc:
        print(f"VERIFICATION FAILED: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
