---
name: game-prototype
description: Build a fast, throwaway playable game prototype with the checked-in tools (bin/character-studio, bin/model-forge, bin/scene-forge, bin/wildlands) and present it as a self-contained HTML storyboard. Use when asked to "prototype a game", try a "quick game idea", "make a playable prototype and storyboard", pitch or mock up a Wildlands game, build a vertical slice or demo from an idea, or show a game concept with real captures (hero character, generated props, procedural key art, generated missions or quests, built HTML game, headless play facts).
---

# Fast game prototype and storyboard

Turns a one-line idea into: a hero (Character Studio), generated and reskinned props (Model
Forge), procedural key art (Scene Forge terrain, layout and scatter), a validated portable project
with generated content, headless play facts and a self-contained playable HTML (Wildlands),
screenshots, and one deterministic storyboard page (`wildlands storyboard`). Everything is data
driven through guarded CLI commands: **no engine or game code is written**. A validated run (Track
A plus Track C) took about 4 minutes of tool time. Time-box it to one pass; do not polish.

Read first (skim): `AGENTS.md` ("Standalone CLI projects", "Documentation housekeeping"),
`bin/README.md`, `docs/reference/wildlands-cli.md` (`storyboard`, `create`, `run`, `edit`,
Character Studio interchange, `generate`), `docs/how-to/character-agent-workflow.md`,
`docs/how-to/procedural-generation.md` and [references/procedural.md](references/procedural.md)
(prop scale, key-art layout, content generators, replays). Flags change: when a
command here fails with a usage error, run its discovery (`bin/wildlands discover`,
`bin/wildlands creature discover`, `bin/wildlands storyboard schema`,
`bin/model-forge describe <cmd>`, `bin/scene-forge describe <cmd>`,
`bin/character-studio describe --command <cmd>`, `bin/model-forge generate show <gen>`,
`bin/wildlands generate discover`) and follow it, not memory.

Rules: work only in a new scratch directory; never write into `docs/concepts/`, `demos/`, `bin/`
or `source/`; never hand-edit generated output (built HTML, review manifests); outputs go to new
paths. Another agent may rebuild `bin/*` concurrently: if a bin command behaves oddly, re-run it.

## 0. Set up the scratch run (once)

Tool time per block: A1-A6 and C under a minute each (A4's review and A5's run take 30-45 s); A7
about 80 s with software WebGL; slower machines took up to 2 minutes for A6. Give shell calls a
5-minute timeout or run long blocks in the background. Shell state does not persist between tool calls, so the run keeps its variables
and two helpers in `$W/env.sh`; start **every** later shell call with
`W=<same absolute path>; . "$W/env.sh"`. `env.sh` sets `set -e`, so a block stops at the first
failure: fix it and continue from that command. Do not re-run a whole block: Character Studio
`create`, creature and review outputs are new-only and refuse to overwrite earlier evidence.

```sh
W=<scratchpad>/prototype-<id>       # absolute, new; <id> is the prototype id, e.g. glowmoss
REPO="$(git rev-parse --show-toplevel)"
mkdir -p "$W"/logs "$W"/captures "$W"/tools "$W"/models "$W"/project "$W"/build "$W"/game
cat > "$W/env.sh" <<EOF
cd "$REPO"
W="$W"
EOF
cat >> "$W/env.sh" <<'EOF'
set -e   # stop the shell call at the first failed step; read logs/NAME.json or .err, fix, re-run the rest
if [ -x /opt/pw-browsers/chromium ]; then   # this cloud image; elsewhere set your own Chromium or rely on Playwright's
  export FORGE_CHROMIUM_PATH=/opt/pw-browsers/chromium CHARACTER_STUDIO_CHROMIUM_PATH=/opt/pw-browsers/chromium PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium
fi
# r NAME CMD...: run CMD, keep stdout in logs/NAME.json and stderr in logs/NAME.err, log the argv
r() { local n="$1" s=0; shift; printf '%s\t%s\n' "$n" "$*" >> "$W/logs/commands.tsv"; "$@" > "$W/logs/$n.json" 2> "$W/logs/$n.err" || s=$?; printf '%s exit=%s %s\n' "$n" "$s" "$(head -c 240 "$W/logs/$n.json" | tr -d '\n')"; if [ -s "$W/logs/$n.err" ]; then head -c 600 "$W/logs/$n.err"; echo; fi; return $s; }
# j FILE [PATH]: print one field (dot path, e.g. data.stateHash) of a JSON file
j() { node -e 'const v=(process.argv[2]||"").split(".").filter(Boolean).reduce((o,k)=>o==null?o:o[k],JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")));process.stdout.write(typeof v==="object"?JSON.stringify(v):String(v))' "$1" "${2:-}"; }
EOF
. "$W/env.sh"
r versions-wildlands bin/wildlands --version
r mf-doctor bin/model-forge --compact doctor
r sf-doctor bin/scene-forge --compact doctor
r cs-doctor bin/character-studio doctor --project "$W/chars" --capture
j "$W/logs/mf-doctor.json" data.reviewReady; echo; j "$W/logs/cs-doctor.json" capture.ready; echo
```

