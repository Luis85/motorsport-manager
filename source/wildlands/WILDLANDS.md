# Wildlands project and Godot target

Wildlands is a TypeScript game prototype maker. It combines a browser workspace,
portable project documents and a terminal interface over the existing validated
Littlewild simulation. Littlewild loads by default to demonstrate the builder's
capabilities. Emberworks and Office provide different scenario examples.

During development this separate npm project remains in
`source/wildlands/` within Motorsport Manager. Run the commands below from
that folder. Native Motorsport Manager and Wildlands retain separate builds,
application lifecycles, simulations and persistence.

## Browser workspace

Build with `npm run build`, then open `littlewild.html` in a desktop browser. The
workspace offers project save/open, scenario review and the existing authoring
tools for scenes/worlds, creatures, balance and content libraries. Scenario review
precedes **Start this scene**, which replaces the active story after confirmation.
The existing world/scene, creature, terrain, building and storytelling editors
remain the authoring surfaces; gameplay and editor drafts retain their existing
validated command boundaries.

**Save project** captures the current complete pack and selected scene; a retained
valid world/scene editor draft supplies the authored pack instead when its pack
ID matches the active scenario. A draft for another scenario is not exported. **Open project**
validates the file and opens the scenario review. **Export Godot project → Download
Godot ZIP** compiles a validated project in the browser, without a server. Unzip
that archive and open its `project.godot` in Godot.

A project is `wildlands-project` schema version 1 with `id`, `name`, `target:
"godot"`, `scenarioId`, `sceneId` and a complete current-format scenario `pack`.
The selected scene must exist and `scenarioId` must match `pack.id`. The complete
pack carries supported content libraries, assets, creature definitions,
configuration, storyboards and owner checkpoints. It is data, and cannot add
executable mechanics. Project validation is bounded to 10 MiB; the inner pack
retains its own admission limits.

`validate` and `inspect` report the same project `fingerprint`: 16 hexadecimal
digits computed from the key-sorted canonical JSON of the complete normalized
project, including `id`, `name`, `scenarioId`, `sceneId` and the whole `pack`.
JSON key order and whitespace do not affect it; any value change, including a
captured `run` or `edit` result, does. The fingerprint is not stored in the
project. It detects changes rather than authenticating authors, and is a
non-cryptographic identifier, not a signature.

## Terminal and AI-agent workflow

Use Node.js 22 or newer. Install dependencies and build once:

```sh
npm ci --no-audit --no-fund
npm run build
npm run wildlands -- discover
npm run wildlands -- scenarios
npm run wildlands -- create --output /tmp/wildlands.project.json
npm run wildlands -- validate --project /tmp/wildlands.project.json
npm run wildlands -- inspect --project /tmp/wildlands.project.json
npm run wildlands -- compile --project /tmp/wildlands.project.json --output /tmp/wildlands-godot

godot --path /tmp/wildlands-godot
```

The Godot output directory must not already exist. Choose a fresh path for another
compile. `export` is an alias for `compile`. The CLI stages output in a sibling
working directory and publishes the complete project together.

Create a specific scenario or switch an existing project into a separate file:

```sh
npm run wildlands -- create --scenario littlewild --scene charted-home --output /tmp/showcase.json
npm run wildlands -- scenario --project /tmp/showcase.json --scenario office --output /tmp/office.json
npm run wildlands -- create --pack /tmp/custom.pack.json --output /tmp/custom.json
```

For machine parsing, invoke the generated entry directly so npm's lifecycle
banner does not appear on stdout:

```sh
node .generated/tools/wildlands-cli.cjs discover
```

The repository also checks in the same CLI as one self-contained executable,
`bin/wildlands` at the repository root. It needs only Node.js 22 or newer: no
`npm ci`, build or `node_modules`. Its commands, JSON output and exit codes are
identical to the generated entry. The [Wildlands CLI handbook](../../docs/reference/wildlands-cli.md)
is the complete command reference and agent guide. After changing any authored
source, package or toolchain file, refresh it with `npm run build:cli`;
`npm run check:cli` rebuilds it in memory, smoke-runs the candidate from an empty
directory and fails when the checked-in file differs.

Each invocation emits one JSON result with `ok` and `protocolVersion: 1`. Exit 0
means success, exit 1 means the project was rejected by validation, and exit 2
means usage, I/O, bootstrap or operation failure. Unknown and duplicate flags
are rejected; commands never prompt. Input aliases are protected when writing
project documents.

