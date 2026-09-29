class_name WeatherTuning
extends RefCounted
## Frozen v1 compatibility values and explicit authoring bounds for weather.
## Runtime consumers receive already validated, read-only parameter tables.
const DEFAULTS = {
	"wet_initial_cloud": 0.94,
	"changeable_initial_cloud": 0.32,
	"changeable_initial_span": 0.3,
	"dry_initial_cloud": 0.18,
	"wet_initial_rain": 0.65,
	"dry_target_base": 0.12,
	"dry_target_span": 0.28,
	"wet_target_base": 0.28,
	"wet_target_span": 0.72,
	"changeable_target_base": 0.05,
	"changeable_target_span": 0.95,
	"target_base_seconds": 45.0,
	"target_jitter_seconds": 100.0,
	"cloud_response_per_second": 0.005,
	"rain_cloud_threshold": 0.52,
	"rain_cloud_gain": 2.5,
	"rain_response_per_second": 0.008,
	"observation_interval_seconds": 10.0,
	"wet_initial_water": 0.6,
	"dry_initial_water": 0.0,
	"initial_rubber": 0.12,
	"training_wet_rain": 0.65,
	"training_easing_rain": 0.18,
	"training_ease_at_seconds": 170.0,
	"training_dry_at_seconds": 280.0,
	"training_minimum_race_seconds": 120.0,
	"training_light_rain": 0.2,
	"training_heavy_rain": 0.8,
	"training_light_from": 0.25,
	"training_heavy_from": 0.32,
	"training_heavy_to": 0.61,
	"training_light_to": 0.7
}

static func schema() -> Dictionary:
	return ContentSchema.object({
		"wet_initial_cloud": ContentSchema.number(0, 1),
		"changeable_initial_cloud": ContentSchema.number(0, 1),
		"changeable_initial_span": ContentSchema.number(0, 1),
		"dry_initial_cloud": ContentSchema.number(0, 1),
		"wet_initial_rain": ContentSchema.number(0, 1),
		"dry_target_base": ContentSchema.number(0, 1),
		"dry_target_span": ContentSchema.number(0, 1),
		"wet_target_base": ContentSchema.number(0, 1),
		"wet_target_span": ContentSchema.number(0, 1),
		"changeable_target_base": ContentSchema.number(0, 1),
		"changeable_target_span": ContentSchema.number(0, 1),
		"target_base_seconds": ContentSchema.number(5, 500),
		"target_jitter_seconds": ContentSchema.number(0, 500),
		"cloud_response_per_second": ContentSchema.number(0, 1),
		"rain_cloud_threshold": ContentSchema.number(0, 1),
		"rain_cloud_gain": ContentSchema.number(0.01, 10),
		"rain_response_per_second": ContentSchema.number(0, 1),
		"observation_interval_seconds": ContentSchema.number(1, 60),
		"wet_initial_water": ContentSchema.number(0, 1),
		"dry_initial_water": ContentSchema.number(0, 1),
		"initial_rubber": ContentSchema.number(0, 1),
		"training_wet_rain": ContentSchema.number(0, 1),
		"training_easing_rain": ContentSchema.number(0, 1),
		"training_ease_at_seconds": ContentSchema.number(0, 3600),
		"training_dry_at_seconds": ContentSchema.number(0, 7200),
		"training_minimum_race_seconds": ContentSchema.number(1, 3600),
		"training_light_rain": ContentSchema.number(0, 1),
		"training_heavy_rain": ContentSchema.number(0, 1),
		"training_light_from": ContentSchema.number(0, 1),
		"training_heavy_from": ContentSchema.number(0, 1),
		"training_heavy_to": ContentSchema.number(0, 1),
		"training_light_to": ContentSchema.number(0, 1)
	})

static func problem(p: Dictionary) -> Dictionary:
	if p.changeable_initial_cloud + p.changeable_initial_span > 1:
		return issue("/changeable_initial_span", "Initial cloud base plus span must not exceed 1.")
	for prefix in ["dry", "wet", "changeable"]:
		if p[prefix + "_target_base"] + p[prefix + "_target_span"] > 1:
			return issue("/" + prefix + "_target_span", "Cloud target base plus span must not exceed 1.")
	if p.target_base_seconds + p.target_jitter_seconds > 600:
		return issue("/target_jitter_seconds", "Transition base plus jitter must fit the 600-second state bound.")
	if p.training_ease_at_seconds > p.training_dry_at_seconds:
		return issue("/training_dry_at_seconds", "Drying must not begin before the rain-easing boundary.")
	if p.training_easing_rain > p.training_wet_rain or p.training_light_rain > p.training_heavy_rain:
		return issue("/training_easing_rain", "Easing/light rain must not exceed the corresponding wet/heavy intensity.")
	if not (p.training_light_from <= p.training_heavy_from and p.training_heavy_from < p.training_heavy_to and p.training_heavy_to <= p.training_light_to):
		return issue("/training_heavy_from", "Place the ordered heavy-rain interval inside the light-rain interval.")
	return {}

static func coherent(p: Dictionary) -> bool:
	return problem(p).is_empty()

static func issue(field: String, message: String) -> Dictionary:
	return ContentValidation.diagnostic("CONTENT_TUNING", field, message)
