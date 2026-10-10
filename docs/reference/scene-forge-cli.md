# Scene Forge CLI handbook

`bin/scene-forge` is a checked-in, self-contained build of
[Scene Forge](../../source/scene-forge/README.md): a command-line 3D authoring tool
that turns JSON recipes into reproducible geometry. You describe projects,
parametric models and scenes as data, apply validated and revision-guarded edits,
then export GLB/glTF/OBJ/STL/Three.js JSON, generate an offline HTML viewer and
capture review images. The editable recipe is the source of truth; meshes and
images are build outputs.

The executable is one file. It bundles every JavaScript dependency and the viewer,
stylesheet and example catalog, so it runs from a fresh clone without `npm ci`. It
is the same program as the `forge3d` package command in `source/scene-forge`, with
the program name `scene-forge`. Scene Forge is a standalone tool beside the game;
it does not read or write Motorsport Manager content, saves or Godot scenes.

Every `sh` block on this page was executed in order, as one shell session, against
`bin/scene-forge` 0.6.0, both in place and as a lone copy in an empty directory
without `node_modules` on its module path.
`text` blocks show outputs, file layouts and environment setup commands.

## Requirements

| Capability | Commands | Needs |
|---|---|---|
| Authoring, validation, inspection, quality audit, export, bundles, examples, offline HTML preview | everything except the two below | Node.js 22 or newer |
| Image capture | `screenshot`, `review` | Node.js 22+, the `playwright` package and a Chromium build Playwright can launch |
| Installation report | `doctor` | Node.js 22+; reports Playwright and Chromium status without failing when they are absent |

Playwright is deliberately not bundled. The executable loads it on demand and looks,
in order, in its own module resolution (including `NODE_PATH`), the current working
directory, `source/scene-forge` beside the repository's `bin/` directory, and the
global npm module root of the running Node. Any one of these enables rendering:

```text
# Repository checkout: bin/scene-forge then uses source/scene-forge/node_modules/playwright
cd source/scene-forge && npm ci
# Or anywhere
npm install --global playwright
# Or point NODE_PATH at a node_modules directory that contains playwright
export NODE_PATH=/path/to/node_modules
```

Playwright also needs its matching Chromium: run `npx playwright install chromium`
(Linux hosts lacking system libraries: `npx playwright install --with-deps chromium`),
or set `FORGE_CHROMIUM_PATH` to an existing Chromium/Chrome executable. Opening the
generated HTML needs a WebGL 2 capable browser; nothing else uses a browser.

On systems that do not honor the `#!/usr/bin/env node` line (Windows shells),
invoke it through Node, for example `node bin/scene-forge --version`.

## Quick start

Run from the repository root. The work happens in a new scratch directory, so use
an empty one (commands that create projects refuse to overwrite).

```sh
export PATH="$PWD/bin:$PATH"
scene-forge --version
mkdir -p /tmp/forge-demo && cd /tmp/forge-demo
```

Write a parametric model. `$param` reads a model parameter; `$expr` is bounded
arithmetic; the linear `pattern` repeats the band `bands` times.

```sh
cat > crate.model.json <<'EOF'
{
  "schemaVersion": 1,
  "kind": "model",
  "id": "crate",
  "name": "Banded crate",
  "category": "props",
  "description": "Wooden crate with parametric width/height and a whole number of steel bands.",
  "parameters": {
    "width": { "default": 1.2, "min": 0.4, "max": 3, "description": "X size in meters" },
    "height": { "default": 0.8, "min": 0.3, "max": 2, "description": "Y size in meters" },
    "bands": { "default": 2, "min": 1, "max": 6, "integer": true }
  },
  "materials": {
    "wood": { "color": "#b07a45", "roughness": 0.8 },
    "steel": { "color": "#8899aa", "metalness": 0.7, "roughness": 0.35 }
  },
  "geometries": {
    "body": { "type": "box", "size": [{ "$param": "width" }, { "$param": "height" }, 0.8] },
    "band": {
      "type": "box",
      "size": [{ "$expr": "add", "args": [{ "$param": "width" }, 0.04] }, 0.06, 0.84]
    }
  },
  "nodes": [
    {
      "id": "body",
      "type": "mesh",
      "geometry": "body",
      "material": "wood",
      "transform": { "position": [0, { "$expr": "mul", "args": [{ "$param": "height" }, 0.5] }, 0] }
    },
    {
      "id": "bands",
      "type": "mesh",
      "geometry": "band",
      "material": "steel",
      "transform": { "position": [0, 0.15, 0] },
      "pattern": { "type": "linear", "count": { "$param": "bands" }, "step": [0, 0.25, 0] }
    }
  ]
}
EOF
```

Write a composition that places two instances, one with parameter overrides:

```sh
cat > yard.composition.json <<'EOF'
{
  "schemaVersion": 1,
  "kind": "composition",
  "scene": "main",
  "groups": [{ "id": "storage", "name": "Storage bay", "tags": ["storage"] }],
  "instances": [
    { "id": "crateA", "model": "crate", "parent": "storage", "tags": ["storage"] },
    {
      "id": "crateB",
      "model": "crate",
      "parent": "storage",
      "tags": ["storage"],
      "parameters": { "width": 1.6, "bands": 3 },
      "transform": { "position": [2.2, 0, 0], "rotation": [0, 15, 0] }
    }
  ]
}
EOF
```

Create the project, register the model, compose, validate and export:

```sh
scene-forge init garage --name "Garage props"
scene-forge -p garage model import --file crate.model.json --dry-run
scene-forge -p garage model import --file crate.model.json
scene-forge -p garage model inspect crate --parameters '{"width":1.5,"bands":3}'
scene-forge -p garage scene compose --file yard.composition.json --dry-run
scene-forge -p garage scene compose --file yard.composition.json --expected-revision 0
scene-forge -p garage node list --tag storage --details
scene-forge -p garage validate
scene-forge -p garage export --validate --out garage/exports/yard.glb
scene-forge -p garage preview --out garage/exports/yard.html
```

Open `garage/exports/yard.html` in a browser to orbit, select and edit the scene
offline. With Playwright available, render six views and a contact sheet, then
look at `garage/exports/review/contact-sheet.png`:

```sh
scene-forge -p garage review --out garage/exports/review
```

