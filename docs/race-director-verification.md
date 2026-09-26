# Race Director verification

Godot **4.7.2 Standard**, Linux Compatibility renderer through Xvfb / Mesa llvmpipe, `LP_NUM_THREADS=2`. No native Windows or controller-hardware result is implied.

## Reproduce

```sh
LP_NUM_THREADS=2 python3 scripts/verify.py --godot /path/to/Godot_v4.7.2-stable_linux.x86_64
```

The runner creates a clean project copy and unique native user-data identity for each phase. Missing reports, nonzero exit codes, parse errors, `SCRIPT ERROR` and `ERROR` output fail verification. Native suites are mandatory unless the caller explicitly chooses `--headless-only`; that mode must not be reported as full verification.

New mandatory reports:

| Report | Coverage |
|---|---|
| `director-tests.json` | Real fixed-step watch, manual time-control precedence, physical pit stages, bounded resource handback, qualifying recall, pure reading and exact sporting replay |
| `director-ui.json` | Default native layout at 1440×900 / 1100×720 and 100/115/130% text; named commands, stale review, receipts, focus, layout/guide separation and exit |
| `director-weekend-ui.json` | Actual briefing → measured practice → measured qualifying → approved formation/lights → six-lap race → classification → separate checkpoint sandbox |

Existing domain suites remain. The existing native detailed-panel suites run with the public, shipping `-- --pitwall-layout=engineering` preference. The new native suites use the default Race Director. The previous practice smoke test's exact script-name assertion accepts the new composed workspace; its functional assertions are retained. This is not a second test-only interface or simulation.

## Evidence provenance

The original source tree was recovered from hosted verification and compared to merged main `6faeba52b8f82b153475f69eb8cc7961259c1994`, tree `dc158774436c6fb78843ad501779018cad1fe50b`. Its historic results are baseline evidence, not new-head results.

Layout-profile fixtures in `director-ui.json` explicitly inject a race-entry layout state. Their subsequent instructions, handbacks and stops run through the real physical model. The separate `director-weekend-ui.json` journey does not inject phases, positions, stock or results. Sandbox captures identify the experiment and retain the original source time separately.

Native captures are generated in `reports/finish-director-*.png`. Exact-run JSON and logs belong to the verification artifact. Reports from failing intermediate development runs are not acceptance evidence. Re-running a suite does not increase its unique check count.

## Descriptive gameplay probes

Three two-lap pace probes use the same actual race-entry state on Pinecrest, seed 7314, 12-lap weekend. They are observations, not a broad balance benchmark.

| Pace mode | Simulated seconds to target distance | Remaining tread | Position |
|---|---:|---:|---:|
| Protect | 73.900 | 92.2369% | P5 |
| Normal | 70.400 | 90.5984% | P3 |
| Push | 71.950 | 88.7398% | P3 |

Push consumed more tread but did not beat normal elapsed time in this traffic fixture. No guaranteed-pass claim is made. The previous strategic-duel finding that extension did not show a robust winning example in its four exercised scenarios remains unresolved; this patch does not claim a new strategy balance pass.

## Acceptance boundaries

Passing tests support the checked interaction and simulation contracts, not measured enjoyment, representative-device frame rate, screen-reader compatibility or accessibility certification. Windows/exported launch, actual DPI, controller hardware, text above 130%, wider seed/circuit balance and a counterbalanced human playtest remain separate gates. The proposed playtest tasks and acceptance targets are in the research report.

The authoritative aggregate for any execution is that execution's `reports/verification.json`. Publication/CI status must be read for the exact proposed commit, not inferred from the merged baseline or a local preflight.
