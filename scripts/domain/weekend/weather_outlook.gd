class_name WeatherOutlook
extends RefCounted
## Limited-information forecast: this API accepts measured history, not a weather model or RaceSim.
const VERSION = 1

static func condition(water: float, p: Dictionary = WeatherForecastTuning.DEFAULTS) -> String:
	return "dry" if water < p.dry_water_limit else ("damp" if water < p.damp_water_limit else ("wet" if water < p.wet_water_limit else "very wet"))

static func signature(observed: Dictionary) -> String:
	var values: Array = [int(observed.rain * 20), int(observed.cloud * 20), int(observed.peak * 20)]
	for sector in observed.sectors: values.append(int(sector * 20))
	return JSON.stringify(values).sha256_text()

static func evaluate(history: Array, observed: Dictionary, lap_seconds: float, mode: String, p: Dictionary = WeatherForecastTuning.DEFAULTS) -> Dictionary:
	var anchor = observed
	for item in history:
		if item.time >= observed.time - p.history_window_seconds and item.time < observed.time - p.minimum_trend_seconds:
			anchor = item; break
	var elapsed = maxf(1, observed.time - anchor.time)
	var measured_trend = anchor.time < observed.time - p.minimum_trend_seconds
	var slope = clampf((observed.mean - anchor.mean) / elapsed, -p.maximum_water_slope, p.maximum_water_slope) if measured_trend else 0.0
	var cloud_slope = (observed.cloud - anchor.cloud) / elapsed if measured_trend and observed.cloud >= 0 and anchor.cloud >= 0 else 0.0
	var horizon = clampf(lap_seconds * p.horizon_laps, p.minimum_horizon_seconds, p.maximum_horizon_seconds)
	var middle = clampf(observed.mean + slope * horizon * p.trend_projection_factor, 0, 1)
	# These are stress cases, not probabilities or samples of the authoritative future.
	var spread = minf(p.maximum_case_spread, p.base_case_spread + horizon * p.case_spread_per_second + (p.missing_trend_spread if not measured_trend else 0.0))
	var trend = "wetting" if slope > p.trend_threshold else ("drying" if slope < -p.trend_threshold else "no clear surface trend")
	var arrival: Dictionary = {}
	if observed.rain < p.rain_observed_threshold and cloud_slope > p.cloud_trend_threshold and observed.cloud > p.cloud_arrival_threshold:
		var estimate = maxf(p.arrival_estimate_floor_seconds, (p.cloud_arrival_reference - observed.cloud) / cloud_slope)
		arrival = {"low": maxf(p.arrival_low_floor_seconds, estimate * p.arrival_low_multiplier), "high": minf(p.arrival_high_cap_seconds, maxf(p.arrival_high_floor_seconds, estimate * p.arrival_high_multiplier + p.arrival_high_buffer_seconds))}
	# A lower estimate beyond the bounded outlook is unavailable, not a precise point at its cap.
	if not arrival.is_empty() and arrival.low > arrival.high: arrival = {}
	var message = "Rain observed; its duration is unknown." if observed.rain >= p.rain_observed_threshold else "No rain observed; a later shower remains possible."
	if not arrival.is_empty(): message = "Cloud is building; rain is possible in a broad window, not promised."
	if mode == "scripted_training": message += " Scripted training schedule; the forecast still does not read its future."
	var worst_sector = 0
	for i in range(1, 3):
		if observed.sectors[i] > observed.sectors[worst_sector]: worst_sector = i
	# Trend evidence can change while present rain/water remain the same. Invalidate on
	# material public trend revisions too, never on hidden weather-process state.
	var revision_key = [signature(observed), measured_trend, roundi(slope * 10000), roundi(cloud_slope * 10000)]
	if p != WeatherForecastTuning.DEFAULTS: revision_key.append(RaceStateValue.fingerprint(p))
	return {"version": VERSION, "time": observed.time, "condition": condition(observed.mean, p),
		"sector_conditions": observed.sectors.map(func(water): return condition(water, p)), "key": JSON.stringify(revision_key).sha256_text(), "mode": mode,
		"observed": observed.duplicate(true), "scope": "Observed rain, cloud and surface history only",
		"trend": trend, "confidence": "limited trend evidence" if measured_trend else "baseline only; more observations needed",
		"horizon_seconds": horizon, "arrival": arrival, "message": message, "worst_sector": worst_sector,
		"cases": [{"name": "drier", "water": maxf(0, middle - spread)}, {"name": "trend persists", "water": middle}, {"name": "wetter", "water": minf(1, middle + spread)}],
		"limitations": "Uncalibrated stress-case range, not a probability band. No future weather, rival plans or random state is available. Local wet patches may remain after rain stops."}
