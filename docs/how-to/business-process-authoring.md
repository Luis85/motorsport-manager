# Author and simulate a business process

Use the checked-in `bin/wildlands` and `bin/scene-forge` with Node.js 22+.
No build or dependencies are needed to run these tools. The
[process contract](../reference/business-process-engine.md) defines the supported
semantics and limits. This workflow starts with definitions and then builds scenes.

## Create a process incrementally

Run from the repository root and choose a new output directory:

```sh
mkdir -p /tmp/process-work
bin/wildlands process discover
bin/wildlands process schema --kind definition
bin/wildlands process schema --kind recipe
bin/wildlands process create --id my-process --name "My process" --output /tmp/process-work/process.json
bin/wildlands process inspect --input /tmp/process-work/process.json
```

`inspect` returns the current revision and fingerprint. The fingerprint covers
all definition values and ignores object key order. Preserve both in every edit
recipe. It is a change guard, not a cryptographic signature.

Write `/tmp/process-work/edit.json`, using the fingerprint you just read:

```json
{
  "expectedRevision": 0,
  "expectedFingerprint": "REPLACE_WITH_INSPECT_FINGERPRINT",
  "operations": [
    {"op": "putResource", "value": {"id": "analyst", "name": "Analyst", "capacity": 1, "costPerMinute": 2}},
    {"op": "putStep", "value": {
      "id": "work", "name": "Review request", "kind": "task",
      "duration": 12, "resources": {"analyst": 1},
      "scene": {"id": "scene-work", "position": [12, 0], "color": "#ffbb73"}
    }},
    {"op": "setArrivals", "value": [{"at": 0, "count": 3, "interval": 4, "data": {}}]}
  ]
}
```

```sh
bin/wildlands process edit --input /tmp/process-work/process.json --recipe /tmp/process-work/edit.json --dry-run
bin/wildlands process edit --input /tmp/process-work/process.json --recipe /tmp/process-work/edit.json --output /tmp/process-work/review.json
bin/wildlands process validate --input /tmp/process-work/review.json
bin/wildlands process inspect --input /tmp/process-work/review.json
```

