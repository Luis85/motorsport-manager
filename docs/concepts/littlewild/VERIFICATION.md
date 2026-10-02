# Littlewild v15 verification

## Current gate

The authoritative gate is now the TypeScript pipeline:

```sh
npm run typecheck
npm run architecture
npm run verify
```

The gate compiles all authored TypeScript into `.generated/`, rebuilds `littlewild.html`, runs the deterministic/domain/regression/schema/release suites against generated JavaScript, and runs the Playwright browser contracts. Machine-readable evidence remains `verification/v15/gate-results.json`.

### Verified TypeScript head

Implementation head `c8407aece0c479c2ffe0498a6e9e5bed20bfe5fc` passed **1,053 / 1,053 checks across 31 suites** in GitHub Actions run `37036136280`.

- strict TypeScript gate: passed;
- architecture/DDD gate: **16 / 16**;
- bundled 3D asset catalog: **8 / 8**;
- deterministic/domain/regression/schema/release checks before browser: **948 / 948**;
- main Playwright browser suite: **89 / 89**;
- focused browser contracts: **16 / 16**;
- total browser contracts: **105 / 105**;
- standalone SHA-256: `1ab1addec4a383dd3ade1c53a33535296024ee15e5a6aaee915e8623adedfae8`;
- standalone bytes: **4,140,507**.

CI uses the committed lockfile and `npm ci`. Browser screenshot capture is opt-in with `LITTLEWILD_CAPTURE_SCREENSHOTS=1`; screenshots are evidence, not functional gate requirements. The functional browser assertions remain mandatory.


### Superseded pre-TypeScript baseline

Before the TypeScript/Clean Architecture polishing pass, the branch passed **1,006 / 1,006 checks in 27 suites**, including 105 browser checks. That result and the former artifact SHA-256 `d317308acd8b10bdd0acbdd365bc6c669f89ecd06f563067bd675d4722c4b5f1` are retained below only as a regression baseline; they are not claimed as evidence for the current head.

| Suite | Passed / total | Elapsed seconds |
|---|---:|---:|
| ecs-core | 9 / 9 | 0.05 |
| simulation-profile | 15 / 15 | 0.08 |
| simulation-profile-integration | 15 / 15 | 3.09 |
| engine-composition | 14 / 14 | 0.90 |
| ecs-activity | 7 / 7 | 0.04 |
| ecs-world | 11 / 11 | 0.05 |
| ecs-economy | 12 / 12 | 0.04 |
| ecs-integration | 7 / 7 | 0.67 |
| ecs-world-integration | 6 / 6 | 0.40 |
| ecs-economy-integration | 8 / 8 | 0.40 |
| scenario-domain | 77 / 77 | 10.32 |
| presentation | 47 / 47 | 1.09 |
| pause-policy | 54 / 54 | 1.49 |
| cartography | 73 / 73 | 5.17 |
| domain | 76 / 76 | 2.96 |
| growth-stress | 3 / 3 | 23.25 |
| earned-progression | 8 / 8 | 8.09 |
| legacy-v5 | 133 / 133 | 7.19 |
| legacy-v6 | 52 / 52 | 27.42 |
| legacy-v8 | 88 / 88 | 29.62 |
| quality-v9 | 31 / 31 | 1.34 |
| foundation-v9 | 31 / 31 | 10.96 |
| legacy-schemas | 19 / 19 | 2.63 |
| scenario-schema-cli | 47 / 47 | 3.58 |
| release | 58 / 58 | 5.72 |
| browser | 89 / 89 | 16.08 |
| browser-contracts | 16 / 16 | 7.29 |

## What was actually exercised

The M6 profile suites validate the complete `classic-v1` actor/economy rule document, exact `living-world-v1` compiled archetype order, deep immutability, deterministic fingerprints, per-engine profile capture, both bundled schema-2 packs, atomic profile/library rollback, and deterministic continuation through envelope-10 export/import. They also validate the deliberate schema-1 pack and envelope-9 story migrations and reject profile fingerprint tampering, ambiguous legacy documents, unsupported versions, executable values, unknown systems, reordered systems, and behavior-shaped JSON.

The asset suite validates all isolated `source/assets/` folders, unique category/ID identities, complete visual coverage for every gameplay building/item/equipment definition, actor rig/socket references, data-only payloads and catalog immutability. The scenario suite validates both packs and four starting scenes, reversed JSON property order, reversible library and simulation-profile staging, unknown fields, malformed input, world references, disconnected layouts, protected sites, fresh and captured states, corruption/stale-review checks, and exact simulation continuation. It compares 4,761 terrain cells with the authentic v14 geometry fixture and six generated legacy layouts. Separate navigation foundations perform 8,432 route comparisons; these are subcases, not additional inflated test totals.

Legacy regression suites cover physical logistics, work interruption, RPG/quests, housing, prestige, map gating, market deliveries, deterministic restoration, and old save/schema compatibility. Six-creature stress scenarios retain their source-defined durations in the detailed JSON logs. The automated earned-progression controller completes its first expansion and physical market sale through normal commands; this is reachability evidence, not human pacing validation.

Browser checks use actual inputs and DOM/layout inspection: pan exposed world, keyboard focus between panel and canvas, category/search/draft state, explicit second-creature assignment, real blueprint placement, real save/pack downloads and uploads, cancellation of delayed reads, changed-scene confirmation, independent single-pack launch, simulation-profile disclosure, schema-2 pack export/capture, and envelope-10 story export. Six viewports are exercised: 1440×900, 1024×768, 768×1024, 390×844, 320×568, and 844×390. No uncaught JavaScript errors or HTTP/HTTPS requests were observed in the tested main flows.

An actual browser save was captured from the supplied v14 artifact with hash `3ee1c7f043f2c0e8a1fff3720ede5cf63950793857f89ea9fb141a7619824b0d`; the fixture is `source/fixtures/actual-v14-story.json`. Authentic older fixtures are retained and tested separately. Native stories remain format 8, legacy scenario-aware envelope-9 stories migrate explicitly, and canonical scenario-aware stories now use envelope 10 with context version 2 and an independent simulation-profile fingerprint.

## Gate integrity and historical assertions

Every suite result is removed before that suite runs. Nonzero exits, missing results, mismatched counts, explicit failures, schema drift, profile/archetype drift, or unexpected artifact changes fail the gate. The pre-TypeScript result below remains useful as a behavioral baseline. The current handoff is valid only when the TypeScript workflow has rebuilt the artifact and produced a fresh passing `verification/v15/gate-results.json` for the current PR head.

The historical v10–v14 browser scripts and per-version bundle hashes are not all rerun because some assert superseded full-screen Build/Tutorial behavior or former artifact identity. Their domain regression suites remain active, and prior pure presentation and pause assertions are retained in v15-specific suites. The 1,006-check result is the last pre-TypeScript baseline; it is not presented as evidence for the current head or as the sum of every obsolete historical harness.

## Limits

Testing uses headless Chromium through Playwright and `page.set_content`. Actual captures use the bundled software renderer. Hardware GPU/WebGL behavior and performance, Safari, Firefox, native local-file autosave, physical touch devices, screen readers, localization, human comprehension, and enjoyment are not verified. No FPS, security-certification, or full accessibility-compliance claim is made. Theme contrast remains an author responsibility for arbitrary custom palettes.

The delivered source is independently rebuilt during verification. Artifact identity and all suite outputs are recorded in the gate evidence rather than counted as additional gameplay tests.
