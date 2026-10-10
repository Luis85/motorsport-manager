# Model Forge

Model Forge is a standalone, agent-first editor for **exactly one 3D model recipe per
document**. It owns the model recipe kernel (`src/kernel`) that Scene Forge also builds on,
and it produces every asset the rest of the repository consumes: model recipes and bundles
for Scene Forge, Littlewild definitions for Wildlands games, and GLB/glTF for engines and
DCC tools.

The repository executable is `bin/model-forge` (one generated CommonJS file, Node.js 22+,
no `node_modules`). From this directory, `npm run cli -- <args>` runs the same CLI from
source.

```sh
bin/model-forge discover                                  # protocol, operations, limits, errors
bin/model-forge create lamp.model.json --id lamp --name "Floor lamp"
bin/model-forge -d lamp.model.json add cylinder pole --radius 0.02 --height 1.4
bin/model-forge -d lamp.model.json inspect --source
bin/model-forge -d lamp.model.json apply --file batch.json --dry-run
bin/model-forge -d lamp.model.json apply --file batch.json --expected-revision 1 --expected-state <hash>
bin/model-forge -d lamp.model.json review --out review/lamp-r2
bin/model-forge -d lamp.model.json export --format glb --validate --out lamp.glb
```

## Agent contract

- Every command prints exactly one JSON object: stdout `{"ok":true,"data":...}` with exit
  0, or stderr `{"ok":false,"error":{"code","message","hint"?,"details"?}}` with exit 1.
  `--compact` prints single-line JSON. There are no prompts, colors or sessions.
- The document is always explicit: global `-d, --document <path>`. Nothing is discovered
  from the working directory.
- JSON input comes from `--file <path>`, `--file -` (stdin) or `--data <json>`, at most
  16 MiB.
- Writes accept `--dry-run`, `--expected-revision <n>` and `--expected-state <hash>` (or the
  same fields in a batch). A stale guard fails with `REVISION_CONFLICT` or `STATE_CONFLICT`;
  inspect again and rebase instead of dropping the guard.
- Operation failures carry `details.operationIndex` (zero-based). `error.hint` is the
  remedy for that failure in its context.
- `discover` (alias `catalog`), `describe [command...]` and `schema --kind <kind> [--raw]`
  are the machine-readable references; `doctor` checks Playwright and Chromium.

## Documents

| Kind           | File                     | Editable                                   |
| -------------- | ------------------------ | ------------------------------------------ |
| `model`        | `<id>.model.json`        | the model                                  |
| `model-bundle` | `<id>.model-bundle.json` | the `entry` model; other models are frozen |

- `revision` is an optional integer in the editable model. Revision 0 is written as no
  field (`create` and `import` write none; an explicit `revision: 0` reads as absent), so
  equal content has one `stateHash`. A batch that changes nothing keeps the revision.
- `stateHash` is `sha256(canonical({model, dependencies}))`, the kernel's `modelStateHash`.
- Each written edit holds `<document>.lock` from read through write, stores the replaced
  file byte-for-byte as `<document>.history/<revision>.json`, increments `revision` and
  replaces the document atomically; a snapshot is never replaced (`HISTORY_CONFLICT`).
  Reads never lock. `DOCUMENT_LOCKED` reports the holder `pid`, `createdAt` and whether it
  is `stale` (its process is gone); locks are never removed automatically. `history`
  lists revisions and `restore <revision> --expected-revision <current>` writes a stored
  one as a new revision.
- `create`, `import` and `example create` never overwrite a document.
- Documents inside a Scene Forge project (an ancestor holds `forge.project.json`) are
  read-only: writes, new documents and `model`/`model-bundle` exports there fail with
  `PROJECT_MODEL_READONLY`. Import a copy with `import --project`, then hand it back with
  `scene-forge model import --replace` and its guards.
- Outputs never replace an existing file without `--overwrite` (`ALREADY_EXISTS`), and
  never the source document, a `*.lock` file or a `*.history` entry (`INVALID_PATH`).
  `export --format littlewild` merges into an existing definition instead.

