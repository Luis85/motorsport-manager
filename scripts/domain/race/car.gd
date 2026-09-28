class_name RaceCar
extends RefCounted
## Authoritative entrant state owned by one RaceSim aggregate.
## Rules receive this type; saves and read models receive detached records instead.
## Numerical units and serialized names remain compatible with checkpoint versions 4–11.

var id: int = 0
var short: String = ""
var name: String = ""
var team: String = ""
var color: String = ""
var skill: float = 0.0
var consistency: float = 0.0
var wet_skill: float = 0.0
var reliability: float = 0.0
var number: int = 0
var player: bool = false
var grid: int = 0
var distance: float = 0.0
var previous_distance: float = 0.0
var speed: float = 0.0
var lane: float = 0.0
var route: String = ""
var pace: int = 0
var engine: int = 0
var auto: bool = false
var compound: String = ""
var tyre: float = 0.0
var temperature: float = 0.0
var fuel: float = 0.0
var health: float = 0.0
var damage: float = 0.0
var qual_state: String = ""
var qual_runs: int = 0
var next_qual: float = 0.0
var qual_best: float = 0.0
var qual_laps: int = 0
var hot_start: float = 0.0
var hot_valid: bool = false
var lap_start: float = 0.0
var last_lap: float = 0.0
var best_lap: float = 0.0
var completed: int = 0
var sectors: Array = []
var sector_start: float = 0.0
var pit_order: bool = false
var next_compound: String = ""
var repair: bool = false
var pit_d: float = 0.0
var pit_cycle: int = 0
var pit_stage: String = ""
var pit_timer: float = 0.0
var pit_stops: int = 0
var box_d: float = 0.0
var loss: float = 0.0
var dnf: bool = false
var retire_reason: String = ""
var finished: bool = false
var finish_position: int = 0
var finish_time: float = 0.0
var formation_done: bool = false
var blue: bool = false
var ai_clock: float = 0.0
var intent: String = ""
var history: Array = []
var setup: int = 0
var telemetry: Array = []
var last_trace: float = 0.0
var pit_gate: float = 0.0
var crossed_at: float = 0.0
var previous_pit_d: float = 0.0
var previous_lane: float = 0.0
var previous_route: String = ""
var yield_to: int = 0
var yield_side: float = 0.0
var yield_clock: float = 0.0
var qual_history: Array = []
var qual_sectors: Array = []
var qual_sector_start: float = 0.0
var invalid_reason: String = ""
var throttle: float = 0.0
var braking: float = 0.0
var pit_deferred: bool = false
var pit_lap: bool = false
var service_compound: String = ""
var service_repair: bool = false
var tyre_sets: Array = []
var set_id: String = ""
var next_set_id: String = ""
var service_set_id: String = ""
var scheduled_lap: int = 0
var stints: Array = []
var car_setup: Dictionary = {}
var battle_mode: String = ""
var engine_temperature: float = 0.0
var brake_temperature: float = 0.0
var tyre_event_clock: float = 0.0

const FIELDS: Array[String] = [
	"id",
	"short",
	"name",
	"team",
	"color",
	"skill",
	"consistency",
	"wet_skill",
	"reliability",
	"number",
	"player",
	"grid",
	"distance",
	"previous_distance",
	"speed",
	"lane",
	"route",
	"pace",
	"engine",
	"auto",
	"compound",
	"tyre",
	"temperature",
	"fuel",
	"health",
	"damage",
	"qual_state",
	"qual_runs",
	"next_qual",
	"qual_best",
	"qual_laps",
	"hot_start",
	"hot_valid",
	"lap_start",
	"last_lap",
	"best_lap",
	"completed",
	"sectors",
	"sector_start",
	"pit_order",
	"next_compound",
	"repair",
	"pit_d",
	"pit_cycle",
	"pit_stage",
	"pit_timer",
	"pit_stops",
	"box_d",
	"loss",
	"dnf",
	"retire_reason",
	"finished",
	"finish_position",
	"finish_time",
	"formation_done",
	"blue",
	"ai_clock",
	"intent",
	"history",
	"setup",
	"telemetry",
	"last_trace",
	"pit_gate",
	"crossed_at",
	"previous_pit_d",
	"previous_lane",
	"previous_route",
	"yield_to",
	"yield_side",
	"yield_clock",
	"qual_history",
	"qual_sectors",
	"qual_sector_start",
	"invalid_reason",
	"throttle",
	"braking",
	"pit_deferred",
	"pit_lap",
	"service_compound",
	"service_repair",
	"tyre_sets",
	"set_id",
	"next_set_id",
	"service_set_id",
	"scheduled_lap",
	"stints",
	"car_setup",
	"battle_mode",
	"engine_temperature",
	"brake_temperature",
	"tyre_event_clock",
]

