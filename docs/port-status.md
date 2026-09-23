# Iteration 1 — port status and boundaries

## Source baselines

The implementation was informed by the user's **Circuit Atelier v0.4** editor (2026-09-21) and the race-weekend engine embedded in **Obsidian First Light / Energy Dynasty** (2026-09-20), with the earlier `index(1).html` race source used to inspect the qualifying/pit-wall contract. The source was retrieved from the user's file library. The company/era shell is not carried into this iteration.

The seven geographic circuit documents and Pinecrest were converted from the editor's actual source data, including its explicit curve handles, rather than redrawing rough replacement silhouettes. Source provenance and the upstream MIT notice are retained. This is a **native reimplementation of the selected workflows**, not JavaScript running inside Godot and not a promise of byte-identical physics results.

## Implemented in Godot

| Area | Native implementation |
|---|---|
| App shell | Main menu, weekend library/configuration, editor, settings, help, continue/quit |
| Track authoring | Closed cubic editing, exact subdivision, point/handle movement, width/elevation/banking |
| Authoring support | Undo/redo, snap, pan/zoom, reference-image embedding/manual calibration, validation |
| Pits and features | Separate editable pit route, entry/exit/limiter, curbs/runoff/barriers/tunnels/bridges, source props |
| Track exchange | Native/Circuit Atelier authoring import; native authoring and sampled runtime export |
| Shared library | Eight bundled circuits plus writable custom copies, usable by both editor and weekend |
| Qualifying | Physical garage/out/hot/in runs, measured best lap, manual/delegated release and recall, grid result |
| Race flow | Preparation, real formation lap, grid approval, red lights, standing start, finish and classification |
| Player management | Two drivers, pace/engine modes, delegated strategy, compound and pit commands, basic setup |
| Driving and traffic | Curvature/braking profile, lateral lanes, following/passing, blue flags/qualifying courtesy |
| Conditions | Tyre temperature/wear, fuel, health/damage, water/rubber, scenario-driven rain, incidents |
| Race control | Local yellow, simplified virtual safety-car/restart, all-retirement completion |
| Feedback and storage | Top-down cars, timing tower, speed trace, radio/event logs, pause/speed, exact native checkpoint |
| Engineering quality | Bounded imports, isolated model, atomic writes, deterministic tests, native-rendered UI tests, CI |

## Deliberately simplified or not carried over

**Editor:** no full feature parity with every Circuit Atelier v0.4 wizard. Dedicated tangent-arc/chicane/rounded-street helpers, freehand fitting, multiple selection/group transforms, advanced prop editing, elevation constraint solving, georeferenced image alignment, and broad clearance/self-intersection certification are absent. Tunnels and bridges have persisted authoring metadata and top-down annotations, not generated 3D structures. Runtime export contains samples and metadata, not the prototype's full mesh/collision interchange bundle. Authored grid spacing is consumed; some grid placement metadata is only retained.

**Trajectory and physics:** the native solver is a bounded curvature heuristic with a longitudinal speed envelope. It does not port the entire original minimum-time search or guarantee the fastest possible lap. A reference path is followed with simplified traffic lanes; full car footprints, detailed aero/brake/suspension/gearbox modeling, setup familiarity, per-wheel tyres and extensive wet/offline surface-grid behavior are not equivalent to the old engine.

**Weekend rules:** one qualifying session, not practice/Q1/Q2/Q3. No real-series tyre allocation/mandatory compound rules, finite tyre-bank management, detailed stewards/penalties, red flags, collision impulses, or separately driven safety-car vehicle. Engineered pit behavior and race control are management-game abstractions, not a regulations simulator. Audio and visual effects are minimal; driver names and car presets are fictional/generic.

**Surrounding game:** no business economy, workshop, hiring, research, energy/day loop, dynasty, historical UI eras, season progression, or Obsidian integration. The requested restart focuses on the standalone circuit editor and weekend. Existing browser/campaign save files are not compatible with the native checkpoint.

## Acceptance interpretation

Iteration one provides an importable, runnable Godot project and the full end-to-end playable **editor → track library → qualifying → formation → race → results** workflow. It is a solid native starting point with explicit tested boundaries, not an assertion that every subsystem from every prior prototype has been reproduced. Further parity work should take the above gaps as concrete backlog items and preserve the tested native contracts.
