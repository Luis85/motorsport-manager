## ECS M5 — composition cleanup

Replaced the load-order `Engine extends Engine` chain with one stable facade and an explicit systems → colony → world → village → planner → cartography composition root. Added a plain authoritative root state plus actor-scoped compatibility view, an inspectable fixed-step pipeline, and a compiled command router that rejects arbitrary dispatch. Historical imports and authored fixtures now use named construction boundaries. M4/M5 canonical scenario traces remain byte-identical.

## ECS M4 — economy, quests, and progression

Introduced `economy-ecs.js` as the single atomic settlement boundary for guide and creature wallets, shared research, player and actor XP, prestige, chapter completion, and selected progression statistics. Commands still authorize actions and the domain facade still owns physical goods, quest and market history, memories, logs, events, and presentation. Settlement IDs prevent duplicate rewards during the active runtime, while persistent chapter identifiers prevent chapter rewards from being replayed after save/import.

All direct coin, research, XP, and prestige mutations in `engine.js`, `systems.js`, `colony.js`, and `village-systems.js` now delegate to the economy settlement service. Market sale proceeds settle before staged goods are removed; adventure returns settle guide, pocket, research, XP, and prestige rewards together; failed authorizations and insufficient balances leave every financial and progression record unchanged.

Gameplay constants for level thresholds, level-up bonuses, income splitting, and settlement limits live in validated `content/economy-rules.json`. Existing v8 state and v9 portable-story formats remain unchanged because ECS components continue to bind to the existing records by reference.

## ECS M2 — activity and movement

Moved authoritative path traversal and elapsed-work progression into named ECS systems. Current tasks are bound as transient `Task` components with an explicit `Intent` status; movement returns typed walking, arrived and blocked outcomes. Arrival does not spend work time in the same tick. The domain facade retains task selection, emergency interruption, construction payment and completion side effects. Added focused activity and real-engine parity tests without changing v8/v9 persistence.

## ECS architecture follow-up

- Added a generic, DOM-free ECS world and deterministic scheduler with validated deferred structural changes.
- Moved creature needs decay, learning fatigue/hysteresis and baseline social decay from the colony loop into data-tuned actor systems.
- Preserved v8/v9 save records by binding ECS components to existing serialized actor records rather than adding shadow state.
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

Added a complete scenario-pack envelope containing worlds, starting scenes, presentation, tutorials, and all four existing content libraries. Added reversible validation, review/commit, capture-current-scene, JSON import/export, a local CLI and an external-pack build option. New scenario-aware saves use envelope 9; their underlying simulation remains format 8. Legacy stories remain readable without inventing a different geography.

Littlewild and Emberworks are actual input packs. Emberworks changes material/ground colors, names, a shoreline template, resource density, tutorial copy and scene setup. It is also built and browser-tested as a standalone one-pack HTML.

World generation reads terrain, biome display names, resource counts and fixed sites from a profile. The new `reserved-sites` policy places authored sites before random nodes can occupy their coordinates. The legacy policy preserves the v14 generator for existing saves, including its original placement behavior. This is a scoped generation correction, not a balance rewrite of existing settlements.

## Retained mechanics

Autonomy, needs, research/XP, prestige, homes, connected islands, quests, tile jobs, production, physical inventories, market hauling, equipment, moods and relationships retain their core modules and command paths. All four default content libraries and schemas are unchanged. Some composition and geography files necessarily changed to load profiles.
