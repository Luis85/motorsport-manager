"""Adversarial real child-process transport; gameplay parity has native integration tests."""

import json
import os
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import toolbox
from toolbox_process import ToolProcess
from toolbox_project import ToolProject
from toolbox_protocol import ToolboxError, request

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "tests/support/toolbox_engine_fixture.py"


def project_fixture(mode):
    class FixtureProject:
        def __init__(self, root, godot, packs, timeout):
            self.timeout = timeout
            self.temporary = tempfile.TemporaryDirectory(prefix="toolbox-transport-fixture-")
            self.home = Path(self.temporary.name)
            self.project = self.home
            self.env = dict(os.environ)
            self.identity = {"source_revision": "fixture-revision", "source_digest": "a" * 64}

        def prepare(self):
            pass

        def command(self, arguments):
            return [sys.executable, "-u", str(FIXTURE), "--fixture-mode=" + mode, *arguments]

        file_request = ToolProject.file_request

        def close(self):
            self.temporary.cleanup()

    return FixtureProject


class ToolboxClientTests(unittest.TestCase):
    def client(self, mode="normal", **options):
        patched = patch.object(toolbox, "ToolProject", project_fixture(mode))
        patched.start()
        self.addCleanup(patched.stop)
        return toolbox.ToolboxClient(timeout=0.5, **options)

    def test_incremental_calls_share_process_and_named_facets_forward_exact_arguments(self):
        with self.client() as client:
            first = client.weekends.create("weekend-a", {"scenario_id": "native-scenario"})
            second = client.weekends.step_ticks("weekend-a", -5)
            track = client.tracks.commit("track-a", {"nodes": []}, 4)
            campaign = client.campaigns.depart("career-a", "weekend-a")
            self.assertEqual(first["received"], 1)
            self.assertEqual(second["received"], 2)
            self.assertEqual(second["arguments"], {"count": -5})
            self.assertEqual(
                track["arguments"], {"document": {"nodes": []}, "expected_revision": 4}
            )
            self.assertEqual(campaign["arguments"], {"weekend_session": "weekend-a"})
            home = client.project.home
            process = client.process.process
        self.assertIsNotNone(process.poll())
        self.assertFalse(home.exists())

    def test_native_rejection_raw_envelope_and_structured_exception_are_distinct(self):
        with self.client("reject") as client:
            raw = client.request(request("weekend.command", "w", {}, "raw-1"))
            self.assertIs(raw["ok"], False)
            with self.assertRaises(toolbox.ToolboxDomainError) as caught:
                client.weekends.command("w", "pace", {"id": 0, "value": 2})
            self.assertEqual(caught.exception.details, {"owner": "fixture"})
            self.assertIsNotNone(client.process)

    def test_no_context_reused_id_and_double_enter_fail_before_native_mutation(self):
        client = self.client()
        with self.assertRaisesRegex(ToolboxError, "with context"):
            client.discover()
        with client:
            with self.assertRaisesRegex(ToolboxError, "already open"):
                client.__enter__()
            sent = request("toolbox.discover", "", {}, "r9")
            client.request(sent)
            with self.assertRaisesRegex(ToolboxError, "unique"):
                client.request(sent)
            self.assertEqual(client.discover()["received"], 2)

    def test_bad_ready_eof_version_response_id_and_source_never_accept_zero_exit(self):
        for mode in ["missing-ready", "wrong-ready", "eof", "wrong-id", "wrong-source"]:
            with self.subTest(mode=mode):
                with self.assertRaises(ToolboxError):
                    with self.client(mode) as client:
                        client.discover()

    def test_engine_errors_before_or_after_forged_success_are_rejected(self):
        for mode in ["ready-error", "error", "after-error", "duplicate"]:
            with self.subTest(mode=mode):
                with self.assertRaises(ToolboxError):
                    with self.client(mode) as client:
                        client.discover()

    def test_timeout_closes_owned_process_and_private_resources(self):
        client = self.client("hang")
        started = time.monotonic()
        with self.assertRaisesRegex(ToolboxError, "Timed out"):
            with client:
                home, process = client.project.home, client.process.process
                client.discover()
        self.assertLess(time.monotonic() - started, 3)
        self.assertIsNotNone(process.poll())
        self.assertFalse(home.exists())

    @unittest.skipUnless(os.name == "posix", "POSIX process-family regression")
    def test_descendants_are_killed_even_after_parent_exits_successfully(self):
        with tempfile.TemporaryDirectory() as directory:
            pidfile = Path(directory) / "child.pid"
            with patch.dict(os.environ, TOOLBOX_FIXTURE_CHILD_FILE=str(pidfile)):
                with self.client("child") as client:
                    client.discover()
                child = int(pidfile.read_text())
            deadline = time.monotonic() + 2
            while time.monotonic() < deadline:
                status = Path(f"/proc/{child}/stat")
                if not status.exists() or status.read_text().split()[2] == "Z":
                    break
                time.sleep(0.02)
            else:
                self.fail("Owned descendant survived successful parent shutdown")

    def test_file_fallback_validates_fresh_correlated_evidence_and_exactly_one_batch(self):
        with self.client(file_mode=True) as client:
            result = client.batch([request("toolbox.discover", "", {}, "inner-1")])
            self.assertEqual(result["operation"], "toolbox.batch")
            with self.assertRaisesRegex(ToolboxError, "one request"):
                client.discover()
        for mode in ["file-conflict", "error", "wrong-id", "wrong-source", "duplicate"]:
            with self.subTest(mode=mode):
                with self.assertRaises(ToolboxError):
                    with self.client(mode, file_mode=True) as client:
                        client.discover()

    def test_writer_timeout_is_bounded_when_child_does_not_read_stdin(self):
        process = ToolProcess(
            [sys.executable, "-c", "import time; time.sleep(60)"], ROOT, dict(os.environ), 0.1
        )
        try:
            with self.assertRaisesRegex(ToolboxError, "writing"):
                process.send(b"x" * (1024 * 1024))
        finally:
            process.close(graceful=False)
        self.assertIsNotNone(process.process.poll())


