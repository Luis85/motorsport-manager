# Architecture

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

The editor owns a mutable normalized authoring document. Undo/redo stores deep snapshots, bounded to fifty entries. Recompilation produces a separate `TrackGeometry`; a race owns its own geometry/document snapshot. Testing an unsaved draft therefore cannot change an already-running weekend or a packaged library track. `App` owns only the library, current weekend, and settings, not simulation rules.

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

`WeekendView` owns persistent rank-position TreeItems and stable pit controls; its 5 Hz refresh updates values, not control instances. The track surface and moving-car overlays are separate from retained static geometry. All player commands still enter through `RaceSim.command`.

## Iteration-three modules

`TyreInventory` owns stable twelve-set allocations, stable inventory identities and plan/mount helpers; `WheelTyres` owns four-contact-patch state and derives aggregate displays; `RaceSim` owns physical timing and service transactions. Checkpoint validation includes the new identities and histories. Views can select a plan but cannot mutate stock or fit tyres directly.

`CircuitWorld` owns retained world-space illustration. Its private seed and cache are independent from `RaceSim`; camera transforms reuse draw commands. `TrackCanvas` owns editing guides and preview, with separate live vehicle/surface overlays. See [Graphics](graphics.md) for caching and visual-only controls.

## Iteration-four modules

`CarSetup` validates the five source-inspired fields and computes bounded handling/thermal effects. `WheelTyres` owns per-set FL/FR/RL/RR state. `RaceSurface` owns the 96×7 multi-channel gameplay field; legacy water/rubber arrays are derived line profiles, not a second authoritative surface. `RaceSim` integrates these during fixed steps and validates checkpoint v4.

`TrackEdit` implements transactional planar selection operations; `TrackSketch` owns connected transient strokes and compiles a candidate authoring document. Neither accesses UI or app state. The editor owns preview/apply/discard and commits history once.

`RacecraftPanel` owns per-driver setup drafts, stable input controls and the wheel dashboard. `SurfaceLab` observes authoritative cells. `ContextGuide` owns UI navigation/highlighting and local progress only. Topic selectors and expandable details change presentation without issuing simulation commands.
