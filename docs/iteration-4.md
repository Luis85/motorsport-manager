# Iteration 4 — racecraft and authoring parity

Version **0.4.0** · **Godot 4.7.2 Standard** · native 2D/GDScript.

## Scope and source

Continue the same standalone track editor and full Grand Prix weekend. Preserve the calm illustrated world, warm paper/racing-green interface and **dot-only cars**. Company management, hiring, economy, historical eras and season progression remain out of scope.

The source reference is the user's `index(1).html` / Konva Track Studio prototype: `OMMTyres` contact patches, the five `SETUP` fields, racecraft modes, the lateral surface laboratory, and Track Studio selection/drawing operations. These are native adaptations with explicit differences, not the original JavaScript executing in Godot. See [feature parity](feature-parity.md) for what is carried over and what is still missing.

## Race weekend

Each of the twelve finite tyre sets per driver now carries **FL, FR, RL and RR** records. Tread, surface/core temperature, normalized pressure, load, graining, blistering, flat spots and puncture state belong to that set. Core temperature responds more slowly than the surface; turns and braking distribute load across contact patches. Heat cycles are counted on heating, not each tick. Cooling does not repair damage. Remounting a used set preserves its individual wheels. Existing headline tyre values are derived averages, not a separate second tyre simulation.

Punctures reduce grip and cap pace. Cold-tyre lock-ups can leave a flat spot when incident intensity permits. Warnings neither pause the session nor take over manual strategy. Delegated engineers can bring a punctured car in even before ordinary first-lap strategy eligibility and can advance a future scheduled stop. They use real replacement inventory and the next safe braking/entry gate; they do not teleport or manufacture tyres. An entry beyond the race finish cannot execute before the car finishes.

**Setup & handling** exposes wing level, aero balance, suspension, cooling aperture and front brake bias. Values are staged per driver; Apply validates and commits the complete batch. Hover explanations expose trade-offs. Switching drivers or refreshing telemetry does not overwrite a draft. Mechanical setup is locked after garage release, except race preparation. Front brake bias has a separate live racing command. Fitted effects and engine/brake temperatures are feedback estimates, not a detailed powertrain model.

**Patient, Balanced and Assertive** racecraft modifies passing intent and risk within the existing path-following simulation. It does not introduce rigid-body contact or complete defensive-driving regulations.

The **Track surface lab** uses 96 longitudinal stations and seven lateral strips. Water, rubber, dust, marbles, oil, debris and temperature evolve independently; grip is derived. Actual car passage dries and rubbers the occupied corridor. Rain, drainage, washing and conservative lateral runoff modify the field. Click a cell or use arrow keys, inspect its values, change channels and locate that station on the actual circuit. The map overlay consumes the same field. This is a bounded gameplay model, not computational fluid dynamics.

## Track editor

Road points and scenery support Shift-click and marquee multi-selection. Contextual actions cover moving, planar rotation/scaling, alignment and equal-center distribution. Road transforms preserve width/elevation and transform tangent handles with their nodes. Scenery additionally supports simple named groups, ungrouping and duplication. Duplicated groups receive independent identities. Invalid transformations are rejected transactionally.

**Freehand trace** and **Pen trace** collect connected strokes separately from the current circuit. Close the loop, adjust simplification/smoothing, and Preview. The generated candidate must pass the shared blocking checks before Replace becomes available. Replacement requires confirmation, keeps scenery/reference/visual style, and clears old road-attached pit, timing and feature data. One undo restores the entire old document. Cancelling a dialog does nothing.

An unfinished trace is not a completed circuit. Test weekend and runtime export are guarded while it exists; the toolbar Undo/Redo targets drawing history while drawing. Edits invalidate a stale candidate. Clearing a trace and leaving a dirty workspace require confirmation. **Trace strokes themselves remain temporary**: saving/exporting a track saves committed authoring data, not an unapplied sketch workspace. The UI states this distinction.

## Interaction changes

The pit wall uses a stable topic selector instead of an overflowing row of tabs. Tyres is subdivided into Allocation, Wheels and Stop plan. Both teammate selectors and phase-appropriate primary commands remain visible independently of scrolling details. Expand details temporarily trades the timing tower for inspector space while retaining the race map and a visible collapse action. The editor uses the same topic-selection approach, plus selection-dependent controls.

Both workspaces provide dismissible, resumable guides. A guide reveals and highlights real controls, stores its position locally and never sends a simulation command. It does **not** pause a live race automatically. Radio filters and tyre advisories support inspection without interrupting simulation ownership. The original cozy world and cached rendering are retained.

## Persistence and validation

New weekend checkpoints are **version 4**. Native versions 1–3 migrate before validation. Previously recorded inventory, aggregate wear and wing values are preserved; missing individual-wheel asymmetry and spatial-strip history receive explicit defaults because they were never recorded. Old browser/campaign saves remain incompatible. Authoring stays version 1; baked runtime stays version 2. Scenery receives optional simple `group` strings, validated at import.

Validation covers wheel identity and numeric bounds, setup fields, racecraft modes, temperatures, 96×7 surface dimensions, derived-profile consistency, finite stock and service ownership. State is validated before replacing the current weekend. Same-build continuation checks preserve RNG/discrete state and use the established numerical tolerance; cross-platform bit-identical replay is not claimed.

## Verification and boundaries

Run `python3 scripts/verify.py --godot /path/to/godot`. The generated report is authoritative for counts and durations. The suite adds wheel retention and punctures, staged setup, malformed/legacy saves, conservative runoff, actual-passage deposition, transactional groups, connected traces, native pointer events, stale-preview protection, guide resumption and small-window layouts. It runs the actual Godot application, not an HTML mockup.

Still missing: itemized component development and fitting, personnel/stress/skill systems, rich strategy forecasting, advanced stewarding, nested editor groups/full workspace round-trip, dedicated corner-construction wizards and actual 3D bridge/tunnel construction. See [port status](port-status.md). Test coverage is not a claim of exhaustive manual playtesting, certified driving physics or target-GPU frame-rate performance.

**Trace action placement:** Preview road and Replace road remain outside the scrollable inspector at both tested desktop sizes. Closed-loop state is explicit; a closed loop cannot be accidentally closed again to invalidate its preview. The action controls retain identity through inspector rebuilds.
