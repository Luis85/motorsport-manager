# Business process engine

Definition-first contract for the Wildlands process extension, based on PR #40.
The JSON document is the source of truth. A process is a graph of step scenes;
case tokens execute that graph in the shared Wildlands ECS. Navigation and both
renderers observe detached snapshots and never execute business work.

## Definition and units

`format: wildlands-process`, `schemaVersion: 1`, stable `id`, `name`, integer
`revision`, `start`, `resources`, `steps`, `flows`, and `arrivals` are required.
Each step has a unique scene with a stable `id`, a two-dimensional map `position`
in metres (X/Z in 3D), a color, and an optional Scene Forge `asset` definition. Steps have
`start`, `task`, `timer`, `decision`, `fork`, `join`, or `end` kinds. Tasks declare whole
business-minute `duration`, optional `cost`, and simultaneous resource demands.
Tasks and timers may also declare `set` effects and `add` counters (execution rules 10 and 11).
Resource pools declare integer `capacity` and `costPerMinute`; costs are simulated
units, not currency or accounting entries. Pools represent capacity slots; moving
case markers and desk actors represent work, not physical people or a travel-time model.

One explicit simulation tick is one business minute. The shared ECS scheduler
receives its fixed 0.1-second step; this is an adapter interval, not business time.
Durations, arrivals and reported time use business minutes throughout. There is
no wall clock, ambient random source, network call or executable JSON expression
inside the simulation. Arrival records specify `at`, `count`, `interval`, and
scalar case `data`. The example's numbers are synthetic demonstration assumptions.

## Execution rules

1. At time zero admit due cases, resolve control steps, and allocate ready tasks.
2. A minute completes work already started; release all completed allocations,
   apply task `set` then `add` effects, fire timers that reach their due minute
   (rule 11), then route completions and admit arrivals due now.
3. Allocate queued tasks in entered-time, case-ID, token-ID order. Acquire all
   demands atomically; skip blocked work so another pool can progress. There is
   no preemption. Each task start charges its fixed cost once; occupied pool
   slots charge their per-minute costs for each actual work minute.
4. Start, task, timer and join have exactly one outgoing flow. End has none. A decision
   evaluates outgoing conditions in authored order and takes the first match,
   otherwise its single unconditional fallback. Conditions compare a case field
   (`eq`, `ne`, `gt`, `gte`, `lt`, `lte`) to a scalar `value` or to another case field
   named by `valueField` (exactly one of the two). Missing fields, on either side,
   never match, and the ordering operators need numbers on both sides.
5. A fork emits one token per outgoing flow and names a matching join. Parallel
   branches must be disjoint acyclic single-entry paths ending at that join.
   Nested forks and decisions within a parallel region are rejected in v1.
   Branches may update only disjoint case fields; `set` and `add` fields both count
   as writes. A branch may hold tasks and timers. The join consumes exactly one
   arrival per branch of that fork occurrence and emits one continuation.
6. Decisions outside parallel regions may implement bounded rework loops. A
   per-case transition limit fails that case explicitly and releases its work.
   A run has finite case, minute, transition, event and receipt limits; an
   arrival must occur strictly before the minute limit. Waiting work
   with no possible progress is reported as blocked, never silently completed.
7. **Backlogs.** A task or join may declare `backlog: {capacity, order, priority?, pull?}`.
   A task's backlog is its waiting queue: at most `capacity` items wait, and work
   that would exceed it stays *held* at its previous step (status `held`, event
   `held`) without resources until room appears. A join's backlog stores merged
   cases (status `backlog`, events `joined`, `backlogged`); a join does not merge
   while its backlog is full. `order` is `fifo` (default, oldest first), `lifo`
   (newest first) or `priority` (highest numeric case field named by `priority`
   first, ties oldest first); it ranks only within that step. A join's optional
   `pull` limits how many items may be queued or working in its next task; items
   are released (event `pulled`) in backlog order whenever the limit allows.
   Backlogs add no hidden capacity: resources still gate every task start.
8. **Needs.** Any step except start may declare `needs: [{field, op?, value?, label?}]`,
   the case data that earlier steps (or arrivals) must have delivered. A step
   delivers data with its task `set` effects. Admission analyses every route from
   the start (arrival data, task `set`, decision routes and parallel merges) and
   rejects a need that is not guaranteed on all routes with a `needs` diagnostic
   naming the step and need. Join needs are checked when the branches merge.
   The runtime repeats the check and fails a case explicitly if a need is unmet.
9. A case finishes only at an end with no outstanding parallel tokens. Throughput,
   active/queued cases, completed/failed cases, cycle time, task waiting time,
   resource utilization and simulated cost derive from that same state.
