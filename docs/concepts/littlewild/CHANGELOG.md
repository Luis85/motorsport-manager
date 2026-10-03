## PR 25 portable-world and authoring expansion

Added a world/scene tree editor, nested building floors and connected levels, a 3D creature editor, freeform construction and terraforming, authored creature interactions and automatic friendly duels, independent duel/quest settings, and the indoor Office workflow. Scene checkpoints preserve dormant native work and captured data. All fifteen inventoried domain/application typing debts are closed.

Added replaceable renderer registration, actual PixiJS and Excalibur 2D backends, 2D UI scenes embedded in 3D scenes, and deterministic p5.js animation layers. Storyboards and 2D/3D timeline cutscenes animate detached actors, props and cameras; authored events use the same reviewed scene-transition authority. Developers and coding agents can use the typed toolbox and bounded data contracts.

Added Tiled, LDtk, glTF/GLB and Obsidian Canvas/Advanced Canvas exchange, plus a complete engine JSON export with exact editable sources, schemas, assets, licenses and Godot port metadata. Central `source/content/balancing.json` supplies default libraries, profiles, creature tuning and world/start data; the workshop and CLI validate, compare, review and run bounded deterministic experiments. Exported source supports a code-generator project; executable mechanics still require a semantic Godot port.

Merged current main and retained the verified native CI/tooling contracts. Current release evidence is recorded in `VERIFICATION.md`; counts and hashes in the entries below are historical checkpoints.

## PR 25 comprehensive improvement and polishing pass

Closed the remaining TypeScript/architecture/ECS/data-boundary and verification gaps after the first hardening pass. Runtime ECS collections now use real private storage with read-only snapshots; deferred component batches revalidate payloads before commit; command envelopes reject getters, symbols, cycles, sparse/hidden array data and prototype-shaped input; behavior-tree JSON has exact typed schemas and prototype-safe cooldown memory; Base/Adventure/Growth/World/rule/profile inputs share a fail-closed JSON-only boundary; compatibility globals are checked for inward dependency direction; generated builds are one-pass/preflighted and stale output/evidence is cleared before verification. CI is lockfile-driven with `npm ci`, duplicate Littlewild runs were removed, architecture failures print explicit diagnostics, and browser tests use real Playwright callbacks with screenshot capture separated from the functional gate.

Verified implementation head `1ebb80e513d47df06060321bbede3499792ef0cf`: **1,040 / 1,040 checks across 30 suites**, including **14 / 14 architecture checks**, **935 / 935 non-browser checks**, and **105 / 105 browser contracts**. Standalone SHA-256: `8c86ebff29fe3ae28a34bbaa7ce3ed158fa50dd1b2c3c152263dbf6db124364c`.

## PR 25 TypeScript / Clean Architecture / DDD hardening

Made TypeScript the authored executable source of truth across Littlewild runtime, tests, CLIs, build, schema verification and browser contracts. Added a machine-readable bounded-context map for all runtime modules, inward-only dependency checks, platform-isolation checks, a strict TypeScript architecture kernel, a 40 KB module budget with four explicit legacy compatibility exceptions, and TypeScript-only source inventory enforcement. Hardened the ECS generic component contract so behavior-bearing nested data, accessors, class instances, cycles and non-finite values fail closed. The previous 1,006-check gate is retained only as a pre-TypeScript regression baseline; current-head evidence is produced by the TypeScript verification workflow.

## PR 25 final review and hardening

Completed a branch-wide M1–M6 review and polishing pass. Rejected deferred ECS batches are now consumed without wedging later scheduler steps; physical transaction batches and failed production settlements validate before authoritative mutation; story and scenario confirmation privately bind the exact reviewed engine state, four libraries, experience, simulation profile, and scene selection; temporary global library/profile scopes reject asynchronous escape; physical resource IDs validate their real values; and portable-story activation rolls back all registries as one boundary. Added regression coverage and a narrow reviewed-migration entry for the intentionally changed story codec.

## ECS M6 review and polish

Hardened the final milestone with a standalone simulation-profile schema, explicit migration ownership, an immutable per-engine profile, compiled schedule/archetype validation, an independent simulation fingerprint, and atomic profile/library/world activation. Added a dedicated review record and expanded the complete gate to 1,006 checks across 27 suites.

## ECS M6 — versioned simulation profiles and schema evolution

Added scenario schema 2 with a required, self-contained `simulation` profile. The profile combines validated actor/economy rule values with the exact compiled `living-world-v1` engine, fixed-step, actor, world-transaction, and economy-transaction schedules. Both JSON Schema and runtime validation reject unknown or reordered systems, behavior-shaped fields, invalid coefficients, and ambiguous legacy declarations.

Added explicit schema-1→2 pack and context-1→2 migrations using the `classic-v1` compatibility profile. Scenario-aware saves now emit envelope 10 with independent experience and simulation fingerprints; envelope 9 remains readable, surfaces a migration note, and re-exports as 10. Native state stays version 8. Existing engines retain their immutable construction profile when another pack becomes active.

Added a simulation-profile authoring CLI, schema-drift checks, deterministic custom-profile save/resume coverage, browser coverage for schema-2 export/capture, and read-only UI disclosure of the selected profile and compiled archetype.

