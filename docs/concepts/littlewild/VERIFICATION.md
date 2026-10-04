# Littlewild verification

Run `npm ci --no-audit --no-fund`, install Playwright Chromium, and run `npm run verify`. The complete registered gate includes strict TypeScript, architecture, compilation, deterministic domain/CLI/release tests and all 20 browser suites. `--no-browser` creates partial evidence only. Supplemental PNG artifacts require explicit `LITTLEWILD_CAPTURE_SCREENSHOTS=1`; functional image comparisons remain mandatory. Default and explicit-capture external-editor runs separately passed 11/11, preserving the original limits. The capture-policy fix preserves all 421 assertions and their control flow, browser actions and timeouts.

## Current clean-checkout evidence

**1535/1535 checks across 75 suites passed**, including 336 real browser checks. Completed `2026-10-04T09:12:29.252Z` against the clean git archive of `7ba27610790da02e1dc753c1749a122ecf564abe` with exact `npm ci` lock resolution. The tracked standalone is copied directly from this passed archive.

Source `7ba27610790da02e1dc753c1749a122ecf564abe`; authored gate input `f069bae5b04c9f8c435a54052564791209bf657f8ff07022f22a2483a71ea347`; standalone `39d68853f42c8c7d4a4eb421c69fb66a0ba7c47525cf40c671da2c11df158f99` (18771841 bytes);657-file inert source bundle `3ddc744eb564f1d03620972b57f9fffc02e8bb3d741f4d2b9d0fa20983b8de34`. Current identities are explicit here and in `delivery-manifest.json`.

- Fresh sealed evidence: `reports/littlewild-pr25-quality/final-7ba2761/` (189 original core paths plus 0 actual additional records; 189 sealed files).
- Node/CLI: 55 suites / 1199 checks; browser: 20 suites / 336 checks.
- Actual local Node: `v24.19.0`.
- Historical failed4cf focused responsiveness proof: `reports/littlewild-pr25-quality/performance-checkouts/storytelling-21053/RESPONSIVENESS-PROOF.json`; seal SHA `0ae23e0c6afbed5c5cff5d7c4be60c2adfde142580f9b259a41eea0dd8b622a5`; 71 immutable records; timings apply only to that source.

- Corrective retained-buffer proof: `reports/littlewild-pr25-quality/retained-buffer-correction-20261004/inputs.json`; seal SHA `ba993268912835b2d916d74f67f30b989218ac837bd02e86dd78d70f3c6bce8e`; 20 actual sealed records.

- Current retained-buffer fixed32 profile: `reports/littlewild-pr25-quality/performance-checkouts/storytelling-retention-fixed32/RETENTION-RESPONSIVENESS.json`; seal SHA `d2d892c853566cb67c86384b49be5bd6a852a586de8a4875258c45df2c01106e`; 14 actual sealed records.

All 1532 original named checks retain their relative order across 75 unchanged suite registrations, commands, result paths and time limits. Actual new named regressions: 3, yielding 1535 checks (1199 Node/CLI and 336 browser). All 62 original raw browser channels retain their exact original values and localhost fixture semantics.

Production previews now retain a typed opt-in on the actual compiled renderer instance for projection-only painting. An unchanged paused frame can reuse its last paint while the owned host still runs frame queries, overlays and invalidation checks. Custom instances remain continuous by default, including replacement factories registered under builtin IDs; p5 retains its host cadence. Delivered context restoration invalidates the last paint for one next owned paint, without promising GPU resource recovery.

The scene editor requests cancellable idle/background one-shot preview preparation through optional Host.deferPreview. Authored changes and native validation remain synchronous. Detached renderer construction moves out of the synchronous input task into a cancellable idle/background task; exact session, revision, clip, generation, modal/tab ownership and connected mounts are checked before starting and before publishing readiness. Obsolete queued jobs and readiness callbacks cannot start or update the current preview. Canceled obsolete jobs legitimately skip factory admission; the implementation does not claim equal global validation/factory call counts.

