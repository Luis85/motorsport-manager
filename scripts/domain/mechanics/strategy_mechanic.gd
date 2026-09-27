class_name StrategyMechanic
extends RefCounted
## Authoritative strategy rules; caller supplies state, never a view or singleton.
const GLOBAL_COMMANDS = ["qualify", "close_qualifying", "prepare_race", "formation", "lights", "pause", "speed"]
const POLICY_COMMANDS = ["approve_plan", "clear_plan", "delegation", "resource_intent", "hold_decision", "retire_car", "team_order", "cancel_team_order"]

func definition() -> Dictionary:
	return {"id": "strategy", "version": 1, "requires": [], "hooks": ["policy", "active_plan", "forecast", "sync_ownership", "command", "policy_command", "manage_resources", "engineer", "contextual_rival", "review_rival_style", "order_stop", "block_plan", "leave_garage", "record_stint", "step", "snapshot", "traffic_instruction", "record_track_pass", "move_car", "observe_warnings"]}

func install(sim: RaceSim, geometry: TrackGeometry = null, options: Dictionary = {}) -> void:

	sim.strategy_state = RaceJournal.create(sim.cars)
	sim.battle_state = RacecraftController.create(sim.cars)
	sim.team_state = TeamOrders.create()
	sim.rival_state = RivalStrategy.create(sim.cars)

func policy(sim: RaceSim, id: int) -> Dictionary:
	return sim.strategy_state.policies[id]

func active_plan(sim: RaceSim, id: int) -> Dictionary:
	var p = sim.policy(id)
	var result = p.plan.duplicate(true)
	if not result.is_empty(): result.stops = result.stops.slice(int(p.next_stop))
	return result

func forecast(sim: RaceSim, id: int, draft: Dictionary = {}) -> Dictionary:
	if id < 0 or id >= sim.cars.size(): return {}
	return RaceForecaster.evaluate(RaceForecaster.capture(sim, id, sim.active_plan(id) if draft.is_empty() else draft, int(sim.policy(id).revision)))

func sync_ownership(sim: RaceSim, c: Dictionary) -> void:
	var p = sim.policy(c.id)
	c.auto = p.overrides.is_empty()
	for channel in StrategyPlan.CHANNELS:
		if p.owners[channel] != "engineer": c.auto = false

