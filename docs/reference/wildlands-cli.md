# Wildlands CLI handbook

`bin/wildlands` is the noninteractive command-line interface of
[Wildlands](../../source/wildlands/README.md), the TypeScript game prototype maker
kept in `source/wildlands/`. It creates, validates, inspects, plays, edits and
compiles portable **Wildlands projects** (`wildlands-project` documents) and turns
them into runnable Godot desktop projects. Littlewild is the default scenario;
Emberworks and Office are the other built-in scenarios.

The file is one self-contained, checked-in CommonJS executable. It embeds the
compiled simulation, all built-in content, the trusted Godot runtime and the
opt-in engine-source bundle (inflated only when a command asks for it), so it
needs no `npm ci`, build step, `node_modules` or network access. It speaks a
stable JSON-only protocol, which makes it suitable for scripts and AI agents.
Wildlands is separate from the native Motorsport Manager game: it does not read
or write Motorsport Manager saves, configuration or the race/campaign domains.

## Requirements

| Need | Requirement |
|---|---|
| Run any command | Node.js 22 or newer on `PATH` |
| Open a compiled project | Godot 4.4 or newer (desktop), plus Node.js 22+ at runtime |
| Rebuild `bin/wildlands` | Node.js 22+, npm and `npm ci` in `source/wildlands/` |

`compile`/`export` only write files; they do not need Godot. On Windows, or when
the executable bit is lost, invoke it as `node bin/wildlands …`.

## Quick start

Run these from the repository root. The examples in this handbook continue in
the same shell and write only below `$OUT`.

```sh
node --version
bin/wildlands --version
OUT="$(mktemp -d)"
bin/wildlands create --output "$OUT/project.json"
bin/wildlands validate --project "$OUT/project.json"
bin/wildlands inspect --project "$OUT/project.json" > "$OUT/inspect.json"
bin/wildlands run --project "$OUT/project.json" --recipe source/wildlands/examples/wildlands-recipe.example.json --output "$OUT/played.json"
bin/wildlands edit --project "$OUT/played.json" --recipe source/wildlands/examples/wildlands-editor-recipe.example.json --output "$OUT/edited.json"
bin/wildlands export --project "$OUT/edited.json" --output "$OUT/godot"
```

The last command writes a complete Godot project. Open it with
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
| `1` | `false` | `invalid-project` | `--project` was read but rejected by project validation, including malformed JSON. Nothing was written. |
| `2` | `false` | `operation-failed` | Usage error, unknown/duplicate/missing option, I/O failure, invalid recipe or pack, rejected gameplay command, refused output path or compiler failure. Nothing was written. |

Every result carries `"protocolVersion": 1`. Failures always have this shape:

```json
{
  "ok": false,
  "protocolVersion": 1,
  "code": "operation-failed",
  "errors": ["Duplicate option: --output"]
}
```

Options take exactly one value each (`--flag value`); a value cannot start with
`--`. Options may appear in any order after the command. Unknown, duplicate and
missing required options fail with exit 2. Relative paths resolve against the
current directory; `output` fields in results are absolute paths.

**Writing.** JSON outputs are written to a uniquely named temporary file and then
renamed over the destination, so readers never see a partial document. An
existing output file is replaced, except that an output may never be one of the
command's inputs (same path, hard link or symlink alias): that fails with exit 2
and leaves the input untouched. Godot outputs are staged in a sibling directory
and published only when complete.

## Commands

Arguments in `[brackets]` are optional.

