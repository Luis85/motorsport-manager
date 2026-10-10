# Agent operating guide

Scene Forge 0.3 is a stateless CLI over JSON project files. The reliable loop is **discover → inspect → propose → dry-run → apply → review images → export**. Source recipes retain procedural intent; exported meshes are compiled artifacts.

## Discover before authoring

```bash
forge3d catalog --compact
forge3d describe node edit
forge3d describe review
forge3d schema --kind model --raw
forge3d schema --kind batch --raw
forge3d schema --kind review --raw
```

`describe` reflects the installed commands, arguments, flags, defaults and enum choices. `schema` describes exact accepted data. Unknown keys are errors. Use stable IDs; display names can change independently. Responses use `{ok:true,data}` on stdout. Errors use `{ok:false,error:{code,message,details?,hint?}}` on stderr and exit 1. `--compact` removes success-response whitespace. `--file -` supports stdin wherever a source file is accepted.

## A complete first session

After `npm ci && npm run build`, use `node dist/cli.js` or run `npm link` for `forge3d`. Screenshots/review also require `npx playwright install chromium`, or `FORGE_CHROMIUM_PATH` pointing to an existing Chromium executable.

```bash
forge3d scene unpack logistics --file examples/logistics.scene-bundle.json
forge3d -p logistics inspect
forge3d -p logistics node list --tag storage --details
forge3d -p logistics node edit --ids rackB --data '{"parameters":{"height":4,"levels":5}}' --dry-run
forge3d -p logistics node edit --ids rackB --data '{"parameters":{"height":4,"levels":5}}'
forge3d -p logistics review --node rackB --out logistics/exports/rack-review
forge3d -p logistics export --node rackB --out logistics/exports/rack.glb
forge3d -p logistics scene pack --out logistics/exports/logistics.recipe.json
```

Read `rack-review/contact-sheet.png` with your image tool. Then read individual views when a detail is unclear. A successful build proves structural validity, not good proportions, no intersections, or an attractive result. Revise the recipe and render a new review directory until it meets the brief.

## Procedural values

Use meters, Y-up, +Z front, and XYZ Euler degrees. A scalar can be a literal, a parameter reference, or an arithmetic expression:

```json
{
  "type": "box",
  "size": [{ "$param": "width" }, { "$expr": "mul", "args": [{ "$param": "height" }, 0.5] }, 0.2]
}
```

| Operator                   | Arguments | Meaning                            |
| -------------------------- | --------- | ---------------------------------- |
| `add`, `mul`, `min`, `max` | 1–16      | Sum, product, minimum, maximum     |
| `sub`, `div`               | Exactly 2 | First minus/divided by second      |
| `abs`, `neg`               | Exactly 1 | Absolute value, negation           |
| `sin`, `cos`               | Exactly 1 | Trigonometry with input in degrees |
| `clamp`                    | Exactly 3 | Value, minimum, maximum            |

No expression strings, JavaScript, file access or random execution are accepted. Expressions may nest at most 16 levels. Results at every step must be finite and within ±1,000,000. Division by zero and invalid argument counts fail explicitly.

Expressions work in geometry dimensions, transforms, pattern values and model-instance parameter overrides. Instance overrides resolve against their parent scope before entering the child model. This lets a rack derive a nested crate's dimensions from its own dimensions. Model defaults and parameter ranges, scene parameter values, segment counts, mesh indices, colors and material properties remain literals.

Derived transforms stay reactive until a spatial edit resolves them to numbers. Grounding, relative placement and world-preserving reparenting write numeric transforms for the components they change. Browser gizmo edits bake the edited node's transform; numeric fields replace only the edited vector. To retain a relationship, edit its source parameter or expression.

## Repetition and reusable models

```json
{
  "type": "grid",
  "counts": [{ "$param": "columns" }, 1, 3],
  "step": [1.5, 0, 2],
  "centered": true
}
```

Put this `pattern` on a mesh or model instance. Grid indices increase X first, then Y, then Z. Counts resolve to positive integers; their product must not exceed 256. `centered` offsets the lattice around the node origin. The node transform positions the whole pattern. Linear counts and radial counts/angles can also use expressions. Patterned nodes cannot have authored children: capture the assembly as a model, then pattern that model.

Use `model import --dry-run` before replacing a model definition. `model capture` extracts an existing assembly. `model export` produces a dependency bundle. `model inspect --parameters`, `preview --model`, `screenshot --model`, `review --model` and `export --model` let you examine a parameter variant without placing it in a scene.

