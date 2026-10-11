# Armored Platoon bounded verification evidence — 2026-10-10

> Historical implementation evidence from the work based on `749a9f6296f3beb665eedf1eda57ae8cbfd00b39`. These captures establish the behavior described below for particular artifacts. They do not establish reference-game parity or hardware acceptance.

This directory retains small, portable reports and selected captures. Generated HTML, raw frame streams, and full build logs are excluded; selected regression logs are retained. Three logs are losslessly compressed to preserve their original terminal blank lines; the [compression record](raw-log-compression.json) binds decompressed bytes and hashes. The [integration record](../armored-platoon-2026-10-10-integration.md) and [parity ledger](../../reference/armored-platoon-parity.md) record the broader scope and outstanding gaps. [SHA-256 manifest](manifest.json) covers every retained evidence file; source digests and complete command sequences are embedded in the two session reports.

## Artifact identities

| Artifact | Bytes | SHA-256 | Evidence scope |
| --- | ---: | --- | --- |
| Intermediate compiled browser artifact | 1,802,555 | `dffbbdb19f615925a09631cd3e84621742b2fb243feae218e2d3452f5a339558` | Nine browser checks, chase/gunner/phone captures, short motion recording |
| Later compiled Pine browser artifact | 1,803,580 | `9b561acf571dcce27c76ba68bcdc85e0ef02b8215cefe1d471401b32a60f686e` | Original Pine mission from menu to victory debrief |
| Prior published demo (`3679ff94`) | 1,803,890 | `4708ad9b3cd9343ee69b1de248eaeef344b767d83e39bf2ad250271b6737c22d` | Packaging comparison; gzip size 332,430 bytes |
| CSS-isolated compiled artifact | 1,809,185 | `4e7a24b09f490c2c87dcae6a04c9635198f465a612e0eed40991e374d91c0a6f` | Ten focused browser checks, including cross-template computed-style isolation |
| Current published demo | 1,809,495 | `8587053e9591e505313a86936b8b0036a1088f4cb2d270d27ffba3210742e93b` | Regenerated packaging; gzip size 332,592 bytes |

These are distinct files. [Published identity comparison](published-identity.json) records 21 byte-identical runtime inline scripts and identical CSS between the Pine artifact and prior published demo. The remaining catalog/visual-data script is identical after the exact added `LWGameProfile` storage-prefix statement is removed. Wrapper metadata and the explicit storage namespace differ. This supports code/data continuity; it does not turn the Pine run into a run of the published bytes. Published-demo lifecycle verification belongs to the corresponding repository gate; this comparison itself establishes no browser lifecycle result.

[CSS-isolation artifact identity](css-isolation-artifact-identity.json) records the current four CLI hashes and verifies that all 22 inline scripts in the current demo are byte-identical to the prior published demo. CSS differs because every selector is now scoped to the Armored host. Earlier Pine mission captures retain their earlier artifact identities. The corrected compiled artifact separately passed [10/10 focused browser checks](css-isolation-armored-browser-results.json); the [focused gate](css-isolation-focused-gate.json) binds source digest, environment and strict-build result. [Current chase capture](css-isolation-armored-chase.png) belongs to this corrected artifact.

## Browser checks and selected captures

[Intermediate result](armored-browser-results.json) records 9/9 checks passing. [Intermediate identity](intermediate-browser-identity.json) binds that result and the retained screenshots to its compiled artifact. The [browser suite](../../../source/wildlands/source/test-armored-browser.cts) covers menu/briefing/deployment and real WebGL, keyboard driving, pause and detached queries, three camera modes, ammunition and reload, platoon handover and orders, checkpoint rejection/replacement and UI save/load, desktop/compact HUD bounds, and absence of script errors or external requests.

