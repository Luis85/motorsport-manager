"""Read-only authoring operations over results of the production content compiler."""
from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any, Callable

MAX_DIFFS = 256


def json_equal(before: Any, after: Any) -> bool:
    """JSON numbers may compare equally; Booleans are not numbers, even when nested."""
    if isinstance(before, bool) or isinstance(after, bool):
        return type(before) is type(after) and before == after
    if isinstance(before, dict) and isinstance(after, dict):
        return before.keys() == after.keys() and all(json_equal(before[key], after[key]) for key in before)
    if isinstance(before, list) and isinstance(after, list):
        return len(before) == len(after) and all(json_equal(a, b) for a, b in zip(before, after))
    return before == after


def export_snapshot(path: Path, snapshot: dict[str, Any]) -> None:
    """Publish a complete UTF-8 snapshot without replacing an existing destination."""
    text = json.dumps(snapshot, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False) + "\n"
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(text)
            stream.flush()
            os.fsync(stream.fileno())
        # Same-directory hard linking is exclusive and atomic. Do not fall back to
        # replace(), which would destroy a file created while the engine validated.
        os.link(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


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


def execute(args: Any, invoke: Callable[..., dict[str, Any]], packs: Callable[..., list[str]]) -> dict[str, Any]:
    """Never validate definitions in Python or report a simulated step that did not execute."""
    path = getattr(args, "path", None)
    common = getattr(args, "packs", [])

    def selection(root: Path | None, side: str = "") -> list[str]:
        dependencies = common + (getattr(args, side + "_pack", []) if side else [])
        return packs(root, dependencies) if dependencies else packs(root)
    if args.action == "test":
        return invoke(["--action=test", "--id=" + args.scenario, "--steps=" + str(args.steps), *selection(path)], args.godot)
    if args.action == "list":
        result = invoke(["--action=validate", *selection(path)], args.godot)
        if result.get("ok") and args.kind:
            if args.kind not in result.get("kinds", []):
                raise ValueError("Unsupported content kind: " + args.kind)
            result["definitions"] = [item for item in result["definitions"] if item["kind"] == args.kind]
        return result
    if args.action == "export":
        if args.output.exists():
            raise ValueError("Export destination already exists; choose a new file.")
        result = invoke(["--action=export", *selection(path)], args.godot)
        if not result.get("ok"):
            return result
        export_snapshot(args.output, result["snapshot"])
        return {"ok": True, "engine_executed": True, "output": str(args.output),
                "definitions": len(result["snapshot"]["records"]),
                "scope": "Resolved inspection snapshot, not a directly loadable folder pack."}
    before = invoke(["--action=export", *selection(args.before, "before")], args.godot)
    if not before.get("ok"):
        return before
    after = invoke(["--action=export", *selection(args.after, "after")], args.godot)
    if not after.get("ok"):
        return after
    changes = difference(before["snapshot"]["records"], after["snapshot"]["records"])
    return {"ok": True, "engine_executed": True, "equal": not changes,
            "changes": changes[:MAX_DIFFS], "truncated": len(changes) > MAX_DIFFS,
            "scope": "Compared resolved definitions; source locations are not gameplay differences."}
