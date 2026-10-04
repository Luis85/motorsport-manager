"""Launcher contracts complement, never replace, native exported-app acceptance."""

import copy
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import build_standalone as build
import smoke_standalone as smoke


class StandaloneContracts(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.package = self.root / "package"
        self.package.mkdir()
        binary = self.package / "Motorsport Manager.x86_64"
        pack = self.package / "Motorsport Manager.pck"
        binary.write_bytes(b"test executable")
        pack.write_bytes(b"test pack")
        self.manifest = {
            "binary": binary.name,
            "target": "linux",
            "mode": "release",
            "source_revision": "test revision",
            "source_digest": "a" * 64,
            "engine": build.ENGINE,
            "engine_sha256": build.ENGINE_SHA256,
            "templates": {
                name: value for name, value in build.TEMPLATES.items() if name.startswith("linux_")
            },
            "clean_import": True,
            "runtime_verified": False,
            "artifacts": {p.name: build.digest(p) for p in (binary, pack)},
        }
        self.write_manifest()

    def write_manifest(self):
        (self.package / "build-manifest.json").write_text(
            json.dumps(self.manifest), encoding="utf-8"
        )

    def test_real_hashes_identify_pack(self):
        self.assertEqual(smoke.validate_package(self.package), self.manifest)

    def test_manifest_provenance_and_approval_flags_fail_closed(self):
        for field, value in [
            ("mode", "unknown"),
            ("target", "mac"),
            ("source_revision", True),
            ("source_revision", " "),
            ("source_digest", "named-but-not-hashed"),
            ("engine", "foreign"),
            ("engine_sha256", "b" * 64),
            ("templates", {}),
            ("runtime_verified", True),
            ("runtime_verified", 0),
            ("clean_import", 1),
        ]:
            with self.subTest(field=field, value=value):
                original = self.manifest[field]
                self.manifest[field] = value
                self.write_manifest()
                with self.assertRaises(ValueError):
                    smoke.validate_package(self.package)
                self.manifest[field] = original
        (self.package / "build-manifest.json").write_text("[]")
        with self.assertRaisesRegex(ValueError, "object"):
            smoke.validate_package(self.package)

    @unittest.skipUnless(os.name == "posix", "Portable package rejects POSIX symlink fixture")
    def test_equal_hash_symlink_is_not_an_owned_packaged_artifact(self):
        pack = self.package / "Motorsport Manager.pck"
        foreign = self.root / "foreign.pck"
        pack.rename(foreign)
        pack.symlink_to(foreign)
        with self.assertRaisesRegex(ValueError, "owned regular"):
            smoke.validate_package(self.package)

    def stage_report(self):
        return {
            "passed": True,
            "checks": 3,
            "failures": [],
            "stage": "create",
            "build": copy.deepcopy(self.manifest),
            "debug_build": False,
            "user_directory": str(self.root / "user"),
        }

    def test_stage_evidence_requires_exact_checks_stage_identity_and_user_directory(self):
        user = self.root / "user"
        smoke.validate_stage_report(self.stage_report(), "create", self.manifest, user)
        for field, value in [
            ("checks", True),
            ("checks", "3"),
            ("checks", 0),
            ("checks", -1),
            ("stage", "resume"),
            ("failures", ["defect"]),
            ("debug_build", 0),
            ("user_directory", str(self.root / "foreign")),
        ]:
            with self.subTest(field=field, value=value):
                report = self.stage_report()
                report[field] = value
                with self.assertRaises(ValueError):
                    smoke.validate_stage_report(report, "create", self.manifest, user)
        for field in smoke.IDENTITY_FIELDS:
            report = self.stage_report()
            report["build"][field] = 0 if field == "runtime_verified" else "foreign"
            with self.assertRaisesRegex(ValueError, "another source or toolchain"):
                smoke.validate_stage_report(report, "create", self.manifest, user)

    def test_previous_stage_report_is_rejected_before_launch(self):
        (self.package / "create.json").write_text(json.dumps(self.stage_report()))
        with patch.object(smoke.subprocess, "Popen") as process:
            with self.assertRaisesRegex(ValueError, "fresh"):
                smoke.run_stage(
                    self.root / "binary",
                    self.root,
                    self.root / "user",
                    self.package,
                    "create",
                    {"DISPLAY": ":fixture"},
                )
            process.assert_not_called()

    def test_real_interruption_marker_cannot_hide_engine_errors(self):
        marker = self.root / "replacement-paused"
        marker.write_text("temp", encoding="utf-8")
        log = self.root / "interrupted.log"
        log.write_text("SCRIPT ERROR: save journey failed\n", encoding="utf-8")
        process = SimpleNamespace(poll=lambda: None)
        with patch.object(smoke, "stop") as stopped:
            with self.assertRaisesRegex(RuntimeError, "engine errors"):
                smoke.interrupt_at_boundary(process, marker, "interrupt-temp", log)
            stopped.assert_called_once_with(process)
        marker.write_text("backup", encoding="utf-8")
        with self.assertRaisesRegex(RuntimeError, "boundary was not reached"):
            smoke.interrupt_at_boundary(process, marker, "interrupt-temp", log)

    def test_matching_version_cannot_hide_different_editor_bytes(self):
        engine = self.root / "engine"
        engine.write_bytes(b"counterfeit editor with matching version")
        with patch.object(
            build.subprocess, "run", return_value=SimpleNamespace(stdout=build.ENGINE)
        ):
            with self.assertRaisesRegex(ValueError, "editor bytes"):
                build.build(engine, self.root, self.root / "out", "linux", "release", "source")

    def test_build_stages_the_complete_config_without_old_content_homes(self):
        engine = self.root / "engine"
        engine.write_bytes(b"fixture engine")
        names = [name for name in build.TEMPLATES if name.startswith("linux_")]
        for name in names:
            (self.root / name).write_bytes(b"fixture template")
        real_digest = build.digest
        stages = []

        def fixture_digest(path):
            if path == engine:
                return build.ENGINE_SHA256
            if path.name in names:
                return build.TEMPLATES[path.name]
            return real_digest(path)

        def fixture_run(arguments, log, cwd):
            stages.append(cwd)
            source = build.ROOT / "config"
            files = sorted(path.relative_to(source) for path in source.rglob("*.json"))
            staged = cwd / "config"
            self.assertEqual(
                files, sorted(path.relative_to(staged) for path in staged.rglob("*.json"))
            )
            for relative in files:
                self.assertEqual((source / relative).read_bytes(), (staged / relative).read_bytes())
            self.assertFalse((cwd / "data").exists())
            self.assertFalse((cwd / "content/packs/core").exists())
            if "--export-release" in arguments:
                binary = Path(arguments[-1])
                binary.write_bytes(b"fixture executable")
                binary.with_suffix(".pck").write_bytes(b"fixture packed config")

        with (
            patch.object(
                build.subprocess, "run", return_value=SimpleNamespace(stdout=build.ENGINE)
            ),
            patch.object(build, "digest", side_effect=fixture_digest),
            patch.object(build, "run", side_effect=fixture_run),
        ):
            result = build.build(
                engine, self.root, self.root / "out", "linux", "release", "fixture"
            )
        self.assertEqual(2, len(stages))
        self.assertTrue(result["clean_import"])
        self.assertFalse(result["runtime_verified"])

    def test_changed_pack_is_not_accepted(self):
        (self.package / "Motorsport Manager.pck").write_bytes(b"changed")
        with self.assertRaisesRegex(ValueError, "hash differs"):
            smoke.validate_package(self.package)

    def test_missing_pack_is_not_accepted(self):
        (self.package / "Motorsport Manager.pck").unlink()
        with self.assertRaises(OSError):
            smoke.validate_package(self.package)

    def test_binary_path_cannot_escape_package(self):
        self.manifest["binary"] = "../elsewhere"
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "executable"):
            smoke.validate_package(self.package)

    def test_artifact_paths_cannot_escape_package(self):
        self.manifest["artifacts"]["../outside"] = "fake"
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "exactly"):
            smoke.validate_package(self.package)

    def test_provenance_is_required(self):
        for field in smoke.IDENTITY_FIELDS:
            original = self.manifest.pop(field)
            self.write_manifest()
            with self.assertRaises(ValueError):
                smoke.validate_package(self.package)
            self.manifest[field] = original

    def test_missing_templates_fail_closed(self):
        with self.assertRaisesRegex(ValueError, "template"):
            build.validate_templates(self.root, "linux")

    def test_target_selects_only_matching_templates(self):
        for name in build.TEMPLATES:
            (self.root / name).write_bytes(b"not an actual template")
        with patch.object(
            build, "digest", side_effect=lambda path: build.TEMPLATES[path.name]
        ) as hashed:
            result = build.validate_templates(self.root, "windows")
        self.assertEqual(len(result), 2)
        self.assertEqual(hashed.call_count, 2)
        self.assertTrue(all(name.startswith("windows_") for name in result))

    def test_wrong_template_hash_is_rejected(self):
        for name in build.TEMPLATES:
            (self.root / name).write_bytes(b"different version")
        with self.assertRaisesRegex(ValueError, "different pinned"):
            build.validate_templates(self.root, "linux")

    def test_build_rejects_unnamed_source_before_execution(self):
        with self.assertRaisesRegex(ValueError, "revision"):
            build.build(self.root / "engine", self.root, self.root / "out", "linux", "debug", " ")

    def test_build_rejects_mixed_output_before_execution(self):
        with self.assertRaisesRegex(ValueError, "empty"):
            build.build(self.root / "engine", self.root, self.package, "linux", "debug", "revision")

    def test_build_rejects_unsupported_mode(self):
        with self.assertRaisesRegex(ValueError, "Unsupported"):
            build.build(
                self.root / "engine", self.root, self.root / "out", "linux", "other", "revision"
            )

    def test_smoke_rejects_mixed_evidence(self):
        with patch.object(smoke.platform, "system", return_value="Linux"):
            with self.assertRaisesRegex(ValueError, "empty"):
                smoke.smoke(self.package, self.package)

    @unittest.skipIf(smoke.os.name == "nt", "Xvfb driver applies to Linux native smoke")
    def test_smoke_vsync_override_reaches_engine_before_user_arguments(self):
        report = {"passed": True, "checks": 1, "failures": [], "stage": "launch"}

        def complete_stage(timeout):
            self.assertEqual(timeout, 180)
            # The child publishes fresh evidence after launch, as the native player does.
            (self.root / "launch.json").write_text(json.dumps(report), encoding="utf-8")
            return 0

        with (
            patch.object(smoke.shutil, "which", return_value="/bin/xvfb-run"),
            patch.object(smoke.subprocess, "Popen") as launch,
        ):
            launch.return_value.wait.side_effect = complete_stage
            launch.return_value.poll.return_value = 0
            self.assertEqual(
                smoke.run_stage(
                    self.package / self.manifest["binary"],
                    self.package,
                    self.root / "user",
                    self.root,
                    "launch",
                    {},
                ),
                report,
            )
        command = launch.call_args.args[0]
        self.assertEqual(command.count("--disable-vsync"), 2)
        self.assertLess(command.index("--disable-vsync"), command.index("--"))
        driver = command.index("--rendering-driver")
        self.assertLess(driver, command.index("--"))
        self.assertEqual(command[driver + 1], "opengl3_es")
        self.assertEqual(
            command[command.index("--") + 1 :], ["--disable-vsync", "--standalone-smoke=launch"]
        )

    def test_windows_ci_selects_angle_before_application_arguments(self):
        report = {"passed": True, "checks": 1, "failures": [], "stage": "launch"}

        def complete_stage(timeout):
            self.assertEqual(timeout, 180)
            (self.root / "launch.json").write_text(json.dumps(report), encoding="utf-8")
            return 0

        for ci in (True, False):
            with self.subTest(ci=ci):
                (self.root / "launch.json").unlink(missing_ok=True)
                with (
                    patch.object(smoke.os, "name", "nt"),
                    patch.object(smoke.subprocess, "CREATE_NEW_PROCESS_GROUP", 512, create=True),
                    patch.object(smoke.subprocess, "Popen") as launch,
                ):
                    launch.return_value.wait.side_effect = complete_stage
                    launch.return_value.poll.return_value = 0
                    self.assertEqual(
                        smoke.run_stage(
                            self.package / self.manifest["binary"],
                            self.package,
                            self.root / "user",
                            self.root,
                            "launch",
                            {"GITHUB_ACTIONS": "true"} if ci else {},
                        ),
                        report,
                    )
                command = launch.call_args.args[0]
                if ci:
                    driver = command.index("--rendering-driver")
                    self.assertLess(driver, command.index("--"))
                    self.assertEqual(command[driver + 1], "opengl3_angle")
                else:
                    self.assertNotIn("--rendering-driver", command)
                self.assertNotIn("--headless", command)
                self.assertEqual(command.count("--disable-vsync"), 2)
                self.assertEqual(
                    command[command.index("--") + 1 :],
                    ["--disable-vsync", "--standalone-smoke=launch"],
                )
                self.assertEqual(launch.call_args.kwargs["creationflags"], 512)

    def test_runtime_target_is_not_cross_build_success(self):
        self.manifest["target"] = "windows"
        self.manifest["templates"] = {
            name: value for name, value in build.TEMPLATES.items() if name.startswith("windows_")
        }
        self.manifest["binary"] = "Motorsport Manager.exe"
        (self.package / "Motorsport Manager.x86_64").rename(self.package / self.manifest["binary"])
        old = self.manifest["artifacts"].pop("Motorsport Manager.x86_64")
        self.manifest["artifacts"][self.manifest["binary"]] = old
        self.write_manifest()
        with patch.object(smoke.platform, "system", return_value="Linux"):
            with self.assertRaisesRegex(ValueError, "target OS"):
                smoke.smoke(self.package, self.root / "out")


if __name__ == "__main__":
    unittest.main()
