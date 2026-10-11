# Generate models, scenes and game content procedurally

Goal: produce seeded, reviewable content with the checked-in command-line tools
and hand it on without losing the ability to reproduce it. Model Forge generates
single models, Scene Forge lays out terrain and placements, and Wildlands adds
missions and quests to a game folder. Every generator is deterministic, bounded
and writes only through the tool's usual guarded edit, so a seed and a recipe
are enough to rebuild the exact bytes.

The handbooks own the full contracts:
[Model Forge procedural generation](../reference/model-forge-cli.md#procedural-generation),
[Scene Forge procedural generation](../reference/scene-forge-cli.md#procedural-generation)
and [Wildlands `generate`](../reference/wildlands-cli.md#generate). This guide
connects them into working routes.

## Requirements

- Node.js 22 or newer. The checked-in `bin/model-forge`, `bin/scene-forge` and
  `bin/wildlands` run from the repository root without `npm ci`.
- Chromium only for `review`: `bin/model-forge doctor` and
  `bin/scene-forge doctor` report whether it launches. When Playwright's bundled
  browser is not installed, set `FORGE_CHROMIUM_PATH` to an existing Chromium
  executable. Without a browser, skip the `review` and `--review` steps; every
  other step still runs.
- A scratch directory. Never generate into `docs/concepts/`: copy a game folder
  first and work on the copy. A game folder's name must equal its game ID, so
  keep the folder name when you copy it.

Run the blocks below in order, in one shell, from the repository root. The first
block makes the scratch directory and a small `field` helper that prints one
field of a JSON result (`field data.stateHash`, `field nextCommands.0`), so no
other JSON tool is needed.

```sh
OUT="$(mktemp -d)"
field() { node -e 'const v = process.argv[1].split(".").reduce((o, k) => o?.[k], JSON.parse(require("fs").readFileSync(0, "utf8"))); console.log(typeof v === "object" ? JSON.stringify(v) : v)' "$1"; }
echo "$OUT"
```

## One-command happy paths

Each tool has a single command that produces a useful, reviewable result from a
preset. Model Forge writes a new model, its replayable recipe and a four-view
review:

```sh
bin/model-forge --compact generate tree --preset palm --seed 3 --out "$OUT/palm.model.json" --review "$OUT/palm-review" | field data.recipeHash
```

Scene Forge adds a vertex-colored terrain to a project (after `init`):

```sh
bin/scene-forge --compact init "$OUT/island" --name Island | field data.project
bin/scene-forge --compact -p "$OUT/island" terrain add ground --preset island --seed 3 | field data.terrain.geometry
```

Wildlands proposes a playable mission for a copy of an RTS game folder and
validates it without writing:

```sh
mkdir -p "$OUT/quick"
cp -R docs/concepts/rts-frontier "$OUT/quick/"
bin/wildlands generate rts-mission --game "$OUT/quick/rts-frontier" --mission dunes --preset skirmish --seed 7 --dry-run | field summary
```

Open `$OUT/palm-review/contact-sheet.png` before going further: a review is the
evidence of what the model looks like, and a number in a result is not.

## Choose the tool

| You need | Use | Writes |
|---|---|---|
| One prop, plant, building or terrain tile to edit further | `model-forge generate <generator>` (`generate list`, `generate show <generator>`) | A new `kind: "model"` document with editable `$param` dimensions and a `<id>.generate.json` recipe |
| A family of similar props (sizes, colors) | `model-forge -d <doc> variants --vary <param=min..max>` | New documents and `variants.json` |
| Copies scattered inside one model asset (a rock cluster, a planted tile) | `model-forge -d <bundle> scatter` | One guarded edit of that document |
| A world: terrain plus forests, rows, trails of registered models | `scene-forge terrain add`, `scatter`, `layout` | Guarded scene edits; one group node per placement recipe |
| Playable content for a game (an RTS mission, colony adventure quests) | `wildlands generate rts-mission` or `adventure-quests` | One canonical content file of a game folder, validated before it is replaced |

Model Forge owns the look of one asset; Scene Forge owns the arrangement of many
assets; Wildlands owns game rules. Generators never cross those lines: a
Wildlands generator only references archetypes, items, terrain, skills and
balance envelopes the game already defines, and a scene placement never changes
the model it instances.

## The determinism contract

All three tools share one source of randomness, the **forge keyed PRNG v1**: the
seed and a named stream are hashed with cyrb128 (`"<seed>|<stream>"`), which
seeds an sfc32 generator. Model Forge and Scene Forge use the shared kernel
implementation and Wildlands the same algorithm; pinned test vectors in the
kernel check that the two agree. Seeds
are integers from 0 to 4294967295 (default 1). No generator reads the clock or
an ambient random source, and each candidate, item or record draws from its own
keyed stream, so excluding one placement never reshuffles the others.

What fixes a result:

| Tool | Same bytes when these are equal | Recipe to keep |
|---|---|---|
| Model Forge `generate` | Generator version, seed, preset and parameters | The sidecar `<id>.generate.json` (`kind: "generator-recipe"`) |
| Model Forge and Scene Forge `scatter`/`layout` | Document or scene, model library, normalized recipe and seed | The result's `recipe` (a `scatter` recipe; `schema --kind scatter`) |
| Wildlands `generate` | Game folder content, generator recipe and seed | The result's `recipe` (`--recipe FILE`) |

Every result carries `seed` and a `recipeHash`, the SHA-256 of the normalized
recipe. Scene groups are tagged `scatter:<first 8 digits of recipeHash>`, so a
placement in a scene can be traced back to its recipe. Record the seed and
`recipeHash` wherever you present generated content.

Replay the palm from its sidecar recipe and compare the bytes:

```sh
bin/model-forge --compact generate tree --file "$OUT/palm.generate.json" --out "$OUT/replay/palm.model.json" | field data.recipeHash
cmp "$OUT/palm.model.json" "$OUT/replay/palm.model.json" && echo "palm replays byte-identically"
```

A recipe written by an older generator version still runs and reports a
warning; its output can differ from the original document.

## Guarded writes

Generation goes through each tool's ordinary write path, so it can be previewed
and it never silently replaces work:

| Tool | Preview | Commit |
|---|---|---|
| Model Forge `generate`, `variants` | `--dry-run` builds, validates and checks every path; its `nextCommands[0]` is the exact write | Outputs are new paths only: an existing document fails with `DOCUMENT_EXISTS`, an existing recipe file or non-empty directory with `ALREADY_EXISTS`. `--review <dir>` renders before anything is written, so a missing browser leaves no files |
| Model Forge `scatter` | `--dry-run`; its `nextCommands[0]` is the exact guarded write | `--expected-revision` and/or `--expected-state` from the read; a history snapshot and an atomic write |
| Scene Forge `terrain add`, `scatter`, `layout` | `--dry-run`; its `nextCommands[0]` is the exact guarded write | `--expected-revision` and/or `--expected-state`; an existing scatter group or terrain needs `--replace` |
| Wildlands `generate` | `--dry-run` stages a copy of the folder and runs the engine validators | `--expected-digest <digest>` replaces the one content file atomically, or `--output NEW.json` creates the proposed file outside the folder (symlinks resolved; an existing file is never replaced) |

A stale guard fails (`REVISION_CONFLICT`, `STATE_CONFLICT`, `stale-digest`)
without writing. Read the current state again and repeat the dry run; do not
drop the guard.

## Bounds and errors

Every generator is bounded, and failures are structured: read the error code,
then its `hint` and `details`. The handbooks list every code.

| Code | Tool | Meaning and remedy |
|---|---|---|
| `GENERATOR_NOT_FOUND` | Model Forge | Unknown generator; `details.available` lists them. An unknown `--preset` fails with `INVALID_OPTION` and the same `details.available` |
| `PROCEDURAL_BUDGET` | Model Forge, Scene Forge | Over a bound: a generator's triangle budget, 2,000 placements, 20,000 candidate points, 10,000 nodes or 256 x 256 terrain vertices. Raise spacing, shrink the area or lower counts |
| `SCATTER_EMPTY` | Model Forge, Scene Forge | Nothing was placed; `details.rejected` counts `outside`, `exclusion`, `slope` and `budget`. Widen the area, lower spacing or relax filters |
| `TERRAIN_TRANSFORM` | Model Forge, Scene Forge | Grounding follows only translation, yaw and positive uniform scale of the terrain and parent chain |
| `VARIANT_RANGE` | Model Forge | A `--vary` range lies outside the parameter's declared range |
| `DUPLICATE_ID` | Model Forge, Scene Forge | The group or a placement ID exists; pass `--replace` with guards (only a group tagged `scatter` is replaced) or another `--group` |
| `generate-usage`, `stale-digest`, `duplicate-id`, `generation-failed`, `invalid-generated` | Wildlands | Bad options or recipe; the folder changed since the digest; the mission or quest ID exists (`--replace`); no playable layout for this seed (try another); the engine validators rejected the staged folder |

Full tables: [Model Forge error codes](../reference/model-forge-cli.md#error-codes)
and [limits](../reference/model-forge-cli.md#limits),
[Scene Forge error codes](../reference/scene-forge-cli.md#error-codes) and
[Wildlands `generate`](../reference/wildlands-cli.md#generate).

## Walkthrough A: a forest on hills

Generate three assets in Model Forge, hand them to a Scene Forge project, build
hills, scatter a forest around a clearing, lay a fence through the clearing and
review the result.

1. Generate a conifer (with a review), a boulder and a run of ranch fence. The
   fence is a straight 10 m run along X, centered on its origin.

   ```sh
   bin/model-forge --compact generate tree --preset conifer --seed 11 --out "$OUT/pine.model.json" --review "$OUT/pine-review" | field data.recipeHash
   bin/model-forge --compact generate rock --preset boulder --seed 4 --out "$OUT/boulder.model.json" | field data.recipeHash
   bin/model-forge --compact generate fence --preset ranch --seed 2 --out "$OUT/rail.model.json" | field data.documents.0.stats.bounds.size
   ```

2. Export each as a model bundle and register it in a new Scene Forge project.
   Dry-run the first import to see exactly what will be registered.

   ```sh
   for model in pine boulder rail; do
     bin/model-forge --compact -d "$OUT/$model.model.json" export --format model-bundle --out "$OUT/$model.model-bundle.json" | field data.path
   done
   bin/scene-forge --compact init "$OUT/valley" --name Valley | field data.project
   bin/scene-forge --compact -p "$OUT/valley" model import --file "$OUT/pine.model-bundle.json" --dry-run | field data.models
   for model in pine boulder rail; do
     bin/scene-forge --compact -p "$OUT/valley" model import --file "$OUT/$model.model-bundle.json" | field data.models
   done
   ```

3. Add 60 m x 60 m hills at revision 0 and sample the surface. The dry run
   reports the heightfield and the proposed state; the write is guarded.

   ```sh
   bin/scene-forge --compact -p "$OUT/valley" terrain add ground --preset hills --size 60,60 --amplitude 6 --seed 7 --dry-run | field data.terrain.geometry
   bin/scene-forge --compact -p "$OUT/valley" terrain add ground --preset hills --size 60,60 --amplitude 6 --seed 7 --expected-revision 0 | field data.revision
   bin/scene-forge --compact -p "$OUT/valley" terrain sample ground --at "0,0;20,-12" | field data.samples
   ```

4. Scatter pines with some boulders (weight 0.4) on the terrain, keeping a 12 m
   clearing and slopes under 30 degrees free. Commit the plan with the revision
   and state the dry run read, and keep its normalized recipe.

   ```sh
   bin/scene-forge --compact -p "$OUT/valley" scatter --model pine,boulder:0.4 --on ground --spacing 4.5 --scale 0.7..1.2 --max-slope 30 --exclude circle:0,0,12 --seed 42 --group forest --dry-run > "$OUT/forest.dry.json"
   field data.placement < "$OUT/forest.dry.json"
   REV="$(field data.revision < "$OUT/forest.dry.json")"
   STATE="$(field data.stateHash < "$OUT/forest.dry.json")"
   bin/scene-forge --compact -p "$OUT/valley" scatter --model pine,boulder:0.4 --on ground --spacing 4.5 --scale 0.7..1.2 --max-slope 30 --exclude circle:0,0,12 --seed 42 --group forest --expected-revision "$REV" --expected-state "$STATE" > "$OUT/forest.json"
   field data.recipe < "$OUT/forest.json" > "$OUT/forest.scatter.json"
   field data.placement.recipeHash < "$OUT/forest.json"
   ```

   `placement` reports how many candidates were placed and why the others were
   rejected. The recipe in `forest.scatter.json` replays the same placements;
   with `--replace` it plans the same nodes, so nothing changes:

   ```sh
   bin/scene-forge --compact -p "$OUT/valley" scatter --file "$OUT/forest.scatter.json" --replace --dry-run | field data.changed
   ```

5. Lay two fence runs end to end across the clearing. `layout --path` turns each
   instance's +Z along the path, so `--yaw 90` aligns the fence's X axis with
   it; `--spacing 10` matches the run length.

   ```sh
   bin/scene-forge --compact -p "$OUT/valley" layout --model rail --path "-5,3;5,3" --spacing 10 --yaw 90 --on ground --group paddock --dry-run | field data.placement
   bin/scene-forge --compact -p "$OUT/valley" layout --model rail --path "-5,3;5,3" --spacing 10 --yaw 90 --on ground --group paddock --expected-revision 2 | field data.revision
   ```

6. List the generated groups with their recipe tags and review the scene.

   ```sh
   bin/scene-forge --compact -p "$OUT/valley" node list --tag scatter --type group | field data.nodes
   bin/scene-forge --compact -p "$OUT/valley" review --out "$OUT/valley-review" --views iso,top | field data.contactSheet
   ```

Confirm success: `valley-review/contact-sheet.png` shows the hills, a forest
with a clearing and the fence inside it; `node list` shows the `forest` and
`paddock` groups tagged `scatter:<hash>`; and the project is at revision 3.
Replacing the terrain later (`terrain add ground --replace`) does not move
placements: its result lists `staleScatterGroups`, which you regenerate with
`scatter --file … --replace`.

## Walkthrough B: a skirmish map and adventure quests

Add a generated mission to a copy of the RTS game, validate and build it, then
add generated quests to a copy of a colony game.

1. Copy the game folder and preview a mission. `--first` makes it the mission
   the play build starts.

   ```sh
   cp -R docs/concepts/rts-frontier "$OUT/rts-frontier"
   GAME="$OUT/rts-frontier"
   bin/wildlands generate rts-mission --game "$GAME" --mission ridge --preset frontier --seed 7 --first --dry-run > "$OUT/ridge.dry.json"
   field summary < "$OUT/ridge.dry.json"
   field nextCommands.0 < "$OUT/ridge.dry.json"
   ```

   `summary` reports the map size, factions, terrain tiles, whether the bases
   are connected, spawns, deposits and the encounter budget.

2. Write it with the digest the dry run read, keep the recipe, and validate and
   build the folder.

   ```sh
   DIGEST="$(field digest < "$OUT/ridge.dry.json")"
   bin/wildlands generate rts-mission --game "$GAME" --mission ridge --preset frontier --seed 7 --first --expected-digest "$DIGEST" > "$OUT/ridge.json"
   field recipe < "$OUT/ridge.json" > "$OUT/ridge.recipe.json"
   field recipeHash < "$OUT/ridge.json"
   bin/wildlands validate-game --game "$GAME" | field digest
   bin/wildlands build-game --game "$GAME" --output "$OUT/ridge.html" | field bytes
   ```

   Open `$OUT/ridge.html` in a desktop browser to play the generated map.

3. Replay the recipe. With `--replace` it regenerates the same mission, so the
   proposed digest equals the folder's current digest:

   ```sh
   bin/wildlands generate rts-mission --game "$GAME" --recipe "$OUT/ridge.recipe.json" --replace --dry-run > "$OUT/ridge.replay.json"
   test "$(field proposedDigest < "$OUT/ridge.replay.json")" = "$(field digest < "$OUT/ridge.replay.json")" && echo "the recipe reproduces the folder"
   ```

4. Add three tier-2 adventure quests to a copy of a colony game. They use only
   the biomes, skills, provisions and loot that the game's quests and catalogs
   already use, with numbers inside the envelope of its existing tier-2 quests.

   ```sh
   cp -R docs/concepts/emberworks "$OUT/emberworks"
   bin/wildlands generate adventure-quests --game "$OUT/emberworks" --count 3 --tier 2 --seed 11 --dry-run > "$OUT/quests.dry.json"
   field summary.ids < "$OUT/quests.dry.json"
   bin/wildlands generate adventure-quests --game "$OUT/emberworks" --count 3 --tier 2 --seed 11 --expected-digest "$(field digest < "$OUT/quests.dry.json")" | field file
   bin/wildlands validate-game --game "$OUT/emberworks" | field ok
   ```

Confirm success: `validate-game` reports `ok` and the new digest, and the build
writes an HTML file within the folder's play budget. A generated mission or
quest passes the engine's validators and builds; that is not playtesting or
balance validation.

## Hand generated assets to a game

A generated model reaches a Wildlands game as a Littlewild definition. Export it
over an existing definition of the same family and ID in a copied game folder:
Model Forge replaces only the chosen variant of the `visual` facet and keeps the
definition's gameplay facets, so the game's rules stay valid. This replaces the
Littlewild shore rock with a generated stone of the same size and builds the
game:

```sh
cp -R docs/concepts/littlewild "$OUT/littlewild"
mkdir -p "$OUT/generated"
bin/model-forge --compact generate rock --preset stone --seed 21 --set size=0.85 --id shore-rock --name "Shore rock" --out "$OUT/generated/shore-rock.model.json" | field data.recipeHash
bin/model-forge --compact -d "$OUT/generated/shore-rock.model.json" export --format littlewild --family items --variant world --out "$OUT/littlewild/assets/items/shore-rock/definition.json" --dry-run | field data.variants
bin/model-forge --compact -d "$OUT/generated/shore-rock.model.json" export --format littlewild --family items --variant world --out "$OUT/littlewild/assets/items/shore-rock/definition.json" | field data.written
bin/wildlands validate-game --game "$OUT/littlewild" | field ok
bin/wildlands build-game --game "$OUT/littlewild" --output "$OUT/littlewild.html" | field bytes
```

Littlewild assets are authored at a small scale (the shore rock is about 0.85 m
across), so size the generator's parameters to the definition you replace; an
import of the existing variant (`model-forge import --from <definition.json>
--variant world`) reports its bounds. To give a companion a new look, export to
a `creatures/<id>/definition.json` copy and attach it to a portable project with
`wildlands creature attach-visual`, as in the
[Model Forge handbook](../reference/model-forge-cli.md#outputs-and-consumers). A
GLB export (`export --format glb --validate`) serves engines and DCC tools.

To publish a change into a real game folder, follow the
[documentation policy for game folders](maintaining-documentation.md#game-folders):
validate the folder and rebuild its demo in the same change.

## What this does not establish

Generated content is reproducible and validated against each tool's structural
contracts. Reviews are automated headless renders; pixel-identical images across
machines are not promised. None of this is human visual review, playtesting,
balance or usability validation.

## Related

- [Model Forge CLI](../reference/model-forge-cli.md): generators, presets,
  `variants`, document `scatter`, model bundles and Littlewild export.
- [Scene Forge CLI](../reference/scene-forge-cli.md): projects, the model
  registry, `terrain`, `scatter`, `layout` and `review`.
- [Wildlands CLI](../reference/wildlands-cli.md): `generate`, `validate-game`,
  `build-game` and `creature attach-visual`.
- [Author a Wildlands RTS mission](rts-mission-editor.md): refine a generated
  mission by hand in the mission editor of a studio build of the copied folder.
- [Author Littlewild assets in Scene Forge](scene-forge-littlewild-assets.md):
  scene-wide Littlewild synchronization.
