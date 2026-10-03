"""Execute a relocated desktop build through isolated restart and real recovery journeys."""

from __future__ import annotations

import argparse
import json
import os
import platform
import shutil
import signal
import subprocess
import tempfile
import time
import uuid
from pathlib import Path

from build_standalone import digest

STAGES = (
    "create",
    "resume",
    "reload",
    "interrupt-temp",
    "recover-temp",
    "interrupt-backup",
    "recover-backup",
    "retry",
)
IDENTITY_FIELDS = ("source_revision", "source_digest", "engine", "target", "mode")


def validate_package(folder: Path) -> dict:
    manifest = json.loads((folder / "build-manifest.json").read_text(encoding="utf-8"))
    expected_name = (
        "Motorsport Manager.exe"
        if manifest.get("target") == "windows"
        else "Motorsport Manager.x86_64"
    )
    if manifest.get("binary") != expected_name:
        raise ValueError("Manifest does not identify the supported desktop executable")
    files = manifest.get("artifacts")
    if not isinstance(files, dict) or set(files) != {expected_name, "Motorsport Manager.pck"}:
        raise ValueError("Manifest must identify exactly the executable and its PCK")
    for name, expected in files.items():
        if digest(folder / name) != expected:
            raise ValueError(f"Packaged artifact hash differs: {name}")
    if not all(manifest.get(field) for field in IDENTITY_FIELDS):
        raise ValueError("Package provenance is incomplete")
    return manifest


def stop(process: subprocess.Popen) -> None:
    """Terminate only the owned process tree, including its dedicated virtual display."""
    if process.poll() is not None:
        return
    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/PID", str(process.pid), "/T", "/F"],
            capture_output=True,
            check=False,
            timeout=15,
        )
    else:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    process.wait(timeout=15)


def run_stage(
    binary: Path, directory: Path, user: Path, output: Path, stage: str, env: dict[str, str]
) -> dict:
    arguments = [str(binary), "--audio-driver", "Dummy", "--", f"--standalone-smoke={stage}"]
    if os.name != "nt":
        xvfb = shutil.which("xvfb-run")
        if not xvfb and not env.get("DISPLAY"):
            raise ValueError(
                "Native smoke requires a real display or xvfb-run; headless is not equivalent"
            )
        if xvfb:
            arguments = [xvfb, "-a", "-s", "-screen 0 2000x1200x24", *arguments]
    interrupted = stage.startswith("interrupt-")
    marker = user / "replacement-paused"
    if interrupted and marker.exists():
        marker.unlink()
    options = (
        {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP}
        if os.name == "nt"
        else {"start_new_session": True}
    )
    log = output / (stage + ".log")
    with log.open("w", encoding="utf-8") as stream:
        process = subprocess.Popen(
            arguments, cwd=directory, env=env, stdout=stream, stderr=subprocess.STDOUT, **options
        )
        try:
            if interrupted:
                deadline = time.monotonic() + 90
                while (
                    not marker.exists() and process.poll() is None and time.monotonic() < deadline
                ):
                    time.sleep(0.05)
                if not marker.exists() or marker.read_text(encoding="utf-8") != stage.removeprefix(
                    "interrupt-"
                ):
                    raise RuntimeError(f"Real replacement boundary was not reached; inspect {log}")
                stop(process)
                return {
                    "stage": stage,
                    "passed": True,
                    "checks": 1,
                    "process_terminated_at_real_boundary": marker.read_text(encoding="utf-8"),
                }
            code = process.wait(timeout=180)
            text = log.read_text(encoding="utf-8")
            report_path = output / (stage + ".json")
            if code or "SCRIPT ERROR:" in text or "ERROR:" in text or not report_path.is_file():
                raise RuntimeError(f"Packaged journey failed at {stage}; inspect {log}")
            report = json.loads(report_path.read_text(encoding="utf-8"))
            if report.get("passed") is not True or not report.get("checks"):
                raise RuntimeError(f"Missing or failed packaged checks at {stage}")
            return report
        finally:
            stop(process)


def smoke(package: Path, output: Path) -> dict:
    manifest = validate_package(package)
    target = "windows" if os.name == "nt" else "linux"
    if platform.system() not in ("Linux", "Windows") or target != manifest["target"]:
        raise ValueError(
            "Runtime acceptance requires execution on the target OS, not cross-building"
        )
    if output.exists() and any(output.iterdir()):
        raise ValueError("Evidence output must be empty; old reports are not acceptance")
    output.mkdir(parents=True, exist_ok=True)
    result = {
        "passed": False,
        "build": manifest,
        "host": platform.platform(),
        "runtime_verified": False,
        "stages": [],
    }
    with tempfile.TemporaryDirectory(prefix="motorsport-packaged-") as temporary:
        clean = Path(temporary) / "Clean application – Ω"
        clean.mkdir()
        for name in manifest["artifacts"]:
            shutil.copy2(package / name, clean / name)
        # Neither project.godot nor source scripts nor .godot import state is present.
        if set(p.name for p in clean.iterdir()) != set(manifest["artifacts"]):
            raise ValueError("Relocated application directory contains unexpected source data")
        env = dict(os.environ)
        if target == "linux":
            env["XDG_DATA_HOME"] = str(Path(temporary) / "Isolated data – Ω")
            user = Path(env["XDG_DATA_HOME"]) / "godot/app_userdata/Motorsport Manager"
        else:
            # Godot's Windows known-folder API need not honor an APPDATA override.
            # Execute only on a disposable CI host whose actual application slot is absent.
            if env.get("GITHUB_ACTIONS") != "true" or not env.get("APPDATA"):
                raise ValueError(
                    "Windows smoke requires a disposable GitHub runner, not a personal user profile"
                )
            user = Path(env["APPDATA"]) / "Godot/app_userdata/Motorsport Manager"
        if user.exists():
            raise ValueError(f"Refusing to touch an existing user-data directory: {user}")
        env.update(
            MOTORSPORT_SMOKE_USER_DIR=str(user),
            MOTORSPORT_SMOKE_TOKEN=uuid.uuid4().hex,
            MOTORSPORT_SMOKE_EVIDENCE=str(output),
            LP_NUM_THREADS="2",
        )
        try:
            for stage in STAGES:
                report = run_stage(clean / manifest["binary"], clean, user, output, stage, env)
                if not stage.startswith("interrupt-"):
                    if any(
                        report.get("build", {}).get(key) != manifest[key] for key in IDENTITY_FIELDS
                    ):
                        raise RuntimeError(
                            "Executed resource pack belongs to another source or mode"
                        )
                    if report.get("debug_build") != (manifest["mode"] == "debug"):
                        raise RuntimeError("Executed template has the wrong debug/release feature")
                result["stages"].append(report)
            if any(
                digest(clean / name) != expected for name, expected in manifest["artifacts"].items()
            ):
                raise RuntimeError("Journey modified its executable or resource pack")
            result.update(
                passed=True,
                runtime_verified=True,
                checks=sum(row["checks"] for row in result["stages"]),
                source_checkout_present=False,
                import_cache_present=False,
            )
        finally:
            if user.exists():
                shutil.copytree(user, output / "user-data", ignore=shutil.ignore_patterns("logs"))
            (output / "standalone-acceptance.json").write_text(
                json.dumps(result, indent=2) + "\n", encoding="utf-8"
            )
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--package", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        report = smoke(args.package.resolve(), args.output.resolve())
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError) as error:
        parser.exit(2, f"Standalone acceptance failed: {error}\n")
    print(json.dumps({key: value for key, value in report.items() if key != "stages"}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
