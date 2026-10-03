class_name RaceViewStateQuery
extends RefCounted
## Read-only application facade for retained diagnostic screens.
## No command/tick API. Collection results and compiled geometry are detached.
const STEP = RaceSim.STEP
const ACTIVE = RaceSim.ACTIVE
var visuals: RaceVisualPort
var charts: RaceChartQuery

var cars: Array:
	get:
		var source: RaceSim = _source.get_ref()
		return (
			EntrantReadModel.records(source.cars, source.roster_definition)
			if source != null
			else []
		)

var events: Array:
	get:
		var source: RaceSim = _source.get_ref()
		return RaceStateValue.copy(source.events) if source != null else []

var water: Array:
	get:
		var source: RaceSim = _source.get_ref()
		return RaceStateValue.copy(source.water) if source != null else []

var rubber: Array:
	get:
		var source: RaceSim = _source.get_ref()
		return RaceStateValue.copy(source.rubber) if source != null else []

var track: TrackGeometry:
	get:
		return _track

var pit_boxes: Dictionary:
	get:
		var source: RaceSim = _source.get_ref()
		return RaceStateValue.copy(source.pit_boxes) if source != null else {}

var stats: Dictionary:
	get:
		var source: RaceSim = _source.get_ref()
		return RaceStateValue.copy(source.stats) if source != null else {}

var strategy_state: Dictionary:
	get:
		var source: RaceSim = _source.get_ref()
		return RaceStateValue.copy(source.strategy_state) if source != null else {}

var weather_state: Dictionary:
	get:
		var source: RaceSim = _source.get_ref()
		return RaceStateValue.copy(source.weather_state) if source != null else {}

var control_state: Dictionary:
	get:
		var source: RaceSim = _source.get_ref()
		return RaceStateValue.copy(source.control_state) if source != null else {}

var team_state: Dictionary:
	get:
		var source: RaceSim = _source.get_ref()
		return RaceStateValue.copy(source.team_state) if source != null else {}

var battle_state: Dictionary:
	get:
		var source: RaceSim = _source.get_ref()
		return RaceStateValue.copy(source.battle_state) if source != null else {}

var rival_state: Dictionary:
	get:
		var source: RaceSim = _source.get_ref()
		return RaceStateValue.copy(source.rival_state) if source != null else {}

var practice_state: Dictionary:
	get:
		var source: RaceSim = _source.get_ref()
		return RaceStateValue.copy(source.practice_state) if source != null else {}

var rival_styles: Dictionary:
	get:
		var source: RaceSim = _source.get_ref()
		return RaceStateValue.copy(source.rival_styles) if source != null else {}

var duel_state: Dictionary:
	get:
		var source: RaceSim = _source.get_ref()
		return RaceStateValue.copy(source.duel_state) if source != null else {}

var phase: String:
	get:
		var source: RaceSim = _source.get_ref()
		return RaceStateValue.copy(source.phase) if source != null else ""

var flag: String:
	get:
		var source: RaceSim = _source.get_ref()
		return RaceStateValue.copy(source.flag) if source != null else ""

var weather_name: String:
	get:
		var source: RaceSim = _source.get_ref()
		return RaceStateValue.copy(source.weather_name) if source != null else ""

var last_error: String:
	get:
		var source: RaceSim = _source.get_ref()
		return RaceStateValue.copy(source.last_error) if source != null else ""

var intensity: String:
	get:
		var source: RaceSim = _source.get_ref()
		return RaceStateValue.copy(source.intensity) if source != null else ""

var laps: int:
	get:
		var source: RaceSim = _source.get_ref()
		return RaceStateValue.copy(source.laps) if source != null else 0

var speed: int:
	get:
		var source: RaceSim = _source.get_ref()
		return RaceStateValue.copy(source.speed) if source != null else 0

var selected_id: int:
	get:
		var source: RaceSim = _source.get_ref()
		return RaceStateValue.copy(source.selected_id) if source != null else 0

var seed_value: int:
	get:
		var source: RaceSim = _source.get_ref()
		return RaceStateValue.copy(source.seed_value) if source != null else 0

var paused: bool:
	get:
		var source: RaceSim = _source.get_ref()
		return RaceStateValue.copy(source.paused) if source != null else false

var qual_closed: bool:
	get:
		var source: RaceSim = _source.get_ref()
		return RaceStateValue.copy(source.qual_closed) if source != null else false

var chequered: bool:
	get:
		var source: RaceSim = _source.get_ref()
		return RaceStateValue.copy(source.chequered) if source != null else false

