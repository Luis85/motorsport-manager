# Littlewild v15: data-driven worlds, creatures and ECS M1–M6

## Scope

This change remains confined to `docs/concepts/littlewild/` and its dedicated verification workflow. Native Motorsport Manager gameplay code is not modified.

Littlewild v15 provides data-driven worlds, bundled 3D assets, fully data-driven creature archetypes, current-only scenario/story contracts, and the deterministic ECS/application architecture established through M1–M6.

## Implemented architecture

- Deterministic entity/component storage and explicit system scheduling.
- Actor dynamics, task movement, physical logistics, production, economy, quest, progression and cartography boundaries.
- One stable `LW.Engine` facade and a declared composition root.
- Immutable per-engine simulation profiles containing validated actor/economy rules.
- A compiled `living-world-v1` simulation archetype that pins engine layers and ECS schedules.
- Current-only scenario schema 2 and portable story envelope 10. Obsolete scenario/story formats are rejected rather than migrated.
- Atomic activation and rollback across Base, Adventure, World, Growth, simulation profile, world profile and imported state.
- Data-only imports: JSON cannot register systems, handlers, commands, callbacks, modules, source code or arbitrary runtime components.
- Strict CSP remains intact; browser verification no longer relies on string-evaluated predicates.

## Data-driven creatures

Creature gameplay definitions live under:

```text
source/creatures/
├── creature.schema.json
└── sproutling/
    └── creature.json
```

The creature definition owns stable archetype data including:

- explicit archetype identity;
- supported reusable personalities and deterministic name pool;
- founder/arrival spawn modes;
- movement and bond-speed tuning;
- deterministic RNG seed policy;
- complete actor-scoped persistent defaults;
- the shared actor-scoped field contract;
- ECS component bindings.

`creature-catalog.ts` validates, deep-freezes and indexes bundled archetypes. Nested contracts fail closed on unknown or missing fields, the public catalog is immutable, and executable-shaped data is rejected.

`creature-factory.ts` is the application boundary that turns immutable archetype data plus validated Adventure personality content into detached mutable actor records. Recruitment no longer constructs a hidden template engine or carries its own name/spawn/default-state tables.

Native actor identity is now the explicit pair `{archetype, personality}`. Archetype selects the creature domain/visual contract; personality selects reusable traits, attributes and preferences. Future creature archetypes can therefore share personality profiles without coupling species identity to temperament.

Persistent actor records remain authoritative. `actor-ecs.ts` binds configured component records by reference and derives transient `Creature`, `Activity` and `Intent` projections without introducing a second save model. Component references are cached and transient Activity records are reused rather than reallocated every tick.

Persistent interaction state such as event interactions and interaction cooldowns is now owned by the creature manifest/factory. Village/application systems validate and consume that state instead of silently manufacturing missing creature fields.

## Data-driven presentation

The visual asset architecture remains separate from gameplay creature definitions:

```text
source/assets/
├── buildings/<id>/asset.json
├── items/<id>/asset.json
└── actors/<id>/asset.json
```

There are **67 isolated 3D asset manifests**:

- 24 building assets;
- 42 item/environment/equipment assets;
- 1 actor asset.

The Sproutling actor asset owns:

- world model variants;
- material roles and personality appearance profiles;
- rig and equipment/carry sockets;
- label/context/bubble sizing;
- expression thresholds;
- animation tuning.

`world-fidelity.ts` owns animation algorithms only. It resolves the explicit actor archetype to its matching actor asset and consumes data-authored appearance/expression/animation profiles; it no longer derives shape or palette from actor IDs or embeds creature-specific variant tables.

World and portrait rendering use explicit archetype identity, including the portrait fallback path. Regression tests scan presentation code to prevent reintroduction of personality→archetype inference.

## Separation of concerns

The main ownership boundaries are documented in `CREATURE-ARCHITECTURE.md`:

