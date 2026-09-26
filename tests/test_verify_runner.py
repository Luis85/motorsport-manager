"""Regression for native suites leaking saved settings into subsequent suites.

Run with VERIFICATION_TEST_GODOT=/absolute/pinned/Godot to include the real
Godot user:// resolver check. No user application directory is touched.
"""
from __future__ import annotations
import contextlib
import io
import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('verification_runner', Path(__file__).resolve().parents[1] / 'scripts/verify.py')
verify = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(verify)

class RunnerIsolationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='runner-isolation-regression-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.project = self.root / 'project'; self.project.mkdir()
        self.config = self.project / 'project.godot'
        self.config.write_text('config_version=5\n[application]\nconfig/name="MotorsportManagerVerification-probe"\n')
        self.reports = self.root / 'reports'; self.reports.mkdir()
        self.patch = patch.object(verify, 'REPORTS', self.reports); self.patch.start(); self.addCleanup(self.patch.stop)
        self.env = dict(os.environ, GODOT_SILENCE_ROOT_WARNING="1", MOTORSPORT_VERIFY_ROOT=str(self.root), XDG_DATA_HOME=str(self.root / 'shared'), APPDATA=str(self.root / 'shared'))
        self.command = ['godot', '--path', str(self.project), '--headless']

    def test_each_phase_has_its_own_user_directory_and_application_name(self):
        seen = []
        def engine(command, **kwargs):
            env = kwargs['env']; folder = Path(env['XDG_DATA_HOME']); folder.mkdir(parents=True, exist_ok=True)
            self.assertFalse((folder / 'settings.json').exists(), 'Previous suite settings leaked into this suite')
            (folder / 'settings.json').write_text('{"pitwall_text_scale":1.3}')
            seen.append((folder, self.config.read_text(), env['APPDATA']))
            return subprocess.CompletedProcess(command, 0, 'pass\n')
        with patch.object(verify.subprocess, 'run', side_effect=engine):
            verify.run_phase('guide', self.command, self.env)
            verify.run_phase('compact', self.command, self.env)
        self.assertNotEqual(seen[0][0], seen[1][0])
        self.assertNotEqual(seen[0][1], seen[1][1], 'OS resolvers ignoring XDG still need unique application names')
        self.assertNotEqual(seen[0][2], seen[1][2])
        self.assertTrue((seen[0][0] / 'settings.json').exists(), 'Isolation must not delete preceding evidence')
        self.assertEqual(self.env['XDG_DATA_HOME'], str(self.root / 'shared'), 'Caller environment remains unchanged')

    def test_repeated_phase_gets_fresh_identity(self):
        names = []
        def engine(command, **_kwargs):
            names.append(self.config.read_text()); return subprocess.CompletedProcess(command, 0, '')
        with patch.object(verify.subprocess, 'run', side_effect=engine):
            verify.run_phase('probe', self.command, self.env)
            verify.run_phase('probe', self.command, self.env)
        self.assertNotEqual(names[0], names[1])

    def test_refuses_to_rename_a_production_project(self):
        self.config.write_text('config_version=5\n[application]\nconfig/name="Motorsport Manager"\n')
        before = self.config.read_bytes()
        with patch.object(verify.subprocess, 'run', return_value=subprocess.CompletedProcess(self.command, 0, '')) as engine:
            with self.assertRaises(RuntimeError): verify.run_phase('probe', self.command, self.env)
            engine.assert_not_called()
        self.assertEqual(before, self.config.read_bytes())

    def test_zero_exit_with_runtime_error_is_not_a_pass(self):
        result = subprocess.CompletedProcess(self.command, 0, 'SCRIPT ERROR: deliberately failing test\n')
        with patch.object(verify.subprocess, 'run', return_value=result), contextlib.redirect_stdout(io.StringIO()):
            with self.assertRaises(RuntimeError): verify.run_phase('broken', self.command, self.env)
        self.assertIn('SCRIPT ERROR:', (self.reports / 'broken.log').read_text())

    @unittest.skipUnless(os.environ.get('VERIFICATION_TEST_GODOT'), 'Pinned native runtime not supplied')
    def test_native_godot_resolver_does_not_reuse_another_suites_settings(self):
        (self.project / 'probe.gd').write_text('''extends SceneTree
func _initialize() -> void:
    var write = OS.get_cmdline_user_args().has("write")
    var exists = FileAccess.file_exists("user://settings.json")
    print("USER_DIRECTORY ", OS.get_user_data_dir())
    if write:
        var file = FileAccess.open("user://settings.json", FileAccess.WRITE)
        file.store_string('{"pitwall_text_scale":1.3}')
    elif exists:
        push_error("A preceding native test's saved text scale contaminated this suite")
    quit(1 if exists else 0)
''')
        cmd = [os.environ['VERIFICATION_TEST_GODOT'], '--path', str(self.project), '--headless', '--script', 'res://probe.gd']
        verify.run_phase('native-write', cmd + ['--', 'write'], self.env)
        verify.run_phase('native-read', cmd, self.env)

if __name__ == '__main__': unittest.main(verbosity=2)
