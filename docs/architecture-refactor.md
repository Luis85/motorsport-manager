# Architecture — 0.19.0

> **Post-PR24 orientation:** The 0.19.0 ownership model below remains in force after the merged content refactor. [Current project status](current-state.md) records the present shipping/diagnostic boundary and exact release evidence. On the tech/doc maintenance branch, `TrackCanvasOverlays` now owns read-only car/road-surface/selection painting and sampled surface geometry. `TrackCanvas` retains geometry-cache invalidation, input/gestures, document state and view lifecycle; neither owns simulation time or sporting data. Original suite-count statements below describe their dated implementation checkpoints, not the current registry.

This map includes the completed PR #19 foundation, merged PR #20 maintainability
pass and the subsequent system-contract hardening. It is not a continuation of
the former PR #18 branch.
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

## Campaign content ownership

The Team Principal campaign now follows the same immutable-content rule as a
weekend. `ContentCatalog` resolves one selected `CampaignDefinition`;
`CampaignStarter` interprets that data through existing competition, economy,
personnel, operations and rival transactions rather than owning duplicate balance
tables. `CampaignContentSnapshot` freezes the campaign record, every referenced calendar circuit,
and the effective weekend, vehicle, roster, tyre, setup, race-tuning and mechanic definitions into
`CampaignManagement` before publication.

Later campaign departures and weekend settlement read that frozen closure rather
than the live catalog. Thus an external pack can change a future career but cannot
rewrite an active season. Version-1 management envelopes remain readable with
explicit legacy policy defaults; new careers must use a validated campaign
definition. Numeric policy data may tune supported rival/people/supply algorithms,
but external content cannot add algorithms, executable providers or relax
structural/safety bounds.

## Race aggregate implementation split\n\n`RaceSim` remains the public aggregate and mechanic-dispatch surface. Its implementation is now split without changing authority: `RaceSimFoundation` owns authoritative state and deterministic utility APIs, `RaceSimCore` owns fixed-step/session/surface/on-track movement base behavior, and `RaceSimOperations` owns pit/recovery/persistence-projection base behavior. `RaceSim` itself constructs the aggregate, restores checkpoints and exposes the registered mechanic hooks. Existing derived compatibility profiles still extend `RaceSim`; save versions, hook names and arithmetic/RNG order are unchanged.\n\nThe UI follows the same responsibility split: `WeekendView` keeps concrete composition and live refresh over `WeekendViewSupport`; the native shell delegates campaign orchestration to `CampaignScreens`; the Minimal pitwall delegates timing-table diff/reorder work to `MinimalRaceTimingPresenter`. These collaborators do not own simulation time or authoritative state.\n\n## Race and replay lifetimes

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

`RaceCheckpoint.prepare_base` owns detached base-envelope checks and the existing
v1-v3 data preparation for native v4 reconstruction. It receives default records
and supported compounds, not a running aggregate. Empty output means rejected
preparation; non-empty output is **not** complete acceptance. `RaceSim.restore`
still validates surface/semantic state, stable entrant identities, field types
and ranges before constructing typed entrants. Profile-specific readers retain
their own version/state checks and install the matching mechanic composition.
Preparation does not rewrite the source version, consume gameplay randomness,
mutate input records or change migration defaults.

Nested tyre sets, setup, histories and system journals remain explicit versioned
records owned by their entity or subsystem. A copied `Array[RaceCar]` still holds
the same objects; use `RaceCar.records()` for an external value projection or
`detached_copy()` for an independent domain fixture. Never use Object identity
as a saved-state equivalence test.

Save/model versions, serialized names, units, arithmetic order and random-draw
order are retained. Compatibility selection/playback fields remain in the old
snapshot format and are excluded from sporting equivalence. This does not give
presentation ownership of the live checkpoint.

## Command and infrastructure preflight

