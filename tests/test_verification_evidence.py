"""Suite acceptance requires fresh, well-formed primary and secondary evidence."""

import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import verification_run as runner
import verify


class SuiteEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.evidence = self.root / "incoming"
        self.output = self.root / "output"
        self.evidence.mkdir()
        self.output.mkdir()
        self.suite = {
            "id": "probe",
            "native": False,
            "script": "tests/probe.gd",
            "timeout": 10,
            "reports": ["primary.json", "secondary.json"],
        }
        self.report_directory = patch.object(verify, "REPORTS", self.output)
        self.report_directory.start()
        self.addCleanup(self.report_directory.stop)

    def run_suite(self, primary=None, secondary=None):
        def execute(*_args, **_kwargs):
            (self.evidence / "primary.json").write_text(json.dumps(primary))
            (self.evidence / "secondary.json").write_text(json.dumps(secondary))

        with patch.object(verify, "run_phase", side_effect=execute):
            return runner._execute_suite(self.suite, ["godot"], {}, self.evidence, self.output)

    def test_primary_count_is_validated_before_acceptance(self):
        for count in [None, True, -1, 1.0, "1", []]:
            with self.subTest(count=count):
                result = self.run_suite({"passed": True, "checks": count}, {"passed": True})
                self.assertFalse(result["passed"])
                self.assertIn("checks", result["error"])
        result = self.run_suite({"passed": True, "checks": 3}, {"passed": True})
        self.assertTrue(result["passed"])
        self.assertEqual(result["checks"], 3)

    def test_secondary_failure_cannot_be_replaced_by_primary_success(self):
        for secondary in [None, [], {}, {"passed": False}, {"passed": 1}]:
            with self.subTest(secondary=secondary):
                self.assertFalse(self.run_suite({"passed": True, "checks": 3}, secondary)["passed"])

    def test_old_screenshots_and_reports_do_not_survive_a_new_run(self):
        previous = self.output / self.suite["id"]
        previous.mkdir()
        (previous / "previous-source.png").write_bytes(b"stale evidence")
        (self.evidence / "primary.json").write_text('{"passed": true, "checks": 99}')
        result = self.run_suite({"passed": True, "checks": 3}, {"passed": True})
        self.assertTrue(result["passed"])
        self.assertFalse((previous / "previous-source.png").exists())
        self.assertEqual(json.loads((previous / "primary.json").read_text())["checks"], 3)

    def test_missing_new_report_cannot_reuse_previous_passing_report(self):
        (self.evidence / "primary.json").write_text('{"passed": true, "checks": 99}')
        with patch.object(verify, "run_phase"):
            result = runner._execute_suite(self.suite, ["godot"], {}, self.evidence, self.output)
        self.assertFalse(result["passed"])

    def test_native_vsync_override_reaches_engine_before_user_arguments(self):
        self.suite.update(native=True, layout="minimal")
        with (
            patch.object(runner.sys, "platform", "linux"),
            patch.object(runner.shutil, "which", return_value="/bin/xvfb-run"),
            patch.object(verify, "run_phase") as phase,
        ):
            runner._execute_suite(self.suite, ["godot"], {}, self.evidence, self.output)
        command = phase.call_args.args[1]
        self.assertEqual(command.count("--disable-vsync"), 2)
        self.assertLess(command.index("--disable-vsync"), command.index("--"))
        driver = command.index("--rendering-driver")
        self.assertLess(driver, command.index("--"))
        self.assertEqual(command[driver + 1], "opengl3_es")
        self.assertEqual(
            command[command.index("--") + 1 :], ["--disable-vsync", "--pitwall-layout=minimal"]
        )

    def test_native_real_display_preserves_configured_renderer(self):
        self.suite.update(native=True, layout="minimal")
        with (
            patch.object(runner.shutil, "which", return_value=None),
            patch.object(verify, "run_phase") as phase,
        ):
            runner._execute_suite(self.suite, ["godot"], {}, self.evidence, self.output)
        self.assertNotIn("--rendering-driver", phase.call_args.args[1])

    def test_headless_suite_does_not_request_display_settings(self):
        with patch.object(verify, "run_phase") as phase:
            runner._execute_suite(self.suite, ["godot"], {}, self.evidence, self.output)
        command = phase.call_args.args[1]
        self.assertIn("--headless", command)
        self.assertNotIn("--disable-vsync", command)


if __name__ == "__main__":
    unittest.main()
