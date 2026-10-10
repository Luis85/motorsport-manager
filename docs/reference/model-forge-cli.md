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
| Discovery, document lifecycle, inspection, editing, history, audit, preview, export, procedural generation | everything except reviews | Node.js 22 or newer |
| Image review | `review`, `generate --review`, `variants --review` | Node.js 22+, the `playwright` package and a Chromium build Playwright can launch |
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
nonnegative integer. Revision 0 is written as **no field**: `create`, `import`
and `example create` write none, the first committed edit writes `revision: 1`,
and a hand-written `revision: 0` is read as absent. Equal content therefore has
one `stateHash`, the same as Scene Forge computes for the plain model, whether or
not a file spells out revision 0. Portable `export --format model` and
`model-bundle` outputs omit the field, and `scene-forge model import` drops it
from a raw document with a warning, so importing a document or its portable
export gives the same project state.

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
atomically. A writer records its `pid`, `hostname` and `createdAt` in the lock and
removes the lock only while it is still its own. A second writer fails with
`DOCUMENT_LOCKED` and these `details`, plus `stale: true` when the holder process
no longer runs on this host (a crashed writer). Model Forge never removes a lock
by itself: delete a stale lock only after verifying that no writer is running.
A history snapshot is never replaced; if `<revision>.json` already exists for the
current revision, the write fails with `HISTORY_CONFLICT` and changes nothing.

**Scene Forge projects are read-only.** A document inside a Scene Forge project
(any ancestor directory holding `forge.project.json`) can be read, validated,
reviewed and exported elsewhere, but every write, every new document (`create`,
`import --out`, `example create`) and every `model`/`model-bundle` export there
fails with `PROJECT_MODEL_READONLY`. Its `hint` names the supported route: `import
--project <dir> --id <id> --out <new document>`, edit the copy, `export --format
model-bundle`, then `scene-forge model import --replace` with
`--expected-revision` or `--expected-state`. `stateHash` is the SHA-256 of the canonical JSON of
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
7. Never edit a model registered inside a Scene Forge project in place (Model
   Forge refuses with `PROJECT_MODEL_READONLY`). Import a copy, export a
   `model-bundle` and import it with Scene Forge's guarded `model import`.
8. Every error carries `hint`, the remedy for that failure in its context (for
   example "choose another node ID" for a taken ID); `discover` lists the general
   remedy of each code.

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
| `discover` (alias `catalog`) | Workflow steps, commands, document kinds, operations (and scene-only operations with their model equivalents), schemas, geometry types, patterns, lights, expressions, rigging, review views, imports, the `procedural` section (generators, presets, commands, outputs, limits and one-command examples), exports, Littlewild families, conventions, limits and error codes with remedies |
| `describe [path...]` | Arguments, flags, defaults and choices of a command subtree |
| `schema [--kind <kind>] [--raw]` | JSON Schema for `batch` (default), `model`, `model-bundle`, `operation`, `node`, `node-patch`, `geometry`, `material`, `parameter`, `rig`, `pattern`, `selector`, `scalar`, `review`, `camera`, `camera-snapshot`, `quality-policy`, `littlewild-asset`, `scatter`, `generator-recipe` or `model-variants` |
| `doctor` | Node, Playwright and Chromium availability (`reviewReady`) |
| `example list` | Bundled examples with kind, file name and dependencies |
| `example show <id> [--raw]` | One example document; `--raw` prints the bare document for saving or piping |
| `example create <id> <path>` | Write an example as a new document; a nesting example needs a `.model-bundle.json` path |

### Lifecycle

`create`, `import` and `example create` never overwrite an existing file or an
orphaned `<document>.history` directory (`DOCUMENT_EXISTS`; `import --dry-run`
checks the same), never write into a Scene Forge project
(`PROJECT_MODEL_READONLY`), and add a `warnings` entry when the file name is not
`<model id>.model.json` (or `.model-bundle.json`).