The corrective retention policy deliberately requests preserveDrawingBuffer=true for the actual Pixi/Excalibur WebGL rendering surfaces used by projection-only painting, through public renderer APIs. All other captured context attributes remain unchanged. Retained buffers add GPU memory and presentation costs; no retained-buffer throughput improvement is claimed. The original 80ms pixel checks, numerical limits, CSP and headless launch flags are unchanged.

Playwright/playwright-core remain exactly `1.62.1`, selecting official Chromium `151.0.7922.34` revision `1234`; this local gate actually used `Chromium 151.0.7922.173 built on Debian GNU/Linux 13 (trixie)`. Hosted 21053 failed using the stable pin. All seven workflows must pass on the new exact publication head for hosted acceptance.

Hosted `21053a96f86c904fc53eb1f4b78227091db4bc1e` completed all seven workflows: six passed and Littlewild failed. Littlewild passed 60 preceding suites / 1,249 checks, then attempted storytelling-browser (13/15 passed). The two desktop 1440px click actions timed out at their original 20-second step limits; the renderer-library suite never ran. Add-track commitment is supported by subsequent keyframe/p5 leaves; import commitment is not established. The failed leaves did not execute their remaining assertions. Raw storytelling errors, console warnings and request arrays are empty. The stable Playwright 1.62.1 pin did not solve these click failures. Installed official Chromium 151.0.7922.34/revision 1234 is established by the lock/install log and default bundled launch, rather than a directly sampled hosted browser.version. The independent compact artifact `11296352460` is 86,957 bytes, SHA-256 `c1363787e285c839c945f814e91d494219047152fa69751e33cf41d7b385ad6b`. Its failed source input was `7bcb66a8b0f4e0a1fcd78c156311346acf997d48d9cfa920dcd593866a0a14e7`, standalone `6fafea78ba5c92f6b17d5f4e9a5c349e879a4a985e206a605a167a67b230b120`.

The separately completed native workflow on that same historical head passed 103 suites / 21,346 checks across six shards (run `37183426542`, aggregate job `111386288891`, merge `4ce6691fa35a471ba3790a4573671a2cb2656828`, native source digest `b57cbb9e70f54f937ac7be66bffdbf4aa35903af7ab2cbcb9b6e175d2f9365dc`). All six actual artifact IDs/digests were admitted in the aggregate log. These historical successes do not certify any workflow on the new publication head.

The first local responsiveness checkpoint `4cf63dfbd83d86e415cef5b6129393a86828bead` was not accepted for publication. Its complete gate attempted 63 suites:62 preceding suites / 1,278 checks passed, including storytelling 17/17. The original renderer-storytelling suite then passed 13/15 and failed the Pixi and Excalibur canonical geometry pixel-change assertions. Its raw page errors, console warnings and request arrays are empty. In total 1,293 leaf checks ran: 1,291 passed and 2 failed; 12 later suites /242 checks were not reached. All 501 authored inputs stayed unchanged before/after that failed attempt. The failed input `5c9a33a04878759eacaf2c53abfaa0f36be4631e8af863a9bf106e53e9b3ed7a`, standalone `13e8fecc05170f0e47ff41f368e35aa6fc80545905e02259d370d9cb09b15dfe` (18,770,872 bytes), bundle `c0fc59eea6063cbad71898edc05a2c61be8894e680c1c26da210e4b12856bad7`, and 151-file evidence seal `994dba4a9585a4f3ed509789e3085b702ad8afe2583510ad369718529e75389b` remain immutable historical evidence. The earlier focused responsiveness proof142/0ae and its unrun publication plan do not certify that failed full gate or the corrective source.

