# Developing systems and mechanics

## Current entry points

Run from the repository root with Python 3.10 or newer:

```sh
python3 scripts/mechanics.py list
python3 scripts/mechanics.py hooks
python3 scripts/mechanics.py scaffold resource_policy --hook forecast_parameters --dry-run
python3 scripts/mechanics.py scaffold resource_policy --hook forecast_parameters
python3 scripts/verify.py --godot /path/to/godot --suite extension_resource_policy
```

`list` reports the declared providers, prerequisites, versions and production
profiles. `hooks` reports the existing typed aggregate signatures. These are
source contracts, not a claim about a currently running save.

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
| Accepted commands and application ownership | `RaceCommands`, `RaceViewSession`, `RaceSessionRunner` |
| Read-only minimal screen | `MinimalWeekendQuery`, `RaceVisualSource` |
| Retained diagnostic screens | `RaceViewQuery` and injected application services |
| Editor commit/history | `TrackEditorSession` |
| Track compilation and preview scheduling | Application editor services |
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

## Verification sequence

```sh
python3 scripts/check_architecture.py
python3 scripts/verify.py --godot /path/to/godot --suite mechanics_tests --suite editor_session_tests
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

## Completion boundary

Behavior inheritance, UI-owned ticking, direct UI aggregate access, and editor
filesystem/committed-document ownership have been migrated in this PR. The
shipping minimal route now includes configuration, welcome, physical sessions
and final classification. Existing diagnostic screens use detached read models.

**The broad typed-car entity migration is not complete.** Runtime car/system
records still use the validated dictionary schemas required by existing saves
and domain services. The new provider interface and hook checks do not convert
those records into typed entities. Completing that migration requires updating
all authoritative consumers and validating save/replay compatibility together;
a typed wrapper with a writable legacy dictionary would not close the boundary.
No new physics calibration, threaded runtime, psychological model, or universal
performance/accessibility guarantee is part of this continuation.

## Primary technical references

Godot's scene-organization guidance supports focused, loosely coupled scenes and
externally supplied dependencies. Its Object metadata and Dictionary semantics
inform the construction checks and explicit copying used here. These references
support implementation choices, not proof that this game's behavior is correct:

- https://docs.godotengine.org/en/stable/tutorials/best_practices/scene_organization.html
- https://docs.godotengine.org/en/stable/classes/class_object.html
- https://docs.godotengine.org/en/stable/classes/class_dictionary.html
