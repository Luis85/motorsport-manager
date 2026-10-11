# Wildlands CLI handbook

`bin/wildlands` is the noninteractive command-line interface of the
[Wildlands](../../source/wildlands/README.md) engine kept in `source/wildlands/`.
It is the engine alone: it carries **no game content**. Games are data-only
folders, one per game, under [`docs/concepts/<id>/`](../concepts/README.md)
(`game.json` plus the content, asset and README files it names). The CLI

- validates, inspects and builds a game folder into one self-contained,
  ready-to-play HTML file (the five checked-in [`demos/`](../../demos/README.md),
  Littlewild, Emberworks, Office, RTS Frontier and Pocket Pet, are built this
  way), and
- creates, validates, inspects, plays, edits and compiles portable **Wildlands
  projects** (`wildlands-project` documents) into runnable Godot desktop
  projects. A project embeds the game it was made from, so after `create` no
  command needs the game folder again.

The file is one self-contained, checked-in CommonJS executable. It embeds the
compiled engine, the HTML templates and precompiled (minified) engine code of
every game profile, the trusted Godot runtime and the opt-in engine-source bundle
(inflated only when a command asks for it), so it needs no `npm ci`, build step,
`node_modules`, compiler or network access. It speaks a stable JSON-only protocol,
which makes it suitable for scripts and AI agents. Wildlands is separate from the
native Motorsport Manager game: it does not read or write Motorsport Manager
saves, configuration or the race/campaign domains.

## Requirements

| Need | Requirement |
|---|---|
| Run any command | Node.js 22 or newer on `PATH` |
| Play a built game | A current desktop browser (the HTML runs offline from `file://`) |
| Open a compiled project | Godot 4.4 or newer (desktop), plus Node.js 22+ at runtime |
| Rebuild `bin/wildlands` or `demos/` | Node.js 22+, npm and `npm ci` in `source/wildlands/` |

`compile`/`export` only write files; they do not need Godot. On Windows, or when
the executable bit is lost, invoke it as `node bin/wildlands …`.

## Quick start

Run these from the repository root. The examples in this handbook continue in
the same shell and write only below `$OUT`.

```sh
node --version
bin/wildlands --version
OUT="$(mktemp -d)"
bin/wildlands validate-game --game docs/concepts/littlewild
bin/wildlands build-game --game docs/concepts/littlewild --output "$OUT/littlewild.html"
bin/wildlands create --game docs/concepts/littlewild --output "$OUT/project.json"
bin/wildlands validate --project "$OUT/project.json"
bin/wildlands inspect --project "$OUT/project.json" > "$OUT/inspect.json"
bin/wildlands run --project "$OUT/project.json" --recipe source/wildlands/examples/wildlands-recipe.example.json --output "$OUT/played.json"
bin/wildlands edit --project "$OUT/played.json" --recipe source/wildlands/examples/wildlands-editor-recipe.example.json --output "$OUT/edited.json"
bin/wildlands export --project "$OUT/edited.json" --output "$OUT/godot"
```

Open `$OUT/littlewild.html`, or the checked-in
[`demos/littlewild.html`](../../demos/littlewild.html), in a browser to play;
every other game folder has its demo next to it (`demos/<id>.html`).
The last command writes a complete Godot project: open it with
`godot --path "$OUT/godot"`, or import `$OUT/godot/project.godot` in the Godot
editor.

## Protocol

Every invocation, including `--help`, prints exactly **one JSON object** to
stdout, pretty-printed with two-space indentation and a trailing newline. Nothing
is printed to stderr in normal operation. Commands never prompt and never read
stdin.

| Exit | `ok` | `code` | Meaning |
|---|---|---|---|
| `0` | `true` | — | Success. |
| `1` | `false` | `invalid-project` | `--project` was read but rejected by project validation (malformed JSON, invalid fields or pack, an embedded game the engine does not admit). Nothing was written. |
| `1` | `false` | `invalid-game` | `--game` names a folder that is not a valid game: inventory, manifest, projection or an engine validator rejected it. Nothing was written. |
| `1` | `false` | `over-budget` | `build-game`: the play artifact exceeds `targets.html.budgetBytes` of its `game.json`. Nothing was written. |
| `1` | `false` | `stale-artifact` | `build-game --check`: the file differs from a fresh build, or is missing. |
| `1` | `false` | none | `process validate`: the definition was read but rejected; the result carries `diagnostics` and no `code`. |
| `2` | `false` | `process-operation-failed` | Any `wildlands process` usage or operation failure (unknown command, bad option, bad number, refused output, I/O). Nothing was written. |
| `2` | `false` | `game-required` | The command needs `--game DIR` (`create`, `scenarios`, the game commands, schemaVersion 1 projects). The engine has no built-in game. |
| `2` | `false` | `game-embedded` | `--game` was given for a schemaVersion 2 project, which embeds its game. |
| `2` | `false` | `operation-failed` | Usage error, unknown/duplicate/missing option, I/O failure, invalid recipe or pack, rejected gameplay command, refused output path or compiler failure. Nothing was written. |

Every result carries `"protocolVersion": 1`. Failures always have this shape;
`game-required` failures also carry `"handbook": "docs/reference/wildlands-cli.md"`
and over-budget failures `bytes` and `budgetBytes`:

```json
{
  "ok": false,
  "protocolVersion": 1,
  "code": "operation-failed",
  "errors": ["Duplicate option: --output"]
}
```

Options take exactly one value each (`--flag value`); a value cannot start with
`--`. `--with-engine-sources` is the one value-less flag. Options may appear in
any order after the command. Unknown, duplicate and missing required options
fail with exit 2. Relative paths resolve against the current directory; `output`
fields in results are absolute paths.

**Writing.** JSON and HTML outputs are written to a uniquely named temporary file
and then renamed over the destination, so readers never see a partial document.
An existing output file is replaced, except that an output may never be one of the
command's inputs (same path, hard link or symlink alias): that fails with exit 2
and leaves the input untouched. Godot outputs are staged in a sibling directory
and published only when complete.

## Games and projects

**One game per invocation.** Before the engine loads, the CLI installs exactly one
game in its process: the folder named by `--game`, or the game a schemaVersion 2
project embeds. Commands that need neither (`--help`, `--version`, `discover`)
install nothing.

