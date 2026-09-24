class_name PracticeEvidence
extends RefCounted
## Bounded observations from completed physical laps. No hidden optimum or gameplay bonus.
const VERSION = 1
const MAX_RUNS = 3
const MAX_LAPS = 4
const OBJECTIVES = {
	"tyre_life": "Tyre-life estimate", "qualifying": "Qualifying preparation",
	"setup": "Setup comparison", "wet": "Wet-condition learning"}
const BASELINES = {
	"current": "Current setup", "balanced": "Balanced", "low_drag": "Low drag", "stable_wet": "Stable wet"}

static func setup_for(car: Dictionary, baseline: String) -> Dictionary:
	var result = car.car_setup.duplicate()
	if baseline == "balanced": result = CarSetup.DEFAULTS.duplicate()
	elif baseline == "low_drag": result.wing = 2; result.cooling = 4
	elif baseline == "stable_wet": result.wing = 7; result.suspension = 3; result.cooling = 6
	return result

static func create(cars: Array, duration: float, status: String = "available") -> Dictionary:
	var drivers: Array = []
	for car in cars: drivers.append({"id": int(car.id), "revision": 0, "runs": [], "active": {}, "next_release": 4.0 + car.id * 9.0})
	return {"version": VERSION, "status": status, "duration": duration, "closed": false, "drivers": drivers}

static func state_key(state: Dictionary, car: Dictionary) -> String:
	return JSON.stringify([state.status, state.closed, state.drivers[int(car.id)].revision, car.route,
		car.set_id, car.next_set_id, car.car_setup, car.pace, car.engine]).sha256_text()

static func observation(sim: RaceSim, car: Dictionary) -> Dictionary:
	return {"time": sim.total_time, "distance": car.distance, "life": car.tyre,
		"fuel": car.fuel, "health": car.health, "temperature": car.engine_temperature,
		"water": sim.average(sim.water), "damage": car.damage,
		"wheels": WheelTyres.KEYS.map(func(key): return TyreInventory.find(car, car.set_id).wheels[key].life)}

static func prior(state: Dictionary, car: Dictionary, water: float) -> Dictionary:
	# Never pool a rival's private measurements, nor transfer a teammate's skill/setup residual.
	var result: Dictionary = {}
	for compound in RaceSim.TYRES:
		var samples: Array = []
		for run in state.drivers[int(car.id)].runs:
			if run.compound != compound or run.setup != car.car_setup or run.pace != car.pace or run.engine != car.engine: continue
			for lap in run.samples:
				if lap.clean and absf(lap.water - water) <= 0.10 and absf(lap.health - car.health) <= 12 and absf(lap.damage - car.damage) <= 3:
					samples.append(lap)
		if samples.is_empty(): continue
		var wear = 0.0; var pace = 0.0
		for lap in samples: wear += lap.wear_ratio; pace += lap.model_ratio
		wear /= samples.size(); pace /= samples.size()
		var spread = 0.0
		for lap in samples: spread = maxf(spread, absf(lap.model_ratio - pace))
		var weight = float(samples.size()) / (samples.size() + 4.0)
		result[compound] = {"samples": samples.size(), "wear_factor": lerpf(1, clampf(wear, 0.5, 2.5), weight),
			"lap_factor": lerpf(1, clampf(pace, 0.9, 1.2), weight),
			"uncertainty": maxf(0.045 if samples.size() >= 3 else 0.06, spread + 0.025),
			"label": "%d matching measured practice laps; bounded blend, not calibrated confidence" % samples.size()}
	return result

