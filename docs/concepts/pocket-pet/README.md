# Pocket Pet

Pocket Pet is an original virtual pet built with the Wildlands engine's `pet`
template: hatch an egg, keep its needs balanced and discover which adult form
your care produces. It runs on the same ECS as the colony and RTS games with
its own catalog, clock and checkpoints. The
[Pocket Pet tutorial](../../tutorials/pocket-pet-demo.md) walks through it and
the [Pocket Pet reference](../../reference/pet-engine.md) documents the rules.

This folder is the game's complete source. It holds data only: a manifest, one
JSON catalog, the pet presentation definitions, this README and
[PROVENANCE.md](PROVENANCE.md). No file here is executed.

## Contents

| Path | What it is |
|---|---|
| `game.json` | Manifest (`wildlands-game`, schemaVersion 1); grammar in [`game.schema.json`](../../../source/wildlands/source/schemas/game.schema.json) |
| `content/pet.json` | The pet catalog (`format: "wildlands-pet"`, schemaVersion 1): rules, scene, needs, species, life stages, actions, economy, skins and items |
| `assets/pets/<id>/definition.json` | 3D presentation definitions (family `pets`, category `pet`): two species, ten props and six accessories |
| `PROVENANCE.md` | Where the 3D definitions come from (Scene Forge recipes) |

The definition format is described in the engine's
[asset README](../../../source/wildlands/source/assets/README.md);
[`pet-catalog.ts`](../../../source/wildlands/source/pet-catalog.ts) validates the
catalog. A pet game's `assets` may hold only `pets` definitions.

## Saves

The manifest uses the storage namespace `wildlands.pocket-pet`. Pets are saved
and restored as exported checkpoint files; see the tutorial.

## Play

Open [`demos/pocket-pet.html`](../../../demos/pocket-pet.html) in a current
desktop browser. The file is self-contained: it runs offline from `file://` with
no network access, install or build step, and carries only this game. It needs a
browser with WebGL 2. Save and restore the pet as exported checkpoint files (see
the tutorial).

The JSON-only pet CLI (`npm run pet -- discover` in `source/wildlands`) runs the
same catalog headlessly.

## Build

The engine CLI builds the demo from this folder; it needs only Node.js 22:

```sh
bin/wildlands validate-game --game docs/concepts/pocket-pet
bin/wildlands build-game --game docs/concepts/pocket-pet --output demos/pocket-pet.html
```

`build-game` validates the folder with the engine's runtime validators, records
the folder digest and engine identity in the artifact, and writes nothing when
the play artifact exceeds `targets.html.budgetBytes` in `game.json` (3,145,728
bytes, 3 MiB). The `pet` template has no studio profile; `build-game` builds the
play artifact only. The checked-in [`demos/`](../../../demos/README.md) is
regenerated for every game by `npm run build:demos` in `source/wildlands` and
checked by `npm run check:demos`; see the
[Wildlands CLI handbook](../../reference/wildlands-cli.md).

## Editing and validation

Edit `content/pet.json`, then validate the folder and rebuild the demo;
`npm run pet -- validate FILE` checks a catalog on its own. Do not hand-edit
`assets/pets/`: change the Scene Forge recipes and publish them again (see
[PROVENANCE.md](PROVENANCE.md)). Validation rejects a folder whose files are not
all named by `game.json` (other than README, PROVENANCE and LICENSE files), that
contains code, markup, executable files or symbolic links, or whose catalog
fails the engine validator. The `game-folders` verification suite checks the
manifest, the closed inventory, full validation and that the compiled profile
still equals the profile Pocket Pet ran with before this folder existed.

## Provenance

Authored for this repository as part of the Wildlands project (MIT, see the
repository [LICENSE](../../../LICENSE)). The catalog moved here unchanged with
`git mv` from `source/wildlands/source/content/pet-demo.json` and the
definitions from `source/wildlands/source/assets/pets/`; see
[PROVENANCE.md](PROVENANCE.md) and the Wildlands
[changelog](../../../source/wildlands/CHANGELOG.md).
