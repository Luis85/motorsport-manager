> **0.19.0 continuation:** The shipping and diagnostic UI now consume `RaceViewQuery` / `MinimalWeekendQuery`, commands and injected ports. Native composition roots live in `scripts/composition/`. The former selected-renderer guard applies to every `scripts/ui/` component. Historical 0.18.0 evidence below is not current-head verification.

# Simulation and presentation boundaries — 0.18.0

## Scope and protected behavior

This increment continues the actual 0.17.2 source at `15932dd4ac1650281628ad1412e98a3df85f45c6`, tree `c4adab01b8f6d256c9f2ba2f55bfc0169faf9469`. It preserves the minimal UI, the five driver commands, physical practice/qualifying/race flow, finite tyre inventory, model version, fixed step, save schema, RNG ordering and existing coefficients. Stress remains a documented read-only current-demand estimate. This is not a new psychological or vehicle-physics model.

The refactor is incremental, not a claim that every historical class is now a small typed aggregate. In particular, serialized car dictionaries and the existing simulation inheritance chain remain. Old Director/Engineering controllers remain compatibility adapters; they are not reintroduced into the normal UI.

## Dependency contract

| Layer | Owns | Allowed inward dependencies |
|---|---|---|
| `scripts/domain/` | Race state, validation, physical rules, fixed-step policy and serialized values | Domain and non-scene Godot value utilities |
| `scripts/application/` | Session runner, command adapters, queries, recording/reconstruction and replay playback | Application and domain |
| `scripts/services/` | Godot composition/lifecycle, storage, content catalog access and runtime metadata | Services, application and domain; not UI |
| `scripts/ui/` | Native controls, presentation, input intent, visual interpolation and editor interaction | Inward collaborators injected at composition |

`App` is the engine-facing composition/lifecycle adapter. It owns active live and replay runners, not physics calculations. Its process callback supplies elapsed seconds to the application. A screen refresh never advances the race or writes an automatic checkpoint.

This is a single-process design, not a distributed system. Commands and reads use separate interfaces without adding queues, dependency-injection containers, event sourcing or speculative services. A future renderer can implement `RaceVisualPort`; it does not require a second race engine.

## Simulation ownership

`RaceSessionRunner` owns the active simulation lifetime. `RaceStepClock` accepts caller-supplied elapsed seconds and applies the existing 0.05-second fixed step, 0.25-second frame-spike cap, playback speed and pause/phase boundaries. Negative and non-finite elapsed values are rejected atomically. A pause raised during a fixed-step callback stops the same frame's remaining ticks.

The runtime does not promise to recover discarded wall time beyond the existing frame cap. Deterministic comparisons must use equal accepted commands and equal actual steps, not merely equal wall-clock duration. Cross-platform floating-point identity is not asserted.

`App.activate_session` subscribes once to phase changes; stopping or suspending disconnects that listener. Phase autosaves use the current original/sandbox recording and the appropriate storage slot. Repeated visual refreshes cannot repeat a save. Explicit save/exit operations still retain their existing application behavior.

Opening a replay explicitly suspends the live runner, preserving its state, remainder, speed and pause flag. `ReplayPlayback` advances reconstruction independently of its widgets. A sandbox receives a separate live runner. Returning restores the exact original runner; visual visibility is no longer the authority for whether a session runs.

## Detached presentation boundary

`MinimalRaceSession` supplies the shipping screen with three distinct collaborators: command control, detached query and visual port. The minimal workspace has no live `RaceSim` field. `MinimalWeekendQuery` produces only required phase, identity, timing and own-driver card values. Rival resource inventories do not escape through map/identity data.

`TrackCanvas`, battle/rejoin overlays and the migrated diagnostic charts render detached values. A canvas selection emits intent; it cannot mutate `selected_id`. The application control adapter validates whether that driver is controllable. Presentation preferences are supplied as copied values rather than fetched through the simulation singleton.

`RaceVisualSource` and chart queries hold weak source references. Their returned dictionaries/arrays are independent values; destroying a session makes the source unavailable. The active runner—not a stray renderer—keeps the simulation alive. `TrackGeometry.detached_copy` copies already-compiled data without re-solving it. Running races and renderer-owned copies cannot be edited through the source document. The track editor's explicitly owned draft remains editable.

Domain event notifications are independent, recursively read-only serialized records. They cannot be changed by an earlier subscriber to corrupt a later recorder. Callers needing an editable working value must duplicate the event. Packed value arrays are detached; arbitrary mutable engine objects are outside this event contract.

For save/replay compatibility, `selected_id`, pause, playback speed and frame remainder still exist in the legacy checkpoint. They are explicitly excluded from sporting equivalence; new player commands name their driver through the application adapter. Moving those compatibility fields out of the snapshot requires a separately validated migration.

The legacy diagnostic controllers still orchestrate allowed commands and queries using their historical model interfaces. This pass enforces read-only **renderers**, domain/application dependency direction, and no UI ticking everywhere; it does not claim that every historical controller has been migrated to the new minimal facade.

## Domain responsibilities

