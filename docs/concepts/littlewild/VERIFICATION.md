# Littlewild verification

Run `npm ci --no-audit --no-fund`, install Playwright Chromium, and run `npm run verify`. The complete registered gate includes strict TypeScript, architecture, compilation, deterministic domain/CLI/release tests and all 20 browser suites. `--no-browser` creates partial evidence only. Supplemental PNG artifacts require explicit `LITTLEWILD_CAPTURE_SCREENSHOTS=1`; functional image comparisons remain mandatory. Default and explicit-capture external-editor runs separately passed 11/11, preserving the original limits. The capture-policy fix preserves all 421 assertions and their control flow, browser actions and timeouts.

## Current clean-checkout evidence

**1523/1523 checks across 75 suites passed**, including 332 real browser checks. Completed `2026-10-03T22:58:43.467Z` against a clean git archive of `a1bc95db62d9a31f6d97c979a335b9dfa17b6117` with the exact dependency lock. The tracked standalone is copied directly from this passed archive.

- Authored gate input SHA-256: `6ba2e108553c2cd1d7b74f9ba522370b58d1b1f4a5778dd55152adc65e833049`
- Standalone SHA-256: `0f205d483b1dcc1ac17311b034d262f54355f0308518701b1ea377cf8078e007`
- Standalone bytes: 18761160
- Inert implementation/source inventory: 657 files, identity `3084091dd08a1b7e30a66725e77984c3962a36e0c26e2e1f3f8b5e2d2cbfb3e9`
- Runtime: `v24.19.0` on `linux/x64`
- Chromium: `/usr/bin/chromium`
- Fresh machine evidence: `verification/v15/gate-results.json` (ignored locally; CI uploads its own evidence).

Documentation and shipping-only changes after this source checkpoint are excluded from the gate's input identity; source/vendor/toolchain inputs must continue to match. Historical 915-check/pre-authoring evidence does not certify this expanded implementation.

| Suite | Passed / total | Seconds |
| --- | ---: | ---: |
| engine-export-cli | 5 / 5 | 11.84 |
| engine-export | 13 / 13 | 23.6 |
| animations | 3 / 3 | 0.04 |
| balancing-cli | 5 / 5 | 13.24 |
| cold-balancing | 23 / 23 | 3.43 |
| balancing | 14 / 14 | 19.65 |
| storytelling | 24 / 24 | 42.34 |
| external-editor-cli | 9 / 9 | 23.33 |
| external-canvas | 21 / 21 | 53.29 |
| creature-editor | 18 / 18 | 32.99 |
| external-editors | 24 / 24 | 72.79 |
| renderer-scene-2d | 10 / 10 | 0.11 |
| scene-editor | 15 / 15 | 18.87 |
| scene-navigation | 15 / 15 | 138.49 |
| architecture-extensions | 10 / 10 | 3.13 |
| building-interiors | 15 / 15 | 6.18 |
| construction | 12 / 12 | 2.97 |
| terraform | 13 / 13 | 4.18 |
| renderers | 11 / 11 | 0.11 |
| canvas-renderer | 29 / 29 | 0.31 |
| architecture-policy | 53 / 53 | 19.5 |
| storage-clock | 15 / 15 | 0.04 |
| gate-integrity | 21 / 21 | 1.1 |
| cli-contracts | 23 / 23 | 16.98 |
| typescript-architecture | 17 / 17 | 5.19 |
| behavior-tree | 7 / 7 | 0.03 |
| content-boundary | 18 / 18 | 1.34 |
| assets | 15 / 15 | 0.29 |
| creatures | 23 / 23 | 1.7 |
| ecs-core | 19 / 19 | 0.06 |
| simulation-profile | 19 / 19 | 0.22 |
| simulation-profile-integration | 17 / 17 | 7.7 |
| scene-environment | 6 / 6 | 0.05 |
| office-scenario | 11 / 11 | 45.59 |
| game-settings | 13 / 13 | 2.66 |
| game-settings-ui | 12 / 12 | 0.05 |
| creature-interactions | 27 / 27 | 17.16 |
| interaction-ui | 12 / 12 | 0.04 |
| developer-toolbox | 32 / 32 | 91.77 |
| engine-composition | 30 / 30 | 1.75 |
| ecs-activity | 9 / 9 | 0.06 |
| ecs-world | 24 / 24 | 0.04 |
| ecs-economy | 15 / 15 | 0.06 |
| ecs-integration | 7 / 7 | 0.74 |
| ecs-world-integration | 6 / 6 | 0.53 |
| ecs-economy-integration | 9 / 9 | 0.5 |
| scenario-domain | 83 / 83 | 32.71 |
| presentation | 49 / 49 | 0.45 |
| pause-policy | 53 / 53 | 0.21 |
| cartography | 71 / 71 | 5.11 |
| domain | 86 / 86 | 3.88 |
| growth-stress | 3 / 3 | 22.85 |
| earned-progression | 8 / 8 | 6.54 |
| scenario-schema-cli | 61 / 61 | 5.13 |
| release | 28 / 28 | 11.02 |
| external-editors-browser | 11 / 11 | 35.88 |
| external-canvas-browser | 7 / 7 | 30.7 |
| creature-editor-browser | 20 / 20 | 62.19 |
| balancing-defaults-browser | 4 / 4 | 28.56 |
| balancing-browser | 9 / 9 | 25.5 |
| storytelling-browser | 13 / 13 | 104.13 |
| engine-export-browser | 11 / 11 | 33.96 |
| renderer-storytelling | 15 / 15 | 55.23 |
| storytelling-player-browser | 8 / 8 | 61.35 |
| renderer-libraries | 14 / 14 | 29.84 |
| scene-editor-browser | 33 / 33 | 72.25 |
| building-interiors-browser | 9 / 9 | 22.5 |
| construction-editor-browser | 13 / 13 | 17.47 |
| terraform-browser | 9 / 9 | 20.27 |
| renderers-browser | 14 / 14 | 17.95 |
| office-browser | 9 / 9 | 17.18 |
| game-settings-browser | 11 / 11 | 15.61 |
| browser | 90 / 90 | 31.35 |
| interactions-browser | 8 / 8 | 16.86 |
| browser-contracts | 24 / 24 | 30.34 |

