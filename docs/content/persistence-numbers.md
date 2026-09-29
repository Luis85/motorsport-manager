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
