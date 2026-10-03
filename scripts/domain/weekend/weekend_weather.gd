class_name WeekendWeather
extends RefCounted
## Authoritative weather owns its RNG. Forecasts only receive observations, never this record.
const VERSION = 1
const MODES = ["seeded", "scripted_training"]
const SAMPLE_INTERVAL = 10.0
const HISTORY_LIMIT = 120


static func create(
	seed: int,
	scenario: String,
	mode: String = "seeded",
	rules: Dictionary = LegacyEnvironment.VALUES.weather
) -> Dictionary:
	var state = {
		"version": VERSION,
		"mode": mode,
		"rng": (seed ^ 0xa53c91e7) & 0xffffffff,
		"cloud": 0.0,
		"target": 0.0,
		"remaining": 0.0,
		"rain": 0.0
	}
	state.cloud = (
		rules.initial_cloud_wet
		if scenario == "wet"
		else (
			rules.initial_cloud_changeable_base + draw(state) * rules.initial_cloud_changeable_span
			if scenario == "changeable"
			else rules.initial_cloud_dry
		)
	)
	state.rain = rules.initial_rain_wet if scenario == "wet" else 0.0
	choose_target(state, scenario, rules)
	return state


static func draw(state: Dictionary) -> float:
	state.rng = (1664525 * int(state.rng) + 1013904223) & 0xffffffff
	return float(state.rng) / 4294967296.0


static func choose_target(
	state: Dictionary, scenario: String, rules: Dictionary = LegacyEnvironment.VALUES.weather
) -> void:
	var value = draw(state)
	state.target = (
		rules.target_dry_base + value * rules.target_dry_span
		if scenario == "dry"
		else (
			rules.target_wet_base + value * rules.target_wet_span
			if scenario == "wet"
			else rules.target_changeable_base + value * rules.target_changeable_span
		)
	)
	state.remaining = rules.transition_base_seconds + draw(state) * rules.transition_span_seconds


static func advance(
	state: Dictionary,
	scenario: String,
	dt: float,
	rules: Dictionary = LegacyEnvironment.VALUES.weather
) -> void:
	# Called only at the authoritative fixed step. No wall time, renderer or live race RNG.
	state.remaining -= dt
	if state.remaining <= 0:
		choose_target(state, scenario, rules)
	state.cloud = move_toward(
		float(state.cloud), float(state.target), dt * rules.cloud_response_per_second
	)
	var target_rain = (
		0.0
		if scenario == "dry"
		else clampf((state.cloud - rules.rain_cloud_threshold) * rules.rain_cloud_gain, 0, 1)
	)
	state.rain = move_toward(float(state.rain), target_rain, dt * rules.rain_response_per_second)


static func observe(surface: Array, rain: float, cloud: float, time: float) -> Dictionary:
	var sectors = [0.0, 0.0, 0.0]
	var peak = 0.0
	var off_line_peak = 0.0
	var peak_station = 0
	for i in range(RaceSurface.STATIONS):
		var column = surface[i]
		var water = float(RaceSurface.within(column, column.line).water)
		sectors[mini(2, int(i / 32))] += water / 32.0
		if water > peak:
			peak = water
			peak_station = i
		for lane in column.lanes:
			off_line_peak = maxf(off_line_peak, lane.water)
	return {
		"time": time,
		"rain": rain,
		"cloud": cloud,
		"sectors": sectors,
		"mean": (sectors[0] + sectors[1] + sectors[2]) / 3.0,
		"peak": peak,
		"peak_station": peak_station,
		"off_line_peak": off_line_peak
	}


static func observation_valid(value: Variant, now: float) -> bool:
	if not value is Dictionary or not RaceCheckpoint.number(value.get("time"), 0, now):
		return false
	for key in ["rain", "mean", "peak", "off_line_peak"]:
		if not RaceCheckpoint.number(value.get(key), 0, 1):
			return false
	if not RaceCheckpoint.number(value.get("cloud"), -1, 1):
		return false
	if not value.get("sectors") is Array or value.sectors.size() != 3:
		return false
	for sector in value.sectors:
		if not RaceCheckpoint.number(sector, 0, 1):
			return false
	if not RaceCheckpoint.integral(value.get("peak_station"), 0, 95):
		return false
	return (
		absf(value.mean - (value.sectors[0] + value.sectors[1] + value.sectors[2]) / 3.0) < 0.00001
		and value.peak + 0.00001 >= value.mean
		and value.off_line_peak + 0.00001 >= value.peak
	)


static func valid(value: Variant, rules: Dictionary = LegacyEnvironment.VALUES.weather) -> bool:
	if not value is Dictionary or value.get("version") != VERSION or value.get("mode") not in MODES:
		return false
	if not RaceCheckpoint.integral(value.get("rng"), 0, 4294967295):
		return false
	for key in ["cloud", "target", "rain"]:
		if not RaceCheckpoint.number(value.get(key), 0, 1):
			return false
	return RaceCheckpoint.number(
		value.get("remaining"), 0, rules.transition_base_seconds + rules.transition_span_seconds
	)


static func training(
	scenario: String,
	phase: String,
	clock: float,
	reference_duration: float,
	rules: Dictionary = LegacyEnvironment.VALUES.training
) -> Dictionary:
	var target = 0.0
	var label = "Clear skies"
	if scenario == "wet":
		target = (
			rules.wet_heavy_rain
			if phase != "race" or clock < rules.wet_ease_seconds
			else (rules.wet_eased_rain if clock < rules.wet_dry_seconds else 0.0)
		)
		label = "Steady rain" if target > 0.4 else ("Rain easing" if target > 0 else "Drying line")
	elif scenario == "changeable" and phase == "race":
		var fraction = clock / maxf(rules.minimum_race_seconds, reference_duration)
		target = (
			rules.changeable_heavy_rain
			if fraction > rules.changeable_heavy_start and fraction < rules.changeable_heavy_end
			else (
				rules.changeable_light_rain
				if fraction > rules.changeable_light_start and fraction < rules.changeable_light_end
				else 0.0
			)
		)
		label = "Heavy shower" if target > 0.5 else ("Light rain" if target > 0 else "Clear skies")
	return {"rain": target, "label": label}
