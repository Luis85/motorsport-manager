extends "res://scripts/domain/weekend/tactical_duel_validation.gd"
## Physical duel execution and timed resource targets.


static func review(sim, c: RaceCar) -> bool:
	var id = int(c.id)
	var r = current(sim, id)
	if not owns(r):
		return false
	if not r.order_id.is_empty():
		return true
	if sim.total_time < r.next_review:
		return true
	r.next_review = sim.total_time + 1.0
	var plan = r.plan
	var rival = sim.cars[int(plan.target_id)]
	if rival.dnf or rival.finished:
		finish(
			sim,
			id,
			"review",
			"The target contest ended. Review a new target; the previous pit owner resumes."
		)
		return true
	if (
		plan.kind == "undercut"
		and plan.rival_first
		and (rival.route == "pit" or rival.pit_stops > r.target_stops)
	):
		finish(
			sim,
			id,
			"review",
			"Rival entry observed before our order. Undercut withheld; review or keep the previous pit policy."
		)
		return true
	var preview = TacticalForecast.preview(sim, id, plan)
	if not preview.available:
		finish(sim, id, "review", preview.reason + " Previous pit ownership resumes.")
		return true
	if RaceForecaster.fuel_margin(sim, c) < plan.fuel_reserve:
		finish(
			sim,
			id,
			"review",
			"The observed fuel projection is below the approved reserve. No new tactical stop; review the resource policy."
		)
		return true
	var fitted = TyreInventory.find(c, c.set_id)
	if RaceForecaster.limiting_life(fitted, fitted.life) < plan.tyre_floor:
		finish(
			sim,
			id,
			"review",
			"A limiting wheel crossed the approved tread floor. Review recovery rather than silently extending."
		)
		return true
	var safe = RaceForecaster.reachable_gate(sim, c)
	var release_lap = plan.from_lap + (plan.wait_laps if plan.kind == "extend" else 0)
	if safe.lap < release_lap:
		record_event(
			sim,
			id,
			"preparing",
			(
				"Waiting for the approved lap %d opportunity; physical resources continue to be spent."
				% release_lap
			)
		)
		return true
	if sim.flag != "GREEN":
		record_event(
			sim,
			id,
			"preparing",
			"Race restriction: tactical order withheld. The approved window still expires normally."
		)
		return true
	if preview.candidate.risk == "high":
		finish(
			sim,
			id,
			"review",
			"The remaining-stint estimate is high risk. The tactic did not authorize this exposure; review the plan."
		)
		return true
	if plan.avoid_traffic and (not preview.pit.traffic.is_empty() or preview.pit.queue > 1.0):
		if safe.lap >= plan.to_lap:
			finish(
				sim,
				id,
				"review",
				"The final authorized entry still has traffic or shared-box exposure. No forced stop; review another approach."
			)
		else:
			record_event(
				sim,
				id,
				"preparing",
				"Waiting inside the window to avoid predicted rejoin traffic or a shared-box queue."
			)
		return true
	if TeamOrders.defer_stop(sim, c, {"from_lap": plan.from_lap, "to_lap": plan.to_lap}):
		return true
	sim.order_stop(
		c,
		TyreInventory.find(c, plan.set_id),
		"Tactical %s against %s at the authorized safe entry" % [plan.kind, rival.short]
	)
	r.order_id = sim.policy(id).last_order_id
	r.gate = c.pit_gate
	record_event(
		sim,
		id,
		"ordered",
		(
			"Pit order accepted for %s; awaiting physical entry. A later rival response does not cancel it."
			% plan.set_id
		)
	)
	return true


static func after_step(sim) -> void:
	if not sim.duel_state.enabled:
		return
	for id in sim.player_ids():
		_step_duel(sim, id)


static func resource_targets(sim, c: RaceCar, channel: String = "") -> void:
	var r = current(sim, int(c.id))
	if not owns(r) or not r.order_id.is_empty() or sim.phase != "race":
		return
	var p = sim.policy(int(c.id))
	var plan = r.plan
	var gate_lap = plan.from_lap + (plan.wait_laps if plan.kind == "extend" else 0)
	var distance = maxf(
		0,
		(
			(float(gate_lap) - 1)
			+ sim.track.pit_entry / sim.track.length
			- c.distance / sim.track.length
		)
	)
	if (
		channel in ["", "pace"]
		and StrategyPlan.owns(p, "pace")
		and (
			(
				c.tyre
				- (
					distance
					* c.tyre_rules.spec(c.compound).wear
					* sim.tuning.pace.forecast_wear_factor
				)
			)
			< plan.tyre_floor
		)
	):
		c.pace = 0
	if (
		channel in ["", "engine"]
		and StrategyPlan.owns(p, "engine")
		and RaceForecaster.fuel_margin(sim, c) < plan.fuel_reserve
	):
		c.engine = 0


