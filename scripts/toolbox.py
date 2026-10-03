#!/usr/bin/env python3
"""Persistent native developer toolbox SDK and pure-JSON command-line adapter.

Import ToolboxClient from this module with scripts/ on Python's module path.
Every gameplay result is produced by the native GameToolbox; this module only
validates transport structure, correlation and execution/source evidence.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import threading
from pathlib import Path

from toolbox_facets import Campaigns, Tracks, Weekends
from toolbox_process import ToolProcess
from toolbox_project import ToolProject
from toolbox_protocol import (
    MAX_BYTES,
    ToolboxDomainError,
    ToolboxError,
    decode,
    encode,
    positive_timeout,
    ready,
    request,
    response,
    validate_request,
)

ROOT = Path(__file__).resolve().parents[1]
__all__ = ["ToolboxClient", "ToolboxDomainError", "ToolboxError"]


class ToolboxClient:
    """Incremental process-local sessions; explicit context controls native lifetime.

    .request(envelope) retains native success/rejection evidence. .call(operation,
    session, arguments) returns only the detached result and raises a structured
    ToolboxDomainError for native rejection. No operation runs on a Python model.
    """

    def __init__(self, *, godot=None, root=ROOT, packs=(), timeout=60, file_mode=False):
        self.timeout = positive_timeout(timeout)
        self.options = (Path(root), godot, list(packs), self.timeout)
        self.file_mode = file_mode
        self.project = self.process = None
        self.metadata = None
        self.counter = 0
        self.request_ids = set()
        self.lock = threading.RLock()
        self.weekends = Weekends(self, "weekend")
        self.campaigns = Campaigns(self, "campaign")
        self.tracks = Tracks(self, "track")

    def __enter__(self):
        with self.lock:
            if self.project is not None:
                raise ToolboxError("TRANSPORT_ERROR", "Toolbox context is already open")
            self.project = ToolProject(*self.options)
            self.metadata = None
            self.request_ids.clear()
            try:
                self.project.prepare()
                if not self.file_mode:
                    self.process = ToolProcess(
                        self.project.command(["--toolbox-stdio"]),
                        self.project.project,
                        self.project.env,
                        self.timeout,
                    )
                    self.metadata = ready(self.process.read("TOOLBOX_READY"), self.project.identity)
                return self
            except BaseException:
                self.close(graceful=False)
                raise

    def __exit__(self, kind, value, traceback):
        self.close(graceful=kind is None)

    def close(self, *, graceful=True):
        with self.lock:
            try:
                if self.process is not None:
                    self.process.close(graceful=graceful)
            finally:
                self.process = None
                if self.project is not None:
                    self.project.close()
                    self.project = None

    def request(self, envelope: dict) -> dict:
        with self.lock:
            validate_request(envelope)
            # Freeze caller input before it can be changed by another thread.
            raw = encode(envelope)
            sent = decode(raw)
            if self.project is None:
                raise ToolboxError("TRANSPORT_ERROR", "Use ToolboxClient inside a with context")
            if sent["request_id"] in self.request_ids:
                raise ToolboxError(
                    "PROTOCOL_ERROR", "Request IDs must be unique within a client context"
                )
            if self.file_mode and self.request_ids:
                raise ToolboxError(
                    "TRANSPORT_ERROR", "File mode accepts one request or ordered batch per context"
                )
            self.request_ids.add(sent["request_id"])
            try:
                if self.file_mode:
                    return self.project.file_request(sent)
                self.process.send(raw)
                value = response(self.process.read("TOOLBOX_RESULT"), sent, self.metadata)
                self.process.check()
                return value
            except ToolboxError:
                self.close(graceful=False)
                raise
            except (OSError, subprocess.SubprocessError) as error:
                self.close(graceful=False)
                raise ToolboxError(
                    "TRANSPORT_ERROR", "Native request failed: " + str(error)
                ) from error

    def call(self, operation: str, session: str = "", arguments: dict | None = None):
        with self.lock:
            self.counter += 1
            while "r" + str(self.counter) in self.request_ids:
                self.counter += 1
            sent = request(
                operation, session, {} if arguments is None else arguments, "r" + str(self.counter)
            )
            value = self.request(sent)
            if not value["ok"]:
                raise ToolboxDomainError(value)
            return value["result"]

    def discover(self):
        return self.call("toolbox.discover")

    def batch(self, requests: list[dict], stop_on_error: bool = True):
        return self.call(
            "toolbox.batch", arguments={"requests": requests, "stop_on_error": stop_on_error}
        )


def read_json(path: str) -> object:
    if path == "-":
        return decode(sys.stdin.buffer.read(MAX_BYTES + 1))
    with Path(path).open("rb") as stream:
        return decode(stream.read(MAX_BYTES + 1))


def arguments() -> argparse.Namespace:
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--godot")
    common.add_argument("--root", type=Path, default=ROOT)
    common.add_argument("--pack", action="append", default=[])
    common.add_argument("--timeout", type=float, default=60)
    common.add_argument(
        "--file-mode",
        action="store_true",
        help="one native file invocation; use batch for sessions",
    )
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("discover", parents=[common])
    call = commands.add_parser("call", parents=[common])
    call.add_argument("operation")
    call.add_argument("--session", default="")
    call.add_argument("--arguments", default="{}", help="JSON object passed to the native owner")
    raw = commands.add_parser("request", parents=[common])
    raw.add_argument("path", help="full request JSON file, or - for stdin")
    batch = commands.add_parser("batch", parents=[common])
    batch.add_argument("path", help="JSON request array or {requests,stop_on_error} object, or -")
    return parser.parse_args()


def cli_request(args: argparse.Namespace) -> dict:
    if args.command == "request":
        value = read_json(args.path)
        validate_request(value)
        return value
    if args.command == "batch":
        value = read_json(args.path)
        payload = {"requests": value, "stop_on_error": True} if isinstance(value, list) else value
        return request("toolbox.batch", "", payload, "cli-1")
    operation = "toolbox.discover" if args.command == "discover" else args.operation
    payload = {} if args.command == "discover" else decode(args.arguments.encode("utf-8"))
    return request(operation, getattr(args, "session", ""), payload, "cli-1")


def main() -> int:
    args = arguments()
    try:
        sent = cli_request(args)
        with ToolboxClient(
            godot=args.godot,
            root=args.root,
            packs=args.pack,
            timeout=args.timeout,
            file_mode=args.file_mode,
        ) as client:
            value = client.request(sent)
        print(json.dumps(value, ensure_ascii=False, allow_nan=False))
        return 0 if value["ok"] else 1
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        failure = ToolboxError("TRANSPORT_ERROR", str(error))
    except ToolboxError as error:
        failure = error
    print(json.dumps({"ok": False, "error": failure.as_dict(), "transport": True}), flush=True)
    print(f"Toolbox {failure.code}: {failure.message}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
