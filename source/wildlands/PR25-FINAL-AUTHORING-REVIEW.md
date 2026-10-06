# Independent cumulative Littlewild review — 6664900

This report retains its original source-pinned scope. The later post-push review and current release acceptance are recorded in `PR25-POSTPUSH-REVIEW.md` and `VERIFICATION.md`.

No outstanding actionable finding remains in this independent scoped review. Final-checkpoint native, typed consumer, browser and visual checks pass. Root owns the broader release/native gates, push and subsequent exact PR-head/CI review.

## Identity and evidence boundaries

Checkpoint reviewed: `666490088c322761da90f9dce8123471eb2c147f`. Source input SHA256 `bf73b24e5810ce13017f89101bab84816b800250d8e0b5253b3507aa4a866b59`, 495 files. Before/after identity matches; no source inputs changed during the private checks.

Private HTML: 18,761,164 bytes, SHA256 `feb63a408193509adfc771e6c520594ce40724aaa57bb5b58fdf547630f1c201`. Engine source inventory: 657 files, identity `d5eba5743991a7b50c917c5b97cc4073c08240d908f47a6899422fbc268a597c`.

Exact checkpoint checks: strict TypeScript passes; architecture 17/17; fresh-process cold balancing 23/23; engine export 13/13; CLI 5/5; developer SDK and generated positive/negative TypeScript consumers 32/32; actual renderer/p5 browser 15/15; desktop/mobile balancing browser 9/9 (114 counted checks). Two additional original Creature/Scene delayed-import counterprobes retain newer edits, with empty raw diagnostics. Balance's real File-backed regression exercises the original third race at both desktop and mobile sizes. The reproducibility check builds before/after creating ignored generated suite evidence and requires identical source bundles.

`review-proof.json` pins the exact suite reports, source identity, artifact and all 12 fresh screenshot hashes. The independent source digest hashes sorted source/vendor/toolchain inputs; the root gate uses its own documented input algorithm and must be named separately. Earlier 33e7422/4856702/f3ec2fd results are retained as historical evidence, rather than being relabeled as final tests.

Current merged main provenance: `0f9cd5e1fc040005daeba8eb6f8c8f66bddd02b0`. Independently checked `git diff 6664900..0f9cd5e -- docs/concepts/littlewild`: empty. The merged workflow preserves failure aggregation while suppressing cancellation-induced false failure, and Windows now runs balance contract tests with explicit exit-code checks. The new base's complete native gate is a separate pending acceptance boundary.

## Closed correctness findings

- Cold module loading: pure creature, interaction, growth/adventure, interior and inventory helpers resolve their declared Node dependencies. Fresh-process tests cover helper-first import followed by real composed simulation and SDK save restoration. Bare browser creature catalogs remain supported only when the entire canonical balancing document is absent; incomplete present documents reject. Application tooling uses the documented composed SDK entry.
- Canonical world placement: shipped Littlewild balancing now retains the original reserved-sites policy, so generated island resources preserve authored sites. Existing imported legacy policy behavior and the generator algorithm are unchanged.
- Standalone physical task defaults: world-tasks loads its pure balancing dependency explicitly in Node, while browser manifest ordering remains authoritative. Cold architecture-policy import verifies canonical default duration and explicit duration override.
- Physical indoor presence and native import: authored support cells and direct traversable route edges are authoritative; stationary and fractional saved positions cannot cross walls or disappear into floor holes. Office onsite quests use one pure venue policy, retain canonical quest progression, and remain selectable in detached renderer frames.
- Construction and terrain: upgrades preserve prior authored floor/door/station/stair IDs and footprints; pending forged overlaps are rejected. Height-aware rendered diamond picking handles positive and negative terrain, including pan/zoom. Planted 3D nodes no longer reference an out-of-scope model.
- Scenario lifecycle: direct initial entry checks authored requirements/events; compact world checkpoints avoid recursive resources and admit only bounded portable documents; imports and reviews preserve native state and registries on rejection. Native housing normalization uses authoritative detached import rather than a second housing algorithm.
- Creature and scene authoring: asynchronous file reads capture session identity and revision, so a completed old import cannot overwrite newer form edits. Balance imports also capture draft/base identity and invalidate stale reads. Real File-backed desktop/mobile regressions exercise all three routes.
- Balancing: whole-pack comparison avoids ghost diffs; inherited optional catalogs remain absent on no-op changes; interaction/interior tuning targets the resolved native owner selected by sceneId. Pending/active duels and paid work block incompatible edits, while unchanged zero-diff documents remain valid.
- Storytelling: cues fire at their authored times through bounded time segmentation. Same-time cue tails survive rejected/cancelled navigation review; replacement discards old tails. Runtime completion, skip and cancellation release detached presentation, preserve newly chained clips, and retain status/Replay. Camera state resets for a new story, including the same pack ID.
- Renderer lifecycle: replacement stages both the main renderer and embedded views before committing; failure or cancellation preserves the previous live composition. Actual Excalibur/Pixi draw authored geometry and selected floor contents; canonical 3D presentation and custom renderer admission are transactional. Unknown stable IDs remain inert portable data and require an installed compiled module before runtime entry.
- Engine export: extension metadata is captured before asynchronous work, bounded and validated independently from the current registry. Deterministic built-in descriptors and captured custom descriptors allow cold Node validation after withdrawal without invoking factories. Source hashes, byte limits, source path bounds, metadata tampering and malformed documents are checked. Generated suite evidence is excluded from the reproducible source inventory.