| Command | Options and behavior |
|---|---|
| `create <path>` | `--id`, `--name` (both required), `--category`, `--description`, `--example <id>` (start from a bundled example under the new ID and metadata; its dependencies stay frozen). Writes a new document at revision 0 (no `revision` field); the path suffix selects `model` or `model-bundle` |
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
| `history` | Stored revisions with their `stateHash` and snapshot path, plus the current revision. An unreadable snapshot is listed with `error` (`code`, `message`) instead of a `stateHash`; the other revisions stay listed |
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
| `remove <id>` | Remove a node; `--cascade` also removes its descendants (otherwise a node with children fails with `HAS_CHILDREN`). Geometries and materials are removed through `apply` (`removeGeometry`/`removeMaterial`; an ID the model does not define fails with `NOT_FOUND`, one only a frozen dependency defines with `DEPENDENCY_READONLY`) |
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
| `dependency remove <id>` | Bundle only: remove a dependency no node instantiates; otherwise `DEPENDENCY_IN_USE` names the instancing nodes (`details.nodes`) and dependencies (`details.dependencies`) |
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
`details.operation` (the kernel's own details move to `details.cause`); this
includes a taken node ID (`DUPLICATE_ID`), a missing geometry or material to
remove, a dependency still in use and a `putParameter` default outside its range
(`PARAMETER_RANGE`, `PARAMETER_INTEGER`). Failures found by the final validation
of the whole result (for example, a removed geometry that is still referenced)
carry no index. `--expected-state` must be the 64-digit hex `stateHash`;
anything else fails with `INVALID_OPTION` before the document is read.

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

Outputs never silently replace a file: `export` and `preview` fail with
`ALREADY_EXISTS` when the output exists unless `--overwrite` is passed, and
`review` does the same for a non-empty directory. No output may replace the
source document, any `*.lock` file or anything inside a `*.history` directory,
even with `--overwrite` (`INVALID_PATH`). `export --format littlewild` is the
exception by contract: it merges into an existing `definition.json` (and refuses
`--overwrite`).

| Command | Options and behavior |
|---|---|
| `review --out <directory>` | Renders in one headless Chromium session: one PNG per view, `contact-sheet.png` (`--no-contact-sheet` skips it), `review.json` (`review-result` v1 with `provenance.tool: "model-forge"`, top-level `scene` set to the model ID and `revision` to the document revision, `target` with the document path, model, revision and parameters, `sourceStateHash`, camera settings and frame hashes) and `replay-plan.json` with fixed cameras. Views from `--views <names>` (default `iso,front,right,back,left,top`) or `--turntable <2–36>` with `--elevation`; `--width`/`--height` (64–2048, default 800×600), `--projection auto\|perspective\|orthographic`, `--padding`, `--grid`, `--wireframe`, `--parameters <json>`, `--background #rrggbb`. `--file <plan>` (`schema --kind review`, for example a `replay-plan.json`) replaces the view and frame flags. A non-empty directory fails with `ALREADY_EXISTS` unless `--overwrite` |
| `preview --out <file.html>` | A self-contained, offline, read-only orbit page; `--parameters <json>`, `--overwrite`. No Playwright needed |
| `audit` | Policy from `--file`/`--data` (`schema --kind quality-policy`; defaults when absent), `--parameters <json>`, `--strict`. Geometry and material budgets of the visible deliverable; failures return `QUALITY_GATE_FAILED` |
| `export --format <format> --out <file>` | `-f, --format` (default `glb`), `--validate` (Khronos validation; GLB/glTF only), `--parameters <json>` (rendered formats and Littlewild; `model` and `model-bundle` stay parametric and refuse it), `--overwrite` (not Littlewild). `model` and `model-bundle` exports into a Scene Forge project fail with `PROJECT_MODEL_READONLY`. Littlewild only: `--family items\|buildings\|creatures\|pets` (default: the `<family>` directory of the `--out` path, else `items`), `--variant` (default `world`), `--name` (default: the existing definition's name, else the model name), `--materials <json>`, `--check` and `--dry-run`; these flags fail with `INVALID_OPTION` for other formats, naming each flag as typed |

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
| `littlewild` | A Littlewild `definition.json` written through the same kernel writer as Scene Forge. The output must be `<target>/<family>/<id>/definition.json` (otherwise `LITTLEWILD_EXPORT`); the directory names give the definition ID and, by default, the family. Only the `visual` facet's selected variant is replaced; other variants, rig metadata, gameplay and other facets are retained, and unchanged parts of the variant keep their source representation (see below) | Wildlands game folders (`docs/concepts/<id>/assets/<family>/<id>/definition.json`), `wildlands creature attach-visual`, `bin/wildlands validate-game` |
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
export merges into the original complete definition. The first `--check`, before
any edit, passes: an unedited import re-exports byte-identically.

```sh
mkdir -p "$OUT/assets/creatures/sproutling"
cp docs/concepts/littlewild/assets/creatures/sproutling/definition.json "$OUT/assets/creatures/sproutling/definition.json"
bin/model-forge import --from "$OUT/assets/creatures/sproutling/definition.json" --variant world --out "$OUT/sproutling-world.model.json"
bin/model-forge -d "$OUT/sproutling-world.model.json" export --format littlewild --variant world --out "$OUT/assets/creatures/sproutling/definition.json" --check
bin/model-forge -d "$OUT/sproutling-world.model.json" node edit --ids ear-left,ear-right --data '{"transform": {"scale": [1, 1.15, 1]}}' --expected-revision 0
bin/model-forge -d "$OUT/sproutling-world.model.json" validate
bin/model-forge -d "$OUT/sproutling-world.model.json" export --format littlewild --family creatures --variant world --out "$OUT/assets/creatures/sproutling/definition.json" --dry-run
bin/model-forge -d "$OUT/sproutling-world.model.json" export --format littlewild --family creatures --variant world --out "$OUT/assets/creatures/sproutling/definition.json"
bin/model-forge -d "$OUT/sproutling-world.model.json" export --format littlewild --family creatures --variant world --out "$OUT/assets/creatures/sproutling/definition.json" --check
bin/wildlands create --game docs/concepts/littlewild --output "$OUT/game.project.json"
FINGERPRINT="$(bin/wildlands creature list --project "$OUT/game.project.json" | node -p 'JSON.parse(require("fs").readFileSync(0, "utf8")).fingerprint')"
bin/wildlands creature attach-visual --project "$OUT/game.project.json" --archetype sproutling --file "$OUT/assets/creatures/sproutling/definition.json" --expected-fingerprint "$FINGERPRINT" --dry-run
bin/wildlands creature attach-visual --project "$OUT/game.project.json" --archetype sproutling --file "$OUT/assets/creatures/sproutling/definition.json" --expected-fingerprint "$FINGERPRINT" --output "$OUT/game-v2.project.json"
```

`--dry-run` compiles and compares without writing (`changed`, `written: false`
and `warnings`, for example retained variants that now use re-exported
materials); `--check` fails with `LITTLEWILD_STALE` when a write would change the
file, so it passes only once the definition is current. The display name stays
the existing definition's unless `--name` replaces it (a new definition takes the
model name, which a Littlewild import sets to `<name> (<variant>)`).

Littlewild export is **lossless for unchanged content**, in Model Forge and in
Scene Forge's `littlewild export` and `littlewild sync` alike. Where a
re-exported node, material or mesh is semantically unchanged, the definition
keeps its own representation: node key order, explicit zero transforms and empty
`children`, shared string material references and per-node `materialProps`,
mesh resource names, engine-only node fields the recipe cannot express (for
example `castShadow: false` or `receiveShadow: false`), palette entries and
meshes no variant references, and the file's layout (indented arrays, or plain or
ASCII-escaped `JSON.stringify` output). Only edited fields take the exporter's
normalized form: in the example above the definition gains exactly the two ear
`scale` arrays. A changed material is written in full and shared by every
variant that names it (the result's `warnings` lists retained variants that now
use it). Every variant of every `definition.json` under `docs/concepts` round-trips
unedited through both tools (`tests/littlewild-roundtrip.test.ts` in each project).
A new definition is written in canonical form. Both tools share the writer, its
`--family`/`--name` defaults and this contract, so they write identical bytes for
the same model, whether the definition is new or merged.

