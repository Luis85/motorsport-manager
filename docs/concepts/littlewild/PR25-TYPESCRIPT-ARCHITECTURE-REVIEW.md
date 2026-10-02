# PR #25 — TypeScript, Clean Architecture, DDD, ECS and data-driven review

## Scope

- Repository: `Luis85/motorsport-manager`
- Pull request: **#25 — Littlewild v15: data-driven worlds and ECS M1–M6**
- Review branch: `concept/littlewild-v15-world-ui`
- Verified implementation head for this pass: `c8407aece0c479c2ffe0498a6e9e5bed20bfe5fc`
- Scope: `docs/concepts/littlewild/` plus the dedicated Littlewild verification workflow
- Native Motorsport Manager Godot gameplay remains outside this isolated Littlewild refactor.

This pass reviewed the existing M1–M6 implementation as one architecture. It did not treat a successful test count as proof that the implementation met the requested engineering standards. The review separately examined authored language/tooling, dependency direction, bounded-context ownership, ECS invariants, data/configuration authority, deterministic behavior, persistence, transaction boundaries, compatibility, and verification.

## Executive assessment

The pre-pass implementation already had strong deterministic and transactional behavior, extensive compatibility coverage, explicit ECS scheduling, schema-validated content, and useful migration boundaries. The largest mismatch was between those intentions and the source/tooling model: runtime code was still authored as JavaScript/CommonJS with Python build/verification utilities, architecture ownership lived mostly in documentation, and the generic ECS accepted behavior-shaped nested component data.

The polishing pass therefore made **TypeScript the authored executable source of truth**, added **machine-enforced DDD/Clean Architecture ownership**, strengthened **ECS data-only invariants**, moved active build/verification/browser/schema tooling to TypeScript, and extended **strict TypeScript checking to the architecture-critical kernel**.

This is still a compatibility-preserving strangler architecture. Four large historical application adapters remain deliberately grandfathered and are not presented as exemplary small-module Clean Code.

## Findings and resolutions

### P0 — authored Littlewild code was not TypeScript

Before this pass, the Littlewild source tree contained 57 `.js` runtime files, 36 `.cjs` test/tool files, and Python build/verification executables. Renaming files alone would not have been sufficient because the build, release checks, CLIs and browser tests still consumed JavaScript/Python sources directly.

**Resolution**

- Converted all project-authored executable Littlewild source to `.ts` / `.cts`.
- Converted active build, schema verification, release verification and Playwright browser contracts to TypeScript.
- Added a TypeScript build that emits disposable JavaScript into ignored `.generated/`.
- The standalone bundle consumes only compiler output plus static JSON/CSS/HTML and the third-party `vendor/three.js` distribution.
- Added an architecture rule that fails if authored `.js`, `.cjs`, `.mjs`, `.jsx` or `.py` executables return.

Current inventory: **99 TypeScript/CTS authored files**, **zero project-authored legacy JS/CJS/Python executables**, and one retained third-party `.js` vendor file.

### P0 — Clean Architecture and DDD ownership were convention-based

The runtime responsibilities were reasonably separated, but ownership was inferred from filenames and documentation. Nothing prevented a new runtime module from appearing without a bounded context, or a domain module from drifting toward browser/platform APIs.

**Resolution**

Added `source/architecture/domain-map.json` as the machine-readable ownership contract. Every top-level runtime module is owned exactly once by one of these contexts:

- simulation core
- actors
- physical world
- economy/progression
- content model
- simulation application
- experience application
- persistence/clock infrastructure
- presentation

The architecture gate verifies:

- all **57 runtime modules** are owned exactly once;
- no runtime module is missing or multiply owned;
- dependencies point inward only;
- domain/application modules contain no DOM, browser storage, network, timer/wall-clock or ambient-randomness dependencies;
- imported simulation/scenario JSON contains no executable-shaped fields;
- generated JavaScript stays outside authored source.

### P0 — active tooling contradicted the TypeScript architecture

The previous build used Python to concatenate JavaScript and the source gate mixed Node, Python/jsonschema and Python Playwright. That left two implementation languages governing the same release boundary.

**Resolution**

- `source/build.ts` now compiles the TypeScript tree and constructs the offline HTML from generated code.
- `source/verification/verify-v15.ts` is the authoritative product gate.
- Schema checks use TypeScript + AJV.
- Browser verification uses Playwright TypeScript.
- The Littlewild GitHub workflow installs the Node toolchain, runs strict type checking and architecture checks, compiles, rebuilds and then executes generated runtime/test code.
- Retired one-time Python publication/capture executables were removed. The retained `publication/` directory is historical evidence only.

### P1 — ECS “components are data only” was not enforced generically

