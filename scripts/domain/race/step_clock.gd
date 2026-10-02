class_name RaceStepClock
extends RefCounted
## Pure fixed-step scheduling policy. Caller supplies elapsed seconds; no wall-clock reads.
## Checkpoint-compatible accumulator and approval/pause boundaries remain in RaceSim.
const MAX_FRAME_SECONDS = 0.25
const MAX_STEPS_PER_ADVANCE = 100
const EPSILON = 0.0000001

static func advance(sim: RaceSimFoundation, elapsed_seconds: float) -> int:
	if sim == null or not is_finite(elapsed_seconds) or elapsed_seconds < 0.0:
		return 0
	if sim.paused or sim.phase not in RaceSimFoundation.ACTIVE:
		return 0
	sim.accumulator += minf(elapsed_seconds, MAX_FRAME_SECONDS) * sim.speed
	var ticks = 0
	while (sim.accumulator + EPSILON >= RaceSimFoundation.STEP
			and sim.phase in RaceSimFoundation.ACTIVE and not sim.paused
			and ticks < MAX_STEPS_PER_ADVANCE):
		sim.accumulator = maxf(0.0, sim.accumulator - RaceSimFoundation.STEP)
		sim.step()
		ticks += 1
	return ticks
