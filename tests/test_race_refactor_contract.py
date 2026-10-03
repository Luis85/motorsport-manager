"""Regression contract for the split RaceSim inheritance chain."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from gdscript_contracts import inheritance_sources

ROOT = Path(__file__).resolve().parents[1]

PORT = ROOT / "scripts/domain/race_sim_port.gd"
CORE = ROOT / "scripts/domain/race_sim_core.gd"
AGGREGATE = ROOT / "scripts/domain/race_sim.gd"


class RaceRefactorContractTests(unittest.TestCase):
    def test_base_required_player_team_label_is_declared_on_port(self):
        sources = {
            path.relative_to(ROOT).as_posix(): path.read_text(encoding="utf-8")
            for path in (ROOT / "scripts/domain").glob("*.gd")
        }
        port = "\n".join(
            source for _, source in inheritance_sources(sources, PORT.relative_to(ROOT).as_posix())
        )
        core = CORE.read_text(encoding="utf-8")
        self.assertIn("player_team_label()", core)
        self.assertIn("func player_team_label() -> String:", port)

    def test_concrete_aggregate_keeps_explicit_base_path(self):
        sources = {
            path.relative_to(ROOT).as_posix(): path.read_text(encoding="utf-8")
            for path in (ROOT / "scripts/domain").glob("*.gd")
        }
        chain = inheritance_sources(sources, AGGREGATE.relative_to(ROOT).as_posix())
        self.assertIn("scripts/domain/race_sim_operations.gd", [path for path, _ in chain])
        self.assertIn(
            'extends "res://scripts/domain/race_sim_operations.gd"',
            "\n".join(source for _, source in chain),
        )


if __name__ == "__main__":
    unittest.main()
