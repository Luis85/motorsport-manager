# Scene Forge — TypeScript 3D authoring for agents

A working v0.6 **CLI 3D editor and scene composer**. Create projects, describe models and scenes in JSON, apply validated edits, export geometry, inspect an offline Three.js preview, and capture PNGs through headless Chromium.

The editable recipe is the source of truth. Generated meshes are build outputs. This makes procedural models reviewable in Git and easier for agents to change reliably.

This standalone concept has its own Node package, schemas, build and verification. Run the commands below from `docs/concepts/scene-forge/`.

## Start here

Requires **Node.js 22+**. Install and build from this directory:

```bash
npm ci
npm run build
node dist/cli.js --help
```

For the shorter `forge3d` command, run `npm link` once. All examples below assume that alias; `node dist/cli.js` works without it.

Try the eight-scene workshop, including primitives, characters, everyday props, industrial assemblies and animated rigs:

```bash
forge3d -p examples/showcase preview --all-scenes --out workshop.html
forge3d example list
forge3d example create animationLab my-motion
forge3d -p my-motion export --validate --out animated.glb
```

Open `workshop.html` directly in a WebGL 2 capable browser. Choose a scene, browse model categories, add objects, change materials, author lights and bind/pose a rig. **Save bundle** downloads the editable scene and model recipes; **Save edits** downloads a guarded transaction for the existing project. The HTML bundles Three.js and all required data without a server or CDN. The ready-built workshop is in `examples/showcase/exports/`.

See [example recipes](./docs/EXAMPLES.md), [rigging and animation](./docs/RIGGING.md), and [editor extension contracts](./docs/EDITOR_EXTENSIONS.md). The editor now uses registered tools with snapshot reads, one transactional edit port and explicit lifecycle hooks.

Screenshots additionally require Chromium:

```bash
npx playwright install chromium
# Linux hosts missing browser system libraries:
# npx playwright install --with-deps chromium
forge3d doctor
forge3d -p examples/outpost screenshot --out outpost.png --view iso
```

You can use an existing Chromium executable with `FORGE_CHROMIUM_PATH`. A browser is required only for screenshot capture and viewing; geometry generation and GLB export run in Node.js.

## Fast agent loop

```bash
forge3d describe review --compact
forge3d scene unpack my-assets --file examples/logistics.scene-bundle.json
forge3d -p my-assets node list --tag storage --details
forge3d -p my-assets node edit --tag storage --data '{"parameters":{"height":3.5}}' --dry-run
forge3d -p my-assets node edit --tag storage --data '{"parameters":{"height":3.5}}'
forge3d -p my-assets audit --file examples/quality.policy.json
forge3d -p my-assets review --out my-assets/exports/review
forge3d -p my-assets export --validate --out my-assets/exports/scene.glb
forge3d -p my-assets scene pack --out my-assets/exports/scene.recipe.json
```

`review` creates six PNGs, a labeled `contact-sheet.png`, and `review.json` containing camera settings, source hashes, bounds and output paths. It compiles once and reuses one headless browser session. Open the contact sheet first, then inspect individual full-resolution frames where needed. For coordinated work, include the revision/state guards returned by inspection.

The [agent operating guide](./docs/AGENT_WORKFLOW.md) covers the complete loop, procedural expressions, selectors, review plans and portable source bundles. The new `examples/procedural` project shows rack dimensions, shelf counts and nested cargo dimensions derived from parameters.

## Authoring and editor improvements in v0.6

- Eight demo scenes and 43 reusable models; searchable, categorized asset palette and offline scene navigation.
- Capped spline tubes, explicit path patterns and integer model parameters.
- Authored point/spot/directional lights, per-instance PBR/unlit material editing, and preview tone mapping/exposure.
- Model-instance skeletons, automatic or explicit part skinning, joint pose editing, keyframes and clip playback; portable GLB skins and rotation animations.
- Extensible editor tools with shared undo, rollback, guarded batches, recipe bundles and separate rendering/resource ownership.

