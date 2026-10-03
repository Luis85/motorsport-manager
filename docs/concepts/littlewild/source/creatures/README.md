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

Actor identity is the explicit pair `{archetype, personality}`. `archetype` selects this domain/visual contract; `personality` selects reusable Adventure traits and preferences. Multiple archetypes may support the same personality without introducing renderer or ECS switches.

All persistent actor defaults—including village interaction events and cooldowns—belong to the creature definition/factory. Downstream systems validate and consume this state; they do not silently create missing creature fields.
