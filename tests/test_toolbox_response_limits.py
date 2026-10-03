"""Real child-process framing at response-size boundaries, including Windows CRLF."""

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import toolbox_process
from toolbox_process import ToolProcess
from toolbox_protocol import ToolboxError


class ToolboxResponseLimitTests(unittest.TestCase):
    def child(self, payload, delimiter=b"\r\n"):
        code = (
            "import sys; sys.stdout.buffer.write("
            + repr(b"TOOLBOX_RESULT " + payload + delimiter)
            + "); sys.stdout.buffer.flush()"
        )
        return ToolProcess([sys.executable, "-u", "-c", code], Path.cwd(), dict(os.environ), 10)

    def test_exact_payload_budget_excludes_marker_and_crlf(self):
        payload = b'"' + b"x" * 126 + b'"'
        with patch.object(toolbox_process, "MAX_RESPONSE_BYTES", 128):
            child = self.child(payload)
            try:
                self.assertEqual(child.read("TOOLBOX_RESULT"), "x" * 126)
                child.close()
            finally:
                child.close(graceful=False)

    def test_oversized_payload_fails_even_when_marker_fits_the_line_budget(self):
        # LF is one byte shorter than CRLF; the payload check must still reject overflow.
        payload = b'"' + b"x" * 127 + b'"'
        with patch.object(toolbox_process, "MAX_RESPONSE_BYTES", 128):
            child = self.child(payload, b"\n")
            try:
                with self.assertRaises(ToolboxError) as caught:
                    child.read("TOOLBOX_RESULT")
                self.assertEqual(caught.exception.code, "PROTOCOL_ERROR")
            finally:
                child.close(graceful=False)