The direct invocation used from `source/wildlands` was:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node --import tsx source/test-armored-browser.cts
```

This invocation requires the repository dependencies and a built artifact. Running it against a later build creates new evidence, not a reproduction of the intermediate identity above.

- [Chase view](armored-chase.png)
- [Gunner view](armored-gunner.png)
- [390 × 844 phone observation](armored-phone-observation.png): layout observation only; touch driving is not implemented or accepted.

[Short motion recording](armored-motion.mp4) and [before/after observations](motion-observations.json) show actual keyboard drive, traverse, camera switching and fire at 960 × 600. The recording contains 21 captured frames over approximately 15.196 seconds of wall time; simulation advanced from tick 0 to 127 (2.117 simulated seconds). The controlled chassis moved approximately 5.607 metres, turret yaw changed from 0 to 0.325 radians, and AP ammunition decreased from 15 to 14. There were no recorded page errors. Sparse software-rendered capture cadence must not be interpreted as representative game frame rate.

## Pine browser mission completion

[Pine browser result](pine-browser-result.json) records a fresh menu selection and deployment into the original authored Pine mission, followed by 1,799 accepted public drive commands derived from detached queries. The vehicle reached the rally objective and retreated to cover. Victory occurred at tick 10,800 (180 simulated seconds), with `rally-platoon = 1` and `hold-ridge = 180`. The visible debrief read “Mission accomplished.” [Victory debrief capture](pine-victory-debrief.png) was taken at 1440 × 900. There were no recorded page errors.

The route used the public `WildlandsArmored.query` and `WildlandsArmored.command` ports. It did not restore a checkpoint, inject mission state, or invoke a private session tick. Before application boot, a requestAnimationFrame adapter supplied 100 milliseconds of application time per actual rendered frame; the application's existing six-tick frame cap remained intact. This clock acceleration tests mission progression and the terminal interface, not normal real-time performance or manual play.

Total observed wall time was 437.834 seconds. The initial route viewport was 480 × 320; it was reduced on the same live page to 320 × 240 after the tick-5,304 observation. The debrief capture used the larger viewport stated above. The report includes the viewport sequence, commands, timeline, terminal snapshot, screenshot digest, and a live observation from the original page.

## Session command evidence

| Report | Method and observed outcome |
| --- | --- |
| [Pine session commands](pine-session-command-report.json) | Fresh original catalog, 1,800 accepted drive commands and explicit six-tick session steps; victory at 180 seconds. |
| [Crossroads session commands](crossroads-session-command-report.json) | Fresh original catalog, 5,692 drive/aim/fire/ammo/control commands with explicit six-tick session steps; victory at 201.15 seconds after vehicle loss, handover and a flank. |

These are independent Node session runs, not additional browser completions. Both reports include full command sequences and SHA-256 digests of the exact catalog and relevant combat, AI, mission, physics, session, checkpoint and catalog-admission sources. Neither run uses checkpoint restoration or direct state injection. They establish possible successful routes through the two authored missions; they do not establish reference mission or AI fidelity. Pine's late withdrawal included momentum/downhill coasting after gunner disability, rather than powered driving throughout. The successful Crossroads route waited out finite enemy AP reserves before flanking; this exposes an AI ammunition-management and balance weakness.

## Environment and limits

Browser observations used Chromium 151.0.7922.173, Playwright 1.63.0 and software WebGL through `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`. Node session reports identify Node v24.19.0. The Linux environment was not a representative gaming GPU.

At Pine tick 5,304, observed JavaScript heap use was 23,366,073 bytes out of 32,258,189 allocated bytes. This single point does not measure total process or GPU memory or establish stability. Navigation load time was 6,141 milliseconds for routed in-memory HTML; it is not a network cold-load benchmark. Renderer internals were not exposed to extract Three.js renderer counters.

No 30-minute hardware soak, representative hardware frame-rate acceptance, human usability study, reference-game visual comparison, or full fidelity acceptance is established by this directory. Screenshot presence and successful terminal objectives do not close the gaps documented in the parity ledger.

## Thirty-minute software-browser stability observation

The [compact summary](stability-summary.json), [raw observations](stability-observations.json), [identity](stability-identity.json) and [run log](stability-run.log) record **1,800.002 wall seconds** on the exact current published demo at commit `187dd821`, using Chromium 151, SwiftShader, 960 × 600 output/internal resolution and device scale factor 1. The original requestAnimationFrame clock remained intact. The [workload script](stability-observe.cjs) uses public commands and untouched checkpoint/restore ports, plus actual menu/briefing/selection/deployment UI actions. It injects no mission state or private simulation ticks.

The run recorded **121 samples, seven byte-identical paused checkpoint roundtrips, seven mission switches, and 371 accepted commands**. There were no rejected commands, page errors, console errors or observation failures. Eight warnings retained the same Three.js `PCFSoftShadowMap` deprecation message, once per renderer construction. The canvas count remained one and DOM element count remained 178. CDP session, context and browser all closed successfully; published artifact bytes remained unchanged.

CDP JavaScript heap readings were 27,340,736 bytes initially, 37,664,388 finally, with an observed minimum of 12,895,360 and maximum of 57,610,472. No garbage collection was forced. These measurements neither establish leak freedom nor measure total CPU/GPU residency. The summary preserves eight separate mission/tick intervals: simulation advanced more slowly than wall time on this software renderer, and resets are not summed into a fictional continuous combat duration. The workload uses the small authored missions; it does not cover the full target stress content, multiplayer, device loss or campaign completion. Q03 remains partial and hardware acceptance remains open.

Selected captures are [start](stability-start.png), [Iron Counterattack deployment](stability-transition-04-mission.png), [final Pine deployment](stability-transition-14-mission.png) and [final paused frame](stability-final.png). Other capture/checkpoint hashes remain in the raw report, but those files are retained only in the session's `work/armored-stability-30m` directory. This archive is a selected evidence package, not every local artifact.

The exact [summary postprocessor](stability-summarize.cjs) is retained separately from the launched workload. Reproduction requires a dependency-installed checkout of implementation `187dd821`, its normal Wildlands build (which creates the recorded browser harness), and placing the archived workload at `work/armored-stability-30m/observe.cjs`. Run `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node work/armored-stability-30m/observe.cjs` in an equivalent declared environment. The source-HEAD guard is intentional; a later run is separate evidence with its own identity.

## Repository regression records

The [current implementation workflow snapshot](current-implementation-workflows.json) records all ten workflows completed successfully on `187dd821`. Final [handoff checks](handoff-checks.json) cover documentation links, diff whitespace and the unchanged implementation/output paths. Root static architecture validation also passed with 453 scripts scanned and no violations.

- [Fast Wildlands gate](wildlands-fast-final.log): 866/866 checks across 48 suites, 164.79 seconds. This is the fast selection, not the complete gate.
- [Pinned Python result](python-pinned-regression-result.json) and [raw log](python-pinned-regression.log): 345 passed, one Windows-only skip, 346 tests total in 1558.848 seconds. The result identifies the exact original commit/tree and Godot 4.7.2 binary digest; the integration record maps the identical public commit tree.
- [Exact-current native CI result](native-remote-current.json): all six shards and aggregate passed, **103 suites / 21,346 checks**, at implementation commit `187dd821`, source digest `8d07fd8e647e275bd4920b7b9e50b93cd3fb9867af87dec9e60aed918838e32d`, [run 38088144152](https://github.com/Luis85/motorsport-manager/actions/runs/38088144152). The long duel passed in 1,447.471 seconds within its unchanged limit.
- [Earlier complete native CI result](native-remote-final.json): all six shards and aggregate passed, 103 suites and 21,346 checks, at commit `f6d7c48d` using pinned Godot 4.7.2. Native source paths are unchanged at implementation commit `187dd821`; this does not change the original run identity.
- [Interrupted local native run](native-local-interrupted.json): 453 script loads and two completed suites before stopping the duplicate local run to free CPU. It is explicitly not a complete pass. The independent native CI gate completed separately, as recorded below.
- [Full-gate storytelling log](full-gate-storytelling-browser.log.gz): the 720-second suite deadline expired after 20 passing checks, without a final suite report. This is a failure, not a pass.
- [Full-gate scene-editor report](full-gate-scene-editor-browser-results.json) and [log](full-gate-scene-editor-browser.log): 30/33 checks passed; three interactions timed out. These retain the original failed invocation even if a subsequent isolated rerun passes.

The earlier full Wildlands run was [interrupted](wildlands-pre-css-interrupted.json), with [partial progress](wildlands-pre-css-progress.json) preserved, after review found the cross-template CSS defect. Its source digest was `ff1d5c640032943a051d897a5b3d6a1d476b56e88bf4a163df0f75b44c6a0b5c`. The correction does not establish that CSS caused either recorded timeout; Scene Editor uses the unaffected studio artifact.

The [corrected complete local gate](wildlands-complete-gate.json) and [console log](wildlands-complete-gate.log) record **failure**, not acceptance: 120 suites executed in 2,545.07 seconds, 115 passed and five failed, against source digest `6f000038fcbdf3b3702cdb15af81c117c479492c25089dc049964e66ad10b541`. All 82 Node suites passed. The gate's `2084/2084` count includes only passing suites and must not be presented as the required 2,154-check full pass. Armored separately passed [10/10 in this complete invocation](css-isolation-full-armored-browser-results.json).

| Failed local suite | Observed result |
| --- | --- |
| [Scene Editor](css-isolation-full-scene-editor-browser-results.json) | Initial Begin trial click exceeded seven seconds before domain assertions; setup report 0/1 and diagnostics unavailable. |
| [Process Present](css-isolation-full-process-present-browser-results.json) | 9/10; a phone-width title exceeded its vertical fit allowance. |
| [Engine Export](css-isolation-full-engine-export-browser-results.json) | 11/12; desktop startup took 22,986 ms, exceeding the unchanged budget. |
| [Artifact play](css-isolation-full-artifact-play-browser-results.json) | 0/4; managed Chromium denied every `file://` navigation. |
| [Game demos](css-isolation-full-game-demos-browser-results.json) | 1/11; ten lifecycle checks, including the published Armored demo, were denied by the same file-navigation policy. |

