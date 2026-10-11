# Armored Platoon capability inventory — 10 October 2026

> Historical record. This document is not a current capability or verification claim.

Historical implementation audit of base `749a9f6296f3beb665eedf1eda57ae8cbfd00b39`.
This records inspected source capabilities and one environment probe, not a final
verification pass, reference fidelity approval, or a completed game. Later working
tree modules and results require their own exact-source evidence. The integrator's
base-selection record establishes upstream ancestry.

## Source-linked starting inventory

| Requirement | Classification | Inspected authority and consequence |
|---|---|---|
| Plain ECS records, explicit stepping, deterministic system ordering | Reuse | [ecs.ts](../../source/wildlands/source/ecs.ts). Deferred structural publication does not roll back arbitrary record mutation. |
| Commands, detached views, application clock, checkpoint boundary | Extend pattern | [rts-session.ts](../../source/wildlands/source/rts-session.ts), [rts-application.ts](../../source/wildlands/source/rts-application.ts). Retain RTS 0.1-second tick and old saves; armored gets separate versioned authority and 1/60-second step. |
| Physical tracked chassis, contacts, suspension, collision, uneven-ground support | New implementation | [rts-navigation.ts](../../source/wildlands/source/rts-navigation.ts) is 2D kinematic navigation, not tracked physics. A deterministic custom motor requires physical and reference calibration; it cannot claim a proven rigid-body solver. |
| Ballistic flight, armor regions, crew/components, smoke | New implementation | [rts-systems.ts](../../source/wildlands/source/rts-systems.ts) follows targets with 2D projectiles and scalar damage; it is not the requested combat model. |
| Footprint navigation, platoon handover and orders, perception | Extend/new | Existing RTS navigation and commands demonstrate ownership patterns; full 3D footprint routing, visibility and combat-aware formation semantics require new contracts and evidence. |
| Perspective tank cameras and stable Three.js battle presentation | Extend/new | [world-3d.ts](../../source/wildlands/source/world-3d.ts) supplies browser WebGL presentation patterns. [rts-renderer.ts](../../source/wildlands/source/rts-renderer.ts) is Canvas2D isometric. Neither is a production armored renderer. |
| Reproducible models, portable meshes, authored articulations | Reuse/extend | [Model Forge handbook](../reference/model-forge-cli.md), [kernel](../../source/model-forge/src/kernel). Model documents, geometry compilation and portable exports exist; production texture/import/animation capabilities must be admitted explicitly. |
| Battlefield composition and repeatable scene export | Reuse/extend | [Scene Forge handbook](../reference/scene-forge-cli.md). Scene Forge imports the Model Forge kernel through bridges; runtime terrain/colliders/navigation need a validated compilation boundary. |
| Crew presentation | Extend/unverified | [Character Studio handbook](../reference/character-studio-cli.md). Existing companion authoring and exports do not establish human WWII crew assets, exposed-station hit volumes or production skeletal animation. |
| Production animated glTF import | Unsupported in existing exchange codec | [external-editor-gltf.ts](../../source/wildlands/source/external-editor-gltf.ts) is static proxy interchange and rejects skins, animations and required extensions. Do not relabel it a production model loader. |
| Data-only game folder, offline HTML, registered artifact lifecycle | Extend | [game-folder.cts](../../source/wildlands/source/tools/game-folder.cts), [game-manifest.cts](../../source/wildlands/source/tools/game-manifest.cts), [artifact-profiles.cts](../../source/wildlands/source/tools/artifact-profiles.cts). Add an armored template; preserve closed inventory and bounded admission. Binary asset streaming is not supplied by the existing UTF-8 folder contract. |
| Content ownership and versioned data admission | Reuse/extend | [content-provider.ts](../../source/wildlands/source/content-provider.ts), [runtime contracts](../../source/wildlands/RUNTIME-CONTRACTS.md). Install one profile, validate owned sections, keep game policies in the game folder. |
| Multiplayer authority, reconnect, transport, lobbies | New implementation/unsupported baseline | Inspected RTS application is local; no inspected module establishes an authoritative armored server, transport or synchronization protocol. |
| Full reference vehicle/mission roster, campaign tuning, audio and presentation parity | Unverified | Requires the dated reference ledger, independent licensed/authored assets, installed-reference measurements and motion comparison. Existing tests and software-rendered screenshots do not establish these outcomes. |

## Required integration and verification registrations

The integrator owns shared registrations. New files alone do not enter production:

- `source/wildlands/source/tools/game-manifest.cts`, `game-folder.cts`,
  `game-build.cts`, `artifact-profiles.cts`, `build-inserts.cts`, and `build.ts`
  admit the versioned armored folder and compile the play artifact.
- `content-provider-contracts.d.ts` and `content-provider.ts` declare/admit the
  armored section and its browser data global; consumers validate it.
- `source/architecture/domain-map.json` owns runtime/application/presentation
  modules; `contract-ownership.json` owns each declaration file.
  `data-ownership.json` gives each shipped JSON exactly one owner;
  `tools/architecture-data.cts` registers its compiled validator role.
  Engine schemas also require `architecture/engine-data.json` admission.
- `tsconfig.strict.json` explicitly includes new strict-checked sources.
- `source/verification/suites.json` registers executable suites and output paths;
  `gate-expectations.json` records exact named checks. Fixed sleeps are forbidden.
- Rebuild generated `bin/wildlands` and all `demos/` after source changes; do not
  hand-edit outputs. Kernel changes require both Model Forge and Scene Forge
  bundle rebuild/checks. Their change owners determine relevant regression suites.

Required Wildlands sequence is serialized by the integrator: typecheck,
architecture, build, focused new and legacy RTS checks, complete `npm run verify`,
`build:cli` / `check:cli`, `build:demos` / `check:demos`. Validate the game folder
with the rebuilt CLI. Run root `scripts/check_docs.py` and architecture checks;
record absent native Godot/full-game regressions rather than implying they passed.
No build or suite has been run by this inventory work.

## Available verification environment and limits

An independent Playwright launch on 10 October 2026 used Node `v24.19.0`, existing
project dependencies and `/usr/bin/chromium` (`HeadlessChrome/151.0.0.0`). A fresh
canvas returned a WebGL2 context. The observed renderer was
`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`.
The development host reports Linux 6.18.44 x86_64, glibc 2.41, Intel Xeon
Platinum 8573C, five logical CPUs and 18,440,136 kB total RAM. This is software
rendering, not representative GPU hardware or an FPS acceptance result. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` for the existing
browser harness; it already supplies the SwiftShader flags. No dependency install
or shared generated-output build was performed for this probe.

Browser M0 acceptance must load the compiled game artifact, begin a mission,
observe actual fixed-step motion from keyboard intent, separate camera/aim state,
emit and consume a real shot, exercise platoon handover and orders, pause without
query/draw ticking, save/restore transactionally, and retain valid state across
view changes. Capture rendered chase/optics/UI and console/network diagnostics.
Tests should use condition waits or frame counts, never fixed sleeps. These checks
prove only their bounded scenarios; full fidelity, mission completion, hardware
budgets, human playtesting and multiplayer require additional evidence.
