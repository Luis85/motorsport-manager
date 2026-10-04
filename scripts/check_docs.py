#!/usr/bin/env python3
"""Check local documentation links, headings, navigation and folder discipline."""

from __future__ import annotations

import argparse
import re
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
LINK = re.compile(r"!?\[[^\]\n]*\]\(\s*(<[^>\n]+>|[^\s)]+)(?:\s+[^)\n]*)?\)")
DEFINITION = re.compile(r"^ {0,3}\[[^\]\n]+\]:\s*(<[^>\n]+>|\S+)", re.MULTILINE)
DOC_PATH = re.compile(r"(?<![\w/])docs/[\w./-]+\.(?:md|json)\b")


def prose(text: str) -> str:
    """Mask fenced examples while preserving diagnostic line numbers."""
    result = []
    fence = ""
    for line in text.splitlines(keepends=True):
        marker = re.match(r"^ {0,3}(`{3,}|~{3,})", line)
        if marker and not fence:
            fence = marker[1]
            result.append("\n")
        elif fence:
            result.append("\n")
            if marker and marker[1][0] == fence[0] and len(marker[1]) >= len(fence):
                fence = ""
        else:
            result.append(line)
    return "".join(result)


def anchors(text: str) -> set[str]:
    result = set(re.findall(r'<a\s+(?:id|name)=["\']([^"\']+)', text))
    counts: dict[str, int] = {}
    for line in prose(text).splitlines():
        heading = re.match(r"^ {0,3}#{1,6}\s+(.+?)(?:\s+#+)?$", line)
        if not heading:
            continue
        label = re.sub(r"!?\[([^\]]*)\]\([^)]*\)", r"\1", heading[1])
        label = re.sub(r"<[^>]+>", "", label)
        slug = re.sub(r"[^\w\- ]", "", label.lower()).replace(" ", "-")
        count = counts.get(slug, 0)
        counts[slug] = count + 1
        result.add(f"{slug}-{count}" if count else slug)
    return result


def link_error(path: Path, match: re.Match, clean: str, root: Path) -> tuple[Path | None, str]:
    href = match[1].strip("<>")
    url = urlsplit(href)
    if url.scheme or url.netloc:
        return None, ""
    line = clean[: match.start()].count("\n") + 1
    target = (path.parent / unquote(url.path)).resolve() if url.path else path
    where = f"{path.relative_to(root)}:{line}"
    if not target.exists():
        return target, f"{where}: missing link target {href}"
    if target.is_file() and target.suffix == ".md":
        if url.fragment and unquote(url.fragment) not in anchors(target.read_text()):
            return target, f"{where}: missing heading fragment {href}"
    return target, ""


def literal_errors(root: Path, pages: list[Path]) -> list[str]:
    candidates = [
        *pages,
        *root.glob("scripts/**/*.py"),
        *root.glob("scripts/**/*.gd"),
        *root.glob(".github/**/*.yml"),
    ]
    errors = []
    for path in sorted(set(candidates)):
        text = path.read_text(encoding="utf-8")
        for match in DOC_PATH.finditer(text):
            if not (root / match[0]).exists():
                line = text[: match.start()].count("\n") + 1
                errors.append(f"{path.relative_to(root)}:{line}: stale document path {match[0]}")
    return errors


def check(root: Path) -> tuple[list[str], int]:
    root = root.resolve()
    docs = root / "docs"
    # Installed package documentation is not repository-authored documentation.
    pages = sorted(p for p in docs.rglob("*.md") if "node_modules" not in p.relative_to(docs).parts)
    extra = [root / "README.md", root / "AGENTS.md", root / "config/README.md"]
    texts = {p: p.read_text(encoding="utf-8") for p in pages + extra if p.is_file()}
    errors: list[str] = []
    graph: dict[Path, set[Path]] = {}
    count = 0
    entry = docs / "README.md"
    if not entry.is_file():
        errors.append("docs/README.md: missing documentation entry point")
    for path in docs.iterdir() if docs.is_dir() else []:
        if path.is_file() and path.stem.lower() not in {"readme", "index"}:
            errors.append(f"{path.relative_to(root)}: docs root permits only README/index files")
    for path, text in texts.items():
        relative = path.relative_to(root)
        if "_archive" in relative.parts and path.name != "README.md":
            if not re.search(r"^>.*[Hh]istorical", text, re.MULTILINE):
                errors.append(f"{relative}: missing explicit historical notice")
        clean = prose(text)
        for match in list(LINK.finditer(clean)) + list(DEFINITION.finditer(clean)):
            target, error = link_error(path, match, clean, root)
            if target is None:
                continue
            count += 1
            if error:
                errors.append(error)
            graph.setdefault(path, set()).add(target)
    # Check literal paths used by contributor guidance and production diagnostics.
    errors.extend(literal_errors(root, list(texts)))
    reached: set[Path] = set()
    pending = [entry]
    while pending:
        current = pending.pop()
        if current not in reached:
            reached.add(current)
            pending.extend(graph.get(current, set()) - reached)
    for page in pages:
        if page not in reached:
            errors.append(f"{page.relative_to(root)}: unreachable from docs/README.md")
    return errors, count


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    args = parser.parse_args()
    errors, count = check(args.root)
    if errors:
        print("\n".join(errors))
        print(f"Documentation check failed: {len(errors)} findings")
        return 1
    print(f"Documentation check passed: {count} local links; layout and navigation valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
