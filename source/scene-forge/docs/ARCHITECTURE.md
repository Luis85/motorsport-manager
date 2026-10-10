# Architecture and product direction

## Product goal

Make a 3D authoring session reproducible as data. An agent should be able to create a game prop or scene, inspect measurable output, inspect rendered output, revise it, and deliver an interoperable asset without controlling a desktop modeling application.

The primary loop is **describe → validate → compile → inspect → render → revise → export**. Every edit is explicit. The project is the durable workspace; the offline browser composer edits a local snapshot and returns explicit transactions to that workspace.

## Model authoring moved to Model Forge

The model recipe kernel (schemas and semantic validation, operations, compilation, export, Littlewild asset writing, capture/review and browser realization) now lives in [`../model-forge/src/kernel`](../../model-forge/src/kernel/index.ts) and is owned by Model Forge, the standalone editor for exactly one model (`bin/model-forge`, see the [Model Forge CLI handbook](../../../docs/reference/model-forge-cli.md)). Scene Forge imports it only through `src/kernel.ts` and the browser-safe `src/kernel-render.ts`; bare imports from kernel files resolve to this package's `node_modules` (`scripts/kernel-deps.mjs`, `scripts/kernel-resolve.mjs`, `tsconfig.check.json`). Scene Forge keeps projects, scene composition, the model registry (`model *` commands), bundles, the offline composer and scene-wide Littlewild sync.

## Boundaries

| Concern            | Owner                           | Contract                                                                |
| ------------------ | ------------------------------- | ----------------------------------------------------------------------- |
| Input shapes       | Zod schemas                     | Versioned JSON and generated JSON Schema                                |
| Meaning            | Semantic validator              | References, cycles, dimensions, parameter ranges, graph constraints     |
| Edits              | Pure operations                 | Existing scene + models + ordered operations → proposed scene           |
| Geometry           | Scene compiler                  | Scene + model registry → Three.js scene, diagnostics and disposal       |
| Persistence        | File repository                 | Manifest, registered files, lock, atomic file replacement and snapshots |
| Interchange        | Export adapter                  | Compiled scene → GLB/glTF/OBJ/STL/Three.js JSON                         |
| Visual composition | HTML adapter + browser composer | Compiled Three.js JSON + model prototypes + source + state guard        |
| Capture            | Playwright adapter              | Generated HTML + view/dimensions → PNG                                  |
| Automation surface | Commander CLI                   | Structured inputs, stable error codes, no prompts                       |

Zod is currently the single schema definition source. TypeScript geometry types are inferred from the strict Zod constructor union; the external JSON Schema is generated from the runtime schema. `schemaVersion: 1` is required. Unknown keys fail rather than disappearing silently.

## Project model

The project manifest indexes scenes and models. Each scene declares local geometries, materials and nodes. Nodes form a parent graph; mesh nodes refer to geometry/material definitions, model nodes refer to reusable recipes, and group nodes own transform hierarchy. A model has its own local IDs, materials, geometry and parameter definitions.

Compilation resolves each instance's numeric parameters and material overrides, expands models and patterns, generates geometry, and calculates bounds/triangle counts. Generated names carry a path such as `main/scout/leftFrontWheel`; `userData.forgeId` and `forgePath` preserve traceability after GLB export. Authored object UUIDs derive deterministically from paths; pooled resource UUIDs derive from resolved definitions. UUIDs are opaque build identifiers, not durable authoring IDs.

The source does not serialize transient browser state. Camera operations copied from the viewer may be applied as explicit source edits. Orbiting or hiding the preview grid never changes the authored scene.

## Transactions and concurrency

Scene batches hold one project lock, read the current source, compare optional scene revision and scene/library state hash, create a proposed scene, validate/compile it, snapshot the previous source and atomically replace the scene file. No-op edits do not increase the revision. A restore is another new revision, never a rewind of the counter.

The lock coordinates CLI processes, not arbitrary external editors. The revision is per scene. A canonical SHA-256 state hash fingerprints the parsed scene and entire model registry, including changes to unused models. This conservatively rejects stale preview edits after model replacement or external source changes. It is a conflict detector, not authentication or a frozen dependency store. Scene history still uses current model definitions on restore. Model registration validates all models/scenes and rolls back caught write failures; multi-file registry changes still need a journal for crash recovery.

