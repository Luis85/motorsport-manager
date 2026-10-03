# Littlewild ECS architecture

## Goal

Refactor the Littlewild simulation from a deep `Engine extends Engine` inheritance chain into an explicit entity-component-system runtime without giving up the existing JSON-authored content, deterministic fixed-step simulation, or native-v8 state compatibility. Scenario-aware stories use envelope 10 with a versioned simulation profile; obsolete scenario/story formats are rejected.

This migration is intentionally incremental. A rewrite would make it difficult to prove that movement, resource conservation, work, progression, and imported stories retained their behavior. Each slice therefore moves one authoritative rule into a system, adds parity tests, and then deletes the corresponding legacy rule.

## TypeScript and bounded contexts

All project-authored executable Littlewild code is TypeScript (`.ts` / `.cts`). The standalone still executes ordinary JavaScript because the build compiles TypeScript into the ignored `.generated/` directory before bundling. The only authored-tree JavaScript retained is third-party `vendor/three.js`; JSON, CSS, and HTML remain data/presentation assets rather than executable project source.

`source/architecture/domain-map.json` is the machine-readable DDD ownership contract. It assigns every top-level runtime module exactly once to **simulation core**, **actors**, **physical world**, **economy/progression**, **content model**, **simulation application**, **experience application**, **persistence/clock infrastructure**, or **presentation**. CI fails for unowned/duplicate runtime modules, inward-layer violations, platform dependencies in domain/application code, executable-shaped scenario data, or reintroduction of authored JavaScript/Python executables.

The current architecture deliberately retains a stable legacy-compatible `LW.Engine` facade and process-global registries. Those are compatibility adapters around the bounded contexts, not the target domain model. Large historical modules such as `engine.ts` and `colony.ts` remain migration debt protected by regression fixtures; they are not described as exemplary small-module Clean Code.

## Architectural rules

1. **Entities are identities only.** Runtime entity IDs are stable domain IDs (`c1`, building IDs, node IDs, island IDs). Display names and array positions are never identities.
2. **Components are data only.** The ECS kernel rejects nested functions, accessors, class instances, symbols, cycles, and non-finite numbers. Components contain no callbacks, DOM references, timers, storage providers, or rendering objects. Serialized game records remain plain data.
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
ECS World  <---- component adapters ---- native v8 state records
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

The adapter binds component stores to the exact nested actor objects already serialized today. There is no shadow component state and no ECS blob in exports. `Activity` is ephemeral, computed from current task plus an explicit, bounded snapshot of domain context. Existing `colony.ts` retains its actor command permissions, task decisions, mood and stochastic temper checks. Only the migrated numerical decay/fatigue rules are removed from that legacy loop.

Authoritative compatibility values live in `source/content/simulation-profile.json`, which contains the validated actor and economy rule documents plus the exact compiled `living-world-v1` composition archetype. Scenario schema 2 requires a complete profile; schema 1 packs are rejected. A profile may tune bounded actor/economy numbers, but its engine layers, fixed-step phases and transaction-system lists must exactly match the compiled runtime. JSON cannot add, remove, reorder or implement systems.

Actor-major stepping and previous RNG call order remain unchanged: the existing shared-world loop visits the saved creature order and invokes ECS once for each present actor. System order within an actor is: daily practice reset; learning fatigue/hysteresis; social decay; needs decay. Legacy incident/decision/task code follows.

M2 adds explicit transient **Task** and **Intent** components and a second deterministic scheduler for activity progression. `task-movement` owns transform/path advancement; `task-work-progress` owns elapsed work time; the post phase records intent status. The legacy facade still creates tasks, applies interruption policy, authorizes construction costs, mirrors specialized progress records and invokes completion side effects. Arrival intentionally consumes no work time in the same tick, preserving the prior phase boundary. Blocked paths return a typed outcome to the facade rather than deleting tasks from inside a generic ECS system.

M3 adds `world-ecs.ts` for physical ownership and production. Stable resource, inventory, worksite, harvest, carrier, and production identities are bound to the existing records. Deterministic systems settle transfers, finite depletion, reservations, worker claims, retries, and exactly-once output emission. The facade still chooses sources and recipes, performs skill checks, and owns rewards and narration.

M4 adds `economy-ecs.ts` for atomic financial and progression settlement. Guide and actor wallets, shared research, player and actor levels, prestige, statistics, and chapter completion are updated as one transaction with rollback on failure. Domain commands still decide whether an action is allowed and what the reward means; the facade alone writes the ledger, histories, memories, logs, and presentation events. A validated `economy-rules.json` manifest owns level thresholds, level-up bonuses, income sharing, and bounded settlement limits.

