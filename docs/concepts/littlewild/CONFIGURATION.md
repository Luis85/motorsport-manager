# Configurable experiences — authoring contract 2

## Product boundary

The engine supplies autonomous agents, needs, learning, RPG resolution, quests, construction, production, physical logistics, relationships, housing, connected islands and progression. A **pack** supplies one setting, its authored starts and a bounded simulation selection. **Littlewild is a bundled showcase**, alongside Emberworks.

The implementation separates data from execution. Existing core item, skill and building IDs remain mechanic roles. Their names, costs, recipes and supported settings are editable through the four established libraries; arbitrarily removing or renaming those roles, adding executable handlers, changing scheduler order or registering a new component type is unsupported. Creature rigs, animation programs, world lighting, island dimensions and some legacy narrative strings remain compiled.

## Supported configuration

| Concern | JSON location | Runtime effect |
|---|---|---|
| Identity | `id`, `name`, `version`, `presentation` | Window title, tagline, world subtitle and selected UI palette |
| Terrain | `worlds[].terrain` | Actual 19×19 land/water cells used by drawing and navigation |
| Regions | `biomeNames` | Names shown for the existing four biome roles |
| Resources | `resourceCounts`, `fixedSites` | New-island harvesting distribution and exact authored sites |
| Visual palette | `groundColors`, `materialColors` | Ground palette and procedural material-color substitutions |
| Starting scenes | `scenes[].initialState` | Creatures, holdings, buildings, needs, skills, orders, progression and owned islands |
| Guidance | `tutorial[]` | Ordered steps with supported real-workspace links |
| Definitions | `libraries.base/adventure/world/growth` | Existing versioned content contracts and supported mechanics data |
| ECS tuning | `simulation.ruleProfiles[]` | Validated actor-needs, learning, feelings, economy, XP and settlement coefficients |
| ECS composition | `simulation.compositionArchetypes[]` | A known, dependency-complete creature component contract |
| Scene selection | `ruleProfileId`, `actorArchetypeId` | Chooses one published profile and archetype for a starting scene |

## World profiles

World profiles reuse the existing square-island lattice: 19×19 cells, stride 23, one crossing on each edge, connected purchased neighbors. Eight profiles and eight scenes per pack are supported; a scene selects one profile for its connected archipelago. This is not simultaneous different terrain templates per island or arbitrary scene-to-scene creature travel.

A terrain row contains `.` for land and `~` for water. Keep row 9 and column 9 traversable so existing bridge crossings remain valid. All land must be connected; blocking fixed nodes must not seal access. Node counts are bounded to 0–30 per existing harvest role. Counts describe generation requests, not a guarantee that dense or blocked terrain can accommodate every request.

`placementPolicy: "reserved-sites"` protects fixed-site coordinates from random generation. Bundled packs use it. `legacy` reproduces old v14 generation for existing stories. Changing a generator does not retroactively refill or relocate existing saved nodes.

## Versioned simulation content

Scenario-pack schema 2 requires a `littlewild-simulation-content` document. It may contain up to eight rule profiles and eight composition archetypes. Each definition has a stable ID and its own schema version.

A rule profile wraps complete actor and economy rule manifests. The bundled `standard` profile contains the exact compatibility values from `actor-rules.json` and `economy-rules.json`. Numeric tuning is data-driven, but the meaning and execution of each field remain compiled. A profile cannot add a system, callback, command, expression, script, URL or event handler.

Composition archetype version 1 declares the established creature contract:

```json
{
  "format": "littlewild-composition-archetype",
  "schemaVersion": 1,
  "id": "creature-standard",
  "name": "Standard creature",
  "description": "A creature bound to the complete actor pipeline.",
  "entity": "creature",
  "persistentComponents": ["Transform", "Needs", "Learning", "Feelings", "Inventory"],
  "transientComponents": ["Activity", "Task", "Intent"]
}
```

Version 1 deliberately requires that complete dependency set. Renaming components, omitting dependencies or adding `Renderer`, `Script`, custom systems or arbitrary component names is rejected. This is a versioned compatibility declaration, not a general ECS scripting language.

## Recommended workflow

