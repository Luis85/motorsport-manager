# Littlewild verification

Run `npm ci --no-audit --no-fund`, install Playwright Chromium, and run `npm run verify`. The complete registered gate includes strict TypeScript, architecture, compilation, deterministic domain/CLI/release tests and all 20 browser suites. `--no-browser` creates partial evidence only. Supplemental PNG artifacts require explicit `LITTLEWILD_CAPTURE_SCREENSHOTS=1`; functional image comparisons remain mandatory. Default and explicit-capture external-editor runs separately passed 11/11, preserving the original limits. The capture-policy fix preserves all 421 assertions and their control flow, browser actions and timeouts.

## Current clean-checkout evidence

**1529/1529 checks across 75 suites passed**, including 334 real browser checks. Completed `2026-10-04T05:22:46.441Z` against a clean git archive of `c0e66f74569367d03058a6c9ddbc2e4f4ea38aa4` with exact `npm ci` lock resolution. The tracked standalone is copied directly from this passed archive.

- Authored gate input SHA-256: `cd76fe50a57fc2fab1f56635f5b3e773650ebfe538f21641bf23944b81f7fde1`
- Standalone SHA-256: `c33c69c238ad9075609dd4d1ae1142f18727cbf46ad3a6843f7bba139b46e421`
- Standalone bytes: 18765740
- Inert implementation/source inventory: 657 files, identity `6830af3104c19377d3c531df7048c0ac6f9592a48bbd434a741669875e181f74`
- Actual local runtime: `v24.19.0`; system Chromium `151.0.7922.173`
- Selected official hosted browser: Chromium `151.0.7922.34`, revision `1234`, via exact Playwright `1.62.1`
- Fresh sealed evidence: `reports/littlewild-pr25-quality/final-c0e66f7/` (187 historical core paths plus 2 additional records; 189 actual sealed files).