`model-forge doctor` reports `reviewReady` and the Playwright module it resolved
(`data.playwright.resolvedFrom`); `character-studio doctor --capture` reports `capture.ready` and
`webgl2`; `scene-forge doctor` reports Playwright and Chromium. **No browser:** skip every
`review` and the HTML capture, keep going, and give storyboard cards an `intent`/`caption` that
says "No capture: <doctor reason>" (the storyboard prints **No capture supplied** for them). Never
synthesize screenshots or describe looks you did not render.

## 1. Frame the idea (5 minutes, no tools)

Write down, for the storyboard `intent` fields: a one-paragraph pitch, the core loop in one
sentence, 3-5 beats (what the player sees first, does, gets back). Then pick the **closest existing
game folder**; do not invent mechanics the engine lacks.

| Idea shape | Template | Start from | Track |
|---|---|---|---|
| Companions living, gathering, caring, building (garden, village, workshop) | colony | `docs/concepts/emberworks` (complete pack, own scene ids; verified) or `office` (operations; not verified here) | A (below) |
| Deliveries, queues, service flows, customer/user journeys | process | a new definition (`process create`) | B: [references/process-track.md](references/process-track.md) |
| A small skirmish map | rts | `docs/concepts/rts-frontier` | C (below): copy + re-identify (A1), generate a mission, validate, build, capture |
| One virtual pet | pet | `docs/concepts/pocket-pet` | copy + re-identify (A1), validate, build (A6), capture (A7) only |

Run `bin/wildlands discover --game <base folder>` to see the gameplay commands that exist.

