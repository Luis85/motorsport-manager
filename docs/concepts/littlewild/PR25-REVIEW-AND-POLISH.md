# PR 25 — comprehensive code review and polishing pass

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
