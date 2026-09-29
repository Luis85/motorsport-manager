class_name EnvironmentTuningSchema
extends RefCounted
## Supported parameter vocabulary, ranges and units; projected into the authoring schema.
const LIMITS = {
	"weather": {
		"initial_cloud_dry": [0, 1, "fraction: Initial observed cloud in a dry session."],
		"initial_cloud_wet": [0, 1, "fraction: Initial observed cloud in a wet session."],
		"initial_cloud_changeable_base": [0, 1, "fraction: Base initial cloud in changeable sessions."],
		"initial_cloud_changeable_span": [0, 1, "fraction: Uniform initial-cloud jitter; a draw is retained when zero."],
		"initial_rain_wet": [0, 1, "fraction: Initial rainfall in a wet seeded session; dry/changeable start at zero."],
		"target_dry_base": [0, 1, "fraction: Base cloud target for dry sessions; dry rainfall stays zero."],
		"target_dry_span": [0, 1, "fraction: Uniform dry target jitter."],
		"target_wet_base": [0, 1, "fraction: Base wet cloud target."],
		"target_wet_span": [0, 1, "fraction: Uniform wet target jitter."],
		"target_changeable_base": [0, 1, "fraction: Base changeable cloud target."],
		"target_changeable_span": [0, 1, "fraction: Uniform changeable target jitter."],
		"transition_base_seconds": [1, 145, "seconds: Minimum time between cloud-target choices."],
		"transition_span_seconds": [0, 144, "seconds: Uniform transition-duration jitter; base plus span cannot exceed 145."],
		"cloud_response_per_second": [1e-05, 0.2, "fraction/second: Maximum cloud movement toward the hidden target."],
		"rain_cloud_threshold": [0, 0.99, "fraction: Cloud level above which rain is generated."],
		"rain_cloud_gain": [0.01, 20, "multiplier: Gain applied above the cloud threshold, before clamping rainfall to [0,1]."],
		"rain_response_per_second": [1e-05, 0.2, "fraction/second: Maximum rainfall movement per simulated second."]
	},
	"training": {
		"wet_heavy_rain": [0, 1, "fraction: Rainfall before the wet-training easing boundary."],
		"wet_eased_rain": [0, 1, "fraction: Rainfall between wet-training easing and dry boundaries."],
		"wet_ease_seconds": [0, 3600, "race seconds: Wet-training easing boundary; non-race phases retain heavy rain."],
		"wet_dry_seconds": [0, 7200, "race seconds: Wet-training dry boundary, not earlier than easing."],
		"changeable_light_rain": [0, 1, "fraction: Light rainfall inside the outer changeable-training window."],
		"changeable_heavy_rain": [0, 1, "fraction: Heavy rainfall inside the inner changeable-training window."],
		"changeable_light_start": [0, 1, "race-duration fraction: Exclusive outer-window start."],
		"changeable_heavy_start": [0, 1, "race-duration fraction: Exclusive inner-window start."],
		"changeable_heavy_end": [0, 1, "race-duration fraction: Exclusive inner-window end."],
		"changeable_light_end": [0, 1, "race-duration fraction: Exclusive outer-window end."],
		"minimum_race_seconds": [1, 1200, "seconds: Lower bound on the reference duration used to scale training windows."]
	},
	"surface": {
		"initial": {
			"dry_water": [0, 1, "fraction: Initial line water for dry and changeable sessions."],
			"wet_water": [0, 1, "fraction: Initial line water for wet sessions."],
			"rubber": [0, 1, "fraction: Initial rubber on each strip."],
			"dust_base": [0, 1, "fraction: Initial centre-strip dust."],
			"dust_per_strip": [0, 0.33, "fraction/strip: Dust added for each strip away from the centre; total must fit [0,1]."],
			"marbles": [0, 1, "fraction: Initial rubber debris on every strip."],
			"wet_threshold": [0, 1, "fraction: Initial water threshold for choosing wet temperature."],
			"wet_temperature_c": [0, 80, "Celsius: Initial wet surface temperature."],
			"dry_temperature_c": [0, 80, "Celsius: Initial dry surface temperature."]
		},
		"grip": {
			"base": [0.3, 1.3, "multiplier: Clean-surface grip before rubber, water and contamination."],
			"rubber_gain": [0, 0.5, "multiplier: Dry rubber gain; reduced quadratically by water."],
			"wet_rubber_threshold": [0, 1, "fraction: Water threshold for rubber becoming a grip penalty."],
			"wet_rubber_loss": [0, 0.5, "multiplier: Wet-rubber grip penalty."],
			"dust_loss": [0, 1, "multiplier: Dust grip penalty."],
			"marbles_loss": [0, 1, "multiplier: Rubber-debris grip penalty."],
			"debris_loss": [0, 1, "multiplier: Incident-debris grip penalty."],
			"oil_loss": [0, 1, "multiplier: Oil grip penalty."],
			"water_linear_loss": [0, 1, "multiplier: Linear standing-water grip penalty."],
			"water_squared_loss": [0, 1, "multiplier: Quadratic standing-water grip penalty."],
			"minimum": [0.05, 1, "multiplier: Minimum effective surface grip."],
			"maximum": [0.5, 1.5, "multiplier: Maximum grip and normalization of the grip overlay."]
		},
		"runoff": {
			"diffusion_per_second": [0, 1, "per second: Pairwise water diffusion rate."],
			"camber_factor": [0, 2, "multiplier: Camber contribution to lateral runoff."],
			"advection_per_second": [0, 1, "per second: Slope-driven lateral water movement; conservative exchange is still bounded by code."]
		},
		"evolution": {
			"rain_base": [0, 2, "multiplier: Base local rainfall modulation."],
			"rain_amplitude": [0, 1, "multiplier: Sinusoidal spatial rainfall amplitude."],
			"rain_station_radians": [0, 1, "radians/station: Spatial rainfall modulation frequency."],
			"rain_time_radians": [0, 0.1, "radians/second: Time frequency of rainfall modulation."],
			"rain_minimum": [0, 2, "multiplier: Lower clamp for local rainfall modulation."],
			"rain_maximum": [0, 2, "multiplier: Upper clamp for local rainfall modulation."],
			"drainage_minimum": [0.01, 1, "multiplier: Minimum local drainage capability."],
			"drainage_camber": [0, 5, "multiplier: Signed camber contribution to longitudinal drainage."],
			"evaporation_base": [0, 0.02, "fraction/second: Evaporation at the reference temperature."],
			"evaporation_reference_c": [0, 60, "Celsius: Reference temperature for evaporation."],
			"evaporation_temperature": [0, 0.0002, "fraction/second/Celsius: Temperature-dependent evaporation; total cannot become negative at 0 C."],
			"water_arrival": [0, 0.1, "fraction/second: Rain-driven water accumulation coefficient."],
			"water_drainage": [0, 0.1, "fraction/second: Local drainage coefficient."],
			"water_drainage_base": [0, 1, "multiplier: Base drainage in addition to square-root water depth."],
			"rain_threshold": [0, 1, "fraction: Local rain threshold for reduced evaporation and wet temperature target."],
			"wet_evaporation": [0, 1, "multiplier: Evaporation multiplier above the rain threshold."],
			"rain_rubber_wash": [0, 0.1, "per second: Rain-driven rubber wash."],
			"water_rubber_wash": [0, 0.1, "per second: Standing-water rubber wash."],
			"dust_wash": [0, 0.1, "fraction/second: Rain-driven dust removal."],
			"marbles_wash": [0, 0.1, "fraction/second: Rain-driven rubber-debris removal."],
			"oil_wash": [0, 0.1, "fraction/second: Rain-driven oil removal."],
			"oil_decay": [0, 0.1, "fraction/second: Oil decay without rain."],
			"debris_decay": [0, 0.1, "fraction/second: Incident-debris removal."],
			"wet_temperature_c": [0, 80, "Celsius: Wet surface temperature target."],
			"dry_temperature_c": [0, 80, "Celsius: Dry surface temperature target."],
			"temperature_response": [1e-05, 1, "per second: Surface temperature interpolation response."]
		},
		"contact": {
			"width_strips": [0.1, 3, "strips: Gaussian contact footprint width; grid resolution remains code-owned."],
			"rubber_deposit": [0, 0.1, "fraction/normalized distance: Rubber deposited by passage, reduced quadratically by water."],
			"wet_water_clearance": [0, 0.2, "fraction/normalized distance: Water displaced by a wet-family tyre."],
			"dry_water_clearance": [0, 0.2, "fraction/normalized distance: Water displaced by a dry-family tyre."],
			"dust_clearance": [0, 0.2, "fraction/normalized distance: Dust displaced by contact."],
			"marbles_clearance": [0, 0.2, "fraction/normalized distance: Rubber debris cleared by contact."],
			"temperature_limit_c": [0, 100, "Celsius: Contact-heating ceiling; must cover initial and environment target temperatures."],
			"temperature_gain_c": [0, 2, "Celsius/normalized distance: Contact heating without braking."],
			"braking_temperature_c": [0, 2, "Celsius/normalized distance: Extra contact heating at full braking."],
			"outside_marbles": [0, 0.1, "fraction/normalized distance: Debris deposited on the outside strip."],
			"push_marbles_factor": [1, 3, "multiplier: Outside-debris multiplier at push pace."]
		},
		"incident": {
			"debris": [0, 1, "fraction: Debris deposited by the existing incident paths."],
			"adjacent_debris_factor": [0, 1, "multiplier: Debris deposited on adjacent stations."],
			"oil": [0, 1, "fraction: Oil deposited when the incident qualifies."],
			"oil_health_threshold": [0, 100, "health points: Oil qualification threshold for incident contamination."]
		}
	},
	"outlook": {
		"condition_dry": [0, 1, "fraction: Dry/damp line-water label boundary."],
		"condition_damp": [0, 1, "fraction: Damp/wet line-water label boundary."],
		"condition_wet": [0, 1, "fraction: Wet/very-wet line-water label boundary."],
		"history_seconds": [20, 600, "seconds: Public observation window for a trend anchor."],
		"minimum_trend_seconds": [10, 300, "seconds: Minimum age of public trend evidence."],
		"maximum_water_slope": [1e-05, 0.1, "fraction/second: Clamp for observed water slope."],
		"horizon_laps": [0.25, 6, "reference laps: Forecast horizon before applying time bounds."],
		"horizon_minimum_seconds": [10, 240, "seconds: Shortest forecast horizon."],
		"horizon_maximum_seconds": [10, 480, "seconds: Longest forecast horizon."],
		"trend_gain": [0, 2, "multiplier: Extrapolation weight for measured water trend."],
		"spread_maximum": [0, 1, "fraction: Maximum uncalibrated stress-case spread."],
		"spread_base": [0, 1, "fraction: Base stress-case spread."],
		"spread_per_second": [0, 0.01, "fraction/second: Horizon contribution to the spread."],
		"spread_without_history": [0, 1, "fraction: Extra spread when evidence is insufficient."],
		"trend_threshold": [0, 0.1, "fraction/second: Minimum slope magnitude for a wetting/drying label."],
		"rain_visible": [0, 1, "fraction: Observed-rain threshold shared by public messaging and weather policy."],
		"rain_heavy": [0, 1, "fraction: Heavy-rain message threshold."],
		"arrival_cloud_slope": [0.0001, 0.1, "fraction/second: Minimum observed cloud growth for an arrival estimate."],
		"arrival_cloud_threshold": [0, 1, "fraction: Minimum observed cloud level for an arrival estimate."],
		"arrival_cloud_reference": [0, 1, "fraction: Public extrapolation reference, not the hidden weather target."],
		"arrival_estimate_minimum_seconds": [1, 120, "seconds: Minimum nominal arrival estimate."],
		"arrival_low_minimum_seconds": [1, 120, "seconds: Minimum lower arrival window endpoint."],
		"arrival_high_minimum_seconds": [1, 480, "seconds: Minimum upper arrival window endpoint."],
		"arrival_high_maximum_seconds": [1, 600, "seconds: Upper arrival-window cap."],
		"arrival_low_factor": [0.1, 1, "multiplier: Lower-window factor applied to the estimate."],
		"arrival_high_factor": [1, 4, "multiplier: Upper-window factor applied to the estimate."],
		"arrival_high_margin_seconds": [0, 120, "seconds: Extra margin for the upper arrival estimate."]
	},
	"weather_policy": {
		"slick_warning_water": [0, 1, "fraction: Warn a slick-tyre runner above this peak line water."],
		"wet_warning_water": [0, 1, "fraction: Warn a wet-tyre runner below this mean line water."],
		"rain_warning_water": [0, 1, "fraction: Rain-arrival notice is relevant below this mean water."],
		"fallback_tread": [0, 100, "tread percent: Below this level the existing resource/recovery policy takes precedence."],
		"fallback_damage": [0, 100, "damage points: Above this level existing damage recovery takes precedence."],
		"dry_fallback_water": [0, 1, "fraction: Dry-weather ordinary strategy threshold."],
		"review_seconds": [1, 15, "seconds: Base delegated-weather review interval; four-way staggering is code-owned."],
		"minimum_case_gain_seconds": [0, 30, "seconds: Robust case gain sufficient to consider a discretionary stop."],
		"nominal_gain_seconds": [0, 60, "seconds: Minimum nominal gain for the less-conservative alternative criterion."],
		"nominal_pit_loss_factor": [0, 2, "multiplier: Nominal gain required relative to modeled pit loss."],
		"maximum_case_loss_factor": [0, 1, "multiplier: Maximum accepted worst-case loss relative to pit loss."],
		"safe_tread": [0, 100, "tread percent: High-risk threshold used for set comparison and crossover evaluation."],
		"moderate_tread": [0, 100, "tread percent: Moderate-risk threshold in crossover evaluation."],
		"traffic_seconds_per_car": [0, 10, "seconds/car: Coarse public-traffic allowance in crossover scoring."],
		"wettest_sector_factor": [0, 1, "multiplier: Observed wettest-sector contrast retained by the coarse model."],
		"model_allowance_seconds": [0, 30, "seconds: Uncalibrated model allowance around case outcomes and gains."]
	}
}