Do **not** base an HTML prototype on `docs/concepts/littlewild`: it is the canonical game. Its thin
pack inherits `content.canonicalId` defaults, and the browser rebuilds its `first-morning` and
`charted-home` scenes from those defaults, so renamed scenes, added entities and the new hero never
appear in the built HTML (renaming its scene ids instead breaks the page with "runtime staging:
Only JSON data is accepted"). Emberworks has the same assets and rules with a complete pack.

## 2. Track A: colony prototype

The example values are the validated run "Glowmoss Garden" (base `emberworks`, hero `glim`, the
herb bed reskinned as glowing moss). Replace ids, names and colors; keep the command shapes.

### A1. Scratch game folder with a new identity

```sh
W=<abs>; . "$W/env.sh"
BASE=docs/concepts/emberworks; ID=glowmoss    # the folder name must equal the game id
cp -r "$BASE" "$W/game/$ID"
node -e '
const fs=require("fs"); const [dir,id,title,desc]=process.argv.slice(1); const f=dir+"/game.json";
const g=JSON.parse(fs.readFileSync(f,"utf8"));
delete g["$schema"];                     // relative to docs/concepts; meaningless in scratch
Object.assign(g,{id,name:title,version:"0.1.0"});
Object.assign(g.presentation,{title,description:desc});
g.storage.namespace="wildlands."+id;     // required form; keeps browser saves apart from the real game
g.targets.html.output="demos/"+id+".html";
g.targets.html.budgetBytes=8388608;      // a Character Studio hero adds ~1.5 MB to a colony play build
fs.writeFileSync(f,JSON.stringify(g,null,2)+"\n");
' "$W/game/$ID" "$ID" "Glowmoss Garden" "Prototype: a lantern-moss garden tended by Glim. Synthetic values."
r a1-validate bin/wildlands validate-game --game "$W/game/$ID"
r a1-quests-dry bin/wildlands generate adventure-quests --game "$W/game/$ID" --count 2 --tier 1 --seed 11 --dry-run
r a1-quests bin/wildlands generate adventure-quests --game "$W/game/$ID" --count 2 --tier 1 --seed 11 --expected-digest "$(j "$W/logs/a1-quests-dry.json" digest)"
j "$W/logs/a1-quests.json" summary.ids; echo
r a1-validate2 bin/wildlands validate-game --game "$W/game/$ID"
```

Report the raised `budgetBytes` (the published Emberworks budget is 4 MiB). Keep the README copy as
is; it is outside the digest. The two generated quests (`gen-11-1`, `gen-11-2`) use only the pack's
existing biomes, skills and loot; skip them for a non-colony base. Track C continues at C below;
a pet prototype continues at A6/A7.

### A2. Hero with Character Studio

```sh
W=<abs>; . "$W/env.sh"
bin/character-studio catalog > "$W/logs/cs-catalog.json"   # presets, outfits (slot:id), skills
r cs-create bin/character-studio create --project "$W/chars" --id glim --name Glim --preset mochi
r cs-inspect bin/character-studio inspect --project "$W/chars" --id glim
REV=$(j "$W/logs/cs-inspect.json" revision); STATE=$(j "$W/logs/cs-inspect.json" stateHash)
cat > "$W/hero.batch.json" <<'EOF'
{"operations":[
  {"op":"set","path":"/appearance/coat","value":"#cfe3d6"},
  {"op":"set","path":"/appearance/eyeColor","value":"#2f6f5e"},
  {"op":"set","path":"/outfits/tool","value":"lantern"},
  {"op":"set","path":"/outfits/back","value":"field_satchel"}
]}
EOF
r cs-apply-dry bin/character-studio apply --project "$W/chars" --id glim --file "$W/hero.batch.json" --expected-revision "$REV" --expected-state "$STATE" --dry-run
r cs-apply bin/character-studio apply --project "$W/chars" --id glim --file "$W/hero.batch.json" --expected-revision "$REV" --expected-state "$STATE"
cat > "$W/hero-review.plan.json" <<'EOF'
{"format":"character-studio-review-plan","schemaVersion":1,"views":[
  {"id":"front","camera":"front","width":384,"height":384},
  {"id":"three-quarter","camera":"three-quarter","width":384,"height":384},
  {"id":"portrait","mode":"portrait","width":384,"height":384},
  {"id":"night-walk","mode":"world","light":"night","pose":"walk","camera":"three-quarter","time":0.35,"width":384,"height":384}
]}
EOF
r cs-review bin/character-studio review --project "$W/chars" --id glim --out "$W/hero-review" --plan "$W/hero-review.plan.json"
r cs-recipe bin/character-studio export --project "$W/chars" --id glim --format recipe --out "$W/glim.recipe.json"
r cs-package bin/character-studio export --project "$W/chars" --id glim --format package --out "$W/glim.package.json"
```

Open `$W/hero-review/contact-sheet.png` and look at it before moving on. A stale guard exits 3:
inspect again and rebuild the batch. Presets: `pip`, `fern`, `mochi`, `bramble`.

### A3. Props with Model Forge (generate for key art, reskin for the game)

The fast path for key-art props is a generator: one command writes a parametric model, its
replayable `<id>.generate.json` recipe and a four-view review. Size generated props to the game's
scale (a companion is about 1 m tall; see references/procedural.md).

```sh
W=<abs>; . "$W/env.sh"
bin/model-forge generate list > "$W/logs/mf-generators.json"   # generators, presets, examples
r mf-gen-rock bin/model-forge --compact generate rock --preset stone --seed 5 --set size=0.3 --set color=#55606b --out "$W/models/mossrock.model.json" --review "$W/mossrock-review"
r mf-gen-bush bin/model-forge --compact generate bush --preset flowering --seed 6 --set size=0.6 --set leafColor=#3fbf9a --set flowerColor=#f4ffb8 --out "$W/models/glowbush.model.json" --review "$W/glowbush-review"
j "$W/logs/mf-gen-bush.json" data.documents.0.stats.bounds.size; echo
```

Open both `contact-sheet.png` files. A generated model is not used by the game until content refers
to it; to put one in the build, export it over an existing definition of similar size
(references/procedural.md). Reskinning a definition the game already uses keeps gameplay valid and
shows up in the build. The scratch folder copy is laid out as `<family>/<id>/definition.json`, so
export merges in place.

```sh
W=<abs>; . "$W/env.sh"; ID=glowmoss; DEF="$W/game/$ID/assets/items/herbs/definition.json"
r mf-import bin/model-forge --compact import --from "$DEF" --variant world --out "$W/models/herbsWorld.model.json"
r mf-check bin/model-forge --compact -d "$W/models/herbsWorld.model.json" export --format littlewild --variant world --out "$DEF" --check
r mf-inspect bin/model-forge --compact -d "$W/models/herbsWorld.model.json" inspect --source
j "$W/logs/mf-inspect.json" data.source.materials; echo; j "$W/logs/mf-inspect.json" data.counts; echo
REV=$(j "$W/logs/mf-inspect.json" data.revision); STATE=$(j "$W/logs/mf-inspect.json" data.stateHash)
cat > "$W/prop.batch.json" <<'EOF'
{"operations":[
  {"op":"putMaterial","id":"leaf","material":{"color":"#3fbf9a","emissive":"#1d7a62","emissiveIntensity":0.6,"roughness":0.7,"flatShading":true}},
  {"op":"putMaterial","id":"light","material":{"color":"#7fe0c0","emissive":"#2fa486","emissiveIntensity":0.7,"roughness":0.7,"flatShading":true}},
  {"op":"putMaterial","id":"flower","material":{"color":"#f4ffb8","emissive":"#e6f27a","emissiveIntensity":1.2,"roughness":0.5,"flatShading":true}},
  {"op":"putGeometry","id":"glow-orb","geometry":{"type":"sphere","radius":0.06}},
  {"op":"putNode","node":{"id":"glow-orb","type":"mesh","geometry":"glow-orb","material":"flower","transform":{"position":[0.12,0.52,0.05]}}}
]}
EOF
r mf-apply-dry bin/model-forge --compact -d "$W/models/herbsWorld.model.json" apply --file "$W/prop.batch.json" --dry-run
r mf-apply bin/model-forge --compact -d "$W/models/herbsWorld.model.json" apply --file "$W/prop.batch.json" --expected-revision "$REV" --expected-state "$STATE"
r mf-validate bin/model-forge --compact -d "$W/models/herbsWorld.model.json" validate
r mf-review bin/model-forge --compact -d "$W/models/herbsWorld.model.json" review --out "$W/prop-review" --views iso,front --width 480 --height 360 --background '#1b2430'
r mf-export-dry bin/model-forge --compact -d "$W/models/herbsWorld.model.json" export --format littlewild --variant world --out "$DEF" --dry-run
r mf-export bin/model-forge --compact -d "$W/models/herbsWorld.model.json" export --format littlewild --variant world --out "$DEF"
r mf-bundle bin/model-forge --compact -d "$W/models/herbsWorld.model.json" export --format model-bundle --out "$W/models/glowmoss.model-bundle.json"
r a3-validate bin/wildlands validate-game --game "$W/game/$ID"
```

The first `--check` must pass (an unedited import re-exports byte-identically); if it fails, stop
and report. Failures print JSON on stderr (`logs/NAME.err`) with `error.code` and `error.hint`.
For a hand-built model instead of a generator: `bin/model-forge create "$W/models/<id>.model.json"
--id <id> --name "<name>"`, `add box|sphere|cylinder|cone|torus|capsule|plane`, then `review`.

### A4. Key art with Scene Forge (terrain, layout, scatter)

Small hills at prop scale, the hero grounded at the center, moss beds around it and the generated
props in an outer ring, all seeded and guarded. Imports do not change the scene revision; each
placement does, so the guards count up from the terrain's dry run.

```sh
W=<abs>; . "$W/env.sh"; P="$W/keyart"
r sf-init bin/scene-forge --compact init "$P" --name "Glowmoss key art"
r sf-model-dry bin/scene-forge --compact -p "$P" model import --file "$W/models/glowmoss.model-bundle.json" --dry-run
r sf-model bin/scene-forge --compact -p "$P" model import --file "$W/models/glowmoss.model-bundle.json"
r sf-rock bin/scene-forge --compact -p "$P" model import --file "$W/models/mossrock.model.json"
r sf-bush bin/scene-forge --compact -p "$P" model import --file "$W/models/glowbush.model.json"
r sf-inspect bin/scene-forge --compact -p "$P" inspect
REV=$(j "$W/logs/sf-inspect.json" data.revision); STATE=$(j "$W/logs/sf-inspect.json" data.stateHash)
r sf-hero-dry bin/scene-forge --compact -p "$P" littlewild import --definition "$W/glim.package.json" --expected-revision "$REV" --expected-state "$STATE" --dry-run
r sf-hero bin/scene-forge --compact -p "$P" littlewild import --definition "$W/glim.package.json" --expected-revision "$REV" --expected-state "$STATE"
j "$W/logs/sf-hero.json" data.variantModels; echo   # pick world-<ears of the hero>, e.g. glimWorldPointed
HERO=glimWorldPointed
r sf-terrain-dry bin/scene-forge --compact -p "$P" terrain add ground --preset hills --size 5,5 --amplitude 0.3 --seed 3 --dry-run
REV=$(j "$W/logs/sf-terrain-dry.json" data.revision); STATE=$(j "$W/logs/sf-terrain-dry.json" data.stateHash)
r sf-terrain bin/scene-forge --compact -p "$P" terrain add ground --preset hills --size 5,5 --amplitude 0.3 --seed 3 --expected-revision "$REV" --expected-state "$STATE"
r sf-hero-place bin/scene-forge --compact -p "$P" layout --model "$HERO" --grid 1x1 --step 1 --yaw -20 --on ground --group hero --expected-revision $((REV + 1))
r sf-moss bin/scene-forge --compact -p "$P" scatter --model herbsWorld --area circle:0,0,1.3 --exclude circle:0,0,0.6 --exclude rect:-0.6,0,0.6,3 --spacing 0.7 --max 4 --seed 4 --on ground --group moss --expected-revision $((REV + 2))
r sf-props-dry bin/scene-forge --compact -p "$P" scatter --model mossrock,glowbush --area circle:0,0,2.4 --exclude circle:0,0,1.4 --exclude rect:-1,0,1,3 --spacing 0.75 --scale 0.8..1.3 --seed 7 --on ground --group props --dry-run
j "$W/logs/sf-props-dry.json" data.placement; echo
r sf-props bin/scene-forge --compact -p "$P" scatter --model mossrock,glowbush --area circle:0,0,2.4 --exclude circle:0,0,1.4 --exclude rect:-1,0,1,3 --spacing 0.75 --scale 0.8..1.3 --seed 7 --on ground --group props --expected-revision $((REV + 3))
r sf-validate bin/scene-forge --compact -p "$P" validate
r sf-review bin/scene-forge --compact -p "$P" review --out "$W/keyart-review" --views iso,front --width 640 --height 400 --background '#1b2430'
```

The Model Forge bundle's entry id (`herbsWorld`) and the generated documents' ids (`mossrock`,
`glowbush`) are the Scene Forge model ids. Dry-runs of `littlewild import` print the whole model,
which is why `r` keeps stdout in a file. Each placement result reports `placed`, `rejected` counts
and a `recipeHash`; the `rect` exclusions keep the `front` view of the hero clear. Open the contact
sheet; to adjust a ring, repeat its command with another `--seed` or `--spacing`, `--replace` and the
current revision.

### A5. Portable project: retitle, edit, install the hero, play headlessly

```sh
W=<abs>; . "$W/env.sh"; ID=glowmoss; P="$W/project"
r wl-create bin/wildlands create --game "$W/game/$ID" --id glowmoss-proto --name "Glowmoss Garden" --output "$P/p0.json"
node -e '
const fs=require("fs"); const [src,dst,name,desc,tagline,subtitle]=process.argv.slice(1);
const p=JSON.parse(fs.readFileSync(src,"utf8")).pack;
Object.assign(p,{name,description:desc}); Object.assign(p.presentation,{title:name,tagline,worldSubtitle:subtitle});
fs.writeFileSync(dst,JSON.stringify(p,null,2)+"\n");
' "$P/p0.json" "$P/retitled.pack.json" "Glowmoss Garden" "A lantern-moss garden prototype on the shared autonomous-life simulation." "Light the way home" "A dusky hollow. Lantern moss everywhere."
r wl-create-pack bin/wildlands create --game "$W/game/$ID" --pack "$P/retitled.pack.json" --id glowmoss-proto --name "Glowmoss Garden" --output "$P/p1.json"
cat > "$P/world.editor-recipe.json" <<'EOF'
{"format":"wildlands-editor-recipe","schemaVersion":1,"operations":[
  {"operation":"updateWorld","args":["copper-shore",{"name":"Glowmoss Hollow","description":"A dusky hollow where lantern moss lights the paths."}]},
  {"operation":"updateScene","args":["workshop-first-morning",{"name":"First glow","description":"Glim wakes in the hollow and tends the first lantern-moss beds."}]},
  {"operation":"addEntity","args":["workshop-first-morning","nodes","v3-herbs-0","glowmoss-1",9,9]},
  {"operation":"addEntity","args":["workshop-first-morning","nodes","v3-herbs-1","glowmoss-2",10,12]}
]}
EOF
r wl-edit bin/wildlands edit --project "$P/p1.json" --recipe "$P/world.editor-recipe.json" --output "$P/p2.json"
r wl-list bin/wildlands creature list --project "$P/p2.json"
FP=$(j "$W/logs/wl-list.json" fingerprint)
r wl-import-dry bin/wildlands creature import --project "$P/p2.json" --file "$W/glim.package.json" --expected-fingerprint "$FP" --dry-run
r wl-import bin/wildlands creature import --project "$P/p2.json" --file "$W/glim.package.json" --expected-fingerprint "$FP" --output "$P/p3.json"
r wl-list2 bin/wildlands creature list --project "$P/p3.json"
FP=$(j "$W/logs/wl-list2.json" fingerprint)
cat > "$P/hero.creature-recipe.json" <<'EOF'
{"format":"wildlands-creature-recipe","schemaVersion":1,"operations":[
  {"op":"setField","id":"instance:archetype","value":"glim"},
  {"op":"setField","id":"instance:name","value":"Glim"}
]}
EOF
r wl-hero-dry bin/wildlands creature edit --project "$P/p3.json" --archetype sproutling --instance c1 --recipe "$P/hero.creature-recipe.json" --expected-fingerprint "$FP" --dry-run
r wl-hero bin/wildlands creature edit --project "$P/p3.json" --archetype sproutling --instance c1 --recipe "$P/hero.creature-recipe.json" --expected-fingerprint "$FP" --output "$P/p4.json"
r wl-validate bin/wildlands validate --project "$P/p4.json"
r wl-inspect bin/wildlands inspect --project "$P/p4.json"
cat > "$P/play.recipe.json" <<'EOF'
{"format":"wildlands-recipe","schemaVersion":1,"operations":[
  {"operation":"start"},
  {"operation":"command","command":{"id":"select-creature","args":["c1"]}},
  {"operation":"command","command":{"id":"set-stock-target","actorId":"c1","args":["herbs",6]}},
  {"operation":"advance","seconds":300},
  {"operation":"inspect"}
]}
EOF
r wl-run bin/wildlands run --project "$P/p4.json" --recipe "$P/play.recipe.json" --output "$P/played.json"
j "$W/logs/wl-run.json" advancedSeconds; echo; j "$W/logs/wl-run.json" snapshot.actors; echo
```

- Take ids from facts, never display names: scene/world ids from `scenarios`/`inspect`, entity
  ids from `p0.json` (`pack.scenes[].initialState.nodes|buildings`), companion ids from
  `creature list`. `addEntity` copies an existing entity of that category (`templateId`); the
  edit fails with "World save: unknown or duplicate node" when the target tile cannot hold it
  (water, a reserved site or another entity): pick another tile near the template.
- Commands and argument counts come from `bin/wildlands discover --game DIR`; a rejected command
  fails the whole `run` (exit 2) and writes nothing. Recipes are capped at 36,000 steps (one
  simulated hour); chain several `run`s for longer.
- `--archetype` on the companion edit is the companion's **current** archetype (`sproutling`
  for Emberworks' `c1` "Rivet"); selecting the new archetype instead fails with "Selected
  companion identity must match this archetype and personality".
- Optional: `bin/wildlands compile --project "$P/p4.json" --output "$W/build/godot"` writes a
  Godot 4.4+ desktop project (not run here; needs Godot).

### A6. Put the pack back, validate and build the playable HTML

```sh
W=<abs>; . "$W/env.sh"; ID=glowmoss
PACKFILE=$(j "$W/game/$ID/game.json" content.packs.0)
node -e 'const fs=require("fs");const [src,dst]=process.argv.slice(1);fs.writeFileSync(dst,JSON.stringify(JSON.parse(fs.readFileSync(src,"utf8")).pack,null,2)+"\n")' "$W/project/p4.json" "$W/game/$ID/$PACKFILE"
r a6-validate bin/wildlands validate-game --game "$W/game/$ID"
r a6-inspect-game bin/wildlands inspect-game --game "$W/game/$ID"
r a6-build bin/wildlands build-game --game "$W/game/$ID" --output "$W/build/$ID.html"
r a6-check bin/wildlands build-game --game "$W/game/$ID" --check "$W/build/$ID.html"
```

`p4.json` is the edited **initial** state (not `played.json`); the project's pack is the complete
scenario pack the folder names, so it round-trips into the folder. `over-budget` means raise
`targets.html.budgetBytes` in the scratch `game.json` (A1) and report it.

### A7. Capture the built game headlessly

There is no CLI capture for colony/pet/rts HTML. Write the Playwright capture script once from
[references/capture-html.md](references/capture-html.md) (its block writes
`$W/tools/capture-html.mjs`; never into the repository), then:

```sh
W=<abs>; . "$W/env.sh"
export PW_ENTRY="$(j "$W/logs/mf-doctor.json" data.playwright.resolvedFrom)"
r a7-capture timeout 180 node "$W/tools/capture-html.mjs" "$W/build/glowmoss.html" "$W/captures" --click "First glow" --speed "Four times speed" --frames 240
```

`--click` is the accessible name of the scene button on the "Choose a beginning" dialog (the edited
scene name); `--speed` is a speed button's `aria-label` ("Normal speed", "Double speed", "Four
times speed"). A click that cannot be found fails after 15 s: open `desktop-start.png` to read the
real label.
Open every PNG and check: the new title, the hero in the world, readable text, no blank canvas.
`consoleErrors` must be `[]`; otherwise report them. Process games use `process:shots` instead
(Track B).

## 2C. Track C: generated skirmish map

Run A1 with `BASE=docs/concepts/rts-frontier`, a new id (for example `ID=ridgefront`) and title,
without the quest lines (an RTS play build is about 190 KB, so drop A1's 8 MiB `budgetBytes` line
to keep the folder's 512 KiB budget). Then generate the map instead of hand-authoring it (write the
capture script first, A7):

```sh
W=<abs>; . "$W/env.sh"; ID=ridgefront
r c-gen-dry bin/wildlands generate rts-mission --game "$W/game/$ID" --mission ridge --preset frontier --seed 7 --first --dry-run
j "$W/logs/c-gen-dry.json" summary; echo
r c-gen bin/wildlands generate rts-mission --game "$W/game/$ID" --mission ridge --preset frontier --seed 7 --first --expected-digest "$(j "$W/logs/c-gen-dry.json" digest)"
j "$W/logs/c-gen.json" recipe > "$W/ridge.recipe.json"
r c-validate bin/wildlands validate-game --game "$W/game/$ID"
r c-build bin/wildlands build-game --game "$W/game/$ID" --output "$W/build/$ID.html"
export PW_ENTRY="$(j "$W/logs/mf-doctor.json" data.playwright.resolvedFrom)"
r c-capture timeout 180 node "$W/tools/capture-html.mjs" "$W/build/$ID.html" "$W/captures-rts"
```

`--first` makes the generated mission the one the play build starts. `summary` has the factions,
terrain tiles, `connected`, spawns, deposits and encounter budget for the storyboard caption;
`generation-failed` means no playable layout for that seed (try the next). Storyboard cards: the
summary (`logs/c-gen.json`, caption with seed and `recipeHash`), the build (`logs/c-build.json`)
and the captures. Presets and bounds: references/procedural.md.

## 3. Storyboard

Write `$W/storyboard.json` (all paths relative to it, all inputs beneath `$W`). Keep the three
kinds of content apart: **intent** (`intent`, authored), **facts** (`source`: JSON the tools wrote),
**visual evidence** (`image`, or review manifests, which embed their own frames). Never put a
claim in a caption that a source or image does not show.

```sh
W=<abs>; . "$W/env.sh"
# Seeds and recipe hashes of every generated output -> logs/generated.json (+ .tsv) for the caption.
node -e '
const fs = require("fs"), path = require("path"), rows = [], [out, ...files] = process.argv.slice(1);
for (const f of files) {
  if (!fs.existsSync(f)) continue;
  const d = JSON.parse(fs.readFileSync(f, "utf8")), v = d.data ?? d, p = v.placement ?? v, t = v.terrain;
  rows.push({ output: path.basename(f, ".json"), seed: p.seed ?? t?.geometry.seed, recipeHash: p.recipeHash ?? null,
    ...(t ? { terrain: { preset: t.preset, size: t.geometry.size, amplitude: t.geometry.amplitude } } : {}) });
}
fs.writeFileSync(out, JSON.stringify(rows, null, 2) + "\n");
for (const r of rows) console.log([r.output, r.seed, r.recipeHash ?? JSON.stringify(r.terrain)].join("\t"));
' "$W/logs/generated.json" "$W"/logs/{a1-quests,mf-gen-rock,mf-gen-bush,sf-terrain,sf-hero-place,sf-moss,sf-props,c-gen}.json | tee "$W/logs/generated.tsv"
cat > "$W/storyboard.json" <<'EOF'
{"format":"wildlands-storyboard","schemaVersion":1,
 "title":"Glowmoss Garden · prototype storyboard",
 "intent":"Pitch: Glim, a lantern-carrying companion, tends glowing moss in a dusky hollow; the player nudges, never steers. Core loop: choose a stock target, watch Glim gather and care, grow the garden. A one-pass prototype on the existing colony template: no new engine code, no balance or usability validation.",
 "layout":"sequence",
 "sections":[
  {"id":"pitch","title":"Pitch and beats","cards":[
    {"id":"beat-1","title":"Beat 1 · First glow","intent":"The hollow opens at dusk; Glim wakes next to the storehouse and the first moss beds glow."},
    {"id":"beat-2","title":"Beat 2 · Ask, don't steer","intent":"The player sets a moss stock target; Glim decides when and how to gather it."},
    {"id":"beat-3","title":"Beat 3 · Light the way","intent":"Gathered moss grows the garden and lights new paths (intended next step; not built in this prototype)."}]},
  {"id":"hero","title":"Hero · Character Studio","cards":[
    {"id":"hero-recipe","title":"Editable hero recipe","source":"glim.recipe.json","intent":"Keep the hero editable in Character Studio."},
    {"id":"hero-review","title":"Captured hero views","source":"hero-review/manifest.json","caption":"Actual compiled model: front, three-quarter, portrait and night walk."}]},
  {"id":"assets","title":"World assets · Model Forge and Scene Forge","cards":[
    {"id":"prop-review","title":"Glowing moss bed (reskinned herb bed)","source":"prop-review/review.json","caption":"Model Forge review of the edited herbs visual (Littlewild asset format) exported back into the scratch game folder."},
    {"id":"gen-bush","title":"Generated glow bush","source":"glowbush-review/review.json","caption":"model-forge generate bush, preset flowering, seed 6, size 0.6 m; recipe models/glowbush.generate.json."},
    {"id":"gen-rock","title":"Generated moss rock","source":"mossrock-review/review.json","caption":"model-forge generate rock, preset stone, seed 5, size 0.3 m."},
    {"id":"keyart","title":"Key art","source":"keyart-review/review.json","caption":"Scene Forge: hills terrain (seed 3), the hero by layout, moss beds and generated props scattered on the terrain."},
    {"id":"generated","title":"Generated content: seeds and recipe hashes","source":"logs/generated.json","caption":"Copied from logs/generated.tsv: <one line per output: log, seed, recipeHash>."}]},
  {"id":"game","title":"Game · Wildlands facts","cards":[
    {"id":"project","title":"Portable project","source":"project/p4.json","intent":"Emberworks colony rules and assets, retitled pack, Glowmoss Hollow world, two extra moss beds, Glim as companion c1."},
    {"id":"play","title":"Headless play: 300 s","source":"logs/wl-run.json","caption":"Recipe: start, select c1, herbs stock target 6, advance 300 s. Copied from logs/wl-run.json: 3000 steps, advancedSeconds 300, day 1 08:00 to 23:00, Glim idle ('Enjoying the glade'), coins 86 to 122, xp 0 to 30, herbs gathered 0, both new beds still 80/80. Not a balance test."},
    {"id":"build","title":"Playable HTML build","source":"logs/a6-build.json","caption":"From logs/a6-build.json: colony-play, 4,863,227 bytes against a raised 8 MiB budget; build-game --check current."}]},
  {"id":"captures","title":"Built game · headless captures","cards":[
    {"id":"cap-start","title":"Start dialog (desktop)","image":"captures/desktop-start.png","source":"captures/captures.json"},
    {"id":"cap-play","title":"First glow at 4× (desktop)","image":"captures/desktop-play.png"},
    {"id":"cap-phone","title":"First glow (phone)","image":"captures/phone-play.png"}]},
  {"id":"limits","title":"What this does not show","cards":[
    {"id":"limits-card","title":"Limits","intent":"Synthetic, automated prototype. No human playtest, usability, accessibility or balance validation; screenshots come from headless Chromium; scripted play covers 300 simulated seconds; generated quests and props passed the validators but were not playtested. Tutorial text still names the base game's companion and the world header still reads Mossmeadow (the edited world name is in the pack, not in that header)."}]}
 ]}
EOF
r sb-dry bin/wildlands storyboard build --input "$W/storyboard.json" --dry-run
V=1; while [ -e "$W/storyboard-v$V.html" ]; do V=$((V+1)); done   # outputs are new-only
r sb-build bin/wildlands storyboard build --input "$W/storyboard.json" --output "$W/storyboard-v$V.html"
ls -l "$W/storyboard-v$V.html"; sha256sum "$W/storyboard-v$V.html"
```

- Replace the example's copied numbers with your own run's values, including the `generated`
  caption, which must list every line of `logs/generated.tsv`.
- Recognized sources (Wildlands projects, Character Studio recipes/reviews, Forge reviews) show
  real facts; any other JSON shows only its field names. Put the numbers that matter in that
  card's `caption`, copied verbatim and naming the file ("Copied from logs/wl-run.json: ...").
  Expected receipt `warnings`: "No capture supplied" for intent/fact cards, and "Some review images
  have no declared SHA-256" for Forge reviews (observed hashes are still recorded).
- Every card needs `intent`, `source`, `image` or `caption`; ids match `^[a-z][a-z0-9_-]{0,63}$`
  and are unique; at most 12 sections, 48 cards, 96 images, 10 MiB per JSON source, 8 MiB per
  image, 24 MiB input. Check `bin/wildlands storyboard schema` when a build is refused (exit 2,
  `storyboard-operation-failed`, one diagnostic).
- `--output` must be a new `.html` (the block picks the next free `storyboard-vN.html`). Identical inputs give
  identical bytes; the stdout `receipt` hashes every input and labels the result presentation-only.
- Quick structural page without a plan: `bin/wildlands storyboard build --project
  "$W/project/p4.json" --output "$W/build/project-overview.html"`.

## 4. Present

Give the user: the storyboard path (`$W/storyboard-vN.html`) and the playable game
(`$W/build/<id>.html`), both open offline from `file://`; a five-line summary (pitch, template and
base, what each tool produced, play facts such as `advancedSeconds` and the companion's task);
and the evidence list with the seeds and recipe hashes (`logs/generated.tsv`). If asked to share
it, publish the storyboard HTML as an artifact.

Report the actual execution: tool versions (`logs/versions-wildlands.json`, `bin/model-forge
--version`, `bin/scene-forge --version`, `bin/character-studio version`), repository commit,
game digest and engine identity (`logs/a6-build.json`), SHA-256 of the storyboard and game HTML,
the command list (`logs/commands.tsv`), skipped steps and why (for example no browser), and the
raised HTML budget. A bounded scripted run and headless captures are not human playtesting,
usability, accessibility or balance validation; say so.

## 5. Guardrails

- Time-box: one pass per step; if a step fails twice, record it, drop it from the storyboard
  (or caption it as missing) and continue. Keep every recipe and run bounded.
- No code: games are data only. Never add scripts, markup or unreferenced files to a game folder,
  never edit `bin/`, `demos/` or `source/`, never patch built HTML or review manifests.
- Guards: always dry-run, then commit with fresh revision/state/fingerprint/digest values read from
  the previous step's log. On a conflict, re-inspect; never guess or remove locks you do not own.
- Reproducibility: record the seed and `recipeHash` of every generated model, placement, mission and
  quest set (terrain: preset, size and seed) in the storyboard facts (`logs/generated.tsv` and the
  `generated` card, source `logs/generated.json`). Never present generated content without them; replays are in
  references/procedural.md.
- Clean up: `capture-html.mjs` closes its browser; `character-studio serve` and
  `scene-forge preview --serve` are not needed here; if you start one, stop it before finishing.
- Keep the scratch tree: it is the evidence and the storyboard inputs.

## 6. Promote to a real game folder (only when the user asks)

Follow `AGENTS.md` and `docs/concepts/README.md`: copy the scratch folder to
`docs/concepts/<id>/`, restore `"$schema": "../../../source/wildlands/source/schemas/game.schema.json"`,
set a deliberate `targets.html.budgetBytes`, rewrite the copied base `README.md` (what it is,
provenance including the base folder it was copied from, synthetic values), then `bin/wildlands validate-game --game docs/concepts/<id>`. Demos are generated:
`cd source/wildlands && npm ci && npm run build:demos && npm run check:demos` (never hand-edit
`demos/`), and update `docs/concepts/README.md`, `docs/reference/current-state.md` and
`python3 scripts/check_docs.py`. For a process game also follow the `process-demo` skill.
