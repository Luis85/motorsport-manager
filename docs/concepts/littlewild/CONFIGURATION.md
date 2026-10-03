# Configurable experiences — authoring contract 2

## Product boundary

The engine supplies autonomous agents, needs, learning, RPG resolution, quests, construction, production, physical logistics, relationships, housing, connected islands and progression. A **pack** supplies one setting and its authored starts. **Littlewild is a bundled showcase**, alongside Emberworks.

The implementation separates data from execution, but does not claim that every former hardcoded constant is extracted. Existing core item/skill/building IDs are mechanic roles. Their names, costs, recipes and supported settings are editable through the existing libraries; arbitrarily removing/renaming those roles or adding a new executable handler is unsupported. Some Adventure entries are extensible under that library's existing rules. **Bundled 3D model geometry, material roles, actor rig sockets and building animation anchors are declarative asset data under `source/assets/`.** Animation programs, world lighting, island dimensions and certain legacy narrative strings remain compiled.

## Supported configuration

| Concern | JSON location | Runtime effect |
|---|---|---|
| Identity | `id`, `name`, `version`, `presentation` | Window/brand title, tagline, world subtitle, selected UI accent/paper/ink |
| Terrain | `worlds[].terrain` | Actual 19×19 land/water cells used by drawing and navigation |
| Regions | `biomeNames` | Names shown for the existing four biome roles |
| Resources | `resourceCounts`, `fixedSites` | New-island harvesting distribution and exact authored sites |
| Visual palette | `groundColors`, `materialColors` | Ground palette and procedural material-color substitutions |
| Starting scenes | `scenes[].initialState` | Actual creatures, holdings, buildings, needs, skills, orders, player progression and owned islands |
| Guidance | `tutorial[]` | Ordered steps with supported real-workspace links |
| Definitions | `libraries.base/adventure/world/growth` | Existing item, lesson, quest, world, progression and interaction definitions |
| Simulation tuning | `simulation.rules.actor`, `simulation.rules.economy` | Bounded physiological, learning, social, level, income and settlement coefficients |
| Composition contract | `simulation.archetype` | Must exactly equal the compiled `living-world-v1` engine, pipeline and transaction schedules |

World profiles reuse the existing square-island lattice: 19×19 cells, stride 23, one crossing on each edge, connected purchased neighbors. Eight profiles and eight scenes per pack are supported; a scene selects one profile for its connected archipelago. This is not simultaneous different terrain templates per island or arbitrary scene-to-scene creature travel.

A terrain row contains `.` for land and `~` for water. Keep row 9 and column 9 traversable so existing bridge crossings remain valid. All land must be connected; blocking fixed nodes must not seal access. Node counts are bounded to 0–30 per existing harvest role. Counts describe generation requests, not a guarantee that dense/blocked terrain can accommodate every requested node.

`placementPolicy: "reserved-sites"` protects fixed-site coordinates from random generation. Bundled new packs use it. `legacy` reproduces old v14 generation for existing stories. Changing a generator does not retroactively refill or relocate existing saved nodes.

## Recommended workflow

1. Open a bundled scene that resembles the desired start, and configure it through normal gameplay or the supported definition tools.
2. Use **More → Worlds & scenarios → Capture current scene**. This creates a complete editable pack with the current canonical native state and exact four libraries.
3. Edit identity, palettes, world layout, text, starting state, library values and bounded actor/economy rule values in an external JSON tool. Keep IDs/references and active work consistent. Do not change the compiled archetype arrays. Create additional scenes by copying a scene and assigning a unique ID; each must reference a declared world.
4. Validate with the CLI, import into the catalog, review a starting scene, then explicitly launch it. Validating and selecting do not replace the active story.
5. For a dedicated distributable, compile with `--pack`.

