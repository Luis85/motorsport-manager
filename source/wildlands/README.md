# Wildlands — TypeScript game prototype maker

Wildlands is a standalone TypeScript game prototype maker. **Littlewild** is its default playable showcase; **Emberworks** and **Office** demonstrate alternate settings using the same simulation and authoring tools. The browser provides the workspace, and the CLI provides project automation for developers and AI agents. The first engine target is a runnable Godot desktop project.

Development stays in `source/wildlands/` inside Motorsport Manager. This folder remains a separate npm project with its own build, tools and verification; it does not share the native Motorsport Manager game's simulation or UI. Existing `LW*` APIs, scenario IDs and versioned save formats remain compatible.

To script projects or build games without installing anything, run the checked-in single-file engine CLI `bin/wildlands` from the repository root with Node.js 22+. It carries no game: games are data-only folders under [`docs/concepts/`](../../docs/concepts/README.md), and `bin/wildlands build-game --game docs/concepts/<id> --output demos/<id>.html` turns one into a self-contained, ready-to-play HTML file (the checked-in [`demos/`](../../demos/README.md)). The [Wildlands CLI handbook](../../docs/reference/wildlands-cli.md) covers every command.

See [WILDLANDS.md](WILDLANDS.md) for the project workflow, terminal interface, Godot compiler contract and current limits. The [documentation index](DOCUMENTATION.md) separates task guides and contracts from source-bound Littlewild records.

The incremental ECS migration now covers actor dynamics, task movement, physical world logistics, production settlement, atomic economy/progression settlement, explicit engine composition, command boundaries, and versioned simulation profiles. Native state remains format 8. Scenario-aware saves use envelope 10; obsolete story envelopes and scenario schema versions are rejected. See `ECS-ARCHITECTURE.md`.

## Skill trees

Littlewild companions have independent branching skill trees. Open **Learn → Skill trees** to inspect XP, spend earned points and choose a work or learning path. The engine also supports trees on the guide and arbitrary validated trees through the developer toolbox. Definitions and progress travel with saves and scenarios. See the [skill-tree contract](../../docs/reference/skill-trees.md).

## Developer toolbox

The typed Node SDK and browser `LWDeveloper` global expose validated commands,
fixed-step session ownership, detached inspection, scenario/story review and
asset/creature discovery. After `npm run build`, run `npm run toolbox -- --seconds 5`.
See [DEVELOPER-TOOLBOX.md](DEVELOPER-TOOLBOX.md) for the API and coding-agent guide,
and [EXCALIBUR-TOOLBOX-REVIEW.md](EXCALIBUR-TOOLBOX-REVIEW.md) for the source review
that informed the interface.

## Play

Open [`demos/rts-frontier.html`](../../demos/rts-frontier.html) for the separate isometric RTS match (in the composite showcase fixture, **RTS demo** in the toolbar opens it and **Return to colony** restores the colony workspace). Its validated JSON catalog defines units, buildings, terrain, resources, research, items, abilities and missions over the shared ECS. Follow the [RTS demo tutorial](../../docs/tutorials/rts-demo.md) and [engine reference](../../docs/reference/rts-engine.md) for controls, developer tools and current limits.

