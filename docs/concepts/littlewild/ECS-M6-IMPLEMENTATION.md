# ECS M6 — versioned simulation profiles and schema evolution

## Status

**Implemented.** M6 completes the planned ECS migration by making rule tuning, compiled composition identity, pack migration, and scenario-aware save migration explicit. Native simulation state remains version 8. Scenario packs now publish schema 2 and scenario-aware stories emit envelope 10.

## Versioned simulation profile

`source/simulation-profile.js` owns the profile boundary. A profile is a bounded, JSON-only document with:

- identity and version metadata;
- a complete validated actor-rule document;
- a complete validated economy-rule document;
- one compiled composition archetype declaration.

The compatibility document is `source/content/simulation-profile.json` (`classic-v1`). Its standalone JSON Schema is `source/content/simulation.schema.json`; the same definitions are embedded in the scenario schema and checked for drift.

Accepted profiles are deeply frozen and fingerprinted. An engine captures the active profile when it is constructed. Actor and economy ECS runtimes are built from that captured profile, so later catalog selection cannot retroactively change an existing story.

## Compiled archetype, not executable content

The only supported archetype is `living-world-v1`. It declares the exact known order of:

1. engine composition layers;
2. high-level simulation pipeline phases;
3. actor-dynamics systems;
4. actor-activity systems;
5. world-transaction systems;
6. economy-transaction systems.

The schema uses structural constants for those arrays, and runtime validation independently compares them with the compiled schedulers. Imported JSON cannot add, remove, rename, or reorder systems. It cannot provide modules, callbacks, command handlers, source text, behavior-tree handlers, components, or executable functions.

## Scenario schema 2

`source/content/scenario.schema.json` now accepts two source versions with unambiguous rules:

- schema 1 must not contain `simulation`;
- schema 2 must contain a complete `simulation` profile.

Both built-in packs publish schema 2. Captures and exports also produce schema 2. Existing schema-1 packs remain importable through a deliberate additive migration to `classic-v1`; a schema-1 pack that already contains simulation data fails closed rather than guessing intent.

`source/scenario-shape.js` now evaluates the exact additional schema keywords needed by this contract: deep structural constants, conditional `if`/`then`, `not`, `allOf`, uniqueness, and deterministic local branch evaluation. It remains a bounded evaluator for the bundled schema, not an arbitrary schema engine.

## Explicit migrations

`source/scenario-migrations.js` contains the only scenario/profile migrations:

| Input | Canonical result |
|---|---|
| Scenario pack schema 1 without `simulation` | Schema 2 with `classic-v1`, plus a migration note |
| Scenario pack schema 2 with profile | Validated schema 2 |
| Experience context version 1 | Context version 2 with `classic-v1`, plus a migration note |
| Experience context version 2 | Validated context version 2 |

Unsupported versions and ambiguous documents are rejected. Migration functions copy their inputs and do not mutate author files.

## Story boundary

Scenario-aware portable stories now use envelope 10:

- native payload remains version 8;
- experience context is version 2;
- the exact simulation profile is embedded;
- the complete experience has its existing fingerprint;
- the simulation profile has an independent fingerprint.

Envelope-9 stories first validate their original context fingerprint, then migrate to context version 2 and `classic-v1`. The preview exposes the migration note. A committed migrated story re-exports as envelope 10. Ordinary native-v8 stories use `classic-v1` without gaining scenario context.

## Atomic activation and rollback

Scene validation and commit stage these resources together:

- Base library;
- Adventure library;
- World library;
- Growth library;
- simulation profile;
- world profile;
- imported native state.

Failure restores all prior registries and profiles. Validation, import selection, and preview do not replace the active story. Only explicit scene launch commits the staged configuration.

## Authoring tools and UI

`source/tools/simulation-profile-cli.cjs` provides local, non-mutating commands:

```sh
node source/tools/simulation-profile-cli.cjs validate profile.json
node source/tools/simulation-profile-cli.cjs fingerprint profile.json
node source/tools/simulation-profile-cli.cjs export profile.json
node source/tools/simulation-profile-cli.cjs schema
```

The scenario CLI reports source schema version, selected profile, archetype, and migration notes. The scenario UI displays the profile and archetype during catalog browsing and launch review, and exposes legacy migration notes before replacement.

## Preserved boundaries

- Native state is still version 8.
- ECS worlds, schedulers, composition descriptors, command manifests, state views, and active registries remain transient.
- Existing Base, Adventure, World, and Growth schemas remain their own contracts.
- Rendering, camera, device preferences, file I/O, DOM state, and wall-clock time remain outside simulation inputs.
- Randomness remains deterministic and domain-owned.
- Littlewild and Emberworks continue to share the same compiled mechanics.
- Mature domain methods remain facade adapters; M6 does not falsely turn every mechanic into a generic ECS system.
