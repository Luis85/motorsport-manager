# 0.12 verification evidence

Recorded **24 September 2026** for PR **#8**, `feat/race-weekend-replay`, stacked on the unmerged **#6** branch `feat/race-weekend-rivals-ui`. This is executed evidence for the first RW-19 increment, not completion of Stage D, campaign settlement or human validation.

## Revision boundary

| Anchor | Revision |
|---|---|
| Required 0.11 feature base / PR #6 | `3bc9fbc384b3b9976b926cefb02121b4dade61c5` |
| Recovered interrupted implementation | `8b7e32edfa8f92306cb63f3c45f842cc8021260b` |
| Recovered tree | `6b9b2c7a084b8cfa55e0b9a91c8ed6e6bdf4f988` |
| Final tested code, tests and workflow | **`1fd797837b9b01b5b0514670db960b857027d19e`** |
| Final tested code tree | **`9fb9fad8ec3bc3315c5733c269d7fc02b217dc3d`** |
| Unchanged main at integration check | `a8c551c42b6ec0d8c7191460c4d3536607d6a5b2` |

The following handoff commit changes documentation only. Its exact head and tree are recorded in the PR and downloadable revision manifest. Published trees were checked against the local Git index. All **224 non-document source/configuration/test files** match the clean final verification copy. Only the harness's isolated application-name substitution and excluded/recreated `reports/.gdignore` are normalized. `final-source-match.json` records the checked hashes. Main and PR #6 were not reset, changed or merged.

## Clean local regression

The recovered starting tree passed a fresh full run of **2,013 checks / 90 native screenshots**. It already contained the two interrupted replay-domain commits; it is not presented as an untouched 0.11 or main benchmark. Its existing verifier, like the recovered successful CI run, did **not** invoke replay-specific suites. Those suites are now mandatory.

The final clean run on the code revision above passed **2,219 checks and produced 102 native screenshots**, preserving every baseline suite and adding 206 checks:

| Coverage | Passing checks |
|---|---:|
| Base domain / native UI | 706 / 113 |
| Strategy domain / complete scenarios / UI | 109 / 19 / 34 |
| Living racecraft and team domain / UI | 113 / 33 |
| Weather domain / complete scenario / UI | 97 / 10 / 33 |
| Recovery domain / complete scenarios / UI | 128 / 24 / 41 |
| Compact UI / task-oriented pit wall | 119 / 128 |
| Practice domain / complete scenario / UI | 78 / 17 / 67 |
| Rival styles / complete scenarios / UI | 49 / 34 / 47 |
| Populated workspace/performance contracts | 14 |
| **New replay domain / complete scenario / observer cost / native UI** | **50 / 30 / 15 / 111** |
| **Total** | **2,219** |

Run:

```sh
LP_NUM_THREADS=2 python3 scripts/verify.py \
  --godot /path/to/Godot_v4.7.2-stable_linux.x86_64
```

The runner copies and freshly imports the project, isolates user data, and rejects failed assertions and script/parse/runtime errors. The final run used **Godot 4.7.2 Standard (`ed1daf0bf`)**, Linux, **AMD EPYC 9V74**, Xvfb/X11 and Mesa llvmpipe (LLVM 19.1.7), software OpenGL and Dummy audio. Reported phase durations sum to **1,113.6 seconds**; this is test duration, not game performance. The software driver reports that changing VSync is unsupported; that warning is not hidden as a hardware capability claim.

`reports/verification.json`, per-suite JSON, logs and actual PNG files are the evidence. The hosted job budget increased from 25 to 30 minutes for the additional work; per-phase timeouts and failure detection remain. `--headless-only` explicitly omits native UI verification.

### Review, correction and rerun history

An earlier expanded run at `5e1ae0fcc816d22580c8e06aa46785b975282890` passed **2,207 checks / 102 screenshots**. Subsequent code review identified an inherited phase-autosave path that still called `App.save_weekend` from the sandbox view. It could rewrite the original slot even though the sandbox never replaced the original simulation.

The final code routes sandbox phase autosaves to its own slot before the inherited observer can save the original. Twelve new native checks guard the original file bytes and assert sandbox-origin autosaves at the six supported size/text combinations. The focused 111-check UI suite passed, and **the entire clean suite was rerun after the fix**. No safety assertion or inherited suite was removed to obtain a pass. Earlier focused results are not substituted for the final clean report.

## Complete replay and result evidence

The new full fixture starts a normal Pinecrest weekend, dry/calm, seed 7314, four racing laps. It explicitly skips optional practice, records actual qualifying laps for both cars, approves preparation, completes physical formation, approves lights, and finishes the race. The retained practice-to-race suite independently covers actual practice; no claim is made that this replay fixture itself includes practice.

The original executes **8,232 actual fixed steps**. Its JSON recording reproduces the same 8,232-step input history to an equivalent sporting endpoint, including retained tyres, weather, strategy, journal and random-stream state. Numerical comparison uses the declared absolute `1e-8` tolerance. A separately restored race-start branch conserves Mercer and calls an early physical stop, then completes its own race. Original plus alternate physical runs count **11,224 steps**, with the replay work reported separately. The full original archive is **1,293,793 bytes**.

| Branch | Mercer | Moreau |
|---|---|---|
| Original | P1, 4 laps, 0 stops | P6, 4 laps, 0 stops |
| Altered early stop | P12, **3 laps**, 1 physical stop | P2, 4 laps, 0 stops |

Both player cars finish in both branches. The changed approach loses for Mercer in this short fixture. A lapped result is not an equal-distance race-time comparison. This demonstrates real executable alternatives and source isolation, not balanced optima, a universal strategy recommendation or proof of enjoyment.

