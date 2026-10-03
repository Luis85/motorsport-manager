"""Read-only authoring operations over results of the production content compiler."""

from __future__ import annotations

import json
import math
import os
import tempfile
from pathlib import Path
from typing import Any, Callable

MAX_DIFFS = 256


def reject_constant(value: str) -> Any:
    raise ValueError("Non-finite JSON number is not supported: " + value)


def finite_float(literal: str) -> float:
    value = float(literal)
    if not math.isfinite(value):
        raise ValueError("Non-finite JSON number is not supported: " + literal)
    return value


def write_new_json(path: Path, value: Any, *, sort_keys: bool = False) -> None:
    """Never overwrite a file and remove our partial file on failed writes."""
    text = (
        json.dumps(value, ensure_ascii=False, sort_keys=sort_keys, indent=2, allow_nan=False) + "\n"
    )
    identity: os.stat_result | None = None
    try:
        with path.open("x", encoding="utf-8") as stream:
            identity = os.fstat(stream.fileno())
            stream.write(text)
            stream.flush()
            os.fsync(stream.fileno())
    except BaseException:
        # The handle is closed before cleanup (also required on Windows).
        # Never delete a pre-existing file or another writer's replacement.
        if identity is not None:
            try:
                current = path.stat(follow_symlinks=False)
                if (current.st_dev, current.st_ino) == (identity.st_dev, identity.st_ino):
                    path.unlink()
            except OSError:
                # Preserve the original write failure if cleanup is unavailable.
                pass
        raise


def selected_arguments(
    args: Any, path: Path | None, packs: Callable[..., list[str]], *, side: str = ""
) -> list[str]:
    """Only select paths here; dependency and content validation stay native."""
    dependencies = list(getattr(args, "packs", []))
    if side:
        dependencies.extend(getattr(args, side + "_pack", []))
    return packs(path, dependencies) if dependencies else packs(path)


def export_snapshot(path: Path, snapshot: dict[str, Any]) -> None:
    """Atomically publish a complete UTF-8 snapshot without replacing a destination."""
    text = (
        json.dumps(snapshot, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False) + "\n"
    )
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            "w", encoding="utf-8", dir=path.parent, delete=False
        ) as stream:
            temporary = Path(stream.name)
            stream.write(text)
            stream.flush()
            os.fsync(stream.fileno())
        # A same-directory hard link is exclusive; an overwriting rename is not.
        # Unsupported filesystems fail visibly rather than risk another author's file.
        os.link(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def json_equal(before: Any, after: Any) -> bool:
    """JSON booleans are not numbers; 1 and 1.0 still denote the same number."""
    if isinstance(before, bool) or isinstance(after, bool):
        return type(before) is type(after) and before == after
    if isinstance(before, dict) and isinstance(after, dict):
        return before.keys() == after.keys() and all(
            json_equal(before[key], after[key]) for key in before
        )
    if isinstance(before, list) and isinstance(after, list):
        return len(before) == len(after) and all(
            json_equal(left, right) for left, right in zip(before, after, strict=True)
        )
    return before == after


def difference(before: Any, after: Any, path: str = "") -> list[dict[str, Any]]:
    """Bounded JSON-pointer differences. Array order remains meaningful."""
    if json_equal(before, after):
        return []
    if isinstance(before, dict) and isinstance(after, dict):
        changes: list[dict[str, Any]] = []
        for key in sorted(before.keys() | after.keys()):
            pointer = path + "/" + key.replace("~", "~0").replace("/", "~1")
            if key not in before:
                changes.append({"path": pointer, "change": "added", "after": after[key]})
            elif key not in after:
                changes.append({"path": pointer, "change": "removed", "before": before[key]})
            else:
                changes.extend(difference(before[key], after[key], pointer))
            if len(changes) > MAX_DIFFS:
                break
        return changes[: MAX_DIFFS + 1]
    return [{"path": path or "/", "change": "changed", "before": before, "after": after}]


def execute(
    args: Any, invoke: Callable[..., dict[str, Any]], packs: Callable[..., list[str]]
) -> dict[str, Any]:
    """Never validate definitions in Python or report a simulated step that did not execute."""
    path = getattr(args, "path", None)
    if args.action == "test":
        return invoke(
            [
                "--action=test",
                "--id=" + args.scenario,
                "--steps=" + str(args.steps),
                *selected_arguments(args, path, packs),
            ],
            args.godot,
        )
    if args.action == "list":
        result = invoke(["--action=validate", *selected_arguments(args, path, packs)], args.godot)
        if result.get("ok") and args.kind:
            if args.kind not in result.get("kinds", []):
                raise ValueError("Unsupported content kind: " + args.kind)
            result["definitions"] = [
                item for item in result["definitions"] if item["kind"] == args.kind
            ]
        return result
    if args.action == "export":
        if args.output.exists():
            raise ValueError("Export destination already exists; choose a new file.")
        result = invoke(["--action=export", *selected_arguments(args, path, packs)], args.godot)
        if not result.get("ok"):
            return result
        # Exclusive creation also protects against a destination appearing during validation.
        export_snapshot(args.output, result["snapshot"])
        return {
            "ok": True,
            "engine_executed": True,
            "output": str(args.output),
            "definitions": len(result["snapshot"]["records"]),
            "scope": "Resolved inspection snapshot, not a directly loadable folder pack.",
        }
    before = invoke(
        ["--action=export", *selected_arguments(args, args.before, packs, side="before")],
        args.godot,
    )
    if not before.get("ok"):
        return before
    after = invoke(
        ["--action=export", *selected_arguments(args, args.after, packs, side="after")], args.godot
    )
    if not after.get("ok"):
        return after
    changes = difference(before["snapshot"]["records"], after["snapshot"]["records"])
    return {
        "ok": True,
        "engine_executed": True,
        "equal": not changes,
        "changes": changes[:MAX_DIFFS],
        "truncated": len(changes) > MAX_DIFFS,
        "scope": "Compared resolved definitions; source locations are not gameplay differences.",
    }