`World.set()` originally checked only that the outer component payload was a plain object. A caller could still store a nested function, accessor, class instance or other behavior-bearing object while the architecture documentation claimed otherwise.

**Resolution**

The ECS kernel now rejects:

- nested functions and other non-data primitives;
- getters/setters;
- class instances and non-plain nested objects;
- symbol-keyed payloads;
- cyclic data;
- non-finite numeric values.

Component query/system component names are validated, and duplicate component requirements in one system definition are rejected. Regression tests cover those invariants.

### P1 — strict TypeScript could have been cosmetic

A complete legacy codebase cannot safely become strict TypeScript in one mechanical pass without either huge behavior risk or pervasive `any`/suppression. A `.ts` extension alone would therefore have been a weak result.

**Resolution**

The build transpiles the compatibility modules without semantic drift, while `tsconfig.strict.json` gives full strict checking to the architecture-critical seams:

- `ecs.ts`
- `command-router.ts`
- `simulation-pipeline.ts`
- `simulation-profile.ts`
- `build.ts`
- `tools/architecture-check.cts`

The ECS/command kernel and simulation pipeline/profile contracts were rewritten with explicit types rather than suppressions. The remaining mature compatibility modules are a staged typing/decomposition backlog, not claimed as fully strict.

### P1 — 3D model ownership was still interleaved with renderer code

The architecture correctly classified the renderer as presentation, but building meshes, resource props, carried items and the companion body/equipment rig were still constructed through hard-coded renderer branches. That made visual refinement risky and forced renderer edits for ordinary model work.

**Resolution**

- Added `source/assets/buildings/<id>/asset.json`, `items/<id>/asset.json`, and `actors/<id>/asset.json`.
- Added 67 isolated manifests: 24 building assets, 42 item/environment/equipment assets, and the Sproutling actor.
- Added `asset-catalog.ts` for validation/freeze/indexing and `asset-renderer.ts` as the generic primitive-scene interpreter.
- Building manifests now own complete meshes plus optional door, rotor and smoke anchors.
- Item manifests can expose `world`, `depleted`, `carry`, and `equipped` variants.
- The actor manifest owns body geometry, named rig nodes and equipment/carry sockets; `world-fidelity.ts` is reduced to pose/expression/attachment behavior.
- World hit heights and static-geometry invalidation now read asset metadata/revisions.
- Refined the current models with clearer silhouettes and purpose cues: differentiated homes/workplaces, dedicated study/loom/smelter interiors, improved market/well/waterwheel/mill/observatory props, richer resources, carried goods, equipment, shoreline props and biome tree variants.
- Asset JSON remains build-time bundled data. Scenario/story imports cannot add systems, code or arbitrary asset manifests.

The asset gate verifies path/identity alignment, model coverage for every gameplay building/item/equipment definition, actor rig/socket completeness, data-only payloads and catalog immutability.

### P1 — renderer ownership was mislabeled as application logic

The first DDD ownership pass mapped `world.ts` as an application compatibility adapter. Source inspection showed that the module is the isometric canvas renderer/view: it owns canvas creation, resize observation, camera/hover/placement presentation and browser globals. Keeping it in the application layer would either fail the platform-boundary gate or normalize presentation leakage.

**Resolution**

- Moved `world.ts` to the presentation bounded context.
- Removed it from the oversized application compatibility exceptions.
- Added an architecture check that domain-owned modules cannot register composition/application hooks.
- Reclassified `planner.ts` and `cartography.ts` as application orchestration because both operate through the engine composition/facade.

### P1 — large legacy modules remain difficult to reason about

The source still contains mature application adapters substantially larger than the preferred module scale.

**Resolution**

A **40 KB domain/application module budget** is now enforced. Only four named compatibility modules are grandfathered, each with an explicit migration reason:

- `engine.ts`
- `colony.ts`
- `systems.ts`
- `world-simulation.ts`

Any new domain/application module exceeding the budget fails architecture verification instead of silently increasing the monolith.

This is a guardrail, not a claim that those four files are already cleanly decomposed.

### P1 — data-driven architecture needed a clearer authority boundary

The pre-pass implementation already validated actor/economy rules and scenario/profile JSON and blocked imported code. The review confirmed the important distinction between **data-driven configuration** and **arbitrary runtime composition**.

**Resolution / confirmation**

- Scenario/content input remains plain validated JSON.
- Numeric actor/economy tuning is profile data.
- World/content definitions remain schema-validated data.
- Runtime system topology and command handlers remain compiled capabilities.
- A profile may select only the exact supported `living-world-v1` topology; it cannot add/reorder systems or inject callbacks/modules/source.
- Existing engine instances capture immutable validated profiles.
- Scenario/story review fingerprints bind the exact reviewed profile/context.
- The simulation profile and high-level pipeline are now part of the strict TypeScript gate.

