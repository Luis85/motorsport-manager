# Developing systems and mechanics

## Current entry points

Run from the repository root with Python 3.10 or newer:

```sh
python3 scripts/mechanics.py list
python3 scripts/mechanics.py hooks
python3 scripts/mechanics.py validate --dry-run
python3 scripts/mechanics.py scaffold resource_policy --hook forecast_parameters --dry-run
python3 scripts/mechanics.py scaffold resource_policy --hook forecast_parameters
python3 scripts/mechanics.py validate --godot /path/to/godot --mechanic resource_policy
```

`list` reports the declared providers, prerequisites, versions and production
profiles. `hooks` reports the existing typed aggregate signatures. These are
source contracts, not a claim about a currently running save.

`validate` selects registered construction/behavior suites and delegates to the
normal isolated verifier, including import, fail-closed engine-log checks and
owned-process cleanup. It always runs `mechanics_tests`; inactive providers add
their registered `extension_<id>` suite. Repeat `--mechanic` to narrow inactive
extension tests, or omit it to check every catalogued extension. No runtime
provider is discovered or enabled. A missing test registration, malformed literal
definition, duplicate ID or unknown selection is an actionable error.
`--dry-run` reports `engine_executed: false`: selection is not validation.

The generated-code development fixture exercises a typed `RaceCar` observation
(`neutral`), a typed-car mutation signature (`wear_car`), a scalar observation
(`weather_advice`) and no-argument hooks (`step`, `snapshot`). Its pass-through
state comparison is only scaffolding evidence. New rules still need focused
behavior, rejected-input, predecessor-order and restore tests before activation.

`scaffold` creates a `RaceMechanic` provider and a headless regression test, then
registers that test in the single verification registry. The generated provider
forwards to its predecessor, so it deliberately changes no sporting behavior.
The generated test constructs the real profile, installs the extension, enters
an active session, and compares full state and random state after fixed steps.
The tool rejects malformed identifiers, duplicate identities/classes, unsupported
hooks, overwrite attempts and paths escaping through symlinks. A failed write
rolls back files already written. It is a local authoring tool, not a concurrent
repository transaction service.

**Scaffolding never enables a mechanic in the game.** Review the generated code,
add behavior-specific tests, and then explicitly append the provider in
`RaceMechanicProfiles.build` for the desired new-session profile. For example,
an extension that requires practice must follow the installed practice provider.
Do not merely append its identity after practice in `ORDER` and assume the
existing `build("practice")` call will include it.

## Implementing a behavior change

Choose a focused domain responsibility. Input is the authoritative aggregate and
validated parameters; simulated time is supplied by the domain tick. Return
values and domain events are data. Never read a UI node, use wall-clock time,
perform I/O, retain the aggregate in a provider, or spawn a second simulation.
Keep presentation wording and rendering out of the rule calculation.

Every declared hook must be an explicit aggregate dispatch entry point.
`RaceHookContract` checks the argument count, simulation argument and typed
parameters/returns at construction time. It distinguishes void from Variant.
The architecture checker compares the hook manifest with actual aggregate
entry points. No reflection is added to each fixed step. Variant-valued legacy
contracts remain dynamic and require behavior tests; this is not a complete
static typechecker or sandbox for untrusted scripts.

Use `sim.mechanics.before(your_id, hook, arguments)` once where the predecessor
should run. Calling `sim.<same_hook>()` would dispatch back to your provider.
Do not change order casually: arithmetic and random draws are order-dependent.
Installation receives detached geometry and options, preventing accidental
modification of caller-owned track data or another provider's setup input.

A no-op extension needs no saved state. A stateful extension does: identify its
owned fields, initialize them deterministically, include them in a versioned
snapshot, validate them on restore, and reconstruct the provider in the matching
profile. A metadata `version` alone does not perform a migration. Never enable a
stateful extension whose save can restore without the rule that owns its state.

## Data ownership and presentation

| Responsibility | Entry point |
|---|---|
| Domain rules and resource conservation | `scripts/domain/mechanics/`, focused domain services |
| Accepted commands and application ownership | `RaceCommands`, `RaceViewSession`, `RaceSessionRunner` (application only) |
| Minimal UI capabilities | `MinimalRaceHandle`, `MinimalWeekendQuery`, `RaceVisualSource` |
| Retained diagnostic screens | `RaceViewHandle`, `RaceViewQuery` and injected ports |
| Legacy base checkpoint preparation | `RaceCheckpoint.prepare_base`; complete acceptance remains in `RaceSim.restore` and profile readers |
| Editable/publishable track policy | `TrackDocument.draft_errors`, `publication_errors`, `validate` |
| Editor commit/history | `TrackEditorSession` |
| Track compilation and preview scheduling | Application editor services; canvas gets `TrackPreviewHandle` without a clock |
| Disk, image loading and archive operations | Ports implemented by `scripts/services/` |
| Scene composition and input wiring | `scripts/composition/` |

