# Configurable experiences — authoring contract 2

## Product boundary

The engine supplies autonomous agents, needs, learning, RPG resolution, quests, construction, production, physical logistics, relationships, housing, connected islands and progression. A **pack** supplies one setting and its authored starts. **Littlewild is a bundled showcase**, alongside Emberworks and the indoor Office scenario.

Default gameplay tuning lives in the Littlewild game folder's [content/balancing.json](../../docs/concepts/littlewild/content/balancing.json); see [BALANCING.md](BALANCING.md) for its supported paths and experiments. Creature identity and discovery remain in the co-located asset folders, with a validated numeric tuning overlay. Complete packs explicitly override defaults, and engines retain captured values. Existing core item/skill/building IDs are mechanic roles. Their names, costs, recipes and supported settings are editable; arbitrarily removing/renaming those roles or adding a new executable handler is unsupported. **3D model geometry, material roles, actor rig sockets and building animation anchors are declarative asset data.** Full scenario snapshots can carry validated visual and creature catalogs. Animation executors, mathematical rules, grid dimensions and some legacy narrative strings remain compiled.

## Supported configuration

| Concern | JSON location | Runtime effect |
|---|---|---|
| Identity | `id`, `name`, `version`, `presentation` | Window/brand title, tagline, world subtitle, selected UI accent/paper/ink |
| Complete catalogs | `resources.assets`, `resources.creatures` | Scoped validated visual/creature definitions, including nonbundled compatible bindings |
| Indoor setting | `worlds[].environment`, `nodePolicy` | Room geometry, floor/walls/background/camera and profile-only resource context |
| Role workflows | `scenes[].initialState.scenarioWorkflow` | Role-owned supply work and successful quest facts → customer demand → physical dispatch |
| Terrain | `worlds[].terrain` | Actual 19×19 land/water cells used by drawing and navigation |
| Regions | `biomeNames` | Names shown for the existing four biome roles |
| Resources | `resourceCounts`, `fixedSites` | New-island harvesting distribution and exact authored sites |
| Visual palette | `groundColors`, `materialColors` | Ground palette and procedural material-color substitutions |
| Starting scenes | `scenes[].initialState` | Actual creatures, holdings, buildings, needs, skills, orders, player progression and owned islands |
| Guidance | `tutorial[]` | Ordered steps with supported real-workspace links |
| Definitions | `libraries.base/adventure/world/growth` | Existing item, lesson, quest, world, progression and interaction definitions |
| Simulation tuning | `simulation.rules.actor`, `simulation.rules.economy`, `simulation.rules.gameplay` | Bounded physiological, learning, social, work, construction, care, level, income and settlement coefficients |
| Storytelling | `storytelling`, `scenes[].graph.events`, `triggers` | Storyboard shots, timeline tracks, p5 descriptors and validated story actions |
| Composition contract | `simulation.archetype` | Must exactly equal the compiled `living-world-v1` engine, pipeline and transaction schedules |

World profiles reuse the existing square-island lattice: 19×19 cells, stride 23, one crossing on each edge, connected purchased neighbors. Eight worlds and up to 64 scenes per pack are supported. Root scenes own native checkpoints; bound interior and island scenes share their source authority. Reviewed connections can cross worlds within the pack and preserve dormant work. This does not transfer creatures arbitrarily between independent native owners or give each island an unrelated terrain topology.

A terrain row contains `.` for land and `~` for water. Keep row 9 and column 9 traversable so existing bridge crossings remain valid. All land must be connected; blocking fixed nodes must not seal access. Node counts are bounded to 0–30 per existing harvest role. Counts describe generation requests, not a guarantee that dense/blocked terrain can accommodate every requested node.

`placementPolicy: "reserved-sites"` protects fixed-site coordinates from random generation. Bundled new packs use it. `legacy` reproduces old v14 generation for existing stories. Changing a generator does not retroactively refill or relocate existing saved nodes.

## Recommended workflow

