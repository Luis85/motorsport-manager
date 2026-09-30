# Littlewild ECS architecture — migration decision (PR #26, stacked on PR #25)

**Status:** first playable migration slice in progress; this document distinguishes implemented behavior from target architecture.  
**Scope:** `docs/concepts/littlewild/`, the offline JavaScript/Three.js concept. It does **not** refactor the repository's native Godot Motorsport Manager.

## 1. Verified starting point and problems addressed

PR #25 publishes v15 as a single-file offline browser prototype with authored modules and Littlewild/Emberworks scenario packs. Its published checks and hashes describe **v15**, not this work-in-progress branch.

The current simulation adds features through a deep `Engine` inheritance chain:
`engine.js → systems.js → colony.js → world-simulation.js → village-systems.js`, with further validation and planning wrappers. `colony.js` temporarily exposes the selected actor through `s.*` property aliases and switches `_actor` while processing creatures. World rules, daily updates, actor physiology, AI decisions, movement, work execution and consequences are interleaved. Other large modules (`ui.js`, rendering and the world) cross several responsibilities, although the existing engine is already separate from DOM and the simulation has a fixed-step presentation clock.

This creates concrete risks: fragile `super` extension order, implicit actor context, difficulty unit-testing one rule without the whole inheritance tree, global mutable registries, and duplicated logic when another agent type is introduced. It is **not** evidence that v15 simulation correctness failed; the aim is a maintainable composition model and simpler future feature development.

## 2. Architectural decision

Use a small **composition-oriented ECS for simulation state and behavior**, while retaining specialized bounded services outside ECS. ECS is an organization boundary, not a blanket instruction to put every UI screen, schema validator, source file and content definition into entities.

- **Entity**: stable, opaque ID. No behavior. Initial actor IDs reuse canonical v8 IDs; never renumber an existing creature based on array position, selection or display name.
- **Component**: serializable data only. Distinct components for transform, needs, learning, social state and inventory. Future components include activity, navigation, ownership, work orders, building storage, resource deposits and market commitments.
- **System**: one defined simulation responsibility with declared read/write components and explicit execution phase. No DOM, storage, file I/O, `Math.random`, or access to an unrestricted engine singleton.
- **World/context**: entity/component stores plus registered systems. Game-specific read-only rules, RNG streams and world services are injected as explicit context. The present bridge deliberately shares canonical save objects rather than maintaining an eventually-consistent mirror.
- **Commands**: planned input boundary. Validation and authorization occur before gameplay mutation; accepted commands target stable entity IDs. Rejected commands are no-ops. Structural changes during systems are prohibited until a tested deferred command buffer is introduced.
- **Events**: planned immutable consequences of accepted commands and simulated changes, not commands disguised as notifications. UI, history and sound may observe events but must not modify the simulation.
- **Presentation**: renderer and UI consume read-only projections of current simulation data; only an application controller invokes validated commands.

Keep the existing authored content libraries and scenario pack formats. **Rules are configurable data, handlers are compiled code.** JSON never carries executable callbacks. The new `source/content/actor-model.json` extracts existing physiological coefficients without modifying the v15 four-library portable-save contract; scenario-pack overrides for this fifth rules family require a future validated pack/schema/version extension.

## 3. Implemented first slice

| Part | Implemented behavior | Deliberate boundary |
|---|---|---|
| `ecs.js` | Stable IDs, per-component stores, deterministic actor-major queries, ordered phases, declared reads/writes, guard against mid-phase structural edits | Not yet an archetype/SoA or parallel scheduler; no speculative performance claim |
| `actor-systems.js` | Legacy-record adapter; explicit actor components; separate fatigue, social and needs systems | Activity is a read-only pointer snapshot; task ownership is still legacy |
| `actor-model.json` | Versioned, validated tuning data for the extracted physiological rules | Not yet overridable in v15 scenario pack schema |
| `colony.js` | Calls those systems during the existing actor step; exposes `actorEcs` for headless checks | Legacy AI, activity dispatch, movement and other effects remain |
| `build.py`, `index.html`, `simulation.cjs` | Both offline browser and Node paths load the same modules and tuning model | The previously published v15 standalone and publication hashes are kept as historical evidence |
| `test-ecs.cjs` | Ordering, ownership, lifecycle, model bounds, literal old/new equation parity, engine save/load continuation | Browser/hardware validation remains a separate release gate |

The bridge owns **no second copy** of `needs`, `learning`, `feelings`, `inventory` or `creature`: their stores hold the same objects already serialized by the established v8 state. The adapter replaces the transient Activity snapshot when the legacy task pointer changes. New companions are discovered by ID; departed companions are removed. Existing save envelopes still persist only canonical gameplay state.

## 4. Target boundaries

