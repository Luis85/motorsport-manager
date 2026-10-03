class_name TacticalDuels
extends "res://scripts/domain/weekend/tactical_duel_execution.gd"


static func create(cars: Array, enabled: bool) -> Dictionary:
	var drivers: Array = []
	for c in cars:
		drivers.append(
			{"driver_id": int(c.id), "revision": 0, "active": {}, "history": [], "truncated": false}
		)
	return {"version": VERSION, "enabled": enabled, "sequence": 0, "drivers": drivers}


static func archive(driver: Dictionary) -> void:
	if driver.active.is_empty():
		return
	driver.history.append(driver.active.duplicate(true))
	if driver.history.size() > HISTORY_LIMIT:
		driver.history.pop_front()
		driver.truncated = true
	driver.active = {}


static func command(sim, action: String, payload: Dictionary) -> bool:
	if not sim.duel_state.enabled:
		return (
			sim
			. fail(
				"This saved weekend retains the earlier model. Start a new Strategic Duels weekend to use tactical plans."
			)
		)
	if not RaceCheckpoint.integral(payload.get("id"), 0, sim.cars.size() - 1):
		return sim.fail("Name the intended driver explicitly.")
	var id = int(payload.id)
	var c = sim.cars[id]
	var d = sim.duel_state.drivers[id]
	if not c.player:
		return sim.fail("A rival cannot receive your tactical commands.")
	if (
		not RaceCheckpoint.integral(payload.get("revision"), 0, 1000000)
		or payload.revision != d.revision
	):
		return sim.fail("The tactical record changed. Review it before committing.")
	if d.revision >= 999999 or sim.duel_state.sequence >= 999999:
		return sim.fail("The tactical history limit has been reached for this weekend.")
	if action == "duel_cancel":
		if not live(d.active) or payload.get("plan_id") != d.active.id:
			return sim.fail("There is no matching active tactical plan to end.")
		finish(
			sim,
			id,
			"abandoned",
			"Ended by the player. Any accepted pit order stays valid; use ordinary pit cancellation before entry."
		)
	else:
		if live(d.active) and d.active.status != "review":
			return sim.fail("End or review the active tactic before approving another.")
		if not payload.get("plan") is Dictionary:
			return sim.fail("Review a complete tactical draft first.")
		var preview = TacticalForecast.preview(sim, id, payload.plan)
		if not preview.available:
			return sim.fail(preview.reason)
		if (
			payload.get("key") != preview.key
			or not RaceCheckpoint.number(payload.get("time"), 0, sim.total_time)
			or sim.total_time - payload.time > sim.tuning.balance.forecast.maximum_age_seconds
		):
			return sim.fail("The tactical comparison is stale. Refresh it before approval.")
		if (
			not RaceCheckpoint.integral(payload.get("policy_revision"), 0, 1000000)
			or payload.policy_revision != sim.policy(id).revision
		):
			return sim.fail("The underlying pit policy changed. Review it first.")
		if live(d.active):
			finish(
				sim,
				id,
				"abandoned",
				"Replaced after an explicit new comparison; previous evidence retained."
			)
		archive(d)
		var p = sim.policy(id)
		var target = sim.cars[int(payload.plan.target_id)]
		sim.duel_state.sequence += 1
		var record = {
			"id": "duel-%d" % int(sim.duel_state.sequence),
			"driver_id": id,
			"plan": payload.plan.duplicate(true),
			"status": "approved",
			"reason": "",
			"created_at": sim.total_time,
			"updated_at": sim.total_time,
			"next_review": sim.total_time,
			"previous_owner": p.owners.pit,
			"borrowed_pits": payload.plan.authority == "execute",
			"policy_revision": int(p.revision),
			"replaced_stop":
			int(p.next_stop) if p.next_stop < p.plan.get("stops", []).size() else -1,
			"own_stops": int(c.pit_stops),
			"target_stops": int(target.pit_stops),
			"own_entry": -1.0,
			"own_exit": -1.0,
			"target_entry": sim.total_time if target.route == "pit" else -1.0,
			"target_exit": -1.0,
			"order_id": "",
			"gate": -1.0,
			"events": [],
			"events_truncated": false,
			"forecast":
			{
				"time": preview.time,
				"key": preview.key,
				"gain": preview.candidate.gain,
				"seconds": preview.candidate.seconds,
				"pit_loss": preview.pit.loss,
				"warmup": preview.pit.warmup,
				"traffic": preview.candidate.traffic_cost,
				"gap": preview.gap,
				"rival_cases": preview.rival_cases
			}
		}
		d.active = record
		if record.borrowed_pits:
			p.owners.pit = "engineer"
			p.revision += 1
			record.policy_revision = int(p.revision)
		record_event(
			sim,
			id,
			"approved",
			(
				"Approved %s against %s. %s"
				% [
					TacticalForecast.LABELS[record.plan.kind],
					target.name,
					(
						"Pit timing only is delegated temporarily; other owners are unchanged."
						if record.borrowed_pits
						else "Recommendation only; existing pit ownership and orders are unchanged."
					)
				]
			)
		)
		sim.sync_ownership(c)
	sim.commands.append(
		{
			"tick": snappedf(sim.total_time, RaceSim.STEP),
			"action": action,
			"payload": payload.duplicate(true)
		}
	)
	return true