@unittest.skipUnless(os.name == "posix", "Executable transport fixture uses a POSIX shebang")
class ToolboxCliTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.project = self.root / "source"
        self.project.mkdir()
        (self.project / "project.godot").write_text('[application]\nconfig/name="Fixture"\n')
        self.engine = self.root / "fixture engine"
        self.engine.write_bytes(FIXTURE.read_bytes())
        self.engine.chmod(0o755)

    def cli(self, arguments, mode="normal"):
        return subprocess.run(
            [
                sys.executable,
                str(ROOT / "scripts/toolbox.py"),
                *arguments,
                "--godot",
                str(self.engine),
                "--root",
                str(self.project),
                "--timeout",
                "1",
            ],
            capture_output=True,
            text=True,
            timeout=10,
            env=dict(os.environ, TOOLBOX_FIXTURE_MODE=mode),
        )

    def test_stdout_is_exactly_one_json_envelope_and_checkout_has_no_import_cache(self):
        result = self.cli(["call", "weekend.command", "--session", "w", "--arguments", '{"x":"Ω"}'])
        self.assertEqual(result.returncode, 0, result.stderr)
        response = json.loads(result.stdout)
        self.assertEqual(response["result"]["arguments"], {"x": "Ω"})
        self.assertFalse((self.project / ".godot").exists())
        self.assertNotIn("TOOLBOX_RESULT", result.stdout)

    def test_native_rejection_and_transport_failure_have_different_exit_codes(self):
        rejected = self.cli(["discover"], "reject")
        self.assertEqual(rejected.returncode, 1)
        self.assertEqual(json.loads(rejected.stdout)["error"]["code"], "DOMAIN_REJECTED")
        failed = self.cli(["discover"], "error")
        self.assertEqual(failed.returncode, 2)
        self.assertTrue(json.loads(failed.stdout)["transport"])
        self.assertIn("ENGINE_ERROR", failed.stderr)

    def test_batch_file_fallback_is_pure_json_and_invalid_input_stays_structured(self):
        batch = self.root / "batch.json"
        batch.write_text(json.dumps([request("toolbox.discover", "", {}, "inner-1")]))
        result = self.cli(["batch", str(batch), "--file-mode"])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["operation"], "toolbox.batch")
        result = self.cli(["call", "weekend.command", "--arguments", '{"x":NaN}'])
        self.assertEqual(result.returncode, 2)
        self.assertEqual(json.loads(result.stdout)["error"]["code"], "PROTOCOL_ERROR")


if __name__ == "__main__":
    unittest.main()
