# Littlewild Creature Architecture

## Purpose

Creatures are authored as data, instantiated by an application service, simulated through ECS components, and rendered through independent actor assets. No creature JSON can register code, systems, callbacks, commands or modules.

## Ownership

| Concern | Owner | Persistent? |
| --- | --- | --- |
| Archetype identity, supported personalities, names, movement tuning, RNG seed policy, actor defaults, spawn modes, ECS bindings | `source/creatures/<id>/creature.json` | Definition data |
| Personality traits, attributes and preferences | Adventure content | Definition data |
| Mutable needs, inventory, learning, feelings, equipment, RPG state, tasks | Creature actor record | Yes |
| `Creature`, `Activity`, `Intent` ECS projections | `actor-ecs.ts` | No |
| Construction of a new mutable actor from immutable definitions | `creature-factory.ts` | Application service |
| Geometry, rig, sockets, appearance, expression and animation tuning | `source/assets/actors/<id>/asset.json` | Presentation data |
| Animation algorithm and Three.js attachment behavior | `world-fidelity.ts` | No |
| Recruitment, social/quest orchestration and use-case sequencing | `colony.ts` | Application orchestration |

## Core patterns

1. **Immutable definitions, mutable state.** Catalog entries are deeply frozen. A factory always returns detached mutable state.
2. **Data-only trust boundary.** Creature manifests reject executable-shaped fields and unknown schema fields. Imported scenarios cannot register creature archetypes or assets.
3. **Reference-bound ECS.** Persistent component data remains owned by the actor record. ECS stores the same object references; transient projections never enter save data.
4. **Compiled systems, authored tuning.** JSON selects and tunes known capabilities. JSON never supplies arbitrary behavior code or system order.
5. **Presentation isolation.** Domain creature data never imports Three.js or asset code. Visual assets never own gameplay balances or progression.
6. **Deterministic creation.** Name selection and actor RNG seeds derive from explicit definition data and the deterministic roster sequence.
7. **Fail closed.** Runtime catalog validation mirrors the JSON schema and rejects unknown nested fields instead of silently ignoring them.

## Runtime flow

```text
creature.json
    ↓ validate + deep-freeze
LWCreatures
    ↓ seed()
LWCreatureFactory
    ↓ detached actor record
colony/application use cases
    ↓ bind by reference
LWActorECS
    ↓ deterministic systems
authoritative actor record

actor asset.json
    ↓ validate + deep-freeze
LWAssets
    ↓ appearance/expression/animation profile
LWFidelity
    ↓
Three.js scene
```

## ECS boundary

Persistent actor objects are the source of truth. The ECS owns deterministic progression, not a parallel save model.

Definition-bound components are declared by each creature manifest. The engine-required baseline is `Transform`, `Needs`, `Learning`, `Feelings` and `Inventory`; an archetype may add more object-valued components. `Creature`, `Activity` and `Intent` are transient engine projections.

The ECS caches component references and reuses transient `Activity` records to avoid avoidable per-tick allocations while still detecting actor-record replacement by reference.

## Adding another creature

1. Add `source/creatures/<id>/creature.json` using `creature.schema.json`.
2. Assign globally unique personality IDs already defined in Adventure content, or add the matching Adventure definitions.
3. Define all actor-scoped defaults and founder/arrival overrides.
4. Declare ECS component bindings. Do not add callbacks or system names as executable behavior.
5. Add `source/assets/actors/<id>/asset.json` with the shared creature ID.
6. Provide the engine rig/socket contract, an appearance for every supported personality, expression thresholds and animation tuning.
7. Run `npm run typecheck`, `npm run architecture` and `npm run verify`.

## Intentional constraints

Creature archetypes and visual assets are bundled trusted application content. Scenario packs may select/tune supported simulation content but cannot inject new creature code, systems or renderer assets. Personality IDs are currently globally unique across bundled archetypes, which keeps existing roster and UI contracts deterministic without introducing a second polymorphic identity into native state.