## Architecture and reliability improvements in v0.5

The [code quality report](./docs/CODE_QUALITY.md) details the refactor and evidence. The CLI now has an import-safe factory and focused command groups. Pure edit preparation is separated from persistence; compilation owns pooled resources explicitly; screenshot and review share a capture adapter; the editor separates history, prototypes, viewport and panels.

This pass fixes failed-edit/undo rollback, resource cleanup and operation-input aliasing. Production TypeScript has no explicit `any`. Automated checks enforce dependency boundaries, detect runtime import cycles and keep large modules from growing unchecked. The v0.5 refactor passed 63 tests and preserved the three original example GLB byte streams. Current release results are in `./docs/checks.json` and `./docs/showcase-verification.json`.

## Quality and portability improvements in v0.4

The [research report](./docs/RESEARCH.md) covers 15 primary sources, product perspectives, implemented decisions and the remaining roadmap. This pass adds:

- `audit` with JSON quality policies, visible-only budgets, degeneracy checks and actionable failures.
- Shared compiled geometry/materials across repeated model instances. The logistics GLB is 53.6% smaller, with unchanged node and triangle counts.
- Custom mesh `normals` and `uvs`, validated per vertex and preserved in GLB.
- `export --validate` using Khronos validation before writing; subtree exports retain ancestor transforms to preserve world placement.
- `replay-plan.json` from every review, with fixed cameras and renderer-version metadata. Reuse via `review --file previous/replay-plan.json --out next`.
- Editor **Copy review plan** and **Save review plan**, preserving projection and zoom, including orthographic views.
- A 16 MiB UTF-8 byte limit across JSON files, stdin and inline input.

```bash
forge3d -p examples/procedural audit --file examples/quality.policy.json
forge3d -p examples/procedural review --out review-before
# Apply scene/model edits, then reuse exactly the same cameras:
forge3d -p examples/procedural review --file review-before/replay-plan.json --out review-after
forge3d -p examples/procedural export --validate --out logistics.glb
```

Quality failures return `QUALITY_GATE_FAILED`, exit 1, with the report in `error.details`. `--strict` also rejects warnings. `audit --model <id> --parameters <json>` and `audit --node <id>` isolate deliverables. A quality gate does not certify manifold geometry, collision-free placement or native Blender/Godot imports.

## Create your first project

```bash
forge3d init my-game-assets --name "My game assets"
forge3d -p my-game-assets apply --file examples/quick-start.batch.json --dry-run
forge3d -p my-game-assets apply --file examples/quick-start.batch.json --expected-revision 0
forge3d -p my-game-assets add cylinder wheel --radius 0.4 --height 0.25 --rotate 0,0,90 --at 1,0.4,0
forge3d -p my-game-assets inspect --source
forge3d -p my-game-assets preview --out my-game-assets/exports/preview.html
forge3d -p my-game-assets export --format glb --out my-game-assets/exports/model.glb
```

The CLI finds the closest parent project when `--project` is omitted. `--scene <id>` selects a scene for one command without changing the active scene.

## Implemented capabilities

| Area             | Implemented                                                                                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Projects         | Manifest, named scenes, active scene, model registry, source history                                                                                            |
| Modeling         | Box, sphere, cylinder, cone, torus, capsule, plane, lathe, capped spline tubes, extrusion with holes and bevel, indexed triangle mesh with optional normals/UVs |
| Boolean modeling | Union, subtraction and intersection of named geometries, with operand transforms                                                                                |
| Composition      | Declarative scene recipes, model placement, subtree duplication, groups, reparenting, grounding and relative alignment                                          |
| Reuse            | Capture scene selections as models; portable dependency bundles; parametric instances, nesting and material overrides                                           |
| Repetition       | Linear, radial, 3D grid and explicit path patterns with parameterized counts on mesh or model nodes                                                             |
| Materials        | Standard metallic/roughness PBR and unlit shading, emissive color, opacity, double-sided and flat-shading preview flags                                         |
| Agents           | JSON Schemas, structured responses, stdin, dry-run, transaction batches, revision and scene/library state guards, idempotent upserts                            |
| Export           | GLB, embedded glTF, Three.js ObjectLoader JSON, geometry-only OBJ, binary STL                                                                                   |
| Composer         | Offline model palette, authored hierarchy, transform gizmos and numeric fields, snap, undo/redo, duplicate, ground, remove and guarded edit downloads           |
| Review           | Camera views, wireframe, grid, frame selection, source recipes, standalone model preview and live GLB export                                                    |
| Capture          | PNG from CLI or browser, specified dimensions and camera view, optional preview UI                                                                              |
| Recovery         | Scene snapshot history and restore as a new revision                                                                                                            |

