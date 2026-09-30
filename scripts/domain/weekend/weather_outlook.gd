class_name WeatherOutlook
extends RefCounted
## Limited-information forecast: this API accepts measured history, not a weather model or RaceSim.
const VERSION = 1

static func condition(water: float, rules: Dictionary = LegacyEnvironment.VALUES.outlook) -> String:
	return "dry" if water < rules.condition_dry else ("damp" if water < rules.condition_damp else ("wet" if water < rules.condition_wet else "very wet"))

static func signature(observed: Dictionary) -> String:
	var values: Array = [int(observed.rain * 20), int(observed.cloud * 20), int(observed.peak * 20)]
	for sector in observed.sectors: values.append(int(sector * 20))
	return JSON.stringify(values).sha256_text()

static func evaluate(history: Array, observed: Dictionary, lap_seconds: float, mode: String, rules: Dictionary = LegacyEnvironment.VALUES.outlook) -> Dictionary:
	var anchor = observed
	for item in history:
		if item.time >= observed.time - rules.history_seconds and item.time < observed.time - rules.minimum_trend_seconds:
			anchor = item; break
	var elapsed = maxf(1, observed.time - anchor.time)
	var measured_trend = anchor.time < observed.time - rules.minimum_trend_seconds
	var slope = clampf((observed.mean - anchor.mean) / elapsed, -rules.maximum_water_slope, rules.maximum_water_slope) if measured_trend else 0.0
	var cloud_slope = (observed.cloud - anchor.cloud) / elapsed if measured_trend and observed.cloud >= 0 and anchor.cloud >= 0 else 0.0
	var horizon = clampf(lap_seconds * rules.horizon_laps, rules.horizon_minimum_seconds, rules.horizon_maximum_seconds)
	var middle = clampf(observed.mean + slope * horizon * rules.trend_gain, 0, 1)
	# These are stress cases, not probabilities or samples of the authoritative future.
	var spread = minf(rules.spread_maximum, rules.spread_base + horizon * rules.spread_per_second + (rules.spread_without_history if not measured_trend else 0.0))
	var trend = "wetting" if slope > rules.trend_threshold else ("drying" if slope < -rules.trend_threshold else "no clear surface trend")
	var arrival: Dictionary = {}
	if observed.rain < rules.rain_visible and cloud_slope > rules.arrival_cloud_slope and observed.cloud > rules.arrival_cloud_threshold:
		var estimate = maxf(rules.arrival_estimate_minimum_seconds, (rules.arrival_cloud_reference - observed.cloud) / cloud_slope)
		arrival = {"low": maxf(rules.arrival_low_minimum_seconds, estimate * rules.arrival_low_factor), "high": minf(rules.arrival_high_maximum_seconds, maxf(rules.arrival_high_minimum_seconds, estimate * rules.arrival_high_factor + rules.arrival_high_margin_seconds))}
	var message = "Rain observed; its duration is unknown." if observed.rain >= rules.rain_visible else "No rain observed; a later shower remains possible."
	if not arrival.is_empty(): message = "Cloud is building; rain is possible in a broad window, not promised."
	if mode == "scripted_training": message += " Scripted training schedule; the forecast still does not read its future."
	var worst_sector = 0
	for i in range(1, 3):
		if observed.sectors[i] > observed.sectors[worst_sector]: worst_sector = i
	# Trend evidence can change while present rain/water remain the same. Invalidate on
	# material public trend revisions too, never on hidden weather-process state.
	var revision_key = [signature(observed), measured_trend, roundi(slope * 10000), roundi(cloud_slope * 10000)]
	if rules != LegacyEnvironment.VALUES.outlook:
		revision_key.append(RaceStateValue.fingerprint(rules))
	return {"version": VERSION, "time": observed.time, "key": JSON.stringify(revision_key).sha256_text(), "mode": mode,
		"observed": observed.duplicate(true), "condition": condition(observed.mean, rules),
		"sector_conditions": observed.sectors.map(func(water): return condition(water, rules)), "scope": "Observed rain, cloud and surface history only",
		"trend": trend, "confidence": "limited trend evidence" if measured_trend else "baseline only; more observations needed",
		"horizon_seconds": horizon, "arrival": arrival, "message": message, "worst_sector": worst_sector,
		"cases": [{"name": "drier", "water": maxf(0, middle - spread)}, {"name": "trend persists", "water": middle}, {"name": "wetter", "water": minf(1, middle + spread)}],
		"limitations": "Uncalibrated stress-case range, not a probability band. No future weather, rival plans or random state is available. Local wet patches may remain after rain stops."}