M5 removes the runtime constructor-replacement chain. Feature modules register ordered descriptors with `engine-composition.ts`, and `engine-composition-root.ts` finalizes one stable facade in an explicit six-layer order. `actor-state-view.ts` resolves personal fields by actor identity without adding getters to serialized root state. `simulation-pipeline.ts` exposes the fixed-step world/actor phase order, while `command-router.ts` provides a compiled allowlist for application commands and rejects arbitrary method dispatch. Historical import stages and authored fixtures use explicit partial-construction boundaries rather than global load order.

M6 adds `simulation-profile.ts` as the explicit simulation content boundary. Scenario schema 2 carries a self-contained, fingerprinted simulation profile. Engines capture an immutable validated profile at construction, and actor/economy runtimes use that captured data rather than whichever profile is globally active later. Portable scenario stories use envelope 10 with context version 2 and an independent simulation fingerprint; envelope 9 imports are rejected. Native state remains version 8.

## Separation and ownership

| Owner | Allowed | Forbidden |
|---|---|---|
| `ecs.ts` | Stable identity, component storage, structural buffer, query and scheduling primitives | Game content, story formats, rendering, business rules |
| `actor-ecs.ts` | Actor components and physiological/social decay rules with validated tuning | Reading globals for selected creature, UI, RNG, work completion |
| `world-ecs.ts` | Physical deposits, inventories, worksite jobs, reservations, transfers and exactly-once output settlement | Source selection, recipes, skill rolls, rewards, UI |
| `economy-ecs.ts` | Atomic wallets, research, XP, prestige, statistics and chapter settlement with rollback and a neutral outbox | Authorization, physical goods, histories, logs, memories, presentation, RNG |
| `engine-composition.ts` / root | Stable facade identity, explicit feature order, historical construction boundaries | Gameplay policy, persistence, UI |
| `simulation-pipeline.ts` | Fixed-step world/actor orchestration and visible phase order | Domain calculations, rendering, wall clock |
| `command-router.ts` | Compiled command allowlist, envelope validation, explicit actor routing | Arbitrary method dispatch, imported executable handlers |
| `simulation-profile.ts` | Strict bounded profile parsing, actor/economy rule validation, immutable profile identity, compiled-archetype parity | Dynamic modules, callbacks, handler registration, system insertion/reordering |
| Actor state view and simulation adapters | Translate actor/root context; call ECS services; retain authorization, decision and presentation boundaries | Root-state accessors, duplicated migrated calculations or balances |
| Existing content registries | Definition parsing, ID/reference validation, immutable read tables | Executing imported callbacks |
| Application shell | Input/command dispatch, save/export orchestration, render scheduling | Authoritative gameplay calculations |
| Persistence | Native v8 state, envelope 10 scenario context, explicit obsolete-format rejection | Serialization of renderer objects or duplicated ECS caches |

## Migration sequence and exit gates

- **M1 — ECS core + actor dynamics:** world, scheduler, rule manifest and legacy adapter; fixed-step unit tests; real-engine save/resume parity; unmodified four content-library schemas.
- **M2 — tasks, intents and movement (implemented):** explicit transient `Task`/`Intent`, deterministic path traversal, arrival/blocked outcomes and elapsed-work progression. Task selection, policy interruption, authorization and completion consequences remain explicit facade boundaries for M3/M4.
- **M3 — world simulation (implemented):** deposits, worksite inventories, production reservations/jobs, finite substrate use, carrier transfers, conservation, stable IDs and deterministic contention.
- **M4 — economy, quests and progression (implemented):** atomic wallets, research, XP, prestige, statistics and chapter settlement; authorization, physical goods, histories, journaling and presentation remain separate adapters.
- **M5 — composition cleanup (implemented):** one stable facade; explicit systems/colony/world/village/planner/cartography root; actor-scoped view over plain root data; fixed-step pipeline; compiled command router; no feature-module constructor replacement.
- **M6 — content/schema evolution (implemented):** scenario schema 2 requires a versioned simulation profile; actor/economy rules are bounded data; `living-world-v1` arrays are exact compiled contracts; schema-1 packs and envelope-9 stories are rejected; scenario saves emit envelope 10 with an independent profile fingerprint.

Each migration has an executable regression gate and a baseline trace for old-versus-new behavior, and must leave both Littlewild and Emberworks usable.

## Do not claim yet

M1–M6 do **not** make imported JSON executable or convert every mature mechanic method into a small standalone system. AI decision providers, quest/market history, construction consequences, narration, and presentation remain domain adapters on the stable facade. Direct command methods remain compatibility aliases while callers migrate to the explicit router. The migration also does not guarantee cross-platform bitwise float equality or provide a live multiplayer simulation.
