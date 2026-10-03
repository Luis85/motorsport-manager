extends "res://scripts/domain/mechanics/strategy_execution.gd"
## Validated strategy and ownership commands.
## Plan, authority and bounded resource-intent command operations.


func policy_command(sim: RaceSim, action: String, payload: Dictionary) -> bool:
	var c = sim.cars[int(payload.id)]
	var p = sim.policy(c.id)
	var accepted = true
	match action:
		"team_order":
			accepted = _policy_team_order(sim, c, p, payload)
		"cancel_team_order":
			accepted = _policy_cancel_team_order(sim, c, p, payload)
		"approve_plan":
			accepted = _policy_approve_plan(sim, c, p, payload)
		"clear_plan":
			accepted = _policy_clear_plan(sim, c, p, payload)
		"delegation":
			accepted = _policy_delegation(sim, c, p, payload)
		"resource_intent":
			accepted = _policy_resource_intent(sim, c, p, payload)
		"hold_decision":
			accepted = _policy_hold_decision(sim, c, p, payload)
		"retire_car":
			accepted = _policy_retire_car(sim, c, p, payload)
	if not accepted:
		return false
	sim.post(
		"radio",
		"%s · %s accepted. Unrelated ownership is unchanged." % [c.short, action.replace("_", " ")]
	)
	return true


func _policy_team_order(sim: RaceSim, _c: RaceCar, _p: Dictionary, payload: Dictionary) -> bool:
	var error = TeamOrders.validate(sim, payload)
	if not error.is_empty():
		return sim.fail(error)
	TeamOrders.accept(sim, payload)
	return true


func _policy_cancel_team_order(
	sim: RaceSim, _c: RaceCar, _p: Dictionary, payload: Dictionary
) -> bool:
	if (
		payload.get("slot") not in ["track_order", "pit_priority"]
		or payload.get("revision") != sim.team_state.revision
	):
		return sim.fail("Review the current team instruction before cancelling it.")
	var record = sim.team_state[payload.slot]
	if (
		not TeamOrders.active(record)
		or payload.get("intent_id") != record.intent_id
		or int(payload.id) not in [int(record.actor_id), int(record.teammate_id)]
	):
		return sim.fail("There is no matching active team instruction.")
	TeamOrders.finish(
		sim,
		payload.slot,
		"cancelled",
		"Cancelled by the pit wall; physical positions and accepted pit orders are unchanged."
	)
	return true


func _policy_approve_plan(sim: RaceSim, c: RaceCar, p: Dictionary, payload: Dictionary) -> bool:
	if sim.phase not in ["briefing", "race_preparation", "race"] or c.route == "pit" or c.pit_order:
		return sim.fail("Approve a plan in preparation or on track with no committed pit order.")
	if (
		not RaceCheckpoint.integral(payload.get("revision"), 0, 1000000)
		or payload.revision != p.revision
	):
		return sim.fail(
			"This draft is based on an older plan. Reload the current plan before applying."
		)
	var plan = payload.get("plan")
	var error = StrategyPlan.validate(
		plan,
		c,
		sim.laps,
		maxi(1, int(floor(c.distance / sim.track.length)) + 1) if sim.phase == "race" else 0
	)
	if not error.is_empty():
		return sim.fail(error)
	if sim.phase == "race" and plan.starting_set != c.set_id:
		return sim.fail("A live plan must start with the actually fitted set.")
	if sim.phase == "race":
		var safe = RaceForecaster.reachable_gate(sim, c)
		for stop in plan.stops:
			if stop.to_lap < safe.lap:
				return sim.fail("The proposed pit window is no longer reachable.")
	p.plan = plan.duplicate(true)
	p.revision += 1
	p.next_stop = 0
	p.plan_status = "approved"
	p.owners.pit = "engineer"
	p.blocked_reason = ""
	p.next_review = sim.total_time
	if sim.phase != "race":
		var item = TyreInventory.find(c, plan.starting_set)
		c.next_set_id = item.id
		c.next_compound = item.compound
	return true


func _policy_clear_plan(sim: RaceSim, c: RaceCar, p: Dictionary, _payload: Dictionary) -> bool:
	if sim.phase not in ["briefing", "race_preparation", "race"] or c.route == "pit" or c.pit_order:
		return sim.fail("Cancel any uncommitted order first; a committed stop cannot be replaced.")
	p.plan = {}
	p.revision += 1
	p.next_stop = 0
	p.plan_status = "unplanned"
	p.owners.pit = "player"
	p.blocked_reason = ""
	return true


func _policy_delegation(sim: RaceSim, _c: RaceCar, p: Dictionary, payload: Dictionary) -> bool:
	if (
		payload.get("channel") not in StrategyPlan.CHANNELS
		or payload.get("owner") not in ["engineer", "player"]
	):
		return sim.fail("Choose an explicit domain and owner.")
	p.owners[payload.channel] = payload.owner
	p.overrides.erase(payload.channel)
	if payload.channel == "pit" and payload.owner == "engineer" and not p.plan.is_empty():
		p.plan_status = "approved"
		p.next_review = sim.total_time
	return true


func _policy_resource_intent(sim: RaceSim, c: RaceCar, p: Dictionary, payload: Dictionary) -> bool:
	if sim.phase != "race" or payload.get("channel") not in ["pace", "engine"]:
		return sim.fail("Temporary pace and engine intents require a live race.")
	if (
		not RaceCheckpoint.integral(payload.get("value"), 0, 2)
		or not RaceCheckpoint.integral(payload.get("laps"), 1, 5)
	):
		return sim.fail("Use a valid mode for one to five laps.")
	var channel: String = payload.channel
	var previous = p.overrides.get(channel, {}).get("previous_value", c[channel])
	p.overrides[channel] = {
		"id": "pending",
		"value": int(payload.value),
		"previous_value": int(previous),
		"until_distance": maxf(0, c.distance) + payload.laps * sim.track.length
	}
	c[channel] = int(payload.value)
	return true


func _policy_hold_decision(sim: RaceSim, c: RaceCar, p: Dictionary, payload: Dictionary) -> bool:
	if (
		payload.get("issue") not in ["pit", "fuel", "tyre", "plan", "qualifying"]
		or not payload.get("key") is String
		or payload.key.length() != 64
	):
		return sim.fail("Select a current decision to acknowledge.")
	if payload.key != RaceForecaster.material_key(sim, c.id, int(p.revision)):
		return sim.fail(
			"That decision changed. Read the current conditions before keeping the plan."
		)
	p.held[payload.issue] = DecisionFeed.acknowledgement_key(sim, c.id, payload.issue, p)
	return true


func _policy_retire_car(sim: RaceSim, c: RaceCar, _p: Dictionary, payload: Dictionary) -> bool:
	if sim.phase != "race" or payload.get("confirm") != true:
		return sim.fail("Confirm a voluntary retirement during the race.")
	sim.retire(c, "Retired by the pit wall")
	return true