A small set of historical compatibility defaults remains compiled in legacy facades and the explicitly labeled partial-construction fallback. The branch therefore does **not** claim that every historical tuning literal has already been extracted into data.

## Architecture assessment

### TypeScript

**Enforced for authored executables.** Static JSON/CSS/HTML remain their appropriate formats and bundled Three.js remains third-party JavaScript. Generated JS is ignored build output.

### Clean Architecture

The target dependency direction is now explicit:

`domain ← application ← infrastructure ← presentation`

The compatibility facade still uses the historical global `LW` composition surface, but domain/application modules are prevented from depending outward on presentation/platform concerns. This keeps the current standalone format compatible while giving future extraction a measurable direction.

### Domain-driven design

The bounded contexts are explicit in the domain map rather than inferred from menus or class names. Stable domain IDs remain identities; display names and array positions are not identity. Application commands route intent into domain behavior rather than allowing UI mutation of ECS state.

The design is pragmatic DDD rather than ceremony-heavy DDD: existing save records remain authoritative aggregates during migration, and the ECS binds to those records instead of introducing a second persistence model.

### ECS

The ECS foundation retains the important invariants:

- stable entity IDs;
- data-only components;
- deterministic query order;
- explicit phase/order scheduling;
- deferred structural changes;
- all-or-nothing structural batch validation;
- transient ECS runtime over authoritative save records;
- no rendering/storage/network/wall-clock authority;
- injected/explicit randomness rather than ambient RNG;
- domain-owned transaction rollback for value mutations that can fail.

Actor activity, physical-world settlement and economy/progression use the ECS where ECS composition/system iteration adds value. The code deliberately does not turn every immutable definition or UI record into an entity.

### Data-driven design

The configuration path is bounded and testable rather than “JSON can do anything.” Schemas/profile validators define the data contract, while executable capabilities remain code. This is safer and more maintainable than allowing data packs to register arbitrary systems or handlers.

## Testing assessment

The verified TypeScript implementation head passed **1,053 / 1,053 checks across 31 suites**, including **8 / 8 dedicated asset-catalog checks** and **105 / 105 browser contracts**. The previous pre-TypeScript head passed **1,006 / 1,006 across 27 suites** and is retained only as a behavioral regression baseline.

The TypeScript pass adds or strengthens:

- strict compiler checks for the architecture kernel;
- **16 architecture/DDD checks**;
- 8 dedicated 3D asset catalog/coverage/immutability checks;
- ECS behavior-free-component tests;
- invalid query/system-shape tests;
- TypeScript-only source inventory checks;
- bounded-context completeness/uniqueness checks;
- inward dependency checks;
- deterministic/platform boundary checks;
- module-size debt checks;
- existing ECS/domain/compatibility/schema/CLI/release suites executed against compiler output;
- existing 105 browser interaction/layout contracts ported to Playwright TypeScript.

The authoritative evidence is `verification/v15/gate-results.json` produced by `npm run verify`. Workflow run `37036136280` recorded status `passed`, **1,053 / 1,053**, and standalone SHA-256 `1ab1addec4a383dd3ade1c53a33535296024ee15e5a6aaee915e8623adedfae8` for implementation head `c8407aece0c479c2ffe0498a6e9e5bed20bfe5fc`.

## Deliberate remaining debt

1. **Four large compatibility adapters remain.** They are bounded and regression-protected but should be decomposed incrementally by bounded context rather than mechanically split.
2. **Strict typing is concentrated at architecture-critical seams.** The rest of the migrated TypeScript tree is transpiled compatibility code and should gain strict types slice by slice as behavior moves out of the legacy adapters.
3. **The global `LW` facade/registries remain.** They support the self-contained browser artifact and old saves, but a future module-native runtime should inject ports/services rather than discover process-global state.
4. **Not every historic tuning literal is data-authored.** New mechanics/tuning should enter validated profile/content documents; compatibility constants should move only with parity tests and explicit migration.
5. **ECS generic scheduling is not a universal transaction manager.** Structural changes are atomic; domain systems that can fail after value mutation must continue to preflight or provide their own rollback, as economy/world settlement already do.
6. Hardware WebGL, physical touch devices, screen readers, human usability, game balance and enjoyment remain outside automated code verification.

## Handoff criteria

This polishing pass is complete only when the current PR head has:

1. strict TypeScript gate passing;
2. architecture/DDD gate passing;
3. complete deterministic/domain/regression suites passing against generated JavaScript;
4. browser contracts passing against the rebuilt standalone;
5. no regression in native repository checks triggered by the PR.

The branch documentation intentionally does not substitute the historical 1,006-check result for that current-head evidence.
