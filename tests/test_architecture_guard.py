"""Adversarial fixtures for the architectural guard; no changes to production files."""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from check_architecture import inspect


class ArchitectureGuardTests(unittest.TestCase):
    def scan(self, source: str, path="scripts/domain/probe.gd"):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            files = {
                "scripts/ui/widget.gd": "class_name Widget\nextends Control\n",
                "scripts/services/store.gd": "class_name Store\nextends RefCounted\n",
                path: source,
            }
            for name, text in files.items():
                file = root / name
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_text(text)
            return inspect(root)[0]

    def test_global_class_dependency(self):
        self.assertIn(
            "dependency-direction",
            [v.rule for v in self.scan("extends RefCounted\nvar value = Widget.new()")],
        )

    def test_preload_and_extends_paths(self):
        for expression in [
            'extends "res://scripts/ui/widget.gd"',
            'const UI = preload("res://scripts/ui/widget.gd")',
        ]:
            self.assertIn("literal-dependency", [v.rule for v in self.scan(expression)])

    def test_script_path_aliases_cannot_change_the_declared_dependency_layer(self):
        for path in (
            "res://scripts/domain/../ui/widget.gd",
            "res://scripts/domain/./../ui/widget.gd",
            "res://scripts//ui/widget.gd",
            "scripts/domain/value.gd",
            "user://scripts/domain/value.gd",
        ):
            for owner in ("domain", "application", "ui"):
                for expression in (f'load("{path}")', f'preload("{path}")'):
                    with self.subTest(path=path, owner=owner, expression=expression):
                        self.assertIn(
                            "unbounded-script-path",
                            [v.rule for v in self.scan(expression, f"scripts/{owner}/probe.gd")],
                        )

    def test_no_false_edges_from_documentation(self):
        self.assertEqual(
            [], self.scan('extends RefCounted\n# Widget.new()\nvar copy = "Store App Time Node"\n')
        )

    def test_domain_io_and_clock(self):
        self.assertIn(
            "domain-engine-authority",
            [v.rule for v in self.scan('func run():\n\tFileAccess.open("a",1)')],
        )
        self.assertIn(
            "domain-wall-clock", [v.rule for v in self.scan("func run():\n\tTime.get_ticks_usec()")]
        )

    def test_domain_static_factory_cannot_construct_engine_nodes_indirectly(self):
        source = (
            "extends RefCounted\nstatic func create() -> Object:\n"
            '\treturn ClassDB.instantiate("Node")\n'
        )
        self.assertIn("domain-engine-authority", [v.rule for v in self.scan(source)])
        self.assertEqual([], self.scan(source, "scripts/composition/native_factory.gd"))
        self.assertEqual(
            [],
            self.scan(
                'extends RefCounted\n# ClassDB.instantiate("Node")\n'
                'var example = "ClassDB.instantiate(\\"Node\\")"\n'
            ),
        )

    def test_domain_compilers_have_no_wall_clock_exception(self):
        path = "scripts/domain/track_geometry.gd"
        self.assertIn(
            "domain-wall-clock",
            [v.rule for v in self.scan("func compile():\n\tTime.get_ticks_usec()", path)],
        )
        self.assertIn(
            "domain-wall-clock",
            [v.rule for v in self.scan("func step():\n\tTime.get_ticks_usec()", path)],
        )

    def test_ui_cannot_advance(self):
        self.assertIn(
            "ui-drives-simulation",
            [
                v.rule
                for v in self.scan("func _process(d):\n\tsim.advance(d)", "scripts/ui/probe.gd")
            ],
        )

    def test_renderer_cannot_retain_aggregate(self):
        self.assertIn(
            "detached-renderer",
            [v.rule for v in self.scan("var model: RaceSim", "scripts/ui/track_canvas.gd")],
        )

    def test_ui_cannot_retain_extracted_race_authority_layers(self):
        for name in ["RaceSimPort", "RaceSimFoundation", "RaceSimCore", "RaceSimOperations"]:
            self.assertIn(
                "detached-renderer",
                [v.rule for v in self.scan("var model: " + name, "scripts/ui/probe.gd")],
            )

    def test_every_presentation_component_has_the_detached_boundary(self):
        for name in ["editor", "weekend", "scenario_author", "new_instrument"]:
            self.assertIn(
                "detached-renderer",
                [v.rule for v in self.scan("var model: RaceSim", f"scripts/ui/{name}.gd")],
            )
        self.assertIn(
            "presentation-private-authority",
            [
                v.rule
                for v in self.scan(
                    "func render():\n\tquery._source.get_ref()", "scripts/ui/new_instrument.gd"
                )
            ],
        )

    def test_ui_cannot_retain_schedulers_or_composition_bindings(self):
        for name in [
            "TrackReferencePreview",
            "RaceCar",
            "RaceSessionRunner",
            "ReplayPlayback",
            "RaceViewSession",
            "MinimalRaceSession",
            "ReplaySessionBinding",
        ]:
            self.assertIn(
                "detached-renderer",
                [v.rule for v in self.scan("var model: " + name, "scripts/ui/probe.gd")],
            )
        for name in ["_runner", "_playback"]:
            self.assertIn(
                "presentation-private-authority",
                [
                    v.rule
                    for v in self.scan(
                        "func render():\n\tquery." + name + ".get_ref()", "scripts/ui/probe.gd"
                    )
                ],
            )

    def test_dynamic_load_rejected_inward(self):
        self.assertIn(
            "dynamic-load", [v.rule for v in self.scan("func build(path):\n\treturn load(path)")]
        )

    def test_literal_prefix_does_not_disguise_a_computed_load_argument(self):
        for layer in ("domain", "application"):
            for argument in (
                '"res://" + path',
                '"res://%s" % path',
                '"res://" + "scripts/ui/widget.gd"',
            ):
                source = f"extends RefCounted\nfunc build(path):\n\treturn load({argument})\n"
                with self.subTest(layer=layer, argument=argument):
                    self.assertIn(
                        "dynamic-load",
                        [v.rule for v in self.scan(source, f"scripts/{layer}/probe.gd")],
                    )

    def test_complete_literal_load_allows_native_whitespace_comments_and_trailing_comma(self):
        for trailing in ("", ",", " # bound dependency\n", ", # bound dependency\n"):
            source = (
                "extends RefCounted\nfunc build():\n"
                f'\treturn load("res://scripts/domain/value.gd"{trailing})\n'
            )
            with self.subTest(trailing=trailing):
                self.assertEqual([], self.scan(source))

    def test_application_no_infrastructure_dependency(self):
        self.assertIn(
            "dependency-direction",
            [
                v.rule
                for v in self.scan("var storage = Store.new()", "scripts/application/probe.gd")
            ],
        )

    def test_editor_cannot_read_files_or_compile_authority(self):
        for token in ["App", "Storage", "FileAccess", "ReplayStorage"]:
            self.assertTrue(self.scan("var value = " + token, "scripts/ui/editor.gd"))
        self.assertIn(
            "editor-owns-compilation",
            [
                v.rule
                for v in self.scan(
                    "func draw():\n\tTrackGeometry.new({})", "scripts/ui/track_canvas.gd"
                )
            ],
        )

    def test_literal_alias_cannot_bypass_presentation_authority(self):
        for authority, target in [
            ("RaceSim", "scripts/domain/race_sim.gd"),
            ("RaceCar", "scripts/domain/race_car.gd"),
            ("RaceSessionRunner", "scripts/application/runner.gd"),
        ]:
            for expression in [
                f'const Alias = preload("res://{target}")',
                f'extends "res://{target}"',
            ]:
                with tempfile.TemporaryDirectory() as folder:
                    root = Path(folder)
                    for name, text in {
                        target: f"class_name {authority}\nextends RefCounted\n",
                        "scripts/ui/probe.gd": expression,
                    }.items():
                        path = root / name
                        path.parent.mkdir(parents=True, exist_ok=True)
                        path.write_text(text)
                    self.assertIn("detached-renderer", [v.rule for v in inspect(root)[0]])

    def test_literal_pure_value_dependency_still_allowed(self):
        self.assertEqual(
            [],
            self.scan(
                'const Value = preload("res://scripts/domain/value.gd")', "scripts/ui/probe.gd"
            ),
        )

    def test_hook_manifest_rejects_missing_extra_and_duplicate_entries(self):
        for hooks, invalid in [
            ('"step"', False),
            ("", True),
            ('"step", "helper"', True),
            ('"step", "step"', True),
        ]:
            with tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                domain = root / "scripts/domain"
                (domain / "mechanics").mkdir(parents=True)
                (domain / "race_sim.gd").write_text(
                    'class_name RaceSim\nfunc step():\n\tmechanics.invoke("step", [])\n'
                )
                (domain / "mechanics/race_hook_contract.gd").write_text(
                    "class_name RaceHookContract\nconst HOOKS: Array[String] = [" + hooks + "]\n"
                )
                rules = [v.rule for v in inspect(root)[0]]
                self.assertEqual("mechanic-hook-contract" in rules, invalid)


