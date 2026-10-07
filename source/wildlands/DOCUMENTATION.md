# Wildlands documentation index

Wildlands is a separate TypeScript game prototype maker with Littlewild as its
default showcase. Its browser workspace, terminal tools and Node-backed Godot
desktop target retain their own runtime and evidence, isolated from the native
Motorsport Manager game. Development stays in this folder. These routes organize
the existing documents by reader need without changing published identities or
turning earlier Littlewild acceptance into verification of Wildlands.

## Entry points

- [Wildlands overview and Littlewild showcase](README.md)
- [Project workflow, terminal/AI interface and Godot target](WILDLANDS.md)
- [Wildlands CLI handbook for `bin/wildlands`](../../docs/reference/wildlands-cli.md)
- [Current validation procedure and export acceptance criteria](WILDLANDS.md#validation-and-development)

## Authoring and task guides

- [Isometric RTS demonstration](../../docs/tutorials/rts-demo.md)
- [Graphical RTS mission authoring](../../docs/how-to/rts-mission-editor.md)
- [Pocket Pet virtual-pet demonstration](../../docs/tutorials/pocket-pet-demo.md)
- [Author Littlewild assets in Scene Forge](../../docs/how-to/scene-forge-littlewild-assets.md)
- [Developer toolbox](DEVELOPER-TOOLBOX.md)
- [Central balancing and experiments](BALANCING.md)
- [Office: a complete portable scenario](OFFICE-SCENARIO.md)
- [Building visits and floor production](BUILDING-INTERIORS.md)
- [Authored buildings and staged improvements](FREEFORM-BUILDING.md)
- [Terraform the current world](TERRAFORM.md)
- [World & Scene Editor](WORLD-SCENE-EDITOR.md)
- [World & Scene Editor surface](SCENE-EDITOR-SURFACE.md)
- [Littlewild 3D Creature Editor](CREATURE-EDITOR.md)
- [Creature editor surface](CREATURE-EDITOR-SURFACE.md)
- [Offline external editor exchange](EXTERNAL-EDITORS.md)
- [Obsidian Canvas scene interchange](OBSIDIAN-CANVAS.md)
- [Storyboard and timeline authoring](STORYTELLING-EDITOR.md)

## Runtime and format references

- [Player and creature skill trees](../../docs/reference/skill-trees.md)

- [Data-driven ECS RTS engine and tools](../../docs/reference/rts-engine.md)
- [Pocket Pet engine, catalog and tools](../../docs/reference/pet-engine.md)
- [Configurable experiences — authoring contract 2](CONFIGURATION.md)
- [Littlewild v13 — Content integration compatibility](CONTENT-INTEGRATION.md)
- [Littlewild rules boundary](RULES.md)
- [Creature interactions](CREATURE-INTERACTIONS.md)
- [Runtime contracts and extension ownership](RUNTIME-CONTRACTS.md)
- [Scene journeys and native world authority](WORLD-SCENE-RUNTIME.md)
- [Programmatic world renderers](RENDERERS.md)
- [Scenes, cutscenes and storyboards](STORYTELLING.md)
- [Complete engine input for code generation](ENGINE-EXPORT.md)

## Architecture and design explanation

- [Littlewild ECS architecture](ECS-ARCHITECTURE.md)
- [Littlewild 3D asset architecture](ASSET-ARCHITECTURE.md)
- [Littlewild Creature Architecture](CREATURE-ARCHITECTURE.md)
- [Littlewild systemic design and developer boundaries](SYSTEMIC-DESIGN.md)

## Asset and third-party provenance

- [Littlewild 3D assets](source/assets/README.md)
- [Creature assets](source/assets/creatures/README.md)
- [Offline 2D renderer libraries](vendor/RENDERER-VENDORS.md)
- [p5.js 2.3.4](vendor/P5-VENDOR.md)

## Dated implementation, review and delivery records

These historical records describe their named revisions, measurements and
limitations. They do not establish acceptance for a later source. Follow the
[current validation procedure](WILDLANDS.md#validation-and-development) to check a
Wildlands checkout; the PR25 records retain their original Littlewild scope.

- [PR25 Littlewild verification and source identities](VERIFICATION.md)
- [PR25 Littlewild portable worlds, storytelling and developer tools](PULL_REQUEST.md)
- [Littlewild ECS, data-driven architecture and game-pattern research](ARCHITECTURE-RESEARCH.md)
- [UI research and implementation rationale](UI-RESEARCH.md)
- [Excalibur patterns for the Littlewild developer toolbox](EXCALIBUR-TOOLBOX-REVIEW.md)
- [Research-informed architecture review and improvement plan](RESEARCH-IMPROVEMENT-PLAN.md)
- [v15 change log](CHANGELOG.md)
- [v15 code review and scope](CODE-REVIEW.md)
- [PR 25 code and test quality audit](QUALITY-AUDIT.md)
- [ECS M3 verified dispatch](ECS-M3-DISPATCH.md)
- [ECS M3 — world resources and physical logistics](ECS-M3-IMPLEMENTATION.md)
- [ECS M3 verification evidence](ECS-M3-RESULTS.md)
- [ECS M4 — economy, quests, and progression](ECS-M4-IMPLEMENTATION.md)
- [ECS M4 verification evidence](ECS-M4-RESULTS.md)
- [ECS M5 — explicit composition and application boundaries](ECS-M5-IMPLEMENTATION.md)
- [ECS M5 verification evidence](ECS-M5-RESULTS.md)
- [ECS M6 — versioned simulation profiles and schema evolution](ECS-M6-IMPLEMENTATION.md)
- [ECS M6 verification results](ECS-M6-RESULTS.md)
- [ECS M6 review and polishing pass](ECS-M6-REVIEW-AND-POLISH.md)
- [PR 25 — comprehensive code review and polishing pass](PR25-REVIEW-AND-POLISH.md)
- [Littlewild post-push review and polish](PR25-POSTPUSH-REVIEW.md)
- [PR #25 — TypeScript, Clean Architecture, DDD, ECS and data-driven review](PR25-TYPESCRIPT-ARCHITECTURE-REVIEW.md)
- [Independent cumulative Littlewild review — 6664900](PR25-FINAL-AUTHORING-REVIEW.md)
- [Littlewild v15 — publication record](publication/README.md)
- [Littlewild v15 verification — 29 September 2026](publication/VERIFICATION.md)

- [Business process engine](../../docs/reference/business-process-engine.md) and [agent workflow](../../docs/how-to/business-process-authoring.md).
