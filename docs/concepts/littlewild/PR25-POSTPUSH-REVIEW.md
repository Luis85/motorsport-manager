# Littlewild post-push review and polish

The independent reviewer accepted the expansion pushed at `9240715aa12f5b1aadc2259c80ac4bbc789c0d30`. Git independently confirmed both the branch and PR head. No outstanding runtime finding remained in the reviewed scope. The follow-up fixes authored whitespace and clarifies historical publication records.

## Reviewed implementation

The cumulative pass covered data and ECS ownership, physical interiors and construction, terrain editing, creature assets and interactions, deterministic duels, scenario transactions, world and creature editors, asynchronous imports, balancing ownership, storytelling, renderer replacement, p5 lifecycle, external editor exchange, inert engine exports and the typed developer toolbox.

Runtime, content, vendor and compiler inputs from the independently reviewed `6664900` checkpoint through the first pushed `9240715` checkpoint are unchanged. Six browser verifier files changed: their stale renderer assumptions and diagnostic coverage were independently checked. Prior reports retain their original source identities; they are not relabeled as new test runs.

The reviewer inspected the complete clean `9b56e8f` gate: **1,523 checks across 75 suites**, including **332 checks in 20 browser suites**, with all suite exits successful. All raw browser errors and warnings are empty. Nineteen suites report no requests; secure engine export records only its two explicitly fulfilled local HTTPS fixture navigations.

The separate updated native checkpoint passed **103 suites and 21,346 checks across six shards** on merged-main `0f9cd5e`. It retains 537 native UI captures and original suite limits. This is supplementary native evidence, separate from final PR-head hosted CI.

## Implemented polishing plan

The polishing agent removed whitespace on five authored blank lines and one extra final blank line, then froze the source at `ddb3d83`. Scoped attributes preserve literal shader whitespace in exact upstream vendor files and generated standalone output. Vendor bytes remain unchanged; no source wildcard, module-budget exception or warning filter was introduced.

Both agents independently compared the actual generated files: **284 compiler outputs, 24 generated declarations and 11 vendor files are byte-identical** to the complete passing baseline. The 657-entry engine source inventory has identical paths, dependencies, architecture and build metadata. Exactly three raw source entries change text, bytes and hashes; normalizing those entries and aggregate identity makes the decoded documents deeply equal.

The whitespace checkpoint input identity is `805258bd0a0002f8edabdb75a66e03d047e512fdcaea6b415b8a87026d655339`. Its private standalone is 18,761,160 bytes, SHA-256 `0f205d483b1dcc1ac17311b034d262f54355f0308518701b1ea377cf8078e007`. The engine source inventory identity is `3084091dd08a1b7e30a66725e77984c3962a36e0c26e2e1f3f8b5e2d2cbfb3e9`.

Fresh checks passed strict compilation, build, architecture **17/17**, engine export **13/13**, actual renderer/p5 browser **15/15** and secure export browser **11/11**, using the original limits and production CSP. The reviewer independently inspected their results and fresh desktop/mobile export captures. Raw errors and warnings are empty; request handling retains the precise fixture boundary above.

The historical publication README and staging manifest now explicitly identify their older gate and payload as historical. Their original hashes and counts remain intact.

## Release and hosted acceptance

The final source and standalone require their own complete gate because raw source inventory identity changes despite identical compiled behavior. `VERIFICATION.md` and `delivery-manifest.json` record the accepted source and artifact pair and distinguish local evidence from hosted checks. The independent proof and raw reports are retained under `reports/littlewild-pr25-quality/postpush-9240715/`.

At the first-push review, source packaging passed and six hosted workflows were queued. That observation certifies no later head. Current-head GitHub checks remain a separate acceptance boundary after the follow-up push.

Headless checks do not establish hardware GPU performance, physical-device accessibility, human usability or balance. Editor exchange supports documented native data and static proxies. Complete inert engine export provides implementation and mapping inputs for a code generator; a semantically equivalent Godot game still requires a port.

