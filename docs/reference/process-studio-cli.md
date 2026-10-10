# Process Studio CLI handbook

`bin/process-studio` is the standalone, agent-first command line for Wildlands
business-process definitions (`format: wildlands-process`, schemaVersion 1). It
creates, inspects, validates and edits definitions under revision and fingerprint
guards, simulates, replicates and compares them, explains them as slide decks,
exchanges BPMN 2.0 (with BPSim 1.0) and builds one offline HTML simulation: the
browser studio that the [first business process tutorial](../tutorials/first-business-process.md)
opens. It is the preferred tool for process work; the equivalent command family
`bin/wildlands process` stays available with the same results (see
[Parity with `wildlands process`](#parity-with-wildlands-process)).

The executable is one checked-in, dependency-free CommonJS file of about 1.2 MB,
generated from the independent TypeScript project
[`source/process-studio/`](../../source/process-studio/README.md). It needs only
Node.js 22 or newer: no `npm ci`, `node_modules`, build step, network access or
other repository file, not even `bin/wildlands`. It is separate from the native
Motorsport Manager game and does not read or write its saves, configuration or
race/campaign state.

The definition grammar, simulation semantics, BPMN mapping and the studio are
specified in the [business process engine](business-process-engine.md) contract;
task recipes are in [business process authoring](../how-to/business-process-authoring.md).

Every `sh` block on this page was executed in order, as one shell session from
the repository root, against `bin/process-studio` 0.1.0.

## Requirements

| Need | Requirement |
|---|---|
| Run any command | Node.js 22 or newer on `PATH` |
| Open a built HTML file | A current desktop browser (the file runs offline from `file://`) |
| Rebuild or check `bin/process-studio` | Node.js 22+, npm and `npm ci` in `source/process-studio/`; the checked-in `bin/wildlands` |

On Windows, or when the executable bit is lost, invoke it as
`node bin/process-studio …`.

## Quick start

The examples continue in the same shell and write only below `$OUT`.

```sh
node --version
bin/process-studio --version
bin/process-studio doctor --compact
OUT="$(mktemp -d)"
bin/process-studio create --id intake --name "Intake" --output "$OUT/intake.json"
bin/process-studio inspect --input "$OUT/intake.json" --compact
bin/process-studio validate --input "$OUT/intake.json"
bin/process-studio run --input "$OUT/intake.json" --minutes 480 --seed 7 --output "$OUT/intake-run.json"
bin/process-studio slides --input "$OUT/intake.json" --format md --output "$OUT/intake-slides.md"
bin/process-studio export-bpmn --input "$OUT/intake.json" --output "$OUT/intake.bpmn" --bpsim
bin/process-studio validate-bpmn --input "$OUT/intake.bpmn" --compact
bin/process-studio build --input "$OUT/intake.json" --output "$OUT/intake.html"
```

`create` writes a runnable starter (revision 0) with the steps **Intake**,
**Deliver work** and **Handover**; `run` finishes its one case at minute 5 and
reports `"status": "completed"`. Open `$OUT/intake.html` in a browser for the
studio with that definition. A larger synthetic model, the seven processes of the
[agency delivery lab](../concepts/agency-delivery/README.md), can be replicated
directly:

```sh
A=docs/concepts/agency-delivery/content/agency.process.json
bin/process-studio replicate --input "$A" --minutes 2400 --runs 10 --seed 1 --output "$OUT/agency-replications.json"
bin/process-studio run --input "$A" --minutes 600 --output "$OUT/agency-run.json" --event-log "$OUT/agency-events.xes" --format xes
```

## Protocol

- Every invocation prints exactly **one JSON object** on stdout, pretty-printed
  with two-space indentation and a trailing newline, or on one line with the
  global `--compact` (accepted once, anywhere in the arguments). The one
  exception is `slides --format md` without `--output`, which prints the Markdown
  deck itself. Nothing is written to stderr; there are no prompts, no colours and
  no state between invocations, and stdin is never read.
- Every result carries `ok` and `"protocolVersion": 1`.
- Options take exactly one value (`--option value`), which cannot start with
  `--`. The flags `--draft`, `--dry-run`, `--bpsim`, `--no-auto-system-pool`,
  `--no-bpsim` and `--brief` take none. Options may appear in any order after the
  command. Relative paths resolve against the current directory; `output` fields
  are absolute paths.
- Usage errors (unknown command or option, a duplicate or missing option or
  value, a non-whole or out-of-range number, an unknown `--kind`, `--format` or
  `--lanes`, `--dry-run` with `--output`, `--seed` on `slides` without
  `--minutes`, run and replication bounds, an event log naming the input or the
  report) exit 2 before any file is read or written.
- Outputs are written to an exclusively created temporary file and renamed into
  place, so a reader never sees a partial file. An existing output is replaced,
  but an output may never be one of the command's inputs, also not through a hard
  or symbolic link: that fails with exit 2 and leaves the input untouched.
  `forge` writes a new directory only.

| Exit | `ok` | `code` | Meaning |
|---|---|---|---|
| `0` | `true` | — | Success. |
| `1` | `false` | none | `validate`: the definition was read but rejected (`diagnostics`). `import-bpmn`: the imported definition has graph diagnostics and `--draft` was not given; nothing was written. |
| `1` | `false` | `process-studio-doctor-failed` | `doctor`: at least one check failed; `checks` names it. |
| `2` | `false` | `process-operation-failed` | Any usage error or operation failure: unreadable or invalid input, refused output, stale edit guard, I/O. The result has one message in `errors`. Nothing was written. |
| `2` | `false` | `process-import-rejected` | `import-bpmn`: unsupported constructs (`rejections` with element ids) without `--unsupported drop`. Nothing was written. |
| `2` | `false` | `process-bpmn-nonconforming` | `validate-bpmn`: the file does not conform; the full report is printed. |

```sh
bin/process-studio validate --input "$OUT/missing.json" --compact || echo "exit $?"
bin/process-studio run --input "$OUT/intake.json" --minutes 0 --output "$OUT/r.json" --compact || echo "exit $?"
bin/process-studio run --input "$OUT/intake.json" --minutes 10 --output "$OUT/intake.json" --compact || echo "exit $?"
```

Each prints `process-operation-failed` with one message and exits 2: the read
error ("ENOENT: no such file or directory, …"), "--minutes must be a whole number
from 1 to 100000." (before the input is read) and "Output must not overwrite an
input file." (the input is unchanged).

## Commands

`bin/process-studio discover` is authoritative: it lists every command with its
options and description, the limits, the guarded edit operations, the workflow
and the recipe shape. No arguments, `--help` and `-h` (alone) print the same
document.

| Command | Required | Optional | Result |
|---|---|---|---|
| `discover` | | | Commands, options, limits, `editOperations`, workflow, recipe example; plus `tool`, `toolOperations` and `globalOptions`. |
| `version` (also `--version`) | | | `name`, `version`, `kernel` (`format`, `schemaVersion`), `engine`, `distribution`, `sourceIdentity`. |
| `doctor` | | | `checks`: `node`, `kernel`, `engine-kit`, `build`. |
| `schema` | | `--kind definition\|recipe` | The definition (default) or edit recipe JSON Schema. |
| `create` | `--id`, `--output` | `--name` | A runnable starter definition; prints `output`, `revision`, `fingerprint`. |
| `validate` | `--input` | `--draft` | `runnable`, `diagnostics`, `advisories`; exit 1 when rejected. `--draft` accepts graph diagnostics. |
| `inspect` | `--input` | | `id`, `revision`, `fingerprint`, `runnable`, `diagnostics`, `advisories`, `scenes` and the minute-0 `snapshot`; never advances time. |
| `edit` | `--input`, `--recipe`, and `--output` or `--dry-run` | `--draft` | Applies a guarded recipe as one transaction; `--dry-run` writes nothing. |
| `attach` | `--input`, `--asset`, `--step`, `--expected-revision`, `--expected-fingerprint`, and `--output` or `--dry-run` | | Puts a Scene Forge Wildlands asset (or its `{visual}` wrapper) on one step under the same guards. |
| `run` | `--input`, `--minutes`, `--output` | `--seed`, `--event-log FILE`, `--format csv\|xes` | One fresh deterministic run; writes the report and prints `requestedMinutes`, `seed`, `advancedMinutes`, `status`, `metrics` (and `eventLog` with `file`, `format`, `events`). `--format` needs `--event-log`; CSV is the default log format. |
| `replicate` | `--input`, `--minutes`, `--runs` | `--seed`, `--warmup`, `--output` | Runs over consecutive seeds (from `--seed`, else the definition seed, else 1): n, mean, sample sd, t-based 95% interval and p10/p50/p90 per KPI with per-seed rows; `--warmup W` adds KPIs after minute W. |
| `compare` | `--input`, `--against`, `--minutes`, `--runs` | `--seed`, `--warmup`, `--output` | Both definitions over the same seeds: per KPI the statistics of A and B and the paired difference A - B with its interval, plus the `diff` of the two files. |
| `diff` | `--input`, `--against` | | What changed from `--against` to `--input`: summary, counts, changed entities and every changed value with its path. Writes nothing. |
| `slides` | `--input` | `--format json\|md`, `--minutes`, `--seed`, `--brief`, `--output` | The explanatory slide deck; `--minutes N [--seed S]` adds facts from one bounded run; `--brief` keeps the section slides only. |
| `export-bpmn` | `--input`, `--output` (`.bpmn` or `.xml`) | `--bpsim` | BPMN 2.0 XML with the Wildlands extension and diagram; `fidelity` names what only the extension carries. |
| `validate-bpmn` | `--input` | | The conformance report; exit 2 with `process-bpmn-nonconforming` when the file does not conform. |
| `import-bpmn` | `--input`, `--output` | `--draft`, `--report FILE`, `--process ID`, `--lanes pools\|ignore`, `--default-duration N`, `--default-capacity N`, `--system-capacity N`, `--no-auto-system-pool`, `--minutes-per-day N`, `--minutes-per-hour N`, `--unsupported reject\|drop`, `--no-bpsim`, `--scenario ID` | A simulatable definition and the structured mapping report. |
| `forge` | `--input`, `--output` (a new directory) | | An editable Scene Forge project with one scene per step. |
| `build` | `--input`, `--output` (`.html`) | | One self-contained offline HTML studio; prints `output`, `bytes`, `sha256`. |

The meaning of every process option, the edit operations and the import options
is the same as in the
[Wildlands CLI process table](wildlands-cli.md#business-processes); the run
semantics, KPIs, BPMN mapping and slide model are in the
[engine contract](business-process-engine.md).

### Guarded edits

A recipe names the `revision` and `fingerprint` that `inspect` printed and one to
256 operations; `schema --kind recipe` is its exact schema. An agent reads,
previews, applies and reviews:

```sh
A=docs/concepts/agency-delivery/content/agency.process.json
bin/process-studio inspect --input "$A" --compact > "$OUT/inspect.json"
node -e '
const fs = require("fs"), [inspect, definition, recipe] = process.argv.slice(1);
const {revision, fingerprint} = JSON.parse(fs.readFileSync(inspect, "utf8"));
const qa = JSON.parse(fs.readFileSync(definition, "utf8")).resources.find(resource => resource.id === "qa");
fs.writeFileSync(recipe, JSON.stringify({expectedRevision: revision, expectedFingerprint: fingerprint,
 operations: [{op: "putResource", value: {...qa, capacity: 2}}]}));
' "$OUT/inspect.json" "$A" "$OUT/qa.recipe.json"
bin/process-studio edit --input "$A" --recipe "$OUT/qa.recipe.json" --dry-run --compact > "$OUT/preview.json"
bin/process-studio edit --input "$A" --recipe "$OUT/qa.recipe.json" --output "$OUT/agency-qa2.json" --compact > "$OUT/applied.json"
bin/process-studio edit --input "$OUT/agency-qa2.json" --recipe "$OUT/qa.recipe.json" --dry-run --compact || echo "exit $?"
bin/process-studio diff --input "$OUT/agency-qa2.json" --against "$A" --compact
bin/process-studio compare --input "$OUT/agency-qa2.json" --against "$A" --minutes 2400 --runs 5 --seed 1 --output "$OUT/qa-compare.json" --compact
```

`edit` prints the whole edited definition with its new `revision` (1) and
`fingerprint`, so the example keeps it in a file. Applying the same recipe again,
to the edited file, fails with exit 2 because its revision and fingerprint no
longer match: inspect again and rebase instead of dropping the guards. `diff`
reports "Changes: 1 resource changed" with the one value `/resources/qa/capacity`
from 1 to 2.

### `version`, `doctor` and `--compact`

These exist only in Process Studio. `version` (or `--version`) reports the tool
version, `kernel` (the definition format it reads and writes), `engine` (the
identity of the Wildlands engine kit its builds embed), `distribution`
(`bundle` for `bin/process-studio`, `checkout` when run from the TypeScript
sources) and `sourceIdentity` (a SHA-256 over every bundled source file; `null`
in a checkout). `doctor` checks the Node.js version, creates, validates and runs
a starter definition for one minute, verifies the embedded engine kit and builds
the starter in memory; `detail.wildlandsRequired` of the `build` check is
`false`. Both take no options.

A lone copy works the same, for example outside the repository:

```sh
mkdir "$OUT/alone" && cp bin/process-studio "$OUT/alone/process-studio"
(cd "$OUT/alone" && node process-studio doctor --compact && node process-studio create --id alone --output alone.json --compact)
```

## Relationship to Wildlands

Process Studio owns its command line: the dispatcher, usage rules, discovery,
`version`, `doctor` and the HTML assembly. The process engine itself stays in
Wildlands and is bundled into `bin/process-studio` at build time through one
bridge module, `source/process-studio/src/kernel.cts`, the only Process Studio
module that imports Wildlands code. It reaches the process SDK and the engine
scripts it loads, the shared atomic CLI I/O, the process CLI's forge, analytics
and event-log modules, and the pure artifact profile and placement rules. The
explicit allowlist of every Wildlands file the bundle may contain is
`source/process-studio/scripts/bridge.cts`; `npm run architecture` and every
bundle fail on a file outside it or on a stale entry.

`build` is embedded rather than delegated. A process play artifact is the
Wildlands process template, the 137 inserts the `process-play` profile selects
(engine kernel, asset catalog, the 3D renderer and the process template's
modules) and the Wildlands engine identity. `npm run build:cli` takes exactly
that slice, about 2.0 MB of text, from the engine kit embedded in the checked-in
`bin/wildlands`, verifies its payload digest and recomputes the kit identity, and
stores it as one raw-deflate payload (about 0.5 MB). The HTML is therefore byte
for byte that of `bin/wildlands process build` for the same definition, and its
`wildlands-engine` meta element names the same engine as the
[published demos](../../demos/README.md).

Because every built artifact records the whole Wildlands engine identity, and the
bridged files are compiled into the bundle:

- **any change to a bridged Wildlands file, or any Wildlands engine change** (one
  that changes `bin/wildlands`'s engine kit, which covers every engine source
  file) makes `bin/process-studio` stale. After rebuilding `bin/wildlands` (and
  `demos/`) in `source/wildlands`, run `npm run build:cli` in
  `source/process-studio` and commit `bin/process-studio` in the same change;
  `npm run check:cli` there fails until then;
- the [Process Studio verification workflow](../../.github/workflows/process-studio.yml)
  runs on pull requests that change the project, `bin/process-studio`,
  `bin/wildlands`, the bridged Wildlands files, the BPMN examples or the agency
  delivery folder.

## Parity with `wildlands process`

Every `bin/wildlands process` subcommand exists in Process Studio with identical
options, usage rules, printed results, written files and exit codes. The
project's parity test runs a corpus covering every subcommand, including usage
errors, refused outputs through links, a byte order mark, rejected and diagnosed
BPMN imports and builds, through both executables in the same directory and
compares exit codes, results and every written file byte for byte; it also fails
naming any subcommand `bin/wildlands process discover` lists that Process Studio
lacks. The documented differences are:

- `discover` adds `tool` (name, version, handbook), `toolOperations` (`version`,
  `doctor`) and `globalOptions` (`--compact`);
- an unknown command says `use process-studio discover` instead of
  `use wildlands process discover`;
- `version`, `doctor` and `--compact` exist only here.

```sh
bin/wildlands process build --input "$OUT/intake.json" --output "$OUT/intake-wildlands.html" > /dev/null
cmp "$OUT/intake.html" "$OUT/intake-wildlands.html" && echo "identical HTML"
```

A Scene Forge project written by `forge` keeps the Wildlands wording of its
README (it names `wildlands process attach`), byte-identical to Wildlands; use
`bin/process-studio attach` with the same options. Studio-only steps that need a
game folder (`validate-game`, `build-game`) and the screenshot review tool
`npm run process:shots` remain Wildlands commands.

## Limits

| Limit | Value |
|---|---|
| Input file (`--input`, `--recipe`, `--against`, `--asset`, BPMN) | 8 MiB |
| Run length (`--minutes`) | 1 to 100,000 business minutes |
| `--seed` | 0 to 2,147,483,647 |
| Replications (`--runs`) | 1 to 200; at most 1,000,000 simulated minutes in total (`runs × minutes`, doubled for `compare`) |
| `--warmup` | 0 to `--minutes` − 1 |
| Edit recipe | 1 to 256 operations |
| Runtime (`discover` `limits`) | 200 arrivals in total, 2,048 transitions per case, 128-event and 128-receipt histories, 500 unfinished cases at once, 200 finished cases kept in the snapshot |
| BPMN import | 512 flow nodes and 1,024 sequence flows; no DOCTYPE or entity declarations |
| Built HTML | 16 MiB play budget |

A run, replication or comparison is a deterministic simulation of synthetic
inputs: the same definition, seed and minutes give the same report. It is not a
forecast or evidence about a real organisation, and a successful command run is
not human usability or balance validation.

## Rebuild and check the executable

`bin/process-studio` is generated by
[`source/process-studio/scripts/bundle.cts`](../../source/process-studio/scripts/bundle.cts)
with the pinned esbuild and pako of the project lockfile, whose versions equal
Wildlands'. Never edit it by hand.

```sh
cd source/process-studio
npm ci --no-audit --no-fund
npm run typecheck
npm run architecture
npm test
npm run check:cli
cd ../..
```

- `npm run build:cli` bundles `src/cli.cts` with the bridged Wildlands closure
  and the embedded engine kit slice, smoke-runs the candidate from an empty
  temporary directory with file access confined to it (Node's permission model):
  `--version`, `doctor`, `discover`, an unknown command, `create`, `validate`,
  `run` and `build`, whose HTML must equal `bin/wildlands process build` of the
  same file. Only then does it write `bin/process-studio` with mode 755.
- `npm run check:cli` performs the same build and smoke run in memory and fails
  (exit 1) when the checked-in file differs or is not executable.
- `npm test` runs the contract, parity, build parity, bundle and architecture
  tests against the checked-in `bin/wildlands`; it needs no Wildlands build.

The bundle is byte-deterministic for the same sources, lockfile and
`bin/wildlands`: no timestamps, absolute paths or source maps, and the payload is
compressed with pure-JavaScript pako, so the Node.js release does not change the
bytes.

## Related documentation

- [Process Studio project](../../source/process-studio/README.md) and its
  [working rules](../../source/process-studio/AGENTS.md).
- [Business process engine](business-process-engine.md): the definition contract and semantics.
- [Business process authoring](../how-to/business-process-authoring.md) and
  [Present a process to stakeholders](../how-to/present-a-process.md).
- [Model your first business process](../tutorials/first-business-process.md).
- [Wildlands CLI handbook](wildlands-cli.md#business-processes): the equivalent `wildlands process` family.
- [Checked-in command-line tools](../../bin/README.md).
