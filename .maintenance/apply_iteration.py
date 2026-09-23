"""One-time, hash-checked recovery on iteration-4-validation; never operates on main."""
from pathlib import Path
import hashlib
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]
EXPECTED_BASE = "cbacab3a35fea623ec9f3389c099de0f2f4763d3"
subprocess.run(["git", "merge-base", "--is-ancestor", EXPECTED_BASE, "HEAD"], cwd=ROOT, check=True)
pending = {}
for manifest in sorted((ROOT / ".maintenance").glob("*-edits.json")):
    data = json.loads(manifest.read_text(encoding="utf-8"))
    for record in data["files"]:
        relative = Path(record["path"])
        if relative.is_absolute() or ".." in relative.parts or relative.parts[0] not in {"scripts", "tests", "docs", "README.md"}:
            raise ValueError(f"Unapproved source path: {relative}")
        target = ROOT / relative
        if target.is_symlink() or str(relative) in pending:
            raise ValueError(f"Symlink or duplicate source path: {relative}")
        old = target.read_bytes() if target.exists() else b""
        before = hashlib.sha256(old).hexdigest() if target.exists() else None
        if before != record["before_sha256"]:
            raise ValueError(f"Source changed since verified baseline: {relative}")
        lines = old.decode("utf-8").splitlines(keepends=True)
        cursor = 0
        output = []
        for hunk in record["hunks"]:
            start, end = hunk["start"], hunk["end"]
            if not 0 <= cursor <= start <= end <= len(lines):
                raise ValueError(f"Invalid or overlapping edit in {relative}")
            output.extend(lines[cursor:start]); output.append(hunk["text"]); cursor = end
        output.extend(lines[cursor:])
        new = "".join(output).encode("utf-8")
        if hashlib.sha256(new).hexdigest() != record["after_sha256"]:
            raise ValueError(f"Recovered source hash mismatch: {relative}")
        pending[str(relative)] = new
# Validate every edit first. A failed check leaves source files untouched.
for relative, data in pending.items():
    target = ROOT / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    print(f"Verified source: {relative}")
print(f"Applied {len(pending)} hash-checked source updates.")
