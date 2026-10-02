# Littlewild v15: data-driven worlds and ECS M1–M6

## Scope

This change remains confined to `docs/concepts/littlewild/` and its dedicated verification workflow. Native Motorsport Manager gameplay code is not modified.

Littlewild v15 provides reusable scenario packs, compact world-facing UI, a compatibility-preserving ECS migration through M6, and a data-driven bundled 3D asset layer. M1–M4 establish actor, activity, physical-world, economy, quest, and progression boundaries. M5 replaces the load-order constructor chain with one stable facade, explicit composition, actor-scoped state views, an inspectable simulation pipeline, and a fail-closed command router. M6 completes the plan with versioned simulation profiles, compiled composition identity, explicit migrations, and deterministic portable-story compatibility.

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
- A bundled 3D asset catalog with one folder per building/item/actor model; imported scenarios cannot register or replace assets.
- Generic primitive-scene rendering with data-authored materials, model variants, actor sockets, door/rotor/smoke anchors and asset-derived hit bounds.

Native state remains version 8. ECS worlds, schedulers, profiles, composition descriptors, state views, command manifests, renderer state, and UI state remain transient.

## Review and polishing pass

The final branch-wide review retained the M6 architecture and closed additional failure modes: rejected deferred ECS batches no longer wedge the scheduler; physical transaction batches validate before mutation; story/scenario confirmation privately binds the exact reviewed state, libraries, experience, simulation profile, and scene; temporary global registries reject asynchronous escape; resource IDs validate their real values; and multi-library story activation rolls back as one unit.

See `PR25-TYPESCRIPT-ARCHITECTURE-REVIEW.md` for the TypeScript/Clean Architecture/DDD review and `PR25-REVIEW-AND-POLISH.md` for the earlier transactional review. `ECS-M6-REVIEW-AND-POLISH.md` retains the milestone-specific review.

## Verification

The current authoritative gate is TypeScript-based:

```sh
npm ci --no-audit --no-fund
npm run typecheck
npm run architecture
npx playwright install chromium
npm run verify
```

Implementation head `c8407aece0c479c2ffe0498a6e9e5bed20bfe5fc` passed **1,053 / 1,053 checks across 31 suites** in workflow run `37036136280`, including **8 / 8 asset-catalog checks** and **105 / 105 browser contracts**. The rebuilt standalone SHA-256 is `1ab1addec4a383dd3ade1c53a33535296024ee15e5a6aaee915e8623adedfae8`.

The previous pre-TypeScript head passed **1,006 / 1,006 checks across 27 suites**, including 105 browser checks. That result and its former standalone hash are retained as a regression baseline only. Current-head evidence is `verification/v15/gate-results.json` produced by the TypeScript workflow; do not substitute the historical baseline for a current run.

The current source inventory contains 104 authored TypeScript/CTS files, 59 machine-owned runtime modules, **67 isolated 3D asset manifests** (24 buildings, 42 items, 1 actor), and no project-authored JS/CJS/Python executable files. `vendor/three.js` is the only retained JavaScript source and is third-party distribution code.

## Review path

Open `docs/concepts/littlewild/littlewild.html`, review a bundled scene under **More → Worlds & scenarios**, and inspect the displayed simulation profile and compiled archetype. Export a story and verify envelope 10 includes both experience and simulation fingerprints. Then review `CONFIGURATION.md`, `ECS-M6-IMPLEMENTATION.md`, `ECS-M6-REVIEW-AND-POLISH.md`, and `PR25-TYPESCRIPT-ARCHITECTURE-REVIEW.md`.

## Limits

M6 does not create a general entity-definition or scripting language. System implementations, behavior handlers, command handlers, animation programs, island topology, and mature domain consequences remain compiled capabilities. Bundled model descriptors are data-driven, but external scenario packs cannot register model files or renderer code. Content registries still support one active experience per document. Hardware WebGL, physical devices, screen readers, human usability, and game balance are not verified by the automated gate.
