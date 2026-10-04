# Wildlands — TypeScript game prototype maker

Wildlands is a standalone TypeScript game prototype maker. **Littlewild** is its default playable showcase; **Emberworks** and **Office** demonstrate alternate settings using the same simulation and authoring tools. The browser provides the workspace, and the CLI provides project automation for developers and AI agents. The first engine target is a runnable Godot desktop project.

Development stays in `docs/concepts/littlewild/` inside Motorsport Manager. This folder remains a separate npm project with its own build, tools and verification; it does not share the native Motorsport Manager game's simulation or UI. Existing `LW*` APIs, scenario IDs and versioned save formats remain compatible.

See [WILDLANDS.md](WILDLANDS.md) for the project workflow, terminal interface, Godot compiler contract and current limits.

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

**More → Worlds & scenarios → Open World & Scene Editor** opens a separate revisioned pack draft. Its world/scene tree, placement grid and inspectors edit worlds, child levels, canonical creatures, buildings, item quantities, props, entry rules and connections. Connections can cross worlds within the pack; visiting a connected level checkpoints unfinished work for a later return. Worlds share the pack's content catalogs and have their own terrain and environment settings. Building floors and islands reference their existing native state. See [WORLD-SCENE-EDITOR.md](WORLD-SCENE-EDITOR.md) and [WORLD-SCENE-RUNTIME.md](WORLD-SCENE-RUNTIME.md) for authoring, transition and persistence contracts.

Developers can register a renderer factory and select it programmatically through the browser renderer host. The current **basic** renderer remains the default. Scenes select 2D or 3D; actual PixiJS and ExcaliburJS are additional 2D options. A 3D scene may display another 2D scene as an observational minimap or panel. Plugins receive detached scene data and validated command ports. See [RENDERERS.md](RENDERERS.md) for the lifecycle contract and runnable example.

The **3D Creature Editor** edits appearance, body parts, archetype tuning, future companion defaults and current character values in a detached draft, with JSON import/export and reviewed application. The World & Scene Editor exchanges files with **Tiled, LDtk, Blender/Godot via glTF/GLB, Obsidian Canvas and Advanced Canvas**. See [CREATURE-EDITOR.md](CREATURE-EDITOR.md) and [EXTERNAL-EDITORS.md](EXTERNAL-EDITORS.md) for programmatic APIs and supported format limits.

**Storyboards & timelines** keeps ordered story notes beside normal scenes and cutscenes across worlds. Cutscenes animate scene entities and cameras in a detached 2D/3D preview. Scene entry rules, timed cues and completion events can request reviewed scene changes or play another cutscene. Pinned **p5.js** supplies deterministic presentation presets through a replaceable, typed animation registry driven by the existing application clock. See [STORYTELLING-EDITOR.md](STORYTELLING-EDITOR.md), [STORYTELLING.md](STORYTELLING.md) and [p5 provenance and source](vendor/P5-VENDOR.md).

The Wildlands compiler exports a **runnable Godot project** with a native presentation adapter and the authoritative TypeScript simulation bundled for a local Node subprocess. Scenario data, owner checkpoints, assets and supported command behavior travel with the project. Native Littlewild includes personality appearances, equipment, task feedback, building-floor inspection and authored guidance. This desktop target requires Godot and Node; native presentation does not reproduce every browser editor or renderer. See [WILDLANDS.md](WILDLANDS.md).

The existing **engine JSON document** remains a separate inert code-generator input: canonical scenario data and checkpoints, implementation sources, contracts, assets, schemas, licenses and a Godot mapping manifest. A pure GDScript semantic port remains separate work. See [ENGINE-EXPORT.md](ENGINE-EXPORT.md) for the distinction.

Edit [source/content/balancing.json](source/content/balancing.json) for default gameplay tuning, or open the editor's **Balancing workshop** to review changes and compare seeded experiments. Creature tuning overlays retain archetype identity and discovery in the assets folder. Complete packs and saved stories keep their captured overrides. See [BALANCING.md](BALANCING.md) for JSON, CLI and SDK workflows.

