class_name RaceViewToolsQuery
extends RaceViewAnalysisQuery
## Detached planning drafts and pure profile helpers.


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


func scenario_assessment(brief: Dictionary) -> String:
	var source: RaceSim = _source.get_ref()
	return ScenarioBrief.assessment(brief, source) if source else "No active experiment."


func car(id: int) -> Dictionary:
	var source: RaceSim = _source.get_ref()
	return (
		EntrantReadModel.record(source.cars[id], source.roster_definition)
		if source != null and id >= 0 and id < source.cars.size()
		else {}
	)


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


## Draft calculations consume a detached typed value, not the live entrant.
func setup_effects(record: Dictionary, wetness: float) -> Dictionary:
	var car = _draft_entrant(record)
	return CarSetup.effects(car, wetness) if car != null else {}


func planned_set(record: Dictionary, exclude_mounted: bool = false) -> Dictionary:
	var car = _draft_entrant(record)
	return RaceStateValue.copy(TyreInventory.planned(car, exclude_mounted)) if car != null else {}


func strategy_draft(
	record: Dictionary, laps_value: int, template: String = "balanced"
) -> Dictionary:
	var car = _draft_entrant(record)
	var source: RaceSim = _source.get_ref()
	return (
		StrategyPlan.draft(car, laps_value, template, source.tuning.balance.strategy_defaults)
		if car != null and source != null
		else {}
	)


func strategy_plan_error(
	plan: Variant, record: Dictionary, laps_value: int, current_lap: int = 0
) -> String:
	var car = _draft_entrant(record)
	return (
		StrategyPlan.validate(plan, car, laps_value, current_lap)
		if car != null
		else "The driver data is unavailable."
	)


func practice_setup(record: Dictionary, baseline: String) -> Dictionary:
	var car = _draft_entrant(record)
	return PracticeEvidence.setup_for(car, baseline) if car != null else {}


func practice_key(state: Dictionary, record: Dictionary) -> String:
	var car = _draft_entrant(record)
	return PracticeEvidence.state_key(state, car) if car != null else ""


func reliability_observation(record: Dictionary, reliability_record: Dictionary) -> Dictionary:
	var car = _draft_entrant(record)
	var source: RaceSim = _source.get_ref()
	return (
		RaceReliability.observation(car, reliability_record, source.tuning.operations.reliability)
		if car != null and source != null
		else {}
	)


func rival_description(state: Dictionary, record: Dictionary) -> String:
	var car = _draft_entrant(record)
	var source: RaceSim = _source.get_ref()
	return (
		RivalStyles.public_driver(state, car, source.tuning.competition)
		if car != null and source != null
		else "Driver unavailable."
	)


func tactical_plan_error(plan: Variant, id: int) -> String:
	var source: RaceSim = _source.get_ref()
	if source == null or id < 0 or id >= source.cars.size():
		return "The driver data is unavailable."
	return TacticalForecast.validate_plan(plan, source.cars, id, source.laps)