Start agents with `discover`, then inspect the chosen project and use stable
actor, scene and asset IDs returned by discovery. `run` applies a bounded game
recipe through the validated SDK commands and captures its resulting project;
`edit` applies a bounded scene-editor recipe and validates the exported draft.
Write the result to a new document, inspect it and compile that document. The
existing [developer toolbox](DEVELOPER-TOOLBOX.md) remains available for typed
session control, command discovery, scene/creature editing, content exchange and
balancing experiments. A process owns at most one developer session; concurrent
experiments use separate processes.

Game recipes use this data-only envelope:

```json
{
  "format": "wildlands-recipe",
  "schemaVersion": 1,
  "operations": [
    {"operation": "start"},
    {"operation": "advance", "seconds": 1},
    {"operation": "inspect"}
  ]
}
```

```sh
node .generated/tools/wildlands-cli.cjs run --project /tmp/showcase.json --recipe /tmp/recipe.json --output /tmp/played.json
```

`discover` returns supported commands, recipe operations and examples. Recipes
accept at most 256 operations and request at most 36,000 fixed steps in total.
One step is 0.1 seconds; paused/unstarted sessions preserve their normal gates,
so requested steps may advance no simulation time. Inspect the resulting
snapshot and the returned `requestedSteps` / `advancedSeconds` to establish actual progress.
Gameplay command rejection prevents writing an output project. The SDK releases
the owned session on completion or failure.

Editor recipes use `wildlands-editor-recipe` schema version 1 with operations
shaped as `{"operation":"updateScene","args":["charted-home",{"name":"My home"}]}`.
Only the discovered explicit editor operations are available. New draft data
passes the existing scene editor and whole-pack validators before publication.

## Persistent terminal protocol

For agents that need a retained session or editor draft, the same subprocess
interface used by Godot also works directly in a terminal:

```sh
node .generated/tools/wildlands-runtime.cjs --project /tmp/showcase.json --stdio
```

Send one UTF-8 JSON object per line on stdin:

```json
{"id":1,"method":"discover","params":{}}
{"id":2,"method":"inspect","params":{}}
{"id":3,"method":"start","params":{}}
{"id":4,"method":"advance","params":{"seconds":1}}
{"id":5,"method":"story","params":{}}
{"id":6,"method":"shutdown","params":{}}
```

Responses echo the request ID and return `ok` with `result` or an `error` object.
The protocol supports explicit session lifecycle, queries, validated commands,
scene review/entry and retained scene, creature and storytelling authoring
handles. Use `discover` to obtain the actual allowed methods and argument counts;
never infer callable aggregate methods. Authoring handles and pending balancing
reviews are each bounded to 32. Close handles when finished, and send `shutdown`
or close stdin to release the runtime. Transport requests and responses are each bounded to 64 MiB. Diagnostics use stderr; protocol results use stdout.
There is no network listener or automatic gameplay clock in this interface.

## Runnable Godot compiler

The compiler produces a desktop Godot project containing:

