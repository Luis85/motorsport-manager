"""Native balancing validation must use a trusted private project and clean results."""

from __future__ import annotations

import contextlib
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))
import balance
from balance_authoring import Snapshot
from balance_native import NativeProject, clean_result, executable, field_metadata
from build_standalone import ENGINE
from toolbox_project import private_windows_editor


class BalanceNativeTests(unittest.TestCase):
    def setUp(self):
        # Mocked transport fixtures do not carry real Windows editor binaries.
        editor = patch(
            "balance_native.private_windows_editor", side_effect=lambda executable, home: executable
        )
        editor.start()
        self.addCleanup(editor.stop)

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
                    return subprocess.CompletedProcess(command, 0, ENGINE + "\n", "")
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
                    self.assertEqual(result["metadata"]["engine_version"], ENGINE)
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
            with (
                patch(
                    "balance_native.subprocess.run",
                    return_value=subprocess.CompletedProcess([], 0, ENGINE + "\n", ""),
                ),
                patch.object(
                    native,
                    "run",
                    return_value=subprocess.CompletedProcess([], 0, "", "Parse Error: failed"),
                ),
            ):
                with self.assertRaisesRegex(ValueError, "import failed"):
                    with native:
                        self.fail("failed native project must not enter")
            self.assertFalse(native.home.exists())

    def test_unpinned_engine_rejects_before_import_or_source_copy(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            config = root / "config"
            config.mkdir()
            original = b'{"value":1}'
            (config / "value.json").write_bytes(original)
            with patch("balance_native.executable", return_value="godot"):
                native = NativeProject(root, Snapshot(config), None)
            with (
                patch(
                    "balance_native.subprocess.run",
                    return_value=subprocess.CompletedProcess([], 0, "4.6.3.stable.official\n", ""),
                ),
                patch.object(native, "run") as import_run,
            ):
                with self.assertRaisesRegex(ValueError, "Expected pinned Godot"):
                    with native:
                        self.fail("Unpinned engine cannot enter native validation")
                import_run.assert_not_called()
            self.assertFalse(native.home.exists())
            self.assertEqual((config / "value.json").read_bytes(), original)

    def test_unconfigured_path_engine_is_never_selected_implicitly(self):
        with patch("balance_native.os.environ", {}), patch("balance_native.shutil.which") as which:
            self.assertIsNone(executable(None))
            which.assert_not_called()

    def test_missing_git_still_reports_actual_staged_source_digest(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            config = root / "config"
            config.mkdir()
            (config / "value.json").write_text("{}")
            with patch("balance_native.executable", return_value="godot"):
                native = NativeProject(root, Snapshot(config), None)
            with (
                patch("balance_native.shutil.which", return_value=None),
                patch(
                    "balance_native.subprocess.run",
                    return_value=subprocess.CompletedProcess([], 0, ENGINE + "\n", ""),
                ),
                patch.object(
                    native, "run", return_value=subprocess.CompletedProcess([], 0, "", "")
                ),
            ):
                with native:
                    self.assertEqual(native.identity["source_revision"], "")
                    self.assertEqual(len(native.identity["source_digest"]), 64)

    def test_native_timeout_or_crash_reports_started_execution_and_preserves_source(self):
        for failure in (
            subprocess.TimeoutExpired("godot", 120),
            subprocess.CompletedProcess([], 1, "SCRIPT ERROR: native failed", ""),
        ):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as temporary:
                config = Path(temporary)
                target = config / "value.json"
                original = b'{"value":1}'
                target.write_bytes(original)
                with patch("balance_native.executable", return_value="godot"):
                    native = NativeProject(config, Snapshot(config), None)
                native.identity = {"engine_version": ENGINE, "source_digest": "actual-stage"}
                output = io.StringIO()
                with (
                    patch.object(balance, "NativeProject", return_value=native),
                    patch.object(native, "prepare"),
                    patch.object(native, "run", side_effect=[failure]),
                    contextlib.redirect_stdout(output),
                ):
                    status = balance.main(
                        ["--config-dir", str(config), "set", "value.json", "/value", "2"]
                    )
                result = json.loads(output.getvalue())
                self.assertEqual(status, 1)
                self.assertFalse(result["ok"])
                self.assertTrue(result["engine_executed"])
                self.assertEqual(result["metadata"]["engine_version"], ENGINE)
                self.assertEqual(target.read_bytes(), original)

    def test_windows_missing_console_companion_returns_json_without_publication(self):
        with tempfile.TemporaryDirectory() as temporary:
            config = Path(temporary) / "config"
            config.mkdir()
            target = config / "value.json"
            original = b'{"value":1}'
            target.write_bytes(original)
            console = Path(temporary) / "Godot_console.exe"
            console.write_bytes(b"fixture, never executed")
            windows_os = Mock(wraps=os)
            windows_os.name = "nt"
            windows_os.environ = os.environ
            output = io.StringIO()
            with (
                patch("balance_native.executable", return_value=str(console)),
                patch("balance_native.os", windows_os),
                patch("balance_native.private_windows_editor", wraps=private_windows_editor),
                contextlib.redirect_stdout(output),
            ):
                status = balance.main(
                    ["--config-dir", str(config), "set", "value.json", "/value", "2"]
                )
            result = json.loads(output.getvalue())
            self.assertEqual(status, 1)
            self.assertFalse(result["engine_executed"])
            self.assertIn("editor companion", result["error"])
            self.assertEqual(target.read_bytes(), original)

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

    def test_numeric_object_keys_follow_properties_in_schema(self):
        schemas = {"kind": {"properties": {"0": {"type": "number", "minimum": 1}}}}
        value = field_metadata({"kind": "kind"}, schemas, ("0",))
        self.assertEqual(value, {"type": "number", "minimum": 1})


if __name__ == "__main__":
    unittest.main()
