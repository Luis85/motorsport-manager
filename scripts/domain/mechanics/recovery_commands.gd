extends "res://scripts/domain/mechanics/recovery_incidents.gd"
## Recovery authority and stale-checked command execution.


func command(sim: RaceSim, action: String, payload: Dictionary = {}) -> bool:
	if not sim.enhanced():
		return sim.mechanics.before("recovery", "command", [action, payload])
	if (
		action
		not in ["recovery_protect", "recovery_repair", "recovery_retire", "recovery_authority"]
	):
		if (
			action in ["repair", "select_set", "compound", "pit", "schedule_pit", "weather_box"]
			and RaceCheckpoint.integral(payload.get("id"), 0, sim.cars.size() - 1)
		):
			var c = sim.cars[int(payload.id)]
			if action == "repair" and c.route == "pit":
				return (
					sim
					. fail(
						"The repair choice is locked after pit entry. The current service plan remains unchanged."
					)
				)
			if sim.reliability(int(c.id)).repair_only and c.pit_order:
				return (
					sim
					. fail(
						"Cancel the uncommitted repair-only order before changing its service or tyre plan."
					)
				)
		var accepted = sim.mechanics.before("recovery", "command", [action, payload])
		if accepted and action in ["cancel_pit", "cancel_schedule"]:
			sim.reliability(int(payload.id)).repair_only = false
		return accepted
	return _recovery_command(sim, action, payload)


func _recovery_command(sim: RaceSim, action: String, payload: Dictionary) -> bool:
	sim.last_error = ""
	if not RaceCheckpoint.integral(payload.get("id"), 0, sim.cars.size() - 1):
		return sim.fail("Name the intended recovery driver.")
	var id = int(payload.id)
	var c = sim.cars[id]
	var r = sim.reliability(id)
	if not c.player or c.dnf or c.finished:
		return sim.fail(
			(
				"Recovery commands require a running Obsidian driver."
				if sim.roster_definition == null
				else "Recovery commands require a running driver from your team."
			)
		)
	if action == "recovery_authority":
		return _recovery_authority(sim, action, payload, r)
	if sim.phase != "race" or c.route != "track":
		return sim.fail("Choose a recovery action for a car racing on track.")
	if sim.recovery_stale(
		{"driver_id": id, "time": payload.get("time"), "key": payload.get("key")}
	):
		return sim.fail(
			"Recovery conditions, ownership or flags changed. Review the current comparison."
		)
	return _recovery_action(sim, action, payload, id, c)


func _recovery_authority(sim: RaceSim, action: String, payload: Dictionary, r: Dictionary) -> bool:
	if (
		sim.phase not in ["briefing", "race_preparation", "race"]
		or not RaceCheckpoint.integral(payload.get("revision"), 0, 1000000)
		or payload.revision != r.revision
	):
		return sim.fail("Review the current recovery authority before changing it.")
	if (
		payload.get("value") not in ["advise", "repair"]
		or not RaceCheckpoint.number(payload.get("budget"), 0, 30)
	):
		return sim.fail(
			"Choose advice or bounded emergency repair with a 0–30 second repair-work budget."
		)
	r.emergency = payload.value
	r.repair_budget = payload.budget
	r.revision += 1
	(
		sim
		. log_recovery_command(
			action,
			payload,
			"Emergency repair authority changed; pit ownership and approved emergency limits still take precedence."
		)
	)
	return true


func _recovery_action(
	sim: RaceSim, action: String, payload: Dictionary, id: int, c: RaceCar
) -> bool:
	if action == "recovery_protect":
		if not sim.mechanics.before(
			"recovery",
			"command",
			["resource_intent", {"id": id, "channel": "engine", "value": 0, "laps": 2}]
		):
			return false
		sim.log_recovery_command(
			action,
			payload,
			(
				"Engine saving for two laps; heat falls gradually. Previous engine owner returns "
				+ "afterward; pit ownership is unchanged."
			)
		)
		return true
	if action == "recovery_retire":
		if payload.get("confirm") != true:
			return sim.fail("Confirm the named driver's irreversible retirement.")
		(
			sim
			. log_recovery_command(
				action,
				payload,
				"Confirmed voluntary retirement; classification is retained and no clearance hazard is fabricated."
			)
		)
		return sim.mechanics.before(
			"recovery", "command", ["retire_car", {"id": id, "confirm": true}]
		)
	return _recovery_repair(sim, action, payload, id, c)


func _recovery_repair(
	sim: RaceSim, action: String, payload: Dictionary, id: int, c: RaceCar
) -> bool:
	var advice = sim.recovery_advice(id)
	if not advice.repair_available:
		return sim.fail(advice.unavailable_reason)
	if (
		not RaceCheckpoint.number(payload.get("gate"), 0, 100000000)
		or absf(payload.gate - advice.gate.distance) > 0.001
	):
		return sim.fail("The safe repair-entry gate changed; review the deferred entry.")
	sim.issue_repair(
		c,
		true,
		"Manual repair-only call; fitted tyres retained and lifetime health is not restored."
	)
	sim.log_recovery_command(
		action,
		payload,
		(
			"Repair-only ordered at the displayed safe gate; manual pit ownership. Remaining tyre "
			+ "windows need explicit re-approval."
		)
	)
	return true
