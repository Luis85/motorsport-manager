class_name OperationsTuningSchema
extends RefCounted
## Existing scalar reliability and fictional virtual neutralization; no executable author code.
const LIMITS = {
	"reliability": {
		"damage_warning": [0, 1000, "damage units: Inclusive warning threshold."],
		"damage_degraded": [0, 1000, "damage units: Inclusive degraded threshold, not below warning."],
		"damage_critical": [0.01, 1000, "damage units: Inclusive critical threshold, not below degraded."],
		"health_warning": [0, 100, "health percent: Inclusive warning threshold."],
		"health_degraded": [0, 100, "health percent: Inclusive degraded threshold, not above warning."],
		"health_critical": [0, 100, "health percent: Inclusive critical threshold, not above degraded."],
		"temperature_warning_c": [0, 200, "Celsius: Start a thermal warning."],
		"temperature_warning_reset_c": [0, 200, "Celsius: Retain an existing thermal warning down to this temperature."],
		"stress_warning": [0, 10000, "exposure units: Warning threshold for accumulated repairable stress."],
		"thermal_reference_c": [0, 200, "Celsius: No thermal exposure below this temperature."],
		"thermal_exposure": [0, 1, "exposure/second/Celsius: Thermal exposure above the reference."],
		"health_reference": [0, 100, "health percent: No condition exposure above this health."],
		"health_exposure": [0, 1, "exposure/second/health point: Condition exposure below the reference."],
		"damage_reference": [0, 1000, "damage units: No damage exposure below this value."],
		"damage_exposure": [0, 1, "exposure/second/damage unit: Exposure above the reference."],
		"maximum_exposure": [0.01, 50, "exposure/second: Clamp after engine-mode scaling."],
		"engine_save": [0, 10, "multiplier: Exposure in saving engine mode."],
		"engine_normal": [0, 10, "multiplier: Exposure in normal engine mode."],
		"engine_attack": [0, 10, "multiplier: Exposure in attack engine mode."],
		"stress_recovery_per_second": [0, 50, "exposure/second: Stress recovery when instantaneous exposure is zero."],
		"fault_threshold_base": [0.01, 10000, "exposure units: Minimum sampled fault threshold."],
		"fault_threshold_span": [0, 10000, "exposure units: Uniform threshold jitter; the random draw remains when zero."],
		"terminal_threshold_base": [0.01, 10000, "critical exposure units: Minimum sampled terminal threshold."],
		"terminal_threshold_span": [0, 10000, "critical exposure units: Uniform terminal-threshold jitter."],
		"fault_damage_base": [0, 1000, "damage units: Base scalar damage added by a fault."],
		"fault_damage_span": [0, 1000, "damage units: Uniform additional scalar-fault damage."],
		"fault_health_base": [0, 100, "health points: Base lifetime health lost to a fault; never repaired in pits."],
		"fault_health_span": [0, 100, "health points: Uniform additional lifetime health loss."],
		"minimum_critical_exposure": [0, 50, "exposure/second: Minimum accumulation while critically damaged."],
		"critical_recovery_per_second": [0, 50, "exposure/second: Critical-load recovery outside the critical stage."],
		"minimum_critical_seconds": [0.05, 600, "seconds: Minimum critical interval before progressive terminal failure; zero health is separate."],
		"observed_rising_exposure": [0, 50, "exposure/second: Public rising-exposure label threshold; not a failure prediction."],
		"default_repair_budget_seconds": [0, 30, "seconds of additional repair work: Initial per-driver cap; does not grant player repair authority."],
		"repair_minimum_tread": [0, 100, "tread percent: Minimum limiting-wheel life for repair-only service; punctures remain disallowed."]
	},
	"control": {
		"virtual_pace_factor": [0.05, 1, "multiplier: Virtual/ending target relative to the compiled speed envelope; no catch-up."],
		"ending_seconds": [1, 120, "seconds: Published no-passing interval after virtual clearance."],
		"local_yellow_speed_mps": [1, 100, "metres/second: Local-yellow target speed cap; ordinary braking still applies."],
		"legacy_neutral_speed_mps": [1, 100, "metres/second: Legacy neutral/formation target cap; not a physical safety car."],
		"local_incident_seconds": [1, 120, "seconds: Local clearance for a non-terminal driving incident."],
		"retired_car_seconds": [1, 120, "seconds: Global virtual clearance for an actual on-track retirement."],
		"legacy_mechanical_seconds": [1, 120, "seconds: Legacy mechanical-retirement local-yellow interval."]
	},
	"incidents": {
		"base_exposure_per_second": [0, 0.001, "per simulated second: Base driving-error exposure before driver, tyre and mode factors."],
		"consistency_factor": [0, 0.2, "multiplier/consistency deficit point: Driving-error exposure below consistency 100."],
		"reliability_factor": [0, 0.2, "multiplier/reliability deficit point: Driving-error exposure below reliability 100."],
		"push_factor": [1, 5, "multiplier: Driving-error exposure at push pace."],
		"water_factor": [0, 10, "multiplier/water fraction: Exposure on the actual local strip."],
		"low_tread_reference": [0, 100, "tread percent: Reference below which driving-error exposure rises."],
		"low_tread_factor": [0, 0.2, "multiplier/tread point: Exposure below the low-tread reference."],
		"patient_factor": [0, 5, "multiplier: Driving-error exposure under patient racecraft."],
		"balanced_factor": [0, 5, "multiplier: Driving-error exposure under balanced racecraft."],
		"assertive_factor": [0, 5, "multiplier: Driving-error exposure under assertive racecraft."],
		"volatile_factor": [1, 5, "multiplier: Disclosed volatile mode; calm still suppresses stochastic incidents."],
		"barrier_probability": [0, 1, "conditional probability: Barrier retirement after a driving error has occurred."],
		"legacy_retirement_threshold": [0, 1, "cumulative conditional probability: Legacy mechanical branch follows barrier outcomes."],
		"legacy_mechanical_health": [0, 100, "health percent: Legacy mechanical branch only below this remaining health."],
		"lost_seconds_base": [0, 120, "seconds: Base time loss after a non-terminal driving error."],
		"lost_seconds_span": [0, 120, "seconds: Uniform additional driving-error time loss."],
		"damage_base": [0, 1000, "damage units: Base damage after a non-terminal driving error."],
		"damage_span": [0, 1000, "damage units: Uniform additional driving-error damage."],
		"tread_loss": [0, 100, "tread points: Per-wheel retained-life loss from a driving error."]
	}
}