func to_record() -> Dictionary:
	return {
		"id": id,
		"short": short,
		"name": name,
		"team": team,
		"color": color,
		"skill": skill,
		"consistency": consistency,
		"wet_skill": wet_skill,
		"reliability": reliability,
		"number": number,
		"player": player,
		"grid": grid,
		"distance": distance,
		"previous_distance": previous_distance,
		"speed": speed,
		"lane": lane,
		"route": route,
		"pace": pace,
		"engine": engine,
		"auto": auto,
		"compound": compound,
		"tyre": tyre,
		"temperature": temperature,
		"fuel": fuel,
		"health": health,
		"damage": damage,
		"qual_state": qual_state,
		"qual_runs": qual_runs,
		"next_qual": next_qual,
		"qual_best": qual_best,
		"qual_laps": qual_laps,
		"hot_start": hot_start,
		"hot_valid": hot_valid,
		"lap_start": lap_start,
		"last_lap": last_lap,
		"best_lap": best_lap,
		"completed": completed,
		"sectors": sectors.duplicate(true),
		"sector_start": sector_start,
		"pit_order": pit_order,
		"next_compound": next_compound,
		"repair": repair,
		"pit_d": pit_d,
		"pit_cycle": pit_cycle,
		"pit_stage": pit_stage,
		"pit_timer": pit_timer,
		"pit_stops": pit_stops,
		"box_d": box_d,
		"loss": loss,
		"dnf": dnf,
		"retire_reason": retire_reason,
		"finished": finished,
		"finish_position": finish_position,
		"finish_time": finish_time,
		"formation_done": formation_done,
		"blue": blue,
		"ai_clock": ai_clock,
		"intent": intent,
		"history": history.duplicate(true),
		"setup": setup,
		"telemetry": telemetry.duplicate(true),
		"last_trace": last_trace,
		"pit_gate": pit_gate,
		"crossed_at": crossed_at,
		"previous_pit_d": previous_pit_d,
		"previous_lane": previous_lane,
		"previous_route": previous_route,
		"yield_to": yield_to,
		"yield_side": yield_side,
		"yield_clock": yield_clock,
		"qual_history": qual_history.duplicate(true),
		"qual_sectors": qual_sectors.duplicate(true),
		"qual_sector_start": qual_sector_start,
		"invalid_reason": invalid_reason,
		"throttle": throttle,
		"braking": braking,
		"pit_deferred": pit_deferred,
		"pit_lap": pit_lap,
		"service_compound": service_compound,
		"service_repair": service_repair,
		"tyre_sets": tyre_sets.duplicate(true),
		"set_id": set_id,
		"next_set_id": next_set_id,
		"service_set_id": service_set_id,
		"scheduled_lap": scheduled_lap,
		"stints": stints.duplicate(true),
		"car_setup": car_setup.duplicate(true),
		"battle_mode": battle_mode,
		"engine_temperature": engine_temperature,
		"brake_temperature": brake_temperature,
		"tyre_event_clock": tyre_event_clock,
	}

func detached_copy() -> RaceCar:
	return from_record(to_record())

static func from_record(record: Dictionary) -> RaceCar:
	# The enclosing checkpoint validates domain ranges, route invariants and stock.
	# This codec additionally rejects unknown/missing fields and incompatible types.
	if record.size() != FIELDS.size():
		return null
	var car = RaceCar.new()
	for field in FIELDS:
		if not record.has(field):
			return null
		var value: Variant = record[field]
		var expected = typeof(car.get(field))
		if expected in [TYPE_INT, TYPE_FLOAT]:
			if typeof(value) not in [TYPE_INT, TYPE_FLOAT] or not is_finite(value):
				return null
			if expected == TYPE_INT and float(value) != floorf(float(value)):
				return null
			car.set(field, int(value) if expected == TYPE_INT else float(value))
		elif typeof(value) == expected and _record_value(value):
			car.set(field, RaceStateValue.copy(value))
		else:
			return null
	return car

static func records(cars: Array[RaceCar]) -> Array:
	var result: Array = []
	for car in cars:
		result.append(car.to_record())
	return result

static func _record_value(value: Variant, depth: int = 0) -> bool:
	# A record may not retain engine Objects or cyclic caller collections.
	if depth > 24:
		return false
	match typeof(value):
		TYPE_NIL, TYPE_BOOL, TYPE_INT, TYPE_STRING, TYPE_STRING_NAME:
			return true
		TYPE_FLOAT:
			return is_finite(value)
		TYPE_ARRAY:
			if value.size() > 20000: return false
			for item in value:
				if not _record_value(item, depth + 1): return false
			return true
		TYPE_DICTIONARY:
			if value.size() > 20000: return false
			for key in value:
				if typeof(key) not in [TYPE_STRING, TYPE_STRING_NAME] or not _record_value(value[key], depth + 1): return false
			return true
	return false
