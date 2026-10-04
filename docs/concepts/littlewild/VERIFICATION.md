# Littlewild verification

Run `npm ci --no-audit --no-fund`, install Playwright Chromium, and run `npm run verify`. The complete registered gate includes strict TypeScript, architecture, compilation, deterministic domain/CLI/release tests and all 20 browser suites. `--no-browser` creates partial evidence only. Supplemental PNG artifacts require explicit `LITTLEWILD_CAPTURE_SCREENSHOTS=1`; functional image comparisons remain mandatory. Default and explicit-capture external-editor runs separately passed 11/11, preserving the original limits. The capture-policy fix preserves all 421 assertions and their control flow, browser actions and timeouts.

## Current clean-checkout evidence

**1529/1529 checks across 75 suites passed**, including 334 real browser checks. Completed `2026-10-04T03:58:57.868Z` against a clean git archive of `bfa4e8798be53eb33d05195d30e3efae009f5076` with the exact dependency lock. The tracked standalone is copied directly from this passed archive.

- Authored gate input SHA-256: `503c690d35ed01f83b799e59ca54fce60a3cad0bf028d5ba4c2c3225ffe73bd5`
- Standalone SHA-256: `769e31f694710825df396f24e0fefc117bcb2f7b5f59c9093460080ecba47f08`
- Standalone bytes: 18765564
- Inert implementation/source inventory: 657 files, identity `52cff763e02d1f9432a16431989a0a08bc67f7477fe32b865a4b98041e90b55e`
- Runtime: `v24.19.0` on `linux/x64`
- Chromium: `/usr/bin/chromium`
- Fresh machine evidence: `verification/v15/gate-results.json` (ignored locally; CI uploads its own evidence).

Documentation and shipping-only changes after this source checkpoint are excluded from the gate's input identity; source/vendor/toolchain inputs must continue to match. Earlier gates retain their own source identities and do not certify this runtime change.

| Suite | Passed / total | Seconds |
| --- | ---: | ---: |
| engine-export-cli | 5 / 5 | 11.34 |
| engine-export | 13 / 13 | 23.54 |
| animations | 5 / 5 | 0.04 |
| balancing-cli | 5 / 5 | 12.96 |
| cold-balancing | 23 / 23 | 3.36 |
| balancing | 14 / 14 | 20.1 |
| storytelling | 24 / 24 | 42.47 |
| external-editor-cli | 9 / 9 | 22.77 |
| external-canvas | 21 / 21 | 53.55 |
| creature-editor | 18 / 18 | 32.58 |
| external-editors | 24 / 24 | 72.09 |
| renderer-scene-2d | 10 / 10 | 0.11 |
| scene-editor | 15 / 15 | 18.92 |
| scene-navigation | 15 / 15 | 137.59 |
| architecture-extensions | 10 / 10 | 3.3 |
| building-interiors | 15 / 15 | 6.22 |
| construction | 12 / 12 | 2.89 |
| terraform | 13 / 13 | 4.06 |
| renderers | 13 / 13 | 0.14 |
| canvas-renderer | 29 / 29 | 0.32 |
| architecture-policy | 53 / 53 | 19.44 |
| storage-clock | 15 / 15 | 0.04 |
| gate-integrity | 21 / 21 | 1.09 |
| cli-contracts | 23 / 23 | 16.61 |
| typescript-architecture | 17 / 17 | 5.08 |
| behavior-tree | 7 / 7 | 0.03 |
| content-boundary | 18 / 18 | 1.35 |
| assets | 15 / 15 | 0.27 |
| creatures | 23 / 23 | 1.64 |
| ecs-core | 19 / 19 | 0.07 |
| simulation-profile | 19 / 19 | 0.21 |
| simulation-profile-integration | 17 / 17 | 7.67 |
| scene-environment | 6 / 6 | 0.04 |
| office-scenario | 11 / 11 | 45.82 |
| game-settings | 13 / 13 | 2.5 |
| game-settings-ui | 12 / 12 | 0.04 |
| creature-interactions | 27 / 27 | 17.23 |
| interaction-ui | 12 / 12 | 0.04 |
| developer-toolbox | 32 / 32 | 90.67 |
| engine-composition | 30 / 30 | 1.65 |
| ecs-activity | 9 / 9 | 0.06 |
| ecs-world | 24 / 24 | 0.05 |
| ecs-economy | 15 / 15 | 0.06 |
| ecs-integration | 7 / 7 | 0.74 |
| ecs-world-integration | 6 / 6 | 0.53 |
| ecs-economy-integration | 9 / 9 | 0.52 |
| scenario-domain | 83 / 83 | 32.32 |
| presentation | 49 / 49 | 0.41 |
| pause-policy | 53 / 53 | 0.2 |
| cartography | 71 / 71 | 4.86 |
| domain | 86 / 86 | 4.04 |
| growth-stress | 3 / 3 | 23.19 |
| earned-progression | 8 / 8 | 6.71 |
| scenario-schema-cli | 61 / 61 | 5.08 |
| release | 28 / 28 | 10.62 |
| external-editors-browser | 11 / 11 | 36.43 |
| external-canvas-browser | 7 / 7 | 29.15 |
| creature-editor-browser | 20 / 20 | 61.03 |
| balancing-defaults-browser | 4 / 4 | 27.79 |
| balancing-browser | 9 / 9 | 27.3 |
| storytelling-browser | 15 / 15 | 83.57 |
| engine-export-browser | 11 / 11 | 36.31 |
| renderer-storytelling | 15 / 15 | 55.88 |
| storytelling-player-browser | 8 / 8 | 59.98 |
| renderer-libraries | 14 / 14 | 34.97 |
| scene-editor-browser | 33 / 33 | 72.2 |
| building-interiors-browser | 9 / 9 | 23.93 |
| construction-editor-browser | 13 / 13 | 16.9 |
| terraform-browser | 9 / 9 | 19.81 |
| renderers-browser | 14 / 14 | 17.81 |
| office-browser | 9 / 9 | 16.91 |
| game-settings-browser | 11 / 11 | 13.48 |
| browser | 90 / 90 | 33.1 |
| interactions-browser | 8 / 8 | 17.05 |
| browser-contracts | 24 / 24 | 29.2 |

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
