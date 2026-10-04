# Littlewild verification

Run `npm ci --no-audit --no-fund`, install Playwright Chromium, and run `npm run verify`. The complete registered gate includes strict TypeScript, architecture, compilation, deterministic domain/CLI/release tests and all 20 browser suites. `--no-browser` creates partial evidence only. Supplemental PNG artifacts require explicit `LITTLEWILD_CAPTURE_SCREENSHOTS=1`; functional image comparisons remain mandatory. Default and explicit-capture external-editor runs separately passed 11/11, preserving the original limits. The capture-policy fix preserves all 421 assertions and their control flow, browser actions and timeouts.

## Current clean-checkout evidence

**1543/1543 checks across75 suites passed**, including 342 real browser checks. Completed `2026-10-04T13:54:30.558Z` against the clean git archive of `cbcb968fcd5dec9b43da866e933f167c28693a2b` with exact `npm ci` lock resolution. The tracked standalone is copied directly from this passed archive.

Source `cbcb968fcd5dec9b43da866e933f167c28693a2b`; authored gate input `77cc05fd9705b36be909441e4e63eedeca819323e9a5c9743548f85ba38b07ea` (503 files); standalone `323ea5245c0829c90685c332f0c0980fcda55064c4dbc70512fa2180875f9ffd` (18,794,852 bytes); 657-file inert source bundle `02243f3c51f41d29baaf4af3d756a23f803421da362892f94a403a5fa360116f`. Current identities are explicit here and in `delivery-manifest.json`.

- Fresh sealed evidence: `reports/littlewild-pr25-quality/final-cbcb968/` (189 original core paths plus 1 diagnostic, 2 actual scoped completion records and 417 retained generated files; 609 sealed files).
- Node/CLI:55 suites /1201 checks; browser:20 suites /342 checks.
- Frozen focused proof: `reports/littlewild-pr25-quality/preview-retirement-focused-20261004/FOCUSED-PROOF.json`; seal SHA `e0dbab95b900b889ab2d1a290f199a63a20443167164696211782aa4f51f389a`; 2761 records. Each attempt retains its actual input identity.

All1539 prior named checks retain relative order across75 unchanged suite registrations, commands, result paths and time limits. Actual new named regressions: 4, yielding 1543 checks (1201 Node/CLI and 342 browser). All62 original raw browser channels retain their exact values and local fixture semantics.

Closing a detached preview retires eligible compiled instances immediately, stops ownership and detaches canvases, then releases captured resources through deferred finalizers. Explicit receiver/original-dispose identity guards preserve custom, copied or overridden disposal contracts through synchronous fallback. The bounded cleanup queue remains owned across cancel/reopen and inactive scene-editor entry; native admission, active-engine state, existing validators and original budgets remain authoritative. The observer never wraps protected disposal hooks; missing resource-release phases are unobservable, not evidence of completion.

Final77cc attempt2 passed strict/build, Architecture17, Renderer16, Animations5, StoryON23/OFF23, RendererStory15 and Libraries14 at the original limits. The earlier d432 attempt1 passed21/23 Story rows and failed two original disposal-fixture assertions; it remains separate historical evidence. Final diagnostic evidence contains97/59/20 rows for Add track/import/Close with limits192/192/64, zero dropped/oversize metadata and a38,451-byte file. Close observes retire and full scene rendering/CDP acknowledgement; it does not observe asynchronous finalizer completion. These are local functional observations, not a throughput benchmark, hosted cause or future hosted acceptance.

Optional test-only click observations are sealed at `reports/littlewild-pr25-quality/final-cbcb968/verification/v15/storytelling-click-diagnostics.json` (38,445 bytes, SHA `3fba7613fdaf8fc93cf4dee248856c6e8b340f2064ea9d4eb6553c27290a3827`), within the64KiB file and192/192/64-row per-case bounds. They retain the three original desktop target cases, CDP mouse/h.stop acknowledgements and session/idle/retarget-draw phases. They are not additional checks or causal proof. The observer is absent from shipped HTML and exported bundle files; its truthful excluded-inventory reference remains.

Actual gate session49599/chunk8eb892 exited0. The sealed scoped process receipt records zero gate-started live Chromium processes, 11 unrelated preexisting live processes and 1999 inactive zombies. Original browser producers await context/browser close before successful result output; global browser closure is not claimed.

Playwright/playwright-core remain exactly `1.62.1`, selecting official Chromium `151.0.7922.34` revision `1234`; this local gate actually used `Chromium 151.0.7922.173 built on Debian GNU/Linux 13 (trixie)` and Node `v24.19.0`. Hosted0d5 failed using the stable pin. All seven workflows must pass on the new exact publication head for hosted acceptance.