10. **Counters.** A task or timer may declare `add: {<field>: <delta>}` with one to eight
   fields, each a nonzero whole number within ±1,000,000. At completion the engine
   applies `set` effects and then adds each delta (a missing field counts as 0; a field
   also in `set` adds to the value just set). An existing value that is not a whole number,
   or a sum outside ±1,000,000,000, fails that case explicitly (for example
   `Step "X" cannot add to n because it holds "x", not a whole number.`), applies
   none of the step's effects, records no receipt and releases its work. Static `needs` analysis treats `add` as
   delivering a whole-number field on every route through the step, but cannot prove a
   counter's value, so a need that tests a counter with `op`/`value` is rejected; use a
   bare delivery need. Decisions do not narrow counters or field-to-field conditions.
   Bounded rework loops use a counter and `iteration lt iterations` style conditions.
11. **Timers.** A `timer` step waits without resources, cost or a backlog. It declares
   exactly one of `duration` (1 to 100,000 whole minutes after the token arrives) or
   `until` (an absolute business minute from 1 to 99,999; if the clock is already at or
   past it the timer fires at once, in the same minute, with zero wait). The token has
   status `timer` and a `due` minute, and fires in the pass for the first minute at or
   after `due`: it applies `set` then `add`, records a receipt, and routes like a
   completed task. Simultaneous timers fire in due-minute, case-ID, token-ID order after
   that minute's task completions. Timers use no pool capacity, so any number may wait
   at once, and may sit in parallel branches next to tasks. A pending timer is progress:
   the run is never `blocked` and never `completed` while one waits. If a timer's due
   minute lies beyond the run horizon it stays pending and the run reports `limit`.

Definition validation rejects unknown fields, duplicate identities, nonfinite or
out-of-range values, dangling flows/resources, invalid scene geometry, impossible
resource demands, unreachable steps and steps without a route to an end. These
checks do not prove all data-dependent loops terminate. Bounded execution makes
those failures observable.

## Authoring and ownership

The application owns the ECS world and clock. The domain owns schema admission,
routing and resource semantics. Browser code, CLI and AI agents use commands and
detached queries. Import validates the complete document before replacing the
active session; a failure retains the existing process. Editing creates a new
revision and resets only when explicitly applied. The browser starts paused.

Agent tooling exposes discover, schema, create, validate, inspect, edit, run,
build and forge operations under `wildlands process`. Edit recipes require an
expected revision and fingerprint, apply complete upserts/removals atomically,
support dry runs, and report the resulting definition plus validation diagnostics.
Drafts may have graph diagnostics between incremental edits; runnable/exported
definitions must pass all validation. Commands never execute arbitrary methods.

## Scenes, Scene Forge and builds

The overview shows the complete connected graph in 2D or real Three.js 3D.
Selecting a step opens its scene, resources, active work and queue. Switching
views or selecting another scene retains the same process time. Each step's
Scene Forge assets are interpreted by the existing Wildlands asset renderer.
The forge bridge emits one editable Scene Forge scene recipe per process step;
the reverse bridge admits Scene Forge's Wildlands asset export as scene assets.
No scripts, URLs or dynamically loaded modules are admitted as process assets.

Process definitions live in a data-only game folder with `template: process` and
exactly one of `content.definition` (one JSON path) or `content.definitions` (1-8
unique JSON paths; the first is the initially active process). Every listed file is
part of the folder inventory and digest and is admitted on its own; admission names
the failing index. A multi-process folder embeds the first entry as
`LWProcessDefinition` (so single-process consumers are unchanged) and the ordered
list as `LWProcessDefinitions`; the content profile exposes them as `process` and
`processes`. `build-game` and `process build` emit a single offline HTML
file containing the runtime, Three.js, CSS, process definition and scene assets.
The viewer imports/exports process JSON, runs/pauses/steps/resets simulations,
exports reports and downloads a new self-contained HTML with the current
definition. Exported HTML starts a fresh paused run; it is not a checkpoint.

When a game lists more than one process, the header shows a labelled **Process**
selector (hidden for one process) naming each definition. Switching has replace
semantics: a new paused session at minute 0, nothing selected, receipts and
inspector reset, the 3D surface and 2D frame rebuilt, with run length and view mode
kept. It never ticks the clock, even from a running process. The studio keeps each
process's applied (edited, applied or imported) definition and its unapplied draft
text in memory, so switching back restores both. Import and Apply replace only the
active process in place. Export JSON, BPMN, draft and run report act on the active
process only, as the subtitle states. **Download HTML** rewrites
`LWProcessDefinition` (the first list entry) and `LWProcessDefinitions` with all
current applied definitions in list order; the page reopens on the first process
with every edit. Unapplied drafts and runs are not included.

