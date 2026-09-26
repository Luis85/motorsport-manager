# Architecture

**0.14 update:** [Circuit notebook](race-weekend-notebook.md) adds opt-in historical facts and revision-checked personal notes in `user://circuit-notebook.json` (notebook v1). It does not alter native v10, the replay model, forecasts, physics, original/sandbox slots or result receipts. The inherited 0.13 frozen-scenario authoring and validation are preserved; historical integration status and test counts remain in their dated handoffs. [Notebook verification](notebook-verification.md).

## Retained 0.13 authored-scenario boundary

[Scenario authoring](race-weekend-scenario-authoring.md) adds inert author intent to a frozen replay checkpoint; [0.13 verification](scenario-authoring-verification.md) records this increment's actual evidence. `ScenarioBrief` validates bounded text and an allow-listed observed goal. `ReplayScenario` creates and validates a zero-step sandbox record whose initial state, endpoint and briefing agree. It never evaluates author text as code or changes the starting resources to satisfy an objective.

`ScenarioAuthor` owns the native unapplied form. `ReplayWorkspace` captures a separate simulation for that form, exports the resulting envelope and carries the brief into a separately identified sandbox. `ReplayController` validates imports before suspending the original view. Goals inspect final classification; they are not simulation commands and cannot award rewards. Long briefs use the existing bounded reader. No extra simulation or view inheritance layer is introduced.

`WeekendResult.validate` now checks the structured twelve-car classification, twelve owned finite inventories, supported aggregate condition, statistics and provenance before a receipt is accepted or an old ledger reused. `RaceRecord` also checks frozen seed/rules/roster/track identity across its snapshots and safely rejects wrong JSON scalar types. Integrity digests are local consistency checks, not authentication or proof that an imported history was genuinely played.

Current application version is **0.14.0**; sporting model `race-weekend-0.12-v1`, embedded native v10 and existing session/replay/result envelopes remain unchanged. See [Persistence](persistence.md) for the new scenario envelope, retained slots and UTF-8 byte limit.

## Retained 0.12 replay composition

[Independent replay and sandbox](race-weekend-replay.md) documents the current ownership and migration contract; [verification](replay-verification.md) records tested revisions. No extra simulation or view inheritance layer is introduced.

`PracticeRaceSim` emits observational accepted-outer-input and completed-fixed-step signals. `RaceRecord` captures exact inputs and bounded checkpoints without invoking gameplay or consuming sporting RNG. `RaceReplay` restores a separate existing `PracticeRaceSim` and advances bounded batches. The existing journal remains causal evidence, not the exact-input transport. `WeekendResult` derives factual classification/resources, while the `ResultReceipts` service persists local idempotent acceptance without awarding campaign consequences.

`App` owns the original weekend and its recorder. `ReplayController` retains/suspends the actual original native view, composes `ReplayWorkspace`, and restores the same nodes/drafts/focus on return. The replay has its own simulation; an experiment has a separate recorder and existing native `PracticeWeekendView`. That view routes its phase autosaves and manual saves to the sandbox slot rather than saving `App.weekend`. Invalid imports do not replace either authority. Explicit replay navigation does not advance the original clock or rewrite its time policy.

`ReplayStorage` uses session v1 around embedded native v10, with origin/slot and engine/model validation. The original and sandbox paths are independent. A future campaign must validate its frozen entry and perform its own atomic settlement; the local standalone receipt is not a substitute for that transaction.

**0.11 update:** [Contextual rivals](race-weekend-rivals.md), [workspace specification](design/pitwall-workspace.md) and [verification evidence](rivals-verification.md) supersede older UI/checkpoint statements where noted. The current native checkpoint is v10; old saves retain classic rivals. No new simulation/view inheritance layer or pressure mechanic is added.

## Native project structure

```text
project.godot                  Godot project and App autoload
scenes/main.tscn                Main native Control scene
scripts/domain/
  track_document.gd            Schema, normalization, validation, cubic editing
  track_geometry.gd            Immutable compiled geometry and speed profile
  racing_line.gd               Bounded time-evaluated racing-line candidates
  track_diagnostics.gd         Sampled crossings, pit angles and readiness checks
  race_checkpoint.gd           Nested checkpoint validation
  race_sim.gd                  Deterministic weekend model and commands
  tyre_inventory.gd            Finite driver-owned tyre sets and retained condition
scripts/services/
  app.gd                       Library, settings and current-weekend ownership
  storage.gd                   Bounded JSON reads and atomic writes
scripts/ui/
  ui.gd                        Shared native control/theme helpers
  main.gd                      Main menu, library, settings and screen routing
  editor.gd                    Track authoring actions, undo/redo and inspectors
  track_canvas.gd               Editing guides, camera and separate live overlays
  circuit_world.gd              Cached world-space circuit illustration
  weekend.gd                   Timing tower, pit-wall controls, telemetry and log
scripts/verify.py               Import/domain/rendered-UI verification harness
data/tracks/catalog.json       Ordered catalog manifest
data/tracks/*.json             Individual bundled authoring circuits
```

`TrackDocument`, `TrackGeometry`, and `RaceSim` are `RefCounted` domain classes. They do not query the scene tree or the `App` singleton. Native UI nodes translate user actions into model commands and display model state. Domain tests instantiate the same classes without creating a game scene.

## Ownership and boundaries

