"""Ordered pack selection, transaction failures and real compiler integration."""

from __future__ import annotations

import contextlib
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))
import content_operations

import content


class MultiPackTests(unittest.TestCase):
    def test_dependency_order_and_implicit_core_are_preserved(self):
        core = content.ROOT / "content/packs/core"
        result = content.pack_arguments(Path("last"), [core, Path("first"), Path("second")])
        self.assertEqual(
            result, ["--pack=" + str(Path(name).resolve()) for name in ["first", "second", "last"]]
        )
        self.assertEqual(content.pack_arguments(core), [])

    def test_aliases_are_not_silently_loaded_twice(self):
        with self.assertRaisesRegex(ValueError, "more than once"):
            content.pack_arguments(Path("same"), [Path("./same")])

    def test_read_commands_forward_every_selected_pack(self):
        for command in ["validate", "inspect", "list", "export", "test"]:
            with self.subTest(command=command), tempfile.TemporaryDirectory() as temporary:
                argv = [command, "child", "--pack", "dependency-a", "--pack", "dependency-b"]
                if command == "inspect":
                    argv += ["--id", "child.vehicle.one"]
                elif command == "export":
                    argv += ["--output", str(Path(temporary) / "snapshot.json")]
                elif command == "test":
                    argv += ["--scenario", "child.scenario.one"]
                result = {"ok": True, "definitions": [], "kinds": [], "snapshot": {"records": {}}}
                with (
                    patch.object(content, "invoke_engine", return_value=result) as invoke,
                    contextlib.redirect_stdout(io.StringIO()),
                ):
                    self.assertEqual(content.main(argv), 0)
                selected = [x for x in invoke.call_args.args[0] if x.startswith("--pack=")]
                self.assertEqual(
                    selected,
                    content.pack_arguments(
                        Path("child"), [Path("dependency-a"), Path("dependency-b")]
                    ),
                )

    def test_diff_supports_common_and_side_specific_dependencies(self):
        result = {"ok": True, "snapshot": {"records": {}}}
        with (
            patch.object(content, "invoke_engine", return_value=result) as invoke,
            contextlib.redirect_stdout(io.StringIO()),
        ):
            self.assertEqual(
                content.main(
                    [
                        "diff",
                        "old",
                        "new",
                        "--pack",
                        "common",
                        "--before-pack",
                        "old-base",
                        "--after-pack",
                        "new-base",
                    ]
                ),
                0,
            )
        calls = [call.args[0] for call in invoke.call_args_list]
        self.assertEqual(
            calls[0],
            [
                "--action=export",
                *content.pack_arguments(Path("old"), [Path("common"), Path("old-base")]),
            ],
        )
        self.assertEqual(
            calls[1],
            [
                "--action=export",
                *content.pack_arguments(Path("new"), [Path("common"), Path("new-base")]),
            ],
        )

    def test_clone_forwards_dependencies_before_its_destination(self):
        with tempfile.TemporaryDirectory() as temporary:
            pack = Path(temporary) / "child"
            content.initialize(pack, "child")
            result = {
                "ok": True,
                "definitions": [],
                "inspection": {"definition": {"kind": "vehicle", "id": "base.vehicle.one"}},
            }
            with patch.object(content, "invoke_engine", return_value=result) as invoke:
                content.clone_definition(
                    pack, "base.vehicle.one", "child.vehicle.copy", None, [Path("base")]
                )
            self.assertEqual(
                invoke.call_args.args[0][2:], content.pack_arguments(pack, [Path("base")])
            )
            self.assertTrue((pack / "vehicles/child.vehicle.copy.json").is_file())

    def test_clone_rejects_a_manifest_modified_during_validation(self):
        with tempfile.TemporaryDirectory() as temporary:
            pack = Path(temporary) / "child"
            content.initialize(pack, "child")
            manifest = pack / "pack.json"
            changed = json.loads(manifest.read_text())
            changed["version"] = "2.0.0"

            def validate(*_):
                self.assertTrue((pack / ".content-author.lock").exists())
                manifest.write_text(content.encode(changed))
                return {
                    "ok": True,
                    "definitions": [],
                    "inspection": {"definition": {"kind": "vehicle"}},
                }

            with patch.object(content, "invoke_engine", side_effect=validate):
                with self.assertRaisesRegex(ValueError, "changed during validation"):
                    content.clone_definition(pack, "core.vehicle.gt", "child.vehicle.copy", None)
            self.assertEqual(json.loads(manifest.read_text()), changed)
            self.assertEqual(sorted(p.name for p in pack.iterdir()), ["pack.json"])

    def test_clone_failed_validation_cleans_its_lock_without_creating_a_directory(self):
        with tempfile.TemporaryDirectory() as temporary:
            pack = Path(temporary) / "child"
            content.initialize(pack, "child")
            with patch.object(content, "invoke_engine", return_value={"ok": False}):
                self.assertFalse(
                    content.clone_definition(pack, "missing.item", "child.vehicle.copy", None)["ok"]
                )
            self.assertEqual([p.name for p in pack.iterdir()], ["pack.json"])

    def test_cooperating_writer_lock_is_never_removed_by_a_failed_acquisition(self):
        with tempfile.TemporaryDirectory() as temporary:
            pack = Path(temporary) / "child"
            content.initialize(pack, "child")
            lock = pack / ".content-author.lock"
            lock.write_text("owner")
            with patch.object(content, "invoke_engine") as invoke:
                with self.assertRaises(FileExistsError):
                    content.clone_definition(pack, "core.vehicle.gt", "child.vehicle.copy", None)
            invoke.assert_not_called()
            self.assertEqual(lock.read_text(), "owner")

    def test_schema_check_has_no_directory_side_effects(self):
        with (
            tempfile.TemporaryDirectory() as temporary,
            patch.object(content, "ROOT", Path(temporary)),
            patch.object(
                content, "invoke_engine", return_value={"ok": True, "schemas": {"vehicle": {}}}
            ),
        ):
            self.assertFalse(content.schemas(None, True)["ok"])
            self.assertEqual(list(Path(temporary).iterdir()), [])

    def test_ids_match_the_production_length_bound(self):
        with tempfile.TemporaryDirectory() as temporary:
            pack = Path(temporary) / "child"
            with self.assertRaises(ValueError):
                content.initialize(pack, "a" * 97)
            self.assertFalse(pack.exists())
            with self.assertRaises(ValueError):
                content.clone_definition(pack, "core.vehicle.gt", "child." + "a" * 97, None)

    def test_invalid_serialization_never_creates_a_file(self):
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary) / "new.json"
            for writer in [content.write_new, content_operations.export_snapshot]:
                with self.subTest(writer=writer.__name__), self.assertRaises(ValueError):
                    writer(target, {"bad": float("nan")})
                self.assertEqual(list(Path(temporary).iterdir()), [])

    def test_export_write_failure_leaves_no_partial_destination_or_temporary(self):
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary) / "snapshot.json"
            with patch.object(content_operations.os, "fsync", side_effect=OSError("disk full")):
                with self.assertRaises(OSError):
                    content_operations.export_snapshot(target, {"records": {}})
            self.assertEqual(list(Path(temporary).iterdir()), [])

    def test_export_does_not_replace_a_destination_created_during_publication(self):
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary) / "snapshot.json"
            link = os.link

            def concurrent(source, destination):
                target.write_text("other author")
                link(source, destination)

            with patch.object(content_operations.os, "link", side_effect=concurrent):
                with self.assertRaises(FileExistsError):
                    content_operations.export_snapshot(target, {"records": {}})
            self.assertEqual(target.read_text(), "other author")
            self.assertEqual(list(Path(temporary).iterdir()), [target])

    def test_diff_does_not_equate_nested_booleans_with_numbers(self):
        for before, after in [(True, 1), ({"v": False}, {"v": 0}), ([{"v": True}], [{"v": 1.0}])]:
            self.assertTrue(content_operations.difference(before, after))
        self.assertEqual(content_operations.difference({"v": [1, 2.0]}, {"v": [1.0, 2]}), [])

    def test_bare_godot_command_uses_path_lookup(self):
        runs = [
            subprocess.CompletedProcess([], 0, "", ""),
            subprocess.CompletedProcess([], 0, 'CONTENT_RESULT {"ok":true}\n', ""),
        ]
        with (
            patch.object(content.shutil, "which", return_value="/tools/godot"),
            patch.object(content.subprocess, "run", side_effect=runs) as run,
        ):
            self.assertTrue(content.invoke_engine([], "godot")["ok"])
            self.assertEqual(run.call_args.args[0][0], "/tools/godot")

    def test_invalid_engine_result_envelopes_fail_cleanly(self):
        for value in [[], None, True, {"ok": "true"}, {"ok": 1}, {}]:
            executed = subprocess.CompletedProcess(
                [], 0, "CONTENT_RESULT " + json.dumps(value) + "\n", ""
            )
            imported = subprocess.CompletedProcess([], 0, "", "")
            with (
                self.subTest(value=value),
                patch.object(content.subprocess, "run", side_effect=[imported, executed]),
            ):
                with self.assertRaisesRegex(ValueError, "explicit Boolean"):
                    content.invoke_engine([], "/fake/godot")


