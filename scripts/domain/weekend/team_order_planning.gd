extends RefCounted
## Team instructions constrain future legal choices; they never move or reorder cars.
const ACTIVE = ["waiting", "executing", "staggered", "queue"]
const STATUSES = ["waiting", "executing", "staggered", "queue", "completed", "cancelled", "expired"]
## Shared-box planning, detached preview and explicit stop deferral.


static func planned_gate(sim, car: RaceCar) -> float:
	if car.pit_order:
		return car.pit_gate
	var plan = sim.active_plan(car.id)
	if not StrategyPlan.owns(sim.policy(car.id), "pit") or plan.get("stops", []).is_empty():
		return -1.0
	var window = plan.stops[0]
	var safe = RaceForecaster.reachable_gate(sim, car)
	if safe.lap > window.to_lap:
		return -1.0
	var gate = maxf(safe.distance, (window.from_lap - 1) * sim.track.length + sim.track.pit_entry)
	var priority = sim.team_state.pit_priority
	if active(priority) and car.id == priority.teammate_id and priority.deferred_gate >= 0:
		gate = maxf(gate, priority.deferred_gate + sim.track.length)
	return gate


static func preview(sim) -> Dictionary:
	var rows: Array = []
	for id in sim.player_ids():
		var car = sim.cars[id]
		var snapshot = RaceForecaster.capture(sim, id)
		var gate = planned_gate(sim, car)
		var origin = (
			"accepted order"
			if car.pit_order
			else ("approved window" if gate >= 0 else "hypothetical next entry")
		)
		if gate < 0:
			gate = snapshot.gate.distance
		var context = snapshot.get("model_context", {})
		var arrival = (
			(
				maxf(0, gate - car.distance)
				/ (sim.track.length / sim.track.estimate * context.get("neutral_factor", 1.0))
			)
			+ car.box_d / sim.track.pit_limit
			+ sim.tuning.service.arrival_allowance_seconds
		)
		if car.route == "pit":
			arrival = (
				0.0
				if car.pit_stage == "service"
				else maxf(0, car.box_d - car.pit_d) / sim.track.pit_limit
			)
			origin = "physically committed"
		rows.append(
			{
				"id": id,
				"short": car.short,
				"arrival": arrival,
				"eligible": not car.dnf and not car.finished and car.pit_stage != "exit",
				"service":
				(
					car.pit_timer
					if car.pit_stage == "service"
					else (
						RaceTuningDefinition.mean_service(
							sim.tuning.service, context.get("repair_only", false)
						)
						+ (
							car.damage * sim.tuning.service.repair_seconds_per_damage
							if car.repair
							else 0.0
						)
					)
				),
				"origin": origin
			}
		)
		if car.dnf or car.finished:
			rows.back().origin = "not running"
			rows.back().arrival = 0.0
		elif car.pit_stage == "exit":
			rows.back().origin = "service completed; releasing"
			rows.back().arrival = 0.0
	rows.sort_custom(
		func(a, b): return a.arrival < b.arrival if a.arrival != b.arrival else a.id < b.id
	)
	return {
		"first": rows[0],
		"second": rows[1],
		"queue":
		(
			maxf(0, rows[0].arrival + rows[0].service - rows[1].arrival)
			if rows[0].eligible and rows[1].eligible
			else 0.0
		),
		"note": "Estimate, not a reserved slot. Actual arrival and the physical box decide order."
	}


static func defer_stop(sim, car: RaceCar, window: Dictionary = {}) -> bool:
	var record = sim.team_state.pit_priority
	if (
		not active(record)
		or car.id != record.teammate_id
		or not StrategyPlan.owns(sim.policy(car.id), "pit")
	):
		return false
	var primary = sim.cars[int(record.actor_id)]
	var safe = RaceForecaster.reachable_gate(sim, car)
	var mounted = TyreInventory.find(car, car.set_id)
	var limiting_life = float(car.tyre)
	for wheel in mounted.get("wheels", {}).values():
		limiting_life = minf(limiting_life, wheel.life)
	var safe_resources = (
		WheelTyres.usable(mounted)
		and (
			(
				limiting_life
				- (
					car.tyre_rules.spec(car.compound).wear
					* sim.tuning.competition.team.priority_wear_factor
				)
			)
			> sim.tuning.competition.team.priority_tread
		)
		and car.damage < sim.tuning.competition.policy.repair_damage
	)
	if (
		car.compound != sim.recommended_compound()
		and (car.tyre_rules.wet(car.compound) or sim.tyre_rules.wet(sim.recommended_compound()))
	):
		safe_resources = false
	if not safe_resources:
		record.status = "queue"
		record.reason = "Recovery takes priority; a physical queue may be necessary."
		return false
	if record.deferred_gate >= 0:
		return safe.distance <= record.deferred_gate
	var primary_gate = planned_gate(sim, primary)
	if primary_gate < 0:
		return false
	var context = sim.forecast_parameters(int(primary.id))
	var velocity = sim.track.length / sim.track.estimate * context.get("neutral_factor", 1.0)
	var primary_arrival = (
		maxf(0, primary_gate - primary.distance) / velocity + primary.box_d / sim.track.pit_limit
	)
	var secondary_arrival = (
		maxf(0, safe.distance - car.distance) / velocity + car.box_d / sim.track.pit_limit
	)
	var service = (
		RaceTuningDefinition.mean_service(sim.tuning.service, context.get("repair_only", false))
		+ (primary.damage * sim.tuning.service.repair_seconds_per_damage if primary.repair else 0.0)
	)
	if (
		absf(primary_arrival - secondary_arrival)
		> service + sim.tuning.competition.team.priority_queue_margin_seconds
	):
		return false
	if (
		(not window.is_empty() and safe.lap >= window.to_lap)
		or safe.distance + sim.track.length >= sim.laps * sim.track.length
	):
		record.status = "queue"
		record.reason = "No later legal entry inside the approved window; priority cannot rewrite it."
		return false
	record.deferred_gate = safe.distance
	record.status = "staggered"
	record.reason = (
		"%s waits one entry inside authorized discretion, giving %s the first opportunity."
		% [car.short, primary.short]
	)
	RaceJournal.append(
		sim.strategy_state,
		sim,
		"team_priority_defer",
		int(car.id),
		{
			"reason": record.reason,
			"skipped_gate": safe.distance,
			"next_gate": safe.distance + sim.track.length
		},
		record.intent_id
	)
	return true


static func active(record: Dictionary) -> bool:
	return not record.is_empty() and record.status in ACTIVE
