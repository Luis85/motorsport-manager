# Office

Office is an indoor sales, warehouse and fulfillment team built with the
Wildlands engine's `colony` template. Phil wins customer deals, Angela packs and
dispatches orders and Marty keeps inbound materials moving, all through the
same autonomous-life simulation as Littlewild with its own simulation tuning,
indoor world, furniture and creature catalog. How the shift works is described
in [OFFICE-SCENARIO.md](../../../source/wildlands/OFFICE-SCENARIO.md).

This folder is the game's complete source. It holds data only: a manifest,
JSON documents, asset definitions and this README. No file here is executed.

## Contents

| Path | What it is |
|---|---|
| `game.json` | Manifest (`wildlands-game`, schemaVersion 1); grammar in [`game.schema.json`](../../../source/wildlands/source/schemas/game.schema.json) |
| `content/office.pack.json` | The Office scenario pack: complete libraries, simulation profile, indoor world, scene, tutorial and its own `resources` (furniture assets and creature catalog) |
| `content/balancing.json` | Balancing defaults the colony runtime falls back to (building interiors, interactions, default world and simulation) |
| `assets/items/<id>/definition.json` | Items, recipes, equipment, resource nodes and their 3D models |
| `assets/buildings/<id>/definition.json` | Buildings, physical footprints, homes and their 3D models |
| `assets/creatures/` | The sproutling creature, the creature catalog (`catalog.json`) and the creature editor field layout (`editor-fields.json`) |
| `assets/interactions/catalog.json` | Creature interaction library (equals the balancing `interactions` section) |

The pack lists no canonical pack (`content.canonicalId` is absent), so it is
used exactly as authored; it does not inherit libraries from `balancing.json`.
Its `resources.assets` and `resources.creatures` take precedence over the
folder-level catalogs wherever they define an id. The definition format is
described in the engine's
[asset README](../../../source/wildlands/source/assets/README.md) and
[creature README](../../../source/wildlands/source/assets/creatures/README.md);
balancing paths in [BALANCING.md](../../../source/wildlands/BALANCING.md).

## Materialized Littlewild data

Office reuses stable Littlewild mechanic ids (`wood` for inbound blanks,
`planks` for packed orders, `bench`, `market`), and the runtime takes building
interiors, interactions and every asset the pack does not carry itself from the
installed game. So that this folder is self-contained, `content/balancing.json`
and everything under `assets/` are byte-identical copies of the
[Littlewild folder](../littlewild/README.md) at the time Office received its own
folder. The whole set is kept, not a subset: the balancing `$catalog` selectors
expand over every definition, and the compiled library schema takes its id
vocabulary from them, so removing a definition would change the profile Office
has always run with. The two folders may diverge from here on; an edit to
Littlewild no longer changes Office.

## Saves

The manifest uses the storage namespace `wildlands.office`, so a standalone
Office build keeps its saves apart from Littlewild and the other games.

## Build and play

Today the Wildlands build composes this folder's pack into its artifacts next
to the Littlewild and Emberworks packs:

```sh
cd source/wildlands
npm ci
npm run build    # writes .generated/artifacts/colony-play.html and the showcase fixture
```

Open `.generated/artifacts/colony-play.html` directly from disk and choose
**More → Worlds & scenarios → Office**. The engine CLI command that builds
`demos/office.html` from this folder arrives with the next engine phase; until
then this README does not claim it.

## Editing and validation

Edit the JSON here, then rebuild. The build rejects a folder whose files are not
all named by `game.json` (other than README, PROVENANCE and LICENSE files),
that contains code, markup, executable files or symbolic links, or whose
documents fail the engine validators. The `game-folders` verification suite
checks the manifest, the closed inventory, full validation with the engine's
runtime validators and that the compiled profile still equals the profile
Office ran with before this folder existed.

## Provenance

Authored for this repository as part of the Wildlands project (MIT, see the
repository [LICENSE](../../../LICENSE)). The pack moved here unchanged with
`git mv` from `source/wildlands/source/content/office.pack.json`; the
balancing and asset documents are copies of the Littlewild folder (see above).
See the Wildlands [changelog](../../../source/wildlands/CHANGELOG.md).
