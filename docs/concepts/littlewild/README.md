# Littlewild

Littlewild is the woodland colony game built with the Wildlands engine: an
offline, autonomous-buddy life simulation in which sproutling companions
gather, craft, build, learn and go on adventures beside the player. It uses the
engine's `colony` template and is the canonical game the engine's colony
systems were developed against.

This folder is the game's complete source. It holds data only: a manifest,
JSON documents, asset definitions and this README. No file here is executed.

## Contents

| Path | What it is |
|---|---|
| `game.json` | Manifest (`wildlands-game`, schemaVersion 1); grammar in [`game.schema.json`](../../../source/wildlands/source/schemas/game.schema.json) |
| `content/balancing.json` | Canonical balancing defaults; `$catalog` selectors expand over `assets/` |
| `content/littlewild.pack.json` | The Littlewild scenario pack; it inherits libraries, simulation, starting scenes and the default world from balancing (`canonicalId`) |
| `content/skill-tree.json` | The growth skill tree |
| `content/adventure-example.json` | A complete custom adventure library example |
| `assets/items/<id>/definition.json` | Items, recipes, equipment, resource nodes and their 3D models |
| `assets/buildings/<id>/definition.json` | Buildings, physical footprints, homes and their 3D models |
| `assets/creatures/` | The sproutling creature, the creature catalog (`catalog.json`) and the creature editor field layout (`editor-fields.json`) |
| `assets/interactions/catalog.json` | Creature interaction library (equals the balancing `interactions` section) |

The definition format is described in the engine's
[asset README](../../../source/wildlands/source/assets/README.md) and
[creature README](../../../source/wildlands/source/assets/creatures/README.md);
balancing paths in [BALANCING.md](../../../source/wildlands/BALANCING.md).

## Saves

The manifest keeps the legacy storage namespace `littlewild`, so browser saves
keep their existing keys (`littlewild.save.v5`, `littlewild.backup.v5`) and the
serialized `littlewild-*` format identifiers are unchanged. Other games use
`wildlands.<id>`.

## Build and play

Today the Wildlands build reads this folder (or the folder named by
`WILDLANDS_GAMES_DIR`) and composes it into its artifacts:

```sh
cd source/wildlands
npm ci
npm run build    # writes littlewild.html and .generated/artifacts/colony-play.html
```

Open `.generated/artifacts/colony-play.html` directly from disk to play. The
engine CLI command that builds `demos/littlewild.html` from this folder
(`bin/wildlands build-game --game docs/concepts/littlewild`) arrives with the
next engine phase; until then this README does not claim it.

## Editing and validation

Edit the JSON here, then rebuild. The build rejects a folder whose files are not
all named by `game.json` (other than README, PROVENANCE and LICENSE files),
that contains code, markup, executable files or symbolic links, or whose
documents fail the engine validators. The folder digest is SHA-256 over every
file's path and byte hash, so any byte change, including whitespace or key
order, gives a new digest. The `game-folders` verification suite checks the
manifest, inventory, digest and that the compiled profile still equals the
profile the engine shipped before the folder existed.

## Provenance

Authored for this repository as part of the Wildlands project (MIT, see the
repository [LICENSE](../../../LICENSE)). The data moved here unchanged with
`git mv` from `source/wildlands/source/content` and `source/wildlands/source/assets`;
see the Wildlands [changelog](../../../source/wildlands/CHANGELOG.md).
[Emberworks](../emberworks/README.md) and [Office](../office/README.md) carry
their own copies of the balancing and asset documents taken from this folder;
editing Littlewild does not change them.
