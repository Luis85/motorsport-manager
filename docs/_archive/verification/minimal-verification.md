# Minimal race weekend — historical 0.17.0 verification scope

> **Historical record.** Scope, version claims and validation below belong to the
> named milestone. See [current project status](../../reference/current-state.md)
> and [the documentation index](../../README.md) for current behavior.


For the later UI pass, use [0.17.1 UI polish verification](../releases/minimal-ui-polish.md). Counts below are the previous implementation, not the later head.

Implementation: 0.17.0, based on merged main `6d20af58403ba3d208146979ee843012c760fdea` (source tree `7ea04fe4d16a56531b9ea5d408368fb9afceff65`). Native checks used Godot **4.7.2 Standard**, Linux, GL Compatibility and software rendering under Xvfb for UI. No browser mockup stands in for the game.

## Executed local checks

| Suite | Result | Evidence |
|---|---:|---|
| Minimal command/state/save/replay tests | 57 passed | `reports/minimal-tests.json` |
| Minimal native interaction and layout tests | 145 passed; 16 captures | `reports/minimal-ui.json` |
| Full native practice → qualifying → race journey | 28 passed; 9 captures | `reports/minimal-weekend-ui.json` |
| Retained practice domain regression | 78 passed | `reports/practice-tests.json` |
| Retained Director domain regression | 76 passed | `reports/director-tests.json` |
| Retained replay domain regression | 59 passed | `reports/replay-tests.json` |
| Production script load | 123 scripts passed | `reports/script-load.json` |
| Verification-runner isolation | 5 tests passed, including native user-directory resolver | runner-isolation log |

The three new suites contain **230 checks and 25 native screenshots**. Import completed, Python compilation and `git diff --check` passed. Logs were checked for script/parse/runtime errors, not just exit codes. Benign root/VSync warnings from the test environment are not game errors.

These are targeted local results, **not a claim that the complete historical CI corpus was rerun locally**. The full `scripts/verify.py` retains all existing domain, scenario, native UI and performance suites, adds the three minimal suites, and isolates each suite's saved preferences. The feature PR's own hosted result must be consulted separately before merging. A previous revision's green run is not evidence for this revision.

## What the new checks establish

Command tests cover read-only refresh/preview, explicit driver ownership, invalid/duplicate commands, separate speed and pause behavior, manual practice modes, real measured laps and physical returns. Mixed-mode evidence cannot become a clean forecast prior. A mid-run JSON checkpoint continues with matching state and RNG; a separately loaded record re-simulates the new commands. Malformed stored modes are rejected. Race pit acceptance pins a reachable current-lap gate and finite replacement; a physical service/exit executes. A synthetic late-gate boundary verifies rejection rather than a silently deferred promise.

Native layout checks cover **1440×900 and 1100×720**, each at **100%, 115% and 130%** pit-wall text, all twelve timing rows, complete button labels and a usable central race view. Compact enlarged-text phase probes verify that long receipts and next-session labels cannot push controls offscreen. Those phase-only probes are explicitly synthetic and are not offered as lifecycle evidence.

Native interaction checks dispatch mouse/key input to the real controls: driver selection, Push → Normal, Calm, Play/Pause, speed, Space, engine popup keyboard choice and Box this lap. An open engine menu retains the user's highlighted choice across refreshes. Timing rows are reused; repeated refresh is observational.

The separate journey starts from a **new** Pinecrest weekend (seed 7314, dry, calm incidents, six race laps). It uses the real visible session/driver buttons and **14,609 production fixed steps**, not injected grids, finishing positions or tyre stock. Both drivers run practice and qualifying, cars return physically, formation and start lights complete, one managed car performs a physical pit stop, and both finish. The production session archive saves and restores final cars and RNG. Captures named `finish-minimal-weekend-*` belong to this journey; the other `finish-minimal-*` captures are the disclosed layout/input fixtures.

## Limits

This does not establish human usability or enjoyment, controller/screen-reader completeness, translations, mobile support, extreme scaling, every circuit/weather/endurance combination, or a universal frame rate. Live running gaps remain labelled estimates. Automatic tyre choice is a baseline heuristic, not an optimal strategy model. Physics, racecraft, weather and telemetry are retained; this increment is not a comprehensive re-calibration of them.

## Reproduce

From the project root, import once, then use distinct user-data directories per suite:

```sh
GODOT=/absolute/path/to/Godot_v4.7.2-stable_linux.x86_64
"$GODOT" --headless --editor --path . --import
LP_NUM_THREADS=2 XDG_DATA_HOME=/tmp/mm-minimal-domain "$GODOT" --headless --path . --script res://tests/minimal_tests.gd
LP_NUM_THREADS=2 XDG_DATA_HOME=/tmp/mm-minimal-ui xvfb-run -a -s '-screen 0 2000x1200x24' "$GODOT" --path . --audio-driver Dummy --script res://tests/minimal_ui_tests.gd
LP_NUM_THREADS=2 XDG_DATA_HOME=/tmp/mm-minimal-journey xvfb-run -a -s '-screen 0 2000x1200x24' "$GODOT" --path . --audio-driver Dummy --script res://tests/minimal_weekend_ui_tests.gd
```

Use fresh directories rather than personal application data. For complete verification, use `LP_NUM_THREADS=2 python3 scripts/verify.py --godot "$GODOT"`; that runner makes a clean source copy and unique per-suite application identities automatically. Its `reports/verification.json` is produced only when the entire requested run passes.