func command(sim: RaceSim, action: String, payload: Dictionary = {}) -> bool:
	sim.last_error = ""
	var global = action in GLOBAL_COMMANDS
	if not global and not RaceCheckpoint.integral(payload.get("id"), 0, sim.cars.size() - 1): return sim.fail("Name the intended driver explicitly.")
	var id = 3 if global else int(payload.id)
	var c = sim.cars[id]; var p = sim.policy(id)
	var accepted_payload = payload.duplicate(true); accepted_payload.id = id
	if not global and (not c.player or c.dnf or c.finished): return sim.fail("Only a running Obsidian driver can receive this command.")
	if action in ["pace", "engine"] and not RaceCheckpoint.integral(payload.get("value"), 0, 2): return sim.fail("Choose a valid driving mode.")
	if action == "speed" and not RaceCheckpoint.integral(payload.get("value"), 1, 16): return sim.fail("Choose a valid playback speed.")
	if action == "auto" and not payload.get("value") is bool: return sim.fail("Choose an explicit delegation state.")
	if action == "send" and not RaceForecaster.qualifying_release(sim, c).can_start_hotlap: return sim.fail("Too late to begin a legal flying lap under the release estimate; the car stays in the garage.")
	if action == "pit" and payload.has("forecast_key"):
		if payload.get("forecast_key") != RaceForecaster.material_key(sim, id, int(p.revision)) or not RaceCheckpoint.number(payload.get("forecast_time"), 0, sim.total_time) or sim.total_time - float(payload.forecast_time) > RaceForecaster.MAX_AGE: return sim.fail("The pit forecast is stale. Compare the updated options before committing.")
		if not RaceCheckpoint.number(payload.get("expected_gate"), 0, 100000000) or absf(payload.expected_gate - RaceForecaster.reachable_gate(sim, c).distance) > 0.001: return sim.fail("The safe entry has changed. Review the deferred gate before committing.")
	var chosen: Dictionary = {}
	if action == "pit" and payload.has("set_id"):
		if sim.phase != "race" or c.route != "track" or not payload.set_id is String: return sim.fail("A forecast stop requires a racing car and a specific replacement set.")
		chosen = TyreInventory.find(c, payload.set_id)
		if not WheelTyres.usable(chosen) or chosen.id == c.set_id: return sim.fail("The forecast replacement is no longer available.")
	var prior: Dictionary = {}
	if action in ["pit", "schedule_pit"]: prior = RaceForecaster.capture(sim, id, sim.active_plan(id), int(p.revision))
	if action in POLICY_COMMANDS:
		if not sim.policy_command(action, accepted_payload): return false
		sim.commands.append({"tick": snappedf(sim.total_time, RaceSim.STEP), "action": action, "payload": accepted_payload.duplicate(true)})
	else:
		if not chosen.is_empty(): c.next_set_id = chosen.id; c.next_compound = chosen.compound
		if action == "qualify":
			for car in sim.cars: car.auto = StrategyPlan.owns(sim.policy(car.id), "qualifying")
		if not sim.mechanics.before("strategy", "command", [action, accepted_payload]):
			for car in sim.cars: sim.sync_ownership(car)
			return false
		if action in ["pace", "engine"]:
			p.owners[action] = "player"; p.overrides.erase(action)
		elif action == "auto":
			for channel in StrategyPlan.CHANNELS: p.owners[channel] = "engineer" if c.auto else "player"
			p.overrides.clear()
		elif action in ["pit", "schedule_pit", "cancel_pit", "cancel_schedule"]:
			p.owners.pit = "player"
			if not p.plan.is_empty(): p.plan_status = "overridden"
		elif action in ["compound", "select_set"] and sim.phase == "race": p.owners.pit = "player"
		elif action in ["send", "recall"]: p.owners.qualifying = "player"
		elif action == "battle_mode": p.owners.racecraft = "player"
		if action == "prepare_race":
			for car in sim.cars:
				var existing = sim.policy(car.id)
				if not existing.plan.is_empty():
					var item = TyreInventory.find(car, existing.plan.starting_set)
					if WheelTyres.usable(item): car.next_set_id = item.id; car.next_compound = item.compound
	for car in sim.cars: sim.sync_ownership(car)
	var evidence = {"action": action, "payload": accepted_payload, "applied_pace": c.pace, "applied_engine": c.engine,
		"distance": c.distance, "fuel": c.fuel, "tyre": c.tyre, "owners": p.owners.duplicate(true)}
	var intent_id = RaceJournal.append(sim.strategy_state, sim, "command", -1 if global else id, evidence)
	if action == "resource_intent": p.overrides[accepted_payload.channel].id = intent_id
	if action == "approve_plan": p.plan_intent_id = intent_id
	if action == "team_order": sim.team_state[TeamOrders.slot(accepted_payload.kind)].intent_id = intent_id
	if action in ["pit", "schedule_pit"]:
		p.last_order_id = intent_id; p.order_forecast = RaceForecaster.pit_prediction(prior, c.pit_gate)
		RaceJournal.append(sim.strategy_state, sim, "strategy_order", id, {"reason": "Manual pit order accepted for lap %d%s" % [int(round((c.pit_gate - sim.track.pit_entry) / sim.track.length)) + 1, " · deferred to the next safe entry" if c.pit_deferred else ""], "prediction": p.order_forecast}, intent_id)
	elif action in ["cancel_pit", "cancel_schedule"]:
		p.order_forecast = {}; p.last_order_id = ""
	return true