| Output | Responsibility |
| --- | --- |
| `project.godot`, `main.tscn` | Godot project configuration and entry scene. |
| `wildlands.project.json` | Validated portable project and complete scenario snapshot. |
| `wildlands.manifest.json` | Generated-file identities, target and runtime requirements, feature coverage. |
| `native/*.gd` | Native presentation, input and subprocess adapters. |
| `runtime/` | Compiled TypeScript simulation, SDK and bridge runtime: exactly the static require closure of the bridge entry points, without browser presentation modules or test fixtures. |
| `runtime/engine-source-bundle.json` | Only with the explicit `--with-engine-sources` opt-in: the inert [engine-source inventory](ENGINE-EXPORT.md#payload-policy) that enables engine export inside the project. |

Godot supplies the native view and sends requests to a local Node subprocess over
JSON lines. The existing TypeScript domain remains the gameplay authority. The
bridge restores the selected scenario's canonical state, accepts supported
commands and advances the existing fixed-step session explicitly. Godot renders
detached projections; it does not reproduce gameplay calculations in GDScript.
This preserves the supported economy, needs, work, progression and other
mechanics without maintaining a second simulation implementation.

The first target requires desktop Godot 4.4+ with Node.js 22+ installed on `PATH`
(or selected with `WILDLANDS_NODE`). It is not a standalone Godot web/mobile export: those platforms need a different runtime
integration or a native gameplay port. A distributable desktop binary also needs
the runtime files and an available Node executable; compiling the project does
not package Node itself.

Native controls expose start/pause, speed, scene connections, full story save/load
and a command console using discovered gameplay commands. Littlewild's native
view selects each companion's personality appearance and material palette,
attaches equipped items to the authored sockets, and shows walking, work, cargo,
care and expression feedback from detached state. Away companions leave the
world view; onsite workflows retain their admitted presence.

**Building floors** opens an inspector for a completed building, including the
graph-less Littlewild starts. Choose a floor to observe companions and physical
supplies, suggest a visit to the selected companion, or place a validated
production order at an available workstation. Opening or changing the observed
floor does not move companions or advance simulation. The native guide includes
the authored tutorial steps; selecting advice is observational and does not
complete tasks or change saved tutorial progress.

Authored timeline sampling previews supported entity positions/transforms and camera tracks in the
native view. Sampling is observational: it does not run scene-entry events,
timed cues, completion events or the browser's reviewed storytelling director.
Cutscene-driven gameplay transitions remain an explicit native integration task.
Scenario switching in the browser selects a new authored project; connections
within the native game use the current pack's scene admission and owner-continuation rules.

The native presentation is a new adapter. Browser editors, renderer plugins,
p5 drawing, full cutscene event execution, 2D/embedded presentation and the
browser panel layout do not become native Godot UI automatically. Consult the
generated manifest for target coverage. Retaining their authored data in the pack is different from implementing their
native presentation. Compiler admission rejects custom renderer and animation
extensions that lack a native adapter. The browser remains the complete authoring
workspace.

## Separate engine JSON export

[ENGINE-EXPORT.md](ENGINE-EXPORT.md) describes `littlewild-engine-export` version
1, the existing inert source/data bundle for code generators. It includes source
integrity and a semantic Godot binding plan. That document is useful for a future
pure GDScript port, but is a different format from the runnable project compiler.
Imported scenario and project data do not install or evaluate source strings.

## Validation and development

```sh
npm run typecheck
npm run architecture
npm run verify
# After building, run the additional native export gate:
npm run verify:godot
# Select the repository's pinned Godot executable when it is not on PATH:
WILDLANDS_GODOT=/path/to/godot npm run verify:godot
```

`verify:godot` checks the generated archive and starts the actual native shell and
Node subprocess headlessly by default. To capture actual rendered screenshots,
run with a graphical display and set an absolute output path:

```sh
WILDLANDS_GODOT=/path/to/godot WILDLANDS_CAPTURE_NATIVE=/tmp/wildlands-native.png npm run verify:godot
```

The capture option enables a graphical run and requires a working display. It
also captures the building-floor view beside the main native screenshot.

The normal verification gate owns the registered simulation, CLI, export and
browser suites. A focused or `--no-browser` run is partial evidence. Native Godot
launch and smoke results should record the Godot and Node versions actually used;
a successful TypeScript build alone does not verify native rendering or input.
Future native gameplay ports must preserve canonical checkpoints, paid-work
receipts, RNG order and deterministic continuation, with explicit conformance
tests against the TypeScript authority.

## First milestone: Littlewild export acceptance

The first target is the shipped Littlewild showcase: `first-morning` and
`charted-home` in `mossmeadow`. Both starts are graph-less and contain no authored
cutscenes, scene triggers, renderer embeds or p5 descriptors. The exported game
retains the existing gameplay authority and adds native companion appearances,
equipment, task feedback, building-floor inspection and authored guidance.
Supported gameplay commands and canonical continuation travel with the project.

Acceptance is about the observable behavior of those starts, including:

- Compile a validated Littlewild project without the source checkout or npm
  dependencies at runtime; require only the documented Godot/Node prerequisites.
- Preserve complete packs, scene-owner checkpoints, dormant work, paid jobs,
  progression, RNG state and exact fixed-step continuation across save/load.
- Discover and submit every supported gameplay command through the same validated
  boundary, with rejected commands preserving authoritative state.
- Verify scene admission and transitions against the TypeScript reference.
- Reconstruct the three `charted-home` personality appearances and Pip's six
  equipped slots, show real task/cargo/care feedback, and preserve away/indoor
  presence without advancing gameplay through rendering.
- Inspect actual building floors, submit visits and production through validated
  commands, and display the authored guide without completing work automatically.
- Validate generated Godot code, native input and actual rendering using recorded
  native smoke checks and visual evidence.

This does not establish presentation parity for every prototype the builder can
author. Automatic storytelling director events, p5 effects, 2D scenes/embeds,
custom renderer plugins and the complete browser editor/panel presentation still
need target adapters. None of those absent authored scene features occurs in the
original two Littlewild starts. The generated manifest declares target coverage;
retaining authored data alone does not demonstrate native execution.

A pure GDScript simulation, bundled Node executable and web/mobile Godot targets
are later portability work with their own conformance and packaging requirements.
