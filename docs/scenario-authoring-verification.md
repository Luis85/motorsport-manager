# 0.13 verification and integration evidence

## Revision boundary

This record concerns authored replay scenarios and stricter local result evidence, not all of RW-19 or the wider GDD. Behavior and limitations are in [the authoring handoff](race-weekend-scenario-authoring.md).

| Anchor | Revision / tree |
|---|---|
| Fresh recovered integration baseline | `9c30e928b0edb006c5e55b9e948dbe367752236c` / `66feffcd0b90610279df9289fac0ddc3593ebb5a` |
| Preserved concurrent replay core | `1fd797837b9b01b5b0514670db960b857027d19e` / `9fb9fad8ec3bc3315c5733c269d7fc02b217dc3d` |
| Runtime, tests and workflow under final clean verification | `ae4690ab77691197ac883bff2a197f54f0d1f378` / `2b4d1f6d711d913fcf551cf89d6292e942e29680` |
| History/documentation integration | `16451bfdf7fd2c55c92324bb278e7fa96882387b` / `a640fa37c892dfc3558693a9fdc1a443db33e8bc` |
| Main at integration inspection | `455728df4ff08108f604596770d3a760238c1464` |

The integration commit changes documentation only relative to the tested code. It preserves the actual PR #8 merge and main history without resetting branches or force-pushing. The later documentation update also leaves runtime/test/workflow bytes unchanged. Every uploaded implementation/test tree through `ae4690ab` was checked against the local Git index. The clean verification copy uses an isolated application name and recreated `reports/.gdignore`; those are harness normalizations, not gameplay changes.

## Integration history

The interrupted native replay UI batch was already published by a concurrent commit at `9c30e928` with the exact pending tree. A non-fast-forward check prevented this continuation from overwriting it. Subsequent replay regression and sandbox-autosave work was preserved at `1fd7978`. Authoring continued on its own branch, `feat/race-weekend-scenario-authoring`, rather than competing for writes to that replay branch.

While implementation ran, PR #6 reached main at `455728d`; PR #8 merged into `feat/race-weekend-rivals-ui` at `8bab2a4`; and PR #9 merged into `feat/race-weekend-replay` at `c873823`, at authoring head `05bab294`, before the later authoring tests. The latter two were **feature-branch merges, not delivery to main**. Their merged status must not be read as full integrated acceptance. Duplicate draft #7 was closed without deleting code. This continuation has not merged a PR or modified main.

Final integration is reviewed in a new direct-to-main PR carrying completed replay, authoring, the later tests and documentation together; its description records the exact final head. The immutable closed #9 metadata remains a record of its partial merge; it cannot be retargeted retrospectively.

## Clean local verification

The untouched recovered integration baseline completed a fresh local **2,013 checks / 90 native screenshots** run. Its then-current runner omitted replay-specific suites; it is not called replay acceptance or a pristine 0.11 main baseline. Summed baseline phase time was **2,013.1 seconds**, a test-run duration, not a game-performance measurement.

**Final expanded clean local run: 2,379 checks / 106 native screenshots, all passing, with no parse/script/runtime errors.** This includes the complete prior 2,219-check replay coverage plus 160 additional authoring/validation checks. No inherited safety assertion was removed. The tested runtime, tests and workflow are exactly `ae4690ab` / tree `2b4d1f6d711d913fcf551cf89d6292e942e29680`; later commits change documentation/history only. Summed final phase time is **2,235.5 seconds**, not game performance.

| Coverage | Passing checks |
|---|---:|
| Base domain / native UI | 706 / 113 |
| Strategy / complete dry scenarios / native UI | 109 / 19 / 34 |
| Living racecraft and team / native UI | 113 / 33 |
| Weather / complete wet scenario / native UI | 97 / 10 / 33 |
| Recovery / complete scenarios / native UI | 128 / 24 / 41 |
| Compact UI / task-oriented pit wall | 119 / 128 |
| Practice / complete weekend / native UI | 78 / 17 / 67 |
| Rival styles / complete scenarios / native UI | 49 / 34 / 47 |
| Populated workspace/performance contracts | 14 |
| Replay domain / full race / observer cost / native UI | 59 / 30 / 15 / 111 |
| Authored full-race experiment / native authoring UI | 42 / 109 |
| **Total** | **2,379** |