```bash
forge3d -p logistics model inspect rack --parameters '{"width":4,"height":3.5}'
forge3d -p logistics review --model rack --parameters '{"width":4,"height":3.5}' --out logistics/exports/variant
```

## Precise inspection and edits

`node list` returns authored nodes instead of every expanded mesh. Filters intersect: `--ids a,b`, `--tag storage`, `--type model`, `--model rack`, `--parent depot`, or `--root`. `--details` adds source, world position/matrix, world-axis bounds, mesh count and triangle count for each subtree. These statistics include authored hidden geometry. Use `--limit`/`--offset` and follow `nextOffset` for large scenes.

`node edit` accepts the same selectors and a patch through `--file` or `--data`. At least one CLI selector is required. For data-driven transactions:

```json
{
  "operations": [
    {
      "op": "patchNodes",
      "selector": { "tag": "storage", "type": "model" },
      "patch": { "parameters": { "height": 3.5 } }
    }
  ]
}
```

An empty JSON selector intentionally matches every authored node. An empty result is `EMPTY_SELECTION`. IDs that do not exist are errors. `putNode` replaces a full definition; `patchNode`/`patchNodes` merge supplied properties, transform vectors and named parameter/material overrides. Use `pattern:null` to remove repetition. A batch either validates/compiles fully or leaves the scene unchanged. Spatial operations inspect the current intermediate state, so define their resources before using them within a batch; final reference validation supports forward references for ordinary put operations.

Dry-run responses contain added/updated/removed IDs, proposed revision and proposed state hash. Their `stateHash` is the current project state, suitable as a guard for applying the proposal. Use both `--expected-revision` and `--expected-state`, or include `scene`, `expectedRevision`, `expectedState` in the batch. The state hash covers the scene plus the entire registered model library. Inspect and rebase on conflict. Per-operation failures report zero-based `details.operationIndex`; final-state validation errors may apply to several operations.

## Fast visual review

```bash
forge3d -p logistics review --out logistics/exports/review
forge3d -p logistics review --model rack --turntable 8 --elevation 25 --out logistics/exports/orbit
forge3d -p logistics review --node rackB --views iso,front,right,top,bottom --wireframe --out logistics/exports/topology
forge3d -p logistics screenshot --node rackB --view orbit --azimuth 135 --elevation 20 --out logistics/exports/detail.png
```

Default review views are `iso,front,right,back,left,top`. `side` aliases `right`; `bottom`, `orbit` and `authored` are also available. Views use world axes. Use `--model` for the model recipe's coordinate frame, or `--node` to preserve a placed instance and its ancestor transforms. `--projection auto` uses perspective for iso/orbit and orthographic for directional views. `--padding` is the framing margin, from 1.02 to 3. An authored view requires a scene camera and uses its perspective settings.

Review frames default to 800×600 and support 64–2048 pixels per dimension. A review accepts 1–36 frames; turntables accept 2–36. `--no-contact-sheet` skips the summary image. `--grid`, `--wireframe` and `--background '#rrggbb'` help inspect shape and topology. Single screenshots support dimensions up to 4096. Rendering does not mutate source or revisions.

For exact automation, use a review plan:

```json
{
  "schemaVersion": 1,
  "kind": "review",
  "width": 800,
  "height": 600,
  "frames": [
    { "id": "overview", "camera": { "view": "iso" } },
    { "id": "front", "camera": { "view": "front", "padding": 1.2 } },
    {
      "id": "rear-detail",
      "camera": { "view": "orbit", "azimuth": 140, "elevation": 20, "projection": "orthographic" }
    }
  ]
}
```

Run `review --file plan.json --out <directory>`. Plans own frame/render settings and cannot be combined with equivalent CLI flags. Target options (`--node`, `--model`, `--parameters`) remain CLI inputs. Duplicate frame IDs are rejected. Use a new output directory each iteration, or explicitly pass `--overwrite` to replace named outputs. Overwrite leaves unrelated or older frame files in place; trust the current manifest's frame list.

The manifest contains the input plan, source/render hashes, target, scene revision, bounds, frame dimensions, actual cameras, PNG hashes and relative filenames. The CLI response includes absolute paths for immediate tool use. The contact sheet uses thumbnails up to 640×480; individual PNGs retain the requested resolution. The manifest is written last after all frames render. Rendering snapshots the source once, then releases the project lock; the recorded source hash identifies exactly which snapshot was reviewed. Pixel-identical output across different browsers/GPUs is not guaranteed.