The corrective retained-buffer focused proof passed all 15 original renderer-storytelling cases, the 14 renderer-library cases, 17 storytelling cases, 14 renderer Node groups, 5 animation groups and 17 architecture groups, with strict diagnostics 0 and empty browser diagnostics. The original renderer-storytelling source hash and all 15 names/order are unchanged, including the 80ms pixel checks. Its before/after probe recorded false→true preserveDrawingBuffer for both Pixi and Excalibur, identical other captured attributes/dimensions, and unchanged native state. Before, both captures were blank (one color, zero geometry, equal hashes). After, both renderer surfaces had canonical geometry and changed pixel hashes. This supports the local delayed-readback correction; it does not establish a hosted click remedy or a performance measurement for retained buffers.

A separate additive profile of the current retained-buffer source `7ba2761` held CPU throttling at 32 times only for the guide-position submission through detached preview readiness, then reset 4 times. It passed 3/3 original checks with empty raw diagnostics: the click took 9.815 seconds, click-through-ready 18.858 seconds, and maximum utility hit-target stop 0.352 seconds. The original 20-second action/ready-locator, 10-second actual renderer preparation and 300-second external suite limits remain. Other actions and later playback/pixel assertions ran at 4 times throttling. This single phase does not cover 64-times throttling, import or the full suite; it is not a repeated before/after retention benchmark, uniform performance guarantee or hosted-cause proof. Retained-buffer memory/presentation cost remains an explicit tradeoff; no quantitative memory measurement or retained-buffer throughput gain is claimed.

Historical focused 4cf source only; the following measurements do not certify the corrective retention source or its responsiveness. The first 4cf complete gate subsequently failed two original renderer pixel-change checks.

The sealed local Node 22.23.3 / Chromium 151.0.7922.173 profiles retain CPU, Chrome trace, CDP/input, per-call, result and action logs. They are local profiling evidence, separate from the complete acceptance gate and the official hosted browser. The uninstrumented focused candidate passed all 17 storytelling cases (all 15 original bodies preserved plus two viewport lifecycle cases), the unchanged 14 renderer-library cases, 14 renderer Node groups (13 original plus one) and 17 architecture groups, with successful strict/build checks and empty browser diagnostics.

With target clicks throttled 32 times and idle work 4 times, the baseline passed 5/6 and timed out on the 2D Add track action at the original 20-second limit; the candidate passed 6/6. Utility hit-target stop responses were at most 14.707 seconds before and 0.881 seconds after in those runs. The baseline32 hooks differ from the enhanced candidate hooks: common CDP/action outcomes remain useful, but global profiler totals are not a paired throughput comparison. The helper resets CPU throttling to 4 times after click acknowledgement, so the later deferred admission duration is not a claim of faster admission at 32 times throttling.

A separate candidate run held 32 times throttling through detached 3D renderer readiness and passed 3/3: the guide-position click took 8.653 seconds and the full click-through-ready interval took 16.475 seconds. The original 20-second action and 10-second renderer-preparation limits remain unchanged. The baseline mixed run recorded a 31.055-second utility hit-target stop and a 9.3433-second first Three render after authored mutation, demonstrating local scheduling and paint pressure without establishing exact hosted causality.

The harsher mixed profile (first 3D action throttled 64 times and import 32 times) remained 4/6 before and after. The candidate's 20.007-second first-3D and 20.004-second import timeouts are retained, not suppressed. Extreme pre-input and authoring costs remain; this is not a universal responsiveness guarantee. The initial failed sequence in the new fixture is also sealed separately; the corrected fixture passed 17/17. No profiling hooks ship. Stable Playwright 1.62.1 did not resolve the historical hosted 21053 click failure; all seven new-head hosted workflows remain required.

