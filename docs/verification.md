# Verification and acceptance

## One command

```sh
python3 scripts/verify.py --godot /path/to/godot
```

The verifier performs a headless editor import, deterministic domain tests, and rendered native UI tests. Tests use a fresh temporary project copy with a unique application name and isolated user-data environment; generated evidence is copied back to `reports/`. It checks exit codes, rejects script/parse/runtime errors in logs, requires fresh passing JSON reports, and writes `reports/verification.json`. Stale reports are removed before a run. Linux without a display needs `xvfb-run` and `xauth`; UI rendering uses software OpenGL and the Dummy audio driver. A driver warning that VSync cannot change under the virtual display is non-fatal.

`--headless-only` is available for domain-only environments and records that explicitly; it is not equivalent to full verification. In CI, the full command is mandatory and verification evidence is uploaded even on failure.

## Automated coverage

The suite includes the original 404 assertions plus the targeted scenarios in `tests/foundation_tests.gd`. Exact totals are emitted in each run’s JSON report. Counts include repeated per-car/per-step invariants, not independent user scenarios. It covers:

- All eight bundled layouts: bounded geometry, lengths, continuity, native round trip, sector/pit compilation and runtime export.
- Exact cubic subdivision, automatic-handle migration, malformed documents, preset differences, snapshot isolation and persistence errors/backups.
- A complete qualifying/formation/race lifecycle, measured qualifying laps, shared pit servicing, compound changes, limiter compliance, monotonic route progress and completion.
- Frame-partition invariance, JSON checkpoint continuation including PRNG/surface state, pause and invalid-checkpoint rejection.
- No-pass neutralization, blue flags, late pit calls, same-step finish ordering, all-retirement termination and wet/rotated-track/vehicle scenarios.

The native UI smoke test opens the real main scene, visits menus/settings/library/editor, exercises editor history and custom-save/test-return behavior, runs a weekend through all phases, checks classification positions and checkpoint reload, and captures **fifteen screenshots**, including a 1100×720 window. It is an integration/smoke test, not a comprehensive pixel-diff or accessibility audit.

## Iteration-two regressions

New domain checks cover candidate-time fallback, cheap preview bakes, continuous nearest-point projection, same-level versus grade-separated crossings, duplicate sector fallback, measured three-sector qualifying, finishing active hot laps after chequered, invalid laps, lap-distance-first classification, pit-lap exclusion, persistent yielding, frozen service plans, braking before the box, physical queue spacing, v1 migration and malformed nested snapshots. A seeded race matrix adds Suzuka/Formula/dry, Interlagos/Touring/changeable and Zandvoort/Kart/wet.

Native UI checks deliver actual mouse-button/motion events to the canvas, verify selection does not clear redo, drag uses the cheap preview, Escape rolls back the transaction, and release commits once. They cover reference calibration without moving the road, persistent timing TreeItems, selected-driver retention, follow-camera cancellation, synchronized speed/delegation controls, visible pit actions in all tabs and at the smaller viewport, and non-modal ordinary commands. These are scripted native integration checks, not a claim of exhaustive manual playtesting.

## Reproducible artifacts

`reports/` is generated and ignored by Git. A successful full run produces import/domain/UI logs, `domain-tests.json`, `ui-smoke.json`, `verification.json`, `bake-performance.json`, `race-matrix.json`, and numbered screenshots. GitHub Actions exposes these as the `verification-evidence` artifact. Actual counts/durations are taken from the report, not hard-coded into the pass criteria.

The implementation was verified with **Godot 4.7.2 standard on Linux**, using software OpenGL for native UI capture. No Windows/macOS export, touch-device session, or target-GPU performance claim follows from these tests. Reference lap estimates are not compared against real qualifying records as a correctness test.

## Manual acceptance pass

Open the project in the editor and play one dry short weekend. Confirm the actual buttons/keyboard/canvas selection work on your input device; manually command both player cars, call/cancel a stop, and inspect their tyre/fuel response. Save mid-session, close, relaunch, and resume. Try a longer changing-weather race rather than expecting a very short shower to create instant standing water.

In the editor, copy Monaco, manipulate the hairpin/chicane with explicit handles, insert a point, undo, alter height/banking, reposition pit nodes, add a tunnel/bridge range, and save to the library. Import/export that authoring file and test it in a weekend. Add a licensed reference image, calibrate it, and verify it travels with the export. These hands-on checks remain valuable for ergonomics and target-device graphics beyond the automated coverage.
