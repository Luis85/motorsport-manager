"""Read explicit local GDScript inheritance without interpreting gameplay code."""

from __future__ import annotations

import re

TOKEN = re.compile(
    r'(?P<comment>\#[^\n]*)|(?P<string>"""[\s\S]*?"""|\'\'\'[\s\S]*?\'\'\'|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\')'
)
# Native terminals supported by these source-only contracts. Unknown names must
# not masquerade as engine classes and hide a missing project dependency.
NATIVE_BASES = {
    "Object",
    "RefCounted",
    "Resource",
    "Node",
    "Node2D",
    "Node3D",
    "Control",
    "SceneTree",
    "Timer",
    "CanvasLayer",
    "CanvasItem",
    "Container",
    "VBoxContainer",
    "HBoxContainer",
    "PanelContainer",
    "MarginContainer",
    "ScrollContainer",
    "ConfirmationDialog",
    "AcceptDialog",
    "Window",
}


def mask(source: str) -> str:
    """Preserve positions and newlines while hiding documentation and string data."""
    return TOKEN.sub(lambda m: "".join("\n" if c == "\n" else " " for c in m[0]), source)


def bounded_resource_path(target: str) -> str | None:
    """Return the exact canonical project path; aliases cannot change its layer."""
    if not target.startswith("res://") or any(
        part in ("", ".", "..") for part in target[6:].split("/")
    ):
        return None
    return target[6:]


def global_classes(sources: dict[str, str]) -> dict[str, str]:
    """Resolve one unambiguous project registry for repeated inheritance walks."""
    classes = {}
    for path, source in sources.items():
        declaration = re.search(r"^class_name\s+(\w+)", mask(source), re.M)
        if declaration:
            if declaration[1] in classes:
                raise ValueError(f"Duplicate global class: {declaration[1]}")
            classes[declaration[1]] = path
    return classes


def inheritance_sources(
    sources: dict[str, str], entry: str, *, classes: dict[str, str] | None = None
) -> list[tuple[str, str]]:
    """Follow source-pinned literal/class parents; reject missing paths and cycles."""
    if classes is None:
        classes = global_classes(sources)
    result = []
    visited = set()
    while entry:
        if entry in visited:
            raise ValueError(f"Cyclic script inheritance: {entry}")
        if entry not in sources:
            raise ValueError(f"Missing inherited script: {entry}")
        visited.add(entry)
        source = sources[entry]
        result.append((entry, source))
        header = re.search(r"^(?:class_name\s+\w+\s+)?extends\b", mask(source), re.M)
        if not header:
            break
        declaration = source[header.end() :].split("\n", 1)[0]
        parent = re.fullmatch(r'\s*(?:([\'"])([^\'"\n]+)\1|(\w+))\s*(?:#[^\n]*)?', declaration)
        if not parent:
            raise ValueError(f"Cannot resolve explicit script inheritance: {entry}")
        if parent[2]:
            target = parent[2]
            resolved = bounded_resource_path(target)
            if resolved is None:
                raise ValueError(f"Inherited script must name a bounded resource path: {entry}")
            entry = resolved
        else:
            name = parent[3]
            if name not in classes and name not in NATIVE_BASES:
                raise ValueError(f"Unresolved inherited global class {name}: {entry}")
            entry = classes.get(name, "")
    return result


def aggregate_dispatch_sources(sources: dict[str, str], entry: str) -> list[tuple[str, str]]:
    """Reject a derived override hiding an inherited aggregate dispatch.

    Both the CLI and architectural fitness check use this effective-method rule.
    A plain or untyped override can remove a hook just as a typed override can.
    This explicit contract rejects shadowing rather than interpreting super calls.
    """
    chain = inheritance_sources(sources, entry)
    derived = {}
    for path, source in chain:
        code = mask(source)
        headers = list(re.finditer(r"^(?:static\s+)?func\s+(\w+)\s*\(", code, re.M))
        declared = set()
        for index, header in enumerate(headers):
            name = header[1]
            if name in declared:
                raise ValueError(f"Duplicate method {name}: {path}")
            declared.add(name)
            end = headers[index + 1].start() if index + 1 < len(headers) else len(code)
            dispatch = re.search(r"\bmechanics\s*\.\s*invoke\s*\(", code[header.end() : end])
            if dispatch and name in derived:
                raise ValueError(
                    f"Aggregate dispatch {name} in {path} is shadowed by {derived[name]}"
                )
        for name in declared:
            derived.setdefault(name, path)
    return chain
