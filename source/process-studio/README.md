# Process Studio

Process Studio is the agent-first command line for Wildlands business-process
definitions (`format: wildlands-process`, schemaVersion 1): create, inspect,
validate and edit them under revision/fingerprint guards, simulate, replicate
and compare them, explain them as slides, exchange BPMN 2.0 with BPSim, scaffold
Scene Forge scenes and build one offline HTML simulation.

It is an independent Node.js 22 TypeScript project, like `source/model-forge/`
and `source/scene-forge/`. Its generated, checked-in executable is
[`bin/process-studio`](../../bin/process-studio): one dependency-free file that
needs only Node.js 22 or newer, no `npm ci`, no `node_modules`, no network and
no other repository file. It does not read or write the native game's saves,
configuration or race/campaign state.

The definition grammar, simulation semantics, BPMN mapping and limits are those
of the Wildlands process engine; the engine handbook is
[Business process engine](../../docs/reference/business-process-engine.md).
The equivalent command family is still available as `bin/wildlands process`
([Wildlands CLI](../../docs/reference/wildlands-cli.md#business-processes)).

## Quick start

From the repository root:

```sh
bin/process-studio --version
bin/process-studio doctor
bin/process-studio discover --compact
bin/process-studio create --id intake --name "Intake" --output /tmp/intake.json
bin/process-studio inspect --input /tmp/intake.json
bin/process-studio run --input /tmp/intake.json --minutes 480 --seed 7 --output /tmp/intake-run.json
bin/process-studio replicate --input docs/concepts/agency-delivery/content/agency.process.json --minutes 2400 --runs 10 --seed 1
bin/process-studio build --input /tmp/intake.json --output /tmp/intake.html
```

## Protocol

- One JSON object on stdout per invocation (`--compact` anywhere prints it on
  one line), except `slides --format md` without `--output`, which prints the
  Markdown deck itself. Nothing is written to stderr, there are no prompts or
  colours, and no state is kept between invocations.
- Every result has `ok` and `protocolVersion: 1`. Failures are
  `{ok: false, protocolVersion: 1, code: "process-operation-failed", errors: [message]}`
  with exit 2.
- Exit codes: 0 success; 1 a rejected definition (`validate`, or `import-bpmn`
  with graph diagnostics without `--draft`; `ok: false` and no `code`);
  2 any failure, a rejected BPMN import (`process-import-rejected`) or a
  nonconforming BPMN file (`process-bpmn-nonconforming`). `doctor` exits 1 with
  `process-studio-doctor-failed` when a check fails.
- Usage errors (unknown command or option, duplicate or missing option or value,
  non-whole or out-of-range numbers, unknown enumerations, `--dry-run` with
  `--output`, run/replicate/compare bounds, an event log naming the input or
  report) exit 2 before any file is read or written.
- Outputs are written atomically (an exclusively created temporary file, then a
  rename) and never replace an input, also not through a hard or symbolic link.
  `forge` writes a new directory only.

## Commands

| Command | Required | Optional |
|---|---|---|
| `discover` (also no arguments, `--help`, `-h`) | | |
| `version` (also `--version`) | | |
| `doctor` | | |
| `schema` | | `--kind definition\|recipe` |
| `create` | `--id`, `--output` | `--name` |
| `validate` | `--input` | `--draft` |
| `inspect` | `--input` | |
| `edit` | `--input`, `--recipe`, `--output` or `--dry-run` | `--draft` |
| `attach` | `--input`, `--asset`, `--step`, `--expected-revision`, `--expected-fingerprint`, `--output` or `--dry-run` | |
| `run` | `--input`, `--minutes`, `--output` | `--seed`, `--event-log FILE`, `--format csv\|xes` |
| `replicate` | `--input`, `--minutes`, `--runs` | `--seed`, `--warmup`, `--output` |
| `compare` | `--input`, `--against`, `--minutes`, `--runs` | `--seed`, `--warmup`, `--output` |
| `diff` | `--input`, `--against` | |
| `slides` | `--input` | `--format json\|md`, `--minutes`, `--seed`, `--brief`, `--output` |
| `export-bpmn` | `--input`, `--output` (`.bpmn` or `.xml`) | `--bpsim` |
| `validate-bpmn` | `--input` | |
| `import-bpmn` | `--input`, `--output` | `--draft`, `--report`, `--process`, `--lanes`, `--default-duration`, `--default-capacity`, `--system-capacity`, `--no-auto-system-pool`, `--minutes-per-day`, `--minutes-per-hour`, `--unsupported reject\|drop`, `--no-bpsim`, `--scenario` |
| `forge` | `--input`, `--output` (new directory) | |
| `build` | `--input`, `--output` (`.html`) | |

`discover` is authoritative: it lists every process command with its options and
description, the limits, the guarded edit operations, the workflow and the recipe
shape. The option meanings are documented in the
[Wildlands CLI handbook](../../docs/reference/wildlands-cli.md#business-processes).

## Relationship to `bin/wildlands process`

Every `bin/wildlands process` subcommand exists here with identical options,
results, written files and exit codes; `tests/parity.test.cts` checks this
against the checked-in `bin/wildlands` on a corpus that covers every subcommand,
and fails naming any subcommand `bin/wildlands process discover` lists that
Process Studio lacks. The documented differences are:

- `discover` adds `tool` (name, version, handbook), `toolOperations` (`version`,
  `doctor`) and `globalOptions` (`--compact`);
- an unknown command says `use process-studio discover`;
- `version`, `doctor` and `--compact` exist only here.

The Scene Forge project `forge` writes still names `wildlands process attach` in
its README, byte-identical to Wildlands.

## Self-contained `build`

`build` is embedded, not delegated: bin/process-studio needs no Wildlands CLI.
A process play artifact consists of the process template, the 137 inserts the
`process-play` profile selects (engine kernel, asset catalog, the 3D renderer and
the process template's modules, about 2.0 MB of the 9.1 MB engine kit) and the
Wildlands engine identity. `npm run build:cli` takes exactly that slice from the
engine kit embedded in the checked-in `bin/wildlands`, verifies the payload
digest and recomputes the kit identity, and embeds it compressed (2.0 MB of
text as 0.5 MB of raw deflate, 0.7 MB in base64; the whole executable is 1.2 MB).
The profile and placement rules are bridged Wildlands code, so the HTML is byte
for byte that of `bin/wildlands process build` (`tests/build.test.cts`).

Because every artifact records the whole engine's identity, **any Wildlands
engine change makes bin/process-studio stale**: after rebuilding `bin/wildlands`
(and the demos), run `npm run build:cli` here and commit `bin/process-studio`.
`npm run check:cli` fails until then.

## Development

```sh
cd source/process-studio
npm ci
npm run typecheck      # strict TypeScript, including the bridged Wildlands files
npm run architecture   # bridge, layers, closure allowlist, budgets, determinism, toolchain
npm test               # contract, parity, build parity, bundle and architecture tests
npm run build:cli      # rebuild ../../bin/process-studio
npm run check:cli      # fail when ../../bin/process-studio differs or is not executable
npm run cli -- discover
```

`npm test`, `build:cli` and `check:cli` use the checked-in `bin/wildlands` as the
parity reference and kit source. Layout:

- `src/cli.cts` dispatcher and global options; `src/options.cts` the process
  command surface and usage rules; `src/io.cts` the protocol and file I/O;
  `src/discover.cts`, `src/version.cts`, `src/doctor.cts`;
  `src/commands/*.cts` one module per command family; `src/assemble.cts`,
  `src/kit.cts`, `src/kit-source.cts`, `src/payload.cts` the embedded build.
- `src/kernel.cts` is the bridge: the only module that imports Wildlands code
  (the process SDK, shared CLI I/O, the process CLI's forge/analytics/event-log
  modules and the pure artifact profile/placement rules). `scripts/bridge.cts`
  lists every Wildlands file the bundle may contain.
- `scripts/bundle.cts` (deterministic esbuild bundle and `--check`),
  `scripts/smoke.cts` (confined standalone run), `scripts/architecture.cts`.

See [AGENTS.md](AGENTS.md) for the working rules.
