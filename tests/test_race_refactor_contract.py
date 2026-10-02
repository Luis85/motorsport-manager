"""Regression contract for the split RaceSim inheritance chain."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
PORT = ROOT / "scripts/domain/race_sim_port.gd"
CORE = ROOT / "scripts/domain/race_sim_core.gd"
AGGREGATE = ROOT / "scripts/domain/race_sim.gd"


class RaceRefactorContractTests(unittest.TestCase):
    def test_base_required_player_team_label_is_declared_on_port(self):
        port = PORT.read_text(encoding="utf-8")
        core = CORE.read_text(encoding="utf-8")
        self.assertIn("player_team_label()", core)
        self.assertIn("func player_team_label() -> String:", port)

    def test_concrete_aggregate_keeps_explicit_base_path(self):
        source = AGGREGATE.read_text(encoding="utf-8")
        self.assertIn('extends "res://scripts/domain/race_sim_operations.gd"', source)


if __name__ == "__main__":
    unittest.main()