Scene-wide Littlewild synchronization from a manifest (`littlewild sync`) and the
Pocket Pet assets stay in Scene Forge; see
[Author Littlewild assets in Scene Forge](../how-to/scene-forge-littlewild-assets.md).

## Procedural generation

Model Forge can start a document from a **generator** instead of an empty
model, write seeded **variants** of any document, and **scatter** copies or
instances over an area of a document. Everything is deterministic: the forge
keyed PRNG v1 (the same algorithm as the Wildlands generators) is the only source
of randomness, no command reads the clock, and every number a generator writes is
rounded to 1e-4. The same generator version, seed and parameters give the same
document bytes on every run (`tests/generate.test.ts` pins one golden SHA-256 per
generator). Outputs are bounded and guarded like every other write: nothing is
replaced, `--dry-run` writes nothing, documents inside a Scene Forge project are
refused (`PROJECT_MODEL_READONLY`), and results carry `seed`, `recipeHash`,
`documents` (path, ID, `stateHash`, statistics) and `nextCommands`.

### Generators

A generated document is an ordinary `kind: "model"` document. Its main
dimensions are **model parameters** (`$param`), so it stays editable with every
other command, `inspect --parameters` and `variants`, and Scene Forge can set
them per instance. Bold presets are the defaults.

| Generator | Presets | Builds | Model parameters |
|---|---|---|---|
| `rock` | `pebble`, **`stone`**, `boulder` | A seeded displaced icosphere mesh with flat chiseled faces and a flat base on y = 0 | `size`, `height`, `stretch` |
| `tree` | **`deciduous`**, `conifer`, `palm`, `dead` | A low-poly tree rooted at the origin: clumped crown, stacked cones, curved trunk with drooping fronds, or bare branches | `height`, `canopy` (not `dead`) |
| `bush` | **`round`**, `hedge`, `flowering` | Overlapping foliage clumps on y = 0; a hedge wears them around a block; blossoms optional | `size`, `height`, `length` |
| `crate` | **`wooden`**, `military`, `small` | Inset panels with plank grooves, twelve edge beams, optional grips | `width`, `height`, `depth`, `frame` |
| `barrel` | **`wooden`**, `oil`, `rusty` | A lathe-turned body with a recessed lid, a rim, hoops or drum ribs and a filler cap | `radius`, `height`, `bulge` |
| `fence` | **`picket`**, `ranch`, `palisade` | A straight run along X, centered: posts as a linear pattern, rails, pickets | `posts` (integer), `spacing`, `height` |
| `building` | **`cottage`**, `townhouse`, `warehouse` | Windows as storey-by-bay grid patterns on all four walls, a door, plinth and eave band, and a gable roof extruded from its profile (or a flat roof) | `floors`, `bays` (integers), `floorHeight`, `bayWidth`, `depth`, `roofHeight` |
| `terrain` | `plains`, **`hills`**, `mountains`, `island`, `dunes` | A heightfield tile from the kernel terrain presets, vertex-colored by height; the seed shapes the noise | `width`, `depth`, `amplitude` |

