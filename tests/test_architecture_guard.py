"""Adversarial fixtures for the architectural guard; no changes to production files."""
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from check_architecture import inspect

class ArchitectureGuardTests(unittest.TestCase):
    def scan(self, source: str, path='scripts/domain/probe.gd'):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            files = {'scripts/ui/widget.gd': 'class_name Widget\nextends Control\n',
                     'scripts/services/store.gd': 'class_name Store\nextends RefCounted\n', path: source}
            for name, text in files.items():
                file = root / name
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_text(text)
            return inspect(root)[0]

    def test_global_class_dependency(self):
        self.assertIn('dependency-direction', [v.rule for v in self.scan('extends RefCounted\nvar value = Widget.new()')])

    def test_preload_and_extends_paths(self):
        for expression in ['extends "res://scripts/ui/widget.gd"', 'const UI = preload("res://scripts/ui/widget.gd")']:
            self.assertIn('literal-dependency', [v.rule for v in self.scan(expression)])

    def test_no_false_edges_from_documentation(self):
        self.assertEqual([], self.scan('extends RefCounted\n# Widget.new()\nvar copy = "Store App Time Node"\n'))

    def test_domain_io_and_clock(self):
        self.assertIn('domain-engine-authority', [v.rule for v in self.scan('func run():\n\tFileAccess.open("a",1)')])
        self.assertIn('domain-wall-clock', [v.rule for v in self.scan('func run():\n\tTime.get_ticks_usec()')])

    def test_domain_compilers_have_no_wall_clock_exception(self):
        path = 'scripts/domain/track_geometry.gd'
        self.assertIn('domain-wall-clock', [v.rule for v in self.scan('func compile():\n\tTime.get_ticks_usec()', path)])
        self.assertIn('domain-wall-clock', [v.rule for v in self.scan('func step():\n\tTime.get_ticks_usec()', path)])

    def test_ui_cannot_advance(self):
        self.assertIn('ui-drives-simulation', [v.rule for v in self.scan('func _process(d):\n\tsim.advance(d)', 'scripts/ui/probe.gd')])

    def test_renderer_cannot_retain_aggregate(self):
        self.assertIn('detached-renderer', [v.rule for v in self.scan('var model: RaceSim', 'scripts/ui/track_canvas.gd')])

    def test_ui_cannot_retain_extracted_race_authority_layers(self):
        for name in ['RaceSimPort', 'RaceSimFoundation', 'RaceSimCore', 'RaceSimOperations']:
            self.assertIn('detached-renderer',
                          [v.rule for v in self.scan('var model: ' + name, 'scripts/ui/probe.gd')])

    def test_every_presentation_component_has_the_detached_boundary(self):
        for name in ["editor", "weekend", "scenario_author", "new_instrument"]:
            self.assertIn('detached-renderer', [v.rule for v in self.scan('var model: RaceSim', f'scripts/ui/{name}.gd')])
        self.assertIn('presentation-private-authority', [v.rule for v in self.scan('func render():\n\tquery._source.get_ref()', 'scripts/ui/new_instrument.gd')])

    def test_ui_cannot_retain_schedulers_or_composition_bindings(self):
        for name in ['TrackReferencePreview', 'RaceCar', 'RaceSessionRunner', 'ReplayPlayback', 'RaceViewSession', 'MinimalRaceSession', 'ReplaySessionBinding']:
            self.assertIn('detached-renderer', [v.rule for v in self.scan('var model: ' + name, 'scripts/ui/probe.gd')])
        for name in ['_runner', '_playback']:
            self.assertIn('presentation-private-authority', [v.rule for v in self.scan('func render():\n\tquery.' + name + '.get_ref()', 'scripts/ui/probe.gd')])

    def test_dynamic_load_rejected_inward(self):
        self.assertIn('dynamic-load', [v.rule for v in self.scan('func build(path):\n\treturn load(path)')])

    def test_application_no_infrastructure_dependency(self):
        self.assertIn('dependency-direction', [v.rule for v in self.scan('var storage = Store.new()', 'scripts/application/probe.gd')])

    def test_editor_cannot_read_files_or_compile_authority(self):
        for token in ['App', 'Storage', 'FileAccess', 'ReplayStorage']:
            self.assertTrue(self.scan('var value = ' + token, 'scripts/ui/editor.gd'))
        self.assertIn('editor-owns-compilation', [v.rule for v in self.scan('func draw():\n\tTrackGeometry.new({})', 'scripts/ui/track_canvas.gd')])

    def test_literal_alias_cannot_bypass_presentation_authority(self):
        for authority, target in [('RaceSim', 'scripts/domain/race_sim.gd'),
                                  ('RaceCar', 'scripts/domain/race_car.gd'),
                                  ('RaceSessionRunner', 'scripts/application/runner.gd')]:
            for expression in [f'const Alias = preload("res://{target}")',
                               f'extends "res://{target}"']:
                with tempfile.TemporaryDirectory() as folder:
                    root = Path(folder)
                    for name, text in {target: f'class_name {authority}\nextends RefCounted\n',
                                       'scripts/ui/probe.gd': expression}.items():
                        path = root / name
                        path.parent.mkdir(parents=True, exist_ok=True)
                        path.write_text(text)
                    self.assertIn('detached-renderer', [v.rule for v in inspect(root)[0]])

    def test_literal_pure_value_dependency_still_allowed(self):
        self.assertEqual([], self.scan('const Value = preload("res://scripts/domain/value.gd")',
                                       'scripts/ui/probe.gd'))

    def test_hook_manifest_rejects_missing_extra_and_duplicate_entries(self):
        for hooks, invalid in [('"step"', False), ('', True), ('"step", "helper"', True), ('"step", "step"', True)]:
            with tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                domain = root / 'scripts/domain'
                (domain / 'mechanics').mkdir(parents=True)
                (domain / 'race_sim.gd').write_text('class_name RaceSim\nfunc step():\n\tmechanics.invoke("step", [])\n')
                (domain / 'mechanics/race_hook_contract.gd').write_text('class_name RaceHookContract\nconst HOOKS: Array[String] = [' + hooks + ']\n')
                rules = [v.rule for v in inspect(root)[0]]
                self.assertEqual('mechanic-hook-contract' in rules, invalid)

if __name__ == '__main__':
    unittest.main(verbosity=2)