func policy_command(sim: RaceSim, action: String, payload: Dictionary) -> bool:
	var c = sim.cars[int(payload.id)]; var p = sim.policy(c.id)
	match action:
		"team_order":
			var error = TeamOrders.validate(sim, payload)
			if not error.is_empty(): return sim.fail(error)
			TeamOrders.accept(sim, payload)
		"cancel_team_order":
			if payload.get("slot") not in ["track_order", "pit_priority"] or payload.get("revision") != sim.team_state.revision: return sim.fail("Review the current team instruction before cancelling it.")
			var record = sim.team_state[payload.slot]
			if not TeamOrders.active(record) or payload.get("intent_id") != record.intent_id or int(payload.id) not in [int(record.actor_id), int(record.teammate_id)]: return sim.fail("There is no matching active team instruction.")
			TeamOrders.finish(sim, payload.slot, "cancelled", "Cancelled by the pit wall; physical positions and accepted pit orders are unchanged.")
		"approve_plan":
			if sim.phase not in ["briefing", "race_preparation", "race"] or c.route == "pit" or c.pit_order: return sim.fail("Approve a plan in preparation or on track with no committed pit order.")
			if not RaceCheckpoint.integral(payload.get("revision"), 0, 1000000) or payload.revision != p.revision: return sim.fail("This draft is based on an older plan. Reload the current plan before applying.")
			var plan = payload.get("plan")
			var error = StrategyPlan.validate(plan, c, sim.laps, maxi(1, int(floor(c.distance / sim.track.length)) + 1) if sim.phase == "race" else 0)
			if not error.is_empty(): return sim.fail(error)
			if sim.phase == "race" and plan.starting_set != c.set_id: return sim.fail("A live plan must start with the actually fitted set.")
			if sim.phase == "race":
				var safe = RaceForecaster.reachable_gate(sim, c)
				for stop in plan.stops:
					if stop.to_lap < safe.lap: return sim.fail("The proposed pit window is no longer reachable.")
			p.plan = plan.duplicate(true); p.revision += 1; p.next_stop = 0; p.plan_status = "approved"
			p.owners.pit = "engineer"; p.blocked_reason = ""; p.next_review = sim.total_time
			if sim.phase != "race":
				var item = TyreInventory.find(c, plan.starting_set)
				c.next_set_id = item.id; c.next_compound = item.compound
		"clear_plan":
			if sim.phase not in ["briefing", "race_preparation", "race"] or c.route == "pit" or c.pit_order: return sim.fail("Cancel any uncommitted order first; a committed stop cannot be replaced.")
			p.plan = {}; p.revision += 1; p.next_stop = 0; p.plan_status = "unplanned"; p.owners.pit = "player"; p.blocked_reason = ""
		"delegation":
			if payload.get("channel") not in StrategyPlan.CHANNELS or payload.get("owner") not in ["engineer", "player"]: return sim.fail("Choose an explicit domain and owner.")
			p.owners[payload.channel] = payload.owner; p.overrides.erase(payload.channel)
			if payload.channel == "pit" and payload.owner == "engineer" and not p.plan.is_empty(): p.plan_status = "approved"; p.next_review = sim.total_time
		"resource_intent":
			if sim.phase != "race" or payload.get("channel") not in ["pace", "engine"]: return sim.fail("Temporary pace and engine intents require a live race.")
			if not RaceCheckpoint.integral(payload.get("value"), 0, 2) or not RaceCheckpoint.integral(payload.get("laps"), 1, 5): return sim.fail("Use a valid mode for one to five laps.")
			var channel: String = payload.channel
			var previous = p.overrides.get(channel, {}).get("previous_value", c[channel])
			p.overrides[channel] = {"id": "pending", "value": int(payload.value), "previous_value": int(previous), "until_distance": maxf(0, c.distance) + payload.laps * sim.track.length}
			c[channel] = int(payload.value)
		"hold_decision":
			if payload.get("issue") not in ["pit", "fuel", "tyre", "plan", "qualifying"] or not payload.get("key") is String or payload.key.length() != 64: return sim.fail("Select a current decision to acknowledge.")
			if payload.key != RaceForecaster.material_key(sim, c.id, int(p.revision)): return sim.fail("That decision changed. Read the current conditions before keeping the plan.")
			p.held[payload.issue] = DecisionFeed.acknowledgement_key(sim, c.id, payload.issue, p)
		"retire_car":
			if sim.phase != "race" or payload.get("confirm") != true: return sim.fail("Confirm a voluntary retirement during the race.")
			sim.retire(c, "Retired by the pit wall")
	sim.post("radio", "%s · %s accepted. Unrelated ownership is unchanged." % [c.short, action.replace("_", " ")])
	return true

