# Littlewild verification

Run `npm ci --no-audit --no-fund`, install Playwright Chromium, and run `npm run verify`. The complete registered gate includes strict TypeScript, architecture, compilation, deterministic domain/CLI/release tests and all 20 browser suites. `--no-browser` creates partial evidence only. Supplemental PNG artifacts require explicit `LITTLEWILD_CAPTURE_SCREENSHOTS=1`; functional image comparisons remain mandatory. Default and explicit-capture external-editor runs separately passed 11/11, preserving the original limits. The capture-policy fix preserves all 421 assertions and their control flow, browser actions and timeouts.

## Current clean-checkout evidence

**1532/1532 checks across 75 suites passed**, including 334 real browser checks. Completed `2026-10-04T06:31:26.874Z` against the clean git archive of `8793f421288336c12deca4a56f81fb417cde4b81` with exact `npm ci` lock resolution. The tracked standalone is copied directly from this passed archive.

Source `8793f421288336c12deca4a56f81fb417cde4b81`; authored gate input `7bcb66a8b0f4e0a1fcd78c156311346acf997d48d9cfa920dcd593866a0a14e7`; standalone `6fafea78ba5c92f6b17d5f4e9a5c349e879a4a985e206a605a167a67b230b120` (18765804 bytes); 657-file inert source bundle `16e48243f2093756244a2068b6dd868fa624417ebcc7222572a158ddce061fc1`. These current identities are also recorded explicitly in `VERIFICATION.md` and `delivery-manifest.json`.

- Fresh sealed evidence: `reports/littlewild-pr25-quality/final-8793f42/` (189 original core paths plus 0 actual additional records; 189 sealed files).
- Node/CLI: 55 suites / 1198 checks; browser: 20 suites / 334 checks.
- Raw browser channels: 62 original paths preserved with exact original values and fixture semantics.
- Actual local Node: `v24.19.0`.

The runtime change reduces ordinary-object descriptor allocation only. All original JSON safety checks, validation calls, native admission, array handling, clone/parse/fingerprint behavior and numeric budgets remain. Ordinary JSON rejection ordering is retained. A missing Proxy descriptor now rejects fail-closed; arbitrary Proxy trap sequencing is not claimed observationally equivalent. Navigation tests retain 15 original cases/assertions and add timing diagnostics; content-boundary retains 18 original cases and adds 3 safety regressions.

Playwright/playwright-core remain exactly `1.62.1`, selecting official Chromium `151.0.7922.34` revision `1234`; this local gate actually used `Chromium 151.0.7922.173 built on Debian GNU/Linux 13 (trixie)`. The earlier stable-toolchain mitigation has not yet been exercised by hosted browser suites on the failed ae874f0 run. All seven workflows must pass on the new publication head for hosted acceptance.

Hosted `ae874f04420c2bc1955530abea055197b9537fb4` passed 13 Node/CLI suites / 186 checks and attempted 14 suites. Node scene-navigation exceeded its unchanged 180-second budget at 180.11 seconds (`ETIMEDOUT`, `SIGKILL`); its result leaf is absent and its log contains one newline byte. No browser or renderer-library suite ran. That failure used gate input `cd76fe50a57fc2fab1f56635f5b3e773650ebfe538f21641bf23944b81f7fde1` and standalone `c33c69c238ad9075609dd4d1ae1142f18727cbf46ad3a6843f7bba139b46e421`; its stable browser mitigation was not hosted-tested. The complete local `c0e66f74569367d03058a6c9ddbc2e4f4ea38aa4` checkpoint remains historical, including bundle `6830af3104c19377d3c531df7048c0ac6f9592a48bbd434a741669875e181f74`.

Sealed local Node22 `v22.23.3` profiles of the same 15 navigation cases measured 151.377s before and 119.963s after (20.75% lower elapsed time in this run). Observed public API counts matched per case; this wrapper census excludes locally captured/internal calls. The separate uninstrumented 15-case acceptance passed under the unchanged 180-second limit, with summed case timings 114.041s. These local runs did not reproduce the hosted timeout or identify its missing last case. Actual raw API/CPU profiles and Node package provenance are sealed in `reports/littlewild-pr25-quality/performance-checkouts/navigation-ae874/NAVIGATION-PROOF-SEAL.json`; no profiler or wrapper ships.

