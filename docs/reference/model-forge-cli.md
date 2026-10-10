# Model Forge CLI handbook

`bin/model-forge` is a checked-in, self-contained build of
[Model Forge](../../source/model-forge/README.md): an agent-first, standalone
editor for **exactly one 3D model**. One invocation reads one model document,
applies validated and revision-guarded edits to it, and produces the assets that
[Scene Forge](scene-forge-cli.md), the [Wildlands engine](wildlands-cli.md) and
its game folders consume. The editable recipe is the source of truth; meshes,
images and Littlewild definitions are build outputs.

Model Forge also owns the **model asset contract** (the `model` and `model-bundle`
document formats, schema version 1) and the **shared model recipe kernel** in
`source/model-forge/src/kernel`: schemas and semantic validation, operations,
deterministic model expansion, GLB/glTF/OBJ/STL/Three.js export, Littlewild asset
writing, capture/review and browser realization. Scene Forge imports that kernel
through its own bridge modules and keeps projects, scene composition, its model
registry and scene-wide Littlewild sync. Model Forge is a standalone tool beside
the game; it does not read or write Motorsport Manager content, saves or Godot
scenes.

The executable is one file. It bundles every JavaScript dependency, so it runs
from a fresh clone without `npm ci`. It is the same program as the `model-forge`
package command in `source/model-forge` (`npm run cli -- <args>` there runs it
from source). `model-forge discover` and `model-forge describe <command path>`
report the exact commands, flags, defaults and limits of the installed build;
prefer them over memorized syntax.

Every `sh` block on this page was executed in order, as one shell session from
the repository root, against `bin/model-forge` 0.1.0 (with `bin/scene-forge` and
`bin/wildlands` for the handoffs) and Chromium supplied through
`FORGE_CHROMIUM_PATH`. The examples write only below `$OUT`. `text` blocks show
file layouts and maintainer commands.

## Requirements

| Capability | Commands | Needs |
|---|---|---|
| Discovery, document lifecycle, inspection, editing, history, audit, preview, export | everything except `review` | Node.js 22 or newer |
| Image review | `review` | Node.js 22+, the `playwright` package and a Chromium build Playwright can launch |
| Installation report | `doctor` | Node.js 22+; reports Playwright and Chromium status without failing when they are absent |

Playwright is not bundled. The executable loads it on demand from its own module
resolution (including `NODE_PATH`), the working directory, `source/model-forge`
beside the repository's `bin/` directory, and the global npm module root of the
running Node. Provide Chromium with `npx playwright install chromium` or set
`FORGE_CHROMIUM_PATH` to an existing Chromium/Chrome executable. `preview` only
writes an HTML file and needs neither.

Where the `#!/usr/bin/env node` line is not honored (Windows shells), run
`node bin/model-forge …`.

## Quick start

```sh
node --version
bin/model-forge --version
OUT="$(mktemp -d)"
bin/model-forge --compact discover > "$OUT/discover.json"
bin/model-forge describe export
bin/model-forge schema --kind batch --raw > "$OUT/batch.schema.json"
bin/model-forge create "$OUT/crate.model.json" --id crate --name "Supply crate" --category props
bin/model-forge -d "$OUT/crate.model.json" add box body --size 0.6,0.4,0.6 --at 0,0.2,0
bin/model-forge -d "$OUT/crate.model.json" inspect --source
```

`create` and `import` answer with `nextCommands`; `add` is a one-batch shortcut
that also creates a `clay` material when the model has none of that name.

## The document

Every command except discovery, `create` and `import` targets one document named
with the global `-d, --document <path>`; without it they fail with
`DOCUMENT_REQUIRED`. There is no working-directory discovery and no hidden
session state: each invocation reads the file it is given.

| Kind | File | Editable content |
|---|---|---|
| `model` | `<id>.model.json` | The whole model: parameters, materials, geometries, nodes, metadata |
| `model-bundle` | `<id>.model-bundle.json` | Only the `entry` model; every other model in `models` is a frozen, read-only dependency |

The path decides the kind: `create` writes a `model-bundle` when the path ends in
`.model-bundle.json` and a `model` when it ends in `.model.json`; any other name
fails with `DOCUMENT_KIND`. A model that nests other models cannot be written to
a `.model.json` path (`DOCUMENT_KIND`, with `details.suggestedPath`).

