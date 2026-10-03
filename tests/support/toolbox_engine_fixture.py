#!/usr/bin/env python3
"""Adversarial transport fixture only; this does not implement any gameplay model."""

import json
import os
import subprocess
import sys
import time
from pathlib import Path


def argument(name, default=""):
    for value in sys.argv[1:]:
        if value.startswith("--" + name + "="):
            return value.split("=", 1)[1]
    return default


def emit(prefix, value):
    print(prefix + " " + json.dumps(value), flush=True)


def make_response(sent, metadata, count, mode):
    response = {
        key: sent.get(key, "")
        for key in ("protocol", "version", "request_id", "operation", "session")
    }
    response.update(
        ok=True,
        metadata=metadata,
        result={
            "arguments": sent["arguments"],
            "session": sent.get("session", ""),
            "operation": sent["operation"],
            "received": count,
        },
    )
    if mode == "reject":
        response.pop("result")
        response.update(
            ok=False,
            error={
                "code": "DOMAIN_REJECTED",
                "message": "Fixture rejection",
                "details": {"owner": "fixture"},
            },
        )
    if mode == "wrong-id":
        response["request_id"] = "foreign"
    if mode == "wrong-source":
        response["metadata"] = dict(metadata, source_digest="b" * 64)
    if mode == "error-text":
        response["result"] = {
            "name": "SCRIPT ERROR: authored text; Parse Error: notes; ERROR: label"
        }
    return response


def main():
    if "--editor" in sys.argv:
        project = Path(sys.argv[sys.argv.index("--path") + 1])
        (project / ".godot").mkdir(exist_ok=True)
        (project / ".godot/cache").write_text("private import fixture")
        return
    mode = argument("fixture-mode", os.environ.get("TOOLBOX_FIXTURE_MODE", "normal"))
    metadata = {
        "engine_executed": True,
        "engine": "transport fixture, not a native game execution",
        "source_revision": argument("source-revision", "fixture-revision"),
        "source_digest": argument("source-digest", "a" * 64),
    }
    ready = {"protocol": "motorsport-manager-toolbox", "version": 1, "metadata": metadata}
    if mode == "ready-error":
        print("ERROR: fixture engine startup failed", file=sys.stderr, flush=True)
    if mode == "wrong-ready":
        ready["version"] = 2
    if mode != "missing-ready" and not argument("toolbox-request"):
        emit("TOOLBOX_READY", ready)
    if mode in ("missing-ready", "eof"):
        return
    if mode == "hang":
        time.sleep(60)
        return
    if mode == "child":
        child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])
        Path(os.environ["TOOLBOX_FIXTURE_CHILD_FILE"]).write_text(str(child.pid))
    count = 0
    input_file = argument("toolbox-request")
    rows = [Path(input_file).read_text()] if input_file else sys.stdin
    for line in rows:
        count += 1
        sent = json.loads(line)
        response = make_response(sent, metadata, count, mode)
        if mode == "error":
            print("SCRIPT ERROR: fixture native operation failed", file=sys.stderr, flush=True)
        output_file = argument("toolbox-response")
        if output_file:
            Path(output_file).write_text(json.dumps(response))
        emit("TOOLBOX_RESULT", response)
        if mode == "duplicate":
            emit("TOOLBOX_RESULT", response)
        if mode == "after-error":
            time.sleep(0.02)
            print("ERROR: fixture error after forged success", file=sys.stderr, flush=True)
        if mode == "file-conflict" and output_file:
            Path(output_file).write_text(json.dumps(dict(response, result={"foreign": True})))


if __name__ == "__main__":
    main()
