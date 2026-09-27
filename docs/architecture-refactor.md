# Architecture — 0.19.0

This is the current architecture map for the PR #19 continuation on PR #18.
The earlier 0.18.0 design and its evidence remain in Git history. Test counts
belong to the source-pinned run that produced them, not to this architecture map.

## Ownership and dependency direction

| Layer | Owns | Does not own |
|---|---|---|
| `scripts/domain/` | Race aggregate, typed entrants, mechanic rules, finite resources, timing, pure track operations | Widgets, filesystem access, wall clocks, scene lifecycle |
| `scripts/application/` | Commands, queries, live/replay scheduling, editor transactions, weekend entry, recording and result use cases | Native rendering or concrete filesystem implementations |
| `scripts/services/` | Godot lifecycle integration, supplied elapsed time, storage and content adapters | Sporting calculations or UI components |
| `scripts/ui/` | Native controls, layout, input intent, interpolation, rendering and uncommitted gestures | Live cars, simulation objects, runners, disk operations or authoritative time |
| `scripts/composition/` | Assemble collaborators, connect navigation and lifecycle signals | A second set of gameplay rules |

Dependencies point inward. Infrastructure implements application ports; native
composition injects those ports into views. `App` supplies elapsed time to the
application-owned runners. It does not calculate car movement or pit outcomes.
The race editor and race weekend are separate contexts sharing pure track data,
not a mutable active-race document.

## Race and replay lifetimes

`RaceSessionRunner` owns one active `RaceSim`. `RaceStepClock` preserves the
0.05-second step, frame-spike cap, pause boundaries and existing speed policy.
Invalid elapsed values are rejected before mutation. A frame cap can discard
wall time; equal wall time is not a determinism guarantee.

`MinimalRaceSession` and `RaceViewSession` are composition bindings. Only their
`view` handles reach widgets. `MinimalRaceHandle` and `RaceViewHandle` expose
commands, detached queries and `RaceSessionStatus`, not a runner. Save status
is read only. Controls, visual sources and optional directors use weak source
references: retaining an obsolete widget handle cannot retain a discarded race.
Expired handles return unavailable data or reject actions without an engine error.

`ReplaySessionBinding` owns replay reconstruction and its playback runner.
`ReplayViewSession` exposes observation, seeking and playback intent but no tick
operation or live engine. Native composition suspends the original runner,
creates independent sandbox runners, and restores the original runner on return.
The editor follows the same policy: `TrackPreviewHandle` exposes toggle/stop and
copied readouts; only the application advances the reference preview.

Phase autosaves occur through application lifecycle observation, including the
initial paused session. They do not depend on screen refresh or visibility.
Changing a panel, text size, camera or display cadence cannot advance the race.

## Typed entrants and serialized boundaries

The aggregate stores `Array[RaceCar]`. `RaceCar` has 91 declared fields and no
writable backing dictionary. Authoritative movement, timing, pit service,
resource progression, strategy and mechanic hooks receive typed entrants.

`RaceCar.to_record()` produces detached records for saves and read models.
`from_record()` rejects unknown/missing fields, incompatible scalar types,
non-integral IDs, non-finite values, nested Objects and excessive/cyclic nesting.
The existing checkpoint validators still own semantic ranges, valid routes,
set ownership and version migration. Passing the codec is not sufficient to
accept an arbitrary imported checkpoint.

Nested tyre sets, setup, histories and system journals remain explicit versioned
records owned by their entity or subsystem. A copied `Array[RaceCar]` still holds
the same objects; use `RaceCar.records()` for an external value projection or
`detached_copy()` for an independent domain fixture. Never use Object identity
as a saved-state equivalence test.

Save/model versions, serialized names, units, arithmetic order and random-draw
order are retained. Compatibility selection/playback fields remain in the old
snapshot format and are excluded from sporting equivalence. This does not give
presentation ownership of the live checkpoint.

## Composed systems

The former Strategy → Weather → Recovery → Practice behavior inheritance chain
is replaced by ordered `RaceMechanic` providers. Compatibility construction and
restore classes directly extend `RaceSim`. `RaceMechanicProfiles` explicitly
assembles the supported profile for each newly created or restored session.

Construction validates the complete proposal before installation: identity,
version, prerequisite order, actual dispatch hooks, argument counts and typed
parameters/returns. `before(id, hook, arguments)` invokes the predecessor while
retaining the original arithmetic and RNG order. Reflection happens during
construction, not once per car per simulation step. Installation gets detached
geometry/options. Running sessions cannot silently hot-swap their rules.

See [Composed mechanics](composable-mechanics.md) and
[Developing systems and mechanics](developing-mechanics.md) for authoring commands,
registration, state compatibility and tests.

## Track editor and weekend flow

`TrackEditorSession` owns the canonical document, read-only revision, saved
signature and bounded undo/redo history. The canvas edits a draft. Commit/save
must carry the revision observed when that draft was created; undo, redo and
replacement invalidate older gestures. Failed writes retain work for retry.
Compilation and diagnostics belong to application services; filesystem and
reference-image operations are implemented by injected infrastructure ports.
A running race owns a detached compiled track, unaffected by subsequent editing.

`WeekendLaunch` stages configuration and welcome without replacing a saved race.
It validates the circuit and options and requires the observed launch revision.
Initial practice persistence must succeed before replacing the active weekend.
Back/cancel preserve the previous event; stale and repeated commits are rejected.
The physical practice, qualifying, formation, lights, racing and final results
remain the existing simulation. `WeekendSummary` supplies factual end-screen data.

See [Editor and weekend contracts](editor-and-weekend-boundaries.md).

## Executable rules and verification

`python3 scripts/check_architecture.py` resolves global classes and literal
script references. It checks dependency direction, forbids domain I/O and wall
clocks, prohibits live entities/runners in every UI component, and compares the
hook manifest to real aggregate dispatch points. Fixtures test the checker.
Godot import and runtime tests complement this intentionally limited static scan.
It is not a complete GDScript parser or a security sandbox against reflection.

The verification registry retains all previous required suites and adds mechanic,
editor, entry, presentation, entity and codec tests: 64 registered entry points.
CI uses six shards and a required aggregate `verify` gate. Missing, failed,
partial, duplicate, malformed, mixed-source or stale-source evidence is rejected.
Engine errors fail a suite even when its own JSON says `passed: true`.

Regression includes the 24 unchanged sporting-state checkpoints, complete
physical weekends, replay, old-save migration, finite stock, native input,
scaled layouts, failed persistence, stale drafts and discarded-session lifetimes.
The populated-screen suite has a bounded 900-second budget because its own
physical lineage and 149 native captures exceeded the previous 360-second limit
on a hosted runner. Coverage and assertions were not removed.

## Completion boundary

This iteration completes the planned behavior-composition, typed-entrant,
all-UI detached-presentation, scheduler-ownership and editor-transaction migration.
It deliberately does not replace every small serialized record with an Object,
introduce threads, recalibrate physics, add player commands or invent campaign
systems. Public API boundaries and tests enforce architectural rules; GDScript
private-name conventions are not a sandbox for untrusted extensions.

Human playtesting, physical controllers/screen readers, Windows exports and
representative-device performance remain separate validation activities. A Linux
regression pass is not evidence of those outcomes or a universal FPS guarantee.

## Primary technical references

The project's implementation applies, rather than claims certification against,
Godot's guidance on injected scene relationships, RefCounted lifetime management
and static typing. Consulted during this continuation:

- https://docs.godotengine.org/en/stable/tutorials/best_practices/scene_organization.html
- https://docs.godotengine.org/en/stable/classes/class_refcounted.html
- https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/static_typing.html