static func definition() -> Dictionary:
	var properties = {"model": {"enum": ["weather-surface-v1"]}}
	for group in LIMITS:
		properties[group] = _object(LIMITS[group])
	return ContentSchema.object(properties)

static func _object(fields: Dictionary) -> Dictionary:
	var result: Dictionary = {}
	for key in fields:
		if fields[key] is Dictionary:
			result[key] = _object(fields[key])
		else:
			var spec: Array = fields[key]
			result[key] = ContentSchema.number(spec[0], spec[1])
			result[key].description = spec[2]
	return ContentSchema.object(result)

static func semantic_errors(value: Dictionary) -> Array:
	# Schema types/ranges must be checked first. These errors identify the conflicting field.
	var errors: Array = []
	var w: Dictionary = value.weather
	for prefix in ["initial_cloud_changeable", "target_dry", "target_wet", "target_changeable"]:
		if w[prefix + "_base"] + w[prefix + "_span"] > 1:
			_error(errors, "weather/" + prefix + "_span", "Base plus span cannot exceed one.")
	if w.transition_base_seconds + w.transition_span_seconds > 145:
		_error(errors, "weather/transition_span_seconds", "Combined transition time cannot exceed the saved 145-second limit.")
	var t: Dictionary = value.training
	if t.wet_ease_seconds > t.wet_dry_seconds or t.wet_eased_rain > t.wet_heavy_rain:
		_error(errors, "training/wet_ease_seconds", "Wet-training easing must precede drying and cannot increase rain.")
	if not _ordered([t.changeable_light_start, t.changeable_heavy_start, t.changeable_heavy_end, t.changeable_light_end]) or t.changeable_light_rain > t.changeable_heavy_rain:
		_error(errors, "training/changeable_heavy_start", "The heavy-training window must be inside the light window, with no smaller rain level.")
	var s: Dictionary = value.surface
	if s.initial.dust_base + 3 * s.initial.dust_per_strip > 1:
		_error(errors, "surface/initial/dust_per_strip", "Initial dust must stay within one on every strip.")
	if s.grip.minimum > s.grip.maximum:
		_error(errors, "surface/grip/minimum", "Minimum grip cannot exceed maximum grip.")
	if s.evolution.rain_minimum > s.evolution.rain_maximum:
		_error(errors, "surface/evolution/rain_minimum", "Local rainfall clamps must be ordered.")
	if s.evolution.evaporation_base < s.evolution.evaporation_reference_c * s.evolution.evaporation_temperature:
		_error(errors, "surface/evolution/evaporation_base", "Evaporation cannot become negative at a supported surface temperature.")
	for temperature in [s.initial.wet_temperature_c, s.initial.dry_temperature_c, s.evolution.wet_temperature_c, s.evolution.dry_temperature_c]:
		if temperature > s.contact.temperature_limit_c:
			_error(errors, "surface/contact/temperature_limit_c", "Contact temperature cap must cover every initial and equilibrium temperature.")
			break
	var o: Dictionary = value.outlook
	if not _ordered([o.condition_dry, o.condition_damp, o.condition_wet]):
		_error(errors, "outlook/condition_dry", "Water-condition boundaries must be ordered.")
	if o.history_seconds <= o.minimum_trend_seconds:
		_error(errors, "outlook/history_seconds", "History window must exceed the minimum trend age.")
	if o.horizon_minimum_seconds > o.horizon_maximum_seconds or o.rain_visible > o.rain_heavy or o.trend_threshold > o.maximum_water_slope:
		_error(errors, "outlook/horizon_minimum_seconds", "Forecast time bounds, rain bands and slope thresholds must be ordered.")
	var maximum_estimate = maxf(o.arrival_estimate_minimum_seconds, (o.arrival_cloud_reference - o.arrival_cloud_threshold) / o.arrival_cloud_slope)
	if o.arrival_cloud_threshold >= o.arrival_cloud_reference or o.arrival_low_minimum_seconds > o.arrival_high_minimum_seconds or o.arrival_high_minimum_seconds > o.arrival_high_maximum_seconds or maximum_estimate * o.arrival_low_factor > o.arrival_high_maximum_seconds:
		_error(errors, "outlook/arrival_high_maximum_seconds", "Arrival calibration would permit an inverted time window.")
	if value.weather_policy.safe_tread > value.weather_policy.moderate_tread:
		_error(errors, "weather_policy/safe_tread", "High-risk tread must not exceed moderate-risk tread.")
	return errors

static func _ordered(values: Array) -> bool:
	for index in range(1, values.size()):
		if values[index] < values[index - 1]: return false
	return true

static func _error(errors: Array, field: String, message: String) -> void:
	errors.append(ContentValidation.diagnostic("CONTENT_ENVIRONMENT", "/environment/" + field, message))
