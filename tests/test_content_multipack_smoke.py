"""End-to-end authoring through the production Godot validator, never a Python substitute."""
from __future__ import annotations

import contextlib
import io
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))
import content

ENGINE = os.environ.get("GODOT_BINARY") or os.environ.get("VERIFICATION_TEST_GODOT")


@unittest.skipUnless(ENGINE, "Set GODOT_BINARY or VERIFICATION_TEST_GODOT to execute native authoring tests.")
class MultiPackIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="content authoring ü ")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.base = self.root / "base"
        self.event = self.root / "event"
        self.after = self.root / "after"
        self.addon = self.root / "addon"
        self.core = content.ROOT / "content/packs/core"
        vehicle = json.loads((self.core / "vehicles/gt.json").read_text(encoding="utf-8"))
        vehicle.update(id="local.base.vehicle.gt", name="ERROR: is allowed in an authored label")
        self.pack(self.base, "local.base", {"vehicle.json": vehicle})
        weekend = json.loads((self.core / "weekends/quick.json").read_text(encoding="utf-8"))
        weekend.update(id="local.event.weekend.quick", vehicle_id=vehicle["id"])
        self.pack(self.event, "local.event", {"weekend.json": weekend}, ["local.base"])
        shutil.copytree(self.event, self.after)
        weekend["settings"]["laps"] += 1
        (self.after / "weekend.json").write_text(content.encode(weekend), encoding="utf-8")
        self.pack(self.addon, "local.addon", {}, ["local.base"])

    def pack(self, path, identity, records, dependencies=()):
        content.initialize(path, identity)
        manifest_path = path / "pack.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest["dependencies"] += [{"id": identity, "version": "1.0.0"} for identity in dependencies]
        for filename, record in records.items():
            (path / filename).write_text(content.encode(record), encoding="utf-8")
        manifest["files"] = list(records)
        manifest_path.write_text(content.encode(manifest), encoding="utf-8")

    def command(self, *args):
        with contextlib.redirect_stdout(io.StringIO()) as output:
            status = content.main([*map(str, args), "--godot", str(ENGINE)])
        result = json.loads(output.getvalue())
        self.assertEqual(0 if result["ok"] else 1, status, result)
        return result

    def test_validate_inspect_and_list_use_the_same_ordered_selection(self):
        roots = ["--pack", self.base, "--pack", self.event]
        accepted = self.command("validate", *roots, "--format", "json")
        self.assertTrue(accepted["ok"], accepted)
        self.assertTrue(accepted["engine_executed"])
        inspected = self.command("inspect", *roots, "--id", "local.event.weekend.quick", "--format", "json")
        self.assertEqual("local.base.vehicle.gt", inspected["inspection"]["definition"]["vehicle_id"])
        listed = self.command("list", *roots, "--kind", "weekend")
        self.assertTrue(any(item["id"] == "local.event.weekend.quick" for item in listed["definitions"]))
        self.assertTrue(all(item["kind"] == "weekend" for item in listed["definitions"]))

    def test_missing_or_out_of_order_dependencies_are_native_rejections(self):
        for roots in [[self.event], [self.base, "--pack", self.event]]:
            result = self.command("validate", *roots, "--format", "json")
            self.assertFalse(result["ok"])
            self.assertTrue(result["engine_executed"])
            self.assertEqual("CONTENT_DEPENDENCY", result["diagnostics"][0]["code"])

    def test_export_and_diff_resolve_shared_dependencies_and_side_addons(self):
        destination = self.root / "resolved.json"
        exported = self.command("export", self.event, "--pack", self.base, "--output", destination)
        self.assertTrue(exported["ok"], exported)
        snapshot = json.loads(destination.read_text(encoding="utf-8"))
        self.assertIn("local.event.weekend.quick", snapshot["records"])
        result = self.command("diff", self.event, self.after, "--pack", self.base,
                              "--before-pack", self.addon, "--after-pack", self.addon)
        self.assertTrue(result["ok"], result)
        self.assertFalse(result["equal"])
        self.assertEqual([{"path": "/local.event.weekend.quick/settings/laps", "change": "changed",
                           "before": 12, "after": 13}], result["changes"])

    def test_clone_from_dependency_is_still_accepted_by_production(self):
        result = self.command("clone", "local.base.vehicle.gt", "--as", "local.event.vehicle.cloned",
                              "--pack", self.event, "--include-pack", self.base)
        self.assertTrue(result["ok"], result)
        result = self.command("validate", self.event, "--pack", self.base, "--format", "json")
        self.assertTrue(result["ok"], result)
        self.assertTrue(any(item["id"] == "local.event.vehicle.cloned" for item in result["definitions"]))


if __name__ == "__main__":
    unittest.main()
