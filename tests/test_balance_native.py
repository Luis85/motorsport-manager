"""Native balancing validation must use a trusted private project and clean results."""

from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))
from balance_authoring import Snapshot
from balance_native import NativeProject, clean_result, field_metadata


class BalanceNativeTests(unittest.TestCase):
    def test_clean_result_cannot_hide_native_errors_or_exit_mismatch(self):
        for run in (
            subprocess.CompletedProcess(
                [], 0, 'CONTENT_RESULT {"ok":true}\n', "SCRIPT ERROR: failed"
            ),
            subprocess.CompletedProcess([], 0, 'CONTENT_RESULT {"ok":true}\nERROR: failed', ""),
            subprocess.CompletedProcess([], 1, 'CONTENT_RESULT {"ok":true}\n', ""),
            subprocess.CompletedProcess([], 0, 'CONTENT_RESULT {"ok":false}\n', ""),
            subprocess.CompletedProcess([], 0, 'CONTENT_RESULT {"ok":1}\n', ""),
            subprocess.CompletedProcess(
                [], 0, 'CONTENT_RESULT {"ok":true}\nCONTENT_RESULT {"ok":true}', ""
            ),
            subprocess.CompletedProcess([], 0, 'CONTENT_RESULT {"ok":true,"ok":false}', ""),
            subprocess.CompletedProcess([], 0, 'CONTENT_RESULT {"ok":true,"value":NaN}', ""),
            subprocess.CompletedProcess([], 0, "Godot ready, no result", ""),
        ):
            with self.subTest(run=run), self.assertRaises(ValueError):
                clean_result(run)
        accepted = clean_result(
            subprocess.CompletedProcess(
                [],
                0,
                'Godot 4.7.2\nCONTENT_RESULT {"ok":true,"label":"ERROR: author text"}',
                "",
            )
        )
        self.assertTrue(accepted["ok"])

    def test_missing_engine_never_claims_acceptance(self):
        with (
            patch("balance_native.executable", return_value=None),
            self.assertRaisesRegex(ValueError, "No native validation"),
        ):
            NativeProject(Path("."), None, None)

    def test_full_config_acceptance_requires_explicit_true(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "value.json").write_text('{"value":1}')
            with patch("balance_native.executable", return_value="godot"):
                native = NativeProject(root, Snapshot(root), None)
            self.addCleanup(native.close)
            for missing in (None, False, 1, "true"):
                with (
                    self.subTest(missing=missing),
                    patch.object(
                        native, "invoke", return_value={"ok": True, "config_validated": missing}
                    ),
                ):
                    with self.assertRaisesRegex(ValueError, "complete config"):
                        native.validate()
            with patch.object(
                native, "invoke", return_value={"ok": True, "config_validated": True}
            ):
                self.assertTrue(native.validate()["ok"])

    def test_private_project_overlays_candidate_and_isolates_user_data(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "source"
            root.mkdir()
            (root / "project.godot").write_text("config_version=5\n")
            original = root / "config"
            original.mkdir()
            (original / "value.json").write_text('{"value":1}')
            for name in (".git", "reports", "playerdata", "saves", ".godot"):
                (root / name).mkdir()
                (root / name / "private.txt").write_text("never copy")
            candidate = Snapshot(original)
            candidate.files["value.json"] = b'{"value":2}'
            commands = []

            def run(command, **kwargs):
                commands.append((command, kwargs))
                if "--version" in command:
                    return subprocess.CompletedProcess(command, 0, "4.7.2.stable.native\n", "")
                if "rev-parse" in command:
                    return subprocess.CompletedProcess(command, 0, "fixture-revision\n", "")
                if "--import" in command:
                    return subprocess.CompletedProcess(command, 0, "Godot imported\n", "")
                return subprocess.CompletedProcess(
                    command, 0, 'CONTENT_RESULT {"ok":true,"config_validated":true}\n', ""
                )

            with (
                patch("balance_native.executable", return_value="godot"),
                patch("balance_native.subprocess.run", side_effect=run),
            ):
                with NativeProject(root, candidate, None) as native:
                    home = native.home
                    self.assertEqual(
                        (native.project / "config/value.json").read_bytes(), b'{"value":2}'
                    )
                    self.assertEqual((original / "value.json").read_bytes(), b'{"value":1}')
                    for name in (".git", "reports", "playerdata", "saves", ".godot"):
                        self.assertFalse((native.project / name).exists())
                    result = native.validate()
                    self.assertTrue(result["engine_executed"])
                    self.assertEqual(result["metadata"]["engine_version"], "4.7.2.stable.native")
                    self.assertEqual(result["metadata"]["source_revision"], "fixture-revision")
                    self.assertEqual(len(result["metadata"]["source_digest"]), 64)
                    for command, kwargs in commands:
                        self.assertFalse(any(str(arg).startswith("--pack=") for arg in command))
                        if command[0] == "godot":
                            for key in (
                                "XDG_DATA_HOME",
                                "XDG_CACHE_HOME",
                                "APPDATA",
                                "LOCALAPPDATA",
                            ):
                                self.assertTrue(Path(kwargs["env"][key]).is_relative_to(home))
            self.assertFalse(home.exists())

    def test_import_failure_cleans_private_home(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            config = root / "config"
            config.mkdir()
            (config / "value.json").write_text("{}")
            with patch("balance_native.executable", return_value="godot"):
                native = NativeProject(root, Snapshot(config), None)
            with patch.object(
                native,
                "run",
                return_value=subprocess.CompletedProcess([], 0, "", "Parse Error: failed"),
            ):
                with self.assertRaisesRegex(ValueError, "import failed"):
                    with native:
                        self.fail("failed native project must not enter")
            self.assertFalse(native.home.exists())

    def test_schema_metadata_comes_from_declared_native_fields(self):
        schemas = {
            "kind": {
                "properties": {
                    "rates": {
                        "items": {
                            "properties": {
                                "pace": {
                                    "type": "number",
                                    "minimum": 0,
                                    "maximum": 2,
                                    "description": "metres/second: Declared pace.",
                                },
                            }
                        }
                    }
                }
            }
        }
        value = field_metadata({"kind": "kind"}, schemas, ("rates", "0", "pace"))
        self.assertEqual(value["minimum"], 0)
        self.assertEqual(value["units"], "metres/second")
        self.assertEqual(field_metadata({"kind": "kind"}, schemas, ("unknown",)), {})


if __name__ == "__main__":
    unittest.main()
