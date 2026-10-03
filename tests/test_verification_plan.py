"""The required merge gate must never turn partial or stale evidence into a full pass."""

import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import verification_run as runner


class PlanTests(unittest.TestCase):
    def setUp(self):
        self.plan = runner.suites()
        self.reports = [
            {
                "passed": True,
                "mode": "full",
                "source": "frozen-source",
                "index": i,
                "count": 6,
                "suites": [
                    {"id": s["id"], "passed": True, "checks": 1}
                    for s in runner.partition(self.plan, i, 6)
                ],
            }
            for i in range(6)
        ]

    def test_previous_required_suites_are_retained(self):
        required = json.loads(
            (runner.ROOT / "tests/fixtures/required_verification_suites.json").read_text()
        )
        self.assertTrue(set(required).issubset({s["id"] for s in self.plan}))

    def test_each_suite_appears_once_at_all_supported_counts(self):
        for count in [1, 2, 3, 6, 8, 64]:
            actual = [s["id"] for i in range(count) for s in runner.partition(self.plan, i, count)]
            self.assertEqual(sorted(actual), sorted(s["id"] for s in self.plan))

    def test_complete_evidence_passes(self):
        self.assertTrue(
            runner.validate_aggregate(self.reports, 6, self.plan, "frozen-source")["passed"]
        )

    def test_consistently_stale_reports_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "another source"):
            runner.validate_aggregate(self.reports, 6, self.plan, "current-source")

    def test_focused_selection_is_explicit_and_cannot_be_a_shard(self):
        chosen, mode = runner.select_suites(
            self.plan, 0, 1, requested=["mechanics_tests", "editor_session_tests"]
        )
        self.assertEqual({s["id"] for s in chosen}, {"mechanics_tests", "editor_session_tests"})
        self.assertEqual(mode, "focused")
        with self.assertRaises(ValueError):
            runner.select_suites(self.plan, 0, 6, requested=["mechanics_tests"])
        with self.assertRaises(ValueError):
            runner.select_suites(self.plan, 0, 1, requested=["misspelled"])
        with self.assertRaises(ValueError):
            runner.select_suites(self.plan, 0, 1, True, ["minimal_ui_tests"])

    def test_malformed_suite_evidence_fails_closed(self):
        for invalid in [None, {}, [None], [{"id": 1}], [{"id": "some", "checks": -1}]]:
            reports = copy.deepcopy(self.reports)
            reports[0]["suites"] = invalid
            with self.assertRaises(ValueError):
                runner.validate_aggregate(reports, 6, self.plan, "frozen-source")
        reports = copy.deepcopy(self.reports)
        reports[0]["suites"][0]["checks"] = -1
        with self.assertRaises(ValueError):
            runner.validate_aggregate(reports, 6, self.plan, "frozen-source")

    def test_shard_identity_types_do_not_coerce_or_crash(self):
        for field, values in {
            "index": [False, 0.0, "0", [], {}],
            "count": [True, 6.0, "6", [], {}],
            "source": [None, "", True, [], {}],
        }.items():
            for value in values:
                with self.subTest(field=field, value=value):
                    reports = copy.deepcopy(self.reports)
                    reports[0][field] = value
                    with self.assertRaises(ValueError):
                        runner.validate_aggregate(reports, 6, self.plan, "frozen-source")
        for count in [True, 6.0, "6", 0, 65]:
            with self.subTest(count=count), self.assertRaises(ValueError):
                runner.validate_aggregate(self.reports, count, self.plan, "frozen-source")

    def test_source_digest_ignores_runtime_evidence_but_not_rules(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "rule.gd").write_text("original")
            initial = runner.source_digest(root)
            (root / "reports").mkdir()
            (root / "reports/result.json").write_text("evidence")
            self.assertEqual(initial, runner.source_digest(root))
            (root / ".ruff_cache").mkdir()
            (root / ".ruff_cache/check.bin").write_bytes(b"tool cache")
            self.assertEqual(initial, runner.source_digest(root))
            (root / "rule.gd").write_text("changed")
            self.assertNotEqual(initial, runner.source_digest(root))

    def test_invalid_indices_are_rejected(self):
        for index, count in [(-1, 6), (6, 6), (0, 0), (0, 65), (False, 6), (0.0, 6), (0, True)]:
            with self.assertRaises(ValueError):
                runner.partition(self.plan, index, count)

    def test_missing_duplicate_failed_mixed_and_partial_evidence_fails(self):
        variations = [self.reports[:-1], self.reports + [self.reports[0]]]
        for key, value in [
            ("passed", False),
            ("mode", "headless-only"),
            ("source", "other"),
            ("index", 1),
            ("count", 5),
        ]:
            variant = copy.deepcopy(self.reports)
            variant[0][key] = value
            variations.append(variant)
        variant = copy.deepcopy(self.reports)
        variant[0]["suites"].pop()
        variations.append(variant)
        variant = copy.deepcopy(self.reports)
        variant[0]["suites"][0]["passed"] = False
        variations.append(variant)
        for variant in variations:
            with self.assertRaises(ValueError):
                runner.validate_aggregate(variant, 6, self.plan, "frozen-source")