static func definition() -> Dictionary:
	var properties: Dictionary = {"model": {"enum": ["race-operations-v1"]}}
	for group in LIMITS:
		var fields: Dictionary = {}
		for key in LIMITS[group]:
			var field = LIMITS[group][key]
			fields[key] = ContentSchema.number(field[0], field[1])
			fields[key].description = field[2]
		properties[group] = ContentSchema.object(fields)
	return ContentSchema.object(properties)

static func semantic_errors(value: Dictionary) -> Array:
	var errors: Array = []
	var r: Dictionary = value.reliability
	for pair in [["damage_warning", "damage_degraded"], ["damage_degraded", "damage_critical"],
		["health_critical", "health_degraded"], ["health_degraded", "health_warning"],
		["temperature_warning_reset_c", "temperature_warning_c"], ["engine_save", "engine_normal"],
		["engine_normal", "engine_attack"], ["minimum_critical_exposure", "maximum_exposure"],
		["observed_rising_exposure", "maximum_exposure"]]:
		if r[pair[0]] > r[pair[1]]:
			errors.append(_error("reliability/" + pair[1], "Must not be below " + str(pair[0]) + "."))
	for triple in [["fault_threshold_base", "fault_threshold_span", 10000],
		["terminal_threshold_base", "terminal_threshold_span", 10000],
		["fault_damage_base", "fault_damage_span", 1000], ["fault_health_base", "fault_health_span", 100]]:
		if r[triple[0]] + r[triple[1]] > triple[2]:
			errors.append(_error("reliability/" + triple[1], "Base plus span exceeds the supported state bound."))
	var i: Dictionary = value.incidents
	for pair in [["patient_factor", "balanced_factor"], ["balanced_factor", "assertive_factor"],
		["barrier_probability", "legacy_retirement_threshold"]]:
		if i[pair[0]] > i[pair[1]]:
			errors.append(_error("incidents/" + pair[1], "Must not be below " + str(pair[0]) + "."))
	for triple in [["lost_seconds_base", "lost_seconds_span", 120], ["damage_base", "damage_span", 1000]]:
		if i[triple[0]] + i[triple[1]] > triple[2]:
			errors.append(_error("incidents/" + triple[1], "Base plus span exceeds the supported state bound."))
	# The fixed-step probability must remain a probability at the worst supported exposure.
	var worst = i.base_exposure_per_second * (1 + 100 * i.consistency_factor) * (1 + 100 * i.reliability_factor) * i.push_factor * (1 + i.water_factor + i.low_tread_reference * i.low_tread_factor) * i.assertive_factor * i.volatile_factor * 0.05
	if worst > 1.0:
		errors.append(_error("incidents/base_exposure_per_second", "Combined maximum exposure exceeds one event per fixed step."))
	return errors

static func _error(field: String, message: String) -> Dictionary:
	return ContentValidation.diagnostic("CONTENT_OPERATIONS", "/operations/" + field, message)
