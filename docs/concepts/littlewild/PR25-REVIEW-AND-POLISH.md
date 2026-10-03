# PR 25 — comprehensive code review and polishing pass

This is a chronological review record. Current source, artifact and acceptance evidence are recorded in `VERIFICATION.md` and `delivery-manifest.json`.

## Review target

- Repository: `Luis85/motorsport-manager`
- Pull request: **#25 — Littlewild v15: data-driven worlds and ECS M1–M6**
- Reviewed branch: `concept/littlewild-v15-world-ui`
- Reviewed remote head before the pass: `13b51ac0c4a8fd5dff8921d51dc311007a38e437`
- Product scope: `docs/concepts/littlewild/` and its dedicated workflow only

The review treated M1–M6 as one system rather than reviewing only the final commit. Generated HTML, browser captures, vendored Three.js, and machine-generated verification records were separated from hand-authored runtime code. The highest-risk paths were deterministic scheduling, physical-resource settlement, scenario/story review and commit, global registry lifetime, migration compatibility, and release evidence.

## Findings resolved

### P0 — a rejected deferred ECS batch permanently wedged the world

`World.flush()` validated the queued structural commands before removing them. A late invalid command correctly prevented partial entity/component writes, but the invalid queue remained. `Scheduler.step()` refuses to run while structural work is pending, so the same rejected batch made every later step fail.

**Resolution:** consume the complete structural batch before shadow validation. A failure still leaves authoritative entity/component state untouched, but the failed transaction is discarded and the world remains usable. The regression test now proves queue cleanup, a subsequent valid flush, and a later scheduler step.

### P0 — malformed physical transaction batches could partially move stock

Transfer batches validated and prepared each command immediately before execution. A malformed later command could therefore be discovered after an earlier command had already mutated inventories. Production settlement had a related ordering problem: a failed-attempt record could increment `attempts` before rejecting an invalid retry progress.

**Resolution:** preflight the complete command set before binding components or running systems. Physical IDs, inventories, quantities, capacities, production records, and action-specific fields are validated up front; conflicting entity IDs bound to different records are rejected. Invalid production settlements are rejected before any job mutation. Regression coverage proves a valid-first/invalid-second transfer batch leaves every inventory unchanged and an invalid retry leaves the entire job/storage record unchanged.

### P0 — import confirmation did not bind everything the user reviewed

Portable-story confirmation primarily trusted the base-library preview. Adventure, World, Growth, and the imported engine state could be changed after inspection. Scenario confirmation protected the pack body but not the selected `sceneId`, allowing another scene in the same reviewed pack to be launched. The visible fingerprint fields were themselves mutable, so a caller could modify both data and the displayed checksum.

**Resolution:** story review now fingerprints the exact engine state plus all four libraries, revalidates each library in the staged dependency context, reconstructs the engine from that reviewed snapshot, and rolls every active registry back if installation fails. Scenario review includes the selected scene. Both boundaries keep review evidence in private `WeakMap` storage bound to the exact preview object; changing public data and forging public fingerprint fields cannot authorize a different commit. Scenario-aware envelope review independently binds experience and simulation-profile data.

### P1 — temporary global registries could escape their synchronous lifetime

Base, World, Growth, simulation-profile, and world-profile helpers temporarily replace process-global state and restore it in `finally`. Returning a promise allowed asynchronous continuation after restoration, which could make validation or construction continue under the wrong active configuration.

**Resolution:** every temporary scope now rejects thenables and documents the synchronous-only contract. Tests cover successful rollback, exception rollback, and promise-return rejection across all affected registries/profiles.

### P1 — resource identifiers accepted an empty logical ID

Several physical-world checks validated `"i:" + id`. An empty resource ID therefore became the syntactically valid string `i:`.

**Resolution:** validate the actual authored resource ID directly for inventory keys, deposits, transfers, and recipe costs.

### P1 — portable-story activation was not one rollback boundary

The previous commit path installed Base, Adventure, World, and Growth sequentially without restoring already-applied registries when a later activation failed.

**Resolution:** validate and construct under detached temporary registries first, retain a complete active snapshot, then install all four registries inside one guarded activation boundary. Any activation failure restores the exact previous definitions before propagating the error.

### P2 — the historical byte-parity gate did not describe the reviewed story migration

The required story-import hardening necessarily changes `story-codec.js`, which was still pinned as byte-identical to v14. The release gate failed despite all 843 preceding non-browser checks passing.

**Resolution:** preserve the original v14 hash, add `story-codec.js` to the narrow reviewed-migration manifest with its reason and required implementation token, and keep every other retained contract byte-pinned. The release gate passes without weakening historical protection.

