"""Bounded config snapshots, byte-preserving edits and guarded atomic publication."""

from __future__ import annotations

import contextlib
import hashlib
import json
import math
import os
import re
import secrets
import stat
import tempfile
from pathlib import Path

from balance_windows import windows_root_lock
from content_operations import difference, finite_float, reject_constant

MAX_BYTES = 1_048_576
MAX_TOTAL_BYTES = 16_777_216
MAX_FILES = 2048
MAX_ENTRIES = 4096
MAX_DEPTH = 32
PROTECTED = {
    "id",
    "kind",
    "model",
    "version",
    "schema_version",
    "runtime_contract",
    "dependencies",
    "files",
    "overrides",
    "name",
    "title",
    "description",
    "notice",
    "objective",
    "hint",
    "meta",
    "metadata",
    "provider",
    "algorithm",
    "checksum",
    "sha256",
}


def unique_object(pairs: list) -> dict:
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key: " + key)
        result[key] = value
    return result


def decode(raw: bytes | str):
    if len(raw) > MAX_BYTES:
        raise ValueError("JSON exceeds the 1 MiB authoring limit.")
    try:
        value = json.loads(
            raw,
            object_pairs_hook=unique_object,
            parse_constant=reject_constant,
            parse_float=finite_float,
        )
        bounded(value)
        return value
    except (UnicodeError, RecursionError) as error:
        raise ValueError("JSON encoding or nesting is invalid.") from error


def bounded(value, depth: int = 0) -> None:
    if depth > 64:
        raise ValueError("JSON nesting exceeds 64 levels.")
    if isinstance(value, (dict, list)):
        if len(value) > 100_000:
            raise ValueError("JSON collection exceeds 100000 entries.")
        for item in value.values() if isinstance(value, dict) else value:
            bounded(item, depth + 1)
    elif isinstance(value, (int, float)) and not isinstance(value, bool):
        if abs(value) > 1_000_000_000_000 or not math.isfinite(value):
            raise ValueError("JSON numeric magnitude exceeds the authoring limit.")


def guarded_path(path: Path) -> Path:
    path = Path(os.path.abspath(path.expanduser()))
    for ancestor in [*reversed(path.parents), path]:
        if ancestor.is_symlink():
            raise ValueError("Symbolic links are not supported: " + str(ancestor))
    return path


def relative_file(name: str) -> str:
    parts = name.split("/")
    if "\\" in name or any(part in ("", ".", "..") for part in parts):
        raise ValueError("Choose a relative config file without traversal.")
    if not name.endswith(".json") or Path(name).is_absolute():
        raise ValueError("Choose a relative .json file inside config.")
    return name


