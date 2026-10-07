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
`start`, `task`, `decision`, `fork`, `join`, or `end` kinds. Tasks declare whole
business-minute `duration`, optional `cost`, and simultaneous resource demands.
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
   apply task `set` effects, then route completions and admit arrivals due now.
3. Allocate queued tasks in entered-time, case-ID, token-ID order. Acquire all
   demands atomically; skip blocked work so another pool can progress. There is
   no preemption. Each task start charges its fixed cost once; occupied pool
   slots charge their per-minute costs for each actual work minute.
4. Start, task and join have exactly one outgoing flow. End has none. A decision
   evaluates outgoing conditions in authored order and takes the first match,
   otherwise its single unconditional fallback. Conditions compare a case field
   (`eq`, `ne`, `gt`, `gte`, `lt`, `lte`) to a scalar; missing fields never match.
5. A fork emits one token per outgoing flow and names a matching join. Parallel
   branches must be disjoint acyclic single-entry paths ending at that join.
   Nested forks and decisions within a parallel region are rejected in v1.
   Branches may update only disjoint case fields. The join consumes exactly one
   arrival per branch of that fork occurrence and emits one continuation.
6. Decisions outside parallel regions may implement bounded rework loops. A
   per-case transition limit fails that case explicitly and releases its work.
   A run has finite case, minute, transition, event and receipt limits; an
   arrival must occur strictly before the minute limit. Waiting work
   with no possible progress is reported as blocked, never silently completed.
7. A case finishes only at an end with no outstanding parallel tokens. Throughput,
   active/queued cases, completed/failed cases, cycle time, task waiting time,
   resource utilization and simulated cost derive from that same state.

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
`content.definition`. `build-game` and `process build` emit a single offline HTML
file containing the runtime, Three.js, CSS, process definition and scene assets.
The viewer imports/exports process JSON, runs/pauses/steps/resets simulations,
exports reports and downloads a new self-contained HTML with the current
definition. Exported HTML starts a fresh paused run; it is not a checkpoint.

## Explicit v1 boundaries

This is an executable process simulation format, not a BPMN 2.0 interchange
implementation. No external service execution, credentials, calendars, stochastic
distributions, nested parallel regions, interrupts, compensation, live process
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
Before completion the panel labels authored `set` effects as **Expected changes**.
No inferred or planned effect is presented as an observed output.

Snapshots and exported reports retain the latest 128 task receipts and report
`receiptsDropped` explicitly. Original inputs and final case outputs remain for
all admitted cases even when earlier task receipts leave this bounded history.
These are additive read-model fields; the definition schema is unchanged.

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

The Definition editor tab includes a form over the unapplied draft (names, descriptions, resource capacity and cost, task duration, cost and resource needs, arrivals). Edits update the draft only; Apply validates through the catalog and starts a fresh paused run that keeps the chosen run length.
Static paused scenes render only when the view or camera changes.

Each 2D scene shows a bounded marker sample plus an overflow count. All cases
remain in the data inspector, simulation and reports. Resource occupancy appears
in the inspector. The latest 128 events are retained; metrics cover the full run.
