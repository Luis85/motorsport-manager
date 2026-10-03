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


static func create(
	cars: Array,
	seed: int,
	mode: String = "staged",
	rules: Dictionary = LegacyOperations.VALUES.reliability
) -> Dictionary:
	var drivers: Array = []
	for c in cars:
		var r = {
			"id": int(c.id),
			"rng": (seed ^ 0x6e624eb7 ^ ((int(c.id) + 1) * 7919)) & 0xffffffff,
			"stage": "normal",
			"stage_since": 0.0,
			"stress": 0.0,
			"critical_load": 0.0,
			"critical_seconds": 0.0,
			"faults": 0,
			"revision": 0,
			"emergency": "advise" if c.player else "repair",
			"repair_budget": rules.default_repair_budget_seconds,
			"repair_only": false,
			"service": {},
			"notice": ""
		}
		r.fault_threshold = rules.fault_threshold_base + draw(r) * rules.fault_threshold_span
		r.terminal_threshold = (
			rules.terminal_threshold_base + draw(r) * rules.terminal_threshold_span
		)
		r.stage = stage(c, r, rules)
		drivers.append(r)
	return {
		"version": VERSION,
		"mode": mode,
		"drivers": drivers,
		"service_stream": {"rng": (seed ^ 0xd1b54a35) & 0xffffffff}
	}


static func stage(
	c: RaceCar, r: Dictionary, rules: Dictionary = LegacyOperations.VALUES.reliability
) -> String:
	if c.dnf:
		return "retired"
	if c.damage >= rules.damage_critical or c.health <= rules.health_critical:
		return "critical"
	if c.damage >= rules.damage_degraded or c.health <= rules.health_degraded:
		return "degraded"
	if (
		c.damage >= rules.damage_warning
		or c.health <= rules.health_warning
		or c.engine_temperature >= rules.temperature_warning_c
		or r.stress >= rules.stress_warning
	):
		return "warning"
	if r.stage == "warning" and c.engine_temperature >= rules.temperature_warning_reset_c:
		return "warning"
	return "normal"


static func rate(c: RaceCar, rules: Dictionary = LegacyOperations.VALUES.reliability) -> float:
	var thermal = maxf(0, c.engine_temperature - rules.thermal_reference_c) * rules.thermal_exposure
	var condition = maxf(0, rules.health_reference - c.health) * rules.health_exposure
	var damage = maxf(0, c.damage - rules.damage_reference) * rules.damage_exposure
	return minf(
		rules.maximum_exposure,
		(
			(thermal + condition + damage)
			* [rules.engine_save, rules.engine_normal, rules.engine_attack][c.engine]
		)
	)


static func advance(
	r: Dictionary,
	c: RaceCar,
	dt: float,
	stochastic: bool,
	rules: Dictionary = LegacyOperations.VALUES.reliability
) -> Dictionary:
	var result: Dictionary = {}
	var load = rate(c, rules)
	r.stress = clampf(
		r.stress + dt * (load if load > 0 else -rules.stress_recovery_per_second), 0, 10000
	)
	if stochastic and r.stress >= r.fault_threshold:
		var before = c.damage
		c.damage = minf(
			1000, c.damage + rules.fault_damage_base + draw(r) * rules.fault_damage_span
		)
		c.health = maxf(0, c.health - rules.fault_health_base - draw(r) * rules.fault_health_span)
		r.stress -= r.fault_threshold
		r.fault_threshold = rules.fault_threshold_base + draw(r) * rules.fault_threshold_span
		r.faults += 1
		r.revision += 1
		result = {
			"kind": "scalar_fault",
			"damage_before": before,
			"damage_after": c.damage,
			"temperature": c.engine_temperature,
			"health": c.health,
			"exposure_rate": load,
			"reason":
			"Accumulated thermal/condition exposure caused aggregate damage. No individual component was diagnosed."
		}
	if stage(c, r, rules) == "critical":
		r.critical_seconds += dt
		r.critical_load = minf(
			10000, r.critical_load + maxf(rules.minimum_critical_exposure, load) * dt
		)
	else:
		r.critical_seconds = 0.0
		r.critical_load = maxf(0, r.critical_load - dt * rules.critical_recovery_per_second)
	if (
		c.health <= 0
		or (
			stochastic
			and r.critical_seconds >= rules.minimum_critical_seconds
			and r.critical_load >= r.terminal_threshold
		)
	):
		result.retire = true
		result.reason = (
			"Aggregate condition exhausted"
			if c.health <= 0
			else "Critical aggregate condition could no longer sustain running"
		)
	return result