A `model` document is the existing Scene Forge model recipe (`schemaVersion: 1`,
`kind: "model"`, `id`, `name`, optional `category` and `description`,
`parameters`, `materials`, `geometries`, `nodes`). Model Forge adds one optional
field to the **editable model** (the entry model of a bundle), `revision`: a
nonnegative integer that is absent (meaning 0) in existing files, so their bytes
and state hashes are unchanged. Scene Forge accepts the field everywhere it
accepts a model. Portable `export --format model` and `model-bundle` outputs omit
it.

A model that nests other models (a node with `"type": "model"`) needs its
dependencies to compile. Such a model is edited as a `model-bundle`
(`schemaVersion: 1`, `kind: "model-bundle"`, `entry`, `models`), the same format
Scene Forge's `model export` writes. Dependencies travel with the entry model but
cannot be changed through ordinary edits: a write that touches a node of one fails
with `DEPENDENCY_READONLY`. `putDependency` and `removeDependency` (and their
`dependency put|remove` wrappers) are the only operations that change the
dependency set, and only in a bundle; in a `model` document they fail with
`DOCUMENT_KIND`. A dependency that no node instantiates is kept in the document,
listed by `inspect` as `unusedDependencies`, warned about in `stats.warnings`,
and left out of portable exports.

Side files beside the document belong to the editor:

```text
crate.model.json             the document (source of truth)
crate.model.json.lock        held by a writer from read through write; never delete another process's lock
crate.model.json.history/    the replaced file, byte for byte, per committed revision: <revision>.json
```

Reads (`inspect`, `validate`, `node list`, `history`, `rig inspect`, `review`,
`preview`, `audit`, `export`) never take the lock; writers replace the document
atomically. `stateHash` is the SHA-256 of the canonical JSON of
`{model, dependencies}`: the entry model and the frozen dependency library. Every
read returns `revision` and `stateHash`; every write accepts them as guards.

