class_name RaceDecisionViewModel
extends RefCounted
## One presentation snapshot, sourced only from the existing public forecaster/feed.
## A rendered option remains bound to its driver, set, safe gate and source revision.
static func capture(model: StrategyRaceSim, id: int, forecast: Dictionary) -> Dictionary:
	if id not in [3, 6] or forecast.is_empty(): return {}
	var car = model.cars[id]; var policy = model.policy(id)
	var entries = DecisionFeed.for_driver(model, id, policy, forecast)
	var primary = DecisionFeed.primary(entries)
	var order = model.standings(model.phase in ["qualifying", "qualifying_results"])
	return {"driver_id":id, "name":car.name, "short":car.short, "phase":model.phase,
		"forecast":forecast.duplicate(true), "decisions":entries.duplicate(true), "primary":primary.duplicate(true),
		"revision":int(policy.revision), "position":order.find(car)+1, "set_id":car.set_id,
		"tyre":car.tyre, "fuel":car.fuel, "fuel_margin":RaceForecaster.fuel_margin(model,car),
		"ownership":StrategyPlan.ownership_text(policy), "pit_stops":car.pit_stops,
		"release":RaceForecaster.qualifying_release(model, car)}

static func pit_payload(value: Dictionary) -> Dictionary:
	var f = value.forecast
	return {"id":value.driver_id, "forecast_key":f.key, "forecast_time":f.time, "expected_gate":f.gate.distance, "set_id":f.replacement_id}
