# Littlewild ECS architecture

## Goal

Refactor the Littlewild simulation from a deep `Engine extends Engine` inheritance chain into an explicit entity-component-system runtime without giving up the existing JSON-authored content, deterministic fixed-step simulation, or v8 native and v10 portable-story compatibility.

This migration is intentionally incremental. A rewrite would make it difficult to prove that movement, resource conservation, work, progression, and imported stories retained their behavior. Each slice therefore moves one authoritative rule into a system, adds parity tests, and then deletes the corresponding legacy rule.

## Architectural rules

1. **Entities are identities only.** Runtime entity IDs are stable domain IDs (`c1`, building IDs, node IDs, island IDs). Display names and array positions are never identities.
2. **Components are data only.** Components contain no callbacks, DOM references, timers, storage providers, or rendering objects. Serialized game records remain plain JSON.
3. **Systems own behavior.** Fixed-step mutation happens in named systems with an explicit phase and deterministic order. A system declares the components it requires.
4. **Content remains data driven.** Constants that define gameplay belong in validated JSON rule/content documents. JSON may select data and known handler IDs; it never supplies executable code.
5. **Commands are not systems.** Player/UI actions enter through validated domain commands. UI code does not mutate components directly.
6. **Presentation reads snapshots.** Rendering, labels, dialogs, camera state, frame interpolation, and wall-clock timing never become ECS inputs unless converted into an explicit gameplay command.
7. **Simulation time is authoritative.** The existing fixed-step clock remains outside the ECS. The scheduler receives a bounded simulation `dt`; frame rate never changes system order.
8. **Randomness is injected by domain systems.** Systems that need randomness receive an explicit deterministic stream/context. Rendering and queries never consume it.
9. **Structural changes are deferred.** Entity/component creation/removal cannot invalidate an active query. Deferred structural batches validate before application, and failed systems discard queued structure.
10. **Persistence is an adapter boundary.** ECS internals are not serialized by accident. During migration, components bind by reference to the existing save records. A future save-schema migration must be explicit and versioned.

## Runtime layers

```text
JSON content/scenario packs
        |
        v
Validated definitions + versioned rule profiles/archetypes   Device preferences
        |                                         |
        v                                         v
Application / commands  ---------------->  Presentation adapters
        |                                         ^
        v                                         |
Simulation facade                                Read models
        |
        +--> fixed-step clock boundary
        |
        v
ECS World  <---- component adapters ---- existing v8 records (authoritative native state)
        |
        v
System Scheduler
  pre -> decision -> movement -> work -> physiology -> economy -> post
        |
        v
Domain events / journal -> persistence / debrief / UI projections
```

The target removes the legacy subclass chain. `LW.Engine` eventually becomes a small composition root/facade rather than the owner of every rule.

## Entity model

Do not turn every record into an entity merely because ECS exists. An entity should have identity, lifecycle, and composition that benefits from independent systems.

| Entity | Candidate components |
|---|---|
| Creature | Transform, Needs, Learning, Feelings, Inventory, Equipment, Activity, Intent, Home, Adventure, Relationships |
| Building | Transform, BuildingDefinition, Storage, Worksite, Condition, HomeCapacity |
| Resource node | Transform, ResourceDeposit, HarvestPolicy |
| Market order | TradeOrder, Assignment, Transit, Settlement |
| Island | IslandCoordinate, GeographyProfile, Ownership |

Definitions such as recipes, skills, items, behavior-tree templates, and scenario profiles remain immutable resources/configuration, not entities.

## Implemented migration slices

M1 covers creature **Needs**, **Learning**, and **Feelings** updates. It also binds Transform and Inventory components so identity/lifecycle are explicit, while leaving their behavior in existing systems for now.

The adapter binds component stores to the exact nested actor objects already serialized today. There is no shadow component state and no ECS blob in exports. `Activity` is ephemeral, computed from current task plus an explicit, bounded snapshot of domain context. Existing `colony.js` retains its actor command permissions, task decisions, mood and stochastic temper checks. Only the migrated numerical decay/fatigue rules are removed from that legacy loop.

The compatibility values live in `source/content/actor-rules.json` and `source/content/economy-rules.json`. M6 publishes those exact values as the `standard` versioned rule profile. Scenario-pack schema 2 may select other validated numeric profiles without changing system implementations, scheduler order, native state or executable behavior.

Actor-major stepping and previous RNG call order remain unchanged: the existing shared-world loop visits the saved creature order and invokes ECS once for each present actor. System order within an actor is: daily practice reset; learning fatigue/hysteresis; social decay; needs decay. Legacy incident/decision/task code follows.

M2 adds explicit transient **Task** and **Intent** components and a second deterministic scheduler for activity progression. `task-movement` owns transform/path advancement; `task-work-progress` owns elapsed work time; the post phase records intent status. The legacy facade still creates tasks, applies interruption policy, authorizes construction costs, mirrors specialized progress records and invokes completion side effects. Arrival intentionally consumes no work time in the same tick, preserving the prior phase boundary. Blocked paths return a typed outcome to the facade rather than deleting tasks from inside a generic ECS system.

M3 adds `world-ecs.js` for physical ownership and production. Stable resource, inventory, worksite, harvest, carrier, and production identities are bound to the existing records. Deterministic systems settle transfers, finite depletion, reservations, worker claims, retries, and exactly-once output emission. The facade still chooses sources and recipes, performs skill checks, and owns rewards and narration.