**Build** opens a non-modal catalog beside the world. Search a researched blueprint, choose a builder and approach, then choose a location. Drag/zoom the world normally. **F6** switches focus between the world and an open panel. **Escape** closes the panel or cancels placement. **Guide** opens a compact, resumable tutorial; Show me links to the relevant existing controls without completing tasks.

The existing **Pause when opening panels** device preference also covers these panels. Manual pause wins. Replacement reviews remain safety pauses even with automatic pausing disabled.

## Build and verify

Littlewild's authored executable source is TypeScript. JavaScript under `.generated/` is disposable compiler output; the pinned distributions under `vendor/` are third-party code.

```sh
npm ci --no-audit --no-fund
npm run typecheck
npm run architecture

npm run build
# A separate, single-pack HTML using the same compiled runtime:
npm run build -- --pack source/content/emberworks.pack.json --output emberworks.html

npx playwright install chromium
npm run verify
# Additional native export checks; requires Godot on PATH or WILDLANDS_GODOT:
npm run verify:godot
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
- `WORLD-SCENE-EDITOR.md` and `WORLD-SCENE-RUNTIME.md`: visual pack authoring, nested levels, cross-world links and persistent scene journeys.
- `CREATURE-EDITOR.md`: 3D character authoring, current values, appearance and package exchange.
- `EXTERNAL-EDITORS.md`: standard editor formats, conversion APIs, CLI commands and limits.
- `STORYTELLING-EDITOR.md` and `STORYTELLING.md`: storyboards, timeline editing, presentation playback and reviewed scene events.
- `WILDLANDS.md`: product boundary, project workflow, terminal/agent use and runnable Godot export.
- `ENGINE-EXPORT.md`: inert code-generator JSON, source integrity and native-port conversion boundaries.
- `BALANCING.md`: central gameplay tuning, reviewed edits, seeded probes and bounded sweeps.

Stable mechanic executors, handlers, island dimensions and animation algorithms remain compiled capabilities. Creature defaults, spawn modes, movement/physiology tuning, visual selection, ECS bindings, geometry, appearance profiles, expression thresholds, animation tuning, rig sockets and building anchors are validated data. External scenario packs can carry complete creature and visual manifest catalogs using the supported geometry and rig grammar. Imported data cannot register executable code or new engine primitives. Littlewild, Emberworks and Office demonstrate the supported configuration surface.

## ECS refactor on PR #25

The compatibility-preserving M1–M6 plan is implemented and documented in `ECS-ARCHITECTURE.md`. The current polishing pass also makes TypeScript the authored source of truth and publishes `source/architecture/domain-map.json` as the machine-checked DDD/Clean Architecture ownership contract. The simulation section of `source/content/balancing.json` combines validated actor/economy/gameplay rule data with the exact compiled `living-world-v1` composition archetype; the earlier individual profile file is a reference mirror. Schema-2 packs may tune supported values but cannot insert or reorder systems. The normal verification gate includes isolated ECS/profile suites plus real-engine current-format rejection, deterministic resume, logistics, quest, market, progression, schema/CLI, release, and browser compatibility checks. Mature domain methods remain compatibility adapters on one stable facade, so this is not a claim that every mechanic is an isolated ECS system.

- [`ECS-M6-REVIEW-AND-POLISH.md`](ECS-M6-REVIEW-AND-POLISH.md) — final architecture review and polishing evidence.

Architecture sources and the implemented plan: [research](ARCHITECTURE-RESEARCH.md), [systemic design](SYSTEMIC-DESIGN.md), [Excalibur adaptations](EXCALIBUR-TOOLBOX-REVIEW.md), [improvement plan](RESEARCH-IMPROVEMENT-PLAN.md).

Central default tuning, the balancing workshop, CLI experiments and captured-value semantics are documented in [BALANCING.md](BALANCING.md).
