class_name StrategyRaceSim
extends RaceSim
## Incremental strategy layer. The original fixed-step movement, tyres and classification stay authoritative.
const GLOBAL_COMMANDS = ["qualify", "close_qualifying", "prepare_race", "formation", "lights", "pause", "speed"]
const POLICY_COMMANDS = ["approve_plan", "clear_plan", "delegation", "resource_intent", "hold_decision", "retire_car"]
var strategy_state: Dictionary = {}

func _init(geometry: TrackGeometry = null, options: Dictionary = {}) -> void:
	super(geometry, options)
	strategy_state = RaceJournal.create(cars)

func policy(id: int) -> Dictionary:
	return strategy_state.policies[id]

func active_plan(id: int) -> Dictionary:
	var p = policy(id)
	var result = p.plan.duplicate(true)
	if not result.is_empty(): result.stops = result.stops.slice(int(p.next_stop))
	return result

func forecast(id: int, draft: Dictionary = {}) -> Dictionary:
	if id < 0 or id >= cars.size(): return {}
	return RaceForecaster.evaluate(RaceForecaster.capture(self, id, active_plan(id) if draft.is_empty() else draft, int(policy(id).revision)))

func sync_ownership(c: Dictionary) -> void:
	var p = policy(c.id)
	c.auto = p.overrides.is_empty()
	for channel in StrategyPlan.CHANNELS:
		if p.owners[channel] != "engineer": c.auto = false

func command(action: String, payload: Dictionary = {}) -> bool:
	last_error = ""
	var global = action in GLOBAL_COMMANDS
	if not global and not RaceCheckpoint.integral(payload.get("id"), 0, cars.size() - 1): return fail("Name the intended driver explicitly.")
	var id = 3 if global else int(payload.id)
	var c = cars[id]; var p = policy(id)
	var accepted_payload = payload.duplicate(true); accepted_payload.id = id
	if not global and (not c.player or c.dnf or c.finished): return fail("Only a running Obsidian driver can receive this command.")
	if action in ["pace", "engine"] and not RaceCheckpoint.integral(payload.get("value"), 0, 2): return fail("Choose a valid driving mode.")
	if action == "speed" and not RaceCheckpoint.integral(payload.get("value"), 1, 16): return fail("Choose a valid playback speed.")
	if action == "auto" and not payload.get("value") is bool: return fail("Choose an explicit delegation state.")
	if action == "send" and not RaceForecaster.qualifying_release(self, c).can_start_hotlap: return fail("Too late to begin a legal flying lap under the release estimate; the car stays in the garage.")
	if action == "pit" and payload.has("forecast_key"):
		if payload.get("forecast_key") != RaceForecaster.material_key(self, id, int(p.revision)) or not RaceCheckpoint.number(payload.get("forecast_time"), 0, total_time) or total_time - float(payload.forecast_time) > RaceForecaster.MAX_AGE: return fail("The pit forecast is stale. Compare the updated options before committing.")
		if not RaceCheckpoint.number(payload.get("expected_gate"), 0, 100000000) or absf(payload.expected_gate - RaceForecaster.reachable_gate(self, c).distance) > 0.001: return fail("The safe entry has changed. Review the deferred gate before committing.")
	var prior: Dictionary = {}
	if action in ["pit", "schedule_pit"]: prior = RaceForecaster.capture(self, id, active_plan(id), int(p.revision))
	if action in POLICY_COMMANDS:
		if not policy_command(action, accepted_payload): return false
		commands.append({"tick": snappedf(total_time, STEP), "action": action, "payload": accepted_payload.duplicate(true)})
	else:
		if action == "qualify":
			for car in cars: car.auto = StrategyPlan.owns(policy(car.id), "qualifying")
		if not super.command(action, accepted_payload):
			for car in cars: sync_ownership(car)
			return false
		if action in ["pace", "engine"]:
			p.owners[action] = "player"; p.overrides.erase(action)
		elif action == "auto":
			for channel in StrategyPlan.CHANNELS: p.owners[channel] = "engineer" if c.auto else "player"
			p.overrides.clear()
		elif action in ["pit", "schedule_pit", "cancel_pit", "cancel_schedule"]:
			p.owners.pit = "player"
			if not p.plan.is_empty(): p.plan_status = "overridden"
		elif action in ["compound", "select_set"] and phase == "race": p.owners.pit = "player"
		elif action in ["send", "recall"]: p.owners.qualifying = "player"
		elif action == "battle_mode": p.owners.racecraft = "player"
		if action == "prepare_race":
			for car in cars:
				var existing = policy(car.id)
				if not existing.plan.is_empty():
					var item = TyreInventory.find(car, existing.plan.starting_set)
					if WheelTyres.usable(item): car.next_set_id = item.id; car.next_compound = item.compound
	for car in cars: sync_ownership(car)
	var evidence = {"action": action, "payload": accepted_payload, "applied_pace": c.pace, "applied_engine": c.engine,
		"distance": c.distance, "fuel": c.fuel, "tyre": c.tyre, "owners": p.owners.duplicate(true)}
	var intent_id = RaceJournal.append(strategy_state, self, "command", -1 if global else id, evidence)
	if action == "resource_intent": p.overrides[accepted_payload.channel].id = intent_id
	if action == "approve_plan": p.plan_intent_id = intent_id
	if action in ["pit", "schedule_pit"]:
		p.last_order_id = intent_id; p.order_forecast = RaceForecaster.pit_prediction(prior, c.pit_gate)
		RaceJournal.append(strategy_state, self, "strategy_order", id, {"reason": "Manual pit order accepted for lap %d%s" % [int(round((c.pit_gate - track.pit_entry) / track.length)) + 1, " · deferred to the next safe entry" if c.pit_deferred else ""], "prediction": p.order_forecast}, intent_id)
	elif action in ["cancel_pit", "cancel_schedule"]:
		p.order_forecast = {}; p.last_order_id = ""
	return true

