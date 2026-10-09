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
    {"op": "setArrivals", "value": [{"at": 0, "count": 3, "interval": 4, "data": {}}]},
    {"op": "setDescription", "value": "Reviews incoming requests. All values are synthetic."},
    {"op": "setSeed", "value": 7}
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
and `rename` complete the entity edit vocabulary. Process settings have their own
operations, so nothing needs to be hand-edited into the JSON: `setDescription`
(`value` text or `null`), `setSeed` (a whole number or `null`), `setGenre`
(`process`, `customer-journey` or `user-journey`; `process` removes the field and
`null` is rejected),
`setSipoc` (`{suppliers, customers}` or `null`) and `setTrack` (a tracked-field list
or `null`). `null` removes the field; a new field is written in schema order. They
are recipe operations only: the definition schema is unchanged and admission still
validates every value.

To review a change, compare two definitions and explain the result:

```sh
bin/wildlands process diff --input /tmp/process-work/review.json --against /tmp/process-work/process.json
bin/wildlands process slides --input /tmp/process-work/review.json --format md
```

`diff` reports changed steps (with names), flows, resources, arrival rules and
process settings plus both revisions and fingerprints. `slides` explains the
process as a slide deck: an overview (SIPOC for business processes, phases and
touchpoints for journeys), the resource pools, every main-route step phase by
phase, every other path and a summary. Add `--minutes N [--seed S]` for read-only
facts from one fresh bounded run.

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

## Map a customer or user journey

A journey is a process whose cases are customers. Set `genre` to `customer-journey` or
`user-journey` (a display preset only), use `touchpoint` steps for the interactions,
annotate steps with `phase`, `emotion` (-3 to 3), `pain` and `opportunity`, and end the
journey with `outcome: "goal"` or `"lost"` steps. A touchpoint works like a task but
may use pools of any kind, or none, and may name a `channel` (`web`, `mobile`, `store`,
`phone`, `chat`, `email`, `social`, `ads`, `delivery`, `document`). List up to six
`track` fields to get measured averages. This small web shop loses 30% of visitors
after browsing, counts mood with a counter, and runs an open stream of visitors:

```json
{
  "format": "wildlands-process", "schemaVersion": 1, "revision": 0, "id": "web-shop", "name": "Web shop purchase", "seed": 7,
  "genre": "customer-journey", "track": [{"field": "mood", "label": "Mood"}],
  "start": "start",
  "resources": [{"id": "shop", "name": "Shop platform", "capacity": 2, "costPerMinute": 1, "kind": "system"}],
  "steps": [
    {"id": "start", "name": "Visitor arrives", "kind": "start", "phase": "Awareness", "scene": {"id": "scene-start", "position": [0, 0], "color": "#77b5a0"}},
    {"id": "browse", "name": "Browses the shop", "kind": "touchpoint", "channel": "web", "phase": "Consideration", "emotion": 1, "duration": 3,
     "add": {"mood": 1}, "pain": "Search results are slow.", "opportunity": "Show best sellers first.", "scene": {"id": "scene-browse", "position": [12, 0], "color": "#ffbb73"}},
    {"id": "intent", "name": "Interested?", "kind": "decision", "phase": "Consideration", "scene": {"id": "scene-intent", "position": [24, 0], "color": "#ffffff"}},
    {"id": "checkout", "name": "Checks out", "kind": "touchpoint", "channel": "web", "phase": "Purchase", "emotion": -1, "duration": 4,
     "resources": {"shop": 1}, "add": {"mood": -1}, "pain": "Account creation is required.", "scene": {"id": "scene-checkout", "position": [36, 0], "color": "#ffbb73"}},
    {"id": "delivery", "name": "Receives the parcel", "kind": "touchpoint", "channel": "delivery", "phase": "Delivery", "emotion": 2, "duration": 10,
     "timing": {"dist": "uniform", "min": 6, "max": 14}, "add": {"mood": 2}, "scene": {"id": "scene-delivery", "position": [48, 0], "color": "#ffbb73"}},
    {"id": "won", "name": "Order delivered", "kind": "end", "outcome": "goal", "phase": "Delivery", "scene": {"id": "scene-won", "position": [60, 0], "color": "#77b5a0"}},
    {"id": "lost", "name": "Left the shop", "kind": "end", "outcome": "lost", "scene": {"id": "scene-lost", "position": [36, 12], "color": "#d9777f"}}
  ],
  "flows": [
    {"id": "f1", "from": "start", "to": "browse"}, {"id": "f2", "from": "browse", "to": "intent"},
    {"id": "f3", "from": "intent", "to": "lost", "label": "Bounces", "when": {"chance": 30}}, {"id": "f4", "from": "intent", "to": "checkout"},
    {"id": "f5", "from": "checkout", "to": "delivery"}, {"id": "f6", "from": "delivery", "to": "won"}
  ],
  "arrivals": [{"at": 0, "open": true, "interval": 4, "gap": {"dist": "exponential", "mean": 4, "max": 30}, "draws": [{"field": "mood", "kind": "int", "min": -1, "max": 1}], "data": {}}]
}
```

