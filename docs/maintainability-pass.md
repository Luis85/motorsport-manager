# Maintainability pass after PR #19

PR: https://github.com/Luis85/motorsport-manager/pull/20
Branch: `refactor/race-system-maintainability`, targeting `main`.

## Source and reproducible baseline

Inspected main `2511fa3ae284f97d0465ba58a2a272fd235ea7f3`, source tree
`9cd1451c5d9eb809fa6979fc92b15b357a78c9cf`. Main's Godot verification
run **357 / 36363390583** completed successfully. This is baseline evidence,
not verification of this branch. Version 0.19.0 and Godot 4.7.2 Standard remain
unchanged.

The local source was obtained from main's existing source-package artifact
10946318087 after direct Git DNS/network access failed. Its reconstructed Git
tree matches main exactly. Its verification source digest also matches both
retrieved baseline shard reports:
`7ba2c1e4e7f020a69a9b781310becb84e8bccf5d7523246af193f9e0488fe842`.
No local user work existed. Initial preflight: 37 Python tests discovered,
35 passed and two explicitly skipped because Godot is not installed; architecture
guard passed 175 scripts. A missing local engine is not a runtime pass.

## Ownership after this pass

- `RaceSim`: authoritative entrants, fixed-step coordination, accepted base
  commands, aggregate invariants and reconstruction. Ordered `RaceMechanics`
  providers own strategy/weather/recovery/practice rules; supported profiles
  extend RaceSim directly. These PR #19 migrations remain complete.
- `RaceCheckpoint.prepare_base`: detached legacy base-envelope/data preparation;
  `RaceCheckpoint.valid`: semantic checkpoint policy; `RaceCar`: structural record
  codec. Complete acceptance remains in `RaceSim.restore` and profile-specific
  readers, which retain version/state checks and installed composition.
- Application commands/queries/runners: command routing, detached observations,
  scheduling, replay binding, entry persistence and session lifetime. Native
  views receive handles, not authoritative simulations or clocks.
- `TrackEditorSession`: canonical document, revision-bound transactions, bounded
  history, compilation, preview scheduling and injected storage. It invokes pure
  document policies but remains the sole transaction/mutation owner.
- `TrackDocument`: editable-draft and publication contracts, bounded serialized
  values and existing track validation. `TrackEdit` transforms drafts;
  `TrackGeometry` owns the unchanged compilation algorithms. Views interpret
  pointers, selection and temporary gestures, not a second canonical document.
- `scripts/verification_suites.json`: single runtime test registry;
  `verify.py`/`verification_run.py`/`verification_process.py`: isolated execution,
  error detection, owned-process cleanup and source-bound aggregate evidence.
  `mechanics validate` delegates to this infrastructure.

## Initial assessment at main and selected changes

| Finding | Evidence / classification at inspected main | Implemented response / verification |
|---|---|---|
| Generated-code tests had a different engine-error policy | Verified gap: `test_generated_noop_loads_and_runs_in_real_godot` used `subprocess.run` and rejected only `SCRIPT ERROR`; the runner also rejected Parse Error and ERROR and cleaned up owned process families | Generated execution now uses `verify.run_phase`; zero-exit error fixtures preserve failure logs and fail closed |
| Presentation authority could bypass the guard through a preload alias | Verified guard gap: identifiers rejected `RaceSim`, but UI-to-domain literal references allowed an aliased aggregate or scheduler | Same forbidden-owner policy resolves literal source paths; adversarial preload/extends fixtures and allowed pure-value cases |
| No focused mechanic-validation command or explicit typed-car scaffold probe | Improvement opportunity: list/hooks/scaffold existed; the real fixture selected step/snapshot/weather_advice | `validate` selects registered construction and inactive-extension tests, including actionable catalog/registration errors. Generated fixture adds typed-car hooks, preserving inactive defaults and overwrite/rollback protection |
| Pure document rules were embedded in application transactions | Cohesion opportunity: `TrackEditorSession.draft_errors`/`_serializable`, with repeated draft-then-publication validation | Existing `TrackDocument` now owns these policies. No extra forwarding service. Error order, limits and legacy normalization remain unchanged. Pure, session, native rejection and running-track isolation tests extend existing suites |
| Legacy preparation was embedded in aggregate reconstruction | Cohesion opportunity: `RaceSim.restore` mixed base v1-v3 preparation with semantic validation and entrant installation | Move only detached preparation into `RaceCheckpoint`; pass default/compound values rather than an aggregate. Reconstruction remains unchanged. Direct tests cover migration, input/default isolation, rejection and profile readers |
| Broad diagnostic queries copy records and reconstruct entrants repeatedly | Measurement opportunity, not an isolated root-cause diagnosis: `RaceViewQuery.cars`, `car_position`, `pit_status` versus focused projections | Retain correctness-first projections. Record separate populated query, simulation, rendering and compilation evidence. Do not add a cache or attribute whole-refresh cost to one operation without profiling |

