# Iteration 3 — a calmer circuit world

Version **0.3.0** · Godot **4.7.2 Standard** · native 2D/GDScript.

## Intent and protected scope

Continue the native v0.2.0 editor and Grand Prix weekend. This iteration adds a warm, stylized circuit presentation and a bounded slice of prototype parity. Cars remain **flat, readable dots**. The management campaign, historical progression and company economy remain outside the project.

The behavior reference is the user's `index(1).html` prototype: `OMMTyres.allocation`, its `select-set`, `schedule-pit` and `cancel-schedule` commands, and Track Studio's `layerEnabled`/`locked` editor gates. The prototype allocates three soft, three medium, two hard, two intermediate and two wet sets per driver. These native mechanisms are reimplementations, not imported JavaScript or a claim of complete parity with every prototype layer. The rendering direction below is new implementation work based on the requested calm/cozy style.

## Delivered graphics

The application uses warm paper surfaces, dark racing-green text and controls, restrained brass accents and a serif heading fallback. Muted sage road surfaces sit within pastel meadow/woodland/coastal illustrations. Trees have layered canopies and soft offset shadows; small garage roofs, grandstands, towers, tents, cafes, water and yachts provide scale without replacing the dot-car presentation. The pit paddock aligns with the actual shared service-box stations.

Dots have a dark outer outline, cream rim and optional larger sizes. Selected cars have a static ring, not a pulsing glow. Label chips avoid occupied label rectangles where possible. Start lights and flags remain visible and unambiguous; no camera shake or decorative full-screen rain is introduced.

**Settings** provides rich/simple scenery, three dot sizes and reduced camera motion. **Editor → World** provides meadow/woodland/coastal and summer/autumn options. These are illustrative art presets, not geospatial terrain or changes to tyre grip. No external textures, font files or engine plugins are bundled.

## Delivered parity slice

| Area | Current native behavior | Boundary |
|---|---|---|
| Finite tyres | Twelve stable, driver-owned sets; retained aggregate tread, temperature, laps and mounting count | Not the prototype's per-wheel pressure, grain, blister, flat-spot or puncture model |
| Planning versus fitting | Picking a set changes a plan; Send, formation approval or actual pit service fits it | Setup remains the earlier single simplified slider |
| Planned pit lap | One future racing-lap pit entry; cancellation, safe lead distance and usable-set validation | No multi-stop optimizer or real-series mandatory compounds |
| Service integrity | Actual set identity and repair choice are frozen when service begins; no free tread reset | Shared-box/repair physics remain management abstractions |
| Stint feedback | Actual fitted-set spans and the pending stop marker; approximate tread/fuel advice | Advice is a current-rate estimate, not an empirical multi-lap prediction |
| Editor layers | View/hide and lock road, pits, scenery, features and reference; grid toggle | Workspace-local state, not persisted group/multi-selection authoring |
| Reference lap | Dot preview along the baked line, stopped on geometric edits | Heuristic speed envelope; not a second full racing simulation |

## Foundation guarantees exercised

World scenery is generated with its own deterministic seed. It never calls the race PRNG. Cached world-space draw commands follow camera transforms without reconstructing scenery; live cars and water overlays remain separate. Generated trees exclude sampled road and pit corridors, but this is a decorative placement rule, not certified collision clearance.

The tyre inventory survives qualifying, race preparation, actual servicing and JSON checkpoints. Old native checkpoints (versions 1 and 2) migrate to version 3. They retain the currently fitted aggregate wear and temperature; unavailable historical stock data cannot be reconstructed, so remaining sets are initialized explicitly. Browser campaign/session saves remain unsupported.

Authoring remains version 1 with an optional normalized `visual` object. Runtime export remains version 2 with additive visual metadata and `illustration_revision`. Neither style choices nor graphics preferences change geometry, session time or simulation randomness.

## Verification

Run `python3 scripts/verify.py --godot /path/to/godot`. The report, not this document, is authoritative for counts and durations. Iteration-three tests extend the prior suite with tyre identity, worn-set remounts, physical scheduled stops, malformed/legacy checkpoint fixtures, illustration determinism, layer locks, preview behavior, stable inventory controls, and cached camera drawing. Native screenshots include the World inspector, autumn illustration, allocation panel and trackside detail.

The render sample reports 45 paused-race camera frames using software OpenGL. It checks zero static scenery rebuilds/draw reissues during those transforms; it is not an FPS guarantee or a live-race stress benchmark. Windows/macOS hands-on and target-GPU tests are not established by this Linux run.

## Review next

Remaining parity includes richer mechanical setup, per-wheel tyres, multi-lane surface state, group/freehand editor operations, geometric bridge/tunnel construction and more complete racing regulations. Existing structural checks do not certify full-width crossings, tunnel clearance or a globally fastest racing line. These gaps are not disguised by decorative scenery.
