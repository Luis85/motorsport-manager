# Working with Scene Forge

This repository contains a TypeScript CLI for declarative 3D modeling. Use `node dist/cli.js` after `npm ci && npm run build`, or link the `forge3d` command with `npm link`. From the repository root, the checked-in `bin/scene-forge` runs the same CLI without `node_modules`; see `../../docs/reference/scene-forge-cli.md`.

## Model authoring protocol

To author or refine one model by itself, use Model Forge (`bin/model-forge`, `../model-forge/README.md`, `../../docs/reference/model-forge-cli.md`): it edits exactly one `<id>.model.json` or `<id>.model-bundle.json` with revision/state guards and history, and owns the model asset contract. Bring its result into a project with `model-forge -d <document> export --format model-bundle --out <file>` → `model import --file <file> --dry-run` → `model import` (`--replace` with `--expected-revision`/`--expected-state` for an existing definition). Never let another tool edit a model file inside a project in place. The protocol below covers scene authoring and in-project model capture.

1. Read `catalog`, use `describe <command path>` for machine-readable flags, then `schema --kind batch --raw` and any specific geometry/model schema needed.
2. Read `inspect --source`. Preserve the scene ID, current revision and `stateHash`.
3. Give every entity a stable descriptive ID. Use descriptive names and tags to support inspection.
4. Prefer complete transaction batches. Definitions can refer to others created later in the same batch; final state is validated before writing.
5. Dry-run and then apply with `--expected-revision` and `--expected-state`. On conflict, inspect again; do not retry blindly.
6. Query `node list --details` with selectors. Check bounds, triangles and warnings, then use `review --out <new-directory>` for six views plus a contact sheet. Use `--node`/`--model` to isolate work and `--turntable 8` for orbit views.
7. Run `audit --file <quality-policy>` for visible geometry budgets. Use `export --validate` for Khronos format checks. Reuse a previous `replay-plan.json` to hold cameras fixed across edits.
8. Export GLB once the visual result is acceptable. Use `scene pack` to preserve one scene and its complete model dependency closure as a portable recipe. `scene unpack` restores it into a new directory.

Use meters, Y-up and degrees. `$expr` supports bounded arithmetic; nested model parameter overrides resolve in the parent scope. Pattern counts must resolve to positive integers (grid products at most 256). See `./docs/AGENT_WORKFLOW.md` for exact semantics. Primitives are centered at their origins unless otherwise documented (extrusions start at Z=0; lathe follows its profile). Use groups for pivots and assemblies, models for reuse, and linear/radial/grid/path patterns for repetition.

Use `model capture` to extract an assembly, `model export`/`model import` to transfer dependency bundles, and `scene compose` to assemble registered models. Composition files upsert listed groups and instances; they do not clear a scene. `node ground` and `node place` arrange instances using world bounds. `node reparent` preserves world placement unless `--local` is supplied.

The offline composer downloads guarded JSON batches through Save edits. Apply the file through the CLI, then regenerate the preview. New model imports require a regenerated palette.

Use filtered `node edit` or `patchNodes` for intentional bulk changes. Dry-run results include exact added/updated/removed IDs, `proposedRevision` and `proposedStateHash`; `stateHash` remains the current state on a dry run. Operation failures identify their zero-based batch index when available.

All `put` operations replace the full definition. `patchNode` merges only supplied properties, transform components and named overrides. Preserve fields you intend to retain. Scene history does not version model definitions; use Git for full-project history. Never remove another running process's `.forge.lock`.

## Code changes

The model recipe kernel (schemas and semantic validation, deterministic model expansion, export, Littlewild asset writing, capture/review and browser realization) lives in `../model-forge/src/kernel`. Import it only through `src/kernel.ts` (Node) or `src/kernel-render.ts` (browser-safe subset); its bare imports resolve from this package's `node_modules` (`scripts/kernel-deps.mjs` for tsx, `scripts/kernel-resolve.mjs` for esbuild, `tsconfig.check.json` paths for tsc). Keep Scene Forge contracts (project, composition, scene bundle, Littlewild manifest, schema registry) in `src/domain`, project/preview I/O in `src/infra`, and browser-only logic in `src/preview`.

Keep CLI registration in `src/commands`, import file helpers from `infra/files.ts`, and use the kernel's `withCaptureSession` for browser capture lifecycle. Pure scene edits belong in the kernel's `application/edit.ts`; hold the repository lock across load, preparation and persistence. Preview contracts, edit history, templates, viewport and panels have separate owners; avoid growing `viewer.ts` with additional non-UI responsibilities. See `./docs/CODE_QUALITY.md`.

When adding a geometry or operation, update schema, compiler/application support, catalog, meaningful tests, and documentation. The browser should continue to consume compiled Three.js scene JSON rather than duplicate modeling logic.

Run `npm run format:check`, `npm run architecture:check`, `npm run check`, `npm run build`, and `npm test`. `npm run build` also regenerates the checked-in `../../bin/scene-forge`; commit it with source changes, and confirm with `npm run check:cli`. Keep Playwright out of that bundle: browser code loads it through the kernel's `io/playwright.ts`, and packaged files are read through `infra/assets.ts`. Run `npm run test:e2e` when changing export, preview, capture, or command workflows; Chromium is required. Do not claim native Blender/Godot compatibility was manually verified unless those applications were actually used.

Do not add hidden mutable session state, terminal prompts, arbitrary executable code in recipes, or network dependencies to exported HTML.

Use `example list`/`example create` for starter projects. `rig inspect` lists joint data and expanded mesh paths; `rig bind` replaces the rig; `rig pose` makes a guarded joint pose edit. Prefer GLB for skeletal output. See `./docs/RIGGING.md`. New browser tools implement `EditorTool` and register in `preview/tools/index.ts`; do not expose mutable renderer state to tools. Follow `./docs/EDITOR_EXTENSIONS.md` for schema, transaction and lifecycle seams.

For Littlewild/Wildlands assets use `littlewild sync --file <manifest>` (dry-run first, then `--check`), tag pet animation nodes `rig:<role>`, and keep the kernel's `application/littlewild*.ts` free of file I/O. Do not hand-edit generated Littlewild definitions; change the recipe or manifest and re-sync. `littlewild import` creates editable models from existing definitions; exporting them back is lossless (unchanged content keeps the definition's own bytes, the same contract as Model Forge), so review a sync or export diff as exactly your edit.
