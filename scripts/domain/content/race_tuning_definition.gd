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
var fingerprint: String:
	get: return _fingerprint

static func legacy() -> RaceTuningDefinition:
	var value = RaceTuningDefinition.new()
	value._values = RaceStateValue.read_only(LegacyRaceTuning.VALUES)
	return value

static func from_record(record: Variant) -> RaceTuningDefinition:
	if not record is Dictionary: return null
	if not ContentValidation.check(record, ContentSchema.definition("race_tuning")).is_empty(): return null
	# A legal maximum-length race must still fit the existing serialized fuel bound.
	if record.fuel.race_load_per_lap * 100 + record.fuel.race_reserve_laps > 200: return null
	var service = record.service
	var maximum_service = maxf(service.tyre_base_seconds + service.tyre_jitter_seconds, service.repair_base_seconds + service.repair_jitter_seconds) + 1000 * service.repair_seconds_per_damage
	if maximum_service > 200: return null
	var heat = record.condition
	var hottest = heat.engine_base_c + 2 * heat.engine_mode_c - (1 - heat.cooling_reference) * heat.cooling_c + heat.throttle_c
	var coldest = heat.engine_base_c - (9 - heat.cooling_reference) * heat.cooling_c - heat.water_c
	if hottest > 200 or coldest < 0: return null
	for sequence in [record.fuel.engine_rates, record.pace.speed_modes, record.pace.engine_modes, record.pace.wear_modes]:
		if sequence[0] > sequence[1] or sequence[1] > sequence[2]: return null
	if record.condition.health_wear_attack < record.condition.health_wear_normal: return null
	var value = RaceTuningDefinition.new()
	value._record = RaceStateValue.read_only(record)
	var tables: Dictionary = {}
	for group in LegacyRaceTuning.VALUES:
		tables[group] = record[group]
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
