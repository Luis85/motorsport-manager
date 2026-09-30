"""Read-only authoring operations retain validation and exclusive-write boundaries."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import Mock

sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))
from content_operations import difference, execute


class ContentOperationsTests(unittest.TestCase):
    def test_differences_retain_array_order_and_escape_pointers(self):
        result = difference({"a/b": [1, 2]}, {"a/b": [2, 1]})
        self.assertEqual(result[0]["path"], "/a~1b")
        self.assertEqual(result[0]["before"], [1, 2])
        self.assertEqual(difference({"n": 1}, {"n": 1.0}), [])

    def test_difference_reports_additions_removals_and_a_bounded_window(self):
        self.assertEqual(difference({"before": 1}, {"after": 2})[0]["change"], "added")
        result = difference({}, {str(i): i for i in range(500)})
        self.assertEqual(len(result), 257)

    def test_invalid_source_cannot_export(self):
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary) / "snapshot.json"
            invoke = Mock(return_value={"ok": False, "error": "Invalid pack"})
            result = execute(argparse.Namespace(action="export", path=None, output=target, godot=None), invoke, lambda _: [])
            self.assertFalse(result["ok"])
            self.assertFalse(target.exists())

    def test_export_never_overwrites_and_identifies_inspection_format(self):
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary) / "snapshot.json"
            invoke = Mock(return_value={"ok": True, "snapshot": {"records": {"test.item": {"value": 3}}}})
            args = argparse.Namespace(action="export", path=None, output=target, godot=None)
            result = execute(args, invoke, lambda _: [])
            self.assertEqual(json.loads(target.read_text())["records"]["test.item"]["value"], 3)
            self.assertIn("not a directly loadable", result["scope"])
            with self.assertRaises(ValueError):
                execute(args, invoke, lambda _: [])
            self.assertEqual(invoke.call_count, 1)

    def test_test_command_calls_production_simulator_and_never_fakes_success(self):
        invoke = Mock(return_value={"ok": False, "simulation_executed": False})
        result = execute(argparse.Namespace(action="test", path=Path("pack"), scenario="test.scenario", steps=1600, godot="godot"), invoke, lambda _: ["--pack=pack"])
        self.assertFalse(result["ok"])
        self.assertFalse(result["simulation_executed"])
        self.assertIn("--action=test", invoke.call_args.args[0])
        self.assertIn("--steps=1600", invoke.call_args.args[0])

    def test_diff_never_compares_an_invalid_catalog(self):
        invoke = Mock(return_value={"ok": False, "diagnostics": [{"code": "CONTENT_REFERENCE"}]})
        result = execute(argparse.Namespace(action="diff", before=Path("old"), after=Path("new"), godot=None), invoke, lambda _: [])
        self.assertFalse(result["ok"])
        self.assertEqual(invoke.call_count, 1)

    def test_list_rejects_typo_in_kind_instead_of_claiming_empty_catalog(self):
        invoke = Mock(return_value={"ok": True, "kinds": ["circuit"], "definitions": []})
        with self.assertRaises(ValueError):
            execute(argparse.Namespace(action="list", path=None, godot=None, kind="circut"), invoke, lambda _: [])


if __name__ == "__main__":
    unittest.main()
