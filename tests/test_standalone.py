"""Launcher contracts complement, never replace, native exported-app acceptance."""

import json
import sys
import tempfile
import unittest
from pathlib import Path
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
            "source_digest": "test digest",
            "engine": build.ENGINE,
            "artifacts": {p.name: build.digest(p) for p in (binary, pack)},
        }
        self.write_manifest()

    def write_manifest(self):
        (self.package / "build-manifest.json").write_text(
            json.dumps(self.manifest), encoding="utf-8"
        )

    def test_real_hashes_identify_pack(self):
        self.assertEqual(smoke.validate_package(self.package), self.manifest)

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
        report = {"passed": True, "checks": 1}
        (self.root / "launch.json").write_text(json.dumps(report), encoding="utf-8")
        with (
            patch.object(smoke.shutil, "which", return_value="/bin/xvfb-run"),
            patch.object(smoke.subprocess, "Popen") as launch,
        ):
            launch.return_value.wait.return_value = 0
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

    def test_runtime_target_is_not_cross_build_success(self):
        self.manifest["target"] = "windows"
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
