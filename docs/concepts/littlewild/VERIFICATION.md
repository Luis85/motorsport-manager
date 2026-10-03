# Littlewild verification

Run `npm ci --no-audit --no-fund`, install Playwright Chromium, and run `npm run verify`. The complete registered gate includes strict TypeScript, architecture, compilation, deterministic domain/CLI/release tests and all 20 browser suites. `--no-browser` creates partial evidence only.

## Current clean-checkout evidence

**1523/1523 checks across 75 suites passed**, including 332 real browser checks. Completed `2026-10-03T21:37:49.428Z` against a clean git archive of `9b56e8ff2a609a112239476d8d51ed54824300af` with the exact dependency lock. The tracked standalone is copied directly from this passed archive.

- Authored gate input SHA-256: `e6dcff3d24fa9a2d4067b89517d959b946b5dba7c92a537873019f79306ec371`
- Standalone SHA-256: `feb63a408193509adfc771e6c520594ce40724aaa57bb5b58fdf547630f1c201`
- Standalone bytes: 18761164
- Inert implementation/source inventory: 657 files, identity `d5eba5743991a7b50c917c5b97cc4073c08240d908f47a6899422fbc268a597c`
- Runtime: `v24.19.0` on `linux/x64`
- Chromium: `/usr/bin/chromium`
- Fresh machine evidence: `verification/v15/gate-results.json` (ignored locally; CI uploads its own evidence).

Documentation and shipping-only changes after this source checkpoint are excluded from the gate's input identity; source/vendor/toolchain inputs must continue to match. Historical 915-check/pre-authoring evidence does not certify this expanded implementation.

| Suite | Passed / total | Seconds |
| --- | ---: | ---: |
| engine-export-cli | 5 / 5 | 12.15 |
| engine-export | 13 / 13 | 25.05 |
| animations | 3 / 3 | 0.04 |
| balancing-cli | 5 / 5 | 14.02 |
| cold-balancing | 23 / 23 | 3.7 |
| balancing | 14 / 14 | 20.7 |
| storytelling | 24 / 24 | 44.34 |
| external-editor-cli | 9 / 9 | 23.69 |
| external-canvas | 21 / 21 | 56.77 |
| creature-editor | 18 / 18 | 33.8 |
| external-editors | 24 / 24 | 76.61 |
| renderer-scene-2d | 10 / 10 | 0.12 |
| scene-editor | 15 / 15 | 20.03 |
| scene-navigation | 15 / 15 | 142.44 |
| architecture-extensions | 10 / 10 | 3.34 |
| building-interiors | 15 / 15 | 6.11 |
| construction | 12 / 12 | 3.17 |
| terraform | 13 / 13 | 4.34 |
| renderers | 11 / 11 | 0.13 |
| canvas-renderer | 29 / 29 | 0.38 |
| architecture-policy | 53 / 53 | 20.51 |
| storage-clock | 15 / 15 | 0.04 |
| gate-integrity | 21 / 21 | 1.09 |
| cli-contracts | 23 / 23 | 17.4 |
| typescript-architecture | 17 / 17 | 5.04 |
| behavior-tree | 7 / 7 | 0.03 |
| content-boundary | 18 / 18 | 1.35 |
| assets | 15 / 15 | 0.27 |
| creatures | 23 / 23 | 1.65 |
| ecs-core | 19 / 19 | 0.08 |
| simulation-profile | 19 / 19 | 0.23 |
| simulation-profile-integration | 17 / 17 | 8.45 |
| scene-environment | 6 / 6 | 0.04 |
| office-scenario | 11 / 11 | 46.25 |
| game-settings | 13 / 13 | 2.84 |
| game-settings-ui | 12 / 12 | 0.05 |
| creature-interactions | 27 / 27 | 18.49 |
| interaction-ui | 12 / 12 | 0.04 |
| developer-toolbox | 32 / 32 | 96.98 |
| engine-composition | 30 / 30 | 1.73 |
| ecs-activity | 9 / 9 | 0.06 |
| ecs-world | 24 / 24 | 0.04 |
| ecs-economy | 15 / 15 | 0.06 |
| ecs-integration | 7 / 7 | 0.79 |
| ecs-world-integration | 6 / 6 | 0.51 |
| ecs-economy-integration | 9 / 9 | 0.53 |
| scenario-domain | 83 / 83 | 33.59 |
| presentation | 49 / 49 | 0.46 |
| pause-policy | 53 / 53 | 0.21 |
| cartography | 71 / 71 | 5.29 |
| domain | 86 / 86 | 3.96 |
| growth-stress | 3 / 3 | 23.47 |
| earned-progression | 8 / 8 | 7.01 |
| scenario-schema-cli | 61 / 61 | 5.54 |
| release | 28 / 28 | 11.52 |
| external-editors-browser | 11 / 11 | 46.24 |
| external-canvas-browser | 7 / 7 | 39.08 |
| creature-editor-browser | 20 / 20 | 73.62 |
| balancing-defaults-browser | 4 / 4 | 29.5 |
| balancing-browser | 9 / 9 | 35.64 |
| storytelling-browser | 13 / 13 | 133.07 |
| engine-export-browser | 11 / 11 | 39.88 |
| renderer-storytelling | 15 / 15 | 61.84 |
| storytelling-player-browser | 8 / 8 | 67.91 |
| renderer-libraries | 14 / 14 | 39.29 |
| scene-editor-browser | 33 / 33 | 82.36 |
| building-interiors-browser | 9 / 9 | 22.83 |
| construction-editor-browser | 13 / 13 | 17.67 |
| terraform-browser | 9 / 9 | 22.32 |
| renderers-browser | 14 / 14 | 16.94 |
| office-browser | 9 / 9 | 16.97 |
| game-settings-browser | 11 / 11 | 16.28 |
| browser | 90 / 90 | 32.46 |
| interactions-browser | 8 / 8 | 17.35 |
| browser-contracts | 24 / 24 | 29.84 |

