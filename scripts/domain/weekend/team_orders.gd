class_name TeamOrders
extends RefCounted
## Team instructions constrain future legal choices; they never move or reorder cars.
const ACTIVE = ["waiting", "executing", "staggered", "queue"]
const STATUSES = ["waiting", "executing", "staggered", "queue", "completed", "cancelled", "expired"]

static func create() -> Dictionary:
	return {"version": 1, "revision": 0, "track_order": {}, "pit_priority": {}}

static func slot(kind: String) -> String:
	return "pit_priority" if kind == "pit_priority" else "track_order"

static func active(record: Dictionary) -> bool:
	return not record.is_empty() and record.status in ACTIVE

static func validate(sim, payload: Dictionary) -> String:
	if sim.phase != "race": return "Team instructions require a live race."
	if not RaceCheckpoint.integral(payload.get("revision"), 0, 100000000) or payload.revision != sim.team_state.revision: return "The team instruction changed. Review its current state."
	if payload.get("kind") not in ["hold", "yield", "pit_priority"]: return "Choose hold, allow through, or pit priority."
	if not RaceCheckpoint.integral(payload.get("id"), 0, sim.cars.size() - 1) or not RaceCheckpoint.integral(payload.get("teammate_id"), 0, sim.cars.size() - 1): return "Name both affected drivers."
	var car = sim.cars[int(payload.id)]; var mate = sim.cars[int(payload.teammate_id)]
	if car.id == mate.id or not car.player or not mate.player or car.team != mate.team: return "A team instruction needs the two different Obsidian drivers."
	if car.dnf or car.finished or mate.dnf or mate.finished: return "Both affected drivers must still be running."
	if not RaceCheckpoint.integral(payload.get("laps"), 1, 5): return "Choose an expiry of one to five laps."
	if active(sim.team_state[slot(payload.kind)]): return "Cancel the active instruction before replacing it."
	if car.route != "track" or mate.route != "track" or car.pit_order or mate.pit_order: return "Existing pit orders and physical commitment take priority; they cannot be reordered."
	if payload.kind == "pit_priority":
		if RaceForecaster.reachable_gate(sim, car).distance >= sim.laps * sim.track.length or RaceForecaster.reachable_gate(sim, mate).distance >= sim.laps * sim.track.length: return "No shared pit opportunity remains before the finish."
	if payload.kind != "pit_priority":
		var gap = car.distance - mate.distance
		if gap < RacecraftController.CLEARANCE or gap > sim.track.length * 0.45: return "The named first driver must be clearly ahead on the same racing lap."
		if payload.kind == "yield" and gap > 120: return "Allow through when the teammate is within 120 metres; otherwise continue the current plans."
	return ""

static func accept(sim, payload: Dictionary) -> void:
	var car = sim.cars[int(payload.id)]; var mate = sim.cars[int(payload.teammate_id)]
	var record = {"kind": payload.kind, "actor_id": int(car.id), "teammate_id": int(mate.id), "intent_id": "pending",
		"started": sim.total_time, "until_distance": maxf(0, car.distance) + payload.laps * sim.track.length,
		"status": "waiting", "reason": "Waiting for a legal opportunity; other control owners are unchanged.",
		"deferred_gate": -1.0, "initial_stops": [int(car.pit_stops), int(mate.pit_stops)]}
	sim.team_state[slot(payload.kind)] = record; sim.team_state.revision += 1

static func finish(sim, key: String, status: String, reason: String) -> void:
	var record = sim.team_state[key]
	if not active(record): return
	record.status = status; record.reason = reason; sim.team_state.revision += 1
	RaceJournal.append(sim.strategy_state, sim, "team_order_outcome", int(record.actor_id),
		{"kind": record.kind, "teammate_id": int(record.teammate_id), "status": status, "reason": reason}, record.intent_id)
	sim.post("radio", "Team instruction · " + reason)

static func track_blocks(sim, car: Dictionary, nearest: int) -> bool:
	var record = sim.team_state.track_order
	if not active(record): return false
	return record.kind == "hold" and car.id == record.teammate_id and nearest == record.actor_id or record.kind == "yield" and car.id == record.actor_id

