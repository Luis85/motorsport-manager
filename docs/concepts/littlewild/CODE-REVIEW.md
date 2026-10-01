## PR 25 final review and polishing pass

> Comprehensive final review: [`PR25-REVIEW-AND-POLISH.md`](PR25-REVIEW-AND-POLISH.md)

The final branch-wide pass hardened failed ECS transaction recovery, physical-world preflight, exact story/scenario review binding, synchronous temporary-registry lifetimes, resource identity validation, multi-registry rollback, and the retained-contract release evidence. These changes preserve the M1–M6 ownership model while closing failure modes that were not covered by the milestone-by-milestone review.

## ECS M6 review

> Dedicated final review: [`ECS-M6-REVIEW-AND-POLISH.md`](ECS-M6-REVIEW-AND-POLISH.md)


`simulation-profile.js` is the only runtime boundary for data-authored ECS tuning. It parses a bounded JSON document, delegates actor and economy values to their existing validators, deeply freezes accepted data, fingerprints the complete profile, and checks the declared archetype against the compiled engine, pipeline, actor, world, and economy schedules. A scenario can tune approved values but cannot register code or alter system topology.

`scenario-migrations.js` makes schema evolution explicit. Scenario schema 1 migrates to schema 2 with `classic-v1`; context version 1 migrates to version 2 with the same compatibility profile. Ambiguous legacy documents fail closed. `scenario-story.js` emits envelope 10 with independent experience and simulation fingerprints, while envelope 9 remains an import-only migration source. Engines capture their profile at construction so a later active-pack change cannot mutate an existing simulation.

## ECS M5 review

`LW.Engine` now has one stable identity. Feature modules register composition descriptors and never replace the constructor; the final facade has no runtime superclass tower. Existing `super` contracts are captured during composition so behavior remains unchanged, while explicit partial boundaries preserve historical imports and fixture setup. `engine.state` is plain authoritative data and `engine.s` is an actor-scoped view, eliminating accessors on save records.

The high-level clock/actor order lives in `simulation-pipeline.js`; authoritative actor, world, and economy mutations remain in their dedicated ECS schedulers. `command-router.js` exposes a fixed capability manifest and bounded envelopes instead of arbitrary method lookup. Legacy direct methods are retained as compatibility adapters, not a second source of state.

## ECS M4 review

`economy-ecs.js` owns atomic settlement and nothing else. It validates a detached settlement plan, binds the existing player, actor, progression, statistics, and chapter records as components, applies the plan in a deterministic scheduler, and returns a neutral outbox. Any failure rolls every touched record back before the error crosses the boundary. It does not choose rewards, authorize commands, remove physical goods, write history, append ledger entries, create memories, emit UI events, or consume randomness.

The simulation facade now translates approved domain outcomes into settlement plans and translates the outbox into existing journal and presentation behavior. This removes the previous duplicate-mutation pattern where market or quest code could update balances and then call XP/research helpers independently. Runtime settlement IDs provide exactly-once protection for one engine instance; chapter IDs remain exactly-once across export/import through the existing `completedQuests` record.


## ECS M2 review

`actor-ecs.js` now has separate dynamics and activity schedulers. Movement mutates only the bound Transform and Task records, while work progression mutates only Task elapsed time. Walkability and rates enter as explicit validated simulation context; no renderer or UI state is read. Domain-specific authorization and completion remain in `colony.js`, preventing the generic activity systems from spending inventory or emitting rewards.

# v15 code review and scope

## Source identity

The actual v14 source ZIP was recovered and checked. Earlier v15 material consisted of screenshots only, not source. The changes in this package were made on that source baseline. The supplied v14 standalone hash is `3ee1c7f043f2c0e8a1fff3720ede5cf63950793857f89ea9fb141a7619824b0d`.

## Cohesive new modules

