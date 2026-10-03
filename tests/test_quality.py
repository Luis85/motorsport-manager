"""Adversarial fixtures for advisory measurement, reporting and process outcomes."""

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
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from quality import execute, inventory, main, tool_findings
from quality_loc import gdscript_lines, measure, python_lines
from quality_report import annotation, publish

POLICY = {
    "limits": {"source": 400, "tests": 450},
    "extensions": [".py", ".gd"],
    "test_roots": ["tests"],
    "excluded_directories": ["vendor", "reports"],
    "complexity_limit": 15,
    "tool_timeout_seconds": 5,
}


class QualityMeasurementTests(unittest.TestCase):
    def test_exact_budgets_and_first_excess_line(self):
        for path, limit in [("scripts/a.gd", 400), ("tests/a.gd", 450)]:
            for count in (limit - 1, limit, limit + 1):
                with self.subTest(path=path, count=count):
                    source = "# documentation\n\n" + "var x = 1 # note\n" * count
                    row = measure(Path(path), source, POLICY)
                    self.assertEqual(row["code_lines"], count)
                    self.assertEqual(row["over_limit"], count > limit)
                    self.assertEqual(row["line"], limit + 3 if count > limit else 1)

    def test_gd_hashes_quotes_escapes_and_multiline_strings(self):
        source = (
            '# ignore\nvar x = "#code" # ignore\nvar y = "escaped \\" #still"\n'
            'var z = """long\n# runtime content\n\nend""" # ignore\n'
        )
        self.assertEqual(gdscript_lines(source), {2, 3, 4, 5, 7})
        # Godot permits newline-containing double-quoted literals too.
        self.assertEqual(gdscript_lines('var s = "a\n# data\nb"\n'), {1, 2, 3})
        self.assertEqual(gdscript_lines("var s = '#value' # note\r\n\t# note\r\n"), {1})

    def test_python_docstrings_not_runtime_strings(self):
        source = '"""module docs\nmore docs"""\n# note\ndef f():\n    "docs"\n    return "# code"\n'
        self.assertEqual(python_lines(source), {4, 6})
        self.assertEqual(python_lines('x = """data\n# runtime\n\nend"""\n'), {1, 2, 4})
        self.assertEqual(python_lines('"docs"; x = 1 # still code\n'), {1})

    def test_malformed_or_unsupported_never_zero(self):
        for source in ['var s = "oops', "var s = '''oops"]:
            with self.assertRaises(ValueError):
                gdscript_lines(source)
        with self.assertRaises(SyntaxError):
            python_lines("def (: nope")
        with self.assertRaises(ValueError):
            measure(Path("a.js"), "let x = 1", POLICY)

    def test_documentation_does_not_change_budget(self):
        baseline = "extends Node\nvar value = 4\n"
        self.assertEqual(
            len(gdscript_lines(baseline)),
            len(gdscript_lines("# long explanation\n\n" + baseline + "\n# more context\n")),
        )


class QualityReportingTests(unittest.TestCase):
    def test_actions_escaping_and_bounded_report(self):
        warning = {
            "rule": "A,B",
            "message": "bad%\n::error::injection",
            "path": "a,b.gd",
            "line": 2,
        }
        text = annotation(warning)
        self.assertNotIn("\n", text)
        self.assertIn("a%2Cb.gd", text)
        self.assertIn("bad%25%0A", text)
        report = {"files": [], "findings": [warning] * 9, "tools": [], "analysis_complete": True}
        with (
            tempfile.TemporaryDirectory() as temp,
            contextlib.redirect_stdout(io.StringIO()) as stream,
        ):
            with patch.dict(os.environ, {}, clear=True):
                publish(report, Path(temp), True, 3)
            self.assertEqual(len(stream.getvalue().splitlines()), 4)
            self.assertEqual(
                len(json.loads((Path(temp) / "quality.json").read_text())["findings"]), 9
            )

    def test_missing_and_timed_out_tool_is_not_clean(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            tool, _ = execute("missing", [str(root / "absent")], root, root, 1)
            self.assertEqual(tool["status"], "unavailable")
            with patch("quality.subprocess.run", side_effect=subprocess.TimeoutExpired("slow", 1)):
                tool, _ = execute("timeout", ["slow"], root, root, 1)
            self.assertEqual(tool["status"], "unavailable")

    def test_native_findings_and_malformed_output(self):
        root = Path("/repo")
        tool = {"name": "gdlint", "status": "findings", "exit_code": 1, "log": "gdlint.log"}
        rows = tool_findings(tool, "scripts/a.gd:4: Error: Too long (max-line-length)\n", root, 15)
        self.assertEqual(rows[0]["line"], 4)
        tool = {"name": "ruff", "status": "findings", "exit_code": 2, "log": "ruff.log"}
        rows = tool_findings(tool, "invalid json", root, 15)
        self.assertEqual(tool["status"], "unavailable")
        self.assertEqual(rows[0]["rule"], "tool-unavailable")

    def test_empty_object_is_not_valid_ruff_evidence(self):
        tool = {"name": "ruff", "status": "clean", "exit_code": 0, "log": "ruff.log"}
        rows = tool_findings(tool, "{}", Path("/repo"), 15)
        self.assertEqual(tool["status"], "unavailable")
        self.assertEqual(rows[0]["rule"], "tool-unavailable")

    def test_complexity_threshold(self):
        tool = {"name": "gdradon", "status": "clean", "exit_code": 0, "log": "cc.log"}
        rows = tool_findings(
            tool,
            "scripts/a.gd\n    F 4:0 fine - C (15)\n    F 20:0 large - C (16)\n",
            Path("/repo"),
            15,
        )
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["line"], 20)

    def test_default_advisory_and_explicit_strict(self):
        with tempfile.TemporaryDirectory() as temp, contextlib.redirect_stdout(io.StringIO()):
            with patch("quality.collect", side_effect=ValueError("broken configuration")):
                self.assertEqual(main(["--output", temp]), 0)
                self.assertEqual(main(["--output", temp, "--strict"]), 1)
                self.assertFalse(
                    json.loads((Path(temp) / "quality.json").read_text())["analysis_complete"]
                )

    def test_inventory_ignores_vendor_and_reports_without_hiding_tests(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            subprocess.run(["git", "init", "-q"], cwd=root, check=True)
            for name in ("a.gd", "tests/a.gd", "vendor/a.gd", "reports/a.py", "docs/note.md"):
                target = root / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text("# fixture\n")
            self.assertEqual(inventory(root, POLICY), [Path("a.gd"), Path("tests/a.gd")])


if __name__ == "__main__":
    unittest.main()
