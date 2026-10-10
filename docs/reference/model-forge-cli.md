# Model Forge CLI handbook

`bin/model-forge` is a checked-in, self-contained build of
[Model Forge](../../source/model-forge/): an agent-first, standalone editor for
**exactly one 3D model**. One invocation reads one model document, applies
validated and revision-guarded edits to it, and produces the assets that
[Scene Forge](scene-forge-cli.md), the [Wildlands engine](wildlands-cli.md) and
its game folders consume. The editable
recipe is the source of truth; meshes, images and Littlewild definitions are
build outputs.

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
package command in `source/model-forge`. `model-forge discover` and
`model-forge describe <command path>` report the exact commands, flags, defaults
and limits of the installed build; prefer them over memorized syntax.

## Requirements

| Capability | Commands | Needs |
|---|---|---|
| Discovery, document lifecycle, inspection, editing, history, audit, export | everything except `review` | Node.js 22 or newer |
| Image review | `review` | Node.js 22+, the `playwright` package and a Chromium build Playwright can launch |
| Installation report | `doctor` | Node.js 22+; reports Playwright and Chromium status without failing when they are absent |

Playwright is not bundled. The executable loads it on demand from its own module
resolution (including `NODE_PATH`), the working directory, `source/model-forge`
beside the repository's `bin/` directory, and the global npm module root of the
running Node. Provide Chromium with `npx playwright install chromium` or set
`FORGE_CHROMIUM_PATH` to an existing Chromium/Chrome executable.

Where the `#!/usr/bin/env node` line is not honored (Windows shells), run
`node bin/model-forge …`.

## The document

Every command except discovery, `create` and `import` targets one document named
with the global `-d, --document <path>`. There is no working-directory discovery
and no hidden session state: each invocation reads the file it is given.

| Kind | File | Editable content |
|---|---|---|
| `model` | `<id>.model.json` | The whole model: parameters, materials, geometries, nodes, metadata |
| `model-bundle` | `<id>.model-bundle.json` | Only the `entry` model; every other model in `models` is a frozen, read-only dependency |

A `model` document is the existing Scene Forge model recipe (`schemaVersion: 1`,
`kind: "model"`, `id`, `name`, optional `category` and `description`,
`parameters`, `materials`, `geometries`, `nodes`). Model Forge adds one optional
field, `revision`: a nonnegative integer that is absent (meaning 0) in existing
files, so their bytes and state hashes are unchanged. Scene Forge accepts the
field everywhere it accepts a model.

A model that nests other models (a node with `"type": "model"`) needs its
dependencies to compile. Such a model is edited as a `model-bundle`
(`schemaVersion: 1`, `kind: "model-bundle"`, `entry`, `models`), the same format
Scene Forge's `model export` writes. Dependencies travel with the entry model but
cannot be changed through ordinary edits: a write that touches one fails with
`DEPENDENCY_READONLY`. `putDependency` and `removeDependency` are the only
operations that change the dependency set, and only in a bundle.

Side files beside the document belong to the editor:

```text
crate.model.json             the document (source of truth)
crate.model.json.lock        held while one process writes; never delete another process's lock
crate.model.json.history/    one snapshot per committed revision: <revision>.json
```

`stateHash` is the SHA-256 of the canonical JSON of `{model, dependencies}`: the
entry model and the frozen dependency library. Every read returns `revision` and
`stateHash`; every write accepts them as guards.

