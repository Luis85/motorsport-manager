# 0.14 verification evidence

Recorded **24 September 2026** for PR **#10**, `feat/race-weekend-mastery`, targeting **main directly**. Design basis: Race Weekend GDD v1.0 section 20.4 and the RW-19/RW-16 foundation. This is not completion of Stage D or campaign settlement.

## Exact revisions and integration

| Anchor | Revision |
|---|---|
| Main at integration | `455728df4ff08108f604596770d3a760238c1464` (0.11) |
| Preserved combined replay/authoring branch | `c873823c25199a4131dd047ac596cc2bf75c6aa1` |
| Untouched combined 0.13 baseline tree | `fe3f4fd5e85b248ce7f652d1ee884925d030909a` |
| Two-parent feature integration | `0b40f22055bb70de101923bec1992e7df86c402c` |
| **Final clean-tested code/tests** | **`ee14092ae26cce964b13fd721ab4820def88d267`** |
| **Final tested code tree** | **`d810db4901a386dc262aee2d80da2b88cc91877b`** |

The subsequent handoff commit changes documentation only. Its exact head/tree and all source hashes are in the PR and downloadable manifest. The local index was checked against each uploaded Git tree. All **241 non-document source/configuration/test files** match the final clean imported copy, allowing only the isolated test application-name substitution and excluded/recreated `reports/.gdignore`. No original branch or main was reset or changed.

PR #8 merged into the former rivals feature branch, and #9 into the replay feature branch. Their source was not in main. The integration commit preserves main and the combined replay/authoring history as two parents, using the exact combined tree. It does not automatically merge this PR. The inherited authoring code is retained work, not new notebook authorship.

## Fresh baseline and final regression

The untouched combined 0.13 baseline passed a fresh **2,219-check / 102-screenshot** full run. It contains replay and authored scenarios, not merely 0.11 main. Dedicated scenario-authoring checks were absent from its runner; the new notebook suites and expanded complete-race fixture now exercise those contracts too.

The corrected final clean run passed **2,437 checks and produced 110 native screenshots**, retaining every earlier suite:

| Coverage | Passing checks |
|---|---:|
| Base domain / native UI | 706 / 113 |
| Strategy / complete dry scenarios / UI | 109 / 19 / 34 |
| Living racecraft and team / UI | 113 / 33 |
| Weather / complete scenario / UI | 97 / 10 / 33 |
| Recovery / complete scenarios / UI | 128 / 24 / 41 |
| Compact / task-oriented UI | 119 / 128 |
| Practice / complete scenario / UI | 78 / 17 / 67 |
| Rivals / complete scenarios / UI | 49 / 34 / 47 |
| Populated-workspace performance contracts | 14 |
| Replay / expanded complete scenario / observer cost / UI | 50 / 39 / 15 / 111 |
| **New notebook domain/storage / native UI** | **96 / 113** |
| **Total** | **2,437** |

The increment adds **218 checks**: 96 notebook domain/storage checks, nine additions to the complete replay/race fixture, and 113 native notebook checks. Main-suite screenshots add eight to the baseline 102. The separate supplemental results below are not added to these totals.

```sh
LP_NUM_THREADS=2 python3 scripts/verify.py \
  --godot /path/to/Godot_v4.7.2-stable_linux.x86_64
```

Environment: **Godot 4.7.2 Standard (`ed1daf0bf`)**, Linux, **INTEL(R) XEON(R) PLATINUM 8573C**, Xvfb/X11, Mesa llvmpipe (LLVM 19.1.7), software OpenGL and Dummy audio. This is a different reference CPU from the historical 0.12 report. No new engine version or renderer is introduced.

The runner copies/imports the source afresh, isolates application user data, requires successful JSON reports and rejects script/parse/runtime errors. The final 30 phase durations sum to **2,005.4 seconds**. The baseline phase sum was 2,392.0 seconds. These are verification durations under differing concurrent test load, **not a game-performance comparison**. The inherited software-driver VSync warning is retained; it does not establish hardware support. `--headless-only` expressly skips native UI verification.

### Corrections and rerun history

The first revised full attempt on `85e6389` was deliberately stopped before completion after supplementary native input found that the inherited Replays & experiments MenuButton could not receive ordinary keyboard focus on return. The production focus mode was corrected, one mandatory assertion was added, and the **entire clean run restarted** on `ee14092`. The stopped attempt is not a pass and is not added to the final counts.

