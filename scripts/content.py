#!/usr/bin/env python3
"""Author external Motorsport Manager content using its production Godot validator."""
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
from typing import Any

import content_operations

ROOT = Path(__file__).resolve().parents[1]
IDENTITY = re.compile(r"[a-z][a-z0-9_-]*(?:\.[a-z0-9_-]+)+\Z")
PACK_ID = re.compile(r"[a-z][a-z0-9_-]*(?:\.[a-z0-9_-]+)*\Z")


def encode(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n"


def write_new(path: Path, value: Any) -> None:
    # Encode before creating anything; an invalid value must not leave an empty file.
    text = encode(value)
    with path.open("x", encoding="utf-8") as file:
        try:
            file.write(text)
            file.flush()
        except OSError:
            path.unlink(missing_ok=True)
            raise


def invoke_engine(arguments: list[str], godot: str | None) -> dict[str, Any]:
    executable = godot or os.environ.get("GODOT_BINARY") or shutil.which("godot")
    if not executable:
        raise ValueError("Pass --godot /path/to/Godot or set GODOT_BINARY. No validation was executed.")
    # A bare --godot/GODOT_BINARY value is a command name, not a cwd-relative path.
    if not Path(executable).is_absolute() and not any(sep in executable for sep in ("/", "\\")):
        executable = shutil.which(executable)
        if not executable:
            raise ValueError("Godot command was not found on PATH. No validation was executed.")
    executable = str(Path(executable).resolve())
    environment = {**os.environ, "GODOT_SILENCE_ROOT_WARNING": "1", "LP_NUM_THREADS": "2"}
    commands = [
        [executable, "--headless", "--editor", "--path", str(ROOT), "--import", "--quit"],
        [executable, "--headless", "--path", str(ROOT), "--script",
         "res://scripts/services/content/cli.gd", "--", *arguments],
    ]
    result: dict[str, Any] | None = None
    for index, command in enumerate(commands):
        run = subprocess.run(command, text=True, capture_output=True, timeout=120, env=environment)
        log = run.stdout + "\n" + run.stderr
        fatal = any(marker in log for marker in ["SCRIPT ERROR:", "Parse Error:", "ERROR:"])
        if index == 0:
            if run.returncode or fatal:
                raise ValueError("Godot import failed; validation was not executed.\n" + log[-6000:])
            continue
        payloads = [line.removeprefix("CONTENT_RESULT ") for line in run.stdout.splitlines()
                    if line.startswith("CONTENT_RESULT ")]
        if len(payloads) != 1 or fatal:
            raise ValueError("Validator failed to produce one clean result.\n" + log[-6000:])
        result = json.loads(payloads[0])
        if not isinstance(result, dict) or type(result.get("ok")) is not bool:
            raise ValueError("Validator result must be an object with an explicit Boolean ok field.")
        if run.returncode != (0 if result.get("ok") else 1):
            raise ValueError("Validator exit status disagrees with its result.")
    if result is None:
        raise ValueError("No validator result was produced.")
    result["engine_executed"] = True
    return result


def pack_arguments(path: Path | None, dependencies: list[Path] | None = None) -> list[str]:
    """Keep explicit dependency order; the production loader alone resolves definitions."""
    roots = list(dependencies or []) + ([path] if path is not None else [])
    result: list[str] = []
    seen: set[str] = set()
    core = (ROOT / "content/packs/core").resolve()
    for root in roots:
        resolved = root.resolve()
        key = os.path.normcase(str(resolved))
        if key in seen:
            raise ValueError("Pack directory selected more than once: " + str(resolved))
        seen.add(key)
        if resolved != core:
            result.append("--pack=" + str(resolved))
    return result


def initialize(path: Path, identity: str) -> dict[str, Any]:
    if len(identity) > 96 or not PACK_ID.fullmatch(identity):
        raise ValueError("Use a lowercase pack ID, for example local.club.")
    path.mkdir(parents=True, exist_ok=False)
    write_new(path / "pack.json", {
        "kind": "motorsport-manager-content-pack", "schema_version": 1,
        "id": identity, "version": "1.0.0", "runtime_contract": 1,
        "dependencies": [{"id": "core", "version": "1.0.0"}],
        "files": [], "overrides": [],
    })
    return {"ok": True, "created": str(path / "pack.json"), "engine_executed": False}


def clone_definition(path: Path, source: str, identity: str, godot: str | None,
                     dependencies: list[Path] | None = None) -> dict[str, Any]:
    if len(identity) > 96 or not IDENTITY.fullmatch(identity):
        raise ValueError("Use a namespaced definition ID of at most 96 characters, for example local.club.vehicle.sport.")
    path = path.resolve(strict=True)
    manifest_path = path / "pack.json"
    if manifest_path.is_symlink():
        raise ValueError("The pack manifest cannot be a symbolic link.")
    lock = path / ".content-author.lock"
    with lock.open("x"):
        pass
    created: Path | None = None
    temporary: str | None = None
    try:
        # Snapshot BEFORE validation, under the cooperative lock. Never splice an
        # inspected definition into a different, subsequently read manifest.
        with manifest_path.open("rb") as stream:
            before = stream.read(1048577)
        if len(before) > 1048576:
            raise ValueError("The pack manifest exceeds the 1 MiB content limit.")
        result = invoke_engine(["--action=inspect", "--id=" + source,
                                *pack_arguments(path, dependencies)], godot)
        if not result.get("ok"):
            return result
        if manifest_path.is_symlink() or manifest_path.read_bytes() != before:
            raise ValueError("Pack changed during validation; retry against the new manifest.")
        if any(entry["id"] == identity for entry in result.get("definitions", [])):
            raise ValueError("The destination ID is already defined; choose another ID.")
        manifest = json.loads(before)
        if not identity.startswith(manifest["id"] + "."):
            raise ValueError("The new ID must use the destination pack's namespace.")
        value = dict(result["inspection"]["definition"])
        value["id"] = identity
        if value["kind"] == "circuit":
            value["document"] = {**value["document"], "id": identity}
        target = path / (value["kind"] + "s")
        if target.is_symlink():
            raise ValueError("The destination directory cannot be a symbolic link.")
        target.mkdir(exist_ok=True)
        filename = target / (identity + ".json")
        relative = filename.relative_to(path).as_posix()
        write_new(filename, value)
        created = filename
        manifest["files"].append(relative)
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path, delete=False) as file:
            temporary = file.name
            file.write(encode(manifest))
        if manifest_path.is_symlink() or manifest_path.read_bytes() != before:
            raise ValueError("Pack changed before publication; retry against the new manifest.")
        os.replace(temporary, manifest_path)
        temporary = None
        created = None
    finally:
        if created is not None:
            created.unlink(missing_ok=True)
        if temporary:
            Path(temporary).unlink(missing_ok=True)
        lock.unlink()
    return {"ok": True, "created": str(filename), "source": source,
            "engine_executed": True, "next": "Edit the new definition, then validate the pack."}