func policy_command(action: String, payload: Dictionary) -> bool:
	var c = cars[int(payload.id)]; var p = policy(c.id)
	match action:
		"approve_plan":
			if phase not in ["briefing", "race_preparation", "race"] or c.route == "pit" or c.pit_order: return fail("Approve a plan in preparation or on track with no committed pit order.")
			if not RaceCheckpoint.integral(payload.get("revision"), 0, 1000000) or payload.revision != p.revision: return fail("This draft is based on an older plan. Reload the current plan before applying.")
			var plan = payload.get("plan")
			var error = StrategyPlan.validate(plan, c, laps, maxi(1, int(floor(c.distance / track.length)) + 1) if phase == "race" else 0)
			if not error.is_empty(): return fail(error)
			if phase == "race" and plan.starting_set != c.set_id: return fail("A live plan must start with the actually fitted set.")
			if phase == "race":
				var safe = RaceForecaster.reachable_gate(self, c)
				for stop in plan.stops:
					if stop.to_lap < safe.lap: return fail("The proposed pit window is no longer reachable.")
			p.plan = plan.duplicate(true); p.revision += 1; p.next_stop = 0; p.plan_status = "approved"
			p.owners.pit = "engineer"; p.blocked_reason = ""; p.next_review = total_time
			if phase != "race":
				var item = TyreInventory.find(c, plan.starting_set)
				c.next_set_id = item.id; c.next_compound = item.compound
		"clear_plan":
			if phase not in ["briefing", "race_preparation", "race"] or c.route == "pit" or c.pit_order: return fail("Cancel any uncommitted order first; a committed stop cannot be replaced.")
			p.plan = {}; p.revision += 1; p.next_stop = 0; p.plan_status = "unplanned"; p.owners.pit = "player"; p.blocked_reason = ""
		"delegation":
			if payload.get("channel") not in StrategyPlan.CHANNELS or payload.get("owner") not in ["engineer", "player"]: return fail("Choose an explicit domain and owner.")
			p.owners[payload.channel] = payload.owner; p.overrides.erase(payload.channel)
			if payload.channel == "pit" and payload.owner == "engineer" and not p.plan.is_empty(): p.plan_status = "approved"; p.next_review = total_time
		"resource_intent":
			if phase != "race" or payload.get("channel") not in ["pace", "engine"]: return fail("Temporary pace and engine intents require a live race.")
			if not RaceCheckpoint.integral(payload.get("value"), 0, 2) or not RaceCheckpoint.integral(payload.get("laps"), 1, 5): return fail("Use a valid mode for one to five laps.")
			var channel: String = payload.channel
			var previous = p.overrides.get(channel, {}).get("previous_value", c[channel])
			p.overrides[channel] = {"id": "pending", "value": int(payload.value), "previous_value": int(previous), "until_distance": maxf(0, c.distance) + payload.laps * track.length}
			c[channel] = int(payload.value)
		"hold_decision":
			if payload.get("issue") not in ["pit", "fuel", "tyre", "plan", "qualifying"] or not payload.get("key") is String or payload.key.length() != 64: return fail("Select a current decision to acknowledge.")
			if payload.key != RaceForecaster.material_key(self, c.id, int(p.revision)): return fail("That decision changed. Read the current conditions before keeping the plan.")
			p.held[payload.issue] = payload.key
		"retire_car":
			if phase != "race" or payload.get("confirm") != true: return fail("Confirm a voluntary retirement during the race.")
			retire(c, "Retired by the pit wall")
	post("radio", "%s · %s accepted. Unrelated ownership is unchanged." % [c.short, action.replace("_", " ")])
	return true