## Portable deliverables

- `export --format glb`: static meshes, hierarchy and supported PBR material values for Blender, Three.js and Godot import. Model/pattern expansion and booleans are baked.
- `scene pack`: one editable scene plus its transitive model dependency closure. Unused models, project history and other scenes are omitted. Revision is preserved.
- `scene unpack <new-directory>`: recreate a self-contained project from a scene bundle. Existing directories are refused. Model IDs generate paths; bundles do not supply filesystem paths.
- `model export`/`model import`: transfer reusable model recipes independently of scenes.
- `preview`: portable offline Three.js composition/review HTML.

Native Blender/Godot imports have not been run in this environment. GLBs are checked with the Khronos validator. Scene Forge supports procedural modeling, authored lights, portable PBR/unlit materials, skeleton skinning and rotation animation clips. Image textures, visual UV editing/unwrapping, inverse kinematics and arbitrary mesh import remain outside its capabilities. See [rigging](RIGGING.md), [examples](EXAMPLES.md) and [editor extension seams](EDITOR_EXTENSIONS.md).

## Quality gates and resource identity

Run `audit` after an edit and before visual review/export. It measures **visible** geometry; `inspect` and detailed node queries include hidden content. A JSON policy follows `schema --kind quality-policy --raw`. See `examples/quality.policy.json` for a budget suitable for the supplied fixtures, not a universal performance target.

```bash
forge3d -p logistics audit --file examples/quality.policy.json
forge3d -p logistics audit --model rack --parameters '{"width":4}' --strict
forge3d -p logistics export --validate --out logistics/exports/scene.glb
```

Policy fields are `maxTriangles`, `maxMeshes`, `maxMaterials`, `maxGeometries`, `maxExtent` (longest world-axis dimension in meters), `allowTransparency`, `allowDoubleSided`, and `requireUVs`. Omitted limits impose no extra budget. Transparency is a warning when allowed; mirrored transforms also request visual review. Empty visible output and degenerate triangles are errors. `--strict` turns any warning into a failed gate. Error reports aggregate counts and include at most ten example paths per finding. A failed gate uses the usual stderr JSON contract and exit 1; the complete report is `error.details`. Recipes are unchanged.

Unique geometries/materials are shared within a compilation; nodes and transforms remain distinct. `geometryBytes` counts unique geometry attribute/index buffers. It is not GPU memory, file size or a draw-call estimate. The programmatic API exposes shared mutable Three.js resources: clone a geometry/material before mutating only one instance, or edit and recompile the recipe.

`export --validate` supports GLB and embedded glTF only. It runs Khronos glTF-Validator before writing. Format errors return `EXPORT_INVALID` and preserve the destination; warnings/information are reported. Subtree exports retain transform-only ancestors, so local TRS chains remain intact even if their combined world transform contains shear.

## Fixed-camera review

Each review creates `replay-plan.json`. Reuse that file for comparisons after editing:

```bash
forge3d -p logistics review --out logistics/exports/before
forge3d -p logistics review --file logistics/exports/before/replay-plan.json --out logistics/exports/after
```

`camera.fixed` accepts the `camera-snapshot` schema: projection, position/target/up, near/far, zoom, plus perspective fov/aspect or orthographic left/right/top/bottom planes. These values take precedence over auto-fit fields. Keep the saved plan's width/height together with its camera; changing image aspect can stretch a fixed projection. Invalid planes, coincident targets and parallel up vectors are rejected. Newly enlarged geometry may leave a fixed view: use another auto-fit review to check the entire scene.

The browser's **Save review plan** downloads the current camera/settings as a CLI-ready plan. **Copy review plan** offers the same data through clipboard or the source panel. These actions preserve orthographic zoom; they do not save scene edits. Apply downloaded scene edits first, then run the plan against the project. Model-only previews need the same `--model` and parameter values on the review command. Plans capture no implicit target or model edits.

Review manifests include tool/Three.js/Node/Chromium versions, OS/architecture and requested rendering backend. This identifies the environment, not a promise of pixel equality across machines. Scene lighting is still derived from environment settings and current bounds. A replay freezes the camera, not lighting or source content.

## Custom mesh attributes