| Suite | Passed / total | Seconds |
| --- | ---: | ---: |
| engine-export-cli | 5 / 5 | 11.57 |
| engine-export | 13 / 13 | 22.4 |
| animations | 5 / 5 | 0.04 |
| balancing-cli | 5 / 5 | 11.89 |
| cold-balancing | 23 / 23 | 3.32 |
| balancing | 14 / 14 | 17.05 |
| storytelling | 24 / 24 | 36.56 |
| external-editor-cli | 9 / 9 | 21.37 |
| external-canvas | 21 / 21 | 44.92 |
| creature-editor | 18 / 18 | 27.85 |
| external-editors | 24 / 24 | 64.5 |
| renderer-scene-2d | 10 / 10 | 0.1 |
| scene-editor | 15 / 15 | 16.11 |
| scene-navigation | 15 / 15 | 112.61 |
| architecture-extensions | 10 / 10 | 3.39 |
| building-interiors | 15 / 15 | 5.53 |
| construction | 12 / 12 | 2.84 |
| terraform | 13 / 13 | 3.55 |
| renderers | 14 / 14 | 0.14 |
| canvas-renderer | 29 / 29 | 0.32 |
| architecture-policy | 53 / 53 | 19.63 |
| storage-clock | 15 / 15 | 0.04 |
| gate-integrity | 21 / 21 | 1.09 |
| cli-contracts | 23 / 23 | 16.55 |
| typescript-architecture | 17 / 17 | 4.93 |
| behavior-tree | 7 / 7 | 0.04 |
| content-boundary | 21 / 21 | 1.19 |
| assets | 15 / 15 | 0.26 |
| creatures | 23 / 23 | 1.6 |
| ecs-core | 19 / 19 | 0.06 |
| simulation-profile | 19 / 19 | 0.19 |
| simulation-profile-integration | 17 / 17 | 6.57 |
| scene-environment | 6 / 6 | 0.04 |
| office-scenario | 11 / 11 | 41.88 |
| game-settings | 13 / 13 | 2.2 |
| game-settings-ui | 12 / 12 | 0.04 |
| creature-interactions | 27 / 27 | 15.11 |
| interaction-ui | 12 / 12 | 0.04 |
| developer-toolbox | 32 / 32 | 77.54 |
| engine-composition | 30 / 30 | 1.53 |
| ecs-activity | 9 / 9 | 0.06 |
| ecs-world | 24 / 24 | 0.05 |
| ecs-economy | 15 / 15 | 0.06 |
| ecs-integration | 7 / 7 | 0.68 |
| ecs-world-integration | 6 / 6 | 0.48 |
| ecs-economy-integration | 9 / 9 | 0.44 |
| scenario-domain | 83 / 83 | 27.8 |
| presentation | 49 / 49 | 0.4 |
| pause-policy | 53 / 53 | 0.2 |
| cartography | 71 / 71 | 4.3 |
| domain | 86 / 86 | 3.12 |
| growth-stress | 3 / 3 | 21.28 |
| earned-progression | 8 / 8 | 6.39 |
| scenario-schema-cli | 61 / 61 | 4.94 |
| release | 28 / 28 | 11.23 |
| external-editors-browser | 11 / 11 | 36.94 |
| external-canvas-browser | 7 / 7 | 29.5 |
| creature-editor-browser | 20 / 20 | 58.88 |
| balancing-defaults-browser | 4 / 4 | 28.52 |
| balancing-browser | 9 / 9 | 26.6 |
| storytelling-browser | 17 / 17 | 82.32 |
| engine-export-browser | 11 / 11 | 36.26 |
| renderer-storytelling | 15 / 15 | 50.48 |
| storytelling-player-browser | 8 / 8 | 57.24 |
| renderer-libraries | 14 / 14 | 30.88 |
| scene-editor-browser | 33 / 33 | 68.55 |
| building-interiors-browser | 9 / 9 | 22.13 |
| construction-editor-browser | 13 / 13 | 16.34 |
| terraform-browser | 9 / 9 | 19.12 |
| renderers-browser | 14 / 14 | 17.39 |
| office-browser | 9 / 9 | 15.63 |
| game-settings-browser | 11 / 11 | 13.31 |
| browser | 90 / 90 | 31.4 |
| interactions-browser | 8 / 8 | 18.65 |
| browser-contracts | 24 / 24 | 29.37 |

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
