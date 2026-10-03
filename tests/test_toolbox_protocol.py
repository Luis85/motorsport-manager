"""Validate transport identity and finite JSON without duplicating gameplay rules."""

import copy
import math
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import toolbox_protocol as protocol


class ToolboxProtocolTests(unittest.TestCase):
    def setUp(self):
        self.sent = protocol.request("weekend.command", "weekend-a", {"action": "pace"}, "r17")
        self.metadata = {
            "engine_executed": True,
            "engine": "actual fixture",
            "source_revision": "c" * 40,
            "source_digest": "d" * 64,
        }
        self.response = {
            key: self.sent[key]
            for key in ("protocol", "version", "request_id", "operation", "session")
        }
        self.response.update(ok=True, result={"detached": [1, "Ω"]}, metadata=self.metadata)

    def test_correlated_response_retains_native_json_and_metadata(self):
        self.assertEqual(protocol.response(self.response, self.sent, self.metadata), self.response)

    def test_bad_correlation_never_becomes_a_gameplay_verdict(self):
        for field, value in [
            ("protocol", "foreign"),
            ("version", True),
            ("version", 1.0),
            ("request_id", "r18"),
            ("operation", "weekend.snapshot"),
            ("session", "other"),
        ]:
            with self.subTest(field=field, value=value):
                wrong = dict(self.response, **{field: value})
                with self.assertRaisesRegex(protocol.ToolboxError, "correlation"):
                    protocol.response(wrong, self.sent, self.metadata)

    def test_false_execution_or_foreign_startup_identity_is_rejected(self):
        for field, value in [
            ("engine_executed", 1),
            ("engine_executed", False),
            ("engine", "foreign"),
            ("source_revision", "foreign"),
            ("source_digest", "foreign"),
        ]:
            wrong = copy.deepcopy(self.response)
            wrong["metadata"][field] = value
            with self.assertRaises(protocol.ToolboxError):
                protocol.response(wrong, self.sent, self.metadata)

    def test_success_and_rejection_shapes_are_explicit(self):
        for wrong in [
            dict(self.response, ok=1),
            dict(self.response, error={}),
            {key: value for key, value in self.response.items() if key != "result"},
        ]:
            with self.assertRaises(protocol.ToolboxError):
                protocol.response(wrong, self.sent, self.metadata)
        rejected = dict(self.response, ok=False)
        rejected.pop("result")
        rejected["error"] = {"code": "DOMAIN_REJECTED", "message": "Owner rejection", "details": {}}
        self.assertIs(protocol.response(rejected, self.sent, self.metadata), rejected)
        error = protocol.ToolboxDomainError(rejected)
        self.assertEqual(error.code, "DOMAIN_REJECTED")
        self.assertEqual(error.response, rejected)
        rejected["error"]["details"] = []
        with self.assertRaises(protocol.ToolboxError):
            protocol.response(rejected, self.sent, self.metadata)

    def test_json_overflow_duplicate_keys_cycles_and_nonstring_keys_fail_closed(self):
        for raw in [b'{"a":1,"a":2}', b'{"a":NaN}', b'{"a":1e999}', b"\xff", b"{bad"]:
            with self.assertRaises(protocol.ToolboxError):
                protocol.decode(raw)
        cyclic = []
        cyclic.append(cyclic)
        for value in [
            cyclic,
            {1: "cannot silently rename"},
            {"nested": {False: 3}},
            {"a": math.nan},
            {"a": math.inf},
            object(),
        ]:
            with self.assertRaises(protocol.ToolboxError):
                protocol.encode(value)

    def test_bound_is_encoded_utf8_bytes(self):
        with patch.object(protocol, "MAX_BYTES", 10):
            self.assertEqual(protocol.decode(protocol.encode("ΩΩΩΩ")), "ΩΩΩΩ")
            with self.assertRaises(protocol.ToolboxError):
                protocol.encode("ΩΩΩΩΩ")

    def test_request_ids_and_versions_are_bounded_without_game_rule_validation(self):
        for field, value in [
            ("request_id", ""),
            ("request_id", "r" * 65),
            ("request_id", "space id"),
            ("request_id", "a/b"),
            ("session", "a/b"),
            ("session", "../valid-as-process-id"),
            ("version", True),
            ("arguments", []),
        ]:
            wrong = dict(self.sent, **{field: value})
            if field == "session":
                # Process IDs are not paths: a first dot is disallowed; internal dots are legal.
                pass
            with self.assertRaises(protocol.ToolboxError):
                protocol.validate_request(wrong)
        # Actual sporting bounds are validated by the native owner, never Python.
        protocol.request("weekend.step_ticks", "w", {"count": -5}, "valid.r-1")

    def test_timeout_is_finite_positive_and_not_a_boolean(self):
        for value in [0, -1, math.nan, math.inf, True, "30"]:
            with self.assertRaises(ValueError):
                protocol.positive_timeout(value)
        self.assertEqual(protocol.positive_timeout(0.1), 0.1)


if __name__ == "__main__":
    unittest.main()
