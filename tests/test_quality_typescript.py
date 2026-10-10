"""TypeScript code-line accounting, test classification and exclusions for the advisory gate."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from quality import inventory, measurement_findings
from quality_loc import category_of, measure, path_matches, typescript_lines
from quality_report import summary

ROOT = Path(__file__).resolve().parents[1]
POLICY = json.loads((ROOT / "quality-policy.json").read_text(encoding="utf-8"))


def lines(*rows: str) -> str:
    return "\n".join(rows) + "\n"


class TypeScriptLineTests(unittest.TestCase):
    def test_comment_like_text_inside_strings_is_code(self):
        source = lines(
            'const a = "// not a comment";',
            "const b = '/* nor this */';",
            "// a real comment with 'quotes' and `ticks`",
            '/* a block comment with "quotes"',
            "   and `ticks` */",
            'const c = "escaped \\" // still a string";',
        )
        self.assertEqual(typescript_lines(source), {1, 2, 6})

    def test_multiline_template_with_nested_holes_and_backticks(self):
        source = lines(
            "const t = `outer ${inner(`nested ${deep({ k: `x` })} // template text`)} /* text */",
            "// this line is template text, not a comment",
            "",
            "${ value /* hole comment */ } tail`;",
            "/* after the template */",
        )
        self.assertEqual(typescript_lines(source), {1, 2, 4})

    def test_template_hole_braces_do_not_end_the_hole_early(self):
        source = lines(
            "const t = `${(() => { const o = { a: { b: 1 } }; return o; })()}",
            "}`;",
            "// comment",
        )
        self.assertEqual(typescript_lines(source), {1, 2})

    def test_regular_expressions_containing_comment_markers(self):
        source = lines(
            "const r = /\\/\\/|\\/\\*/g; // trailing comment",
            "const s = /[/*]/u.test(x);",
            "const u = text.replace(/\\*\\//g, '');",
            "// comment after the literals",
            "function f(x: string) { return /a\\/b/.test(x); }",
            "if (!/^#/.test(x)) call();",
        )
        self.assertEqual(typescript_lines(source), {1, 2, 3, 5, 6})

    def test_division_is_not_a_regular_expression(self):
        source = lines(
            "const d = a / b / c; // note /",
            "const e = (x + 1) / 2 /* half */ / 3;",
            "const f = items[0] / total!/ 2;",
            "const g = value! / 100; const h = 1 / 2;",
            "// a comment line /* with markers",
        )
        self.assertEqual(typescript_lines(source), {1, 2, 3, 4})

    def test_jsdoc_and_block_comments_are_not_code(self):
        source = lines(
            "/**",
            " * Describes f.",
            " * @param a the value",
            " */",
            "export function f(a: number): number {",
            "  /** inline doc */",
            "  return a; /* trailing */",
            "}",
        )
        self.assertEqual(typescript_lines(source), {5, 7, 8})

    def test_hashbang_crlf_and_declaration_files(self):
        source = "#!/usr/bin/env node\r\n// note\r\nexport declare const x: number;\r\n"
        self.assertEqual(typescript_lines(source), {3})
        for name in ("a.ts", "a.d.ts", "a.cts", "a.mts", "a.d.mts"):
            with self.subTest(name=name):
                row = measure(Path("source/wildlands/source") / name, source, POLICY)
                self.assertEqual(row["code_lines"], 1)
                self.assertEqual(row["language"], "typescript")

    def test_multiline_string_continuation_counts_nonblank_lines(self):
        source = lines("const s = 'first \\", "second';", "// done")
        self.assertEqual(typescript_lines(source), {1, 2})

    def test_unterminated_tokens_are_failures_never_zero(self):
        cases = {
            'const s = "oops': "string literal",
            "const s = 'line\nbreak';": "string literal",
            "const t = `oops": "template literal",
            "const t = `a ${b": "template literal",
            "/* oops": "block comment",
            "const r = /oops": "regular expression",
        }
        for source, what in cases.items():
            with self.subTest(source=source):
                with self.assertRaisesRegex(ValueError, "Unterminated " + what):
                    typescript_lines(source)


class TypeScriptPolicyTests(unittest.TestCase):
    def test_glob_segments(self):
        self.assertTrue(path_matches("a/test-x.cts", "a/test-*.cts"))
        self.assertFalse(path_matches("a/test-support/x.cts", "a/test-*.cts"))
        self.assertTrue(path_matches("a/b/c/d.ts", "a/**"))
        self.assertTrue(path_matches("a/d.ts", "a/**/d.ts"))
        self.assertTrue(path_matches("a/b/c/d.ts", "a/**/d.ts"))
        self.assertFalse(path_matches("ab/d.ts", "a/**"))

    def test_test_classification(self):
        expected = {
            "source/wildlands/source/test-process.cts": "tests",
            "source/wildlands/source/test-support/game-fixtures.cts": "tests",
            "source/wildlands/source/verification/process-browser.ts": "tests",
            "source/wildlands/source/verification/process-map-label-checks.ts": "tests",
            "source/scene-forge/tests/core.test.ts": "tests",
            "source/scene-forge/tests/e2e/workflow.test.ts": "tests",
            "source/process-studio/tests/parity.test.cts": "tests",
            "source/process-studio/tests/parity-cases.cts": "tests",
            "tests/test_quality.py": "tests",
            "source/wildlands/source/process-ui.ts": "source",
            "source/wildlands/source/process-contracts.d.ts": "source",
            "source/wildlands/source/tools/process-cli.cts": "source",
            "source/wildlands/source/tools/test-like-name.cts": "source",
            "source/scene-forge/src/cli.ts": "source",
            "source/scene-forge/scripts/standalone.d.mts": "source",
            "source/process-studio/src/kernel.cts": "source",
            "source/process-studio/scripts/bundle.cts": "source",
        }
        for path, category in expected.items():
            with self.subTest(path=path):
                self.assertEqual(category_of(Path(path), POLICY), category)

    def test_budget_boundaries_for_typescript(self):
        for path, limit in [
            ("source/scene-forge/src/a.ts", 400),
            ("source/scene-forge/tests/a.test.ts", 450),
        ]:
            for count in (limit, limit + 1):
                with self.subTest(path=path, count=count):
                    source = "/** header */\n\n" + "const x = 1; // note\n" * count
                    row = measure(Path(path), source, POLICY)
                    self.assertEqual(row["code_lines"], count)
                    self.assertEqual(row["over_limit"], count > limit)
                    self.assertEqual(row["line"], limit + 3 if count > limit else 1)

    def test_generated_and_vendored_directories_are_excluded(self):
        names = [
            "bin/tool.ts",
            "demos/game.ts",
            "source/scene-forge/dist/types/index.d.ts",
            "source/wildlands/.generated/engine.ts",
            "source/wildlands/node_modules/pkg/index.d.ts",
            "source/wildlands/vendor/lib.ts",
            "source/wildlands/source/engine.ts",
            "source/scene-forge/src/index.ts",
            "source/scene-forge/tests/core.test.ts",
            "source/wildlands/source/styles.css",
        ]
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            subprocess.run(["git", "init", "-q"], cwd=root, check=True)
            for name in names:
                target = root / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text("export {};\n")
            self.assertEqual(
                inventory(root, POLICY),
                [
                    Path("source/scene-forge/src/index.ts"),
                    Path("source/scene-forge/tests/core.test.ts"),
                    Path("source/wildlands/source/engine.ts"),
                ],
            )

    def test_long_lines_are_advisory_typescript_findings(self):
        width = POLICY["long_lines"]["limit"]
        exact = "const a = '" + "x" * (width - 13) + "';"
        wide = "// " + "y" * (width - 2)
        source = lines(exact, wide, "const b = 1;")
        self.assertEqual(len(exact), width)
        row = measure(Path("source/wildlands/source/a.ts"), source, POLICY)
        self.assertEqual(row["long_lines"], [[2, width + 1]])
        findings = measurement_findings(row, POLICY)
        self.assertEqual([(item["rule"], item["line"]) for item in findings], [("long-line", 2)])
        python = measure(Path("scripts/a.py"), "x = '" + "z" * 200 + "'\n", POLICY)
        self.assertEqual(python["long_lines"], [])

    def test_summary_lists_languages(self):
        row = measure(Path("source/scene-forge/src/a.ts"), "const x = 1;\n", POLICY)
        report = {"files": [row], "findings": [], "tools": [], "analysis_complete": True}
        self.assertIn("| typescript | source | 1 | 0 | 0 |", summary(report))


if __name__ == "__main__":
    unittest.main()
