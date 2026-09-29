class_name WeatherForecastTuning
extends RefCounted
## Frozen v1 compatibility values and explicit authoring bounds for weather_forecast.
## Runtime consumers receive already validated, read-only parameter tables.
const DEFAULTS = {
	"history_window_seconds": 60.0,
	"minimum_trend_seconds": 15.0,
	"maximum_water_slope": 0.006,
	"horizon_laps": 3.0,
	"minimum_horizon_seconds": 60.0,
	"maximum_horizon_seconds": 240.0,
	"trend_projection_factor": 0.65,
	"maximum_case_spread": 0.5,
	"base_case_spread": 0.12,
	"case_spread_per_second": 0.0012,
	"missing_trend_spread": 0.08,
	"trend_threshold": 0.0003,
	"rain_observed_threshold": 0.08,
	"cloud_trend_threshold": 0.001,
	"cloud_arrival_threshold": 0.3,
	"cloud_arrival_reference": 0.6,
	"arrival_estimate_floor_seconds": 20.0,
	"arrival_low_floor_seconds": 15.0,
	"arrival_low_multiplier": 0.5,
	"arrival_high_cap_seconds": 480.0,
	"arrival_high_floor_seconds": 60.0,
	"arrival_high_multiplier": 2.0,
	"arrival_high_buffer_seconds": 30.0,
	"dry_water_limit": 0.08,
	"damp_water_limit": 0.24,
	"wet_water_limit": 0.68,
	"slick_warning_water": 0.3,
	"wet_tyre_warning_water": 0.15,
	"arrival_warning_water": 0.24,
	"delegate_tyre_floor": 18.0,
	"delegate_damage_ceiling": 24.0,
	"delegate_dry_water": 0.1,
	"review_interval_seconds": 15.0,
	"minimum_robust_gain_seconds": 2.0,
	"minimum_nominal_gain_seconds": 4.0,
	"nominal_pit_gain_ratio": 0.25,
	"maximum_downside_pit_ratio": 0.5,
	"traffic_cost_seconds": 0.8,
	"sector_contrast_factor": 0.5,
	"comparison_uncertainty_seconds": 3.0,
	"critical_life_percent": 10.0,
	"moderate_life_percent": 25.0
}

static func schema() -> Dictionary:
	return ContentSchema.object({
		"history_window_seconds": ContentSchema.number(2, 600),
		"minimum_trend_seconds": ContentSchema.number(1, 300),
		"maximum_water_slope": ContentSchema.number(1e-05, 0.1),
		"horizon_laps": ContentSchema.number(0.1, 10),
		"minimum_horizon_seconds": ContentSchema.number(1, 600),
		"maximum_horizon_seconds": ContentSchema.number(2, 1200),
		"trend_projection_factor": ContentSchema.number(0, 2),
		"maximum_case_spread": ContentSchema.number(0.01, 1),
		"base_case_spread": ContentSchema.number(0, 1),
		"case_spread_per_second": ContentSchema.number(0, 0.02),
		"missing_trend_spread": ContentSchema.number(0, 1),
		"trend_threshold": ContentSchema.number(0, 0.1),
		"rain_observed_threshold": ContentSchema.number(0.001, 0.5),
		"cloud_trend_threshold": ContentSchema.number(1e-05, 0.1),
		"cloud_arrival_threshold": ContentSchema.number(0, 1),
		"cloud_arrival_reference": ContentSchema.number(0, 1),
		"arrival_estimate_floor_seconds": ContentSchema.number(1, 120),
		"arrival_low_floor_seconds": ContentSchema.number(0, 120),
		"arrival_low_multiplier": ContentSchema.number(0.01, 1),
		"arrival_high_cap_seconds": ContentSchema.number(120, 3600),
		"arrival_high_floor_seconds": ContentSchema.number(1, 600),
		"arrival_high_multiplier": ContentSchema.number(1, 5),
		"arrival_high_buffer_seconds": ContentSchema.number(0, 300),
		"dry_water_limit": ContentSchema.number(0, 1),
		"damp_water_limit": ContentSchema.number(0, 1),
		"wet_water_limit": ContentSchema.number(0, 1),
		"slick_warning_water": ContentSchema.number(0, 1),
		"wet_tyre_warning_water": ContentSchema.number(0, 1),
		"arrival_warning_water": ContentSchema.number(0, 1),
		"delegate_tyre_floor": ContentSchema.number(0, 100),
		"delegate_damage_ceiling": ContentSchema.number(0, 1000),
		"delegate_dry_water": ContentSchema.number(0, 1),
		"review_interval_seconds": ContentSchema.number(1, 120),
		"minimum_robust_gain_seconds": ContentSchema.number(0, 60),
		"minimum_nominal_gain_seconds": ContentSchema.number(0, 60),
		"nominal_pit_gain_ratio": ContentSchema.number(0, 2),
		"maximum_downside_pit_ratio": ContentSchema.number(0, 2),
		"traffic_cost_seconds": ContentSchema.number(0, 10),
		"sector_contrast_factor": ContentSchema.number(0, 1),
		"comparison_uncertainty_seconds": ContentSchema.number(0, 60),
		"critical_life_percent": ContentSchema.number(0, 100),
		"moderate_life_percent": ContentSchema.number(0, 100)
	})

static func problem(p: Dictionary) -> Dictionary:
	if p.minimum_trend_seconds >= p.history_window_seconds:
		return issue("/minimum_trend_seconds", "Minimum trend age must be shorter than the observation-history window.")
	if p.minimum_horizon_seconds > p.maximum_horizon_seconds:
		return issue("/maximum_horizon_seconds", "Maximum forecast horizon must be at least its minimum.")
	if p.arrival_low_floor_seconds > p.arrival_high_floor_seconds or p.arrival_high_floor_seconds > p.arrival_high_cap_seconds:
		return issue("/arrival_high_floor_seconds", "Arrival floors and cap must be ordered: low floor <= high floor <= high cap.")
	if p.dry_water_limit > p.damp_water_limit or p.damp_water_limit > p.wet_water_limit:
		return issue("/damp_water_limit", "Condition labels require ordered dry, damp and wet water cutoffs.")
	if p.critical_life_percent > p.moderate_life_percent:
		return issue("/moderate_life_percent", "Moderate tread warning must be at least the critical warning.")
	if p.trend_threshold > p.maximum_water_slope:
		return issue("/trend_threshold", "Trend threshold must fit the supported maximum water slope.")
	return {}

static func coherent(p: Dictionary) -> bool:
	return problem(p).is_empty()

static func issue(field: String, message: String) -> Dictionary:
	return ContentValidation.diagnostic("CONTENT_TUNING", field, message)
