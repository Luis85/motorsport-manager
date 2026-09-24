# 0.11 verification evidence

## Revision and execution boundary

Recorded **24 September 2026** for PR **#6**, branch `feat/race-weekend-rivals-ui`, targeting `main`.

| Anchor | Exact revision |
|---|---|
| Fresh baseline | `a8c551c42b6ec0d8c7191460c4d3536607d6a5b2` |
| Baseline tree | `ce49436312af662ab20c647ed5fb29ab4af1b71e` |
| Final tested code/tests/workflow | `2f6a2b324145c7398426c62d5cd3adcdac7e9e28` |
| Tested published tree | `dda60af3b340e9d06c90f6d35f04191f14657997` |

The subsequent handoff commit changes documentation only. The published code tree was reconstructed and checked against the local Git index. All **203 non-document source/configuration/test files** in the clean verification copy match the delivered code; the test-only application name and recreated `reports/.gdignore` are documented harness normalizations. The source/evidence download includes hashes and exact final head metadata. Main was not modified or reset, and this PR was not merged.

## Clean local verification

The untouched baseline passed a new full run: **1,869 checks / 79 native screenshots**. The final revised clean run passed **2,013 checks / 90 native screenshots**, including all existing behavioral assertions and the following additions:

| Coverage | Passing checks |
|---|---:|
| Preserved baseline suites, including the same Practice guide assertion | 1,869 |
| Rival styles, fairness, legality, persistence and overrides | 49 |
| Two rival recipes, four completed physical race branches | 34 |
| New native mouse/keyboard, focus, public inspection and layout checks | 47 |
| Populated workspace and fixed-step performance contracts | 14 |
| **Total** | **2,013** |

Run with `python3 scripts/verify.py --godot /path/to/Godot_v4.7.2-stable_linux.x86_64`. The verifier imports a fresh project copy with isolated user data and rejects parse/runtime errors. The final local phase durations summed to **937.3 seconds**; that is verification duration, not game performance. `reports/verification.json` and the per-suite JSON/logs are the run evidence.

One first revised full run failed an inherited tutorial selector which assumed Practice was the last guide step. The new rival guide invalidated that assumption. The test now locates the same named Practice step, retaining its title and no-speed-change assertions. The full suite was rerun cleanly after that fix. A separate temporary staging preference leak was also resolved with isolated application names; no safety assertion was removed.

**Hosted CI is separate.** At documentation handoff, GitHub Actions run `35996355487` for tested code `2f6a2b3` was still in progress, not a pass. Consult the PR's checks for later results and the documentation-only head's own run. Successful source packaging is not gameplay verification. Local success does not substitute for an unresolved hosted check.

## Native inspection and workflow

The full run includes the existing practice-or-skip, qualifying, preparation, physical formation/start, dry/wet racing, shared-box, repair-only recovery and classification fixtures. New UI tests use actual mouse/key events for navigation, Find, the native Weekend menu, Escape return focus and protected picker shortcuts. They also verify both car actions, own/rival inspection transitions and retained practice drafts. Existing explicit-recipient, stale-command, ownership, resource and editor checks remain.

Native targets: **1440x900 and 1100x720**, each at **100%, 115% and 130% text**; an additional **1920x1080 / 130%** view was captured. Visual inspection covered the small enlarged-text comparison, public profile dialog, Weekend popup, practice and recovery states, in addition to the baseline audit. Actual rich-text foreground/background properties pass the selected 4.5:1 contrast design reference; this is not accessibility certification.

Eight additional matched before/after captures use the same disclosed classic-model Pinecrest 24-lap, dry seed 7314, paused synthetic race state. They are UI comparison fixtures, not a claim about sporting results. Filenames in each matched report folder are `matched-1440x900-100-watch.png`, `matched-1440x900-100-compare.png`, `matched-1100x720-130-watch.png` and `matched-1100x720-130-compare.png`.

At 1100x720 / 130%, circuit height changed from **263 to 314 native pixels**, with unchanged width: **51 pixels recovered**. The standard 1440x900 view gained 40 pixels (527 to 567). All three complete strategy alternatives now fit before scrolling at every supported size/text combination. Long assumptions, inventory and reports still scroll; fixed actions stay outside them. The smaller enlarged inspector still temporarily replaces the timing tower, with Watch restoring it.

## Matched performance: measured, mixed results

The baseline and revised builds ran **serially**, after the full verification run, with the same harness bytes, engine, machine, renderer, viewport and input workloads. Environment: **Godot 4.7.2 Standard (`ed1daf0bf`)**, Linux, AMD EPYC 9V74, Xvfb, Mesa llvmpipe (LLVM 19.1.7), `LP_NUM_THREADS=2`, software OpenGL, Dummy audio. These are software-rendered local measurements, not target-GPU or cross-platform guarantees.

