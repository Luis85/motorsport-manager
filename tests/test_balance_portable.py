"""Portable publication and Windows mutex contracts exercised on every host."""

from __future__ import annotations

import os
import stat
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))
import balance_authoring as authoring
import balance_windows as windows


class PortablePublicationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name) / "config"
        self.root.mkdir()
        self.manifest = self.root / "pack.json"
        self.manifest.write_bytes(b'{"id":"core"}')
        self.target = self.root / "value.json"
        self.original = b'{ "value": 1 }\n'
        self.target.write_bytes(self.original)
        self.other = self.root / "other.json"
        self.other.write_bytes(b'{"value":7}')
        self.snapshot = authoring.Snapshot(self.root)
        self.windows_os = Mock(wraps=os)
        self.windows_os.name = "nt"
        self.mutex = Mock()
        self.mutex.CreateMutexW.return_value = 42
        self.mutex.WaitForSingleObject.return_value = 0
        self.mutex.ReleaseMutex.return_value = True

    def publish(self):
        with (
            patch.object(authoring, "os", self.windows_os),
            patch.object(windows, "kernel32", return_value=self.mutex),
        ):
            authoring.publish(self.snapshot, "value.json", b'{ "value": 2 }\n')

    def assert_clean(self):
        self.assertEqual(
            sorted(path.name for path in self.root.iterdir()),
            ["other.json", "pack.json", "value.json"],
        )
        self.assertEqual(self.manifest.read_bytes(), b'{"id":"core"}')

    def test_windows_dispatch_uses_mutex_and_atomically_publishes_one_file(self):
        with patch.object(authoring, "publish_directory") as posix:
            self.publish()
            posix.assert_not_called()
        self.assertEqual(self.target.read_bytes(), b'{ "value": 2 }\n')
        self.assertEqual(self.other.read_bytes(), b'{"value":7}')
        self.mutex.WaitForSingleObject.assert_called_once_with(42, 15000)
        self.mutex.ReleaseMutex.assert_called_once_with(42)
        self.mutex.CloseHandle.assert_called_once_with(42)
        self.windows_os.replace.assert_called_once()
        source, destination = self.windows_os.replace.call_args.args
        self.assertEqual(source.parent, self.target.parent)
        self.assertEqual(destination, self.target)
        self.assert_clean()

    def test_flush_or_replace_failure_preserves_source_and_unlocks(self):
        for operation in ("fsync", "replace"):
            with self.subTest(operation=operation):
                self.windows_os = Mock(wraps=os)
                self.windows_os.name = "nt"
                getattr(self.windows_os, operation).side_effect = OSError(operation + " failed")
                self.mutex.reset_mock()
                with self.assertRaisesRegex(OSError, operation + " failed"):
                    self.publish()
                self.assertEqual(self.target.read_bytes(), self.original)
                self.mutex.ReleaseMutex.assert_called_once_with(42)
                self.mutex.CloseHandle.assert_called_once_with(42)
                self.assert_clean()

    def test_concurrent_other_file_change_during_flush_preserves_latest_data(self):
        def concurrent(handle):
            os.fsync(handle)
            self.other.write_bytes(b'{"value":99}')

        self.windows_os.fsync.side_effect = concurrent
        with self.assertRaisesRegex(ValueError, "changed"):
            self.publish()
        self.assertEqual(self.other.read_bytes(), b'{"value":99}')
        self.assertEqual(self.target.read_bytes(), self.original)
        self.windows_os.replace.assert_not_called()
        self.mutex.ReleaseMutex.assert_called_once_with(42)
        self.mutex.CloseHandle.assert_called_once_with(42)
        self.assert_clean()

    def test_failed_mutex_acquisition_cannot_publish_or_change_manifest(self):
        self.mutex.WaitForSingleObject.return_value = 258
        with self.assertRaisesRegex(TimeoutError, "Timed out"):
            self.publish()
        self.assertEqual(self.target.read_bytes(), self.original)
        self.windows_os.replace.assert_not_called()
        self.mutex.ReleaseMutex.assert_not_called()
        self.mutex.CloseHandle.assert_called_once_with(42)
        self.assert_clean()

    def test_abandoned_mutex_rechecks_latest_config_before_publication(self):
        self.mutex.WaitForSingleObject.return_value = 128
        self.other.write_bytes(b'{"value":99}')
        with self.assertRaisesRegex(ValueError, "changed"):
            self.publish()
        self.assertEqual(self.target.read_bytes(), self.original)
        self.mutex.ReleaseMutex.assert_called_once_with(42)
        self.assert_clean()

    @unittest.skipUnless(os.name == "posix", "POSIX mode bits")
    def test_portable_replacement_preserves_existing_posix_permissions(self):
        self.target.chmod(0o640)
        self.snapshot = authoring.Snapshot(self.root)
        self.publish()
        self.assertEqual(stat.S_IMODE(self.target.stat().st_mode), 0o640)


if __name__ == "__main__":
    unittest.main()
