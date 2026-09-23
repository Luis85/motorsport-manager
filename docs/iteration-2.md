# Iteration 2 — race and circuit foundation

Version: **0.2.0**. Engine target: **Godot 4.7.2 Standard**.

## Scope and reviewed baseline

This release continues the native v0.1.0 project, not the surrounding HTML management campaign. Its protected loop is **author a circuit → inspect it → test qualifying → prepare → formation/start → manage a race → inspect classification**. The earlier prototype remains a behavior reference for out/hot/in laps, reactive courtesy, explicit pit routes, and independent creative track authoring. The port is a native reimplementation, not complete parity with every historical prototype subsystem.

The baseline review found concrete implementation defects and interaction bottlenecks. These findings came from the source and native rendered screens, not a survey or generalized design ranking.

| Finding | Change | Regression evidence |
|---|---|---|
| Timing rows were cleared and rebuilt every refresh | Twelve persistent rank rows; selected driver is tracked by identity | Thirty refreshes preserve TreeItem identities and selection |
| A point drag repeatedly ran the full line solver | Coalesced coarse preview; full bake on commit; Escape rollback | Pointer event tests and per-circuit preview/full timing report |
| Clicking a point cleared redo despite no edit | History begins on actual movement | Selection and cancelled-drag history checks |
| Lapped finishers could inherit crossing-order positions | Rank finishers by completed laps, timestamp, grid tie-break | Lapped car finishes before the lead-lap runner fixture |
| Qualifying did not retain usable split histories | Three interpolated sectors, valid/invalid run records | Custom/rotated sector and chequered-boundary scenarios |
| Service choices could change while the crew was working | Freeze compound and repair decision at service start | Mid-service tyre/repair mutation test |
| Pit movement approached the box at limiter speed | Braking envelope and snapshot-based lane queue | Pre-box deceleration and 6.5 m queue-spacing checks |
| Nested continuation data was insufficiently constrained | Validate selected IDs, identity, splits, telemetry, commands, stats and box ownership | Malformed JSON fixtures and occupied-box continuation |
| Default speed could be lost when JSON numbers decoded as floats | Explicit validated conversion | Native settings reload check |

## Circuit authoring

The authoring format stays version 1. Existing native tracks and supported Circuit Atelier versions 1–4 remain importable. Geographic data and attribution are unchanged.

Road editing uses the same explicit cubic handles. A drag displays approximately 12 m preview samples without a racing-line solve; it cannot advertise a valid lap estimate. Releasing commits one edit and restores the approximately 4 m full bake. Undo/redo remain document-level operations. A click without movement creates no edit. Escape restores the pre-drag state, including the redo history.

The inspector now includes **Checks**. Its findings can focus the corresponding circuit station. Sampled same-level centreline intersections block weekend entry and runtime export. Vertically separated crossings remain reviewable information. Pit alignment, unusually tight radii and invalid timing boundaries produce advisories. These checks do not certify full-width road separation, vehicle envelopes, bridge thickness, tunnel clearance or real-world safety.

Reference calibration uses two ruler points and a known distance, scaling the image about the first point without modifying road geometry. Scenery gains type selection, direct movement, position, rotation, scale and deletion. The Track inspector can assign the two sector boundaries at selected road points. Scenery remains decorative, not a vehicle collision system.

## Racing line and movement

The solver evaluates the centreline and three smoothed candidates. It selects the lowest estimated time among those candidates, using actual candidate 3D segment lengths, curvature/banking limits and closed-loop acceleration/braking passes. A centreline fallback prevents accepting a candidate with a worse evaluated time. This is a bounded heuristic, not a guaranteed global minimum-lap-time solver.

Runtime export advances to version 2 and identifies `time-candidate-v2`. It includes `line_arc_to_next_m` and the centreline comparison estimate. Driver movement converts physical travel to centreline station with the local path-length ratio; wet/worn grip feeds a look-ahead braking envelope. The dry reference line remains shared: the engine does not solve a separate trajectory for each car/tyre/condition.

Courtesy now remembers its priority car and chosen side until the pass clears. Lateral occupancy is checked before moving into another car’s corridor. Local yellows use the authored timing sectors. These changes improve the current path-following model; they do not constitute rigid-body collision physics or comprehensive sporting regulations.

## Weekend presentation and decisions

The fixed stage header shows the current session and available next action. The timing tower updates persistent rows rather than rebuilding controls. Approximate race gaps are marked; qualifying states and measured times have their own meanings.

The selected-driver pit wall separates **Commands**, **Telemetry**, and **Radio**. Both teammate selectors, resources, and phase-appropriate pit/release buttons stay outside scrollable detail areas. Routine commands give a non-modal acknowledgment. Closing qualifying confirms the consequential action. Viewing a rival is allowed, commanding them is not.

Telemetry records qualifying sectors and valid/invalid runs, tyre/fuel/condition, speed and acceleration-derived pedal indicators. Pedal indicators are feedback estimates, not a powertrain model. The optional water overlay reads the authoritative surface cells. Manual navigation cancels damped camera following immediately. Static road drawing, water presentation and moving cars use separate canvas layers.

Qualifying history survives race preparation; race timing resets. A flying lap already underway can finish after chequered, but another cannot start. Pit-route laps remain visible in history and are excluded from fastest-lap records. Final classification no longer promotes lapped cars merely because they cross earlier.

## Save compatibility

New native weekend saves are version 2. Version 1 is default-migrated before validation. The old HTML campaign/session formats remain unsupported. A v1 save can resume in the new engine, but changed solver/traffic behavior means it does not promise the old build’s future lap times.

The model’s track is isolated from both editor changes and modifications to a returned checkpoint dictionary. Restore validates nested fields before replacing the running model. JSON numeric continuation is tested with a stated tolerance, not advertised as byte-identical serialization: the occupied-pit scenario requires exact discrete/RNG state and at most `1e-7` numeric difference. Cross-architecture identical replay is not established.

## Verification and remaining work

Run `python3 scripts/verify.py --godot /path/to/godot`. It imports a clean project, runs domain/foundation tests, opens real native UI with isolated player data, rejects script errors and saves evidence. The report is the authority for counts and durations. Fifteen screenshots cover editor checks, qualifying splits, race telemetry/radio and the smaller viewport. The bake report records local timings; it is not an FPS guarantee for another computer.

Additional seeded two-lap scenarios cover Suzuka/Formula/dry, Interlagos/Touring/changeable, and Zandvoort/Kart/wet, alongside the original wet Monaco and GT/rotated Silverstone tests. Scripted input and rendered checks do not replace prolonged hands-on testing on the intended Windows/macOS/GPU/input hardware.

Deferred: company management; Q1/Q2/Q3 elimination; finite tyre-set inventory and per-wheel thermal models; itemized component failures; 3D bridge/tunnel construction; multilayer scenery grouping; a global optimum line solver; full-width topology validation; advanced weather/lateral surface grids; red flags and comprehensive stewarding. Next work should be driven by reproducible race/editor failures and target-device profiling rather than adding unrelated systems.