## How it works

### Projects and files

`init <directory>` creates a project:

```text
garage/
  forge.project.json        manifest: name, active scene, scene and model registry
  scenes/main.scene.json    scene source (one file per scene)
  models/<id>.model.json    reusable model recipes, added by model import/capture
  history/<scene>/<n>.json  scene snapshots per revision, used by scene restore
```

Commands find the nearest parent project of the working directory, or use
`-p/--project <directory>`. `-s/--scene <id>` targets another scene for one
command without changing the active scene. Relative `-p`, `--file` and `--out`
paths resolve against the working directory, not the project.

### Conventions

Meters, right-handed, **Y up**, model front **+Z**, local **XYZ Euler angles in
degrees**; transforms apply scale, then rotation, then translation. Primitives are
centered at their origin; extrusions lie in XY and extend along +Z from Z=0; lathe
points are `[radius, y]` revolved around Y. Use groups for pivots and assemblies,
models for reuse and patterns for repetition. IDs start with a letter and contain
letters, digits, `_` and `-` (at most 64 characters).

### Revisions and state guards

Each scene has an integer `revision`. Every response that reads a scene also
returns `stateHash`, a SHA-256 over the scene and the entire model registry.
Mutating commands accept `--dry-run`, `--expected-revision <n>` and
`--expected-state <hash>`. A dry run validates and compiles the proposal and
reports `proposedRevision`, `proposedStateHash` and the added/updated/removed IDs
without writing. A failed edit never partially changes the scene. Reapplying an
identical upsert does not increment the revision. `put` operations replace a whole
definition; `patch` operations merge only the supplied fields.

## Output contract and exit codes

| Result | Stream | Shape | Exit |
|---|---|---|---|
| Success | stdout | `{"ok":true,"data":...}`, pretty-printed; one line with `--compact` | 0 |
| Failure | stderr | `{"ok":false,"error":{"code","message","hint"?,"details"?}}` | 1 |
| `--help`, `help <command>`, `--version` | stdout | plain text | 0 |
| `schema --raw`, `example show --raw` | stdout | bare JSON document | 0 |
| No command, or a command group without a subcommand | stdout help, stderr `CLI_USAGE` error | | 1 |

`--compact` is a global option and may appear anywhere on the command line. There
are no prompts. Use `--file -` to read JSON from stdin wherever `--file` is
accepted, or `--data '<json>'` inline. JSON inputs are limited to 16 MiB.

An error from the quick-start project (a composition passed to `apply`, which
expects a batch). stderr receives:

```sh
scene-forge -p garage apply --file yard.composition.json --expected-revision 0 || echo "exit $?"
```

```text
{
  "ok": false,
  "error": {
    "code": "SCHEMA_INVALID",
    "message": "Input does not match the schema. Use the schema command to inspect the contract.",
    "hint": "Run schema --kind <kind> --raw and repair the reported field paths.",
    "details": [
      {
        "path": "operations",
        "message": "Invalid input: expected array, received undefined"
      },
      {
        "path": "",
        "message": "Unrecognized keys: \"schemaVersion\", \"kind\", \"groups\", \"instances\""
      }
    ]
  }
}
```

followed by `exit 1` on stdout.

### Error codes

Read `error.code`, then `error.hint` and `error.details` (field paths, operation
index, searched paths, quality findings). Codes are stable identifiers.

| Group | Codes |
|---|---|
| Command line and input | `CLI_USAGE`, `INVALID_OPTION`, `INPUT_REQUIRED`, `JSON_INVALID`, `JSON_READ_FAILED`, `INPUT_TOO_LARGE`, `INVALID_PATH`, `NOT_FOUND`, `ALREADY_EXISTS`, `UNKNOWN_SCHEMA` |
| Schema and references | `SCHEMA_INVALID`, `ID_MISMATCH`, `DUPLICATE_ID`, `REFERENCE_MISSING`, `UNKNOWN_GEOMETRY`, `UNKNOWN_OPERATION`, `UNKNOWN_PARAMETER`, `PARAMETER_MISSING`, `PARAMETER_RANGE`, `PARAMETER_INTEGER`, `CYCLE`, `DEPTH_LIMIT` |
| Expressions and patterns | `EXPRESSION_ARITY`, `EXPRESSION_DEPTH`, `EXPRESSION_DIV_ZERO`, `EXPRESSION_OPERATOR`, `EXPRESSION_RANGE`, `PATTERN_COUNT`, `PATTERN_PATH`, `PATTERN_HAS_CHILDREN` |
| Geometry and budgets | `INVALID_GEOMETRY`, `EMPTY_GEOMETRY`, `INVALID_SCALE`, `TRANSFORM_RANGE`, `SHEAR_UNSUPPORTED`, `SCENE_BUDGET`, `CSG_BUDGET`, `LIGHT_BUDGET`, `PREVIEW_BUDGET` |
| Scene editing | `INVALID_NODE_TYPE`, `HAS_CHILDREN`, `DEPENDENT_NODES`, `DIFFERENT_PARENTS`, `OVERLAPPING_SELECTION`, `EMPTY_SELECTION`, `NODE_HIDDEN`, `SCENE_MISMATCH` |
| Concurrency | `REVISION_CONFLICT`, `STATE_CONFLICT`, `GUARD_MISMATCH`, `PROJECT_LOCKED`, `PROJECT_NOT_FOUND` |
| Rigs | `RIG_INVALID`, `RIG_BINDING`, `RIG_MISSING`, `RIG_NESTED`, `RIG_EMPTY`, `RIG_CHILDREN`, `RIG_BUDGET` |
| Outputs | `EXPORT_INVALID`, `QUALITY_GATE_FAILED`, `INVALID_CAMERA`, `RENDER_FAILED` |
| Littlewild exchange | `LITTLEWILD_EXPORT`, `LITTLEWILD_IMPORT`, `LITTLEWILD_BUDGET` (baked mesh over its vertex limit), `LITTLEWILD_STALE` (`sync --check` found an out-of-date definition) |
| Runtime | `PLAYWRIGHT_UNAVAILABLE` (Playwright not resolvable), `BROWSER_UNAVAILABLE` (Chromium did not launch), `BUILD_REQUIRED` (packaged asset missing), `INTERNAL_ERROR` |

