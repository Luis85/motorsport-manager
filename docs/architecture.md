# Architecture

## Native project structure

```text
project.godot                  Godot project and App autoload
scenes/main.tscn                Main native Control scene
scripts/domain/
  track_document.gd            Schema, normalization, validation, cubic editing
  track_geometry.gd            Immutable compiled geometry and speed profile
  race_sim.gd                  Deterministic weekend model and commands
scripts/services/
  app.gd                       Library, settings and current-weekend ownership
  storage.gd                   Bounded JSON reads and atomic writes
scripts/ui/
  ui.gd                        Shared native control/theme helpers
  main.gd                      Main menu, library, settings and screen routing
  editor.gd                    Track authoring actions, undo/redo and inspectors
  track_canvas.gd               Static circuit canvas and separate car overlay
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
