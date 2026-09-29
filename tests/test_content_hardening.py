"""Authoring selection, output protocol and write-failure regression contracts."""
from __future__ import annotations

import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))
import content
import content_operations as operations


class ContentHardeningTests(unittest.TestCase):
    def test_ordered_roots_are_canonical_and_core_is_loaded_once(self):
        with tempfile.TemporaryDirectory() as temporary:
            first = Path(temporary) / "dependency"
            second = Path(temporary) / "extension"
            expected = ["--pack=" + str(first), "--pack=" + str(second)]
            actual = content.pack_arguments(first, [first / ".", second, content.ROOT / "content/packs/core"])
            self.assertEqual(expected, actual)

    def test_every_read_command_accepts_repeated_packs(self):
        for action, extra in [("validate", []), ("inspect", ["--id", "local.car"]),
                              ("list", []), ("export", ["--output", "out.json"]),
                              ("test", ["--scenario", "local.scenario"])]:
            with self.subTest(action=action):
                args = content.parser().parse_args([action, "a", "--pack", "b", "--pack", "c", *extra])
                selected = operations.selected_arguments(args, args.path, content.pack_arguments)
                self.assertEqual(content.pack_arguments(Path("a"), [Path("b"), Path("c")]), selected)

    def test_diff_dependencies_and_sides_are_separate(self):
        args = content.parser().parse_args(["diff", "before", "after", "--pack", "dependency",
                                           "--before-pack", "old-addon", "--after-pack", "new-addon"])
        for side, expected in [("before", ["dependency", "before", "old-addon"]),
                               ("after", ["dependency", "after", "new-addon"])]:
            self.assertEqual(content.pack_arguments(None, map(Path, expected)),
                             operations.selected_arguments(args, getattr(args, side), content.pack_arguments, side=side))

    def test_clone_reads_dependencies_before_destination_without_writing_them(self):
        with tempfile.TemporaryDirectory() as temporary:
            dependency = Path(temporary) / "dependency"
            destination = Path(temporary) / "destination"
            content.initialize(dependency, "local.source")
            content.initialize(destination, "local.target")
            before = (dependency / "pack.json").read_bytes()
            result = {"ok": True, "definitions": [], "inspection": {"definition": {
                "id": "local.source.vehicle.original", "kind": "vehicle"}}}
            with patch.object(content, "invoke_engine", return_value=result) as invoke:
                content.clone_definition(destination, "local.source.vehicle.original", "local.target.vehicle.copy", None, [dependency])
            self.assertEqual(invoke.call_args.args[0][-2:], content.pack_arguments(dependency, [destination]))
            self.assertEqual(before, (dependency / "pack.json").read_bytes())
            self.assertTrue((destination / "vehicles/local.target.vehicle.copy.json").exists())

    def invoke_payload(self, payload, status=0, stderr="", stdout_prefix=""):
        imported = subprocess.CompletedProcess([], 0, "", "")
        executed = subprocess.CompletedProcess([], status, stdout_prefix + "CONTENT_RESULT " + payload + "\n", stderr)
        with patch.object(content.subprocess, "run", side_effect=[imported, executed]):
            return content.invoke_engine([], "/fake/godot")

    def test_valid_author_text_is_not_an_engine_error(self):
        result = self.invoke_payload(json.dumps({"ok": True, "text": "ERROR: and SCRIPT ERROR: are literal text"}))
        self.assertTrue(result["ok"])
        self.assertTrue(result["engine_executed"])

    def test_actual_engine_errors_still_reject(self):
        for output in [("ERROR: engine failure\n", ""), ("", "SCRIPT ERROR: engine failure\n")]:
            with self.subTest(output=output), self.assertRaisesRegex(ValueError, "one clean result"):
                self.invoke_payload('{"ok":true}', stdout_prefix=output[0], stderr=output[1])

    def test_malformed_engine_envelopes_fail_closed(self):
        for payload in ["[]", "null", "true", "{}", '{"ok":1}', '{"ok":"true"}',
                        '{"ok":true,"value":NaN}', '{"ok":true,"value":Infinity}', '{"ok":true,"value":1e400}']:
            with self.subTest(payload=payload), self.assertRaises(ValueError):
                self.invoke_payload(payload)

    def test_command_name_resolves_on_path(self):
        runs = [subprocess.CompletedProcess([], 0, "", ""),
                subprocess.CompletedProcess([], 0, 'CONTENT_RESULT {"ok":true}\n', "")]
        with patch.object(content.shutil, "which", return_value="/opt/bin/godot"), \
             patch.object(content.subprocess, "run", side_effect=runs) as run:
            content.invoke_engine([], "godot")
        self.assertEqual("/opt/bin/godot", run.call_args.args[0][0])

    def test_failed_write_closes_then_removes_partial_file(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "partial.json"
            with patch.object(operations.os, "fsync", side_effect=OSError("disk full")):
                with self.assertRaisesRegex(OSError, "disk full"):
                    operations.write_new_json(path, {"value": "data"})
            self.assertFalse(path.exists())

    @unittest.skipIf(os.name == "nt", "Windows prevents replacing an open file.")
    def test_failed_write_does_not_remove_another_writers_replacement(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "output.json"
            def replace_then_fail(_fd):
                other = path.with_suffix(".other")
                other.write_text("other writer", encoding="utf-8")
                os.replace(other, path)
                raise OSError("disk full")
            with patch.object(operations.os, "fsync", side_effect=replace_then_fail):
                with self.assertRaises(OSError):
                    operations.write_new_json(path, {"value": "data"})
            self.assertEqual("other writer", path.read_text(encoding="utf-8"))

    def test_exclusive_write_preserves_existing_file_and_symlink_target(self):
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary) / "existing.json"
            target.write_text("original", encoding="utf-8")
            for path in [target, Path(temporary) / "link.json"]:
                if path != target:
                    try:
                        path.symlink_to(target)
                    except OSError:
                        continue  # Windows may deny symlink creation without developer mode.
                with self.assertRaises(FileExistsError):
                    operations.write_new_json(path, {"value": "new"})
                self.assertEqual("original", target.read_text(encoding="utf-8"))

    def test_serialization_failure_creates_nothing(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "invalid.json"
            with self.assertRaises(ValueError):
                operations.write_new_json(path, {"value": float("nan")})
            self.assertFalse(path.exists())

    def test_failed_initialization_rolls_back_new_directory_only(self):
        with tempfile.TemporaryDirectory() as temporary:
            parent = Path(temporary) / "parent"
            parent.mkdir()
            pack = parent / "pack"
            with patch.object(operations.os, "fsync", side_effect=OSError("disk full")):
                with self.assertRaises(OSError):
                    content.initialize(pack, "local.test")
            self.assertFalse(pack.exists())
            self.assertTrue(parent.is_dir())

    def test_check_schemas_does_not_create_directories(self):
        with tempfile.TemporaryDirectory() as temporary, patch.object(content, "ROOT", Path(temporary)), \
             patch.object(content, "invoke_engine", return_value={"ok": True, "schemas": {"vehicle": {}}}):
            self.assertFalse(content.schemas(None, True)["ok"])
            self.assertEqual([], list(Path(temporary).iterdir()))

    def test_boolean_number_differences_are_not_lost_in_nested_values(self):
        for before, after in [(True, 1), (False, 0.0), ({"x": [True]}, {"x": [1]}),
                              ([{"x": False}], [{"x": 0}])]:
            with self.subTest(before=before):
                self.assertFalse(operations.json_equal(before, after))
                self.assertEqual(1, len(operations.difference(before, after)))
        self.assertEqual([], operations.difference({"x": [1, 0.0]}, {"x": [1.0, 0]}))

    def test_cli_invalid_result_is_a_json_failure_without_traceback(self):
        with patch.object(content, "invoke_engine", side_effect=ValueError("bad result")), \
             patch("sys.stdout", new_callable=io.StringIO) as output:
            status = content.main(["validate", "--format", "json"])
        self.assertEqual(1, status)
        self.assertEqual({"ok": False, "error": "bad result"}, json.loads(output.getvalue()))


if __name__ == "__main__":
    unittest.main()
