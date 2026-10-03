"""Reject timing comparisons which do not establish comparable work and outcomes."""

import sys
import unittest
from copy import deepcopy
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from paired_runtime import IDENTITY, summarize, validate_pair


def report():
    value = {key: "same" for key in IDENTITY}
    value.update(
        passed=True,
        checks=10,
        controlled=[
            {
                "speed": 16,
                "input_frames": 120,
                "fixed_steps": 100,
                "frame_cap_discarded_seconds": 1.5,
                "outcome_hash": "same",
            }
        ],
        simulation={"steps": 1000, "simulated_seconds": 50, "outcome_hash": "same"},
        timings=[
            {
                "workload": "save",
                "median_us": 100,
                "samples": 24,
                "warmup_calls": 4,
                "measured_calls": 24,
            }
        ],
    )
    return value


class RuntimeComparisonTests(unittest.TestCase):
    def test_same_work_accepts_different_elapsed_time(self):
        base, candidate = report(), report()
        candidate["timings"][0]["median_us"] = 75
        self.assertEqual(
            summarize([{"baseline": base, "candidate": candidate}])[0]["reduction_percent"], 25
        )

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
        for change in (
            lambda x: x.update(passed=False),
            lambda x: x.pop("controlled"),
            lambda x: x["timings"].append(deepcopy(x["timings"][0])),
            lambda x: x["timings"][0].update(samples=1),
            lambda x: x["timings"][0].update(median_us=0),
        ):
            candidate = report()
            change(candidate)
            with self.assertRaises(ValueError):
                validate_pair(report(), candidate)

    def test_identically_invalid_work_is_not_comparable_evidence(self):
        for change in (
            lambda x: x.update(checks=True),
            lambda x: x.update(checks=-1),
            lambda x: x.update(timings=[]),
            lambda x: x.update(timings=[None]),
            lambda x: x.update(controlled="same"),
            lambda x: x.update(simulation=None),
            lambda x: x["timings"][0].update(samples=-1),
            lambda x: x["timings"][0].update(measured_calls=True),
            lambda x: x["timings"][0].update(warmup_calls=-1),
            lambda x: x["timings"][0].update(workload=[]),
        ):
            base, candidate = report(), report()
            change(base)
            change(candidate)
            with self.subTest(change=change), self.assertRaises(ValueError):
                validate_pair(base, candidate)

    def test_no_pairs_is_not_evidence(self):
        with self.assertRaises(ValueError):
            summarize([])

    def test_missing_simulation_work_cannot_produce_a_speedup(self):
        for field in ("steps", "simulated_seconds"):
            base, candidate = report(), report()
            for value in (base, candidate):
                value["simulation"].pop(field)
            candidate["timings"][0]["median_us"] = 75
            with self.subTest(field=field), self.assertRaises(ValueError):
                summarize([{"baseline": base, "candidate": candidate}])

    def test_identically_malformed_controlled_records_are_rejected(self):
        for rows in ([None], [{}], [dict(report()["controlled"][0], outcome_hash=True)]):
            base, candidate = report(), report()
            base["controlled"] = candidate["controlled"] = rows
            with self.subTest(rows=rows), self.assertRaises(ValueError):
                validate_pair(base, candidate)

    def test_missing_or_invalid_deterministic_work_is_not_comparable(self):
        domains = {
            "controlled": {
                "speed": (False, 0, float("inf")),
                "input_frames": (True, 0, 120.0),
                "fixed_steps": (True, 0, -1),
                "frame_cap_discarded_seconds": (True, -1, float("nan")),
                "outcome_hash": (False, "", " "),
            },
            "simulation": {
                "steps": (True, 0, 1000.0),
                "simulated_seconds": (True, 0, float("inf")),
                "outcome_hash": (False, "", " "),
            },
        }
        for domain, fields in domains.items():
            for field, invalid in fields.items():
                for bad in (None, *invalid):
                    base, candidate = report(), report()
                    for value in (base, candidate):
                        target = value[domain][0] if domain == "controlled" else value[domain]
                        if bad is None:
                            target.pop(field)
                        else:
                            target[field] = bad
                    with self.subTest(domain=domain, field=field, bad=bad):
                        with self.assertRaises(ValueError):
                            validate_pair(base, candidate)

    def test_zero_discarded_frame_time_is_valid(self):
        base, candidate = report(), report()
        base["controlled"][0]["frame_cap_discarded_seconds"] = 0
        candidate["controlled"][0]["frame_cap_discarded_seconds"] = 0.0
        validate_pair(base, candidate)


if __name__ == "__main__":
    unittest.main()
