# Creature definitions

Each creature archetype owns one folder and one `creature.json`.

```text
creatures/
  sproutling/
    creature.json
```

Creature definitions are domain data. They own the stable gameplay contract: supported personality IDs, name pool, spawn modes, movement tuning, persistent defaults, actor-scoped fields, deterministic RNG seeding, and ECS component bindings.

Visual geometry remains separate under `source/assets/actors/<creature-id>/asset.json`. Actor assets own geometry, materials, rig/socket names, and appearance profiles. The shared creature ID binds domain data to presentation without making domain code depend on rendering.

Definitions are bundled and immutable. Scenario/adventure imports cannot register creature archetypes or executable behavior.