Conventions are Scene Forge's: meters, right-handed, **Y up**, model front **+Z**,
local XYZ Euler angles in degrees. Scalars may be numbers, `{"$param": "<name>"}`
or bounded `{"$expr": …}` arithmetic; see the
[Scene Forge file formats](scene-forge-cli.md#file-formats).

## Output contract

| Result | Stream | Shape | Exit |
|---|---|---|---|
| Success | stdout | `{"ok":true,"data":...}`, pretty-printed; one line with `--compact` | 0 |
| Failure | stderr | `{"ok":false,"error":{"code","message","hint"?,"details"?}}` | 1 |
| `--help`, `help <command>`, `--version` | stdout | plain text | 0 |
| `schema --raw`, `example show` raw output | stdout | bare JSON document | 0 |

The envelope is identical to Scene Forge's. `--compact` is global and changes
formatting only. There are no prompts. Wherever JSON input is accepted, use
`--file <path>`, `--file -` for stdin, or `--data '<json>'`; inputs are limited to
16 MiB.

## Agent protocol

1. Discover, do not guess: `model-forge discover --compact` lists the workflow,
   document kinds, operations, geometry types, limits, export formats and error
   codes. Use `describe <command path>` for flags and
   `schema --kind <kind> --raw` before writing JSON. Unknown keys fail.
2. Read before writing: `model-forge -d <doc> inspect` returns `id`, `kind`,
   `revision`, `stateHash`, `parameters`, `dependencies` and `stats` (nodes,
   meshes, triangles, materials, geometries, bounds, warnings). Add `--source`
   for the recipe, `--node <id>` to focus on one subtree and `--parameters <json>`
   to measure a variant.
3. Build one complete batch, dry-run it with `apply --dry-run`, then apply the
   same batch with `--expected-revision R --expected-state H` from the latest
   read. On `REVISION_CONFLICT` or `STATE_CONFLICT`, read again and rebuild; never
   retry blindly and never remove the lock file.
4. `put*` replaces a definition; `patch*` merges only supplied fields. Identical
   upserts do not increment the revision.
5. Check the result: `validate`, `audit` (`--strict` fails on warnings), then
   `review --out <new directory>` and look at `contact-sheet.png`. When
   Playwright is unavailable, say that no visual check ran; `doctor` tells you
   which case applies.
6. Export for the consumer (see [Outputs and consumers](#outputs-and-consumers));
   use `--validate` for GLB/glTF and `--check` before rewriting a Littlewild
   definition.
7. Never edit a model registered inside a Scene Forge project in place. Export a
   `model-bundle` and import it with Scene Forge's guarded `model import`.

## Command reference

`model-forge describe [path...]` prints the same information as JSON for the
installed build, and `model-forge help <command path>` as text.

### Global options

| Option | Meaning |
|---|---|
| `-d, --document <path>` | The one document this command reads or edits |
| `--compact` | One-line success JSON |
| `-V, --version` / `-h, --help` | Version / help |

### Discovery

| Command | Purpose |
|---|---|
| `discover` (alias `catalog`) | Workflow steps, document kinds, operations, geometry types, limits, export formats and error codes |
| `describe [path...]` | Arguments, flags, defaults and choices of a command subtree |
| `schema --kind <kind> [--raw]` | JSON Schema for `model`, `model-bundle`, `batch`, `operation`, `node`, `geometry`, `material`, `parameter`, `rig`, `pattern`, `selector`, `scalar`, `review`, `camera`, `camera-snapshot`, `quality-policy` or `littlewild-asset` |
| `doctor` | Node, Playwright and Chromium availability |
| `example list` / `example show <id>` / `example create <id> <path>` | Bundled example models; `create` writes a new document |

### Lifecycle

| Command | Options and behavior |
|---|---|
| `create <path>` | `--id`, `--name` (required), `--category`, `--description`, `--example <id>`. Writes a new `model` document at revision 0; never overwrites |
| `import` | `--from <file>`, `--out <new file>`, optional `--entry`, `--variant`, `--prefix`. Accepts a `model`, a `model-bundle`, a Scene Forge project model (`--project <dir> --id <model>`), or a Littlewild `littlewild-definition`, creature package or `littlewild-3d-asset` (reports `variantModels`, mapping source variant names to model IDs). Writes a new document; never overwrites |

### Read

| Command | Options and behavior |
|---|---|
| `inspect` | `--source`, `--parameters <json>`, `--node <id>`. Identity, revision, `stateHash`, parameters, dependencies and compiled statistics |
| `validate` | Schema, references, cycles, parameter ranges and compilation |
| `node list [selectors]` | Selectors as in Scene Forge (`--ids`, `--tag`, `--type`, `--model`, `--parent`); `--details` adds bounds and transforms |
| `history` | Committed revisions available for `restore` |

### Write

Every write accepts `--dry-run`, `--expected-revision <n>` and
`--expected-state <hash>`, holds the document lock across read, validation and
write, snapshots the previous revision into the history directory, and replaces
the document atomically. A failed edit never partially changes the document.

| Command | Behavior |
|---|---|
| `apply` | A batch `{expectedRevision?, expectedState?, operations}` from `--file`/`--data` |
| `put <kind>` / `remove <kind> <id>` | One-operation wrappers for nodes, geometries, materials and parameters |
| `add <primitive> <id>` | Add a primitive mesh node with its geometry and material |
| `node transform\|patch\|duplicate\|group\|reparent\|ground\|place` | Spatial and structural node edits with the same semantics as Scene Forge |
| `parameter put\|remove` | Model parameter definitions |
| `rig inspect\|bind\|pose\|remove` | Rigs on model-instance nodes; `inspect` is read-only |
| `restore <revision>` | Commit an earlier revision's content as a new revision; requires `--expected-revision` |

Batch operations: `putNode`, `patchNode`, `patchNodes`, `removeNode`,
`duplicateNode`, `reparentNode`, `groupNodes`, `groundNode`, `placeNode`,
`putGeometry`, `removeGeometry`, `putMaterial`, `removeMaterial`,
`putParameter`, `removeParameter`, `setMetadata`, and, in a bundle only,
`putDependency` and `removeDependency`. Scene-only operations such as
`setCamera`, `setEnvironment` and `setParameter` fail with `UNKNOWN_OPERATION`
and a hint naming Scene Forge.

A write result mirrors Scene Forge's edit result: `revision`, `stateHash`,
`proposedRevision`, `proposedStateHash`, `changes` (`added`, `updated`,
`removed`), `changed`, `dryRun`, `operations` and `stats`. A dry run keeps the
current `revision` and `stateHash`. A failing operation reports its zero-based
`details.operationIndex`.

### Outputs

| Command | Options and behavior |
|---|---|
| `review --out <new directory>` | Render-only capture page, one PNG per view, `contact-sheet.png`, `review.json` (`review-result` v1 with `provenance.tool: "model-forge"`, camera settings and the source `stateHash`) and a replay plan. `--file <plan>` reuses cameras; refuses a non-empty directory |
| `audit` | `--file <quality-policy>`, `--parameters <json>`, `--strict`. Geometry and material budgets of the visible deliverable; failures return `QUALITY_GATE_FAILED` |
| `export --format <format> --out <file>` | `--validate` (Khronos validation for GLB/glTF), `--parameters <json>`. Littlewild adds `--family`, `--variant`, `--name`, `--materials` and `--check` |

## Outputs and consumers

| `export --format` | Writes | Consumed by |
|---|---|---|
| `model` | The entry model as a standalone `model` document | `scene-forge model import`; another Model Forge document via `import` |
| `model-bundle` | Entry model plus its frozen dependency closure | `scene-forge -p <project> model import --file <file>` (`--dry-run` first; `--replace` with `--expected-revision`/`--expected-state` to change an existing registered model) |
| `littlewild` | A Littlewild `definition.json` written through the same kernel writer as Scene Forge: only the `visual` facet is merged; gameplay and other facets stay byte-for-byte | Wildlands game folders (`docs/concepts/<id>/assets/<family>/<id>/definition.json`), `wildlands creature attach-visual`, `bin/wildlands validate-game` |
| `glb`, `gltf` | glTF 2.0 with PBR materials, skins and rotation clips | Engines and DCC tools; `--validate` runs the Khronos validator |
| `obj`, `stl`, `three` | Mesh interchange and Three.js JSON | Other tools |

Review evidence (`review.json`) is a `review-result` v1 manifest that the
Wildlands `storyboard` command can compose with other tools' evidence.

Hand a model to Scene Forge:

```sh
bin/model-forge -d crate.model.json export --format model-bundle --out crate.model-bundle.json
bin/scene-forge -p garage model import --file crate.model-bundle.json --dry-run
bin/scene-forge -p garage model import --file crate.model-bundle.json
```

Refine a Littlewild visual and attach it to an engine project without losing
gameplay:

```sh
cp docs/concepts/littlewild/assets/creatures/sproutling/definition.json sproutling.definition.json
bin/model-forge import --from sproutling.definition.json --variant world --out sproutling-world.model.json
bin/model-forge -d sproutling-world.model.json inspect --compact
# … guarded apply, validate, audit and review …
bin/model-forge -d sproutling-world.model.json export --format littlewild --family creatures --variant world --out sproutling.definition.json --check
bin/model-forge -d sproutling-world.model.json export --format littlewild --family creatures --variant world --out sproutling.definition.json
bin/wildlands creature attach-visual --project game.project.json --archetype sproutling --file sproutling.definition.json --expected-fingerprint <fingerprint>
```

Export into a copy of the original complete definition so that other variants,
rig metadata and gameplay survive; `--check` reports whether the write would
change it.

Scene-wide Littlewild synchronization from a manifest (`littlewild sync`) and the
Pocket Pet assets stay in Scene Forge; see
[Author Littlewild assets in Scene Forge](../how-to/scene-forge-littlewild-assets.md).

## Error codes

Read `error.code`, then `error.hint` and `error.details`. Model Forge reports the
kernel's stable codes listed in the
[Scene Forge error table](scene-forge-cli.md#error-codes) (input, schema and
references, expressions and patterns, geometry and budgets, rigs, outputs,
Littlewild exchange and runtime), plus these document codes:

| Code | Meaning |
|---|---|
| `DOCUMENT_NOT_FOUND` | `--document` does not name an existing file |
| `DOCUMENT_LOCKED` | Another process holds the document's `.lock`; wait and retry, never delete it |
| `DOCUMENT_KIND` | The file is not a `model` or `model-bundle`, or the operation needs a bundle |
| `DEPENDENCY_READONLY` | An edit would change a frozen bundle dependency |
| `HISTORY_NOT_FOUND` | `restore` names a revision without a history snapshot |
| `REVISION_CONFLICT`, `STATE_CONFLICT`, `GUARD_MISMATCH` | A guard does not match the current document |
| `UNKNOWN_OPERATION` | Not a model operation (scene-only operations name Scene Forge in the hint) |
| `ALREADY_EXISTS` | `create`, `import` or an output refuses to overwrite |

## Limits

The kernel's limits apply: 20,000 expanded objects, 2,000,000 triangles, 256
pattern copies, model nesting depth 16, 10,000 authored nodes per model,
16 MiB per JSON input, and the Littlewild per-mesh, per-definition and engine
JSON value/depth budgets. Not supported, as in Scene Forge: inverse kinematics,
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
```

A kernel change also changes Scene Forge's bundle: rebuild and check
`bin/scene-forge` in `source/scene-forge` and commit both executables together.
CI runs `.github/workflows/model-forge.yml` for Model Forge and
`.github/workflows/scene-forge.yml` whenever the kernel changes.

## Further reading

- [Scene Forge CLI](scene-forge-cli.md): projects, scene composition, the model
  registry and scene-wide Littlewild sync.
- [Wildlands CLI](wildlands-cli.md): `creature attach-visual`, game folders and
  `storyboard`.
- [Character Studio CLI](character-studio-cli.md) and the
  [complete agent workflow](../how-to/character-agent-workflow.md).
- [Checked-in command-line tools](../../bin/README.md).