## BPMN 2.0 interchange

`process export-bpmn` and the studio's **Export BPMN** write BPMN 2.0 XML (model
and diagram interchange); `process import-bpmn` and **Import JSON or BPMN** read it.

| Wildlands | BPMN 2.0 |
| --- | --- |
| start / end | `startEvent` / `endEvent` |
| task (duration, cost, `set`, `add`) | `task`; resource demands as `performer` + `resourceRef` |
| timer (`duration`) | `intermediateCatchEvent` (id prefix `Event_`, event-sized shape) with `timerEventDefinition` / `timeDuration` `PT{n}M` |
| timer (`until`) | the same element with a `timeDate`; see below |
| decision, conditional flow | `exclusiveGateway` with `default`; `conditionExpression` (`${field == value}`, or `${field < otherField}`) |
| fork / join | diverging / converging `parallelGateway` |
| flow label | `sequenceFlow` `name` |
| resources | root `resource` |
| scenes, layout | `BPMNShape` / `BPMNEdge` (10 pixels per scene unit) |

Values BPMN has no field for (durations, `until` minutes, costs, capacities, `set`, `add`,
`needs`, `backlog`, `valueField` comparisons, arrivals, scene ids, colours, attached assets, the exact condition) travel in
elements of the `urn:wildlands:process:1` namespace inside `extensionElements`. An
export imports back to an identical definition (same fingerprint); other BPMN tools
ignore the extension. Exported files are not executable BPMN (`isExecutable="false"`).

An `until` timer waits for an absolute business minute, which BPMN cannot express
without a calendar. The exact minute travels in `<wl:step until="N"/>`; for tools that
ignore the extension the event carries a standard `timeDate` showing minute N counted
from the synthetic epoch `1970-01-01T00:00Z` (minute 200 is `1970-01-01T03:20:00Z`). That
text is display only: import trusts `until` from the extension and refuses a `timeDate`
without it. In `conditionExpression`, text values are always quoted (`${a == 'b'}`),
while a bare word other than `true`, `false` or `null` names another case field
(`${a < b}`); the exact comparison is in `<wl:when valueField="b"/>`. A field named
`true`, `false` or `null` gets no expression at all so the word is never ambiguous.

Import accepts one `process` with start and end events, `task`, `userTask`,
`manualTask`, `businessRuleTask`, `serviceTask`, `scriptTask`, `sendTask`,
`receiveTask`, `intermediateCatchEvent` with exactly one `timerEventDefinition` whose
`timeDuration` is `PT{n}M` or `PT{n}H` (n of at least 1; hours count 60 minutes),
exclusive and parallel gateways, sequence flows, resources and `resourceRef`
performers. Timers may sit in parallel branches and have one outgoing flow. Rejected
with a list of offending elements: sub-processes, call activities, boundary events,
intermediate throw events, catch events other than timers, timers with `timeDate`
(unless the Wildlands `until` extension is present), `timeCycle`, combined or
other ISO-8601 durations (`PT1H30M`, `P1D`, seconds), inclusive, event-based and complex
gateways, and conditions that are not `field op literal` or `field op field`. Reported as warnings, never
silent: durations defaulted (5 minutes, `--default-duration`), merge or pass-through
exclusive gateways folded into their flows, behaviour of service or script tasks not
executed, ignored event definitions, lanes and annotations, automatic layout, and a
default arrival of one case. Foreign ids are lowercased to the Wildlands id format.
The imported definition is checked like any other (needs, backlogs, graph rules);
a draft with diagnostics can be kept with `--draft`. XML with DOCTYPE or entity
declarations, more than 8 MiB or 64 levels of nesting is refused.
Conformance to the OMG XSD or any specific modeler was not verified.

## Explicit v1 boundaries

This is an executable process simulation format; BPMN 2.0 interchange covers only
the subset above. No external service execution, credentials, calendars, stochastic
distributions, nested parallel regions, interrupts, boundary or interrupting timers,
recurring or calendar-aware timers (timers count plain business minutes), counters
other than integer addition, compensation, live process
migration, saved-run restoration or native Godot process export is claimed.
Graph layout and scene presentation do not influence scheduling. Simulation
results describe authored assumptions and are not measured project forecasts.

## Observed inputs and outputs

Both projections share an **Inputs & outputs** panel with a case selector.
The overview retains each case's arrival `input` separately from mutable `data`.
Completed cases show their final process outputs; active and failed cases show
current data, explicitly distinguished from a completed result.

