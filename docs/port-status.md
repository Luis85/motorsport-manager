# Port status and boundaries

Current release: **0.4.0**. Read the explicit [feature-parity matrix](feature-parity.md) and [iteration-four notes](iteration-4.md). Earlier iteration documents are historical release records, not competing current specifications.

The source baseline is the user's Circuit Atelier/Track Studio and top-down race-weekend prototype. Native source data, including the eight-circuit library and existing attribution, is retained. This is a native reimplementation, not JavaScript running inside Godot, and it does not promise identical simulation output to every prototype revision.

## Delivered foundation

The complete **editor → library → measured qualifying → race preparation → formation → start lights → race → classification** loop is playable. Track documents, a compiled geometric model, deterministic simulation, native controls, illustration, save validation and tests have separate responsibilities.

Authoring includes cubic points/handles, exact insertion, width/elevation/banking, separate pit routes, start/finish/sector boundaries, references/calibration, range features, decorative scenery, diagnostics, preview and import/export. Multi-selection, flat scenery groups, planar transforms and connected freehand/pen trace with explicit apply are now available.

The weekend includes finite tyre allocation, individual FL/FR/RL/RR condition, five setup fields, live racing brake bias, racecraft modes, seven-strip surface evolution/laboratory, traffic courtesy, pits/queues, weather, incidents, flags, telemetry and resumable guides. Cozy illustration and dot-only cars are retained.

## Important remaining differences

**Engineering and people:** the complete itemized component/blueprint/manufacture/fit pipeline, setup familiarity, stress, crew roles and personnel skill progression are not ported. Health and repairable vehicle damage remain scalar. Per-wheel tyre state is a bounded management model, not a rigid-body tyre/vehicle solver.

**Strategy and race control:** only one pending stop per car, current-rate advice and scenario-based weather are implemented. Rich forecast confidence, multi-stop planning and complete battle/rule systems remain absent. One qualifying session is supported; no practice/Q1/Q2/Q3 structure is claimed. Safety-car neutralization is virtual, with no separate driven safety-car vehicle, red flags or comprehensive penalties.

**Editor:** flat scenery groups are not arbitrary nested hierarchies. Drawing strokes are transient and cannot be saved as the prototype's full editor workspace. Specialized corner/arc/chicane tools, constraint-based elevation, georeferencing services and terrain sculpting remain absent. Supported authoring imports do not imply all historical prototype workspace files round-trip.

**Geometry and rendering:** bridges/tunnels remain authored metadata and top-down annotations, not constructed 3D structures. Diagnostics check sampled centerlines, not full road/vehicle/bridge clearances. Runtime export is a sampled native interchange model, not a mesh/collision bundle. The racing-line solver evaluates bounded candidates and does not prove a global optimum. Stylized scenery is decorative, not a vehicle collision system. Audio is not implemented.

**Surrounding game:** company economy, workshop, research, hiring, energy/day progression, dynasty, seasons, historical UI transitions and Obsidian integration remain excluded. Native saves migrate only supported native versions; browser campaign/session saves are unsupported.

## Acceptance interpretation

A passing suite means the covered invariants and native interactions passed on the recorded environment. It is not a declaration of complete parity, perfect balance, target-hardware fluidity or exhaustive manual testing. Continue closing named gaps while preserving this playable foundation.