## Compatibility controls

No new player action, screen, meter, gameplay system, schema/model version or
physics coefficient. The minimal toolbar/timing/circuit/pitwall/cards and complete
physical weekend remain protected. Stress stays a read-only demand estimate.
No changes to fixed-step arithmetic, random-draw order, fuel units or the 24 pinned
sporting hashes. Nested owned records remain dictionaries where appropriate.

Track validation was moved in the original statement order; migration preparation
was moved with only owner/parameter/rejection-return substitutions. The remaining
aggregate reconstruction is byte-identical. Static source checks are supporting
evidence, not substitutes for Godot execution. No new UID, scene, dependency or
verification registry is introduced.

Commands retain their existing domain validation and Boolean/error boundary.
Accepted-command recording and replay formats are unchanged. No parallel command
API was created merely for organizational symmetry. Save adapters, initial-save
replacement protection, editor failed-write retention and sandbox isolation keep
their existing owners and regression coverage.

## Published implementation ledger

| Commit | Increment |
|---|---|
| `140f032a7ec49919c9a229fe6aa528baeb417995` | Bounded assessment from actual main |
| `8e9028cdeb5c24e1cef62b13ebf06e723a51c603` | Literal presentation-authority guard and adversarial fixtures |
| `17530346106d82c3a37fd90c90cbda9054491a22` | Mechanic validation command, shared runner policy and typed-car authoring fixture |
| `4bb60aa106d3217b33f4cd884cb36fd2da55207b` | Track draft/publication ownership, editor/native/isolation regressions |
| `bfbc7094ad8b84b216421f763dd941df3cd00579` | Detached checkpoint preparation and direct migration regressions |

The subsequent documentation/evidence increment adds separate editor compilation
measurements to the existing editor-session suite, updates the ownership and
authoring guides, and preserves this handoff. The PR head identifies that increment;
a document cannot embed the hash of the commit containing itself.

## Measurements and optimization decision

Baseline evidence: run 36363390583, main/tree/digest above; downloaded artifacts
10947040823 (shard 0) and 10947441869 (shard 2). Engine: 4.7.2-stable official;
Ubuntu 24.04 hosted runners, GL Compatibility, `LP_NUM_THREADS=2`. Shard 0 reports
AMD EPYC 9V74; shard 2 reports AMD EPYC 7763 and llvmpipe LLVM 20.1.2. Different
shards/machines/workloads are not a paired performance experiment.

| Boundary and actual workload | Baseline observation | Interpretation |
|---|---|---|
| Query only: `ui_polish_tests`, two managed-driver read-model capture after 240 executed steps, 200 samples | Median 0.192 ms; p95 0.205 ms; max 1.265 ms | Focused projection, not whole-UI cost; repeated observation also checks state/RNG noninterference |
| Diagnostic UI refresh: `workspace_performance`, three actual runs per managed driver, 10,916 preparation steps, 1,000 journal entries, then disclosed paused race fixture; 40 samples/panel | Strategy/weather/recovery/practice/debrief medians 51.862/48.775/48.250/53.170/59.108 ms | A worthwhile profiling target; does not isolate record-copy, validation, layout or formatting cost |
| Simulation only: same populated workspace fixture, 1,000 executed fixed steps / 50 simulated seconds | 6.224613 wall seconds; exact outcome recorded | Not rendering time or a promised real-time multiplier |
| Rendering/frame wait: `ui_smoke`, paused race, 45 camera frames on software renderer | Median 67.136 ms; p95 92.545 ms; zero static rebuilds/draw reissues | Includes frame waiting; not query or simulation timing and not representative-device FPS |
| Editor compilation | Baseline suite did not emit a separate compile distribution | Candidate editor-session report now records one warmup plus five serial samples for preview and full compilation, separately reporting application and existing compile-observation costs |

