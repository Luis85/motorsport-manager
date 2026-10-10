# Character Studio CLI

See the [generated editor showcase and replay inputs](../_archive/verification/character-studio-showcase-2026-10-10/README.md)
for a captured walkthrough built with the engine's HTML storyboard command.

`bin/character-studio` is one generated Node.js 22+ executable containing a local
browser editor, JSON agent CLI, HTTP API, Littlewild content and Three.js preview.
Authoring commands and the editor need no installation, network connection or
`node_modules` beyond Node.js itself. PNG capture has optional dependencies
described below.
[Source](../../source/character-studio/README.md) and
[Scene Forge](scene-forge-cli.md) describe development and modeling handoffs.
The [complete agent workflow](../how-to/character-agent-workflow.md) covers guarded
maintenance across all three executables, including engine installation and
attaching Scene Forge visuals without losing gameplay data.

## Start editing

```sh
bin/character-studio serve --project ./characters
```

Open the returned loopback URL. The five chapters edit identity, body/face, coat,
skills/personality and outfits. The model, portrait and context preview use the
same compiled definition. Context preview is presentation, not a game simulation.
Save draft stores unfinished work; Review companion validates before creation or
applying edits to an existing identity. Saving never inserts a companion into a
live world. Browser recovery is local to that browser; disk save status appears
only after a successful API response. Export JSON keeps a portable copy.

The executable returns one JSON object per command. `serve` remains running until
SIGINT/SIGTERM; all other commands terminate. It never prompts.

## Agent workflow

Discover the current command and schema contracts before authoring:

```sh
bin/character-studio discover
bin/character-studio catalog
bin/character-studio describe --command apply
bin/character-studio schema --kind character
bin/character-studio schema --kind batch
bin/character-studio create --project ./characters --id moss --name Moss --preset fern
bin/character-studio inspect --project ./characters --id moss
```

Retain `revision` and `stateHash` from inspection. Write a batch:

```json
{"operations":[
  {"op":"set","path":"/identity/name","value":"Moss"},
  {"op":"set","path":"/appearance/coat","value":"#a4ba99"}
]}
```

Then run `apply --project ./characters --id moss --file edits.json
--expected-revision N --expected-state HASH --dry-run`. Inspect the proposed
result, then repeat without `--dry-run` using the same guards. A conflict requires
fresh inspection and a newly considered edit. Dry-runs retain current revision
and hash while returning `proposedRevision` and `proposedStateHash`.

Batches support strict JSON-pointer `set`, `add`, `remove`, `preset`, seeded
`randomize` (optional `scope: all|body|coat`), section `reset`
(`section: identity|body|coat|skills|outfits`), and appearance-only `look`. Each batch validates its final state and
commits once. The stable character ID and format/version fields cannot be patched. Editable
identity choices and other recipe fields are available through this interface; graphical controls do not have a
separate mutation authority. Locks constrain randomization and preset application;
direct edits and explicitly applied saved looks can replace locked choices.

`history`, `undo` and `redo` operate on persisted revisions; undo and redo require
both guards and can be dry-run. Browser undo covers the current working session.
History keeps at most 50 prior disk states. The `.character-studio/write.lock`
serializes disk writers. `doctor --project DIR` reports its owner PID, hostname,
creation time and active/stale/unknown state. Never remove a live or uncertain
lock. After a crashed writer, stop Studio processes using that project, confirm
`doctor` reports stale on the same host, then remove only the reported
`.character-studio/write.lock` directory and retry. No automatic lock stealing
is performed; PID reuse is treated conservatively as active.

## Files and integration

`export --project DIR --id ID --format FORMAT --out NEW_FILE` supports:

| Format | Intended consumer |
|---|---|
| `recipe` | Full editable `littlewild-character` recipe, including editor-only identity and locks |
| `look` | Body, coat and cosmetic outfit choices, preserving recipient identity and skills |
| `package` | Existing Wildlands `littlewild-creature-package` editor contract |
| `definition` | Littlewild game folder `littlewild-definition` creature wrapper |
| `visual` | `littlewild-3d-asset`, directly accepted by Scene Forge |

Without `--out`, JSON exports return their value inline. Output files are new-only;
existing destinations are never overwritten. `--file -` reads bounded JSON stdin.
`import --project DIR --file FILE [--id NEW_ID]` creates a new draft even when the source was ready; it never
replaces an existing ID. Studio recipes and unchanged Studio exports roundtrip.
Arbitrary foreign engine packages are rejected rather than silently discarding
advanced authored data. Scene Forge can import their visual facet directly.

```sh
bin/character-studio export --project ./characters --id moss --format package --out moss.package.json
bin/scene-forge --project ./models littlewild import --definition moss.package.json --dry-run
bin/scene-forge --project ./models littlewild import --definition moss.package.json
```

Use an initialized Scene Forge project. Its package importer transfers visuals,
not gameplay or identity. Keep the original recipe/package. For a Littlewild game
folder, review the exported definition before installing it as a new archetype,
update the creature catalog where appropriate, and validate the whole folder with
`bin/wildlands validate-game --game DIR`. This tool never rewrites game folders or
saves implicitly. Use `bin/wildlands creature discover` for the native creature lifecycle commands.
They import packages and attach refined visuals into new portable project
versions using mandatory fingerprint guards and explicit replacement; the source
project remains unchanged.

Pronouns, gender and voice are independent editor metadata; the current engine
does not interpret them. Outfits are baked cosmetics, not stat-granting equipment.
Skills use the game's actual skill IDs and invested points, with an editor budget
of ten; unused points are valid. These choices do not grant live progression.

`preview --project DIR --id ID --out NEW_HTML` exports the complete offline editor
with the character embedded. Its save destination is browser storage; it cannot
write back to disk without the local server.

