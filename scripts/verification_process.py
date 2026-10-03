"""Run one owned verification process family and retain output on failure.

On POSIX, each invocation gets its own session/process group. This includes
xvfb-run, Xvfb and Godot; stopping the wrapper alone must not leak the engine.
Windows currently guarantees cleanup of the direct child only. This is a test
runner for trusted programs, not a sandbox against deliberate process escape.
"""

from __future__ import annotations

import os
import signal
import subprocess
import tempfile
from pathlib import Path


def _stop_family(process: subprocess.Popen) -> None:
    try:
        if os.name == "posix":
            os.killpg(process.pid, signal.SIGKILL)
        elif process.poll() is None:
            process.kill()
    except ProcessLookupError:
        pass  # The whole owned group already exited.


def execute_process(
    command: list[str], *, cwd: Path, env: dict[str, str], timeout: float
) -> subprocess.CompletedProcess:
    """Bound execution and clean up descendants even after a successful wrapper exit.

    Output goes to a file, not an inherited PIPE: a surviving grandchild cannot
    hold communicate() open or prevent us from reporting a timed-out suite.
    """
    if timeout <= 0:
        raise ValueError("Verification timeout must be positive")
    with tempfile.TemporaryFile() as output:
        process = subprocess.Popen(
            command,
            cwd=cwd,
            env=env,
            stdout=output,
            stderr=subprocess.STDOUT,
            start_new_session=os.name == "posix",
        )
        timed_out = False
        try:
            process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            timed_out = True
        finally:
            # These processes belong exclusively to this invocation. Do not use
            # name matching or the caller's process group for cleanup.
            _stop_family(process)
            process.wait(timeout=5)
        output.seek(0)
        text = output.read().decode("utf-8", "replace")
        if timed_out:
            raise subprocess.TimeoutExpired(command, timeout, output=text)
        return subprocess.CompletedProcess(command, process.returncode, text)
