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


if __name__ == "__main__":
    unittest.main()
