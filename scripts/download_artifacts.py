"""Download exact current-run artifacts with authenticated metadata and verified ZIP bytes."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import stat
import subprocess
import tempfile
import zipfile
from pathlib import Path, PurePosixPath

MAX_BYTES = 2 * 1024**3
MAX_FILES = 50000
NAME = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]*")
REPOSITORY = re.compile(r"[A-Za-z0-9][A-Za-z0-9-]*/[A-Za-z0-9_.-]+")
REVISION = re.compile(r"[0-9a-f]{40}(?:[0-9a-f]{24})?")
DIGEST = re.compile(r"sha256:([0-9a-f]{64})")


def api(endpoint: str, destination: Path | None = None) -> dict | None:
    """GitHub CLI supplies auth and safely follows GitHub's archive redirect.

    GH_TOKEN is supplied only through the process environment. It is never an
    argument or printed. The CLI restricts credentials to its configured host.
    """
    command = ["gh", "api", "--hostname", "github.com", "--method", "GET", endpoint]
    if destination is None:
        result = subprocess.run(command, capture_output=True, text=True, timeout=120)
        if result.returncode:
            raise RuntimeError("GitHub metadata request failed: " + endpoint)
        value = json.loads(result.stdout)
        if not isinstance(value, dict):
            raise ValueError("GitHub metadata must be an object")
        return value
    with destination.open("wb") as stream:
        result = subprocess.run(command, stdout=stream, stderr=subprocess.PIPE, timeout=600)
    if result.returncode:
        raise RuntimeError("GitHub artifact download failed: " + endpoint)
    return None


def select_artifacts(
    run: dict, artifacts: list[dict], repository: str, run_id: int, source: str, names: list[str]
) -> list[dict]:
    validate_request(repository, run_id, source, names)
    if (
        not isinstance(run, dict)
        or type(run.get("id")) is not int
        or run["id"] != run_id
        or run.get("head_sha") != source
        or not isinstance(run.get("repository"), dict)
        or run["repository"].get("full_name") != repository
    ):
        raise ValueError("Artifact run belongs to another repository, run or source")
    if not isinstance(artifacts, list) or any(not isinstance(item, dict) for item in artifacts):
        raise ValueError("Malformed artifact inventory")
    return _select_inventory(artifacts, run_id, source, names)


def validate_request(repository: str, run_id: int, source: str, names: list[str]) -> None:
    if (
        not REPOSITORY.fullmatch(repository)
        or repository.split("/")[-1] in (".", "..")
        or type(run_id) is not int
        or run_id <= 0
        or not REVISION.fullmatch(source)
        or not names
        or len(set(names)) != len(names)
        or any(not NAME.fullmatch(name) for name in names)
    ):
        raise ValueError("Supply a repository, positive run ID, full source SHA and unique names")


def _select_inventory(
    artifacts: list[dict], run_id: int, source: str, names: list[str]
) -> list[dict]:
    selected = []
    for name in names:
        matches = [item for item in artifacts if item.get("name") == name]
        if len(matches) != 1:
            raise ValueError("Missing or duplicate artifact: " + name)
        item = matches[0]
        origin = item.get("workflow_run")
        if (
            not isinstance(origin, dict)
            or type(origin.get("id")) is not int
            or origin["id"] != run_id
            or origin.get("head_sha") != source
            or item.get("expired") is not False
            or type(item.get("id")) is not int
            or item["id"] <= 0
            or type(item.get("size_in_bytes")) is not int
            or not 0 < item["size_in_bytes"] <= MAX_BYTES
            or not isinstance(item.get("digest"), str)
            or not DIGEST.fullmatch(item["digest"])
        ):
            raise ValueError("Artifact provenance, digest or availability is invalid: " + name)
        selected.append(item)
    if len({item["id"] for item in selected}) != len(selected):
        raise ValueError("Artifact identities are duplicated")
    return selected


def validate_entries(entries: list[zipfile.ZipInfo]) -> None:
    if not entries:
        raise ValueError("Artifact ZIP is empty")
    if len(entries) > MAX_FILES or sum(item.file_size for item in entries) > MAX_BYTES:
        raise ValueError("Artifact extraction exceeds the bounded evidence size")
    seen = set()
    for item in entries:
        name = item.filename.rstrip("/") if item.is_dir() else item.filename
        parts = name.split("/")
        kind = stat.S_IFMT(item.external_attr >> 16)
        if (
            not name
            or "\\" in name
            or "\x00" in item.orig_filename
            or PurePosixPath(name).is_absolute()
            or any(part in ("", ".", "..") or ":" in part for part in parts)
            or name.casefold() in seen
            or kind not in (0, stat.S_IFDIR if item.is_dir() else stat.S_IFREG)
        ):
            raise ValueError("Artifact contains an unsafe, special or duplicate path")
        seen.add(name.casefold())


def extract(archive: Path, destination: Path, expected: dict) -> None:
    if archive.stat().st_size != expected["size_in_bytes"]:
        raise ValueError("Downloaded archive size differs from GitHub metadata")
    with archive.open("rb") as stream:
        actual = hashlib.file_digest(stream, "sha256").hexdigest()
    if "sha256:" + actual != expected["digest"]:
        raise ValueError("Downloaded archive digest differs from GitHub metadata")
    with zipfile.ZipFile(archive) as zipped:
        entries = zipped.infolist()
        validate_entries(entries)
        destination.mkdir(parents=True, exist_ok=False)
        for item in entries:
            target = destination / item.filename
            if item.is_dir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                with zipped.open(item) as source, target.open("xb") as output:
                    shutil.copyfileobj(source, output)


def download(
    repository: str, run_id: int, source: str, names: list[str], output: Path, nested: bool = False
) -> dict:
    validate_request(repository, run_id, source, names)
    if output.exists() or output.is_symlink():
        raise ValueError("Artifact destination must be absent; old evidence is not acceptance")
    if len(names) != 1 and not nested:
        raise ValueError("Multiple artifacts require separate named destination directories")
    prefix = f"repos/{repository}/actions"
    run = api(f"{prefix}/runs/{run_id}")
    inventory = []
    total = None
    for page in range(1, 11):
        data = api(f"{prefix}/runs/{run_id}/artifacts?per_page=100&page={page}")
        if (
            type(data.get("total_count")) is not int
            or not 0 <= data["total_count"] <= 1000
            or not isinstance(data.get("artifacts"), list)
            or (total is not None and data["total_count"] != total)
        ):
            raise ValueError("Malformed or changing artifact inventory")
        total = data["total_count"]
        inventory.extend(data["artifacts"])
        if len(inventory) >= total:
            break
    if len(inventory) != total:
        raise ValueError("Incomplete artifact inventory")
    selected = select_artifacts(run, inventory, repository, run_id, source, names)
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="github-artifacts-", dir=output.parent) as temporary:
        stage = Path(temporary)
        extracted = stage / "extracted"
        if nested:
            extracted.mkdir()
        for item in selected:
            archive = stage / (item["name"] + ".zip")
            api(f"{prefix}/artifacts/{item['id']}/zip", archive)
            extract(archive, extracted / item["name"] if nested else extracted, item)
        extracted.rename(output)
    return {
        "repository": repository,
        "run_id": run_id,
        "source": source,
        "artifacts": [{key: item[key] for key in ("id", "name", "digest")} for item in selected],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repository", required=True)
    parser.add_argument("--run-id", type=int, required=True)
    parser.add_argument("--source", required=True)
    parser.add_argument("--name", action="append", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--nested", action="store_true")
    args = parser.parse_args()
    try:
        result = download(
            args.repository, args.run_id, args.source, args.name, args.output, args.nested
        )
    except (
        OSError,
        ValueError,
        RuntimeError,
        zipfile.BadZipFile,
        subprocess.SubprocessError,
    ) as error:
        parser.exit(2, f"Artifact download failed: {error}\n")
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