```sh
npm install --no-audit --no-fund
npm run build

node .generated/tools/scenario-cli.cjs validate source/content/emberworks.pack.json
node .generated/tools/scenario-cli.cjs export littlewild my-setting.pack.json
node .generated/tools/scenario-cli.cjs capture my-story.json captured.pack.json
node .generated/tools/simulation-profile-cli.cjs validate source/content/simulation-profile.json
node .generated/tools/simulation-profile-cli.cjs export my-profile.json

npm run build -- --pack my-setting.pack.json --output my-setting.html
```

TypeScript under `source/` is authoritative. `npm run build` compiles it to ignored `.generated/` JavaScript, validates the selected pack through the compiled CLI, discovers and validates every `source/assets/{buildings,items,actors}/<id>/asset.json`, and bundles the chosen pack, immutable asset catalog, runtime, compatibility libraries and Three.js into one offline HTML file. No runtime file server is required.

3D assets are a **build-time bundled catalog**, not part of scenario schema 2 or portable stories. This keeps user-imported world/scenario JSON data-only and prevents an imported pack from registering renderer behavior or executable asset loaders. See `ASSET-ARCHITECTURE.md`.

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

## Safety and persistence

Packs are at most 8 MiB, bounded in count and string length, and cannot contain executable scripts. A simulation profile is separately bounded to 256 KiB. The bundled schemas validate shape and exact compiled archetype arrays; actor/economy validators check numerical relationships; existing library/native validators check mechanics and references. Staging temporarily installs validated data only within synchronous reversible scopes. Failed validation restores all registries, the world profile and the simulation profile. Imports populate a read-only catalog; scene replacement requires a separate confirmation.

Scenario schema **2** requires an explicit `simulation` profile. Schema-1 packs are obsolete and rejected; import requires a complete current-format pack. The canonical profile is `littlewild-simulation-profile` schema 1. Its `living-world-v1` archetype is a declaration of known compiled order, not a plug-in mechanism.

Scenario-aware portable saves use envelope **10**, containing context version 2, the exact simulation profile and an independent simulation fingerprint. Envelope-9 stories are obsolete and rejected. The native simulation payload remains version 8. Ordinary v8 stories use the compatibility profile. Device graphics and pause preferences remain separate from scene context.

Fingerprints detect accidental changes and stale reviews. They are opaque non-cryptographic IDs, **not signatures, authentication or proof that a pack is trustworthy**. Rejected or delayed file reads cannot reopen a dismissed import. No network resources are loaded from packs.

## Still required for a fully general framework

A complete setting-neutral runtime would additionally need configurable capability/role bindings, arbitrary content-ID catalogs, extracted mechanics constants and narrative vocabulary, a supported external asset-pack/import policy, and richer topologies. The renderer/rig descriptor foundation itself now exists for bundled assets. This release provides tested world/scene repurposing within the current systems. It does not advertise unimplemented external asset ingestion or a visual world editor.

## Simulation profiles and ECS boundaries

`source/content/simulation-profile.json` is the compatibility profile used by ordinary current-format stories. It contains complete validated copies of `actor-rules.json` and `economy-rules.json`, plus the exact compiled composition archetype. Engines capture a deeply frozen profile when constructed, so later catalog selection cannot retroactively change an existing engine.

Supported profile edits are bounded data values accepted by the actor/economy validators, such as needs rates, learning fatigue/recovery, social decay, level thresholds, level-up bonuses, income sharing and settlement limits. Relationships between values still apply; for example, recovery thresholds and financial limits must remain coherent.

The following remain compiled and must match exactly: engine feature layers, high-level fixed-step phases, actor-dynamics systems, actor-activity systems, world-transaction systems and economy-transaction systems. The schema and runtime both reject unknown, removed or reordered entries. Imported JSON cannot declare components, commands, callbacks, module paths, source text, behavior-tree handlers or executable systems.

Use `simulation-profile-cli.cjs validate` before embedding a profile in a schema-2 pack. Use `fingerprint` to compare deterministic identities, `export` to obtain the compatibility profile and `schema` to inspect the standalone contract. The scenario schema embeds the same profile definitions and is checked for drift by the release gate.
