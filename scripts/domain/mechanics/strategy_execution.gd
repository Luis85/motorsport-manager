extends RaceMechanic
## Authoritative strategy rules; caller supplies state, never a view or singleton.
const GLOBAL_COMMANDS = [
	"qualify", "close_qualifying", "prepare_race", "formation", "lights", "pause", "speed"
]
const POLICY_COMMANDS = [
	"approve_plan",
	"clear_plan",
	"delegation",
	"resource_intent",
	"hold_decision",
	"retire_car",
	"team_order",
	"cancel_team_order"
]
## Strategy resource ownership, engineer decisions and on-track execution.


func manage_resources(sim: RaceSim, c: RaceCar, only_channel: String = "") -> void:
	var p = sim.policy(c.id)
	var remaining = maxf(0, sim.laps - c.distance / sim.track.length)
	var emergency = not WheelTyres.usable(TyreInventory.find(c, c.set_id))
	var target = remaining
	var plan = sim.active_plan(c.id)
	if not plan.get("stops", []).is_empty():
		target = maxf(
			0.1,
			(
				float(plan.stops[0].to_lap - 1)
				+ sim.track.pit_entry / sim.track.length
				- c.distance / sim.track.length
			)
		)
	var reserve = float(plan.get("tyre_reserve", sim.tuning.balance.strategy_defaults.tyre_reserve))
	if StrategyPlan.owns(p, "pace") and only_channel in ["", "pace"]:
		var wear = c.tyre_rules.spec(c.compound).wear * sim.tuning.pace.forecast_wear_factor
		c.pace = (
			0
			if (
				emergency
				or sim.flag != "GREEN"
				or c.tyre - target * wear < reserve
				or c.engine_temperature > sim.tuning.competition.policy.pace_temperature_c
			)
			else 1
		)
	if StrategyPlan.owns(p, "engine") and only_channel in ["", "engine"]:
		var margin = c.fuel - remaining
		c.engine = (
			0
			if (
				emergency
				or (
					margin
					< float(
						plan.get(
							"fuel_reserve", sim.tuning.balance.strategy_defaults.fuel_reserve_laps
						)
					)
				)
				or c.engine_temperature > sim.tuning.condition.heat_reference_c
			)
			else 1
		)
	if StrategyPlan.owns(p, "racecraft") and only_channel.is_empty():
		c.battle_mode = (
			"patient"
			if (
				plan.get("objective") == "protect_finish"
				or c.damage > sim.tuning.competition.policy.repair_damage
			)
			else "balanced"
		)
		if (
			plan.get("objective") == "chase_position"
			and c.tyre > sim.tuning.competition.policy.attack_tread
			and c.damage < sim.tuning.competition.policy.attack_damage
			and sim.flag == "GREEN"
			and RaceForecaster.fuel_margin(sim, c) > 0
		):
			c.battle_mode = "assertive"


func engineer(sim: RaceSim, c: RaceCar) -> void:
	if sim.phase != "race" or c.route != "track" or c.dnf or c.finished:
		return
	sim.manage_resources(c)
	var p = sim.policy(c.id)
	if not StrategyPlan.owns(p, "pit") or c.pit_order:
		return
	var remaining = maxf(0, sim.laps - c.distance / sim.track.length)
	var safe = RaceForecaster.reachable_gate(sim, c)
	if safe.distance >= sim.laps * sim.track.length:
		return
	var emergency = not WheelTyres.usable(TyreInventory.find(c, c.set_id))
	if emergency and p.plan.get("allow_emergency", true):
		_emergency_stop(sim, c)
		return
	if not p.plan.is_empty():
		_execute_plan_window(sim, c, p, safe, emergency)
		return
	_review_unplanned_stop(sim, c, p, remaining, safe)


func contextual_rival(_sim: RaceSim, _car: RaceCar) -> bool:
	return false


func review_rival_style(
	_sim: RaceSim, _car: RaceCar, _snapshot: Dictionary, _comparison: Dictionary
) -> bool:
	return false