func manage_resources(c: Dictionary, only_channel: String = "") -> void:
	var p = policy(c.id)
	var remaining = maxf(0, laps - c.distance / track.length)
	var emergency = not WheelTyres.usable(TyreInventory.find(c, c.set_id))
	var target = remaining
	var plan = active_plan(c.id)
	if not plan.get("stops", []).is_empty(): target = maxf(0.1, float(plan.stops[0].to_lap - 1) + track.pit_entry / track.length - c.distance / track.length)
	var reserve = float(plan.get("tyre_reserve", 22.0))
	if StrategyPlan.owns(p, "pace") and only_channel in ["", "pace"]:
		var wear = TYRES[c.compound].wear * 1.05
		c.pace = 0 if emergency or flag != "GREEN" or c.tyre - target * wear < reserve or c.engine_temperature > 120 else 1
	if StrategyPlan.owns(p, "engine") and only_channel in ["", "engine"]:
		var margin = c.fuel - remaining
		c.engine = 0 if emergency or margin < float(plan.get("fuel_reserve", 0.35)) or c.engine_temperature > 115 else 1
	if StrategyPlan.owns(p, "racecraft") and only_channel.is_empty():
		c.battle_mode = "patient" if plan.get("objective") == "protect_finish" or c.damage > 24 else "balanced"

