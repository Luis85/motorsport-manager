# RTS Frontier

RTS Frontier is an original isometric real-time strategy match built with the
Wildlands engine's `rts` template: three factions, workers gathering four
resources, construction, training, research, items, abilities and a mission
with objectives, all driven by one validated catalog. The
[RTS demo tutorial](../../tutorials/rts-demo.md) walks through a match and the
[RTS reference](../../reference/rts-engine.md) documents the catalog contract.

This folder is the game's complete source. It holds data only: a manifest, one
JSON catalog and this README. No file here is executed.

## Contents

| Path | What it is |
|---|---|
| `game.json` | Manifest (`wildlands-game`, schemaVersion 1); grammar in [`game.schema.json`](../../../source/wildlands/source/schemas/game.schema.json) |
| `content/rts.json` | The RTS catalog (`format: "wildlands-rts"`, schemaVersion 1; catalog id `frontier-rts`): resources, factions, units, buildings, items, technologies, abilities, terrain and missions |

The catalog grammar is the engine's
[`rts.schema.json`](../../../source/wildlands/source/content/rts.schema.json);
[`rts-catalog.ts`](../../../source/wildlands/source/rts-catalog.ts) validates
its fields, ranges and references.

## Saves

The manifest uses the storage namespace `wildlands.rts-frontier`. Matches are
saved and restored as exported checkpoint files; see the tutorial.

## Play

Open [`demos/rts-frontier.html`](../../../demos/rts-frontier.html) in a current
desktop browser. The file is self-contained: it runs offline from `file://` with
no network access, install or build step, and carries only this game. The match
starts in the browser; save and restore it as exported checkpoint files (see the
tutorial).

The JSON-only RTS CLI (`npm run rts -- discover` in `source/wildlands`) runs the
same catalog headlessly.

## Build

The engine CLI builds the demo from this folder; it needs only Node.js 22:

```sh
bin/wildlands validate-game --game docs/concepts/rts-frontier
bin/wildlands build-game --game docs/concepts/rts-frontier --output demos/rts-frontier.html
```

`build-game` validates the folder with the engine's runtime validators, records
the folder digest and engine identity in the artifact, and writes nothing when
the play artifact exceeds `targets.html.budgetBytes` in `game.json` (524,288
bytes, 512 KiB). Add `--profile studio` to build the same game with the editors
and export tools on demand; studios are not published in `demos/`. The
checked-in [`demos/`](../../../demos/README.md) is regenerated for every game by
`npm run build:demos` in `source/wildlands` and checked by
`npm run check:demos`; see the
[Wildlands CLI handbook](../../reference/wildlands-cli.md).

## Editing and validation

Edit `content/rts.json` (or export it from the in-game mission editor), then
validate the folder and rebuild the demo; `npm run rts -- validate FILE` checks
a catalog on its own. Validation rejects a folder whose files are not all named
by `game.json` (other than README, PROVENANCE and LICENSE files), that contains
code, markup, executable files or symbolic links, or whose catalog fails the
engine validator. The `game-folders` verification suite checks the manifest, the
closed inventory, full validation and that the compiled profile still equals the
profile RTS Frontier ran with before this folder existed.

## Provenance

Authored for this repository as part of the Wildlands project (MIT, see the
repository [LICENSE](../../../LICENSE)). The catalog moved here unchanged with
`git mv` from `source/wildlands/source/content/rts-demo.json`; see the
Wildlands [changelog](../../../source/wildlands/CHANGELOG.md).
