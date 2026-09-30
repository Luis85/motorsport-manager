# Persisted numeric identity

The supported Godot 4.7.2 JSON decoder can move a small decimal by an IEEE-754
unit in the last place on successive parses. For example, the decimal
`1.0797002911567688e-09` is not stable under repeated native JSON decoding.
A live tyre grain value can therefore acquire a different replay digest after
writing an otherwise unchanged session.

`Storage.read_json` now uses `ContentJson` with exact numeric conversion for
session, replay, weekend, scenario, reproduction, weekend-result, notebook and
result-receipt envelopes.
`JsonNumber` compares a bounded approximation with exact rational rounding
intervals and uses nearest/ties-to-even conversion, including subnormal values.
Its integer limbs are bounded; it does not evaluate code or load resources.
Unknown formats still use their existing decoder. In particular, ordinary
content and legacy track imports retain their existing numerical contract.

This is a decoding fix, not a new digest or replay version. It does not round
simulation state, repair a failed digest, guess missing content, or change the
record validators. Previously corrupted saved files are not silently recovered.
Those files require their original valid backup.

Verification is `content_persistence_tests`: independent Python-produced binary64
reference bytes; decimal halfway cases; smallest/largest values; repeated file
round trips; an actual moving fourteen-car session; and rejected state/content
tampering. `tests/fixtures/json_number_cases.json` is generated independently of
Godot, using Python binary64 packing and high-precision Decimal halfway cases,
with deterministic seed 7314. The original sporting characterization is retained.

No cross-engine or cross-platform deterministic simulation guarantee is added.

## Numerical fixture field names

The 544 independent reference cases use `decimal_literal` for the input text and
`bits` for the expected little-endian IEEE-754 binary64 bytes. Every input is a
JSON decimal number, including boundary and halfway values; none is a credential.
Keep the input as text so the production decoder, not the fixture reader, performs
the conversion under test.

The original input-field name was `token`, in the lexical-analysis sense. It
triggered GitGuardian incident 37735342 at line 51 of this fixture because the
generic high-entropy detector interprets that assignment name as sensitive. The
flagged number is the largest finite binary64 value. The rename changes no input
digits, expected bytes, ordering, simulation values, or digest algorithms.

`test_json_number_fixtures.py` enforces the descriptive field names and numerical
grammar, independently checks all expected bytes with Python, and pins the ordered
reference pairs to their pre-rename digest. Neither this change nor the test adds
scanner exclusions. The historical incident should be reviewed as **False positive
(not a secret)**, not as a revoked credential. A source-only follow-up commit does
not itself close the historical incident; no history rewrite is needed for this
confirmed numerical fixture.