func manage_resources(sim: RaceSim, c: Dictionary, only_channel: String = "") -> void:
	var p = sim.policy(c.id)
	var remaining = maxf(0, sim.laps - c.distance / sim.track.length)
	var emergency = not WheelTyres.usable(TyreInventory.find(c, c.set_id))
	var target = remaining
	var plan = sim.active_plan(c.id)
	if not plan.get("stops", []).is_empty(): target = maxf(0.1, float(plan.stops[0].to_lap - 1) + sim.track.pit_entry / sim.track.length - c.distance / sim.track.length)
	var reserve = float(plan.get("tyre_reserve", 22.0))
	if StrategyPlan.owns(p, "pace") and only_channel in ["", "pace"]:
		var wear = RaceSim.TYRES[c.compound].wear * 1.05
		c.pace = 0 if emergency or sim.flag != "GREEN" or c.tyre - target * wear < reserve or c.engine_temperature > 120 else 1
	if StrategyPlan.owns(p, "engine") and only_channel in ["", "engine"]:
		var margin = c.fuel - remaining
		c.engine = 0 if emergency or margin < float(plan.get("fuel_reserve", 0.35)) or c.engine_temperature > 115 else 1
	if StrategyPlan.owns(p, "racecraft") and only_channel.is_empty():
		c.battle_mode = "patient" if plan.get("objective") == "protect_finish" or c.damage > 24 else "balanced"
		if plan.get("objective") == "chase_position" and c.tyre > 35 and c.damage < 12 and sim.flag == "GREEN" and RaceForecaster.fuel_margin(sim, c) > 0: c.battle_mode = "assertive"

func engineer(sim: RaceSim, c: Dictionary) -> void:
	if sim.phase != "race" or c.route != "track" or c.dnf or c.finished: return
	sim.manage_resources(c)
	var p = sim.policy(c.id)
	if not StrategyPlan.owns(p, "pit") or c.pit_order: return
	var remaining = maxf(0, sim.laps - c.distance / sim.track.length)
	var safe = RaceForecaster.reachable_gate(sim, c)
	if safe.distance >= sim.laps * sim.track.length: return
	var emergency = not WheelTyres.usable(TyreInventory.find(c, c.set_id))
	if emergency and p.plan.get("allow_emergency", true):
		var item = TyreInventory.choose(c, sim.recommended_compound(), true)
		if item.is_empty():
			for compound in RaceSim.TYRES:
				item = TyreInventory.choose(c, compound, true)
				if not item.is_empty(): break
		if item.is_empty(): sim.block_plan(c, "No sound replacement is available for the damaged tyre.")
		else: sim.order_stop(c, item, "Authorized damaged-tyre recovery at the next safe entry")
		return
	if not p.plan.is_empty():
		if p.next_stop >= p.plan.stops.size(): return
		var window = p.plan.stops[int(p.next_stop)]
		if safe.lap < window.from_lap: return
		if safe.lap > window.to_lap: sim.block_plan(c, "The approved window is no longer reachable. Re-plan or take manual control."); return
		var item = TyreInventory.find(c, window.set_id)
		if not WheelTyres.usable(item) or item.id == c.set_id: sim.block_plan(c, "The approved replacement set is unavailable. Choose a new plan."); return
		if TeamOrders.defer_stop(sim, c, window): return
		var preview = RaceForecaster.pit_prediction(RaceForecaster.capture(sim, c.id))
		if "avoid_traffic" in p.plan.branches and safe.lap < window.to_lap and (preview.queue > 1 or not preview.traffic.is_empty()) and not emergency: return
		sim.order_stop(c, item, "Approved window: lap %d–%d; estimated queue %.1fs" % [window.from_lap, window.to_lap, preview.queue])
		return
	if sim.total_time < p.next_review or remaining < 0.8: return
	p.next_review = sim.total_time + 12.0 + float(c.id % 3)
	if c.tyre > 80 and c.damage < 24 and c.compound == sim.recommended_compound() and not sim.contextual_rival(c): return
	var snapshot = RaceForecaster.capture(sim, c.id)
	var comparison = RaceForecaster.evaluate(snapshot)
	var candidate: Dictionary = {}
	for option in comparison.options:
		if option.id == "box" and option.available: candidate = option
	var item = RaceForecaster.replacement(snapshot)
	if item.is_empty() or candidate.is_empty(): return
	var urgent = c.tyre < 18 or c.damage > 24 or c.compound != sim.recommended_compound() and (c.compound in ["I", "W"] or sim.recommended_compound() in ["I", "W"])
	var memory = sim.rival_state.drivers[int(c.id)]
	if not urgent and sim.flag == "GREEN" and memory.hold_gate >= safe.distance: return
	if not urgent:
		if sim.review_rival_style(c, snapshot, comparison): return
		var response = RivalStrategy.response(snapshot, sim.rival_state.stops, memory, comparison)
		if not response.is_empty():
			for field in ["kind", "event_id", "hold_gate", "reason"]: memory[field] = response[field]
			RaceJournal.append(sim.strategy_state, sim, "strategy_response", int(c.id), {"reason": response.reason, "kind": response.kind, "observation": response.evidence})
			if response.kind == "cover" and not TeamOrders.defer_stop(sim, c): sim.order_stop(c, item, response.reason)
			return
	# Same public-context candidate model for every team; no hidden boost or future weather.
	var worthwhile = candidate.gain > maxf(3.0, comparison.pit.loss * 0.12) and candidate.risk != "high"
	if urgent or worthwhile and not TeamOrders.defer_stop(sim, c): sim.order_stop(c, item, "Observed-resource recovery" if urgent else "Public timing / tyre-offset comparison favors a stop; estimated gain %.1fs" % candidate.gain)

