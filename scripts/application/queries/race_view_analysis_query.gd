class_name RaceViewAnalysisQuery
extends RaceViewStateQuery
## Detached forecast, decision and director observations.


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
	return (
		RaceStateValue.copy(DecisionFeed.deadline_text(card_record, source))
		if source != null
		else ""
	)


func decision_feed_for_driver(id: int, policy: Dictionary, forecast: Dictionary) -> Array:
	var source: RaceSim = _source.get_ref()
	return (
		RaceStateValue.copy(DecisionFeed.for_driver(source, id, policy, forecast))
		if source != null
		else []
	)


func director_read_model_car(id: int, forecast: Dictionary = {}) -> Dictionary:
	var source: RaceSim = _source.get_ref()
	return (
		RaceStateValue.copy(DirectorReadModel.car(source, id, forecast)) if source != null else {}
	)


func director_read_model_spotlight(forecasts: Dictionary) -> Dictionary:
	var source: RaceSim = _source.get_ref()
	return (
		RaceStateValue.copy(DirectorReadModel.spotlight(source, forecasts))
		if source != null
		else {}
	)


func race_chart_query_stints() -> Dictionary:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(RaceChartQuery.stints(source)) if source != null else {}


func race_chart_query_strategy(id: int, forecast: Dictionary, initial_set: String = "") -> Array:
	var source: RaceSim = _source.get_ref()
	return (
		RaceStateValue.copy(RaceChartQuery.strategy(source, id, forecast, initial_set))
		if source != null
		else []
	)


func race_decision_view_model_accepted_receipt(
	value: Dictionary, action: String, payload: Dictionary, after_sequence: int
) -> Dictionary:
	var source: RaceSim = _source.get_ref()
	return (
		RaceStateValue.copy(
			RaceDecisionViewModel.accepted_receipt(source, value, action, payload, after_sequence)
		)
		if source != null
		else {}
	)


func race_decision_view_model_capture(id: int, forecast: Dictionary) -> Dictionary:
	var source: RaceSim = _source.get_ref()
	return (
		RaceStateValue.copy(RaceDecisionViewModel.capture(source, id, forecast))
		if source != null
		else {}
	)


func race_decision_view_model_receipt_progress(receipt: Dictionary) -> Dictionary:
	var source: RaceSim = _source.get_ref()
	return (
		RaceStateValue.copy(RaceDecisionViewModel.receipt_progress(source, receipt))
		if source != null
		else {}
	)


func race_forecaster_fuel_margin(car: Dictionary) -> float:
	var source: RaceSim = _source.get_ref()
	var entrant = _draft_entrant(car)
	return (
		RaceStateValue.copy(RaceForecaster.fuel_margin(source, entrant))
		if source != null and entrant != null
		else 0
	)


func race_forecaster_material_key(driver_id: int, revision: int = 0) -> String:
	var source: RaceSim = _source.get_ref()
	return (
		RaceStateValue.copy(RaceForecaster.material_key(source, driver_id, revision))
		if source != null
		else ""
	)


func race_forecaster_qualifying_release(car: Dictionary) -> Dictionary:
	var source: RaceSim = _source.get_ref()
	var entrant = _draft_entrant(car)
	return (
		RaceStateValue.copy(RaceForecaster.qualifying_release(source, entrant))
		if source != null and entrant != null
		else {}
	)


func race_forecaster_stale(forecast: Dictionary, revision: int = 0) -> bool:
	var source: RaceSim = _source.get_ref()
	return (
		RaceStateValue.copy(RaceForecaster.stale(source, forecast, revision))
		if source != null
		else false
	)


func race_read_model_capture(forecasts: Dictionary = {}) -> Dictionary:
	var source: RaceSim = _source.get_ref()
	return RaceStateValue.copy(RaceReadModel.capture(source, forecasts)) if source != null else {}
