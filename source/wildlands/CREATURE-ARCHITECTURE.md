# Littlewild Creature Architecture

## Purpose

Creatures are authored as data, instantiated by an application service, simulated through ECS components, and rendered through independent actor assets. No creature JSON can register code, systems, callbacks, commands or modules.

## Ownership

| Concern | Owner | Persistent? |
| --- | --- | --- |
| Archetype identity, supported personalities, names, movement/physiology tuning, visual asset selection, RNG seed policy, actor defaults, spawn modes, ECS bindings | `docs/concepts/<game>/assets/creatures/<id>/definition.json (`creature` facet)` | Definition data |
| Personality traits, attributes and preferences | Adventure content | Definition data |
| Mutable needs, inventory, learning, feelings, equipment, RPG state, tasks, interaction events/cooldowns | Creature actor record | Yes |
| Paired invitations, duel rounds/history, catalog identity, participant cooldowns, trigger clocks and seek intents | Root `state.creatureInteractions` via `interaction-runtime.ts` and `interaction-triggers.ts` | Yes |
| `Creature`, `Activity`, `Intent` ECS projections | `actor-ecs.ts` | No |
| Construction of a new mutable actor from immutable definitions | `creature-factory.ts` | Application service |
| Geometry, rig, sockets, appearance, expression and animation tuning | `docs/concepts/<game>/assets/creatures/<id>/definition.json (`visual` facet)` | Presentation data |
| Animation algorithm and Three.js attachment behavior | `world-fidelity.ts` | No |
| Recruitment, social/quest orchestration and use-case sequencing | `colony.ts` | Application orchestration |

## Core patterns

1. **Immutable definitions, mutable state.** Catalog entries are deeply frozen. A factory always returns detached mutable state.
2. **Data-only trust boundary.** Creature manifests reject executable-shaped fields and unknown schema fields. Portable scenarios may carry validated creature and asset definitions in a scoped resource context; they cannot register executable capabilities.
3. **Reference-bound ECS.** Persistent component data remains owned by the actor record. ECS stores the same object references; transient projections never enter save data.
4. **Compiled systems, authored tuning.** JSON selects and tunes known capabilities. JSON never supplies arbitrary behavior code or system order.
5. **Presentation isolation.** Domain creature data never imports Three.js or asset code. Visual assets never own gameplay balances or progression.
6. **Deterministic creation.** Name selection and actor RNG seeds derive from explicit definition data and the deterministic roster sequence.
7. **Fail closed.** Runtime catalog validation mirrors the JSON schema and rejects unknown nested fields instead of silently ignoring them.

## Runtime flow

```text
definition.json creature facet
    ↓ validate + deep-freeze
LWCreatures
    ↓ seed(archetype, personality, mode, sequence)
LWCreatureFactory
    ↓ detached actor record
colony/application use cases
    ↓ bind by reference
LWActorECS
    ↓ deterministic systems
authoritative actor record

definition.json visual facet
    ↓ validate + deep-freeze
LWAssets
    ↓ appearance/expression/animation profile
LWFidelity
    ↓
Three.js scene
```

## ECS boundary

Persistent actor objects are the source of truth. The ECS owns deterministic progression, not a parallel save model.

Definition-bound components are declared by each creature manifest. The engine-required baseline is `Transform`, `Needs`, `Learning`, `Feelings` and `Inventory`; an archetype may add more object-valued components. `Creature`, `Activity` and `Intent` are transient engine projections. `Creature` carries the explicit archetype/personality pair used by systems, while persistent actor records remain the source of truth.

The ECS caches component references and reuses transient `Activity` records to avoid avoidable per-tick allocations while still detecting actor-record replacement by reference. Every archetype implements the required core actor fields and stable bindings (`Transform → creature`, `Needs → needs`, `Learning → learning`, `Feelings → feelings`, `Inventory → inventory`). An archetype may declare additional owned fields and object components. The catalog publishes the union of owned field names to the actor-scoped facade; it does not add absent extra fields to other archetypes or their saves. Extra fields cannot shadow shared world state. Binding an extra component does not register a new system.

## Folder discovery and defaults

