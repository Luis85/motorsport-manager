class_name DeveloperWeekendPlanningQueries
extends RefCounted
## Production planning drafts, approval previews and evidence through detached read ports.
const VIEWS = [
	"practice",
	"practice_preview",
	"strategy_draft",
	"strategy_forecast",
	"tactical_draft",
	"tactical_preview",
	"team_orders",
	"recovery",
	"decisions",
	"setup"
]
const STRATEGY_TEMPLATES = ["balanced", "alternate", "no_stop"]


static func describe() -> Array:
	var result: Array = []
	for view in VIEWS:
		result.append({"view": view, "parameters": schema(view)})
	return result


static func schema(view: String) -> Dictionary:
	var fields = {"id": ContentSchema.integer(0, 23)}
	var required: Array = []
	match view:
		"practice_preview":
			fields.plan = _practice_plan()
			required = ["plan"]
		"strategy_draft":
			fields.template = {"enum": STRATEGY_TEMPLATES}
		"strategy_forecast":
			fields.draft = {"type": "object"}
		"tactical_draft":
			fields.kind = {"enum": TacticalForecast.KINDS}
		"tactical_preview":
			fields.plan = {"type": "object"}
			required = ["plan"]
		"team_orders":
			fields = {}
		"setup":
			fields.baseline = {"enum": PracticeEvidence.BASELINES.keys()}
			fields.wetness = ContentSchema.number(0, 1)
	return _object(fields, required)


static func capture(
	simulation: PracticeRaceSim, query: RaceViewQuery, view: String, parameters: Dictionary
) -> Dictionary:
	var diagnostics = ContentValidation.check(parameters, schema(view))
	if not diagnostics.is_empty():
		return DeveloperToolResult.failure(
			"INVALID_ARGUMENT",
			"Planning query parameters do not match this view.",
			{"diagnostics": diagnostics}
		)
	var id = int(parameters.get("id", simulation.player_ids()[0]))
	if id >= simulation.cars.size():
		return DeveloperToolResult.failure("INVALID_ARGUMENT", "Choose an existing entrant ID.")
	var value: Variant
	match view:
		"practice":
			value = {
				"state": query.practice_state,
				"driver": query.practice_driver(id),
				"objectives": PracticeEvidence.OBJECTIVES,
				"baselines": PracticeEvidence.BASELINES
			}
		"practice_preview":
			value = query.run_preview(id, parameters.plan)
		"strategy_draft":
			value = {
				"plan":
				query.strategy_draft(
					query.car(id), simulation.laps, parameters.get("template", "balanced")
				),
				"revision": query.policy(id).revision
			}
		"strategy_forecast":
			return _strategy_forecast(simulation, query, id, parameters.get("draft", {}))
		"tactical_draft":
			value = _tactical_draft(query, id, parameters.get("kind", "undercut"))
		"tactical_preview":
			value = query.tactical_forecast_preview(id, parameters.plan)
		"team_orders":
			value = {"state": query.team_state, "preview": query.team_orders_preview()}
		"recovery":
			value = {"state": query.reliability(id), "advice": query.recovery_advice(id)}
		"decisions":
			value = query.decision_feed_for_driver(id, query.policy(id), query.forecast(id))
		"setup":
			value = _setup(simulation, query, id, parameters)
	return DeveloperToolResult.success(value)


static func _strategy_forecast(
	simulation: PracticeRaceSim, query: RaceViewQuery, id: int, draft: Dictionary
) -> Dictionary:
	if not draft.is_empty():
		var current_lap = (
			maxi(1, int(floor(simulation.cars[id].distance / simulation.track.length)) + 1)
			if simulation.phase == "race"
			else 0
		)
		var error = query.strategy_plan_error(draft, query.car(id), simulation.laps, current_lap)
		if not error.is_empty():
			return DeveloperToolResult.failure("DOMAIN_REJECTED", error)
	return DeveloperToolResult.success(query.forecast(id, draft))


static func _tactical_draft(query: RaceViewQuery, id: int, kind: String) -> Dictionary:
	var state = query.duel_state
	return {
		"plan": query.tactical_forecast_draft(id, kind),
		"enabled": state.get("enabled", false),
		"revision": state.drivers[id].revision if not state.is_empty() else 0,
		"policy_revision": query.policy(id).revision
	}


static func _setup(
	simulation: PracticeRaceSim, query: RaceViewQuery, id: int, parameters: Dictionary
) -> Dictionary:
	var record = query.car(id)
	var wetness = float(parameters.get("wetness", query.average(query.water)))
	return {
		"current": record.car_setup,
		"controls": simulation.setup_definition.specs(),
		"defaults": simulation.setup_definition.defaults(),
		"baseline": query.practice_setup(record, parameters.get("baseline", "current")),
		"effects": query.setup_effects(record, wetness)
	}


static func _practice_plan() -> Dictionary:
	return _object(
		{
			"objective": {"enum": PracticeEvidence.OBJECTIVES.keys()},
			"set_id": ContentSchema.text(96),
			"laps": ContentSchema.integer(1, PracticeEvidence.MAX_LAPS),
			"baseline": {"enum": PracticeEvidence.BASELINES.keys()},
			"manual_modes": {"type": "boolean"}
		},
		["objective", "set_id", "laps", "baseline"]
	)


static func _object(properties: Dictionary, required: Array) -> Dictionary:
	return {
		"type": "object",
		"properties": properties,
		"required": required,
		"additionalProperties": false
	}
