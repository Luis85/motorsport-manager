# ECS M6 verification evidence

## Versioned simulation-content contracts

- **24 / 24** focused simulation-content checks passed.
- Scenario packs now use schema 2 and select one validated rule profile and one known creature composition archetype per scene.
- The bundled `standard` profile is exactly equal to the authoritative actor and economy rule manifests.
- Custom numeric profiles install real actor and economy services on an engine and survive envelope-10 save/restore with deterministic continuation.
- Native export remains version 8 and contains no profile, archetype, registry, scheduler, or service cache.
- Schema-1 packs and envelope-9 contexts validate against their retained contracts before explicit in-memory migration to `standard` / `creature-standard`.
- Unknown fields, executable values, unsupported versions, unresolved IDs, partial component sets, and new component names fail closed.
- Scene capture and portable stories contain the engine's actual active selection, not stale context metadata.

## Independent schema and CLI evidence

- **38 / 38** scenario schema/CLI checks passed.
- Both bundled packs validate independently against JSON Schema draft 2020-12.
- Current packs fail the retained v1 schema; derived v1 packs pass only that retained schema and migrate without input mutation.
- CLI validation reports source schema version and migration notes.
- Export and capture produce complete current schema-2 packs.

## Complete release result

All **26** registered suites pass, totaling **987 / 987** checks:

- ECS core, composition, activity, world, economy, and real-engine integrations;
- M6 simulation profiles, composition archetypes, migration, persistence, and source-manifest contracts;
- scenario, presentation, pause, cartography, domain, stress, and earned progression;
- v5, v6, v8, quality-v9, and foundation-v9 regressions;
- retained and current schema/CLI checks;
- release contracts;
- browser behavior and browser contracts.

The standalone artifact is rebuilt from source before verification.

- Final size: **3,786,469 bytes**
- Final SHA-256: `30937a9328c51eceebee7bf53dfadc8f72fb60ffaae3bb3145747c122fc8a78d`
- Aggregate record: `verification/v15/gate-results.json`
- M6 source-manifest SHA-256: `68bc9530becd7b0f66c65e666cd8fd38db28d3ea3d87302249d1e948852aaaa4`
- Manifest scope: `simulation-content-source-manifest-v1`
- Manifested authority files: **21**
