"""Finding identities are review aids, never a suppression baseline."""
from copy import deepcopy
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import quality_delta


def report(findings):
    return {"schema_version": 1, "analysis_complete": True, "mode": "advisory",
            "commit": "abc", "source_sha256": "source", "analyzer_sha256": "analyzer",
            "tool_versions": {"ruff": "pinned", "gdtoolkit": "pinned"},
            "policy": {"source_limit": 400}, "findings": findings}


def finding(line=1, path="scripts/example.gd", message="Unclear branch"):
    return {"rule": "complexity", "path": path, "message": message, "line": line}


class QualityDeltaTests(unittest.TestCase):
    def test_line_movement_is_unchanged_and_both_locations_are_retained(self):
        result = quality_delta.compare(report([finding(2)]), report([finding(19)]))
        self.assertTrue(result["comparable"])
        self.assertEqual(result["new"], [])
        self.assertEqual(result["resolved"], [])
        self.assertEqual(result["unchanged"], [{"base": finding(2), "candidate": finding(19)}])

    def test_duplicate_findings_use_multiset_not_set_semantics(self):
        result = quality_delta.compare(report([finding(2), finding(8)]), report([finding(7)]))
        self.assertEqual(len(result["unchanged"]), 1)
        self.assertEqual(result["resolved"], [finding(8)])

    def test_message_change_and_rename_are_not_inferred_equivalent(self):
        result = quality_delta.compare(report([finding()]), report([finding(path="new.gd", message="Other branch")]))
        self.assertEqual(len(result["new"]), 1)
        self.assertEqual(len(result["resolved"]), 1)
        self.assertEqual(len(result["unchanged"]), 0)

    def test_incomplete_analysis_cannot_resolve_debt(self):
        candidate = report([])
        candidate["analysis_complete"] = False
        result = quality_delta.compare(report([finding()]), candidate)
        self.assertFalse(result["comparable"])
        self.assertEqual(result["resolved"], [])
        self.assertIn("No resolved-debt claim", quality_delta.markdown(result))

    def test_policy_analyzer_and_tool_changes_refuse_comparison(self):
        for key in ("policy", "analyzer_sha256", "tool_versions"):
            candidate = report([])
            candidate[key] = {"changed": True} if key != "analyzer_sha256" else "different"
            with self.subTest(key=key):
                result = quality_delta.compare(report([finding()]), candidate)
                self.assertFalse(result["comparable"])
                self.assertEqual(result["resolved"], [])

    def test_legacy_report_without_provenance_is_explicitly_incomparable(self):
        candidate = report([])
        del candidate["tool_versions"]
        self.assertFalse(quality_delta.compare(report([]), candidate)["comparable"])

    def test_malformed_provenance_is_not_a_resolved_debt_claim(self):
        for versions in (None, [], "unknown", {"ruff": True}):
            candidate = report([])
            candidate["tool_versions"] = versions
            with self.subTest(versions=versions):
                result = quality_delta.compare(report([finding()]), candidate)
                self.assertFalse(result["comparable"])
                self.assertEqual(result["resolved"], [])

    def test_report_source_identity_is_required(self):
        candidate = report([])
        candidate["source_sha256"] = ""
        self.assertFalse(quality_delta.compare(report([]), candidate)["comparable"])

    def test_malformed_findings_fail_closed(self):
        for value in (None, [], report([{}]), report([dict(finding(), line=True)])):
            with self.subTest(value=value), self.assertRaises(ValueError):
                quality_delta.compare(report([]), value)

    def test_input_inventory_is_not_mutated(self):
        base = report([finding(9), finding(1)])
        original = deepcopy(base)
        quality_delta.compare(base, report([finding(4)]))
        self.assertEqual(base, original)

    def test_cli_retains_full_delta_without_blocking_findings(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name, value in (("base", report([])), ("candidate", report([finding()]))):
                (root / f"{name}.json").write_text(json.dumps(value), encoding="utf-8")
            code = quality_delta.main(["--base-report", str(root / "base.json"), "--candidate-report", str(root / "candidate.json"), "--output", str(root / "output")])
            self.assertEqual(code, 0)
            delta = json.loads((root / "output/delta.json").read_text())
            self.assertEqual(delta["new"], [finding()])


if __name__ == "__main__":
    unittest.main()
