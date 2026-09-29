"""Publication safety tests. Remote writes use a temporary bare Git repository.
The GitHub CLI is an explicit fake; these tests cannot establish a GitHub upload.
"""
from __future__ import annotations

from contextlib import contextmanager
import importlib.util
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import zipfile

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("publisher", HERE / "publish_v15.py")
assert spec and spec.loader
P = importlib.util.module_from_spec(spec)
spec.loader.exec_module(P)
ARCHIVE = Path(os.environ.get("LITTLEWILD_SOURCE_ZIP", str(HERE / "littlewild-v15-source.zip")))
FILES = P.archive_files(ARCHIVE) if ARCHIVE.exists() else None


@contextmanager
def synthetic(entries):
    with tempfile.TemporaryDirectory() as temporary:
        path = Path(temporary) / "test.zip"
        with zipfile.ZipFile(path, "w") as archive:
            for name, data in entries:
                archive.writestr(name, data)
        with patch.object(P, "ARCHIVE_SHA", P.digest(path.read_bytes())):
            yield path


class ArchiveTests(unittest.TestCase):
    @unittest.skipIf(FILES is None, "Pass the retained delivery ZIP for integration tests")
    def test_pinned_delivery(self):
        self.assertEqual(len(FILES), 203)
        self.assertEqual(P.digest(FILES["littlewild.html"]), P.HTML_SHA)

    def test_missing_archive(self):
        with self.assertRaises(ValueError):
            P.archive_files(HERE / "absent.zip")

    def test_wrong_checksum(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "wrong.zip"
            path.write_bytes(b"not the reviewed source")
            with self.assertRaisesRegex(ValueError, "checksum"):
                P.archive_files(path)

    def test_oversized_archive(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "large.zip"
            with path.open("wb") as stream:
                stream.truncate(21 * 1024 * 1024)
            with self.assertRaises(ValueError):
                P.archive_files(path)

    def test_unsafe_paths(self):
        for name in ("other/x", "Littlewild-v15/../x", "Littlewild-v15//x",
                     "Littlewild-v15/.git/config", "Littlewild-v15/C:/x",
                     "Littlewild-v15/a\\b", "/Littlewild-v15/x"):
            with self.subTest(name=name), synthetic([(name, b"x")]) as path:
                with self.assertRaises(ValueError):
                    P.archive_files(path)

    def test_duplicate_case_paths(self):
        with synthetic([("Littlewild-v15/A", b"a"),
                        ("Littlewild-v15/a", b"b")]) as path:
            with self.assertRaisesRegex(ValueError, "colliding"):
                P.archive_files(path)

    def test_symlink_member(self):
        member = zipfile.ZipInfo("Littlewild-v15/link")
        member.create_system = 3
        member.external_attr = (stat.S_IFLNK | 0o777) << 16
        with synthetic([(member, b"/etc/passwd")]) as path:
            with self.assertRaisesRegex(ValueError, "symlinks"):
                P.archive_files(path)

    def test_missing_payload(self):
        with synthetic([("Littlewild-v15/README.md", b"a")]) as path:
            with self.assertRaisesRegex(ValueError, "payload"):
                P.archive_files(path)

    def test_too_many_entries(self):
        with synthetic([(f"Littlewild-v15/{i}", b"x") for i in range(501)]) as path:
            with self.assertRaisesRegex(ValueError, "entry count"):
                P.archive_files(path)


class DestinationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name).resolve() / "target"

    def tearDown(self):
        self.temp.cleanup()

    def test_new_files_and_idempotence(self):
        payload = {"README.md": b"actual readme", "source/test.js": b"hello"}
        P.write_files(self.root, payload)
        before = (self.root / "source/test.js").stat().st_mtime_ns
        P.write_files(self.root, payload)
        self.assertEqual(before, (self.root / "source/test.js").stat().st_mtime_ns)

    def test_approved_readme_replaced(self):
        self.root.mkdir()
        (self.root / "README.md").write_bytes((HERE / "README-staging.md").read_bytes())
        P.write_files(self.root, {"README.md": b"product readme"})
        self.assertEqual((self.root / "README.md").read_bytes(), b"product readme")

    def test_unknown_readme_preserved(self):
        self.root.mkdir()
        (self.root / "README.md").write_bytes(b"user decisions")
        with self.assertRaises(ValueError):
            P.write_files(self.root, {"new.txt": b"x", "README.md": b"replacement"})
        self.assertFalse((self.root / "new.txt").exists())
        self.assertEqual((self.root / "README.md").read_bytes(), b"user decisions")

    def test_modified_source_preserved(self):
        self.root.mkdir()
        (self.root / "code.js").write_bytes(b"user code")
        with self.assertRaises(ValueError):
            P.write_files(self.root, {"code.js": b"supplied code"})
        self.assertEqual((self.root / "code.js").read_bytes(), b"user code")

    def test_symlinks_rejected(self):
        self.root.mkdir()
        (self.root / "link").symlink_to(Path(self.temp.name))
        with self.assertRaises(ValueError):
            P.write_files(self.root, {"link/escape.txt": b"x"})
        self.assertFalse((Path(self.temp.name) / "escape.txt").exists())

    def test_parent_file_rejected(self):
        self.root.mkdir()
        (self.root / "source").write_bytes(b"file instead of folder")
        with self.assertRaises(ValueError):
            P.write_files(self.root, {"source/code.js": b"x"})

    def test_directory_collision_rejected(self):
        (self.root / "code.js").mkdir(parents=True)
        with self.assertRaises(ValueError):
            P.write_files(self.root, {"code.js": b"x"})

    def test_staging_scope(self):
        self.assertTrue(P.safe_staged_paths(["docs/concepts/littlewild/source/test.js"]))
        for paths in ([], ["scripts/game.gd"], ["docs/concepts/littlewild-other/test.js"],
                      ["docs/concepts/littlewild/a", "README.md"]):
            self.assertFalse(P.safe_staged_paths(paths))


@unittest.skipIf(FILES is None, "Retained ZIP required for local Git integration")
class GitIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name).resolve()
        self.seed, self.remote, self.repo = [self.root / n for n in ("seed", "remote.git", "repo")]
        self.seed.mkdir()
        self.git(["init", "-b", "main"], self.seed)
        for key, value in (("user.name", "Publication Test"), ("user.email", "test@example.invalid")):
            self.git(["config", key, value], self.seed)
        (self.seed / "native.txt").write_text("native game remains unchanged\n")
        dest = self.seed / P.DESTINATION
        dest.mkdir(parents=True)
        (dest / "README.md").write_bytes((HERE / "README-staging.md").read_bytes())
        self.git(["add", "."], self.seed)
        self.git(["commit", "-m", "test baseline"], self.seed)
        self.git(["branch", P.BRANCH], self.seed)
        self.git(["clone", "--bare", str(self.seed), str(self.remote)], self.root)
        self.git(["clone", str(self.remote), str(self.repo)], self.root)
        for key, value in (("user.name", "Publication Test"), ("user.email", "test@example.invalid")):
            self.git(["config", key, value], self.repo)
        self.calls = []

    def tearDown(self):
        self.temp.cleanup()

    def git(self, args, cwd):
        return subprocess.check_output(["git", *args], cwd=cwd, text=True, stderr=subprocess.DEVNULL).strip()

    def test_full_local_publication_and_retry(self):
        original_run = P.run
        original_which = shutil.which

        def fake_cli(arguments, cwd, timeout=180):
            self.calls.append(arguments)
            if arguments[0] != "gh":
                return original_run(arguments, cwd, timeout)
            if arguments[1:3] == ["pr", "list"]:
                return json.dumps([{"number": 99, "url": "https://example.invalid/pr/99",
                                    "isDraft": True, "body": P.MARKER}])
            return ""

        with patch.object(P, "run", fake_cli), patch.object(P.shutil, "which", lambda n: "/fake/gh" if n == "gh" else original_which(n)):
            url = P.publish(self.repo, FILES)
            first = self.git(["rev-parse", P.BRANCH], self.remote)
            self.assertEqual(url, "https://example.invalid/pr/99")
            self.assertEqual(self.git(["branch", "--show-current"], self.repo), "main")
            self.assertEqual(self.git(["status", "--porcelain"], self.repo), "")
            html = subprocess.check_output(["git", "show", f"{P.BRANCH}:docs/concepts/littlewild/littlewild.html"], cwd=self.remote)
            self.assertEqual(P.digest(html), P.HTML_SHA)
            self.assertEqual(self.git(["show", f"{P.BRANCH}:native.txt"], self.remote), "native game remains unchanged")
            changed = self.git(["diff", "main", P.BRANCH, "--name-only"], self.remote).splitlines()
            self.assertTrue(P.safe_staged_paths(changed))
            P.publish(self.repo, FILES)
            self.assertEqual(first, self.git(["rev-parse", P.BRANCH], self.remote))
            self.assertEqual(len(self.git(["worktree", "list", "--porcelain"], self.repo).split("worktree ")) - 1, 1)
            for call in self.calls:
                if call[:2] == ["git", "push"]:
                    self.assertNotIn("--force", call)
                    self.assertEqual(call[-1], f"HEAD:refs/heads/{P.BRANCH}")
            self.assertIn(["gh", "pr", "ready", "99", "--repo", P.REPOSITORY], self.calls)


if __name__ == "__main__":
    unittest.main(verbosity=2)