| Module/family | Owns | Must not own |
|---|---|---|
| ECS core | Identity, stores, queries, scheduling, lifecycle rules | Game vocabulary, economy, DOM or serialization format |
| Content/configuration | Authored immutable definitions, ID/reference validation, version/hash | Live inventory, actor execution or arbitrary executable handlers |
| Simulation orchestration | Fixed tick, command ordering, RNG streams, phase boundaries | View refresh, camera animation or storage I/O |
| Actor simulation | Needs, learning, social state, movement/AI behavior and activity data as separate systems | UI selection, file writes or another actor's private context |
| World simulation | Deposits, topology reference, buildings, production and physical transfer conservation | Per-frame rendering or cinematic world events |
| Work/commerce | Plans, reservations, permissions, accounting and exactly-once settlement | Renderer updates, duplicated stock ledgers or invisible items |
| Persistence adapter | Versioned save schema, migration, full-state validation, atomic replacement | Decisions, time progression, randomization or silent repair of unknown state |
| Presentation adapters | Read-only projected actor/world state; input intent construction | Authoritative computation, RNG or direct component writes |
| App shell | Pause/speed input, scene bootstrap, UI navigation, import confirmation | Simulation mechanics or hardcoded dependencies between ECS systems |

**Important:** save state, content definitions and derived UI view-models are three different data families. Never use a renderer's cached transform, a UI selection, or an estimated forecast as an authoritative world component.

## 5. Required ordering, determinism and replay rules

Current behavior must remain unchanged during migration:
1. one fixed simulation timestep; only simulation ticks change gameplay state
2. shared world progression and quest-board work execute once, not once per creature
3. actors execute in their established stable order; active quest processing remains exclusive
4. within each active actor, fatigue/recovery → social recovery → basic needs, followed by the existing warning/decision/activity code
5. UI inspection, scenario previews, animation frames and save/export must never advance the world or consume live RNG
6. a refused command, failed import, dismissed dialog or unloaded scene cannot commit partial gameplay state.

The first ECS scheduler intentionally runs **actor-major** to preserve legacy results. Do not globally reorder all needs updates before all AI decisions until a dedicated test campaign establishes the change and a versioned determinism contract is recorded. Display interpolation remains in presentation and separate from simulation. Maintain separate seeded streams when migrating future random subsystems; do not introduce incidental `Math.random()`.

## 6. Remaining migrations (dependency order)

**ECS-02 — Activities and navigation.** Represent task phases, target and route as explicit components. Move movement and path invalidation into systems; keep cancellation and work reservation atomic. Replace `s.task` aliases last. Compare interrupted work, failed routes, carried goods and save continuation across old/new implementations.

**ECS-03 — Physical world and workplace.** Introduce resource-deposit, building-storage, production-job, hauling-intent and reservation components. Enforce one owner for every quantity. Apply transfers only at valid destinations; check capacity and cancellation. This removes the need for subclass overrides in `world-simulation.js`.

**ECS-04 — Economy, quests and progression.** Move event triggers, task settlement, market obligations, quest work and progression into individually testable systems using stable IDs and explicit dependencies; no UI-driven consequence changes. Preserve public/private information and legacy-world migration paths.

**ECS-05 — Input and event boundary.** Add typed, validated commands and a deterministic deferred structural-command buffer with phase-boundary commits. Keep UI drafts separate from committed intents. Introduce a versioned event journal that supports causality, debugging and replay experiments without rerolling live outcomes.

**ECS-06 — Persistence and content generalization.** When migrated entities have full ownership, introduce a versioned ECS snapshot and deterministic v8/v9 adapters. Extend scenario schema explicitly for configurable actor-model profiles and compiled capability binding. Keep legacy imports supported via meaningful deterministic migrations; reject unknown incompatible states.

**ECS-07 — Presentation/engine cleanup.** Replace direct `engine.s` reads with bounded projections where they risk mutation; split `ui.js` by app shell/use case; unify simulation bootstrapping and runtime injection. Retain the original art direction, panel interaction and Three.js independence.

## 7. Performance and quality rules

Do not claim ECS itself makes Littlewild faster. Today's actor counts are small, and Map-based ECS has overhead. Profile fixed-step cost, component query allocation, active actor count, AI decisions, scene rendering and save size **before** proposing SoA arrays, archetypes, workers or parallelism. Keep DOM and 3D work off the simulation critical path.

Acceptance gates for each migrated responsibility: deterministic headless fixtures; old/new behavioral parity or documented intentionally versioned change; legacy saves and custom scenario compatibility; invariant checks including rejected commands; regression tests across growth, logistics and quest flows; offline standalone build; keyboard/pause/focus/browser interaction checks. A release/publication fingerprint belongs to the artifact actually built and verified, never to an earlier version.

## 8. Reference patterns

The design follows the standard ECS separation of identity/data/behavior and explicit system schedules. The existing fixed-step clock is preserved instead of linking simulation time to render cadence. See Bevy ECS documentation, Unity Entities ECS concepts and Glenn Fiedler's *Fix Your Timestep!* for general engineering patterns. These sources are architecture references, not evidence that this specific prototype has reached full ECS migration.