static func describe(run: Dictionary) -> String:
	var n = run.samples.size()
	var title = "%s · %s · %s · %d/%d measured laps" % [run.id, OBJECTIVES[run.objective], run.set_id, n, run.target]
	var lines: Array[String] = [title, run.reason]
	var clean = run.samples.filter(func(lap): return lap.clean)
	if n > 0:
		var times = run.samples.map(func(lap): return lap.seconds)
		var wear = run.samples.map(func(lap): return lap.wear)
		lines.append("Measured lap %.2f–%.2fs · average tread loss %.2f–%.2f points/lap · %d clean samples." % [times.min(), times.max(), wear.min(), wear.max(), clean.size()])
		if run.objective == "qualifying": lines.append("Practice flying laps do not set the qualifying grid. Banker-run evidence only.")
		elif run.objective == "wet":
			var wet = run.samples.map(func(lap): return lap.water)
			lines.append("Observed line water %.0f–%.0f%%. %s" % [wet.min() * 100, wet.max() * 100, "No wet-condition evidence in this run." if wet.max() < 0.15 else "Rainfall and surface water are different measurements."])
		elif run.objective == "setup": lines.append("Compare only similar driver, tyre, fuel and water conditions. Faster observed laps do not isolate a setup effect.")
		else: lines.append("Matching clean laps inform the tyre forecast. Wear can change with pace, water, damage or setup.")
	if not run.get("end", {}).is_empty():
		lines.append("Run cost measured: %.2f tread points, %.2f fuel laps, %.2f health points; %.1fs elapsed. Tyre identity and all wear retained." % [maxf(0, run.start.life - run.end.life), maxf(0, run.start.fuel - run.end.fuel), maxf(0, run.start.health - run.end.health), run.end.time - run.start.time])
	if clean.is_empty(): lines.append("No comparable clean full-lap sample: forecasts retain the baseline. Partial running is still recorded.")
	return "\n".join(lines)

static func report(state: Dictionary, id: int) -> String:
	var runs = state.drivers[id].runs
	if runs.is_empty(): return "No practice runs recorded. Skipping is viable: baseline estimates and normal delegation remain available."
	var lines: Array[String] = []
	for run in runs: lines.append(describe(run))
	if runs.size() >= 2:
		var a = runs[-2]; var b = runs[-1]
		if not a.samples.is_empty() and not b.samples.is_empty():
			var ta = 0.0; var tb = 0.0
			for lap in a.samples: ta += lap.seconds
			for lap in b.samples: tb += lap.seconds
			lines.append("Latest-run comparison: second minus first %+.2fs/lap (measured averages). Different tyres, fuel, traffic, temperature and water may confound this difference. No perfect setup score or automatic change is applied." % [tb / b.samples.size() - ta / a.samples.size()])
	lines.append("Next decision: retain the proven configuration or schedule a complementary run. Apply any setup change explicitly; more laps are useful only when the conditions answer your question.")
	return "\n\n".join(lines)

static func valid_observation(value: Variant, now: float) -> bool:
	if not value is Dictionary: return false
	for field in [["time", 0, now], ["distance", -100000000, 100000000], ["life", 0, 100], ["fuel", 0, 200], ["health", 0, 100], ["temperature", 0, 200], ["water", 0, 1], ["damage", 0, 1000]]:
		if not RaceCheckpoint.number(value.get(field[0]), field[1], field[2]): return false
	if not value.get("wheels") is Array or value.wheels.size() != 4: return false
	for life in value.wheels:
		if not RaceCheckpoint.number(life, 0, 100): return false
	return true