The exact official stable Playwright and playwright-core `1.62.1` pin selects bundled Chromium `151.0.7922.34` revision `1234`, replacing the failed hosted `153.0.8010.12` toolchain. This is a published stable-version reproducibility mitigation, not a proven explanation of either timeout. It does not contain the unreleased Playwright 1.64 [Range patch 43076](https://github.com/microsoft/playwright/pull/43076). [Official1.62.1 browser metadata](https://github.com/microsoft/playwright/blob/v1.62.1/packages/playwright-core/browsers.json) documents the selected bundle. Gameplay, verification source, vendor bytes, original assertions and numeric limits are unchanged; all 284 emitted JavaScript files match the lifecycle checkpoint. Only package/lock configuration rows and corresponding dependency metadata change in the 657-file source bundle.

The fresh local gate actually used system Chromium `151.0.7922.173`; it does not certify the separately bundled hosted `151.0.7922.34`. All seven workflows must succeed on the new publication head before hosted acceptance. Prior hosted failures and local checkpoints retain their own identities.

Hosted `bc7e8bb` passed 60 preceding suites / 1,246 checks, then Storytelling failed 13/15. The desktop Add track and Apply storytelling import clicks exceeded the unchanged 20-second action limit after resolving visible, enabled and stable buttons. Subsequent keyframe/p5 cases establish Add track committed; import commit is unproven because the following lifecycle case does not assert the renamed clip. All mobile and both new lifecycle cases passed; raw page/console/request diagnostics were empty, and renderer-library verification was not reached. Exact failure evidence remains under `reports/littlewild-pr25-quality/hosted-bc7e8bb-failure-diagnostics/`.

Private whole-click profiles passed their five original desktop cases plus raw diagnostics (6/6 each) at 4x slowdown and at 16x around the target clicks, retaining 20-second actions and the 300-second suite budget. Neither reproduced the hosted failure. Validation, renderer disposal/replacement and hit-target cleanup incurred measured work; no isolated 20-second GPU disposal stall or causal determination was established. Actual phase, CDP and GPU evidence is retained in `reports/littlewild-pr25-quality/performance-checkouts/storytelling-bc7/CLICK-DIAGNOSIS.json`.

| Suite | Passed / total | Seconds |
| --- | ---: | ---: |
| engine-export-cli | 5 / 5 | 11.53 |
| engine-export | 13 / 13 | 23.36 |
| animations | 5 / 5 | 0.04 |
| balancing-cli | 5 / 5 | 13.02 |
| cold-balancing | 23 / 23 | 3.49 |
| balancing | 14 / 14 | 19.91 |
| storytelling | 24 / 24 | 42.67 |
| external-editor-cli | 9 / 9 | 22.74 |
| external-canvas | 21 / 21 | 51.86 |
| creature-editor | 18 / 18 | 32.14 |
| external-editors | 24 / 24 | 73.97 |
| renderer-scene-2d | 10 / 10 | 0.1 |
| scene-editor | 15 / 15 | 18.33 |
| scene-navigation | 15 / 15 | 134.32 |
| architecture-extensions | 10 / 10 | 3.21 |
| building-interiors | 15 / 15 | 6.17 |
| construction | 12 / 12 | 3.03 |
| terraform | 13 / 13 | 4.04 |
| renderers | 13 / 13 | 0.13 |
| canvas-renderer | 29 / 29 | 0.31 |
| architecture-policy | 53 / 53 | 19.19 |
| storage-clock | 15 / 15 | 0.04 |
| gate-integrity | 21 / 21 | 1.09 |
| cli-contracts | 23 / 23 | 16.94 |
| typescript-architecture | 17 / 17 | 5.02 |
| behavior-tree | 7 / 7 | 0.04 |
| content-boundary | 18 / 18 | 1.37 |
| assets | 15 / 15 | 0.27 |
| creatures | 23 / 23 | 1.62 |
| ecs-core | 19 / 19 | 0.07 |
| simulation-profile | 19 / 19 | 0.2 |
| simulation-profile-integration | 17 / 17 | 7.88 |
| scene-environment | 6 / 6 | 0.04 |
| office-scenario | 11 / 11 | 45.15 |
| game-settings | 13 / 13 | 2.5 |
| game-settings-ui | 12 / 12 | 0.04 |
| creature-interactions | 27 / 27 | 17.36 |
| interaction-ui | 12 / 12 | 0.04 |
| developer-toolbox | 32 / 32 | 92.37 |
| engine-composition | 30 / 30 | 1.69 |
| ecs-activity | 9 / 9 | 0.06 |
| ecs-world | 24 / 24 | 0.04 |
| ecs-economy | 15 / 15 | 0.06 |
| ecs-integration | 7 / 7 | 0.76 |
| ecs-world-integration | 6 / 6 | 0.53 |
| ecs-economy-integration | 9 / 9 | 0.51 |
| scenario-domain | 83 / 83 | 32.55 |
| presentation | 49 / 49 | 0.43 |
| pause-policy | 53 / 53 | 0.22 |
| cartography | 71 / 71 | 4.9 |
| domain | 86 / 86 | 3.95 |
| growth-stress | 3 / 3 | 22.16 |
| earned-progression | 8 / 8 | 6.53 |
| scenario-schema-cli | 61 / 61 | 4.94 |
| release | 28 / 28 | 10.56 |
| external-editors-browser | 11 / 11 | 34.7 |
| external-canvas-browser | 7 / 7 | 30 |
| creature-editor-browser | 20 / 20 | 58.89 |
| balancing-defaults-browser | 4 / 4 | 28.47 |
| balancing-browser | 9 / 9 | 25.93 |
| storytelling-browser | 15 / 15 | 84.4 |
| engine-export-browser | 11 / 11 | 36.64 |
| renderer-storytelling | 15 / 15 | 54.55 |
| storytelling-player-browser | 8 / 8 | 58.9 |
| renderer-libraries | 14 / 14 | 30.93 |
| scene-editor-browser | 33 / 33 | 72.39 |
| building-interiors-browser | 9 / 9 | 22.28 |
| construction-editor-browser | 13 / 13 | 17.53 |
| terraform-browser | 9 / 9 | 19.54 |
| renderers-browser | 14 / 14 | 16.74 |
| office-browser | 9 / 9 | 16.78 |
| game-settings-browser | 11 / 11 | 13.72 |
| browser | 90 / 90 | 31.3 |
| interactions-browser | 8 / 8 | 17.22 |
| browser-contracts | 24 / 24 | 29.27 |

## Evidence integrity and review

The gate clears stale results, requires uniquely named explicit successful checks, bounds children, retains failure logs and rejects changed source or artifacts. Browser pages run under the production CSP with raw diagnostic monitoring. The engine-export browser proof routes only two explicit local HTTPS fixture navigations to the authoritative HTML; all other and external requests are rejected. Other offline suites report empty request diagnostics.

Independent review reproduced the stale import fixes and verified real p5/Pixi/Excalibur/Basic rendering, cutscene completion and disposal, authored room geometry, native/RNG/camera preservation, cold exported-extension portability and reproducible source inventories. Its precise source/artifact scope and fresh desktop/mobile captures are retained with the local review evidence. See `PR25-REVIEW-AND-POLISH.md` and `PR25-POSTPUSH-REVIEW.md`. The earlier whitespace/capture-policy polish preserved runtime and vendor bytes. The subsequent paused-preview optimization changes one runtime module, preserves registered renderer and p5 callbacks and current frame timing, and adds two regression cases for invalidation and disposal. The subsequent verifier change queues pixel readback through a GPU buffer and fence rather than blocking on a CPU read. It retains every functional pixel assertion and raw diagnostic check. At the earlier e7befad verifier-only checkpoint, runtime rendering, vendor code, standalone bytes and embedded source inventory remained unchanged relative to the paused-preview checkpoint. Earlier failed combined attempts are retained under `reports/littlewild-pr25-quality/final-gate-attempts/`; they are superseded by this complete passing gate.

The current lifecycle checkpoint preserves the exact preview wrapper and canvases during selection-only redraws, prepares a fresh connected mount after session/revision invalidation, and avoids repeated p5 redraws of an already-cleared empty layer. Nonempty callbacks, validation, resize clears and pending-paint disposal remain checked. Two new Node and two desktop/mobile lifecycle checks augment every original check. A paired CPU-throttled profile reduced empty paints 36 to 2 but did not reproduce the hosted timeout or establish a latency improvement. Final-head hosted verification remains required.

## Additional repository verification

The independent native application checkpoint passed **103 registered suites / 21,346 checks across six shards**, with 537 native UI captures on Godot 4.7.2. Its clean merged-main source checkpoint is `0f9cd5e1fc040005daeba8eb6f8c8f66bddd02b0`, digest `824e3a412f751d4a9e636c27e92b41f0e8d3a6cfd70b4d0713a0f8fcc5f2f0f4`. All registered suites passed with their original limits, including the 1,390.8-second duel run below its 1,500-second bound. Each shard separately loaded all 453 native scripts. This evidence is supplementary to final PR-head hosted CI. The earlier 99-suite checkpoint and its initial CPU-contention attempts remain separately retained as historical evidence.

The current native archive completed 335 Python tests: 334 passed and one expected Windows Job Object test skipped on Linux. Native architecture covered 453 scripts with zero violations; advisory quality covered 687 files with zero findings across five tools. These source-pinned companion checks accompany the complete updated 103-suite runtime gate. The current dependency-lock audit reports zero advisories. Actual Godot GLTFDocument static-proxy import/re-export preserves the native pack; a translated companion changes only its intended X position, rechecked through the final compiled Littlewild codec.

The newer native balancing changes from main `dc2acaaec936ee7cbeb26bdced97d88a6d712588` were merged without changing Littlewild inputs. The earlier 99-suite native checkpoint is historical relative to that update. The complete updated 103-suite/six-shard checkpoint is retained separately; final-head CI remains a separate acceptance boundary.

Current-head GitHub checks must be inspected after pushing; old green runs and this local evidence are not represented as final hosted CI.

## Limits

Headless Chromium does not establish hardware GPU performance, physical touch, Firefox/Safari behavior, screen-reader conformance, localization or human usability/balance. External editor conversion supports documented data and static proxies, not arbitrary scripts or animated meshes. Complete engine JSON contains inert implementation/data/asset/porting inputs for code generators; semantic conversion into a functioning Godot game remains a manual port. See `ENGINE-EXPORT.md`, `EXTERNAL-EDITORS.md` and `QUALITY-AUDIT.md`.