Historical hosted `0d5a52add03b4943d03dbc0c3ac387e7700a734f` passed 60 preceding suites / 1,251 checks, then Story19/20 failed the original desktop Back to scenes click at its unchanged20-second limit. Across61 attempts,1,271 checks were observed:1,270 passed and1 failed;14 later suites /268 checks were unreached. All20 executed raw channels are empty; EngineExport and its two fixture requests were not reached. Actual full ZIP and HTML7348/18,780,453 bytes were verified. The34,532-byte trace captures only two successful Add track/import cases (95/59 rows), not the failing Close action; no Close dispatch/commit/disposal cause is proved. This history does not establish new-head hosted acceptance.

Prior source9424/606-file complete acceptance and successful receiptff7 are preserved, together with source7ba, hosted774, immutable71/20/14/1724 focused records and failed4cf151-file history. Earlier timing numbers remain scoped to their recorded sources; they do not measure this new implementation.

| Suite | Passed / total | Seconds |
| --- | ---: | ---: |
| engine-export-cli | 5 / 5 | 11.75 |
| engine-export | 13 / 13 | 23.66 |
| animations | 5 / 5 | 0.04 |
| balancing-cli | 5 / 5 | 11.51 |
| cold-balancing | 23 / 23 | 3.25 |
| balancing | 14 / 14 | 16.85 |
| storytelling | 24 / 24 | 37.23 |
| external-editor-cli | 9 / 9 | 20.94 |
| external-canvas | 21 / 21 | 44.19 |
| creature-editor | 18 / 18 | 28.46 |
| external-editors | 24 / 24 | 64.32 |
| renderer-scene-2d | 10 / 10 | 0.11 |
| scene-editor | 15 / 15 | 17.21 |
| scene-navigation | 15 / 15 | 115.29 |
| architecture-extensions | 10 / 10 | 3.34 |
| building-interiors | 15 / 15 | 5.44 |
| construction | 12 / 12 | 2.79 |
| terraform | 13 / 13 | 3.62 |
| renderers | 16 / 16 | 0.16 |
| canvas-renderer | 29 / 29 | 0.28 |
| architecture-policy | 53 / 53 | 20.53 |
| storage-clock | 15 / 15 | 0.05 |
| gate-integrity | 21 / 21 | 1.1 |
| cli-contracts | 23 / 23 | 17.13 |
| typescript-architecture | 17 / 17 | 6.1 |
| behavior-tree | 7 / 7 | 0.04 |
| content-boundary | 21 / 21 | 1.28 |
| assets | 15 / 15 | 0.27 |
| creatures | 23 / 23 | 1.75 |
| ecs-core | 19 / 19 | 0.06 |
| simulation-profile | 19 / 19 | 0.22 |
| simulation-profile-integration | 17 / 17 | 6.87 |
| scene-environment | 6 / 6 | 0.04 |
| office-scenario | 11 / 11 | 41.47 |
| game-settings | 13 / 13 | 2.18 |
| game-settings-ui | 12 / 12 | 0.05 |
| creature-interactions | 27 / 27 | 15.32 |
| interaction-ui | 12 / 12 | 0.05 |
| developer-toolbox | 32 / 32 | 78.02 |
| engine-composition | 30 / 30 | 1.57 |
| ecs-activity | 9 / 9 | 0.06 |
| ecs-world | 24 / 24 | 0.04 |
| ecs-economy | 15 / 15 | 0.06 |
| ecs-integration | 7 / 7 | 0.73 |
| ecs-world-integration | 6 / 6 | 0.46 |
| ecs-economy-integration | 9 / 9 | 0.43 |
| scenario-domain | 83 / 83 | 29.4 |
| presentation | 49 / 49 | 0.36 |
| pause-policy | 53 / 53 | 0.21 |
| cartography | 71 / 71 | 4.24 |
| domain | 86 / 86 | 3.34 |
| growth-stress | 3 / 3 | 21.4 |
| earned-progression | 8 / 8 | 6.47 |
| scenario-schema-cli | 61 / 61 | 5.21 |
| release | 28 / 28 | 11.74 |
| external-editors-browser | 11 / 11 | 38.36 |
| external-canvas-browser | 7 / 7 | 29.97 |
| creature-editor-browser | 20 / 20 | 62.31 |
| balancing-defaults-browser | 4 / 4 | 29.3 |
| balancing-browser | 9 / 9 | 27.72 |
| storytelling-browser | 23 / 23 | 108 |
| engine-export-browser | 11 / 11 | 38.79 |
| renderer-storytelling | 15 / 15 | 53.56 |
| storytelling-player-browser | 8 / 8 | 59.1 |
| renderer-libraries | 14 / 14 | 32.5 |
| scene-editor-browser | 33 / 33 | 72.45 |
| building-interiors-browser | 9 / 9 | 24.57 |
| construction-editor-browser | 13 / 13 | 17.78 |
| terraform-browser | 9 / 9 | 20.55 |
| renderers-browser | 14 / 14 | 19.01 |
| office-browser | 9 / 9 | 16.71 |
| game-settings-browser | 11 / 11 | 15.52 |
| browser | 90 / 90 | 33.77 |
| interactions-browser | 8 / 8 | 19.58 |
| browser-contracts | 24 / 24 | 30.85 |

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