## Commands

| Group     | Commands                                                                                                                                                                                                          |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Discovery | `discover` (`catalog`), `describe`, `schema`, `doctor`, `example list\|show\|create`                                                                                                                              |
| Lifecycle | `create`, `import`                                                                                                                                                                                                |
| Read      | `inspect`, `validate`, `node list`, `history`, `rig inspect`                                                                                                                                                      |
| Write     | `apply`, `put`, `remove`, `add`, `node transform\|patch\|edit\|duplicate\|group\|reparent\|ground\|place`, `parameter put\|remove`, `metadata set`, `dependency put\|remove`, `rig bind\|pose\|remove`, `restore` |
| Output    | `review`, `preview`, `audit`, `export`                                                                                                                                                                            |

Batch operations: `putNode`, `patchNode`, `patchNodes`, `removeNode`, `duplicateNode`,
`reparentNode`, `groupNodes`, `groundNode`, `placeNode`, `putGeometry`, `removeGeometry`,
`putMaterial`, `removeMaterial`, `putParameter`, `removeParameter`, `setMetadata`,
`putDependency` and `removeDependency` (bundles only). Scene operations (`setCamera`,
`setEnvironment`, `setParameter`) fail with `UNKNOWN_OPERATION` and name the model
equivalent. Rigs bind to nested model-instance nodes, the kernel's rig scope.

## Imports and exports

`import --out <new document>` accepts a model, a model-bundle (`--entry`), a Scene Forge
project model (`--project <dir> --id <model>`, read-only) or a Littlewild definition,
creature package or 3D asset (`--prefix`). A multi-variant Littlewild source writes one
document for `--variant` (default: the first) and maps every source variant to its model ID
in `variantModels`. `--dry-run` plans and validates without writing.

| `export --format`     | Consumer                                                                               |
| --------------------- | -------------------------------------------------------------------------------------- |
| `model`               | `scene-forge model import --file`                                                      |
| `model-bundle`        | `scene-forge model import --file [--replace]`, `model-forge import`                    |
| `littlewild`          | `wildlands creature attach-visual`, Littlewild games (`<family>/<id>/definition.json`) |
| `glb`, `gltf`         | engines, DCC tools (`--validate` runs the Khronos validator)                           |
| `obj`, `stl`, `three` | DCC tools, 3D printing, three.js `ObjectLoader`                                        |

Portable `model` and `model-bundle` exports carry no editor revision, and a bundle export
leaves out dependencies no node instantiates (`inspect` lists them as `unusedDependencies`).
GLB, model-bundle and new Littlewild definitions are byte-identical to Scene Forge's
`export --model`, `model export` and `littlewild export` for the same model;
`tests/agent.test.ts` checks this against `bin/scene-forge`. Into an existing
definition, both tools keep the source representation of everything unchanged
(layout, key order, string material references, mesh names, engine-only fields such
as `castShadow`): one lossless contract, so an unedited Littlewild import re-exports
byte-identically and merged definitions are byte-identical to Scene Forge's too;
`tests/littlewild-roundtrip.test.ts` checks every variant under `docs/concepts` and
the edited-definition parity with `bin/scene-forge`.

`review --out <new directory>` renders named views or a `--turntable` in one headless
Chromium session and writes PNGs, `contact-sheet.png`, `review.json` (`review-result`,
`provenance.tool: "model-forge"`, top-level `scene`/`revision` naming the model and its
document revision) and a `replay-plan.json` with fixed cameras. `preview`
writes a self-contained, read-only orbit page.

## Development

```sh
npm ci
npm run format:check && npm run architecture:check && npm run check && npm test
npm run build:cli && npm run check:cli          # regenerate and verify ../../bin/model-forge
FORGE_CHROMIUM_PATH=/path/to/chromium npm run test:e2e
npm run verify                                  # all of the above in order
```

See [AGENTS.md](AGENTS.md) for layering and code-change rules.
