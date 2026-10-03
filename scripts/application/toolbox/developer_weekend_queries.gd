class_name DeveloperWeekendQueries
extends RefCounted
## Explicit read-model adapters. No reflective calls, retained car references or RNG draws.
const VIEWS = (
	["state", "cars", "car", "overview", "weather", "strategy", "mechanics"]
	+ DeveloperWeekendPlanningQueries.VIEWS
)


static func describe() -> Array:
	var result: Array = []
	for view in VIEWS:
		var schema: Dictionary
		if view in DeveloperWeekendPlanningQueries.VIEWS:
			schema = DeveloperWeekendPlanningQueries.schema(view)
		else:
			var properties = (
				{"id": ContentSchema.integer(0, 23)}
				if view in ["car", "weather", "strategy"]
				else {}
			)
			schema = {
				"type": "object",
				"properties": properties,
				"required": [],
				"additionalProperties": false
			}
		result.append({"view": view, "parameters": schema})
	return result


static func capture(
	simulation: PracticeRaceSim, query: RaceViewQuery, view: String, parameters: Dictionary
) -> Dictionary:
	if view not in VIEWS:
		return DeveloperToolResult.failure("UNSUPPORTED_VIEW", "Unknown weekend view: " + view)
	if view in DeveloperWeekendPlanningQueries.VIEWS:
		return DeveloperWeekendPlanningQueries.capture(simulation, query, view, parameters)
	var allowed = ["id"] if view in ["car", "weather", "strategy"] else []
	for key in parameters:
		if key not in allowed:
			return DeveloperToolResult.failure(
				"INVALID_ARGUMENT", "Unsupported query parameter: " + str(key)
			)
	var id = parameters.get("id", simulation.player_ids()[0])
	if (
		view in ["car", "weather", "strategy"]
		and not RaceCheckpoint.integral(id, 0, simulation.cars.size() - 1)
	):
		return DeveloperToolResult.failure("INVALID_ARGUMENT", "Choose an existing entrant ID.")
	match view:
		"state":
			return DeveloperToolResult.success(_state(simulation))
		"cars":
			return DeveloperToolResult.success(query.cars)
		"car":
			return DeveloperToolResult.success(query.car(int(id)))
		"overview":
			return DeveloperToolResult.success(query.race_read_model_capture())
		"weather":
			return DeveloperToolResult.success(
				{
					"observation": simulation.weather_observation(),
					"outlook": simulation.weather_outlook(),
					"advice": query.weather_advice(int(id))
				}
			)
		"strategy":
			return DeveloperToolResult.success(
				{
					"policy": simulation.policy(int(id)).duplicate(true),
					"forecast": simulation.forecast(int(id)),
					"duel": query.tactical_current(int(id))
				}
			)
	return DeveloperToolResult.success(simulation.mechanic_catalog())


static func _state(simulation: PracticeRaceSim) -> Dictionary:
	return {
		"phase": simulation.phase,
		"paused": simulation.paused,
		"speed": simulation.speed,
		"clock": simulation.clock,
		"total_time": simulation.total_time,
		"accumulator": simulation.accumulator,
		"step_seconds": RaceSim.STEP,
		"player_ids": simulation.player_ids()
	}
