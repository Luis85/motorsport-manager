"""Current-run artifact provenance, digest and extraction contracts use actual ZIP bytes."""

import copy
import hashlib
import json
import stat
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import download_artifacts as downloader


class ArtifactDownloadTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.source = "a" * 40
        self.run = {"id": 10, "head_sha": self.source, "repository": {"full_name": "owner/game"}}
        self.archive = self.root / "artifact.zip"
        self.zip([("reports/verification.json", b"{}")])

    def zip(self, entries):
        with zipfile.ZipFile(self.archive, "w") as output:
            for name, data in entries:
                output.writestr(name, data)
        return self.metadata()

    def metadata(self, name="verification-shard-0", identity=42):
        return {
            "id": identity,
            "name": name,
            "expired": False,
            "size_in_bytes": self.archive.stat().st_size,
            "digest": "sha256:" + hashlib.sha256(self.archive.read_bytes()).hexdigest(),
            "workflow_run": {"id": 10, "head_sha": self.source},
        }

    def select(self, entries, run=None, names=None):
        return downloader.select_artifacts(
            run or self.run,
            entries,
            "owner/game",
            10,
            self.source,
            names or ["verification-shard-0"],
        )

    def test_exact_current_run_artifact_is_selected(self):
        item = self.metadata()
        self.assertEqual(self.select([item]), [item])

    def test_pr_head_provenance_preserves_distinct_checkout_merge_identity(self):
        merge = "b" * 40
        report = json.dumps({"source_revision": merge, "passed": True}).encode()
        item = self.zip([("verification.json", report)])
        self.assertEqual(self.select([item]), [item])
        downloader.extract(self.archive, self.root / "out", item)
        self.assertEqual(
            json.loads((self.root / "out/verification.json").read_text()),
            {
                "source_revision": merge,
                "passed": True,
            },
        )
        with self.assertRaisesRegex(ValueError, "another"):
            downloader.select_artifacts(self.run, [item], "owner/game", 10, merge, [item["name"]])

    def test_another_source_run_or_repository_is_rejected(self):
        for field, value in [
            ("id", 11),
            ("head_sha", "b" * 40),
            ("repository", {"full_name": "foreign/game"}),
            ("repository", None),
        ]:
            with self.subTest(field=field, value=value):
                run = copy.deepcopy(self.run)
                run[field] = value
                with self.assertRaisesRegex(ValueError, "another"):
                    self.select([self.metadata()], run)
        for field, value in [("id", 11), ("head_sha", "b" * 40), ("id", True)]:
            item = self.metadata()
            item["workflow_run"][field] = value
            with self.assertRaisesRegex(ValueError, "provenance"):
                self.select([item])

    def test_missing_duplicate_expired_or_unidentified_artifact_is_rejected(self):
        for entries in [[], [self.metadata(), self.metadata()]]:
            with self.assertRaisesRegex(ValueError, "Missing or duplicate"):
                self.select(entries)
        for field, value in [
            ("expired", True),
            ("expired", 0),
            ("id", True),
            ("digest", None),
            ("digest", "sha256:wrong"),
            ("size_in_bytes", True),
            ("size_in_bytes", 0),
            ("size_in_bytes", downloader.MAX_BYTES + 1),
        ]:
            item = self.metadata()
            item[field] = value
            with self.subTest(field=field, value=value):
                with self.assertRaisesRegex(ValueError, "provenance"):
                    self.select([item])
        first = self.metadata()
        second = self.metadata("verification-shard-1")
        with self.assertRaisesRegex(ValueError, "identities are duplicated"):
            self.select([first, second], names=[first["name"], second["name"]])

    def test_invalid_request_never_reaches_github(self):
        for repository, source, names in [
            ("../foreign", self.source, ["ok"]),
            ("owner/game", "unknown", ["ok"]),
            ("owner/game", self.source, ["../escape"]),
            ("owner/game", self.source, ["same", "same"]),
        ]:
            with patch.object(downloader, "api") as request:
                with self.assertRaises(ValueError):
                    downloader.download(repository, 10, source, names, self.root / "out")
                request.assert_not_called()

    def test_archive_bytes_and_size_must_match_authenticated_metadata(self):
        item = self.metadata()
        self.archive.write_bytes(self.archive.read_bytes()[:-1])
        with self.assertRaisesRegex(ValueError, "size"):
            downloader.extract(self.archive, self.root / "out", item)
        item["size_in_bytes"] = self.archive.stat().st_size
        with self.assertRaisesRegex(ValueError, "digest"):
            downloader.extract(self.archive, self.root / "out", item)
        self.assertFalse((self.root / "out").exists())

    def test_nested_unicode_files_are_extracted_without_rewriting_bytes(self):
        item = self.zip([("München – Ω/report.json", b'{"passed":true}')])
        downloader.extract(self.archive, self.root / "out", item)
        self.assertEqual(
            (self.root / "out/München – Ω/report.json").read_bytes(), b'{"passed":true}'
        )

    def test_unsafe_paths_fail_before_writing_any_file(self):
        for name in [
            "../escape",
            "/absolute",
            "C:/drive",
            "a/../escape",
            "a//escape",
            "a/./escape",
            "a\\escape",
            "file:stream",
        ]:
            with self.subTest(name=name):
                item = self.zip([("safe", b"valid"), (name, b"bad")])
                with self.assertRaisesRegex(ValueError, "unsafe"):
                    downloader.extract(self.archive, self.root / "out", item)
                self.assertFalse((self.root / "out").exists())

    def test_symlinks_and_case_collisions_are_rejected_on_every_os(self):
        link = zipfile.ZipInfo("link")
        link.create_system = 3
        link.external_attr = (stat.S_IFLNK | 0o777) << 16
        item = self.zip([(link, b"../outside")])
        with self.assertRaisesRegex(ValueError, "unsafe"):
            downloader.extract(self.archive, self.root / "out", item)
        item = self.zip([("Report.json", b"one"), ("report.json", b"two")])
        with self.assertRaisesRegex(ValueError, "duplicate"):
            downloader.extract(self.archive, self.root / "out", item)

    def test_empty_or_oversized_zip_is_not_evidence(self):
        item = self.zip([])
        with self.assertRaisesRegex(ValueError, "empty"):
            downloader.extract(self.archive, self.root / "out", item)
        item = self.zip([("one", b"a"), ("two", b"b")])
        with patch.object(downloader, "MAX_FILES", 1):
            with self.assertRaisesRegex(ValueError, "bounded"):
                downloader.extract(self.archive, self.root / "out", item)

    def test_download_uses_owned_api_endpoint_and_separate_artifact_directories(self):
        first = self.metadata()
        second = self.metadata("verification-shard-1", 43)
        first["archive_download_url"] = "https://foreign.invalid/unsafe"
        calls = []

        def request(endpoint, destination=None):
            calls.append(endpoint)
            if endpoint.endswith("/runs/10"):
                return self.run
            if "/artifacts?" in endpoint:
                return {"total_count": 2, "artifacts": [first, second]}
            destination.write_bytes(self.archive.read_bytes())

        with patch.object(downloader, "api", side_effect=request):
            result = downloader.download(
                "owner/game",
                10,
                self.source,
                [first["name"], second["name"]],
                self.root / "out",
                True,
            )
        self.assertEqual(result["source"], self.source)
        self.assertTrue(
            (self.root / "out/verification-shard-0/reports/verification.json").is_file()
        )
        self.assertTrue(
            (self.root / "out/verification-shard-1/reports/verification.json").is_file()
        )
        self.assertEqual(
            calls[-2:],
            [
                "repos/owner/game/actions/artifacts/42/zip",
                "repos/owner/game/actions/artifacts/43/zip",
            ],
        )

    def test_failure_cannot_publish_partial_or_reuse_old_evidence(self):
        item = self.metadata()

        def request(endpoint, destination=None):
            if endpoint.endswith("/runs/10"):
                return self.run
            if "/artifacts?" in endpoint:
                return {"total_count": 1, "artifacts": [item]}
            destination.write_bytes(b"corrupt")

        output = self.root / "out"
        with patch.object(downloader, "api", side_effect=request):
            with self.assertRaises(ValueError):
                downloader.download("owner/game", 10, self.source, [item["name"]], output)
        self.assertFalse(output.exists())
        output.mkdir()
        with patch.object(downloader, "api") as request:
            with self.assertRaisesRegex(ValueError, "absent"):
                downloader.download("owner/game", 10, self.source, [item["name"]], output)
            request.assert_not_called()

    def test_changing_or_incomplete_paginated_inventory_cannot_download(self):
        for totals in [(101, 102), (1,) * 10]:
            with self.subTest(totals=totals):
                pages = iter(totals)

                def request(endpoint, destination=None, pages=pages):
                    self.assertIsNone(destination)
                    if endpoint.endswith("/runs/10"):
                        return self.run
                    total = next(pages)
                    items = [self.metadata(f"other-{index}", index + 1) for index in range(100)]
                    return {"total_count": total, "artifacts": items if total > 1 else []}

                with patch.object(downloader, "api", side_effect=request):
                    with self.assertRaisesRegex(ValueError, "changing|Incomplete"):
                        downloader.download(
                            "owner/game",
                            10,
                            self.source,
                            ["verification-shard-0"],
                            self.root / "out",
                        )
                self.assertFalse((self.root / "out").exists())

    def test_authentication_is_never_added_to_command_arguments(self):
        with patch.object(downloader.subprocess, "run") as process:
            process.return_value.returncode = 0
            process.return_value.stdout = json.dumps({"id": 10})
            self.assertEqual(downloader.api("repos/owner/game/actions/runs/10"), {"id": 10})
        self.assertEqual(
            process.call_args.args[0],
            [
                "gh",
                "api",
                "--hostname",
                "github.com",
                "--method",
                "GET",
                "repos/owner/game/actions/runs/10",
            ],
        )


if __name__ == "__main__":
    unittest.main()
