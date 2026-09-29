# Littlewild v15 verification

## Current final gate

**871 / 871 checks passed in 17 suites.** Of these, 105 are browser checks; 766 are domain, presentation, pause, schema/CLI and release checks.

Artifact: `littlewild.html` — 3,695,818 bytes. SHA-256: `acaf00f6163cb8ca3539370ed8b89e2afd844491ae7ee1c1bb70a321b0543032`. Source gate: `python verify-v15.py`. Machine-readable evidence: `verification/v15/gate-results.json`.

| Suite | Passed / total | Elapsed seconds |
|---|---:|---:|
| scenario-domain | 77 / 77 | 9.08 |
| presentation | 47 / 47 | 0.78 |
| pause-policy | 54 / 54 | 1.39 |
| cartography | 73 / 73 | 5.67 |
| domain | 76 / 76 | 6.4 |
| growth-stress | 3 / 3 | 10.85 |
| earned-progression | 8 / 8 | 3.44 |
| legacy-v5 | 133 / 133 | 6.75 |
| legacy-v6 | 52 / 52 | 11.44 |
| legacy-v8 | 88 / 88 | 13.93 |
| quality-v9 | 31 / 31 | 1.51 |
| foundation-v9 | 31 / 31 | 12.57 |
| legacy-schemas | 19 / 19 | 3.13 |
| scenario-schema-cli | 21 / 21 | 5.52 |
| release | 53 / 53 | 4.36 |
| browser | 89 / 89 | 21.82 |
| browser-contracts | 16 / 16 | 10.13 |

## What was actually exercised

The new scenario suite validates both packs and four starting scenes, reversed JSON property order, reversible library staging, unknown fields, malformed input, world references, disconnected layouts, protected sites, fresh and captured states, corruption/stale-review checks and exact simulation continuation. It compares 4,761 terrain cells to the authentic v14 geometry fixture and six generated legacy layouts. Separate navigation foundations perform 8,432 route comparisons; these are subcases, not additional inflated test totals.

Legacy regression suites cover physical logistics, work interruption, RPG/quests, housing, prestige, map gating, market deliveries and deterministic restoration. Six-creature stress scenarios retain their source-defined durations in the detailed JSON logs. The automated earned-progression controller completes its first expansion and physical market sale through normal commands; this is reachability evidence, not human pacing validation.

Current browser checks use actual inputs and DOM/layout inspection: pan exposed world, keyboard focus between panel and canvas, category/search/draft state, explicit second-creature assignment, real blueprint placement, real save/pack downloads/uploads, cancellation of delayed reads, changed scene confirmation, independent single-pack build launch, and six sizes (1440×900, 1024×768, 768×1024, 390×844, 320×568, 844×390). No uncaught JavaScript errors or HTTP/HTTPS requests were observed in the tested main flows.

An actual browser save was captured from the supplied v14 artifact with hash `3ee1c7f043f2c0e8a1fff3720ede5cf63950793857f89ea9fb141a7619824b0d`; the fixture is `source/fixtures/actual-v14-story.json`. Authentic older fixtures are retained and tested separately. Ordinary legacy stories retain native format 8; scenario-aware stories use outer envelope 9.

## Gate integrity and historical assertions

Every suite result is removed before that suite runs. Nonzero exits, missing results, mismatched counts, explicitly failed cases or artifact changes fail the gate. A harness failure caused by a legacy result omitting `total` was corrected by deriving its total from its explicitly returned case array, still requiring zero failures. The entire gate was rerun afterward. Its successful result is the one counted here.

The historical v10–v14 browser scripts and per-version title/hash assertions are not all rerun: some assert the removed full-screen Build/Tutorial model or former bundle identity. Their domain regression suites remain active; all prior pure presentation and pause behavior assertions are retained in v15-specific suites with updated preservation pins. This 871-check gate should not be described as all former 1,100 checks plus new tests. No native Motorsport Manager runtime or integration code is changed, so its unrelated Godot gate was not executed.

## Limits

Testing uses headless Chromium via Playwright and `page.set_content`. Actual captures use the bundled software renderer. Hardware GPU/WebGL behavior and performance, Safari, Firefox, native local-file autosave, physical touch devices, screen readers, localization, human comprehension and enjoyment are not verified. No FPS or full accessibility compliance claim is made. Input schema checks do not establish security certification. Theme contrast remains an author responsibility for arbitrary custom palettes.

The delivered source is independently extracted and rebuilt during packaging; that result and artifact/archive checksums are recorded in the delivery manifest, rather than counted as new gameplay tests.
