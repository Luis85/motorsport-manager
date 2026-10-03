# Littlewild v15 — Worlds of Possibility

An offline autonomous-creature simulation showcase with compact world-facing UI and reusable JSON scenario packs. The browser prototype is isolated from the native Motorsport Manager game.

The incremental ECS migration now covers actor dynamics, task movement, physical world logistics, production settlement, atomic economy/progression settlement, explicit engine composition, command boundaries, and versioned simulation profiles. Native state remains format 8. Scenario-aware saves use envelope 10; obsolete story envelopes and scenario schema versions are rejected. See `ECS-ARCHITECTURE.md`.

## Developer toolbox

The typed Node SDK and browser `LWDeveloper` global expose validated commands,
fixed-step session ownership, detached inspection, scenario/story review and
asset/creature discovery. After `npm run build`, run `npm run toolbox -- --seconds 5`.
See [DEVELOPER-TOOLBOX.md](DEVELOPER-TOOLBOX.md) for the API and coding-agent guide,
and [EXCALIBUR-TOOLBOX-REVIEW.md](EXCALIBUR-TOOLBOX-REVIEW.md) for the source review
that informed the interface.

## Play

Open `littlewild.html` in a full desktop browser. No server, network, account, API key or asset download is needed. Choose the first scene for earned progression or **A charted home** for the existing multi-creature demonstration. Under **More → Worlds & scenarios**, switch to Emberworks or **Office**, or import your own pack. Starting a scene replaces the active story only after review and confirmation; export a backup first.

Office runs indoors: Phil wins customer deals, Marty supplies the warehouse, and Angela packs and ships orders through physical production and delivery tasks. Whole scenario exports include the content libraries, creature and visual catalogs, environment, roles, workflows, interaction rules, settings, and captured state. See [OFFICE-SCENARIO.md](OFFICE-SCENARIO.md) for editing and programmatic import/export.

Creature interactions include autonomous friendly duels, authored trigger rules, and player controls to seek or stage a duel. **More → Settings** independently enables duels and quests. See [CREATURE-INTERACTIONS.md](CREATURE-INTERACTIONS.md) and [RULES.md](RULES.md) for the supported rules and extension points.

Visit a completed building to see its interior, select floors and request item or equipment production at a workstation. Companions travel through the same saved rooms and stairs while carrying out their work. The building designer supports custom floors, walls, windows, doors and staged improvements; companions source materials and build them. **More → Terraform this world** edits grass, water, height and living resource sources through a validated preview. These features persist in whole scenario exports. See [building interiors](BUILDING-INTERIORS.md), [freeform construction](FREEFORM-BUILDING.md) and [terrain editing](TERRAFORM.md).

Developers can register a renderer factory and select it programmatically through the browser renderer host. The current **basic** renderer remains the default. Plugins receive detached scene data and validated command ports. See [RENDERERS.md](RENDERERS.md) for the lifecycle contract and runnable example.

**Build** opens a non-modal catalog beside the world. Search a researched blueprint, choose a builder and approach, then choose a location. Drag/zoom the world normally. **F6** switches focus between the world and an open panel. **Escape** closes the panel or cancels placement. **Guide** opens a compact, resumable tutorial; Show me links to the relevant existing controls without completing tasks.

The existing **Pause when opening panels** device preference also covers these panels. Manual pause wins. Replacement reviews remain safety pauses even with automatic pausing disabled.

## Build and verify

Littlewild's authored executable source is TypeScript. JavaScript under `.generated/` is disposable compiler output; the bundled `vendor/three.js` is third-party distribution code.

```sh
npm ci --no-audit --no-fund
npm run typecheck
npm run architecture

npm run build
# A separate, single-pack HTML using the same compiled runtime:
npm run build -- --pack source/content/emberworks.pack.json --output emberworks.html

npx playwright install chromium
npm run verify
# Skip browser suites only for an explicitly partial local check:
npm run verify -- --no-browser
```

`typecheck` runs strict TypeScript checks, including shared declarations and dependencies. The former 15-module compatibility typing debt inventory is empty. `architecture` enforces TypeScript-only authored executables, DDD bounded-context ownership, dependency direction, data-only scenario/configuration inputs, and domain/application isolation from DOM, storage, network, wall-clock and ambient RNG APIs. `verify` compiles the complete TypeScript source tree, rebuilds the standalone artifact, validates the bundled 3D asset catalog, then runs the generated Node and Playwright suites.

## Documentation

- `QUALITY-AUDIT.md`: current PR 25 correctness, test, refactoring and pipeline audit.

- `CONFIGURATION.md`: scenario-schema 2, simulation-profile authoring, world/scene configuration, current formats and engine boundaries.
- `UI-RESEARCH.md` and `UI-REVIEW.html`: research, observed baseline and actual captures.
- `VERIFICATION.md`: this build's executed checks and limitations.
- `CHANGELOG.md` and `CODE-REVIEW.md`: changes, module ownership and remaining coupling.
- `CONTENT-INTEGRATION.md`: existing Base/Adventure/World/Growth library contracts.
- `ASSET-ARCHITECTURE.md`: bundled data-driven 3D model folders, manifest contract, renderer boundary and authoring workflow.
- `CREATURE-ARCHITECTURE.md`: creature archetype data, factory/ECS ownership, visual asset boundary and extension workflow.
- `BUILDING-INTERIORS.md`, `FREEFORM-BUILDING.md`, `TERRAFORM.md`: spatial authority, physical work and authoring interfaces.
- `RENDERERS.md`: programmatic renderer registration, replacement, observations and cleanup.

Stable mechanic executors, handlers, island dimensions and animation algorithms remain compiled capabilities. Creature defaults, spawn modes, movement/physiology tuning, visual selection, ECS bindings, geometry, appearance profiles, expression thresholds, animation tuning, rig sockets and building anchors are validated data. External scenario packs can carry complete creature and visual manifest catalogs using the supported geometry and rig grammar. Imported data cannot register executable code or new engine primitives. Littlewild, Emberworks and Office demonstrate the supported configuration surface.

## ECS refactor on PR #25

The compatibility-preserving M1–M6 plan is implemented and documented in `ECS-ARCHITECTURE.md`. The current polishing pass also makes TypeScript the authored source of truth and publishes `source/architecture/domain-map.json` as the machine-checked DDD/Clean Architecture ownership contract. The canonical `source/content/simulation-profile.json` combines validated actor/economy rule data with the exact compiled `living-world-v1` composition archetype. Schema-2 packs may tune bounded actor/economy values but cannot insert or reorder systems. The normal verification gate includes isolated ECS/profile suites plus real-engine current-format rejection, deterministic resume, logistics, quest, market, progression, schema/CLI, release, and browser compatibility checks. Mature domain methods remain compatibility adapters on one stable facade, so this is not a claim that every mechanic is an isolated ECS system.

- [`ECS-M6-REVIEW-AND-POLISH.md`](ECS-M6-REVIEW-AND-POLISH.md) — final architecture review and polishing evidence.

Architecture sources and the implemented plan: [research](ARCHITECTURE-RESEARCH.md), [systemic design](SYSTEMIC-DESIGN.md), [Excalibur adaptations](EXCALIBUR-TOOLBOX-REVIEW.md), [improvement plan](RESEARCH-IMPROVEMENT-PLAN.md).