1. Open a bundled scene that resembles the desired start, and configure it through normal gameplay or the supported definition tools.
2. Use **More → Worlds & scenarios → Capture current scene**. This creates a complete editable pack with the current canonical native state and exact four libraries.
3. Edit identity, palettes, world layout, text, starting state, library values and bounded actor/economy rule values in an external JSON tool. Keep IDs/references and active work consistent. Do not change the compiled archetype arrays. Create additional scenes by copying a scene and assigning a unique ID; each must reference a declared world.
4. Validate with the CLI, import into the catalog, review a starting scene, then explicitly launch it. Validating and selecting do not replace the active story.
5. For a dedicated distributable, compile with `--pack`.

```sh
npm ci --no-audit --no-fund
npm run build

node .generated/tools/scenario-cli.cjs validate ../../docs/concepts/emberworks/content/emberworks.pack.json
node .generated/tools/scenario-cli.cjs export littlewild my-setting.pack.json
node .generated/tools/scenario-cli.cjs capture my-story.json captured.pack.json
node .generated/tools/simulation-profile-cli.cjs validate source/content/simulation-profile.json
node .generated/tools/simulation-profile-cli.cjs export my-profile.json

npm run build -- --pack my-setting.pack.json --output my-setting.html
```

TypeScript under `source/` is authoritative. `npm run build` compiles it to ignored `.generated/` JavaScript, validates the selected pack through the compiled CLI, discovers one authored `definition.json` per item, building or creature folder, assembles the portable catalogs and balancing document from its facets, and validates the projected domain and visual data. Authored interaction definitions live under `source/assets/interactions/`. The selected pack, immutable catalogs, runtime, compatibility libraries and pinned Three.js, PixiJS, ExcaliburJS and p5.js distributions are bundled into one offline HTML file. No runtime file server is required.

The default visual catalog is bundled at build time. Schema-2 packs and portable stories may carry complete validated visual and creature catalogs in `resources`. These definitions use the same bounded primitive/material/rig grammar as bundled assets. They cannot register renderer behavior, executable asset loaders or arbitrary remote media. See `ASSET-ARCHITECTURE.md`.

## Scene state is a precise snapshot

`initialState` is the canonical native **state**, not the outer portable-save envelope and not an unrestricted bag of display properties. Begin with a capture rather than an empty object. Player fields are `level`, `xp`, `coins`; companions reside in `colony.creatures`. Their names, own inventories, equipment, skills, needs and assignments are separate. Buildings, nodes, world inventories, work claims, homes, island identities, quest origins and ID counters must agree.

Validation rejects unknown scene-root and player fields, normalization mismatches, invalid coordinates and inconsistent native commitments. Other nested records retain their existing subsystem validators; this is not a claim that the scenario JSON Schema alone exhaustively describes every native save field.

Example edits to a captured pack:

```python
import json
from pathlib import Path
pack = json.loads(Path('captured.pack.json').read_text())
pack['id'] = 'harbor-keepers'
pack['name'] = 'Harbor Keepers'
pack['presentation']['title'] = 'Harbor Keepers'
pack['worlds'][0]['name'] = 'Quiet Anchorage'
pack['scenes'][0]['initialState']['player']['coins'] = 150
pack['scenes'][0]['initialState']['colony']['creatures'][0]['name'] = 'Tern'
Path('harbor-keepers.pack.json').write_text(json.dumps(pack, indent=2))
```

Validate the resulting file. A change to a name is not a change to an identity. Avoid editing paid work, quest settlements or identity counters by hand unless all their native invariants are understood.

## Tutorial actions

Allowed actions: `select`, `care`, `learn`, `home`, `planner`, `research`, `quests`, `growth`, `market`, `save`, `map`. They route to existing interfaces. They do not grant inventory, bypass research or mark a real task complete. One to 31 authored steps are supported. Tutorial progress is positional in the existing story field; changing/reordering a guide is safest as a new scene/pack version, not a live history rewrite.

## Activity settings

Settings includes independent **Friendly duels** and **Quests** controls. Both are enabled by default. Their saved Boolean flags are `state.settings.duels` and `state.settings.quests`; current-format legacy states without either flag retain the enabled default and their existing audio, motion, contrast, and camera preferences. Native and portable story imports reject present nonboolean flags before hydration. They also reject contradictory disabled flags with retained duel locks/seeking or a quest that has not entered its recalled return.

