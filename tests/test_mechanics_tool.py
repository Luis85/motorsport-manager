"""Mechanic authoring tool contract, rollback and real generated GDScript execution."""
from pathlib import Path
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest import mock
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import mechanics


class MechanicsToolTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.root = Path(self.folder.name) / 'project'
        for relative in [Path('scripts/domain/race_sim.gd'), mechanics.REGISTRY,
                         *[p.relative_to(mechanics.ROOT) for p in (mechanics.ROOT / mechanics.MECHANICS).glob('*.gd')]]:
            target = self.root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(mechanics.ROOT / relative, target)

    def plan(self, identity='extension_probe', hooks=None):
        return mechanics.scaffold(self.root, identity, hooks or ['forecast_parameters'], 'practice')

    def test_catalog_lists_supported_profiles_and_all_hooks(self):
        self.assertEqual({x['id'] for x in mechanics.catalog(self.root)}, {'strategy', 'weather', 'recovery', 'practice'})
        hooks = mechanics.hook_contracts(self.root)
        self.assertEqual(hooks['weather_advice'], ('id: int', 'Dictionary'))
        self.assertEqual(len(hooks), 62)

    def test_dry_plan_never_changes_project(self):
        before = {str(p): p.read_bytes() for p in self.root.rglob('*') if p.is_file()}
        self.plan()
        self.assertEqual(before, {str(p): p.read_bytes() for p in self.root.rglob('*') if p.is_file()})

    def test_scaffold_registers_test_but_does_not_enable_gameplay(self):
        profile_path = self.root / mechanics.MECHANICS / 'race_mechanic_profiles.gd'
        before = profile_path.read_bytes()
        files = self.plan(hooks=['step', 'weather_advice'])
        mechanics.publish(self.root, files)
        self.assertEqual(before, profile_path.read_bytes())
        provider = (self.root / mechanics.MECHANICS / 'extension_probe_mechanic.gd').read_text()
        self.assertIn('func step(sim: RaceSim) -> void:', provider)
        self.assertIn('func weather_advice(sim: RaceSim, id: int) -> Dictionary:', provider)
        self.assertIn('return sim.mechanics.before', provider)
        registry = json.loads((self.root / mechanics.REGISTRY).read_text())
        self.assertEqual(registry[-1]['id'], 'extension_extension_probe')

    def test_invalid_ids_hooks_and_profiles_are_rejected(self):
        for identity in ['../escape', '/tmp/x', 'With space', 'A', '', 'x' * 49, 'practice']:
            with self.assertRaises(ValueError):
                self.plan(identity)
        for hooks in [['unknown'], ['step', 'step']]:
            with self.assertRaises(ValueError):
                self.plan(hooks=hooks)
        with self.assertRaises(ValueError):
            mechanics.scaffold(self.root, 'probe', ['step'], 'unknown')

    def test_existing_target_is_not_overwritten(self):
        files = self.plan()
        test = self.root / 'tests/extensions/extension_probe_tests.gd'
        test.parent.mkdir(parents=True)
        test.write_text('user work')
        with self.assertRaises(ValueError):
            mechanics.publish(self.root, files)
        self.assertEqual(test.read_text(), 'user work')
        self.assertFalse((self.root / mechanics.MECHANICS / 'extension_probe_mechanic.gd').exists())

    def test_failed_write_rolls_back_created_files_and_preserves_registry(self):
        files = self.plan()
        before = (self.root / mechanics.REGISTRY).read_bytes()
        replace = os.replace
        calls = []
        def fail_second(source, target):
            calls.append(target)
            if len(calls) == 2:
                raise OSError('injected second write failure')
            replace(source, target)
        with mock.patch.object(mechanics.os, 'replace', side_effect=fail_second):
            with self.assertRaises(OSError):
                mechanics.publish(self.root, files)
        self.assertEqual(before, (self.root / mechanics.REGISTRY).read_bytes())
        for path in files:
            if path != mechanics.REGISTRY:
                self.assertFalse((self.root / path).exists())

    def test_symlink_escape_is_rejected(self):
        with tempfile.TemporaryDirectory() as external:
            (self.root / 'tests').symlink_to(external, target_is_directory=True)
            with self.assertRaises(ValueError):
                mechanics.publish(self.root, self.plan())
            self.assertEqual(list(Path(external).iterdir()), [])

    @unittest.skipUnless(os.environ.get('VERIFICATION_TEST_GODOT'), 'Set VERIFICATION_TEST_GODOT for generated-code execution')
    def test_generated_noop_loads_and_runs_in_real_godot(self):
        with tempfile.TemporaryDirectory(prefix='mechanic-generated-') as folder:
            project = Path(folder) / 'project'
            shutil.copytree(mechanics.ROOT, project, ignore=shutil.ignore_patterns('.git', '.godot', 'reports', 'builds', '__pycache__'))
            config = project / 'project.godot'
            config.write_text(config.read_text().replace('config/name="Motorsport Manager"', f'config/name="MechanicVerification-{uuid.uuid4().hex}"'))
            (project / 'reports').mkdir()
            (project / 'reports/.gdignore').touch()
            mechanics.publish(project, mechanics.scaffold(project, 'extension_probe', ['step', 'snapshot', 'weather_advice'], 'practice'))
            env = dict(os.environ, XDG_DATA_HOME=folder, APPDATA=folder, LOCALAPPDATA=folder, GODOT_SILENCE_ROOT_WARNING='1')
            base = [os.environ['VERIFICATION_TEST_GODOT'], '--headless', '--path', str(project)]
            for command in [base + ['--editor', '--quit'], base + ['--script', 'res://tests/extensions/extension_probe_tests.gd']]:
                result = subprocess.run(command, env=env, capture_output=True, text=True, timeout=120)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertNotIn('SCRIPT ERROR', result.stdout + result.stderr)
            report = json.loads((project / 'reports/extension-extension_probe.json').read_text())
            self.assertTrue(report['passed'])
            self.assertEqual(report['checks'], 6)


if __name__ == '__main__':
    unittest.main(verbosity=2)
