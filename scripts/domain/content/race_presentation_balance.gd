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
const DESCRIPTIONS = {
	"low_tread_percent":
	"tread percent: Warn when the limiting fitted wheel is at or below this tread life.",
	"practice_reuse_tread_percent":
	(
		"tread percent: Minimum fitted-set life for practice reuse when its "
		+ "compound is preferred."
	),
	"advisory_tread_percent":
	"tread percent: Report a low-tread advisory below this observed " + "fitted-wheel life.",
	"advisory_core_excess_c":
	"Celsius delta: Report core heat above the fitted compound optimum plus " + "this margin.",
	"demand_base": "points: Starting current-demand score at Normal or Push pace.",
	"demand_calm_base": "points: Starting current-demand score at Calm pace.",
	"demand_push": "points: Added current demand when Push pace is selected.",
	"demand_puncture":
	(
		"points: Added current demand for a fitted puncture instead of the "
		+ "ordinary tread contribution."
	),
	"demand_tread_threshold_percent":
	(
		"tread percent: Below this fitted life, add demand scaled by the "
		+ "proportion of tread lost."
	),
	"demand_tread_points":
	"points: Maximum low-tread demand contribution at zero fitted tread life.",
	"demand_damage_max": "points: Maximum current-demand contribution from observed car damage.",
	"demand_damage_per_percent":
	(
		"points/damage percent: Convert observed car damage into current demand "
		+ "before the damage cap."
	),
	"demand_water_threshold":
	"fraction: Above this local surface-water fraction, include wet-track " + "current demand.",
	"demand_water_points":
	(
		"points: Wet-track demand at a water fraction of one; smaller fractions "
		+ "scale the contribution."
	),
	"demand_recovery":
	(
		"points: Added current demand while the car has observed incident "
		+ "recovery time remaining."
	),
	"demand_traffic_distance_m":
	"metres: Along-route proximity inside which another live track car adds " + "current demand.",
	"demand_traffic_points":
	(
		"points: Maximum traffic demand at zero along-route separation, falling "
		+ "to zero at the distance threshold."
	),
	"demand_raised":
	"points: Current-demand score at or above which the Raised observation band starts.",
	"demand_high":
	"points: Current-demand score at or above which the High observation band starts.",
	"moment_water_raised":
	"fraction: Average observed water at or above which the first wet " + "check-in band starts.",
	"moment_water_high":
	"fraction: Average observed water at or above which the highest wet " + "check-in band starts.",
	"moment_tread_low_percent":
	"tread percent: Fitted tread at or below which the first low-tread " + "check-in band starts.",
	"moment_tread_critical_percent":
	"tread percent: Fitted tread at or below which the critical check-in " + "band starts.",
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
	for key in properties:
		properties[key]["description"] = DESCRIPTIONS[key]
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