class Snapshot:
    """Own detached bytes and filesystem identity for one complete config root."""

    def __init__(self, root: Path, ignored: tuple[Path, tuple] | None = None):
        self.root = guarded_path(root)
        if not self.root.is_dir():
            raise ValueError("Config directory does not exist: " + str(self.root))
        self.ignored = ignored
        self.files: dict[str, bytes] = {}
        self.identities: dict[str, tuple] = {}
        self.total_bytes = 0
        self.entry_count = 0
        self.case_names: set[str] = set()
        self._scan(self.root)
        for name, raw in self.files.items():
            if name.endswith(".json"):
                decode(raw)
        self.digest = hashlib.sha256()
        for name, raw in sorted(self.files.items()):
            self.digest.update(name.encode() + b"\0" + raw + b"\0")

    def _scan(self, directory: Path) -> None:
        relative = directory.relative_to(self.root).as_posix()
        if len(directory.relative_to(self.root).parts) > MAX_DEPTH:
            raise ValueError("Config directory nesting exceeds 32 levels.")
        self.identities[relative] = self._identity(directory)
        for path in sorted(directory.iterdir()):
            identity = self._identity(path)
            if self.ignored == (path, identity):
                continue
            self.entry_count += 1
            if self.entry_count > MAX_ENTRIES:
                raise ValueError("Config exceeds the 4096 filesystem entry limit.")
            name = path.relative_to(self.root).as_posix()
            folded = name.casefold()
            if folded in self.case_names:
                raise ValueError("Config paths have a case collision: " + name)
            self.case_names.add(folded)
            if stat.S_ISDIR(identity[2]):
                self._scan(path)
                continue
            if not stat.S_ISREG(identity[2]) or identity[3] != 1:
                raise ValueError("Config files must be regular and have no links: " + str(path))
            if len(self.files) >= MAX_FILES:
                raise ValueError("Config exceeds the 2048 file limit.")
            size = path.stat().st_size
            if size > MAX_BYTES:
                raise ValueError("Config file exceeds the 1 MiB limit: " + str(path))
            self.total_bytes += size
            if self.total_bytes > MAX_TOTAL_BYTES:
                raise ValueError("Config exceeds the 16 MiB total byte limit.")
            name = path.relative_to(self.root).as_posix()
            raw = path.read_bytes()
            if len(raw) > MAX_BYTES or self._identity(path) != identity:
                raise ValueError("Config changed while reading; retry.")
            self.files[name] = raw
            self.identities[name] = identity

    @staticmethod
    def _identity(path: Path) -> tuple:
        info = path.lstat()
        return (info.st_dev, info.st_ino, info.st_mode, info.st_nlink)

    def unchanged(self, ignored: tuple[Path, tuple] | None = None) -> None:
        latest = Snapshot(self.root, ignored)
        if self.files != latest.files or self.identities != latest.identities:
            raise ValueError("Config changed during validation; latest data was preserved. Retry.")

    def document(self, name: str):
        return decode(self.files[relative_file(name)])

    def write(self, destination: Path) -> None:
        destination.mkdir()
        for name, raw in self.files.items():
            path = destination / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(raw)


def pointer_parts(pointer: str) -> tuple[str, ...]:
    if not pointer.startswith("/") or re.search(r"~(?![01])", pointer):
        raise ValueError("Use a non-empty RFC 6901 JSON pointer beginning with /.")
    return tuple(part.replace("~1", "/").replace("~0", "~") for part in pointer[1:].split("/"))


def lookup(value, parts: tuple[str, ...]):
    for part in parts:
        if isinstance(value, dict) and part in value:
            value = value[part]
        elif isinstance(value, list) and re.fullmatch(r"0|[1-9][0-9]*", part):
            try:
                value = value[int(part)]
            except IndexError as error:
                raise ValueError("JSON pointer does not select an existing field.") from error
        else:
            raise ValueError("JSON pointer does not select an existing field.")
    return value


def scalar_span(text: str, parts: tuple[str, ...]) -> tuple[int, int]:
    """Locate a validated JSON value without serializing neighboring bytes."""
    decoder = json.JSONDecoder()

    def skip(position: int) -> int:
        while position < len(text) and text[position].isspace():
            position += 1
        return position

    def visit(position: int, path: tuple) -> tuple[int, tuple | None]:
        start = position = skip(position)
        if text[position] not in "[{":
            _, end = decoder.raw_decode(text, position)
            return end, (start, end) if path == parts else None
        closing = "}" if text[position] == "{" else "]"
        mapping = closing == "}"
        position = skip(position + 1)
        index = 0
        found = None
        while text[position] != closing:
            if mapping:
                key, position = decoder.raw_decode(text, position)
                position = skip(position) + 1
            else:
                key = str(index)
            position, selected = visit(position, (*path, key))
            found = selected if selected is not None else found
            position = skip(position)
            if text[position] == ",":
                position = skip(position + 1)
            index += 1
        return position + 1, found

    _, span = visit(0, ())
    if span is None:
        raise ValueError("Only existing scalar balance fields can be edited.")
    return span