func order_stop(sim: RaceSim, c: RaceCar, item: Dictionary, reason: String) -> void:
	var p = sim.policy(c.id)
	var source = RaceForecaster.capture(sim, c.id, sim.active_plan(c.id), int(p.revision))
	c.next_compound = item.compound
	c.next_set_id = item.id
	c.scheduled_lap = -1
	sim.queue_pit(c)
	p.order_forecast = RaceForecaster.pit_prediction(source, c.pit_gate)
	p.last_order_id = RaceJournal.append(
		sim.strategy_state,
		sim,
		"strategy_order",
		c.id,
		{
			"reason": reason,
			"set_id": item.id,
			"gate": c.pit_gate,
			"prediction": p.order_forecast,
			"scope": source.scope
		},
		p.plan_intent_id
	)
	if not sim.contextual_rival(c):
		sim.post("pit", "%s · %s. Physical pit entry remains authoritative." % [c.short, reason])


func block_plan(sim: RaceSim, c: RaceCar, reason: String) -> void:
	var p = sim.policy(c.id)
	if p.blocked_reason == reason:
		return
	p.blocked_reason = reason
	p.plan_status = "blocked"
	RaceJournal.append(
		sim.strategy_state, sim, "plan_blocked", c.id, {"reason": reason}, p.plan_intent_id
	)
	sim.post("radio", c.short + " · " + reason)


func leave_garage(sim: RaceSim, c: RaceCar) -> void:
	if not RaceForecaster.qualifying_release(sim, c).can_start_hotlap:
		return
	sim.mechanics.before("strategy", "leave_garage", [c])


func record_stint(sim: RaceSim, c: RaceCar) -> void:
	sim.mechanics.before("strategy", "record_stint", [c])
	if not c.stints.is_empty():
		c.stints.back().start_life = c.tyre


func traffic_instruction(
	sim: RaceSim,
	c: RaceCar,
	old: Array,
	nearest: int,
	gap: float,
	desired: float,
	lane: float,
	sample: Dictionary,
	local: Dictionary
) -> Dictionary:
	var base = sim.mechanics.before(
		"strategy", "traffic_instruction", [c, old, nearest, gap, desired, lane, sample, local]
	)
	if sim.phase != "race":
		return base
	var blocked = TeamOrders.track_blocks(sim, c, nearest)
	var result = RacecraftController.instruction(sim, c, old, nearest, base, sample, local, blocked)
	var record = sim.battle_state.drivers[int(c.id)]
	if not result.attempt and (blocked or nearest == int(record.target_id) and nearest >= 0):
		result.lane = lane
		if nearest >= 0 and old[nearest].distance > old[int(c.id)].distance:
			result.block_pass = true
	return TeamOrders.traffic(sim, c, old, nearest, result, sample, local)


func record_track_pass(_sim: RaceSim, _c: RaceCar, _other: RaceCar) -> void:
	# A centre-line crossing is not a resolved contest. after_step records clearance once.
	pass


func move_car(sim: RaceSim, c: RaceCar, old: Array) -> void:
	sim.mechanics.before("strategy", "move_car", [c, old])
	if sim.phase != "race" or c.pit_order or c.blue or c.route != "track":
		return
	c.intent = RacecraftController.describe(sim.battle_state, int(c.id), sim.cars)
	var order = sim.team_state.track_order
	if TeamOrders.active(order) and int(c.id) in [int(order.actor_id), int(order.teammate_id)]:
		c.intent = "Team %s · %s" % [order.kind, order.reason]


func observe_warnings(sim: RaceSim, c: RaceCar) -> void:
	var p = sim.policy(c.id)
	var active: Array = []
	for card in DecisionFeed.for_driver(sim, c.id, p, {}):
		if card.priority < 90:
			continue
		active.append(card.issue)
		if p.notices.get(card.issue, "") == card.dedup_key:
			continue
		p.notices[card.issue] = card.dedup_key
		RaceJournal.append(
			sim.strategy_state,
			sim,
			"warning",
			c.id,
			{
				"reason": card.title + ": " + card.evidence,
				"fallback": card.fallback,
				"issue": card.issue
			}
		)
		sim.post("radio", c.short + " · " + card.title + ". " + card.evidence)
	for issue in p.notices.keys():
		if issue not in active:
			p.notices.erase(issue)


