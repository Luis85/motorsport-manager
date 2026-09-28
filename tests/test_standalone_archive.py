"""Exercise the same tar -> artifact ZIP -> tar transport used by the workflow."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from build_standalone import ENGINE, digest
from smoke_standalone import validate_package


@unittest.skipUnless(os.name == "posix" and shutil.which("tar"), "POSIX mode and tar test")
class StandaloneArchiveTests(unittest.TestCase):
    def test_distributed_archive_preserves_launch_and_provenance(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "Built app – Ω"
            source.mkdir()
            binary = source / "Motorsport Manager.x86_64"
            binary.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
            binary.chmod(0o755)
            pack = source / "Motorsport Manager.pck"
            pack.write_bytes(b"transport contract fixture, not a Godot pack")
            manifest = {
                "binary": binary.name, "target": "linux", "mode": "release",
                "source_revision": "transport-fixture", "source_digest": "fixture",
                "engine": ENGINE, "artifacts": {p.name: digest(p) for p in (binary, pack)},
            }
            (source / "build-manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
            archive = root / "D:standalone-linux-release.tar.gz"
            subprocess.run(["tar", "-czf", str(archive), "-C", str(source), "."], check=True)
            transport = root / "transport.zip"
            # Model the artifact service losing modes, not a tar-library shortcut.
            with zipfile.ZipFile(transport, "w") as uploaded:
                uploaded.writestr(archive.name, archive.read_bytes())
            download = root / "Downloaded artifact"
            with zipfile.ZipFile(transport) as uploaded:
                uploaded.extractall(download)
            (download / archive.name).chmod(0o644)
            clean = root / "Clean application – Ω"
            clean.mkdir()
            # GNU tar otherwise interprets a Windows drive colon as a remote host.
            subprocess.run(["tar", "--force-local", "-xzf", archive.name, "-C", str(clean)],
                           cwd=download, check=True)
            self.assertEqual(validate_package(clean), manifest)
            executable = clean / binary.name
            self.assertTrue(executable.stat().st_mode & 0o100)
            self.assertEqual(subprocess.run([str(executable)], cwd=clean, check=False).returncode, 0)
            self.assertFalse((clean / "project.godot").exists())


if __name__ == "__main__":
    unittest.main()