For a new instrument, extend the appropriate detached query and its tests, then
render its values. Do not expose a live car dictionary or add a simulation tick
to `_process`. For a new command, validate target/phase in the domain and route
it through the application command path, including accepted-command recording.

For an editor change, read a draft **and its observed revision**. Pass that
revision to `commit(draft, expected_revision)` or
`save(port, draft, expected_revision)`. Never substitute the latest revision
when an older gesture completes. Undo, redo and document replacement invalidate
older revisions. Cancel returns the canonical document without deleting redo.
A repository failure keeps the user's edited work available for retry.

Keep pure authoring constraints in `TrackDocument`, not in a view or storage
adapter. `draft_errors` permits a short/open road but validates nested metadata,
finite values and bounds. `publication_errors` first applies that safe-draft
contract and only then the complete circuit contract. Commit, save and export use
those shared policies; the session still owns revisions, history and mutation.
A new operation should transform a detached draft (using `TrackEdit` where useful),
commit with its observed revision, and test cancel/stale/failure cases through the
session. Compilation results and running-weekend tracks are independent copies.

## Verification sequence

```sh
python3 scripts/check_architecture.py
python3 scripts/verify.py --godot /path/to/godot --suite mechanics_tests --suite editor_session_tests --suite car_record_tests
python3 scripts/verify.py --godot /path/to/godot
```

The normal runner includes authoring-tool tests, including a real Godot import
and run of a generated extension. CI runs all registered suites in six shards
and rejects missing, duplicate, partial or mixed-source evidence. Focused runs
are labeled focused and cannot satisfy the full aggregate gate.

For an intended behavior-preserving refactor, retain the 24 pinned sporting
checkpoints and full weekend/replay regressions. For an intentional behavior
change, define the new expectations and version the model explicitly rather
than silently replacing baseline hashes. Test rejected commands, failed saves,
empty/retired states, disposal, and repeated observations as well as success.

## Typed car and save contracts

Authoritative car parameters are `RaceCar`; the aggregate owns `Array[RaceCar]`.
Use declared fields inside rules. The 91-field codec has no writable backing
record: `to_record()` and `RaceCar.records()` produce detached external values,
while `detached_copy()` creates an independent entity. Copying an array of
Objects is not the same operation. Do not serialize Object identity.

When adding a persisted field, update the typed field, codec field list/output,
constructor initialization, semantic checkpoint validation and explicit migration
together. Test missing/unknown fields and full-precision JSON round trips.
`from_record()` checks structural types and finite values, not all domain ranges;
external saves must still go through the production checkpoint validator.
Nested wheels, setup and journals remain owned versioned records.

Edit legacy base-data preparation in `RaceCheckpoint.prepare_base`. It preserves
v1 service choices, v2 finite set initialization and v3 wheel/setup/surface defaults
in the original order. Its default-record and compound parameters are narrow
values, not a simulation context. It returns detached prepared data or an empty
record on rejection, never an installed session. Do not treat successful preparation
as semantic acceptance: `RaceSim.restore` still validates state/identity before
hydration; profile readers retain their own versioned state and composition checks.
The input version is not silently rewritten. Add regression fixtures to
`car_record_tests` and retain legacy, replay and sporting characterization suites.

Domain command rejection still uses the existing Boolean outcome plus `last_error`;
application command handles copy inputs, route intent and expose error feedback.
Accepted input is recorded through the established path. Validation precedes
mutation; errors may change feedback, not sporting state, resources or RNG. No
parallel command API or new replay format is introduced by this pass.

## Presentation and scheduler ownership

Composition creates `MinimalRaceSession` or `RaceViewSession`; pass only `.view`
to a widget and give `.runner` to application lifecycle ownership. The view gets
`RaceSessionStatus`, not a ticking object. Replay uses `ReplaySessionBinding`
with the same separation. Command/query/director handles must not keep a discarded
simulation alive; expired handles return unavailable data or reject commands.
The editor canvas similarly receives `TrackPreviewHandle`, never its scheduler.

## Completion boundary

The planned behavior-inheritance, typed-entrant, detached-presentation,
application-scheduler and editor-transaction migrations are implemented. This
includes retained diagnostic controllers, not only the shipping minimal UI.
Existing serialized names/model behavior remain compatible, including old
selection/playback checkpoint fields. Not every nested data record is an Object,
and GDScript conventions/static checks are not a sandbox for untrusted code.
No new physics calibration, threaded runtime, psychological model, or universal
performance/accessibility guarantee is part of this continuation. Final release
evidence must identify its source; historical counts are not current verification.

## Primary technical references

Godot's scene-organization guidance supports focused, loosely coupled scenes and
externally supplied dependencies. Its Object metadata and Dictionary semantics
inform the construction checks and explicit copying used here. These references
support implementation choices, not proof that this game's behavior is correct:

- https://docs.godotengine.org/en/stable/tutorials/best_practices/scene_organization.html
- https://docs.godotengine.org/en/stable/classes/class_object.html
- https://docs.godotengine.org/en/stable/classes/class_dictionary.html