This is procedural hard-surface modeling, not full Blender parity. Inverse kinematics, manual vertex weight painting, sculpting, visual UV editing/unwrapping, image textures, arbitrary mesh import, physics, native `.blend`/`.tscn` authoring and a visual mesh editor are not implemented. See [the architecture and roadmap](./docs/ARCHITECTURE.md).

## Agent and review commands added in v0.3

| Command                                                                              | Purpose                                                    |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `describe node edit`                                                                 | JSON description of arguments, flags, defaults and choices |
| `node list --tag storage --details --limit 20`                                       | Query authored objects with world bounds and pagination    |
| `node edit --tag storage --data '{"visible":false}'`                                 | Transactionally patch a filtered selection                 |
| `model import --file model.json --dry-run`                                           | Validate a model/library change without writing            |
| `model inspect rack --parameters '{"height":4}'`                                     | Measure a parameter variant                                |
| `review --out exports/review`                                                        | Six views, contact sheet and camera/source manifest        |
| `review --model rack --parameters '{"width":4}' --turntable 8 --out exports/rack`    | Review a standalone variant from orbit views               |
| `review --node rackB --file examples/review.plan.json --out exports/detail`          | Review one subtree using a data-driven plan                |
| `screenshot --node rackB --view orbit --azimuth 135 --elevation 25 --out detail.png` | Capture a specific angle                                   |
| `export --model rack --parameters '{"width":4}' --out rack.glb`                      | Export a standalone model variant                          |
| `scene pack --out scene.recipe.json`                                                 | Freeze scene source and all nested model dependencies      |
| `scene unpack restored --file scene.recipe.json`                                     | Restore a bundle to a new project directory                |

## Command reference