Run it unlimited for a while (`wildlands process run --input shop.json --minutes 2000 --output report.json`)
and read the snapshot: `metrics.goals`, `metrics.lost` and `metrics.conversion` (permille;
676 means 67.6%), `metrics.tracked.mood` at the finish, and for each step `reached`
(distinct visitors who got that far), `entered` (visits) and `tracked.mood` (average mood
on entry, a measured curve per touchpoint). Drop-off between two steps is the difference
of their `reached`. To model more drop-off, add another decision with a `chance` route
to the same `lost` end; to model waiting, add a `timer` or give the touchpoint `timing`.
The numbers are scenario assumptions for one seed, not a forecast. Persona libraries,
attribution models and text sentiment are not supported; see
[Customer and user journeys](../reference/business-process-engine.md).

## Describe suppliers and customers (SIPOC)

Add the optional, descriptive `sipoc` to name who supplies the process and who receives
its result; it never changes a run. Inputs, process stages, outputs and measures are
derived by the view, so fill in only the parties (in the Definition editor: **Suppliers and customers (SIPOC)**, up to 8 of each, name up to 60 and what they supply or receive up to 160 characters):

```json
"sipoc": {"suppliers": [{"name": "Warehouse", "supplies": "Stock"}],
          "customers": [{"name": "Shopper", "receives": "Parcel"}]}
```

Up to 8 entries per list, names 1-60 characters, no duplicate name within a list.

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

## Model BPMN-class behaviour

Four optional fields cover what a BPMN model needs to be simulated; the full rules and
limits are in
[Simulation semantics for BPMN-class processes](../reference/business-process-engine.md).

Normal and Erlang durations: `"timing": {"dist": "normal", "mean": 30, "sd": 5}` or
`{"dist": "erlang", "k": 3, "mean": 30}`.

A condition built with `all`, `any` and `not` (the BPMN `&&`, `||` and `!`):

```json
{"id": "to-review", "from": "gate", "to": "review",
 "when": {"all": [{"field": "amount", "op": "gte", "value": 1000},
                  {"not": {"field": "vip", "op": "eq", "value": true}}]}}
```

An inclusive gateway: the fork names its join and activates every flow whose condition holds
(the flow without `when` is the default when none does); the join waits for exactly those
branches. Fields written on only some branches are not guaranteed after the join.

```json
{"id": "ship", "name": "Ship", "kind": "fork", "join": "shipped", "mode": "inclusive", "scene": {"id": "scene-ship", "position": [36, 0], "color": "#ffffff"}}
```

Multi-instance work (one receipt per visit, items counted in `queued` and `active`):
`"instances": {"count": 5, "mode": "parallel"}` or `{"field": "lines", "mode": "sequential"}`.

A boundary deadline, here non-interrupting: after 20 working minutes a new token follows
the flow marked `on: "deadline"` to its own end while the work continues. Use `"mode": "interrupt"`
to cancel the work and route the token along that flow instead.

