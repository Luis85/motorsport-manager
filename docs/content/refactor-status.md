# Data-driven refactor: implementation status

This continuation builds on PR #24 source commit
`4234c71be310585aedbdda53fa786a48a581cce1`. It is an incremental implementation,
not a declaration that the complete original plan is done.

| Work package | Delivered foundation | Remaining gate |
|---|---|---|
| DD-00 Inventory | Per-family content guides and explicit runtime contracts | Exhaustive literal/consumer coverage inventory and classifications |
| DD-01 Content boundary | Strict bounded packs, schemas, provenance, typed vehicles and external discovery | Retain regression gates as families expand |
| DD-02 Field | Separate teams/drivers/rosters, stable ownership, fourteen-car example | Existing targeted tests retained |
| DD-03 Tyres/setup | Arbitrary compound IDs, allocations, thermal profiles and setups | Audit the remaining wheel operating coefficients versus hard safety limits |
| DD-04 Mechanics/weekends | Shared fuel, service, weather/surface, operations, competition/rival tuning and weekend presets | General registered-provider profile selection, remaining consumer audit |
| DD-05 Editor/content | Shared circuit catalog, original track files, external styles, ordinary editor transactions and complete-weekend scenario briefs | Legacy diagnostic scenario collections, placement presets and guide/presentation text |
| DD-06 Continuation | Frozen supported definitions, circuit/style snapshots and scenario context; exact persisted number decoding | Extend the same contract to any subsequently migrated families |
| DD-07 Authoring | Init, clone, validate, inspect, schemas, list, resolved export, diff and bounded scenario test | General multi-pack CLI selection and explicit future-version migrations |
| DD-08 Acceptance | Registered domain/native tests and Linux debug/release exported-runtime acceptance | Complete final-source six-shard regression, performance comparison, and remote CI |

## Scope of this continuation

The saved-number fix does not change hashes or round physics. Circuit authoring
uses the existing TrackDocument schema and transaction owner. Scenario selection
stages an existing weekend rather than introducing a second scenario simulator.
A bounded CLI segment explicitly distinguishes successful execution from a whole
weekend or balance test. See the linked family guides for commands and limits.

Built-in and old direct APIs remain compatible. Do not replace retained sporting
expected values to make a refactor pass. New tests are registered alongside the
existing monotonic suite floor, not substituted for it.

## Publication

A local source/patch handover is not evidence that GitHub was updated. Check the
actual PR head before publishing, and do not force-push over concurrent work.
This increment must remain a draft until its remaining work and complete-source
release gates are satisfied. No merge is authorized by this document.
