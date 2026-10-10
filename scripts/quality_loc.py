"""Physical code-line accounting, not statement counts or total file length.

Blank lines, comments, and Python documentation strings are excluded. Runtime
strings (including GDScript triple-quoted strings and TypeScript template
literals) are code, even when they contain a # or //. Syntax/tokenization
failures must be reported, never counted as 0.
"""

from __future__ import annotations

import ast
import io
import re
import tokenize
from bisect import bisect_right
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


# TypeScript (.ts, .cts, .mts, .d.ts). A physical line is code when it holds any
# token that is not a comment or whitespace. String and template literal content
# is code (a multi-line token counts every nonblank line it spans); // and /* */
# comments, JSDoc included, are not. A "/" starts a regular expression only where
# an expression may begin (the previous significant token is not a value: an
# identifier other than an operator keyword, a literal, ")" or "]"); otherwise it
# is division. "!" keeps the previous state: after a value it is the non-null
# assertion (x! / 2), elsewhere it is logical not (!/re/). The rule follows the
# TypeScript scanner closely enough to agree with a compiler-based count on this
# repository; a "}" ending an object literal before a division is the known
# ambiguity and is read as a statement end.
_TS_SPACE = re.compile(
    r"[ \t\n\r\v\f\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+"
)
_TS_LINE_COMMENT = re.compile(r"[^\n\r\u2028\u2029]*")
_TS_WORD = re.compile(r"[\w$\\\u0080-\uffff]+")
_TS_NUMBER = re.compile(r"\.?\d[\w.]*")
_TS_STRINGS = {
    quote: re.compile(quote + r"(?:[^" + quote + r"\\\n\r]|\\(?:\r\n|[\s\S]))*" + quote)
    for quote in "'\""
}
_TS_TEMPLATE_TEXT = re.compile(r"(?:[^`\\$]|\\[\s\S]|\$(?!\{))*")
_TS_REGEX = re.compile(r"/(?:[^/\\\[\n\r]|\\[^\n\r]|\[(?:[^\]\\\n\r]|\\[^\n\r])*\])+/[\w$]*")
# Keywords after which an expression (so a regular expression) may start.
_TS_OPERATOR_WORDS = frozenset(
    "await case delete do else in instanceof new of return throw typeof void yield".split()
)