## Hosted screenshot failure and pipeline fix

First-push Littlewild CI (`37156101594`, head `9240715`) passed all **1,191 non-browser checks**, then failed its first external-editor browser suite at **10/11**. The desktop Tiled case timed out at 15 seconds saving a supplemental screenshot after download/import/review checks; the interruption prevented its subsequent cancellation and apply assertions. Raw errors, warnings and request arrays remained empty. The exact failed artifact and report are retained under `reports/littlewild-pr25-quality/hosted-9240715-screenshot-failure/`.

The separate complete local whitespace checkpoint (`ddb3d83`, input `805258bd`) passed **1,523/1,523 across all 75 suites**, including the entire external-editor case. This does not relabel the failed hosted attempt or certify the subsequent capture-policy change.

The independent review identified 40 screenshot sites. Of these, 37 write PNG artifacts for later inspection; three consume buffers as functional image comparisons. Frozen source `a1bc95db62d9a31f6d97c979a335b9dfa17b6117` makes all artifact-only captures explicitly opt-in with `LITTLEWILD_CAPTURE_SCREENSHOTS=1`. The three functional comparisons remain unconditional. Requested captures still fail normally if they cannot complete; errors are not swallowed.

AST comparison independently proves all **421 assertion expressions and their complete branch/loop ancestry**, browser actions, numeric limits, screenshot options and test names unchanged. Bitmap readiness checks, both viewport sizes, raw diagnostics and production CSP remain enforced. Strict compilation, build and architecture **17/17** pass. Exactly the 12 intended compiled verifiers change; the runtime, standalone HTML, source inventory and compressed source loader remain byte-identical to the passing whitespace checkpoint.

The final input identity is `6ba2e108553c2cd1d7b74f9ba522370b58d1b1f4a5778dd55152adc65e833049`. This genuine pipeline change requires fresh default-mode browser verification, explicit-capture verification and its own complete final gate. Current acceptance is recorded in `VERIFICATION.md` and `delivery-manifest.json`, with hosted results kept separate.

Fresh repaired external-editor verification passed **11/11 with capture unset**, emitting no PNG artifacts, and **11/11 with explicit capture enabled**, producing all four valid desktop/mobile PNGs. The previously interrupted Tiled cancellation and apply assertions completed. Both runs retain the original 15-second step and 240-second suite bounds and empty raw diagnostic arrays. The reviewer independently decoded and inspected the captures; no visual blocker remained. The complete final-source gate remains a separate acceptance step.

## Final local acceptance

The complete clean-checkout gate on `a1bc95db62d9a31f6d97c979a335b9dfa17b6117` passed **1,523/1,523 checks across 75 suites**, including all 20 browser suites (332 checks), completed `2026-10-03T22:58:43.467Z`. The standalone copied from this archive matches the source and artifact identities above. This complete gate supplements the independently reviewed byte-equivalence and 39 focused checks. No runtime or verification source changed after the frozen checkpoint. Final-head hosted checks remain separately observable on PR25.

## Unchanged-input hosted navigation retry

Hosted head `6e29af0` failed the non-browser scene-navigation suite at its unchanged 180-second bound (180.12 seconds, ETIMEDOUT/SIGKILL), before any browser suite ran. The artifact contains neither partial navigation results nor useful case progress, so it cannot identify the interrupted case. The original evidence is preserved under `reports/littlewild-pr25-quality/hosted-6e29af0-navigation-timeout/`.

Navigation source and its compiled verifier are byte-identical to the earlier hosted checkpoint, which completed in 137.30 seconds; the final clean local run completed in 138.49 seconds. The thirteen preceding hosted suites were approximately 30% slower than the earlier hosted run. This supports a host-wide slowdown explanation, without proving the precise cause. Independent review recommends one fresh final-head run with the same source, assertions and time limits. A repeated timeout requires profiling the actual case costs before changing implementation or verification. This publication retries those unchanged inputs and preserves both prior failures separately.