Early focused native-test failures also exposed harness assumptions: loading App-dependent UI too early, and double-counting root-space positions for nested embedded windows. Runtime scene loading and a corrected real-input helper resolved these; confirmation cancellation now additionally asserts that the dialog disappeared. No production safety assertion was removed. Supplementary menu tests were corrected to use actual popup navigation rather than unsupported Home/End assumptions. The exact executed supplemental harness and development logs are included for provenance.

## Actual race and challenge evidence

The expanded 39-check fixture completes a normal Pinecrest dry/calm four-lap weekend, seed 7314: explicit practice skip, actual measured qualifying for both players, preparation, physical formation, approved lights and the race. The original and JSON replay each execute **8,232 actual fixed steps**, retaining equivalent sporting endpoint state including resources, random streams and journal. Numerical equivalence uses the existing absolute `1e-8` tolerance.

At the real race-start checkpoint, a frozen scenario is authored with a finish-both goal. Its separate sandbox conserves Mercer and calls an early physical pit stop. Original plus alternate physical racing totals **11,224 steps**, with replay work counted separately. No outcome is forced.

| Completed branch | Mercer | Moreau |
|---|---|---|
| Original | P1, 4/4 laps, 0 stops | P6, 4/4 laps, 0 stops |
| Altered early-stop sandbox | P12, **3/4 laps**, 1 physical stop | P2, 4/4 laps, 0 stops |

Both players finish both branches. The notebook accurately records the sandbox's **met finish-both goal** despite Mercer's lapped last place; it does not call that a winning strategy. Different completed distances preclude an equal-distance time comparison. These outcomes demonstrate executed alternatives and source isolation, not balanced optimal strategies or enjoyment.

The fixture remembers both actual results, retains measured qualifying and physical pit counts, saves a separate interpretation, reloads the original from JSON, and proves no duplicate notebook entry, erased note, changed source or changed accepted-result receipt. `notebook-example.json` contains these two fictional test-run observations. No player data is included.

Domain/storage tests deliberately use synthetic terminal states to cover all-retired results, every supported challenge goal, unfinished/missing source refusal, exact circuit identity, duplicate/conflicting facts, stale revisions, oversize notes, invalid data, corrupt-file preservation, explicit deletion and full capacity without eviction. Scenario authoring is observational and its temporary recorder detaches. Synthetic fixtures are not shipped scenarios or additional completed races.

## Native interaction and visual inspection

The mandatory notebook suite uses actual mouse and keyboard events at **1440x900 and 1100x720**, each at **100%, 115% and 130% text**, plus **1920x1080/130%**. It covers Find/Enter, visible fixed actions, actual text entry, protected race shortcut characters, deliberate save, duplicate remember, dirty exit with safe Stay default, cancellation, reopen persistence, stale/corrupt-save draft retention, forget confirmation, Escape and focus return. It verifies unchanged source snapshots and original-save bytes. An active-state fixture proves the notebook does not prevent authoritative stepping or claim an unfinished result.

The eight new main-suite captures are `notebook-<size>-text<scale>.png` and `notebook-authoring-validation-1100x720-text130.png`. Their terminal UI fixture is deliberately synthetic/all-retired. Existing practice, recovery, weather, replay, editor and performance screenshots remain in the full 110-image set.

A separate supplementary native run passed **19 checks and produced 3 captures** using the actual two-run notebook from the completed-race fixture. It tests the main-menu popup, selection of original versus sandbox, dirty-selection cancellation, a real FileDialog export that excludes the unsaved draft, proper main-menu focus restoration, and unchanged original file bytes. The sandbox's observed goal and its lapped distance remain visible together.

That supplemental run also enables actual view frame processing with the notebook open and observes **120 fixed steps / 6.0 simulated seconds** while the source remains unpaused at its selected 8x and receives no hidden inputs. This establishes continued execution, **not a measured achieved-8x throughput guarantee**. The exact-circuit filter uses the actual document hash: normalized library metadata can differ from an otherwise similar saved geometry, so the All view remains available rather than falsely equating snapshots.

