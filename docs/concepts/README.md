# Game folders

Each directory under `docs/concepts/` is the complete source of one game or
scenario built with the Wildlands engine (`source/wildlands/`). A game folder is
data, not documentation in the Diátaxis sense and not code:

- `game.json`, the manifest validated against the engine-owned
  [game manifest schema](../../source/wildlands/source/schemas/game.schema.json)
  (format `wildlands-game`, schemaVersion 1): id, name, version, engine template
  (`colony`, `rts` or `pet`), engine API, optional engine features, content
  paths, presentation, storage namespace and build targets;
- the JSON documents and asset definition folders the manifest names;
- `README.md` (what the game is, how to build and play it, provenance) and,
  where needed, `PROVENANCE.md` and `LICENSE*` files.

Nothing in a game folder is executed. The engine tooling
(`source/wildlands/source/tools/game-folder.cts`) rejects any file the manifest
does not name, code or markup files, executable modes, symbolic links and
oversized trees, then validates every document with the engine's own
validators. Engine schemas stay in the engine; a game folder never copies them.

## Games

| Game | Template | Folder |
|---|---|---|
| Littlewild | colony | [littlewild](littlewild/README.md) |
| Emberworks | colony | [emberworks](emberworks/README.md) |
| Office | colony | [office](office/README.md) |
| RTS Frontier | rts | [rts-frontier](rts-frontier/README.md) |
| Pocket Pet | pet | [pocket-pet](pocket-pet/README.md) |

No game data remains under `source/wildlands/source/`: the engine keeps only
its schemas and engine metadata there, and its architecture check rejects any
game file that is not in a game folder. Each folder is self-contained;
Emberworks and Office carry their own copies of the Littlewild balancing and
asset documents they were authored against.

## Working with a folder

Build tools look for game folders here, or in the directory named by the
`WILDLANDS_GAMES_DIR` environment variable (used by isolated rebuilds and the
engine-source export, which carries bundled games under `games/<id>/`). See
[maintaining documentation](../how-to/maintaining-documentation.md#game-folders)
for the placement rule and the Wildlands
[runtime contracts](../../source/wildlands/RUNTIME-CONTRACTS.md) for how a
folder becomes an installed content profile.
