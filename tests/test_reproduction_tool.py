"""The developer wrapper reports evidence and fails closed before engine execution."""

from __future__ import annotations

import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import reproduce


class ReproductionToolTests(unittest.TestCase):
    def write(self, value):
        root = tempfile.TemporaryDirectory()
        self.addCleanup(root.cleanup)
        path = Path(root.name) / "évidence file.json"
        path.write_text(json.dumps(value), encoding="utf-8")
        return path

    def test_reads_unicode_bundle_without_running_engine(self):
        value = {"kind": "motorsport-manager-reproduction", "failure": {"message": "Änderung"}}
        self.assertEqual(reproduce.read_bundle(self.write(value)), value)

    def test_rejects_other_files_and_nonfinite_values(self):
        for value in [
            [],
            {},
            {"kind": "save"},
            {"kind": "motorsport-manager-reproduction", "x": float("nan")},
        ]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                reproduce.read_bundle(self.write(value))

    def test_enforces_byte_limit_before_decoding(self):
        path = self.write({"kind": "motorsport-manager-reproduction", "x": "界"})
        with patch.object(reproduce, "MAX_BYTES", 8), self.assertRaisesRegex(ValueError, "16 MiB"):
            reproduce.read_bundle(path)

    def test_description_distinguishes_recorded_values_from_cause(self):
        result = {
            "source_revision": "abc",
            "engine": "4.7.2",
            "checked": 8,
            "dropped_boundaries": 9,
            "first_divergence": {
                "step": 17,
                "cursor": 2,
                "path": "cars[3].fuel",
                "expected": 8.25,
                "observed": 8.5,
                "last_input": {"action": "pause"},
            },
        }
        text = reproduce.describe(result, Path("path with spaces/évidence.json"), "godot")
        for expected in [
            "fixed step 17",
            "cars[3].fuel",
            "Expected (recorded): 8.25",
            "Observed (replay): 8.5",
            "not inferred cause",
            "dropped: 9",
            "Reproduce:",
        ]:
            self.assertIn(expected, text)

    def test_failed_replay_does_not_claim_matching_boundaries(self):
        text = reproduce.describe({"error": "Different engine"}, Path("test.json"), "godot")
        self.assertIn("could not establish equivalence", text)
        self.assertNotIn("Retained boundaries match", text)

    def test_missing_engine_returns_actionable_error_without_output(self):
        path = self.write({"kind": "motorsport-manager-reproduction"})
        error = io.StringIO()
        with (
            patch.object(sys, "argv", ["reproduce.py", str(path)]),
            patch.object(reproduce.shutil, "which", return_value=None),
            contextlib.redirect_stderr(error),
        ):
            self.assertEqual(reproduce.main(), 2)
        self.assertIn("pinned engine path", error.getvalue())


if __name__ == "__main__":
    unittest.main()
