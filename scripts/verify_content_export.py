#!/usr/bin/env python3
"""Verify data-only edits and frozen continuation in actual Linux debug/release exports."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import tempfile
import time
from typing import Any

from verification_run import source_digest

ROOT = Path(__file__).resolve().parents[1]


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def command(args: list[str], cwd: Path, env: dict[str, str], timeout: int = 180, runtime_uid: int | None = None) -> subprocess.CompletedProcess[str]:
    identity = {} if runtime_uid is None else {"user": runtime_uid, "group": runtime_uid}
    result = subprocess.run(args, cwd=cwd, env=env, capture_output=True, text=True, timeout=timeout, **identity)
    log = result.stdout + "\n" + result.stderr
    if any(marker in log for marker in ["SCRIPT ERROR:", "Parse Error:", "ERROR:"]):
        raise RuntimeError("Engine error: " + log[-6000:])
    return result


def probe(executable: Path, args: list[str], cwd: Path, env: dict[str, str], expected: bool = True, runtime_uid: int | None = None) -> dict[str, Any]:
    result = command([str(executable), "--headless", "--", *args], cwd, env, runtime_uid=runtime_uid)
    lines = [line.removeprefix("CONTENT_RESULT ") for line in result.stdout.splitlines()
             if line.startswith("CONTENT_RESULT ")]
    if len(lines) != 1:
        raise RuntimeError("Expected one runtime result: " + result.stdout + result.stderr)
    value = json.loads(lines[0])
    if value.get("ok") is not expected or result.returncode != (0 if expected else 1):
        raise RuntimeError("Unexpected runtime acceptance: " + json.dumps(value))
    return value


def verify(godot: Path, output: Path) -> dict[str, Any]:
    output.mkdir(parents=True, exist_ok=True)
    environment = {**os.environ, "GODOT_SILENCE_ROOT_WARNING": "1", "LP_NUM_THREADS": "2"}
    version = command([str(godot), "--version"], ROOT, environment).stdout.strip()
    imported = command([str(godot), "--headless", "--editor", "--path", str(ROOT), "--import", "--quit"], ROOT, environment)
    if imported.returncode:
        raise RuntimeError("Import failed: " + imported.stdout + imported.stderr)
    results = []
    for mode in ["debug", "release"]:
        executable = output / ("motorsport-manager-" + mode + ".x86_64")
        started = time.monotonic()
        exported = command([str(godot), "--headless", "--path", str(ROOT), "--export-" + mode,
                            "Linux", str(executable)], ROOT, environment)
        (output / (mode + "-export.log")).write_text(exported.stdout + exported.stderr, encoding="utf-8")
        if exported.returncode or not executable.is_file():
            raise RuntimeError("Export failed: " + exported.stdout + exported.stderr)
        executable.chmod(executable.stat().st_mode | 0o100)
        original_hash = digest(executable)
        with tempfile.TemporaryDirectory(prefix="mm-export-acceptance-") as temporary:
            isolated = Path(temporary)
            isolated.chmod(0o755)
            user = isolated / "independent user home"
            user.mkdir()
            runtime_uid = 65534 if os.geteuid() == 0 else None
            if runtime_uid is not None:
                os.chown(user, runtime_uid, runtime_uid)
            install = isolated / "Read Only Installation"
            install.mkdir()
            installed = install / executable.name
            shutil.copy2(executable, installed)
            installed.chmod(0o555)
            install.chmod(0o555)
            for target in [install, installed]:
                writable = command(["test", "-w", str(target)], isolated, env=environment, runtime_uid=runtime_uid)
                if writable.returncode != 1:
                    raise RuntimeError("Runtime identity can still write the installation: " + str(target))
            env = {**environment, "HOME": str(user), "XDG_DATA_HOME": str(user / "data"),
                   "XDG_CONFIG_HOME": str(user / "config"), "XDG_CACHE_HOME": str(user / "cache")}
            pack = isolated / "München club content"
            shutil.copytree(ROOT / "content/examples/club-racing", pack)
            args = ["--content-pack=" + str(pack), "--content-probe=local.club.vehicle.sport",
                    "--content-probe-roster_id=local.club.roster.expanded",
                    "--content-probe-tyre_allocation_id=local.club.tyre_allocation.endurance",
                    "--content-probe-setup_id=local.club.setup.club"]
            first = probe(installed, args, isolated, env, runtime_uid=runtime_uid)
            if (first["top_speed_mps"] != 55 or first["field_size"] != 14
                    or first["player_ids"] != [12, 13] or first["sets_per_driver"] != 10
                    or first["compound_count"] != 6 or first["compound_wear"] != 2.7
                    or first["wing"] != 3 or first["starting_compound"] != "local.club.tyre.endurance"):
                raise RuntimeError("The first run did not use the authored vehicle, roster, allocation and setup.")
            definition = pack / "vehicles/sport.json"
            data = json.loads(definition.read_text(encoding="utf-8"))
            data["top_speed_mps"] = 56
            definition.write_text(json.dumps(data), encoding="utf-8")
            tyre_path = pack / "tyres/endurance.json"
            tyre = json.loads(tyre_path.read_text(encoding="utf-8"))
            tyre["wear"] = 2.8
            tyre_path.write_text(json.dumps(tyre), encoding="utf-8")
            setup_path = pack / "setups/club.json"
            setup = json.loads(setup_path.read_text(encoding="utf-8"))
            setup["controls"]["wing"]["default"] = 4
            setup_path.write_text(json.dumps(setup), encoding="utf-8")
            edited = probe(installed, args, isolated, env, runtime_uid=runtime_uid)
            if (edited["top_speed_mps"] != 56 or edited["compound_wear"] != 2.8 or edited["wing"] != 4
                    or any(first[key] == edited[key] for key in ["definition_hash", "tyre_content_hash", "setup_content_hash"])):
                raise RuntimeError("The unchanged executable did not observe the external edit.")
            data["top_speed_mps"] = -1
            definition.write_text(json.dumps(data), encoding="utf-8")
            rejected = probe(installed, ["--content-pack=" + str(pack), "--content-validate"], isolated, env, False, runtime_uid)
            shutil.rmtree(pack)
            restored = probe(installed, ["--content-probe-restore"], isolated, env, runtime_uid=runtime_uid)
            if restored != edited:
                raise RuntimeError("A removed/invalid pack changed the saved session.")
            if digest(executable) != original_hash or digest(installed) != original_hash:
                raise RuntimeError("Acceptance modified the executable.")
            results.append({"mode": mode, "passed": True, "executable_sha256": original_hash,
                            "source_directory_present_in_cwd": False, "installation_writable": False,
                            "runtime_uid": runtime_uid if runtime_uid is not None else os.geteuid(),
                            "unicode_and_space_path": True, "first": first, "edited": edited,
                            "restored_without_pack": restored, "rejection": rejected,
                            "seconds": round(time.monotonic() - started, 3)})
            install.chmod(0o755)
    return {"passed": True, "source": source_digest(ROOT), "engine": version, "platform": platform.platform(),
            "engine_sha256": digest(godot), "exports": results,
            "scope": "Linux native headless execution; not Windows execution or human visual acceptance."}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--godot", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=ROOT / "reports/content-export")
    args = parser.parse_args()
    try:
        result = verify(args.godot.resolve(strict=True), args.output.resolve())
    except (OSError, RuntimeError, ValueError, subprocess.TimeoutExpired) as error:
        result = {"passed": False, "error": str(error)}
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "acceptance.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