M4 adds `economy-ecs.js` for atomic financial and progression settlement. Guide and actor wallets, shared research, player and actor levels, prestige, statistics, and chapter completion are updated as one transaction with rollback on failure. Domain commands still decide whether an action is allowed and what the reward means; the facade alone writes the ledger, histories, memories, logs, and presentation events. A validated `economy-rules.json` manifest owns level thresholds, level-up bonuses, income sharing, and bounded settlement limits.

M5 removes the runtime constructor-replacement chain. Feature modules register ordered descriptors with `engine-composition.js`, and `engine-composition-root.js` finalizes one stable facade in an explicit six-layer order. `actor-state-view.js` resolves personal fields by actor identity without adding getters to serialized root state. `simulation-pipeline.js` exposes the fixed-step world/actor phase order, while `command-router.js` provides a compiled allowlist for application commands and rejects arbitrary method dispatch. Historical import stages and authored fixtures use explicit partial-construction boundaries rather than global load order.

M6 adds `simulation-content.js` as the data-only compatibility boundary for versioned actor/economy rule profiles and known creature composition archetypes. Scenario-pack schema 2 selects a profile and archetype per scene; envelope 10 snapshots that exact selection. Retained schema-1 packs and envelope-9 experience contexts are fingerprinted and migrated explicitly to the canonical defaults. The selected services are engine-specific, transient, and never serialized into native state.

## Separation and ownership

| Owner | Allowed | Forbidden |
|---|---|---|
| `ecs.js` | Stable identity, component storage, structural buffer, query and scheduling primitives | Game content, story formats, rendering, business rules |
| `actor-ecs.js` | Actor components and physiological/social decay rules with validated tuning | Reading globals for selected creature, UI, RNG, work completion |
| `world-ecs.js` | Physical deposits, inventories, worksite jobs, reservations, transfers and exactly-once output settlement | Source selection, recipes, skill rolls, rewards, UI |
| `economy-ecs.js` | Atomic wallets, research, XP, prestige, statistics and chapter settlement with rollback and a neutral outbox | Authorization, physical goods, histories, logs, memories, presentation, RNG |
| `engine-composition.js` / root | Stable facade identity, explicit feature order, historical construction boundaries | Gameplay policy, persistence, UI |
| `simulation-pipeline.js` | Fixed-step world/actor orchestration and visible phase order | Domain calculations, rendering, wall clock |
| `command-router.js` | Compiled command allowlist, envelope validation, explicit actor routing | Arbitrary method dispatch, imported executable handlers |
| `simulation-content.js` | Versioned numeric rule profiles, known component-contract validation, engine-specific transient service installation | System registration, callbacks, new component types, persistence mutation |
| Actor state view and simulation adapters | Translate actor/root context; call ECS services; retain authorization, decision and presentation boundaries | Root-state accessors, duplicated migrated calculations or balances |
| Existing content registries | Definition parsing, ID/reference validation, immutable read tables | Executing imported callbacks |
| Application shell | Input/command dispatch, save/export orchestration, render scheduling | Authoritative gameplay calculations |
| Persistence | Existing v8 native state, v10 portable envelope, retained v1/v9 migration boundaries | Serialization of renderer objects, duplicated ECS caches or implicit profile guesses |

## Migration sequence and exit gates

- **M1 — ECS core + actor dynamics:** world, scheduler, rule manifest and legacy adapter; fixed-step unit tests; real-engine save/resume parity; unmodified four content-library schemas.
- **M2 — tasks, intents and movement (implemented):** explicit transient `Task`/`Intent`, deterministic path traversal, arrival/blocked outcomes and elapsed-work progression. Task selection, policy interruption, authorization and completion consequences remain explicit facade boundaries for M3/M4.
- **M3 — world simulation (implemented):** deposits, worksite inventories, production reservations/jobs, finite substrate use, carrier transfers, conservation, stable IDs and deterministic contention.
- **M4 — economy, quests and progression (implemented):** atomic wallets, research, XP, prestige, statistics and chapter settlement; authorization, physical goods, histories, journaling and presentation remain separate adapters.
- **M5 — composition cleanup (implemented):** one stable facade; explicit systems/colony/world/village/planner/cartography root; actor-scoped view over plain root data; fixed-step pipeline; compiled command router; no feature-module constructor replacement.
- **M6 — content/schema evolution (implemented):** scenario-pack schema 2; versioned actor/economy rule profiles; known creature composition archetypes; envelope 10; retained schema-1 and envelope-9 migrations; engine-specific transient selection. External JSON remains data only.

Each migration has an executable regression gate and a baseline trace for old-versus-new behavior, and must leave both Littlewild and Emberworks usable.

## Do not claim yet

M1–M6 do **not** make imported JSON executable or convert every mature mechanic method into a small standalone system. AI decision providers, quest/market history, construction consequences, narration, and presentation remain domain adapters on the stable facade. Composition archetype version 1 validates only the existing dependency-complete creature contract; it is not a general component-definition language. Direct command methods remain compatibility aliases while callers migrate to the explicit router. The migration also does not guarantee cross-platform bitwise float equality or provide a live multiplayer simulation.
