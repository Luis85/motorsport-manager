# Littlewild verification

Run `npm ci --no-audit --no-fund`, install Playwright Chromium, and run `npm run verify`. The complete registered gate includes strict TypeScript, architecture, compilation, deterministic domain/CLI/release tests and all 20 browser suites. `--no-browser` creates partial evidence only. Supplemental PNG artifacts require explicit `LITTLEWILD_CAPTURE_SCREENSHOTS=1`; functional image comparisons remain mandatory. Default and explicit-capture external-editor runs separately passed 11/11, preserving the original limits. The capture-policy fix preserves all 421 assertions and their control flow, browser actions and timeouts.

## Current clean-checkout evidence

**1525/1525 checks across 75 suites passed**, including 332 real browser checks. Completed `2026-10-04T02:22:59.226Z` against a clean git archive of `e7befadc7ea74055737983ae884c25a6cf321257` with the exact dependency lock. The tracked standalone is copied directly from this passed archive.

- Authored gate input SHA-256: `d368735e844818c567035785f16c22367e6d65d80edf87d90f56fa3d3b1b54db`
- Standalone SHA-256: `ce1b16141e19e7bded25b9e6ca745ea8c106fd01138fa17e72da56239931de72`
- Standalone bytes: 18762531
- Inert implementation/source inventory: 657 files, identity `15f63dc6fcc5ff4ff0ec3c8b2234a35512c739feed8e92c8d94aa17809ab40e1`
- Runtime: `v24.19.0` on `linux/x64`
- Chromium: `/usr/bin/chromium`
- Fresh machine evidence: `verification/v15/gate-results.json` (ignored locally; CI uploads its own evidence).

Documentation and shipping-only changes after this source checkpoint are excluded from the gate's input identity; source/vendor/toolchain inputs must continue to match. Historical 915-check/pre-authoring evidence does not certify this expanded implementation.

| Suite | Passed / total | Seconds |
| --- | ---: | ---: |
| engine-export-cli | 5 / 5 | 11.55 |
| engine-export | 13 / 13 | 23.59 |
| animations | 3 / 3 | 0.03 |
| balancing-cli | 5 / 5 | 13.01 |
| cold-balancing | 23 / 23 | 3.38 |
| balancing | 14 / 14 | 19.56 |
| storytelling | 24 / 24 | 40.95 |
| external-editor-cli | 9 / 9 | 22.95 |
| external-canvas | 21 / 21 | 52.46 |
| creature-editor | 18 / 18 | 32.07 |
| external-editors | 24 / 24 | 71.69 |
| renderer-scene-2d | 10 / 10 | 0.09 |
| scene-editor | 15 / 15 | 18.49 |
| scene-navigation | 15 / 15 | 137.28 |
| architecture-extensions | 10 / 10 | 3.2 |
| building-interiors | 15 / 15 | 6.31 |
| construction | 12 / 12 | 3.08 |
| terraform | 13 / 13 | 4.12 |
| renderers | 13 / 13 | 0.13 |
| canvas-renderer | 29 / 29 | 0.32 |
| architecture-policy | 53 / 53 | 19.56 |
| storage-clock | 15 / 15 | 0.04 |
| gate-integrity | 21 / 21 | 1.08 |
| cli-contracts | 23 / 23 | 17.6 |
| typescript-architecture | 17 / 17 | 5.79 |
| behavior-tree | 7 / 7 | 0.04 |
| content-boundary | 18 / 18 | 1.32 |
| assets | 15 / 15 | 0.27 |
| creatures | 23 / 23 | 1.61 |
| ecs-core | 19 / 19 | 0.06 |
| simulation-profile | 19 / 19 | 0.23 |
| simulation-profile-integration | 17 / 17 | 7.69 |
| scene-environment | 6 / 6 | 0.04 |
| office-scenario | 11 / 11 | 46.14 |
| game-settings | 13 / 13 | 2.78 |
| game-settings-ui | 12 / 12 | 0.05 |
| creature-interactions | 27 / 27 | 17.68 |
| interaction-ui | 12 / 12 | 0.04 |
| developer-toolbox | 32 / 32 | 92.49 |
| engine-composition | 30 / 30 | 1.83 |
| ecs-activity | 9 / 9 | 0.07 |
| ecs-world | 24 / 24 | 0.05 |
| ecs-economy | 15 / 15 | 0.06 |
| ecs-integration | 7 / 7 | 0.8 |
| ecs-world-integration | 6 / 6 | 0.57 |
| ecs-economy-integration | 9 / 9 | 0.57 |
| scenario-domain | 83 / 83 | 33.36 |
| presentation | 49 / 49 | 0.38 |
| pause-policy | 53 / 53 | 0.2 |
| cartography | 71 / 71 | 4.84 |
| domain | 86 / 86 | 3.86 |
| growth-stress | 3 / 3 | 22.66 |
| earned-progression | 8 / 8 | 6.68 |
| scenario-schema-cli | 61 / 61 | 5.08 |
| release | 28 / 28 | 11.05 |
| external-editors-browser | 11 / 11 | 37.63 |
| external-canvas-browser | 7 / 7 | 30.97 |
| creature-editor-browser | 20 / 20 | 57.75 |
| balancing-defaults-browser | 4 / 4 | 28.15 |
| balancing-browser | 9 / 9 | 25.83 |
| storytelling-browser | 13 / 13 | 94.54 |
| engine-export-browser | 11 / 11 | 33.94 |
| renderer-storytelling | 15 / 15 | 53.79 |
| storytelling-player-browser | 8 / 8 | 60.34 |
| renderer-libraries | 14 / 14 | 33.36 |
| scene-editor-browser | 33 / 33 | 71.7 |
| building-interiors-browser | 9 / 9 | 23.43 |
| construction-editor-browser | 13 / 13 | 17.37 |
| terraform-browser | 9 / 9 | 19.47 |
| renderers-browser | 14 / 14 | 18.13 |
| office-browser | 9 / 9 | 17.77 |
| game-settings-browser | 11 / 11 | 14.64 |
| browser | 90 / 90 | 29.25 |
| interactions-browser | 8 / 8 | 17.21 |
| browser-contracts | 24 / 24 | 29.47 |

