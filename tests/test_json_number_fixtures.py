"""Verify the independent numerical corpus without credential-like field names."""
from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
import re
import struct
import sys
import unittest

FIXTURE = Path(__file__).parent / "fixtures" / "json_number_cases.json"
DECIMAL = re.compile(r"-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?\Z")
# Ordered input/expected-byte pairs, captured before the field-only rename.
REFERENCE_DIGEST = "4e9cc50bbd28d6a34f6d2b9014661b39c1fdaf5d2242cac0eeb2fdd7d5a9c467"


class JsonNumberFixtureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.cases = json.loads(FIXTURE.read_text(encoding="utf-8"))

    def test_corpus_uses_exact_descriptive_fields(self) -> None:
        self.assertIsInstance(self.cases, list)
        self.assertEqual(len(self.cases), 544)
        for index, case in enumerate(self.cases):
            with self.subTest(case=index):
                self.assertIsInstance(case, dict)
                self.assertEqual(set(case), {"decimal_literal", "bits"})
                self.assertIsInstance(case["decimal_literal"], str)
                self.assertIsInstance(case["bits"], str)

    def test_inputs_are_finite_decimal_numbers(self) -> None:
        for index, case in enumerate(self.cases):
            with self.subTest(case=index):
                self.assertRegex(case["decimal_literal"], DECIMAL)
                self.assertTrue(math.isfinite(float(case["decimal_literal"])))
                self.assertRegex(case["bits"], r"^[0-9a-f]{16}$")

    def test_expected_bits_match_independent_python_conversion(self) -> None:
        for index, case in enumerate(self.cases):
            with self.subTest(case=index):
                expected = struct.pack("<d", float(case["decimal_literal"])).hex()
                self.assertEqual(case["bits"], expected)

    def test_reference_pairs_and_order_are_unchanged(self) -> None:
        pairs = [[case["decimal_literal"], case["bits"]] for case in self.cases]
        payload = json.dumps(pairs, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
        self.assertEqual(hashlib.sha256(payload).hexdigest(), REFERENCE_DIGEST)

    def test_numerical_boundaries_remain_in_the_corpus(self) -> None:
        actual = {case["bits"] for case in self.cases}
        for value in (0.0, -0.0, sys.float_info.max, sys.float_info.min, math.ulp(0.0)):
            with self.subTest(value=value):
                self.assertIn(struct.pack("<d", value).hex(), actual)


if __name__ == "__main__":
    unittest.main()
