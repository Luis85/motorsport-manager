class_name RacePhysicsBalance
extends RefCounted
## Supported physical balance inputs. Tick, RNG, geometry sampling and safety floors remain code.
const VALUES = {
	"tyre_incidents":
	{
		"puncture_tread_threshold": 8.0,
		"guaranteed_puncture_tread": 0.5,
		"puncture_probability_per_tread": 0.004,
		"lockup_braking_threshold": 0.75,
		"lockup_core_threshold_c": 68.0,
		"lockup_probability": 0.01,
		"assertive_lockup_factor": 1.12,
		"lockup_damage": 4.0,
		"check_interval_seconds": 2.0
	},
	"procedure":
	{
		"lights_seconds": 6.0,
		"grid_lane_hold_seconds": 3.0,
		"formation_braking_mps2": 6.0,
		"garage_turnaround_seconds": 18.0,
		"qualifying_maximum_runs": 2,
		"qualifying_release_transit_seconds": 3.0,
		"qualifying_outlap_speed_factor": 0.76,
		"qualifying_release_margin_seconds": 5.0,
		"unavailable_set_retry_seconds": 60.0,
		"autonomous_review_seconds": 1.5
	},
	"courtesy":
	{
		"clear_ahead_distance_m": 18.0,
		"release_behind_distance_m": 220.0,
		"acquire_distance_m": 150.0,
		"immediate_distance_m": 45.0,
		"timeout_seconds": 20.0,
		"lapped_distance_fraction": 0.65,
		"minimum_closing_mps": -0.5,
		"arrival_seconds": 7.0
	},
	"pit_motion":
	{
		"acceleration_mps2": 5.0,
		"braking_mps2": 8.0,
		"entry_braking_factor": 0.5,
		"entry_braking_margin_m": 8.0,
		"exit_headway_seconds": 1.2,
		"exit_approach_distance_m": 15.0,
		"exit_ahead_distance_m": 8.0
	},
	"motion":
	{
		"minimum_grip": 0.16,
		"maximum_grip": 1.1,
		"corner_blend_curvature_scale": 100.0,
		"minimum_acceleration_mps2": 1.0,
		"minimum_braking_mps2": 2.0,
		"minimum_lateral_mps2": 3.0,
		"braking_anticipation_m": 25.0,
		"pit_approach_margin_m": 5.0,
		"formation_lane_distance_m": 100.0
	}
}
const LIMITS = {
	"tyre_incidents":
	{
		"puncture_tread_threshold":
		[0, 100, "tread percent: Below this life puncture exposure is checked."],
		"guaranteed_puncture_tread":
		[0, 100, "tread percent: Life at or below this value punctures without a random draw."],
		"puncture_probability_per_tread":
		[0, 1, "probability/tread point/check: Hazard below the tread threshold."],
		"lockup_braking_threshold":
		[0, 1, "fraction: Required braking demand for a cold lock-up check."],
		"lockup_core_threshold_c":
		[0, 200, "Celsius: Maximum average core temperature for a cold lock-up check."],
		"lockup_probability": [0, 1, "probability/check: Base cold lock-up probability."],
		"assertive_lockup_factor": [1, 10, "multiplier: Assertive cold lock-up exposure."],
		"lockup_damage":
		[0, 100, "tread points: Flat-spot damage applied by the existing wheel model."],
		"check_interval_seconds": [0.05, 120, "seconds: Physical tyre incident check cadence."]
	},
	"procedure":
	{
		"lights_seconds": [0.05, 60, "seconds: Standing-start lights phase duration."],
		"grid_lane_hold_seconds":
		[0, 60, "seconds: Maintain starting grid lanes after lights out."],
		"formation_braking_mps2": [0.1, 30, "metres/second squared: Formation stopping envelope."],
		"garage_turnaround_seconds":
		[0, 300, "seconds: Garage turnaround before another qualifying release."],
		"qualifying_maximum_runs": [1, 20, "runs: Maximum autonomous qualifying departures."],
		"qualifying_release_transit_seconds":
		[0, 60, "seconds: Coarse qualifying pit transit allowance."],
		"qualifying_outlap_speed_factor":
		[0.1, 1, "multiplier: Coarse qualifying outlap speed for release feasibility."],
		"qualifying_release_margin_seconds":
		[0, 120, "seconds: Required qualifying release forecast margin."],
		"unavailable_set_retry_seconds":
		[0.05, 300, "seconds: Delay before retrying a departure without a usable set."],
		"autonomous_review_seconds":
		[0.05, 120, "seconds: Classic engineer review and spare-tyre cooling cadence."]
	},
	"courtesy":
	{
		"clear_ahead_distance_m":
		[0, 200, "metres: Release a courtesy target after it clears ahead."],
		"release_behind_distance_m":
		[1, 1000, "metres: Release a courtesy target that falls this far behind."],
		"acquire_distance_m":
		[1, 1000, "metres: Maximum distance behind for courtesy target acquisition."],
		"immediate_distance_m":
		[0, 1000, "metres: Gap allowing courtesy without a time-to-arrival test."],
		"timeout_seconds": [0.05, 120, "seconds: Maximum duration of a courtesy target."],
		"lapped_distance_fraction":
		[0, 1, "lap fraction: Unwrapped progress advantage indicating a blue-flag priority car."],
		"minimum_closing_mps":
		[-10, 10, "metres/second: Minimum relative speed for acquiring a courtesy target."],
		"arrival_seconds":
		[0.05, 60, "seconds: Maximum estimated arrival time for acquiring a courtesy target."]
	},
	"pit_motion":
	{
		"acceleration_mps2": [0.1, 30, "metres/second squared: Pit-lane acceleration."],
		"braking_mps2":
		[0.1, 30, "metres/second squared: Pit-lane braking and box stopping envelope."],
		"entry_braking_factor":
		[0.01, 1, "multiplier: Effective vehicle braking used to schedule safe pit entry."],
		"entry_braking_margin_m": [0, 100, "metres: Additional pit entry braking allowance."],
		"exit_headway_seconds": [0.1, 10, "seconds: Desired pit exit gap to an approaching car."],
		"exit_approach_distance_m":
		[
			15,
			500,
			"metres: Desired pit exit approach gap; the fifteen-metre safety floor remains code-owned."
		],
		"exit_ahead_distance_m":
		[
			8,
			100,
			"metres: Desired pit exit gap to a car ahead; the eight-metre safety floor remains code-owned."
		]
	},
	"motion":
	{
		"minimum_grip": [0.01, 1.1, "multiplier: Lower modeled grip clamp."],
		"maximum_grip": [0.01, 1.1, "multiplier: Upper modeled grip clamp."],
		"corner_blend_curvature_scale":
		[1, 1000, "metres: Curvature scale blending straight and corner handling."],
		"minimum_acceleration_mps2":
		[0.1, 20, "metres/second squared: Minimum on-track acceleration."],
		"minimum_braking_mps2": [0.1, 30, "metres/second squared: Minimum on-track braking."],
		"minimum_lateral_mps2":
		[0.1, 30, "metres/second squared: Minimum corner braking-envelope lateral acceleration."],
		"braking_anticipation_m": [0, 200, "metres: Additional braking-envelope lookahead."],
		"pit_approach_margin_m": [0, 100, "metres: Pit approach stopping allowance."],
		"formation_lane_distance_m":
		[0, 500, "metres: Distance before the formation endpoint to align in grid lanes."]
	}
}