func _review_unplanned_stop(
	sim: RaceSim, c: RaceCar, p: Dictionary, remaining: float, safe: Dictionary
) -> void:
	if (
		sim.total_time < p.next_review
		or remaining < sim.tuning.competition.policy.stop_remaining_laps
	):
		return
	p.next_review = (
		sim.total_time
		+ sim.tuning.competition.policy.review_seconds
		+ float(c.id % 3) * sim.tuning.competition.policy.review_stagger_seconds
	)
	if (
		c.tyre > sim.tuning.competition.policy.healthy_tread
		and c.damage < sim.tuning.competition.policy.repair_damage
		and c.compound == sim.recommended_compound()
		and not sim.contextual_rival(c)
	):
		return
	var snapshot = RaceForecaster.capture(sim, c.id)
	var comparison = RaceForecaster.evaluate(snapshot)
	var candidate: Dictionary = {}
	for option in comparison.options:
		if option.id == "box" and option.available:
			candidate = option
	var item = RaceForecaster.replacement(snapshot)
	if item.is_empty() or candidate.is_empty():
		return
	var urgent = (
		c.tyre < sim.tuning.competition.policy.urgent_tread
		or c.damage > sim.tuning.competition.policy.repair_damage
		or (
			c.compound != sim.recommended_compound()
			and (c.tyre_rules.wet(c.compound) or sim.tyre_rules.wet(sim.recommended_compound()))
		)
	)
	var memory = sim.rival_state.drivers[int(c.id)]
	if not urgent and sim.flag == "GREEN" and memory.hold_gate >= safe.distance:
		return
	if not urgent:
		if sim.review_rival_style(c, snapshot, comparison):
			return
		var response = RivalStrategy.response(snapshot, sim.rival_state.stops, memory, comparison)
		if not response.is_empty():
			for field in ["kind", "event_id", "hold_gate", "reason"]:
				memory[field] = response[field]
			RaceJournal.append(
				sim.strategy_state,
				sim,
				"strategy_response",
				int(c.id),
				{"reason": response.reason, "kind": response.kind, "observation": response.evidence}
			)
			if response.kind == "cover" and not TeamOrders.defer_stop(sim, c):
				sim.order_stop(c, item, response.reason)
			return
	# Same public-context candidate model for every team; no hidden boost or future weather.
	var worthwhile = (
		(
			candidate.gain
			> maxf(
				sim.tuning.competition.policy.minimum_gain_seconds,
				comparison.pit.loss * sim.tuning.competition.policy.pit_loss_gain_factor
			)
		)
		and candidate.risk != "high"
	)
	if urgent or worthwhile and not TeamOrders.defer_stop(sim, c):
		sim.order_stop(
			c,
			item,
			(
				"Observed-resource recovery"
				if urgent
				else (
					"Public timing / tyre-offset comparison favors a stop; estimated gain %.1fs"
					% candidate.gain
				)
			)
		)


func _emergency_stop(sim: RaceSim, c: RaceCar) -> void:
	var item = TyreInventory.choose(c, sim.recommended_compound(), true)
	if item.is_empty():
		for compound in sim.tyre_rules.compounds():
			item = TyreInventory.choose(c, compound, true)
			if not item.is_empty():
				break
	if item.is_empty():
		sim.block_plan(c, "No sound replacement is available for the damaged tyre.")
	else:
		sim.order_stop(c, item, "Authorized damaged-tyre recovery at the next safe entry")
	return


func _execute_plan_window(
	sim: RaceSim, c: RaceCar, p: Dictionary, safe: Dictionary, emergency: bool
) -> void:
	if p.next_stop >= p.plan.stops.size():
		return
	var window = p.plan.stops[int(p.next_stop)]
	if safe.lap < window.from_lap:
		return
	if safe.lap > window.to_lap:
		sim.block_plan(
			c, "The approved window is no longer reachable. Re-plan or take manual control."
		)
		return
	_execute_window_stop(sim, c, p, safe, emergency, window)


func _execute_window_stop(
	sim: RaceSim, c: RaceCar, p: Dictionary, safe: Dictionary, emergency: bool, window: Dictionary
) -> void:
	var item = TyreInventory.find(c, window.set_id)
	if not WheelTyres.usable(item) or item.id == c.set_id:
		sim.block_plan(c, "The approved replacement set is unavailable. Choose a new plan.")
		return
	if TeamOrders.defer_stop(sim, c, window):
		return
	var preview = RaceForecaster.pit_prediction(RaceForecaster.capture(sim, c.id))
	if (
		"avoid_traffic" in p.plan.branches
		and safe.lap < window.to_lap
		and (
			preview.queue > sim.tuning.competition.policy.traffic_queue_seconds
			or not preview.traffic.is_empty()
		)
		and not emergency
	):
		return
	sim.order_stop(
		c,
		item,
		(
			"Approved window: lap %d–%d; estimated queue %.1fs"
			% [window.from_lap, window.to_lap, preview.queue]
		)
	)
	return
