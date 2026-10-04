# Littlewild verification

Run `npm ci --no-audit --no-fund`, install Playwright Chromium, and run `npm run verify`. The complete registered gate includes strict TypeScript, architecture, compilation, deterministic domain/CLI/release tests and all 20 browser suites. `--no-browser` creates partial evidence only. Supplemental PNG artifacts require explicit `LITTLEWILD_CAPTURE_SCREENSHOTS=1`; functional image comparisons remain mandatory. Default and explicit-capture external-editor runs separately passed 11/11, preserving the original limits. The capture-policy fix preserves all 421 assertions and their control flow, browser actions and timeouts.

## Current clean-checkout evidence

**1525/1525 checks across 75 suites passed**, including 332 real browser checks. Completed `2026-10-04T00:28:02.597Z` against a clean git archive of `a2eee462f686b9ebbef4e177ed99edb2e65b1a88` with the exact dependency lock. The tracked standalone is copied directly from this passed archive.

- Authored gate input SHA-256: `631b6e8901e68f833692b7e49b0595c5b7206842d9d902493fbb35878e8f7bf0`
- Standalone SHA-256: `ce1b16141e19e7bded25b9e6ca745ea8c106fd01138fa17e72da56239931de72`
- Standalone bytes: 18762531
- Inert implementation/source inventory: 657 files, identity `15f63dc6fcc5ff4ff0ec3c8b2234a35512c739feed8e92c8d94aa17809ab40e1`
- Runtime: `v24.19.0` on `linux/x64`
- Chromium: `/usr/bin/chromium`
- Fresh machine evidence: `verification/v15/gate-results.json` (ignored locally; CI uploads its own evidence).

Documentation and shipping-only changes after this source checkpoint are excluded from the gate's input identity; source/vendor/toolchain inputs must continue to match. Historical 915-check/pre-authoring evidence does not certify this expanded implementation.

| Suite | Passed / total | Seconds |
| --- | ---: | ---: |
| engine-export-cli | 5 / 5 | 11.64 |
| engine-export | 13 / 13 | 23.52 |
| animations | 3 / 3 | 0.04 |
| balancing-cli | 5 / 5 | 12.75 |
| cold-balancing | 23 / 23 | 3.46 |
| balancing | 14 / 14 | 19.67 |
| storytelling | 24 / 24 | 42.43 |
| external-editor-cli | 9 / 9 | 22.63 |
| external-canvas | 21 / 21 | 53.37 |
| creature-editor | 18 / 18 | 32.56 |
| external-editors | 24 / 24 | 73.3 |
| renderer-scene-2d | 10 / 10 | 0.1 |
| scene-editor | 15 / 15 | 18.65 |
| scene-navigation | 15 / 15 | 137.25 |
| architecture-extensions | 10 / 10 | 3.41 |
| building-interiors | 15 / 15 | 6.34 |
| construction | 12 / 12 | 3.12 |
| terraform | 13 / 13 | 4.09 |
| renderers | 13 / 13 | 0.13 |
| canvas-renderer | 29 / 29 | 0.34 |
| architecture-policy | 53 / 53 | 19.85 |
| storage-clock | 15 / 15 | 0.04 |
| gate-integrity | 21 / 21 | 1.08 |
| cli-contracts | 23 / 23 | 16.98 |
| typescript-architecture | 17 / 17 | 4.92 |
| behavior-tree | 7 / 7 | 0.03 |
| content-boundary | 18 / 18 | 1.3 |
| assets | 15 / 15 | 0.32 |
| creatures | 23 / 23 | 1.67 |
| ecs-core | 19 / 19 | 0.07 |
| simulation-profile | 19 / 19 | 0.21 |
| simulation-profile-integration | 17 / 17 | 7.72 |
| scene-environment | 6 / 6 | 0.05 |
| office-scenario | 11 / 11 | 46.03 |
| game-settings | 13 / 13 | 2.64 |
| game-settings-ui | 12 / 12 | 0.04 |
| creature-interactions | 27 / 27 | 17.56 |
| interaction-ui | 12 / 12 | 0.05 |
| developer-toolbox | 32 / 32 | 92.79 |
| engine-composition | 30 / 30 | 1.71 |
| ecs-activity | 9 / 9 | 0.06 |
| ecs-world | 24 / 24 | 0.05 |
| ecs-economy | 15 / 15 | 0.06 |
| ecs-integration | 7 / 7 | 0.72 |
| ecs-world-integration | 6 / 6 | 0.53 |
| ecs-economy-integration | 9 / 9 | 0.52 |
| scenario-domain | 83 / 83 | 32.74 |
| presentation | 49 / 49 | 0.42 |
| pause-policy | 53 / 53 | 0.21 |
| cartography | 71 / 71 | 5.19 |
| domain | 86 / 86 | 3.92 |
| growth-stress | 3 / 3 | 22.96 |
| earned-progression | 8 / 8 | 6.78 |
| scenario-schema-cli | 61 / 61 | 5.16 |
| release | 28 / 28 | 11 |
| external-editors-browser | 11 / 11 | 36.26 |
| external-canvas-browser | 7 / 7 | 28.49 |
| creature-editor-browser | 20 / 20 | 58.98 |
| balancing-defaults-browser | 4 / 4 | 28.92 |
| balancing-browser | 9 / 9 | 26.06 |
| storytelling-browser | 13 / 13 | 93.49 |
| engine-export-browser | 11 / 11 | 32.76 |
| renderer-storytelling | 15 / 15 | 55.27 |
| storytelling-player-browser | 8 / 8 | 56.87 |
| renderer-libraries | 14 / 14 | 29.97 |
| scene-editor-browser | 33 / 33 | 73 |
| building-interiors-browser | 9 / 9 | 22.85 |
| construction-editor-browser | 13 / 13 | 17.71 |
| terraform-browser | 9 / 9 | 20.14 |
| renderers-browser | 14 / 14 | 17.68 |
| office-browser | 9 / 9 | 16.42 |
| game-settings-browser | 11 / 11 | 13.96 |
| browser | 90 / 90 | 31.94 |
| interactions-browser | 8 / 8 | 19.44 |
| browser-contracts | 24 / 24 | 29.13 |

