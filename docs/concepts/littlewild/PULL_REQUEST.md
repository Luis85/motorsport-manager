# Littlewild v15: data-driven worlds and ECS M1–M6

## Scope

This change remains confined to `docs/concepts/littlewild/` and its dedicated verification workflow. Native Motorsport Manager gameplay code is not modified.

Littlewild v15 provides reusable scenario packs, compact world-facing UI, and a compatibility-preserving ECS migration through M6. M1–M4 establish actor, activity, physical-world, economy, quest, and progression boundaries. M5 replaces the load-order constructor chain with one stable facade, explicit composition, actor-scoped state views, an inspectable simulation pipeline, and a fail-closed command router. M6 completes the plan with versioned simulation profiles, compiled composition identity, explicit migrations, and deterministic portable-story compatibility.

## Implemented architecture

- Deterministic entity/component storage and explicit system scheduling.
- Actor dynamics, task movement, physical logistics, production, economy, quest, and progression boundaries.
- One stable `LW.Engine` facade and a declared composition root.
- Immutable per-engine simulation profiles containing validated actor/economy rules.
- A compiled `living-world-v1` archetype that pins engine layers and all ECS schedules.
- Scenario schema 2 and portable envelope 10 with explicit schema-1/envelope-9 migrations.
- Independent experience and simulation-profile fingerprints for stale-review detection.
- Atomic activation and rollback across Base, Adventure, World, Growth, simulation profile, world profile, and imported state.
- Data-only imports: JSON cannot register systems, handlers, commands, callbacks, modules, source code, or arbitrary components.

Native state remains version 8. ECS worlds, schedulers, profiles, composition descriptors, state views, command manifests, renderer state, and UI state remain transient.

## Review and polishing pass

The final review replaced the first M6 profile-set draft with a stricter standalone profile contract, separated migrations from scenario orchestration, made profile lifetime instance-stable, added an independent simulation fingerprint, and expanded rollback and compatibility coverage. The publication failure was CI-permission-only: the verified M6 commit object was fast-forwarded directly and the branch returned to the read-only verifier.

See `ECS-M6-REVIEW-AND-POLISH.md` for findings, decisions, remaining debt, and separation-of-concerns evidence.

## Verification

- **1,006 / 1,006 checks passed across 27 suites**.
- Simulation-profile unit: **15 / 15**.
- Simulation-profile real-engine integration: **15 / 15**.
- Engine composition: **14 / 14**.
- Scenario schema and CLI: **47 / 47**.
- Release contracts: **58 / 58**.
- Browser: **89 / 89**.
- Browser contracts: **16 / 16**.
- Standalone artifact: **3,788,823 bytes**.
- SHA-256: `73a1d790ec3ca2c04f57ff4dab16c3c68184b871dd555a7b613c2809861be96c`.
- M6 authority manifest: `73f37d9eaf1a20ef3363f840fdb80db3c212ce8cf914c6b7370bd37a600bd521` across 28 files.

Detailed executed evidence and limitations are in `VERIFICATION.md` and `ECS-M6-RESULTS.md`.

## Review path

Open `docs/concepts/littlewild/littlewild.html`, review a bundled scene under **More → Worlds & scenarios**, and inspect the displayed simulation profile and compiled archetype. Export a story and verify envelope 10 includes both experience and simulation fingerprints. Then review `CONFIGURATION.md`, `ECS-M6-IMPLEMENTATION.md`, and `ECS-M6-REVIEW-AND-POLISH.md`.

## Limits

M6 does not create a general entity-definition or scripting language. System implementations, behavior handlers, command handlers, renderer rigs, island topology, and mature domain consequences remain compiled capabilities. Content registries still support one active experience per document. Hardware WebGL, physical devices, screen readers, human usability, and game balance are not verified by the automated gate.