## Export strategy

Use glTF 2.0/GLB as the common mesh/material exchange format. Keep Blender and Godot native files as optional adapters later; they should consume the same compiled scene rather than define a competing source of truth.

The v0.6 GLB contains authored meshes, PBR/unlit materials, punctual lights, skeleton skins and rotation clips. The preview's lighting, camera, ground grid and selection outline are separate. Runtime-specific gameplay behavior, collisions and navigation are absent. Pattern instances are expanded into normal scene nodes for portability; a future optimizer may introduce instancing where the destination supports it.

Three.js is a rendering/geometry backend, not a substitute for a modeling kernel. CSG uses `three-bvh-csg` and must be treated as approximate triangle-based boolean work. A precision CAD use case would require another kernel behind the compiler.

## Agent experience

Agents should not memorize every command. `catalog` gives a capability overview, `schema` gives the exact accepted data, and error responses identify the invalid field or reference. No terminal width assumptions, ANSI spinners or interactive confirmations enter machine workflows.

Large scenes should be authored as a small set of reusable model recipes. Batch operations reduce repeated reads and guarantee that related changes become visible together. Image feedback is an explicit tool output, not a claim that structural validation proves visual quality.

## Reusable models and composition

`captureModel` copies selected subtrees and their reachable local resources into a model recipe. It bakes scene parameter references and preserves nested model references. Single-root capture removes root position, retaining rotation/scale. Multi-root capture requires a shared parent coordinate frame. Bundle export computes the transitive dependency closure; bundle import validates the complete proposed registry before registration.

Composition files expand to ordinary `putNode` operations, so they share transaction validation and idempotency. Spatial operations resolve current world matrices and bounds using the compiler. Reparenting decomposes the new local transform and checks reconstruction; a required shear is rejected because the source contract represents only translation, rotation and scale. Ground/place resolve source transforms to numeric coordinates.

The HTML adapter compiles an initial scene and default-parameter model prototypes. The browser clones those meshes for instance placement instead of embedding the procedural/CSG compiler. Existing instances retain their original compiled parameter variants. The editable state covers nodes (including rigs), materials and environment; a 50-entry undo stack stores these values and selection. Geometry/model-parameter editing stays in the CLI.

On download, the composer diffs authored nodes, materials and environment against the initial recipe to emit guarded operations. It includes scene ID, initial revision and state hash. The CLI recompiles and validates before persistence. The browser never receives project write access. Browser GLB export compiles the current in-memory object graph through Three.js GLTFExporter, so it includes unsaved local composition changes.

## Procedural values and batch selection

Scalar recipes support literals, parameter references, and an allowlisted arithmetic AST. Evaluation bounds expression nesting and numeric results, uses degrees for trigonometry, and rejects invalid arities and division by zero. Geometry/transform/pattern values and nested instance overrides resolve before validation and compilation. Scene parameter values and model parameter defaults remain numeric, avoiding an implicit dependency solver.

Linear, radial, grid and explicit path patterns expand deterministically. Grid indices are X-fastest; counts must be positive integers and the product must not exceed 256. Expanded object/triangle budgets still apply. Selectors intersect explicit IDs, tag, node type, model and direct parent. `patchNodes` uses the same transaction boundary as single-node operations; changes and proposed state hashes are returned even on dry runs.

## Portable review loop

A scene bundle contains one scene recipe and the transitive model closure. Its paths are generated from validated IDs on unpack, and unpack requires a new directory. It preserves scene revision but carries no history. The editable bundle freezes model definitions for that snapshot; GLB remains the mesh interchange format.

Review compiles a read-only target once, loads one offline browser page, and renders all requested frames through it. Subtree targets retain transform-only ancestors, preserving world placement even when the combined matrix has shear. Model targets may supply parameter variants without creating scene instances. Bounds fitting is shared between interactive previews and captures and checks projected corner extents for perspective and orthographic views.

Review results include the plan, actual camera position/target/up and projection values, output dimensions, per-frame SHA-256, source state hash, render state hash and statistics. A canvas assembles the contact sheet from the completed PNGs. The manifest is written last after successful rendering; output files are atomically replaced individually. This is not a directory-wide crash-atomic transaction. Pixel equality across GPUs/drivers is not guaranteed.