func engineer(c: Dictionary) -> void:
	if phase != "race" or c.route != "track" or c.dnf or c.finished: return
	manage_resources(c)
	var p = policy(c.id)
	if not StrategyPlan.owns(p, "pit") or c.pit_order: return
	var remaining = maxf(0, laps - c.distance / track.length)
	var safe = RaceForecaster.reachable_gate(self, c)
	if safe.distance >= laps * track.length: return
	var emergency = not WheelTyres.usable(TyreInventory.find(c, c.set_id))
	if emergency and p.plan.get("allow_emergency", true):
		var item = TyreInventory.choose(c, recommended_compound(), true)
		if item.is_empty():
			for compound in TYRES:
				item = TyreInventory.choose(c, compound, true)
				if not item.is_empty(): break
		if item.is_empty(): block_plan(c, "No sound replacement is available for the damaged tyre.")
		else: order_stop(c, item, "Authorized damaged-tyre recovery at the next safe entry")
		return
	if not p.plan.is_empty():
		if p.next_stop >= p.plan.stops.size(): return
		var window = p.plan.stops[int(p.next_stop)]
		if safe.lap < window.from_lap: return
		if safe.lap > window.to_lap: block_plan(c, "The approved window is no longer reachable. Re-plan or take manual control."); return
		var item = TyreInventory.find(c, window.set_id)
		if not WheelTyres.usable(item) or item.id == c.set_id: block_plan(c, "The approved replacement set is unavailable. Choose a new plan."); return
		var preview = RaceForecaster.pit_prediction(RaceForecaster.capture(self, c.id))
		if "avoid_traffic" in p.plan.branches and safe.lap < window.to_lap and (preview.queue > 1 or not preview.traffic.is_empty()) and not emergency: return
		order_stop(c, item, "Approved window: lap %d–%d; estimated queue %.1fs" % [window.from_lap, window.to_lap, preview.queue])
		return
	if total_time < p.next_review or remaining < 0.8: return
	p.next_review = total_time + 12.0 + float(c.id % 3)
	if c.tyre > 80 and c.damage < 24 and c.compound == recommended_compound(): return
	var snapshot = RaceForecaster.capture(self, c.id)
	var comparison = RaceForecaster.evaluate(snapshot)
	var candidate: Dictionary = {}
	for option in comparison.options:
		if option.id == "box" and option.available: candidate = option
	var item = RaceForecaster.replacement(snapshot)
	if item.is_empty() or candidate.is_empty(): return
	var urgent = c.tyre < 18 or c.damage > 24 or c.compound != recommended_compound() and (c.compound in ["I", "W"] or recommended_compound() in ["I", "W"])
	# Same public-context candidate model for every team; no hidden boost or future weather.
	var worthwhile = candidate.gain > maxf(3.0, comparison.pit.loss * 0.12) and candidate.risk != "high"
	if urgent or worthwhile: order_stop(c, item, "Observed-resource recovery" if urgent else "Public timing / tyre-offset comparison favors a stop; estimated gain %.1fs" % candidate.gain)

func order_stop(c: Dictionary, item: Dictionary, reason: String) -> void:
	var p = policy(c.id)
	var source = RaceForecaster.capture(self, c.id, active_plan(c.id), int(p.revision))
	c.next_compound = item.compound; c.next_set_id = item.id; c.scheduled_lap = -1
	queue_pit(c)
	p.order_forecast = RaceForecaster.pit_prediction(source, c.pit_gate)
	p.last_order_id = RaceJournal.append(strategy_state, self, "strategy_order", c.id, {"reason": reason, "set_id": item.id, "gate": c.pit_gate, "prediction": p.order_forecast, "scope": source.scope}, p.plan_intent_id)
	post("pit", "%s · %s. Physical pit entry remains authoritative." % [c.short, reason])

func block_plan(c: Dictionary, reason: String) -> void:
	var p = policy(c.id)
	if p.blocked_reason == reason: return
	p.blocked_reason = reason; p.plan_status = "blocked"
	RaceJournal.append(strategy_state, self, "plan_blocked", c.id, {"reason": reason}, p.plan_intent_id)
	post("radio", c.short + " · " + reason)

func leave_garage(c: Dictionary) -> void:
	if not RaceForecaster.qualifying_release(self, c).can_start_hotlap: return
	super.leave_garage(c)

func record_stint(c: Dictionary) -> void:
	super.record_stint(c)
	if not c.stints.is_empty(): c.stints.back().start_life = c.tyre

