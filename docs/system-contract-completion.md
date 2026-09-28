# System contract completion

## Baseline and scope

Continue after merged PR #20 from main `cfe351b0054f72c3e504c5e9c8c00f3ada82d5b7`,
tree `5c561c906f6620bc5fade1ff9782159b47f2c64f`. Its source-identical PR run
#370 (`36389424323`) passed six shards and the aggregate gate. The new main
run #371 was still running at the first inspection. Those are baseline results,
not verification of this continuation.

Local artifact reconstruction matched that exact tree. Baseline Python:
45 tests, 43 passed, two explicit engine-dependent skips; architecture guard:
175 scripts. The pinned Godot 4.7.2 editor is unavailable locally. Runtime and
native acceptance therefore require actual hosted evidence, not a substitute
Python result. No repository instructions file was present in the inspected tree.

The completed typed aggregate, mechanic composition, weak view handles,
application scheduling, editor transactions and minimal weekend journey remain
the foundation. No new player action, UI surface, save version, simulation
coefficient, geometry algorithm or mechanic is authorized by this pass.

## Initial ownership and concrete findings

These are the inspected starting gaps, not claims that completed increments remain
unimplemented. The checklist below records the current implementation state.

| Boundary | Current owner | Finding and evidence | Disposition |
| --- | --- | --- | --- |
| Authoritative commands | `RaceSim.command`, ordered providers | The aggregate dispatches caller dictionaries without checking their serialization shape. `RaceCommands.execute` deep-copies before any check. Accepted base commands and practice input signals copy the payload into records; an otherwise valid command with an Object or cyclic extra value can reach these paths. | Validate before copying/dispatch, then detach once at the aggregate boundary. Domain-specific permission, phase and resource checks remain in their owners. Add rejection/noninterference and caller-isolation regressions. |
| Structural value decoding | `RaceCar._record_value`, `TrackDocument.serializable` | These implement the same finite-value, key-type, depth and collection-bound traversal independently. This is validation duplication, not a defect in dictionary-owned system records. | Move the existing policy to `RaceStateValue`; retain public editor compatibility and semantic validation in each domain. |
| Extension discovery | `mechanics.py:hook_contracts` | Source inspection assumes dispatch is the first statement of every aggregate hook. A correct pre-dispatch command guard would silently hide the command hook. | Inspect explicit dispatch within its owning function and test guard/comment/identity cases. Continue to use one runtime registry. |
| Predecessor dispatch | `RaceMechanics.before` | A known provider can request an undeclared hook; unknown identity uses an assertion rather than actionable diagnostics. | Reject invalid predecessor identity/hook without invoking sporting code; preserve valid ordering. Static authoring checks cover literal predecessor mistakes; dynamic semantic correctness remains the author's tested responsibility. |
| Atomic persistence | `Storage.write_json` | Rollback is attempted whenever `.bak` exists, even when this attempt never moved an original destination. Backup removal and rollback errors are ignored. Existing application adapters test a returned save failure, not these filesystem steps. | Isolate a narrow injectable filesystem boundary, track whether this attempt preserved the original, propagate recovery errors, and exercise read/write/backup/replace/rollback failures. Keep public storage results and formats. |
| Editor transactions | `TrackEditorSession` and `TrackDocument` | Revision/history/preview ownership and source-versus-running-track isolation already have focused coverage. | Reuse those contracts; add storage failure evidence beneath the existing application adapter rather than another canonical document or new editor tools. |
| Presentation reads | `RaceViewQuery`, narrow minimal/visual projections | Some retained diagnostic methods reconstruct full entities from detached records. This does not justify exposing live cars or guessing a cache. | Inspect source-bound populated baseline/candidate reports. Only optimize if attributable measurements warrant it; otherwise document retention. |

## Compatibility and verification

Valid JSON-shaped commands retain their existing action/payload and replay
records. Invalid structural payloads may update `last_error`, but must not alter
phase, resources, RNG, accepted history or input signals. A provider receives a
call-local detached payload, not authority over the caller's draft. Predecessor
checks are developer diagnostics, never checkpoint fields.

Structural traversal retains the existing bounds and accepted value types; it is
not a state migration. Semantic fields, units, profile restore rules and stock
ownership remain unchanged. Storage keeps its 16 MB bound and recoverable `.bak`
convention; failed writes retain editor work and the last recoverable saved data.

Every coherent increment runs available Python/architecture checks and adds
registered real-Godot regressions. Final evidence must include fresh imports,
script loads, all registered suites, the 24 unchanged sporting checkpoints,
complete physical weekend, editor interactions and actual native screenshots.
The six minimal desktop size/text combinations remain acceptance requirements.
No timeouts, assertions, pinned sporting hashes or suites will be relaxed.

## Resumed inspection: remaining boundary gaps

At `4d25515b34c638282eb25d93b4270b4af034e6ba`, the first three increments below
were already published. Current main verification #371 (`36411038105`) has now
succeeded. The recovered source archive exactly matched tree
`240aea054765a255df798e3ff0fe90f9bf287e67`; local preflight passed 47 of 49
Python tests with two explicit engine-dependent skips. No local Godot was found.

Two concrete follow-up gaps were found before closing this pass:

- `RaceMechanics.configure` recursively freezes arbitrary extra definition fields;
  cyclic metadata can reach `RaceStateValue.read_only` without its structural
  preflight. `install` similarly copies unchecked options before providers run.
  Use the existing shared value policy before either operation, retain retry after
  rejected proposals, and reject whitespace identities consistently with tooling.
  Metadata remains developer-only, never a schema migration or snapshot field.