1. Open a bundled scene that resembles the desired start and configure it through normal gameplay or the supported definition tools.
2. Use **More → Worlds & scenarios → Capture current scene**. The output is a complete schema-2 pack with canonical native state, all four libraries, and the active rule profile and archetype.
3. Edit identity, palettes, world layout, text, starting state, libraries and supported numeric profile fields in an external JSON tool. Keep IDs, references and active work consistent.
4. Create additional scenes by copying a scene, assigning a unique ID, and selecting declared `worldId`, `ruleProfileId` and `actorArchetypeId` values.
5. Validate with the CLI, import into the catalog, review a starting scene, then explicitly launch it. Validation and selection never replace the active story.
6. For a dedicated distributable, compile with `--pack`.

```sh
node source/tools/scenario-cli.cjs validate source/content/emberworks.pack.json
node source/tools/scenario-cli.cjs export littlewild my-setting.pack.json
node source/tools/scenario-cli.cjs capture my-story.json captured.pack.json
python source/build.py --pack my-setting.pack.json --output my-setting.html
```

The CLI reports `sourceSchemaVersion` and compatibility migration notes. It never rewrites the input. The build bundles the chosen pack, engine, retained schemas, libraries and Three.js into one offline HTML file.

## Scene state is a precise snapshot

`initialState` is canonical native **state**, not the outer portable-save envelope and not an unrestricted bag of display properties. Begin with a capture rather than an empty object. Player fields are `level`, `xp`, `coins`; companions reside in `colony.creatures`. Their names, inventories, equipment, skills, needs and assignments are separate. Buildings, nodes, world inventories, work claims, homes, island identities, quest origins and ID counters must agree.

Validation rejects unknown scene-root and player fields, normalization mismatches, invalid coordinates and inconsistent native commitments. Other nested records retain their existing subsystem validators; scenario JSON Schema alone does not exhaustively describe every native save invariant.

```python
import json
from pathlib import Path
pack = json.loads(Path('captured.pack.json').read_text())
pack['id'] = 'harbor-keepers'
pack['name'] = 'Harbor Keepers'
pack['presentation']['title'] = 'Harbor Keepers'
pack['worlds'][0]['name'] = 'Quiet Anchorage'
pack['scenes'][0]['initialState']['player']['coins'] = 150
pack['scenes'][0]['ruleProfileId'] = 'standard'
Path('harbor-keepers.pack.json').write_text(json.dumps(pack, indent=2))
```

Validate the result. A change to a name is not a change to an identity. Avoid editing paid work, quest settlements or identity counters by hand unless all native invariants are understood.

## Tutorial actions

Allowed actions are `select`, `care`, `learn`, `home`, `planner`, `research`, `quests`, `growth`, `market`, `save` and `map`. They route to existing interfaces. They do not grant inventory, bypass research or mark a real task complete. One to 31 authored steps are supported. Tutorial progress is positional in the existing story field; changing or reordering a guide is safest as a new scene or pack version.

## Migration and persistence

| Input | Handling |
|---|---|
| Scenario pack schema 2 | Validated directly, including profile/archetype shape and ID references |
| Scenario pack schema 1 | Validated against retained `scenario-v1.schema.json`, then migrated in memory to `standard` / `creature-standard` |
| Scenario-aware story envelope 10 | Restores the exact fingerprinted simulation selection |
| Scenario-aware story envelope 9 | Fingerprint checked first, then migrated explicitly to the standard selection with a review note |
| Ordinary native stories 1–8 | Existing story and library migrations remain authoritative |

The native simulation payload remains version 8. Profiles, archetype manifests, ECS stores, schedulers and renderer state are transient. Scenario-aware saves use envelope **10** to preserve the exact experience, world, tutorial, four libraries, selected rule profile and selected archetype.

## Safety

Packs are at most 8 MiB, bounded in count and string length, and must contain JSON data only. Shape validation is followed by semantic library, world, native-state, profile, archetype and reference validation. Candidate libraries and world profiles are staged only within synchronous reversible scopes. Simulation selections are engine-specific and cannot leak into the active story during preview.

Fingerprints detect accidental changes and stale reviews. They are opaque non-cryptographic IDs, **not signatures, authentication or proof that a pack is trustworthy**. Rejected or delayed file reads cannot reopen a dismissed import. Packs load no network resources.

## Still required for a fully general framework

A setting-neutral runtime would additionally need configurable capability and role bindings, arbitrary content-ID catalogs, more extracted narrative vocabulary, renderer and rig asset descriptors, richer topologies, versioned component implementations and safe system-extension APIs. This contract provides tested world, scene, numeric tuning and known creature-composition repurposing within current systems. It does not advertise executable modding, a visual world editor or arbitrary ECS construction.