| Command                                                              | Purpose                                                             |
| -------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `catalog`                                                            | Discover capabilities, conventions, limits and unsupported features |
| `schema --kind scene --raw`                                          | Print a JSON Schema directly for validators                         |
| `init <directory> --name <name>`                                     | Create a project                                                    |
| `scene list / create <id> / use <id> / clone <id>`                   | Manage scenes and variations                                        |
| `scene compose --file layout.json`                                   | Upsert groups and model instances from a composition recipe         |
| `scene restore <revision>`                                           | Restore a saved scene as a new revision                             |
| `model list / inspect <id>`                                          | Inspect registered models, parameters and dependencies              |
| `model capture crate --nodes assembly`                               | Save selected authored nodes as a reusable model                    |
| `model export crate --out crate.models.json`                         | Bundle a model and its transitive dependencies                      |
| `model import --file model.json`                                     | Validate and copy a model into the project                          |
| `model import --file model.json --replace`                           | Replace a model after validating every scene                        |
| `model instantiate rover scout --parameters '{"wheelRadius":0.6}'`   | Place a parametric model                                            |
| `add box body --size 2,1,3 --at 0,0.5,0`                             | Quickly add a primitive                                             |
| `put geometry bodyGeo --data '{"type":"box","size":[2,1,3]}'`        | Upsert an entire geometry definition                                |
| `put material paint --data '{"color":"#e99045"}'`                    | Upsert a material                                                   |
| `put node body --file node.json`                                     | Upsert an entire node                                               |
| `node transform scout --at 2,0,3 --rotate 0,45,0`                    | Update local transform components                                   |
| `node patch scout --data '{"name":"Scout Alpha"}'`                   | Merge selected node properties                                      |
| `node duplicate scout scoutB --offset 3,0,0`                         | Duplicate an authored subtree                                       |
| `node group fleet --nodes scout,scoutB`                              | Group sibling roots without moving them                             |
| `node reparent scout --parent fleet`                                 | Change parent while preserving world placement                      |
| `node ground scout --y 0`                                            | Place its lowest point on a world Y plane                           |
| `node place scoutB --to scout --side right --gap 1`                  | Arrange using world-space bounds                                    |
| `remove body --cascade`                                              | Remove a node and its descendants                                   |
| `apply --file operations.json`                                       | Apply a validated multi-operation transaction                       |
| `apply --file -`                                                     | Read a transaction from stdin                                       |
| `validate`                                                           | Validate source and actually compile geometry                       |
| `inspect --source / --id body`                                       | Get bounds, triangle counts, source or node details                 |
| `export --format glb --out model.glb --node scout`                   | Export the scene or one subtree                                     |
| `preview --out scene.html`                                           | Build a portable HTML scene composer                                |
| `preview --model rover --out rover.html`                             | Inspect a standalone model                                          |
| `preview --serve --port 8080`                                        | Serve locally; rebuild on browser refresh                           |
| `screenshot --out scene.png --view front --width 1600 --height 1000` | Capture the scene                                                   |
| `screenshot --out ui.png --ui --grid`                                | Capture the review interface                                        |
| `doctor`                                                             | Report runtime and browser installation                             |

Scene edit commands accept `--dry-run`, `--expected-revision` and `--expected-state`. `scene restore` currently supports the revision guard only. Use `--help` on any command. For a negative first vector component, use `--at=-2,0,0` to avoid flag ambiguity.

`put` replaces the complete object identified by the ID, rather than merging its fields. Inspect before changing an existing definition. Repeating an identical edit leaves the revision unchanged.

## Compose scenes with your models

Capture a single assembly or a selection of sibling roots:

```bash
forge3d -p my-game-assets model capture cargo --nodes body,wheel --name "Cargo assembly"
forge3d -p my-game-assets model inspect cargo
forge3d -p my-game-assets model export cargo --out cargo.models.json
forge3d init my-level
forge3d -p my-level model import --file cargo.models.json
forge3d -p my-level model instantiate cargo cargoA --at 0,0,0
forge3d -p my-level node ground cargoA
forge3d -p my-level node duplicate cargoA cargoB --offset 3,0,0
forge3d -p my-level node place cargoB --to cargoA --side right --gap 0.5
forge3d -p my-level preview --out my-level/exports/composer.html
```

A captured single root has its position reset to zero; its rotation and scale remain. Multiple roots retain their shared parent coordinate frame. Only used geometries/materials are copied, scene parameter references are baked to their current defaults, and nested models stay linked. A model bundle includes all nested dependencies for transfer to another project.

For a complete declarative layout, use a composition file:

```json
{
  "schemaVersion": 1,
  "kind": "composition",
  "scene": "main",
  "groups": [{ "id": "supplies", "name": "Supply depot" }],
  "instances": [
    { "id": "cargoA", "model": "cargo", "parent": "supplies" },
    {
      "id": "cargoB",
      "model": "cargo",
      "parent": "supplies",
      "transform": { "position": [3, 0, 0], "rotation": [0, 45, 0] }
    }
  ]
}
```

```bash
forge3d -p my-level scene compose --file layout.json --dry-run
forge3d -p my-level scene compose --file layout.json
```

Composition upserts the listed groups and instances by ID and leaves unmentioned nodes in place. Reapplying an unchanged recipe is a no-op. Use a batch when the layout also needs geometry, materials, removal or relative placement. `patchNode` merges supplied transform components and named parameter/material overrides; `putNode` replaces the full definition. Reparenting keeps world placement by default and rejects transforms requiring shear; `--local` retains local coordinates instead. Relative placement uses world-axis bounding boxes; `--keep-other-axes` disables centering on the other axes.

