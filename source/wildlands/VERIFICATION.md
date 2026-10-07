# Littlewild verification

## Running the gate

Run `npm ci --no-audit --no-fund`, install Playwright Chromium (or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to an existing desktop Chromium), and run `npm run verify`. The complete registered gate runs strict TypeScript and the build concurrently, then every registered domain/CLI/release suite and all browser suites. Only an unfiltered run can report `passed`; every option below except `--jobs`, `--browser-jobs` and `--keep-going` produces `partial-passed` evidence.

| Command | Scope |
| --- | --- |
| `npm test` | Fast tier (`--tier fast`): typecheck, build and the quick Node suites. Partial evidence for edit loops. |
| `npm run verify` | Complete gate, parallel by default. |
| `npm run verify:sequential` | Complete gate with `--jobs 1` (registry order, one suite at a time). |
| `npm run verify:node` | `--no-browser`; partial evidence. |
| `npm run verify -- --only a,b` | Named registered suites; unknown or excluded names are rejected. |
| `npm run verify -- --shard I/N` | The I-th of N deterministic, duration-balanced shards; combine shard reports with `npm run verify:merge -- --output merged.json shard-1.json …`, which re-accepts every pinned result file and the complete inventory. |

`--jobs N` sets the total number of concurrent suites (default `min(4, cores - 1)`; `1` reproduces the sequential order) and `--browser-jobs N` caps concurrent browser suites (default `min(2, jobs)`). CI (`.github/workflows/littlewild-ecs-rebuild.yml`, ubuntu-24.04 with 4 vCPUs) first validates every game folder with the checked-in `bin/wildlands` alone, then runs `npm run typecheck`, `npm run architecture`, the fast tier (`npm test`), `npm run check:cli` and `npm run check:demos`, clears `.generated/` and `verification/v15/`, and runs the complete gate as `npm run verify -- --jobs 3 --browser-jobs 2`. Browser suites now wait on readiness and state with explicit transition/admission budgets instead of fixed sleeps, and the complete gate passed locally at that setting on a 4-core host (see below); if a load-related browser timeout appears on a smaller host, `--browser-jobs 1` reproduces the earlier serial browser schedule with identical reports. Suites marked `exclusive` in the registry run first and alone; no suite currently is (`browser-contracts` builds its custom-pack artifact in an isolated copy of the project instead of rebuilding the shared `.generated/` output in place, and `architecture-policy` gives each of its four nested runs of the real architecture checker a 120 s backstop instead of a fixed 15 s, within its 300 s registry timeout: one checker run takes about 10 s alone, and the suite took 72–80 s in five consecutive `--jobs 4 --browser-jobs 2` runs beside nine other suites on a 4-core host, all passing); longer suites are dispatched next, but `gate-results.json` always lists suites in registry order, so reports and accepted check names are identical at every job count. After a failure no new suite starts unless `--keep-going` is given. `gate-results.json` is written only when the run starts and finishes (suites such as `cli-contracts` compare it across their own execution); in-flight progress is in `gate-progress.json`.

Each suite runs as its own process group with its registry timeout, a private `TMPDIR` that is removed afterwards, and `WILDLANDS_SUITE_NAME`/`WILDLANDS_SUITE_OUT` (an empty-by-default directory under `verification/v15/suite-output/`) for scratch output. Registered result paths are unchanged; CI and reviewers read the same files.

### Registry and reviewed expectations

