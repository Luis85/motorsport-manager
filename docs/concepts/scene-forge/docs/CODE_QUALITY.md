# Code quality and architecture pass — v0.5.0

This release separates responsibilities while preserving scene recipes, command names, transaction responses and portable output. It also fixes editor rollback, resource cleanup and caller-data ownership defects exposed during the refactor.

## Responsibility map

| Boundary             | Implementation                                                     | Responsibility                                                                                                                |
| -------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Data contracts       | `domain/schema.ts`, `validate.ts`, `canonical.ts`                  | Strict schemas, semantic validation, numeric scalar resolution and deterministic JSON equality                                |
| Edit preparation     | `application/edit.ts`                                              | Check revision/state guards, apply operations, validate/compile the proposal and calculate dry-run/commit results without I/O |
| Compilation          | `application/compiler.ts`                                          | Expand the scene hierarchy, models and patterns; enforce expansion budgets and report statistics                              |
| Resource ownership   | `application/resources.ts`, `transforms.ts`                        | Pool equivalent geometry/materials, construct geometry, apply resolved transforms and dispose resources                       |
| Project persistence  | `infra/project.ts`, `files.ts`, `state-hash.ts`                    | Hold project locks, load the snapshot, persist prepared changes, retain history, and generate SHA-256 concurrency tokens      |
| Capture lifecycle    | `infra/capture.ts`                                                 | Own the temporary workspace and Chromium session; wait for readiness, report browser errors and capture completed frames      |
| Capture products     | `infra/preview.ts`, `review.ts`                                    | Assemble HTML, save single PNGs, produce multi-view manifests and contact sheets                                              |
| CLI composition      | `commands/create-cli.ts`, `context.ts`                             | Construct independent CLI instances with injected working directory, stdin and output sinks                                   |
| CLI adapters         | `commands/input.ts`, `options.ts`, `errors.ts`, command registrars | Parse unknown input, select a use case and serialize success or failure                                                       |
| Editor state         | `preview/edit-state.ts`                                            | Own undo/redo snapshots, transaction rollback and guarded batch generation without DOM or WebGL                               |
| Editor rendering     | `preview/templates.ts`, `viewport.ts`, `panels.ts`                 | Reuse compiled prototypes, configure lighting/rendering and display scene/model/inspector panels                              |
| Editor orchestration | `preview/viewer.ts`                                                | Connect DOM events, selection, transforms, camera controls and exports                                                        |

The application core deliberately uses Three.js and the CSG engine as its geometry implementation. It does not import Node built-ins, project persistence, browser automation or CLI code. There is no general dependency-injection container or second procedural engine in the browser.

## Changes that improve reliability

- Geometry types now derive from the strict Zod union, removing the separately maintained constructor union and unchecked schema casts.
- `Resolved<T>` represents numeric values after scalar evaluation. JSON input enters the CLI as `unknown`; schemas narrow it before use. Production TypeScript contains no explicit `any`.
- A shared schema registry drives command discovery and generated schema files. Release version consistency is checked automatically.
- `prepareSceneEdit` accepts a scene snapshot and a narrow hash function. The repository retains the project lock from snapshot loading through persistence. Dry runs keep the current revision/hash and return the proposed values separately.
- `applyOperations` clones caller-owned operations, so a subsequent patch or mutation of the returned scene cannot modify the input operations.
- Pooled resources have a single compilation owner. Disposal is idempotent. CSG temporary materials and allocated geometries are released on failure as well as success.
- Screenshot and review share browser setup, renderer readiness checks and frame capture. Their temporary directory is removed even if browser closure fails. A primary setup/render error is preserved if closure also fails. Single screenshot files now use atomic replacement.
- Editor transactions append undo history only after the rebuild succeeds. A failed change restores both nodes and selection. Failed undo/redo also restores state without consuming history. No-op changes retain redo; new changes clear the redo branch.
- End-to-end fixtures no longer contend for the same project lock across parallel test files; copied fixtures exclude transient locks and generated exports.

## Enforced boundaries

`npm run architecture:check` parses TypeScript imports and syntax. It rejects outward core dependencies, Node built-ins in core/browser modules, runtime dependency cycles, explicit `any`, oversized modules, and browser imports of the procedural compiler/schema runtime. Infrastructure may consume preview contracts and the HTML template, but not browser orchestration code.

`npm run check` also rejects unused locals, unused parameters, switch fallthrough and inconsistent filename casing. `npm run verify` runs formatting, architecture, types, build, core tests and end-to-end tests, then writes `./docs/checks.json`.

These checks are guardrails, not a formal proof of purity or security. Review the meaning of new dependencies as well as whether a check permits them.

## Evidence

The v0.5 verification run passed **63 tests: 51 core and 12 end-to-end**. Eleven added tests cover pure edit preparation, immutable operation inputs, a pre-refactor state-hash fixture, independent CLI sessions and stdin, failed editor rebuild/undo, redo branching, guarded edit diffs, failed browser startup/cleanup and idempotent resource disposal.

| Previous hotspot          |    Before |   After | Extracted responsibility                                |
| ------------------------- | --------: | ------: | ------------------------------------------------------- |
| `cli.ts`                  | 747 lines | 3 lines | Factory, input/error handling and command registrars    |
| `preview/viewer.ts`       |     1,036 |     760 | Edit history, prototype rebuilding, viewport and panels |
| `application/compiler.ts` |       436 |     201 | Resource construction/pooling and transforms            |
| `infra/project.ts`        |       462 |     320 | File/lock utilities, hashes and edit preparation        |

Line counts describe responsibility redistribution, not a reduction in total product scope. The compiler resource module is 250 lines; the editor orchestration remains the largest module at 760 lines and is capped by the architecture check.

`./docs/refactor-evidence.json` records the comparison against the pre-refactor source: **all three complete example GLBs are byte-identical**, their source-state hashes match, and compiled statistics match. The persisted SHA-256 guard representation is unchanged. The independent release run validates four GLBs with zero errors/warnings, audits three example projects, and checks desktop/mobile previews for runtime errors, network requests and horizontal overflow. See `./docs/verification.json` and `./docs/quality-reports.json` for actual results.

## Compatibility and remaining limits

Existing public exports remain available, including project file helpers and `CommandContext`. `createCli` and `prepareSceneEdit` are additive programmatic APIs. Create one CLI instance per invocation; importing the factory does not parse arguments or write output. `run(args)` returns a status instead of setting `process.exitCode`; only the three-line executable bootstrap changes process status.

Three.js geometry/material UUIDs are opaque build identifiers and change in this release because pooling no longer depends on Node crypto. They remain deterministic within this version. Use authored IDs and `forgePath` for durable references. Recipe IDs, persisted state hashes and the tested GLB byte streams remain stable.

Multi-file registry writes still roll back caught failures but are not crash-atomic. Scene history still uses current model definitions. Native Blender/Godot imports and macOS/Windows execution were not tested. No claims of cross-driver pixel identity or universal geometry validity are added by this refactor.

## v0.6 extension pass

The editor now registers inspector tools behind snapshot read ports and one synchronous transactional write port. Materials, lights, rigs and scene looks use the same undo/rollback and persistence path. Output controls and project navigation are separated from viewport orchestration. See [EDITOR_EXTENSIONS.md](EDITOR_EXTENSIONS.md) for the extension recipe and ownership map. Current verification is recorded in `checks.json` and `showcase-verification.json`; the byte-identity comparisons above describe v0.5 only.
