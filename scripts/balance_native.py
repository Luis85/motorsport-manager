"""Production content validation inside an isolated project and user-data home."""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from balance_authoring import Snapshot, decode
from build_standalone import ENGINE
from toolbox_project import private_windows_editor
from toolbox_protocol import ToolboxError
from verification_run import source_digest

EXCLUDED = {
    ".git",
    ".godot",
    "reports",
    "builds",
    "__pycache__",
    ".ruff_cache",
    ".venv",
    "venv",
    ".aws",
    ".codex",
    ".agents",
    "config",
    "playerdata",
    "user_data",
    "saves",
    "recordings",
}


def executable(godot: str | None) -> str | None:
    selected = godot or os.environ.get("GODOT_BINARY") or os.environ.get("VERIFICATION_TEST_GODOT")
    return shutil.which(selected) if selected else None


def clean_result(run: subprocess.CompletedProcess) -> dict:
    payloads = []
    diagnostics = []
    for line in run.stdout.splitlines():
        if line.startswith("CONTENT_RESULT "):
            payloads.append(line.removeprefix("CONTENT_RESULT "))
        else:
            diagnostics.append(line)
    log = "\n".join(diagnostics) + "\n" + run.stderr
    if len(payloads) != 1 or any(
        marker in log for marker in ("SCRIPT ERROR:", "Parse Error:", "ERROR:")
    ):
        raise ValueError("Native validator did not produce one clean result. " + log[-3000:])
    result = decode(payloads[0])
    if not isinstance(result, dict) or type(result.get("ok")) is not bool:
        raise ValueError("Native validator requires an explicit Boolean ok result.")
    if run.returncode != (0 if result["ok"] else 1):
        raise ValueError("Native validator exit status disagrees with its result.")
    return result


class NativeProject:
    """One private trusted res://config root; never load a core pack externally."""

    def __init__(self, root: Path, snapshot: Snapshot, godot: str | None):
        self.godot = executable(godot)
        if self.godot is None:
            raise ValueError("Godot is unavailable. No native validation was executed.")
        self.root = root
        self.snapshot = snapshot
        self.temporary = tempfile.TemporaryDirectory(prefix="motorsport-balance-")
        self.home = Path(self.temporary.name)
        self.project = self.home / "project"
        self.env = dict(os.environ)
        for key, directory in {
            "XDG_DATA_HOME": "user",
            "XDG_CACHE_HOME": "cache",
            "XDG_CONFIG_HOME": "settings",
            "APPDATA": "user",
            "LOCALAPPDATA": "cache",
        }.items():
            path = self.home / directory
            path.mkdir(exist_ok=True)
            self.env[key] = str(path)
        self.env.update(GODOT_SILENCE_ROOT_WARNING="1", LP_NUM_THREADS="2")
        try:
            if os.name == "nt":
                self.godot = private_windows_editor(self.godot, self.home)
        except ToolboxError as error:
            self.close()
            raise ValueError(str(error)) from error
        except BaseException:
            self.close()
            raise
        self.identity: dict = {}

    def __enter__(self):
        try:
            self.prepare()
        except BaseException:
            self.close()
            raise
        return self

    def __exit__(self, *_):
        self.close()

    def close(self) -> None:
        self.temporary.cleanup()

    def run(self, arguments: list[str]) -> subprocess.CompletedProcess:
        return subprocess.run(
            [self.godot, "--headless", "--path", str(self.project), *arguments],
            text=True,
            capture_output=True,
            timeout=120,
            env=self.env,
        )

    def prepare(self) -> None:
        version = subprocess.run(
            [self.godot, "--version"],
            text=True,
            capture_output=True,
            timeout=15,
            env=self.env,
        )
        if version.returncode or version.stdout.strip() != ENGINE:
            raise ValueError(
                f"Expected pinned Godot {ENGINE}; received {version.stdout.strip()!r}. No validation was executed."
            )
        shutil.copytree(
            self.root,
            self.project,
            ignore=shutil.ignore_patterns(*EXCLUDED),
        )
        self.snapshot.write(self.project / "config")
        run = self.run(["--editor", "--import", "--quit"])
        log = run.stdout + "\n" + run.stderr
        if run.returncode or any(
            marker in log for marker in ("SCRIPT ERROR:", "Parse Error:", "ERROR:")
        ):
            raise ValueError("Godot import failed; validation was not executed. " + log[-3000:])
        git = shutil.which("git")
        revision = (
            subprocess.run(
                [git, "rev-parse", "HEAD"],
                cwd=self.root,
                text=True,
                capture_output=True,
                timeout=10,
                check=False,
            )
            if git
            else None
        )
        self.identity = {
            "engine_version": version.stdout.strip(),
            "source_revision": revision.stdout.strip()
            if revision and revision.returncode == 0
            else "",
            "source_digest": source_digest(self.project),
            "config_digest": self.snapshot.digest.hexdigest(),
        }

    def invoke(self, action: str) -> dict:
        try:
            result = clean_result(
                self.run(
                    [
                        "--script",
                        "res://scripts/services/content/cli.gd",
                        "--",
                        "--action=" + action,
                    ]
                )
            )
        except (ValueError, OSError, subprocess.TimeoutExpired) as error:
            self.executed_error(error)
            raise
        result.update(engine_executed=True, metadata=self.identity)
        return result

    def executed_error(self, error: Exception) -> Exception:
        error.engine_executed = True
        error.metadata = self.identity
        return error

    def validate(self) -> dict:
        result = self.invoke("balance-validate")
        if result.get("ok") and result.get("config_validated") is not True:
            raise self.executed_error(
                ValueError("Native validator did not confirm complete config acceptance.")
            )
        return result

    def schemas(self) -> dict:
        result = self.invoke("schemas")
        if not result.get("ok") or not isinstance(result.get("schemas"), dict):
            raise self.executed_error(
                ValueError("Native validator did not return generated schemas.")
            )
        return result["schemas"]


def published_schemas(root: Path) -> dict:
    """Read generated schema artifacts for honest offline field inspection."""
    return {
        path.name.removesuffix(".schema.json"): decode(path.read_bytes())
        for path in (root / "content/schemas/v1").glob("*.schema.json")
    }


def field_metadata(document, schemas: dict, parts: tuple[str, ...]) -> dict:
    schema = schemas.get(document.get("kind", ""), {}) if isinstance(document, dict) else {}
    for part in parts:
        schema = (
            schema.get("items", {})
            if "items" in schema
            else schema.get("properties", {}).get(part, {})
        )
    result = {
        key: schema[key]
        for key in ("type", "minimum", "maximum", "enum", "description")
        if key in schema
    }
    if ": " in result.get("description", ""):
        result["units"] = result["description"].split(": ", 1)[0]
    return result
