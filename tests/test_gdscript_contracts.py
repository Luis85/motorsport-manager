"""Refactoring cannot disconnect CLI and fitness checks from inherited authority."""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from check_architecture import inspect
from gdscript_contracts import inheritance_sources
from mechanics import hook_contracts


class InheritedContractTests(unittest.TestCase):
    def setUp(self):
        self.sources = {
            "scripts/domain/race_sim.gd": 'class_name RaceSim\nextends "res://scripts/domain/dispatch.gd"\n',
            "scripts/domain/dispatch.gd": 'extends RefCounted\nfunc step() -> void:\n\tmechanics.invoke(\n\t\t"step", []\n\t)\n# mechanics.invoke("example", [])\n',
            "scripts/domain/mechanics/race_hook_contract.gd": 'const HOOKS: Array[String] = ["step"]\n',
        }
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.write_sources()

    def write_sources(self):
        for name, source in self.sources.items():
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(source)

    def test_dispatch_hooks_follow_the_same_inheritance_as_godot(self):
        self.assertEqual(hook_contracts(self.root), {"step": ("", "void")})
        self.assertEqual(inspect(self.root)[0], [])

    def test_preloading_inherited_authority_cannot_bypass_the_ui_boundary(self):
        self.sources["scripts/ui/probe.gd"] = (
            'const Hidden = preload("res://scripts/domain/dispatch.gd")\n'
        )
        self.write_sources()
        self.assertIn("detached-renderer", [error.rule for error in inspect(self.root)[0]])

    def test_inheritance_through_declared_classes_preserves_source_order(self):
        self.sources["scripts/domain/race_sim.gd"] = "class_name RaceSim\nextends Dispatch\n"
        self.sources["scripts/domain/dispatch.gd"] = (
            "class_name Dispatch\n" + self.sources["scripts/domain/dispatch.gd"]
        )
        self.assertEqual(
            [path for path, _ in inheritance_sources(self.sources, "scripts/domain/race_sim.gd")],
            ["scripts/domain/race_sim.gd", "scripts/domain/dispatch.gd"],
        )

    def test_missing_cyclic_and_escaping_parents_fail_closed(self):
        for target in [
            "res://scripts/domain/missing.gd",
            "res://scripts/domain/race_sim.gd",
            "res://scripts/../outside.gd",
        ]:
            with self.subTest(target=target):
                self.sources["scripts/domain/dispatch.gd"] = f'extends "{target}"\n'
                self.write_sources()
                with self.assertRaises(ValueError):
                    hook_contracts(self.root)
                self.assertIn(
                    "mechanic-hook-contract", [error.rule for error in inspect(self.root)[0]]
                )


if __name__ == "__main__":
    unittest.main()