`putStep`, `putFlow`, and `putResource` replace complete definitions. Keep fields
you intend to retain. A recipe is one transaction: every operation succeeds and
the resulting definition passes admission, or nothing is written. References
may point to definitions added later in the same recipe. Unknown operations and
fields fail. Output cannot overwrite input, including hard-link/symlink aliases. Argument errors
(missing, duplicate or unknown options, non-numeric `--minutes` or
`--expected-revision`, `--dry-run` with `--output`) exit 2 before any work; see the
[option tables](../reference/wildlands-cli.md#business-processes).

For a longer graph, use `edit --draft` while adding unconnected steps and flows.
Drafts still pass structural and asset validation; their graph diagnostics are
returned explicitly. `inspect` can inspect them and returns `runnable: false`
and `snapshot: null`. Resolve every diagnostic before `run` or `build`; `forge` and `attach` require an admitted definition.
Use `--dry-run --draft` to preview an intermediate edit without writing.
On a stale guard, inspect again and reconcile the intended change; do not retry
with a guessed revision. `removeStep`, `removeFlow`, `removeResource`, `setStart`
and `rename` complete the supported edit vocabulary.

## Add branching and parallel work

- Give a decision at least two outgoing flows, exactly one without `when` as the
  fallback. Conditional flows compare a scalar case field. The first matching
  condition in definition order wins; the fallback is evaluated last.
- Give a fork a `join` step ID. Its branches must be disjoint task chains ending
  at that join. Each branch may write different case fields using task `set`.
- For rework, route a decision back to a task outside a parallel region. The task
  can clear a boolean such as `needsRework` before the next decision.
- Resource demands are simultaneous. A task needing a business analyst and a
  requirements engineer waits until both are available. There is no hidden staff capacity.

## Add machines and systems

Mark pools with a `kind` and demand them from `machine` or `system` steps. Tasks keep
using `people` pools (the default); a machine step may demand only machine pools and a
system step only system pools, and each must demand at least one.

```json
"resources": [
  {"id": "staff", "name": "Staff", "capacity": 1, "costPerMinute": 2},
  {"id": "robot", "name": "Robot cell", "capacity": 1, "costPerMinute": 5, "kind": "machine"},
  {"id": "ci", "name": "Build farm", "capacity": 2, "costPerMinute": 1, "kind": "system"}
],
"steps": [
  {"id": "weld", "name": "Weld frame", "kind": "machine", "duration": 6, "resources": {"robot": 1},
   "technology": "Robot arm", "set": {"welded": true}, "outputs": [{"field": "welded", "label": "Welded frame"}]},
  {"id": "build", "name": "Run build", "kind": "system", "duration": 5, "resources": {"ci": 1},
   "technology": "CI/CD pipeline", "needs": [{"field": "welded"}], "set": {"built": true}, "outputs": [{"field": "built"}]}
]
```

`technology` is a label only and `outputs` must each be delivered by the same step's
`set` or `add`. These are simulated assumptions; nothing is executed or integrated.

## Declare needs and backlogs

- A step delivers data with `set` (for example `"set": {"requirementsReady": true}`)
  and states what it needs with `needs`: `[{"field": "requirementsReady", "op": "eq",
  "value": true, "label": "Product design deliverable"}]`. Omit `op` and `value` to
  require only that the field was delivered. Validation fails when any route can reach
  the step without the delivery, so mistakes show up before a run.
- Give a task or join a `backlog` to bound and order waiting work:
  `{"capacity": 3, "order": "priority", "priority": "priority", "pull": 1}`.
  `pull` (joins only) caps work in the next task so downstream steps draw from the
  backlog instead of the whole queue piling up in front of them.
- In the webview, **Edit step…** edits backlog capacity, order, priority field and
  pull limit, and adds, edits or removes needs. Apply to start a fresh run.

## Count iterations and wait with timers

An iteration counter bounds a rework loop. The task adds 1 each visit and the decision
compares the counter with a case field, so the arrival data sets the limit:

```json
{"id": "build", "name": "Build increment", "kind": "task", "duration": 8, "add": {"iteration": 1}, ...},
{"id": "more", "name": "More iterations?", "kind": "decision", "needs": [{"field": "iteration"}], ...}
```
```json
{"id": "more-build", "from": "more", "to": "build",
 "when": {"field": "iteration", "op": "lt", "valueField": "iterations"}},
{"id": "more-end", "from": "more", "to": "end"}
```

With `"data": {"iterations": 3}` the task runs three times and receipts show
`iteration` 1, 2, 3. A missing counter or limit never matches and takes the fallback.

A sprint timebox is a `timer` step: `{"id": "timebox", "kind": "timer", "duration": 20160,
"set": {"sprintClosed": true}}` waits two working weeks (in business minutes) without using
people or cost, then continues. Use `"until": 4800` to wait to an absolute minute (a
release date); it passes straight through if that minute has already arrived. Place a
timer beside tasks in a fork so the sprint ends when both the work and the timebox have
finished. Timers cannot be interrupted or cancelled and have no calendars.

The complete [agency example](../concepts/agency-delivery/README.md) demonstrates
all of these rules in its [JSON definition](../concepts/agency-delivery/content/agency.process.json).

## Simulate steady demand and random outcomes

By default every arrival is a finite batch, so the process drains and completes.
For steady demand, give an arrival entry one end rule: `count` (the batch, 1 to
200), `until` (an absolute minute) or `open: true` (for the whole run). Randomness is
opt-in and always comes from the definition's `seed` (or `process run --seed N`):
the same seed reproduces the same run, a different seed gives another one. Results
are scenario assumptions, not forecasts. The full rules are in
[Randomness, seeds and steady arrivals](../reference/business-process-engine.md).

A steady open stream with a random gap and a route that sends 15% of the work to
rework (the 15% is drawn per case; `check` takes the first matching flow, then the
fallback):

```json
{
  "seed": 42,
  "arrivals": [
    {"at": 0, "open": true, "interval": 6,
     "gap": {"dist": "exponential", "mean": 6, "max": 30}, "data": {}}
  ],
  "steps": [
    {"id": "check", "name": "Quality check", "kind": "decision", "scene": {"id": "scene-check", "position": [24, 0], "color": "#ffffff"}}
  ],
  "flows": [
    {"id": "check-rework", "from": "check", "to": "rework", "label": "Defect", "when": {"chance": 15}},
    {"id": "check-ship", "from": "check", "to": "ship"}
  ]
}
```

`interval` stays required as the mean spacing. Run it unlimited (Run length
"Unlimited" in the page, `horizon: null` in code) and it keeps going until you pause;
at 500 unfinished cases further arrivals are refused (event `arrival-dropped`,
metric `dropped`) and only the 200 newest finished cases stay in the case list while
the totals remain exact.

Uniform task timing with a random case attribute written at completion:

```json
{
  "id": "build", "name": "Build", "kind": "task", "duration": 8,
  "timing": {"dist": "uniform", "min": 4, "max": 12},
  "resources": {"dev": 1},
  "draws": [{"field": "severity", "kind": "choice",
             "values": [{"value": "minor", "weight": 3}, {"value": "major", "weight": 1}]}],
  "scene": {"id": "scene-build", "position": [12, 0], "color": "#ffbb73"}
}
```

`duration` stays as the planning value (8 minutes); each visit draws 4 to 12 whole
minutes when its work starts and the receipt records the realized `duration`. The
drawn `severity` appears in the receipt `changes` and can feed a later bare `needs`
entry or a decision condition.

## Author each step scene with Scene Forge

```sh
bin/wildlands process forge --input /tmp/process-work/review.json --output /tmp/process-work/forge
bin/scene-forge -p /tmp/process-work/forge catalog
bin/scene-forge -p /tmp/process-work/forge inspect --source
bin/scene-forge -p /tmp/process-work/forge validate
bin/scene-forge -p /tmp/process-work/forge littlewild sync --file /tmp/process-work/forge/littlewild.export.json
```

`forge` needs an existing parent directory and a directory that does not yet exist.
The new project has one scene and one editable starter model for every process
step, an export manifest, and a process-to-scene map. Use Scene Forge's guarded
batch operations to add props, character models and other geometry. Follow its
[agent protocol](../../source/scene-forge/AGENTS.md). The scaffold does not
convert existing attachments: these are retained verbatim in `existing-assets`
and can be brought into Scene Forge with `littlewild import` for exact editing.

Attach an exported model to the process step. Read fresh guards from `inspect`:

```sh
bin/wildlands process attach --input /tmp/process-work/review.json --step work --asset /tmp/process-work/forge/exports/items/scene-work/definition.json --expected-revision 1 --expected-fingerprint REPLACE_WITH_INSPECT_FINGERPRINT --dry-run
bin/wildlands process attach --input /tmp/process-work/review.json --step work --asset /tmp/process-work/forge/exports/items/scene-work/definition.json --expected-revision 1 --expected-fingerprint REPLACE_WITH_INSPECT_FINGERPRINT --output /tmp/process-work/visual.json
```

The `visual` facet becomes `step.scene.asset`; a bare `littlewild-3d-asset` is
also accepted. It must have a `world` model. The existing engine asset validator
and renderer handle supported primitives and bounded baked meshes. Exported
assets carry meters, Y-up and radians; Scene Forge recipes use degrees and the
exporter converts them. Materials/meshes travel inside the process JSON.
The [agency Scene Forge project](../../source/scene-forge/examples/agency-delivery/forge.project.json)
is the editable source of the demo's attached scene geometry.

## Exchange BPMN 2.0

```sh
bin/wildlands process export-bpmn --input /tmp/process-work/review.json --output /tmp/process-work/review.bpmn
bin/wildlands process import-bpmn --input /tmp/process-work/review.bpmn --output /tmp/process-work/imported.json
```

Export carries durations, needs, backlogs and layout in a `wl:` extension, so a
round trip is lossless. Importing BPMN from another tool lists every default or
folded element in `warnings`; add durations, resources and arrivals afterwards in
**Edit process…** (Tune values) and **Edit step…**, or with guarded edits. Unsupported constructs (sub-processes,
boundary events, inclusive gateways) are rejected rather than approximated. The studio
offers the same through **Export BPMN** and **Import JSON or BPMN**.

## Run and build

```sh
bin/wildlands process run --input /tmp/process-work/review.json --minutes 100 --output /tmp/process-work/report.json
bin/wildlands process build --input /tmp/process-work/review.json --output /tmp/process-work/process.html
bin/wildlands validate-game --game docs/concepts/agency-delivery
bin/wildlands build-game --game docs/concepts/agency-delivery --output /tmp/process-work/agency.html
```

The report binds the complete definition and its fingerprint to the observed
snapshot. It includes business-minute time, resource utilization, queues, cost,
cycle time, completed and failed cases. The event tail retains the latest 128
events; aggregate metrics retain the complete run. A run may finish earlier than
the requested horizon when all scheduled cases have ended. It does not execute
real services or update external systems.

Open the HTML directly. Use **Run simulation**, **Pause**, **Step 1 min**,
**Advance 30 min**, and **Reset run**. **2D** and **3D** show one simulation;
**Step scenes** and **Whole process** change the view without advancing time.
**Edit process…** in the header opens the **Definition editor** (validation before **Apply draft and reset run**, see below); a chip beside it names an unapplied draft.
To change one step, select it and choose **Edit step…** beside **Frame view**. The step editor opens as a dialog whose sections follow the kind of step: basics, timing and cost, people and capacity (tasks), equipment (machine steps) or systems (system steps), completion values and counters, declared outputs, needs from earlier steps, backlog and outgoing flows (conditions on decisions, with a short summary of the order the paths are checked). Work steps and duration timers also offer **Random timing** (the planning duration stays the average shown in estimates while each visit draws its own time) and **Random outcomes (draws)** for chance, weighted-choice and whole-number fields; a decision path can take a random share of cases instead of testing a field. Inconsistent numbers are reported next to the field. Machine and system steps add an **Automation** section for the optional technology label and list only pools of their own kind; if the process has no machine or system pool yet, the dialog says so and points to the Definition editor. Problems the engine finds for the step appear beside the fields as you type, and the problem list at the top links to each field. **Save to draft** keeps your edits in the draft without starting anything and the draft summary reads, for example, "Unapplied draft: 1 step changed". **Apply and reset run** applies the whole draft (including other unapplied edits, which a banner announces); when a run is already in progress it first asks you to confirm that the run will be discarded, so export the run report beforehand if you need it. **Cancel**, Escape, **Close** and a click outside the dialog all ask before throwing edits away. The run pauses while the dialog is open. Adding or removing flows and steps is still done in the raw JSON draft.
The Definition editor is a dialog with two panes: **Tune values** (process name,
description and **Seed**, shared resources with their kind People, Machine or System,
and each arrival's end rule, first arrival, planning interval, optional random gap,
case data and random case fields) and **Raw JSON** (the draft with line numbers, the
exact line and column of a syntax error, every problem the catalog reports as a button
that selects the offending text, **Format JSON** and **Copy**). Below 1000 px the panes
are tabs; on a phone the dialog is a full sheet. The run pauses while it is open. Edits
go to the draft as you type, so closing never loses text, and the chip in the header
("Unapplied draft · 3 steps, 1 resource changed") reopens it. **Restore active
definition** and **Apply draft and reset run** (when a run is past minute 0) ask first;
export the run report beforehand if you need it. **Export draft**
saves the draft text exactly, including unfinished JSON. **Export JSON** and
**Download HTML** continue to use the active definition until you apply a valid
draft. Editing clears the previous validation result; validate again before applying.
A rejected import retains the previous definition and run.
If the game folder lists several processes, choose one with the **Process**
selector. Switching starts that process paused at minute 0 and keeps the others'
applied edits and unapplied drafts for the session; import and apply change only
the active process, and the JSON, BPMN, draft and report exports use it too.
Use **Inputs & outputs** beneath either view to select a case. **Whole process**
shows its arrival fields and, after completion, final outputs. Select a task to
compare its captured inputs with completed outputs; **Visit** lets you inspect
retained rework visits. Until completion, authored effects are labeled
**Expected changes**. Waiting work has no captured task inputs yet. Reports
retain the latest 128 task completions, with an explicit omitted-record count.

In 3D, active work appears as desk actors typing and reviewing screens while
playback runs. Pause freezes their motion; reduced-motion preferences disable
it. Additional work uses bounded markers, with counts preserving total activity.
Focus the canvas to orbit with arrow keys, pan with Shift+arrows or WASD (or right-drag), zoom with +/−, or frame with F. In 2D, drag to pan, scroll or pinch to zoom, and press 0 to reset. Use **Run until** in the toolbar to choose a run length or Unlimited, and the **Tune values** pane of the Definition editor (**Edit process…**: name, seed, resources, arrivals) or **Edit step…** (one step) to fine-tune an agent-built process before applying it.

**Export run report** downloads observed results, including retained task I/O. **Download HTML** embeds the
active definition (for a multi-process game, every applied process in list order)
and starts a fresh paused run when reopened. There is no
checkpoint import or automatic browser persistence in v1.

For reusable game folders, copy the agency `game.json` shape, choose an ID equal
to the folder name, set `template: process`, and point `content.definition` at
the process JSON (or `content.definitions` at 1-8 process JSON files, never both,
to let the studio switch between them). Set matching storage/output IDs. Keep the folder data-only.
The build has no external scripts, fonts, asset requests or account dependency.

## Agent completion checklist

1. Inspect and retain exact edit guards.
2. Dry-run complete transactions; review diagnostics and changed definitions.
3. Validate the complete graph and scene assets.
4. Run bounded cases covering each decision outcome, contention and rework.
5. Review actual Scene Forge views and both process projections where a browser
   is available; a headless simulation result does not certify visual quality.
6. Build the HTML and reopen it offline, then export/reimport JSON and HTML.
7. Report the source identity, executed tests, assumptions and unsupported rules.