`source/verification/suites.json` is the suite registry: name, kind (`node`/`browser`), tier (`fast`/`full`), compiled entry, pinned result path, hard timeout, an observed-cost scheduling hint and an optional `exclusive` reason. `source/verification/gate-expectations.json` holds the reviewed gate contract: the ordered suite list, the exact check-name inventory of every suite, `totalChecks`, the immutable historical baseline (75 suites, 1,543 checks), named `reviewedAdditions`, and explicit `renames` and `retirements`. `totalChecks` must equal baseline + additions − retirements. The gate fails closed on a missing, unexpected, duplicated or renamed check, a missing or reordered suite, or a count mismatch; a partial run still matches each selected suite's inventory. To add, rename or retire a check, update the inventory together with the matching reviewed entry; never edit the baseline. The CI Storytelling observer-independence step reads the same file instead of inline pins. The registry holds 104 suites / 1,869 reviewed checks; the most recent reviewed addition is the `game-folders` check that README edits leave the folder digest unchanged while PROVENANCE and LICENSE edits change it (README.md files are documentation outside the digest; `wildlands-cli` additionally asserts that a README edit keeps a built demo current and a PROVENANCE edit makes it stale), and the typescript-architecture check "Engine content directories hold only engine data and declared pending game data" keeps its name but now asserts that no pending game-data list exists at all. Before them, the most recent registrations are `scene-journeys` (full tier, 5: the portable story and journey persistence checks moved unchanged out of `scene-navigation`, which keeps its 11 live-navigation checks and the memo check below, so the two run concurrently) and the `scene-navigation` check that the accepted-pack validation memo is keyed by the exact pack content and the renderer/animation extension catalogs and hands out detached packs (added with that memo); before it came `game-demos-browser` (full tier, 9: Littlewild, RTS Frontier and Pocket Pet built with the checkout's compiled CLI and its studio, then the published `demos/manifest.json` and one boot check per published demo from `file://`: only its own game, no request, every storage key inside its namespace), the engine-only CLI and game-build checks (`wildlands-project` 3, `wildlands-cli` 6, `cli-contracts` 3) and `game-folders` (fast tier, 13: the game manifest, closed inventory, byte digest and full validation of every game folder, and each bundled game's folder profile against the digest captured before its data moved: Littlewild, Emberworks, Office, RTS Frontier and Pocket Pet), `content-provider` (fast tier, 6, the content-provider seam), the typescript-architecture check that runtime modules read game content only through the installed content provider, and the nine engine-source payload checks (`engine-export` 4, `wildlands-project` 1, `wildlands-cli` 3, `engine-export-browser` 1), after `runtime-optionality` (fast tier, 13), `runtime-optionality-browser` (10) and `artifact-play-browser` (4, smoke checks of the play/studio artifacts in `.generated/artifacts/`) and the typescript-architecture artifact-profile check. Every Node suite first requires `source/test-support/install-games.cts`, which installs the composite showcase content profile; fresh child processes and browser-like realms that compose engine modules install a profile (or load `content-provider.js` ahead of the module, as a browser artifact does) the same way.

### Browser harness and sleeps

`browser-harness.ts` provides `openArtifact` (serves the HTML from memory through `context.route` on a fixed fixture URL with a navigation timeout separate from action timeouts), `waitForReady` (waits for the shared ready signal `window.__wildlandsReady === true`, optionally for one host id in `documentElement.dataset.wildlandsReady`; the colony shell, the standalone RTS/Pet hosts and the play-boot template all publish it, and a boot that throws never signals ready) and Playwright clock helpers (`installClock`, `advanceClock`, `pauseClockAt`). Browser suites wait for readiness through `waitForReady` with an explicit 60 s `READY_TIMEOUT_MS` rather than their short action timeouts, and `browser.ts`/`game-settings-browser.ts` give `setContent` an explicit 30 s navigation timeout like the other suites; no check name or assertion changed. New fixed `waitForTimeout` sleeps are rejected: `source/verification/sleep-allowlist.json` records the reviewed per-file budget, which may only go down.

The colony and game browser suites load the smallest artifact that covers their checks, through `openArtifact` and `waitForReady` with the expected host id. `game-settings`, `skill-tree`, `construction-editor` and the colony half of `browser-contracts` load `.generated/artifacts/colony-play.html`. Suites that switch scenes through the scenario library (`browser`, `building-interiors`, `terraform`, `interactions`, `office`) and every `runtime-optionality-browser` colony check except the complete-shell check load `.generated/artifacts/studio.html` (the colony with every bundle except the template hosts). The 17 MB showcase stays only where a check asserts cross-host composition: the complete-shell check (both template hosts mount beside the colony), and `rts-browser`, `rts-mission-editor-browser` and `pet-browser`, which enter the embedded RTS/Pet from a running colony and return, asserting the colony story is untouched and focus returns to the colony launcher. `artifact-play-browser` and `game-demos-browser` keep `file://` navigation because their checks assert `file://` boot. Pages that must each start fresh use `fixtureUrl(label)` origins, since one origin shares the saves the colony writes on `pagehide`; fixture document loads are recorded in `fixtureRequests`, and game `requests` must still be empty. Ordinary actions use `ACTION_TIMEOUT_MS` (15 s); clicks whose handler synchronously builds a world (Begin, scene review and launch, entering an interior or an embedded application) use `TRANSITION_TIMEOUT_MS` (60 s), since Playwright's click resolves only when that handler returns. Fixed sleeps in these suites are gone: synchronous handlers need no wait, asynchronous outcomes are awaited by state (`settle`, which leaves the failure to the check's own assertion, or a visible locator), and rendering or "nothing advances while paused" checks count rendered frames with `nextFrames` (every application frame loop runs once per rendered frame). They do not install the Playwright clock: on pages with expensive frames its natural-flow catch-up runs due frames back to back, starves real rendering and stalls Playwright's actionability checks.