The populated-workspace harness uses Pinecrest, seed 2026, 1440x900, 100% text and the **same classic rival policy on both builds** to isolate presentation changes. It executes three real two-lap practice runs per player, totaling **10,916 preparation steps**, then creates a disclosed synthetic race presentation state and adds **1,000 diagnostic load records**. Those records are not invented race incidents. Each paused refresh has 40 measured samples after warm-up; the uncached forecast has 20.

| Workload | Median before -> after (ms) | p95 before -> after (ms) |
|---|---:|---:|
| Strategy refresh | 2.717 -> 2.528 | 7.226 -> 3.660 |
| Weather refresh | 2.397 -> 2.856 | 3.503 -> 3.513 |
| Recovery refresh | 1.983 -> 2.145 | 3.302 -> 2.388 |
| Practice refresh | 2.216 -> 2.363 | 2.799 -> 2.819 |
| Debrief refresh | 2.652 -> 2.098 | 4.695 -> 2.729 |
| Uncached practice-informed forecast | 1.557 -> 1.548 | 2.385 -> 1.716 |

Debrief median was about **21% lower** in this pair. Weather, recovery and practice medians were higher; there is **no across-the-board speedup claim**. A single serial pair does not establish statistical significance or isolate every source of variance. The report-prefix caches remove repeated evidence construction, but further presentation profiling remains justified.

The simulation-only benchmark explicitly unpauses and proves **1,000 real fixed steps / 50 simulated seconds**: baseline **3.349352 wall seconds / 14.928 simulated seconds per wall second**, revised **3.363507 / 14.865**. The normalized outcome hash matches exactly. No paused no-op loop is counted as simulation throughput.

| Controlled native workload | Fixed steps / simulated seconds | Wall seconds before -> after | Achieved sim-seconds/wall-second before -> after |
|---|---|---:|---:|
| Selected 1x, 120 input frames at 1/60 s | 40 / 2 | 7.095010 -> 7.396068 | 0.282 -> 0.270 |
| Selected 16x, 120 input frames at 1/60 s | 640 / 32 | 9.594828 -> 9.569864 | 3.335 -> 3.344 |

These are **controlled-input presentation workloads**, not uninterrupted live playback using measured wall-frame deltas. The achieved values describe the actual benchmark work; the selected 16x label does not prove 16x achieved playback. Both builds match their unrendered shadows, and normalized initial, simulation-only and both active-workload hashes match across builds. Normalization excludes only checkpoint version and the explicitly disabled rival-profile payload. No steps, failures or seed were dropped to obtain equivalence.

The preserved demanding **Monaco** workload also ran on both revisions at 1100x720, dry seed 7314. Paused overlay redraw counts stayed zero. Median native-frame time was **40.045 -> 38.230 ms** for its controlled 1x workload and **51.731 -> 52.960 ms** for 16x; corresponding p95 values were **46.882 -> 42.942 ms** and **61.045 -> 59.947 ms**. Its headless-shadow and across-build outcome hashes match. Mixed timings again do not establish a universal frame-rate improvement.

The paired harness deliberately retains classic rivals; it **does not isolate the overhead of enabling the new strategic preferences**. New rivals are exercised by their complete-race and deterministic suites. Broader CPU/GPU, long-run and active new-policy profiling remains open.

## Scenario outcomes and scope limits

The four completed new race branches consumed **45,850 fixed steps**. Both player cars finish in every branch; some are lapped. These are actual outcomes, not forced wins:

| Recipe / approach | MER: position, laps, stops | MOR: position, laps, stops |
|---|---|---|
| Faster car behind / conserve | P2, 12, 0 | P5, 11, 0 |
| Faster car behind / early offset | P4, 12, 1 | P6, 12, 0 |
| Both cars in contention / conserve | P3, 16, 0 | P4, 16, 0 |
| Both cars in contention / early offset | P9, 15, 1 | P7, 15, 0 |

The deliberately early stop loses positions in these fixtures. They establish executable alternatives and a complete loop, **not balanced competitive optima**. Different completed distances preclude naive total-time comparisons. Paired decision fixtures separately demonstrate contextual style differences under the same forecast and sensible emergency/legality overrides.

RW-18 remains partial: rival styles ship, pressure does not. v10 preserves the new preferences/holds/diagnostics; v1-v9 keep classic rivals without invented history. No new random stream, campaign settlement, editor tools, replay branch or hidden performance bonus is introduced. Human comprehension/enjoyment, accessibility with participants, controller/screen-reader completeness, larger text beyond 130%, forecast calibration, cross-platform runs and broader balance remain open gates.
