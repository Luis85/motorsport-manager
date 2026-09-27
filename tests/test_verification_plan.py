"""The required merge gate must never turn partial or stale evidence into a full pass."""
import copy
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import verification_run as runner


class PlanTests(unittest.TestCase):
    def setUp(self):
        self.plan = runner.suites()
        self.reports = [{"passed": True, "mode": "full", "source": "frozen-source", "index": i, "count": 6,
                         "suites": [{"id": s["id"], "passed": True, "checks": 1} for s in runner.partition(self.plan, i, 6)]} for i in range(6)]

    def test_previous_required_suites_are_retained(self):
        required = json.loads((runner.ROOT / "tests/fixtures/required_verification_suites.json").read_text())
        self.assertTrue(set(required).issubset({s["id"] for s in self.plan}))

    def test_each_suite_appears_once_at_all_supported_counts(self):
        for count in [1, 2, 3, 6, 8, 64]:
            actual = [s["id"] for i in range(count) for s in runner.partition(self.plan, i, count)]
            self.assertEqual(sorted(actual), sorted(s["id"] for s in self.plan))

    def test_complete_evidence_passes(self):
        self.assertTrue(runner.validate_aggregate(self.reports, 6, self.plan)["passed"])

    def test_invalid_indices_are_rejected(self):
        for index, count in [(-1, 6), (6, 6), (0, 0), (0, 65)]:
            with self.assertRaises(ValueError): runner.partition(self.plan, index, count)

    def test_missing_duplicate_failed_mixed_and_partial_evidence_fails(self):
        variations = [self.reports[:-1], self.reports + [self.reports[0]]]
        for key, value in [("passed", False), ("mode", "headless-only"), ("source", "other"), ("index", 1), ("count", 5)]:
            variant = copy.deepcopy(self.reports); variant[0][key] = value; variations.append(variant)
        variant = copy.deepcopy(self.reports); variant[0]["suites"].pop(); variations.append(variant)
        variant = copy.deepcopy(self.reports); variant[0]["suites"][0]["passed"] = False; variations.append(variant)
        for variant in variations:
            with self.assertRaises(ValueError): runner.validate_aggregate(variant, 6, self.plan)


if __name__ == "__main__": unittest.main(verbosity=2)
