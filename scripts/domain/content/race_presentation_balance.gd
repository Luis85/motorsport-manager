class_name RacePresentationBalance
extends RefCounted
## Observational check-in and current-demand policy; never a performance modifier.
const LEGACY = {
	"low_tread_percent": 25.0,
	"practice_reuse_tread_percent": 40.0,
	"advisory_tread_percent": 15.0,
	"advisory_core_excess_c": 20.0,
	"demand_base": 15.0,
	"demand_calm_base": 7.0,
	"demand_push": 20.0,
	"demand_puncture": 30.0,
	"demand_tread_threshold_percent": 40.0,
	"demand_tread_points": 20.0,
	"demand_damage_max": 20.0,
	"demand_damage_per_percent": 0.6,
	"demand_water_threshold": 0.15,
	"demand_water_points": 15.0,
	"demand_recovery": 15.0,
	"demand_traffic_distance_m": 70.0,
	"demand_traffic_points": 24.0,
	"demand_raised": 35.0,
	"demand_high": 65.0,
	"moment_water_raised": 0.15,
	"moment_water_high": 0.45,
	"moment_tread_low_percent": 25.0,
	"moment_tread_critical_percent": 10.0
}


static func defaults() -> Dictionary:
	return {"presentation": LEGACY.duplicate(true)}


static func fields() -> Dictionary:
	var properties = {}
	for key in LEGACY:
		properties[key] = ContentSchema.number(0, 100)
	for key in ["demand_water_threshold", "moment_water_raised", "moment_water_high"]:
		properties[key] = ContentSchema.number(0, 1)
	properties.demand_tread_threshold_percent = ContentSchema.number(0.1, 100)
	properties.demand_damage_per_percent = ContentSchema.number(0, 10)
	properties.demand_traffic_distance_m = ContentSchema.number(1, 1000)
	return {"presentation": ContentSchema.object(properties)}


static func semantic_errors(record: Dictionary) -> Array:
	var errors: Array = []
	var value: Dictionary = record.presentation
	if value.demand_high < value.demand_raised:
		errors.append("Presentation high demand must not be below raised demand.")
	if value.moment_water_high < value.moment_water_raised:
		errors.append("Presentation high water band must not be below raised water.")
	if value.moment_tread_critical_percent > value.moment_tread_low_percent:
		errors.append("Presentation critical tread must not exceed low tread.")
	return errors
