extends "res://scripts/domain/weekend/practice_run_validation.gd"
## Bounded observations from completed physical laps. No hidden optimum or gameplay bonus.


static func valid(state: Variant, sim: RaceSim) -> bool:
	if not state is Dictionary or state.get("version") != VERSION:
		return false
	if (
		state.get("status") not in ["available", "running", "complete", "skipped", "legacy"]
		or not state.get("closed") is bool
	):
		return false
	if not RaceCheckpoint.number(state.get("duration"), 120, 1800):
		return false
	if not state.get("drivers") is Array or state.drivers.size() != sim.cars.size():
		return false
	if not _valid_session_status(state, sim):
		return false
	for i in range(sim.cars.size()):
		var d = state.drivers[i]
		var c = sim.cars[i]
		if not _valid_driver_header(d, state, i):
			return false
		if not _valid_driver_runs(d, c, state, sim, i):
			return false
	return true


static func valid_records(records: Array, state: Dictionary) -> bool:
	for record in records:
		if record.kind not in ["practice_command", "practice_lap", "practice_return"]:
			continue
		var e = record.evidence
		if not e.get("reason") is String or e.reason.length() > 512:
			return false
		if record.kind == "practice_command":
			if (
				e.get("action")
				not in [
					"practice_start",
					"practice_run",
					"practice_recall",
					"practice_end",
					"practice_finish",
					"practice_skipped"
				]
			):
				return false
			if e.action not in ["practice_run", "practice_recall"]:
				if record.driver_id != -1:
					return false
				continue
		if record.driver_id < 0 or record.driver_id >= state.drivers.size():
			return false
		var matched: Dictionary = {}
		for run in state.drivers[int(record.driver_id)].runs:
			if run.id == e.get("run_id"):
				matched = run
				break
		if matched.is_empty():
			return false
		if not _valid_matching_record(record, e, matched):
			return false
	return true


static func _valid_driver_runs(
	d: Dictionary, c: RaceCar, state: Dictionary, sim: RaceSim, i: int
) -> bool:
	var active_count = 0
	var last_end = -1.0
	for j in range(d.runs.size()):
		var run = d.runs[j]
		if not _valid_run_schema(run, c, sim, i, j):
			return false
		if run.start.time < last_end:
			return false
		if (
			run.reason.length() > 512
			or not run.get("samples") is Array
			or run.samples.size() > run.target
		):
			return false
		if run.end.is_empty():
			active_count += 1
			if j != d.runs.size() - 1 or state.status != "running":
				return false
		elif not valid_observation(run.end, sim.total_time) or run.end.time < run.start.time:
			return false
		last_end = run.end.get("time", sim.total_time)
		if not _valid_samples(run, last_end):
			return false
	if not _valid_active_run(d, c, sim, active_count):
		return false
	if (
		state.status == "running"
		and (c.qual_best != 0 or c.qual_runs != 0 or not c.qual_history.is_empty())
	):
		return false
	if state.status == "running" and c.route != "garage" and not c.dnf and d.active.is_empty():
		return false
	return true