Never delete another process's `.forge.lock` to clear `PROJECT_LOCKED`; wait and retry.

## Command reference

The tables list each command's own options. All commands also accept the global
options. `scene-forge describe <command path>` prints the same information as JSON
for the installed build, and `scene-forge help <command path>` as text.

### Global options

| Option | Meaning |
|---|---|
| `-p, --project <directory>` | Project directory (default: nearest project above the working directory) |
| `-s, --scene <id>` | Scene for this command (default: the project's `activeScene`) |
| `--compact` | One-line success JSON |
| `-V, --version` / `-h, --help` | Version / help |

### Discovery

| Command | Options |
|---|---|
| `catalog` | none. Commands, geometry types, operations, conventions, limits, unsupported features |
| `describe [path...]` | none. Arguments, flags, defaults and choices of a command subtree |
| `schema` | `--kind <name>` (default `scene`; one of `scene`, `model`, `project`, `batch`, `node`, `geometry`, `material`, `composition`, `model-bundle`, `scene-bundle`, `selector`, `scalar`, `review`, `camera`, `camera-snapshot`, `quality-policy`, `pattern`, `rig`, `littlewild-export`), `--raw` (bare JSON Schema) |
| `help [command]` | text help |

```sh
scene-forge --help
scene-forge catalog --compact
scene-forge describe node edit --compact
scene-forge schema --kind batch --raw > batch.schema.json
scene-forge schema --kind composition --compact
```

Littlewild import returns `variants` (the existing model-ID array) and
`variantModels` (original source variant name → actual imported model ID).
Use `variantModels["world-round"]` when choosing a model for preview or export;
do not infer normalized suffixes. Dry-run and apply return the same mapping,
including custom prefixes and long IDs.

### Plush forms and portable surface detail

`catalog` exposes `organicForms` and `surfaceDetails`, including complete JSON
batch operations, parameter ranges, export behavior and visual review workflow.
Use `schema --kind geometry --raw` and `schema --kind material --raw` for the
installed contracts. Apply both through the existing guarded `apply` transaction.

The `organic` geometry makes closed, smoothly rounded forms with seam-aware UVs:

```json
{
  "op": "putGeometry",
  "id": "plushBody",
  "geometry": {
    "type": "organic", "size": [0.9, 1.1, 0.72], "roundness": 0.9,
    "taper": 0.22, "bend": 0, "segments": 32
  }
}
```

`size` is the untapered diameter in meters. `roundness` is 0.65–1.5 (default 1;
lower values fill out the form), `taper` is −0.65–0.65 (positive narrows the top),
`bend` is −0.75–0.75 (positive offsets both ends along X), and `segments` is
12–96 (default 32). Inspect actual bounds because taper and bend can extend them.
The default has 561 vertices; the maximum has 4,753. Organic forms export as
baked Littlewild meshes and ordinary GLB meshes.

An optional `profile` gives agents editable crosssections for a belly, waist,
cheek, ear or closed garment form. Supply 2–12 stations ordered from `at: -1`
(bottom) to `at: 1` (top), separated by at least 0.02. Each station has `width`
and `depth` multipliers (0.1–2) and optional `offset: [x,z]` (−0.75–0.75,
default `[0,0]`). Offsets use half the corresponding size; the profile composes
with taper and bend. Smoothstep interpolation never overshoots these values,
and each station gets an exact mesh ring. Width/depth multiply the closed
base shape, so the endpoints remain poles. Profiles use at most 5,723 vertices.
This is a closed sculpted form, not an open cloth sheet or a boolean eye socket.

```json
{
"type": "organic", "size": [1, 2, 1],
"profile": [
  {"at": -1, "width": 1, "depth": 1},
  {"at": -0.35, "width": 1.12, "depth": 1.15, "offset": [0, 0.12]},
  {"at": 0.35, "width": 0.75, "depth": 0.8},
  {"at": 1, "width": 0.65, "depth": 0.7, "offset": [0.1, -0.08]}
]
}
```

Use a complete `putGeometry` to update the existing geometry ID while retaining
its nodes, rig tags and material roles. `putGeometry` replaces the full definition:
start from `inspect --source`, preserve other fields, dry-run with revision/state
guards, inspect bounds, then compare a fixed `review --file` across edits.
Littlewild/GLB preserve the resulting silhouette and UVs as baked geometry;
retain the Forge recipe to edit profile stations again.

Standard PBR materials accept a versioned deterministic surface recipe:

```json
{
  "op": "putMaterial", "id": "plushFur",
  "material": {
    "color": "#c89059", "roughness": 0.9, "sheen": 0.65,
    "surface": { "kind": "fur", "seed": 7, "scale": 3, "strength": 0.4 }
  }
}
```

All four surface fields are required. Kinds are `fur`, `cloth`, `leather`; seed
is an integer 0–65535, scale is UV repeat 1–16, and strength is 0–1. The
`littlewild-surface-v1` algorithm creates 128×128 color and tangent normal maps.
Optional `version: 2` chooses fine directional fur fibres, woven yarn and subtle
leather grain (`littlewild-surface-v2`). Omitted version or `version: 1` retains
the original pixels exactly. The inspector exposes this as Detail style.
GLB/glTF embeds PNGs, mesh tangents, UV transforms and recipe metadata without
requiring Chromium. Littlewild retains the recipe, per-node effective material
roles and mesh UVs. Unlit surfaces reject this detail instead of silently ignoring
it; OBJ/STL continue to omit materials. Legacy meshes without UVs get a local
spherical projection; authored seam-aware UVs give precise placement.

These maps shade short fur and fabric detail. Silhouette volume, tufts, eyelids,
clothing thickness and facial proportions still require geometry. Use a complete
batch with revision/state guards, inspect the dry run, apply the same batch, and
compare `review --file previous/replay-plan.json` captures. The material inspector
edits the same fields and downloads guarded recipe changes.

Surface maps are shared across colors with the same version/kind/seed/scale/strength. A
scene allows at most 256 distinct surface recipes; exceeding it fails with
`SCENE_BUDGET` before publication. Reuse seeds and scales when changing only color.

### Projects and scenes

| Command | Options |
|---|---|
| `init <directory>` | `--name <name>` |
| `scene list` | none |
| `scene create <id>` | `--name <name>` |
| `scene use <id>` | none. Sets `activeScene` |
| `scene clone <id>` | `--name <name>`. Copies the selected scene |
| `scene restore <revision>` | `--expected-revision <n>`. Restores a snapshot as a new revision with the current model registry |
| `scene compose` | `--file`, `--data`, guards, `--dry-run`. Upserts groups and instances; never clears a scene |
| `scene pack` | `-o, --out <file>` (required). One scene plus its full model dependency closure |
| `scene unpack <directory>` | `--file`, `--data`. Restores a scene bundle into a new project |

"Guards" means `--expected-revision <n>` and `--expected-state <hash>`.

```sh
scene-forge -p garage scene list
scene-forge -p garage scene create night --name "Night shift"
scene-forge -p garage scene clone variant --name "Variant"
scene-forge -p garage scene use main
```

### Models

| Command | Options |
|---|---|
| `model list` | none |
| `model inspect <id>` | `--parameters <json>`. Parameters, dependencies, dimensions of a variant |
| `model import` | `--file`, `--data`, `--replace`, `--dry-run`, `--expected-revision`, `--expected-state`. Accepts a model or a `model-bundle` |
| `model instantiate <model> <id>` | `--at <x,y,z>` (default `0,0,0`), `--rotate <x,y,z>`, `--scale <x,y,z>` (default `1,1,1`), `--parameters <json>`, `--parent <id>`, `--name <name>`, guards, `--dry-run` |
| `model capture <id>` | `--nodes <ids>` (required), `--name <name>`, `--replace`, guards, `--dry-run`. Turns scene nodes into a model |
| `model export <id>` | `-o, --out <path>` (required). Model bundle with nested dependencies |

```sh
scene-forge -p garage model list
scene-forge -p garage model instantiate crate crateC --at 0,0,2 --parameters '{"height":1.2}'
scene-forge -p garage model capture bay --nodes storage --name "Storage bay" --dry-run
scene-forge -p garage model export crate --out garage/exports/crate.models.json
scene-forge init level
scene-forge -p level model import --file garage/exports/crate.models.json
scene-forge -p level model instantiate crate first
```

### Scene editing

| Command | Options |
|---|---|
| `add <type> <id>` | `type`: `box`, `sphere`, `cylinder`, `cone`, `torus`, `capsule`, `plane`. `--size <x,y,z>` (default `1,1,1`), `--radius <n>` (0.5), `--height <n>` (1), `--tube <n>` (0.15), `--at`, `--rotate`, `--material <id>` (default `clay`, created if absent), `--parent <id>`, guards, `--dry-run` |
| `put <kind> <id>` | `kind`: `node`, `material`, `geometry`. `--file`, `--data`, guards, `--dry-run`. Replaces the whole definition |
| `apply` | `--file`, `--data`, guards, `--dry-run`. Batch transaction `{"operations":[...]}` |
| `remove <id>` | `--cascade`, guards, `--dry-run` |
| `node transform <id>` | `--at`, `--rotate`, `--scale`, guards, `--dry-run`. Changes only supplied components |
| `node patch <id>` | `--file`, `--data`, guards, `--dry-run`. Merges name, visibility, tags, transform or model overrides |
| `node duplicate <id> <newId>` | `--offset <x,y,z>` (default `0,0,0`), guards, `--dry-run` |
| `node group <id>` | `--nodes <ids>` (required), `--name <name>`, guards, `--dry-run` |
| `node reparent <id>` | `--parent <id>` (omit for scene root), `--local` (keep local transform), guards, `--dry-run` |
| `node ground <id>` | `--y <number>` (default 0), guards, `--dry-run` |
| `node place <id>` | `--to <id>` (required), `--side right\|left\|front\|back\|above\|below` (default `right`), `--gap <meters>` (0), `--keep-other-axes`, guards, `--dry-run` |
| `node list` | selectors, `--details`, `--limit <n>` (1–1000, default 100), `--offset <n>` |
| `node edit` | selectors (at least one), `--file`, `--data`, guards, `--dry-run`. Patches every match in one transaction |

Selectors intersect: `--ids <a,b>`, `--tag <tag>`, `--type group|mesh|model|light`,
`--model <id>`, `--parent <id>`, `--root`. Write a negative first vector component
as `--at=-1.5,0,0` so it is not parsed as a flag.

```sh
scene-forge -p garage add box pallet --size 3,0.15,1.2 --at 1,0.075,0
scene-forge -p garage add cylinder drum --radius 0.3 --height 0.9 --at=-1.5,0.45,0
scene-forge -p garage put material paint --data '{"color":"#e99045","roughness":0.5}'
scene-forge -p garage put geometry signGeo --data '{"type":"box","size":[1,0.5,0.05]}'
scene-forge -p garage put node sign --data '{"id":"sign","type":"mesh","geometry":"signGeo","material":"paint","transform":{"position":[0,1.6,-0.6]}}'
scene-forge -p garage remove drum
scene-forge -p garage node ground crateC
scene-forge -p garage node place crateC --to crateB --side right --gap 0.3
scene-forge -p garage node duplicate crateC crateD --offset 0,0,1.5
scene-forge -p garage node transform crateD --rotate 0,30,0
scene-forge -p garage node patch crateD --data '{"name":"Spare crate","tags":["spare"]}'
scene-forge -p garage node group spares --nodes crateC,crateD --name "Spares"
scene-forge -p garage node reparent crateD --parent storage
scene-forge -p garage node list --type model --limit 2
scene-forge -p garage node edit --tag storage --type model --data '{"parameters":{"height":1}}' --dry-run
scene-forge -p garage node edit --tag storage --type model --data '{"parameters":{"height":1}}'
```

A batch with a boolean subtraction, a lathe and a grid pattern, applied through
stdin after a dry run:

```sh
cat > workbench.batch.json <<'EOF'
{
  "operations": [
    { "op": "putMaterial", "id": "metal", "material": { "color": "#a9c1bf", "metalness": 0.35, "roughness": 0.4 } },
    { "op": "putGeometry", "id": "plate", "geometry": { "type": "box", "size": [1.2, 0.1, 0.6] } },
    {
      "op": "putGeometry",
      "id": "hole",
      "geometry": { "type": "cylinder", "radiusTop": 0.12, "radiusBottom": 0.12, "height": 0.3, "segments": 24 }
    },
    {
      "op": "putGeometry",
      "id": "drilledPlate",
      "geometry": { "type": "boolean", "operation": "subtract", "left": "plate", "right": "hole" }
    },
    {
      "op": "putGeometry",
      "id": "post",
      "geometry": { "type": "lathe", "points": [[0, 0], [0.06, 0], [0.04, 0.4], [0.07, 0.8], [0, 0.8]], "segments": 16 }
    },
    {
      "op": "putNode",
      "node": { "id": "bench", "type": "group", "name": "Workbench", "tags": ["fixture"], "transform": { "position": [0, 0, -2] } }
    },
    {
      "op": "putNode",
      "node": {
        "id": "top",
        "type": "mesh",
        "parent": "bench",
        "geometry": "drilledPlate",
        "material": "metal",
        "transform": { "position": [0, 0.85, 0] }
      }
    },
    {
      "op": "putNode",
      "node": {
        "id": "legs",
        "type": "mesh",
        "parent": "bench",
        "geometry": "post",
        "material": "metal",
        "pattern": { "type": "grid", "counts": [2, 1, 2], "step": [1, 0, 0.4], "centered": true }
      }
    }
  ]
}
EOF
scene-forge -p garage apply --file workbench.batch.json --dry-run
cat workbench.batch.json | scene-forge -p garage apply --file -
```

Guarded edit, reading the current revision and state hash first (Node is already
required, so it doubles as the JSON reader):

```sh
state=$(scene-forge -p garage --compact inspect)
rev=$(printf '%s' "$state" | node -p 'JSON.parse(require("fs").readFileSync(0, "utf8")).data.revision')
hash=$(printf '%s' "$state" | node -p 'JSON.parse(require("fs").readFileSync(0, "utf8")).data.stateHash')
scene-forge -p garage node transform pallet --at 1,0.075,0.2 --expected-revision "$rev" --expected-state "$hash"
scene-forge -p garage scene restore 1 --expected-revision "$((rev + 1))"
```

The restore creates a new revision containing revision 1's scene; history is kept.

### Inspection and quality

| Command | Options |
|---|---|
| `inspect` | `--id <id>` (one node), `--source` (include the complete scene document). Revision, `stateHash`, compiled statistics |
| `validate` | none. Schema, references, parameters and actual geometry compilation |
| `audit` | `--file`/`--data` (quality policy), `--model <id>`, `--node <id>`, `--parameters <json>`, `--strict` (warnings fail). Visible geometry only |

```sh
cat > garage.policy.json <<'EOF'
{
  "schemaVersion": 1,
  "kind": "quality-policy",
  "maxTriangles": 20000,
  "maxMeshes": 100,
  "maxMaterials": 8,
  "maxExtent": 20,
  "allowTransparency": false
}
EOF
scene-forge -p garage inspect
scene-forge -p garage inspect --id crateB
scene-forge -p garage inspect --source --compact
scene-forge -p garage validate
scene-forge -p garage audit --file garage.policy.json
scene-forge -p garage audit --model crate --parameters '{"width":2}' --strict
```

A failed gate is `QUALITY_GATE_FAILED` with the complete report in
`error.details.findings`. Policy fields: `maxTriangles`, `maxMeshes`,
`maxMaterials`, `maxGeometries`, `maxExtent` (meters), `allowTransparency`,
`allowDoubleSided`, `requireUVs`; omitted limits impose no budget.

### Export and preview

| Command | Options |
|---|---|
| `export` | `-o, --out <path>` (required), `-f, --format glb\|gltf\|obj\|stl\|three` (default `glb`), `--validate` (Khronos glTF-Validator before writing; GLB/glTF), `--node <id>`, `--model <id>`, `--parameters <json>` |
| `preview` | `-o, --out <path>` (default `preview.html`), `--all-scenes`, `--model <id>`, `--node <id>`, `--parameters <json>`, `--serve`, `--port <port>` (default 0: any free port) |

```sh
scene-forge -p garage export --format gltf --validate --out garage/exports/yard.gltf
scene-forge -p garage export --format obj --out garage/exports/yard.obj
scene-forge -p garage export --format stl --out garage/exports/yard.stl
scene-forge -p garage export --format three --out garage/exports/yard.three.json
scene-forge -p garage export --node crateB --out garage/exports/crateB.glb
scene-forge -p garage export --model crate --parameters '{"bands":4}' --out garage/exports/crate4.glb
scene-forge -p garage preview --model crate --parameters '{"bands":4}' --out garage/exports/crate.html
scene-forge -p garage preview --all-scenes --out garage/exports/workshop.html
```

Physical materials support `sheen`, `sheenColor`, `sheenRoughness`, `clearcoat`
and `clearcoatRoughness`. Scalar values are 0–1; colors use `#RRGGBB`. Omitted
fields keep legacy standard shading. Sheen is useful for soft cloth and fur
surfaces; clearcoat adds a polished layer for eyes, glazed props and varnish.
These controls require standard PBR shading; unlit materials do not light them.
GLB/glTF preserve them through `KHR_materials_sheen` and
`KHR_materials_clearcoat`; Littlewild import/export preserves the same values.
Littlewild node `materialProps` are merged over their base material into isolated,
deduplicated editable slots, preserving individual nose, cheek and ear finishes.
Equal values on differently named base roles remain separate. Per-node overrides
are baked into new slots: downstream appearance palettes must target those slots
explicitly when recoloring an edited definition; source behavioral palette
inheritance is not rewritten automatically.
Littlewild mesh `castShadow` and `receiveShadow` flags currently use Scene Forge’s
mesh defaults after import. A native shadow decal may therefore cast an additional
contact shadow in lit previews; GLB does not carry engine-specific shadow flags.
Material opacity and depth-write behavior are retained.
Native shadow decals preserve `depthWrite: false` together with alpha blending
and opacity below 1. GLB represents these with `alphaMode: BLEND`; Scene Forge
recipes, previews and Littlewild output retain the explicit depth setting.
Imports reject opaque `depthWrite: false`, transparency inconsistent with `opacity < 1`,
and emission above 20 with `LITTLEWILD_MATERIAL_UNSUPPORTED`; change those source
settings explicitly before importing. Scene Forge does not silently approximate
them.
The material inspector exposes these fields under **Soft fabric & polished
surfaces**. Full `putMaterial` definitions replace the previous material.

For a warm artboard-like review, set `environment.presentation` to `portrait`,
with a pale background, or use **Use portrait studio** in the viewer. This adds
a warm rim light and a soft shadow receiver in the preview only. Inspection
remains available as `inspection`; existing recipes retain their previous look.
The presentation setting is retained by scene bundles and guarded edits, and
applies to screenshots and review captures. It never adds geometry or lights to
the exported GLB. `setEnvironment` replaces the environment, so retain any
custom intensity and key position values you want to keep.

Example operations for a guarded `apply` batch (read revision/state first):

```json
{
  "operations": [
    { "op": "putMaterial", "id": "softCoat", "material": {
      "color": "#bc8151", "roughness": 0.88,
      "sheen": 0.75, "sheenColor": "#ffe3bc", "sheenRoughness": 0.8
    } },
    { "op": "setEnvironment", "environment": {
      "presentation": "portrait", "background": "#eee7d8",
      "ambient": 1.1, "keyIntensity": 3.2, "keyPosition": [5, 10, 7],
      "exposure": 1, "toneMapping": "filmic"
    } }
  ]
}
```

GLB is the primary format (Blender: File → Import → glTF 2.0; Three.js:
`GLTFLoader`; Godot: copy the `.glb` into the project). glTF embeds its buffer;
OBJ omits materials; STL omits materials, hierarchy and units. Hidden subtrees are
not exported, and `--node` keeps the subtree's world transform. `preview --serve`
serves the viewer on `127.0.0.1` and rebuilds it on every browser refresh until
Ctrl+C:

```text
scene-forge -p garage preview --serve --port 8080
```

The HTML is fully offline (Three.js and the scene data are embedded). **Save
edits** downloads a guarded transaction file; pass it to `apply --file` with
`--dry-run`, then without. The HTML never writes project files itself; regenerate
it after applying edits or importing models.

### Bundles and examples

| Command | Options |
|---|---|
| `example list` | none. Bundled examples, their models, features and statistics |
| `example show <id>` | `--raw` (bare `scene-bundle` JSON) |
| `example create <id> <directory>` | none. New project from an example; returns `nextCommands` |

```sh
scene-forge -p garage scene pack --out garage/exports/yard.recipe.json
scene-forge scene unpack restored --file garage/exports/yard.recipe.json
scene-forge -p restored validate
scene-forge example list --compact
scene-forge example show courtyard --raw > courtyard.scene-bundle.json
scene-forge scene unpack courtyard --file courtyard.scene-bundle.json
scene-forge example create animationLab motion
```

### Littlewild / Wildlands exchange

These commands publish Scene Forge models as asset definitions of the
[Wildlands](../../source/wildlands/DOCUMENTATION.md) engine and import existing
definitions back as editable models. The task guide
[Author Littlewild assets in Scene Forge](../how-to/scene-forge-littlewild-assets.md)
covers rig roles, mesh budgets and manifests.

| Command | Options |
|---|---|
| `littlewild sync` | `--file <path>` (required `littlewild-export` manifest), `--asset <id>`, `--dry-run`, `--check` (fail with `LITTLEWILD_STALE`, never write) |
| `littlewild export` | `--model <id>` and `--out <family>/<id>/definition.json` (required), `--family items\|buildings\|creatures\|pets`, `--variant <name>`, `--name <name>`, `--parameters <json>`, `--materials <json>`, `--dry-run` |
| `littlewild import` | `--definition <path>` (required), `--prefix <id>`, `--dry-run`, `--replace`, `--expected-revision <n>`, `--expected-state <hash>` |

`littlewild import` accepts a `littlewild-definition`, a raw `littlewild-3d-asset`,
or a version 1 `littlewild-creature-package` exported by Character Studio. Package
imports use `appearanceManifest` and report `importedFacet: "visual"`; gameplay,
companion state, behavior mappings and actor rig bindings stay in the source
package. Keep the source recipe for Character Studio; externally edited visuals
continue in Scene Forge and are rejected by the Studio recipe importer to prevent
loss of advanced edits. Export changed visuals into the existing Littlewild
definition to retain its gameplay and actor rig. Read `inspect` for the revision
and state hash, then pass both guards when
replacing existing models to reject intervening edits. Dry runs validate the same
model dependency closure without writing.

A manifest's `target` is relative to the manifest file; `--file` and
`--definition` are relative to the working directory. From the repository root,
confirm that the Pocket Pet definitions match their recipes:

```sh
scene-forge -p source/scene-forge/examples/pocket-pet littlewild sync --file source/scene-forge/examples/pocket-pet/littlewild.export.json --check
```

### Rigs and animation

| Command | Options |
|---|---|
| `rig inspect <node>` | none. Joints, clips, bindable mesh paths and guards |
| `rig bind <node>` | `--file`, `--data`, guards, `--dry-run`. Replaces the instance's rig |
| `rig pose <node>` | `--joint <id>` (required), `--rotation <x,y,z>` (required, absolute local degrees), guards, `--dry-run` |
| `rig remove <node>` | guards, `--dry-run` |

Rigs attach to model instances without authored children. GLB/glTF keep joints,
skin weights and rotation clips; OBJ/STL do not.

```sh
cat > arm.rig.json <<'EOF'
{
  "joints": [
    { "id": "root", "position": [0, 0, 0] },
    { "id": "upper", "parent": "root", "position": [0, 0.4, 0] }
  ],
  "binding": "smooth",
  "bindings": {},
  "pose": { "upper": [0, 0, 10] },
  "clips": [
    {
      "id": "sway",
      "duration": 2,
      "tracks": [
        {
          "joint": "upper",
          "keyframes": [
            { "time": 0, "rotation": [0, 0, 0] },
            { "time": 1, "rotation": [0, 0, 15] },
            { "time": 2, "rotation": [0, 0, 0] }
          ]
        }
      ]
    }
  ]
}
EOF
scene-forge -p garage rig bind crateA --file arm.rig.json --dry-run
scene-forge -p garage rig bind crateA --file arm.rig.json
scene-forge -p garage rig inspect crateA
scene-forge -p garage rig pose crateA --joint upper --rotation 0,0,20
scene-forge -p garage rig remove crateA
scene-forge -p motion rig inspect wave
scene-forge -p motion rig pose wave --joint rightArm --rotation 0,0,110
scene-forge -p motion export --validate --out motion/exports/animated.glb
```

### Rendering

| Command | Options |
|---|---|
| `doctor` | none. Node version, Playwright resolution, Chromium path |
| `screenshot` | `-o, --out <path>` (required PNG), `--view iso\|front\|back\|right\|left\|side\|top\|bottom\|authored\|orbit` (default `iso`), `--width <px>` (1600), `--height <px>` (1000), `--azimuth <deg>` (45), `--elevation <deg>` (30), `--projection auto\|perspective\|orthographic`, `--padding <factor>` (1.12), `--model <id>`, `--node <id>`, `--parameters <json>`, `--grid`, `--wireframe`, `--ui` |
| `review` | `-o, --out <directory>` (required), `--file <plan>`, `--views <names>` (default `iso,front,right,back,left,top`), `--turntable <count>` (2–36), `--elevation <deg>` (25), `--width`/`--height` (64–2048, default 800×600), `--projection`, `--padding` (1.02–3), `--grid`, `--wireframe`, `--no-contact-sheet`, `--overwrite`, `--model <id>`, `--node <id>`, `--parameters <json>`, `--background <#rrggbb>` |

`screenshot` and `review` need Playwright (see [Requirements](#requirements));
without it they fail with `PLAYWRIGHT_UNAVAILABLE` and `details.remedies`. A
review writes one PNG per frame, `contact-sheet.png`, `review.json` (cameras,
source/render hashes, environment) and `replay-plan.json` for fixed-camera
comparisons. Rendering never changes the source or its revision. Capture loads the self-contained
viewer as inline HTML, so browser restrictions on `file://` URLs do not prevent
`screenshot` or `review`, and no local HTTP server is needed.

```sh
cat > review.plan.json <<'EOF'
{
  "schemaVersion": 1,
  "kind": "review",
  "width": 640,
  "height": 480,
  "frames": [
    { "id": "overview", "camera": { "view": "iso" } },
    { "id": "front", "camera": { "view": "front", "padding": 1.2 } },
    { "id": "rear-detail", "camera": { "view": "orbit", "azimuth": 140, "elevation": 20, "projection": "orthographic" } }
  ]
}
EOF
scene-forge doctor
scene-forge -p garage screenshot --out garage/exports/yard.png --width 800 --height 500
scene-forge -p garage screenshot --node crateB --view orbit --azimuth 135 --elevation 20 --out garage/exports/crateB.png
scene-forge -p garage review --file review.plan.json --out garage/exports/review-plan
scene-forge -p garage review --model crate --turntable 4 --width 256 --height 256 --out garage/exports/turntable
scene-forge -p garage review --file garage/exports/review/replay-plan.json --out garage/exports/review-after
```

## File formats

Every format has a JSON Schema: `scene-forge schema --kind <kind> --raw`. The same
schemas are checked in under
[source/scene-forge/schemas](../../source/scene-forge/schemas/scene.schema.json).
Unknown keys are errors. Scalars in geometry dimensions, transforms, pattern values
and instance parameter overrides may be a number, `{"$param": "<name>"}` or
`{"$expr": "<op>", "args": [...]}` with `add`, `mul`, `min`, `max` (1–16 args),
`sub`, `div` (2), `abs`, `neg`, `sin`, `cos` (1, degrees) and `clamp` (3). Expressions
nest at most 16 levels and must stay within ±1,000,000.

| Kind | File | Minimal working example in this page |
|---|---|---|
| `project` | `forge.project.json` | written by `init`; below |
| `scene` | `scenes/<id>.scene.json` | below |
| `model` | `models/<id>.model.json` or any file for `model import` | `crate.model.json` in [Quick start](#quick-start) |
| `batch` | any file for `apply` | `workbench.batch.json` in [Scene editing](#scene-editing) |
| `composition` | any file for `scene compose` | `yard.composition.json` in [Quick start](#quick-start) |
| `quality-policy` | any file for `audit` | `garage.policy.json` in [Inspection and quality](#inspection-and-quality) |
| `review` | any file for `review --file` | `review.plan.json` in [Rendering](#rendering) |
| `rig` | any file for `rig bind` | `arm.rig.json` in [Rigs and animation](#rigs-and-animation) |
| `model-bundle`, `scene-bundle` | written by `model export`, `scene pack`, `example show --raw` | [Bundles and examples](#bundles-and-examples) |
| `littlewild-export` | any file for `littlewild sync --file` | `littlewild.export.json` in the [Pocket Pet example](../../source/scene-forge/examples/pocket-pet/littlewild.export.json) |

The manifest written by `init garage` after the steps above:

```text
{
  "schemaVersion": 1,
  "name": "Garage props",
  "activeScene": "main",
  "scenes": {
    "main": "scenes/main.scene.json",
    "night": "scenes/night.scene.json",
    "variant": "scenes/variant.scene.json"
  },
  "models": {
    "crate": "models/crate.model.json"
  }
}
```

Paths are project relative and registered IDs must match their files. Prefer
commands for edits, but a scene file may also be written directly while no command
is running. A minimal complete scene, replacing the empty `main` scene of a new
project:

```sh
cat > crate.scene.json <<'EOF'
{
  "schemaVersion": 1,
  "kind": "scene",
  "id": "main",
  "name": "Crate",
  "materials": { "paint": { "color": "#e99045", "roughness": 0.6 } },
  "geometries": { "cube": { "type": "box", "size": [1, 1, 1] } },
  "nodes": [
    { "id": "crate", "type": "mesh", "geometry": "cube", "material": "paint", "transform": { "position": [0, 0.5, 0] } }
  ]
}
EOF
scene-forge init single
cp crate.scene.json single/scenes/main.scene.json
scene-forge -p single validate
scene-forge -p single export --out single/crate.glb
```

Batch operations: `putNode`, `patchNode`, `patchNodes`, `removeNode`,
`duplicateNode`, `reparentNode`, `groupNodes`, `groundNode`, `placeNode`,
`putGeometry`, `removeGeometry`, `putMaterial`, `removeMaterial`, `setParameter`,
`setCamera`, `setEnvironment`. A batch may carry top-level `scene`,
`expectedRevision` and `expectedState`. Geometry types: `box`, `sphere`,
`cylinder`, `cone`, `torus`, `capsule`, `plane`, `tube`, `lathe`, `extrude`
(profile with optional holes and bevel), `mesh` (indexed triangles with optional
`normals`/`uvs`) and `boolean` (`union`, `subtract`, `intersect`). Patterns:
`linear`, `radial`, `grid` (at most 256 copies) and `path`. Materials are
metallic/roughness PBR or unlit. `scene-forge catalog` lists the current set.

## Common workflows

**Change an existing project safely.** `inspect` → note `revision` and `stateHash`
→ build a batch → `apply --dry-run` → `apply --expected-revision R --expected-state
H` → `validate` → `audit` → `review` → `export --validate`. On
`REVISION_CONFLICT`/`STATE_CONFLICT`, inspect again and rebuild the batch.

**Start from an example.** `example list` → `example create <id> <dir>` → follow
the returned `nextCommands`.

**Reuse models across projects.** `model capture` (from scene nodes) or
`model export` → `model import --dry-run` → `model import` in the other project →
`model instantiate` or `scene compose`. Use `--replace` only to change an existing
definition deliberately; every scene is revalidated first.

**Freeze a deliverable.** `export --validate --out <file>.glb` for engines and
`scene pack --out <file>.json` for an editable recipe with its model closure.
History and other scenes are not included; use Git for full project history.

**Compare renders across edits.** `review --out before`, edit, then
`review --file before/replay-plan.json --out after` reuses the same cameras.

## For AI agents

1. Discover, do not guess: `scene-forge catalog --compact`,
   `scene-forge describe <command path> --compact`, and
   `scene-forge schema --kind <kind> --raw` before writing JSON. Unknown keys fail.
2. Always parse stdout as JSON when the exit status is 0 and stderr as JSON when it
   is 1. Branch on `error.code`, follow `error.hint`, and read `error.details`
   (for batches, `details.operationIndex` is zero-based). Use `--compact` to save
   tokens; it changes formatting only.
3. Use stable, descriptive IDs and complete definitions. `put*` replaces;
   `patch*` merges. Preserve fields you want to keep.
4. Dry-run every mutation, then apply with `--expected-revision` and
   `--expected-state` from the latest read. Never retry a conflict blindly and
   never remove `.forge.lock`.
5. Validate before exporting: `validate`, then `audit --file <policy>` (add
   `--strict` to fail on warnings), then `export --validate` for GLB/glTF.
6. Treat structural validity as necessary, not sufficient. When Playwright is
   available, `review` and look at `contact-sheet.png`; otherwise say that no
   visual check ran. `doctor` tells you which case applies.
7. Write each review to a new directory; `review` refuses a non-empty directory
   unless `--overwrite`. Other outputs replace their target file atomically.
8. Responses contain absolute paths of written files; use them directly.
9. Commands are stateless between invocations and never prompt. Environment
   inputs are limited to `NODE_PATH` (Playwright lookup), `FORGE_CHROMIUM_PATH` and
   Playwright's own variables such as `PLAYWRIGHT_BROWSERS_PATH`.
10. Identical recipes produce identical exports with the same build. Pixel-identical
    screenshots across machines are not promised.

Limits: 20,000 expanded objects, 2,000,000 triangles, 256 pattern copies, model
depth 16, 32 authored lights, 16 MiB per JSON input. Not supported: inverse
kinematics, weight painting, sculpting, external image texture import and automatic
UV unwrapping, physics,
mesh import, native `.blend`/`.tscn` output, arbitrary scripts or GLSL.

## Rebuild and verify the executable

`bin/scene-forge` is generated from `source/scene-forge` and must be committed
whenever that source changes:

```text
cd source/scene-forge
npm ci
npm run build:cli    # rewrites ../../bin/scene-forge (npm run build also does this)
npm run check:cli    # rebuilds into a temporary directory; exits 1 if the checked-in file differs
```

The build is a single CommonJS file with a `#!/usr/bin/env node` line, minified,
without source maps, timestamps or absolute paths, so the same sources and locked
dependencies produce identical bytes. Its header comment reproduces the license
and notice texts of every bundled package. For development without rebuilding,
`npm run cli -- <arguments>` runs the TypeScript source as `forge3d`.

## Further reading

- [Scene Forge README](../../source/scene-forge/README.md): capabilities, export
  targets, editor and release history.
- [Agent operating guide](../../source/scene-forge/docs/AGENT_WORKFLOW.md):
  procedural values, selectors, review plans and quality gates in depth.
- [Examples](../../source/scene-forge/docs/EXAMPLES.md),
  [rigging](../../source/scene-forge/docs/RIGGING.md) and
  [editor extensions](../../source/scene-forge/docs/EDITOR_EXTENSIONS.md).
- [Architecture](../../source/scene-forge/docs/ARCHITECTURE.md) and
  [code quality map](../../source/scene-forge/docs/CODE_QUALITY.md).
- [Contributor instructions](../../source/scene-forge/AGENTS.md) and
  [third-party notices](../../source/scene-forge/THIRD_PARTY_NOTICES.md).


### Maintaining shared Littlewild meshes

A material-only refinement preserves the exact authored mesh buffers, including
positions, normals, UVs and indices. Export reuses equal buffers across retained
variants and removes unreferenced mesh resources. Equality includes all buffers:
small shape changes or different UV placement remain distinct. Mesh names are
collision-safe; an existing ID never silently replaces a different retained mesh.
Keep the original definition wrapper when replacing one variant so gameplay,
rig bindings and other variants remain available.

The complete exported visual is checked against the engine's **400,000 JSON
values and depth 32** limits, in addition to per-mesh and total vertex budgets.
This counts every JSON value, not only mesh numbers. An over-budget export fails
with `LITTLEWILD_BUDGET` before writing; reduce segments, reuse geometry or remove
unneeded variants. Dry-run and then export the same source. Repeated material
refinements do not accumulate copies of unchanged authored mesh data.
