# Configurable experiences — authoring contract 1

## Product boundary

The engine supplies autonomous agents, needs, learning, RPG resolution, quests, construction, production, physical logistics, relationships, housing, connected islands and progression. A **pack** supplies one setting and its authored starts. **Littlewild is a bundled showcase**, alongside Emberworks.

The implementation separates data from execution, but does not claim that every former hardcoded constant is extracted. Existing core item/skill/building IDs are mechanic roles. Their names, costs, recipes and supported settings are editable through the existing libraries; arbitrarily removing/renaming those roles or adding a new executable handler is unsupported. Some Adventure entries are extensible under that library's existing rules. Creature rigs, animation programs, world lighting, island dimensions and certain legacy narrative strings remain compiled.

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
| Mechanics/tuning | `libraries.base/adventure/world/growth` | Existing definition schemas and supported configuration from all prior systems |

World profiles reuse the existing square-island lattice: 19×19 cells, stride 23, one crossing on each edge, connected purchased neighbors. Eight profiles and eight scenes per pack are supported; a scene selects one profile for its connected archipelago. This is not simultaneous different terrain templates per island or arbitrary scene-to-scene creature travel.

A terrain row contains `.` for land and `~` for water. Keep row 9 and column 9 traversable so existing bridge crossings remain valid. All land must be connected; blocking fixed nodes must not seal access. Node counts are bounded to 0–30 per existing harvest role. Counts describe generation requests, not a guarantee that dense/blocked terrain can accommodate every requested node.

`placementPolicy: "reserved-sites"` protects fixed-site coordinates from random generation. Bundled new packs use it. `legacy` reproduces old v14 generation for existing stories. Changing a generator does not retroactively refill or relocate existing saved nodes.

## Recommended workflow

1. Open a bundled scene that resembles the desired start, and configure it through normal gameplay or the supported definition tools.
2. Use **More → Worlds & scenarios → Capture current scene**. This creates a complete editable pack with the current canonical native state and exact four libraries.
3. Edit identity, palettes, world layout, text, starting state and library values in an external JSON tool. Keep IDs/references and active work consistent. Create additional scenes by copying a scene and assigning a unique ID; each must reference a declared world.
4. Validate with the CLI, import into the catalog, review a starting scene, then explicitly launch it. Validating and selecting do not replace the active story.
5. For a dedicated distributable, compile with `--pack`.

```sh
node source/tools/scenario-cli.cjs validate source/content/emberworks.pack.json
node source/tools/scenario-cli.cjs export littlewild my-setting.pack.json
node source/tools/scenario-cli.cjs capture my-story.json captured.pack.json
python source/build.py --pack my-setting.pack.json --output my-setting.html
```

The build bundles the chosen pack, engine, original compatibility libraries and Three.js into the output. It does not require a runtime file server. The external-pack option needs Node.js for semantic validation; the ordinary built-in build needs only Python.

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

Packs are at most 8 MiB, bounded in count and string length, and cannot contain executable scripts. The bundled schema validates shape; existing library/native validators check mechanics and references. Staging temporarily installs validated data only within synchronous reversible scopes. Failed validation restores previous registries and profile. Imports populate a read-only catalog; scene replacement requires a separate confirmation.

Scenario-aware portable saves use version **9**, with exact experience context, its world profile/tutorial and four existing libraries. The native simulation payload remains version 8. Legacy saves retain their original library/geography compatibility. Device graphics and pause preferences remain separate from the scene context.

Fingerprints detect accidental changes and stale reviews. They are opaque non-cryptographic IDs, **not signatures, authentication or proof that a pack is trustworthy**. Rejected or delayed file reads cannot reopen a dismissed import. No network resources are loaded from packs.

## Still required for a fully general framework

A complete setting-neutral runtime would additionally need configurable capability/role bindings, arbitrary content-ID catalogs, extracted mechanics constants and narrative vocabulary, renderer/rig asset descriptors, and richer topologies. This release provides tested world/scene repurposing within the current systems. It does not advertise unimplemented generality or a visual world editor.

## Actor rules and ECS migration

`source/content/actor-rules.json` contains validated default physiological, learning-fatigue and baseline social coefficients executed by the actor ECS. The file is embedded into standalone builds, but it is **not** yet a scene-pack override: v9 portable stories still serialize the existing creature records and their exact four established libraries. Arbitrary systems, executable callbacks, runtime component types and actor-rule changes through imported scenario JSON remain unsupported. A scenario-level rule profile requires its own versioned compatibility contract.
