class_name RaceReliability
extends RefCounted
## Aggregate condition only. Faults spend simulated exposure, never presentation frames.
## Coefficients are fictional tuning seeds; no component diagnosis or calibrated probability.
const VERSION = 1
const STAGES = ["normal", "warning", "degraded", "critical", "retired"]
const REPAIR_SECONDS_PER_DAMAGE = 0.14
const MIN_CRITICAL_SECONDS = 15.0

static func draw(record: Dictionary) -> float:
	record.rng = (1664525 * int(record.rng) + 1013904223) & 0xffffffff
	return float(record.rng) / 4294967296.0

static func create(cars: Array, seed: int, mode: String = "staged") -> Dictionary:
	var drivers: Array = []
	for c in cars:
		var r = {"id": int(c.id), "rng": (seed ^ 0x6e624eb7 ^ ((int(c.id) + 1) * 7919)) & 0xffffffff,
			"stage": "normal", "stage_since": 0.0, "stress": 0.0, "critical_load": 0.0, "critical_seconds": 0.0,
			"faults": 0, "revision": 0, "emergency": "advise" if c.player else "repair", "repair_budget": 12.0,
			"repair_only": false, "service": {}, "notice": ""}
		r.fault_threshold = 25.0 + draw(r) * 25.0
		r.terminal_threshold = 35.0 + draw(r) * 35.0
		r.stage = stage(c, r)
		drivers.append(r)
	return {"version": VERSION, "mode": mode, "drivers": drivers,
		"service_stream": {"rng": (seed ^ 0xd1b54a35) & 0xffffffff}}

static func stage(c: Dictionary, r: Dictionary) -> String:
	if c.dnf: return "retired"
	if c.damage >= 55 or c.health <= 25: return "critical"
	if c.damage >= 20 or c.health <= 60: return "degraded"
	if c.damage >= 5 or c.health <= 80 or c.engine_temperature >= 114 or r.stress >= 12: return "warning"
	if r.stage == "warning" and c.engine_temperature >= 110: return "warning"
	return "normal"

static func rate(c: Dictionary) -> float:
	var thermal = maxf(0, c.engine_temperature - 108) * 0.08
	var condition = maxf(0, 80 - c.health) * 0.007
	var damage = maxf(0, c.damage - 15) * 0.013
	return minf(6, (thermal + condition + damage) * [0.40, 1.0, 1.50][c.engine])

static func advance(r: Dictionary, c: Dictionary, dt: float, stochastic: bool) -> Dictionary:
	var result: Dictionary = {}
	var load = rate(c)
	r.stress = clampf(r.stress + dt * (load if load > 0 else -0.20), 0, 10000)
	if stochastic and r.stress >= r.fault_threshold:
		var before = c.damage
		c.damage = minf(1000, c.damage + 6.0 + draw(r) * 8.0)
		c.health = maxf(0, c.health - 1.0 - draw(r) * 2.0)
		r.stress -= r.fault_threshold; r.fault_threshold = 25.0 + draw(r) * 25.0
		r.faults += 1; r.revision += 1
		result = {"kind": "scalar_fault", "damage_before": before, "damage_after": c.damage,
			"temperature": c.engine_temperature, "health": c.health, "exposure_rate": load,
			"reason": "Accumulated thermal/condition exposure caused aggregate damage. No individual component was diagnosed."}
	if stage(c, r) == "critical":
		r.critical_seconds += dt
		r.critical_load = minf(10000, r.critical_load + maxf(0.02, load) * dt)
	else:
		r.critical_seconds = 0.0; r.critical_load = maxf(0, r.critical_load - dt * 0.20)
	if c.health <= 0 or stochastic and r.critical_seconds >= MIN_CRITICAL_SECONDS and r.critical_load >= r.terminal_threshold:
		result.retire = true
		result.reason = "Aggregate condition exhausted" if c.health <= 0 else "Critical aggregate condition could no longer sustain running"
	return result

static func observation(c: Dictionary, r: Dictionary) -> Dictionary:
	return {"driver_id": int(c.id), "stage": stage(c, r), "health": c.health, "damage": c.damage,
		"temperature": c.engine_temperature, "engine": c.engine, "pace": c.pace,
		"distance": c.distance, "route": c.route, "set_id": c.set_id,
		"exposure": "rising" if rate(c) > 0.1 else "low", "faults_observed": int(r.faults)}

static func valid(state: Variant, cars: Array, now: float) -> bool:
	if not state is Dictionary or state.get("version") != VERSION or state.get("mode") not in ["staged", "legacy"]: return false
	if not state.get("service_stream") is Dictionary or not RaceCheckpoint.integral(state.service_stream.get("rng"), 0, 4294967295): return false
	if not state.get("drivers") is Array or state.drivers.size() != cars.size(): return false
	for i in range(cars.size()):
		var r = state.drivers[i]; var c = cars[i]
		if not r is Dictionary or r.get("id") != i or r.get("stage") not in STAGES: return false
		if not RaceCheckpoint.integral(r.get("rng"), 0, 4294967295): return false
		for field in [["stage_since", 0, now], ["stress", 0, 10000], ["critical_load", 0, 10000], ["critical_seconds", 0, now + 0.1], ["fault_threshold", 25, 50], ["terminal_threshold", 35, 70], ["repair_budget", 0, 30]]:
			if not RaceCheckpoint.number(r.get(field[0]), field[1], field[2]): return false
		for key in ["faults", "revision"]:
			if not RaceCheckpoint.integral(r.get(key), 0, 1000000): return false
		if r.get("emergency") not in ["advise", "repair"] or not r.get("repair_only") is bool: return false
		if not r.get("notice") is String or r.notice.length() > 512: return false
		if r.repair_only and (not c.pit_order or c.route not in ["track", "pit"] or not c.repair): return false
		if not r.get("service") is Dictionary: return false
		if r.service.is_empty():
			if state.mode == "staged" and c.pit_stage == "service" and not c.dnf: return false
			continue
		var job = r.service
		if c.route != "pit" or c.pit_stage not in ["service", "exit"]: return false
		for field in [["started", 0, now], ["duration", 0, 200], ["damage_before", 0, 1000], ["health_before", 0, 100], ["repair_seconds", 0, 140]]:
			if not RaceCheckpoint.number(job.get(field[0]), field[1], field[2]): return false
		for key in ["repair", "repair_only"]:
			if not job.get(key) is bool: return false
		if not job.get("set_before") is String or TyreInventory.find(c, job.set_before).is_empty(): return false
		if not job.get("event_id") is String: return false
		if job.repair_only != r.repair_only or job.repair != c.service_repair: return false
		if c.pit_stage == "service" and (c.pit_timer > job.duration + 0.00001 or job.repair_only and not c.service_set_id.is_empty()): return false
	return true
