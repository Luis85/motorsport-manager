extends "res://scripts/domain/mechanics/strategy_policy_commands.gd"
## Validated strategy and ownership commands.


func command(sim: RaceSim, action: String, payload: Dictionary = {}) -> bool:
	sim.last_error = ""
	var is_global = action in GLOBAL_COMMANDS
	if not is_global and not RaceCheckpoint.integral(payload.get("id"), 0, sim.cars.size() - 1):
		return sim.fail("Name the intended driver explicitly.")
	var id = int(sim.player_ids()[0]) if is_global else int(payload.id)
	var c = sim.cars[id]
	var p = sim.policy(id)
	var accepted_payload = payload.duplicate(true)
	accepted_payload.id = id
	var error = _command_preflight(sim, action, payload, id, c, p, is_global)
	if not error.is_empty():
		return sim.fail(error)
	var chosen = _pit_replacement(sim, action, payload, c)
	if chosen.get("error", "") != "":
		return sim.fail(chosen.error)
	var prior: Dictionary = {}
	if action in ["pit", "schedule_pit"]:
		prior = RaceForecaster.capture(sim, id, sim.active_plan(id), int(p.revision))
	if action in POLICY_COMMANDS:
		if not sim.policy_command(action, accepted_payload):
			return false
		sim.commands.append(
			{
				"tick": snappedf(sim.total_time, RaceSim.STEP),
				"action": action,
				"payload": accepted_payload.duplicate(true)
			}
		)
	else:
		if not chosen.is_empty():
			c.next_set_id = chosen.id
			c.next_compound = chosen.compound
		if action == "qualify":
			for car in sim.cars:
				car.auto = StrategyPlan.owns(sim.policy(car.id), "qualifying")
		if not sim.mechanics.before("strategy", "command", [action, accepted_payload]):
			for car in sim.cars:
				sim.sync_ownership(car)
			return false
		_accepted_ownership(sim, action, c, p)
	for car in sim.cars:
		sim.sync_ownership(car)
	return _record_command(sim, action, accepted_payload, c, p, id, is_global, prior)


func _command_failure(message: String) -> String:
	return message


func _command_preflight(
	sim: RaceSim,
	action: String,
	payload: Dictionary,
	id: int,
	c: RaceCar,
	p: Dictionary,
	is_global: bool
) -> String:
	if not is_global and (not c.player or c.dnf or c.finished):
		return _command_failure(
			"Only a running %s driver can receive this command." % sim.player_team_label()
		)
	if action in ["pace", "engine"] and not RaceCheckpoint.integral(payload.get("value"), 0, 2):
		return _command_failure("Choose a valid driving mode.")
	if action == "speed" and not RaceCheckpoint.integral(payload.get("value"), 1, 16):
		return _command_failure("Choose a valid playback speed.")
	if action == "auto" and not payload.get("value") is bool:
		return _command_failure("Choose an explicit delegation state.")
	if action == "send" and not RaceForecaster.qualifying_release(sim, c).can_start_hotlap:
		return "Too late to begin a legal flying lap under the release estimate; the car stays in the garage."
	return _pit_forecast_preflight(sim, action, payload, id, c, p)


func _pit_forecast_preflight(
	sim: RaceSim, action: String, payload: Dictionary, id: int, c: RaceCar, p: Dictionary
) -> String:
	if action == "pit" and payload.has("forecast_key"):
		if (
			payload.get("forecast_key") != RaceForecaster.material_key(sim, id, int(p.revision))
			or not RaceCheckpoint.number(payload.get("forecast_time"), 0, sim.total_time)
			or sim.total_time - float(payload.forecast_time) > RaceForecaster.MAX_AGE
		):
			return _command_failure(
				"The pit forecast is stale. Compare the updated options before committing."
			)
		if (
			not RaceCheckpoint.number(payload.get("expected_gate"), 0, 100000000)
			or absf(payload.expected_gate - RaceForecaster.reachable_gate(sim, c).distance) > 0.001
		):
			return _command_failure(
				"The safe entry has changed. Review the deferred gate before committing."
			)
	return ""


func _accepted_ownership(sim: RaceSim, action: String, c: RaceCar, p: Dictionary) -> void:
	if action in ["pace", "engine"]:
		p.owners[action] = "player"
		p.overrides.erase(action)
	elif action == "auto":
		for channel in StrategyPlan.CHANNELS:
			p.owners[channel] = "engineer" if c.auto else "player"
		p.overrides.clear()
	elif action in ["pit", "schedule_pit", "cancel_pit", "cancel_schedule"]:
		p.owners.pit = "player"
		if not p.plan.is_empty():
			p.plan_status = "overridden"
	elif action in ["compound", "select_set"] and sim.phase == "race":
		p.owners.pit = "player"
	elif action in ["send", "recall"]:
		p.owners.qualifying = "player"
	elif action == "battle_mode":
		p.owners.racecraft = "player"
	if action == "prepare_race":
		for car in sim.cars:
			var existing = sim.policy(car.id)
			if not existing.plan.is_empty():
				var item = TyreInventory.find(car, existing.plan.starting_set)
				if WheelTyres.usable(item):
					car.next_set_id = item.id
					car.next_compound = item.compound


func _pit_replacement(sim: RaceSim, action: String, payload: Dictionary, c: RaceCar) -> Dictionary:
	var chosen: Dictionary = {}
	if action == "pit" and payload.has("set_id"):
		if sim.phase != "race" or c.route != "track" or not payload.set_id is String:
			return {
				"error": "A forecast stop requires a racing car and a specific replacement set."
			}
		chosen = TyreInventory.find(c, payload.set_id)
		if not WheelTyres.usable(chosen) or chosen.id == c.set_id:
			return {"error": "The forecast replacement is no longer available."}
	return chosen


func _record_command(
	sim: RaceSim,
	action: String,
	accepted_payload: Dictionary,
	c: RaceCar,
	p: Dictionary,
	id: int,
	is_global: bool,
	prior: Dictionary
) -> bool:
	var evidence = {
		"action": action,
		"payload": accepted_payload,
		"applied_pace": c.pace,
		"applied_engine": c.engine,
		"distance": c.distance,
		"fuel": c.fuel,
		"tyre": c.tyre,
		"owners": p.owners.duplicate(true)
	}
	var intent_id = RaceJournal.append(
		sim.strategy_state, sim, "command", -1 if is_global else id, evidence
	)
	if action == "resource_intent":
		p.overrides[accepted_payload.channel].id = intent_id
	if action == "approve_plan":
		p.plan_intent_id = intent_id
	if action == "team_order":
		sim.team_state[TeamOrders.slot(accepted_payload.kind)].intent_id = intent_id
	if action in ["pit", "schedule_pit"]:
		p.last_order_id = intent_id
		p.order_forecast = RaceForecaster.pit_prediction(prior, c.pit_gate)
		RaceJournal.append(
			sim.strategy_state,
			sim,
			"strategy_order",
			id,
			{
				"reason":
				(
					"Manual pit order accepted for lap %d%s"
					% [
						int(round((c.pit_gate - sim.track.pit_entry) / sim.track.length)) + 1,
						" · deferred to the next safe entry" if c.pit_deferred else ""
					]
				),
				"prediction": p.order_forecast
			},
			intent_id
		)
	elif action in ["cancel_pit", "cancel_schedule"]:
		p.order_forecast = {}
		p.last_order_id = ""
	return true