Open [`demos/pocket-pet.html`](../../demos/pocket-pet.html) (or **Pet demo** in the showcase fixture's toolbar) to raise an original tamagotchi-style
virtual pet in a 3D room. A validated catalog drives needs, digestion, sleep,
sickness, care mistakes, growth and two adult forms on the shared ECS. Coins buy
skins and socketed accessories; premium offers unlock through a replaceable store
adapter (the bundled one is simulated). The demo
owns its own clock and checkpoints, and `npm run pet` runs bounded caretaker
experiments. Every pet and prop model is a [Scene Forge](../scene-forge/README.md)
recipe exported with `forge3d littlewild sync`. Follow the
[Pocket Pet tutorial](../../docs/tutorials/pocket-pet-demo.md), the
[engine reference](../../docs/reference/pet-engine.md) and the
[asset workflow](../../docs/how-to/scene-forge-littlewild-assets.md).

In an RTS studio build (`bin/wildlands build-game --game docs/concepts/rts-frontier --profile studio --output rts-studio.html`), choose **Mission editor** in the RTS toolbar to author terrain, placements,
objectives and mission settings in a separate validated catalog draft. Undo/redo
and complete JSON import/export retain the authoring boundary; explicitly playing
the draft creates a paused fresh match. Follow the [mission authoring guide](../../docs/how-to/rts-mission-editor.md).
To generate content instead, `bin/wildlands generate discover` lists the
procedural generators: `generate rts-mission` adds a playable, point-symmetric
mission to an RTS game folder and `generate adventure-quests` adds quests with
loot tables to a colony game, both from what the game already defines and through
a dry run or a digest-guarded, validated write (see the
[handbook](../../docs/reference/wildlands-cli.md#generate)).

Open a ready-to-play demo from the repository's [`demos/`](../../demos/README.md) in a full desktop browser: `littlewild.html`, `emberworks.html`, `office.html`, `rts-frontier.html` or `pocket-pet.html`. Each file carries one game and runs from disk; no server, network, account, API key, asset download, install or build is needed. In Littlewild, choose **A first morning** for earned progression or **A charted home** for the existing multi-creature demonstration. Starting a scene replaces the active story only after review and confirmation; export a backup first.

The editors, developer tools and export features below (World & Scene Editor, Creature Editor, Balancing workshop, storyboards, external editors, scenario library and Godot/engine export) are studio tools, not published demos. Build a colony game's studio on demand with `bin/wildlands build-game --game docs/concepts/<id> --profile studio --output <id>-studio.html`; under **More → Worlds & scenarios** it can import your own pack. Engine developers also get the composite showcase (every bundled game and tool in one file) as the test fixture `.generated/artifacts/showcase.html` after `npm run build`; it is not published.

Office runs indoors: Phil wins customer deals, Marty supplies the warehouse, and Angela packs and ships orders through physical production and delivery tasks. Whole scenario exports include the content libraries, creature and visual catalogs, environment, roles, workflows, interaction rules, settings, and captured state. See [OFFICE-SCENARIO.md](OFFICE-SCENARIO.md) for editing and programmatic import/export.

Creature interactions include autonomous friendly duels, authored trigger rules, and player controls to seek or stage a duel. **More → Settings** independently enables duels and quests. See [CREATURE-INTERACTIONS.md](CREATURE-INTERACTIONS.md) and [RULES.md](RULES.md) for the supported rules and extension points.

Visit a completed building to see its interior, select floors and request item or equipment production at a workstation. Companions travel through the same saved rooms and stairs while carrying out their work. The building designer supports custom floors, walls, windows, doors and staged improvements; companions source materials and build them. **More → Terraform this world** edits grass, water, height and living resource sources through a validated preview. These features persist in whole scenario exports. See [building interiors](BUILDING-INTERIORS.md), [freeform construction](FREEFORM-BUILDING.md) and [terrain editing](TERRAFORM.md).

**More → Worlds & scenarios → Open World & Scene Editor** opens a separate revisioned pack draft. Its world/scene tree, placement grid and inspectors edit worlds, child levels, canonical creatures, buildings, item quantities, props, entry rules and connections. Connections can cross worlds within the pack; visiting a connected level checkpoints unfinished work for a later return. Worlds share the pack's content catalogs and have their own terrain and environment settings. Building floors and islands reference their existing native state. See [WORLD-SCENE-EDITOR.md](WORLD-SCENE-EDITOR.md) and [WORLD-SCENE-RUNTIME.md](WORLD-SCENE-RUNTIME.md) for authoring, transition and persistence contracts.

Developers can register a renderer factory and select it programmatically through the browser renderer host. The current **basic** renderer remains the default. Scenes select 2D or 3D; actual PixiJS and ExcaliburJS are additional 2D options. A 3D scene may display another 2D scene as an observational minimap or panel. Plugins receive detached scene data and validated command ports. See [RENDERERS.md](RENDERERS.md) for the lifecycle contract and runnable example.

The **3D Creature Editor** edits appearance, body parts, archetype tuning, future companion defaults and current character values in a detached draft, with JSON import/export and reviewed application. The World & Scene Editor exchanges files with **Tiled, LDtk, Blender/Godot via glTF/GLB, Obsidian Canvas and Advanced Canvas**. See [CREATURE-EDITOR.md](CREATURE-EDITOR.md) and [EXTERNAL-EDITORS.md](EXTERNAL-EDITORS.md) for programmatic APIs and supported format limits.

**Storyboards & timelines** keeps ordered story notes beside normal scenes and cutscenes across worlds. Cutscenes animate scene entities and cameras in a detached 2D/3D preview. Scene entry rules, timed cues and completion events can request reviewed scene changes or play another cutscene. Pinned **p5.js** supplies deterministic presentation presets through a replaceable, typed animation registry driven by the existing application clock. See [STORYTELLING-EDITOR.md](STORYTELLING-EDITOR.md), [STORYTELLING.md](STORYTELLING.md) and [p5 provenance and source](vendor/P5-VENDOR.md).

The Wildlands compiler exports a **runnable Godot project** with a native presentation adapter and the authoritative TypeScript simulation bundled for a local Node subprocess. Scenario data, owner checkpoints, assets and supported command behavior travel with the project. Native Littlewild includes personality appearances, equipment, task feedback, building-floor inspection and authored guidance. This desktop target requires Godot and Node; native presentation does not reproduce every browser editor or renderer. See [WILDLANDS.md](WILDLANDS.md).

The existing **engine JSON document** remains a separate inert code-generator input: canonical scenario data and checkpoints, implementation sources, contracts, assets, schemas, licenses and a Godot mapping manifest. A pure GDScript semantic port remains separate work. See [ENGINE-EXPORT.md](ENGINE-EXPORT.md) for the distinction.

Edit the Littlewild game folder's [content/balancing.json](../../docs/concepts/littlewild/content/balancing.json) for default gameplay tuning, or open the editor's **Balancing workshop** to review changes and compare seeded experiments. Creature tuning overlays retain archetype identity and discovery in the assets folder. Complete packs and saved stories keep their captured overrides. See [BALANCING.md](BALANCING.md) for JSON, CLI and SDK workflows.

**Build** opens a non-modal catalog beside the world. Search a researched blueprint, choose a builder and approach, then choose a location. Drag/zoom the world normally. **F6** switches focus between the world and an open panel. **Escape** closes the panel or cancels placement. **Guide** opens a compact, resumable tutorial; Show me links to the relevant existing controls without completing tasks.

The existing **Pause when opening panels** device preference also covers these panels. Manual pause wins. Replacement reviews remain safety pauses even with automatic pausing disabled.

## Build and verify

Littlewild's authored executable source is TypeScript. JavaScript under `.generated/` is disposable compiler output; the pinned distributions under `vendor/` are third-party code.

```sh
npm ci --no-audit --no-fund
npm run typecheck
npm run architecture

npm run build
# A separate, single-pack composite using the same compiled runtime (--pack needs --output):
npm run build -- --pack ../../docs/concepts/emberworks/content/emberworks.pack.json --output emberworks.html
# The engine CLI and the published demos (never written by npm run build):
npm run build:cli && npm run build:demos
npm run check:cli && npm run check:demos

npx playwright install chromium
npm run verify
# Additional native export checks; requires Godot on PATH or WILDLANDS_GODOT:
npm run verify:godot
# Skip browser suites only for an explicitly partial local check:
npm run verify -- --no-browser
```

`npm run build` compiles once, then `source/tools/artifact-assembler.cts` assembles every profile in `source/tools/artifact-profiles.cts`. Each profile selects bundle tags from `source/tools/build-inserts.cts` (canonical load order), a template under `source/templates/` and its data globals. It writes the full composite showcase `.generated/artifacts/showcase.html` (the browser suites' test fixture; decision D1 retired the tracked `littlewild.html`) plus `.generated/artifacts/studio.html` and the minified play artifacts `colony-play.html`, `rts-play.html` and `pet-play.html`, each with a `.manifest.json`. Play artifacts never embed the engine-source or Godot runtime payloads. `colony-play` carries no editors, developer, export or RTS/Pet template bundles and declares an explicit `LWGameProfile` (`littlewild` namespace, legacy save keys); the studio carries no RTS/Pet templates; `pet-play` omits the colony asset catalog. The architecture check also requires every global a module declares as required in its `inputRoot` shape to be published inside each profile. `npm run build -- --profile ID [--output FILE]` builds one artifact; `--pack FILE` requires `--output`. `npm run report:artifacts` prints a JSON size breakdown per insert, bundle, data global and compressed payload, including `bin/wildlands`.

`typecheck` runs strict TypeScript checks, including shared declarations and dependencies. The former 15-module compatibility typing debt inventory is empty. `architecture` enforces TypeScript-only authored executables, DDD bounded-context ownership, dependency direction, data-only scenario/configuration inputs, and domain/application isolation from DOM, storage, network, wall-clock and ambient RNG APIs. `verify` compiles the complete TypeScript source tree, rebuilds the artifacts (including the showcase fixture), validates the bundled 3D asset catalog, then runs the generated Node and Playwright suites.

## Documentation

- `QUALITY-AUDIT.md`: source-bound PR25 correctness, test, refactoring and pipeline audit.

- `CONFIGURATION.md`: scenario-schema 2, simulation-profile authoring, world/scene configuration, current formats and engine boundaries.
- `UI-RESEARCH.md` and `UI-REVIEW.html`: research, observed baseline and actual captures.
- `VERIFICATION.md`: recorded PR25 Littlewild checks, source identities and limitations; it does not certify later Wildlands changes.
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


## Business process scenes

`bin/wildlands process discover` exposes definition-first agent tools for business processes. [Agency delivery](../../docs/concepts/agency-delivery/README.md) holds seven synthetic processes in one offline 2D/3D HTML with a process switch: the agency pipeline (step scenes, shared resources, parallel design and rework), an agile vendor project, an order fulfilment line, a customer journey, a user journey, a loan application converted from the BPMN 2.0/BPSim example in [`examples/bpmn/`](examples/bpmn/README.md) and a product team's weekly delivery and release train. BPMN 2.0 import and export, including BPSim scenarios, work in the CLI and in the studio (import through its **Import BPMN** dialog). The studio's **Present** mode and `process slides` explain a process as a slide deck, and `process diff` compares two definitions. Read the [contract](../../docs/reference/business-process-engine.md) and [workflow](../../docs/how-to/business-process-authoring.md).
