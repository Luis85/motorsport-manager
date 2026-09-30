# Littlewild ECS architecture

## Goal

Refactor the Littlewild simulation from a deep `Engine extends Engine` inheritance chain into an explicit entity-component-system runtime without giving up the existing JSON-authored content, deterministic fixed-step simulation, or v8/v9 story compatibility.

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
Validated definitions + rule manifests      Device preferences
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
ECS World  <---- component adapters ---- existing v8/v9 records (migration period)
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

## First migration slice

The first authoritative ECS slice covers creature **Needs**, **Learning**, and **Feelings** updates. It also binds Transform and Inventory components so identity/lifecycle are explicit, while leaving their behavior in existing systems for now.

The adapter binds component stores to the exact nested actor objects already serialized today. There is no shadow component state and no ECS blob in exports. `Activity` is ephemeral, computed from current task plus an explicit, bounded snapshot of domain context. Existing `colony.js` retains its actor command permissions, task decisions, mood and stochastic temper checks. Only the migrated numerical decay/fatigue rules are removed from that legacy loop.

Authoritative initial rule values live in `source/content/actor-rules.json`, loaded in Node and embedded in the standalone HTML. They reproduce the current constants; they are not silently overridable by a scene pack. Future per-pack overrides require a separately versioned manifest and save compatibility design.

Actor-major stepping and previous RNG call order remain unchanged: the existing shared-world loop visits the saved creature order and invokes ECS once for each present actor. System order within an actor is: daily practice reset; learning fatigue/hysteresis; social decay; needs decay. Legacy incident/decision/task code follows.

## Separation and ownership

| Owner | Allowed | Forbidden |
|---|---|---|
| `ecs.js` | Stable identity, component storage, structural buffer, query and scheduling primitives | Game content, story formats, rendering, business rules |
| `actor-ecs.js` | Actor components and physiological/social decay rules with validated tuning | Reading globals for selected creature, UI, RNG, work completion |
| Legacy colony adapter | Translate legacy actor state/context; call ECS; retain unmigrated commands/tasks | Duplicate migrated needs/fatigue formulas |
| Existing content registries | Definition parsing, ID/reference validation, immutable read tables | Executing imported callbacks |
| Application shell | Input/command dispatch, save/export orchestration, render scheduling | Authoritative gameplay calculations |
| Persistence | Existing v8 state and v9 portable envelope, versioned migrations | Serialization of renderer objects or duplicated ECS caches |

## Migration sequence and exit gates

- **M1 — ECS core + actor dynamics:** world, scheduler, rule manifest and legacy adapter; fixed-step unit tests; real-engine save/resume parity; unmodified four content-library schemas.
- **M2 — tasks, intents and movement:** move activity lifecycle, path progress, interruptions and `Task`/`Intent` into explicit systems. Separate AI decision generation from movement and completion. Require physical logistics/task ownership parity.
- **M3 — world simulation:** migrate deposits, worksite inventories, production and carrier transfers. Verify conservation, exactly-once task completion, stable IDs and deterministic multi-actor conflicts.
- **M4 — economy, quests and progression:** split authorization, settlement, rewards, presentation and journaling. Keep declarative behavior trees as decision providers, not ECS data mutators.
- **M5 — composition cleanup:** replace extension chain (`systems.js`, `colony.js`, `world-simulation.js`, `village-systems.js`) with a thin facade, command handlers and scheduled domain systems. Remove legacy actor property proxies only when all callers use explicit IDs and views.
- **M6 — content/schema evolution:** publish optional versioned ECS rule profiles and composition archetypes in scenario packs; migrate story snapshots deliberately. Never infer executable behavior from external JSON.

Each migration has an executable regression gate and a baseline trace for old-versus-new behavior, and must leave both Littlewild and Emberworks usable.

## Do not claim yet

M1 does **not** make the whole game ECS. Quest, task completion, construction, physical logistics, market, progression and most command handlers still use existing domain classes. It also does not make all mechanics arbitrarily extensible via imported JSON, guarantee cross-platform bitwise float equality, or provide a live multiplayer simulation.