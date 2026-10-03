"""Read explicit local GDScript inheritance without interpreting gameplay code."""

from __future__ import annotations

import re

TOKEN = re.compile(
    r'(?P<comment>\#[^\n]*)|(?P<string>"""[\s\S]*?"""|\'\'\'[\s\S]*?\'\'\'|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\')'
)


def mask(source: str) -> str:
    """Preserve positions and newlines while hiding documentation and string data."""
    return TOKEN.sub(lambda m: "".join("\n" if c == "\n" else " " for c in m[0]), source)


def inheritance_sources(sources: dict[str, str], entry: str) -> list[tuple[str, str]]:
    """Follow source-pinned literal/class parents; reject missing paths and cycles."""
    classes = {}
    for path, source in sources.items():
        declaration = re.search(r"^class_name\s+(\w+)", mask(source), re.M)
        if declaration:
            classes[declaration[1]] = path
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
        header = re.search(r"^extends\b", mask(source), re.M)
        if not header:
            break
        parent = re.match(r'\s*(?:([\'"])([^\'"\n]+)\1|(\w+))', source[header.end() :])
        if not parent:
            raise ValueError(f"Cannot resolve explicit script inheritance: {entry}")
        if parent[2]:
            target = parent[2]
            if not target.startswith("res://") or any(
                part in ("", ".", "..") for part in target[6:].split("/")
            ):
                raise ValueError(f"Inherited script must name a bounded resource path: {entry}")
            entry = target.removeprefix("res://")
        else:
            entry = classes.get(parent[3], "")
    return result