static func traffic(sim, car: Dictionary, old: Array, nearest: int, result: Dictionary, sample: Dictionary, local: Dictionary) -> Dictionary:
	var record = sim.team_state.track_order
	if not active(record): return result
	if record.kind == "hold" and car.id == record.teammate_id and nearest == record.actor_id:
		result.attempt = false; result.block_pass = true; result.lane = sample.line
		record.status = "executing"; record.reason = "Holding relative team order; neither car is asked to block rivals."
		return result
	if record.kind != "yield": return result
	var actor = sim.cars[int(record.actor_id)]; var mate = sim.cars[int(record.teammate_id)]
	if car.id != actor.id: return result
	result.attempt = false
	var gap = old[int(actor.id)].distance - old[int(mate.id)].distance
	var safe = gap > -RacecraftController.CLEARANCE and gap < 65 and sample.w >= 8 and absf(sample.curvature) < 0.015 and local.grip > 0.6
	safe = safe and not sim.neutral(actor) and not sim.neutral(mate) and actor.yield_to < 0 and mate.yield_to < 0 and not actor.pit_order and not mate.pit_order
	var side = -1.0 if old[int(mate.id)].lane >= 0 else 1.0
	var lane = side * (sample.w * 0.5 - 1.4)
	for other in sim.cars:
		if other.id in [actor.id, mate.id] or other.dnf or other.finished or old[int(other.id)].route != "track": continue
		var delta = fposmod(old[int(other.id)].distance - old[int(car.id)].distance + sim.track.length * 0.5, sim.track.length) - sim.track.length * 0.5
		# Do not slow into or sweep across unrelated traffic, including lapped cars.
		if absf(delta) < 20: safe = false
	if not safe:
		record.status = "waiting"; record.reason = "Waiting: flags, road shape, gap or nearby traffic prevent a safe yield."
		return result
	result.lane = lane
	if absf(old[int(actor.id)].lane - old[int(mate.id)].lane) >= 2.6 and old[int(mate.id)].speed > 14:
		result.desired = maxf(12, minf(result.desired * 0.88, old[int(mate.id)].speed - 2.0))
		record.status = "executing"; record.reason = "Yielding in a clear corridor with a bounded speed reduction; completion requires a physical pass."
	else:
		record.status = "waiting"; record.reason = "Moving aside before reducing speed; no position has been awarded."
	return result

static func planned_gate(sim, car: Dictionary) -> float:
	if car.pit_order: return car.pit_gate
	var plan = sim.active_plan(car.id)
	if not StrategyPlan.owns(sim.policy(car.id), "pit") or plan.get("stops", []).is_empty(): return -1.0
	var window = plan.stops[0]; var safe = RaceForecaster.reachable_gate(sim, car)
	if safe.lap > window.to_lap: return -1.0
	var gate = maxf(safe.distance, (window.from_lap - 1) * sim.track.length + sim.track.pit_entry)
	var priority = sim.team_state.pit_priority
	if active(priority) and car.id == priority.teammate_id and priority.deferred_gate >= 0:
		gate = maxf(gate, priority.deferred_gate + sim.track.length)
	return gate

static func preview(sim) -> Dictionary:
	var rows: Array = []
	for id in [3, 6]:
		var car = sim.cars[id]; var snapshot = RaceForecaster.capture(sim, id)
		var gate = planned_gate(sim, car)
		var origin = "accepted order" if car.pit_order else ("approved window" if gate >= 0 else "hypothetical next entry")
		if gate < 0: gate = snapshot.gate.distance
		var arrival = maxf(0, gate - car.distance) / (sim.track.length / sim.track.estimate) + car.box_d / sim.track.pit_limit + 1.5
		if car.route == "pit":
			arrival = 0.0 if car.pit_stage == "service" else maxf(0, car.box_d - car.pit_d) / sim.track.pit_limit
			origin = "physically committed"
		rows.append({"id": id, "short": car.short, "arrival": arrival,
			"eligible": not car.dnf and not car.finished and car.pit_stage != "exit", "service": car.pit_timer if car.pit_stage == "service" else 3.75 + (car.damage * 0.14 if car.repair else 0.0), "origin": origin})
		if car.dnf or car.finished: rows.back().origin = "not running"; rows.back().arrival = 0.0
		elif car.pit_stage == "exit": rows.back().origin = "service completed; releasing"; rows.back().arrival = 0.0
	rows.sort_custom(func(a, b): return a.arrival < b.arrival if a.arrival != b.arrival else a.id < b.id)
	return {"first": rows[0], "second": rows[1], "queue": maxf(0, rows[0].arrival + rows[0].service - rows[1].arrival) if rows[0].eligible and rows[1].eligible else 0.0,
		"note": "Estimate, not a reserved slot. Actual arrival and the physical box decide order."}