def schemas(godot: str | None, check: bool) -> dict[str, Any]:
    result = invoke_engine(["--action=schemas"], godot)
    if not result.get("ok"):
        return result
    directory = ROOT / "content/schemas/v1"
    if not check:
        directory.mkdir(parents=True, exist_ok=True)
    changed = []
    for kind, value in result["schemas"].items():
        path = directory / (kind + ".schema.json")
        text = encode(value)
        if not path.exists() or path.read_text(encoding="utf-8") != text:
            changed.append(str(path.relative_to(ROOT)))
            if not check:
                path.write_text(text, encoding="utf-8")
    return {"ok": not changed if check else True, "changed": changed,
            "engine_executed": True, "check_only": check}


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description=__doc__)
    commands = root.add_subparsers(dest="action", required=True)
    initial = commands.add_parser("init", help="Create a new folder pack without overwriting files.")
    initial.add_argument("path", type=Path)
    initial.add_argument("--id", required=True)
    clone = commands.add_parser("clone", help="Copy an existing validated definition under a new ID.")
    clone.add_argument("source")
    clone.add_argument("--as", dest="identity", required=True)
    clone.add_argument("--pack", type=Path, required=True)
    clone.add_argument("--godot")
    clone.add_argument("--dependency", type=Path, action="append", default=[],
                       help="Load a dependency pack before the destination; repeat in dependency order.")
    for action in ["validate", "inspect"]:
        command = commands.add_parser(action)
        command.add_argument("path", nargs="?", type=Path)
        command.add_argument("--pack", dest="packs", type=Path, action="append", default=[],
                             help="Load this pack before the positional pack; repeat in dependency order.")
        command.add_argument("--godot")
        command.add_argument("--format", choices=["json", "text"], default="text")
        if action == "inspect":
            command.add_argument("--id", required=True)
    for action in ["list", "export", "test"]:
        command = commands.add_parser(action)
        command.add_argument("path", nargs="?", type=Path)
        command.add_argument("--pack", dest="packs", type=Path, action="append", default=[],
                             help="Load this pack before the positional pack; repeat in dependency order.")
        command.add_argument("--godot")
        command.add_argument("--format", choices=["json", "text"], default="json")
        if action == "list":
            command.add_argument("--kind")
        elif action == "export":
            command.add_argument("--output", type=Path, required=True)
        else:
            command.add_argument("--scenario", required=True)
            command.add_argument("--steps", type=int, default=1600)
    comparison = commands.add_parser("diff")
    comparison.add_argument("before", type=Path)
    comparison.add_argument("after", type=Path)
    comparison.add_argument("--godot")
    comparison.add_argument("--pack", dest="packs", type=Path, action="append", default=[],
                            help="Common dependency pack; repeat in dependency order.")
    for side in ("before", "after"):
        comparison.add_argument("--" + side + "-pack", type=Path, action="append", default=[],
                                help="Additional dependency pack for this side, after common dependencies.")
    schema = commands.add_parser("schemas", help="Publish or check the generated JSON Schemas.")
    schema.add_argument("--godot")
    schema.add_argument("--check", action="store_true")
    return root


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        if args.action in {"list", "export", "diff", "test"}:
            result = content_operations.execute(args, invoke_engine, pack_arguments)
        elif args.action == "init":
            result = initialize(args.path, args.id)
        elif args.action == "clone":
            result = clone_definition(args.pack, args.source, args.identity, args.godot, args.dependency)
        elif args.action == "schemas":
            result = schemas(args.godot, args.check)
        else:
            options = ["--action=" + args.action, *pack_arguments(args.path, args.packs)]
            if args.action == "inspect":
                options.append("--id=" + args.id)
            result = invoke_engine(options, args.godot)
    except (OSError, ValueError, subprocess.TimeoutExpired) as error:
        result = {"ok": False, "error": str(error)}
    if getattr(args, "format", "json") == "text" and "diagnostics" in result:
        print("Content accepted." if result["ok"] else "Content rejected; nothing was activated.")
        for diagnostic in result["diagnostics"]:
            print(f"{diagnostic['code']} {diagnostic.get('file', '')}{diagnostic['field']}: {diagnostic['message']}")
        if "inspection" in result:
            print(encode(result["inspection"]), end="")
        if args.action == "list":
            for item in result.get("definitions", []):
                print(f"{item['kind']}  {item['id']}  {item['name']}")
        if args.action == "test":
            print(encode({key: value for key, value in result.items() if key not in {"definitions", "kinds", "diagnostics"}}), end="")
    else:
        print(encode(result), end="")
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