## Architecture and quality assessment

The PR keeps authoritative state in native save records and uses ECS worlds/schedulers as transient execution boundaries. Actor, physical-world, economy, scenario, profile, and presentation responsibilities remain distinguishable. Imported JSON remains data-only: it cannot register executable systems, handlers, commands, modules, callbacks, or arbitrary runtime topology.

The final pass did not introduce a second persistence model, change native state version 8, reorder deterministic simulation systems, consume extra gameplay randomness, or move simulation authority into the UI. Scenario/story validation is synchronous and reversible; confirmation is now explicitly bound to the reviewed snapshot. The standalone build remains network-independent and retains its CSP and bundled vendor license.

## Verification

The authoritative `python3 verify-v15.py` run rebuilt the standalone from source and passed **1,006/1,006 checks across 27 suites**, including **105 browser checks**. The final artifact is **3,795,633 bytes**, SHA-256 `d317308acd8b10bdd0acbdd365bc6c669f89ecd06f563067bd675d4722c4b5f1`. Per-suite timings and machine-readable evidence are recorded in `VERIFICATION.md` and `verification/v15/gate-results.json`.

Additional focused checks executed during the review included JavaScript syntax checks for every changed source/test file, `git diff --check`, targeted ECS/world/scenario/profile suites, an independent standalone rebuild, and both browser scripts. The repository-level architecture checker scanned **232 scripts with zero violations**. The Python authoring/verification suite passed **171 tests with seven expected skips**. These supplement rather than replace the isolated Littlewild gate.

## Remaining deliberate debt

- Content and profile registries remain process-global and support one active experience per document.
- Runtime exactly-once caches are transient and grow for the life of an engine; persistent chapter IDs remain the durable replay boundary.
- Deterministic content fingerprints are change identifiers, not cryptographic authenticity proofs. Private object-bound review evidence now prevents public-token substitution inside the application.
- Large historical modules remain protected by compatibility fixtures instead of being mechanically split in this review.
- Hardware WebGL, physical devices, screen readers, representative-device performance, game balance, and human usability require separate validation.
- Native Godot gameplay was not modified by PR 25; its six-shard runtime gate is not evidence for this isolated HTML concept and is not substituted by the Littlewild gate.

## Interactions and portable Office scenario follow-up

The sections above record the earlier pre-TypeScript review. Current release counts and identities are in `VERIFICATION.md`; the old module-size and typing debt statements do not describe the current source inventory.

Parallel implementation added authored interaction definitions, duel profiles and trigger rules, independent persistent duel/quest settings, complete scenario resource catalogs, and a generic role/workflow boundary. Office exercises these boundaries through Phil's customer calls, Marty's physical supply transfers, and Angela's packing and dispatch. The scene selects indoor presentation through environment data rather than a scenario-name branch.

Independent integration review reproduced three persistence defects and verified their fixes: market cleanup discarded physical sales still referenced by customer orders; bounded completion markers evicted facts for live orders; and portable stories accepted conflicting native and experience resource catalogs. Regression coverage now checks retention, coherent catalogs, reversible failed imports, and exact native/portable continuation through normal simulation.

The interaction review also corrected target cooldown enforcement, terminal-history validation, complete catalog fingerprints, current composition guards, and large bounded history imports. Root review hardened 3d6 input ownership, immutable probability caches, finite derived arithmetic, and release coverage for every shipped scenario. All 15 inventoried compatibility modules now receive strict semantic checking with declarations checked; architecture has no line-budget or typing-debt exceptions.

The supported duel resolver is the existing GURPS-inspired 3d6 subset with nonlethal authored scoring. New executable behaviors still require reviewed engine code. Process-global catalogs remain a single-active-context compatibility boundary, enforced by host/session ownership and revision guards. Full browser/release evidence and device, hardware and human-validation limits remain explicit in the delivery records.

## Interiors, construction, terrain and renderer review checkpoint

Independent review of committed source `969d4d76e205c880e2a6273c3f8c0b4ad84b9dd2` reproduced and resolved incorrect raised-terrain picking, invalid indoor paths, missing onsite Office occupancy, cross-floor duel eligibility, pending construction overlap, renderer failure-code loss, and a planted-model draw failure. Canonical geometry and venue queries now serve both simulation and presentation. Paid work, movement, world stock and quest progression retain their existing authorities. The replacement renderer uses detached snapshots and explicit lifecycle and command ports.

