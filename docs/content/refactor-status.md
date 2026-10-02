# Data-driven refactor: implementation status

PR #24 was merged into `main` on 30 September 2026. Its exact final source head
`a8428c7` passed the six-shard Godot aggregate, content/exported-runtime,
runtime-confidence and Linux/Windows debug/release build and native-smoke gates.
The merge introduced no file changes. The table retains scope-specific follow-up
work; passing automation does not establish human usability or broad balance.
See [current project status](../current-state.md) for the current player-facing boundary.

| Work package | Delivered foundation | Remaining gate |
|---|---|---|
| DD-00 Inventory | Per-family guides plus machine-checked ownership/classification for every published schema leaf and retained content-related literal table/bound | Keep the exact leaf-path snapshot and consumer gate current as contracts expand |
| DD-01 Content boundary | Strict bounded packs, schemas, provenance, typed vehicles and external discovery | Retain regression gates as families expand |
| DD-02 Field | Separate teams/drivers/rosters, stable ownership, fourteen-car example | Existing targeted tests retained |
| DD-03 Tyres/setup | Arbitrary compounds, allocations, thermal/setup profiles; eleven authored wheel operating coefficients and documented invariant/safety classification | Exact-source sporting/runtime acceptance is complete; controlled same-host paired performance remains separate |
| DD-04 Mechanics/weekends | Shared fuel, service, environment, operations, competition/rival tuning; registered-provider profiles frozen into weekends/replay; current published fields mapped to production consumers | New stateful provider implementations still require versioned code readers and inventory entries |
| DD-05 Editor/content | Shared circuit catalog, original track files, external styles, ordinary editor transactions, complete-weekend scenario briefs, six bounded file-backed diagnostic collections with gallery metadata, and bounded editor placement/guide profiles | Automate stale-preset and native guide/placement regression with each future profile change |
| DD-06 Continuation | Frozen supported definitions, circuit/style snapshots and scenario context; exact persisted number decoding | Extend the same contract to any subsequently migrated families |
| DD-07 Authoring | All authoring operations; ordered multi-pack selection, cross-pack cloning, side-specific diff dependencies, safe failed-write cleanup and explicit version incompatibility diagnostics | Real converters when an actual subsequent format is defined; none is fabricated for hypothetical versions |
| DD-08 Acceptance | Registered domain/native tests and Linux debug/release exported-runtime acceptance | Exact-source six-shard/remote CI completed; same-host paired performance and human playtesting remain separate |

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
Historical publication requirement: this work remained draft until the exact-head
release gates were satisfied. That condition was met before PR #24 merged.
Future changes require their own exact-source gates; this historical note is not a
new authorization to merge an unverified maintenance PR.

## Review and hardening changes

The authoring bridge validates engine-result type/status, distinguishes authored
text from engine diagnostics, and rejects non-finite protocol numbers. Resolved
diffs distinguish booleans from numbers. New-file writes pre-serialize, exclusively
create, flush and synchronize; failures clean up only the file they created.
Schema check-only no longer creates output directories. The decimal regression
corpus uses `decimal_literal` instead of a misleading credential-like field name;
all 544 numerical inputs and expected bit patterns are unchanged. No secret-scan
ignore or history rewrite is introduced. A historical scanner incident must be
triaged in the scanner, not silently declared resolved by a source edit.

The content workflow also runs the Python authoring tests with its real pinned
engine and retains source/tree identity independently of later test success.
Focused local results are not a substitute for the final six-shard aggregate.
The PR comment/check runs record exact final-source evidence after execution.

Known scope is deliberately still visible: the machine-checked consumer inventory
covers every published content-schema leaf plus deliberately retained content-related
compatibility/safety literal tables and bounds; it is an ownership audit, not a claim
that every numeric literal elsewhere in unrelated simulation/UI code should become content. Editor
placement presets and contextual guide copy now use an authoring-only profile;
code retains every target/reveal action and the renderer type allow-list. The
developer diagnostic collections remain bundled verification resources with their
own validated presentation metadata, rather than a new executable external-pack format. The completed-wheel classification is not represented
as an audit of every other subsystem. Windows native exported-runtime execution passed on the exact PR #24 head.
Human playtesting is still a separate product-validation activity.

New source/test files remain within the code-line budgets. Existing oversized
files remain visible (including RaceSim, which receives frozen-profile plumbing);
no blanket quality exclusions or adjusted sporting checkpoints are added.

## Final hardening follow-up

The consumer inventory now pins **the exact sorted schema leaf paths** for all
published families as well as their ownership prefixes. New nested fields cannot
slip in under an existing broad prefix without changing the reviewed snapshot.

Bundled diagnostic collections now validate each known recipe family and reject an
entire malformed collection, including unknown top-level/recipe/dry-plan fields.
Circuit Atelier resolves cached placement choices from the current validated
profile whenever its inspector refreshes; a removed preset cannot continue to
place an obsolete renderer or stale transform. Registered native UI checks cover
actual placements, single-step undo/redo, layer locks and long guide content at
1440×900/1100×720 in normal and enlarged text. These are regression controls;
they do not constitute a manual accessibility or playtesting sign-off.
