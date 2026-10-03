"""Real Godot acceptance of copied centralized config roots and transactional knobs."""

from __future__ import annotations

import json
import os
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))
import balance

ENGINE = os.environ.get("GODOT_BINARY") or os.environ.get("VERIFICATION_TEST_GODOT")
ROOT = Path(os.environ.get("BALANCE_TEST_ROOT", str(balance.ROOT)))


@unittest.skipUnless(
    ENGINE and (ROOT / "config/pack.json").is_file(),
    "Native balancing tests require Godot and the integrated centralized config checkout.",
)
class BalanceIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="balance root ü ")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.config = self.root / "A"
        self.other = self.root / "B"
        shutil.copytree(ROOT / "config", self.config)
        shutil.copytree(self.config, self.other)

    def execute(self, *arguments):
        args = balance.parser().parse_args(
            [
                "--config-dir",
                str(self.config),
                "--godot",
                str(ENGINE),
                *arguments,
            ]
        )
        return balance.execute(args, ROOT)

    def test_trusted_copied_roots_support_validate_inspect_dry_run_set_and_diff(self):
        path = self.config / "race_tuning/default.json"
        original = path.read_bytes()
        value = self.execute("inspect", "race_tuning/default.json", "/fuel/race_load_per_lap")
        self.assertTrue(value["engine_executed"], value)
        self.assertEqual(value["value"], 1.13)
        self.assertEqual(value["metadata"]["engine_version"].split(".")[:3], ["4", "7", "2"])
        dry = self.execute(
            "set", "race_tuning/default.json", "/fuel/race_load_per_lap", "1.14", "--dry-run"
        )
        self.assertTrue(dry["validation"], dry)
        self.assertFalse(dry["published"])
        self.assertEqual(path.read_bytes(), original)
        changed = self.execute("set", "race_tuning/default.json", "/fuel/race_load_per_lap", "1.14")
        self.assertTrue(changed["validation"], changed)
        self.assertTrue(changed["published"])
        self.assertTrue(changed["config_validated"])
        self.assertEqual(
            path.read_bytes(),
            original.replace(b'"race_load_per_lap": 1.13', b'"race_load_per_lap": 1.14'),
        )
        diff = self.execute("diff", str(self.other))
        self.assertFalse(diff["equal"])
        self.assertEqual(len(diff["changes"]), 1)
        self.assertEqual((self.other / "race_tuning/default.json").read_bytes(), original)

    def test_native_schema_rejection_preserves_source(self):
        path = self.config / "race_tuning/default.json"
        original = path.read_bytes()
        rejected = self.execute("set", "race_tuning/default.json", "/fuel/race_load_per_lap", "-1")
        self.assertFalse(rejected["ok"], rejected)
        self.assertTrue(rejected["engine_executed"])
        self.assertEqual(path.read_bytes(), original)

    def test_invalid_unselected_raw_scenario_circuit_or_unlisted_file_blocks_set(self):
        target = self.config / "race_tuning/default.json"
        original = target.read_bytes()
        for family in ("scenario", "circuit", "unlisted"):
            with self.subTest(family=family):
                if family == "scenario":
                    broken = self.config / "scenarios/dry-strategy.json"
                    data = json.loads(broken.read_text())
                    data["scenarios"][0]["laps"] = 0
                elif family == "circuit":
                    broken = self.config / "circuits/hillside.json"
                    data = json.loads(broken.read_text())
                    data["nodes"] = []
                else:
                    broken = self.config / "unlisted.json"
                    data = {"unknown": "unused but invalid"}
                old = broken.read_bytes() if broken.exists() else None
                broken.write_text(json.dumps(data))
                rejected = self.execute(
                    "set", "race_tuning/default.json", "/fuel/race_load_per_lap", "1.14"
                )
                self.assertFalse(rejected["ok"], rejected)
                self.assertTrue(rejected["engine_executed"])
                self.assertEqual(target.read_bytes(), original)
                if old is None:
                    broken.unlink()
                else:
                    broken.write_bytes(old)


if __name__ == "__main__":
    unittest.main()
