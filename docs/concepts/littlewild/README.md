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

## Play

Open [`demos/littlewild.html`](../../../demos/littlewild.html) in a current
desktop browser. The file is self-contained: it runs offline from `file://` with
no network access, install or build step, and carries only this game. Choose
**A first morning** for earned progression or **A charted home** for the
multi-creature demonstration; saves stay in the browser under the legacy keys
above.

## Build

The engine CLI builds the demo from this folder; it needs only Node.js 22:

```sh
bin/wildlands validate-game --game docs/concepts/littlewild
bin/wildlands build-game --game docs/concepts/littlewild --output demos/littlewild.html
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
folder digest is SHA-256 over every file's path and byte hash except README
files, so any byte change of game data, including whitespace or key order,
gives a new digest; editing this README does not, and needs no demo rebuild. The
`game-folders` verification suite checks the manifest, inventory, digest and
that the compiled profile still equals the profile the engine shipped before the
folder existed.

## Provenance

Authored for this repository as part of the Wildlands project (MIT, see the
repository [LICENSE](../../../LICENSE)). The data moved here unchanged with
`git mv` from `source/wildlands/source/content` and `source/wildlands/source/assets`;
see the Wildlands [changelog](../../../source/wildlands/CHANGELOG.md).
[Emberworks](../emberworks/README.md) and [Office](../office/README.md) carry
their own copies of the balancing and asset documents taken from this folder;
editing Littlewild does not change them.
