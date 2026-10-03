extends RefCounted


## Test-only timers around existing APIs, not a second scheduler or query engine.
class Runner:
	extends RaceSessionRunner
	var calls: int = 0
	var ticks: int = 0
	var usec: int = 0
	var supplied_seconds: float = 0.0
	var clamped_seconds: float = 0.0
	var step_cap_frames: int = 0

	func reset() -> void:
		calls = 0
		ticks = 0
		usec = 0
		supplied_seconds = 0.0
		clamped_seconds = 0.0
		step_cap_frames = 0

	func advance(elapsed_seconds: float) -> int:
		var eligible = not _simulation.paused and _simulation.phase in RaceSim.ACTIVE
		var started = Time.get_ticks_usec()
		var count = super.advance(elapsed_seconds)
		usec += Time.get_ticks_usec() - started
		calls += 1
		ticks += count
		if eligible:
			supplied_seconds += elapsed_seconds
			clamped_seconds += maxf(0.0, elapsed_seconds - RaceStepClock.MAX_FRAME_SECONDS)
			if count == RaceStepClock.MAX_STEPS_PER_ADVANCE:
				step_cap_frames += 1
		return count


class Query:
	extends MinimalWeekendQuery
	var calls: int = 0
	var usec: int = 0

	func capture() -> Dictionary:
		var started = Time.get_ticks_usec()
		var result = super.capture()
		usec += Time.get_ticks_usec() - started
		calls += 1
		return result


class Visual:
	extends RaceVisualSource
	var calls: int = 0
	var usec: int = 0

	func capture() -> Dictionary:
		var started = Time.get_ticks_usec()
		var result = super.capture()
		usec += Time.get_ticks_usec() - started
		calls += 1
		return result


static func statistics(samples: Array) -> Dictionary:
	if samples.is_empty():
		return {}
	var ordered = samples.duplicate()
	ordered.sort()
	return {
		"samples": samples.size(),
		"median_us": ordered[ordered.size() / 2],
		"p95_us": ordered[mini(ordered.size() - 1, int(ordered.size() * 0.95))],
		"maximum_us": ordered.back(),
		"raw_us": samples.duplicate()
	}