Rebuild the included field station in a fresh project:

```bash
forge3d init my-station
forge3d -p my-station model import --file examples/field-station.models.json
forge3d -p my-station scene compose --file examples/field-station.composition.json
forge3d -p my-station preview --out my-station/exports/composer.html
```

## Edit in the offline composer

- Add registered assets from **Models**. Select authored objects in the scene tree or viewport.
- Use **Q** to select, **W/E/R** to move/rotate/scale, or enter exact local coordinates in the inspector. Rotation is in degrees. Snap steps are 0.25 m, 15°, and 0.1 scale.
- Rename, toggle visibility, duplicate, ground or remove the selection. Undo/redo retains the last 50 local changes; Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z work outside input fields.
- **PNG** and **GLB** export the current browser scene, including local edits.
- **Save edits** downloads a JSON transaction. Apply that file to persist changes:

```bash
forge3d -p my-level apply --file main.edits.json --dry-run
forge3d -p my-level apply --file main.edits.json
```

Use the actual downloaded filename. The transaction records its originating scene, revision and state hash. If the project changed, inspect and regenerate the preview before reconciling the edits; do not blindly discard the guards. Reload the regenerated HTML after applying. HTML cannot write project files directly and does not autosave; download edits before closing. The palette is a snapshot of the model registry, so regenerate after importing or replacing models.

The composer edits instance transforms and basic properties. Geometry, model parameters, material overrides, patterns, grouping and reparenting remain available through the data/CLI surface. Editing a transform resolves that node's parameterized transform to numeric values. Model-only previews are read-only.

## Data contract

Projects have one `forge.project.json`:

```json
{
  "schemaVersion": 1,
  "name": "My game assets",
  "activeScene": "main",
  "scenes": { "main": "scenes/main.scene.json" },
  "models": { "rover": "models/rover.model.json" }
}
```

Paths in the manifest are project relative. Registered scene/model IDs must match their files. IDs start with a letter and contain only letters, digits, underscores and hyphens, up to 64 characters.

A minimal scene:

```json
{
  "schemaVersion": 1,
  "kind": "scene",
  "id": "main",
  "name": "Crate",
  "materials": { "paint": { "color": "#e99045", "roughness": 0.6 } },
  "geometries": { "cube": { "type": "box", "size": [1, 1, 1] } },
  "nodes": [
    {
      "id": "crate",
      "type": "mesh",
      "geometry": "cube",
      "material": "paint",
      "transform": { "position": [0, 0.5, 0] }
    }
  ]
}
```

Canonical conventions: meters, right-handed, **Y up**, model front +Z, local **XYZ Euler angles in degrees**. Node transform order is scale, rotation, translation. Extruded profiles lie in XY and extend along +Z from their origin. Lathe points are `[radius, y]` and revolve around Y. Pivots are the local geometry origin; use a parent group to create another pivot.

Model parameters use explicit references rather than executable expressions:

```json
{
  "schemaVersion": 1,
  "kind": "model",
  "id": "beam",
  "name": "Beam",
  "parameters": { "length": { "default": 2, "min": 0.1, "max": 20 } },
  "materials": { "steel": { "color": "#8899aa", "metalness": 0.7 } },
  "geometries": { "shape": { "type": "box", "size": [{ "$param": "length" }, 0.2, 0.2] } },
  "nodes": [{ "type": "mesh", "id": "body", "geometry": "shape", "material": "steel" }]
}
```

Geometry dimensions, transform components, pattern counts/offsets/angles and model-instance parameter overrides accept literals, `$param` references and bounded `$expr` arithmetic. Model parameters are local to their model; instance overrides resolve in the parent scope before entering the nested model. Scene parameters and model parameter defaults/ranges remain numeric literals. Segment counts remain integer literals. Relational constraints and general scripting are not implemented. See the agent guide for expression operators and examples.