```json
{"id": "approve", "kind": "task", "duration": 30, "resources": {"clerks": 1},
 "deadline": {"after": 20, "mode": "escalate", "flow": "approve-late"}}
{"id": "approve-late", "from": "approve", "to": "alert-end", "on": "deadline"}
```

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
round trip is lossless: the re-imported definition has the same fingerprint, including
descriptions and empty containers exactly as written. Import rejects unknown or invalid
extension values instead of coercing them. Importing BPMN from another tool lists every default or
folded element in `warnings`; add durations, resources and arrivals afterwards in
**Edit process…** (Tune values) and **Edit step…**, or with guarded edits. By default
(`--unsupported reject`) constructs the engine cannot simulate (transactions, compensation, error
boundary events, complex gateways) are rejected with their element ids and nothing is written;
with `--unsupported drop` they are removed or approximated instead (a complex gateway becomes an
exclusive decision), each with a warning. The studio offers the same through **Export BPMN**,
**Export BPMN with BPSim** and **Import…** (the **Import BPMN** dialog below). Add `--bpsim` to
`export-bpmn` to write a BPSim scenario beside the extension values. Exported XML is checked for
well-formedness, and the registered `business-process-bpmn` suite checks the demo and example
exports with the built-in BPMN 2.0 / BPSim 1.0 conformance validator (next section); an earlier
one-off run also used the OMG schema files
([record](../_archive/verification/bpmn-schema-conformance-2026-10-08.md)).

## Check a BPMN file against BPMN 2.0 and BPSim 1.0

Before handing a file to another tool, or to see why a modeler's file looks odd, check it:

```sh
bin/wildlands process validate-bpmn --input /tmp/process-work/review.bpmn
```

1. **Read the verdict.** Exit 0 and `"conforms": true` mean every checked element follows the
   BPMN 2.0 and BPSim 1.0 structure: known elements in the right order and number, allowed and
   well-typed attributes, unique ids and references that resolve. `checked` counts the elements
   checked.
