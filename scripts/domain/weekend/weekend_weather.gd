class_name WeekendWeather
extends RefCounted
## Authoritative weather owns its RNG. Forecasts only receive observations, never this record.
const VERSION = 1
const MODES = ["seeded", "scripted_training"]
const SAMPLE_INTERVAL = 10.0
const HISTORY_LIMIT = 120

static func create(seed: int, scenario: String, mode: String = "seeded", settings: Dictionary = WeatherTuning.DEFAULTS) -> Dictionary:
	var state = {"version": VERSION, "mode": mode, "rng": (seed ^ 0xa53c91e7) & 0xffffffff,
		"cloud": 0.0, "target": 0.0, "remaining": 0.0, "rain": 0.0}
	state.cloud = settings.wet_initial_cloud if scenario == "wet" else (settings.changeable_initial_cloud + draw(state) * settings.changeable_initial_span if scenario == "changeable" else settings.dry_initial_cloud)
	state.rain = settings.wet_initial_rain if scenario == "wet" else 0.0
	choose_target(state, scenario, settings)
	return state

static func draw(state: Dictionary) -> float:
	state.rng = (1664525 * int(state.rng) + 1013904223) & 0xffffffff
	return float(state.rng) / 4294967296.0

static func choose_target(state: Dictionary, scenario: String, settings: Dictionary = WeatherTuning.DEFAULTS) -> void:
	var value = draw(state)
	state.target = settings.dry_target_base + value * settings.dry_target_span if scenario == "dry" else (settings.wet_target_base + value * settings.wet_target_span if scenario == "wet" else settings.changeable_target_base + value * settings.changeable_target_span)
	state.remaining = settings.target_base_seconds + draw(state) * settings.target_jitter_seconds

static func advance(state: Dictionary, scenario: String, dt: float, settings: Dictionary = WeatherTuning.DEFAULTS) -> void:
	# Called only at the authoritative fixed step. No wall time, renderer or live race RNG.
	state.remaining -= dt
	if state.remaining <= 0: choose_target(state, scenario, settings)
	state.cloud = move_toward(float(state.cloud), float(state.target), dt * settings.cloud_response_per_second)
	var target_rain = 0.0 if scenario == "dry" else clampf((state.cloud - settings.rain_cloud_threshold) * settings.rain_cloud_gain, 0, 1)
	state.rain = move_toward(float(state.rain), target_rain, dt * settings.rain_response_per_second)

static func observe(surface: Array, rain: float, cloud: float, time: float) -> Dictionary:
	var sectors = [0.0, 0.0, 0.0]
	var peak = 0.0; var off_line_peak = 0.0; var peak_station = 0
	for i in range(RaceSurface.STATIONS):
		var column = surface[i]
		var water = float(RaceSurface.within(column, column.line).water)
		sectors[mini(2, int(i / 32))] += water / 32.0
		if water > peak: peak = water; peak_station = i
		for lane in column.lanes: off_line_peak = maxf(off_line_peak, lane.water)
	return {"time": time, "rain": rain, "cloud": cloud, "sectors": sectors,
		"mean": (sectors[0] + sectors[1] + sectors[2]) / 3.0, "peak": peak,
		"peak_station": peak_station, "off_line_peak": off_line_peak}

static func observation_valid(value: Variant, now: float) -> bool:
	if not value is Dictionary or not RaceCheckpoint.number(value.get("time"), 0, now): return false
	for key in ["rain", "mean", "peak", "off_line_peak"]:
		if not RaceCheckpoint.number(value.get(key), 0, 1): return false
	if not RaceCheckpoint.number(value.get("cloud"), -1, 1): return false
	if not value.get("sectors") is Array or value.sectors.size() != 3: return false
	for sector in value.sectors:
		if not RaceCheckpoint.number(sector, 0, 1): return false
	if not RaceCheckpoint.integral(value.get("peak_station"), 0, 95): return false
	return absf(value.mean - (value.sectors[0] + value.sectors[1] + value.sectors[2]) / 3.0) < 0.00001 and value.peak + 0.00001 >= value.mean and value.off_line_peak + 0.00001 >= value.peak

static func valid(value: Variant, settings: Dictionary = WeatherTuning.DEFAULTS) -> bool:
	if not value is Dictionary or value.get("version") != VERSION or value.get("mode") not in MODES: return false
	if not RaceCheckpoint.integral(value.get("rng"), 0, 4294967295): return false
	for key in ["cloud", "target", "rain"]:
		if not RaceCheckpoint.number(value.get(key), 0, 1): return false
	return RaceCheckpoint.number(value.get("remaining"), 0, settings.target_base_seconds + settings.target_jitter_seconds)