No query, cache, rendering or simulation optimization is claimed. The candidate's
production implementation source is commit `bfbc7094ad8b84b216421f763dd941df3cd00579`,
tree `34ae83ef2a58c2764809520fe64ab2976a8a77b6`; the following test/docs increment does
not alter production logic. Candidate measurements must be read with the **exact
published head** and source digest in its own verification artifacts. Pending
measurements are not filled with baseline numbers. Compare matching workloads,
state hashes, engine and runner hardware before making any performance claim.

A focused allocation/profile study of broad diagnostic refresh is deferred. A
cache would need explicit invalidation for pause, phase, restore, driver selection
and disposal. No live references were exposed to avoid copy cost. The new editor
measurement is diagnostic, has no timing assertion and does not imply a speedup.

## Verification and current handoff

Implementation checklist:

- [x] Inspect actual main, instructions, ownership, registry and baseline CI.
- [x] Publish guard/tooling changes with focused Python regressions.
- [x] Extract track policy and add pure/native/running-track regression cases.
- [x] Extract checkpoint preparation and add direct migration/profile tests.
- [x] Record baseline measurements and explicit comparison/attribution limits.
- [x] Update architecture, mechanic authoring and editor ownership guides.
- [ ] Obtain successful exact-final-head hosted aggregate and inspect its native screenshots.

Latest available local preflight: **45 Python tests discovered; 43 passed; two
Godot-dependent tests skipped**, architecture guard passed all 175 scripts, and
`git diff --check` passed. A prior run hit the existing process-family fixture's
readiness-output assertion before its three-second timeout. The isolated runner
suite and subsequent full suite passed unchanged; the transient cause was not
established. No timeout or assertion was relaxed. Local engine/import/runtime,
native interaction and export results are not available in this environment.

The existing hosted workflow runs fresh import/script-load, Python preflight and
all 64 registered suites in six shards. It is the runtime verification path for
this session. Final exact-head status and artifact links belong to PR #20; earlier
heads, partial/cancelled shards and historical baseline successes are not a full
pass. Keep the PR draft until its current-head gate and native review are complete.

Reproduce from a normal clone on this branch, with the pinned editor:

```sh
python3 -m unittest discover -s tests -p 'test_*.py'
python3 scripts/check_architecture.py
python3 scripts/mechanics.py validate --dry-run
LP_NUM_THREADS=2 python3 scripts/mechanics.py validate --godot /path/to/pinned/godot
python3 scripts/verify.py --list-suites
LP_NUM_THREADS=2 python3 scripts/verify.py --godot /path/to/pinned/godot \
  --suite mechanics_tests --suite editor_session_tests --suite car_record_tests
LP_NUM_THREADS=2 python3 scripts/verify.py --godot /path/to/pinned/godot
```

Inspect the existing native `ui_smoke` editor workflow, including the new
`17-editor-draft-rejection.png`, plus current-head minimal/welcome/end captures
at 1440x900 and 1100x720 with 100%, 115% and 130% text. Preserve all diagnostic
layouts and the complete physical weekend. `editor_session_tests` records compile
measurements; `ui_polish_tests`, `workspace_performance` and `replay_performance`
retain their distinct read/simulation/rendering workloads. Verify the 24 pinned
checkpoints and exact six-shard aggregate before declaring full completion.

## Deliberately deferred

No hot swapping, script discovery, ECS, untrusted-mod sandbox, new context
framework, bulk entity conversion, broad command API rewrite, geometry/racing-line
algorithm change, UI redesign or campaign work. Do not extract aggregate movement
or phase coordination merely to shorten a file; a narrower invariant-preserving
boundary needs separate evidence. Windows/export, controllers, screen readers,
cross-platform determinism and human usability remain separate acceptance work.
