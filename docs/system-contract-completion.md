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

## Ownership and concrete findings

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

## Implementation checklist

- [ ] Shared structural validation and command input ownership, with regressions.
- [ ] Guard-aware authoring inspection and actionable predecessor diagnostics.
- [ ] Injectable atomic persistence with deterministic failure/recovery coverage.
- [ ] Updated ownership/developer guides and source-bound measurement decision.
- [ ] Exact final-head hosted aggregate, reports, native screenshots and diff review.

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
LP_NUM_THREADS=2 python3 scripts/verify.py --godot /path/to/pinned/godot
```

Final commit identities, focused/complete evidence and any unresolved work are
recorded below or in a source-pinned PR verification comment after the last push.
