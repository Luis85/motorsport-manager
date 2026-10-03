"""Build named desktop exports with an identified source and matching pinned templates."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

from verification_run import source_digest

ROOT = Path(__file__).resolve().parents[1]
ENGINE = "4.7.2.stable.official.ed1daf0bf"
ENGINE_SHA256 = "8d106cbe6144c2dc7e881d61d2429c1a8a76e6b22ef48bd5e48dcf934953f71e"
TEMPLATES = {
    "linux_debug.x86_64": "1a291d3d15e4180b60b0af96cf6458f11fe143636d76575ddf1e23d1a3f24f2e",
    "linux_release.x86_64": "d9f79ab89b5ae369aeed11c6052d402e8218cd503bf85b4a235f9c30c46a7c63",
    "windows_debug_x86_64.exe": "51498b72b3a237f882ebd7d1787f06a4bc1eaf0572daab93837adcfd3cfdc107",
    "windows_release_x86_64.exe": "d34d36f3be1a6c49c56525ae86469b92e4f417ddf0b43cf00dd80c385c4b0562",
}


def digest(path: Path) -> str:
    """Hash the actual bytes, including executables; never infer a toolchain identity."""
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def validate_templates(folder: Path, target: str) -> dict[str, str]:
    selected = {
        name: expected for name, expected in TEMPLATES.items() if name.startswith(target + "_")
    }
    for name, expected in selected.items():
        path = folder / name
        if not path.is_file() or digest(path) != expected:
            raise ValueError(f"Missing or different pinned export template: {path}")
    return selected


def run(arguments: list[str], log: Path, cwd: Path) -> None:
    result = subprocess.run(
        arguments,
        cwd=cwd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=180,
    )
    output = result.stdout + result.stderr
    log.write_text(output, encoding="utf-8")
    if result.returncode or "SCRIPT ERROR:" in output or "ERROR:" in output:
        raise RuntimeError(f"Export command failed; inspect {log}")


def build(
    godot: Path,
    templates: Path,
    output: Path,
    target: str,
    mode: str,
    revision: str,
    root: Path = ROOT,
) -> dict:
    """Use a clean import, then retain only a relocatable executable/PCK and provenance."""
    if not isinstance(revision, str) or not revision.strip():
        raise ValueError("Provide the actual source revision; disclose any uncommitted changes")
    if target not in ("linux", "windows") or mode not in ("debug", "release"):
        raise ValueError("Unsupported target or build mode")
    if output.exists() and any(output.iterdir()):
        raise ValueError("Output must be empty; do not mix artifacts from different builds")
    godot = godot.resolve()
    version = subprocess.run(
        [str(godot), "--version"], check=True, capture_output=True, text=True, timeout=15
    ).stdout.strip()
    if version != ENGINE:
        raise ValueError(f"Expected {ENGINE}, received {version}")
    engine_hash = digest(godot)
    if engine_hash != ENGINE_SHA256:
        raise ValueError("Export editor bytes differ from the pinned toolchain")
    selected = validate_templates(templates.resolve(), target)
    output.mkdir(parents=True, exist_ok=True)
    identity = {
        "source_revision": revision,
        "source_digest": source_digest(root),
        "engine": version,
        "engine_sha256": engine_hash,
        "templates": selected,
        "target": target,
        "mode": mode,
        "runtime_verified": False,
    }
    with tempfile.TemporaryDirectory(prefix="motorsport-export-") as temporary:
        stage = Path(temporary) / "project"
        stage.mkdir()
        # No checkout/import cache or local reports enter the export staging project.
        for directory in ("scripts", "scenes", "data", "content"):
            shutil.copytree(
                root / directory,
                stage / directory,
                ignore=shutil.ignore_patterns("__pycache__", "*.pyc"),
            )
        for name in ("project.godot", "export_presets.cfg"):
            shutil.copy2(root / name, stage / name)
        (stage / ".export-templates").mkdir()
        for name in selected:
            shutil.copy2(templates / name, stage / ".export-templates" / name)
        (stage / "build-identity.json").write_text(
            json.dumps(identity, indent=2) + "\n", encoding="utf-8"
        )
        run(
            [str(godot), "--headless", "--path", str(stage), "--editor", "--import"],
            output / "import.log",
            stage,
        )
        if source_digest(root) != identity["source_digest"]:
            raise RuntimeError("Source changed during staging; rebuild a stable source tree")
        suffix = ".exe" if target == "windows" else ".x86_64"
        binary = output / ("Motorsport Manager" + suffix)
        preset = "Windows Desktop" if target == "windows" else "Linux Desktop"
        run(
            [
                str(godot),
                "--headless",
                "--path",
                str(stage),
                f"--export-{mode}",
                preset,
                str(binary.resolve()),
            ],
            output / "export.log",
            stage,
        )
        pack = binary.with_suffix(".pck")
        if not binary.is_file() or not pack.is_file() or not pack.stat().st_size:
            raise RuntimeError("Export did not produce an executable and a non-empty PCK")
        binary.chmod(binary.stat().st_mode | 0o111)
        identity["artifacts"] = {item.name: digest(item) for item in (binary, pack)}
        identity["binary"] = binary.name
    for license_name in ("LICENSE", "THIRD_PARTY_NOTICES.md"):
        shutil.copy2(root / license_name, output / license_name)
    identity["clean_import"] = True
    (output / "build-manifest.json").write_text(
        json.dumps(identity, indent=2) + "\n", encoding="utf-8"
    )
    return identity


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--godot", type=Path, required=True)
    parser.add_argument("--templates", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--target", choices=("linux", "windows"), required=True)
    parser.add_argument("--mode", choices=("debug", "release"), required=True)
    parser.add_argument("--revision", required=True)
    args = parser.parse_args()
    try:
        result = build(
            args.godot, args.templates, args.output.resolve(), args.target, args.mode, args.revision
        )
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError) as error:
        parser.exit(2, f"Build failed: {error}\n")
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
