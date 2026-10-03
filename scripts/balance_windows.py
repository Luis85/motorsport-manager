"""A Windows session mutex serializes config writers without locking JSON bytes."""

from __future__ import annotations

import contextlib
import ctypes
import hashlib
import os
from ctypes import wintypes
from pathlib import Path


def kernel32():
    api = ctypes.WinDLL("kernel32", use_last_error=True)
    api.CreateMutexW.argtypes = [ctypes.c_void_p, wintypes.BOOL, wintypes.LPCWSTR]
    api.CreateMutexW.restype = wintypes.HANDLE
    api.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
    api.WaitForSingleObject.restype = wintypes.DWORD
    api.ReleaseMutex.argtypes = [wintypes.HANDLE]
    api.ReleaseMutex.restype = wintypes.BOOL
    api.CloseHandle.argtypes = [wintypes.HANDLE]
    api.CloseHandle.restype = wintypes.BOOL
    return api


def mutex_name(root: Path) -> str:
    info = root.stat()
    identity = f"{os.path.normcase(str(root.resolve()))}\0{info.st_dev}:{info.st_ino}"
    return "Local\\MotorsportManagerBalance-" + hashlib.sha256(identity.encode()).hexdigest()


@contextlib.contextmanager
def windows_root_lock(root: Path):
    api = kernel32()
    handle = api.CreateMutexW(None, False, mutex_name(root))
    if not handle:
        raise OSError("Cannot create the Windows config writer mutex.")
    acquired = False
    try:
        # WAIT_ABANDONED is safe: the caller rechecks every root byte and identity
        # before publishing, including after a previous writer terminated.
        outcome = api.WaitForSingleObject(handle, 15000)
        if outcome == 258:
            raise TimeoutError("Timed out waiting for another config writer.")
        if outcome not in (0, 128):
            raise OSError("Cannot acquire the Windows config writer mutex.")
        acquired = True
        yield
    finally:
        try:
            if acquired and not api.ReleaseMutex(handle):
                raise OSError("Cannot release the Windows config writer mutex.")
        finally:
            api.CloseHandle(handle)