func contextual_rival(sim: RaceSim, _car: Dictionary) -> bool:
	return false

func review_rival_style(sim: RaceSim, _car: Dictionary, _snapshot: Dictionary, _comparison: Dictionary) -> bool:
	return false

func order_stop(sim: RaceSim, c: Dictionary, item: Dictionary, reason: String) -> void:
	var p = sim.policy(c.id)
	var source = RaceForecaster.capture(sim, c.id, sim.active_plan(c.id), int(p.revision))
	c.next_compound = item.compound; c.next_set_id = item.id; c.scheduled_lap = -1
	sim.queue_pit(c)
	p.order_forecast = RaceForecaster.pit_prediction(source, c.pit_gate)
	p.last_order_id = RaceJournal.append(sim.strategy_state, sim, "strategy_order", c.id, {"reason": reason, "set_id": item.id, "gate": c.pit_gate, "prediction": p.order_forecast, "scope": source.scope}, p.plan_intent_id)
	if not sim.contextual_rival(c): sim.post("pit", "%s · %s. Physical pit entry remains authoritative." % [c.short, reason])

func block_plan(sim: RaceSim, c: Dictionary, reason: String) -> void:
	var p = sim.policy(c.id)
	if p.blocked_reason == reason: return
	p.blocked_reason = reason; p.plan_status = "blocked"
	RaceJournal.append(sim.strategy_state, sim, "plan_blocked", c.id, {"reason": reason}, p.plan_intent_id)
	sim.post("radio", c.short + " · " + reason)

func leave_garage(sim: RaceSim, c: Dictionary) -> void:
	if not RaceForecaster.qualifying_release(sim, c).can_start_hotlap: return
	sim.mechanics.before("strategy", "leave_garage", [c])

func record_stint(sim: RaceSim, c: Dictionary) -> void:
	sim.mechanics.before("strategy", "record_stint", [c])
	if not c.stints.is_empty(): c.stints.back().start_life = c.tyre

func step(sim: RaceSim) -> void:
	if sim.paused or sim.phase not in RaceSim.ACTIVE: return
	var previous_phase = sim.phase
	var routes: Array = []
	for car in sim.cars:
		routes.append(car.route)
		if sim.phase == "qualifying": car.auto = StrategyPlan.owns(sim.policy(car.id), "qualifying")
	sim.mechanics.before("strategy", "step", [])
	for car in sim.cars:
		var p = sim.policy(car.id)
		for channel in p.overrides.keys():
			var intent = p.overrides[channel]
			if car.distance + 0.00001 >= intent.until_distance or car.finished or car.dnf:
				car[channel] = int(intent.previous_value); p.overrides.erase(channel)
				if sim.phase == "race" and not car.dnf and not car.finished: sim.manage_resources(car, channel)
				RaceJournal.append(sim.strategy_state, sim, "handback", car.id, {"reason": "%s intent ended; control returned to %s" % [channel.capitalize(), p.owners[channel]]}, intent.id)
				sim.post("radio", "%s · %s control returned to %s." % [car.short, channel, p.owners[channel]])
		if previous_phase == "race" and routes[car.id] == "track" and car.route == "pit":
			RivalStrategy.observe_entry(sim.rival_state, RaceForecaster.capture(sim, (int(car.id) + 1) % sim.cars.size()), int(car.id))
			var entry_id = RaceJournal.append(sim.strategy_state, sim, "pit_entry", car.id, {"gate": car.pit_gate, "set_id": car.next_set_id}, p.last_order_id)
			p.visit = {"entered_at": sim.total_time, "entry_id": entry_id, "prediction": p.order_forecast.duplicate(true)}
		elif previous_phase == "race" and routes[car.id] == "pit" and car.route == "track" and not p.visit.is_empty():
			var elapsed = sim.total_time - p.visit.entered_at
			var evidence = {"visit_seconds": elapsed, "fitted_set": car.set_id, "stops": car.pit_stops}
			var estimate = p.visit.prediction
			if not estimate.is_empty(): evidence.merge({"predicted_low": estimate.visit_low, "predicted_high": estimate.visit_high, "residual": elapsed - estimate.visit})
			RaceJournal.append(sim.strategy_state, sim, "pit_exit", car.id, evidence, p.visit.entry_id)
			if not p.plan.is_empty() and p.next_stop < p.plan.stops.size() and car.set_id == p.plan.stops[int(p.next_stop)].set_id:
				p.next_stop += 1
				if p.next_stop >= p.plan.stops.size(): p.plan_status = "completed"
			p.visit = {}; p.order_forecast = {}; p.next_review = sim.total_time + 12
		sim.sync_ownership(car)
	RacecraftController.after_step(sim)
	TeamOrders.after_step(sim)
	if sim.phase == "race" and roundi(sim.total_time / RaceSim.STEP) % 20 == 0:
		for id in [3, 6]: sim.observe_warnings(sim.cars[id])
	if previous_phase != "results" and sim.phase == "results":
		var classification: Array = []
		for car in sim.standings(): classification.append({"id": car.id, "position": classification.size() + 1, "laps": car.completed, "time": car.finish_time, "retired": car.dnf})
		RaceJournal.append(sim.strategy_state, sim, "result", -1, {"classification": classification})

