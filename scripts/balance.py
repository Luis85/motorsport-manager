#!/usr/bin/env python3
"""Inspect and tune the centralized game config with native transactional validation."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

from balance_authoring import Snapshot, edited, lookup, pointer_parts, publish, relative_file
from balance_native import NativeProject, executable, field_metadata, published_schemas
from content_operations import MAX_DIFFS, difference

ROOT = Path(__file__).resolve().parents[1]


class JsonParser(argparse.ArgumentParser):
    def error(self, message: str) -> None:
        raise ValueError(message)


def options(parser: argparse.ArgumentParser, *, child: bool = False) -> None:
    default = argparse.SUPPRESS if child else None
    parser.add_argument("--config-dir", type=Path, default=default)
    parser.add_argument("--godot", default=default)


def parser() -> argparse.ArgumentParser:
    result = JsonParser(description=__doc__)
    options(result)
    actions = result.add_subparsers(dest="action", required=True)
    for action in ("list", "inspect", "validate", "set", "diff"):
        command = actions.add_parser(action)
        options(command, child=True)
        if action == "list":
            command.add_argument("--kind")
        elif action in ("inspect", "set"):
            command.add_argument("file")
            command.add_argument("pointer", nargs="?" if action == "inspect" else None)
            if action == "set":
                command.add_argument("value", help="One JSON scalar literal")
                command.add_argument("--dry-run", action="store_true")
        elif action == "diff":
            command.add_argument("other", type=Path)
    return result


def list_files(snapshot: Snapshot, kind: str | None) -> list:
    entries = []
    for name in sorted(snapshot.files):
        if not name.endswith(".json"):
            continue
        document = snapshot.document(name)
        entry = {"file": name}
        if isinstance(document, dict):
            entry.update(
                {key: document[key] for key in ("id", "kind", "name", "title") if key in document}
            )
        if kind is None or entry.get("kind") == kind:
            entries.append(entry)
    return entries


def inspect(snapshot: Snapshot, args, schemas: dict) -> dict:
    name = relative_file(args.file)
    document = snapshot.document(name)
    result = {"file": name, "document": document}
    if args.pointer is not None:
        parts = pointer_parts(args.pointer)
        result = {
            "file": name,
            "pointer": args.pointer,
            "value": lookup(document, parts),
            "field": field_metadata(document, schemas, parts),
        }
    return result


def read_only(snapshot: Snapshot, args, root: Path) -> dict:
    result = {"ok": True, "engine_executed": False, "config_dir": str(snapshot.root)}
    if args.action == "diff":
        other = Snapshot(args.other)
        before = {
            name: snapshot.document(name) for name in snapshot.files if name.endswith(".json")
        }
        after = {name: other.document(name) for name in other.files if name.endswith(".json")}
        changes = difference(before, after)
        result.update(
            equal=not changes, changes=changes[:MAX_DIFFS], truncated=len(changes) > MAX_DIFFS
        )
        return result
    schemas = published_schemas(root)
    if executable(args.godot):
        with NativeProject(root, snapshot, args.godot) as native:
            validated = native.validate()
            if not validated.get("ok"):
                return validated
            schemas = native.schemas()
            result.update(engine_executed=True, metadata=native.identity)
    if args.action == "list":
        result["files"] = list_files(snapshot, args.kind)
    else:
        result.update(inspect(snapshot, args, schemas))
    return result


def execute(args, root: Path = ROOT) -> dict:
    snapshot = Snapshot(args.config_dir or root / "config")
    if args.action in ("list", "inspect", "diff"):
        return read_only(snapshot, args, root)
    if args.action == "validate":
        with NativeProject(root, snapshot, args.godot) as native:
            return native.validate()
    name = relative_file(args.file)
    raw, changes = edited(snapshot, name, args.pointer, args.value)
    candidate = Snapshot(snapshot.root)
    if candidate.files != snapshot.files or candidate.identities != snapshot.identities:
        raise ValueError("Config changed while staging; retry.")
    candidate.files[name] = raw
    # Candidate digest includes the staged bytes rather than the original root.
    candidate.digest = hashlib.sha256()
    for filename, data in sorted(candidate.files.items()):
        candidate.digest.update(filename.encode() + b"\0" + data + b"\0")
    with NativeProject(root, candidate, args.godot) as native:
        result = native.validate()
        if not result.get("ok"):
            return result
        try:
            schema = field_metadata(
                snapshot.document(name), native.schemas(), pointer_parts(args.pointer)
            )
            snapshot.unchanged()
            if not args.dry_run and changes:
                publish(snapshot, name, raw)
        except (ValueError, OSError, KeyError, subprocess.TimeoutExpired) as error:
            error.engine_executed = True
            error.metadata = native.identity
            raise
        result.update(
            validation=True,
            dry_run=args.dry_run,
            published=bool(changes) and not args.dry_run,
            file=name,
            changes=changes,
            field=schema,
        )
        return result


def main(argv: list[str] | None = None) -> int:
    try:
        result = execute(parser().parse_args(argv))
    except (ValueError, OSError, KeyError, subprocess.TimeoutExpired) as error:
        result = {
            "ok": False,
            "engine_executed": getattr(error, "engine_executed", False),
            "error": str(error),
        }
        if hasattr(error, "metadata"):
            result["metadata"] = error.metadata
    print(json.dumps(result, ensure_ascii=False, allow_nan=False))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