## Hosted storytelling failure and measured preview improvement

Hosted `475307b` passed navigation 15/15 in 178.66 seconds, then failed storytelling browser 11/13. Two 1440px Add-track clicks exceeded the unchanged 20-second action bound after resolving visible, enabled and stable controls. The corresponding 390px cases passed and all raw diagnostics were empty. The 3D track creation committed despite the click interruption, as shown by the next keyframe case. Original reports remain under `reports/littlewild-pr25-quality/hosted-475307b-storytelling-browser-failure/`.

Private profiling with the original assertions and bounds did not reproduce the hosted 20-second delay. Matching hosted Chromium could not be downloaded because the environment blocks cdn.playwright.dev. The controlled before/after profile measures desktop completion 68.204 to 58.086 seconds, mobile 38.937 to 31.984 seconds, and Basic paints 225 to 28, with desktop validation calls unchanged at 45. These are diagnostic measurements, not proof of the failed hosted click cause.

The independently reviewed change caches immutable projected frames by sampled time, state, generation and viewport. Every registered renderer and p5 callback remains supplied with current timing. Only redundant built-in static rendering is skipped. First paint, seek, both resize dimensions, stop/replay/pause, failed-paint retry, replacement and late disposal remain covered; two meaningful renderer regression cases are added. No original assertion, validation, browser action or numeric bound is removed.

The complete clean-source gate on `a2eee462f686b9ebbef4e177ed99edb2e65b1a88` passed **1,525/1,525 checks across all 75 suites**, including all 20 browser suites / 332 checks, finished `2026-10-04T00:28:02.597Z`. The exact verified standalone is published with the identities in `VERIFICATION.md`; previous complete gates retain their own source/artifact identities. Final-head hosted CI must be accepted separately.

## Hosted GPU readback warning and verifier correction

Hosted `dbf9cf0` completed 64 passing suites (55 Node and nine browser suites), recording 1,291 successful checks before the renderer-library suite. All 13 functional library checks passed, including actual Pixi/Excalibur pixels, picking, composited scenes and paid interior work. Its fourteenth strict diagnostic assertion failed because the verifier synchronously read GPU pixels into a CPU array, producing Chromium 153's GPU stall warning. The original warning and reports remain under `reports/littlewild-pr25-quality/hosted-dbf9cf0-renderer-library-diagnostics/`. The previous `1e6a1c9` failed at the same suite, but its oversized artifact was not downloaded and its precise failed case is not asserted here.

The verifier now queues WebGL2 readback into a GPU pixel buffer, restores graphics state before yielding, polls its fence without blocking, and copies pixels only after completion. WebGL1 uses an asynchronous actual-canvas snapshot. Resource and graphics-state cleanup remain checked. All original pixel palettes, geometry thresholds, functional image comparisons, raw warning/error/request assertions, CSP, browser flags and existing time limits remain intact. No diagnostic is filtered and no blocking `gl.finish()` is introduced. The workflow prints failed leaf evidence and preserves a compact artifact alongside the complete original artifact.

Supplementary probes remain separate from the registered gate: a forced Pixi WebGL1 probe recorded vendor texture-enum warnings, while its pixel samples and cleanup passed. A separate actual WebGL1 fixture verified the helper fallback with clean raw diagnostics. Both the failed and passing probes are retained in `reports/littlewild-pr25-quality/renderer-library-async-readback-20261004/`.

The independently reviewed verifier source checkpoint `e7befadc7ea74055737983ae884c25a6cf321257` passed the complete **75-suite / 1,525-check** local gate, including 20 browser suites / 332 checks, finished `2026-10-04T02:22:59.226Z`. The exact verified standalone and source inventory are published with the identities in `VERIFICATION.md`. Previous complete gates and failed hosted runs retain their own identities; final-head hosted CI must be accepted separately.

## Hosted storytelling follow-up and preview lifecycle

