"""Bounded persistent JSON-line transport and cleanup of one owned process family."""

from __future__ import annotations

import collections
import os
import queue
import re
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path

from toolbox_protocol import MAX_BYTES, ToolboxError, decode, positive_timeout
from toolbox_windows import WindowsJob

ENGINE_ERROR = re.compile(r"SCRIPT ERROR:|Parse Error:|(?:^|\s)ERROR:")


def stop_family(process: subprocess.Popen, job: WindowsJob | None = None) -> None:
    """The PID/group was created by this helper, never selected by executable name."""
    if os.name == "posix":
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    elif job is not None:
        job.close()
    elif process.poll() is None:
        if process.poll() is None:
            process.kill()
    process.wait(timeout=10)


class ToolProcess:
    """Drain both pipes continuously; diagnostics cannot block gameplay requests."""

    def __init__(self, command: list[str], cwd: Path, env: dict, timeout: float):
        self.timeout = positive_timeout(timeout)
        self.frames = queue.Queue(maxsize=128)
        self.diagnostics = collections.deque(maxlen=100)
        self.failure = None
        self.lock = threading.Lock()
        self.closed = False
        self.job = WindowsJob() if os.name == "nt" else None
        if self.job is not None:
            command = [
                sys.executable,
                "-u",
                str(Path(__file__).with_name("toolbox_bootstrap.py")),
                *command,
            ]
        options = (
            {"start_new_session": True}
            if os.name == "posix"
            else {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP}
        )
        try:
            self.process = subprocess.Popen(
                command,
                cwd=cwd,
                env=env,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                **options,
            )
            if self.job is not None:
                self.job.assign(self.process)
                self.process.stdin.write(b"\0")
                self.process.stdin.flush()
        except BaseException:
            if hasattr(self, "process"):
                self.process.kill()
                self.process.wait(timeout=10)
            if self.job is not None:
                self.job.close()
            raise
        self.readers = [
            threading.Thread(target=self._read, args=(stream, name), daemon=True)
            for stream, name in ((self.process.stdout, "stdout"), (self.process.stderr, "stderr"))
        ]
        for reader in self.readers:
            reader.start()

    def _fail(self, code: str, message: str) -> None:
        with self.lock:
            if self.failure is None:
                self.failure = ToolboxError(code, message)

    def _frame(self, kind: str, value: object) -> None:
        try:
            self.frames.put_nowait((kind, value))
        except queue.Full:
            self._fail("PROTOCOL_ERROR", "Native process flooded the bounded frame queue")

    def _read(self, stream, name: str) -> None:
        try:
            while raw := stream.readline(MAX_BYTES + 1):
                if len(raw) > MAX_BYTES:
                    self._fail("PROTOCOL_ERROR", "Native output line exceeds 8 MiB")
                    return
                line = raw.decode("utf-8", "replace").rstrip("\r\n")
                with self.lock:
                    self.diagnostics.append(name + ": " + line[:2048])
                if name == "stdout":
                    for prefix in ("TOOLBOX_READY", "TOOLBOX_RESULT"):
                        if line.startswith(prefix):
                            if not raw.startswith((prefix + " ").encode()):
                                self._fail("PROTOCOL_ERROR", "Malformed native marker")
                            else:
                                self._frame(prefix, decode(raw[len(prefix) + 1 :]))
                            break
                    else:
                        if ENGINE_ERROR.search(line):
                            self._fail(
                                "ENGINE_ERROR", "Native engine emitted an error: " + line[:2048]
                            )
                elif ENGINE_ERROR.search(line):
                    self._fail("ENGINE_ERROR", "Native engine emitted an error: " + line[:2048])
        except ToolboxError as error:
            self._fail(error.code, error.message)
        except (OSError, ValueError) as error:
            if not self.closed:
                self._fail("TRANSPORT_ERROR", "Native output could not be read: " + str(error))
        finally:
            if name == "stdout":
                self._frame("EOF", None)

    def check(self) -> None:
        with self.lock:
            error = self.failure
            lines = list(self.diagnostics)
        if error:
            raise ToolboxError(error.code, error.message, {"diagnostics": lines})

    def read(self, kind: str) -> object:
        deadline = time.monotonic() + self.timeout
        while True:
            self.check()
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise ToolboxError("TIMEOUT", "Timed out waiting for " + kind)
            try:
                received, value = self.frames.get(timeout=min(remaining, 0.05))
            except queue.Empty:
                continue
            self.check()
            if received != kind:
                raise ToolboxError("PROTOCOL_ERROR", "Expected " + kind + ", received " + received)
            return value

    def send(self, raw: bytes) -> None:
        self.check()
        if self.closed or self.process.poll() is not None:
            raise ToolboxError("TRANSPORT_ERROR", "Native toolbox process has exited")

        def write() -> None:
            try:
                self.process.stdin.write(raw + b"\n")
                self.process.stdin.flush()
            except (OSError, ValueError) as error:
                self._fail("TRANSPORT_ERROR", "Native request could not be written: " + str(error))

        writer = threading.Thread(target=write, daemon=True)
        writer.start()
        writer.join(self.timeout)
        if writer.is_alive():
            raise ToolboxError("TIMEOUT", "Timed out writing native request")
        self.check()

    def close(self, *, graceful: bool = True) -> None:
        if self.closed:
            return
        try:
            if graceful:
                self.process.stdin.close()
                try:
                    self.process.wait(timeout=self.timeout)
                except subprocess.TimeoutExpired as error:
                    raise ToolboxError(
                        "TIMEOUT", "Native toolbox did not exit after EOF"
                    ) from error
        finally:
            stop_family(self.process, self.job)
            self.closed = True
            for reader in self.readers:
                reader.join(timeout=2)
            for stream in (self.process.stdin, self.process.stdout, self.process.stderr):
                stream.close()
        if graceful:
            self.check()
            if self.process.returncode:
                raise ToolboxError(
                    "ENGINE_ERROR",
                    "Native toolbox exited unsuccessfully",
                    {"exit_code": self.process.returncode},
                )
            while not self.frames.empty():
                kind, _ = self.frames.get_nowait()
                if kind != "EOF":
                    raise ToolboxError("PROTOCOL_ERROR", "Unrequested native response at shutdown")