func step() -> void:
	if paused or phase not in ACTIVE: return
	var previous_phase = phase
	var routes: Array = []
	for car in cars:
		routes.append(car.route)
		if phase == "qualifying": car.auto = StrategyPlan.owns(policy(car.id), "qualifying")
	super.step()
	for car in cars:
		var p = policy(car.id)
		for channel in p.overrides.keys():
			var intent = p.overrides[channel]
			if car.distance + 0.00001 >= intent.until_distance or car.finished or car.dnf:
				car[channel] = int(intent.previous_value); p.overrides.erase(channel)
				if phase == "race" and not car.dnf and not car.finished: manage_resources(car, channel)
				RaceJournal.append(strategy_state, self, "handback", car.id, {"reason": "%s intent ended; control returned to %s" % [channel.capitalize(), p.owners[channel]]}, intent.id)
				post("radio", "%s · %s control returned to %s." % [car.short, channel, p.owners[channel]])
		if previous_phase == "race" and routes[car.id] == "track" and car.route == "pit":
			var entry_id = RaceJournal.append(strategy_state, self, "pit_entry", car.id, {"gate": car.pit_gate, "set_id": car.next_set_id}, p.last_order_id)
			p.visit = {"entered_at": total_time, "entry_id": entry_id, "prediction": p.order_forecast.duplicate(true)}
		elif previous_phase == "race" and routes[car.id] == "pit" and car.route == "track" and not p.visit.is_empty():
			var elapsed = total_time - p.visit.entered_at
			var evidence = {"visit_seconds": elapsed, "fitted_set": car.set_id, "stops": car.pit_stops}
			var estimate = p.visit.prediction
			if not estimate.is_empty(): evidence.merge({"predicted_low": estimate.visit_low, "predicted_high": estimate.visit_high, "residual": elapsed - estimate.visit})
			RaceJournal.append(strategy_state, self, "pit_exit", car.id, evidence, p.visit.entry_id)
			if not p.plan.is_empty() and p.next_stop < p.plan.stops.size() and car.set_id == p.plan.stops[int(p.next_stop)].set_id:
				p.next_stop += 1
				if p.next_stop >= p.plan.stops.size(): p.plan_status = "completed"
			p.visit = {}; p.order_forecast = {}; p.next_review = total_time + 12
		sync_ownership(car)
	if previous_phase != "results" and phase == "results":
		var classification: Array = []
		for car in standings(): classification.append({"id": car.id, "position": classification.size() + 1, "laps": car.completed, "time": car.finish_time, "retired": car.dnf})
		RaceJournal.append(strategy_state, self, "result", -1, {"classification": classification})

func snapshot() -> Dictionary:
	var data = super.snapshot()
	data.version = 5; data.strategy_state = strategy_state.duplicate(true)
	return data

static func restore_weekend(data: Dictionary) -> StrategyRaceSim:
	if not RaceCheckpoint.integral(data.get("version"), 1, 5): return null
	var legacy = data.duplicate(true)
	var is_strategy = int(legacy.version) == 5
	if is_strategy: legacy.version = 4; legacy.erase("strategy_state")
	var base = RaceSim.restore(legacy)
	if base == null: return null
	var state = data.get("strategy_state") if is_strategy else RaceJournal.create(base.cars)
	if not RaceJournal.valid(state, base.cars, base.laps): return null
	var sim = StrategyRaceSim.new(base.track)
	for key in base.snapshot():
		if key not in ["kind", "version", "track", "vehicle"]: sim.set(key, base.get(key))
	sim.strategy_state = state.duplicate(true)
	sim.strategy_state.sequence = int(sim.strategy_state.sequence)
	for car in sim.cars:
		var p = sim.policy(car.id)
		p.revision = int(p.revision); p.next_stop = int(p.next_stop); p.driver_id = int(p.driver_id)
		for channel in p.overrides:
			p.overrides[channel].value = int(p.overrides[channel].value)
			p.overrides[channel].previous_value = int(p.overrides[channel].previous_value)
		sim.sync_ownership(car)
	return sim
