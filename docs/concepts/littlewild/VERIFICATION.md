# Littlewild v15 verification

## Current final gate

**987 / 987 checks passed across 26 suites.** Of these, 105 are browser checks and 882 are ECS, domain, presentation, pause, schema/CLI, migration, stress, progression, and release checks.

Artifact: `littlewild.html` — **3,786,469 bytes**. SHA-256: `30937a9328c51eceebee7bf53dfadc8f72fb60ffaae3bb3145747c122fc8a78d`. Source gate: `python verify-v15.py`. Machine-readable evidence: `verification/v15/gate-results.json`.

| Suite | Passed / total | Elapsed seconds |
|---|---:|---:|
| ecs-core | 9 / 9 | 0.04 |
| engine-composition | 14 / 14 | 0.61 |
| simulation-content | 24 / 24 | 2.17 |
| ecs-activity | 7 / 7 | 0.03 |
| ecs-world | 11 / 11 | 0.04 |
| ecs-economy | 12 / 12 | 0.03 |
| ecs-integration | 7 / 7 | 0.47 |
| ecs-world-integration | 6 / 6 | 0.27 |
| ecs-economy-integration | 8 / 8 | 0.29 |
| scenario-domain | 77 / 77 | 6.45 |
| presentation | 47 / 47 | 0.62 |
| pause-policy | 54 / 54 | 0.84 |
| cartography | 73 / 73 | 2.96 |
| domain | 76 / 76 | 1.87 |
| growth-stress | 3 / 3 | 16.01 |
| earned-progression | 8 / 8 | 5.59 |
| legacy-v5 | 133 / 133 | 4.68 |
| legacy-v6 | 52 / 52 | 19.18 |
| legacy-v8 | 88 / 88 | 22.85 |
| quality-v9 | 31 / 31 | 0.95 |
| foundation-v9 | 31 / 31 | 8.26 |
| legacy-schemas | 19 / 19 | 1.77 |
| scenario-schema-cli | 38 / 38 | 2.43 |
| release | 54 / 54 | 3.51 |
| browser | 89 / 89 | 13.77 |
| browser-contracts | 16 / 16 | 5.44 |

## M6 contracts exercised

The dedicated simulation-content suite verifies the immutable standard profile, detached and frozen definitions, strict JSON-only rule documents, unsupported-version rejection, exact component composition, duplicate-ID rejection, real-engine actor and economy tuning, per-engine service installation, native-state v8 preservation, schema-1 pack migration, envelope-9 migration, envelope-10 fingerprinting, actual active-profile capture, deterministic continuation, self-contained scene capture, definition-library edits, composition preconditions, and the 21-file M6 source manifest.

Independent schema and CLI checks validate both bundled schema-2 packs, the retained schema-1 contract, strict profile/archetype fields, unsupported component rejection, semantic ID resolution, byte-unchanged migration input, current export, authentic legacy-save capture, and migration-note reporting. Scenario-aware stories use envelope 10 and carry their exact selected profile and archetype; ordinary native stories remain format 8.

## Existing behavior exercised

The scenario suite validates both packs and four starting scenes, reversed JSON property order, reversible library staging, unknown fields, malformed input, world references, disconnected layouts, protected sites, fresh and captured states, corruption/stale-review checks, and exact simulation continuation. It compares 4,761 terrain cells to the authentic v14 geometry fixture and six generated legacy layouts. Separate navigation foundations perform 8,432 route comparisons; these are subcases, not additional inflated test totals.

Legacy regression suites cover physical logistics, work interruption, RPG/quests, housing, prestige, map gating, market deliveries, and deterministic restoration. Six-creature stress scenarios retain their source-defined durations in the detailed JSON logs. The automated earned-progression controller completes its first expansion and physical market sale through normal commands; this is reachability evidence, not human pacing validation.

Current browser checks use actual inputs and DOM/layout inspection: pan exposed world, keyboard focus between panel and canvas, category/search/draft state, explicit second-creature assignment, real blueprint placement, real save/pack downloads/uploads, cancellation of delayed reads, migration review, changed-scene confirmation, independent single-pack launch, and six sizes (1440×900, 1024×768, 768×1024, 390×844, 320×568, 844×390). No uncaught JavaScript errors or HTTP/HTTPS requests were observed in the tested flows.

An actual browser save was captured from the supplied v14 artifact with hash `3ee1c7f043f2c0e8a1fff3720ede5cf63950793857f89ea9fb141a7619824b0d`; the fixture is `source/fixtures/actual-v14-story.json`. Authentic older fixtures are retained and tested separately.

## Gate integrity

The standalone artifact is rebuilt before any suite runs. Every suite result is removed before execution. Nonzero exits, missing result files, mismatched counts, explicit failed cases, or an artifact change during verification fail the gate. `--no-browser` produces a clearly marked partial result and is not accepted as release evidence.

Historical browser scripts whose assertions depend on removed full-screen Build/Tutorial behavior or former bundle hashes are not counted as current passes. Their domain regressions remain active, and retained presentation/pause behaviors have v15-specific tests. The gate therefore reports executed checks only; it does not combine historical headline totals.

## Limits

Testing uses headless Chromium via Playwright and the bundled software renderer. Hardware GPU/WebGL behavior and performance, Safari, Firefox, native local-file autosave, physical touch devices, screen readers, localization, human comprehension, balance, and enjoyment are not verified. No FPS, security-certification, or full-accessibility claim is made. Arbitrary imported JSON cannot register systems or executable behavior, but schema validation alone is not a security certification. Theme contrast remains an author responsibility for custom palettes.

Native Motorsport Manager gameplay source is untouched by this concept milestone; the unrelated native Godot gate is outside this change's scope.
