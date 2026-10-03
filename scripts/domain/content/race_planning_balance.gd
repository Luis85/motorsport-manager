class_name RacePlanningBalance
extends RefCounted
## Frozen pre-extraction coefficients; authored records must supply each complete group.
## Tuple: original value, legal minimum, legal maximum, unit and existing consumer meaning.
const TABLES = {
	"practice":
	{
		"release_offset_seconds":
		[4.0, 0, 120, "seconds: Initial autonomous practice release delay."],
		"release_spacing_seconds":
		[9.0, 0, 60, "seconds/entry: Autonomous practice release spacing."],
		"autonomous_laps": [2, 1, 4, "laps: Requested measured laps in the autonomous run."],
		"default_laps": [2, 1, 4, "laps: Preview choice when a request omits measured laps."],
		"default_pace": [1, 0, 2, "mode index: Ordinary practice pace."],
		"default_engine": [1, 0, 2, "mode index: Ordinary practice engine mode."],
		"qualifying_pace": [2, 0, 2, "mode index: Qualifying-preparation practice pace."],
		"qualifying_engine": [2, 0, 2, "mode index: Qualifying-preparation practice engine mode."],
		"run_transit_factor":
		[0.7, 0.1, 1, "multiplier: Coarse practice run-duration speed factor."],
		"run_return_allowance_seconds":
		[12.0, 0, 120, "seconds: Practice preview return allowance."],
		"fuel_return_reserve_laps": [1.1, 0, 10, "fuel-laps: Practice physical-return threshold."],
		"sample_water_tolerance":
		[0.1, 0, 1, "fraction: Largest water change for a clean measured lap."],
		"sample_damage_tolerance":
		[0.001, 0, 10, "damage points: Largest damage change for a clean measured lap."],
		"matching_water_tolerance":
		[0.1, 0, 1, "fraction: Water tolerance for matching prior observations."],
		"matching_health_tolerance":
		[12.0, 0, 100, "health points: Health tolerance for matching prior observations."],
		"matching_damage_tolerance":
		[3.0, 0, 1000, "damage points: Damage tolerance for matching prior observations."],
		"prior_sample_weight":
		[4.0, 0.01, 100, "samples: Baseline weight in the bounded measured blend."],
		"prior_minimum_wear_factor": [0.5, 0.1, 1, "multiplier: Minimum measured wear adjustment."],
		"prior_maximum_wear_factor": [2.5, 1, 5, "multiplier: Maximum measured wear adjustment."],
		"prior_minimum_lap_factor":
		[0.9, 0.5, 1, "multiplier: Minimum measured lap-time adjustment."],
		"prior_maximum_lap_factor":
		[1.2, 1, 2, "multiplier: Maximum measured lap-time adjustment."],
		"prior_reliable_samples": [3, 1, 12, "samples: Count for the narrower uncertainty floor."],
		"prior_reliable_uncertainty":
		[0.045, 0, 0.5, "fraction: Uncertainty floor with enough matching samples."],
		"prior_base_uncertainty":
		[0.06, 0, 0.5, "fraction: Uncertainty floor with few matching samples."],
		"prior_spread_allowance":
		[0.025, 0, 0.5, "fraction: Additional uncertainty beyond observed spread."],
		"clean_traffic_distance_m":
		[25.0, 0, 200, "metres: Traffic exclusion distance for clean evidence."],
		"clean_traffic_headway_seconds":
		[1.5, 0, 10, "seconds: Traffic exclusion headway for clean evidence."],
	},
	"strategy_defaults":
	{
		"balanced_stop_fraction": [0.46, 0, 1, "race fraction: Suggested balanced-template stop."],
		"extended_stop_fraction":
		[0.62, 0, 1, "race fraction: Suggested alternative-template stop."],
		"tyre_reserve": [22.0, 5, 50, "tread percent: Default approved-plan reserve."],
		"fuel_reserve_laps":
		[0.35, 0, 3, "fuel-laps: Default approved strategy and tactic reserve."],
	},
	"tactical_policy":
	{
		"initial_stop_fraction":
		[0.4, 0, 1, "race fraction: Initial pre-race tactical stop suggestion."],
		"extend_window_laps": [3, 2, 10, "laps: Suggested extend-tactic window width."],
		"undercut_window_laps": [1, 0, 10, "laps: Suggested undercut-tactic window width."],
		"wait_laps": [2, 1, 2, "laps: Suggested extension within the existing two-entry contract."],
		"tyre_floor": [15.0, 5, 50, "tread percent: Default dry-tactic resource floor."],
		"maximum_water":
		[0.15, 0, 1, "fraction: Highest observed water inside the dry tactical envelope."],
		"review_seconds":
		[1.0, 0.05, 1, "seconds: Tactical review interval inside the saved-state bound."],
		"queue_seconds":
		[1.0, 0, 30, "seconds: Maximum queue before an avoid-traffic tactic waits."],
	},
	"forecast":
	{
		"maximum_age_seconds":
		[5.0, 0.05, 5, "seconds: Advice age inside the existing five-second command bound."],
		"traffic_seconds_per_car":
		[0.8, 0, 10, "seconds/car: Ordinary and tactical traffic allowance."],
		"base_uncertainty":
		[0.06, 0, 0.5, "fraction: Baseline ordinary remaining-time uncertainty."],
		"minimum_uncertainty_seconds":
		[3.0, 0, 120, "seconds: Minimum ordinary remaining-time uncertainty."],
		"high_risk_tread": [10.0, 0, 100, "tread percent: High remaining-stint risk threshold."],
		"moderate_risk_tread":
		[25.0, 0, 100, "tread percent: Moderate remaining-stint risk threshold."],
		"rejoin_traffic_behind_m":
		[30.0, 0, 200, "metres: Projected traffic behind a rejoin station."],
		"rejoin_traffic_ahead_seconds":
		[2.5, 0, 10, "seconds: Projected traffic ahead of a rejoin station."],
		"minimum_lap_speed_factor":
		[0.2, 0.05, 1, "multiplier: Lower coarse lap-speed divisor clamp."],
		"damage_limit": [200.0, 0, 200, "damage points: Coarse forecast damage input cap."],
		"measured_wear_minimum_laps":
		[0.5, 0.05, 10, "laps: Minimum distance before observed stint wear is used."],
		"measured_wear_minimum_factor":
		[0.5, 0.1, 1, "multiplier: Minimum observed-race wear adjustment."],
		"measured_wear_maximum_factor":
		[2.5, 1, 5, "multiplier: Maximum observed-race wear adjustment."],
		"observed_lap_samples":
		[
			3,
			1,
			3,
			"samples: Public rival-lap averaging within its original three-sample work bound."
		],
		"extend_laps": [2, 1, 10, "laps: Ordinary extension-comparison horizon."],
		"repair_payback_minimum_gain_seconds":
		[0.01, 1e-05, 10, "seconds/lap: Smallest repair gain displayed as payback."],
		"performance_top_weight": [0.3, 0, 1, "fraction: Coarse top-speed capability weight."],
		"performance_accel_weight": [0.2, 0, 1, "fraction: Coarse acceleration capability weight."],
		"performance_lat_weight": [0.35, 0, 1, "fraction: Coarse lateral capability weight."],
		"performance_brake_weight": [0.15, 0, 1, "fraction: Coarse braking capability weight."],
		"minimum_performance_factor":
		[0.85, 0.1, 1, "multiplier: Minimum coarse profile capability divisor."],
	},
}