2. **Fix each error.** Exit 2 lists `errors` with the `line`, an XPath-like `path` and a plain
   message naming the element, the attribute and the expected value, for example
   `Attribute timeUnit of bpsim:NumericParameter must be one of ms, s, min, hour, day, year, not
   "hrs".` or `bpmndi:BPMNDiagram is not allowed at this position inside bpmn:definitions` (a
   `relationship` must follow the diagrams). The `code` groups them (`element-unexpected`,
   `attribute-unknown`, `value-enumeration`, `idref-unresolved`, ...); see the
   [conformance validator](../reference/business-process-engine.md#conformance-validator).
3. **Mind what was not checked.** `notCovered` lists recognised elements the rules do not cover
   (choreography, conversation, correlation and partner elements, or a BPSim element outside
   `BPSimData`); `unchecked` counts extension content, such as the Wildlands `wl:` values, which
   the importer validates itself. A conforming report says nothing about them, and nothing about
   the BPMN specification's prose rules.

The check never decides what can be imported: `import-bpmn` and the studio's **Import BPMN** dialog
stay lenient with foreign files, and the dialog shows the same result as a **Standards check**
line.

## Import BPMN and its simulation parameters

Foreign BPMN (from a modeler, with or without a BPSim scenario) can be simulated, not just
drawn. Two illustrative files are in
[`source/wildlands/examples/bpmn/`](../../source/wildlands/examples/bpmn/README.md): a loan
application and a support ticket. Their numbers are synthetic.

```sh
bin/wildlands process import-bpmn --input source/wildlands/examples/bpmn/loan-application.bpmn --output /tmp/process-work/loan.json --report /tmp/process-work/loan-report.json
bin/wildlands process run --input /tmp/process-work/loan.json --minutes 3000 --seed 7 --output /tmp/process-work/loan-run.json
```

1. **Read the printed report.** `warnings` states every assumption (defaulted durations, folded
   merge gateways, service tasks run as automated steps, message waits, event races simulated
   by chance, rounded probabilities). `mapping` counts what each foreign element became;
   `--report FILE` writes every entry (`id`, `type`, `target`, `how`).
2. **Choose the process and the pools.** With several processes use `--process ID` (a call
   activity inlines its callee automatically). Lanes become pools named after them with
   `--default-capacity` people each; `--lanes ignore` leaves tasks unconstrained and
   `--no-auto-system-pool` keeps service tasks as plain tasks.
3. **Supply the numbers BPMN lacks.** Durations, probabilities, arrivals, capacities and costs
   come from a BPSim scenario (`--scenario ID` picks one; `--no-bpsim` ignores it). Without
   one, tasks get `--default-duration`, an exclusive gateway with several unconditioned flows is
   rejected (mark a default flow, add probabilities, or import with `--unsupported drop` to share
   them equally) and one case arrives at minute 0. Conditions such as `${amount > 20000}` only
   route cases whose arrivals carry that field: give start-event properties in BPSim, or add
   arrival `data` and `draws` afterwards in **Edit process…**. Timer and BPSim durations are
   ISO-8601 (`PT90M`, `PT1H30M`, `P1D`, `P1W`); `--minutes-per-day` (default 480) and
   `--minutes-per-hour` (default 60) say how many business minutes a day and an hour are, and a
   week is 5 days. There are no calendars or working hours: a timer counts business minutes.
4. **Handle rejections.** Exit code 2 prints `rejections` with the element id and the reason;
   nothing is written. Fix the model, or accept the approximation with `--unsupported drop`: every
   dropped element gets a warning, the flows around a dropped element with one way out are
   bridged and paths that only it reached are pruned; the import still fails if no end remains
   reachable.
5. **Run with a seed and compare.** `process run --seed N` is deterministic; vary the seed to see
   the spread. Treat the result as a scenario built on assumed distributions, not as a
   measurement of the original process.

Edit the imported JSON like any definition (the guarded `edit` recipes, or the studio). An
imported definition exports to BPMN again and re-imports to the same fingerprint.

**In the studio.** Choose **Import…** (on a phone, **⋯** then **Import JSON or BPMN…**) and pick
the `.bpmn` or `.xml` file. A JSON file still replaces the active process at once; a BPMN file
opens the **Import BPMN** dialog instead, and nothing changes until you choose **Import**:

1. Pick the **Process** and, with **Use BPSim simulation parameters** on, the **BPSim scenario**.
   The dialog lists the process's lanes and element counts.
2. Set **Lanes**, **Unsupported constructs** (reject or drop), **People per lane pool**,
   **System pool capacity**, **Business minutes per day**, **Default duration in minutes** and
   **Run service-type tasks on automated system pools**. A value out of range shows its problem
   under the field. Business minutes per hour stays 60 here; use the CLI to change it.
3. Read the **Standards check** line at the top: whether the file conforms to BPMN 2.0 and
   BPSim 1.0 and how many elements were checked, or how many problems it has with the first
   three. It is information only and never blocks **Import**.
4. Read the **Preview**, which updates shortly after each change: whether the result is ready to
   import, rejections with their element ids, warnings (the assumptions made) and the mapping
   grouped into steps, flows, pools, case fields, arrivals and SIPOC. The suggested run length
   from the BPSim scenario is shown only; set **Run until** yourself if you want it.
5. Choose **Import**. It is disabled, with the reason in the footer, while an option is invalid,
   the preview lists rejections or the result cannot run. If the current run is past minute 0
   or you have an unapplied draft, the dialog first says what will be discarded and starts on
   **Cancel**; choose **Import and replace** to continue. Export the run report or draft first if
   you need them.

The imported process replaces the active one with a fresh paused run at minute 0; time never
advances by itself. **Cancel**, **Close** or Escape leaves everything as it was. **Export ▾ →
Export BPMN with BPSim** writes the active process back out with a BPSim scenario.

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
a third button shows the process-type lens over the same simulation: **SIPOC** for a
business process, **Journey map** for a customer or user journey (the lens never offers
the other one), and **Present** opens the slide deck over the 2D map (see
[Present a process](#present-a-process)). A journey opens on its map; switching to another process keeps the lens
for a process of the same kind and otherwise returns to your last 2D or 3D choice.
Selecting a card or stage selects its step, and Escape clears it. Journeys also say
customers or users instead of cases, show Finished, Goals, Lost and Conversion, and up
to two tracked averages next to the run numbers.
**Step scenes** and **Whole process** change the view without advancing time.
**Edit process…** in the header opens the **Definition editor** (validation before **Apply draft and reset run**, see below); a chip beside it names an unapplied draft.
To change one step, select it and choose **Edit step…** beside **Frame view**. The step editor opens as a dialog whose sections follow the kind of step: basics, timing and cost, people and capacity (tasks), equipment (machine steps) or systems (system steps), completion values and counters, declared outputs, needs from earlier steps, backlog and outgoing flows (conditions on decisions, with a short summary of the order the paths are checked). Work steps and duration timers also offer **Random timing** (the planning duration stays the average shown in estimates while each visit draws its own time) and **Random outcomes (draws)** for chance, weighted-choice and whole-number fields; a decision path can take a random share of cases instead of testing a field. Inconsistent numbers are reported next to the field. Machine and system steps add an **Automation** section for the optional technology label and list only pools of their own kind; if the process has no machine or system pool yet, the dialog says so and points to the Definition editor. Problems the engine finds for the step appear beside the fields as you type, and the problem list at the top links to each field. **Save to draft** keeps your edits in the draft without starting anything and the draft summary reads, for example, "Unapplied draft: 1 step changed". **Apply and reset run** applies the whole draft (including other unapplied edits, which a banner announces); when a run is already in progress it first asks you to confirm that the run will be discarded, so export the run report beforehand if you need it. **Cancel**, Escape, **Close** and a click outside the dialog all ask before throwing edits away. The run pauses while the dialog is open. Touchpoints (customer or user interactions) have a **Journey** section for phase, channel, feeling, pain point and opportunity and list backstage teams and systems of any kind as optional; every other step has collapsed **Journey notes**, and end steps choose an **Outcome** (None, Goal reached or Customer or user lost). Adding or removing flows and steps is still done in the raw JSON draft. Forks add **Branching** (parallel, or inclusive with conditions on its paths), work steps add **Multiple instances** and a **Deadline** with its interrupt or escalate path, and any condition can be combined with **All of these**, **Any of these** or **Not**; **Random timing** and the arrival gap also offer Normal and Erlang distributions. The step editor never adds a flow: for a deadline it lets you choose among the step's existing flows and explains where to add the flow in the JSON when there is none.
The Definition editor is a dialog with two panes: **Tune values** (process name,
description, **Process type** (business process, customer journey or user journey) and **Seed**, up to six **Tracked measures** that the simulation averages to draw the measured curve, shared resources with their kind People, Machine or System,
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

**Studio layout.** On a window 1100 px wide or more the studio fits one screen: a compact
header and run toolbar, the step list on the left, the stage in the middle and the inspector on
the right, each column scrolling inside itself. **Run simulation** (**Pause** while playing) is
the only amber button; **Step 1 min**, **Advance 30 min** and **Reset run** follow, then
**Speed**, **Run until** and **Seed**, and finally **Activity**, the clock and the run state.
Typing a **Seed** (0 to 2,147,483,647) starts a fresh paused run that uses it ("Seed 7 · fresh
paused run"); Reset keeps it, importing or applying a definition returns to that definition's
seed. The status message sits under the stage title. **Inputs & outputs** is a collapsible panel
under the metrics (open by default on screens 1600 px wide or more). The inspector lists
**Shared resources** first (utilisation bars with percentages), then the step's details, including
**Random timing**, **Random outcomes** and the share of each chance route, or, for the whole
process, the seed and the arrival streams. On a phone the header keeps **Edit** and a **⋯** menu,
the run bar stays at the top with **Run options** holding the secondary controls, and steps
become a horizontal scroller above the stage. In a short window (for example 200% zoom on a
laptop) dialogs become one scrolling page with the main action kept at the bottom. The studio
follows your browser's default font size and has a dark theme only.

**Large maps.** When step names no longer fit on a zoomed-out 2D map, cards show their list
number instead (the hint reads "Card numbers match the step list · zoom in for names"); zoom in,
or select a step, to read names. Small cues such as deadline tags and instance pills keep a
readable glyph; hover them for a tooltip, or select the step, for their wording. The inspector's
overview counts multi-instance items, deadline firings and inclusive forks, and a step shows its
branching, instances and deadline with live counters.

**Export ▾** holds **Export JSON**, **Export BPMN**, **Export BPMN with BPSim**, **Export run report** and **Download HTML**
(arrow keys, Home, End and Escape work; the menu closes after a choice). **Activity** opens the
**Run activity** modal without pausing the run; its badge counts events since you last looked
(99+ at most). Filter by kind, step or case, choose a step name to select that step and return
to it in the list, and **Export CSV** or **Export JSON** the filtered events (`<process-id>.events.csv`
or `.json`, oldest first; text cells that start with `=`, `+`, `-` or `@` get a leading apostrophe).
The engine keeps its latest 128 events, and the modal says when earlier ones are not kept. While
the run plays the list follows it only when scrolled to the top with no filter focused;
otherwise a "N new events — Show" button waits.

**Export run report** downloads observed results, including retained task I/O. **Download HTML** embeds the
active definition (for a multi-process game, every applied process in list order)
and starts a fresh paused run when reopened. There is no
checkpoint import or automatic browser persistence in v1.

For reusable game folders, copy the agency `game.json` shape, choose an ID equal
to the folder name, set `template: process`, and point `content.definition` at
the process JSON (or `content.definitions` at 1-8 process JSON files, never both,
to let the studio switch between them). Set matching storage/output IDs. Keep the folder data-only.
The build has no external scripts, fonts, asset requests or account dependency.

## Present a process

To walk an audience (or a reviewer) through a process step by step, use the slide deck.

**In the studio.** Choose **Present** beside the view buttons (on a phone: **⋯**, then
**Present slides**). The window shows one slide at a time beside the process map: an
introduction (title, overview, resources), the main route phase by phase, every other path
and a summary. Use **Next** and **Previous**, the arrow keys, Page Up and Page Down, or Home
and End; **Contents** lists every slide by section. A step slide shows that step on the map,
and selecting a step on the map jumps to its slide. If a step is selected when you start,
the deck opens on its slide. Past minute 0 the slides add facts from the current run, named
by its minute and seed. Presenting pauses a running simulation and never advances it; **Exit**
or Escape returns to the view and selection you had, and the run stays paused until you choose
**Run simulation**. The deck explains the applied definition, not an unapplied draft.

**From the command line.** Review the same deck as text, optionally with facts from one bounded
run, and keep the file beside a change for review:

```sh
bin/wildlands process slides --input /tmp/process-work/review.json --format md --output /tmp/process-work/slides.md
bin/wildlands process slides --input /tmp/process-work/review.json --format md --minutes 2400 --seed 7
```

Read it as a learner: every step should say what happens, who does it, how long it takes,
what it needs and delivers and where the work goes next. "No description authored." marks a
step without a `description`; add one with `putStep`. The deck only restates the definition
and one run; it is not a forecast. For screenshots of the studio and Present mode at a chosen
minute (desktop, phone and a wider fallback font, with overflow and console-error reports),
run `npm run process:shots` in `source/wildlands` (see
[Verification suites](../reference/business-process-engine.md#verification-suites)).

## Agent completion checklist

1. Inspect and retain exact edit guards.
2. Dry-run complete transactions (entity and process-setting operations alike; never hand-edit
   the JSON); review diagnostics and `process diff` against the previous file.
3. Validate the complete graph and scene assets.
4. Run bounded cases covering each decision outcome, contention and rework.
5. Review actual Scene Forge views and both process projections where a browser
   is available; a headless simulation result does not certify visual quality.
6. Build the HTML and reopen it offline, then export/reimport JSON and HTML. Review
   `process slides --format md` and, where a browser is available, Present mode.
7. Report the source identity, executed tests, assumptions and unsupported rules. For engine
   or studio changes, the registered process suites are listed under
   [Verification suites](../reference/business-process-engine.md#verification-suites); a bounded
   run or a passing suite is not human or balance validation.