The same suite verifies durable original acceptance; identical-event no-op without rewriting the ledger; JSON reload retaining the event ID; refusal of a conflicting hash; refusal of a completed sandbox; separation of caller mutations from durable data; and preservation of an invalid ledger. A separate explicitly injected all-retired test checks a finite factual result. It is not a shipped scenario that forces retirements.

Domain tests also cover same-step command cursors and bursts, paused no-ops, rejected inputs, malformed checkpoints and type paths, metadata mismatch, changed seed, engine/model mismatch, history limits, and unchanged source state. Integrity checks provide local error detection, not authentication against deliberately edited developer records.

## Native interaction and inspection

The mandatory replay UI suite uses actual mouse/key input through the application shell at **1440x900 and 1100x720**, each at **100%, 115% and 130% text**. It checks fixed actions, Ctrl+K/Enter discovery, the same retained original node instance, focus restoration, unchanged pause/speed/selection/streams, unapplied strategy-draft retention, separate sandbox authority and save paths, malformed import rejection and raw-v10 legacy continuation.

Reordered timing rows are checked by stable driver ID for all ten rivals. Own-wheel detail remains available; rival exact wheel data remains concealed. This covers the actual rank-versus-ID masking defect corrected in the increment.

The 12 new main-suite captures are `replay-<size>-text<scale>.png` and `replay-sandbox-<size>-text<scale>.png`. Visual inspection included the 1100x720/130% viewer and sandbox: one clearly labeled workspace header, visible return/time controls and both driver cards. Existing practice, weather, recovery, editor and debrief captures remain among the 102 images.

Two additional executions are deliberately **outside** the main-suite totals:

| Supplemental execution | Checks | Captures |
|---|---:|---:|
| Wider native replay/sandbox at 1920x1080/130%, plus retained adversarial checks | 36 | 2 |
| Completed original result accepted through actual mouse input, then accepted again as a no-op | 5 | 1 |

The acceptance execution completes another actual 8,232-step weekend, verifies unchanged source state/input history and unchanged receipt bytes on the second click, and captures the native **Already accepted** state at 1100x720/130%. Its factual `example-weekend-result.json` is included in the evidence bundle. Supplemental reports and exact harnesses are supplied separately; they are not falsely counted as committed CI suites. The wider sandbox and accepted-result screen were visually inspected as well.

These are automated tests and developer inspection, not participant usability or accessibility studies. Controller/screen-reader completeness, text beyond 130%, broader input devices and human understanding remain unverified.

## Measured recording cost

The final recorder-cost suite runs **three serial matched pairs with alternating order**, using the same 0.12 code with recording disabled/enabled. Both sides use the current rival policy, the same twelve-car Pinecrest dry/calm seed-7314 state after real formation, and **1,000 actual fixed steps / 50 simulated seconds**. This isolates a bounded observer workload; it is not an engine comparison or a claimed 0.11-to-0.12 speedup. The timed pairs ran serially; supplementary native acceptance was started afterward.

| Pair | Recorder off: wall seconds | Recorder on: wall seconds |
|---|---:|---:|
| 1 | 3.104692 | 3.216643 |
| 2 | 3.145956 | 3.296229 |
| 3 | 3.195252 | 3.263181 |
| **Median** | **3.145956** | **3.263181** |

Median throughput is **15.893 → 15.322 simulated seconds per wall-second**. Recording took about **3.7% more wall time** in these paired observations. All pairs retain an exact sporting outcome hash, including RNG and journal state and excluding only selection/pause/speed/accumulator. Three pairs do not establish statistical significance or a general hardware guarantee.

For the measured **1,327,715-byte** populated archive:

| Synchronous operation | Median cost |
|---|---:|
| Keep a checkpoint | 18.409 ms |
| Seal/archive construction and digest | 144.975 ms |
| Validate archive | 363.356 ms |

These are distinct operation measurements, not total end-to-end disk save/open latency. Imports, saves and exports remain synchronous and can be noticeable. The maximum 16 MB archive, long histories across many circuits and cross-platform performance have not been profiled. Playback work is bounded to 64 steps and 32 same-step inputs per batch; the UI budget selector is not a promised real-time acceleration multiplier.

The preserved populated-workspace suite also passed with actual preparation and controlled active work. Median paused refresh costs were Strategy 2.491 ms, Weather 2.868, Recovery 2.216, Practice 2.338 and Debrief 3.131; these are current measurements, not matched baseline improvements. Its selected-16x controlled workload executed 640 steps / 32 simulated seconds and achieved **3.367 simulated seconds per wall-second** in software rendering, matching its unrendered shadow. This is not uninterrupted live 16x playback. The demanding Monaco diagnostic retained observational equivalence and zero paused overlay redraws. Raw reports retain all timings and limitations.

## Hosted CI and acceptance limits

Hosted CI is separate from the completed local run. At documentation preparation, final-code runs **36029319824** and **36029317417** on `1fd7978` were still **in progress**; no hosted pass is claimed here. Consult PR #8 for subsequently checked status. The later documentation-only head has its own checks. Source packaging is not gameplay verification, and successful older CI omitted the then-unwired replay suites.

This increment establishes a usable replay/sandbox workflow and a once-only local factual receipt. It does not implement external campaign entry validation, financial/points/inventory/calendar settlement, arbitrary scenario editing, unlimited replay scrubbing, model-upgrade replay migration or anti-cheat. Broad seeds/circuits, maximum archive size, human comprehension/accessibility, pressure and RW-20 remain open. See [the behavior contract](race-weekend-replay.md) for the exact delivered boundaries.
