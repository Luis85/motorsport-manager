"""Transactional balance edits: whole-root acceptance and source preservation."""

from __future__ import annotations

import contextlib
import io
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))
import balance
import balance_authoring as authoring


class AcceptedNative:
    def __init__(self, root, snapshot, godot):
        self.snapshot = snapshot
        self.identity = {"engine_version": "native-fixture", "source_digest": "fixture"}

    def __enter__(self):
        return self

    def __exit__(self, *_):
        pass

    def validate(self):
        return {
            "ok": True,
            "engine_executed": True,
            "config_validated": True,
            "metadata": self.identity,
        }

    def schemas(self):
        return {
            "race_tuning": {
                "properties": {
                    "knobs": {
                        "properties": {
                            "pace": {
                                "type": "number",
                                "minimum": 0.1,
                                "maximum": 2.0,
                                "description": "multiplier: Pace coefficient.",
                            },
                        }
                    }
                }
            }
        }


class BalanceAuthoringTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name) / "config"
        self.root.mkdir()
        (self.root / "pack.json").write_text('{"id":"core","version":"1.0.0"}')
        self.path = self.root / "families/race_tuning/default.json"
        self.path.parent.mkdir(parents=True)
        self.original = b'{\n "kind":"race_tuning", "id":"core.race.default",\n "knobs": {"pace": 1.0, "enabled": true, "a/b~c": 4}, "label":"human"\n}\n'
        self.path.write_bytes(self.original)
        self.other = self.root / "other.json"
        self.other.write_text('{"kind":"vehicle","value":7}\n')
        self.name = self.path.relative_to(self.root).as_posix()

    def args(self, *arguments):
        return balance.parser().parse_args(["--config-dir", str(self.root), *arguments])

    def edit(self, *extra):
        return balance.execute(self.args("set", self.name, "/knobs/pace", "1.25", *extra))

    def test_success_stages_whole_root_and_preserves_other_bytes(self):
        observed = []

        class InspectCandidate(AcceptedNative):
            def validate(inner):
                observed.append(inner.snapshot.document(self.name)["knobs"]["pace"])
                self.assertEqual(inner.snapshot.files["other.json"], self.other.read_bytes())
                self.assertEqual(self.path.read_bytes(), self.original)
                return super().validate()

        with patch.object(balance, "NativeProject", InspectCandidate):
            result = self.edit()
        self.assertEqual(observed, [1.25])
        self.assertTrue(result["validation"])
        self.assertTrue(result["published"])
        self.assertEqual(result["field"]["units"], "multiplier")
        self.assertEqual(
            self.path.read_bytes(), self.original.replace(b'"pace": 1.0', b'"pace": 1.25')
        )
        self.assertEqual(self.other.read_bytes(), b'{"kind":"vehicle","value":7}\n')
        self.assertEqual(sorted(p.name for p in self.path.parent.iterdir()), ["default.json"])

    def test_native_rejection_and_crash_never_publish(self):
        for failure in (
            {"ok": False, "engine_executed": True, "diagnostics": ["invalid"]},
            ValueError("crash"),
        ):
            with self.subTest(failure=failure), patch.object(balance, "NativeProject") as native:
                native.return_value.__enter__.return_value.validate.side_effect = [failure]
                if isinstance(failure, Exception):
                    with self.assertRaisesRegex(ValueError, "crash"):
                        self.edit()
                else:
                    self.assertFalse(self.edit()["ok"])
                self.assertEqual(self.path.read_bytes(), self.original)

    def test_dry_run_reports_validated_candidate_without_writes(self):
        with patch.object(balance, "NativeProject", AcceptedNative):
            result = self.edit("--dry-run")
        self.assertTrue(result["validation"])
        self.assertTrue(result["engine_executed"])
        self.assertFalse(result["published"])
        self.assertEqual(result["changes"][0]["after"], 1.25)
        self.assertEqual(self.path.read_bytes(), self.original)

    def test_changed_target_or_other_file_preserves_latest_data(self):
        for target in (self.path, self.other):
            with self.subTest(target=target):
                self.path.write_bytes(self.original)
                self.other.write_text('{"value":7}')
                latest = b'{"value":99}'

                class Concurrent(AcceptedNative):
                    def validate(inner, target=target, latest=latest):
                        target.write_bytes(latest)
                        return super().validate()

                with patch.object(balance, "NativeProject", Concurrent):
                    with self.assertRaisesRegex(ValueError, "changed"):
                        self.edit()
                self.assertEqual(target.read_bytes(), latest)

    def test_added_file_and_replaced_root_reject_publication(self):
        for mutation in ("addition", "root"):
            with self.subTest(mutation=mutation):
                snapshot = authoring.Snapshot(self.root)
                if mutation == "addition":
                    extra = self.root / "new.json"
                    extra.write_text("{}")
                else:
                    old = self.root.with_name("old")
                    self.root.rename(old)
                    self.root.mkdir()
                    (self.root / "new.json").write_text("{}")
                with self.assertRaisesRegex(ValueError, "changed"):
                    authoring.publish(snapshot, self.name, b"{}")
                if mutation == "addition":
                    extra.unlink()
                else:
                    (self.root / "new.json").unlink()
                    self.root.rmdir()
                    old.rename(self.root)
                self.assertEqual(self.path.read_bytes(), self.original)

    def test_failure_during_atomic_replace_cleans_only_owned_temporary(self):
        with (
            patch.object(balance, "NativeProject", AcceptedNative),
            patch.object(authoring.os, "replace", side_effect=OSError("replace failed")),
        ):
            with self.assertRaisesRegex(OSError, "replace failed"):
                self.edit()
        self.assertEqual(self.path.read_bytes(), self.original)
        self.assertEqual(list(self.path.parent.iterdir()), [self.path])

    def test_change_while_temporary_is_flushed_is_detected(self):
        real_fsync = os.fsync

        def concurrent(handle):
            real_fsync(handle)
            self.other.write_text('{"value":123}')

        with (
            patch.object(balance, "NativeProject", AcceptedNative),
            patch.object(authoring.os, "fsync", side_effect=concurrent),
        ):
            with self.assertRaisesRegex(ValueError, "changed"):
                self.edit()
        self.assertEqual(self.path.read_bytes(), self.original)
        self.assertEqual(json.loads(self.other.read_text()), {"value": 123})
        self.assertEqual(list(self.path.parent.iterdir()), [self.path])

    def test_flush_failure_preserves_source_and_cleans_temporary(self):
        with (
            patch.object(balance, "NativeProject", AcceptedNative),
            patch.object(authoring.os, "fsync", side_effect=OSError("flush failed")),
        ):
            with self.assertRaisesRegex(OSError, "flush failed"):
                self.edit()
        self.assertEqual(self.path.read_bytes(), self.original)
        self.assertEqual(list(self.path.parent.iterdir()), [self.path])

    @unittest.skipUnless(os.name == "posix", "directory descriptor publication")
    def test_parent_replaced_by_symlink_during_flush_cannot_write_outside(self):
        outside = self.root.parent / "outside"
        outside.mkdir()
        outside_file = outside / self.path.name
        outside_file.write_bytes(b"outside original")
        moved = self.path.parent.with_name("moved")
        real_fsync = os.fsync

        def replace_parent(handle):
            real_fsync(handle)
            self.path.parent.rename(moved)
            self.path.parent.symlink_to(outside, target_is_directory=True)

        with (
            patch.object(balance, "NativeProject", AcceptedNative),
            patch.object(authoring.os, "fsync", side_effect=replace_parent),
        ):
            with self.assertRaises(ValueError):
                self.edit()
        self.assertEqual(outside_file.read_bytes(), b"outside original")
        self.assertEqual((moved / self.path.name).read_bytes(), self.original)
        self.assertEqual(list(moved.iterdir()), [moved / self.path.name])

    def test_existing_scalar_only_and_protected_fields_preflight(self):
        for pointer, literal in (
            ("/id", '"other"'),
            ("/kind", '"vehicle"'),
            ("/missing", "2"),
            ("/knobs", "{}"),
            ("/knobs/pace", "[]"),
            ("/knobs/pace", "null"),
            ("/knobs/pace", "true"),
            ("/knobs/enabled", "1"),
            ("/knobs/pace", '"fast"'),
            ("/knobs/pace", "1e999"),
            ("/knobs/pace", "NaN"),
            ("/knobs/pace", "1000000000001"),
        ):
            with (
                self.subTest(pointer=pointer, literal=literal),
                patch.object(balance, "NativeProject") as native,
            ):
                with self.assertRaises(ValueError):
                    balance.execute(self.args("set", self.name, pointer, literal))
                native.assert_not_called()
                self.assertEqual(self.path.read_bytes(), self.original)

    def test_pointer_escapes_arrays_and_utf8_preserve_document(self):
        self.path.write_text('{"knobs":{"a/b~c":[2,3]},"label":"é"}', encoding="utf-8")
        snapshot = authoring.Snapshot(self.root)
        raw, changes = authoring.edited(snapshot, self.name, "/knobs/a~1b~0c/1", "5")
        self.assertEqual(raw.decode(), '{"knobs":{"a/b~c":[2,5]},"label":"é"}')
        self.assertEqual(changes[0]["path"], "/knobs/a~1b~0c")
        for invalid in (
            "",
            "knobs/pace",
            "/knobs/a~2b",
            "/knobs/a~1b~0c/01",
            "/knobs/a~1b~0c/-",
            "/knobs/a~1b~0c/2",
        ):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                authoring.edited(snapshot, self.name, invalid, "5")

    def test_out_of_root_paths_reject_before_engine(self):
        for name in (
            "../other.json",
            "/tmp/other.json",
            "families/../other.json",
            "./other.json",
            "families\\other.json",
        ):
            with self.subTest(name=name), patch.object(balance, "NativeProject") as native:
                with self.assertRaises(ValueError):
                    balance.execute(self.args("set", name, "/value", "4"))
                native.assert_not_called()

    def test_symlink_file_parent_and_root_reject(self):
        outside = self.root.parent / "outside.json"
        outside.write_text("{}")
        link = self.root / "linked.json"
        try:
            link.symlink_to(outside)
        except OSError as error:
            if getattr(error, "winerror", None) == 1314:
                self.skipTest("Windows runner lacks symbolic-link privilege")
            raise
        with self.assertRaises(ValueError):
            authoring.Snapshot(self.root)
        link.unlink()
        alias = self.root.parent / "alias"
        alias.symlink_to(self.root, target_is_directory=True)
        with self.assertRaises(ValueError):
            authoring.Snapshot(alias)
        alias.unlink()
        (self.root / "linked-directory").symlink_to(self.path.parent, target_is_directory=True)
        with self.assertRaises(ValueError):
            authoring.Snapshot(self.root)
        self.assertEqual(outside.read_bytes(), b"{}")

    def test_hardlinked_file_rejects_without_changing_either_name(self):
        outside = self.root.parent / "outside.json"
        outside.write_text("{}")
        link = self.root / "linked.json"
        os.link(outside, link)
        with self.assertRaises(ValueError):
            authoring.Snapshot(self.root)
        self.assertEqual(outside.read_bytes(), b"{}")
        self.assertEqual(link.read_bytes(), b"{}")

    def test_duplicate_nonfinite_and_excessive_raw_configs_reject(self):
        for data in (
            b'{"value":1,"value":2}',
            b'{"value":Infinity}',
            b'{"value":1e999}',
            b'{"value":1000000000001}',
            b"[" * 66 + b"0" + b"]" * 66,
        ):
            self.other.write_bytes(data)
            with self.subTest(data=data), self.assertRaises(ValueError):
                authoring.Snapshot(self.root)
            self.assertEqual(self.path.read_bytes(), self.original)

    def test_whole_root_resource_limits_preflight(self):
        cases = (
            ("MAX_FILES", 1, "file limit"),
            ("MAX_ENTRIES", 1, "entry limit"),
            ("MAX_TOTAL_BYTES", 1, "total byte"),
            ("MAX_BYTES", 1, "1 MiB"),
            ("MAX_DEPTH", 1, "nesting"),
        )
        for setting, limit, message in cases:
            with self.subTest(setting=setting), patch.object(authoring, setting, limit):
                with self.assertRaisesRegex(ValueError, message):
                    authoring.Snapshot(self.root)

    def test_case_collision_rejects_on_case_sensitive_filesystem(self):
        upper = self.root / "OTHER.json"
        if upper.exists():
            self.skipTest("Filesystem prevents distinct case-colliding names")
        upper.write_text("{}")
        with self.assertRaisesRegex(ValueError, "case collision"):
            authoring.Snapshot(self.root)
        self.assertEqual(self.path.read_bytes(), self.original)

    def test_offline_reads_report_execution_false_and_do_not_write(self):
        with patch.object(balance, "executable", return_value=None):
            result = balance.execute(self.args("list"))
            inspected = balance.execute(self.args("inspect", self.name, "/knobs/pace"))
            compared = balance.execute(self.args("diff", str(self.root)))
        self.assertFalse(result["engine_executed"])
        self.assertEqual(len(result["files"]), 3)
        self.assertEqual(inspected["value"], 1.0)
        self.assertFalse(inspected["engine_executed"])
        self.assertTrue(compared["equal"])
        self.assertEqual(self.path.read_bytes(), self.original)

    def test_invalid_inspection_selection_rejects_before_native_execution(self):
        for filename, pointer in (("missing.json", "/value"), (self.name, "/knobs/missing")):
            output = io.StringIO()
            with (
                self.subTest(filename=filename, pointer=pointer),
                patch.object(balance, "NativeProject") as native,
                patch.object(balance, "executable", return_value="godot"),
                contextlib.redirect_stdout(output),
            ):
                status = balance.main(
                    ["--config-dir", str(self.root), "inspect", filename, pointer]
                )
            native.assert_not_called()
            result = json.loads(output.getvalue())
            self.assertEqual(status, 1)
            self.assertFalse(result["ok"])
            self.assertFalse(result["engine_executed"])
            self.assertNotIn("metadata", result)
            self.assertEqual(self.path.read_bytes(), self.original)

    def test_options_before_or_after_command_and_json_error_stdout(self):
        args = balance.parser().parse_args(["inspect", self.name, "--config-dir", str(self.root)])
        self.assertEqual(args.config_dir, self.root)
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            status = balance.main(["set"])
        self.assertEqual(status, 1)
        self.assertFalse(json.loads(output.getvalue())["ok"])


if __name__ == "__main__":
    unittest.main()