class _TypeScriptScanner:
    def __init__(self, text: str):
        self.text = text
        self.rows = text.split("\n")
        self.row_starts = [0] + [match.end() for match in re.finditer("\n", text)]
        self.lines: set[int] = set()
        self.braces: list[str] = []  # "{" for a block or object, "${" for a template hole
        self.regex_allowed = True
        self.pos = 0

    def line(self, offset: int) -> int:
        return bisect_right(self.row_starts, offset)

    def fail(self, what: str, offset: int) -> None:
        raise ValueError(f"Unterminated {what} starting at line {self.line(offset)}")

    def mark(self, start: int, end: int) -> None:
        first, last = self.line(start), self.line(end - 1)
        self.lines.update(n for n in range(first, last + 1) if self.rows[n - 1].strip())

    def scan(self) -> set[int]:
        if self.text.startswith("#!"):
            self.pos = _TS_LINE_COMMENT.match(self.text, 2).end()
        while self.pos < len(self.text):
            self.step()
        if "${" in self.braces:
            self.fail("template literal", len(self.text) - 1)
        return self.lines

    def step(self) -> None:
        text, pos = self.text, self.pos
        space = _TS_SPACE.match(text, pos)
        if space:
            self.pos = space.end()
        elif text.startswith("//", pos):
            self.pos = _TS_LINE_COMMENT.match(text, pos).end()
        elif text.startswith("/*", pos):
            end = text.find("*/", pos + 2)
            if end < 0:
                self.fail("block comment", pos)
            self.pos = end + 2
        elif text[pos] == "/" and self.regex_allowed:
            self.literal(_TS_REGEX, "regular expression")
        elif text[pos] in _TS_STRINGS:
            self.literal(_TS_STRINGS[text[pos]], "string literal")
        elif text[pos] == "`":
            self.template(pos, pos + 1)
        elif text[pos] == "}" and self.braces and self.braces[-1] == "${":
            self.braces.pop()
            self.template(pos, pos + 1)
        else:
            self.word_or_punctuator()

    def literal(self, pattern: re.Pattern, what: str) -> None:
        match = pattern.match(self.text, self.pos)
        if not match:
            self.fail(what, self.pos)
        self.mark(self.pos, match.end())
        self.pos = match.end()
        self.regex_allowed = False

    def template(self, start: int, pos: int) -> None:
        end = _TS_TEMPLATE_TEXT.match(self.text, pos).end()
        if end >= len(self.text) or self.text[end] not in "`$":
            self.fail("template literal", start)
        hole = self.text[end] == "$"
        if hole:
            self.braces.append("${")
        self.pos = end + (2 if hole else 1)
        self.mark(start, self.pos)
        self.regex_allowed = hole

    def word_or_punctuator(self) -> None:
        text, pos = self.text, self.pos
        number = _TS_NUMBER.match(text, pos)
        word = number or _TS_WORD.match(text, pos)
        if word:
            end = word.end()
            self.regex_allowed = not number and word.group() in _TS_OPERATOR_WORDS
        else:
            end = pos + 1
            char = text[pos]
            if char == "{":
                self.braces.append("{")
            elif char == "}" and self.braces:
                self.braces.pop()
            if char != "!":
                self.regex_allowed = char not in ")]"
        self.mark(pos, end)
        self.pos = end


def typescript_lines(text: str) -> set[int]:
    return _TypeScriptScanner(text).scan()


READERS = {
    ".py": python_lines,
    ".gd": gdscript_lines,
    ".ts": typescript_lines,
    ".cts": typescript_lines,
    ".mts": typescript_lines,
}


def path_matches(path: str, pattern: str) -> bool:
    """Glob over "/"-separated paths: * and ? stay inside one segment, ** spans segments."""
    segments = pattern.split("/")
    expression = ""
    for index, segment in enumerate(segments):
        last = index == len(segments) - 1
        if segment == "**":
            expression += ".*" if last else "(?:[^/]+/)*"
        else:
            expression += re.escape(segment).replace(r"\*", "[^/]*").replace(r"\?", "[^/]")
            expression += "" if last else "/"
    return re.fullmatch(expression, path) is not None


def category_of(path: Path, policy: dict) -> str:
    if path.parts[0] in policy["test_roots"]:
        return "tests"
    patterns = policy.get("test_patterns", [])
    return "tests" if any(path_matches(path.as_posix(), item) for item in patterns) else "source"


def long_lines(path: Path, text: str, policy: dict) -> list[list[int]]:
    """[line, characters] for physical lines over the advisory width, comments included."""
    rule = policy.get("long_lines")
    if not rule or path.suffix not in rule["extensions"]:
        return []
    rows = text.split("\n")
    widths = ((number, len(row.rstrip("\r"))) for number, row in enumerate(rows, 1))
    return [[number, width] for number, width in widths if width > rule["limit"]]


def measure(path: Path, text: str, policy: dict) -> dict:
    category = category_of(path, policy)
    if path.suffix not in READERS:
        raise ValueError(f"Unsupported source extension: {path.suffix}")
    code = sorted(READERS[path.suffix](text))
    limit = policy["limits"][category]
    return {
        "path": path.as_posix(),
        "language": READERS[path.suffix].__name__.removesuffix("_lines"),
        "category": category,
        "code_lines": len(code),
        "limit": limit,
        "over_limit": len(code) > limit,
        "line": code[limit] if len(code) > limit else 1,
        "long_lines": long_lines(path, text, policy),
    }