static func defaults() -> Dictionary:
	var result: Dictionary = {}
	for group in TABLES:
		var values: Dictionary = {}
		for field in TABLES[group]:
			values[field] = TABLES[group][field][0]
		result[group] = values
	return result


static func fields() -> Dictionary:
	var result: Dictionary = {}
	for group in TABLES:
		var properties: Dictionary = {}
		for field in TABLES[group]:
			var spec: Array = TABLES[group][field]
			var schema = (
				ContentSchema.integer(spec[1], spec[2])
				if spec[0] is int
				else ContentSchema.number(spec[1], spec[2])
			)
			schema.description = spec[3]
			properties[field] = schema
		result[group] = ContentSchema.object(properties)
	return result


static func semantic_errors(record: Dictionary) -> Array:
	var errors: Array = []
	for entry in [
		["practice", "prior_minimum_wear_factor", "prior_maximum_wear_factor"],
		["practice", "prior_minimum_lap_factor", "prior_maximum_lap_factor"],
		["practice", "prior_reliable_uncertainty", "prior_base_uncertainty"],
		["forecast", "high_risk_tread", "moderate_risk_tread"],
		["forecast", "measured_wear_minimum_factor", "measured_wear_maximum_factor"],
		["strategy_defaults", "balanced_stop_fraction", "extended_stop_fraction"],
		["tactical_policy", "wait_laps", "extend_window_laps"]
	]:
		if record[entry[0]][entry[1]] > record[entry[0]][entry[2]]:
			errors.append(_error(entry[0] + "/" + entry[2], "Must not be below " + entry[1] + "."))
	var forecast: Dictionary = record.forecast
	var weight = (
		forecast.performance_top_weight
		+ forecast.performance_accel_weight
		+ forecast.performance_lat_weight
		+ forecast.performance_brake_weight
	)
	if absf(weight - 1.0) > 0.0000001:
		errors.append(
			_error("forecast/performance_top_weight", "Capability weights must sum to one.")
		)
	return errors


static func _error(field: String, message: String) -> Dictionary:
	return ContentValidation.diagnostic("CONTENT_BALANCE", "/balance/" + field, message)