## Evidence integrity and review

The gate clears stale results, requires uniquely named explicit successful checks, bounds children, retains failure logs and rejects changed source or artifacts. Browser pages run under the production CSP with raw diagnostic monitoring. The engine-export browser proof routes only two explicit local HTTPS fixture navigations to the authoritative HTML; all other and external requests are rejected. Other offline suites report empty request diagnostics.

Independent review reproduced the stale import fixes and verified real p5/Pixi/Excalibur/Basic rendering, cutscene completion and disposal, authored room geometry, native/RNG/camera preservation, cold exported-extension portability and reproducible source inventories. Its precise source/artifact scope and fresh desktop/mobile captures are retained with the local review evidence. See `PR25-REVIEW-AND-POLISH.md` and `PR25-POSTPUSH-REVIEW.md`. The post-push source polish preserves all compiled runtime and vendor bytes; this fresh complete gate certifies its changed embedded source inventory. Earlier failed combined attempts are retained under `reports/littlewild-pr25-quality/final-gate-attempts/`; they are superseded by this complete passing gate.

## Additional repository verification

The independent native application checkpoint passed **103 registered suites / 21,346 checks across six shards**, with 537 native UI captures on Godot 4.7.2. Its clean merged-main source checkpoint is `0f9cd5e1fc040005daeba8eb6f8c8f66bddd02b0`, digest `824e3a412f751d4a9e636c27e92b41f0e8d3a6cfd70b4d0713a0f8fcc5f2f0f4`. All registered suites passed with their original limits, including the 1,390.8-second duel run below its 1,500-second bound. Each shard separately loaded all 453 native scripts. This evidence is supplementary to final PR-head hosted CI. The earlier 99-suite checkpoint and its initial CPU-contention attempts remain separately retained as historical evidence.

The current native archive completed 335 Python tests: 334 passed and one expected Windows Job Object test skipped on Linux. Native architecture covered 453 scripts with zero violations; advisory quality covered 687 files with zero findings across five tools. These source-pinned companion checks accompany the complete updated 103-suite runtime gate. The current dependency-lock audit reports zero advisories. Actual Godot GLTFDocument static-proxy import/re-export preserves the native pack; a translated companion changes only its intended X position, rechecked through the final compiled Littlewild codec.

The newer native balancing changes from main `dc2acaaec936ee7cbeb26bdced97d88a6d712588` were merged without changing Littlewild inputs. The earlier 99-suite native checkpoint is historical relative to that update. The complete updated 103-suite/six-shard checkpoint is retained separately; final-head CI remains a separate acceptance boundary.

Current-head GitHub checks must be inspected after pushing; old green runs and this local evidence are not represented as final hosted CI.

## Limits

Headless Chromium does not establish hardware GPU performance, physical touch, Firefox/Safari behavior, screen-reader conformance, localization or human usability/balance. External editor conversion supports documented data and static proxies, not arbitrary scripts or animated meshes. Complete engine JSON contains inert implementation/data/asset/porting inputs for code generators; semantic conversion into a functioning Godot game remains a manual port. See `ENGINE-EXPORT.md`, `EXTERNAL-EDITORS.md` and `QUALITY-AUDIT.md`.
