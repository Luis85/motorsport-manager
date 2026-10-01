# ECS M6 — versioned simulation content and deliberate migrations

## Status

**Implemented.** M6 publishes data-only ECS rule profiles and creature composition archetypes as part of scenario-pack schema 2. Scenario-aware portable stories now use envelope 10 so the selected simulation definition travels with the exact world, tutorial, four established libraries, and native state. The authoritative simulation payload remains version 8.

## Version boundaries

| Boundary | Current version | Compatibility rule |
|---|---:|---|
| Native simulation state | 8 | Unchanged. No ECS registry, scheduler, profile, or archetype cache is serialized into state. |
| Scenario pack | 2 | Schema-1 packs are validated against the retained schema before an in-memory migration adds the standard profile and archetype. |
| Scenario-aware portable story | 10 | Envelope-9 experience contexts are fingerprint-checked first, then migrated to the standard profile and archetype with an explicit review note. |
| Simulation content set | 1 | Contains bounded rule profiles and composition archetypes only. |
| ECS rule profile | 1 | Wraps one validated actor-rules manifest and one validated economy-rules manifest. |
| Creature composition archetype | 1 | Declares the known dependency-complete persisted and transient actor component contract. |

The retained `scenario-v1.schema.json` is the authority for old pack input. Migration never changes the source file, guesses an unknown version, or rewrites native state.

## Rule profiles

A rule profile has a stable ID, human-readable metadata, and complete nested `littlewild-actor-rules` and `littlewild-economy-rules` documents. Existing validators remain authoritative for numeric ranges, exact fields, thresholds, limits, working task kinds, and income sharing.

The bundled `standard` profile embeds the exact M5 actor and economy defaults. Both Littlewild and Emberworks reference it, preserving their established behavior. A pack may publish up to eight profiles and each scene selects one by ID.

Profiles can tune only already implemented numeric rules. They cannot add systems, scheduler phases, commands, event handlers, functions, expressions, URLs, or arbitrary methods.

## Composition archetypes

Composition archetype version 1 describes a creature with these persisted component bindings:

- `Transform`
- `Needs`
- `Learning`
- `Feelings`
- `Inventory`

and these transient runtime components:

- `Activity`
- `Task`
- `Intent`

The runtime validates the complete set before replacing an engine's transient actor and economy services. Version 1 intentionally does not accept partial dependency graphs or new component names. This establishes a versioned composition contract without turning imported JSON into executable registration metadata.

## Engine-specific application

`source/simulation-content.js` validates, canonicalizes, freezes, resolves, and applies simulation selections. Applying a selection:

1. validates the rule profile and archetype as JSON-only data;
2. checks every current creature against the persisted component contract;
3. creates a fresh actor ECS using the selected actor rules;
4. creates a fresh economy ECS using the selected economy rules;
5. stores the immutable selection as non-enumerable engine metadata.

Profiles are engine-specific rather than a mutable process-wide registry. Reversible pack validation therefore cannot leak a candidate profile into the active story. `engine.export()` continues to serialize native state only.

## Scenario-pack schema 2

A schema-2 pack adds:

- top-level `simulation` content;
- `ruleProfileId` on every scene;
- `actorArchetypeId` on every scene.

Runtime validation performs referential checks in addition to JSON Schema shape validation. Unknown IDs, duplicate definitions, unsupported versions, incomplete archetypes, executable-shaped fields, and malformed nested rule documents fail before active registries or world profiles change.

Capture produces a self-contained schema-2 pack containing the active scene's exact selected profile and archetype. The local CLI reports the source schema version and any compatibility migration notes while leaving inputs byte-unchanged.

## Portable envelope 10

A scenario-aware export snapshots the selected profile and archetype inside `experience.simulation` and fingerprints the complete experience context. Import order is deliberate:

1. parse bounded JSON;
2. verify the original experience fingerprint;
3. validate or migrate the context;
4. validate the world and four libraries;
5. import native state 8;
6. apply the selected simulation definition;
7. expose a review; and
8. commit only after confirmation.

Envelope 9 has no simulation selection. It migrates to the canonical `standard` / `creature-standard` pair and reports that compatibility choice in `migrationNotes`. Tampering with an envelope-10 profile or archetype invalidates the fingerprint or the strict content contract.

## Preserved contracts

- Fixed-step order, actor-major order, random-draw order, and domain authorization remain unchanged.
- Existing native formats 1–8 and their library migrations remain supported.
- The four established content-library schemas remain independent of simulation content.
- Littlewild and Emberworks still run the same compiled systems and component implementations.
- Renderer, DOM, camera, wall clock, file I/O, and device preferences remain outside simulation inputs.
- Direct command methods remain compatibility adapters to the M5 command router.

## Deliberate limits

M6 does not make component classes, scheduler order, behavior-tree handlers, command handlers, narrative code, renderer rigs, island topology, or arbitrary content roles configurable. Composition archetype version 1 publishes and validates the existing creature contract; it does not promise a general entity-definition language. New component types or executable mechanics require code, tests, and a new compatibility version.
