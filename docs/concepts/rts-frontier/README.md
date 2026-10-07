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

## Build and play

Today the Wildlands build composes this catalog into its artifacts:

```sh
cd source/wildlands
npm ci
npm run build    # writes .generated/artifacts/rts-play.html and the showcase fixture
```

Open `.generated/artifacts/rts-play.html` directly from disk to play, or use
the JSON-only CLI (`npm run rts -- discover`). The engine CLI command that
builds `demos/rts-frontier.html` from this folder arrives with the next engine
phase; until then this README does not claim it.

## Editing and validation

Edit `content/rts.json` (or export it from the in-game mission editor), then
rebuild; `npm run rts -- validate FILE` checks a catalog on its own. The build
rejects a folder whose files are not all named by `game.json` (other than
README, PROVENANCE and LICENSE files), that contains code, markup, executable
files or symbolic links, or whose catalog fails the engine validator. The
`game-folders` verification suite checks the manifest, the closed inventory,
full validation and that the compiled profile still equals the profile RTS
Frontier ran with before this folder existed.

## Provenance

Authored for this repository as part of the Wildlands project (MIT, see the
repository [LICENSE](../../../LICENSE)). The catalog moved here unchanged with
`git mv` from `source/wildlands/source/content/rts-demo.json`; see the
Wildlands [changelog](../../../source/wildlands/CHANGELOG.md).
