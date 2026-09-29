"""Reject timing comparisons which do not establish comparable work and outcomes."""
from copy import deepcopy
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from paired_runtime import IDENTITY, summarize, validate_pair


def report():
    value = {key: "same" for key in IDENTITY}
    value.update(passed=True, checks=10, controlled=[{"speed": 16, "fixed_steps": 100, "outcome_hash": "same"}],
                 simulation={"steps": 1000, "simulated_seconds": 50, "outcome_hash": "same"},
                 timings=[{"workload": "save", "median_us": 100, "samples": 24, "warmup_calls": 4}])
    return value


class RuntimeComparisonTests(unittest.TestCase):
    def test_same_work_accepts_different_elapsed_time(self):
        base, candidate = report(), report()
        candidate["timings"][0]["median_us"] = 75
        self.assertEqual(summarize([{"baseline": base, "candidate": candidate}])[0]["reduction_percent"], 25)

    def test_changed_hardware_or_fixture_is_not_a_speedup(self):
        for key in IDENTITY:
            candidate = report()
            candidate[key] = "different"
            with self.subTest(key=key), self.assertRaises(ValueError):
                validate_pair(report(), candidate)

    def test_changed_outcome_is_not_a_speedup(self):
        candidate = report()
        candidate["controlled"][0]["outcome_hash"] = "different"
        with self.assertRaises(ValueError):
            validate_pair(report(), candidate)
        candidate = report()
        candidate["simulation"]["steps"] = 1
        with self.assertRaises(ValueError):
            validate_pair(report(), candidate)

    def test_missing_failed_or_duplicate_work_is_rejected(self):
        for change in (lambda x: x.update(passed=False), lambda x: x.pop("controlled"),
                       lambda x: x["timings"].append(deepcopy(x["timings"][0])),
                       lambda x: x["timings"][0].update(samples=1),
                       lambda x: x["timings"][0].update(median_us=0)):
            candidate = report()
            change(candidate)
            with self.assertRaises(ValueError):
                validate_pair(report(), candidate)

    def test_no_pairs_is_not_evidence(self):
        with self.assertRaises(ValueError):
            summarize([])


if __name__ == "__main__":
    unittest.main()
