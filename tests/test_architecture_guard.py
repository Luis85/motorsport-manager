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

    def test_clock_exception_is_function_scoped(self):
        path = 'scripts/domain/track_geometry.gd'
        self.assertEqual([], self.scan('func compile():\n\tTime.get_ticks_usec()', path))
        self.assertIn('domain-wall-clock', [v.rule for v in self.scan('func step():\n\tTime.get_ticks_usec()', path)])

    def test_ui_cannot_advance(self):
        self.assertIn('ui-drives-simulation', [v.rule for v in self.scan('func _process(d):\n\tsim.advance(d)', 'scripts/ui/probe.gd')])

    def test_renderer_cannot_retain_aggregate(self):
        self.assertIn('detached-renderer', [v.rule for v in self.scan('var model: RaceSim', 'scripts/ui/track_canvas.gd')])

    def test_dynamic_load_rejected_inward(self):
        self.assertIn('dynamic-load', [v.rule for v in self.scan('func build(path):\n\treturn load(path)')])

    def test_application_no_infrastructure_dependency(self):
        self.assertIn('dependency-direction', [v.rule for v in self.scan('var storage = Store.new()', 'scripts/application/probe.gd')])

if __name__ == '__main__':
    unittest.main(verbosity=2)