## ECS M5 — composition cleanup

Replaced the load-order `Engine extends Engine` chain with one stable facade and an explicit systems → colony → world → village → planner → cartography composition root. Added a plain authoritative root state plus actor-scoped compatibility view, an inspectable fixed-step pipeline, and a compiled command router that rejects arbitrary dispatch. Historical imports and authored fixtures now use named construction boundaries. M4/M5 canonical scenario traces remain byte-identical.

## ECS M4 — economy, quests, and progression

Introduced `economy-ecs.js` as the single atomic settlement boundary for guide and creature wallets, shared research, player and actor XP, prestige, chapter completion, and selected progression statistics. Commands still authorize actions and the domain facade still owns physical goods, quest and market history, memories, logs, events, and presentation. Settlement IDs prevent duplicate rewards during the active runtime, while persistent chapter identifiers prevent chapter rewards from being replayed after save/import.

All direct coin, research, XP, and prestige mutations in `engine.js`, `systems.js`, `colony.js`, and `village-systems.js` now delegate to the economy settlement service. Market sale proceeds settle before staged goods are removed; adventure returns settle guide, pocket, research, XP, and prestige rewards together; failed authorizations and insufficient balances leave every financial and progression record unchanged.

Gameplay constants for level thresholds, level-up bonuses, income splitting, and settlement limits live in validated `content/economy-rules.json`. At M4, native v8 and portable envelope 9 remained unchanged because ECS components bind to existing records by reference. M6 retains native v8 and deliberately evolves scenario-aware envelopes to 10.

## ECS M2 — activity and movement

Moved authoritative path traversal and elapsed-work progression into named ECS systems. Current tasks are bound as transient `Task` components with an explicit `Intent` status; movement returns typed walking, arrived and blocked outcomes. Arrival does not spend work time in the same tick. The domain facade retains task selection, emergency interruption, construction payment and completion side effects. Added focused activity and real-engine parity tests without changing the then-current v8/v9 persistence boundary.

## ECS architecture follow-up

- Added a generic, DOM-free ECS world and deterministic scheduler with validated deferred structural changes.
- Moved creature needs decay, learning fatigue/hysteresis and baseline social decay from the colony loop into data-tuned actor systems.
- Preserved native v8 save records by binding ECS components to existing serialized actor records rather than adding shadow state; M6 later adds explicit envelope-9→10 context migration.
- Added standalone ECS and real-engine save/resume regression suites to the v15 verification gate.
- Kept the historical retained-contract hashes intact; the single intentional `colony.js` migration is explicitly documented and tested.
- Added `ECS-ARCHITECTURE.md` with ownership rules, target component model and staged extraction plan.

# v15 change log

## UI and interaction

Replaced the world-blocking Build and Tutorial workspaces with separate non-modal asides. Build has searchable researched blueprints, categories, one selected detail, an explicit builder and approach draft, physical-material/location explanations, and a separate placement step. Research and Planner remain one action away. Tutorial shows one editable, authored step, with selection, previous/next, Show me, minimize, resume and close.

Introduced a shared 4/8/12/16/24/32 spacing vocabulary, aligned dialog header/body/footer padding, consistent control heights, and small-screen reflow. Compact panels use 20-pixel desktop insets and 16-pixel mobile insets; the existing main workspaces use 24/16. Legacy CSS is not completely replaced.

Build and tutorial do not mark the world inert or add a full-screen scrim. Camera interaction remains available. F6 provides an explicit keyboard route between the panel and world. Pause-on-open behavior and manual pause remain independent. Actual resource use still belongs to the simulation.

Corrected builder/approach ownership: choosing a construction approach is a UI draft, not a mutation of the selected creature's defaults. The explicit builder receives the final placed plan even when it is not the first creature. Canceling placement adds no plan or charge. Catalog search and category persist through dismissal.

## Reusable experiences

Added a complete scenario-pack envelope containing worlds, starting scenes, presentation, tutorials, and all four existing content libraries. Added reversible validation, review/commit, capture-current-scene, JSON import/export, a local CLI and an external-pack build option. M5 scenario-aware saves used envelope 9. M6 now emits envelope 10 with context version 2 and a simulation profile; envelope 9 migrates explicitly. The underlying simulation remains format 8, and legacy geography remains preserved.

Littlewild and Emberworks are actual input packs. Emberworks changes material/ground colors, names, a shoreline template, resource density, tutorial copy and scene setup. It is also built and browser-tested as a standalone one-pack HTML.

World generation reads terrain, biome display names, resource counts and fixed sites from a profile. The new `reserved-sites` policy places authored sites before random nodes can occupy their coordinates. The legacy policy preserves the v14 generator for existing saves, including its original placement behavior. This is a scoped generation correction, not a balance rewrite of existing settlements.

## Retained mechanics

Autonomy, needs, research/XP, prestige, homes, connected islands, quests, tile jobs, production, physical inventories, market hauling, equipment, moods and relationships retain their core modules and command paths. All four default content libraries and schemas are unchanged. Some composition and geography files necessarily changed to load profiles.