| Command | Purpose |
|---|---|
| `--help`, `-h` or no arguments | Usage summary and handbook path. |
| `--version` | CLI package name and version. |
| `discover` | Machine-readable description of operations, gameplay commands and recipe formats. |
| `scenarios` | Built-in scenario and scene IDs. |
| `create --output FILE [--scenario ID] [--scene ID] [--pack FILE] [--id ID] [--name TEXT]` | Create a project. |
| `validate --project FILE` | Validate a project and print its identity. |
| `inspect --project FILE` | Read-only snapshot of the selected scene. |
| `scenario --project FILE --scenario ID [--scene ID] --output FILE` | Switch scenario/scene into a new document. |
| `run --project FILE --recipe FILE --output FILE` | Play a bounded game recipe and capture the result. |
| `edit --project FILE --recipe FILE --output FILE` | Apply a bounded scene-editor recipe. |
| `compile --project FILE --output DIR [--with-engine-sources]` (alias `export`) | Write a runnable Godot desktop project. |

### `--help` and `--version`

```sh
bin/wildlands --help
bin/wildlands --version
```

`--help` returns `{ok, protocolVersion, usage, handbook}`, where `handbook` is
`docs/reference/wildlands-cli.md`. `--version` returns
`{ok, protocolVersion, name: "wildlands", version}`; `version` is the
`source/wildlands/package.json` version the binary was built from. Neither loads
the simulation. Extra arguments after `--version` are an unknown operation
(exit 2).

### `discover`

```sh
bin/wildlands discover > "$OUT/discover.json"
jq -r '.commands[] | "\(.id) \(.scope) maxArgs=\(.maxArgs)"' "$OUT/discover.json"
```

Result fields: `name` (`"wildlands"`), `projectFormat` (`"wildlands-project"`),
`projectSchemaVersion` (`1`), `target` (`"godot"`), `maxBytes` (project size
limit), `defaultScenario`, `scenarios` (as in `scenarios`), `operations` (each
CLI operation with `description`, `arguments` and an `example` argv),
`commands` (every gameplay command usable in a `command` recipe operation:
`id`, `scope` `actor`|`world`, `maxArgs`, `away`) and `recipes` (limits, the game
and editor recipe operation tables and an example of each). `recipes.toolbox`
names the typed SDK and JSON-lines runtime of a source build (paths under
`source/wildlands/.generated/`); those are not part of `bin/wildlands`.

Discovery is the source of truth for supported commands and operations. Prefer
it over this page when they differ.

### `scenarios`

```sh
bin/wildlands scenarios
```

Returns `{ok, protocolVersion, scenarios: [{id, name, scenes: [{id, name, worldId}]}]}`.
The shipped built-ins are:

| Scenario | Scenes (first is the default) |
|---|---|
| `littlewild` | `first-morning`, `charted-home` |
| `emberworks` | `workshop-first-morning`, `workshop-charted-home` |
| `office` | `operations-shift` |

### `create`

```sh
bin/wildlands create --scenario littlewild --scene charted-home --id my-proto --name "My prototype" --output "$OUT/showcase.json"
bin/wildlands create --scenario office --output "$OUT/office.json"
```

| Option | Default | Rule |
|---|---|---|
| `--output FILE` | required | Project JSON to write. |
| `--scenario ID` | `littlewild` | Built-in scenario. With `--pack`, it must equal the pack's `id`. |
| `--scene ID` | first scene of the pack | Must exist in the pack. |
| `--pack FILE` | built-in pack | Custom `living-worlds-pack` JSON, at most 8 MiB, validated before use. |
| `--id ID` | `wildlands-prototype` | ASCII identifier, 1–64 characters, `[a-zA-Z0-9][a-zA-Z0-9_.-]*`. |
| `--name TEXT` | the pack name | 1–128 characters. |

Result: `{ok, protocolVersion, output, projectId, scenarioId, sceneId}`.

A custom pack is easiest to start from an existing project's `pack`. The pack's
`id` becomes the project's `scenarioId`:

```sh
jq '.pack | .id = "my-prototype"' "$OUT/project.json" > "$OUT/my.pack.json"
bin/wildlands create --pack "$OUT/my.pack.json" --output "$OUT/custom.json"
```

### `validate`

```sh
bin/wildlands validate --project "$OUT/custom.json"
```

