# Simulation mechanics

## Deterministic clock

The model runs at `STEP = 0.05` seconds. A local unsigned 32-bit linear-congruential PRNG drives incidents and service variation; rendering never draws from it. A given track, configuration, seed, command sequence and number of steps produce the same model state in the tested engine. Bit-identical floating-point results across different CPU architectures are not promised.

Frames feed an accumulator; speed modes alter the number of fixed steps, never the step duration. Large frame gaps are clamped to avoid unbounded recovery work. Existing approval phases freeze the simulation. Per-frame display interpolation is not persisted as authoritative race distance.

## Circuit and racing line

Cubics are densely sampled and resampled at approximately 4 m spacing, between 64 and 4096 samples. Width/elevation/banking are interpolated. A bounded, local curvature-reduction heuristic moves the reference line within the road corridor, retaining a 1.5 m edge margin. The v2 solver evaluates candidates after 8, 16 and 32 smoothing iterations, retaining the fastest evaluated candidate or the centreline fallback. It **does not prove the globally fastest lap**.

Three-point curvature estimates constrain corner speed with `v ≈ sqrt(lateral_acceleration / |curvature|)`. Banking modifies the simplified lateral acceleration. Forward acceleration and backward braking passes propagate longitudinal limits around the closed loop. The displayed estimate sums `2 × ds / (v_i + v_next)` using actual candidate 3D segment distances, including elevation; it no longer assumes every offset line has centreline length. Formula, GT, Touring and Kart are game presets with different top speed, lateral grip, acceleration and braking, not licensed car replicas.

The actual driver's target velocity scales the reference profile by tyre/surface grip, skill, wet skill, setup, damage, health, fuel mass, pace and engine setting. Longitudinal acceleration and braking approach that target, with a grade contribution and a grip-dependent look-ahead braking envelope. Physical travel is converted back to centreline station using the local line/centreline arc ratio. This is a path-following management simulation: no rigid-body tyre contact solver, aero map, suspension dynamics, or full vehicle footprint optimization is claimed.

## Traffic and racecraft

Cars advance along monotonic route distance. Traffic decisions use a snapshot of the field to reduce update-order effects. A car may move into a lateral passing corridor where width, curvature and speed advantage permit. Cars cannot sweep through an already-occupied lateral corridor; close same-lane traffic limits advance. Yielding/blue flags are based on nearby physical traffic and session priority. A courtesy target and side persist until the priority car clears, rather than flipping sides each frame. Cars return to their normal racing line afterward. Slipstream and dirty-air effects are small simplified modifiers.

Neutralization disables normal passing and caps speed. Virtual safety-car running is a rules state rather than a separately simulated safety-car vehicle. The model is not a complete race steward: there are no track-limit penalties, red-flag procedures, detailed collision impulses, or protests.

## Tyres, fuel, condition

Five compounds have different pace, wear and wet suitability. Wear accumulates with traveled distance and pace; temperature approaches a phase/compound target. Cold, overheated, worn or weather-mismatched tyres lose grip. Engine mode affects consumption, and fuel itself slightly affects speed. Fuel depletion retires a car; pit stops do not refuel it.

Health and modeled damage affect pace and incident exposure. Optional pit servicing repairs the scalar damage model, not an itemized parts inventory. The chosen compound and repair flag lock when service begins; later orders cannot retroactively change that service. The previous HTML engine's separate aero/suspension/brakes/gearbox components, wear histories, stress system and finite tyre-set allocations are not present here.

## Surface and weather

Ninety-six longitudinal cells store water and rubber. Rainfall is a separate signal: rain adds water gradually, drainage removes it, and vehicle passage dries the line and deposits rubber. Rain washes rubber away. Qualifying surface history carries into the race rather than resetting to an unrelated grip state. The three scenarios are dry, changeable, and wet-to-drying.

The current model has one value per station rather than the prototype's full lateral surface grid. It does not model puddle geometry, spray visibility, track temperature history or detailed weather forecasts. A shower beginning is not an instantaneous switch to a fully wet surface; tyre decisions must follow actual water.

## Pits and measured timing

The pit route has physical stations, a limiter, service positions, a shared box per team and exit gap checks. Its equivalent track progress is unwrapped over the timing line. Lap/sector gate crossing timestamps interpolate within a step using progress before and after movement; pit laps therefore do not lose or add a lap at the join.

Qualifying uses measured flying-lap and sector crossings. Every completed hot lap stores its three splits, validity, compound and invalidation reason. Out/in laps remain untimed. A hot lap already running may finish after chequered; a new hot lap cannot start. Race preparation resets race timing without erasing qualifying history. Race sector ends use authored sector gates where exactly two valid boundaries exist, otherwise thirds. Classification and finish processing are resolved after every car's movement in the tick. This avoids awarding a close finish to whichever driver happened to appear first in the roster array. Final finishers are ranked by completed laps descending, then crossing timestamp, with grid order as the tie-break. A lapped finisher does not jump ahead of a lead-lap car still approaching the flag. Laps touching the pit route remain recorded but cannot set the fastest-lap record.

## Performance boundaries

Track compilation is synchronous and bounded. During a pointer drag, a coalesced approximately 12 m preview omits racing-line solving; a committed edit performs the approximately 4 m full bake. Preview estimates are not race-ready and are never passed directly into a simulation. The maximum-size authoring document is a validation ceiling, not a guarantee of smooth interactive editing on every computer. Normal bundled layouts use 14–250 control points. Track drawing is retained separately from moving cars, and text refreshes at 5 Hz. A native profiler pass on target hardware remains appropriate before claiming a frame-rate guarantee.