## Next releases

| Stage                        | Additions                                                                                                             | Completion criteria                                                         |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Dependable project history   | Schema migrations; atomic registry journal; model history; frozen dependency manifests                                | Interrupted registry updates recover and exact past builds are reproducible |
| Stronger procedural modeling | Relational constraints; bevel/normal modifiers; sweep/curve geometry; parameter variants                              | A vehicle family resizes with constraints intact                            |
| Production asset pipeline    | Image textures and UV unwrapping; imported GLB references; baking; cleanup; LODs; optional compression and instancing | Asset packs meet target size and native import checks                       |
| Animated assets and adapters | Transform clips; skeleton/skinning; Godot metadata; optional Blender batch import/save                                | Animation, materials and axes survive native application fixtures           |
| Richer agent interfaces      | Optional daemon/MCP facade; incremental compilation; queued renders; visual comparisons                               | Multiple workers obtain repeatable review evidence                          |

These stages are proposed development scope, not implemented capabilities. The current CLI is intentionally stateless between invocations; a daemon is an optimization, not a prerequisite for authoring.

## Decisions to keep open

- Whether the product should stay focused on game-ready procedural assets or grow into a general DCC system.
- Whether precision modeling requires a second geometry backend.
- Licensing and publication name; Scene Forge/forge3d are working names and no availability claim is made.
- Whether long-running orchestration should use CLI subprocesses, JSON-RPC or MCP.
- Minimum supported Blender/Godot versions, determined through a native application CI/import matrix.
- Whether generated project assets need a separate versioned asset registry across projects.

## Research-driven 0.4 decisions

`./docs/RESEARCH.md` records primary-source research and the product tradeoffs. Quality checks live in the kernel's `../model-forge/src/kernel/application/quality.ts`, separate from schema/reference validity: budgets depend on the destination and inspect the visible deliverable. Findings are aggregated and bounded for agent consumption. The compiler pools resolved equivalent resources per compilation using stable keys; authored nodes still retain their own IDs/transforms and material/geometry references.

Camera requests optionally carry a complete fixed snapshot. The same camera constructor supports interactive previews and headless replay. Review plans are reusable input artifacts; result manifests record output hashes and environment provenance. The browser downloads exact review plans rather than converting orthographic views into perspective camera operations.

Custom mesh schemas now include optional vertex normals and UV pairs. Export validation is a runtime adapter using the official Khronos package. Selected subtree export keeps ancestor TRS nodes instead of decomposing a potentially sheared world matrix. Neither pooling nor these changes introduce cross-invocation state or executable recipe code.

## Refactoring boundaries in 0.5

See [CODE_QUALITY.md](CODE_QUALITY.md) for the module map, compatibility notes and regression evidence. `../model-forge/src/kernel/application/edit.ts` prepares scene transactions without I/O; `src/infra/project.ts` owns lock/read/write sequencing. Canonical data encoding is shared in the domain, while SHA-256 concurrency tokens remain an infrastructure concern. Three.js and CSG are explicit application dependencies; the core has no Node built-in imports.

The CLI is composed by `commands/create-cli.ts`. It accepts a working directory and input/output streams and returns an exit status. Command registrars share a typed context rather than owning process-global output or input state. The executable contains only argument forwarding and exit-status assignment.

`../model-forge/src/kernel/io/capture.ts` owns one browser session and one temporary workspace for both screenshots and multi-view reviews. Browser automation is isolated from plan/manifest generation. The editor consumes a typed payload and delegates history/diffs, compiled prototypes, viewport configuration and panel rendering to separate modules. It still does not compile procedural geometry in the browser.

Architecture checks run before compilation/tests in `npm run verify`. Public compatibility exports are retained while new code imports the module that owns the responsibility directly.

## Editor extensions and animation

See [EDITOR_EXTENSIONS.md](EDITOR_EXTENSIONS.md) for tool registration, lifecycle and data flow, and [RIGGING.md](RIGGING.md) for the skeletal contract. Procedural geometry remains server-side; narrow environment-free adapters realize lights, materials and skins in both runtimes. Generated HTML carries unbound compiled prototypes and rig metadata, then builds derived skin resources in the browser. GLB export uses a detached graph with safely cloned skeletons and deterministic UUIDs.