static func valid(state: Variant, sim: RaceSim) -> bool:
	if not state is Dictionary or state.get("version") != VERSION: return false
	if state.get("status") not in ["available", "running", "complete", "skipped", "legacy"] or not state.get("closed") is bool: return false
	if not RaceCheckpoint.number(state.get("duration"), 120, 1800): return false
	if not state.get("drivers") is Array or state.drivers.size() != sim.cars.size(): return false
	if (state.status == "running") != (sim.phase == "practice"): return false
	if sim.phase == "practice_results" and (state.status != "complete" or not state.closed): return false
	if state.status == "available" and sim.phase != "briefing": return false
	if state.status == "complete" and not state.closed: return false
	if state.status in ["available", "skipped", "legacy"] and state.closed: return false
	for i in range(sim.cars.size()):
		var d = state.drivers[i]; var c = sim.cars[i]
		if not d is Dictionary or d.get("id") != i or not RaceCheckpoint.integral(d.get("revision"), 0, 100000): return false
		if not RaceCheckpoint.number(d.get("next_release"), 0, 100000000) or not d.get("runs") is Array or d.runs.size() > MAX_RUNS or not d.get("active") is Dictionary: return false
		if state.status in ["available", "skipped", "legacy"] and not d.runs.is_empty(): return false
		var active_count = 0
		var last_end = -1.0
		for j in range(d.runs.size()):
			var run = d.runs[j]
			if not run is Dictionary or run.get("id") != "P%d-%d" % [i, j + 1] or run.get("objective") not in OBJECTIVES: return false
			if not RaceCheckpoint.integral(run.get("target"), 1, MAX_LAPS): return false
			if not run.get("set_id") is String or TyreInventory.find(c, run.set_id).is_empty(): return false
			if run.get("compound") != TyreInventory.find(c, run.set_id).compound or not run.get("setup") is Dictionary or run.setup.size() != 5: return false
			for key in CarSetup.SPECS:
				if not RaceCheckpoint.integral(run.setup.get(key), CarSetup.SPECS[key][0], CarSetup.SPECS[key][1]): return false
			for key in ["pace", "engine", "previous_pace", "previous_engine"]:
				if not RaceCheckpoint.integral(run.get(key), 0, 2): return false
			if not valid_observation(run.get("start"), sim.total_time) or not run.get("end") is Dictionary or not run.get("reason") is String: return false
			if run.start.time < last_end: return false
			if run.reason.length() > 512 or not run.get("samples") is Array or run.samples.size() > run.target: return false
			if run.end.is_empty():
				active_count += 1
				if j != d.runs.size() - 1 or state.status != "running": return false
			elif not valid_observation(run.end, sim.total_time) or run.end.time < run.start.time: return false
			last_end = run.end.get("time", sim.total_time)
			var previous_sample = run.start.time
			for lap in run.samples:
				if not lap is Dictionary or not lap.get("clean") is bool or not lap.get("reason") is String or lap.reason.length() > 512: return false
				for field in [["seconds", 0.001, 10000], ["time", previous_sample, last_end], ["wear", 0, 100], ["wear_ratio", 0, 100], ["model_ratio", 0, 1000], ["water", 0, 1], ["fuel", 0, 200], ["health", 0, 100], ["damage", 0, 1000]]:
					if not RaceCheckpoint.number(lap.get(field[0]), field[1], field[2]): return false
				if lap.time <= previous_sample: return false
				previous_sample = lap.time
		if active_count == 0 and not d.active.is_empty(): return false
		if active_count > 0:
			var a = d.active
			if a.get("run_id") != d.runs.back().id or c.route not in ["track", "pit"] or c.set_id != d.runs.back().set_id: return false
			if not a.get("anchor") is Dictionary or not a.get("tainted") is bool: return false
			if not a.anchor.is_empty() and not valid_observation(a.anchor, sim.total_time): return false
			if not RaceCheckpoint.number(a.get("water_sum"), 0, 100000000) or not RaceCheckpoint.integral(a.get("ticks"), 0, 100000000): return false
			if not a.get("returning") is bool or a.water_sum > a.ticks + 0.000001: return false
			if not a.anchor.is_empty() and a.anchor.time < d.runs.back().start.time: return false
			if c.qual_state == "hotlap" and a.anchor.is_empty(): return false
			if c.car_setup != d.runs.back().setup or c.pace != d.runs.back().pace or c.engine != d.runs.back().engine: return false
		if state.status == "running" and (c.qual_best != 0 or c.qual_runs != 0 or not c.qual_history.is_empty()): return false
		if state.status == "running" and c.route != "garage" and not c.dnf and d.active.is_empty(): return false
	return true

static func valid_records(records: Array, state: Dictionary) -> bool:
	for record in records:
		if record.kind not in ["practice_command", "practice_lap", "practice_return"]: continue
		var e = record.evidence
		if not e.get("reason") is String or e.reason.length() > 512: return false
		if record.kind == "practice_command":
			if e.get("action") not in ["practice_start", "practice_run", "practice_recall", "practice_end", "practice_finish", "practice_skipped"]: return false
			if e.action not in ["practice_run", "practice_recall"]:
				if record.driver_id != -1: return false
				continue
		if record.driver_id < 0 or record.driver_id >= state.drivers.size(): return false
		var matched: Dictionary = {}
		for run in state.drivers[int(record.driver_id)].runs:
			if run.id == e.get("run_id"): matched = run; break
		if matched.is_empty(): return false
		if record.kind == "practice_lap":
			if not e.get("sample") is Dictionary or e.sample not in matched.samples: return false
		elif record.kind == "practice_return":
			if not e.get("end") is Dictionary or e.end != matched.end or e.get("measured_laps") != matched.samples.size(): return false
		elif e.action == "practice_run":
			var plan = e.get("plan")
			if not plan is Dictionary or plan.get("objective") != matched.objective or plan.get("set_id") != matched.set_id or plan.get("laps") != matched.target or plan.get("baseline") not in BASELINES: return false
	return true
