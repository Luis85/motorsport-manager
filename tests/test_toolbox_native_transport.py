"""Native toolbox rejects malformed transport without rewriting caller input."""

import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ENGINE = os.environ.get("VERIFICATION_TEST_GODOT") or os.environ.get("GODOT_BINARY")
ROOT = Path(os.environ.get("TOOLBOX_TEST_ROOT", Path(__file__).resolve().parents[1]))
PROTOCOL = "motorsport-manager-toolbox"


@unittest.skipUnless(ENGINE, "Set VERIFICATION_TEST_GODOT for actual native transport execution")
class NativeToolboxTransportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary = tempfile.TemporaryDirectory(prefix="native-toolbox-transport-")
        cls.addClassCleanup(cls.temporary.cleanup)
        cls.folder = Path(cls.temporary.name)
        cls.project = cls.folder / "project"
        shutil.copytree(
            ROOT,
            cls.project,
            ignore=shutil.ignore_patterns(
                ".git", ".godot", "reports", "builds", "__pycache__", ".ruff_cache"
            ),
        )
        cls.environment = os.environ.copy()
        cls.environment.update(
            {
                "XDG_DATA_HOME": str(cls.folder / "data"),
                "XDG_CONFIG_HOME": str(cls.folder / "config"),
                "XDG_CACHE_HOME": str(cls.folder / "cache"),
            }
        )
        cls.base = [str(ENGINE), "--headless", "--path", str(cls.project)]
        imported = subprocess.run(
            [*cls.base, "--editor", "--import"],
            env=cls.environment,
            capture_output=True,
            timeout=120,
        )
        if imported.returncode or b"ERROR:" in imported.stderr:
            raise AssertionError("Actual native bootstrap failed: " + imported.stderr.decode())

    def request(self, operation="content.list", identity="probe"):
        return {
            "protocol": PROTOCOL,
            "version": 1,
            "request_id": identity,
            "operation": operation,
            "session": "",
            "arguments": {},
        }

    def execute(self, arguments, payload=b""):
        process = subprocess.run(
            [*self.base, "--script", "res://scripts/services/toolbox/cli.gd", "--", *arguments],
            input=payload,
            cwd=self.project,
            env=self.environment,
            capture_output=True,
            timeout=60,
        )
        self.assertEqual(0, process.returncode, process.stderr.decode(errors="replace"))
        self.assertNotIn(b"ERROR:", process.stderr)
        self.assertNotIn(b"Unicode parsing error", process.stderr)
        frames = []
        ready = []
        for line in process.stdout.splitlines():
            if line.startswith(b"TOOLBOX_RESULT "):
                frames.append(json.loads(line[len(b"TOOLBOX_RESULT ") :]))
            elif line.startswith(b"TOOLBOX_READY "):
                ready.append(json.loads(line[len(b"TOOLBOX_READY ") :]))
            else:
                self.assertNotIn(b"ERROR:", line)
        for frame in frames:
            self.assertEqual(PROTOCOL, frame["protocol"])
            self.assertEqual(1, frame["version"])
            self.assertIs(True, frame["metadata"]["engine_executed"])
            self.assertTrue(frame["metadata"]["engine"])
        return frames, ready

    def test_startup_content_failure_publishes_requested_envelope(self):
        request = self.folder / "startup-request.json"
        response = self.folder / "startup-response.json"
        original = json.dumps(self.request()).encode()
        request.write_bytes(original)
        frames, ready = self.execute(
            [
                "--toolbox-request=" + str(request),
                "--toolbox-response=" + str(response),
                "--pack=" + str(self.folder / "missing-pack"),
                "--source-revision=transport-review",
                "--source-digest=known-source-digest",
            ]
        )
        self.assertEqual([], ready)
        self.assertEqual(1, len(frames))
        self.assertFalse(frames[0]["ok"])
        self.assertEqual("CONTENT_REJECTED", frames[0]["error"]["code"])
        self.assertEqual(frames[0], json.loads(response.read_bytes()))
        self.assertEqual(original, request.read_bytes())
        self.assertEqual("transport-review", frames[0]["metadata"]["source_revision"])
        self.assertEqual("known-source-digest", frames[0]["metadata"]["source_digest"])

    def test_invalid_utf8_stdio_rejects_before_dispatch_and_keeps_process_available(self):
        malformed = json.dumps(self.request("content.inspect", "invalid")).encode()
        malformed = malformed.replace(b'"arguments": {}', b'"arguments": {"id":"bad\xffid"}')
        valid = json.dumps(self.request(identity="valid")).encode()
        unicode_request = self.request("content.inspect", "unicode")
        unicode_request["arguments"] = {"id": "authored\ufffdidentifier"}
        unicode_bytes = json.dumps(unicode_request, ensure_ascii=False).encode()
        frames, ready = self.execute(
            ["--toolbox-stdio"], malformed + b"\n" + valid + b"\n" + unicode_bytes + b"\n"
        )
        self.assertEqual(1, len(ready))
        self.assertEqual(3, len(frames))
        self.assertFalse(frames[0]["ok"])
        self.assertEqual("INVALID_JSON", frames[0]["error"]["code"])
        self.assertTrue(frames[1]["ok"])
        self.assertEqual("valid", frames[1]["request_id"])
        self.assertEqual("unicode", frames[2]["request_id"])
        self.assertEqual("NOT_FOUND", frames[2]["error"]["code"])

    def test_invalid_utf8_file_publishes_rejection_and_preserves_input_bytes(self):
        request = self.folder / "encoding-request.json"
        response = self.folder / "encoding-response.json"
        original = b'{"protocol":"bad\xffvalue"}'
        request.write_bytes(original)
        frames, ready = self.execute(
            ["--toolbox-request=" + str(request), "--toolbox-response=" + str(response)]
        )
        self.assertEqual([], ready)
        self.assertEqual(1, len(frames))
        self.assertFalse(frames[0]["ok"])
        self.assertEqual("INVALID_JSON", frames[0]["error"]["code"])
        self.assertEqual(frames[0], json.loads(response.read_bytes()))
        self.assertEqual(original, request.read_bytes())

    def test_aliased_response_and_reserved_storage_paths_cannot_overwrite_request(self):
        response = self.project / "transport-request.json"
        original = json.dumps(self.request()).encode()
        paths = [
            (response, str(self.project) + "/./transport-request.json"),
            (response, str(self.project) + "/../project/transport-request.json"),
            (response, "res://transport-request.json"),
            (Path("transport-request.json"), str(response)),
            (Path(str(response) + ".tmp"), str(response)),
            (Path(str(response) + ".bak"), str(response)),
        ]
        if os.name == "nt":
            windows_response = str(response).replace("/", "\\")
            paths.extend(
                [
                    (response, windows_response.upper()),
                    (response, windows_response.replace("\\", "/")),
                    (Path(str(response) + ".tmp"), windows_response.replace("\\", "/")),
                    (Path(str(response) + ".bak"), windows_response.replace("\\", "/")),
                ]
            )
        for request, output in paths:
            with self.subTest(request=request, output=output):
                physical_request = request if request.is_absolute() else self.project / request
                physical_request.write_bytes(original)
                before = response.read_bytes() if response.exists() else None
                frames, ready = self.execute(
                    ["--toolbox-request=" + str(request), "--toolbox-response=" + output]
                )
                self.assertEqual([], ready)
                self.assertEqual(1, len(frames))
                self.assertFalse(frames[0]["ok"])
                self.assertEqual("INVALID_ARGUMENT", frames[0]["error"]["code"])
                self.assertEqual(original, physical_request.read_bytes())
                self.assertEqual(before, response.read_bytes() if response.exists() else None)

    def test_parent_segments_cannot_hide_a_link_to_the_request_in_reserved_temporary_path(self):
        target = self.folder / "reserved-target"
        child = target / "child"
        child.mkdir(parents=True)
        link = self.project / "transport-link"
        link.symlink_to(child, target_is_directory=True)
        request = target / "reserved-request.json.tmp"
        response = target / "reserved-request.json"
        backup = target / "reserved-request.json.bak"
        original = json.dumps(self.request()).encode()
        retained = {request: original, response: b"previous response", backup: b"previous backup"}
        aliases = [
            str(link) + "/../reserved-request.json",
            "res://transport-link/../reserved-request.json",
            "transport-link/../reserved-request.json",
        ]
        for alias in aliases:
            with self.subTest(output=alias):
                for path, content in retained.items():
                    path.write_bytes(content)
                self.assertTrue(
                    os.path.samefile(request, str(link) + "/../reserved-request.json.tmp")
                )
                frames, ready = self.execute(
                    ["--toolbox-request=" + str(request), "--toolbox-response=" + alias]
                )
                self.assertEqual([], ready)
                self.assertEqual(1, len(frames))
                self.assertFalse(frames[0]["ok"])
                self.assertEqual("INVALID_ARGUMENT", frames[0]["error"]["code"])
                self.assertEqual(retained, {path: path.read_bytes() for path in retained})
                self.assertFalse((self.project / "reserved-request.json").exists())
                self.assertEqual([], list(child.iterdir()))
        regular = self.project / "regular-directory"
        regular.mkdir()
        destination = self.project / "distinct-response.json"
        frames, ready = self.execute(
            [
                "--toolbox-request=" + str(request),
                "--toolbox-response=" + str(regular) + "/../distinct-response.json",
            ]
        )
        self.assertEqual([], ready)
        self.assertEqual(1, len(frames))
        self.assertTrue(frames[0]["ok"])
        self.assertEqual(frames[0], json.loads(destination.read_bytes()))
        self.assertEqual(original, request.read_bytes())

    def test_windows_path_normalization_uses_native_separator_and_dot_rules_on_all_hosts(self):
        cases = [
            [
                "C:\\Users\\Runner\\project/./request.json",
                True,
                "C:/Users/Runner/project/request.json",
            ],
            [
                "C:/Users\\Runner/project/../project/request.json.tmp",
                True,
                "C:/Users/Runner/project/request.json.tmp",
            ],
            ["res://folder\\../request.json", True, "res://request.json"],
            ["user://folder\\../request.json.bak", True, "user://request.json.bak"],
            ["\\\\server\\share\\folder\\..\\request.json", True, "//server/share/request.json"],
            ["/tmp/folder/../request.json", False, "/tmp/request.json"],
        ]
        probe = self.project / "path-normalization-probe.gd"
        probe.write_text(
            "extends MainLoop\n"
            "func _initialize() -> void:\n"
            '\tvar runner = load("res://scripts/services/toolbox/cli.gd").new()\n'
            "\tvar cases: Array = " + json.dumps(cases) + "\n"
            "\tvar results: Array = []\n"
            "\tfor entry in cases:\n"
            "\t\tresults.append(runner._normalized_path(entry[0], entry[1]))\n"
            "\trunner.free()\n"
            '\tprint("PATH_PROBE ", JSON.stringify(results))\n'
            "func _process(_delta: float) -> bool:\n"
            "\treturn true\n",
            encoding="utf-8",
        )
        completed = subprocess.run(
            [*self.base, "--script", str(probe)],
            env=self.environment,
            capture_output=True,
            timeout=60,
        )
        self.assertEqual(0, completed.returncode, completed.stderr.decode(errors="replace"))
        self.assertNotIn(b"ERROR:", completed.stderr)
        frames = [line for line in completed.stdout.splitlines() if line.startswith(b"PATH_PROBE ")]
        self.assertEqual(1, len(frames), completed.stdout)
        self.assertEqual([entry[2] for entry in cases], json.loads(frames[0][11:]))


if __name__ == "__main__":
    unittest.main()