static func observation(
	c: RaceCar, r: Dictionary, rules: Dictionary = LegacyOperations.VALUES.reliability
) -> Dictionary:
	return {
		"driver_id": int(c.id),
		"stage": stage(c, r, rules),
		"health": c.health,
		"damage": c.damage,
		"temperature": c.engine_temperature,
		"engine": c.engine,
		"pace": c.pace,
		"distance": c.distance,
		"route": c.route,
		"set_id": c.set_id,
		"exposure": "rising" if rate(c, rules) > rules.observed_rising_exposure else "low",
		"faults_observed": int(r.faults)
	}


static func valid(
	state: Variant, cars: Array, now: float, tuning: RaceTuningDefinition = null
) -> bool:
	var rules: Dictionary = (
		tuning.operations.reliability if tuning != null else LegacyOperations.VALUES.reliability
	)
	var max_repair = tuning.service.repair_seconds_per_damage * 1000 if tuning != null else 140.0
	if (
		not state is Dictionary
		or state.get("version") != VERSION
		or state.get("mode") not in ["staged", "legacy"]
	):
		return false
	if (
		not state.get("service_stream") is Dictionary
		or not RaceCheckpoint.integral(state.service_stream.get("rng"), 0, 4294967295)
	):
		return false
	if not state.get("drivers") is Array or state.drivers.size() != cars.size():
		return false
	for i in range(cars.size()):
		var r = state.drivers[i]
		var c = cars[i]
		if not _valid_driver(r, c, i, now, rules):
			return false
		if not r.get("service") is Dictionary:
			return false
		if r.service.is_empty():
			if state.mode == "staged" and c.pit_stage == "service" and not c.dnf:
				return false
			continue
		if not _valid_service(r, c, now, max_repair, tuning):
			return false
	return true


static func _valid_driver(r: Variant, c: RaceCar, i: int, now: float, rules: Dictionary) -> bool:
	if not r is Dictionary or r.get("id") != i or r.get("stage") not in STAGES:
		return false
	if not RaceCheckpoint.integral(r.get("rng"), 0, 4294967295):
		return false
	for field in [
		["stage_since", 0, now],
		["stress", 0, 10000],
		["critical_load", 0, 10000],
		["critical_seconds", 0, now + 0.1],
		[
			"fault_threshold",
			rules.fault_threshold_base,
			rules.fault_threshold_base + rules.fault_threshold_span
		],
		[
			"terminal_threshold",
			rules.terminal_threshold_base,
			rules.terminal_threshold_base + rules.terminal_threshold_span
		],
		["repair_budget", 0, 30]
	]:
		if not RaceCheckpoint.number(r.get(field[0]), field[1], field[2]):
			return false
	for key in ["faults", "revision"]:
		if not RaceCheckpoint.integral(r.get(key), 0, 1000000):
			return false
	if r.get("emergency") not in ["advise", "repair"] or not r.get("repair_only") is bool:
		return false
	if not r.get("notice") is String or r.notice.length() > 512:
		return false
	if r.repair_only and (not c.pit_order or c.route not in ["track", "pit"] or not c.repair):
		return false
	return true


static func _valid_service(
	r: Dictionary, c: RaceCar, now: float, max_repair: float, tuning: RaceTuningDefinition
) -> bool:
	var job = r.service
	if c.route != "pit" or c.pit_stage not in ["service", "exit"]:
		return false
	for field in [
		["started", 0, now],
		["duration", 0, 200],
		["damage_before", 0, 1000],
		["health_before", 0, 100],
		["repair_seconds", 0, max_repair]
	]:
		if not RaceCheckpoint.number(job.get(field[0]), field[1], field[2]):
			return false
	for key in ["repair", "repair_only"]:
		if not job.get(key) is bool:
			return false
	if not job.get("set_before") is String or TyreInventory.find(c, job.set_before).is_empty():
		return false
	if not job.get("event_id") is String:
		return false
	if tuning != null and tuning.authored():
		var expected_repair = (
			job.damage_before * tuning.service.repair_seconds_per_damage if job.repair else 0.0
		)
		if absf(job.repair_seconds - expected_repair) > 0.000001:
			return false
	if job.repair_only != r.repair_only or job.repair != c.service_repair:
		return false
	if (
		c.pit_stage == "service"
		and (
			c.pit_timer > job.duration + 0.00001
			or job.repair_only and not c.service_set_id.is_empty()
		)
	):
		return false
	return true