## Evidence integrity and review

The gate clears stale results, requires uniquely named explicit successful checks, bounds children, retains failure logs and rejects changed source or artifacts. Browser pages run under the production CSP with raw diagnostic monitoring. The engine-export browser proof routes only two explicit local HTTPS fixture navigations to the authoritative HTML; all other and external requests are rejected. Other offline suites report empty request diagnostics.

Independent review reproduced the stale import fixes and verified real p5/Pixi/Excalibur/Basic rendering, cutscene completion and disposal, authored room geometry, native/RNG/camera preservation, cold exported-extension portability and reproducible source inventories. Its precise source/artifact scope and fresh desktop/mobile captures are retained with the local review evidence. See `PR25-REVIEW-AND-POLISH.md`. Earlier failed combined attempts are retained under `reports/littlewild-pr25-quality/final-gate-attempts/`; they are superseded by this complete passing gate.

## Additional repository verification

The independent native application checkpoint passed **103 registered suites / 21,346 checks across six shards**, with 537 native UI captures on Godot 4.7.2. Its clean merged-main source checkpoint is `0f9cd5e1fc040005daeba8eb6f8c8f66bddd02b0`, digest `824e3a412f751d4a9e636c27e92b41f0e8d3a6cfd70b4d0713a0f8fcc5f2f0f4`. All registered suites passed with their original limits, including the 1,390.8-second duel run below its 1,500-second bound. Each shard separately loaded all 453 native scripts. This evidence is supplementary to final PR-head hosted CI. The earlier 99-suite checkpoint and its initial CPU-contention attempts remain separately retained as historical evidence.

The current native archive completed 335 Python tests: 334 passed and one expected Windows Job Object test skipped on Linux. Native architecture covered 453 scripts with zero violations; advisory quality covered 687 files with zero findings across five tools. These source-pinned companion checks accompany the complete updated 103-suite runtime gate. The current dependency-lock audit reports zero advisories. Actual Godot GLTFDocument static-proxy import/re-export preserves the native pack; a translated companion changes only its intended X position, rechecked through the final compiled Littlewild codec.

The newer native balancing changes from main `dc2acaaec936ee7cbeb26bdced97d88a6d712588` were merged without changing Littlewild inputs. The earlier 99-suite native checkpoint is historical relative to that update. The complete updated 103-suite/six-shard checkpoint is retained separately; final-head CI remains a separate acceptance boundary.

Current-head GitHub checks must be inspected after pushing; old green runs and this local evidence are not represented as final hosted CI.

## Limits

Headless Chromium does not establish hardware GPU performance, physical touch, Firefox/Safari behavior, screen-reader conformance, localization or human usability/balance. External editor conversion supports documented data and static proxies, not arbitrary scripts or animated meshes. Complete engine JSON contains inert implementation/data/asset/porting inputs for code generators; semantic conversion into a functioning Godot game remains a manual port. See `ENGINE-EXPORT.md`, `EXTERNAL-EDITORS.md` and `QUALITY-AUDIT.md`.
