# Emberworks

Emberworks is a warm clay-and-copper workshop settlement built with the
Wildlands engine's `colony` template: the same autonomous-life simulation as
Littlewild with a separately authored setting, simulation tuning, world and two
starting scenes. It shows that one engine runs more than one colony game.

This folder is the game's complete source. It holds data only: a manifest,
JSON documents, asset definitions and this README. No file here is executed.

## Contents

| Path | What it is |
|---|---|
| `game.json` | Manifest (`wildlands-game`, schemaVersion 1); grammar in [`game.schema.json`](../../../source/wildlands/source/schemas/game.schema.json) |
| `content/emberworks.pack.json` | The Emberworks scenario pack: complete libraries, simulation profile, world, scenes and tutorial |
| `content/balancing.json` | Balancing defaults the colony runtime falls back to (building interiors, interactions, default world and simulation) |
| `assets/items/<id>/definition.json` | Items, recipes, equipment, resource nodes and their 3D models |
| `assets/buildings/<id>/definition.json` | Buildings, physical footprints, homes and their 3D models |
| `assets/creatures/` | The sproutling creature, the creature catalog (`catalog.json`) and the creature editor field layout (`editor-fields.json`) |
| `assets/interactions/catalog.json` | Creature interaction library (equals the balancing `interactions` section) |

The pack lists no canonical pack (`content.canonicalId` is absent), so it is
used exactly as authored; it does not inherit libraries from `balancing.json`.
The definition format is described in the engine's
[asset README](../../../source/wildlands/source/assets/README.md) and
[creature README](../../../source/wildlands/source/assets/creatures/README.md);
balancing paths in [BALANCING.md](../../../source/wildlands/BALANCING.md).

## Materialized Littlewild data

Emberworks was authored on top of the Littlewild catalogs: its pack names
Littlewild item and building ids, and the runtime takes their 3D models, the
sproutling creature, building interiors and interactions from the installed
game. So that this folder is self-contained, `content/balancing.json` and
everything under `assets/` are byte-identical copies of the
[Littlewild folder](../littlewild/README.md) at the time Emberworks received its
own folder. The whole set is kept, not a subset: the balancing `$catalog`
selectors expand over every definition, and the compiled library schema takes
its id vocabulary from them, so removing a definition would change the profile
Emberworks has always run with. The two folders may diverge from here on; an
edit to Littlewild no longer changes Emberworks.

## Saves

The manifest uses the storage namespace `wildlands.emberworks`, so a
standalone Emberworks build keeps its saves apart from Littlewild and the other
games.

## Play

Open [`demos/emberworks.html`](../../../demos/emberworks.html) in a current
desktop browser. The file is self-contained: it runs offline from `file://` with
no network access, install or build step, and carries only this game: the
Emberworks pack. Choose **Found a workshop** or **An established workshop**;
saves stay under `wildlands.emberworks`.

## Build

The engine CLI builds the demo from this folder; it needs only Node.js 22:

```sh
bin/wildlands validate-game --game docs/concepts/emberworks
bin/wildlands build-game --game docs/concepts/emberworks --output demos/emberworks.html
```

`build-game` validates the folder with the engine's runtime validators, records
the folder digest and engine identity in the artifact, and writes nothing when
the play artifact exceeds `targets.html.budgetBytes` in `game.json` (4,194,304
bytes, 4 MiB). Add `--profile studio` to build the same game with the editors
and export tools on demand; studios are not published in `demos/`. The
checked-in [`demos/`](../../../demos/README.md) is regenerated for every game by
`npm run build:demos` in `source/wildlands` and checked by
`npm run check:demos`; see the
[Wildlands CLI handbook](../../reference/wildlands-cli.md).

## Editing and validation

Edit the JSON here, then validate the folder and rebuild the demo. Validation
rejects a folder whose files are not all named by `game.json` (other than
README, PROVENANCE and LICENSE files), that contains code, markup, executable
files or symbolic links, or whose documents fail the engine validators. The
`game-folders` verification suite checks the manifest, the closed inventory,
full validation with the engine's runtime validators and that the compiled
profile still equals the profile Emberworks ran with before this folder existed.

## Provenance

Authored for this repository as part of the Wildlands project (MIT, see the
repository [LICENSE](../../../LICENSE)). The pack moved here unchanged with
`git mv` from `source/wildlands/source/content/emberworks.pack.json`; the
balancing and asset documents are copies of the Littlewild folder (see above).
See the Wildlands [changelog](../../../source/wildlands/CHANGELOG.md).
