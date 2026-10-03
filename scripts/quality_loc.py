"""Physical code-line accounting, not statement counts or total file length.

Blank lines, comments, and Python documentation strings are excluded. Runtime
strings (including GDScript triple-quoted strings) are code, even when they
contain a #. Syntax/tokenization failures must be reported, never counted as 0.
"""

from __future__ import annotations

import ast
import io
import tokenize
from pathlib import Path


def python_lines(text: str) -> set[int]:
    tree = ast.parse(text)
    docs = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
            if node.body and isinstance(node.body[0], ast.Expr):
                value = node.body[0].value
                if isinstance(value, ast.Constant) and isinstance(value.value, str):
                    docs.add((value.lineno, value.col_offset))
    ignored = {
        tokenize.COMMENT,
        tokenize.NL,
        tokenize.NEWLINE,
        tokenize.INDENT,
        tokenize.DEDENT,
        tokenize.ENDMARKER,
        tokenize.ENCODING,
    }
    source = text.splitlines()
    lines = set()
    for token in tokenize.generate_tokens(io.StringIO(text).readline):
        if token.type in ignored or (token.type == tokenize.STRING and token.start in docs):
            continue
        for number in range(token.start[0], token.end[0] + 1):
            if number <= len(source) and source[number - 1].strip():
                lines.add(number)
    return lines


def gdscript_lines(text: str) -> set[int]:
    # Godot uses # comments, not /* blocks. Triple quotes are runtime strings.
    lines: set[int] = set()
    quote = ""
    for number, line in enumerate(text.splitlines(), 1):
        index = 0
        while index < len(line):
            if quote:
                if line[index:].strip():
                    lines.add(number)
                if line[index] == "\\":
                    index += 2
                elif line.startswith(quote, index):
                    index += len(quote)
                    quote = ""
                else:
                    index += 1
                continue
            char = line[index]
            if char == "#":
                break
            if not char.isspace():
                lines.add(number)
            if char in "\"'":
                quote = char * 3 if line.startswith(char * 3, index) else char
                index += len(quote)
            else:
                index += 1
    if quote:
        raise ValueError("Unterminated string at end of file")
    return lines


def measure(path: Path, text: str, policy: dict) -> dict:
    category = "tests" if path.parts[0] in policy["test_roots"] else "source"
    readers = {".py": python_lines, ".gd": gdscript_lines}
    if path.suffix not in readers:
        raise ValueError(f"Unsupported source extension: {path.suffix}")
    code = sorted(readers[path.suffix](text))
    limit = policy["limits"][category]
    return {
        "path": path.as_posix(),
        "category": category,
        "code_lines": len(code),
        "limit": limit,
        "over_limit": len(code) > limit,
        "line": code[limit] if len(code) > limit else 1,
    }
