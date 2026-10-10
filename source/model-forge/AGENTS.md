# Working with Model Forge

Model Forge edits exactly one model per document. Use the repository executable
`bin/model-forge`, or `npm run cli -- <args>` from this directory. The handbook is
[README.md](README.md).

## Editing protocol for agents

1. Run `discover` once. Use `describe <command path>` for flags and `schema --kind batch --raw`
   (plus `geometry`, `material`, `node`, `parameter` or `rig`) for exact JSON contracts.
2. Start a document with `create <path> --id --name` or `import --from <file> --out <path>`.
   Use `<id>.model.json`, or `<id>.model-bundle.json` when the model nests other models.
   Neither command overwrites; choose a new path on `DOCUMENT_EXISTS`.
3. Pass the document explicitly on every command: `-d <path>`. Read `inspect --source` and
   keep its `revision` and `stateHash`.
4. Prefer one complete batch per intent. Run `apply --dry-run`, read `changes`,
   `proposedRevision` and `proposedStateHash`, then apply the same batch with
   `--expected-revision` and `--expected-state`.
5. On `REVISION_CONFLICT` or `STATE_CONFLICT`, inspect again and rebase the batch. Never
   drop the guards to force a write, and never remove another process's `<document>.lock`.
6. Use `node list --details` to check bounds, `validate`, then `audit --file <policy>`. Use
   `review --out <new directory>`; reuse its `replay-plan.json` to hold cameras fixed.
7. Export for the consumer: `model-bundle` for Scene Forge, `littlewild` for Wildlands
   games, `glb --validate` for engines. Export to a Scene Forge project only through
   `scene-forge model import` (with its guards); never edit a project's model files in place.

`put` operations replace whole definitions; `patchNode`/`patchNodes` merge. Dependencies in
a bundle are frozen: change one in its own document and `putDependency` with
`replace: true`. Restore earlier work with `history` and `restore <revision>`.

## Code changes

- Layers (enforced by `npm run architecture:check`): `src/domain` (document contracts,
  schema registry, catalog and error remedies; no I/O) → `src/application` (pure edit,
  import and inspection planning) → `src/infra` (document store with lock/history/atomic
  writes, importers, exporters, render page and review) → `src/commands` (commander
  registration only). `src/preview` is browser-only and imports only
  `src/kernel/render/index.ts` and three.
- Editor code reaches the kernel only through `src/kernel/index.ts` (Node) or
  `src/kernel/render/index.ts` (browser). Scene Forge imports the same kernel, so a kernel
  change must keep `bin/scene-forge` byte-compatible and its tests green; rebuild it there
  with `npm run build:cli` when kernel bytes change.
- Keep the agent contract: one JSON envelope per command, no prompts, no ANSI, no hidden
  state, no working-directory document discovery. New error codes need a remedy in
  `src/domain/errors.ts`. New operations need schema, application support, catalog
  semantics and tests.
- Budgets: at most 400 code lines per source file and 450 per test file. Extract cohesive
  responsibilities instead of compressing code.
- Examples are data in `examples/` (`index.json` plus documents); they are embedded into the
  executable.
- Never hand-edit `bin/model-forge`: run `npm run build:cli`, verify with
  `npm run check:cli` and commit it with the source change. Playwright stays external and is
  loaded lazily; packaged assets are read through `src/infra/assets.ts`.

## Checks

```sh
npm run format:check
npm run architecture:check
npm run check
npm test
npm run build:cli && npm run check:cli
FORGE_CHROMIUM_PATH=/path/to/chromium npm run test:e2e
```

`npm run verify` runs all of them in order. Do not claim native engine or DCC
compatibility from these checks alone.
