# UI completion: executed verification

## Source and environment

This delivery adds the integrated UI-01–UI-10 components and workspaces to PR #12 on baseline `0f450c542efc8864fef2b0dd32c2fad68be25c2e` (tree `5f78437a40c9e6fafe2993cc1bce46d60fa0595f`).

Godot **4.7.2 Standard**, `4.7.2.stable.official.ed1daf0bf`, Linux X11/Xvfb, Mesa llvmpipe, Dummy audio, `LP_NUM_THREADS=2`, isolated application names and user data. A fresh, cache-free source import passed. Isolated suite copies then reused that imported class cache; they did not use the developer checkout's cache. Production files and tests were frozen for the acceptance matrix. The only subsequent executable-file difference is removal of an extra empty line at the end of `results_workspace.gd`; documentation and this report were finalized afterward. No functional code changed after acceptance.

The delivered scripts/tests SHA-256 manifest digest is `7f058e59da3f1bb6b99058ba4fab316f10166170438efd9a3fd7dc7a19316487`. The downloadable evidence contains the per-file manifests, logs, JSON reports and native captures. Final Git-tree equality is verified separately at publication.

## Acceptance results

**19 suites passed**, **2039 counted checks**, **140 native screenshots generated**, plus the observational UX performance workload. Every process was checked for nonzero exit, script errors and parse errors; an exit code of zero alone was not accepted as success.

| Suite | Checks | Screenshots | Result |
|---|---:|---:|---|
| ui_completion_tests | 68 | 21 | Passed |
| ui_repair_tests | 89 | 5 | Passed |
| ui_smoke | 113 | 27 | Passed |
| strategy_ui_smoke | 34 | 7 | Passed |
| living_racecraft_ui | 33 | 6 | Passed |
| weather_ui_smoke | 33 | 6 | Passed |
| recovery_ui_smoke | 41 | 9 | Passed |
| compact_ui_tests | 119 | 7 | Passed |
| pitwall_ux_tests | 131 | 11 | Passed |
| practice_ui_smoke | 67 | 6 | Passed |
| rivals_ui_tests | 47 | 11 | Passed |
| replay_ui_tests | 111 | 12 | Passed |
| scenario_authoring_ui | 109 | 4 | Passed |
| notebook_ui_tests | 113 | 8 | Passed |
| script_load_tests | 102 | — | Passed |
| run_tests | 706 | — | Passed |
| weekend_strategy_tests | 109 | — | Passed |
| workspace_performance | 14 | — | Passed |
| ux_performance | observational | — | Passed |

The twelve existing native UI suites contribute 951 checks and 114 screenshots. New completion coverage contributes 68 checks and 21 screenshots; the retained repair suite adds 89 checks and 5 screenshots. Direct production-script loading checks 102 files. Domain/strategy and workspace performance remain separate checks, not a substitute for UI testing.

## What the new acceptance exercises

Actual header/Tree component ownership; both persistent drivers; stable observational refreshes; evidence review; first activation staging; native Enter and gamepad A confirmation; exact-driver pit commitment; stale evidence rejection; Keep-plan invariants; D-pad navigation and idempotent InputMap bindings; shoulders/X/B/Start; modal isolation; focused inspector reparent/restore; actual forecast schedules; telemetry units and private rival masking; fitted/planned tyre identity; slider/draft synchronization without implicit Apply; team/radio/weather composition; shared independent practice drafts and targeted physical Run; qualifying context; full results ownership/semantics; long stint scrolling with fixed actions; and 1280×800/115% plus 1100×720/130% control reachability.

The native repair, compact, practice, rival, replay, notebook and scenario-authoring tests additionally retain their existing acceptance paths. Source changes do not modify production domain/service files, save schemas, original-result authority, RNG or physical race behavior.

## Regressions found during implementation

The initial migration exposed layout clipping and the changed Details destination in older native tests. The Details assertion now verifies the real non-modal drawer and full battle context, not the removed AcceptDialog. A previous header assertion now checks the active extracted component and its aliases. No failed safety assertion was dropped. Four pit-wall UX checks disappear only because their loop no longer includes the redundant Decision navigation group entry; Decision remains reachable through the queue, driver cards, finder and controller X.

Native controller testing found that this runtime's default `ui_accept` mapping contained keyboard events but no joypad A. Explicit additive all-device InputMap bindings repair that gap; tests verify both actual A activation and D-pad focus traversal. Native render checks also found a one-pixel third-alternative clipping case at 130% and a potentially oversized stint-history panel; spacing and scroll/fixed-action composition were corrected before final acceptance.

An earlier concurrent fresh-import experiment stalled under load. Its timeouts were not reported as passes. The final run used one successful fresh import followed by isolated cached copies of exactly that source. Software-renderer warnings about unsupported V-Sync changes remain visible in the logs; there are no accepted script/parse/runtime errors or leaked-node warnings.

## Reproduce

```sh
LP_NUM_THREADS=2 python3 scripts/verify.py --godot /path/to/Godot_v4.7.2-stable_linux.x86_64
```

The repository runner retains the full domain/scenario/native/performance sequence and now requires `ui_completion_tests.gd`. The local acceptance matrix above deliberately exercises all changed native surfaces plus base/strategy and observational performance; it is **not** represented as a completed run of every long-running scenario suite in `scripts/verify.py`. Hosted CI runs that larger contract independently after publication.

## Limits

Native screenshots include disclosed synthetic/paused fixtures for deterministic interaction and boundary-state testing; they are not fabricated game forecasts or a complete gameplay-balance evaluation. Performance samples are machine-specific observations, not a 60 FPS claim. Physical controllers, Windows screen readers, broad GPU/CPU configurations and human usability need their respective environments. Supported text preferences end at 130%. Hosted success and mergeability are separate states and must be checked on the published commit; this report does not assert a pending CI run passed.