## Architecture and portable tooling

Domain geometry, state rules, immutable data and catalog metadata remain separate from application transactions and presentation hosts. Typed commands and detached projections expose developer operations without giving renderer callbacks a mutable engine. Executable adapters, factories and animation callbacks remain compiled trusted extensions; JSON contains declarative configuration only.

Tiled, LDtk, glTF/GLB, Obsidian Canvas and Advanced Canvas retain supported data-only round trips. Root independently verified a real Godot 4.7.2 glTF import/GLB re-export/native deep-equality round trip. Engine code generation supplies inert source/codegen data and explicit semantic-port instructions; it does not imply automatic gameplay parity in Godot. Custom extensions without associated provenance are identified as requiring supplied source and manual port work.

## Explicit p5 review

The offline runtime pins p5 2.3.4. Its matching source archive (`vendor/p5-source-2.3.4.tar.gz`), LGPL 2.1 text (`vendor/P5-LICENSE.txt`), compiled library and provenance are hash-bound in the exported inventory. The archive package version and license were independently inspected.

Instance-mode noLoop/redraw follows the existing presentation clock in seconds, with no independent gameplay scheduler or native RNG consumption. General descriptor lifetime uses true seconds; disposal, replacement, engine reset and preview reset remove old canvases. Compiled custom preset metadata survives cold export validation and is distinct from the executable callback implementation. All of these actual browser lifecycle, expiration, pose/camera restoration and next-native-RNG parity checks pass on the final coherent artifact.

## Visual evidence and limits

Fresh captures from the exact final artifact were independently inspected: upper-floor 3D room/player controls, actual Excalibur geometry and p5 motion, and desktop/mobile balancing authoring and metrics. No visual blocker remains. Mobile workshop/comparison/review controls measure at least 44px. All final independent browser and race diagnostics report errors[], consoleProblems[], requests[]. Capture paths/hashes are in review-proof.json; final images are in screenshots/ and balancing/. Older original failure captures remain in separate historical folders and are never paired with new passing reports.

Secure engine-export browser proof uses two exact locally fulfilled compiled-fixture HTTPS navigations to make Web Crypto available. It reports no external or other requests and empty console errors/warnings; the two fixture navigations are not hidden by a blanket zero-request claim.

Review status: accepted within the independently tested cumulative scope; no remaining scoped blocker. Root full 75-suite release gate and current-base 103-suite native gate are still in progress at report creation. Tracked release artifact, PR push and fresh exact-head CI review remain required, and this report does not declare those finished. Historical debt outside the tested scope is not declared resolved. This reviewer can be reactivated after push for the final PR/head/CI boundary.


## Renderer and diagnostic follow-up

After the initial scoped review, independent actual browser verification passed all 14 renderer checks on the unchanged runtime artifact. The committed verifier now waits for scene admission before explicitly selecting custom presentation, compares frozen fresh geometry against the replacement engine and preserves active paid work/save state. This supersedes the two transient/stale renderer fixture assumptions; the prior full-gate failure is retained separately.

Five subsequent browser suites passed 61/61 checks with newly retained, exactly empty raw error/warning/request arrays: balancing defaults, interiors, construction, settings and browser contracts. Interior warning exemptions were removed; construction now explicitly checks warnings and requests. These verifier changes preserve the runtime HTML and original per-suite time limits. Source checkpoint `9b56e8f` and its source digest are distinct from the original 6664900 review.

The independent reviewer endorsed the 60-minute overall CI job budget: the earlier 70-suite attempt took 32m39s, exceeding the former 30-minute job limit. Individual suite and startup thresholds remain unchanged. The final complete 75-suite gate and post-push exact-head review remain separate acceptance steps.
