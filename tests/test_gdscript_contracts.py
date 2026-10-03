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

    def test_inline_global_class_parent_preserves_mechanics_and_authority(self):
        self.sources["scripts/domain/dispatch.gd"] = (
            "class_name Dispatch\n" + self.sources["scripts/domain/dispatch.gd"]
        )
        for parent in ("Dispatch", '"res://scripts/domain/dispatch.gd"'):
            self.sources["scripts/domain/race_sim.gd"] = (
                f"class_name RaceSim extends {parent} # inline inheritance\n"
            )
            self.sources["scripts/application/alias.gd"] = "class_name HiddenRace extends RaceSim\n"
            self.sources["scripts/ui/probe.gd"] = "var live = HiddenRace.new()\n"
            self.write_sources()
            with self.subTest(parent=parent):
                self.assertEqual(hook_contracts(self.root), {"step": ("", "void")})
                self.assertIn(
                    "detached-renderer",
                    [v.rule for v in inspect(self.root)[0] if v.path == "scripts/ui/probe.gd"],
                )

    def test_inline_detached_value_inheritance_remains_legal(self):
        self.sources["scripts/domain/value.gd"] = "class_name DetachedValue extends RefCounted\n"
        self.sources["scripts/application/value.gd"] = (
            "class_name DisplayValue extends DetachedValue\n"
        )
        self.sources["scripts/ui/probe.gd"] = "var value = DisplayValue.new()\n"
        self.write_sources()
        self.assertEqual(inspect(self.root)[0], [])

    def test_named_inherited_authority_cannot_bypass_ui_boundary(self):
        self.sources["scripts/domain/dispatch.gd"] = (
            "class_name Dispatch\n" + self.sources["scripts/domain/dispatch.gd"]
        )
        for reference in (
            "var hidden = Dispatch.new()",
            "var hidden: Dispatch",
            "extends Dispatch",
        ):
            self.sources["scripts/ui/probe.gd"] = reference + "\n"
            self.write_sources()
            with self.subTest(reference=reference):
                violations = [v for v in inspect(self.root)[0] if v.path == "scripts/ui/probe.gd"]
                self.assertIn("detached-renderer", [v.rule for v in violations])

    def test_plain_domain_values_remain_available_to_ui(self):
        self.sources["scripts/domain/value.gd"] = "class_name DetachedValue\nextends RefCounted\n"
        self.sources["scripts/ui/probe.gd"] = "var value = DetachedValue.new()\n"
        self.write_sources()
        self.assertEqual(inspect(self.root)[0], [])

    def test_named_descendants_keep_authority_across_application_adapters(self):
        self.sources.update(
            {
                "scripts/domain/car.gd": "class_name RaceCar\nextends RefCounted\n",
                "scripts/domain/car_alias.gd": "class_name CarAlias\nextends RaceCar\n",
                "scripts/application/car_adapter.gd": (
                    'class_name HiddenCar\nextends "res://scripts/domain/car_alias.gd"\n'
                ),
                "scripts/application/private_car_adapter.gd": "extends CarAlias\n",
            }
        )
        for reference in (
            "var live = HiddenCar.new()",
            "var live: HiddenCar",
            "extends HiddenCar",
            'const Live = preload("res://scripts/application/car_adapter.gd")',
            'const Live = preload("res://scripts/application/private_car_adapter.gd")',
        ):
            self.sources["scripts/ui/probe.gd"] = reference + "\n"
            self.write_sources()
            with self.subTest(reference=reference):
                violations = [v for v in inspect(self.root)[0] if v.path == "scripts/ui/probe.gd"]
                self.assertIn("detached-renderer", [v.rule for v in violations])

    def test_detached_value_subclasses_remain_available_to_ui(self):
        self.sources["scripts/domain/value.gd"] = "class_name DetachedValue\nextends RefCounted\n"
        self.sources["scripts/application/value_adapter.gd"] = (
            "class_name DisplayValue\nextends DetachedValue\n"
        )
        self.sources["scripts/ui/probe.gd"] = "var value = DisplayValue.new()\n"
        self.write_sources()
        self.assertEqual(inspect(self.root)[0], [])

    def test_shadowed_dispatch_fails_both_cli_and_guard(self):
        child = self.sources["scripts/domain/race_sim.gd"]
        for override in (
            "func step() -> void:\n\tpass\n",
            "func step():\n\tpass\n",
            "func step ():\n\tpass\n",
            "func step(\n) -> void:\n\tpass\n",
            'func step() -> void:\n\tmechanics.invoke("step", [])\n',
        ):
            self.sources["scripts/domain/race_sim.gd"] = child + override
            self.write_sources()
            with self.subTest(override=override):
                with self.assertRaisesRegex(ValueError, "shadowed"):
                    hook_contracts(self.root)
                self.assertIn("mechanic-hook-contract", [v.rule for v in inspect(self.root)[0]])

    def test_plain_method_overrides_and_documented_examples_are_not_dispatch(self):
        self.sources["scripts/domain/race_sim.gd"] += (
            'func describe():\n\tvar example = "mechanics.invoke(\\"step\\", [])"\n'
            '\t# mechanics.invoke("step", [])\n\treturn example\n'
        )
        self.sources["scripts/domain/dispatch.gd"] += 'func describe():\n\treturn "base"\n'
        self.write_sources()
        self.assertEqual(hook_contracts(self.root), {"step": ("", "void")})
        self.assertEqual(inspect(self.root)[0], [])

    def test_unresolved_global_parent_fails_both_cli_and_guard(self):
        self.sources["scripts/domain/dispatch.gd"] = (
            'extends NonexistentGlobal\nfunc step() -> void:\n\tmechanics.invoke("step", [])\n'
        )
        self.write_sources()
        with self.assertRaisesRegex(ValueError, "Unresolved inherited global class"):
            hook_contracts(self.root)
        self.assertIn("mechanic-hook-contract", [v.rule for v in inspect(self.root)[0]])

    def test_native_terminals_and_trailing_comments_are_explicitly_supported(self):
        for native in ("RefCounted", "Node", "Control", "Window"):
            sources = {"entry.gd": f"extends {native} # documentation\n"}
            with self.subTest(native=native):
                self.assertEqual(inheritance_sources(sources, "entry.gd"), list(sources.items()))

    def test_unresolved_non_simulation_authority_parent_fails_guard(self):
        self.sources["scripts/application/race_session_runner.gd"] = (
            "class_name RaceSessionRunner\nextends MissingRunnerBase\n"
        )
        self.write_sources()
        violations = inspect(self.root)[0]
        self.assertTrue(
            any(
                error.rule == "authority-inheritance" and "MissingRunnerBase" in error.detail
                for error in violations
            )
        )

    def test_ambiguous_global_names_and_unhandled_parent_syntax_fail_closed(self):
        for sources in (
            {"entry.gd": "extends Helper.Inner\n", "helper.gd": "class_name Helper\n"},
            {
                "entry.gd": "extends Helper\n",
                "a.gd": "class_name Helper\n",
                "b.gd": "class_name Helper\n",
            },
        ):
            with self.subTest(sources=sources), self.assertRaises(ValueError):
                inheritance_sources(sources, "entry.gd")

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