Serial diagnostics used the same Chromium 151, unchanged assertions and original suite budgets. Scene Editor passed **33/33** in 95.788 seconds ([result](serial-scene-editor-browser-results.json), [receipt](serial-scene-editor-browser-receipt.json), [log](serial-scene-editor-browser.log)); Engine Export passed **12/12** in 91.094 seconds ([result](serial-engine-export-browser-results.json), [receipt](serial-engine-export-browser-receipt.json), [log](serial-engine-export-browser.log)). Process Present reproduced the same title-fit failure, **9/10** in 74.777 seconds ([result](serial-process-present-browser-results.json), [receipt](serial-process-present-browser-receipt.json), [log](serial-process-present-browser.log)). The original complete-gate JSON remained byte-identical throughout. The exact selected base `749a9f6296f3beb665eedf1eda57ae8cbfd00b39` reproduced **9/10**, with the identical title-fit failure, in 122.451 seconds ([result](base-process-present-browser-results.json), [receipt](base-process-present-browser-receipt.json), [log](base-process-present-browser.log)). Its result report is byte-identical to the current-source serial report. The base worktree's tracked source remained clean, source digest `b01c40daad1d0e48f443dd39a592fa5b01196671653a2a910ef970df5531e9e8`; the receipt identifies the actual base HTML loaded. This establishes baseline reproduction in this Chromium 151 environment, not a diagnosis of the underlying browser/font behavior. An earlier control-harness attempt failed before browser boot because its temporary path exceeded Chromium's Unix socket limit ([receipt](base-process-present-launch-path-failure-receipt.json), [report](base-process-present-launch-path-failure-results.json), [log](base-process-present-launch-path-failure.log)); the working attempt shortened that scratch path without changing the suite, budget, browser or source. The differing Scene Editor and Engine Export outcomes alone do not establish the cause of their original timeouts. File-policy failures are not retried or bypassed. The standard attempt to install Playwright's pinned Chromium 153.0.8010.12 was [blocked with HTTP 403, Domain forbidden](pinned-browser-install.log) at `cdn.playwright.dev`; local evidence therefore remains explicit-override Chromium 151.0.7922.173. Independent CI uses the package-pinned browser and is tracked separately. A later isolated pass would not rewrite this failed full invocation.