Result: `{ok, protocolVersion, fingerprint, projectId, scenarioId, sceneId}`.
`fingerprint` is 16 hexadecimal digits identifying the complete normalized
project: it hashes the key-sorted canonical JSON of every field, including `id`,
`name`, `scenarioId`, `sceneId` and the whole `pack`. JSON key order and
whitespace do not change it; any value change does, including the captured
result of a `run` or `edit` recipe. `validate` and `inspect` report the same
value for the same project. Use it to detect content changes between project
files. A `run` output is the complete captured project, so even a recipe that
advances no time can differ from a project made by `create` (the capture writes
the pack's explicit `resources`); measure simulation progress with
`advancedSeconds`, not the fingerprint. It is a non-cryptographic change
identifier, not a signature or proof of authorship, and it is never stored in the
project. Use a file digest such as `sha256sum` when you need exact bytes.

### `inspect`

```sh
bin/wildlands inspect --project "$OUT/project.json" | jq '.snapshot.actors[] | {id, name, task: .task.label}'
```

Opens a temporary session for the selected scene, reads it and disposes it. It
never advances simulation time, so repeated calls return identical output.
Result: `{ok, protocolVersion, projectId, scenarioId, sceneId, fingerprint,
snapshot, connections}`. `snapshot` holds `simTime`, `day`, `hour`, `started`,
`paused`, `actors` (stable `id`, `name`, `archetype`, `personality`, `position`,
`needs`, `task`, `inventory`), `buildings`, `nodes`, `player`, `scenarioId` and
`sceneId`. `connections` lists the scene connections usable by `enterScene`.

### `scenario`

```sh
bin/wildlands scenario --project "$OUT/showcase.json" --scenario office --output "$OUT/showcase-office.json"
bin/wildlands scenario --project "$OUT/project.json" --scenario littlewild --scene charted-home --output "$OUT/charted.json"
```

Writes a new project that keeps the input's `id` and `name`. Switching to another
scenario replaces the pack with that built-in pack; selecting the project's own
scenario keeps its current pack and changes only the scene. Result:
`{ok, protocolVersion, output, scenarioId, sceneId}`.

### `run`

```sh
bin/wildlands run --project "$OUT/project.json" --recipe source/wildlands/examples/wildlands-recipe.example.json --output "$OUT/played.json" | jq '{requestedSteps, advancedSeconds, simTime: .snapshot.simTime}'
```

Applies a [game recipe](#game-recipes) in one owned session, then captures the
resulting state into a new project. The input project is never changed. Result:
`{ok, protocolVersion, output, scenarioId, sceneId, snapshot, results,
requestedSteps, advancedSeconds}`. `results` has one entry per operation, in
order. `requestedSteps` counts requested 0.1-second steps; `advancedSeconds` is
the simulation time actually advanced. Compare both, because a paused session
can accept steps without advancing time. Any failing operation, including a
rejected gameplay command, fails the whole run with exit 2 and writes nothing.

### `edit`

```sh
bin/wildlands edit --project "$OUT/project.json" --recipe source/wildlands/examples/wildlands-editor-recipe.example.json --output "$OUT/renamed.json"
```

Applies an [editor recipe](#editor-recipes) through the scene editor and the
whole-pack validators, then writes the exported project. Result:
`{ok, protocolVersion, output, scenarioId, sceneId, revision}`, where `revision`
is the editor revision after the last operation.

### `compile` and `export`

```sh
bin/wildlands compile --project "$OUT/showcase.json" --output "$OUT/godot-showcase"
jq '{files, runtime: .manifest.runtime, prerequisites: .manifest.prerequisites}' "$OUT/godot-showcase/wildlands.manifest.json"
```

`export` is an alias for `compile`. `--output` must be a directory that does not
exist yet, with an existing real parent and no symlinked ancestors; choose a fresh
path for every compile. Result: `{ok, protocolVersion, output, files, engineSources, manifest}`.

The directory contains `project.godot` and `main.tscn`, `native/*.gd` (native
presentation and the subprocess bridge), `runtime/` (the compiled TypeScript
simulation that stays the gameplay authority: exactly the static require closure
of the bridge runtime, without browser presentation modules or test fixtures),
`wildlands.project.json` (the validated project) and `wildlands.manifest.json`
(target, prerequisites, capabilities, limitations and the byte size and SHA-256
of every generated file). A Littlewild project compiles to about 150 files and
3.9 MB.

The inert engine-source bundle (code-generator input: authoritative sources,
vendors and a trimmed TypeScript toolchain; see
[ENGINE-EXPORT.md](../../source/wildlands/ENGINE-EXPORT.md#payload-policy)) is
opt-in. `--with-engine-sources` is a value-less flag that adds the exact
`runtime/engine-source-bundle.json` (about 30 MB), which enables the
`engineExport` tools inside the compiled runtime; the result then reports
`engineSources: true` and the manifest lists the capability. Without the flag the
manifest records the omission as a limitation and the project still runs
completely. Output is deterministic: compiling the same project twice gives
byte-identical directories. Projects whose scenes use custom renderer or
animation extensions without a native adapter are rejected. The output needs
desktop Godot 4.4+ and Node.js 22+ on `PATH` (or `WILDLANDS_NODE`); it is not a
web or mobile export. See [WILDLANDS.md](../../source/wildlands/WILDLANDS.md#runnable-godot-compiler)
for coverage and limits.

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
| `--project` file and project document | 10 MiB (10,485,760 bytes); also `discover.maxBytes` |
| `--pack` file | 8 MiB (8,388,608 bytes); the pack keeps its own admission limits |
| `--recipe` file and recipe document | 1 MiB (1,048,576 bytes) |
| Recipe operations | 256 per recipe |
| Recipe clock | 36,000 steps of 0.1 s per recipe (one simulated hour) |
| Project `id` / `name` | 1–64 ASCII identifier characters / 1–128 characters |

Input files must be regular files containing UTF-8 JSON. Duplicate JSON keys and
prototype-shaped values are rejected.

## Common errors

| Exit | Message (in `errors[0]`) | Fix |
|---|---|---|
| 2 | `Unknown operation. wildlands --help \| …` | Use a command from `--help` or `discover`. |
| 2 | `Unknown option: …`, `Duplicate option: …`, `Missing value for …`, `Missing required option: …` | Correct the argv. |
| 2 | `ENOENT: no such file or directory, open '…'` | Check the input path. |
| 1 | `Could not read JSON: …` | The project file is not valid JSON. |
| 1 | `Project scenarioId must match pack.id.` and other validation messages | Recreate the project or fix the reported field. |
| 2 | `Unknown scenario: … Use wildlands scenarios.`, `Scene does not exist in this scenario: …` | Use IDs from `scenarios`. |
| 2 | `Clock values require whole 0.1-second steps, at most 36000.` | Use multiples of 0.1 s within the limits. |
| 2 | `Command rejected: …` | The game refused the command; inspect state and IDs. |
| 2 | `Output must not overwrite an input file.` | Write to a new path. |
| 2 | `Godot output must be a new directory with a real parent and no symlink ancestors.` | Choose a fresh output directory. |

This example shows a rejected argv and keeps the shell going:

```sh
bin/wildlands create --output "$OUT/a.json" --output "$OUT/b.json"; echo "exit=$?"
```

## For AI agents

1. Invoke `bin/wildlands` (or `node bin/wildlands`) directly, not through
   `npm run`, so no npm banner reaches stdout.
2. Parse stdout as one JSON document. Check the exit code and `ok` before using
   any other field. On failure, read `code` and `errors`; do not scrape text.
3. Start with `discover`. Use only the operations, gameplay commands and recipe
   operations it lists. Never infer commands from source code.
4. Get stable actor, building, node, scene and connection IDs from `scenarios`,
   `inspect` and `connections`, not from display names.
5. Treat documents as immutable inputs: always write `run`, `edit`, `scenario`
   and `compile` results to new paths, then `validate` or `inspect` the result.
6. Change projects through `create`, `scenario`, `run` and `edit` recipes. Do not
   hand-edit `pack` internals unless you then pass `validate`. Never add a
   `fingerprint` to documents. Compare `validate` fingerprints to detect content
   changes, never to establish trust (see [`validate`](#validate)).
7. Do not hand-edit compiled Godot output. `wildlands.manifest.json` records the
   SHA-256 of every file; recompile instead.
8. Time advances only through explicit `step`/`advance` operations in `run`.
   `inspect`, `validate` and `discover` never tick. Verify progress with
   `advancedSeconds` and the returned `snapshot`, not with `requestedSteps`.
9. Keep recipes within the limits above, and split longer experiments into
   several `run` invocations that chain output projects.
10. Report the exact `--version`, commands and SHA-256 of resulting files. A
    successful run or compile is not native Godot, balance or human validation.

A typical machine-checked step:

```sh
result="$(bin/wildlands validate --project "$OUT/played.json")"; status=$?
test "$status" -eq 0 && test "$(printf '%s' "$result" | jq -r .ok)" = true && printf '%s' "$result" | jq -r '.scenarioId + "/" + .sceneId'
sha256sum "$OUT/played.json"
```

## Rebuild and check the binary

`bin/wildlands` is generated by
[`source/wildlands/source/tools/cli-bundle.cts`](../../source/wildlands/source/tools/cli-bundle.cts)
with a pinned esbuild. Never edit it by hand.

```sh
cd source/wildlands
npm ci
npm run build:cli
npm run check:cli
```

- `npm run build:cli` runs the full `npm run build`, bundles
  `.generated/tools/wildlands-cli.cjs` and writes `bin/wildlands` with mode 755.
  It smoke-runs the candidate first: `--version`, `--help`, `discover`,
  `scenarios`, `create`, `validate` and `compile` with and without
  `--with-engine-sources`, from an empty temporary directory with
  file reads confined to that directory through Node's permission model.
- `npm run check:cli` performs the same build and smoke test in memory and fails
  (exit 1) when the checked-in file differs or is not executable. CI can use it as
  the freshness gate.
- `npm run build` alone does not touch `bin/wildlands`. Verification and the
  engine export rebuild copies of `source/wildlands` in isolation, and those
  builds must not write outside their own project directory.

The bundle is byte-deterministic for the same sources and lockfile: it has no
timestamps, absolute paths or source maps, and its embedded runtime payloads are
compressed with the pinned pure-JavaScript `pako`, so neither the checkout path
nor the Node.js release changes the bytes. It embeds two payloads: the Godot
runtime closure (about 0.5 MB compressed) and the engine-source bundle (about
6 MB compressed) used by engine export and `compile --with-engine-sources`.
Consequently any change to an authored file under `source/wildlands/source/`,
`vendor/`, `package.json`, `package-lock.json` or the `tsconfig` files changes
`bin/wildlands`. Rebuild and commit it in the same change. The file is about
12.4 MB, half of it the compressed engine sources. `npm run report:artifacts`
breaks down both payloads.

## Related documentation

- [Wildlands project and Godot target](../../source/wildlands/WILDLANDS.md): project format, browser workspace, persistent JSON-lines runtime and native coverage.
- [Developer toolbox](../../source/wildlands/DEVELOPER-TOOLBOX.md): typed SDK sessions, commands and agent guidance for source builds.
- [Wildlands documentation index](../../source/wildlands/DOCUMENTATION.md): every Wildlands guide and contract.
- [Engine JSON export](../../source/wildlands/ENGINE-EXPORT.md): the separate inert source/data export format.
