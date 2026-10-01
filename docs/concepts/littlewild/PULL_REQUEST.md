# Littlewild v15: data-driven worlds and ECS M1–M6

## Scope

This change remains confined to `docs/concepts/littlewild/` and its dedicated verification workflow. Native Motorsport Manager gameplay code is not modified.

Littlewild v15 provides reusable scenario packs, compact world-facing UI, and a compatibility-preserving ECS migration through M6. M1–M4 establish actor, activity, physical-world, economy, quest, and progression boundaries. M5 replaces the load-order constructor chain with one stable facade, explicit composition, actor-scoped state views, a visible simulation pipeline, and a fail-closed command router. M6 adds versioned, data-only simulation profiles and known composition archetypes with deliberate pack/story migrations.

## M6

- Scenario-pack schema 2 adds a bounded simulation-content set and explicit scene references.
- Rule-profile version 1 wraps complete validated actor and economy rule manifests.
- Composition-archetype version 1 publishes only the existing dependency-complete creature contract.
- Native simulation state remains version 8.
- Scenario-aware portable stories use envelope 10 and fingerprint the exact selected profile/archetype with the world context.
- Retained schema-1 packs and envelope-9 contexts migrate explicitly to the canonical defaults after validation against their original contracts.
- Imported JSON cannot register systems, callbacks, commands, methods, component implementations, or executable behavior.

## Verification

- **987 / 987 checks passed across 26 suites**.
- M6 simulation content: **24 / 24**.
- Scenario schema/CLI: **38 / 38**.
- Browser: **89 / 89**.
- Browser contracts: **16 / 16**.
- Standalone artifact: **3,786,469 bytes**.
- SHA-256: `30937a9328c51eceebee7bf53dfadc8f72fb60ffaae3bb3145747c122fc8a78d`.
- M6 source manifest: `68bc9530becd7b0f66c65e666cd8fd38db28d3ea3d87302249d1e948852aaaa4` across 21 authority files.

Detailed executed evidence and limitations are in `VERIFICATION.md` and `ECS-M6-RESULTS.md`.

## Review

Open `docs/concepts/littlewild/littlewild.html`; review a bundled scene under **More → Worlds & scenarios** and confirm the displayed Rules and Composition fields. Export a story and inspect envelope 10, then review `CONFIGURATION.md`, `ECS-M6-IMPLEMENTATION.md`, and the retained `source/content/scenario-v1.schema.json` migration boundary.

## Limits

M6 does not create a general entity-definition or scripting language. System order, component implementations, behavior handlers, command handlers, renderer rigs, island topology, and mature domain consequences remain compiled capabilities. Hardware WebGL, physical devices, screen readers, human usability, and balance are not verified by the automated gate.