`RaceSim.command` owns whole-payload structural validation before its detached
provider dispatch. `RaceCommands` owns weak application routing and feedback;
it no longer deep-copies unchecked input. Scalar/target/Boolean semantics remain
in `_base_command` or the mechanic that owns the rule, before mutation. Rejection
can change feedback but not sporting state, resources, RNG or accepted journals.
The public Boolean/error and accepted replay-record contracts remain unchanged.

`RaceStateValue.serializable` supplies the existing shared finite-value, key-type,
depth and collection limits to car codecs, commands, mechanic construction and
track validation. It is not schema acceptance and does not replace domain ranges,
identity, tyre ownership or profile/migration checks.

`Storage` owns bounded JSON decoding and recoverable temporary/backup replacement.
Its nested `FileOperations` adapter exposes only the filesystem steps needed by
that policy. Domain/application ports still own save semantics. Fault tests cover
each stage, including failed rollback and preserving the previous saved state.
Rollback is attempted only for an original preserved by the current attempt;
failed recovery names the surviving backup. No schema or save version is added.

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
geometry/options after structural preflight. Invalid metadata/options are
retryable without a partial installation; identities cannot contain whitespace.
Invalid predecessor identity/declaration gets an explicit dispatcher error and no
fallback execution. Running sessions cannot silently hot-swap their rules.

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

Pure editable-document validation belongs to `TrackDocument.draft_errors` and
its bounded serialized-value traversal; `publication_errors` adds complete-track
validation for saving and exporting. The session invokes these shared policies
but remains the single revision/mutation owner. Open, short and unnamed drafts
remain editable; malformed nested data does not. Legacy positional-node imports
retain their validated normalization path. Native rejection and running-track
isolation cases exercise this boundary.

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
Literal aliases to the same prohibited authority classes are rejected too;
preloading an aggregate under another name cannot bypass its global-class rule.
Godot import and runtime tests complement this intentionally limited static scan.
It is not a complete GDScript parser or a security sandbox against reflection.

The completed foundation's 64 entry points remain registered. The contract pass
adds `command_contract_tests` and `storage_contract_tests`; current main adds
`game_flow_coherence_ui_tests`. The integrated registry retains all 67 entry points
and extends construction assertions in `mechanics_tests`. Python authoring and
architecture adversaries complement, but do not substitute for, real Godot tests.
CI uses six shards and a required aggregate `verify` gate. Missing, failed,
partial, duplicate, malformed, mixed-source or stale-source evidence is rejected.
Engine errors fail a suite even when its own JSON says `passed: true`.

The runner validates registry structure, native/layout/timeout types, bounded
existing test-script paths and unique JSON report filenames before import,
execution or aggregation. `tests/fixtures/required_verification_suites.json` is
the monotonic regression floor for all 67 established suites, not an alternate
execution registry. Missing required suites fail before launching Godot.

Regression includes the 24 unchanged sporting-state checkpoints, complete
physical weekends, replay, old-save migration, finite stock, native input,
scaled layouts, failed persistence, stale drafts and discarded-session lifetimes.
The populated-screen suite has a bounded 900-second budget because its own
physical lineage and 149 native captures exceeded the previous 360-second limit
on a hosted runner. Coverage and assertions were not removed.

## Completion boundary

PR #19 completed the planned behavior-composition, typed-entrant,
all-UI detached-presentation, scheduler-ownership and editor-transaction migration.
PR #20 builds upon it with shared authoring verification, literal authority guards,
pure track policy ownership and detached legacy checkpoint preparation. See
[Maintainability assessment and handoff](maintainability-pass.md) for its concrete
scope, measured baseline, verification status and deliberately deferred work.
[System contract completion](system-contract-completion.md) records the subsequent
command/structural-value, authoring, construction and filesystem failure work,
including exact-source acceptance and the decision not to add a speculative cache.
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
and static typing. Reference documentation for these established foundations:

- https://docs.godotengine.org/en/stable/tutorials/best_practices/scene_organization.html
- https://docs.godotengine.org/en/stable/classes/class_refcounted.html
- https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/static_typing.html
