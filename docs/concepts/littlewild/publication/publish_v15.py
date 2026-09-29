"""Validate and publish the pinned Littlewild v15 delivery from a detached worktree.

The default is read-only. --publish permits a scoped commit, non-force push and
creation/update of the Littlewild PR. No credentials are stored or requested.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import stat
import subprocess
import sys
import tempfile
import zipfile

REPOSITORY = "Luis85/motorsport-manager"
BRANCH = "concept/littlewild-v15-world-ui"
DESTINATION = Path("docs/concepts/littlewild")
ARCHIVE_SHA = "8793552fbf1776823018e61913d2b6641856480d0f4c4c4c343c8145f8b82b77"
HTML_SHA = "acaf00f6163cb8ca3539370ed8b89e2afd844491ae7ee1c1bb70a321b0543032"
PREFIX = "Littlewild-v15/"
MARKER = "<!-- littlewild-v15-publication -->"
TITLE = "Littlewild v15: world-facing UI and configurable scenario packs"
APPROVED_READMES = {'b193c768605e59162e83f8d6896824bedc03258d0b59ce1bdfc46d6b07b6c7c1', 'eb0d8ace67062f9816318317dd1e1d1941c11924df0a0ff3c06ed10227c133f3'}


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def run(arguments: list[str], cwd: Path, timeout: int = 180) -> str:
    result = subprocess.run(
        arguments, cwd=cwd, text=True, capture_output=True, timeout=timeout
    )
    if result.returncode:
        raise RuntimeError(
            f"{arguments[0]} {arguments[1]} failed: "
            + (result.stderr.strip() or result.stdout.strip())
        )
    return result.stdout.strip()


def archive_files(path: Path) -> dict[str, bytes]:
    if not path.is_file() or path.stat().st_size > 20 * 1024 * 1024:
        raise ValueError("Supply the original littlewild-v15-source.zip (under 20 MiB).")
    if digest(path.read_bytes()) != ARCHIVE_SHA:
        raise ValueError("Archive checksum differs from the reviewed v15 delivery.")
    files: dict[str, bytes] = {}
    casefolded: set[str] = set()
    with zipfile.ZipFile(path) as archive:
        if len(archive.infolist()) > 500:
            raise ValueError("Unexpected archive entry count.")
        if sum(info.file_size for info in archive.infolist()) > 64 * 1024 * 1024:
            raise ValueError("Unexpected expanded archive size.")
        for info in archive.infolist():
            if info.is_dir():
                continue
            name = info.filename
            if not name.startswith(PREFIX) or "\\" in name:
                raise ValueError("Unexpected archive path.")
            relative = name[len(PREFIX):]
            parts = relative.split("/")
            if any(part in ("", ".", "..", ".git") or ":" in part for part in parts):
                raise ValueError("Unsafe archive path.")
            if PurePosixPath(relative).is_absolute():
                raise ValueError("Absolute archive path.")
            if stat.S_ISLNK(info.external_attr >> 16):
                raise ValueError("Archive symlinks are not accepted.")
            if relative.casefold() in casefolded:
                raise ValueError("Duplicate or case-colliding archive path.")
            casefolded.add(relative.casefold())
            files[relative] = archive.read(info)
    if len(files) != 203 or digest(files.get("littlewild.html", b"")) != HTML_SHA:
        raise ValueError("Missing or mismatched v15 payload.")
    return files


def check_destination(root: Path, files: dict[str, bytes]) -> None:
    for relative, content in files.items():
        target = root / relative
        for parent in [target, *target.parents]:
            if parent.is_symlink():
                raise ValueError(f"Refusing symlink: {parent}")
        if target.exists():
            if not target.is_file():
                raise ValueError(f"A directory conflicts with {relative}.")
            old = target.read_bytes()
            if old == content:
                continue
            if relative == "README.md" and digest(old) in APPROVED_READMES:
                continue
            raise ValueError(f"Existing file differs; preserve and review it: {relative}")
        if any(parent.exists() and not parent.is_dir() for parent in target.parents):
            raise ValueError(f"A parent path is not a directory: {relative}")


def write_files(root: Path, files: dict[str, bytes]) -> None:
    check_destination(root, files)
    for relative, content in files.items():
        target = root / relative
        if target.is_file() and target.read_bytes() == content:
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as output:
            temporary = Path(output.name)
            output.write(content)
        try:
            os.replace(temporary, target)
        finally:
            temporary.unlink(missing_ok=True)


def validate_checkout(repo: Path) -> None:
    if not shutil.which("git"):
        raise RuntimeError("Git is required.")
    if Path(run(["git", "rev-parse", "--show-toplevel"], repo)).resolve() != repo:
        raise ValueError("Pass the repository root, not a subdirectory.")
    remote = run(["git", "remote", "get-url", "origin"], repo).removesuffix(".git")
    if remote not in (
        f"https://github.com/{REPOSITORY}", f"git@github.com:{REPOSITORY}"
    ):
        raise ValueError("Origin is not the intended GitHub repository.")
    if run(["git", "status", "--porcelain"], repo):
        raise ValueError("Checkout must be clean; no user changes will be overwritten.")


def safe_staged_paths(paths: list[str]) -> bool:
    prefix = DESTINATION.as_posix() + "/"
    return bool(paths) and all(path.startswith(prefix) for path in paths)


def publish(repo: Path, files: dict[str, bytes]) -> str:
    if not shutil.which("gh"):
        raise RuntimeError("An authenticated GitHub CLI (gh) is required.")
    run(["gh", "auth", "status"], repo)
    run(["git", "var", "GIT_AUTHOR_IDENT"], repo)
    prs = json.loads(run([
        "gh", "pr", "list", "--repo", REPOSITORY, "--head", BRANCH,
        "--base", "main", "--state", "open", "--json", "number,url,isDraft,body"
    ], repo))
    if len(prs) > 1:
        raise ValueError("Multiple matching PRs; resolve the ambiguity before publishing.")
    run(["git", "fetch", "origin", f"refs/heads/{BRANCH}"], repo)
    base = run(["git", "rev-parse", "FETCH_HEAD"], repo)
    with tempfile.TemporaryDirectory(prefix="littlewild-publish-") as temp:
        work = Path(temp).resolve() / "worktree"
        added = False
        try:
            run(["git", "worktree", "add", "--detach", str(work), base], repo)
            added = True
            destination = work / DESTINATION
            write_files(destination, files)
            run([sys.executable, "source/build.py"], destination)
            if digest((destination / "littlewild.html").read_bytes()) != HTML_SHA:
                raise RuntimeError("Rebuild does not match the verified HTML; nothing pushed.")
            for relative, expected in files.items():
                if (destination / relative).read_bytes() != expected:
                    raise RuntimeError(f"Installed file differs after build: {relative}")
            status_text = json.dumps({
                "status": "payload-installed-and-rebuilt", "archiveSha256": ARCHIVE_SHA,
                "htmlSha256": HTML_SHA, "payloadFiles": len(files),
                "nativeGameChanged": False, "testsRerunByPublisher": False
            }, indent=2) + "\n"
            write_files(destination, {"publication/STATUS.json": status_text.encode("utf-8")})
            run(["git", "add", "--", DESTINATION.as_posix()], work)
            paths = run(["git", "diff", "--cached", "--name-only"], work).splitlines()
            if paths:
                if not safe_staged_paths(paths):
                    raise RuntimeError("Unexpected staged path; nothing committed or pushed.")
                run(["git", "commit", "-m",
                     "docs(concepts): publish verified Littlewild v15 payload"], work)
            commit = run(["git", "rev-parse", "HEAD"], work)
            run(["git", "push", "origin", f"HEAD:refs/heads/{BRANCH}"], work)
            print("Pushed payload commit:", commit, flush=True)
            body = destination / "PULL_REQUEST.md"
            if prs:
                pr = prs[0]
                if MARKER in pr.get("body", ""):
                    run(["gh", "pr", "edit", str(pr["number"]), "--repo", REPOSITORY,
                         "--title", TITLE, "--body-file", str(body)], work)
                    if pr["isDraft"]:
                        run(["gh", "pr", "ready", str(pr["number"]),
                             "--repo", REPOSITORY], work)
                else:
                    run(["gh", "pr", "comment", str(pr["number"]), "--repo", REPOSITORY,
                         "--body", f"Verified v15 payload published at `{commit}`. "
                         "The HTML rebuild matches the supplied SHA-256. "
                         "No native game files changed; no test rerun by this publisher."], work)
                return pr["url"]
            return run(["gh", "pr", "create", "--repo", REPOSITORY, "--base", "main",
                        "--head", BRANCH, "--title", TITLE, "--body-file", str(body)], work)
        finally:
            if added:
                run(["git", "worktree", "remove", "--force", str(work)], repo)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("checkout", type=Path)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--publish", action="store_true")
    args = parser.parse_args()
    files = archive_files(args.archive.resolve())
    repo = args.checkout.resolve()
    validate_checkout(repo)
    check_destination(repo / DESTINATION, files)
    print(f"Verified {len(files)} payload files for {REPOSITORY}:{BRANCH}.")
    if not args.publish:
        print("Read-only check complete. No branch, file, commit or PR was changed.")
        return 0
    print(publish(repo, files))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, RuntimeError, zipfile.BadZipFile,
            subprocess.TimeoutExpired) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