Generator parameters (the inputs, listed by `generate show`) and model
parameters (in the output) are different things: generator parameters such as
`kind`, `detail`, `tiers` or the colors decide the structure, and model
parameters keep the dimensions adjustable afterwards. Each generator has a
triangle budget (`limits.maxTriangles`); output above it fails with
`PROCEDURAL_BUDGET`.

### Procedural commands

| Command | Options and behavior |
|---|---|
| `generate list` (or `generate`) | Every generator with its presets, limits and a one-command example |
| `generate show <generator>` | `parameterSchema` (JSON Schema of the generator parameters), `defaults`, `presets` with their complete values, `limits`, the seed range and example commands. An unknown name fails with `GENERATOR_NOT_FOUND` (`details.available`) |
| `generate <generator> --out <new.model.json>` | `--preset <name>`, `--seed <0..4294967295>` (default 1), `--set <name=value>` (repeatable; a value is read as JSON when it parses, else as text), `--file`/`--data` (a generator recipe), `--id` and `--name` (defaults: the `--out` name and `<Preset> <generator>`), `--count <1-64>` (then `--out` is a new directory of `<id>-01.model.json`, ... with seeds seed, seed + 1, ...), `--review <new directory>` and `--dry-run`. Values layer as defaults, then the preset, then the recipe, then `--set`; an unknown name fails with `UNKNOWN_PARAMETER`, a value out of range with `SCHEMA_INVALID`, and an unknown `--preset` with `INVALID_OPTION` (`details.available`) |
| `-d <doc> variants` | `--count <1-64>` (required), `--seed` (default 1), `--vary <parameter=min..max>` (repeatable), `--materials <material=#rrggbb,#rrggbb>` (repeatable), `--out <new directory>` (required), `--review`, `--dry-run`. Writes `<id>-01`, ... documents of the source's kind (a bundle keeps its frozen dependencies) and `variants.json` |
| `-d <doc> scatter` | A scatter recipe from `--file`/`--data` (`schema --kind scatter`), or flags: `--node <ids>` (template nodes of the document to copy) or `--model <ids>` (dependency models to instance), each `id` or `id:weight`; one of `--spacing <m>` (Poisson), `--grid <m>` (with `--jitter`) or `--count <n>` (uniform); `--area rect:x0,z0,x1,z1 \| circle:x,z,r \| polygon:x,z;x,z;...` (default: the model's XZ footprint), `--exclude <area>` (repeatable), `--avoid <ids> --margin <m>`, `--on <terrain node>` with `--sink` and `--max-slope`, `--scale`, `--yaw` and `--tilt` as `min..max`, `--max <n>`, `--seed`, `--group <id>` (default `scatter`), `--parent <id>`. `--dependency <file>` (repeatable) adds the models of a model or model-bundle file as frozen dependencies in the same edit; `--replace` replaces an existing group; `--allow-empty` accepts a scatter that places nothing. A recipe and placement flags together fail with `INVALID_OPTION` |

`generate` writes a **generator recipe** beside every document,
`<id>.generate.json` (`kind: "generator-recipe"`, `schema --kind
generator-recipe`), with the generator version, seed, preset, ID, name and
every parameter resolved. `generate <generator> --file <id>.generate.json --out
<new document>` rebuilds the same bytes; a recipe written by another generator
version still runs and reports a warning. Every path (documents, recipes and
the review directory) is checked before anything is written: an existing
document fails with `DOCUMENT_EXISTS`, an existing recipe file or a non-empty
`--out`/`--review` directory with `ALREADY_EXISTS`.

`variants` samples each `--vary` parameter uniformly inside the given range,
which must lie inside the parameter's declared `min`..`max` with min <= max;
integer parameters take whole numbers, and a range without one fails like a
widened range with `VARIANT_RANGE` (`details.declared`). Each `--materials`
entry picks one color per variant. Variant *i* draws from its own keyed stream,
so the first variants of a larger run are the same documents. `variants.json`
(`kind: "model-variants"`) records the source `stateHash`, seed, ranges, colors
and every variant's values and `stateHash`.

`--review` renders every document in **one** headless Chromium session: a
lineup scene with one fixed-camera frame per document (at most 36), all framed
at one common size so that size differences show, plus `contact-sheet.png`,
`review.json` and `replay-plan.json`. A single generated document gets `iso`,
`front`, `right` and `top` views instead. `generate` writes the review to the
`--review` directory; `variants` writes it to `<out>/review`.

`scatter` runs the kernel planner on the document's model with its frozen
dependencies (plus `--dependency` models) as the model library, and commits the
plan as one guarded edit exactly like `apply`: `--dry-run`, `--expected-revision`,
`--expected-state`, a history snapshot and an atomic write. The plan is made from
the document read under its lock. The result adds `placement` (`seed`,
`recipeHash`, `group`, `placed`, `candidates` and `rejected` counts by
`outside`, `exclusion`, `slope` and `budget`) and the normalized `recipe`, which
replays the same plan with `--file`. The group node is tagged `scatter` and
`scatter:<first 8 recipeHash digits>`; placements are `<group>-1`, `<group>-2`,
... Template copies are made visible, so a hidden template stays a template.
Instancing models needs a `model-bundle` document: convert a model once with
`import --from <doc> --out <id>.model-bundle.json`. A taken group fails with
`DUPLICATE_ID` (pass `--replace`), and nothing placed with `SCATTER_EMPTY`
(`details.rejected`). Grounding follows the terrain's translation, yaw and
uniform scale only (`TERRAIN_TRANSFORM`); placements and candidates are bounded
(`PROCEDURAL_BUDGET`).

Generate, replay and review:

```sh
bin/model-forge generate list
bin/model-forge generate show tree
bin/model-forge generate tree --preset palm --seed 3 --out "$OUT/palm.model.json" --review "$OUT/palm-review"
bin/model-forge generate tree --file "$OUT/palm.generate.json" --out "$OUT/replay/palm.model.json"
cmp "$OUT/palm.model.json" "$OUT/replay/palm.model.json"
bin/model-forge generate rock --preset boulder --count 4 --seed 10 --out "$OUT/boulders" --review "$OUT/boulders-review"
bin/model-forge generate building --preset townhouse --set floors=4 --set roofColor=#2f3a44 --out "$OUT/townhouse.model.json" --dry-run
bin/model-forge -d "$OUT/palm.model.json" variants --count 6 --seed 2 --vary height=5..9 --materials frond=#5f9a3c,#7aa04a --out "$OUT/palms" --review
bin/scene-forge -p "$OUT/garage" model import --file "$OUT/palm.model.json" --dry-run
```

Scatter trees and stones over a generated terrain, first with flags, then with a
recipe file:

```sh
bin/model-forge generate terrain --preset hills --seed 4 --set width=40 --set depth=40 --set amplitude=4 --out "$OUT/meadow.model.json"
bin/model-forge generate tree --seed 5 --out "$OUT/oak.model.json"
bin/model-forge generate rock --seed 6 --out "$OUT/stone.model.json"
bin/model-forge import --from "$OUT/meadow.model.json" --out "$OUT/glade.model-bundle.json"
bin/model-forge -d "$OUT/glade.model-bundle.json" scatter --group trees --model oak --dependency "$OUT/oak.model.json" --spacing 7 --on terrain --scale 0.7..1.2 --dry-run
bin/model-forge -d "$OUT/glade.model-bundle.json" scatter --group trees --model oak --dependency "$OUT/oak.model.json" --spacing 7 --on terrain --scale 0.7..1.2 --expected-revision 0
bin/model-forge -d "$OUT/glade.model-bundle.json" scatter --file source/model-forge/examples/recipes/stones.scatter.json --dependency "$OUT/stone.model.json" --expected-revision 1
bin/model-forge -d "$OUT/glade.model-bundle.json" review --out "$OUT/glade-review" --views iso,top
bin/model-forge -d "$OUT/glade.model-bundle.json" export --format glb --validate --out "$OUT/glade.glb"
```

The recipe, `source/model-forge/examples/recipes/stones.scatter.json`, keeps a
clearing free and grounds slightly tilted, varied stones on the terrain:

```text
{"schemaVersion": 1, "kind": "scatter", "seed": 2, "group": "stones",
 "area": {"type": "rect", "min": [-18, -18], "max": [18, 18]},
 "exclude": [{"type": "circle", "center": [0, 0], "radius": 4}],
 "distribution": {"type": "poisson", "minDistance": 2.5},
 "items": [{"model": "stone", "vary": {"size": [0.3, 0.8]}}],
 "rotation": {"tilt": [-8, 8]},
 "ground": {"mode": "terrain", "node": "terrain", "sink": 0.05}}
```

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
| | `DOCUMENT_NOT_FOUND` | `-d` does not name an existing file (or names a directory); `create` or `import --out` one |
| | `DOCUMENT_EXISTS` | `create`, `import` and `example create` never overwrite a document or an orphaned history directory; choose a new path |
| | `DOCUMENT_LOCKED` | Another writer holds `<document>.lock`; `details` has the holder `pid`, `hostname`, `createdAt` and `stale`. Retry after it finishes; remove a stale lock only after verifying no writer is running |
| | `PROJECT_MODEL_READONLY` | The document or new document is inside a Scene Forge project; import a copy with `import --project`, edit it, export a `model-bundle` and use `scene-forge model import --replace` with its guards |
| | `DOCUMENT_KIND` | The path is not `<id>.model.json`/`<id>.model-bundle.json`, a nesting model needs a bundle, or a dependency operation needs a bundle |
| | `DEPENDENCY_READONLY` | An edit would change a frozen bundle dependency; edit it in its own document and `putDependency` with `replace: true` |
| | `DEPENDENCY_IN_USE` | `removeDependency` while nodes (`details.nodes`) or other dependencies (`details.dependencies`) still instantiate it; remove or retarget them first |
| | `HISTORY_NOT_FOUND` | `restore` names a revision without a history snapshot; run `history` |
| | `HISTORY_CONFLICT` | A snapshot for the current revision already exists in the history directory; nothing was written. Inspect both and move the conflicting snapshot aside deliberately |
| Guards | `REVISION_CONFLICT`, `STATE_CONFLICT` | The document, model or dependencies changed since the read; inspect again and rebase the batch |
| | `GUARD_REQUIRED` | `restore` needs `--expected-revision <current>` |
| | `GUARD_MISMATCH` | The command-line guard and the batch guard disagree; use one, or the same value |
| References and structure | `NOT_FOUND`, `REFERENCE_MISSING`, `DUPLICATE_ID`, `ID_MISMATCH` | A missing node, geometry, material, parameter, dependency or command path (`describe`), or a missing input file (`--file`, `--from`, `--dependency`; the hint names the flag); an ID already in use (including a `duplicateNode` or `groupNodes` target); a bundle model not keyed by its own ID |
| | `CYCLE`, `DEPTH_LIMIT`, `HAS_CHILDREN` | A circular parent or model reference; nesting too deep; removing a node with children without `--cascade` |
| | `EMPTY_SELECTION`, `INVALID_NODE_TYPE` | A selector matched nothing; the command needs another node type (rigs bind to model-instance nodes) |
| Parameters and patterns | `UNKNOWN_PARAMETER`, `PARAMETER_MISSING`, `PARAMETER_RANGE`, `PARAMETER_INTEGER` | Unknown override, undeclared `$param`, a value outside `min`/`max`, or a fraction for an integer parameter |
| | `PATTERN_PATH`, `PATTERN_COUNT` | Degenerate path for yaw orientation; counts that are not positive integers or exceed 256 copies |
| Rigs | `RIG_INVALID`, `RIG_BINDING`, `RIG_MISSING` | Invalid rig document; wrong mesh binding path (use `rig inspect`); posing without a bound rig |
| Paths and projects | `INVALID_PATH` | An output would replace the source document, a `*.lock` file or something inside a `*.history` directory (even with `--overwrite`), an output file path is a directory (or a `review` directory path is a file), or a project path escapes its project |
| | `PROJECT_NOT_FOUND`, `PROJECT_LOCKED` | `import --project` names no Scene Forge project, or a Scene Forge command is writing it |
| Littlewild | `LITTLEWILD_IMPORT` | The source is not a `littlewild-definition`, `littlewild-creature-package` or `littlewild-3d-asset` |
| | `LITTLEWILD_EXPORT` | The output is not `<target>/<family>/<id>/definition.json` for the same family and ID |
| | `LITTLEWILD_STALE` | `--check` found that the definition differs; export without `--check` |
| Outputs | `EXPORT_INVALID` | Khronos validation failed; nothing was written |
| | `QUALITY_GATE_FAILED` | `audit` findings; repair the listed geometry or budgets |
| | `ALREADY_EXISTS` | An `export` or `preview` output file exists, or a `review` directory is not empty; choose a new path or pass `--overwrite` deliberately |
| | `INVALID_CAMERA` | Use a named view, an orbit or a fixed camera from a replay plan |
| Procedural | `GENERATOR_NOT_FOUND` | No generator has that name; use one of `details.available` (`generate list`) |
| | `VARIANT_RANGE` | A `--vary` range lies outside the parameter's declared `min`..`max` (`details.declared`), has min > max, or holds no whole number for an integer parameter; narrow it |
| | `PROCEDURAL_BUDGET` | A generator exceeded its triangle budget, or a scatter exceeded 2,000 placements, 20,000 candidates or 10,000 document nodes (`details.limit`); lower detail, resolution or counts, or increase spacing |
| | `SCATTER_EMPTY` | Nothing was placed; read `details.rejected` and widen the area, lower the spacing or relax exclusions and `maxSlope` (or pass `--allow-empty`) |
| | `TERRAIN_TRANSFORM` | The terrain or scatter parent chain has tilt, nonuniform scale or a pattern; grounding follows translation, yaw and uniform scale only |
| Runtime | `BROWSER_UNAVAILABLE`, `PLAYWRIGHT_UNAVAILABLE`, `RENDER_FAILED` | Review cannot launch Chromium, cannot resolve Playwright (`details.remedies`), or rendering failed; run `doctor` |
| | `BUILD_REQUIRED` | A source run is missing built assets; run `npm run build` in `source/model-forge` or use `bin/model-forge` |
| | `INTERNAL_ERROR` | An unexpected failure; report the message, since retrying the same input fails the same way |

## Limits

`discover` reports the limits of the installed build (procedural ones under
`procedural.limits`): 16 MiB per JSON input,
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