static func defaults() -> Dictionary:
	return VALUES.duplicate(true)


static func fields() -> Dictionary:
	var result: Dictionary = {}
	for group in LIMITS:
		var properties: Dictionary = {}
		for key in LIMITS[group]:
			var entry: Array = LIMITS[group][key]
			properties[key] = (
				ContentSchema.integer(entry[0], entry[1])
				if key == "qualifying_maximum_runs"
				else ContentSchema.number(entry[0], entry[1])
			)
			properties[key].description = entry[2]
		result[group] = ContentSchema.object(properties)
	return result


static func semantic_errors(record: Dictionary) -> Array:
	var errors: Array = []
	for pair in [
		["tyre_incidents", "guaranteed_puncture_tread", "puncture_tread_threshold"],
		["courtesy", "immediate_distance_m", "acquire_distance_m"],
		["courtesy", "acquire_distance_m", "release_behind_distance_m"],
		["motion", "minimum_grip", "maximum_grip"]
	]:
		if record[pair[0]][pair[1]] > record[pair[0]][pair[2]]:
			errors.append(_error(pair[0] + "/" + pair[2], "Must not be below " + pair[1] + "."))
	var tyres: Dictionary = record.tyre_incidents
	if tyres.puncture_tread_threshold * tyres.puncture_probability_per_tread > 1.0:
		errors.append(
			_error(
				"tyre_incidents/puncture_probability_per_tread",
				"Maximum puncture probability exceeds one."
			)
		)
	if tyres.lockup_probability * tyres.assertive_lockup_factor > 1.0:
		errors.append(
			_error(
				"tyre_incidents/lockup_probability", "Assertive lock-up probability exceeds one."
			)
		)
	return errors


static func _error(field: String, message: String) -> Dictionary:
	return ContentValidation.diagnostic("CONTENT_BALANCE", "/balance/" + field, message)
