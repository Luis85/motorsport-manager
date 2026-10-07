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

Emberworks (colony), Office (colony), RTS Frontier (rts) and Pocket Pet (pet)
still ship as engine data under `source/wildlands/source/` and move into their
own folders next; the engine's architecture check lists each pending file with
the game it belongs to.

## Working with a folder

Build tools look for game folders here, or in the directory named by the
`WILDLANDS_GAMES_DIR` environment variable (used by isolated rebuilds and the
engine-source export, which carries bundled games under `games/<id>/`). See
[maintaining documentation](../how-to/maintaining-documentation.md#game-folders)
for the placement rule and the Wildlands
[runtime contracts](../../source/wildlands/RUNTIME-CONTRACTS.md) for how a
folder becomes an installed content profile.