Hosted `78c02c8` passed 60 suites / 1,244 checks before storytelling failed 10/13: its desktop 3D track-ID fill timed out after resolving the input, leaving two dependent checks without their required track. Later desktop 2D and all mobile cases passed; raw diagnostics were empty. Renderer-library checks were not reached. The verified compact and complete original artifacts are retained under `reports/littlewild-pr25-quality/hosted-78c02c8-failure-diagnostics/` and `hosted-78c02c8-full-evidence/`.

The two original desktop cases passed locally under 4x CPU throttling, so the hosted timeout was not reproduced. Profiling did identify redundant empty p5 paints, reduced 36 to 2 by this change with required resize clears retained. Validation/import counts remained equal; profile duration varied adversely, so no overall latency or causal timeout claim is made. Selection-only redraws now reuse the exact original preview wrapper and both canvases. Revision, clip, session identity and close invalidate it; replacement preparation requires a connected canvas. Independent review found and corrected a fake-disposal mismatch before acceptance.

All original 13 storytelling checks remain byte-equivalent in assertions/actions/limits, augmented by two lifecycle cases. Node animation checks increase from 3 to 5, covering empty validation/resize, all nonempty callbacks, pending clear and disposal. Focused actual storytelling and p5-renderer proofs each passed 15/15 with empty raw diagnostics. Source `bfa4e8798be53eb33d05195d30e3efae009f5076` then passed the complete clean **75-suite / 1,529-check** gate, including 20 browser suites / 334 checks, finished `2026-10-04T03:58:57.868Z`. Standalone and 657-file inventory identities are updated from that exact archive; earlier passes remain historical. Hosted acceptance must use the newly published PR head.

## Stable browser toolchain mitigation

Hosted `bc7e8bb` passed 60 preceding suites / 1,246 checks, then Storytelling failed 13/15. The desktop Add track and Apply storytelling import clicks exceeded the unchanged 20-second action limit after resolving visible, enabled and stable buttons. Subsequent keyframe/p5 cases establish Add track committed; import commit is unproven because the following lifecycle case does not assert the renamed clip. All mobile and both new lifecycle cases passed; raw page/console/request diagnostics were empty, and renderer-library verification was not reached. Exact failure evidence remains under `reports/littlewild-pr25-quality/hosted-bc7e8bb-failure-diagnostics/`.

Private whole-click profiles passed their five original desktop cases plus raw diagnostics (6/6 each) at 4x slowdown and at 16x around the target clicks, retaining 20-second actions and the 300-second suite budget. Neither reproduced the hosted failure. Validation, renderer disposal/replacement and hit-target cleanup incurred measured work; no isolated 20-second GPU disposal stall or causal determination was established. Actual phase, CDP and GPU evidence is retained in `reports/littlewild-pr25-quality/performance-checkouts/storytelling-bc7/CLICK-DIAGNOSIS.json`.