## Evidence integrity and review

The gate clears stale results, requires uniquely named explicit successful checks, bounds children, retains failure logs and rejects changed source or artifacts. Browser pages run under the production CSP with raw diagnostic monitoring. The engine-export browser proof routes only two explicit local HTTPS fixture navigations to the authoritative HTML; all other and external requests are rejected. Other offline suites report empty request diagnostics.

Independent review reproduced the stale import fixes and verified real p5/Pixi/Excalibur/Basic rendering, cutscene completion and disposal, authored room geometry, native/RNG/camera preservation, cold exported-extension portability and reproducible source inventories. Its precise source/artifact scope and fresh desktop/mobile captures are retained with the local review evidence. See `PR25-REVIEW-AND-POLISH.md` and `PR25-POSTPUSH-REVIEW.md`. The earlier whitespace/capture-policy polish preserved runtime and vendor bytes. The subsequent paused-preview optimization changes one runtime module, preserves registered renderer and p5 callbacks and current frame timing, and adds two regression cases for invalidation and disposal. The subsequent verifier change queues pixel readback through a GPU buffer and fence rather than blocking on a CPU read. It retains every functional pixel assertion and raw diagnostic check. This fresh complete gate certifies changed verification inputs; the runtime rendering, vendor code, standalone bytes and embedded source inventory remain unchanged relative to the paused-preview checkpoint. Earlier failed combined attempts are retained under `reports/littlewild-pr25-quality/final-gate-attempts/`; they are superseded by this complete passing gate.

## Additional repository verification

The independent native application checkpoint passed **103 registered suites / 21,346 checks across six shards**, with 537 native UI captures on Godot 4.7.2. Its clean merged-main source checkpoint is `0f9cd5e1fc040005daeba8eb6f8c8f66bddd02b0`, digest `824e3a412f751d4a9e636c27e92b41f0e8d3a6cfd70b4d0713a0f8fcc5f2f0f4`. All registered suites passed with their original limits, including the 1,390.8-second duel run below its 1,500-second bound. Each shard separately loaded all 453 native scripts. This evidence is supplementary to final PR-head hosted CI. The earlier 99-suite checkpoint and its initial CPU-contention attempts remain separately retained as historical evidence.

The current native archive completed 335 Python tests: 334 passed and one expected Windows Job Object test skipped on Linux. Native architecture covered 453 scripts with zero violations; advisory quality covered 687 files with zero findings across five tools. These source-pinned companion checks accompany the complete updated 103-suite runtime gate. The current dependency-lock audit reports zero advisories. Actual Godot GLTFDocument static-proxy import/re-export preserves the native pack; a translated companion changes only its intended X position, rechecked through the final compiled Littlewild codec.

The newer native balancing changes from main `dc2acaaec936ee7cbeb26bdced97d88a6d712588` were merged without changing Littlewild inputs. The earlier 99-suite native checkpoint is historical relative to that update. The complete updated 103-suite/six-shard checkpoint is retained separately; final-head CI remains a separate acceptance boundary.

Current-head GitHub checks must be inspected after pushing; old green runs and this local evidence are not represented as final hosted CI.

## Limits

Headless Chromium does not establish hardware GPU performance, physical touch, Firefox/Safari behavior, screen-reader conformance, localization or human usability/balance. External editor conversion supports documented data and static proxies, not arbitrary scripts or animated meshes. Complete engine JSON contains inert implementation/data/asset/porting inputs for code generators; semantic conversion into a functioning Godot game remains a manual port. See `ENGINE-EXPORT.md`, `EXTERNAL-EDITORS.md` and `QUALITY-AUDIT.md`.