A pattern belongs to one mesh/model node. Grid patterns use X-fastest ordering, then Y, then Z; `centered: true` centers the lattice around its origin. Resolved counts must be positive integers with at most 256 total copies. The node transform moves the pattern as a whole. Linear offsets are measured in local coordinates. Radial patterns lie in local XZ around Y; `sweep / count` defines spacing, so a full circle does not duplicate the end point. Patterned nodes cannot have authored child nodes: put the assembly in a model and pattern the model instance.

Transactions have an `operations` array. Supported operations: `putNode`, `patchNode`, `patchNodes`, `removeNode`, `duplicateNode`, `reparentNode`, `groupNodes`, `groundNode`, `placeNode`, `putGeometry`, `removeGeometry`, `putMaterial`, `removeMaterial`, `setParameter`, `setCamera`, `setEnvironment`. Optional top-level `scene`, `expectedRevision` and `expectedState` fields target and guard the transaction. See `examples/*.batch.json` and `forge3d schema --kind batch --raw`.

## Export into other tools

| Target           | Workflow                                                   | Preservation and limitations                                                                                                                                |
| ---------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Blender          | File → Import → glTF 2.0 → select `.glb`                   | Meshes, hierarchy, transforms and supported PBR material values. Save as `.blend` in Blender afterward. Recipes and boolean history remain in this project. |
| Three.js         | `GLTFLoader.loadAsync('model.glb')`, then add `gltf.scene` | Recommended runtime interchange. `--format three` alternatively produces JSON for `ObjectLoader`.                                                           |
| Godot            | Copy `.glb` into the Godot project and allow import        | Instance the imported scene or create an inherited scene for behavior. Collisions, gameplay scripts and navigation are not generated.                       |
| Other mesh tools | OBJ or STL                                                 | OBJ omits materials; STL omits materials, hierarchy and unit metadata. STL coordinates are meters.                                                          |

GLB is the primary portable format. glTF JSON embeds its geometry buffer in a data URI. Linear/radial patterns and model instances expand to ordinary nodes; the editable source retains their procedural meaning. Booleans bake to triangle meshes at export. Render-only options such as the preview environment, grid and selection helpers do not enter exports. The preview studio camera/lights and display filters are render-only; authored punctual lights do export. Custom GLSL and identical appearance across engines are outside the contract. Flat-shading is a preview flag; author hard edges explicitly if their exported normals matter.

Hidden subtrees are excluded from all mesh export formats. `--node` exports the selected authored subtree while retaining its world transform; it does not center the asset automatically. The export response reports the selected output's statistics. Inspect reports the complete compiled scene, including authored hidden content.

The `.glb` outputs have been checked with the Khronos validator and Three.js data round-trips. Native Blender and Godot editor imports were not run in this environment.

## Agent workflow

1. Discover `catalog`, machine-readable `describe <command path>`, and the necessary `schema`.
2. Inspect the source, current revision and `stateHash`.
3. Produce a batch of complete, explicit definitions with stable IDs.
4. Run `apply --dry-run` to catch schema and geometry errors.
5. Apply with `--expected-revision` and `--expected-state` to detect scene or model-library changes.
6. Run `node list --details` with ID/tag/type/model filters to inspect dimensions and triangle counts.
7. Run `review` for a multi-view contact sheet, or `review --turntable 8` for evenly spaced orbit views.
8. Revise until the asset meets the brief, then export GLB and `scene pack` for editable portability.

Success writes `{ "ok": true, "data": ... }` to stdout. Failure writes `{ "ok": false, "error": { "code", "message", "details", "hint" } }` to stderr and exits with status 1. Help, version, and `schema --raw` are deliberate text/bare-JSON exceptions. `--compact` produces one-line success JSON. There are no prompts or confirmation dialogs. API misuse in the programmatic library throws `ForgeError`.