- creature archetype data → `source/creatures/`;
- actor creation → `creature-factory.ts`;
- persistent actor state → actor records;
- deterministic component progression → `actor-ecs.ts`;
- personality/trait definitions → Adventure content;
- geometry/appearance/rig/tuning → actor asset manifests;
- animation algorithms → `world-fidelity.ts`;
- recruitment/social/quest orchestration → application layer.

The current domain map owns **60 runtime modules** across domain, application, infrastructure and presentation contexts. The current `source/` inventory contains **94 authored TypeScript/CTS files**. Project-authored JavaScript/CJS/Python executable source is prohibited; generated JavaScript remains disposable output and `vendor/three.js` is third-party distribution code.

## Additional hardening and polish

- Creature/catalog JSON validates exact nested contracts and rejects schema drift.
- Creature identity and supported personality pairing are validated independently.
- Actor visual asset validation enforces rig, socket, animation, expression and appearance contracts.
- Creature visual-profile caches invalidate when creature/asset/adventure revisions change.
- ECS binding changes remove stale component types and preserve authoritative object references.
- Browser verification respects the production CSP instead of requiring `unsafe-eval`.
- Scenario schema is strictly version 2; obsolete schema versions are rejected.
- Portable story import is current-only envelope 10.
- Current captured actors are checked against the complete creature-owned persistent state contract.
- Current UI copy no longer advertises removed legacy-format import behavior.

## Verification

Authoritative workflow:

```sh
npm ci --no-audit --no-fund
npm run typecheck
npm run architecture
npx playwright install --with-deps chromium
npm run verify
```

Verified implementation head `3177396de09bbf2a7bfb5f99b2f2f88804567549` passed **670 / 670 checks across 26 suites** in Littlewild ECS verification run `37105368075`.

Selected results:

- TypeScript architecture: **17 / 17**
- creature catalog/factory/presentation identity contracts: **15 / 15**
- asset catalog: **8 / 8**
- ECS core: **16 / 16**
- simulation profile + integration: **31 / 31**
- engine composition: **16 / 16**
- ECS activity/world/economy + integrations: **52 / 52**
- scenario domain: **69 / 69**
- presentation: **45 / 45**
- pause policy: **52 / 52**
- cartography: **71 / 71**
- domain: **76 / 76**
- growth stress: **3 / 3**
- earned progression: **8 / 8**
- scenario/schema CLI: **47 / 47**
- release: **28 / 28**
- browser: **89 / 89**
- browser contracts: **14 / 14**

Rebuilt standalone:

- bytes: **4,117,751**
- SHA-256: `73fd6ce19eb8d810fa3f84c828196572a41ee47aa0c5d43e844d521c6918b0b5`

On the same implementation head, **Advisory code quality**, **Content and exported runtime**, and **Runtime confidence** also passed. The PR remains open and mergeable.

## Review path

1. Open `docs/concepts/littlewild/littlewild.html`.
2. Review creature recruitment and each personality appearance in world and portrait views.
3. Inspect `source/creatures/sproutling/creature.json` and `source/assets/actors/sproutling/asset.json`.
4. Review `CREATURE-ARCHITECTURE.md` and `ASSET-ARCHITECTURE.md`.
5. Inspect the `Creature` ECS projection and reference-bound persistent components in `actor-ecs.ts`.
6. Review scenario/schema behavior: current schema 2 validates; obsolete schema versions are rejected.
7. Export/import a current story and verify deterministic continuation under envelope 10.

## Limits

This deliberately does not create an arbitrary entity scripting language. Systems, command handlers and animation algorithms remain compiled trusted capabilities. Creature definitions and visual assets are bundled trusted data; external scenarios cannot inject renderer assets, ECS systems or executable behavior.

All bundled creature archetypes currently implement one shared actor-scoped persistent field contract because the application facade exposes a stable roster shape. Archetypes may vary their data values, visual assets, supported personalities and ECS-bound object components without hiding defaults in consuming systems.

Hardware WebGL performance, physical devices, Safari/Firefox, screen readers, localization, human usability and game balance remain outside the automated gate.
