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