| Module | Ownership |
|---|---|
| `world-profile.js` | Detached, frozen active geography/palette profile, cached identity and reversible temporary profile |
| `scenario-shape.js` | Bounded evaluator for the exact bundled scenario/schema keywords, including conditional versions and structural constants; not a general untrusted-schema interpreter |
| `scenario-runtime.js` | Schema-1/2 pack validation, profile migration, world reachability, reversible four-library/profile staging, detached scene preview and commit |
| `scenario-story.js` | Envelope-10 experience metadata, independent simulation identity and explicit envelope-9 migration around the native codec |
| `scenario-ui.js` | Pack catalog, file-read lifecycle, confirmation and exports |
| `build-panel.js` | Non-modal construction catalog/detail/drafts with explicit creature assignment |
| `guide-panel.js` | Non-modal, authored, resumable guidance |
| `v15.css` | Shared spacing vocabulary and panel-specific layouts |
| `simulation-profile.js` / `scenario-migrations.js` | Strict rule/archetype boundary and explicit schema/context migrations |
| `tools/scenario-cli.cjs` | Local file-based validation, export and capture |
| `tools/simulation-profile-cli.cjs` | Local profile validation, fingerprinting, export and schema inspection |

The engine and simulation modules remain authoritative for work and physical resources. Scene validation does not run arbitrary callbacks from JSON. Renderer materials and geography use an installed profile; profile changes invalidate topology/presentation caches. Generation retains a fixed role iteration order so JSON property order does not change the generated island.

## Corrected during the pass

The previous Build and Tutorial modal roots made the world inert. They now use asides; true replacement reviews stay modal. Construction approaches formerly altered the selected creature rather than belonging to the eventual explicit builder; they now remain drafts until placement and are copied into the native order without changing either creature's default policy. Fixed authored sites could lose to random nodes in the old generator; new scenarios use a protected-site policy, while old saves retain a parity-tested legacy policy.

Pack previews restore registries after failure. Late file reads are canceled by tokens and context checks. Unknown root/player scene fields are rejected rather than retained as apparently functional tuning. Starting states must round-trip canonically. Replaying a guide never grants supplies or progression.

## Preservation and remaining debt

`source/fixtures/v14-retained-contracts.json` pins the prior v14 hashes for 19 runtime modules and eight original content-library/schema files. `source/fixtures/ecs-migration.json` is the narrow allowlist for reviewed deviations; everything else remains byte-gated. Changes to composition, geographic profile plumbing, pause-view classification, renderer materials, and final story-import confirmation are intentional and documented there. The original historical test files remain in source; version-specific title/hash/full-screen expectations are not falsely reported as passing v15 checks. Behavioral presentation and pause assertions were carried forward without removing them, with new v15 identity contracts.

This is incremental architecture work. Large legacy modules (`ui.js`, `engine.js`, `systems.js`, `colony.js` and others) remain beyond the repository's advisory per-file budgets. New modules stay under 400 physical lines and new test scripts under 450, but the legacy imports and generated HTML/vendor bundle are explicit exceptions for this isolated concept handoff. No quality-policy exclusions or native-game assertions are changed. Root native Godot gates were not run: no native runtime files were edited.

Future extraction should proceed by responsibility with behavioral fixtures, not minification or arbitrary file slicing. Global registries still support one active experience in a runtime; concurrent independently configured games in one document are not supported. Some wording and mechanics bindings remain setting-specific and are documented in CONFIGURATION.md.

## Follow-up: first ECS migration

`ecs.js` now owns deterministic entity/component storage, structural command buffering, queries and explicit system scheduling. `actor-ecs.js` owns actor needs, learning fatigue and baseline social decay, with tuning in `content/actor-rules.json`. `colony.js` has one intentional numerical-loop extraction. The reviewed M1–M6 deviations—including the final story-confirmation hardening—remain explicitly enumerated in `source/fixtures/ecs-migration.json`; every non-enumerated historical contract remains hash-gated.

Existing story records remain authoritative component storage during this migration and the original four content-library contracts are unchanged. The ECS binds those nested records by reference rather than serializing a parallel state tree. Task dispatch, movement, work completion, incidents, quests, world logistics, economy and progression are deliberately still legacy responsibilities until their individual parity slices land. See `ECS-ARCHITECTURE.md` for the completed M1–M6 boundaries and remaining product-level limitations.