func snapshot(sim: RaceSim) -> Dictionary:
	var data = sim.mechanics.before("strategy", "snapshot", [])
	data.version = 6; data.strategy_state = sim.strategy_state.duplicate(true)
	data.battle_state = sim.battle_state.duplicate(true); data.team_state = sim.team_state.duplicate(true); data.rival_state = sim.rival_state.duplicate(true)
	return data

func traffic_instruction(sim: RaceSim, c: Dictionary, old: Array, nearest: int, gap: float, desired: float, lane: float, sample: Dictionary, local: Dictionary) -> Dictionary:
	var base = sim.mechanics.before("strategy", "traffic_instruction", [c, old, nearest, gap, desired, lane, sample, local])
	if sim.phase != "race": return base
	var blocked = TeamOrders.track_blocks(sim, c, nearest)
	var result = RacecraftController.instruction(sim, c, old, nearest, base, sample, local, blocked)
	var record = sim.battle_state.drivers[int(c.id)]
	if not result.attempt and (blocked or nearest == int(record.target_id) and nearest >= 0):
		result.lane = lane
		if nearest >= 0 and old[nearest].distance > old[int(c.id)].distance: result.block_pass = true
	return TeamOrders.traffic(sim, c, old, nearest, result, sample, local)

func record_track_pass(sim: RaceSim, _c: Dictionary, _other: Dictionary) -> void:
	# A centre-line crossing is not a resolved contest. after_step records clearance once.
	pass

func move_car(sim: RaceSim, c: Dictionary, old: Array) -> void:
	sim.mechanics.before("strategy", "move_car", [c, old])
	if sim.phase != "race" or c.pit_order or c.blue or c.route != "track": return
	c.intent = RacecraftController.describe(sim.battle_state, int(c.id), sim.cars)
	var order = sim.team_state.track_order
	if TeamOrders.active(order) and int(c.id) in [int(order.actor_id), int(order.teammate_id)]:
		c.intent = "Team %s · %s" % [order.kind, order.reason]

func observe_warnings(sim: RaceSim, c: Dictionary) -> void:
	var p = sim.policy(c.id)
	var active: Array = []
	for card in DecisionFeed.for_driver(sim, c.id, p, {}):
		if card.priority < 90: continue
		active.append(card.issue)
		if p.notices.get(card.issue, "") == card.dedup_key: continue
		p.notices[card.issue] = card.dedup_key
		RaceJournal.append(sim.strategy_state, sim, "warning", c.id, {"reason": card.title + ": " + card.evidence, "fallback": card.fallback, "issue": card.issue})
		sim.post("radio", c.short + " · " + card.title + ". " + card.evidence)
	for issue in p.notices.keys():
		if issue not in active: p.notices.erase(issue)