The editor owns a mutable normalized authoring document. Undo/redo stores deep snapshots, bounded to fifty entries. Recompilation produces a separate `TrackGeometry`; a race owns its own geometry/document snapshot. Testing an unsaved draft therefore cannot change an already-running weekend or a packaged library track. `App` owns the library, original weekend/recorder, and settings, not simulation rules.

UI screens are assembled programmatically using Godot containers. The declarative `.tscn` holds the application root; all game controls are native nodes, not a webview. A shared theme supplies spacing, focus/hover states, colors, and button treatments. The editor canvas and race viewport reuse the same renderer.

## Simulation and rendering

`RaceSim.step()` advances exactly **0.05 simulated seconds**. `advance(real_delta)` accumulates elapsed time multiplied by the selected simulation speed and invokes whole steps. It bounds an individual frame's real delta to 0.25 seconds rather than attempting an unbounded catch-up after a stall. Pause and approval phases do not advance the model.

The circuit canvas keeps static drawing separate from the car overlay. Car display interpolates the previous and current simulation samples; a route change uses the new route directly. The timing tower and text panels refresh at 5 Hz, while car rendering follows the visual frame rate. UI preferences do not change the model's PRNG or physical step size.

## Command and event boundary

UI actions call `RaceSim.command(action, payload)`. Commands validate the session phase, selected driver, permissions, and value ranges before mutation. Rejected actions set an explanatory error and leave gameplay unchanged. Successful commands are logged; model events cover session transitions, laps, pits, flags, weather, incidents, and finishes. Race-log export is an analysis artifact, not a checkpoint importer.

## Extension seams

New rules belong in the domain and require deterministic tests before UI exposure. Add a new authoring field through normalization, validation, compile/export semantics, persistence tests, then the inspector. A different renderer should consume `TrackGeometry` and `RaceSim` rather than duplicate their rules. Company management can later orchestrate weekends without being embedded inside movement or timing calculations.

Current implementation deliberately uses dictionaries at serialization boundaries for migration friendliness. It is not claiming a full typed entity/component framework, multithreaded solver, or Godot editor plugin.

## Iteration-two boundaries

`RacingLine` owns bounded candidate generation and time evaluation. `TrackGeometry` compiles either a lightweight editor preview or an immutable full simulation snapshot. `TrackDiagnostics` consumes that geometry and returns inspectable findings without mutating it; the editor and weekend launcher apply the same blocking rule.

`RaceCheckpoint` validates nested continuation data before `RaceSim.restore` exposes it to the UI. Native v1–v3 saves migrate to version 4 before validation: legacy inventory defaults, four-wheel/setup defaults and explicit lateral surface cells preserve recorded data without inventing missing history. No browser checkpoint is accepted. Simulation state stays independent of UI nodes, navigation, rendering and wall-clock performance measurements.

`WeekendView` owns persistent driver-ID-indexed TreeItems, reordered as standings change, and stable pit controls; its 5 Hz refresh updates values, not control instances. The track surface and moving-car overlays are separate from retained static geometry. All player commands still enter through `RaceSim.command`.

## Iteration-three modules

`TyreInventory` owns stable twelve-set allocations, stable inventory identities and plan/mount helpers; `WheelTyres` owns four-contact-patch state and derives aggregate displays; `RaceSim` owns physical timing and service transactions. Checkpoint validation includes the new identities and histories. Views can select a plan but cannot mutate stock or fit tyres directly.

`CircuitWorld` owns retained world-space illustration. Its private seed and cache are independent from `RaceSim`; camera transforms reuse draw commands. `TrackCanvas` owns editing guides and preview, with separate live vehicle/surface overlays. See [Graphics](graphics.md) for caching and visual-only controls.

## Iteration-four modules

`CarSetup` validates the five source-inspired fields and computes bounded handling/thermal effects. `WheelTyres` owns per-set FL/FR/RL/RR state. `RaceSurface` owns the 96×7 multi-channel gameplay field; legacy water/rubber arrays are derived line profiles, not a second authoritative surface. `RaceSim` integrates these during fixed steps and validates checkpoint v4.

`TrackEdit` implements transactional planar selection operations; `TrackSketch` owns connected transient strokes and compiles a candidate authoring document. Neither accesses UI or app state. The editor owns preview/apply/discard and commits history once.

`RacecraftPanel` owns per-driver setup drafts, stable input controls and the wheel dashboard. `SurfaceLab` observes authoritative cells. `ContextGuide` owns UI navigation/highlighting and local progress only. Topic selectors and expandable details change presentation without issuing simulation commands.


## Extracted race-weekend presentation (PR #12 follow-through)

The existing session inheritance remains the orchestration/command boundary. `RaceSessionHeader`, `RaceTimingTower` and `RaceObservationWorkspace` own the actual constructed controls; legacy host fields alias those components to retain integrations. `RaceDecisionViewModel` freezes displayed evidence, `RaceDecisionQueue` owns attention slots, and `RaceDecisionDrawer` owns review/confirmation/acknowledgement/execution presentation. Commands still return to the host/domain once.

Full `RaceAnalysisWorkspace`, `RacePracticeWorkspace` and `RaceResultsWorkspace` reuse existing inspector/results controls and draft references rather than duplicating model state. `RaceInspectorPage` preserves the scrolling-content/fixed-action and private-rival masking boundary. Recorded metrics, radio pages, stint intervals and journal records are separate renderers with change-only presentation caches. The unused global snapshot prototype is removed; source-of-truth remains the simulation and existing immutable forecast payloads.

No domain/service/save schema changes are needed for this migration. See `docs/ui/race-weekend/component-catalog.md` for the integrated file map.