static func defer_stop(sim, car: Dictionary, window: Dictionary = {}) -> bool:
	var record = sim.team_state.pit_priority
	if not active(record) or car.id != record.teammate_id or not StrategyPlan.owns(sim.policy(car.id), "pit"): return false
	var primary = sim.cars[int(record.actor_id)]
	var safe = RaceForecaster.reachable_gate(sim, car)
	var mounted = TyreInventory.find(car, car.set_id)
	var limiting_life = float(car.tyre)
	for wheel in mounted.get("wheels", {}).values(): limiting_life = minf(limiting_life, wheel.life)
	var safe_resources = WheelTyres.usable(mounted) and limiting_life - RaceSim.TYRES[car.compound].wear * 1.5 > 18 and car.damage < 24
	if car.compound != sim.recommended_compound() and (car.compound in ["I", "W"] or sim.recommended_compound() in ["I", "W"]): safe_resources = false
	if not safe_resources:
		record.status = "queue"; record.reason = "Recovery takes priority; a physical queue may be necessary."
		return false
	if record.deferred_gate >= 0: return safe.distance <= record.deferred_gate
	var primary_gate = planned_gate(sim, primary)
	if primary_gate < 0: return false
	var velocity = sim.track.length / sim.track.estimate
	var primary_arrival = maxf(0, primary_gate - primary.distance) / velocity + primary.box_d / sim.track.pit_limit
	var secondary_arrival = maxf(0, safe.distance - car.distance) / velocity + car.box_d / sim.track.pit_limit
	var service = 3.75 + (primary.damage * 0.14 if primary.repair else 0.0)
	if absf(primary_arrival - secondary_arrival) > service + 2.0: return false
	if (not window.is_empty() and safe.lap >= window.to_lap) or safe.distance + sim.track.length >= sim.laps * sim.track.length:
		record.status = "queue"; record.reason = "No later legal entry inside the approved window; priority cannot rewrite it."
		return false
	record.deferred_gate = safe.distance; record.status = "staggered"
	record.reason = "%s waits one entry inside authorized discretion, giving %s the first opportunity." % [car.short, primary.short]
	RaceJournal.append(sim.strategy_state, sim, "team_priority_defer", int(car.id),
		{"reason": record.reason, "skipped_gate": safe.distance, "next_gate": safe.distance + sim.track.length}, record.intent_id)
	return true

static func after_step(sim) -> void:
	for key in ["track_order", "pit_priority"]:
		var record = sim.team_state[key]
		if not active(record): continue
		var car = sim.cars[int(record.actor_id)]; var mate = sim.cars[int(record.teammate_id)]
		if car.dnf or mate.dnf:
			finish(sim, key, "expired", "An affected driver retired; no cooperation result is attributed to that retirement.")
		elif record.kind == "yield" and mate.distance - car.distance > RacecraftController.CLEARANCE and car.route == "track" and mate.route == "track":
			finish(sim, key, "completed", "%s physically cleared %s; the cooperation instruction is complete." % [mate.short, car.short])
		elif record.kind == "pit_priority" and car.pit_stops > record.initial_stops[0] and mate.pit_stops > record.initial_stops[1]:
			finish(sim, key, "completed", "Both physical services completed; pit priority has ended.")
		elif car.dnf or mate.dnf or car.finished or mate.finished or sim.phase != "race" or car.distance >= record.until_distance:
			finish(sim, key, "expired", "Instruction ended at its distance/session limit or because an affected car stopped running.")
		elif record.kind != "pit_priority" and (car.route != "track" or mate.route != "track" or car.pit_order or mate.pit_order):
			finish(sim, key, "expired", "A pit commitment superseded the track cooperation instruction.")
		elif record.kind == "hold" and mate.distance > car.distance:
			finish(sim, key, "expired", "Relative positions changed; no car is moved backwards to restore an instruction.")

static func valid(state: Variant, cars: Array, now: float) -> bool:
	if not state is Dictionary or state.get("version") != 1 or not RaceCheckpoint.integral(state.get("revision"), 0, 100000000): return false
	for key in ["track_order", "pit_priority"]:
		var record = state.get(key)
		if not record is Dictionary: return false
		if record.is_empty(): continue
		if record.get("kind") not in (["pit_priority"] if key == "pit_priority" else ["hold", "yield"]) or record.get("status") not in STATUSES: return false
		for field in ["actor_id", "teammate_id"]:
			if not RaceCheckpoint.integral(record.get(field), 0, cars.size() - 1): return false
		var car = cars[int(record.actor_id)]; var mate = cars[int(record.teammate_id)]
		if not car.player or not mate.player or car.id == mate.id or car.team != mate.team: return false
		if not record.get("intent_id") is String or not record.intent_id.begins_with("rw-") or not record.get("reason") is String or record.reason.length() > 500: return false
		if not RaceCheckpoint.number(record.get("started"), 0, now + RaceSim.STEP) or not RaceCheckpoint.number(record.get("until_distance"), 0, 100000000) or not RaceCheckpoint.number(record.get("deferred_gate"), -1, 100000000): return false
		if not record.get("initial_stops") is Array or record.initial_stops.size() != 2: return false
		for value in record.initial_stops:
			if not RaceCheckpoint.integral(value, 0, 10000): return false
	return true
