class_name RaceTuningDefinition
extends RefCounted
## Validated, frozen parameter tables. No parsing, I/O or schema work in fixed steps.
var _record: Dictionary = {}
var _values: Dictionary = {}
var _fingerprint: String = "legacy-path-race-v1"
var fuel: Dictionary:
	get: return _values.fuel
var pace: Dictionary:
	get: return _values.pace
var service: Dictionary:
	get: return _values.service
var condition: Dictionary:
	get: return _values.condition
var sessions: Dictionary:
	get: return _values.sessions
var weather: Dictionary:
	get: return _values.weather
var surface: Dictionary:
	get: return _values.surface
var weather_forecast: Dictionary:
	get: return _values.weather_forecast
var fingerprint: String:
	get: return _fingerprint

static func legacy() -> RaceTuningDefinition:
	var value = RaceTuningDefinition.new()
	value._values = RaceStateValue.read_only(LegacyRaceTuning.VALUES)
	return value

static func errors(record: Variant) -> Array:
	var problems = ContentValidation.check(record, ContentSchema.definition("race_tuning"))
	if not problems.is_empty(): return problems
	if record.fuel.race_load_per_lap * 100 + record.fuel.race_reserve_laps > 200:
		return [ContentValidation.diagnostic("CONTENT_TUNING", "/fuel/race_load_per_lap", "A 100-lap race plus reserve must fit the 200-lap-equivalent fuel bound.")]
	var service = record.service
	var maximum_service = maxf(service.tyre_base_seconds + service.tyre_jitter_seconds, service.repair_base_seconds + service.repair_jitter_seconds) + 1000 * service.repair_seconds_per_damage
	if maximum_service > 200:
		return [ContentValidation.diagnostic("CONTENT_TUNING", "/service/repair_seconds_per_damage", "Base, jitter and maximum repair work must fit the 200-second service bound.")]
	var heat = record.condition
	var hottest = heat.engine_base_c + 2 * heat.engine_mode_c - (1 - heat.cooling_reference) * heat.cooling_c + heat.throttle_c
	var coldest = heat.engine_base_c - (9 - heat.cooling_reference) * heat.cooling_c - heat.water_c
	if hottest > 200 or coldest < 0:
		return [ContentValidation.diagnostic("CONTENT_TUNING", "/condition", "Combined engine, cooling, throttle and water effects must keep engine targets within 0–200 degrees C.")]
	for path in [["fuel", "engine_rates"], ["pace", "speed_modes"], ["pace", "engine_modes"], ["pace", "wear_modes"]]:
		var sequence: Array = record[path[0]][path[1]]
		if sequence[0] > sequence[1] or sequence[1] > sequence[2]:
			return [ContentValidation.diagnostic("CONTENT_TUNING", "/" + "/".join(path), "Conserve, normal and attack mode coefficients must be nondecreasing.")]
	if record.condition.health_wear_attack < record.condition.health_wear_normal:
		return [ContentValidation.diagnostic("CONTENT_TUNING", "/condition/health_wear_attack", "Attack-mode health wear cannot be less than normal-mode wear.")]
	for group in ["weather", "surface", "weather_forecast"]:
		var p: Dictionary = record.get(group, LegacyRaceTuning.VALUES[group])
		var problem: Dictionary
		match group:
			"weather": problem = WeatherTuning.problem(p)
			"surface": problem = SurfaceTuning.problem(p)
			"weather_forecast": problem = WeatherForecastTuning.problem(p)
		if not problem.is_empty():
			problem.field = "/" + group + problem.field
			return [problem]
	return []

static func from_record(record: Variant) -> RaceTuningDefinition:
	if not errors(record).is_empty(): return null
	var value = RaceTuningDefinition.new()
	value._record = RaceStateValue.read_only(record)
	var tables: Dictionary = {}
	for group in LegacyRaceTuning.VALUES:
		tables[group] = record.get(group, LegacyRaceTuning.VALUES[group])
	value._values = RaceStateValue.read_only(tables)
	value._fingerprint = RaceStateValue.fingerprint(record)
	return value

func authored() -> bool:
	return not _record.is_empty()

func to_record() -> Dictionary:
	return _record.duplicate(true)

func view() -> Dictionary:
	return _values.duplicate(true)

func race_fuel(lap_count: int) -> float:
	return float(lap_count) * fuel.race_load_per_lap + fuel.race_reserve_laps

func practice_fuel(lap_count: int) -> float:
	return float(lap_count) * fuel.practice_load_per_lap + fuel.practice_reserve_laps

func practice_duration(reference_lap: float) -> float:
	return clampf(maxf(sessions.practice_minimum_seconds, reference_lap * sessions.practice_reference_laps), 120, 1800)

static func forecast_values(snapshot: Dictionary) -> Dictionary:
	# Forecast snapshots are detached application-produced values, never pack files.
	return snapshot.get("tuning_context", LegacyRaceTuning.VALUES)

static func mean_service(values: Dictionary, repair_only: bool) -> float:
	return values.repair_base_seconds + values.repair_jitter_seconds * 0.5 if repair_only else values.tyre_base_seconds + values.tyre_jitter_seconds * 0.5
