class_name WeatherOutlook
extends RefCounted
## Limited-information forecast: this API accepts measured history, not a weather model or RaceSim.
const VERSION = 1

static func condition(water: float) -> String:
	return "dry" if water < 0.08 else ("damp" if water < 0.24 else ("wet" if water < 0.68 else "very wet"))

static func signature(observed: Dictionary) -> String:
	var values: Array = [int(observed.rain * 20), int(observed.cloud * 20), int(observed.peak * 20)]
	for sector in observed.sectors: values.append(int(sector * 20))
	return JSON.stringify(values).sha256_text()

static func evaluate(history: Array, observed: Dictionary, lap_seconds: float, mode: String) -> Dictionary:
	var anchor = observed
	for item in history:
		if item.time >= observed.time - 60 and item.time < observed.time - 15:
			anchor = item; break
	var elapsed = maxf(1, observed.time - anchor.time)
	var measured_trend = anchor.time < observed.time - 15
	var slope = clampf((observed.mean - anchor.mean) / elapsed, -0.006, 0.006) if measured_trend else 0.0
	var cloud_slope = (observed.cloud - anchor.cloud) / elapsed if measured_trend and observed.cloud >= 0 and anchor.cloud >= 0 else 0.0
	var horizon = clampf(lap_seconds * 3, 60, 240)
	var middle = clampf(observed.mean + slope * horizon * 0.65, 0, 1)
	# These are stress cases, not probabilities or samples of the authoritative future.
	var spread = minf(0.50, 0.12 + horizon * 0.0012 + (0.08 if not measured_trend else 0.0))
	var trend = "wetting" if slope > 0.0003 else ("drying" if slope < -0.0003 else "no clear surface trend")
	var arrival: Dictionary = {}
	if observed.rain < 0.08 and cloud_slope > 0.001 and observed.cloud > 0.30:
		var estimate = maxf(20, (0.60 - observed.cloud) / cloud_slope)
		arrival = {"low": maxf(15, estimate * 0.5), "high": minf(480, maxf(60, estimate * 2.0 + 30))}
	var message = "Rain observed; its duration is unknown." if observed.rain >= 0.08 else "No rain observed; a later shower remains possible."
	if not arrival.is_empty(): message = "Cloud is building; rain is possible in a broad window, not promised."
	if mode == "scripted_training": message += " Scripted training schedule; the forecast still does not read its future."
	var worst_sector = 0
	for i in range(1, 3):
		if observed.sectors[i] > observed.sectors[worst_sector]: worst_sector = i
	return {"version": VERSION, "time": observed.time, "key": signature(observed), "mode": mode,
		"observed": observed.duplicate(true), "scope": "Observed rain, cloud and surface history only",
		"trend": trend, "confidence": "limited trend evidence" if measured_trend else "baseline only; more observations needed",
		"horizon_seconds": horizon, "arrival": arrival, "message": message, "worst_sector": worst_sector,
		"cases": [{"name": "drier", "water": maxf(0, middle - spread)}, {"name": "trend persists", "water": middle}, {"name": "wetter", "water": minf(1, middle + spread)}],
		"limitations": "Uncalibrated stress-case range, not a probability band. No future weather, rival plans or random state is available. Local wet patches may remain after rain stops."}