class ToolboxArchitectureTests(unittest.TestCase):
    """Developer command facets cannot become a presentation query shortcut."""

    AUTHORITIES = {
        "GameToolbox": "scripts/application/toolbox/game_toolbox.gd",
        "DeveloperWeekends": "scripts/application/toolbox/developer_weekends.gd",
        "DeveloperWeekendSession": "scripts/application/toolbox/developer_weekend_session.gd",
        "DeveloperWeekendDispatch": "scripts/application/toolbox/developer_weekend_dispatch.gd",
        "CampaignWeekendWorkflow": "scripts/application/campaign/weekend_workflow.gd",
        "DeveloperCampaignSnapshots": "scripts/application/toolbox/developer_campaign_snapshots.gd",
        "RecordedWeekendContinuation": "scripts/application/replay/recorded_weekend_continuation.gd",
        "DeveloperCampaigns": "scripts/application/toolbox/developer_campaigns.gd",
        "DeveloperTracks": "scripts/application/toolbox/developer_tracks.gd",
        "GameToolboxFactory": "scripts/services/toolbox/factory.gd",
    }

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        for name, path in self.AUTHORITIES.items():
            self.write(path, f"class_name {name}\nextends RefCounted\n")

    def write(self, path, source):
        target = self.root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(source)

    def scan_consumer(self, source, path="scripts/ui/probe.gd"):
        self.write(path, source)
        return [error for error in inspect(self.root)[0] if error.path == path]

    def test_ui_cannot_retain_command_facets_even_for_query_only_use(self):
        for authority in self.AUTHORITIES:
            source = (
                f"var port: {authority}\nfunc refresh():\n"
                '\treturn port.query("session", "state", {})\n'
            )
            with self.subTest(authority=authority):
                self.assertIn("detached-renderer", [v.rule for v in self.scan_consumer(source)])

    def test_ui_cannot_advance_injected_weekend_lifetime_owner(self):
        source = (
            "var owner: DeveloperWeekendSession\nfunc refresh():\n\treturn owner.step_ticks(1)\n"
        )
        self.assertIn("detached-renderer", [v.rule for v in self.scan_consumer(source)])

    def test_ui_cannot_construct_live_campaign_weekend_or_dispatch_commands(self):
        for source in (
            "func depart(checkpoint):\n\treturn CampaignWeekendWorkflow.depart(checkpoint)\n",
            "func execute(port):\n\treturn DeveloperWeekendDispatch.execute(\n"
            '\t\tport, "weekend.step_ticks", "session", {"count": 1})\n',
        ):
            with self.subTest(source=source):
                self.assertIn("detached-renderer", [v.rule for v in self.scan_consumer(source)])

    def test_ui_cannot_reconstruct_and_advance_live_recorded_weekends(self):
        for helper, method in (
            ("DeveloperCampaignSnapshots", "prepare"),
            ("RecordedWeekendContinuation", "restore_session"),
        ):
            source = (
                "func restore(snapshot):\n"
                f"\tvar world = {helper}.{method}(snapshot)\n"
                '\tworld.get("weekend", world).get("simulation", world.get("sim")).step()\n'
            )
            with self.subTest(helper=helper):
                self.assertIn("detached-renderer", [v.rule for v in self.scan_consumer(source)])
                self.assertEqual([], self.scan_consumer(source, "scripts/composition/tools.gd"))

    def test_detached_campaign_candidate_transforms_remain_available(self):
        for name in (
            "DeveloperCampaignPlanning",
            "DeveloperCampaignManagementActions",
            "DeveloperCampaignOrganizationActions",
            "DeveloperCampaignSeasonActions",
            "DeveloperTrackEdits",
        ):
            self.write(
                f"scripts/application/toolbox/{name}.gd",
                f"class_name {name}\nextends RefCounted\n",
            )
            source = f"func candidate(value, action, payload):\n\treturn {name}.apply(value, action, payload)\n"
            with self.subTest(name=name):
                self.assertEqual([], self.scan_consumer(source))

    def test_named_subclasses_cannot_hide_live_toolbox_authority(self):
        for authority in self.AUTHORITIES:
            self.write(
                "scripts/application/toolbox/alias.gd",
                f"class_name HiddenPort extends {authority}\n",
            )
            with self.subTest(authority=authority):
                self.assertIn(
                    "detached-renderer",
                    [v.rule for v in self.scan_consumer("var live = HiddenPort.new()\n")],
                )

    def test_literal_aliases_and_inheritance_cannot_hide_toolbox_authority(self):
        for authority, target in self.AUTHORITIES.items():
            for source in (
                f'const Hidden = preload("res://{target}")\n',
                f'extends "res://{target}"\n',
            ):
                with self.subTest(authority=authority, source=source):
                    self.assertIn("detached-renderer", [v.rule for v in self.scan_consumer(source)])

    def test_ui_cannot_construct_the_service_factory(self):
        violations = self.scan_consumer("var factory = GameToolboxFactory.new()\n")
        self.assertIn("dependency-direction", [v.rule for v in violations])
        self.assertIn("detached-renderer", [v.rule for v in violations])

    def test_composition_may_own_developer_command_facets(self):
        source = "\n".join(
            f"var port_{index}: {name}" for index, name in enumerate(self.AUTHORITIES)
        )
        self.assertEqual([], self.scan_consumer(source, "scripts/composition/tools.gd"))

    def test_detached_queries_and_value_helpers_remain_available_to_ui(self):
        names = (
            "RaceViewHandle",
            "RaceViewQuery",
            "CampaignFinanceQuery",
            "DeveloperToolResult",
            "DeveloperWeekendQueries",
            "DeveloperWeekendPlanningQueries",
            "DeveloperCatalogQueries",
        )
        for name in names:
            self.write(f"scripts/application/{name}.gd", f"class_name {name}\nextends RefCounted\n")
        source = "\n".join(f"var query_{index}: {name}" for index, name in enumerate(names))
        self.assertEqual([], self.scan_consumer(source))

    def test_documentation_does_not_create_command_authority_edges(self):
        names = " ".join(self.AUTHORITIES)
        self.assertEqual(
            [], self.scan_consumer(f'extends Control\n# {names}\nvar help = "{names}"\n')
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