Useful error codes include `SCHEMA_INVALID`, `REFERENCE_MISSING`, `CYCLE`, `PARAMETER_RANGE`, `INVALID_GEOMETRY`, `REVISION_CONFLICT`, `STATE_CONFLICT`, `SHEAR_UNSUPPORTED`, `PROJECT_LOCKED`, `SCENE_BUDGET`, `BROWSER_UNAVAILABLE`, and `RENDER_FAILED`, `EXPRESSION_ARITY`, `EXPRESSION_DIV_ZERO`, `PATTERN_COUNT`, and `EMPTY_SELECTION`.

See [AGENTS.md](AGENTS.md) for concise repository instructions and [./docs/AGENT_WORKFLOW.md](./docs/AGENT_WORKFLOW.md) for the operating guide.

## Reliability and current boundaries

- A scene transaction is validated and compiled in memory before the scene file is atomically replaced. Failed edits do not partially change that scene.
- CLI reads/writes cooperate through a project lock. Revision guards cover scene edits; `stateHash` also fingerprints the parsed scene and entire model registry, detecting direct edits and model changes on the next guarded command. Direct external file edits bypass the lock, so avoid editing files during a running command.
- History stores scene snapshots only. Restoring an old scene uses the **current** model registry, so it is not a frozen build of prior model definitions. Use Git for full project history. `scene pack` freezes one scene plus its model dependency closure as portable editable data; it does not include history or other scenes.
- Model import/capture validates the resulting model library and every current scene before writing. Identical imports are idempotent; different definitions require `--replace`. Caught model-registration failures roll back writes. Project creation and registry changes span multiple files and are not crash-atomic database transactions; interrupted processes can still need manual recovery.
- There is no `eval`, shell command or arbitrary JavaScript execution in recipes. Supported geometry constructors are implemented in trusted TypeScript. Adding a new constructor requires code plus schema changes.
- Budgets cap expanded objects at 20,000, triangles at 2,000,000, pattern copies at 256 (the grid count product), expression depth at 16, input nesting at 128, model depth at 16, node/geometry depth at approximately 64, and boolean input triangles at 100,000 per operation. This is a local authoring tool, not a sandbox for hostile workloads.
- Booleans need closed, manifold inputs. Coplanar surfaces, self-intersecting profiles and degenerate custom meshes need manual review. This is not a precision CAD kernel or a manifold certification tool.
- Render reproducibility is bounded by browser, GPU and graphics driver. Identical recipes produce deterministic geometry exports in the tested version; pixel-identical screenshots across machines are not promised.

## Develop

```bash
npm run format:check
npm run architecture:check
npm run check
npm run build
npm test
npm run test:e2e  # requires Chromium
# Or run all gates and record machine-readable results:
npm run verify
npm run release:examples
```

`src/domain/` owns schemas and semantic validation. `src/application/` owns operations and scene compilation. `src/infra/` owns files, exports, HTML generation and screenshots. `src/preview/` owns the browser viewer. `src/commands/` owns the CLI adapters and factory; `src/cli.ts` only starts one invocation. `src/index.ts` exports the programmatic API. The browser consumes serialized compiled geometry, so it does not need the procedural/CSG engine.

The package is private by default. Publishing, licensing, signed releases and cross-platform packaging are decisions for a subsequent release.

## Primary references

- [Three.js GLTFExporter](https://threejs.org/docs/pages/GLTFExporter.html)
- [Blender glTF importer/exporter](https://docs.blender.org/manual/en/5.3/addons/scene_gltf2.html)
- [Godot supported 3D formats](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_3d_scenes/available_formats.html)
- [three-bvh-csg](https://github.com/gkjohnson/three-bvh-csg)
- [Khronos glTF Validator](https://github.com/KhronosGroup/glTF-Validator)

## Concept documents

- [Delivery record and verification limits](./docs/DELIVERY.md)
- [Agent instructions](AGENTS.md)
- [Product context](PRODUCT.md) and [design context](DESIGN.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)
- [Extension guide](./docs/EDITOR_EXTENSIONS.md), [rigging](./docs/RIGGING.md), and [examples](./docs/EXAMPLES.md)