| Module | Responsibility |
|---|---|
| `RaceTiming` | Measured qualifying/race crossings, finish resolution and standings |
| `RacePitService` | Garage release, physical pit transit, queue/service/fitting and stint record |
| `RaceVehicleCondition` | Existing wear/fuel/temperature/health progression |
| `RaceEntrantFactory` | Initial entrant record from approved roster/track/options |
| `RaceStepClock` | Bounded elapsed-time to fixed-step scheduling |
| `RaceStateValue` | Detached/read-only serialized values and stable value fingerprint |

The aggregate delegates to these services while preserving overridable hooks and the original arithmetic order. Extracted code is expanded into readable statements and named `car`/`sim` collaborators; coefficients are not silently rebalanced.

Catalog file loading moved to `ScenarioCatalog` in infrastructure. `DuelScenarios` receives approved recipes rather than loading a file. The scenario whitelist and validation remain. Replay, notebook-entry and result-record classes moved to application because they concern evidence, reconstruction and runtime provenance rather than vehicle movement. Their global names and UIDs are retained.

## Extending the game

For a new authoritative rule, first name its bounded context and the existing aggregate that owns it. Add a pure domain service or method with explicit parameters, implement validation before mutation, and test the invariant through the normal command boundary. Add persistence fields only with explicit validation/versioning. Do not place a coefficient or gameplay RNG draw inside a widget or a read-model query.

For a new visible instrument, add a detached field to an application query with units, unknown/terminal handling and provenance. Consume that field in a read-only native component. Test that editing the returned value cannot mutate the source and that querying at different display cadences preserves outcomes. Do not expose the entire car dictionary for convenience.

For a new action, add a driver/phase-validated application operation calling the existing recorded domain command. Let the view display acceptance/rejection. Tests must include rejected commands, stale driver/phase selection, teammate independence and save/replay continuation. This increment adds no new player action.

For a new rendering backend, consume `RaceVisualPort` or supply a compatible port implementation. Inject a detached compiled track. Visual interpolation, labels, effects, screen resolution and frame count must never affect collision, gates, classification, wear or incident exposure.

## Executable architectural rules

`python3 scripts/check_architecture.py` resolves both global class-name references and literal script dependencies. It rejects outward dependencies from domain/application, domain scene/input/storage authority, undocumented domain wall clocks, dynamic inward script loads, UI ticking, and live aggregate/singleton references in the guarded renderers/minimal workspace. Nine Python fixtures exercise the guard itself, including forbidden literal `extends` paths and comments that must not produce false edges.

Two function-scoped clock exceptions remain: editor-generated identifiers in `TrackDocument.node_at` and elapsed compilation diagnostics in `TrackGeometry.compile`. Neither supplies racing randomness or sporting time. This static guard is not a full GDScript parser or a security boundary against arbitrary reflection; Godot import, runtime tests and review remain necessary.

The normal `scripts/verify.py` retains every previously required suite and adds boundary, native ownership and baseline-characterization gates. No failing test is removed to accommodate the refactor. Historical tests that explicitly step a simulation disable application scheduling explicitly rather than implicitly stopping it by hiding a view.

## Verification and compatibility

`tests/fixtures/architecture-reference.json` was captured from the unchanged 0.17.2 baseline before extraction. Three cases cover Pinecrest/dry, Monaco/wet and Monza/changeable, distinct incident settings, physical formation/lights, ordinary pace/engine/pit commands and 4,000 race steps per case. Every 500 steps records a complete sporting-state hash. The 24 checkpoints include all cars, inventory, surface, journal and RNG, not just the leader. Each scenario executes a physical pit stop. They are characterization workloads, not complete-race or balance claims.

The comparison script cannot regenerate its expected values. Baseline hash generation is retained only in the separately identified verification evidence. Other tests exercise nested mutation attempts, weak lifetimes, immutable notifications, invalid deltas, equivalent elapsed partitions/speeds, paused tick boundaries, actual hidden-view playback, explicit replay suspension and return, and duplicate-listener cleanup.

Exact final results belong to the current run report and handoff. Previous version counts are not evidence for this source. The complete native weekend suite separately exercises measured practice and qualifying, formation, lights, fitting/service/exit, actual finishes and production archive restore.

## Research basis and interpretation

Godot's scene-organization and node-alternative guidance informed focused native scenes, injected dependencies and non-scene `RefCounted` services. Its GDScript style guide informs naming/readable statements. Robert Martin's dependency rule informed inward dependencies and value-only boundary data. Fowler's bounded-context description informs keeping race rules distinct from campaign, presentation and recording vocabulary. These are implementation adaptations, not certifications or evidence of improved gameplay.

- https://docs.godotengine.org/en/stable/tutorials/best_practices/scene_organization.html
- https://docs.godotengine.org/en/stable/tutorials/best_practices/node_alternatives.html
- https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/gdscript_styleguide.html
- https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html
- https://martinfowler.com/bliki/BoundedContext.html

## Remaining work

Further typed entity/value-object migration and reducing the simulation subclass chain should be separate characterized increments, not an untested rewrite. Old diagnostic controller facades can migrate gradually. Dedicated error injection for filesystem failures, physical controller/screen-reader coverage, Windows export validation and representative-device performance remain separate gates. No new physics calibration, FPS guarantee, universal architecture compliance or human-usability conclusion is claimed.