- `RaceSim._base_command` coerces scalar targets/modes and Boolean service choices
  before checking their types. Serializability alone does not make an array a
  driver ID or a string a Boolean. Use existing integral validation before casts
  and explicit Boolean validation before mutation. Preserve absent base defaults,
  integral JSON floats, command-record contents and all valid gameplay inputs.
  Previously coerced malformed typed inputs are intentionally rejected; no valid
  command or save format is changed. Every profile gets noninterference fixtures.

These changes are hardening of existing boundaries, not additional mechanics.

## Implementation checklist

- [x] Shared structural validation and command input ownership, with regressions.
- [x] Guard-aware authoring inspection and actionable predecessor diagnostics.
- [x] Injectable atomic persistence with deterministic failure/recovery coverage.
- [x] Close construction/scalar preflight gaps with focused regressions.
- [x] Updated ownership/developer guides and source-bound measurement decision.
- [ ] Exact final-head hosted aggregate, reports, native screenshots and diff review.

## Measurement decision

Baseline main #371 (`36411038105`) is source tree
`5c561c906f6620bc5fade1ff9782159b47f2c64f`, verification SHA-256
`ef061accc6fba8a736de4d9d9cfc89941e46c0ea1416569e3e32425848cdbf14`.
Retained artifacts from that run, not an empty menu, supply these observations:

| Separate workload | Baseline observation | Environment and limitation |
| --- | --- | --- |
| Two-own-driver bounded `RaceReadModel.capture` | 200 samples; median 0.249 ms, p95 0.280 ms | `ui_polish_tests/race-read-performance.json`, shard 0; not a full diagnostic-screen refresh or forecast |
| Populated diagnostic refresh | Strategy median 51.515 ms; debrief 60.091 ms (40 samples each) | `workspace_performance/workspace-performance.json`, shard 2; Godot 4.7.2, EPYC 7763, llvmpipe LLVM 20.1.2, 1440x900/100%; Pinecrest, seed 2026, three real practice runs per driver plus disclosed 1,000-event synthetic journal |
| Simulation only | 1,000 actual fixed steps / 50 simulated seconds in 6.179807 wall seconds | Same workspace fixture; no UI work in the timed loop, not an achieved interactive speed multiplier |
| Monaco diagnostic observations | Watch median 27.479 ms; uncached forecast 3.212 ms | `ux_performance/ux-performance-current.json`, shard 3; EPYC 9V74, same engine/software renderer, 1100x720, 12 cars, seed 7314; 100 refresh / 30 forecast samples |
| Native rendering observation | 45 paused camera frames; median 67.985 ms, p95 93.507 ms; zero static rebuilds/reissues | `ui_smoke/render-performance.json`, shard 2; software-rendered frames, not domain or query cost |

The bounded driver projection is already separate from whole-screen observations.
Expensive populated diagnostic refresh is an opportunity for dedicated attribution,
not evidence that copying alone causes its cost. Those routines include distinct
queries, controls and forecasts. This pass keeps detached projections and adds no
cache, numerical shortcut, skipped tick or thread. No speedup or universal FPS
claim follows from measurements on variable hosted machines. The existing editor
suite separately reports preview/full compilation; its geometry algorithm is
unchanged. Candidate measurements and their exact-source/engine/CPU association
belong in the final PR evidence comment, without mixing revisions into a pass.

## Runtime verification correction

Exact-head PR run #389 (`36421197345`, source `ac7852b70e44060ab5cad5aef6a35c30074a191a2b6466823eaa35da9fe9a342`)
passed fresh import, all 175 script loads and all 49 Python preflight tests in the
first retrieved shard, but six new storage round-trip assertions failed. Their
byte-retention, rollback, editor-revision and decoding checks passed. The failing
checks compared native integer-valued dictionaries directly with parsed JSON
records. Godot documents JSON numeric parsing through `String.to_float`; strict
collection equality does not identify those two native representations.

The storage fixture now states the JSON-native expected types explicitly; the
editor round trip compares the full decoded JSON value plus exact full-precision
serialized bytes. A separate independently authored JSON fixture verifies number,
Boolean and null types, every expected key and array order, and rejects missing,
extra, mistyped and changed data. It also records the native/decoded numeric types
and strict-equality result as executable diagnosis. The production storage format,
writer, reader, domain validators and all recovery assertions are unchanged.
This corrects a test's cross-representation expectation, not the saved data or a
sporting baseline. Final-head runtime evidence must rerun the entire registry.

Reference: https://docs.godotengine.org/en/stable/classes/class_json.html

## Explicit deferrals

No broad movement/phase rewrite merely to shorten `RaceSim`; no runtime discovery,
hot swapping, ECS, threaded simulation, speculative read cache or typed conversion
of valid nested records. Campaign work and any parallel game-flow branch are out
of scope. Windows/export, physical controllers, screen readers, cross-platform
determinism and human usability require separate environments/acceptance and must
not be claimed from Linux CI.

## Reproduction

```sh
python3 -m unittest discover -s tests -p 'test_*.py'
python3 scripts/check_architecture.py
python3 scripts/mechanics.py validate --dry-run
LP_NUM_THREADS=2 python3 scripts/mechanics.py validate --godot /path/to/pinned/godot
LP_NUM_THREADS=2 python3 scripts/verify.py --godot /path/to/pinned/godot --suite mechanics_tests --suite command_contract_tests --suite storage_contract_tests
LP_NUM_THREADS=2 python3 scripts/verify.py --godot /path/to/pinned/godot
```

Final commit identities, focused/complete evidence and any unresolved work are
recorded below or in a source-pinned PR verification comment after the last push.