The 160-check delta is nine additional replay-domain assertions, 42 authored full-race checks and 109 authoring/native checks. All 106 PNGs in the evidence selection come from this clean run; three stale development captures in the working reports folder were excluded. The final native replay, scrolled author form and authored sandbox captures were also visually inspected. The additional scenario row costs map height at 1100×720/130%; the timing field scrolls while both driver cards and return/time controls remain visible. Automated reachability and visual inspection are not participant usability validation.

Focused development runs passed **57 replay-domain checks** and **108 authoring-native checks / four captures** before the last wrong-header/receipt and UTF-8 assertions were added. These are focused results, not a substitute for the final clean run. Earlier development exposed an exclusive-dialog error despite a passing JSON summary, a too-large author dialog, malformed scalar comparison errors and a test comparing JSON floats with native integers directly. Those were corrected; engine logs and existing safety assertions remain mandatory gates.

Run:

```sh
LP_NUM_THREADS=2 python3 scripts/verify.py \
  --godot /path/to/Godot_v4.7.2-stable_linux.x86_64
```

The verifier copies/imports the project afresh, isolates user data and rejects failed reports or engine parse/script/runtime errors. `--headless-only` explicitly omits native UI evidence. The expanded CI budget is 40 minutes. Existing per-phase limits remain; the additional twelve-lap authoring scenario receives a 600-second limit. Longer budgets do not waive any assertion or failure check.

Environment: **Godot 4.7.2 Standard (`ed1daf0bf`)**, Linux, **Intel Xeon Platinum 8370C @ 2.80 GHz**, five visible CPUs, Xvfb/X11, software OpenGL/Mesa llvmpipe (LLVM 19.1.7), `LP_NUM_THREADS=2`, Dummy audio. This is not the separate 0.12 stream's AMD EPYC measurement environment.

## Hosted CI: independently confirmed