Conventions are Scene Forge's: meters, right-handed, **Y up**, model front **+Z**,
local XYZ Euler angles in degrees. Scalars may be numbers, `{"$param": "<name>"}`
or bounded `{"$expr": …}` arithmetic; see the
[Scene Forge file formats](scene-forge-cli.md#file-formats).

## Output contract

| Result | Stream | Shape | Exit |
|---|---|---|---|
| Success | stdout | `{"ok":true,"data":...}`, pretty-printed; one line with `--compact` | 0 |
| Failure | stderr | `{"ok":false,"error":{"code","message","hint"?,"details"?}}` | 1 |
| `--help`, `<command path> --help`, `--version` | stdout | plain text | 0 |
| `schema --raw`, `example show <id> --raw` | stdout | bare JSON document | 0 |

The envelope is identical to Scene Forge's. `--compact` is global and changes
formatting only. There are no prompts. Wherever JSON input is accepted, use
`--file <path>`, `--file -` for stdin, or `--data '<json>'`; inputs are limited to
16 MiB.

## Agent protocol

1. Discover, do not guess: `model-forge --compact discover` lists the workflow,
   commands, document kinds, operations, geometry types, limits, export formats
   and error codes with remedies. Use `describe <command path>` for flags and
   `schema --kind <kind> --raw` before writing JSON. Unknown keys fail.
2. Read before writing: `model-forge -d <doc> inspect` returns `path`, `id`,
   `kind`, `revision`, `stateHash`, `name` (plus `category`/`description` when
   set), `parameters`, `dependencies`, `unusedDependencies`, `counts` (authored
   nodes, geometries, materials) and compiled `stats` (nodes, meshes, triangles,
   materials, geometries, bounds, warnings). Add `--source` for the document,
   `--node <id>` to focus on one node and `--parameters <json>` to measure a
   variant.
3. Build one complete batch, dry-run it with `apply --dry-run`, then apply the
   same batch with `--expected-revision R --expected-state H` from the latest
   read. On `REVISION_CONFLICT` or `STATE_CONFLICT`, read again and rebuild; never
   retry blindly and never remove another process's lock file.
4. `put*` replaces a definition; `patch*` merges only supplied fields. A batch
   that changes nothing keeps the revision and writes no history snapshot.
5. Check the result: `validate`, `audit` (`--strict` fails on warnings), then
   `review --out <new directory>` and look at `contact-sheet.png`. When
   Playwright is unavailable, say that no visual check ran; `doctor` tells you
   which case applies.
6. Export for the consumer (see [Outputs and consumers](#outputs-and-consumers));
   use `--validate` for GLB/glTF and `--dry-run` or `--check` before rewriting a
   Littlewild definition.
7. Never edit a model registered inside a Scene Forge project in place. Export a
   `model-bundle` and import it with Scene Forge's guarded `model import`.

A guarded edit of the quick-start crate (`add` produced revision 1):

```sh
cat > "$OUT/lid.batch.json" <<'EOF'
{"operations": [
  {"op": "putMaterial", "id": "wood", "material": {"color": "#8a5a2b", "roughness": 0.8}},
  {"op": "putGeometry", "id": "lid", "geometry": {"type": "box", "size": [0.62, 0.05, 0.62]}},
  {"op": "putNode", "node": {"id": "lid", "type": "mesh", "geometry": "lid", "material": "wood",
    "tags": ["lid"], "transform": {"position": [0, 0.425, 0]}}}
]}
EOF
bin/model-forge -d "$OUT/crate.model.json" apply --file "$OUT/lid.batch.json" --dry-run
STATE="$(bin/model-forge --compact -d "$OUT/crate.model.json" inspect | node -p 'JSON.parse(require("fs").readFileSync(0, "utf8")).data.stateHash')"
bin/model-forge -d "$OUT/crate.model.json" apply --file "$OUT/lid.batch.json" --expected-revision 1 --expected-state "$STATE"
bin/model-forge -d "$OUT/crate.model.json" node edit --ids body,lid --data '{"tags": ["crate"]}' --expected-revision 2
bin/model-forge -d "$OUT/crate.model.json" metadata set --description "Wooden supply crate" --clear-category --expected-revision 3
bin/model-forge -d "$OUT/crate.model.json" node list --root --details --limit 10
bin/model-forge -d "$OUT/crate.model.json" validate
bin/model-forge -d "$OUT/crate.model.json" audit --strict
bin/model-forge -d "$OUT/crate.model.json" history
bin/model-forge -d "$OUT/crate.model.json" restore 2 --expected-revision 4 --dry-run
```

## Command reference

`model-forge describe [path...]` prints the arguments, flags, defaults and
choices of a command subtree as JSON for the installed build, and
`model-forge <command path> --help` as text.

### Global options

| Option | Meaning |
|---|---|
| `-d, --document <path>` | The one document this command reads or edits |
| `--compact` | One-line success JSON |
| `-V, --version` / `-h, --help` | Version / help |

### Discovery

| Command | Purpose |
|---|---|
| `discover` (alias `catalog`) | Workflow steps, commands, document kinds, operations (and scene-only operations with their model equivalents), schemas, geometry types, patterns, lights, expressions, rigging, review views, imports, exports, Littlewild families, conventions, limits and error codes with remedies |
| `describe [path...]` | Arguments, flags, defaults and choices of a command subtree |
| `schema [--kind <kind>] [--raw]` | JSON Schema for `batch` (default), `model`, `model-bundle`, `operation`, `node`, `node-patch`, `geometry`, `material`, `parameter`, `rig`, `pattern`, `selector`, `scalar`, `review`, `camera`, `camera-snapshot`, `quality-policy` or `littlewild-asset` |
| `doctor` | Node, Playwright and Chromium availability (`reviewReady`) |
| `example list` | Bundled examples with kind, file name and dependencies |
| `example show <id> [--raw]` | One example document; `--raw` prints the bare document for saving or piping |
| `example create <id> <path>` | Write an example as a new document; a nesting example needs a `.model-bundle.json` path |

### Lifecycle

`create`, `import` and `example create` never overwrite an existing file
(`DOCUMENT_EXISTS`).

| Command | Options and behavior |
|---|---|
| `create <path>` | `--id`, `--name` (both required), `--category`, `--description`, `--example <id>` (start from a bundled example under the new ID and metadata; its dependencies stay frozen). Writes a new document at revision 0; the path suffix selects `model` or `model-bundle` |
| `import` | `--out <new document>` (required) and either `--from <file>` or `--project <dir> --id <model>` (a Scene Forge project and the model's nested closure, read-only; `PROJECT_LOCKED` while a Scene Forge command writes it). `--from` accepts a `model`, a `model-bundle` (`--entry <id>` selects a model other than its entry; only that model's dependency closure is kept), or a Littlewild `littlewild-definition`, `littlewild-creature-package` or `littlewild-3d-asset` (`--variant <name>`, default the first variant; `--prefix <id>` for the generated model IDs). `--dry-run` plans and validates without writing |

A multi-variant Littlewild import writes **one** document for the selected
variant. The result names it in `variant`, maps every source variant to the model
ID it would receive in `variantModels`, reports `sourceFormat` and
`importedFacet: "visual"`, and warns that the other variants need their own
`--variant` imports.

### Read

| Command | Options and behavior |
|---|---|
| `inspect` | `--source`, `--parameters <json>`, `--node <id>`. Identity, revision, `stateHash`, parameters, dependencies, unused dependencies, counts and compiled statistics |
| `validate` | Schema, references, dependencies, cycles, parameter ranges and compilation; returns `valid`, statistics and dependency lists |
| `node list` | Filters intersect: `--ids <a,b>`, `--tag`, `--type group\|mesh\|model\|light`, `--model <dependency>`, `--parent <id>`, `--root`. `--details` adds source, world matrix, bounds and subtree statistics (`--parameters <json>` evaluates them at overrides). Paged with `--limit <1–1000>` (default 100) and `--offset` (default 0); the result has `total`, `offset` and `nextOffset` |
| `history` | Stored revisions with their `stateHash` and snapshot path, plus the current revision |
| `rig inspect <node>` | Joints, clips and bindable mesh paths of a nested model-instance node |

### Write

Every write accepts `--dry-run`, `--expected-revision <n>` and
`--expected-state <hash>`, holds the document lock across read, validation and
write, stores the replaced file in the history directory, increments `revision`
and replaces the document atomically. A failed edit never partially changes the
document.

| Command | Behavior |
|---|---|
| `apply` | A batch `{expectedRevision?, expectedState?, operations}` from `--file`/`--data`; a command-line guard that disagrees with the batch's fails with `GUARD_MISMATCH` |
| `put <kind> <id>` | `kind` is `node`, `geometry`, `material` or `parameter`; JSON from `--file`/`--data`. One `put*` operation |
| `remove <id>` | Remove a node; `--cascade` also removes its descendants (otherwise a node with children fails with `HAS_CHILDREN`). Geometries and materials are removed through `apply` |
| `add <primitive> <id>` | `box`, `sphere`, `cylinder`, `cone`, `torus`, `capsule` or `plane` with `--size`, `--radius`, `--height`, `--tube`, `--at`, `--rotate`, `--material` (default `clay`, created when absent) and `--parent`. Adds geometry `<id>_geo` and the mesh node; guards against the revision it read |
| `node edit` | One patch (`--file`/`--data`, `schema --kind node-patch`) applied to every node matching the `node list` filters; an empty match fails with `EMPTY_SELECTION` |
| `node transform <id>` | `--at`, `--rotate`, `--scale`: set only the given local components |
| `node patch <id>` | Merge name, visibility, tags, transform, pattern or instance overrides from JSON |
| `node duplicate <id> <newId>` | Copy a subtree, `--offset x,y,z` |
| `node group <id>` | `--nodes <a,b>` siblings into a new group, `--name`; world placement is kept |
| `node reparent <id>` | `--parent <id>` (omit for the root); `--local` keeps the local transform instead of the world placement |
| `node ground <id>` | Rest the subtree's world bounds on `--y` (default 0) |
| `node place <id>` | `--to <id>`, `--side right\|left\|front\|back\|above\|below`, `--gap`, `--keep-other-axes` |
| `parameter put <id>` | `--default` (required), `--min`, `--max`, `--integer`, `--description` |
| `parameter remove <id>` | Remove a parameter no expression still uses |
| `metadata set` | `--name`, `--category`, `--description`; `--clear-category` and `--clear-description` remove a field (a value and its clear flag together fail with `INVALID_OPTION`) |
| `dependency put` | Bundle only: add a dependency model from `--file`/`--data`; `--replace` deliberately replaces a different one with the same ID |
| `dependency remove <id>` | Bundle only: remove a dependency no node instantiates |
| `rig bind <node>` | Replace the rig of a nested model-instance node with a rig document (`schema --kind rig`) |
| `rig pose <node>` | `--joint <id> --rotation x,y,z`: absolute local joint rotation in degrees |
| `rig remove <node>` | Remove the rig and return to the authored rest form |
| `restore <revision>` | Commit a stored revision's content as a new revision. Requires `--expected-revision <current>` (`GUARD_REQUIRED` otherwise); an unknown revision fails with `HISTORY_NOT_FOUND`; identical content is a no-op |

Batch operations: `putNode`, `patchNode`, `patchNodes`, `removeNode`,
`duplicateNode`, `reparentNode`, `groupNodes`, `groundNode`, `placeNode`,
`putGeometry`, `removeGeometry`, `putMaterial`, `removeMaterial`,
`putParameter`, `removeParameter`, `setMetadata` (`null` clears `category` or
`description`), and, in a bundle only, `putDependency` (`replace: true` to
replace a different model) and `removeDependency`. Scene-only operations
(`setCamera`, `setEnvironment`, `setParameter`) fail with `UNKNOWN_OPERATION`;
the message names Scene Forge and the model-side alternative (`review` views or
`--background`, `putParameter`).

A write result has `path`, `id`, `kind`, `revision`, `stateHash`,
`proposedRevision`, `proposedStateHash`, `changes`, `changed`, `dryRun`,
`operations` (the operation count) and compiled `stats`. `changes` is grouped
per collection: `nodes`, `geometries`, `materials`, `parameters` and
`dependencies` each list `added`, `updated` and `removed` IDs, and `metadata`
lists the changed metadata fields (`name`, `category`, `description`). A dry run
keeps the current `revision` and `stateHash` and reports the proposal. A
`restore` result has `restoredFrom` and no `changes`. An operation that fails
while it is applied reports its zero-based `details.operationIndex` and
`details.operation`; failures found by the final validation of the whole result
(for example, a removed geometry or dependency that is still referenced) carry no
index.

A bundle around the crate: export it as a portable model, add it as a frozen
dependency and instantiate it twice.

```sh
bin/model-forge -d "$OUT/crate.model.json" export --format model --out "$OUT/crate.portable.model.json"
bin/model-forge create "$OUT/stack.model-bundle.json" --id stack --name "Crate stack"
bin/model-forge -d "$OUT/stack.model-bundle.json" dependency put --file "$OUT/crate.portable.model.json" --expected-revision 0
bin/model-forge -d "$OUT/stack.model-bundle.json" apply --expected-revision 1 --data '{"operations": [
  {"op": "putNode", "node": {"id": "bottom", "type": "model", "model": "crate"}},
  {"op": "putNode", "node": {"id": "top", "type": "model", "model": "crate", "transform": {"position": [0, 0.45, 0], "rotation": [0, 15, 0]}}}
]}'
bin/model-forge -d "$OUT/stack.model-bundle.json" inspect
```

### Outputs

| Command | Options and behavior |
|---|---|
| `review --out <directory>` | Renders in one headless Chromium session: one PNG per view, `contact-sheet.png` (`--no-contact-sheet` skips it), `review.json` (`review-result` v1 with `provenance.tool: "model-forge"`, the document `revision`, `sourceStateHash`, camera settings and frame hashes) and `replay-plan.json` with fixed cameras. Views from `--views <names>` (default `iso,front,right,back,left,top`) or `--turntable <2–36>` with `--elevation`; `--width`/`--height` (64–2048, default 800×600), `--projection auto\|perspective\|orthographic`, `--padding`, `--grid`, `--wireframe`, `--parameters <json>`, `--background #rrggbb`. `--file <plan>` (`schema --kind review`, for example a `replay-plan.json`) replaces the view and frame flags. A non-empty directory fails with `ALREADY_EXISTS` unless `--overwrite` |
| `preview --out <file.html>` | A self-contained, offline, read-only orbit page; `--parameters <json>`. No Playwright needed |
| `audit` | Policy from `--file`/`--data` (`schema --kind quality-policy`; defaults when absent), `--parameters <json>`, `--strict`. Geometry and material budgets of the visible deliverable; failures return `QUALITY_GATE_FAILED` |
| `export --format <format> --out <file>` | `-f, --format` (default `glb`), `--validate` (Khronos validation; GLB/glTF only), `--parameters <json>` (rendered formats and Littlewild; `model` and `model-bundle` stay parametric and refuse it). The output may not be the document or its side files (`INVALID_PATH`). Littlewild only: `--family items\|buildings\|creatures\|pets` (default `items`), `--variant` (default `world`), `--name` (default the model name), `--materials <json>`, `--check` and `--dry-run`; these flags fail with `INVALID_OPTION` for other formats |

```sh
bin/model-forge doctor
bin/model-forge -d "$OUT/crate.model.json" review --out "$OUT/review-r4" --background '#202830'
bin/model-forge -d "$OUT/crate.model.json" review --out "$OUT/review-r4-replay" --file "$OUT/review-r4/replay-plan.json"
bin/model-forge -d "$OUT/stack.model-bundle.json" review --out "$OUT/stack-turntable" --turntable 8 --no-contact-sheet
bin/model-forge -d "$OUT/crate.model.json" preview --out "$OUT/crate.html"
bin/model-forge -d "$OUT/crate.model.json" export --format glb --validate --out "$OUT/crate.glb"
```

## Outputs and consumers

| `export --format` | Writes | Consumed by |
|---|---|---|
| `model` | The entry model as a portable `model` document without `revision` | `scene-forge model import --file`; another Model Forge document via `import` or `dependency put` |
| `model-bundle` | Entry model plus the dependency closure it instantiates, without `revision`; unused dependencies are left out | `scene-forge -p <project> model import --file <file>` (`--dry-run` first; `--replace` with `--expected-revision`/`--expected-state` to change an existing registered model); `model-forge import` |
| `littlewild` | A Littlewild `definition.json` written through the same kernel writer as Scene Forge. The output must be `<target>/<family>/<id>/definition.json` (otherwise `LITTLEWILD_EXPORT`); the directory names give the definition ID. Only the `visual` facet's selected variant is replaced; other variants, rig metadata, gameplay and other facets are retained | Wildlands game folders (`docs/concepts/<id>/assets/<family>/<id>/definition.json`), `wildlands creature attach-visual`, `bin/wildlands validate-game` |
| `glb`, `gltf` | glTF 2.0 with PBR materials, skins and rotation clips | Engines and DCC tools; `--validate` runs the Khronos validator |
| `obj`, `stl`, `three` | Mesh interchange and Three.js JSON | DCC tools, 3D printing, three.js `ObjectLoader` |

Every export result reports `path`, `format`, the source `revision` and
`sourceStateHash`; rendered formats add `bytes`, `stats`, `warnings` and, with
`--validate`, the validator report. Review evidence (`review.json`) is a `review-result` v1
manifest that the Wildlands `storyboard` command can compose with other tools'
evidence.

Hand a model to Scene Forge:

```sh
bin/model-forge -d "$OUT/crate.model.json" export --format model-bundle --out "$OUT/crate.model-bundle.json"
bin/scene-forge init "$OUT/garage" --name Garage
bin/scene-forge -p "$OUT/garage" model import --file "$OUT/crate.model-bundle.json" --dry-run
bin/scene-forge -p "$OUT/garage" model import --file "$OUT/crate.model-bundle.json"
```

Refine a Littlewild visual and attach it to an engine project without losing
gameplay. Work on a copy laid out as `<family>/<id>/definition.json`, so that
export merges into the original complete definition:

```sh
mkdir -p "$OUT/assets/creatures/sproutling"
cp docs/concepts/littlewild/assets/creatures/sproutling/definition.json "$OUT/assets/creatures/sproutling/definition.json"
bin/model-forge import --from "$OUT/assets/creatures/sproutling/definition.json" --variant world --out "$OUT/sproutling-world.model.json"
bin/model-forge -d "$OUT/sproutling-world.model.json" node edit --ids ear-left,ear-right --data '{"transform": {"scale": [1, 1.15, 1]}}' --expected-revision 0
bin/model-forge -d "$OUT/sproutling-world.model.json" validate
bin/model-forge -d "$OUT/sproutling-world.model.json" export --format littlewild --family creatures --variant world --name Sproutling --out "$OUT/assets/creatures/sproutling/definition.json" --dry-run
bin/model-forge -d "$OUT/sproutling-world.model.json" export --format littlewild --family creatures --variant world --name Sproutling --out "$OUT/assets/creatures/sproutling/definition.json"
bin/model-forge -d "$OUT/sproutling-world.model.json" export --format littlewild --family creatures --variant world --name Sproutling --out "$OUT/assets/creatures/sproutling/definition.json" --check
bin/wildlands create --game docs/concepts/littlewild --output "$OUT/game.project.json"
FINGERPRINT="$(bin/wildlands creature list --project "$OUT/game.project.json" | node -p 'JSON.parse(require("fs").readFileSync(0, "utf8")).fingerprint')"
bin/wildlands creature attach-visual --project "$OUT/game.project.json" --archetype sproutling --file "$OUT/assets/creatures/sproutling/definition.json" --expected-fingerprint "$FINGERPRINT" --dry-run
bin/wildlands creature attach-visual --project "$OUT/game.project.json" --archetype sproutling --file "$OUT/assets/creatures/sproutling/definition.json" --expected-fingerprint "$FINGERPRINT" --output "$OUT/game-v2.project.json"
```

`--dry-run` compiles and compares without writing (`changed`, `written: false`
and `warnings`, for example retained variants that now use re-exported
materials); `--check` fails with `LITTLEWILD_STALE` when a write would change the
file, so it passes only once the definition is current. Pass `--name` to keep the
definition's display name; it defaults to the model name, which a Littlewild
import sets to `<name> (<variant>)`. A Littlewild round trip normalizes the
selected variant through the kernel writer, so even an unedited re-export can
differ from a hand-written source: read the `--dry-run` result before writing.

Scene-wide Littlewild synchronization from a manifest (`littlewild sync`) and the
Pocket Pet assets stay in Scene Forge; see
[Author Littlewild assets in Scene Forge](../how-to/scene-forge-littlewild-assets.md).

## Error codes

Read `error.code`, then `error.hint` (the remedy) and `error.details`.
`discover` publishes the same table from `source/model-forge/src/domain/errors.ts`.

| Area | Code | Meaning and remedy |
|---|---|---|
| Input | `CLI_USAGE`, `INVALID_OPTION` | Unknown command, missing argument, or an invalid flag value or combination; run `describe <command path>` |
| | `INPUT_REQUIRED` | Supply exactly one of `--file <path\|->` or `--data <json>` (or a field for `metadata set`) |
| | `INPUT_TOO_LARGE` | A JSON input exceeds 16 MiB; split the recipe into smaller reusable models |
| | `JSON_INVALID`, `JSON_READ_FAILED` | Malformed JSON, or an unreadable input file |
| | `SCHEMA_INVALID`, `UNKNOWN_SCHEMA` | The data violates the schema (repair the reported paths), or `schema --kind` names an unknown contract |
| | `UNKNOWN_OPERATION` | Not a model operation; scene-only operations name their model equivalent in the message |
| Document | `DOCUMENT_REQUIRED` | The command needs `-d, --document <path>` |
| | `DOCUMENT_NOT_FOUND` | `-d` does not name an existing file; `create` or `import --out` one |
| | `DOCUMENT_EXISTS` | `create`, `import` and `example create` never overwrite; choose a new path |
| | `DOCUMENT_LOCKED` | Another writer holds `<document>.lock`; retry after it finishes, and remove a lock only after verifying no writer is running |
| | `DOCUMENT_KIND` | The path is not `<id>.model.json`/`<id>.model-bundle.json`, a nesting model needs a bundle, or a dependency operation needs a bundle |
| | `DEPENDENCY_READONLY` | An edit would change a frozen bundle dependency; edit it in its own document and `putDependency` with `replace: true` |
| | `HISTORY_NOT_FOUND` | `restore` names a revision without a history snapshot; run `history` |
| Guards | `REVISION_CONFLICT`, `STATE_CONFLICT` | The document, model or dependencies changed since the read; inspect again and rebase the batch |
| | `GUARD_REQUIRED` | `restore` needs `--expected-revision <current>` |
| | `GUARD_MISMATCH` | The command-line guard and the batch guard disagree; use one, or the same value |
| References and structure | `NOT_FOUND`, `REFERENCE_MISSING`, `DUPLICATE_ID`, `ID_MISMATCH` | A missing node, geometry, material, parameter or dependency; an ID already in use; a bundle model not keyed by its own ID |
| | `CYCLE`, `DEPTH_LIMIT`, `HAS_CHILDREN` | A circular parent or model reference; nesting too deep; removing a node with children without `--cascade` |
| | `EMPTY_SELECTION`, `INVALID_NODE_TYPE` | A selector matched nothing; the command needs another node type (rigs bind to model-instance nodes) |
| Parameters and patterns | `UNKNOWN_PARAMETER`, `PARAMETER_MISSING`, `PARAMETER_RANGE`, `PARAMETER_INTEGER` | Unknown override, undeclared `$param`, a value outside `min`/`max`, or a fraction for an integer parameter |
| | `PATTERN_PATH`, `PATTERN_COUNT` | Degenerate path for yaw orientation; counts that are not positive integers or exceed 256 copies |
| Rigs | `RIG_INVALID`, `RIG_BINDING`, `RIG_MISSING` | Invalid rig document; wrong mesh binding path (use `rig inspect`); posing without a bound rig |
| Paths and projects | `INVALID_PATH` | An export or review output would replace the document, its lock or its history, or a project path escapes its project |
| | `PROJECT_NOT_FOUND`, `PROJECT_LOCKED` | `import --project` names no Scene Forge project, or a Scene Forge command is writing it |
| Littlewild | `LITTLEWILD_IMPORT` | The source is not a `littlewild-definition`, `littlewild-creature-package` or `littlewild-3d-asset` |
| | `LITTLEWILD_EXPORT` | The output is not `<target>/<family>/<id>/definition.json` for the same family and ID |
| | `LITTLEWILD_STALE` | `--check` found that the definition differs; export without `--check` |
| Outputs | `EXPORT_INVALID` | Khronos validation failed; nothing was written |
| | `QUALITY_GATE_FAILED` | `audit` findings; repair the listed geometry or budgets |
| | `ALREADY_EXISTS` | A review directory is not empty; choose a new one or pass `--overwrite` deliberately |
| | `INVALID_CAMERA` | Use a named view, an orbit or a fixed camera from a replay plan |
| Runtime | `BROWSER_UNAVAILABLE`, `PLAYWRIGHT_UNAVAILABLE`, `RENDER_FAILED` | Review cannot launch Chromium, cannot resolve Playwright (`details.remedies`), or rendering failed; run `doctor` |
| | `BUILD_REQUIRED` | A source run is missing built assets; run `npm run build` in `source/model-forge` or use `bin/model-forge` |
| | `INTERNAL_ERROR` | An unexpected failure; report the message, since retrying the same input fails the same way |

## Limits

`discover` reports the limits of the installed build: 16 MiB per JSON input,
10,000 authored nodes per model, 10,000 operations per batch, 20,000 expanded
objects, 2,000,000 triangles, 256 pattern copies, model nesting depth 16 and 64
rig joints, plus the Littlewild per-mesh, per-definition and engine JSON
value/depth budgets. Not supported, as in Scene Forge: inverse kinematics,
weight painting, sculpting, external image textures and automatic UV
unwrapping, physics, native `.blend`/`.tscn` output, arbitrary scripts or GLSL.
Identical documents produce identical exports with the same build;
pixel-identical reviews across machines are not promised. Structural validity
and automated reviews are not human visual or usability validation.

## Rebuild and verify the executable

`bin/model-forge` is generated from `source/model-forge` and must be committed
with every source change. Never edit it by hand.

```text
cd source/model-forge
npm ci
npm run format:check && npm run architecture:check && npm run check && npm test
npm run build:cli    # rewrites ../../bin/model-forge
npm run check:cli    # rebuilds into a temporary directory; exits 1 if the checked-in file differs
FORGE_CHROMIUM_PATH=/path/to/chromium npm run test:e2e
```

`npm run verify` runs the formatting, architecture, type, unit, `check:cli` and
end-to-end checks in order. A kernel change also changes Scene
Forge's bundle: rebuild and check `bin/scene-forge` in `source/scene-forge` and
commit both executables together. CI runs `.github/workflows/model-forge.yml`
for Model Forge and `.github/workflows/scene-forge.yml` whenever the kernel
changes.

## Further reading

- [Model Forge README](../../source/model-forge/README.md) and
  [AGENTS.md](../../source/model-forge/AGENTS.md): the source project, its
  layering and code-change rules.
- [Scene Forge CLI](scene-forge-cli.md): projects, scene composition, the model
  registry and scene-wide Littlewild sync.
- [Wildlands CLI](wildlands-cli.md): `creature attach-visual`, game folders and
  `storyboard`.
- [Character Studio CLI](character-studio-cli.md) and the
  [complete agent workflow](../how-to/character-agent-workflow.md).
- [Checked-in command-line tools](../../bin/README.md).
