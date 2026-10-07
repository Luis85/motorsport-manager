# Creature assets

Creature packages live together under a game folder's `assets/creatures/`
(Littlewild: `docs/concepts/littlewild/assets/creatures/`):

```text
assets/creatures/
  catalog.json
  editor-fields.json
  sproutling/
    definition.json
```

Their grammars, `catalog.schema.json` and `creature.schema.json`, stay here in the
engine.

The `creature` facet of `definition.json` owns gameplay identity, supported Adventure personalities, names,
spawn modes, movement, physiology multipliers, persistent defaults and ECS
bindings. Its `visual` facet owns geometry, materials, appearances, rig/socket names,
expression thresholds and animation tuning. Its runtime category remains `actor`.
The gameplay definition's `visualAsset` selects a bundled actor asset; it usually
matches the folder ID but may reuse another package's visual asset.

`catalog.json` explicitly selects the default archetype. Adding a folder never
changes the default through alphabetical discovery order. The wrapper and projected facets repeat
their folder identity; missing files, identity mismatches and unsupported visual
profiles fail the build. Runtime catalogs independently validate and freeze data.

Copy a package, update its wrapper and facet IDs and `state.defaults.archetype`, set `visualAsset`,
and edit its data. Use an existing Adventure personality or author that shared
content separately. Set `catalog.defaultArchetype` to change new story founders;
recruitment lists every supported archetype/personality pair. Existing actors keep
their saved identity, independent state and RNG stream.

Physiology multipliers (0–4) scale existing deterministic needs, fatigue/recovery,
social and anger systems; 1 preserves standard behavior and 0 disables that rate.
Additional object-valued defaults can be actor-owned fields and bound ECS
components. Core fields and bindings remain required, and extra fields cannot
shadow shared world state. Extra components alone do not install new systems.

Run `npm run typecheck`, `npm run architecture` and `npm run verify` after edits.
The creature regression adds a second package in an isolated temporary assets
folder and verifies discovery, factory state, extra ECS bindings, physiology,
rendered identity, recruitment, story roundtrip and deterministic resumed ticks.

Definitions are trusted bundled data. Scenario/story imports can carry validated
portable creature and visual catalogs; they cannot register renderer programs or
executable plugins. See `CREATURE-ARCHITECTURE.md` for the
compiled capability boundary and full authoring recipe.