`docs/concepts/<game>/assets/creatures/<id>/` co-locates gameplay and presentation manifests.
Their schema boundaries remain separate; visual manifests retain category `actor`.
`tools/bundled-assets.cts` discovers both collections for the build and regressions.
Every creature folder requires both manifests, matching folder IDs and a selected
visual asset supporting all declared personalities. No source registry branch is
needed to add a package.

The game folder's `assets/creatures/catalog.json` (validated by `catalog.schema.json` and runtime)
selects `defaultArchetype` explicitly. Sorting new folders never changes the
legacy default. The catalog configuration and creature definitions are frozen.
Changing this value changes newly created story founders; saved identities remain
explicit and recruitment accepts any supported pair.

## Adding another creature

1. Copy `docs/concepts/littlewild/assets/creatures/sproutling/` to a new safe lowercase ID.
2. Set the wrapper `id`, `creature.id`, `creature.state.defaults.archetype`, `visual.id` and normally
   `visualAsset` to that ID. Keep `visual.category` as `actor`.
3. Select supported personality IDs from Adventure content and set a supported
   `defaultPersonality` and matching default state. Personalities supply shared
   traits, attributes and preferences independently of species.
4. Edit the name pool, deterministic `rng.base`/`stride`, founder/arrival state and
   movement tuning. Keep all required persistent fields and component bindings.
5. Tune `physiology` multipliers (0–4) for food, water, energy, comfort, joy,
   fatigue, recovery, social and anger. Multipliers scale the existing authored
   actor rules; 1 preserves existing behavior and 0 disables the corresponding
   rate. No random calls or system order are added.
6. Add optional actor-owned defaults through `state.personalFields`; bind extra
   object state through `ecs.components` when useful. This creates reference-bound
   data, not an executable system. Every existing archetype keeps its own defaults.
7. Edit geometry/materials and appearance profiles in the `visual` facet. Keep required
   rig/socket handles valid in every selected model. The same compiled fidelity
   layer renders world actors and portraits using explicit archetype/personality.
8. To swap visuals, change `visualAsset` to another bundled package's asset ID.
   Its appearances must cover every supported personality. Gameplay ID, balances,
   state and saved identity remain the creature definition's ID.
9. To select this species for new story founders, change
   `assets/creatures/catalog.json.defaultArchetype`. Recruitment automatically
   exposes all valid pairs and `purchaseCreature(personality, archetype)` accepts
   an explicit species; existing gameplay prerequisites still apply.
10. Run `npm run typecheck`, `npm run architecture` and `npm run verify`.

The isolated second-archetype regression stages a Brookling package and uses the
actual discovery helper and untouched compiled modules. It verifies name/RNG and
arrival tuning, physiology, an extra Habitat ECS component, mesh identity, visual
reuse, recruitment, story encode/inspect/commit and deterministic continued ticks.
Changing the catalog default also creates a Brookling founder. Existing Sproutling
actors roundtrip without acquiring the optional Habitat field.

## Intentional constraints

Default creature archetypes and visual assets are bundled application content. Scenario packs and portable stories can carry complete validated creature and visual catalogs. They cannot inject new creature code, systems, renderer algorithms or loaders. Native actor state carries an explicit `{archetype, personality}` identity: archetype selects the creature contract and visual asset, while personality selects reusable Adventure traits, attributes and preferences. A personality may therefore be supported by multiple archetypes without coupling species identity to temperament.


New AI actions, handlers, morphology/animation programs and component systems still
require compiled engine capabilities and their regression coverage. Creature
packages configure the supported game rather than injecting arbitrary mechanics.
Removing or renaming an archetype used by a saved story is a compatibility change;
retain stable IDs or provide an explicit migration. Definition edits tune future
creation; saved mutable defaults are not retroactively rewritten on reload.

## Shared interactions

Player care, creature social intentions and exact-node gathering use the same interaction discovery/request boundary while delegating settlement to their established services. Authored friendly duel profiles and declarative trigger rules reserve both participants, obtain creature consent and run bounded actor-seeded 3d6 rounds. Paired state belongs to the world so a single lock and checkpoint covers both actors; their physiology and seeded RPG streams stay actor-owned. See [CREATURE-INTERACTIONS.md](CREATURE-INTERACTIONS.md) for authoring, settings, SDK requests and continuation guarantees.