class RegistryTests(unittest.TestCase):
    """Malformed plans must fail before import, suite execution, or aggregation."""

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        (self.root / "scripts").mkdir()
        (self.root / "tests/fixtures").mkdir(parents=True)
        (self.root / "tests/baseline.gd").write_text("extends SceneTree\n")
        self.registry = self.root / "scripts/verification_suites.json"
        self.floor = self.root / "tests/fixtures/required_verification_suites.json"
        self.floor.write_text('["baseline"]')
        self.plan = [
            {
                "id": "baseline",
                "script": "tests/baseline.gd",
                "native": False,
                "layout": "minimal",
                "timeout": 360,
                "reports": ["baseline.json"],
            }
        ]
        self.write(self.plan)

    def write(self, plan):
        self.registry.write_text(json.dumps(plan))

    def test_valid_plan_is_unchanged_and_allows_explicit_extensions(self):
        original = copy.deepcopy(self.plan)
        self.assertEqual(runner.suites(self.root), original)
        extension = dict(original[0], id="extension_example", layout="engineering", native=True)
        self.write(original + [extension])
        self.assertEqual(runner.suites(self.root), original + [extension])
        self.assertEqual(self.plan, original)

    def test_invalid_envelopes_and_missing_fields_are_actionable(self):
        for invalid in [None, {}, "baseline", [], [None], [{}]]:
            with self.subTest(invalid=invalid):
                self.write(invalid)
                with self.assertRaisesRegex(ValueError, "verification_suites.json"):
                    runner.suites(self.root)
        for key in self.plan[0]:
            with self.subTest(missing=key):
                entry = dict(self.plan[0])
                del entry[key]
                self.write([entry])
                with self.assertRaisesRegex(ValueError, key):
                    runner.suites(self.root)

    def test_invalid_identity_and_duplicate_registration_are_rejected(self):
        for identity in [None, 3, [], "", " baseline", "base-line", "../baseline"]:
            with self.subTest(identity=identity):
                self.write([dict(self.plan[0], id=identity)])
                with self.assertRaisesRegex(ValueError, "id"):
                    runner.suites(self.root)
        self.write(self.plan * 2)
        with self.assertRaisesRegex(ValueError, "Duplicate.*baseline"):
            runner.suites(self.root)

    def test_execution_fields_do_not_coerce_invalid_types(self):
        cases = {
            "native": [None, "false", 0, 1, []],
            "timeout": [None, True, 0, -1, 360.0, "360", []],
            "layout": [None, "", "unknown", False, []],
        }
        for field, invalids in cases.items():
            for value in invalids:
                with self.subTest(field=field, value=value):
                    self.write([dict(self.plan[0], **{field: value})])
                    with self.assertRaisesRegex(ValueError, "baseline.*" + field):
                        runner.suites(self.root)
        for layout in ["minimal", "engineering", "director"]:
            self.write([dict(self.plan[0], layout=layout)])
            self.assertEqual(runner.suites(self.root)[0]["layout"], layout)

    def test_script_paths_are_bounded_existing_test_scripts(self):
        for value in [
            None,
            [],
            "",
            "/tests/baseline.gd",
            "../tests/baseline.gd",
            "tests/../tests/baseline.gd",
            "tests//baseline.gd",
            "tests/./baseline.gd",
            "tests\\baseline.gd",
            "scripts/baseline.gd",
            "tests/missing.gd",
            "tests/baseline.py",
            "tests/bad\0.gd",
        ]:
            with self.subTest(script=value):
                self.write([dict(self.plan[0], script=value)])
                with self.assertRaisesRegex(ValueError, "baseline.*script"):
                    runner.suites(self.root)
        with tempfile.TemporaryDirectory() as outside:
            target = Path(outside) / "outside.gd"
            target.write_text("extends SceneTree\n")
            link = self.root / "tests/escape.gd"
            try:
                link.symlink_to(target)
            except (OSError, NotImplementedError) as error:
                self.skipTest(f"Symlink creation is unavailable: {error}")
            self.write([dict(self.plan[0], script="tests/escape.gd")])
            with self.assertRaisesRegex(ValueError, "baseline.*script"):
                runner.suites(self.root)

    def test_reports_are_nonempty_unique_json_filenames(self):
        for value in [
            None,
            {},
            "baseline.json",
            [],
            [None],
            [3],
            [""],
            [".json"],
            ["../baseline.json"],
            ["/baseline.json"],
            ["reports/baseline.json"],
            ["reports\\baseline.json"],
            ["baseline.txt"],
            ["bad\0.json"],
            ["bad\n.json"],
            ["C:baseline.json"],
            ["baseline.json"] * 2,
        ]:
            with self.subTest(reports=value):
                self.write([dict(self.plan[0], reports=value)])
                with self.assertRaisesRegex(ValueError, "baseline.*reports"):
                    runner.suites(self.root)

    def test_floor_removal_cannot_silently_shrink_full_coverage(self):
        self.write([dict(self.plan[0], id="replacement")])
        with self.assertRaisesRegex(ValueError, "Missing required.*baseline"):
            runner.suites(self.root)
        self.write(self.plan)
        for invalid in [None, {}, [], [None], [""], ["baseline", "baseline"]]:
            with self.subTest(floor=invalid):
                self.floor.write_text(json.dumps(invalid))
                with self.assertRaisesRegex(ValueError, "required_verification_suites.json"):
                    runner.suites(self.root)

    def test_invalid_json_identifies_its_source(self):
        self.registry.write_text("[")
        with self.assertRaisesRegex(ValueError, "verification_suites.json"):
            runner.suites(self.root)
        self.write(self.plan)
        self.floor.write_text("[")
        with self.assertRaisesRegex(ValueError, "required_verification_suites.json"):
            runner.suites(self.root)

    def test_cli_rejects_bad_plan_before_any_engine_execution(self):
        self.write([dict(self.plan[0], native="false")])
        with (
            mock.patch.object(runner, "ROOT", self.root),
            mock.patch.object(runner, "execute") as execute,
        ):
            with mock.patch.object(sys, "argv", ["verify.py", "--godot", "unused"]):
                with mock.patch.object(sys, "stderr") as stderr:
                    self.assertEqual(runner.main(), 1)
                    self.assertIn("native", str(stderr.write.call_args_list))
            execute.assert_not_called()


if __name__ == "__main__":
    unittest.main(verbosity=2)
