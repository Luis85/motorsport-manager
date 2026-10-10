# Working with Process Studio

Process Studio is the standalone command line for Wildlands business-process
definitions. Use the repository executable `bin/process-studio`, or
`npm run cli -- <args>` from this directory. The project overview, protocol and
command table are in [README.md](README.md); the process grammar and semantics
are in [docs/reference/business-process-engine.md](../../docs/reference/business-process-engine.md).

## Editing protocol for agents

1. Run `discover` once (or `doctor` when something fails). It lists every
   command with its options, the limits, the guarded edit operations and the
   recipe shape; `schema --kind recipe` is the exact recipe contract.
2. Pass every file explicitly (`--input`, `--output`, `--recipe`, `--against`).
   Outputs never overwrite an input; choose a new path.
3. Read `inspect` and keep its `revision` and `fingerprint`. Run
   `edit --dry-run` with a recipe carrying `expectedRevision` and
   `expectedFingerprint`, read the result, then apply the same recipe with
   `--output`. On a guard conflict, inspect again and rebase; never drop guards.
4. `validate` (with `--draft` while graph diagnostics remain), `diff` against the
   previous file, then `run`, `replicate` or `compare` with explicit `--minutes`,
   `--runs` and `--seed`. A bounded run is a simulation of synthetic inputs, not
   evidence about a real organisation.
5. `build` writes one offline HTML file; `forge` and `attach` hand scenes to
   Scene Forge and back.

## Code changes

- The bridge `src/kernel.cts` is the only module that imports Wildlands code
  (`../wildlands`). Other modules import from it. `scripts/bridge.cts` is the
  explicit allowlist of every Wildlands file the bundle may contain; change it
  only together with the Wildlands change that needs it, in review.
- Keep the command surface equal to `wildlands process`: options, usage rules and
  descriptions live in `src/options.cts`, one handler per command in
  `src/commands/`. When Wildlands gains or changes a process subcommand,
  `tests/parity.test.cts` fails naming it: add the options, a handler in
  `src/cli.cts` and parity cases in `tests/parity-cases.cts`. Reuse the bridged
  Wildlands module instead of copying it when one exists.
- The only intended output differences from `wildlands process` are the
  documented `discover` additions (`tool`, `toolOperations`, `globalOptions`)
  and the unknown-command message. Do not add others without documenting them in
  README.md and `tests/parity.test.cts`.
- Keep the agent contract: one JSON object per command, usage errors exit 2
  before any file is read, atomic writes through the bridged CLI I/O, no prompts,
  no colours, no hidden state.
- No `Math.random` and no `Date` in Process Studio code; the engine owns seeded
  randomness and business minutes.
- Budgets: at most 400 code lines per source file and 450 per test file; extract
  cohesive responsibilities instead of compressing code.
- devDependencies are exact versions equal to `source/wildlands/package-lock.json`.
- Do not change `source/wildlands/`, `bin/wildlands` or `demos/` from this
  project; those belong to Wildlands' own rebuild and checks.

## Generated executable

Never hand-edit `bin/process-studio`. Rebuild it with `npm run build:cli`,
verify with `npm run check:cli` and commit it with the source change. It embeds
the process play slice of the Wildlands engine kit taken from the checked-in
`bin/wildlands`, so it must also be rebuilt and committed after every Wildlands
engine change (after `bin/wildlands` and `demos/` are rebuilt there);
`npm run check:cli` reports it stale until then.

## Checks

```sh
npm ci
npm run typecheck
npm run architecture
npm test
npm run check:cli
```

From the repository root, the advisory quality gate (`python3 scripts/quality.py`)
also measures this project. A green run here does not replace the Wildlands gate
for changes to the bridged Wildlands files.