Turning Friendly duels off cancels pending and active paired interactions through the normal cancellation authority, releases both creatures, and clears duel-seeking intents. It also blocks direct requests, staging, seeking, and autonomous rules. Ordinary care and physical world interactions remain available. Turning Quests off blocks new invitations, acceptance, preparations, and departure. Existing plans wait; away creatures are recalled through the existing timed return. Recall spends the configured recall energy once; packed provisions stay spent, finds remain carried, and recalled trips earn no completion reward or prestige.

These controls work while paused and do not advance time or roll dice. Enabling a flag does not immediately start an activity. Empty patches and repeated values leave state unchanged. External tools use the typed `session.settings()` query and `set-game-settings` command with a patch such as `{ "duels": false }`; controls and tools invoke the same validated application service.

## Safety and persistence

Packs are at most 8 MiB, bounded in count and string length, and cannot contain executable scripts. A simulation profile is separately bounded to 256 KiB. The bundled schemas validate shape and exact compiled archetype arrays; actor/economy validators check numerical relationships; existing library/native validators check mechanics and references. Staging temporarily installs validated data only within synchronous reversible scopes. Failed validation restores all libraries, visual/creature catalogs, the world profile and the simulation profile. Imports populate a read-only catalog; scene replacement requires a separate confirmation.

Scenario schema **2** requires an explicit `simulation` profile. Schema-1 packs are obsolete and rejected; import requires a complete current-format pack. The canonical profile is `littlewild-simulation-profile` schema 1. Its `living-world-v1` archetype is a declaration of known compiled order, not a plug-in mechanism.

Scenario-aware portable saves use envelope **10**, containing context version 2, the exact simulation profile and an independent simulation fingerprint. Envelope-9 stories are obsolete and rejected. The native simulation payload remains version 8. Ordinary v8 stories use the compatibility profile. Device graphics and pause preferences remain separate from scene context.

Fingerprints detect accidental changes and stale reviews. They are opaque non-cryptographic IDs, **not signatures, authentication or proof that a pack is trustworthy**. Rejected or delayed file reads cannot reopen a dismissed import. No network resources are loaded from packs.

## Still required for a fully general framework

The current runtime supports validated role workflows and portable visual/creature catalogs through existing compiled capabilities. A fully general framework would still need arbitrary mechanic-ID catalogs, new executable capability registration, further extracted mechanics/narrative vocabulary and richer topologies. The World & Scene Editor provides visual pack authoring, nested levels, entry rules, cross-world connections and entity placement within the existing grid, asset and actor contracts. Scene rendering configuration selects 2D or 3D adapters and may embed observational 2D scenes in the UI. The 3D Creature Editor authors supported appearance and character values through the same reviewed draft boundary. External exchange supports Tiled, LDtk, glTF/GLB and Obsidian Canvas/Advanced Canvas with documented format-specific limits. See [Office scenario authoring and portability](OFFICE-SCENARIO.md) for a complete working example.

## Simulation profiles and ECS boundaries

The simulation section of the game's `content/balancing.json` supplies the default profile; `simulation-profile.json`, `actor-rules.json` and `economy-rules.json` remain reference mirrors. Profiles carry complete actor/economy rules and optional supported gameplay rules, plus the exact compiled composition archetype. Engines capture a deeply frozen profile when constructed, so later default-file or catalog edits cannot retroactively change an existing engine. Existing profiles without gameplay rules retain the documented compatible fallback.

Supported profile edits are bounded data values accepted by the actor/economy validators, such as needs rates, learning fatigue/recovery, social decay, level thresholds, level-up bonuses, income sharing and settlement limits. Relationships between values still apply; for example, recovery thresholds and financial limits must remain coherent.

The following remain compiled and must match exactly: engine feature layers, high-level fixed-step phases, actor-dynamics systems, actor-activity systems, world-transaction systems and economy-transaction systems. The schema and runtime both reject unknown, removed or reordered entries. Imported JSON cannot declare components, commands, callbacks, module paths, source text, behavior-tree handlers or executable systems.

Use `simulation-profile-cli.cjs validate` before embedding a profile in a schema-2 pack. Use `fingerprint` to compare deterministic identities, `export` to obtain the compatibility profile and `schema` to inspect the standalone contract. The scenario schema embeds the same profile definitions and is checked for drift by the release gate.

Central default tuning, the balancing workshop, CLI experiments and captured-value semantics are documented in [BALANCING.md](BALANCING.md).