The exact official stable Playwright and playwright-core `1.62.1` pin selects bundled Chromium `151.0.7922.34` revision `1234`, replacing the failed hosted `153.0.8010.12` toolchain. This is a published stable-version reproducibility mitigation, not a proven explanation of either timeout. It does not contain the unreleased Playwright 1.64 [Range patch 43076](https://github.com/microsoft/playwright/pull/43076). [Official1.62.1 browser metadata](https://github.com/microsoft/playwright/blob/v1.62.1/packages/playwright-core/browsers.json) documents the selected bundle. Gameplay, verification source, vendor bytes, original assertions and numeric limits are unchanged; all 284 emitted JavaScript files match the lifecycle checkpoint. Only package/lock configuration rows and corresponding dependency metadata change in the 657-file source bundle.

The fresh local gate actually used system Chromium `151.0.7922.173`; it does not certify the separately bundled hosted `151.0.7922.34`. All seven workflows must succeed on the new publication head before hosted acceptance. Prior hosted failures and local checkpoints retain their own identities.

The fresh `c0e66f74569367d03058a6c9ddbc2e4f4ea38aa4` clean archive passed **75 suites / 1,529 checks**, including all 20 browser suites / 334 checks, completed `2026-10-04T05:22:46.441Z`. Every original lifecycle-checkpoint suite command, check name, assertion, browser action and numeric bound remains intact. Root/archive bytes match before and after for all 501 gate inputs; all 187 historical core evidence paths and every additional actual evidence file are sealed. The current standalone and source bundle identities in `VERIFICATION.md` and `delivery-manifest.json` are derived from that passed archive. This local result and the independently reviewed stable-toolchain recommendation do not substitute for the seven new-head hosted checks.

## Ordinary-object descriptor inspection optimization

Hosted `ae874f04420c2bc1955530abea055197b9537fb4` passed 13 Node/CLI suites / 186 checks and attempted 14 suites. Node scene-navigation exceeded its unchanged 180-second budget at 180.11 seconds (`ETIMEDOUT`, `SIGKILL`); its result leaf is absent and its log contains one newline byte. No browser or renderer-library suite ran. That failure used gate input `cd76fe50a57fc2fab1f56635f5b3e773650ebfe538f21641bf23944b81f7fde1` and standalone `c33c69c238ad9075609dd4d1ae1142f18727cbf46ad3a6843f7bba139b46e421`; its stable browser mitigation was not hosted-tested. The complete local `c0e66f74569367d03058a6c9ddbc2e4f4ea38aa4` checkpoint remains historical, including bundle `6830af3104c19377d3c531df7048c0ac6f9592a48bbd434a741669875e181f74`.

The runtime change reduces ordinary-object descriptor allocation only. All original JSON safety checks, validation calls, native admission, array handling, clone/parse/fingerprint behavior and numeric budgets remain. Ordinary JSON rejection ordering is retained. A missing Proxy descriptor now rejects fail-closed; arbitrary Proxy trap sequencing is not claimed observationally equivalent. Navigation tests retain 15 original cases/assertions and add timing diagnostics; content-boundary retains 18 original cases and adds 3 safety regressions.

Playwright/playwright-core remain exactly `1.62.1`, selecting official Chromium `151.0.7922.34` revision `1234`; this local gate actually used `Chromium 151.0.7922.173 built on Debian GNU/Linux 13 (trixie)`. The earlier stable-toolchain mitigation has not yet been exercised by hosted browser suites on the failed ae874f0 run. All seven workflows must pass on the new publication head for hosted acceptance.

Sealed local Node22 `v22.23.3` profiles of the same 15 navigation cases measured 151.377s before and 119.963s after (20.75% lower elapsed time in this run). Observed public API counts matched per case; this wrapper census excludes locally captured/internal calls. The separate uninstrumented 15-case acceptance passed under the unchanged 180-second limit, with summed case timings 114.041s. These local runs did not reproduce the hosted timeout or identify its missing last case. Actual raw API/CPU profiles and Node package provenance are sealed in `reports/littlewild-pr25-quality/performance-checkouts/navigation-ae874/NAVIGATION-PROOF-SEAL.json`; no profiler or wrapper ships.

Source `8793f421288336c12deca4a56f81fb417cde4b81`; authored gate input `7bcb66a8b0f4e0a1fcd78c156311346acf997d48d9cfa920dcd593866a0a14e7`; standalone `6fafea78ba5c92f6b17d5f4e9a5c349e879a4a985e206a605a167a67b230b120` (18765804 bytes); 657-file inert source bundle `16e48243f2093756244a2068b6dd868fa624417ebcc7222572a158ddce061fc1`. These current identities are also recorded explicitly in `VERIFICATION.md` and `delivery-manifest.json`.

The complete local gate passed 75 suites / 1,532 checks, completed `2026-10-04T06:31:26.874Z`. All 501 committed inputs match root/archive before and after; all 189 original proof paths plus 0 actual additional files are sealed. Exactly 3 of 284 emitted JavaScript files differ; the unchanged 657-file bundle policy includes only the modified content-runtime source row. This local result does not certify any new-head hosted workflow.
