# Godot UI repair: verification protocol

## Reproduction

The failing PR imported with a dependent-class parser cascade (`WeekendView`, `StrategyWeekendView`, `PitwallWorkspace`, `PracticeWeekendView`, then `main.gd`). Direct loading identified the malformed popup `match` callback in `scripts/ui/weekend.gd`. The exact failing CI source was retained rather than inferred from screenshots.

Repaired source is tested with **Godot 4.7.2 Standard**, version `4.7.2.stable.official.ed1daf0bf`. A clean import and 82 directly loaded production scripts pass. A direct loader now runs as part of the verification command and also produces root diagnostics when import fails.

## Command

```sh
LP_NUM_THREADS=2 python3 scripts/verify.py --godot /path/to/Godot_v4.7.2-stable_linux.x86_64
```

The runner imports an isolated project copy, uses separate application/user data, rejects script/runtime errors even when Godot exits with zero, and requires each JSON report. Linux native tests use Xvfb, software OpenGL and the Dummy audio driver. `--headless-only` is explicitly incomplete for native UI validation.

## Additional coverage

`tests/script_load_tests.gd` loads every production GDScript and requires it to be instantiable. `tests/ui_repair_tests.gd` exercises actual native UI construction and input, with 89 assertions and five screenshots. It covers utility menus, responsive reparenting, target identity, hidden-control ownership, disabled commands, contrast states, no steady-state style/node churn, categorical forecasts, missing-sector values, result provenance, selected-row stability, and preservation of authoritative state/RNG during inspection.

All original suites remain in `scripts/verify.py`: full race/domain matrices, strategy scenarios, living racecraft, weather, recovery, practice, rivals, replay, scenario authoring, notebook, native input and performance checks. No original assertion or required test report was removed to make this repair pass.

## Interpreting evidence

Machine-readable logs and reports are generated under `reports/`, not hand-authored pass claims. A report applies to the source used by that test run. An old screenshot, a passing import, or a mergeable PR does not establish full-suite success. Final hosted CI should validate the exact published head; local focused results and any pending full run must be reported separately.

Local repair checks use a Linux container with Intel Xeon Platinum 8272CL, a four-core CPU quota, Mesa llvmpipe software rendering and `LP_NUM_THREADS=2`. They establish functionality on this environment, not a general frame-rate guarantee or validation on the user's Windows machine. Benchmarks run concurrently with other tests are not comparable product-performance measurements.