static func record_event(sim, id: int, status: String, reason: String) -> void:
	var d = sim.duel_state.drivers[id]
	var r = d.active
	if r.is_empty() or r.status == status and r.reason == reason:
		return
	r.status = status
	r.reason = reason
	r.updated_at = sim.total_time
	d.revision += 1
	var event = {"time": sim.total_time, "status": status, "reason": reason}
	if r.events.size() < EVENT_LIMIT:
		r.events.append(event)
	else:
		r.events_truncated = true
	RaceJournal.append(
		sim.strategy_state,
		sim,
		"tactical_plan",
		id,
		{
			"plan_id": r.id,
			"status": status,
			"reason": reason,
			"target_id": int(r.plan.target_id),
			"order_id": r.order_id
		},
		r.id
	)
	sim.post("radio", sim.cars[id].short + " · " + reason)


static func release(sim, id: int, restore_owner: bool = true) -> void:
	var r = current(sim, id)
	if r.is_empty() or not r.borrowed_pits:
		return
	if restore_owner:
		sim.policy(id).owners.pit = r.previous_owner
	r.borrowed_pits = false
	sim.policy(id).revision += 1
	sim.sync_ownership(sim.cars[id])


static func finish(
	sim, id: int, status: String, reason: String, restore_owner: bool = true
) -> void:
	release(sim, id, restore_owner)
	record_event(sim, id, status, reason)


static func _step_duel(sim, id: int) -> void:
	var r = current(sim, id)
	if not live(r):
		return
	var c = sim.cars[id]
	var rival = sim.cars[int(r.plan.target_id)]
	if c.dnf:
		finish(
			sim,
			id,
			"abandoned",
			"Driver retired. Tactical execution ended; no successful pass or strategy gain is inferred."
		)
		return
	if c.finished:
		finish(
			sim,
			id,
			"completed",
			"Race finished. The compared pit cycle remained unresolved; use final classification, not temporary pit positions."
		)
		return
	if rival.dnf or rival.finished:
		finish(
			sim,
			id,
			"completed" if r.own_exit >= 0 else "review",
			"Target contest ended before a comparable pit-cycle observation. No tactical win is inferred."
		)
		return
	if r.status == "review" or sim.phase != "race":
		return
	_observe_duel_cycle(sim, id, r, c, rival)


static func _observe_duel_cycle(
	sim: RaceSim, id: int, r: Dictionary, c: RaceCar, rival: RaceCar
) -> void:
	if r.target_entry < 0 and (rival.route == "pit" or rival.pit_stops > r.target_stops):
		r.target_entry = sim.total_time
		record_event(
			sim,
			id,
			r.status,
			"Rival pit entry observed. This is public execution, not knowledge of its earlier plan."
		)
	if r.target_entry >= 0 and r.target_exit < 0 and rival.route == "track":
		r.target_exit = sim.total_time
	if r.order_id.is_empty():
		if c.pit_order or c.route == "pit":
			finish(
				sim,
				id,
				"abandoned",
				"Another authorized pit transaction took precedence. Its accepted order remains unchanged."
			)
			return
		if sim.average(sim.water) > 0.15:
			finish(
				sim,
				id,
				"review",
				"Conditions left the dry tactical envelope. Review weather strategy; no dry stop was forced."
			)
			return
		if RaceForecaster.reachable_gate(sim, c).lap > r.plan.to_lap:
			finish(
				sim,
				id,
				"review",
				"The last authorized entry passed. No late substitute order was invented."
			)
			return
		if r.plan.authority == "recommend" and sim.total_time >= r.next_review:
			r.next_review = sim.total_time + 1.0
			if r.plan.kind == "undercut" and r.plan.rival_first and r.target_entry >= 0:
				finish(
					sim,
					id,
					"review",
					"Rival entry observed first. Recommendation needs review; manual ownership remains unchanged."
				)
			elif r.status == "approved":
				record_event(
					sim,
					id,
					"preparing",
					"Recommendation is being watched. Compare and issue any pit call manually; silence never authorizes execution."
				)
		return
	if r.own_entry < 0 and c.route == "pit":
		r.own_entry = sim.total_time
		record_event(
			sim,
			id,
			"executing",
			"Physical pit entry observed. Queue, fitting and service remain authoritative."
		)
	if r.own_entry >= 0 and r.own_exit < 0 and c.route == "track":
		r.own_exit = sim.total_time
		var p = sim.policy(id)
		if r.replaced_stop >= 0 and c.set_id == r.plan.set_id and p.revision == r.policy_revision:
			p.next_stop = maxi(int(p.next_stop), int(r.replaced_stop) + 1)
			p.plan_status = (
				"completed" if p.next_stop >= p.plan.get("stops", []).size() else "approved"
			)
		release(sim, id)
		record_event(
			sim,
			id,
			"evaluating",
			(
				"Physical pit exit observed. Previous pit ownership resumes; waiting for the rival "
				+ "cycle before judging relative position."
			)
		)
	if r.own_exit >= 0 and r.target_exit >= 0 and c.route == "track" and rival.route == "track":
		var equivalent = c.pit_stops == r.own_stops + 1 and rival.pit_stops == r.target_stops + 1
		var result = "Different stop counts prevent an equivalent pit-cycle comparison."
		if equivalent:
			result = (
				(
					"%s after both observed pit exits. This is an observed relative position, not proof "
					+ "of causation or the final result."
				)
				% (
					"Ahead of " + rival.name
					if c.distance > rival.distance
					else "Behind " + rival.name
				)
			)
		finish(sim, id, "completed", result)