### Independent CI attempt 1

[Wildlands run 38088144186](https://github.com/Luis85/motorsport-manager/actions/runs/38088144186), implementation commit `187dd821`, failed its first complete-gate attempt. The [gate report](ci-attempt-1-gate.json), with [run provenance](ci-attempt-1-provenance.json), records 58 attempted suites and 1,643.37 seconds; its accepted `1022/1022` counter excludes the failed suite and is not complete acceptance. [Renderers browser result](ci-attempt-1-renderers-browser-results.json) and [failure log](ci-attempt-1-renderers-browser.log) record **13/14**, with a five-second Office-selection click timeout while waiting for actionability. The same renderer suite passed **14/14** in the local complete invocation. No assertion or timeout budget was changed.

CI passed Scene Editor **33/33**, Process Present **10/10**, Engine Export **12/12**, Game Demos **11/11** (including the published Armored demo lifecycle), and Storytelling **24/24**. Artifact Play was not attempted before the gate stopped. These passes do not combine with local results to create a complete pass. The additional observer-independent Storytelling workflow step was skipped. The successful retry is recorded separately below; this first failed attempt remains preserved here.


### Independent CI attempt 2 — complete pass

The [verification log](ci-attempt-2-verification.log), [provenance receipt](ci-attempt-2-provenance.json) and [job status](ci-attempt-2-jobs.json) establish a complete pass at implementation `187dd821`: **2,154/2,154 checks across all 120 suites**, 1,870.39 seconds, three jobs with two browser slots. The retained log contains 120 passing suite rows whose counts sum to 2,154, including Armored admission **4/4**, runtime **11/11**, combat **17/17**, browser **10/10**, and Artifact Play **4/4**. The additional observer-independent Storytelling step passed **24/24**, and the separate Godot export job passed. This is the successful second attempt of [run 38088144186](https://github.com/Luis85/motorsport-manager/actions/runs/38088144186/attempts/2).

The receipt distinguishes its source-digest provenance from a raw gate download: digest `6f000038fcbdf3b3702cdb15af81c117c479492c25089dc049964e66ad10b541` was read from the same-head first attempt and local full gate; the successful additional Storytelling step also enforces unchanged gate/source/HTML/result identities. The connector downloaded diagnostic artifact `11684403290` into File Service, but fetching its signed URL into this workspace returned HTTP 403. The raw second-attempt gate JSON and additional receipt were therefore not extracted locally. The archive retains the exact decoded job-log excerpt, derived receipt, artifact IDs/digests and completed job statuses, rather than presenting a reconstructed JSON report as raw evidence. No alternate-host workaround was attempted.

The earlier local failure, baseline reproduction, interrupted invocation and first CI failure remain separate records. This complete CI pass and the software stability observation do not establish M1 fidelity, full gameplay parity, representative GPU performance, or all browser/device coverage.
