# Littlewild v15 verification

## Authoritative gate

The current Littlewild gate is the TypeScript pipeline:

```sh
npm ci --no-audit --no-fund
npm run typecheck
npm run architecture
npx playwright install --with-deps chromium
npm run verify
```

The gate compiles authored TypeScript into `.generated/`, rebuilds `littlewild.html`, runs deterministic/domain/schema/release suites against generated JavaScript, and executes the Playwright browser suites. Machine-readable evidence is produced as `verification/v15/gate-results.json`.

## Verified implementation head

Implementation head `3177396de09bbf2a7bfb5f99b2f2f88804567549` passed **670 / 670 checks across 26 suites** in GitHub Actions run `37105368075`.

Standalone artifact:

- SHA-256: `73fd6ce19eb8d810fa3f84c828196572a41ee47aa0c5d43e844d521c6918b0b5`
- bytes: **4,117,751**
- browser included: **yes**

### Suite results

| Suite | Passed / total |
|---|---:|
| TypeScript architecture | 17 / 17 |
| Behavior tree | 7 / 7 |
| Content boundary | 6 / 6 |
| Asset catalog | 8 / 8 |
| Creature catalog/factory/presentation identity | 15 / 15 |
| ECS core | 16 / 16 |
| Simulation profile | 15 / 15 |
| Simulation profile integration | 16 / 16 |
| Engine composition | 16 / 16 |
| ECS activity | 7 / 7 |
| ECS world | 11 / 11 |
| ECS economy | 12 / 12 |
| ECS integration | 7 / 7 |
| ECS world integration | 6 / 6 |
| ECS economy integration | 9 / 9 |
| Scenario domain | 69 / 69 |
| Presentation | 45 / 45 |
| Pause policy | 52 / 52 |
| Cartography | 71 / 71 |
| Domain | 76 / 76 |
| Growth stress | 3 / 3 |
| Earned progression | 8 / 8 |
| Scenario/schema CLI | 47 / 47 |
| Release | 28 / 28 |
| Browser | 89 / 89 |
| Browser contracts | 14 / 14 |
| **Total** | **670 / 670** |

## Creature and ECS coverage

The creature suite verifies the current data-driven design rather than historical migration compatibility.

It checks that:

- every `source/creatures/<id>/creature.json` is discovered and validated;
- creature definitions are immutable and executable-free;
- Adventure personality definitions cover the reusable personality set;
- actor creation is deterministic and carries explicit `{archetype, personality}` identity;
- archetype and personality compatibility is validated independently;
- ECS component bindings come from creature data and retain authoritative actor-record references;
- persistent creature defaults are completely owned by the creature manifest/factory;
- current captured scenario actors are covered by the creature-owned persistent field contract;
- every supported personality has a valid data-authored visual profile;
- actor animation and expression tuning are finite validated data;
- presentation code uses explicit archetype identity rather than personality→species inference;
- recruitment, fidelity and rendering do not reintroduce hard-coded Sproutling/variant tables;
- creature schema drift, mismatched identities and invalid spawn modes fail closed.

The ECS itself remains transient. Persistent actor records are authoritative; the ECS binds object-valued components by reference and owns deterministic system progression. `Creature`, `Activity` and `Intent` are runtime projections and are not a second save model.

## Data-driven presentation coverage

The asset suite covers **67 isolated 3D manifests**:

- 24 buildings;
- 42 items/environment/equipment assets;
- 1 actor asset.

The actor asset owns geometry, material roles, model variants, rig/socket contracts, personality appearances, expression thresholds and animation tuning. `world-fidelity.ts` owns animation algorithms and attachment behavior, not model construction or creature appearance tables.

The verified portrait fallback also uses `LWCreatures.defaultArchetype` and `LWCreatures.defaultPersonality`; the portrait cache key includes archetype identity.

## Scenario and story coverage

The current contract is deliberately current-only:

- scenario schema: **2**
- portable story envelope: **10**

Obsolete scenario/story versions are rejected rather than silently migrated. Scenario packs remain data-only and cannot register ECS systems, executable handlers, renderer assets, source modules or arbitrary runtime components.

Scenario/domain verification covers both bundled packs, current scenes, reversible library/profile staging, invalid/unknown fields, world/topology constraints, capture/relaunch, deterministic continuation and stale-review protection.

## Browser coverage

The main Playwright suite passed **89 / 89** checks and the focused browser-contract suite passed **14 / 14**.

The browser harness:

- runs under the production Content Security Policy without `unsafe-eval`;
- exercises actual world/panel input and explicit creature assignment;
- checks construction catalog/search/filter/draft behavior;
- validates real blueprint placement and per-creature policy isolation;
- exercises scenario pack export/import/capture and current story export/import;
- validates selected authored world/simulation profiles;
- checks six viewports: 1440×900, 1024×768, 768×1024, 390×844, 320×568 and 844×390;
- rejects uncaught browser errors in the covered flows;
- verifies that the game makes no HTTP/HTTPS requests during the tested flows.

## Gate integrity

Before each suite, its previous result file is removed. The gate fails on nonzero suite exit, missing results, mismatched pass/total counts, explicit failed checks, schema drift or a standalone artifact changing during verification.

Strict TypeScript and architecture checks are executed before the full gate. Current source must remain authored in TypeScript/CTS; generated JavaScript is disposable output.

Historical pre-current-format verification results may remain in repository history, but they are not evidence for the current head and are not counted in the current gate.

## Limits

Testing uses headless Chromium and the bundled standalone artifact. It does not establish:

- hardware GPU/WebGL performance;
- Safari or Firefox compatibility;
- physical touch-device behavior;
- screen-reader or full accessibility conformance;
- localization quality;
- human comprehension, pacing or game balance;
- security certification.

The automated result is implementation/regression evidence for the tested contracts, not a substitute for human usability and balance validation.
