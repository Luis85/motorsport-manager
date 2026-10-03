class_name EnvironmentTuningValidation
extends RefCounted
## Cross-field physical environment bounds for authored tuning.


static func semantic_errors(value: Dictionary) -> Array:
	# Schema types/ranges must be checked first. These errors identify the conflicting field.
	var errors: Array = []
	var w: Dictionary = value.weather
	for prefix in ["initial_cloud_changeable", "target_dry", "target_wet", "target_changeable"]:
		if w[prefix + "_base"] + w[prefix + "_span"] > 1:
			_error(errors, "weather/" + prefix + "_span", "Base plus span cannot exceed one.")
	if w.transition_base_seconds + w.transition_span_seconds > 145:
		_error(
			errors,
			"weather/transition_span_seconds",
			"Combined transition time cannot exceed the saved 145-second limit."
		)
	var t: Dictionary = value.training
	if t.wet_ease_seconds > t.wet_dry_seconds or t.wet_eased_rain > t.wet_heavy_rain:
		_error(
			errors,
			"training/wet_ease_seconds",
			"Wet-training easing must precede drying and cannot increase rain."
		)
	if (
		not _ordered(
			[
				t.changeable_light_start,
				t.changeable_heavy_start,
				t.changeable_heavy_end,
				t.changeable_light_end
			]
		)
		or t.changeable_light_rain > t.changeable_heavy_rain
	):
		_error(
			errors,
			"training/changeable_heavy_start",
			(
				"The heavy-training window must be inside the light window, with no "
				+ "smaller rain level."
			)
		)
	_surface_errors(value.surface, errors)
	var o: Dictionary = value.outlook
	if not _ordered([o.condition_dry, o.condition_damp, o.condition_wet]):
		_error(errors, "outlook/condition_dry", "Water-condition boundaries must be ordered.")
	if o.history_seconds <= o.minimum_trend_seconds:
		_error(
			errors, "outlook/history_seconds", "History window must exceed the minimum trend age."
		)
	if (
		o.horizon_minimum_seconds > o.horizon_maximum_seconds
		or o.rain_visible > o.rain_heavy
		or o.trend_threshold > o.maximum_water_slope
	):
		_error(
			errors,
			"outlook/horizon_minimum_seconds",
			"Forecast time bounds, rain bands and slope thresholds must be ordered."
		)
	var maximum_estimate = maxf(
		o.arrival_estimate_minimum_seconds,
		(o.arrival_cloud_reference - o.arrival_cloud_threshold) / o.arrival_cloud_slope
	)
	if (
		o.arrival_cloud_threshold >= o.arrival_cloud_reference
		or o.arrival_low_minimum_seconds > o.arrival_high_minimum_seconds
		or o.arrival_high_minimum_seconds > o.arrival_high_maximum_seconds
		or maximum_estimate * o.arrival_low_factor > o.arrival_high_maximum_seconds
	):
		_error(
			errors,
			"outlook/arrival_high_maximum_seconds",
			"Arrival calibration would permit an inverted time window."
		)
	if value.weather_policy.safe_tread > value.weather_policy.moderate_tread:
		_error(
			errors,
			"weather_policy/safe_tread",
			"High-risk tread must not exceed moderate-risk tread."
		)
	return errors


static func _ordered(values: Array) -> bool:
	for index in range(1, values.size()):
		if values[index] < values[index - 1]:
			return false
	return true


static func _error(errors: Array, field: String, message: String) -> void:
	errors.append(
		ContentValidation.diagnostic("CONTENT_ENVIRONMENT", "/environment/" + field, message)
	)


static func _surface_errors(s: Dictionary, errors: Array) -> void:
	if s.initial.dust_base + 3 * s.initial.dust_per_strip > 1:
		_error(
			errors,
			"surface/initial/dust_per_strip",
			"Initial dust must stay within one on every strip."
		)
	if s.grip.minimum > s.grip.maximum:
		_error(errors, "surface/grip/minimum", "Minimum grip cannot exceed maximum grip.")
	if s.evolution.rain_minimum > s.evolution.rain_maximum:
		_error(errors, "surface/evolution/rain_minimum", "Local rainfall clamps must be ordered.")
	if (
		s.evolution.evaporation_base
		< s.evolution.evaporation_reference_c * s.evolution.evaporation_temperature
	):
		_error(
			errors,
			"surface/evolution/evaporation_base",
			"Evaporation cannot become negative at a supported surface temperature."
		)
	for temperature in [
		s.initial.wet_temperature_c,
		s.initial.dry_temperature_c,
		s.evolution.wet_temperature_c,
		s.evolution.dry_temperature_c
	]:
		if temperature > s.contact.temperature_limit_c:
			_error(
				errors,
				"surface/contact/temperature_limit_c",
				"Contact temperature cap must cover every initial and equilibrium " + "temperature."
			)
			break
