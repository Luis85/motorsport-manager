"""One-time Littlewild v15 installer for the concept branch.

Reassembles the checksum-pinned transfer, safely extracts its authored source,
reproduces the pinned Three.js vendor, rebuilds the standalone HTML, and removes
transport-only staging files. It never touches native Motorsport Manager files.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import sys
import tarfile
import tempfile

TRANSPORT_SHA = "cba1683fbbeefbd471d7d4b8016d6d69c068f9efc6ac92b7e15ea1a72146c484"
TRANSPORT_BYTES = 431_164
HTML_SHA = "acaf00f6163cb8ca3539370ed8b89e2afd844491ae7ee1c1bb70a321b0543032"
VENDOR_SHA = "a998daec49b9df4d7fbb55eb23cf7c908479d3983ff92d165ea403361b7c2bd2"
CHUNKS = 72
CHUNK_BYTES = 6_000
EXPECTED_FILES = 181


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def concept_root() -> Path:
    return Path(__file__).resolve().parent.parent


def reassemble(root: Path) -> bytes:
    transfer = root / "publication" / "transfer"
    names = sorted(p.name for p in transfer.iterdir() if p.is_file())
    expected = [f"part-{i:03d}.bin" for i in range(CHUNKS)]
    if names != expected:
        raise ValueError("Transfer chunk set is incomplete or contains unexpected files.")
    pieces = []
    for i, name in enumerate(expected):
        data = (transfer / name).read_bytes()
        expected_size = CHUNK_BYTES if i < CHUNKS - 1 else TRANSPORT_BYTES - CHUNK_BYTES * (CHUNKS - 1)
        if len(data) != expected_size:
            raise ValueError(f"Unexpected size for {name}: {len(data)}")
        pieces.append(data)
    data = b"".join(pieces)
    if len(data) != TRANSPORT_BYTES or sha256(data) != TRANSPORT_SHA:
        raise ValueError("Reassembled transport does not match the reviewed v15 payload.")
    return data


def safe_members(archive: tarfile.TarFile) -> list[tarfile.TarInfo]:
    members = archive.getmembers()
    files = [m for m in members if m.isfile()]
    if len(files) != EXPECTED_FILES or any(not (m.isfile() or m.isdir()) for m in members):
        raise ValueError("Unexpected transport member type/count.")
    folded: set[str] = set()
    for member in members:
        path = PurePosixPath(member.name)
        if path.is_absolute() or not path.parts or any(part in ("", ".", "..", ".git") for part in path.parts):
            raise ValueError(f"Unsafe transport path: {member.name}")
        key = member.name.casefold()
        if key in folded:
            raise ValueError(f"Case-colliding transport path: {member.name}")
        folded.add(key)
    return members


def extract(root: Path, data: bytes) -> None:
    with tempfile.TemporaryDirectory(prefix="littlewild-v15-") as tmp:
        archive_path = Path(tmp) / "payload.tar.xz"
        archive_path.write_bytes(data)
        with tarfile.open(archive_path, "r:xz") as archive:
            members = safe_members(archive)
            kwargs = {"filter": "data"} if sys.version_info >= (3, 12) else {}
            archive.extractall(root, members=members, **kwargs)


def install_vendor(root: Path) -> None:
    destination = root / "vendor" / "three.js"
    local = os.environ.get("LITTLEWILD_VENDOR_SOURCE")
    if local:
        data = Path(local).read_bytes()
        if sha256(data) != VENDOR_SHA:
            raise ValueError("Local vendor source does not match the pinned bundle.")
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
    else:
        subprocess.run([sys.executable, str(root / "publication" / "vendor_prepare.py")], cwd=root, check=True)
    if sha256(destination.read_bytes()) != VENDOR_SHA:
        raise ValueError("Installed vendor does not match the delivered bundle.")


def build(root: Path) -> None:
    subprocess.run([sys.executable, "source/build.py"], cwd=root, check=True)
    output = root / "littlewild.html"
    if not output.is_file() or sha256(output.read_bytes()) != HTML_SHA:
        raise ValueError("Rebuilt standalone HTML does not match the verified v15 release.")


def cleanup_and_record(root: Path) -> None:
    publication = root / "publication"
    shutil.rmtree(publication / "transfer", ignore_errors=False)
    for name in ("transfer-progress.json", "transfer-ready.json", "install_payload.py", "vendor_prepare.py"):
        (publication / name).unlink(missing_ok=True)
    status = {
        "status": "installed-and-rebuilt",
        "transportSha256": TRANSPORT_SHA,
        "htmlSha256": HTML_SHA,
        "vendorSha256": VENDOR_SHA,
        "transportFiles": EXPECTED_FILES,
        "sourceArchiveSha256": "8793552fbf1776823018e61913d2b6641856480d0f4c4c4c343c8145f8b82b77",
        "triggerCommit": os.environ.get("GITHUB_SHA"),
        "nativeGameChanged": False,
        "fullGameGateRerunByWorkflow": False,
    }
    (publication / "STATUS.json").write_text(json.dumps(status, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    root = concept_root()
    data = reassemble(root)
    extract(root, data)
    install_vendor(root)
    build(root)
    cleanup_and_record(root)
    print("Littlewild v15 payload installed and rebuilt:", HTML_SHA, flush=True)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, tarfile.TarError, subprocess.CalledProcessError) as exc:
        print(f"Littlewild publication failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
