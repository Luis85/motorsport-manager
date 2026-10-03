"""Windows job-gated launch: no engine can start before the parent establishes ownership."""

import os
import subprocess
import sys


def main() -> int:
    # Read exactly one byte without Python buffering or consuming request JSON.
    # AssignProcessToJobObject precedes this gate in the parent. Descendants inherit
    # that job; the bootstrap never requests CREATE_BREAKAWAY_FROM_JOB.
    if os.read(sys.stdin.fileno(), 1) != b"\0":
        return 2
    process = subprocess.Popen(
        sys.argv[1:], stdin=sys.stdin.buffer, stdout=sys.stdout.buffer, stderr=sys.stderr.buffer
    )
    return process.wait()


if __name__ == "__main__":
    raise SystemExit(main())