@unittest.skipUnless(
    os.environ.get("VERIFICATION_TEST_GODOT"), "requires the pinned production engine"
)
class NativeMultiPackTests(unittest.TestCase):
    def test_real_dependencies_clone_list_export_diff_and_rejection(self):
        godot = os.environ["VERIFICATION_TEST_GODOT"]
        with tempfile.TemporaryDirectory(prefix="content packs ü ") as temporary:
            base = Path(temporary) / "base"
            child = Path(temporary) / "child"
            content.initialize(base, "local.base")
            content.initialize(child, "local.child")
            vehicle = json.loads((content.ROOT / "content/packs/core/vehicles/gt.json").read_text())
            vehicle["id"] = "local.base.vehicle.gt"
            content.write_new(base / "vehicle.json", vehicle)
            manifest = json.loads((base / "pack.json").read_text())
            manifest["files"] = ["vehicle.json"]
            (base / "pack.json").write_text(content.encode(manifest))
            manifest = json.loads((child / "pack.json").read_text())
            manifest["dependencies"].append({"id": "local.base", "version": "1.0.0"})
            (child / "pack.json").write_text(content.encode(manifest))
            failure = content.invoke_engine(
                ["--action=validate", *content.pack_arguments(child)], godot
            )
            self.assertFalse(failure["ok"])
            self.assertEqual(failure["diagnostics"][0]["code"], "CONTENT_DEPENDENCY")
            cloned = content.clone_definition(
                child, vehicle["id"], "local.child.vehicle.copy", godot, [base]
            )
            self.assertTrue(cloned["ok"])
            for argv in [
                ["validate", str(child), "--pack", str(base)],
                ["list", str(child), "--pack", str(base), "--kind", "vehicle"],
                ["inspect", str(child), "--pack", str(base), "--id", "local.child.vehicle.copy"],
                [
                    "export",
                    str(child),
                    "--pack",
                    str(base),
                    "--output",
                    str(Path(temporary) / "resolved.json"),
                ],
                ["diff", str(child), str(child), "--pack", str(base)],
            ]:
                with self.subTest(command=argv[0]), contextlib.redirect_stdout(io.StringIO()):
                    self.assertEqual(content.main([*argv, "--godot", godot]), 0)
            snapshot = json.loads((Path(temporary) / "resolved.json").read_text())
            self.assertIn("local.child.vehicle.copy", snapshot["records"])
            self.assertEqual(snapshot["provenance"]["local.base.vehicle.gt"]["pack"], "local.base")


if __name__ == "__main__":
    unittest.main()