## Evidence integrity and review

The gate clears stale results, requires uniquely named explicit successful checks, bounds children, retains failure logs and rejects changed source or artifacts. Browser pages run under the production CSP with raw diagnostic monitoring. The engine-export browser proof routes only two explicit local HTTPS fixture navigations to the authoritative HTML; all other and external requests are rejected. Other offline suites report empty request diagnostics.

Independent review reproduced the stale import fixes and verified real p5/Pixi/Excalibur/Basic rendering, cutscene completion and disposal, authored room geometry, native/RNG/camera preservation, cold exported-extension portability and reproducible source inventories. Its precise source/artifact scope and fresh desktop/mobile captures are retained with the local review evidence. See `PR25-REVIEW-AND-POLISH.md` and `PR25-POSTPUSH-REVIEW.md`. The earlier whitespace/capture-policy polish preserved runtime and vendor bytes. The subsequent paused-preview optimization changes one runtime module, preserves registered renderer and p5 callbacks and current frame timing, and adds two regression cases for invalidation and disposal. This fresh complete gate certifies the changed runtime and source inventory. Earlier failed combined attempts are retained under `reports/littlewild-pr25-quality/final-gate-attempts/`; they are superseded by this complete passing gate.

## Additional repository verification

The independent native application checkpoint passed **103 registered suites / 21,346 checks across six shards**, with 537 native UI captures on Godot 4.7.2. Its clean merged-main source checkpoint is `0f9cd5e1fc040005daeba8eb6f8c8f66bddd02b0`, digest `824e3a412f751d4a9e636c27e92b41f0e8d3a6cfd70b4d0713a0f8fcc5f2f0f4`. All registered suites passed with their original limits, including the 1,390.8-second duel run below its 1,500-second bound. Each shard separately loaded all 453 native scripts. This evidence is supplementary to final PR-head hosted CI. The earlier 99-suite checkpoint and its initial CPU-contention attempts remain separately retained as historical evidence.

The current native archive completed 335 Python tests: 334 passed and one expected Windows Job Object test skipped on Linux. Native architecture covered 453 scripts with zero violations; advisory quality covered 687 files with zero findings across five tools. These source-pinned companion checks accompany the complete updated 103-suite runtime gate. The current dependency-lock audit reports zero advisories. Actual Godot GLTFDocument static-proxy import/re-export preserves the native pack; a translated companion changes only its intended X position, rechecked through the final compiled Littlewild codec.

The newer native balancing changes from main `dc2acaaec936ee7cbeb26bdced97d88a6d712588` were merged without changing Littlewild inputs. The earlier 99-suite native checkpoint is historical relative to that update. The complete updated 103-suite/six-shard checkpoint is retained separately; final-head CI remains a separate acceptance boundary.

Current-head GitHub checks must be inspected after pushing; old green runs and this local evidence are not represented as final hosted CI.

## Limits

Headless Chromium does not establish hardware GPU performance, physical touch, Firefox/Safari behavior, screen-reader conformance, localization or human usability/balance. External editor conversion supports documented data and static proxies, not arbitrary scripts or animated meshes. Complete engine JSON contains inert implementation/data/asset/porting inputs for code generators; semantic conversion into a functioning Godot game remains a manual port. See `ENGINE-EXPORT.md`, `EXTERNAL-EDITORS.md` and `QUALITY-AUDIT.md`.