| Suite | Passed / total | Seconds |
| --- | ---: | ---: |
| engine-export-cli | 5 / 5 | 11.56 |
| engine-export | 13 / 13 | 22.54 |
| animations | 5 / 5 | 0.04 |
| balancing-cli | 5 / 5 | 11.32 |
| cold-balancing | 23 / 23 | 3.09 |
| balancing | 14 / 14 | 16.6 |
| storytelling | 24 / 24 | 35.84 |
| external-editor-cli | 9 / 9 | 20.17 |
| external-canvas | 21 / 21 | 43.07 |
| creature-editor | 18 / 18 | 27.76 |
| external-editors | 24 / 24 | 62.34 |
| renderer-scene-2d | 10 / 10 | 0.11 |
| scene-editor | 15 / 15 | 16.31 |
| scene-navigation | 15 / 15 | 110.92 |
| architecture-extensions | 10 / 10 | 3.35 |
| building-interiors | 15 / 15 | 5.55 |
| construction | 12 / 12 | 2.74 |
| terraform | 13 / 13 | 3.63 |
| renderers | 13 / 13 | 0.13 |
| canvas-renderer | 29 / 29 | 0.31 |
| architecture-policy | 53 / 53 | 19.48 |
| storage-clock | 15 / 15 | 0.04 |
| gate-integrity | 21 / 21 | 1.09 |
| cli-contracts | 23 / 23 | 16.62 |
| typescript-architecture | 17 / 17 | 5.02 |
| behavior-tree | 7 / 7 | 0.03 |
| content-boundary | 21 / 21 | 1.21 |
| assets | 15 / 15 | 0.27 |
| creatures | 23 / 23 | 1.53 |
| ecs-core | 19 / 19 | 0.06 |
| simulation-profile | 19 / 19 | 0.19 |
| simulation-profile-integration | 17 / 17 | 6.59 |
| scene-environment | 6 / 6 | 0.05 |
| office-scenario | 11 / 11 | 43.52 |
| game-settings | 13 / 13 | 2.16 |
| game-settings-ui | 12 / 12 | 0.04 |
| creature-interactions | 27 / 27 | 14.67 |
| interaction-ui | 12 / 12 | 0.04 |
| developer-toolbox | 32 / 32 | 77.79 |
| engine-composition | 30 / 30 | 1.49 |
| ecs-activity | 9 / 9 | 0.06 |
| ecs-world | 24 / 24 | 0.04 |
| ecs-economy | 15 / 15 | 0.06 |
| ecs-integration | 7 / 7 | 0.66 |
| ecs-world-integration | 6 / 6 | 0.49 |
| ecs-economy-integration | 9 / 9 | 0.46 |
| scenario-domain | 83 / 83 | 27.29 |
| presentation | 49 / 49 | 0.39 |
| pause-policy | 53 / 53 | 0.2 |
| cartography | 71 / 71 | 3.85 |
| domain | 86 / 86 | 3.06 |
| growth-stress | 3 / 3 | 20.75 |
| earned-progression | 8 / 8 | 6.26 |
| scenario-schema-cli | 61 / 61 | 4.83 |
| release | 28 / 28 | 10.77 |
| external-editors-browser | 11 / 11 | 35.64 |
| external-canvas-browser | 7 / 7 | 29.16 |
| creature-editor-browser | 20 / 20 | 63.06 |
| balancing-defaults-browser | 4 / 4 | 27.98 |
| balancing-browser | 9 / 9 | 23.91 |
| storytelling-browser | 15 / 15 | 85.78 |
| engine-export-browser | 11 / 11 | 36.37 |
| renderer-storytelling | 15 / 15 | 51.13 |
| storytelling-player-browser | 8 / 8 | 57.56 |
| renderer-libraries | 14 / 14 | 29.67 |
| scene-editor-browser | 33 / 33 | 68.58 |
| building-interiors-browser | 9 / 9 | 22.53 |
| construction-editor-browser | 13 / 13 | 17.03 |
| terraform-browser | 9 / 9 | 19.3 |
| renderers-browser | 14 / 14 | 17.82 |
| office-browser | 9 / 9 | 16.69 |
| game-settings-browser | 11 / 11 | 14.92 |
| browser | 90 / 90 | 30.06 |
| interactions-browser | 8 / 8 | 16.33 |
| browser-contracts | 24 / 24 | 29.35 |

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