## Visual verification for agents

Compiler revision 2 produces smooth portable meshes, expressive eyes and physical
coat surfaces. The same rigged geometry travels through the engine and Scene
Forge; render lighting is presentation. Original revision-1 Studio exports remain
importable. Unknown future compiler revisions and externally modified exports
are rejected with explicit guidance. Native Godot exports approximate sheen with
rim lighting and report that limitation; WebGL and GLB retain the physical fields.

`doctor --project DIR --capture` checks optional Playwright, Chromium and WebGL2
without installing anything. Inspect `capture.ready`; ordinary `doctor` only
checks project/lock diagnostics and does not launch a browser.

`review --project DIR --id ID --out NEW_DIRECTORY` captures front, side, back,
portrait, daylight world and night world views in one browser session. It writes
`frames/*.png`, `contact-sheet.png`, `manifest.json`, and `replay-plan.json`.
The manifest binds each image to its SHA-256, recipe hash, compiled visual hash,
compiler revision and explicit camera/light/pose at time zero. The manifest is
written last; a failed render removes only the new directory that command created.

Use `--plan previous-review/replay-plan.json` after edits to hold views fixed.
`schema --kind review` describes custom plans: 1–12 unique named views, at most
2048 pixels per dimension and 16,777,216 total pixels. Keep the tool build and
browser fixed when comparing renders; hashes identify the actual bytes, not a
promise of cross-platform pixel equivalence. Existing output directories are
never overwritten.

```sh
bin/character-studio doctor --project ./characters --capture
bin/character-studio review --project ./characters --id moss --out ./review-v1
bin/character-studio review --project ./characters --id moss --out ./review-v2 --plan ./review-v1/replay-plan.json
```

`capture --project DIR --id ID --out NEW.png` renders the actual compiled model.
Optional `--mode studio|world|portrait`, `--light studio|daylight|night`,
`--pose idle|walk|work|celebrate`, `--camera front|side|back`, `--width` and
`--height` make camera and lighting explicit. The result reports the recipe hash,
view configuration and fixed pose time. PNG destinations are new-only. `preview`
also accepts the four view flags when creating interactive HTML.

Capture alone needs optional Playwright and Chromium. For a source checkout,
run `npm ci` in `source/character-studio` and `npx playwright install chromium`.
A relocated executable can resolve Playwright through `NODE_PATH` or a local
`node_modules`; `CHARACTER_STUDIO_CHROMIUM_PATH` selects an installed Chromium.
The remaining commands and editor do not need these optional dependencies.

## HTTP and browser agents

`GET /api/discover` reports routes and CLI contracts. `GET /api/catalog` and
`GET /api/schema?kind=batch` expose supported data. Read `/api/characters` or
`/api/characters/ID`; inspect `/history` and `/export?kind=package` beneath a record.

A mutation needs `Content-Type: application/json`, the launch token in
`x-studio-token`, and `expectedRevision` plus `expectedState`. Create with revision
0 and state null. `PUT /api/characters/ID` takes `character`; `POST` to `/apply`
takes `operations`; `/undo` and `/redo` take guards. `dryRun:true` stages without
writing. `POST /api/validate` takes `character` and optional `commit:true`.
The server binds only to 127.0.0.1, rejects other Host/Origin values, and serves no
project files. Browser agents also have the documented `window.characterStudio`
interface exposed by both the served and offline page:

| Browser method | Behavior |
|---|---|
| `discover()` | Return browser methods, operation names, preview choices and persistence boundaries |
| `inspect()` | Return the current recipe, session undo/redo availability and persistence status |
| `catalog()` | Return a detached catalog of available choices |
| `apply(operations)` | Validate and apply an operation array to the working recipe and redraw the editor |
| `preview.setMode(value)` | Select `studio`, `world` or `portrait` |
| `preview.setLight(value)` | Select `studio`, `daylight` or `night` |
| `preview.setPose(value)` | Select `idle`, `walk`, `work` or `celebrate` |
| `preview.setCamera(value)` | Select `front`, `side` or `back` |
| `preview.zoom(delta)` | Adjust the presentation camera |
| `preview.reset()` | Reset the view |
| `preview.pause(boolean)` | Pause or resume presentation animation |
| `preview.inspect()` | Return current mode, lighting, pose, camera, time, pause state and live renderer budgets; `modelRevision` counts geometry rebuilds and `renderer.frame` counts rendered frames |
| `preview.configure(options)` | Validate and apply mode, light, pose, camera, paused and reset together with one render; invalid configuration changes nothing |
| `preview.capture()` | Return the current canvas as a PNG data URL when the renderer is available |

Browser `apply` changes the current working session; it is not a guarded disk
write. Use the editor's save action or the HTTP contract for persistence. Preview
methods do not edit the recipe or advance gameplay. Use `window.characterStudio.discover()` before browser automation. Full command
and JSON Schema discovery live in the CLI and `/api/discover`. Preview methods
reject unsupported choices; zoom requires a finite number and pause a boolean.

## Failure and compatibility contract

Exit 0 is success, 1 validation/I/O failure, 2 usage failure, and 3 a stale guard or
existing output. Failures have `ok:false` and an actionable structured `error`.
Malformed JSON, unknown fields, unsafe IDs, nonfinite numbers, unknown catalog
items and over-budget allocation fail before mutation. CLI JSON inputs are limited
to 8 MiB (persisted recipe files and HTTP request bodies remain bounded separately); batches to 256 operations. Unknown content can be exported as the
original import text from the UI's recovery path, but cannot be committed.

The engine's own creature and visual validators check compiled output. This does
not establish human usability validation or native Blender/Godot visual parity.
