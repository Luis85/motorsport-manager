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

The final review needs a new direct-to-main PR carrying completed replay, authoring, the later tests and documentation together. The immutable closed #9 metadata remains a record of its partial merge; it cannot be retargeted retrospectively.

## Executed baseline; final verification status

The untouched recovered integration baseline completed a fresh local **2,013 checks / 90 native screenshots** run. Its then-current runner omitted replay-specific suites; it is not called replay acceptance or a pristine 0.11 main baseline. Summed baseline phase time was **2,013.1 seconds**, a test-run duration, not a game-performance measurement.

**Final expanded clean verification is in progress at this documentation checkpoint. No final full-suite or hosted-CI pass is claimed here.** The runner includes all preserved baseline and replay-core suites plus authoring-specific tests. The completed final report and matched measurements will replace this status before the final handoff.

Focused development runs passed **57 replay-domain checks** and **108 authoring-native checks / four captures** before the last wrong-header/receipt and UTF-8 assertions were added. These are focused results, not a substitute for the final clean run. Earlier development exposed an exclusive-dialog error despite a passing JSON summary, a too-large author dialog, malformed scalar comparison errors and a test comparing JSON floats with native integers directly. Those were corrected; engine logs and existing safety assertions remain mandatory gates.

Run:

```sh
LP_NUM_THREADS=2 python3 scripts/verify.py \
  --godot /path/to/Godot_v4.7.2-stable_linux.x86_64
```

The verifier copies/imports the project afresh, isolates user data and rejects failed reports or engine parse/script/runtime errors. `--headless-only` explicitly omits native UI evidence. The expanded CI budget is 40 minutes. Existing per-phase limits remain; the additional twelve-lap authoring scenario receives a 600-second limit. Longer budgets do not waive any assertion or failure check.

Environment: **Godot 4.7.2 Standard (`ed1daf0bf`)**, Linux, **Intel Xeon Platinum 8370C @ 2.80 GHz**, five visible CPUs, Xvfb/X11, software OpenGL/Mesa llvmpipe (LLVM 19.1.7), `LP_NUM_THREADS=2`, Dummy audio. This is not the separate 0.12 stream's AMD EPYC measurement environment.

## What the required suites exercise

The unchanged core `replay_scenario_runs.gd` executes optional-practice skip, actual qualifying, preparation, physical formation/lights and a four-lap race, followed by exact reconstruction and an altered branch. The unchanged core native suite includes Find, strategy-draft preservation, focus return, legacy save loading, actual sandbox movement, stable rival row identity and original-disk byte guards.

`scenario_authoring_runs.gd` adds a disclosed twelve-lap Pinecrest dry/calm initial-condition recipe: actual formation/lights, an original early stop, complete JSON reconstruction, and a conserving sandbox from the same captured race start. Both player-car outcomes and completed laps are reported; no winning outcome is scripted. Goal assessment occurs only after final classification. Tests also cover duplicate/reloaded receipts, conflicting results, corrupt stored ledgers, wrong returned set ownership, invalid goal/origin promotion and failed disk writes. Malformed-data and correction fixtures are test-only, not injected sporting events.

`scenario_authoring_ui.gd` uses actual mouse/key input at **1440×900 and 1100×720**, each at **100%, 115% and 130% text**. It tests replay entry, branching, original node/draft/state/file retention, sandbox phase autosaves, a malformed import header, invalid then corrected author fields, the fixed Export/Cancel area, the native file destination, a long scenario reader and imported sandbox goals. Four added captures are named `scenario-authoring-1100x720-text130.png`, `scenario-authoring-sandbox-1100x720-text130.png`, `scenario-authoring-scenario-author-1100x720-text130.png` and `scenario-authoring-authored-sandbox-1100x720-text130.png`.

The additional replay-domain assertions reject wrong JSON header types and changed frozen identity, exercise observer detach/reset, reject malformed receipt identity, and prove that a non-ASCII export exceeding the UTF-8 byte ceiling preserves the previous file.

## Performance method and open measurement

The committed recorder benchmark remains observational and counts **1,000 actual fixed steps / 50 simulated seconds**, not paused no-op loops. It performs three alternating recording-off/on pairs, verifies matching sporting hashes and separately measures bookmark, seal and validation operations. Those operations are synchronous and can be visible on larger archives; a small archive is not maximum-size evidence.

A separate matched comparison is scheduled within this implementation execution **after the final clean run finishes**, not in parallel with it: exact replay core `1fd7978` versus runtime `ae4690ab`, the same committed harness, engine, machine, seed and current rival model. No authoring performance improvement or frame-rate claim is made before those results exist. The preserved populated-workspace and demanding-circuit diagnostics remain part of the regular suite; they are not a replacement for matched recorder/validation measurements.

## Acceptance boundaries

No participant usability/accessibility session, controller/screen-reader certification, text support beyond 130%, multi-circuit strategy balance, calibrated forecast coverage, maximum-size archive test or cross-platform deterministic proof is claimed. The new scenario authoring is bounded text/goals around frozen state, not arbitrary rules/roster/resource editing. Goals and local result receipts do not settle campaign money, points, inventory or calendar. An early pit losing to conservation in a fixture demonstrates execution and a real cost, not two equally optimal approaches or universal strategy balance.