The editor, export and renderer browser suites open their artifact through `browser-pages.ts`. `openColony` serves it with `openArtifact` on the fixture origin, clears storage before each page boots (pages in one context share that origin, so a save from an earlier page never resumes in a later one) and waits for the `colony` ready host; `monitorArtifacts` records the routed documents in `fixtureRequests`, which each suite asserts exactly (one entry per page) while `requests` must stay empty. They load `.generated/artifacts/studio.html` (colony, editors, developer tools and export payloads) instead of the composite showcase, except `storytelling-browser`, `renderer-storytelling` and `renderers-browser`, whose checks use `LWAnimationExample`/`LWRendererExample` from the showcase-only `renderer-examples` bundle; `balancing-defaults-browser` boots its isolated build's `colony-play.html`, the standalone game carrying the edited defaults. `engine-export-browser` and `wildlands-browser` keep their own routed fixture URL (and its exact two-request assertion) but serve the studio and wait for the `colony` ready host. Their fixed sleeps are gone: preview and resize waits use `renderingFrames` (requestAnimationFrame boundaries, after which ResizeObserver delivery and the application's own frame work have run), cinematic and host-animation waits use `presentationElapsed` (the render host's presentation clock, which playback samples), p5 layer paints wait until every outstanding `p5.prototype.redraw` promise has settled, and a resumed simulation is awaited as the state condition itself. `scene-editor-browser` installs the Playwright clock and pauses it after boot, so the simulation and render loop advance only through `advanceUntil` steps of virtual time and every snapshot is of a stopped world; it is no longer `exclusive`. In all of these suites, clicks whose handler runs a synchronous domain operation (beginning the story, opening an editor over a captured pack, reviewing, launching or entering a scene, applying an import or conversion, starting cinematic transport, ordering production or visiting a building floor) use `admit`: the control must become actionable within the suite's unchanged action timeout, and only the click's own validation, import or projection work gets the 60 s `ADMISSION_TIMEOUT_MS`. `storytelling-browser`'s hard budget is 720 s (was 510 s) so two concurrent Chromium suites on a 4-core host fit. `engine-export-browser` keeps its startup-under-20 s assertion measured as before, from navigation to the ready signal: the requirement is wall-clock startup, so heavy CPU contention can still affect it.

### Screenshots

Supplemental PNG artifacts require explicit `LITTLEWILD_CAPTURE_SCREENSHOTS=1`; functional image comparisons remain mandatory. At the earlier capture-policy checkpoint, default and explicit-capture external-editor runs separately passed 11/11, preserving the original limits. That fix preserved all 421 assertions and their control flow, browser actions and timeouts.

## Current complete gate

**1869/1869 checks across 104 suites passed** (1,441 Node/CLI in 76 suites; 428 browser in 28 suites) with `npm run verify -- --jobs 3 --browser-jobs 2 --keep-going` on source commit `4148ad3de6257bb8b7d907d2ebe599abb7db73b2` (verification source SHA-256 `62da94e9b54c102b31ff0da4ee8a139af929e0851b1736f76fab8cca02dc0bb0`, registry `1f9345b0…9db098`, expectations `5a1d7336…f44293`). Wall time 1,276 s on a 4-core Linux host with Node 22.22.0 and a preinstalled Chromium (`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`); showcase fixture 17,247,139 bytes, SHA-256 `983978eff53c1951ca7de21b8cfb0777e8ef6470f51795e9634341ab1a400506`. The longest suites were `storytelling-browser` (336 s), `storytelling-player-browser` (191 s), `scene-editor-browser` (182 s) and `creature-editor-browser` (176 s); `architecture-policy` took 73 s. This is local evidence; hosted CI results for the pushed head are a separate acceptance boundary.

## Earlier clean-checkout evidence (PR 25, 80 suites)

The remainder of this section is the historical PR 25 record and does not describe the current registry.


**1613/1613 checks across 80 suites passed** (1251 Node/CLI; 362 browser). Source `285a235728d2c2c6f4f220582c9219fd0b38531e` / `72b491a3e40e662921a7803c826a1f0c8def74933ca37cdae56c5cc661a76404` (531 inputs); HTML `e26034e9356e53a5aea14cac50fb429c7669e0c6050c09cc0ef632c47dd5cf2e` (20,033,473 bytes); inert bundle `e7b5241297e399cc40bee9769433b5831210ccb058a2988c594e3db9ffd0de07` (677 files).

Final source: `285a235728d2c2c6f4f220582c9219fd0b38531e`. Input SHA-256: `72b491a3e40e662921a7803c826a1f0c8def74933ca37cdae56c5cc661a76404` (531 files). Actual complete-gate HTML: 20,033,473 bytes; SHA-256: `e26034e9356e53a5aea14cac50fb429c7669e0c6050c09cc0ef632c47dd5cf2e`. Exact source/artifact equality is required by the publisher.

The complete gate is 1613/1613 across 80 registrations, with 1251 Node/CLI and 362 browser checks; evidence: reports/littlewild-pr25-quality/final-285a235. The original 75 registrations/commands/budgets and 1,543 named checks remain, with explicitly reviewed incoming assertions and actual additional names. All 65 raw channels retain their exact contract: 63 are empty; two request channels contain four intentional routed fixture URL entries, two from engine export and two from Wildlands.

The accepted complete-gate preflight certifies strict checking; the setup architecture pass and actual successful launch provenance retain their exact current-source evidence. Predecessor focused runs retain their earlier scopes. A separate actual diagnostic-OFF Story24 guard is passed (24/24), outside the registered 80 totals. The actual local Node/browser versions and selection are recorded in the sealed successful logs and runtime receipt; Playwright/core remain pinned 1.63.0. Exact-head hosted Node 22, official bundled Chromium and pinned Godot 4.7.2/native frame jobs require separate actual outcomes. No process observer was installed and no managed/global process absence is claimed.

Repository quality: a fresh five-tool run on `c23f72f0e942f9d78ee107980b99f6c521b56d85` passed with 0 findings across 698 GD/PY inputs (632 GD, 66 Python), input SHA-256 `88d2cc6597ae64e9f59e62b9c28b2fca4b3320f7d44931b702bf5d11baab177b`. The earlier source285 byte-identity quality proof is preserved separately. Final combined native conformance: passed separate headless Godot 4.7.2 conformance; 22 actual raw fields and 244 exported files, no visible frame or hosted claim. These fields require actual reviewed source/version/byte bindings; earlier aa7 Godot 4.6.3 remains historical and supplies no current template conformance.


Prior 1,543 names retain order, all original 75 commands/budgets and 62 raw channels retain exact semantics; three Wildlands channels retain empty errors/console and exactly two routed fixture URLs (65 channels/four intentional requests total); actual additions: 70. Playwright/core are `1.63.0`. Lock metadata selects bundled Chromium `153.0.8010.12`/revision `1243`; this local full run used Node `24.19.0`/system Chromium `151.0.7922.173` (21 actual launches), as sampled in sealed evidence. No hosted causal or all-seven acceptance claim follows from this local proof.

| Suite | Passed / total | Seconds |
| --- | ---: | ---: |
| wildlands-runtime | 19 / 19 | 28.36 |
| wildlands-project | 13 / 13 | 18.44 |
| wildlands-cli | 8 / 8 | 12.39 |
| wildlands-acceptance | 7 / 7 | 14.91 |
| engine-export-cli | 5 / 5 | 12.2 |
| engine-export | 13 / 13 | 22.99 |
| animations | 6 / 6 | 0.04 |
| balancing-cli | 5 / 5 | 12.04 |
| cold-balancing | 23 / 23 | 3.29 |
| balancing | 14 / 14 | 16.52 |
| storytelling | 24 / 24 | 36.69 |
| external-editor-cli | 9 / 9 | 21.45 |
| external-canvas | 21 / 21 | 46.36 |
| creature-editor | 18 / 18 | 28.91 |
| external-editors | 24 / 24 | 65.6 |
| renderer-scene-2d | 10 / 10 | 0.1 |
| scene-editor | 15 / 15 | 16.1 |
| scene-navigation | 16 / 16 | 127.49 |
| architecture-extensions | 10 / 10 | 3.04 |
| building-interiors | 15 / 15 | 5.45 |
| construction | 12 / 12 | 2.94 |
| terraform | 13 / 13 | 3.73 |
| renderers | 16 / 16 | 0.15 |
| canvas-renderer | 29 / 29 | 0.33 |
| architecture-policy | 53 / 53 | 21.04 |
| storage-clock | 15 / 15 | 0.04 |
| gate-integrity | 21 / 21 | 1.09 |
| cli-contracts | 23 / 23 | 16.96 |
| typescript-architecture | 17 / 17 | 5.34 |
| behavior-tree | 7 / 7 | 0.03 |
| content-boundary | 21 / 21 | 1.26 |
| assets | 15 / 15 | 0.27 |
| creatures | 24 / 24 | 1.94 |
| ecs-core | 19 / 19 | 0.07 |
| simulation-profile | 19 / 19 | 0.2 |
| simulation-profile-integration | 17 / 17 | 6.63 |
| scene-environment | 6 / 6 | 0.04 |
| office-scenario | 11 / 11 | 42.28 |
| game-settings | 13 / 13 | 2.24 |
| game-settings-ui | 12 / 12 | 0.05 |
| creature-interactions | 27 / 27 | 14.8 |
| interaction-ui | 12 / 12 | 0.05 |
| developer-toolbox | 32 / 32 | 77.84 |
| engine-composition | 30 / 30 | 1.56 |
| ecs-activity | 9 / 9 | 0.06 |
| ecs-world | 24 / 24 | 0.05 |
| ecs-economy | 15 / 15 | 0.06 |
| ecs-integration | 7 / 7 | 0.7 |
| ecs-world-integration | 6 / 6 | 0.49 |
| ecs-economy-integration | 9 / 9 | 0.46 |
| scenario-domain | 83 / 83 | 28.31 |
| presentation | 49 / 49 | 0.58 |
| pause-policy | 53 / 53 | 0.32 |
| cartography | 71 / 71 | 4.35 |
| domain | 86 / 86 | 3.18 |
| growth-stress | 3 / 3 | 20.91 |
| earned-progression | 8 / 8 | 6.3 |
| scenario-schema-cli | 61 / 61 | 4.73 |
| release | 28 / 28 | 11.38 |
| wildlands-browser | 17 / 17 | 130.98 |
| external-editors-browser | 11 / 11 | 43.89 |
| external-canvas-browser | 7 / 7 | 37.68 |
| creature-editor-browser | 20 / 20 | 66.2 |
| balancing-defaults-browser | 4 / 4 | 30.91 |
| balancing-browser | 9 / 9 | 28.51 |
| storytelling-browser | 24 / 24 | 110.79 |
| engine-export-browser | 11 / 11 | 37.63 |
| renderer-storytelling | 17 / 17 | 56.52 |
| storytelling-player-browser | 8 / 8 | 91.17 |
| renderer-libraries | 14 / 14 | 33.61 |
| scene-editor-browser | 33 / 33 | 107.71 |
| building-interiors-browser | 9 / 9 | 25.33 |
| construction-editor-browser | 13 / 13 | 19.1 |
| terraform-browser | 9 / 9 | 22.45 |
| renderers-browser | 14 / 14 | 22.36 |
| office-browser | 9 / 9 | 19.84 |
| game-settings-browser | 11 / 11 | 16.46 |
| browser | 90 / 90 | 36.15 |
| interactions-browser | 8 / 8 | 22.88 |
| browser-contracts | 24 / 24 | 32.83 |

## Evidence integrity and review

The gate clears stale results, requires uniquely named explicit successful checks, bounds children, retains failure logs and rejects changed source or artifacts. Browser pages run under the production CSP with raw diagnostic monitoring. The engine-export browser proof admits exactly two routed local HTTPS fixture requests, and the Wildlands browser proof admits exactly two routed workspace fixture requests. These are the only two nonempty request channels: four intentional fixture URL entries total. All remaining offline raw diagnostic channels are empty.

Independent review reproduced the stale import fixes and verified real p5/Pixi/Excalibur/Basic rendering, cutscene completion and disposal, authored room geometry, native/RNG/camera preservation, cold exported-extension portability and reproducible source inventories. Its precise source/artifact scope and fresh desktop/mobile captures are retained with the local review evidence. See `PR25-REVIEW-AND-POLISH.md` and `PR25-POSTPUSH-REVIEW.md`. The earlier whitespace/capture-policy polish preserved runtime and vendor bytes. The subsequent paused-preview optimization changes one runtime module, preserves registered renderer and p5 callbacks and current frame timing, and adds two regression cases for invalidation and disposal. The subsequent verifier change queues pixel readback through a GPU buffer and fence rather than blocking on a CPU read. It retains every functional pixel assertion and raw diagnostic check. At the earlier e7befad verifier-only checkpoint, runtime rendering, vendor code, standalone bytes and embedded source inventory remained unchanged relative to the paused-preview checkpoint. Earlier failed combined attempts are retained under `reports/littlewild-pr25-quality/final-gate-attempts/`; they are superseded by this complete passing gate.

The current lifecycle checkpoint preserves the exact preview wrapper and canvases during selection-only redraws, prepares a fresh connected mount after session/revision invalidation, and avoids repeated p5 redraws of an already-cleared empty layer. Nonempty callbacks, validation, resize clears and pending-paint disposal remain checked. Two new Node and two desktop/mobile lifecycle checks augment every original check. A paired CPU-throttled profile reduced empty paints 36 to 2 but did not reproduce the hosted timeout or establish a latency improvement. Final-head hosted verification remains required.

## Windows CI renderer follow-up

Hosted `f5e594a` Windows debug and release smoke checks each passed 129 checks but emitted eight OpenGL-to-ANGLE fallback warnings. The follow-up selects Godot’s supported `opengl3_angle` driver explicitly only for Windows CI, before the user-argument separator. Normal Windows and Linux commands, visible rendering, raw logs, original assertions and time limits are preserved; the launcher contracts pass 23/23. Its two Python changes leave all 531 Littlewild game inputs, native templates and the verified HTML unchanged. Fresh repository quality above covers the changed tooling. Exact follow-up-head hosted results, including warning-free Windows smoke, remain pending.

## Additional repository verification

The independent native application checkpoint passed **103 registered suites / 21,346 checks across six shards**, with 537 native UI captures on Godot 4.7.2. Its clean merged-main source checkpoint is `0f9cd5e1fc040005daeba8eb6f8c8f66bddd02b0`, digest `824e3a412f751d4a9e636c27e92b41f0e8d3a6cfd70b4d0713a0f8fcc5f2f0f4`. All registered suites passed with their original limits, including the 1,390.8-second duel run below its 1,500-second bound. Each shard separately loaded all 453 native scripts. This evidence is supplementary to final PR-head hosted CI. The earlier 99-suite checkpoint and its initial CPU-contention attempts remain separately retained as historical evidence.

At that supplementary native checkpoint, the archive completed 335 Python tests: 334 passed and one expected Windows Job Object test skipped on Linux. Native architecture covered 453 scripts with zero violations; advisory quality covered 687 files with zero findings across five tools. These source-pinned companion checks accompany the complete updated 103-suite runtime gate. That checkpoint’s dependency-lock audit reported zero advisories. Actual Godot GLTFDocument static-proxy import/re-export preserves the native pack; a translated companion changes only its intended X position, rechecked through the final compiled Littlewild codec.

The newer native balancing changes from main `dc2acaaec936ee7cbeb26bdced97d88a6d712588` were merged without changing Littlewild inputs. The earlier 99-suite native checkpoint is historical relative to that update. The complete updated 103-suite/six-shard checkpoint is retained separately; final-head CI remains a separate acceptance boundary.

Current-head GitHub checks must be inspected after pushing; old green runs and this local evidence are not represented as final hosted CI.

## Limits

Headless Chromium does not establish hardware GPU performance, physical touch, Firefox/Safari behavior, screen-reader conformance, localization or human usability/balance. External editor conversion supports documented data and static proxies, not arbitrary scripts or animated meshes. Complete engine JSON contains inert implementation/data/asset/porting inputs for code generators; semantic conversion into a functioning Godot game remains a manual port. See `ENGINE-EXPORT.md`, `EXTERNAL-EDITORS.md` and `QUALITY-AUDIT.md`.