[Godot verification run 36032501119](https://github.com/Luis85/motorsport-manager/actions/runs/36032501119) completed successfully on exact tested code **`ae4690ab77691197ac883bff2a197f54f0d1f378`**. Its job `107744459067` finished at **17:36:11 UTC on 24 September 2026**; Import and test, Verification runtime and Test evidence all succeeded.

The downloaded `verification-evidence` artifact **10825060474** independently contains **2,379 checks / 106 actual PNGs**, matching the local aggregate. Its ZIP SHA-256 was checked against GitHub's published `40be92eed2750fb917cb3c21156ce91d5b1fb8430dba77d10872cf53e5a39681`. Artifact expiry is **8 October 2026, 17:36:04 UTC**. Hosted JSON summaries are included separately in the handoff bundle; its full hosted archive is a separate download. These are not the local benchmark measurements.

Later documentation-only heads and the new PR merge check have their own CI runs. The code-commit pass is not described as a completed check on a different head. Source packaging alone is never treated as gameplay verification.

## What the required suites exercise

The unchanged core `replay_scenario_runs.gd` executes optional-practice skip, actual qualifying, preparation, physical formation/lights and a four-lap race, followed by exact reconstruction and an altered branch. The unchanged core native suite includes Find, strategy-draft preservation, focus return, legacy save loading, actual sandbox movement, stable rival row identity and original-disk byte guards.

`scenario_authoring_runs.gd` adds a disclosed twelve-lap Pinecrest dry/calm initial-condition recipe: actual formation/lights, an original early stop, complete JSON reconstruction, and a conserving sandbox from the same captured race start. Both player-car outcomes and completed laps are reported; no winning outcome is scripted. Goal assessment occurs only after final classification. Tests also cover duplicate/reloaded receipts, conflicting results, corrupt stored ledgers, wrong returned set ownership, invalid goal/origin promotion and failed disk writes. Malformed-data and correction fixtures are test-only, not injected sporting events.

`scenario_authoring_ui.gd` uses actual mouse/key input at **1440×900 and 1100×720**, each at **100%, 115% and 130% text**. It tests replay entry, branching, original node/draft/state/file retention, sandbox phase autosaves, a malformed import header, invalid then corrected author fields, the fixed Export/Cancel area, the native file destination, a long scenario reader and imported sandbox goals. Four added captures are named `scenario-authoring-1100x720-text130.png`, `scenario-authoring-sandbox-1100x720-text130.png`, `scenario-authoring-scenario-author-1100x720-text130.png` and `scenario-authoring-authored-sandbox-1100x720-text130.png`.

The additional replay-domain assertions reject wrong JSON header types and changed frozen identity, exercise observer detach/reset, reject malformed receipt identity, and prove that a non-ASCII export exceeding the UTF-8 byte ceiling preserves the previous file.

## Complete authored-scenario outcomes

The added fixture executes **32,138 counted fixed steps**: **11,475** original, **11,475** reconstructed and **9,188** in the conserving sandbox. The original archive is **2,217,601 bytes**. It uses the existing disclosed Faster car behind recipe: Pinecrest, Formula, dry/calm, seed 7314, twelve laps, untimed curated preparation grid and fitted M1 sets at 40% tread. Formation and lights are real approvals; no result is forced.

| Approach | Mercer | Moreau |
|---|---|---|
| Original early stop | P4 · 12 laps · 1 stop · finished | P6 · 12 laps · 0 stops · finished |
| Sandbox conserve | P2 · 12 laps · 0 stops · finished | P5 · **11 laps** · 0 stops · finished |

The early stop loses places in this fixture. Moreau's lapped result is not an equal-distance time comparison. These are executable alternatives with actual costs, not proof of two optimal strategies, general balance or enjoyment. The finishing goal is met in the conserving sandbox without rewards. The accepted original result and original save bytes remain unchanged. The preserved core replay fixture separately executes actual qualifying and its complete four-lap original/reconstruction/alternative; it was not replaced by this curated preparation start.

## Matched performance: measured costs, no speedup

After the full clean run finished, the same committed `tests/replay_performance.gd` ran **serially** on exact replay core `1fd7978` and runtime `ae4690ab`, with identical engine, machine, seed, current rival policy and `LP_NUM_THREADS=2`. Each revision ran three alternating recording-off/on pairs. Every workload counted **1,000 actual fixed steps / 50 simulated seconds**. Paused no-op loops were not counted. The 15 benchmark contracts passed on both revisions, including exact sporting hashes within each off/on pair. This is headless simulation, not a native FPS or selected-16× playback test.

| Operation / workload | Before median | After median |
|---|---:|---:|
| Explicit bookmark | 34.770 ms | 31.173 ms |
| Seal recording | 230.485 ms | 278.830 ms |
| Validate recording | 629.322 ms | 693.096 ms |
| 1,000 steps, recording off | 5.250842 s | 5.923995 s |
| 1,000 steps, recording on | 5.240687 s | 5.839646 s |
| Headless throughput, recording off | 9.522 sim-s/wall-s | 8.440 sim-s/wall-s |
| Headless throughput, recording on | 9.541 sim-s/wall-s | 8.562 sim-s/wall-s |

The archive fixture is **1,327,715 bytes** on both builds. Before/after operation sample ranges were: bookmark **31.460–36.676 / 30.251–50.246 ms**; seal **220.630–232.694 / 218.620–420.105 ms**; validation **617.812–693.989 / 655.486–1,129.828 ms**. Three samples and a serial build order do not establish statistical significance or attribute every change to the added validation. Recording-on being marginally faster than off in some pairs is not interpreted as an optimization benefit.

Validation and sealing were slower at the median, and throughput was lower in the later run. **There is no performance-improvement claim.** Snapshot sealing/validation is synchronous and can produce a visible wait; maximum 16 MB histories and archives with many receipts need separate profiling. No simulation work, seed, stock or failures were removed to improve the numbers.

A supplementary identical harness then ran **1,573 actual preparation steps plus 1,000 recorded steps per build**, after the timed comparison. Initial and endpoint sporting hashes match exactly across versions: initial `304b0bff560dbdb20118c512867b7f9d163a2f05d1e647b01345a2ae84530905`, endpoint `38f0b1e9d416b8bf5ba89a680f88aed6576fe621695ae534fe28775553a8e886`. It excludes only selection, pause, speed and accumulator fields; car, journal and RNG state remain. This supplementary check is not a timing benchmark or part of the 2,379-check aggregate. Its script, reports and logs accompany the paired evidence.

The preserved populated-workspace and Monaco native diagnostics also pass in the full run, including headless-shadow agreement and zero paused dynamic-overlay redraws. They use controlled input frames and are not matched new before/after rendering measurements. The native [authoring workspace contract](design/scenario-authoring-workspace.md) records the layout trade-offs separately.

## Acceptance boundaries

No participant usability/accessibility session, controller/screen-reader certification, text support beyond 130%, multi-circuit strategy balance, calibrated forecast coverage, maximum-size archive test or cross-platform deterministic proof is claimed. The new scenario authoring is bounded text/goals around frozen state, not arbitrary rules/roster/resource editing. Goals and local result receipts do not settle campaign money, points, inventory or calendar. An early pit losing to conservation in a fixture demonstrates execution and a real cost, not two equally optimal approaches or universal strategy balance.