A task captures its input fields when resources are allocated and work starts,
not while queued. On completion it records a receipt with case/step identity,
start/finish minutes, captured `input`, observed case `output`, and `changes`
(the fields written by that task). A later task or rework visit cannot rewrite
an earlier receipt. Parallel tasks share case data: a receipt's output can also
contain fields already written by another branch; `changes` identifies exactly
what this task wrote. The Visit selector exposes retained completed visits.
Timers record receipts the same way: `started` is the arrival minute, `finished` the
fire minute, `input` the case data on arrival, and `changes` the `set` and `add`
results (an `add` field shows its observed new value); a timer without effects
records empty `changes`. Receipt ids for timers end in `:<stepId>`, because one token
can pass several immediate timers in the same minute. Before completion the panel
labels authored `set` effects as **Expected changes**.
No inferred or planned effect is presented as an observed output.

Snapshots and exported reports retain the latest 128 task receipts and report
`receiptsDropped` explicitly. Original inputs and final case outputs remain for
all admitted cases even when earlier task receipts leave this bounded history.
These are additive read-model fields. Timer read model: a token with status `timer`
and `due`, per-step `timers: {waiting, nextDue}` (`nextDue` is `null` when none wait;
timer tokens are not counted in a step's `queued`), and events `timer-started`
(detail `due <minute>`) and `timer-fired`. A task completion still emits `finished-task`.

## Presentation limits

The 3D view displays up to 120 work markers, prioritizing active work, with a
visible overflow count. Up to three active tokens per scene (32 across the view)
use articulated desk actors; additional work and queues use compact markers.
Actor hands, heads and posture animate only during playback and remain still
when paused or reduced motion is requested. These actors are a representation
of active work, not staff allocation, additional capacity or travel time.
Room props, shadows, task progress and occupancy labels are presentation only.
The 3D camera supports pointer orbit/zoom, right-drag or Shift-drag pan, and keyboard arrows (orbit), Shift+arrows or WASD (pan), +/− and F to frame. The 2D map supports drag pan, wheel/pinch zoom, arrows, +/−, 0 and on-screen zoom buttons. Cameras are presentation-only and never tick the run.

Rooms use a presentation theme (reception, office, design studio, test lab, workshop, review desk, records room, decision room, junction, dispatch dock) chosen from the step kind and a stable hash of the step id. A step with working tokens shows its animated task props and lit lamps; a step with none shows an idle variant (covered equipment, dimmed lamp, standby sign). Process Forge starter geometry (desk/monitor or podium/marker) yields to the themed room; custom attached geometry is drawn as authored.

Run length is a session option, not part of the definition or fingerprint. It defaults to the engine limit (100,000 minutes); `Runtime.create(definition, {horizon})` and `Session.setHorizon` accept a whole number of minutes or `null` for no clock limit. An unlimited run still stops when all work completes or cannot advance, and each clock command remains bounded to 100,000 minutes. Case count and retained history limits are unchanged.

The Definition editor tab edits the process as a whole: a form over the unapplied draft for the process name and description, resource capacity and cost and arrivals, plus the raw JSON draft. Edits update the draft only; Apply validates through the catalog and starts a fresh paused run that keeps the chosen run length.

A single step is edited in the **step editor**, a native modal `<dialog>` opened with **Edit step…** from the step inspector or the stage header. It is the same draft, not a second state: the dialog reads the draft text into a detached form model (`LWProcessStepModel`, pure functions with no DOM, session or storage) and writes edits back into a copy of the draft (`LWProcessStepEditor` is the UI surface). Sections follow the step kind: basics; timing (task duration and fixed cost, or a timer's duration or until-minute); people and capacity per shared pool; completion `set` values and `add` counters (tasks and timers); needs from earlier steps; backlog (tasks and joins); and this step's outgoing flows with their label and, for decisions, condition (a value or another field, with ordering). Every edit is checked live with `LWProcessCatalog.validate(candidate, true)` and the engine's diagnostics for this step appear beside the fields; nothing blocks typing. Representation problems that no definition can express (a blank or repeated field name, a non-numeric number) disable the footer actions with a visible reason. **Save to draft** writes the candidate to the draft and closes; **Apply and reset run** requires a fully valid draft (otherwise the diagnostics stay in the dialog and the draft is not written) and then applies exactly like **Apply draft & reset run**; **Cancel**, Escape and **Close** ask before discarding edits. Opening the dialog pauses a running simulation (a command, never a tick); the page behind is inert, so selection, process switching and the clock cannot change while it is open. Flows cannot be added or removed there. The dialog is a centred sheet up to 760 px wide and a full-screen sheet at 650 px and below.
Static paused scenes render only when the view or camera changes.

Each 2D scene shows a bounded marker sample plus an overflow count. All cases
remain in the data inspector, simulation and reports. Resource occupancy appears
in the inspector. The latest 128 events are retained; metrics cover the full run.
