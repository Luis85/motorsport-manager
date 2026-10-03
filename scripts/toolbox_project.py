"""Private project/import resources and truthful startup source identity."""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from toolbox_process import ToolProcess
from toolbox_protocol import MAX_BYTES, RUNNER, ToolboxError, decode, encode, ready, response
from verification_run import source_digest


def private_windows_editor(executable: str, home: Path) -> str:
    """Official self-contained mode keeps Windows known-folder editor state private."""
    source = Path(executable).resolve()
    folder = home / "editor"
    folder.mkdir()
    shutil.copy2(source, folder / source.name)
    if source.name.endswith("_console.exe"):
        companion = source.with_name(source.name.removesuffix("_console.exe") + ".exe")
        if not companion.is_file():
            raise ToolboxError(
                "TRANSPORT_ERROR", "Godot console wrapper needs its editor companion"
            )
    else:
        companion = source.with_name(source.stem + "_console.exe")
    if companion.is_file():
        shutil.copy2(companion, folder / companion.name)
    (folder / "_sc_").touch()
    return str(folder / source.name)


class ToolProject:
    """One copied project, import cache and owned user-data lifetime per client."""

    def __init__(self, root: Path, godot: str | Path | None, packs: list, timeout: float):
        self.root = root.resolve()
        if not (self.root / "project.godot").is_file():
            raise ToolboxError("TRANSPORT_ERROR", "Toolbox root must contain project.godot")
        executable = str(godot or os.environ.get("GODOT_BINARY") or "godot")
        self.godot = shutil.which(executable)
        if not self.godot:
            raise ToolboxError("TRANSPORT_ERROR", "Godot is unavailable; supply --godot")
        self.timeout = timeout
        revision = (
            subprocess.run(
                ["git", "rev-parse", "HEAD"],
                cwd=self.root,
                capture_output=True,
                text=True,
                timeout=10,
                check=False,
            )
            if shutil.which("git")
            else None
        )
        self.identity = {
            "source_revision": revision.stdout.strip()
            if revision and revision.returncode == 0
            else "",
            "source_digest": source_digest(self.root),
        }
        self.temporary = tempfile.TemporaryDirectory(prefix="motorsport-toolbox-")
        self.home = Path(self.temporary.name)
        self.project = self.home / "project"
        self.env = dict(
            os.environ,
            **{
                "XDG_DATA_HOME": str(self.home / "user"),
                "XDG_CACHE_HOME": str(self.home / "cache"),
                "XDG_CONFIG_HOME": str(self.home / "config"),
                "APPDATA": str(self.home / "user"),
                "LOCALAPPDATA": str(self.home / "cache"),
            },
        )
        self.packs = [str(Path(pack).resolve()) for pack in packs]
        for name in ("user", "cache", "config"):
            (self.home / name).mkdir()
        if os.name == "nt":
            self.godot = private_windows_editor(self.godot, self.home)

    def prepare(self) -> None:
        shutil.copytree(
            self.root,
            self.project,
            ignore=shutil.ignore_patterns(
                ".git", ".godot", "reports", "builds", "__pycache__", ".ruff_cache"
            ),
        )
        if source_digest(self.project) != self.identity["source_digest"]:
            raise ToolboxError("TRANSPORT_ERROR", "Source changed while staging the toolbox")
        process = ToolProcess(
            [
                self.godot,
                "--headless",
                "--log-file",
                str(self.home / "import.log"),
                "--path",
                str(self.project),
                "--editor",
                "--import",
            ],
            self.project,
            self.env,
            self.timeout,
        )
        process.close()
        # Import can generate UID sidecars in a never-imported checkout. Record
        # the actual staged source bytes used at native startup, not an inference.
        self.identity["source_digest"] = source_digest(self.project)

    def command(self, arguments: list[str]) -> list[str]:
        return [
            self.godot,
            "--headless",
            "--log-file",
            str(self.home / "engine.log"),
            "--path",
            str(self.project),
            "--script",
            RUNNER,
            "--",
            *arguments,
            *("--pack=" + pack for pack in self.packs),
            *("--" + key.replace("_", "-") + "=" + value for key, value in self.identity.items()),
        ]

    def file_request(self, sent: dict) -> dict:
        request_path, response_path = self.home / "request.json", self.home / "response.json"
        request_path.write_bytes(encode(sent))
        if response_path.exists():
            response_path.unlink()
        process = ToolProcess(
            self.command(
                [
                    "--toolbox-request=" + str(request_path),
                    "--toolbox-response=" + str(response_path),
                ]
            ),
            self.project,
            self.env,
            self.timeout,
        )
        try:
            # File mode can emit the result marker, but exit0 alone is never acceptance.
            process.process.stdin.close()
            process.process.wait(timeout=self.timeout)
            process.close(graceful=False)
            process.check()
            if (
                process.process.returncode
                or not response_path.is_file()
                or response_path.is_symlink()
            ):
                raise ToolboxError("ENGINE_ERROR", "Native file request did not produce a result")
            with response_path.open("rb") as stream:
                value = response(decode(stream.read(MAX_BYTES + 1)), sent, self.identity)
            results = 0
            while not process.frames.empty():
                kind, emitted = process.frames.get_nowait()
                if kind == "TOOLBOX_READY":
                    ready(emitted, value["metadata"])
                if kind == "TOOLBOX_RESULT":
                    results += 1
                    if emitted != value or results > 1:
                        raise ToolboxError(
                            "PROTOCOL_ERROR", "File and emitted native results differ or repeat"
                        )
            return value
        except subprocess.TimeoutExpired as error:
            raise ToolboxError("TIMEOUT", "Native file request timed out") from error
        finally:
            process.close(graceful=False)

    def close(self) -> None:
        self.temporary.cleanup()
