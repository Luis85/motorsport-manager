"""Content authoring failure contracts; runtime acceptance remains Godot-owned."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("content_authoring", Path(__file__).parents[1] / "scripts/content.py")
assert SPEC and SPEC.loader
content = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(content)


class ContentAuthoringTests(unittest.TestCase):
    def test_init_is_explicit_and_never_overwrites(self):
        with tempfile.TemporaryDirectory() as temporary:
            pack = Path(temporary) / "pack"
            result = content.initialize(pack, "local.club")
            self.assertFalse(result["engine_executed"])
            original = (pack / "pack.json").read_bytes()
            with self.assertRaises(FileExistsError):
                content.initialize(pack, "different")
            self.assertEqual(original, (pack / "pack.json").read_bytes())

    def test_bad_identity_creates_nothing(self):
        with tempfile.TemporaryDirectory() as temporary:
            pack = Path(temporary) / "pack"
            with self.assertRaises(ValueError):
                content.initialize(pack, "../bad")
            self.assertFalse(pack.exists())

    def test_missing_engine_never_reports_validation(self):
        with patch.dict(content.os.environ, {}, clear=True), patch.object(content.shutil, "which", return_value=None):
            with self.assertRaisesRegex(ValueError, "No validation was executed"):
                content.invoke_engine([], None)

    def test_engine_error_rejects_a_false_success_report(self):
        imported = subprocess.CompletedProcess([], 0, "", "")
        executed = subprocess.CompletedProcess([], 0, 'CONTENT_RESULT {"ok":true}\n', "SCRIPT ERROR: broken")
        with patch.object(content.subprocess, "run", side_effect=[imported, executed]):
            with self.assertRaisesRegex(ValueError, "one clean result"):
                content.invoke_engine([], "/fake/godot")

    def test_exit_status_must_agree(self):
        imported = subprocess.CompletedProcess([], 0, "", "")
        executed = subprocess.CompletedProcess([], 1, 'CONTENT_RESULT {"ok":true}\n', "")
        with patch.object(content.subprocess, "run", side_effect=[imported, executed]):
            with self.assertRaisesRegex(ValueError, "disagrees"):
                content.invoke_engine([], "/fake/godot")

    def test_clone_checks_namespace_and_duplicate_id(self):
        with tempfile.TemporaryDirectory() as temporary:
            pack = Path(temporary) / "pack"
            content.initialize(pack, "local.club")
            result = {"ok": True, "definitions": [{"id": "local.club.vehicle.used"}],
                      "inspection": {"definition": {"id": "core.vehicle.gt", "kind": "vehicle"}}}
            with patch.object(content, "invoke_engine", return_value=result):
                with self.assertRaisesRegex(ValueError, "already defined"):
                    content.clone_definition(pack, "core.vehicle.gt", "local.club.vehicle.used", None)
                with self.assertRaisesRegex(ValueError, "namespace"):
                    content.clone_definition(pack, "core.vehicle.gt", "foreign.vehicle.new", None)
            self.assertEqual(json.loads((pack / "pack.json").read_text())["files"], [])

    def test_clone_rolls_back_failed_manifest_replace(self):
        with tempfile.TemporaryDirectory() as temporary:
            pack = Path(temporary) / "pack"
            content.initialize(pack, "local.club")
            before = (pack / "pack.json").read_bytes()
            result = {"ok": True, "definitions": [], "inspection": {"definition": {"id": "core.vehicle.gt", "kind": "vehicle"}}}
            with patch.object(content, "invoke_engine", return_value=result), patch.object(content.os, "replace", side_effect=OSError("disk")):
                with self.assertRaises(OSError):
                    content.clone_definition(pack, "core.vehicle.gt", "local.club.vehicle.new", None)
            self.assertEqual((pack / "pack.json").read_bytes(), before)
            self.assertFalse((pack / "vehicles/local.club.vehicle.new.json").exists())
            self.assertFalse((pack / ".content-author.lock").exists())
            self.assertEqual(sorted(x.name for x in pack.iterdir()), ["pack.json", "vehicles"])

    def test_schema_check_does_not_rewrite(self):
        with tempfile.TemporaryDirectory() as temporary, patch.object(content, "ROOT", Path(temporary)), patch.object(content, "invoke_engine", return_value={"ok": True, "schemas": {"vehicle": {"type": "object"}}}):
            self.assertTrue(content.schemas(None, False)["ok"])
            schema = Path(temporary) / "content/schemas/v1/vehicle.schema.json"
            schema.write_text("stale")
            self.assertFalse(content.schemas(None, True)["ok"])
            self.assertEqual(schema.read_text(), "stale")


if __name__ == "__main__":
    unittest.main()