`mesh` geometries accept optional `normals: [[x,y,z], ...]` and `uvs: [[u,v], ...]`, each with one entry per position. Values can use the same bounded scalar expressions as positions. Normals must be nonzero and are normalized by the compiler; absent normals are generated. Duplicate vertices at hard normal edges or UV seams. UVs are preserved as `TEXCOORD_0` in glTF, but image textures and automatic unwrapping are not implemented. Boolean output currently discards UVs.

All JSON input paths enforce a 16 MiB byte limit. Split large content into reusable model files. Inputs use UTF-8 and decode after collecting chunks, so multibyte characters survive stream boundaries.

## Soft materials and portrait review

`schema --kind material --raw` describes optional `sheen`, `sheenColor`,
`sheenRoughness`, `clearcoat` and `clearcoatRoughness`. Use `putMaterial` in a
guarded batch; amounts and roughness are 0–1, colors are `#RRGGBB`. Preserve the
complete material definition when replacing it. These light-responsive fields
apply to standard PBR shading and survive Littlewild and GLB/glTF exchange.
GLB uses the Khronos sheen and clearcoat material extensions. Unlit ignores them.

For a warm studio review, use `setEnvironment` with `presentation: "portrait"`,
`background: "#eee7d8"`, `ambient: 1.1` and `keyIntensity: 3.2`. The optional
presentation defaults to existing inspection lighting when omitted; explicit
`"inspection"` restores that rig. This is a recipe-owned preview setting, included
in scene pack/unpack and review source identity. The shadow floor and lights
never enter exported geometry. The viewer's **Use portrait studio** command
produces the same guarded environment operation as CLI batches.

## Plush forms and portable surface detail

Use `catalog` → `organicForms` and `surfaceDetails` for machine-readable parameter
ranges and complete `putGeometry` / `putMaterial` examples. Both operations use the
normal guarded `apply` transaction; inspect the source and preserve fields before
replacing a definition. Dry-run the complete geometry/material/node batch, then
apply it with the same revision and state guards. A stale guard or invalid surface
rejects the whole transaction. Review using the previous `replay-plan.json` to
compare the same cameras.

`organic` is a closed smooth form with `size: [x,y,z]` in meters, `roundness`
(0.65–1.5, default 1), `taper` (−0.65–0.65, default 0), `bend` (−0.75–0.75,
default 0), and `segments` (12–96, default 32). Roundness below 1 makes a fuller
shape; positive taper narrows the top, and positive bend offsets both ends along
X. Size is the untapered diameter; taper/bend can extend the bounds. Inspect actual
bounds instead of assuming they equal size. UV seams share smooth normals.
The default form uses 561 vertices; the maximum uses 4,753 and remains within the
Littlewild per-mesh budget. Large assemblies can exceed its aggregate budget;
export reports an actionable error instead of silently simplifying them.

A material can include all four `surface` fields:

```json
{
  "color": "#c89059",
  "roughness": 0.9,
  "sheen": 0.65,
  "surface": { "kind": "fur", "seed": 7, "scale": 3, "strength": 0.4 }
}
```

Kinds are `fur`, `cloth`, and `leather`; seed is an integer 0–65535, scale is repeat
1–16, strength is 0–1. This requires standard PBR shading. The versioned
`littlewild-surface-v1` algorithm creates deterministic 128×128 color and normal
maps with no external image files, executable shader code, browser or network.
It adds short surface detail, not strand fur or silhouette volume. Use geometry
for cheek tufts, ears and clothing thickness. The offline material inspector
edits the same recipe and exports the same guarded batch.

Littlewild import/export retains each effective material's surface recipe and
baked mesh UVs. Equal material roles remain distinct so later palette editing
stays intentional. GLB/glTF embeds the generated PNGs, explicit mesh tangents,
UV repeat transforms and the surface recipe in material extras. OBJ/STL still
omit materials. Legacy meshes without UVs receive a local spherical projection;
author seam-aware `uvs` for precise placement. The engine and Forge implementations
are checked against the same generated bytes for all kinds and boundary values.

Surface maps are shared across colors with the same kind/seed/scale/strength. A
scene allows at most 256 distinct surface recipes; exceeding it fails with
`SCENE_BUDGET` before publication. Reuse seeds and scales when changing only color.

Littlewild import returns `variantModels`, a map from original variant names to
actual model IDs, alongside the retained `variants` array. Select
`variantModels["world-round"]` for a creature world model instead of guessing
capitalization, separators or truncation. The dry-run mapping matches apply.
