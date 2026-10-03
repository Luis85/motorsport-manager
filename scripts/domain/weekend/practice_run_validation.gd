extends RefCounted
## Bounded observations from completed physical laps. No hidden optimum or gameplay bonus.
const VERSION = 1
const MAX_RUNS = 3
const MAX_LAPS = 4
const OBJECTIVES = {
	"tyre_life": "Tyre-life estimate",
	"qualifying": "Qualifying preparation",
	"setup": "Setup comparison",
	"wet": "Wet-condition learning"
}
const BASELINES = {
	"current": "Current setup",
	"balanced": "Balanced",
	"low_drag": "Low drag",
	"stable_wet": "Stable wet"
}
## Checkpoint validation for bounded practice evidence and observations.
## Practice run, lap, live-mode and session-consistency validation.


static func valid_observation(value: Variant, now: float) -> bool:
	if not value is Dictionary:
		return false
	for field in [
		["time", 0, now],
		["distance", -100000000, 100000000],
		["life", 0, 100],
		["fuel", 0, 200],
		["health", 0, 100],
		["temperature", 0, 200],
		["water", 0, 1],
		["damage", 0, 1000]
	]:
		if not RaceCheckpoint.number(value.get(field[0]), field[1], field[2]):
			return false
	if not value.get("wheels") is Array or value.wheels.size() != 4:
		return false
	for life in value.wheels:
		if not RaceCheckpoint.number(life, 0, 100):
			return false
	return true


static func _valid_run_schema(run: Variant, c: RaceCar, sim: RaceSim, i: int, j: int) -> bool:
	if (
		not run is Dictionary
		or run.get("id") != "P%d-%d" % [i, j + 1]
		or run.get("objective") not in OBJECTIVES
	):
		return false
	if not RaceCheckpoint.integral(run.get("target"), 1, MAX_LAPS):
		return false
	if not run.get("set_id") is String or TyreInventory.find(c, run.set_id).is_empty():
		return false
	if (
		run.get("compound") != TyreInventory.find(c, run.set_id).compound
		or not run.get("setup") is Dictionary
		or run.setup.size() != 5
	):
		return false
	if not c.setup_definition.valid_values(run.setup):
		return false
	for key in ["pace", "engine", "previous_pace", "previous_engine"]:
		if not RaceCheckpoint.integral(run.get(key), 0, 2):
			return false
	if (
		not valid_observation(run.get("start"), sim.total_time)
		or not run.get("end") is Dictionary
		or not run.get("reason") is String
	):
		return false
	return true


static func _valid_samples(run: Dictionary, last_end: float) -> bool:
	var previous_sample = run.start.time
	for lap in run.samples:
		if (
			not lap is Dictionary
			or not lap.get("clean") is bool
			or not lap.get("reason") is String
			or lap.reason.length() > 512
		):
			return false
		for field in [
			["seconds", 0.001, 10000],
			["time", previous_sample, last_end],
			["wear", 0, 100],
			["wear_ratio", 0, 100],
			["model_ratio", 0, 1000],
			["water", 0, 1],
			["fuel", 0, 200],
			["health", 0, 100],
			["damage", 0, 1000]
		]:
			if not RaceCheckpoint.number(lap.get(field[0]), field[1], field[2]):
				return false
		if lap.time <= previous_sample:
			return false
		previous_sample = lap.time
	return true


static func _valid_active_run(d: Dictionary, c: RaceCar, sim: RaceSim, active_count: int) -> bool:
	if active_count == 0 and not d.active.is_empty():
		return false
	if active_count > 0:
		var a = d.active
		if (
			a.get("run_id") != d.runs.back().id
			or c.route not in ["track", "pit"]
			or c.set_id != d.runs.back().set_id
		):
			return false
		if not a.get("anchor") is Dictionary or not a.get("tainted") is bool:
			return false
		if not a.anchor.is_empty() and not valid_observation(a.anchor, sim.total_time):
			return false
		if (
			not RaceCheckpoint.number(a.get("water_sum"), 0, 100000000)
			or not RaceCheckpoint.integral(a.get("ticks"), 0, 100000000)
		):
			return false
		if not a.get("returning") is bool or a.water_sum > a.ticks + 0.000001:
			return false
		if not a.anchor.is_empty() and a.anchor.time < d.runs.back().start.time:
			return false
		if c.qual_state == "hotlap" and a.anchor.is_empty():
			return false
		if c.car_setup != d.runs.back().setup:
			return false
		# Optional explicit live orders preserve the original run's measured-mode
		# baseline. Legacy runs still require that exact baseline on the car.
		if not _valid_run_modes(a, d, c):
			return false
	return true


static func _valid_run_modes(a: Dictionary, d: Dictionary, c: RaceCar) -> bool:
	var modes = a.get("live_modes", {"pace": d.runs.back().pace, "engine": d.runs.back().engine})
	if not modes is Dictionary or modes.size() != 2:
		return false
	for channel in ["pace", "engine"]:
		if not RaceCheckpoint.integral(modes.get(channel), 0, 2) or c[channel] != modes[channel]:
			return false
	return true


static func _valid_matching_record(record: Dictionary, e: Dictionary, matched: Dictionary) -> bool:
	if record.kind == "practice_lap":
		if not e.get("sample") is Dictionary or e.sample not in matched.samples:
			return false
	elif record.kind == "practice_return":
		if (
			not e.get("end") is Dictionary
			or e.end != matched.end
			or e.get("measured_laps") != matched.samples.size()
		):
			return false
	elif e.action == "practice_run":
		var plan = e.get("plan")
		if (
			not plan is Dictionary
			or plan.get("objective") != matched.objective
			or plan.get("set_id") != matched.set_id
			or plan.get("laps") != matched.target
			or plan.get("baseline") not in BASELINES
		):
			return false
	return true


static func _valid_session_status(state: Dictionary, sim: RaceSim) -> bool:
	if (state.status == "running") != (sim.phase == "practice"):
		return false
	if sim.phase == "practice_results" and (state.status != "complete" or not state.closed):
		return false
	if state.status == "available" and sim.phase != "briefing":
		return false
	if state.status == "complete" and not state.closed:
		return false
	if state.status in ["available", "skipped", "legacy"] and state.closed:
		return false
	return true


static func _valid_driver_header(d: Variant, state: Dictionary, i: int) -> bool:
	if (
		not d is Dictionary
		or d.get("id") != i
		or not RaceCheckpoint.integral(d.get("revision"), 0, 100000)
	):
		return false
	if (
		not RaceCheckpoint.number(d.get("next_release"), 0, 100000000)
		or not d.get("runs") is Array
		or d.runs.size() > MAX_RUNS
		or not d.get("active") is Dictionary
	):
		return false
	if state.status in ["available", "skipped", "legacy"] and not d.runs.is_empty():
		return false
	return true
