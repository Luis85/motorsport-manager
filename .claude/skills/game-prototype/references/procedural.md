# Procedural shortcuts for a prototype run

The full guide is `docs/how-to/procedural-generation.md`; the contracts are the handbooks'
procedural sections (`docs/reference/model-forge-cli.md`, `scene-forge-cli.md`, `wildlands-cli.md`
`generate`). This page holds the prototype-specific choices behind SKILL.md A1, A3, A4 and C.

## What to generate, and what not

| Need | Command | Notes |
|---|---|---|
| A new prop for key art | `model-forge generate <rock\|tree\|bush\|crate\|barrel\|fence\|building\|terrain> --preset … --seed … --review DIR` | Seconds per model; `generate list` / `generate show <gen>` give presets and parameter ranges |
| Several looks of one prop | `model-forge -d <doc> variants --count N --vary <param=min..max> --out DIR --review` | One lineup review |
| Key art ground and dressing | `scene-forge terrain add`, `layout`, `scatter` | Replaces hand-placed compositions |
| A playable RTS map | `wildlands generate rts-mission --first` | Track C |
| More colony content | `wildlands generate adventure-quests` | A1; only existing biomes, skills, provisions and loot |

Do not generate hero characters (Character Studio) or reskins of assets the game already uses (A3
reskin): generators make new, unrigged models. A new model is not used by the game until content
refers to it.

## Scale

Littlewild and Emberworks assets are small: a companion is about 1 m tall, items and beds are
0.3 to 1 m across. Generator defaults are real-world sizes (a stone 0.5 m, a flowering bush 1 m,
a conifer 9 m), so set the size parameters with `--set` and read `data.documents.0.stats.bounds.size`
in the result:

| Generator | Size parameters (`generate show <gen>` has ranges) | Prop-scale example |
|---|---|---|
| rock | `size`, `height`, `stretch` | `--preset stone --set size=0.3` |
| bush | `size`, `height`, `length` | `--preset flowering --set size=0.6` |
| tree | `height`, `canopy` | `--preset conifer --set height=2` |
| crate | `width`, `height`, `depth` | `--preset small` |
| barrel | `radius`, `height` | `--set radius=0.2 --set height=0.5` |

Colors are generator parameters too (`--set color=#55606b`, `--set leafColor=…`); an unknown name
fails with `UNKNOWN_PARAMETER`, an unknown preset with `INVALID_OPTION` (`details.available`).

## Key art layout

- Terrain at prop scale: `terrain add ground --preset hills --size 5,5 --amplitude 0.3`. Larger
  terrains shrink the hero in the auto-framed review.
- The hero is a model too: `layout --model <hero model> --grid 1x1 --step 1 --yaw <deg> --on ground`
  grounds it at the center.
- Rings: `scatter --area circle:0,0,R --exclude circle:0,0,r`. Keep the front camera's view of the
  hero clear with `--exclude rect:-1,0,1,3` (the `front` view looks from +Z).
- Iterate with the same group and `--replace` (keep the guard). `terrain add --replace` does not
  move placements: its result lists `staleScatterGroups` to regenerate.
- `SCATTER_EMPTY` means every candidate was rejected: read `details.rejected` (`outside`,
  `exclusion`, `slope`, `budget`) and widen the area or lower `--spacing`.

## Use a generated prop in the game

Export it over an existing definition of the same family, ID and similar size in the scratch game
folder: only that definition's `visual` variant changes and its gameplay stays valid. Emberworks'
`items/shore-rock` has a single `world` variant about 0.85 m across:

```sh
W=<abs>; . "$W/env.sh"; ID=glowmoss; DEF="$W/game/$ID/assets/items/shore-rock/definition.json"
r mf-gen-shore bin/model-forge --compact generate rock --preset stone --seed 21 --set size=0.85 --set color=#55606b --id shore-rock --name "Shore rock" --out "$W/models/shore-rock.model.json"
r mf-shore-dry bin/model-forge --compact -d "$W/models/shore-rock.model.json" export --format littlewild --family items --variant world --out "$DEF" --dry-run
r mf-shore bin/model-forge --compact -d "$W/models/shore-rock.model.json" export --format littlewild --family items --variant world --out "$DEF"
r shore-validate bin/wildlands validate-game --game "$W/game/$ID"
```

Run it before A5 so the project and the build pick it up.

## Record and replay

Every generated output must be reproducible from the storyboard facts. Record per output: the tool,
generator or recipe, `seed` and `recipeHash` (terrain: preset, size, amplitude and seed). SKILL.md
section 3 writes them to `logs/generated.tsv`; copy that table into a storyboard caption.

Replays, when someone asks how a capture was made:

```sh
W=<abs>; . "$W/env.sh"
mkdir -p "$W/replay"
r replay-bush bin/model-forge --compact generate bush --file "$W/models/glowbush.generate.json" --out "$W/replay/glowbush.model.json"
cmp "$W/models/glowbush.model.json" "$W/replay/glowbush.model.json" && echo "bush replays byte-identically"
j "$W/logs/sf-props.json" data.recipe > "$W/replay/props.scatter.json"
r replay-props bin/scene-forge --compact -p "$W/keyart" scatter --file "$W/replay/props.scatter.json" --replace --dry-run
j "$W/logs/replay-props.json" data.changed; echo   # false: the recipe plans the same nodes
```

A Wildlands result's `recipe` replays with `--recipe FILE --replace --dry-run`; its
`proposedDigest` then equals `digest`.

## Content generators in a prototype

- `rts-mission`: presets `skirmish` (40 x 32), `island`, `frontier` (with a road) and `river`;
  `--difficulty 1..5`; `--first` makes it the mission the play build starts. `generation-failed`
  means no playable layout for that seed: try the next seed.
- `adventure-quests`: `--count 1..24`, `--tier 1..3`, optional `--biome` (an existing one). Quest
  ids are `gen-<seed>-<n>`. On Emberworks they go into `content/emberworks.pack.json`, so run it in
  A1, before A5 reads the pack.
- Both need a canonical two-space JSON content file (`non-canonical-file` otherwise) and one
  publication mode: `--dry-run`, then `--expected-digest` with the dry run's `digest`.
- Generated content passes the engine validators and builds. It is not playtested or balanced;
  say so in the storyboard's limits card.