The immutable clean-checkout gate passed **1,164/1,164 checks in 50 suites**, including **185 browser checks**, completed `2026-10-03T14:37:55.159Z`. Input SHA-256: `3355e7df589912ca46563a5389f3d0623fedd59cf7c4c6f9c2845f1eaa28e81a`. Standalone SHA-256: `0b5b502dafebe4ce2df148959def83e9bf87aa0824ace0d22231823ba903b12e`, 4,947,724 bytes. The independent build was byte-identical and additionally passed 96 focused native checks, 17 architecture checks and 43 browser checks. This is checkpoint evidence before the subsequent World and Scene Editor, not the final combined release claim.

Actual desktop and 390px captures cover Office task occupancy, upper floors, freeform construction, Terraform, and custom room rendering. The interior browser suite retains documented software-GPU environmental exclusions; Canvas readback warnings were resolved rather than filtered. Construction browser evidence does not retain a complete console ledger. Hardware GPU, physical devices, screen readers and human usability remain outside these automated proofs. All 15 inventoried strict typing-debt modules were migrated; this does not imply a new inventory covering unrelated native or historical publication sources.

## Authoring, storytelling and export review

The next implementation cohort adds visual world/scene and creature editors, actual PixiJS/Excalibur rendering, external editor exchange, storyboards and timeline playback, p5 animation, full engine JSON export and central balancing. Scoped acceptance evidence belongs to each frozen owner snapshot; final combined counts belong to the immutable release gate.

Independent review reproduced delayed timeline cues and lost cues sharing a timestamp with a reviewed scene change. The director now dispatches at cue boundaries and retains due events after Cancel or a rejected gate; 23 focused native checks verify the corrected sequencing. Root review corrected general p5 playback's seconds/milliseconds mismatch and requested an actual host-clock expiry regression. Preview assets come from an immutable draft catalog, including the default catalog when a pack omits resources; camera caches expire when a story is replaced.

Balancing admission now checks active interactions as well as paid tasks, production and quests. Compiled field bounds are independent of editable defaults, fractional times/rates remain usable, and incompatible threshold ordering is rejected. Central creature tuning overlays preserve the asset-folder archetype identities and discovery path. UI prices and estimates must read the same captured rules as their domain commands.

Engine export includes dimension-aware Godot scene mappings, canonical floor geometry, every RNG stream and verified source references. Its direct Node import initializes its dependencies without relying on a preloaded SDK. Compressed source data remains inert and bounded; tests exercise hash tampering, accessors, source completeness, asynchronous snapshot ownership and actual large browser downloads. This is code-generator input, with explicit semantic-port requirements rather than a claim of an automatically converted Godot game.

Current `main` was integrated at merge `e3d184dd029c9a681570b69b3022049e14396867`, retaining its digest-verified native artifact downloads and graphics setup. Native architecture checks scan 447 scripts with zero violations, and all five advisory quality tools report zero findings across 667 measured files. That clean checkout completed 292 Python tests: 291 passed and the Windows Job Object test skipped on Linux. Initial runs in the development workspace failed while Godot imported npm SVG assets; the separate browser project now carries `.gdignore`, and clean import completes without errors or warnings. These checks supplement the required final native runtime gate.


## Final authoring and animation checkpoint

The complete registered gate on `9b56e8ff2a609a112239476d8d51ed54824300af` passed 1523/1523 checks across 75 suites, including all 20 actual browser workflows. Shipping HTML is copied from that immutable archive; its SHA-256 is `feb63a408193509adfc771e6c520594ce40724aaa57bb5b58fdf547630f1c201`. Strict domain/application typing debt remains zero, and all ownership/line-budget checks pass. Final combined verification additionally corrected cold standalone task-duration and creature-balancing initialization through explicit inward dependencies; cold-process regressions retain the supported composed entry boundary.

Independent review separately verified actual p5 timing/output/lifecycle, normal cutscene completion/native continuation, registered custom renderers and authored interiors, asynchronous import race fixes, mobile balancing controls, cold source exports after extension withdrawal and deterministic source inventory reproduction. Source-specific reports distinguish prior scoped proofs from the current full gate. The updated merged-main native checkpoint passed 103 suites / 21,346 checks across six shards, separately loading all 453 scripts and retaining 537 PNG captures. Its source checkpoint is 0f9cd5e, digest 824e3a412f751d4a9e636c27e92b41f0e8d3a6cfd70b4d0713a0f8fcc5f2f0f4; final PR-head hosted checks are a separate acceptance boundary. Historical attempts and CPU-contention timeouts remain retained, with no weakened assertions, registration or timeouts.


The final diagnostic follow-up removed the earlier interior warning exclusions and retained previously omitted raw logs for five browser workflows. All 61 focused checks and the final 75-suite gate pass with empty raw error/warning/request arrays, except the two explicitly documented local HTTPS fixture navigations in engine-export verification.
