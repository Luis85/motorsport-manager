# Maintainability pass after PR #19

## Source and baseline

Inspected main `2511fa3ae284f97d0465ba58a2a272fd235ea7f3`, source tree
`9cd1451c5d9eb809fa6979fc92b15b357a78c9cf`. Main's Godot verification
run **357 / 36363390583** completed successfully. This is baseline evidence,
not verification of this branch. Version 0.19.0 and Godot 4.7.2 Standard remain
unchanged.

The local source was obtained from main's existing source-package artifact
10946318087 after direct Git DNS/network access failed. Its Git tree was
reconstructed and matches the tree above exactly. No local user work existed.
Initial local checks: 37 Python tests, 35 executed successfully, two explicitly
skipped because Godot is not installed; architecture guard passed 175 scripts.
The missing local engine must not be reported as a runtime pass.

## Current ownership map

- `RaceSim`: authoritative entrants, fixed-step coordination, accepted base
  commands and aggregate invariants. Ordered `RaceMechanics` providers own
  strategy/weather/recovery/practice rules; supported profiles extend RaceSim
  directly. These PR #19 migrations are complete.
- `RaceCheckpoint`, `RaceCar`, profile restore readers: semantic checkpoint
  validation, detached structural record codecs and supported profile state.
  Legacy base migration currently remains inside `RaceSim.restore`.
- Application commands/queries/runners: command routing, detached observations,
  scheduling, replay binding, entry persistence and session lifetime. Native
  views receive handles, not authoritative simulations or clocks.
- `TrackEditorSession`: canonical document, revision-bound transactions, bounded
  history, compilation, preview scheduling and injected storage. It also embeds
  recursive serialized-draft validation, including road and metadata rules.
- `TrackDocument`, `TrackEdit`, `TrackGeometry`: pure track contracts, draft
  transformations and compilation algorithms. Views own pointer interpretation,
  selection and temporary gestures, not a second canonical document.
- `scripts/verification_suites.json`: single runtime test registry;
  `verify.py`/`verification_run.py`/`verification_process.py`: isolated execution,
  error detection, owned-process cleanup and source-bound aggregate evidence.

## Findings and selected work

| Finding | Evidence / classification | Change and verification |
|---|---|---|
| Engine-error handling differs between generated-code tests and the normal runner | Verified gap: `test_generated_noop_loads_and_runs_in_real_godot` uses `subprocess.run` and only rejects `SCRIPT ERROR`; `verify.run_phase` also rejects Parse Error and ERROR and uses owned-process cleanup | Use the existing runner/error policy for generated execution; add false-success fixtures and retain bounded execution |
| Presentation authority can bypass the guard through a preload alias | Verified guard gap: identifier checks reject `RaceSim`, but `literal-dependency` allows UI-to-domain paths, including an aliased race aggregate or application scheduler | Resolve forbidden authority classes to their source paths; adversarial literal/preload/extends fixtures; do not claim a reflection sandbox |
| No focused mechanic-validation command; generated regression lacks an explicit typed-car probe | Improvement opportunity: `mechanics.py` supports list/hooks/scaffold only, and the real generated test chooses step/snapshot/weather_advice | Add validation through the existing suite registry and runner, not another runtime registry. Exercise typed-car, scalar and no-argument generated hooks; preserve inactive generation and overwrite/rollback safeguards |
| Draft validation mixes pure document policy with application transactions | Cohesion opportunity: `TrackEditorSession.draft_errors` and `_serializable`; save/exports repeat draft-then-publishable validation | Move existing rules without changing limits, messages or ordering into a pure domain contract. Keep transaction/revision/storage ownership in the session. Focused rule tests plus editor-session/native regression |
| Base checkpoint migration is embedded in aggregate reconstruction | Cohesion opportunity: `RaceSim.restore` contains v1-v4 migration before semantic validation and entrant installation | Move only detached legacy-data preparation to the checkpoint owner; retain aggregate reconstruction, profile readers, versions and values. Exercise direct migration isolation and existing legacy/replay/checkpoint tests |
| Diagnostic queries reconstruct records and repeat broad copies | Measurement opportunity, not a verified performance defect: `RaceViewQuery.cars`, `car_position`, `pit_status` versus focused `MinimalWeekendQuery`/`RaceVisualSource` | Retain correctness-first projections; record populated workload measurements separately from simulation/rendering. No cache or numerical optimization without comparable baseline/candidate evidence |

## Compatibility and risk controls

No new player action, screen, meter, gameplay system, schema/model version or
physics coefficient. The minimal toolbar/timing/circuit/pitwall/cards and complete
physical weekend remain protected. Stress stays the read-only demand estimate.
No changes to fixed-step arithmetic, random-draw order or the 24 pinned hashes.
Owned nested records remain dictionaries where appropriate.

Pure validation/migration extraction risks changing error order, missing defaults,
copy isolation or profile restore composition. Preserve statement order and input
ownership, test the boundary directly, and retain the entire existing corpus.
Tool validation is not proof that an arbitrary new mechanic is correct; real
Godot construction and behavior-specific tests are still required.

## Execution checklist

- [x] Inspect current main, instructions, architecture, registry and baseline CI.
- [x] Establish exact local source identity; run available baseline preflight.
- [ ] Publish tooling/guard hardening with focused Python regressions.
- [ ] Extract pure track draft policy and test editor/running-race isolation.
- [ ] Extract detached checkpoint migration and test preserved restoration.
- [ ] Record measured read-model costs or explicitly retain the measurement gap.
- [ ] Update authoring, architecture and ownership guides.
- [ ] Run exact-head hosted full verification and inspect native evidence.
- [ ] Record final head, checks, screenshots and remaining limitations.

## Deliberately deferred

No hot swapping, script discovery, ECS, untrusted-mod sandbox, new context
framework, bulk entity conversion, broad command API rewrite, geometry/racing-line
algorithm change, UI redesign or campaign work. No optimistic query cache without
measurement. Human usability, controllers, screen readers, Windows exports and
cross-platform determinism are separate acceptance work.

## Verification commands

```sh
python3 -m unittest discover -s tests -p 'test_*.py'
python3 scripts/check_architecture.py
python3 scripts/verify.py --list-suites
LP_NUM_THREADS=2 python3 scripts/verify.py --godot /path/to/pinned/godot \
  --suite mechanics_tests --suite editor_session_tests --suite car_record_tests
LP_NUM_THREADS=2 python3 scripts/verify.py --godot /path/to/pinned/godot
```

Focused/headless runs cannot satisfy the full aggregate gate. Existing native
layout and weekend suites remain registered, including 1440x900 and 1100x720 at
100%, 115% and 130% text and the retained diagnostic layouts.