The actual-original, actual-sandbox and main-menu captures were visually inspected, as were the compact enlarged-text notebook and authoring states. Text is readable and fixed actions remain reachable in these samples; long detail can scroll. The notebook is a modal history workspace, not a replacement for the live two-car command view. Its status discloses that a live weekend keeps running; pause explicitly before opening it for reading time.

## Performance: bounded history and matched unchanged simulation

The new full-capacity workload stores **128 synthetic records**, each with **1,200 note characters**, in **361,682 bytes**. After three warm-ups, **20 serial reads including validation** measured median **36.879 ms** and p95 **44.111 ms**. This measures synchronous disk read plus validation, not full window-open, note-save or maximum-size replay latency. Every sample must validate; failures are not dropped. The notebook is not loaded by physics, AI or the forecaster.

A separate matched harness uses identical bytes on the untouched combined 0.13 and revised 0.14 builds. It completes real formation/start before timing twelve cars on the same Pinecrest dry/calm seed-7314 state with current rival policies, **1,000 real steps / 50 simulated seconds**. The notebook is closed, no UI or recorder is attached, and every initial/outcome sporting hash matches exactly across all six executions.

These **three alternating-order pairs ran serially after the final verification finished**, with no other verification job launched by this task:

| Pair | Baseline wall seconds | Revised wall seconds |
|---|---:|---:|
| 1 | 4.816982 | 5.882061 |
| 2 | 4.879858 | 4.809211 |
| 3 | 4.761032 | 4.709029 |
| **Median** | **4.816982** | **4.809211** |

Median throughput is **10.380 → 10.397 simulated seconds per wall-second**. Revised median wall time differs by **-0.2%** in this pair set. This is a small local measurement of the unchanged closed-notebook workload, not a statistically established improvement/regression, an open-notebook rendering benchmark or a hardware/FPS guarantee. No seed, fixed steps or outcomes were changed to obtain equality.

An earlier exploratory three-pair run overlapped full verification and showed highly variable timings (baseline 7.274077/5.021943/4.858130 seconds, revised 9.145723/8.257853/5.240034). It is preserved separately as **under-load exploratory evidence**, not silently discarded or used for a causal speed claim. The final serial measurements above use the same workload; only the report's limitation text changes. Raw harnesses, hashes, logs and all pairs are supplied.

Inherited recorder-cost, populated-workspace and demanding Monaco diagnostics remain in the full suite. Their raw current reports are included; they are not relabeled as notebook speedups or evidence of uninterrupted 16x playback. Maximum 16 MB replay latency, cross-platform/GPU behavior, larger text and broad seed/circuit balance remain open.

## Hosted CI and acceptance boundary

At this documentation checkpoint, GitHub Actions run **36037797936** on the final code `ee14092` was **completed successfully**, checked 24 September 2026 at 18:25 UTC. The downloaded hosted evidence independently confirms **2,437 checks / 110 screenshots**, matching the local summary. Its PR checkout was `cfc9389d180779075c9e8655689ffd5b67af3809`; the GitHub Git object confirms its tree is the same `d810db4901a386dc262aee2d80da2b88cc91877b` as the final code. This is GitHub's test merge ref, not an actual merge into main. Hosted checks are independent of the completed local evidence. The following documentation-only head has separate checks. Source packaging and successful earlier runs do not establish success for another revision. The successful run published `verification-evidence` artifact **10825767964**; its downloaded SHA-256 matches **9c16fcedad3997868a702348904619a49a52612ab31362b7f82be77296458408**. The evidence bundle includes the hosted summary and provenance separately from local measurements. Consult PR #10 for subsequent head status.

No human participant session was performed. An exploratory follow-up should ask a newcomer and an experienced player to identify an original versus sandbox, explain a lapped finish that still met a finish-both goal, add and recover a note, and distinguish saved facts from interpretation and unsaved export content. Record incorrect attribution, missed source labels, unnecessary navigation and abandoned drafts; include relevant access needs. Passing automated input/layout checks does not satisfy that comprehension gate.

The delivered boundary is standalone remembered knowledge, with no grind, hidden buff or core-control unlock. Campaign settlement, arbitrary scenario rule/resource editing, model-upgrade replay migration, full timeline scrubbing, pressure and separately justified RW-20 systems remain unimplemented. The GDD and Stage D are not declared complete. See [behavior and native interaction contract](race-weekend-notebook.md).