var accumulator: float:
	get:
		var source: RaceSim = _source.get_ref()
		return RaceStateValue.copy(source.accumulator) if source != null else 0

var clock: float:
	get:
		var source: RaceSim = _source.get_ref()
		return RaceStateValue.copy(source.clock) if source != null else 0

var qual_duration: float:
	get:
		var source: RaceSim = _source.get_ref()
		return RaceStateValue.copy(source.qual_duration) if source != null else 0

var race_time: float:
	get:
		var source: RaceSim = _source.get_ref()
		return RaceStateValue.copy(source.race_time) if source != null else 0

var rain: float:
	get:
		var source: RaceSim = _source.get_ref()
		return RaceStateValue.copy(source.rain) if source != null else 0

var total_time: float:
	get:
		var source: RaceSim = _source.get_ref()
		return RaceStateValue.copy(source.total_time) if source != null else 0

var car_count: int:
	get:
		var source: RaceSim = _source.get_ref()
		return source.cars.size() if source else 0

var _source: WeakRef
var _track: TrackGeometry


func active_plan(id: int) -> Dictionary:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(source.active_plan(id)) if source != null else {}


func average(values: Array) -> float:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(source.average(values)) if source != null else 0


func car_advisories(c: Dictionary) -> Array[String]:
	var source: RaceSim = _source.get_ref()
	var entrant = _draft_entrant(c)
	if source == null or entrant == null:
		var unavailable: Array[String] = []
		return unavailable
	return source.car_advisories(entrant).duplicate()


func car_position(c: Dictionary, alpha: float = 1.0) -> Dictionary:
	var source: RaceSim = _source.get_ref()
	var entrant = _draft_entrant(c)
	return (
		RaceStateValue.copy(source.car_position(entrant, alpha))
		if source != null and entrant != null
		else {}
	)


func enhanced() -> bool:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(source.enhanced()) if source != null else false


func forecast(id: int, draft: Dictionary = {}) -> Dictionary:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(source.forecast(id, draft)) if source != null else {}


func forecast_parameters(_driver_id: int) -> Dictionary:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(source.forecast_parameters(_driver_id)) if source != null else {}


func has_mechanic(identity: String) -> bool:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(source.has_mechanic(identity)) if source != null else false


func pit_status(c: Dictionary) -> String:
	var source: RaceSim = _source.get_ref()
	var entrant = _draft_entrant(c)
	return (
		RaceStateValue.copy(source.pit_status(entrant))
		if source != null and entrant != null
		else ""
	)


func policy(id: int) -> Dictionary:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(source.policy(id)) if source != null else {}


func practice_driver(id: int) -> Dictionary:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(source.practice_driver(id)) if source != null else {}


func recommended_compound() -> String:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(source.recommended_compound()) if source != null else ""


func recovery_advice(id: int) -> Dictionary:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(source.recovery_advice(id)) if source != null else {}


func recovery_debrief() -> String:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(source.recovery_debrief()) if source != null else ""


func recovery_stale(advice: Dictionary) -> bool:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(source.recovery_stale(advice)) if source != null else false


func reliability(id: int) -> Dictionary:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(source.reliability(id)) if source != null else {}


func run_preview(id: int, plan: Dictionary) -> Dictionary:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(source.run_preview(id, plan)) if source != null else {}


func standings(qualifying: bool = false) -> Array:
	var source: RaceSim = _source.get_ref()
	return (
		EntrantReadModel.records(source.standings(qualifying), source.roster_definition)
		if source != null
		else []
	)


func strategy_advice(c: Dictionary) -> String:
	var source: RaceSim = _source.get_ref()
	var entrant = _draft_entrant(c)
	return (
		RaceStateValue.copy(source.strategy_advice(entrant))
		if source != null and entrant != null
		else ""
	)


func _draft_entrant(record: Dictionary) -> RaceCar:
	var source: RaceSim = _source.get_ref()
	if source == null:
		return null
	var car = EntrantReadModel.decode(record, source.roster_definition)
	if car == null or source.tyre_rules.spec(car.compound).is_empty():
		return null
	if (
		not TyreInventory.valid(car.to_record(), source.laps, source.tyre_rules)
		or not CarSetup.valid(car.to_record(), source.setup_definition)
	):
		return null
	car.tyre_rules = source.tyre_rules
	car.setup_definition = source.setup_definition
	if source.roster_definition != null and car.id >= 0 and car.id < source.cars.size():
		car.entry_definition = source.roster_definition.entrant(car.id)
	return car