def edited(snapshot: Snapshot, name: str, pointer: str, literal: str) -> tuple[bytes, list]:
    name = relative_file(name)
    parts = pointer_parts(pointer)
    if name == "pack.json" or any(
        part in PROTECTED
        or part.endswith(("_id", "_path", "_version"))
        or part in ("track", "path", "resource", "source")
        for part in parts
    ):
        raise ValueError("Identity, metadata, version and resource paths are not balance knobs.")
    before = snapshot.document(name)
    old = lookup(before, parts)
    new = decode(literal)
    if isinstance(new, (dict, list)) or new is None or isinstance(old, (dict, list)) or old is None:
        raise ValueError("Only existing scalar balance fields can be edited.")
    if isinstance(old, bool) or isinstance(new, bool):
        compatible = type(old) is type(new)
    else:
        compatible = type(old) is type(new) or (
            isinstance(old, (int, float)) and isinstance(new, (int, float))
        )
    if not compatible:
        raise ValueError("The replacement must keep the existing JSON field type.")
    text = snapshot.files[name].decode("utf-8")
    start, end = scalar_span(text, parts)
    raw = (
        text[:start] + json.dumps(new, ensure_ascii=False, allow_nan=False) + text[end:]
    ).encode()
    return raw, difference(before, decode(raw))


@contextlib.contextmanager
def root_lock(root: Path):
    """Serialize cooperating writers without adding anything to the config root."""
    if os.name == "nt":
        with windows_root_lock(root):
            yield
        return
    if os.name != "posix":
        raise ValueError("This platform has no supported config publication lock.")
    import fcntl

    handle = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        fcntl.flock(handle, fcntl.LOCK_EX)
        yield
    finally:
        os.close(handle)


def publish(snapshot: Snapshot, name: str, raw: bytes) -> None:
    """Replace one file via our flushed same-parent temporary; retain concurrent data."""
    path = snapshot.root / relative_file(name)
    with root_lock(snapshot.root):
        snapshot.unchanged()
        if os.name == "posix":
            publish_directory(snapshot, name, raw, path)
        else:
            publish_portable(snapshot, name, raw, path)


def publish_directory(snapshot: Snapshot, name: str, raw: bytes, path: Path) -> None:
    parent = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    temporary = ".balance-" + secrets.token_hex(16)
    owned = None
    try:
        expected = snapshot.identities[path.parent.relative_to(snapshot.root).as_posix()]
        current = os.fstat(parent)
        if (current.st_dev, current.st_ino) != expected[:2]:
            raise ValueError("Config parent changed; latest data was preserved.")
        handle = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600, dir_fd=parent)
        with os.fdopen(handle, "wb") as stream:
            info = os.fstat(stream.fileno())
            owned = (info.st_dev, info.st_ino, info.st_mode, info.st_nlink)
            os.fchmod(stream.fileno(), stat.S_IMODE(snapshot.identities[name][2]))
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())
            info = os.fstat(stream.fileno())
            owned = (info.st_dev, info.st_ino, info.st_mode, info.st_nlink)
        snapshot.unchanged((path.parent / temporary, owned))
        os.replace(temporary, path.name, src_dir_fd=parent, dst_dir_fd=parent)
        owned = None
    finally:
        if owned is not None:
            try:
                current = os.stat(temporary, dir_fd=parent, follow_symlinks=False)
                if (current.st_dev, current.st_ino) == owned[:2]:
                    os.unlink(temporary, dir_fd=parent)
            except FileNotFoundError:
                pass
        os.close(parent)


def publish_portable(snapshot: Snapshot, name: str, raw: bytes, path: Path) -> None:
    temporary = None
    owned = None
    try:
        with tempfile.NamedTemporaryFile(
            dir=path.parent, prefix=".balance-", delete=False
        ) as stream:
            temporary = Path(stream.name)
            if hasattr(os, "fchmod"):
                os.fchmod(stream.fileno(), stat.S_IMODE(snapshot.identities[name][2]))
            owned = Snapshot._identity(temporary)
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())
        snapshot.unchanged((temporary, owned))
        os.replace(temporary, path)
        temporary = None
    finally:
        if temporary is not None:
            try:
                if Snapshot._identity(temporary) == owned:
                    temporary.unlink()
            except FileNotFoundError:
                pass