**Game folders** are data only: `loadGame` accepts only files `game.json` names,
asset `definition.json` files under its asset folder and README/PROVENANCE/LICENSE
documents, and rejects code, markup, links, executable modes and oversized trees
(see [runtime contracts](../../source/wildlands/RUNTIME-CONTRACTS.md#game-folders)).
The folder's **digest** is a SHA-256 over every file path and file SHA-256 except
`README.md` files, so any byte change of game input (including `PROVENANCE.md` and
`LICENSE*`, which are licence-relevant) changes it. A README is documentation: it
stays in the closed inventory and its size limits, but editing it changes neither
the digest nor any demo built from the folder. The `template` field selects the engine template:
`colony`, `rts` or `pet`. Portable projects and Godot compilation use colony
games; every template builds HTML.

**Projects** are schemaVersion 2 `wildlands-project` documents:

```json
{
  "format": "wildlands-project",
  "schemaVersion": 2,
  "id": "wildlands-prototype",
  "name": "Littlewild",
  "target": "godot",
  "scenarioId": "littlewild",
  "sceneId": "first-morning",
  "pack": {"…": "the complete scenario pack"},
  "game": {"id": "littlewild", "profile": {"…": "the game's content profile"}}
}
```

`game.profile` is the game's content profile as the engine installs it
(balancing, library schema, creatures, assets and the scenario catalog; never RTS
or Pocket Pet catalogs). It makes the document self-contained: `validate`,
`inspect`, `scenario`, `run`, `edit` and `compile` install it and need no folder.
A Littlewild project is about 1.6 MB.

**Legacy schemaVersion 1 projects** (no `game`) stay readable. Pass `--game DIR`
with the folder they were made with to `validate`, `inspect`, `scenario`, `run`,
`edit` or `compile`; every document the CLI writes from them is schemaVersion 2,
and `compile` compiles the upgrade. `upgrade` rewrites one explicitly. Without
`--game` they fail with `game-required`.

## Commands

Arguments in `[brackets]` are optional.

| Command | Purpose |
|---|---|
| `--help`, `-h` or no arguments | Usage summary and handbook path. |
| `--version` | CLI package name and version. |
| `discover [--game DIR]` | Machine-readable description of operations, gameplay commands and recipe formats; `--game` adds that game. |
| `scenarios --game DIR` | Scenario and scene IDs of a game folder. |
| `create --game DIR --output FILE [--scenario ID] [--scene ID] [--pack FILE] [--id ID] [--name TEXT]` | Create a schemaVersion 2 project. |
| `validate --project FILE [--game DIR]` | Validate a project and print its identity. |
| `inspect --project FILE [--game DIR]` | Read-only snapshot of the selected scene. |
| `scenario --project FILE --scenario ID [--scene ID] --output FILE [--game DIR]` | Switch scenario/scene into a new document. |
| `run --project FILE --recipe FILE --output FILE [--game DIR]` | Play a bounded game recipe and capture the result. |
| `edit --project FILE --recipe FILE --output FILE [--game DIR]` | Apply a bounded scene-editor recipe. |
| `upgrade --project FILE --game DIR --output FILE` | Rewrite a schemaVersion 1 project as schemaVersion 2. |
| `compile --project FILE --output DIR [--with-engine-sources] [--game DIR]` (alias `export`) | Write a runnable Godot desktop project. |
| `validate-game --game DIR` | Validate a game folder with the engine's validators. |
| `inspect-game --game DIR` | Manifest summary, inventory, digest and profile sizes of a game folder. |
| `build-game --game DIR (--output FILE.html \| --check FILE.html) [--profile play\|studio]` | Build a game's self-contained HTML, or check one for freshness. |

`--game DIR` on project commands is accepted only for schemaVersion 1 projects.

### `--help` and `--version`

```sh
bin/wildlands --help
bin/wildlands --version
```

`--help` returns `{ok, protocolVersion, usage, handbook}`, where `handbook` is
`docs/reference/wildlands-cli.md`. `--version` returns
`{ok, protocolVersion, name: "wildlands", version}`; `version` is the
`source/wildlands/package.json` version the binary was built from. Neither loads
the engine. Extra arguments after `--version` are an unknown operation (exit 2).

### `discover`

```sh
bin/wildlands discover > "$OUT/discover.json"
jq -r '.commands[] | "\(.id) \(.scope) maxArgs=\(.maxArgs)"' "$OUT/discover.json"
bin/wildlands discover --game docs/concepts/littlewild | jq '.game.scenarios[].id'
```

Result fields: `name` (`"wildlands"`), `projectFormat` (`"wildlands-project"`),
`projectSchemaVersion` (`2`), `legacySchemaVersions` (`[1]`), `target`
(`"godot"`), `maxBytes` (project size limit), `game` (`null`, or with `--game`
`{id, defaultScenario, scenarios}` as in `scenarios`), `operations` (each CLI
operation with `description`, `arguments` and an `example` argv), `commands`
(every gameplay command usable in a `command` recipe operation: `id`, `scope`
`actor`|`world`, `maxArgs`, `away`) and `recipes` (limits, the game and editor
recipe operation tables and an example of each). `recipes.toolbox` names the
typed SDK and JSON-lines runtime of a source build (paths under
`source/wildlands/.generated/`); those are not part of `bin/wildlands`.

Discovery is the source of truth for supported commands and operations. Prefer
it over this page when they differ.

### `scenarios`

```sh
bin/wildlands scenarios --game docs/concepts/littlewild
```

Returns `{ok, protocolVersion, game, digest, defaultScenario, scenarios: [{id, name,
scenes: [{id, name, worldId}]}]}` for the folder's scenario catalog (`content.packs`
of its `game.json`, in order). The Littlewild folder has one scenario,
`littlewild`, with the scenes `first-morning` (default) and `charted-home`. There
are no built-in scenarios: without `--game` the command fails with
`game-required`.

### `create`

```sh
bin/wildlands create --game docs/concepts/littlewild --scene charted-home --id my-proto --name "My prototype" --output "$OUT/showcase.json"
```

| Option | Default | Rule |
|---|---|---|
| `--game DIR` | required | A colony game folder. Its content profile is embedded in the project. |
| `--output FILE` | required | Project JSON to write. |
| `--scenario ID` | the game's `defaultId` | A scenario of the game. With `--pack`, it must equal the pack's `id`. |
| `--scene ID` | first scene of the pack | Must exist in the pack. |
| `--pack FILE` | the game's pack | Custom `living-worlds-pack` JSON, at most 8 MiB, validated against the game before use. |
| `--id ID` | `wildlands-prototype` | ASCII identifier, 1–64 characters, `[a-zA-Z0-9][a-zA-Z0-9_.-]*`. |
| `--name TEXT` | the pack name | 1–128 characters. |

Result: `{ok, protocolVersion, output, projectId, schemaVersion, gameId,
gameDigest, scenarioId, sceneId}`. Without `--game` it fails with exit 2, code
`game-required`, naming `--game` and this handbook.

A custom pack is easiest to start from an existing project's `pack`. The pack's
`id` becomes the project's `scenarioId`:

```sh
jq '.pack | .id = "my-prototype"' "$OUT/project.json" > "$OUT/my.pack.json"
bin/wildlands create --game docs/concepts/littlewild --pack "$OUT/my.pack.json" --output "$OUT/custom.json"
```

### `validate`

```sh
bin/wildlands validate --project "$OUT/custom.json"
```

Result: `{ok, protocolVersion, fingerprint, projectId, schemaVersion, gameId,
scenarioId, sceneId}`. `fingerprint` is 16 hexadecimal digits identifying the
complete normalized document: it hashes the key-sorted canonical JSON of every
field, including `id`, `name`, `scenarioId`, `sceneId`, the whole `pack` and the
embedded `game`. JSON key order and whitespace do not change it; any value change
does, including the captured result of a `run` or `edit` recipe or a change of
the embedded game (the same pack from another game folder has another
fingerprint). `validate` and `inspect` report the same value for the same project.
A legacy schemaVersion 1 document has its own fingerprint; its upgrade has the
fingerprint of the equivalent new project. A `run` output is the complete captured
project, so even a recipe that advances no time can differ from a project made by
`create` (the capture writes the pack's explicit `resources`); measure simulation
progress with `advancedSeconds`, not the fingerprint. It is a non-cryptographic
change identifier, not a signature or proof of authorship, and it is never stored
in the project. Use a file digest such as `sha256sum` when you need exact bytes.

### `inspect`

```sh
bin/wildlands inspect --project "$OUT/project.json" | jq '.snapshot.actors[] | {id, name, task: .task.label}'
```

Opens a temporary session for the selected scene, reads it and disposes it. It
never advances simulation time, so repeated calls return identical output.
Result: `{ok, protocolVersion, projectId, schemaVersion, gameId, scenarioId,
sceneId, fingerprint, snapshot, connections}`. `snapshot` holds `simTime`, `day`,
`hour`, `started`, `paused`, `actors` (stable `id`, `name`, `archetype`,
`personality`, `position`, `needs`, `task`, `inventory`), `buildings`, `nodes`,
`player`, `scenarioId` and `sceneId`. `connections` lists the scene connections
usable by `enterScene`.

### `scenario`

```sh
bin/wildlands scenario --project "$OUT/project.json" --scenario littlewild --scene charted-home --output "$OUT/charted.json"
```

Writes a new project that keeps the input's `id`, `name` and embedded game.
Switching to another scenario replaces the pack with that pack of the embedded
game's catalog; selecting the project's own scenario keeps its current pack and
changes only the scene. Result: `{ok, protocolVersion, output, schemaVersion,
scenarioId, sceneId}`.

### `run`

```sh
bin/wildlands run --project "$OUT/project.json" --recipe source/wildlands/examples/wildlands-recipe.example.json --output "$OUT/played.json" | jq '{requestedSteps, advancedSeconds, simTime: .snapshot.simTime}'
```

Applies a [game recipe](#game-recipes) in one owned session, then captures the
resulting state into a new project. The input project is never changed. Result:
`{ok, protocolVersion, output, schemaVersion, scenarioId, sceneId, snapshot,
results, requestedSteps, advancedSeconds}`. `results` has one entry per
operation, in order. `requestedSteps` counts requested 0.1-second steps;
`advancedSeconds` is the simulation time actually advanced. Compare both, because
a paused session can accept steps without advancing time. Any failing operation,
including a rejected gameplay command, fails the whole run with exit 2 and writes
nothing.

### `edit`

```sh
bin/wildlands edit --project "$OUT/project.json" --recipe source/wildlands/examples/wildlands-editor-recipe.example.json --output "$OUT/renamed.json"
```

Applies an [editor recipe](#editor-recipes) through the scene editor and the
whole-pack validators, then writes the exported project. Result:
`{ok, protocolVersion, output, schemaVersion, scenarioId, sceneId, revision}`,
where `revision` is the editor revision after the last operation.

### `upgrade`

```sh
jq 'del(.game) | .schemaVersion = 1' "$OUT/project.json" > "$OUT/legacy.json"
bin/wildlands validate --project "$OUT/legacy.json" --game docs/concepts/littlewild
bin/wildlands upgrade --project "$OUT/legacy.json" --game docs/concepts/littlewild --output "$OUT/upgraded.json"
```

Validates a schemaVersion 1 project against the game folder and writes it as a
schemaVersion 2 project with that game embedded (identical to the project
`create` would make from the same pack and scene). Result: `{ok, protocolVersion,
output, projectId, schemaVersion, gameId, fingerprint, scenarioId, sceneId}`. A
schemaVersion 2 input fails with `game-embedded`.

### `compile` and `export`

```sh
bin/wildlands compile --project "$OUT/showcase.json" --output "$OUT/godot-showcase"
jq '{files: (.files | length), runtime, prerequisites}' "$OUT/godot-showcase/wildlands.manifest.json"
```

`export` is an alias for `compile`. `--output` must be a directory that does not
exist yet, with an existing real parent and no symlinked ancestors; choose a fresh
path for every compile. Result: `{ok, protocolVersion, output, files, engineSources, manifest}`.

The directory contains `project.godot` and `main.tscn`, `native/*.gd` (native
presentation and the subprocess bridge), `runtime/` (the compiled TypeScript
engine that stays the gameplay authority: exactly the static require closure of
the bridge runtime, without browser presentation modules, test fixtures or any
game content), `wildlands.project.json` (the validated schemaVersion 2 project,
whose embedded game the runtime installs on start) and `wildlands.manifest.json`
(target, prerequisites, capabilities, limitations and the byte size and SHA-256
of every generated file). A Littlewild project compiles to about 140 files and
3.7 MB. A schemaVersion 1 project compiles with `--game DIR` as its upgrade.

The inert engine-source bundle (code-generator input: authoritative engine
sources, vendors and a trimmed TypeScript toolchain; see
[ENGINE-EXPORT.md](../../source/wildlands/ENGINE-EXPORT.md#payload-policy)) is
opt-in. `--with-engine-sources` is a value-less flag that adds
`runtime/engine-source-bundle.json` (about 26 MB), which enables the
`engineExport` tools inside the compiled runtime; the result then reports
`engineSources: true` and the manifest lists the capability. The bundle is the
engine only: the build's game folders (`games/<id>`) and any game data still
pending its move to a folder are removed and recorded in its excluded inventory.
Without the flag the manifest records the omission as a limitation and the
project still runs completely. Output is deterministic: compiling the same
project twice gives byte-identical directories. Projects whose scenes use custom
renderer or animation extensions without a native adapter are rejected. The
output needs desktop Godot 4.4+ and Node.js 22+ on `PATH` (or `WILDLANDS_NODE`);
it is not a web or mobile export. See
[WILDLANDS.md](../../source/wildlands/WILDLANDS.md#runnable-godot-compiler) for
coverage and limits.

### `validate-game`

```sh
bin/wildlands validate-game --game docs/concepts/littlewild
```

Loads the folder (closed inventory, manifest grammar and rules), projects it into
its content profile, installs that profile and runs the engine's runtime
validators for its template: for colony games the balancing defaults, every
scenario pack, the skill tree, the interaction library, the creature, asset and
interior owners and the balancing consumption audit (every declared gameplay
tuner has an engine consumer and every consumer is declared); for RTS and Pocket
Pet games their catalog. Adventure examples are parsed reference documents, not
admitted. Result: `{ok, protocolVersion, id, template, digest, errors}`; a
rejected folder exits 1 with `code: "invalid-game"` and the first rejection in
`errors` (`id`, `template` and `digest` are `null` when the folder did not load).

### `inspect-game`

```sh
bin/wildlands inspect-game --game docs/concepts/littlewild | jq '{id, template, digest, files: .inventory.files, sections: .profile.sections, play: .builds.play.profile}'
```

A cheap summary that runs no validators. Result: `{ok, protocolVersion, id, name,
version, template, features, presentation, storage, targets, digest, inventory:
{files, bytes, entries: [{path, bytes, sha256}]}, profile: {id, sections:
{<section>: bytes}}, builds}`. `builds` has one entry per build profile the
template offers (`play`, and `studio` for colony and RTS games) with the engine
`profile` id, `template`, `minified`, its `bundles` in load order and the size of
each data global it declares (`data: [{name, bytes}]`).

### `build-game`

```sh
bin/wildlands build-game --game docs/concepts/littlewild --output "$OUT/littlewild.html"
bin/wildlands build-game --game docs/concepts/littlewild --check "$OUT/littlewild.html"
bin/wildlands build-game --game docs/concepts/littlewild --check demos/littlewild.html
bin/wildlands build-game --game docs/concepts/littlewild --output "$OUT/studio.html" --profile studio
bin/wildlands build-game --game docs/concepts/rts-frontier --output "$OUT/rts-frontier.html" | jq '{id, profile, bytes, budgetBytes}'
for folder in docs/concepts/*/; do [ -f "$folder/game.json" ] || continue; bin/wildlands build-game --game "$folder" --check "demos/$(basename "$folder").html" | jq -r '.id + " current=" + (.current | tostring)'; done
```

The loop checks every published demo against a fresh build of its folder.

Validates the folder exactly as `validate-game` does, then assembles one
self-contained HTML document that runs offline from `file://` with no network
request. Exactly one of `--output` and `--check` is required; the path must end
in `.html` and lie outside the game folder.

| Profile | Engine profile | Contents |
|---|---|---|
| `play` (default) | `colony-play`, `rts-play` or `pet-play` | The template's play bundles, minified, plus the optional engine features the game declares in `features` (`renderers-2d` adds the 2D renderers; colony play always includes the storytelling player). No editors, developer tools or export payloads. |
| `studio` | `colony-studio` or `rts-studio` | Built on demand only, never published: colony games get the editors, developer toolbox and Godot/engine export tools with their payloads (the engine-only source loader carries the p5 LGPL source offer); RTS games get the mission editor. Unminified. Pocket Pet games have no studio profile (exit 2). |

Every build declares the game's data globals, including `LWGameProfile` with the
`storage.namespace` of its `game.json` (so saves are scoped per game; the
`littlewild` namespace keeps the legacy save keys), and uses the game's
`presentation.title` and `description`. Its head carries two identity elements:

```html
<meta name="wildlands-engine" content="<engine identity>"><meta name="wildlands-game-digest" content="<folder digest>">
```

The engine identity is the SHA-256 of the engine kit (templates, the exact
inline code of every profile, the engine's tuner consumers and the digests of the
studio payloads, including the identity of the engine sources); every game built by
the same engine carries the same value, and any engine source change changes it.

Result: `{ok, protocolVersion, output|check, id, profile, kind, bytes, sha256,
budgetBytes, digest, engine}`. A `play` artifact larger than
`targets.html.budgetBytes` fails with exit 1, code `over-budget`, and writes
nothing; studio builds have `budgetBytes: null`. With `--check`, the file is
compared byte for byte with a fresh build: equal returns `{…, current: true}`;
different or missing exits 1 with `code: "stale-artifact"`, `current: false` and
`actual: {bytes, sha256}` (or `null`).

Output is byte-deterministic: the same engine and folder always give the same
bytes, wherever and by whichever distribution they are built. `bin/wildlands`
and a source checkout's `npm run build:demos` produce identical files.

## Recipes

Recipes are data-only JSON documents with exactly the fields `format`,
`schemaVersion` and `operations`. Each operation object must have exactly the
listed fields. They cannot contain executable code or call arbitrary methods.

### Game recipes

`format` is `wildlands-recipe`, `schemaVersion` is `1`. The working example
[`wildlands-recipe.example.json`](../../source/wildlands/examples/wildlands-recipe.example.json)
starts the default Littlewild scene, selects the companion `c1`, sets a wood
stock target and advances 30.5 seconds:

```json
{
  "format": "wildlands-recipe",
  "schemaVersion": 1,
  "operations": [
    {"operation": "start"},
    {"operation": "command", "command": {"id": "select-creature", "args": ["c1"]}},
    {"operation": "command", "command": {"id": "set-stock-target", "actorId": "c1", "args": ["wood", 10]}},
    {"operation": "advance", "seconds": 30},
    {"operation": "step", "count": 5},
    {"operation": "connections"}
  ]
}
```

| Operation | Fields | Result entry |
|---|---|---|
| `start`, `pause`, `resume` | — | `{ok: true, operation}` |
| `inspect` | — | A snapshot, as in `inspect` |
| `connections` | — | The scene connections |
| `step` | `count`: whole number of 0.1 s steps | `{steps, advancedSeconds, simTime}` |
| `advance` | `seconds`: multiple of 0.1 | `{steps, advancedSeconds, simTime}` |
| `command` | `command`: `{id, args}`, plus `actorId` for actor-scoped commands | `{ok, data, …}` |
| `enterScene` | `connectionId`: an ID from `connections` | The reviewed scene entry |

Clock values must be finite, non-negative whole 0.1-second steps. Take command IDs
and argument counts from `discover` (`commands[].id`, `scope`, `maxArgs`), and
actor, building and node IDs from `inspect`. World-scoped commands must not carry
`actorId`; actor-scoped commands require it.

### Editor recipes

`format` is `wildlands-editor-recipe`, `schemaVersion` is `1`, and every
operation is `{"operation": NAME, "args": [...]}`. The working example
[`wildlands-editor-recipe.example.json`](../../source/wildlands/examples/wildlands-editor-recipe.example.json)
renames the `first-morning` scene:

```json
{
  "format": "wildlands-editor-recipe",
  "schemaVersion": 1,
  "operations": [
    {"operation": "updateScene", "args": ["first-morning", {"name": "Terminal meadow"}]}
  ]
}
```

| Operation | Arguments (`?` = optional) |
|---|---|
| `replace` | `pack` |
| `updateScene` | `sceneId`, `patch` |
| `updateWorld` | `worldId`, `patch` |
| `addWorld` | `worldTemplate`, `worldId`, `name` |
| `addScene` | `sceneTemplate`, `sceneId`, `worldId`, `parentId?` |
| `removeScene` | `sceneId` |
| `removeWorld` | `worldId` |
| `place` | `sceneId`, `category`, `entityId`, `x`, `y` |
| `setEntity` | `sceneId`, `category`, `entityId`, `patch` |
| `addProp` | `sceneId`, `prop` |
| `addEntity` | `sceneId`, `category`, `templateId`, `entityId`, `x?`, `y?` |
| `removeEntity` | `sceneId`, `category`, `entityId` |
| `undo`, `redo` | — |

Argument counts are checked before the editor opens. Data passes the existing
scene-editor and whole-pack validators; an invalid edit fails the command and
publishes nothing. [World & Scene Editor](../../source/wildlands/WORLD-SCENE-EDITOR.md)
describes the editable data.

## Limits

| Input | Limit |
|---|---|
| `--project` file and project document | 10 MiB (10,485,760 bytes; also `discover.maxBytes`) and 1,000,000 JSON values, embedded game included |
| `--pack` file | 8 MiB (8,388,608 bytes); the pack keeps its own admission limits |
| `--recipe` file and recipe document | 1 MiB (1,048,576 bytes) |
| Recipe operations | 256 per recipe |
| Recipe clock | 36,000 steps of 0.1 s per recipe (one simulated hour) |
| Project `id` / `name` | 1–64 ASCII identifier characters / 1–128 characters |
| Game folder | 2,048 files, 8 MiB per file, 32 MiB in total, 8 directory levels |
| `game.json` `targets.html.budgetBytes` | 1 byte to 64 MiB; enforced on `play` builds |
| `build-game --check` file | 64 MiB |

Input files must be regular files containing UTF-8 JSON. Duplicate JSON keys and
prototype-shaped values are rejected.

## Common errors

| Exit | Message (in `errors[0]`) | Fix |
|---|---|---|
| 2 | `Unknown operation. wildlands --help \| …` | Use a command from `--help` or `discover`. |
| 2 | `Unknown option: …`, `Duplicate option: …`, `Missing value for …`, `Missing required option: …` | Correct the argv. |
| 2 | `create needs --game DIR: the Wildlands engine CLI has no built-in games. …` (`game-required`) | Pass a game folder such as `docs/concepts/littlewild`. |
| 2 | `This schemaVersion 1 project does not embed its game. …` (`game-required`) | Add `--game DIR`, or `upgrade` the project once. |
| 2 | `This schemaVersion 2 project embeds its game (…); omit --game.` (`game-embedded`) | Drop `--game`. |
| 2 | `ENOENT: no such file or directory, open '…'` | Check the input path. |
| 1 | `Could not read JSON: …` | The project file is not valid JSON. |
| 1 | `Project scenarioId must match pack.id.` and other validation messages | Recreate the project or fix the reported field. |
| 1 | `Game folder file is not referenced by game.json: …` and other `invalid-game` messages | Fix the game folder; run `validate-game`. |
| 1 | `… play artifact is N bytes, over its budget of M bytes …` (`over-budget`) | Shrink the game's data or raise `targets.html.budgetBytes`. |
| 1 | `… is stale; rebuild it with wildlands build-game …` (`stale-artifact`) | Rebuild the artifact. |
| 2 | `Unknown scenario: … Use wildlands scenarios --game DIR.`, `Scene does not exist in this scenario: …` | Use IDs from `scenarios`. |
| 2 | `Clock values require whole 0.1-second steps, at most 36000.` | Use multiples of 0.1 s within the limits. |
| 2 | `Command rejected: …` | The game refused the command; inspect state and IDs. |
| 2 | `Output must not overwrite an input file.` | Write to a new path. |
| 2 | `Build output must be outside the game folder, which holds data only.` | Write the HTML elsewhere (for example `demos/`). |
| 2 | `Godot output must be a new directory with a real parent and no symlink ancestors.` | Choose a fresh output directory. |

This example shows a rejected argv and keeps the shell going:

```sh
bin/wildlands create --output "$OUT/a.json"; echo "exit=$?"
```

## For AI agents

1. Invoke `bin/wildlands` (or `node bin/wildlands`) directly, not through
   `npm run`, so no npm banner reaches stdout.
2. Parse stdout as one JSON document. Check the exit code and `ok` before using
   any other field. On failure, read `code` and `errors`; do not scrape text.
3. Start with `discover --game DIR`. Use only the operations, gameplay commands
   and recipe operations it lists. Never infer commands from source code.
4. Games are folders. Run `validate-game` after changing a folder and before
   building or creating projects; never add code or unreferenced files to it.
5. Get stable actor, building, node, scene and connection IDs from `scenarios`,
   `inspect` and `connections`, not from display names.
6. Treat documents as immutable inputs: always write `run`, `edit`, `scenario`,
   `upgrade` and `compile` results to new paths, then `validate` or `inspect` the
   result. Projects embed their game; do not edit `game` by hand.
7. Change projects through `create`, `scenario`, `run` and `edit` recipes. Do not
   hand-edit `pack` internals unless you then pass `validate`. Never add a
   `fingerprint` to documents. Compare `validate` fingerprints to detect content
   changes, never to establish trust (see [`validate`](#validate)).
8. Do not hand-edit compiled Godot output or built HTML.
   `wildlands.manifest.json` records the SHA-256 of every file; `build-game
   --check` verifies an HTML artifact; rebuild instead.
9. Time advances only through explicit `step`/`advance` operations in `run`.
   `inspect`, `validate` and `discover` never tick. Verify progress with
   `advancedSeconds` and the returned `snapshot`, not with `requestedSteps`.
10. Keep recipes within the limits above, and split longer experiments into
    several `run` invocations that chain output projects.
11. Report the exact `--version`, the game digest and engine identity, the
    commands and the SHA-256 of resulting files. A successful build, run or
    compile is not native Godot, balance or human validation.

A typical machine-checked step:

```sh
result="$(bin/wildlands validate --project "$OUT/played.json")"; status=$?
test "$status" -eq 0 && test "$(printf '%s' "$result" | jq -r .ok)" = true && printf '%s' "$result" | jq -r '.scenarioId + "/" + .sceneId'
sha256sum "$OUT/played.json"
```

## Rebuild and check the binary and demos

`bin/wildlands` is generated by
[`source/wildlands/source/tools/cli-bundle.cts`](../../source/wildlands/source/tools/cli-bundle.cts)
with a pinned esbuild, and `demos/` by
[`source/wildlands/source/tools/demos.cts`](../../source/wildlands/source/tools/demos.cts).
Never edit either by hand.

```sh
cd source/wildlands
npm ci
npm run build:cli
npm run check:cli
npm run build:demos
npm run check:demos
```

- `npm run build:cli` runs the full `npm run build`, bundles
  `.generated/tools/wildlands-cli.cjs` and writes `bin/wildlands` with mode 755.
  The bundle replaces the transitional game installers with the engine-only
  installer and embeds only engine-owned JSON; it fails if a scenario pack's text
  of any game appears in the bundle or its payloads, or if a build-only dependency
  (esbuild, TypeScript) would be bundled. It then smoke-runs the candidate from an
  empty temporary directory with file reads and writes confined to that directory
  through Node's permission model: `--version`, `--help`, `discover`, `create`
  without `--game` (expecting `game-required`), `validate-game` and `inspect-game`
  on copies of the game folders, `build-game` of Littlewild, RTS Frontier and
  Pocket Pet (one game per template, each compared byte for byte with the
  checkout's compiled CLI, then `--check`),
  `create --game`, `validate`, `compile` with and without
  `--with-engine-sources`, and the compiled Godot runtime, which must start the
  game its project embeds.
- `npm run check:cli` performs the same build and smoke test in memory and fails
  (exit 1) when the checked-in file differs or is not executable. CI uses it as
  the freshness gate.
- `npm run build:demos` builds the same candidate (with its smoke test), runs its
  `build-game` once per `docs/concepts/*/game.json` into `demos/<id>.html`
  (`targets.html.output`), and writes `demos/manifest.json` (per demo: game
  digest, engine identity, output bytes and SHA-256, budget) and
  `demos/README.md`, generated from the manifests. It removes orphaned demos.
  A demo over its budget fails the build.
- `npm run check:demos` does the same in a temporary directory and fails on any
  byte difference, missing or orphaned file in `demos/`.
- `npm run build` alone touches neither `bin/` nor `demos/`. Verification and the
  engine export rebuild copies of `source/wildlands` in isolation, and those
  builds must not write outside their own project directory.

The bundle is byte-deterministic for the same sources and lockfile: it has no
timestamps, absolute paths or source maps, and its embedded payloads are
compressed with the pinned pure-JavaScript `pako`, so neither the checkout path
nor the Node.js release changes the bytes. It embeds three payloads: the Godot
runtime closure (about 0.4 MB compressed), the engine-only source bundle (about
5.7 MB compressed) used by engine export, studio builds and
`compile --with-engine-sources`, and the engine kit (about 1.7 MB compressed:
templates plus the minified play code and verbatim studio code of every game
profile; verbatim vendor scripts are taken from the engine sources rather than
stored twice). Consequently any change to an authored file under
`source/wildlands/source/`, `vendor/`, `package.json`, `package-lock.json` or the
`tsconfig` files changes `bin/wildlands` and, because the engine identity covers
the engine sources, the `wildlands-engine` element of every demo; a change to a
game folder changes its demo. Rebuild and commit both in the same change. The file is about 12 MB. `npm run report:artifacts` breaks down the
payloads.

## Related documentation

- [Game folders](../concepts/README.md): the games this CLI builds, one folder each.
- [Playable demos](../../demos/README.md): the checked-in builds of every game folder.
- [Wildlands project and Godot target](../../source/wildlands/WILDLANDS.md): project format, browser workspace, persistent JSON-lines runtime and native coverage.
- [Runtime contracts](../../source/wildlands/RUNTIME-CONTRACTS.md): content provider, game folders and optional runtime capabilities.
- [Developer toolbox](../../source/wildlands/DEVELOPER-TOOLBOX.md): typed SDK sessions, commands and agent guidance for source builds.
- [Wildlands documentation index](../../source/wildlands/DOCUMENTATION.md): every Wildlands guide and contract.
- [Engine JSON export](../../source/wildlands/ENGINE-EXPORT.md): the separate inert source/data export format.


## Business processes

`bin/wildlands process` (also `process --help`, `-h`) describes the definition-first process tool family. It is a separate protocol from the game commands above: `process` failures use `code: "process-operation-failed"` with exit 2, and `process validate` exits 1 with no code when the definition is rejected. Options take one value (`--flag value`); `--draft`, `--dry-run`, `--bpsim`, `--no-auto-system-pool`, `--no-bpsim` and `--brief` take none. Unknown, duplicate and missing options, non-whole `--expected-revision`, an unknown `--kind` or `--format`, `--seed` on `slides` without `--minutes`, `--format` on `run` without `--event-log`, `--seed` together with `--checkpoint`, `--dry-run` together with `--output`, and a missing `--output` on `edit`/`attach` without `--dry-run` all fail with exit 2 before any file is read or written. Numeric bounds are checked just as early and the message names the flag: `--minutes must be a whole number from 1 to 100000.`, `--runs must be a whole number from 1 to 200.`, `--warmup must be a whole number of minutes from 0 to 99 (below --minutes).`, and a replication plan over 1,000,000 simulated minutes ("A replication plan may simulate at most 1000000 minutes in total; this one needs 20000000."). Outputs never overwrite an input (including hard-link and symlink aliases). Required options are marked **yes**.

| Command | Option | Required | Meaning |
|---|---|---|---|
| `discover` | none | | Commands (17), limits, edit operations (16), workflow and notes (including what `setWorkingHours` does). |
| `schema` | `--kind` | no | `definition` (default) or `recipe`. |
| `create` | `--id` | yes | Process ID. |
| | `--name` | no | Display name (default: the ID). |
| | `--output` | yes | New definition JSON. |
| `validate` | `--input` | yes | Definition JSON. Prints `runnable`, `diagnostics` and `advisories`: non-blocking modelling notes `{path, message}`, today whole-minute rounding bias of a `timing`, deadline `timing` or arrival `gap` whose average draw is more than 5% from its authored mean ([advisories](business-process-engine.md#modelling-advisories)); `[]` when there are none. |
| | `--draft` | no | Accept graph diagnostics (reported, `runnable: false`). |
| `inspect` | `--input` | yes | Definition JSON; never advances time. Also prints `advisories`, and for a definition with working hours `workingHours` with `hours` ("09:00–17:00, Monday to Friday"), `start` ("Day 1 · Mon 09:00") and `clock` (elapsed minutes; work and arrivals pause outside working hours). |
| `edit` | `--input`, `--recipe` | yes | Definition and guarded recipe. Operations: `putStep`, `putFlow`, `putResource`, `removeStep`, `removeFlow`, `removeResource`, `setArrivals`, `setStart`, `rename`, and the process settings `setDescription`, `setSeed`, `setSipoc`, `setTrack`, `setCalendar` (the display calendar `{minutesPerDay, daysPerWeek}`; `null` removes the field), `setWorkingHours` (the run calendar `{opensAt, closesAt, daysPerWeek}`, minutes after midnight and working days from Monday; `null` removes it; it changes the run, and a display calendar beside it is refused, see [working hours](business-process-engine.md#working-hours)) and `setGenre` (`process`, `customer-journey` or `user-journey`; `process` removes it and `null` is rejected). |
| | `--output` | yes unless `--dry-run` | Edited definition. |
| | `--dry-run` | no | Write nothing; conflicts with `--output`. |
| | `--draft` | no | Allow intermediate graph diagnostics. |
| `run` | `--input`, `--minutes`, `--output` | yes | Whole business minutes to advance (1-100000); report JSON. Prints `output`, `requestedMinutes`, `seed`, `advancedMinutes`, `status` and `metrics`, including the read-model analytics ([read model](business-process-engine.md#read-model-analytics)). |
| | `--seed` | no | Non-negative whole number up to 2147483647 that replaces the definition's `seed` for this run (default: the definition's seed, else 1); validated before any work and reported as `seed`. Same definition, seed and minutes give the same report. Refused together with `--checkpoint`, whose run keeps its own seed. |
| | `--checkpoint FILE` | no | Continues the run saved in FILE (a `wildlands-process-checkpoint` version 1 file, at most 16 MiB, read strictly; [run checkpoints](business-process-engine.md#run-checkpoints)) instead of starting at minute 0. Its fingerprint must equal the `--input` definition's (a mismatch names both); its seed and run length are kept, and `--minutes` more minutes run from its minute and must fit in that run length ("--minutes 100000 goes past the checkpoint's run length: the run is at minute 100 of 100000, so at most 99900 more minutes can run."). Prints `checkpoint` (`input`, `minute`); `advancedMinutes` counts from the checkpoint minute, and an event log holds only the events after it. A file that cannot be read, is malformed or belongs to another process or definition is refused as `--checkpoint FILE: <reason>`, exit 2, and nothing is written. |
| | `--checkpoint-out FILE` | no | Writes a checkpoint of the run where it ended (compact JSON; the run length is the CLI's engine limit, 100,000 minutes, or the continued checkpoint's) and prints `checkpointOut` (`output`, `minute`). FILE must not be the input, the report, the event log or the `--checkpoint` file. A later `--checkpoint` continues it exactly as one longer run. |
| | `--event-log FILE` | no | Streams every engine event of the run, in engine order, to FILE while it runs (buffered to an exclusively created temporary file next to the target, published by rename when the run ends, removed on failure); prints `eventLog` (`file`, `format`, `events`). The file must not be, or alias, the input or the report. Timestamps count business minutes from the synthetic epoch `1970-01-01T00:00Z` (minute 5 is `1970-01-01T00:05:00Z`); they are not calendar dates. |
| | `--format csv\|xes` | no | Needs `--event-log`. `csv` (default): header `case_id,step_id,step_name,event,minute,timestamp,detail`, one row per event, RFC 4180 quoting and a leading apostrophe on text a spreadsheet would run as a formula. `xes` (IEEE 1849-2016, for process-mining tools): one `trace` per case (`wl:status` completed, failed, dropped or active), written when the case ends, with `concept:name` (the step name), `lifecycle:transition` (`start`, `complete`, `schedule`, `suspend`, `resume`, `ate_abort`, `pi_abort`, `withdraw` or `unknown`), `time:timestamp` and the Wildlands `wl:kind`, `wl:minute`, `wl:step` and `wl:detail`; memory is bounded by the cases in progress. |
| `build` | `--input`, `--output` | yes | Output must end in `.html`. |
| `export-bpmn` | `--input`, `--output` | yes | Definition JSON to BPMN 2.0 XML; output must end in `.bpmn` or `.xml`. Prints `output`, `bpsim` and `fidelity`: plain sentences naming what only the Wildlands extension carries, so a tool that ignores the extension loses it (`[]` when nothing is lost; see [fidelity notes](business-process-engine.md#exporting-bpsim)). Text XML 1.0 cannot carry is refused, naming the character. The output is well-formed, and the registered `business-process-bpmn` suite checks the demo and example exports (with and without `--bpsim`) with the built-in BPMN 2.0 / BPSim 1.0 conformance validator (`validate-bpmn`); one earlier recorded run also used the OMG schema files ([record](../_archive/verification/bpmn-schema-conformance-2026-10-08.md)). |
| | `--bpsim` | no | Also write a BPSim scenario (processing and wait times, probabilities, arrival timing, the first arrival rule's constant case data and whole-number draws as start-event properties, the seed as the scenario seed, pool quantities and costs, in minutes; with working hours also a weekly iCalendar `Calendar` that pool availability and the first arrival's timer are valid for). The Wildlands extension stays authoritative on re-import. |
| `validate-bpmn` | `--input` | yes | BPMN 2.0 XML (up to 8 MiB) to check against the built-in BPMN 2.0 and BPSim 1.0 conformance rules; no schema file is used ([conformance validator](business-process-engine.md#conformance-validator)). Prints `ok`, `input` and the report: `conforms`, `errors` (`line`, `path`, `code`, `message`), `notCovered` (recognised elements the rules do not check), `unchecked` (extension content per namespace, such as the Wildlands extension, which is not schema-checked), `checked` and `rules` (`{bpmn: "2.0", bpsim: "1.0"}`). Exit 0 when the file conforms; exit 2 with `ok: false` and `code: "process-bpmn-nonconforming"` when it does not. Usage errors and unreadable files exit 2 with `code: "process-operation-failed"`. |
| `import-bpmn` | `--input`, `--output` | yes | BPMN 2.0 XML to a definition JSON. Prints the structured report: `output`, `runnable`, `diagnostics`, `warnings`, `process`, `scenario`, `horizon`, `options`, `mapping` (`total`, `byType`, `byTarget`) and `rejections` (`[]`). Rejected constructs exit 2 with `ok: false`, `code: "process-import-rejected"`, `rejections` (`id`, `type`, `message`) and `errors`; nothing is written. A process with more than 512 flow nodes or 1,024 sequence flows (4 times the definition limits) is rejected before analysis with a plain message ("This process is too large to import: …"). XML with a DOCTYPE or entity declaration is refused; the same text inside a comment or CDATA section is not. A BPSim scenario `seed` becomes the definition `seed` when the Wildlands extension names none. |
| | `--draft` | no | Keep a definition that has graph diagnostics (`runnable: false`); without it such a file exits 1 with `diagnostics`. |
| | `--process ID` | no | Process, or participant, to import when the file has several (default: the first executable one, else the first). |
| | `--lanes pools\|ignore` | no | `pools` (default): a pool per lane that holds tasks; `ignore`: tasks demand no pool. |
| | `--default-capacity N`, `--system-capacity N` | no | Capacity of pools made from lanes (default 1, system pools and `Automation` 4); 1-1000. |
| | `--no-auto-system-pool` | no | Keep service, script, rule, send and receive tasks as plain tasks instead of `system` steps on `Automation`. |
| | `--default-duration N` | no | Minutes for work without a duration (default 5). |
| | `--minutes-per-day N`, `--minutes-per-hour N` | no | Business minutes in a day (default 480, 1-1440) and an hour (default 60, 1-60) for ISO-8601 timer durations and BPSim units; a week is 5 days. |
| | `--unsupported reject\|drop` | no | `reject` (default) fails with the offending element ids and writes nothing; `drop` removes or approximates unsupported constructs with a warning each, prunes what becomes unreachable and fails if no end remains reachable. |
| | `--no-bpsim` | no | Ignore BPSim scenarios. |
| | `--scenario ID` | no | BPSim scenario id or name (default: the first); an unknown one fails. Conflicts with `--no-bpsim`. |
| | `--report FILE` | no | Also write the complete report (every `mapping` entry) as JSON; it must differ from the input. |
| `slides` | `--input` | yes | Admitted definition JSON to a slide deck that explains the process (`format: wildlands-process-slides`): an intro (title, overview, resources), one section per main-route phase (or one main-route section), a variants section for every step off the main route, and a summary. Every step appears on exactly one step slide; all text is plain text derived from the definition. |
| | `--format json\|md` | no | `json` (default) prints the envelope with `deck`; `md` prints the Markdown text itself (not JSON) to stdout. |
| | `--minutes N` | no | Adds read-only live facts from one fresh bounded run (the same run as `process run`), named by minute and seed. |
| | `--seed S` | no | Seed for that run (requires `--minutes`); default the definition's seed, else 1. |
| | `--brief` | no | The brief deck: title (lead and **Key results**), overview, resources, one section slide per section and the summary, without the step slides; every step is still named on one section slide. Reported as `brief: true`. |
| | `--output` | no | Writes the deck JSON or the Markdown file instead and prints `output`, `format`, `slides`, `sections`, `brief` (with `--brief`) and `live`. |
| `diff` | `--input`, `--against` | yes | Compares two definitions (drafts allowed): what changed from `--against` (the reference) to `--input`. Entities are compared like the fingerprint, with keys sorted, so key order is never a change. Prints `input` and `against` (`file`, `id`, `revision`, `fingerprint`), `identical` (equal fingerprints), `revisionChanged`, `summary` (for example "Changes: 2 steps changed", "Changes: revision only (1 to 2)" or "Changes: none"), `changes` (`steps`, `flows`, `resources`, `arrivals`, `settings` counts), `changedSteps` (`id`, `name`, `change`: added, removed or changed), `changedSettings` (top-level setting names), `changedResources` and `changedFlows` (`id`, `name`, `change`; a flow is named by its label, else "from → to"), `changedArrivals` (`index`, 0-based, `name` "Arrival rule n", `change`) and `fields`, every changed scalar value as `{path, before, after}` with ids in the path (`/steps/pay/duration`, `/resources/developers/capacity`, `/arrivals/0/count`; `before` or `after` is absent for a value that was added or removed, and an added or removed step, resource or flow is reported by its entity rather than value by value). Writes nothing. |
| `replicate` | `--input`, `--minutes`, `--runs` | yes | Runs the definition for `--minutes` (1-100000) over `--runs` (1-200) consecutive seeds in fresh sessions, at most 1,000,000 simulated minutes in total, and prints `report` (`format: wildlands-process-replications`): `minutes`, `horizon`, `runs`, `complete`, `seeds`, per-seed `rows` and per KPI (`completed`, `failed`, `dropped`, `workCost`, `capacityCost`, `meanCycleMinutes`, `meanAgeMinutes`, `throughputPerHour`, `utilization.<pool>` and, with outcomes, `goals`, `lost`, `conversion`) `n`, `mean`, sample `sd`, a `ci95` with the exact Student t quantile for `n − 1` degrees of freedom, and nearest-rank `p10`, `p50`, `p90` ([replications](business-process-engine.md#replications-and-paired-comparisons)). |
| | `--seed S` | no | First seed (default: the definition's seed, else 1); the runs use `S`, `S + 1`, …. |
| | `--warmup W` | no | Whole minutes below `--minutes`: each run also reports windowed KPIs "after minute W" (ids `window.<kpi>`, including `window.meanWip`); without it the report is unchanged. |
| | `--output` | no | Writes the report file and prints `output`, `format`, `runs`, `seeds` and `kpis` (no per-seed rows). |
| `compare` | `--input`, `--against`, `--minutes`, `--runs` | yes | Runs `--input` (A) and `--against` (B) on the same seeds (common random numbers wherever they agree; the plan counts both) and prints `report` (`format: wildlands-process-comparison`): per KPI `a`, `b` and `difference` (A − B paired per seed, with its own sd and interval), per-seed `rows`, and `diff`, exactly what `process diff --input A --against B` prints. Takes `--seed`, `--warmup` and `--output` like `replicate`. |
| `forge` | `--input`, `--output` | yes | New directory; its parent must exist and the directory must not. |
| `attach` | `--input`, `--asset`, `--step`, `--expected-revision`, `--expected-fingerprint` | yes | Scene Forge asset for a step, with edit guards. |
| | `--output` | yes unless `--dry-run` | Edited definition. |
| | `--dry-run` | no | Write nothing; conflicts with `--output`. |

The `process` template builds data-only definitions into offline 2D/3D simulations; its manifest names either one `content.definition` or an ordered `content.definitions` list of 1-8 files (never both), and `validate-game` admits every entry and reports the failing index. See [Business process authoring](../how-to/business-process-authoring.md).
