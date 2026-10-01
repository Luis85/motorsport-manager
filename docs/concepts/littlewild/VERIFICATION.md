# Littlewild v15 verification

## Current final gate

**1,006 / 1,006 checks passed in 27 suites.** Of these, 105 are browser checks and 901 exercise ECS, composition, simulation profiles, migrations, domain behavior, presentation, pause policy, schemas, authoring CLIs, compatibility, and release integrity.

Artifact: `littlewild.html` — 3,788,823 bytes. SHA-256: `73a1d790ec3ca2c04f57ff4dab16c3c68184b871dd555a7b613c2809861be96c`. Source gate: `python verify-v15.py`. Machine-readable evidence: `verification/v15/gate-results.json`.

| Suite | Passed / total | Elapsed seconds |
|---|---:|---:|
| ecs-core | 9 / 9 | 0.03 |
| simulation-profile | 15 / 15 | 0.07 |
| simulation-profile-integration | 15 / 15 | 2.29 |
| engine-composition | 14 / 14 | 0.53 |
| ecs-activity | 7 / 7 | 0.03 |
| ecs-world | 11 / 11 | 0.03 |
| ecs-economy | 12 / 12 | 0.03 |
| ecs-integration | 7 / 7 | 0.42 |
| ecs-world-integration | 6 / 6 | 0.24 |
| ecs-economy-integration | 8 / 8 | 0.29 |
| scenario-domain | 77 / 77 | 6.68 |
| presentation | 47 / 47 | 0.64 |
| pause-policy | 54 / 54 | 0.81 |
| cartography | 73 / 73 | 3.28 |
| domain | 76 / 76 | 2.03 |
| growth-stress | 3 / 3 | 16.75 |
| earned-progression | 8 / 8 | 5.53 |
| legacy-v5 | 133 / 133 | 4.71 |
| legacy-v6 | 52 / 52 | 20.45 |
| legacy-v8 | 88 / 88 | 24.51 |
| quality-v9 | 31 / 31 | 1.04 |
| foundation-v9 | 31 / 31 | 8.08 |
| legacy-schemas | 19 / 19 | 1.71 |
| scenario-schema-cli | 47 / 47 | 2.65 |
| release | 58 / 58 | 3.97 |
| browser | 89 / 89 | 14.36 |
| browser-contracts | 16 / 16 | 5.85 |

## What was actually exercised

The M6 profile suites validate the complete `classic-v1` actor/economy rule document, exact `living-world-v1` compiled archetype order, deep immutability, deterministic fingerprints, per-engine profile capture, both bundled schema-2 packs, atomic profile/library rollback, and deterministic continuation through envelope-10 export/import. They also validate the deliberate schema-1 pack and envelope-9 story migrations and reject profile fingerprint tampering, ambiguous legacy documents, unsupported versions, executable values, unknown systems, reordered systems, and behavior-shaped JSON.

The scenario suite validates both packs and four starting scenes, reversed JSON property order, reversible library and simulation-profile staging, unknown fields, malformed input, world references, disconnected layouts, protected sites, fresh and captured states, corruption/stale-review checks, and exact simulation continuation. It compares 4,761 terrain cells with the authentic v14 geometry fixture and six generated legacy layouts. Separate navigation foundations perform 8,432 route comparisons; these are subcases, not additional inflated test totals.

Legacy regression suites cover physical logistics, work interruption, RPG/quests, housing, prestige, map gating, market deliveries, deterministic restoration, and old save/schema compatibility. Six-creature stress scenarios retain their source-defined durations in the detailed JSON logs. The automated earned-progression controller completes its first expansion and physical market sale through normal commands; this is reachability evidence, not human pacing validation.

Browser checks use actual inputs and DOM/layout inspection: pan exposed world, keyboard focus between panel and canvas, category/search/draft state, explicit second-creature assignment, real blueprint placement, real save/pack downloads and uploads, cancellation of delayed reads, changed-scene confirmation, independent single-pack launch, simulation-profile disclosure, schema-2 pack export/capture, and envelope-10 story export. Six viewports are exercised: 1440×900, 1024×768, 768×1024, 390×844, 320×568, and 844×390. No uncaught JavaScript errors or HTTP/HTTPS requests were observed in the tested main flows.

An actual browser save was captured from the supplied v14 artifact with hash `3ee1c7f043f2c0e8a1fff3720ede5cf63950793857f89ea9fb141a7619824b0d`; the fixture is `source/fixtures/actual-v14-story.json`. Authentic older fixtures are retained and tested separately. Native stories remain format 8, legacy scenario-aware envelope-9 stories migrate explicitly, and canonical scenario-aware stories now use envelope 10 with context version 2 and an independent simulation-profile fingerprint.

## Gate integrity and historical assertions

Every suite result is removed before that suite runs. Nonzero exits, missing results, mismatched counts, explicit failures, schema drift, profile/archetype drift, or unexpected artifact changes fail the gate. The entire gate was rerun after M6 source, authoring, UI, migration, and verification changes; the successful result above is the one committed with the milestone.

The historical v10–v14 browser scripts and per-version bundle hashes are not all rerun because some assert superseded full-screen Build/Tutorial behavior or former artifact identity. Their domain regression suites remain active, and prior pure presentation and pause assertions are retained in v15-specific suites. This 1,006-check gate is the current authoritative release gate; it is not presented as the sum of every obsolete historical harness.

## Limits

Testing uses headless Chromium through Playwright and `page.set_content`. Actual captures use the bundled software renderer. Hardware GPU/WebGL behavior and performance, Safari, Firefox, native local-file autosave, physical touch devices, screen readers, localization, human comprehension, and enjoyment are not verified. No FPS, security-certification, or full accessibility-compliance claim is made. Theme contrast remains an author responsibility for arbitrary custom palettes.

The delivered source is independently rebuilt during verification. Artifact identity and all suite outputs are recorded in the gate evidence rather than counted as additional gameplay tests.