static func after_command(sim, action: String, payload: Dictionary) -> void:
	if (
		not sim.duel_state.enabled
		or action in ACTIONS
		or not RaceCheckpoint.integral(payload.get("id"), 0, sim.cars.size() - 1)
	):
		return
	var id = int(payload.id)
	var r = current(sim, id)
	if not live(r):
		return
	var supersedes = (
		action
		in [
			"approve_plan",
			"clear_plan",
			"pit",
			"schedule_pit",
			"cancel_pit",
			"cancel_schedule",
			"select_set",
			"compound",
			"weather_box",
			"recovery_repair",
			"auto",
			"retire_car",
			"recovery_retire"
		]
	)
	if action == "delegation" and payload.get("channel") == "pit":
		supersedes = true
	if not supersedes:
		return
	# A pre-race set edit does not transfer pit authority. Every other listed
	# command explicitly supersedes it; never restore an old owner over that choice.
	var restore_owner = action in ["select_set", "compound"] and sim.phase != "race"
	finish(
		sim,
		id,
		"abandoned",
		(
			"Superseded by the accepted %s command. Its ownership and any physical pit transaction are retained."
			% action.replace("_", " ")
		),
		restore_owner
	)


static func describe(sim, id: int) -> String:
	if sim.duel_state.is_empty() or not sim.duel_state.enabled:
		return "Earlier saved model retained; tactical plans are available in new weekends."
	var d = sim.duel_state.drivers[id]
	var r = d.active
	if r.is_empty():
		return (
			"No tactical plan for "
			+ sim.cars[id].name
			+ ". Existing strategy and ownership remain active."
		)
	var p = r.plan
	var lines: Array[String] = [
		"%s · %s" % [sim.cars[id].name, TacticalForecast.LABELS[p.kind]],
		(
			"Target: %s · %s · %s"
			% [
				sim.cars[int(p.target_id)].name,
				r.status.to_upper(),
				"PITS DELEGATED" if r.borrowed_pits else "NO TACTICAL EXECUTION AUTHORITY"
			]
		),
		(
			"Window %d–%d · %s · floor %.0f%% / fuel reserve %.2f lap units"
			% [p.from_lap, p.to_lap, p.set_id, p.tyre_floor, p.fuel_reserve]
		),
		r.reason,
		(
			(
				"At approval: estimated gain %+.1fs against the current plan; pit loss ~%.1fs, "
				+ "warm-up ~%.1fs. Not calibrated probabilities."
			)
			% [r.forecast.gain, r.forecast.pit_loss, r.forecast.warmup]
		)
	]
	lines.append(r.forecast.rival_cases)
	for event in r.events:
		lines.append("%.1fs · %s · %s" % [event.time, event.status, event.reason])
	if r.events_truncated:
		(
			lines
			. append(
				"The 20-event tactical detail limit was reached. Consult the retained race journal for later records."
			)
		)
	if d.truncated:
		lines.append("Only the latest eight previous tactical plans are retained here.")
	return "\n\n".join(lines)


static func debrief(sim) -> String:
	if sim.duel_state.is_empty() or not sim.duel_state.enabled:
		return ""
	var lines: Array[String] = ["STRATEGIC DUELS · APPROVAL, EXECUTION, OBSERVATION"]
	for id in sim.player_ids():
		lines.append(describe(sim, id))
		for r in sim.duel_state.drivers[id].history:
			lines.append("Previous %s · %s · %s" % [r.id, r.status, r.reason])
	return "\n\n".join(lines)
