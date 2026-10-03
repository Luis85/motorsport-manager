"""Mechanic authoring tool contract, rollback and real generated GDScript execution."""

import contextlib
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import mechanics
import verify
from gdscript_contracts import inheritance_sources


class MechanicsToolTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.root = Path(self.folder.name) / "project"
        for relative in [
            *[
                p.relative_to(mechanics.ROOT)
                for p in (mechanics.ROOT / "scripts/domain").glob("race_sim*.gd")
            ],
            mechanics.REGISTRY,
            *[
                p.relative_to(mechanics.ROOT)
                for p in (mechanics.ROOT / mechanics.MECHANICS).glob("*.gd")
            ],
        ]:
            target = self.root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(mechanics.ROOT / relative, target)

    def aggregate_source(self, hook):
        sources = {
            path.relative_to(self.root).as_posix(): path.read_text()
            for path in (self.root / "scripts").rglob("*.gd")
        }
        for path, text in inheritance_sources(sources, "scripts/domain/race_sim.gd"):
            if hook in mechanics._source_hook_contracts(text):
                return self.root / path
        self.fail("Missing aggregate dispatch for " + hook)

    def plan(self, identity="extension_probe", hooks=None):
        return mechanics.scaffold(self.root, identity, hooks or ["forecast_parameters"], "practice")

    def test_catalog_lists_supported_profiles_and_all_hooks(self):
        self.assertEqual(
            {x["id"] for x in mechanics.catalog(self.root)},
            {"strategy", "weather", "recovery", "practice"},
        )
        hooks = mechanics.hook_contracts(self.root)
        self.assertEqual(hooks["weather_advice"], ("id: int", "Dictionary"))
        self.assertEqual(len(hooks), 62)

    def test_dry_plan_never_changes_project(self):
        before = {str(p): p.read_bytes() for p in self.root.rglob("*") if p.is_file()}
        self.plan()
        self.assertEqual(
            before, {str(p): p.read_bytes() for p in self.root.rglob("*") if p.is_file()}
        )

    def test_scaffold_registers_test_but_does_not_enable_gameplay(self):
        profile_path = self.root / mechanics.MECHANICS / "race_mechanic_profiles.gd"
        before = profile_path.read_bytes()
        files = self.plan(hooks=["step", "weather_advice"])
        mechanics.publish(self.root, files)
        self.assertEqual(before, profile_path.read_bytes())
        provider = (self.root / mechanics.MECHANICS / "extension_probe_mechanic.gd").read_text()
        self.assertIn("func step(sim: RaceSim) -> void:", provider)
        self.assertIn("func weather_advice(sim: RaceSim, id: int) -> Dictionary:", provider)
        self.assertIn("return sim.mechanics.before", provider)
        registry = json.loads((self.root / mechanics.REGISTRY).read_text())
        self.assertEqual(registry[-1]["id"], "extension_extension_probe")

    def test_invalid_ids_hooks_and_profiles_are_rejected(self):
        for identity in ["../escape", "/tmp/x", "With space", "A", "", "x" * 49, "practice"]:
            with self.assertRaises(ValueError):
                self.plan(identity)
        for hooks in [["unknown"], ["step", "step"]]:
            with self.assertRaises(ValueError):
                self.plan(hooks=hooks)
        with self.assertRaises(ValueError):
            mechanics.scaffold(self.root, "probe", ["step"], "unknown")

    def test_existing_target_is_not_overwritten(self):
        files = self.plan()
        test = self.root / "tests/extensions/extension_probe_tests.gd"
        test.parent.mkdir(parents=True)
        test.write_text("user work")
        with self.assertRaises(ValueError):
            mechanics.publish(self.root, files)
        self.assertEqual(test.read_text(), "user work")
        self.assertFalse((self.root / mechanics.MECHANICS / "extension_probe_mechanic.gd").exists())

    def test_failed_write_rolls_back_created_files_and_preserves_registry(self):
        files = self.plan()
        before = (self.root / mechanics.REGISTRY).read_bytes()
        replace = os.replace
        calls = []

        def fail_second(source, target):
            calls.append(target)
            if len(calls) == 2:
                raise OSError("injected second write failure")
            replace(source, target)

        with mock.patch.object(mechanics.os, "replace", side_effect=fail_second):
            with self.assertRaises(OSError):
                mechanics.publish(self.root, files)
        self.assertEqual(before, (self.root / mechanics.REGISTRY).read_bytes())
        for path in files:
            if path != mechanics.REGISTRY:
                self.assertFalse((self.root / path).exists())

    def test_symlink_escape_is_rejected(self):
        with tempfile.TemporaryDirectory() as external:
            (self.root / "tests").symlink_to(external, target_is_directory=True)
            with self.assertRaises(ValueError):
                mechanics.publish(self.root, self.plan())
            self.assertEqual(list(Path(external).iterdir()), [])

    def test_validation_uses_the_existing_registry_and_never_enables_a_provider(self):
        self.assertEqual(mechanics.validation_suites(self.root), ["mechanics_tests"])
        mechanics.publish(self.root, self.plan(hooks=["neutral"]))
        before = {str(p): p.read_bytes() for p in self.root.rglob("*") if p.is_file()}
        self.assertEqual(
            mechanics.validation_suites(self.root), ["mechanics_tests", "extension_extension_probe"]
        )
        self.assertEqual(mechanics.validation_suites(self.root, ["practice"]), ["mechanics_tests"])
        self.assertEqual(
            mechanics.validation_suites(self.root, ["extension_probe"] * 2),
            ["mechanics_tests", "extension_extension_probe"],
        )
        self.assertEqual(
            before, {str(p): p.read_bytes() for p in self.root.rglob("*") if p.is_file()}
        )

    def test_validation_rejects_unknown_or_unregistered_extensions(self):
        with self.assertRaisesRegex(ValueError, "Unknown mechanics"):
            mechanics.validation_suites(self.root, ["missing"])
        files = self.plan()
        mechanics.publish(
            self.root, {p: value for p, value in files.items() if p != mechanics.REGISTRY}
        )
        with self.assertRaisesRegex(ValueError, "Register behavior tests"):
            mechanics.validation_suites(self.root)

    def test_catalog_cannot_silently_drop_malformed_or_duplicate_providers(self):
        path = self.root / mechanics.MECHANICS / "invalid_mechanic.gd"
        for source in [
            "extends RaceMechanic\n",
            "func definition() -> Dictionary:\n\treturn {broken}\n",
            'func definition() -> Dictionary:\n\treturn {"id": 4}\n',
            'func definition() -> Dictionary:\n\treturn {"id": "practice"}\n',
        ]:
            path.write_text(source)
            with self.assertRaises(ValueError):
                mechanics.catalog(self.root)

    def test_validation_delegates_to_verifier_and_preserves_caller_arguments(self):
        original = sys.argv
        seen = []

        def run():
            seen.append(sys.argv[:])
            return 1

        with mock.patch("verification_run.main", side_effect=run):
            self.assertEqual(
                mechanics.run_validation(["mechanics_tests", "extension_probe"], "/pinned/godot"), 1
            )
        self.assertIs(sys.argv, original)
        self.assertEqual(
            seen,
            [
                [
                    "verify.py",
                    "--godot",
                    "/pinned/godot",
                    "--suite",
                    "mechanics_tests",
                    "--suite",
                    "extension_probe",
                ]
            ],
        )
        with mock.patch("verification_run.main", side_effect=RuntimeError("probe")):
            with self.assertRaises(RuntimeError):
                mechanics.run_validation(["mechanics_tests"], None)
        self.assertIs(sys.argv, original)

    def test_guarded_dispatch_and_documentation_preserve_all_contracts(self):
        path = self.aggregate_source("command")
        original = path.read_text()
        expected = mechanics.hook_contracts(self.root)
        comment = '\t# mechanics.invoke("not_a_hook", [])\n'
        path.write_text(
            original.replace(
                '\treturn mechanics.invoke("command",',
                comment + '\treturn mechanics.invoke("command",',
            )
        )
        self.assertEqual(mechanics.hook_contracts(self.root), expected)
        self.assertIn("command", expected)
        path.write_text(original.replace('mechanics.invoke("command",', 'mechanics.invoke("step",'))
        with self.assertRaisesRegex(ValueError, "identity differs"):
            mechanics.hook_contracts(self.root)
        path.write_text(
            original.replace(
                '\treturn mechanics.invoke("command",',
                '\tmechanics.invoke("command", [])\n\treturn mechanics.invoke("command",',
            )
        )
        with self.assertRaisesRegex(ValueError, "one explicit"):
            mechanics.hook_contracts(self.root)

    def test_multiline_literal_definitions_and_hook_signatures_preserve_contracts(self):
        path = self.aggregate_source("policy")
        expected = mechanics.hook_contracts(self.root)
        source = path.read_text()
        source = source.replace("func policy(id: int)", "func policy(\n\tid: int,\n)")
        source = source.replace('mechanics.invoke("policy",', 'mechanics.invoke(\n\t\t"policy",')
        path.write_text(source)
        self.assertEqual(mechanics.hook_contracts(self.root), expected)
        for provider in mechanics.catalog(self.root):
            provider_path = self.root / provider["source"]
            text = provider_path.read_text()
            begin = text.index("func definition()")
            end = text.find("\n\nfunc ", begin + 1)
            if end < 0:
                end = len(text)
            literal = {key: provider[key] for key in ("id", "version", "requires", "hooks")}
            provider_path.write_text(
                text[:begin]
                + "func definition() -> Dictionary:\n\treturn "
                + json.dumps(literal, indent=4)
                + "\n"
                + text[end:]
            )
        self.assertEqual(
            {item["id"] for item in mechanics.catalog(self.root)},
            set(mechanics.profiles(self.root)),
        )

    def test_literal_definition_rejects_trailing_expression(self):
        path = self.root / mechanics.MECHANICS / "extension_probe_mechanic.gd"
        record = {"id": "extension_probe", "version": 1, "requires": [], "hooks": []}
        path.write_text(
            "func definition() -> Dictionary:\n\treturn " + json.dumps(record) + ".merged({})\n"
        )
        with self.assertRaises(ValueError):
            mechanics.catalog(self.root)

    def test_validation_rejects_definition_contract_errors_before_execution(self):
        path = self.root / mechanics.MECHANICS / "extension_probe_mechanic.gd"
        good = {"id": "extension_probe", "version": 1, "requires": ["practice"], "hooks": ["step"]}
        for change in [
            {"version": True},
            {"version": 0},
            {"requires": ["missing"]},
            {"requires": ["extension_probe"]},
            {"requires": ["practice", "practice"]},
            {"hooks": ["step", "step"]},
            {"hooks": ["unknown"]},
            {"hooks": [4]},
            {"id": "bad identity"},
            {"requires": "practice"},
        ]:
            with self.subTest(change=change):
                path.write_text(
                    "func definition() -> Dictionary:\n\treturn " + json.dumps(good | change) + "\n"
                )
                with self.assertRaises(ValueError):
                    mechanics.validation_suites(self.root)

    def test_literal_predecessor_errors_include_source_and_do_not_parse_comments(self):
        files = self.plan(hooks=["step", "neutral"])
        mechanics.publish(self.root, files)
        path = self.root / mechanics.MECHANICS / "extension_probe_mechanic.gd"
        original = path.read_text()
        path.write_text(original + '\n# sim.mechanics.before("wrong", "unknown", [])\n')
        self.assertIn("extension_extension_probe", mechanics.validation_suites(self.root))
        path.write_text(
            original.replace('before("extension_probe", "step"', 'before("practice", "step"')
        )
        with self.assertRaisesRegex(
            ValueError, r"extension_probe_mechanic.gd:\d+: predecessor identity"
        ):
            mechanics.validation_suites(self.root)
        path.write_text(
            original.replace(
                'before("extension_probe", "step"', 'before("extension_probe", "command"'
            )
        )
        with self.assertRaisesRegex(ValueError, "undeclared predecessor hook: command"):
            mechanics.validation_suites(self.root)

    def test_production_order_and_extension_cycles_fail_early(self):
        path = self.root / mechanics.MECHANICS / "race_mechanic_profiles.gd"
        original = path.read_text()
        path.write_text(
            original.replace(
                '["strategy", "weather", "recovery", "practice"]',
                '["weather", "strategy", "recovery", "practice"]',
            )
        )
        with self.assertRaisesRegex(ValueError, "earlier production provider"):
            mechanics.validation_suites(self.root)
        path.write_text(original)
        for identity, dependency in [("first", "second"), ("second", "first")]:
            item = {"id": identity, "version": 1, "requires": [dependency], "hooks": []}
            (self.root / mechanics.MECHANICS / (identity + "_mechanic.gd")).write_text(
                "func definition() -> Dictionary:\n\treturn " + json.dumps(item) + "\n"
            )
        with self.assertRaisesRegex(ValueError, "cyclic mechanic prerequisites"):
            mechanics.validation_suites(self.root)

    def test_generated_execution_policy_rejects_zero_exit_engine_errors(self):
        reports = self.root / "reports"
        reports.mkdir()
        for message in [
            "SCRIPT ERROR: test failure",
            "Parse Error: invalid generated script",
            "ERROR: engine failure",
            "ordinary output\nERROR: late engine failure",
        ]:
            with self.subTest(message=message):
                result = subprocess.CompletedProcess(["godot"], 0, message + "\n")
                with (
                    mock.patch.object(verify, "REPORTS", reports),
                    mock.patch.object(verify, "execute_process", return_value=result),
                    contextlib.redirect_stdout(io.StringIO()),
                ):
                    with self.assertRaises(RuntimeError):
                        verify.run_phase("generated-probe", ["godot"], {})
                self.assertIn(message, (reports / "generated-probe.log").read_text())

    def test_typed_car_scaffold_keeps_signature_and_explicit_probe(self):
        files = self.plan(hooks=["neutral", "wear_car"])
        provider = files[mechanics.MECHANICS / "extension_probe_mechanic.gd"]
        self.assertIn("func neutral(sim: RaceSim, c: RaceCar) -> bool:", provider)
        self.assertIn(
            "func wear_car(sim: RaceSim, c: RaceCar, distance: float, cell: int, effects: Dictionary = {}, local: Dictionary = {}) -> void:",
            provider,
        )
        self.assertIn(
            "candidate.neutral(candidate.cars[3])",
            files[Path("tests/extensions/extension_probe_tests.gd")],
        )

    @unittest.skipUnless(
        os.environ.get("VERIFICATION_TEST_GODOT"),
        "Set VERIFICATION_TEST_GODOT for generated-code execution",
    )
    def test_generated_noop_loads_and_runs_in_real_godot(self):
        with tempfile.TemporaryDirectory(prefix="mechanic-generated-") as folder:
            project = Path(folder) / "project"
            shutil.copytree(
                mechanics.ROOT,
                project,
                ignore=shutil.ignore_patterns(".git", ".godot", "reports", "builds", "__pycache__"),
            )
            config = project / "project.godot"
            config.write_text(
                config.read_text().replace(
                    'config/name="Motorsport Manager"',
                    f'config/name="MechanicVerification-{uuid.uuid4().hex}"',
                )
            )
            (project / "reports").mkdir()
            (project / "reports/.gdignore").touch()
            mechanics.publish(
                project,
                mechanics.scaffold(
                    project,
                    "extension_probe",
                    ["step", "snapshot", "weather_advice", "neutral", "wear_car"],
                    "practice",
                ),
            )
            env = dict(
                os.environ,
                XDG_DATA_HOME=folder,
                APPDATA=folder,
                LOCALAPPDATA=folder,
                GODOT_SILENCE_ROOT_WARNING="1",
            )
            base = [os.environ["VERIFICATION_TEST_GODOT"], "--headless", "--path", str(project)]
            env.pop("MOTORSPORT_VERIFY_ROOT", None)
            # Same fail-closed log policy and owned-process cleanup as every other suite.
            with mock.patch.object(verify, "REPORTS", project / "reports"):
                for label, command in [
                    ("generated-import", base + ["--editor", "--quit"]),
                    (
                        "generated-run",
                        base + ["--script", "res://tests/extensions/extension_probe_tests.gd"],
                    ),
                ]:
                    verify.run_phase(label, command, env, timeout=120)
            report = json.loads((project / "reports/extension-extension_probe.json").read_text())
            self.assertTrue(report["passed"])
            self.assertEqual(report["checks"], 8)


if __name__ == "__main__":
    unittest.main(verbosity=2)
