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

The final branch-wide review retained the M6 architecture and closed additional failure modes: rejected deferred ECS batches no longer wedge the scheduler; physical transaction batches validate before mutation; story/scenario confirmation privately binds the exact reviewed state, libraries, experience, simulation profile, and scene; temporary global registries reject asynchronous escape; resource IDs validate their real values; and multi-library story activation rolls back as one unit.

See `PR25-TYPESCRIPT-ARCHITECTURE-REVIEW.md` for the TypeScript/Clean Architecture/DDD review and `PR25-REVIEW-AND-POLISH.md` for the earlier transactional review. `ECS-M6-REVIEW-AND-POLISH.md` retains the milestone-specific review.

## Verification

The current authoritative gate is TypeScript-based:

```sh
npm install --no-audit --no-fund
npm run typecheck
npm run architecture
npx playwright install chromium
npm run verify
```

The previous pre-TypeScript head passed **1,006 / 1,006 checks across 27 suites**, including 105 browser checks. That result and its former standalone hash are retained as a regression baseline only. Current-head evidence is `verification/v15/gate-results.json` produced by the TypeScript workflow; do not substitute the historical baseline for a current run.

The current source inventory contains 99 authored TypeScript/CTS files, 57 machine-owned runtime modules, and no project-authored JS/CJS/Python executable files. `vendor/three.js` is the only retained JavaScript source and is third-party distribution code.

## Review path

Open `docs/concepts/littlewild/littlewild.html`, review a bundled scene under **More → Worlds & scenarios**, and inspect the displayed simulation profile and compiled archetype. Export a story and verify envelope 10 includes both experience and simulation fingerprints. Then review `CONFIGURATION.md`, `ECS-M6-IMPLEMENTATION.md`, `ECS-M6-REVIEW-AND-POLISH.md`, and `PR25-TYPESCRIPT-ARCHITECTURE-REVIEW.md`.

## Limits

M6 does not create a general entity-definition or scripting language. System implementations, behavior handlers, command handlers, renderer rigs, island topology, and mature domain consequences remain compiled capabilities. Content registries still support one active experience per document. Hardware WebGL, physical devices, screen readers, human usability, and game balance are not verified by the automated gate.
