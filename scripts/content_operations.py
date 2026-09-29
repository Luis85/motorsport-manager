"""Read-only authoring operations over results of the production content compiler."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable

MAX_DIFFS = 256


def difference(before: Any, after: Any, path: str = "") -> list[dict[str, Any]]:
    """Bounded JSON-pointer differences. Array order remains meaningful."""
    if before == after:
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
    if args.action == "test":
        return invoke(["--action=test", "--id=" + args.scenario, "--steps=" + str(args.steps), *packs(path)], args.godot)
    if args.action == "list":
        result = invoke(["--action=validate", *packs(path)], args.godot)
        if result.get("ok") and args.kind:
            if args.kind not in result.get("kinds", []):
                raise ValueError("Unsupported content kind: " + args.kind)
            result["definitions"] = [item for item in result["definitions"] if item["kind"] == args.kind]
        return result
    if args.action == "export":
        if args.output.exists():
            raise ValueError("Export destination already exists; choose a new file.")
        result = invoke(["--action=export", *packs(path)], args.godot)
        if not result.get("ok"):
            return result
        # Exclusive creation also protects against a destination appearing during validation.
        with args.output.open("x", encoding="utf-8") as stream:
            json.dump(result["snapshot"], stream, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False)
            stream.write("\n")
        return {"ok": True, "engine_executed": True, "output": str(args.output),
                "definitions": len(result["snapshot"]["records"]),
                "scope": "Resolved inspection snapshot, not a directly loadable folder pack."}
    before = invoke(["--action=export", *packs(args.before)], args.godot)
    if not before.get("ok"):
        return before
    after = invoke(["--action=export", *packs(args.after)], args.godot)
    if not after.get("ok"):
        return after
    changes = difference(before["snapshot"]["records"], after["snapshot"]["records"])
    return {"ok": True, "engine_executed": True, "equal": not changes,
            "changes": changes[:MAX_DIFFS], "truncated": len(changes) > MAX_DIFFS,
            "scope": "Compared resolved definitions; source locations are not gameplay differences."}
