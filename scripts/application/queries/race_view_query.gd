class_name RaceViewQuery
extends RefCounted
## Read-only application facade for retained diagnostic screens.
## No command/tick API. Collection results and compiled geometry are detached.
const STEP = RaceSim.STEP
const ACTIVE = RaceSim.ACTIVE
var _source: WeakRef
var _track: TrackGeometry
var visuals: RaceVisualPort
var charts: RaceChartQuery

func _init(simulation: RaceSim) -> void:
	_source = weakref(simulation)
	_track = simulation.track.detached_copy()
	visuals = RaceVisualSource.new(simulation)
	charts = RaceChartQuery.new(simulation)

func available() -> bool:
	return _source.get_ref() != null

static func format_time(seconds: float) -> String:
	return RaceSim.format_time(seconds)

var cars: Array:
	get:
		var source: RaceSim = _source.get_ref()
		return RaceStateValue.copy(source.cars) if source != null else []

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
	get: return _track

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

func active_plan(id: int) -> Dictionary:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(source.active_plan(id)) if source != null else {}

func average(values: Array) -> float:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(source.average(values)) if source != null else 0

func car_advisories(c: Dictionary) -> Array[String]:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(source.car_advisories(c)) if source != null else []

func car_position(c: Dictionary, alpha: float = 1.0) -> Dictionary:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(source.car_position(c, alpha)) if source != null else {}

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
	return RaceStateValue.copy(source.pit_status(c)) if source != null else ""

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
	return RaceStateValue.copy(source.standings(qualifying)) if source != null else []

func strategy_advice(c: Dictionary) -> String:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(source.strategy_advice(c)) if source != null else ""

func weather_advice(id: int) -> Dictionary:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(source.weather_advice(id)) if source != null else {}

func weather_debrief() -> String:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(source.weather_debrief()) if source != null else ""

func weather_issue(id: int) -> String:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(source.weather_issue(id)) if source != null else ""

func weather_stale(advice: Dictionary) -> bool:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(source.weather_stale(advice)) if source != null else false

func decision_feed_deadline_text(card_record: Dictionary) -> String:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(DecisionFeed.deadline_text(card_record, source)) if source != null else ""

func decision_feed_for_driver(id: int, policy: Dictionary, forecast: Dictionary) -> Array:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(DecisionFeed.for_driver(source, id, policy, forecast)) if source != null else []

func director_read_model_car(id: int, forecast: Dictionary = {}) -> Dictionary:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(DirectorReadModel.car(source, id, forecast)) if source != null else {}

func director_read_model_spotlight(forecasts: Dictionary) -> Dictionary:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(DirectorReadModel.spotlight(source, forecasts)) if source != null else {}

func race_chart_query_stints() -> Dictionary:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(RaceChartQuery.stints(source)) if source != null else {}

func race_chart_query_strategy(id: int, forecast: Dictionary, initial_set: String = "") -> Array:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(RaceChartQuery.strategy(source, id, forecast, initial_set)) if source != null else []

func race_decision_view_model_accepted_receipt(value: Dictionary, action: String, payload: Dictionary, after_sequence: int) -> Dictionary:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(RaceDecisionViewModel.accepted_receipt(source, value, action, payload, after_sequence)) if source != null else {}

func race_decision_view_model_capture(id: int, forecast: Dictionary) -> Dictionary:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(RaceDecisionViewModel.capture(source, id, forecast)) if source != null else {}

func race_decision_view_model_receipt_progress(receipt: Dictionary) -> Dictionary:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(RaceDecisionViewModel.receipt_progress(source, receipt)) if source != null else {}

func race_forecaster_fuel_margin(car: Dictionary) -> float:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(RaceForecaster.fuel_margin(source, car)) if source != null else 0

func race_forecaster_material_key(driver_id: int, revision: int = 0) -> String:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(RaceForecaster.material_key(source, driver_id, revision)) if source != null else ""

func race_forecaster_qualifying_release(car: Dictionary) -> Dictionary:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(RaceForecaster.qualifying_release(source, car)) if source != null else {}

func race_forecaster_stale(forecast: Dictionary, revision: int = 0) -> bool:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(RaceForecaster.stale(source, forecast, revision)) if source != null else false

func race_read_model_capture(forecasts: Dictionary = {}) -> Dictionary:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(RaceReadModel.capture(source, forecasts)) if source != null else {}

func tactical_forecast_draft(id: int, kind: String = "undercut") -> Dictionary:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(TacticalForecast.draft(source, id, kind)) if source != null else {}

func tactical_forecast_preview(id: int, plan: Dictionary) -> Dictionary:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(TacticalForecast.preview(source, id, plan)) if source != null else {}

func tactical_forecast_team_compare() -> String:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(TacticalForecast.team_compare(source)) if source != null else ""

func weekend_scenarios_briefing() -> String:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(WeekendScenarios.briefing(source)) if source != null else ""

func weekend_scenarios_team_result() -> String:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(WeekendScenarios.team_result(source)) if source != null else ""


static func from_record(record: RaceRecord) -> RaceViewQuery:
	var source = record.source.get_ref() if record != null and record.source != null else null
	return RaceViewQuery.new(source) if source else null

func scenario_assessment(brief: Dictionary) -> String:
	var source: RaceSim = _source.get_ref()
	return ScenarioBrief.assessment(brief, source) if source else "No active experiment."

func car(id: int) -> Dictionary:
	var source: RaceSim = _source.get_ref()
	return source.cars[id].duplicate(true) if source != null and id >= 0 and id < source.cars.size() else {}

var car_count: int:
	get:
		var source: RaceSim = _source.get_ref()
		return source.cars.size() if source else 0

func tactical_current(id: int) -> Dictionary:
	var source: RaceSim = _source.get_ref()
	return TacticalDuels.current(source, id).duplicate(true) if source else {}

func tactical_debrief() -> String:
	var source: RaceSim = _source.get_ref()
	return TacticalDuels.debrief(source) if source else ""

func team_orders_validate(proposed: Dictionary) -> String:
	var source: RaceSim = _source.get_ref()
	return TeamOrders.validate(source, proposed) if source else "The weekend is unavailable."

func team_orders_preview() -> Dictionary:
	var source: RaceSim = _source.get_ref()
	return TeamOrders.preview(source).duplicate(true) if source else {}
