# ECS M5 — explicit composition and application boundaries

## Status

**Implemented.** M5 removes the load-order `Engine extends Engine` replacement chain and establishes one stable `LW.Engine` facade with an explicit composition root, actor-scoped state view, command router, and high-level simulation schedule.

## Composition root

`source/engine-composition-root.js` is the only module allowed to finalize simulation feature order:

1. `systems`
2. `colony`
3. `world-simulation`
4. `village`
5. `planner`
6. `cartography`

Feature modules register descriptors with `source/engine-composition.js`; they no longer assign `LW.Engine`. Finalization snapshots each predecessor contract so existing `super` calls retain their exact behavior, then installs the resulting methods onto the original facade. The public constructor identity therefore stays stable and its prototype has no runtime inheritance tower.

Explicit partial-construction boundaries remain available only for historical import stages and authored fixture factories. They reproduce the former v3/v5/v6/v7/v8 construction sequence without exposing load order as architecture.

## Authoritative state and actor view

`source/actor-state-view.js` provides a stable compatibility proxy for actor-scoped fields. The authoritative root remains a plain object in `engine.state`; `engine.s` resolves personal fields through the current actor identity while shared fields resolve directly to the root.

The root no longer receives dynamic getters/setters for `name`, `needs`, `inventory`, tasks, learning, feelings, or other personal records. Persistence, validation, tooling, and story inspection therefore see ordinary data without an active-actor mutation trap. Passing an actor view back into the facade unwraps the original root explicitly.

## Simulation schedule

`source/simulation-pipeline.js` owns the high-level fixed-step order:

| Order | Phase | Scope | Behavior owner |
|---:|---|---|---|
| 10 | clock | world | simulation pipeline |
| 20 | world | world | world simulation / world ECS |
| 30 | quest board | world | cartography |
| 40 | daily actor work | actor-major | colony |
| 50 | active quest | actor-major | adventure domain |
| 60 | actor simulation | actor-major | actor ECS and domain facade |

The pipeline orchestrates only. It does not implement needs, movement, production, economy, AI decisions, rewards, or presentation. Fixed-step bounds, actor order, day rollover, and RNG call order are retained.

## Command boundary

`source/command-router.js` publishes a compiled, immutable allowlist of application commands. A command envelope contains only a known command ID, optional explicit actor ID, and bounded data arguments. Unknown fields, executable values, malformed actors, and arbitrary method names fail closed without mutation.

Actor commands execute through `commandActor`; world commands invoke their named domain handler. Existing direct methods remain compatibility adapters for the current UI and historical tests, but new application integrations have one explicit dispatch boundary. Imported JSON cannot register handlers or executable behavior.

## Preserved contracts

- Simulation state remains version 8; portable stories remain envelope 9.
- ECS services, composition descriptors, command manifests, pipelines, and actor views are transient.
- Littlewild and Emberworks use the same mechanics and schemas.
- Existing static import migrations still validate through each historical format.
- Authored workshop, colony, and world factories retain exact M4 initial and 25-second continuation snapshots.
- Renderer, camera, wall clock, file I/O, and DOM state remain outside simulation inputs.

## Removed debt

- No feature module declares `class Engine extends ...`.
- No feature module assigns `LW.Engine`.
- No actor property accessors are installed on serialized root state.
- Demo and migration construction no longer depends on whichever module last replaced a global constructor.
- Public command dispatch no longer accepts arbitrary method names.
- The shared clock and actor-major order are visible as one inspectable schedule.

## Deliberate compatibility debt

Large historical mechanic methods remain in their existing feature files and are installed onto the stable facade. M5 removes composition and state-ownership ambiguity; it does not rewrite mature domain rules merely to reduce file size. Direct command methods remain until UI/application callers can migrate incrementally to `dispatchCommand` without changing behavior.
