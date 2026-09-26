class_name TacticalDuels
extends RefCounted
## A bounded, persistent mandate for ONE next stop. Physical pit execution stays in RaceSim.
const VERSION = 1
const CHECKPOINT_VERSION = 11
const MODEL = "race-weekend-0.15-duels-v1"
const HISTORY_LIMIT = 8
const EVENT_LIMIT = 20
const STATES = ["approved", "preparing", "ordered", "executing", "evaluating", "review", "completed", "abandoned"]
const TERMINAL = ["completed", "abandoned"]
const ACTIONS = ["duel_approve", "duel_cancel"]

static func create(cars: Array, enabled: bool) -> Dictionary:
	var drivers: Array = []
	for c in cars: drivers.append({"driver_id": int(c.id), "revision": 0, "active": {}, "history": [], "truncated": false})
	return {"version": VERSION, "enabled": enabled, "sequence": 0, "drivers": drivers}

static func current(sim, id: int) -> Dictionary:
	if sim.duel_state.is_empty() or not sim.duel_state.enabled: return {}
	return sim.duel_state.drivers[id].active

static func live(record: Dictionary) -> bool:
	return not record.is_empty() and record.status not in TERMINAL

static func owns(record: Dictionary) -> bool:
	return live(record) and record.borrowed_pits

static func archive(driver: Dictionary) -> void:
	if driver.active.is_empty(): return
	driver.history.append(driver.active.duplicate(true))
	if driver.history.size() > HISTORY_LIMIT: driver.history.pop_front(); driver.truncated = true
	driver.active = {}

static func command(sim, action: String, payload: Dictionary) -> bool:
	if not sim.duel_state.enabled: return sim.fail("This saved weekend retains the earlier model. Start a new Strategic Duels weekend to use tactical plans.")
	if not RaceCheckpoint.integral(payload.get("id"), 0, sim.cars.size() - 1): return sim.fail("Name the intended driver explicitly.")
	var id = int(payload.id); var c = sim.cars[id]; var d = sim.duel_state.drivers[id]
	if not c.player: return sim.fail("A rival cannot receive your tactical commands.")
	if not RaceCheckpoint.integral(payload.get("revision"), 0, 1000000) or payload.revision != d.revision: return sim.fail("The tactical record changed. Review it before committing.")
	if d.revision >= 999999 or sim.duel_state.sequence >= 999999: return sim.fail("The tactical history limit has been reached for this weekend.")
	if action == "duel_cancel":
		if not live(d.active) or payload.get("plan_id") != d.active.id: return sim.fail("There is no matching active tactical plan to end.")
		finish(sim, id, "abandoned", "Ended by the player. Any accepted pit order stays valid; use ordinary pit cancellation before entry.")
	else:
		if live(d.active) and d.active.status != "review": return sim.fail("End or review the active tactic before approving another.")
		if not payload.get("plan") is Dictionary: return sim.fail("Review a complete tactical draft first.")
		var preview = TacticalForecast.preview(sim, id, payload.plan)
		if not preview.available: return sim.fail(preview.reason)
		if payload.get("key") != preview.key or not RaceCheckpoint.number(payload.get("time"), 0, sim.total_time) or sim.total_time - payload.time > RaceForecaster.MAX_AGE: return sim.fail("The tactical comparison is stale. Refresh it before approval.")
		if not RaceCheckpoint.integral(payload.get("policy_revision"), 0, 1000000) or payload.policy_revision != sim.policy(id).revision: return sim.fail("The underlying pit policy changed. Review it first.")
		if live(d.active): finish(sim, id, "abandoned", "Replaced after an explicit new comparison; previous evidence retained.")
		archive(d)
		var p = sim.policy(id); var target = sim.cars[int(payload.plan.target_id)]
		sim.duel_state.sequence += 1
		var record = {"id": "duel-%d" % int(sim.duel_state.sequence), "driver_id": id, "plan": payload.plan.duplicate(true),
			"status": "approved", "reason": "", "created_at": sim.total_time, "updated_at": sim.total_time, "next_review": sim.total_time,
			"previous_owner": p.owners.pit, "borrowed_pits": payload.plan.authority == "execute", "policy_revision": int(p.revision),
			"replaced_stop": int(p.next_stop) if p.next_stop < p.plan.get("stops", []).size() else -1,
			"own_stops": int(c.pit_stops), "target_stops": int(target.pit_stops), "own_entry": -1.0, "own_exit": -1.0,
			"target_entry": sim.total_time if target.route == "pit" else -1.0, "target_exit": -1.0,
			"order_id": "", "gate": -1.0, "events": [], "events_truncated": false,
			"forecast": {"time": preview.time, "key": preview.key, "gain": preview.candidate.gain,
				"seconds": preview.candidate.seconds, "pit_loss": preview.pit.loss, "warmup": preview.pit.warmup,
				"traffic": preview.candidate.traffic_cost, "gap": preview.gap, "rival_cases": preview.rival_cases}}
		d.active = record
		if record.borrowed_pits: p.owners.pit = "engineer"; p.revision += 1; record.policy_revision = int(p.revision)
		record_event(sim, id, "approved", "Approved %s against %s. %s" % [TacticalForecast.LABELS[record.plan.kind], target.name,
			"Pit timing only is delegated temporarily; other owners are unchanged." if record.borrowed_pits else "Recommendation only; existing pit ownership and orders are unchanged."])
		sim.sync_ownership(c)
	sim.commands.append({"tick": snappedf(sim.total_time, RaceSim.STEP), "action": action, "payload": payload.duplicate(true)})
	return true

static func record_event(sim, id: int, status: String, reason: String) -> void:
	var d = sim.duel_state.drivers[id]; var r = d.active
	if r.is_empty() or r.status == status and r.reason == reason: return
	r.status = status; r.reason = reason; r.updated_at = sim.total_time; d.revision += 1
	var event = {"time": sim.total_time, "status": status, "reason": reason}
	if r.events.size() < EVENT_LIMIT: r.events.append(event)
	else: r.events_truncated = true
	RaceJournal.append(sim.strategy_state, sim, "tactical_plan", id, {"plan_id": r.id, "status": status, "reason": reason, "target_id": int(r.plan.target_id), "order_id": r.order_id}, r.id)
	sim.post("radio", sim.cars[id].short + " · " + reason)

static func release(sim, id: int, restore_owner: bool = true) -> void:
	var r = current(sim, id)
	if r.is_empty() or not r.borrowed_pits: return
	if restore_owner: sim.policy(id).owners.pit = r.previous_owner
	r.borrowed_pits = false; sim.policy(id).revision += 1
	sim.sync_ownership(sim.cars[id])

static func finish(sim, id: int, status: String, reason: String, restore_owner: bool = true) -> void:
	release(sim, id, restore_owner)
	record_event(sim, id, status, reason)

static func after_command(sim, action: String, payload: Dictionary) -> void:
	if not sim.duel_state.enabled or action in ACTIONS or not RaceCheckpoint.integral(payload.get("id"), 0, 11): return
	var id = int(payload.id); var r = current(sim, id)
	if not live(r): return
	var supersedes = action in ["approve_plan", "clear_plan", "pit", "schedule_pit", "cancel_pit", "cancel_schedule", "select_set", "compound", "weather_box", "recovery_repair", "auto", "retire_car", "recovery_retire"]
	if action == "delegation" and payload.get("channel") == "pit": supersedes = true
	if not supersedes: return
	# A pre-race set edit does not transfer pit authority. Every other listed
	# command explicitly supersedes it; never restore an old owner over that choice.
	var restore_owner = action in ["select_set", "compound"] and sim.phase != "race"
	finish(sim, id, "abandoned", "Superseded by the accepted %s command. Its ownership and any physical pit transaction are retained." % action.replace("_", " "), restore_owner)

static func resource_targets(sim, c: Dictionary, channel: String = "") -> void:
	var r = current(sim, int(c.id))
	if not owns(r) or not r.order_id.is_empty() or sim.phase != "race": return
	var p = sim.policy(int(c.id)); var plan = r.plan
	var gate_lap = plan.from_lap + (plan.wait_laps if plan.kind == "extend" else 0)
	var distance = maxf(0, (float(gate_lap) - 1) + sim.track.pit_entry / sim.track.length - c.distance / sim.track.length)
	if channel in ["", "pace"] and StrategyPlan.owns(p, "pace") and c.tyre - distance * RaceSim.TYRES[c.compound].wear * 1.05 < plan.tyre_floor:
		c.pace = 0
	if channel in ["", "engine"] and StrategyPlan.owns(p, "engine") and RaceForecaster.fuel_margin(sim, c) < plan.fuel_reserve:
		c.engine = 0

static func review(sim, c: Dictionary) -> bool:
	var id = int(c.id); var r = current(sim, id)
	if not owns(r): return false
	if not r.order_id.is_empty(): return true
	if sim.total_time < r.next_review: return true
	r.next_review = sim.total_time + 1.0
	var plan = r.plan; var rival = sim.cars[int(plan.target_id)]
	if rival.dnf or rival.finished:
		finish(sim, id, "review", "The target contest ended. Review a new target; the previous pit owner resumes."); return true
	if plan.kind == "undercut" and plan.rival_first and (rival.route == "pit" or rival.pit_stops > r.target_stops):
		finish(sim, id, "review", "Rival entry observed before our order. Undercut withheld; review or keep the previous pit policy."); return true
	var preview = TacticalForecast.preview(sim, id, plan)
	if not preview.available:
		finish(sim, id, "review", preview.reason + " Previous pit ownership resumes."); return true
	if RaceForecaster.fuel_margin(sim, c) < plan.fuel_reserve:
		finish(sim, id, "review", "The observed fuel projection is below the approved reserve. No new tactical stop; review the resource policy."); return true
	var fitted = TyreInventory.find(c, c.set_id)
	if RaceForecaster.limiting_life(fitted, fitted.life) < plan.tyre_floor:
		finish(sim, id, "review", "A limiting wheel crossed the approved tread floor. Review recovery rather than silently extending."); return true
	var safe = RaceForecaster.reachable_gate(sim, c)
	var release_lap = plan.from_lap + (plan.wait_laps if plan.kind == "extend" else 0)
	if safe.lap < release_lap:
		record_event(sim, id, "preparing", "Waiting for the approved lap %d opportunity; physical resources continue to be spent." % release_lap); return true
	if sim.flag != "GREEN":
		record_event(sim, id, "preparing", "Race restriction: tactical order withheld. The approved window still expires normally."); return true
	if preview.candidate.risk == "high":
		finish(sim, id, "review", "The remaining-stint estimate is high risk. The tactic did not authorize this exposure; review the plan."); return true
	if plan.avoid_traffic and (not preview.pit.traffic.is_empty() or preview.pit.queue > 1.0):
		if safe.lap >= plan.to_lap:
			finish(sim, id, "review", "The final authorized entry still has traffic or shared-box exposure. No forced stop; review another approach.")
		else: record_event(sim, id, "preparing", "Waiting inside the window to avoid predicted rejoin traffic or a shared-box queue.")
		return true
	if TeamOrders.defer_stop(sim, c, {"from_lap": plan.from_lap, "to_lap": plan.to_lap}): return true
	sim.order_stop(c, TyreInventory.find(c, plan.set_id), "Tactical %s against %s at the authorized safe entry" % [plan.kind, rival.short])
	r.order_id = sim.policy(id).last_order_id; r.gate = c.pit_gate
	record_event(sim, id, "ordered", "Pit order accepted for %s; awaiting physical entry. A later rival response does not cancel it." % plan.set_id)
	return true

static func after_step(sim) -> void:
	if not sim.duel_state.enabled: return
	for id in [3, 6]:
		var r = current(sim, id)
		if not live(r): continue
		var c = sim.cars[id]; var rival = sim.cars[int(r.plan.target_id)]
		if c.dnf:
			finish(sim, id, "abandoned", "Driver retired. Tactical execution ended; no successful pass or strategy gain is inferred."); continue
		if c.finished:
			finish(sim, id, "completed", "Race finished. The compared pit cycle remained unresolved; use final classification, not temporary pit positions."); continue
		if rival.dnf or rival.finished:
			finish(sim, id, "completed" if r.own_exit >= 0 else "review", "Target contest ended before a comparable pit-cycle observation. No tactical win is inferred."); continue
		if r.status == "review" or sim.phase != "race": continue
		if r.target_entry < 0 and (rival.route == "pit" or rival.pit_stops > r.target_stops):
			r.target_entry = sim.total_time
			record_event(sim, id, r.status, "Rival pit entry observed. This is public execution, not knowledge of its earlier plan.")
		if r.target_entry >= 0 and r.target_exit < 0 and rival.route == "track": r.target_exit = sim.total_time
		if r.order_id.is_empty():
			if c.pit_order or c.route == "pit":
				finish(sim, id, "abandoned", "Another authorized pit transaction took precedence. Its accepted order remains unchanged."); continue
			if sim.average(sim.water) > 0.15:
				finish(sim, id, "review", "Conditions left the dry tactical envelope. Review weather strategy; no dry stop was forced."); continue
			if RaceForecaster.reachable_gate(sim, c).lap > r.plan.to_lap:
				finish(sim, id, "review", "The last authorized entry passed. No late substitute order was invented."); continue
			if r.plan.authority == "recommend" and sim.total_time >= r.next_review:
				r.next_review = sim.total_time + 1.0
				if r.plan.kind == "undercut" and r.plan.rival_first and r.target_entry >= 0:
					finish(sim, id, "review", "Rival entry observed first. Recommendation needs review; manual ownership remains unchanged.")
				elif r.status == "approved": record_event(sim, id, "preparing", "Recommendation is being watched. Compare and issue any pit call manually; silence never authorizes execution.")
			continue
		if r.own_entry < 0 and c.route == "pit":
			r.own_entry = sim.total_time
			record_event(sim, id, "executing", "Physical pit entry observed. Queue, fitting and service remain authoritative.")
		if r.own_entry >= 0 and r.own_exit < 0 and c.route == "track":
			r.own_exit = sim.total_time
			var p = sim.policy(id)
			if r.replaced_stop >= 0 and c.set_id == r.plan.set_id and p.revision == r.policy_revision:
				p.next_stop = maxi(int(p.next_stop), int(r.replaced_stop) + 1)
				p.plan_status = "completed" if p.next_stop >= p.plan.get("stops", []).size() else "approved"
			release(sim, id)
			record_event(sim, id, "evaluating", "Physical pit exit observed. Previous pit ownership resumes; waiting for the rival cycle before judging relative position.")
		if r.own_exit >= 0 and r.target_exit >= 0 and c.route == "track" and rival.route == "track":
			var equivalent = c.pit_stops == r.own_stops + 1 and rival.pit_stops == r.target_stops + 1
			var result = "Different stop counts prevent an equivalent pit-cycle comparison."
			if equivalent:
				result = "%s after both observed pit exits. This is an observed relative position, not proof of causation or the final result." % ("Ahead of " + rival.name if c.distance > rival.distance else "Behind " + rival.name)
			finish(sim, id, "completed", result)

static func describe(sim, id: int) -> String:
	if sim.duel_state.is_empty() or not sim.duel_state.enabled: return "Earlier saved model retained; tactical plans are available in new weekends."
	var d = sim.duel_state.drivers[id]; var r = d.active
	if r.is_empty(): return "No tactical plan for " + sim.cars[id].name + ". Existing strategy and ownership remain active."
	var p = r.plan
	var lines: Array[String] = ["%s · %s" % [sim.cars[id].name, TacticalForecast.LABELS[p.kind]],
		"Target: %s · %s · %s" % [sim.cars[int(p.target_id)].name, r.status.to_upper(), "PITS DELEGATED" if r.borrowed_pits else "NO TACTICAL EXECUTION AUTHORITY"],
		"Window %d–%d · %s · floor %.0f%% / fuel reserve %.2f lap units" % [p.from_lap, p.to_lap, p.set_id, p.tyre_floor, p.fuel_reserve],
		r.reason, "At approval: estimated gain %+.1fs against the current plan; pit loss ~%.1fs, warm-up ~%.1fs. Not calibrated probabilities." % [r.forecast.gain, r.forecast.pit_loss, r.forecast.warmup]]
	lines.append(r.forecast.rival_cases)
	for event in r.events: lines.append("%.1fs · %s · %s" % [event.time, event.status, event.reason])
	if r.events_truncated: lines.append("The 20-event tactical detail limit was reached. Consult the retained race journal for later records.")
	if d.truncated: lines.append("Only the latest eight previous tactical plans are retained here.")
	return "\n\n".join(lines)

static func debrief(sim) -> String:
	if sim.duel_state.is_empty() or not sim.duel_state.enabled: return ""
	var lines: Array[String] = ["STRATEGIC DUELS · APPROVAL, EXECUTION, OBSERVATION"]
	for id in [3, 6]:
		lines.append(describe(sim, id))
		for r in sim.duel_state.drivers[id].history:
			lines.append("Previous %s · %s · %s" % [r.id, r.status, r.reason])
	return "\n\n".join(lines)

static func valid(state: Variant, sim: StrategyRaceSim) -> bool:
	if not state is Dictionary or state.size() != 4 or state.get("version") != VERSION or (not state.get("enabled") is bool or not state.enabled): return false
	if not RaceCheckpoint.integral(state.get("sequence"), 0, 1000000) or not state.get("drivers") is Array or state.drivers.size() != 12: return false
	var ids: Array = []
	for id in range(12):
		var d = state.drivers[id]
		if not d is Dictionary or d.size() != 5 or d.get("driver_id") != id or not RaceCheckpoint.integral(d.get("revision"), 0, 1000000): return false
		if not d.get("active") is Dictionary or not d.get("history") is Array or d.history.size() > HISTORY_LIMIT or not d.get("truncated") is bool: return false
		if not sim.cars[id].player and (not d.active.is_empty() or not d.history.is_empty() or d.revision != 0 or d.truncated): return false
		var records: Array = d.history.duplicate()
		if not d.active.is_empty(): records.append(d.active)
		var last = -1.0
		for r in records:
			if not valid_record(r, sim, id) or r.id in ids or r.created_at < last: return false
			ids.append(r.id); last = r.created_at
			if int(r.id.trim_prefix("duel-")) > state.sequence: return false
			if r != d.active and (r.status not in TERMINAL or r.borrowed_pits): return false
		if owns(d.active):
			if sim.policy(id).owners.pit != "engineer" or sim.policy(id).revision != d.active.policy_revision: return false
		if not valid_active(d.active, sim, id): return false
	return true

static func valid_active(r: Dictionary, sim: StrategyRaceSim, id: int) -> bool:
	if r.is_empty() or r.status in TERMINAL + ["review"]: return true
	if r.status in ["approved", "preparing"]: return r.order_id.is_empty() and r.own_entry < 0 and r.own_exit < 0
	if sim.phase != "race": return false
	if r.status == "evaluating": return r.own_exit >= 0 and not r.borrowed_pits
	# A claimed accepted/executing tactic must refer to the actual current pit
	# transaction. Otherwise a corrupt save could suppress ordinary pit control
	# forever while waiting for an order which the physical model never received.
	var car = sim.cars[id]
	if not r.borrowed_pits or not car.pit_order or sim.policy(id).last_order_id != r.order_id: return false
	if absf(float(car.pit_gate) - float(r.gate)) > 0.00001: return false
	if r.status == "ordered": return car.route == "track" and r.own_entry < 0
	return r.status == "executing" and car.route == "pit" and r.own_entry >= 0 and r.own_exit < 0

static func valid_record(r: Variant, sim: StrategyRaceSim, id: int) -> bool:
	if not r is Dictionary or r.size() != 23 or r.get("driver_id") != id: return false
	if not r.get("id") is String or not r.id.begins_with("duel-") or r.id != "duel-%d" % int(r.id.trim_prefix("duel-")) or int(r.id.trim_prefix("duel-")) < 1: return false
	if not TacticalForecast.validate_plan(r.get("plan"), sim.cars, id, sim.laps).is_empty() or r.get("status") not in STATES: return false
	if not r.get("reason") is String or r.reason.length() > 700 or not r.get("borrowed_pits") is bool or r.get("previous_owner") not in ["engineer", "player"]: return false
	if r.borrowed_pits and (r.plan.authority != "execute" or r.status in TERMINAL + ["review", "evaluating"]): return false
	for key in ["created_at", "updated_at"]:
		if not RaceCheckpoint.number(r.get(key), 0, sim.total_time + RaceSim.STEP): return false
	if r.updated_at < r.created_at or not RaceCheckpoint.number(r.get("next_review"), 0, sim.total_time + 1.1): return false
	for key in ["own_entry", "own_exit", "target_entry", "target_exit"]:
		if not RaceCheckpoint.number(r.get(key), -1, sim.total_time + RaceSim.STEP): return false
	if r.own_entry >= 0 and r.own_entry < r.created_at: return false
	if r.target_entry >= 0 and r.target_entry < r.created_at: return false
	if r.own_exit >= 0 and (r.own_entry < 0 or r.own_exit < r.own_entry): return false
	if r.target_exit >= 0 and (r.target_entry < 0 or r.target_exit < r.target_entry): return false
	for key in ["own_stops", "target_stops", "policy_revision"]:
		if not RaceCheckpoint.integral(r.get(key), 0, 1000000): return false
	if not RaceCheckpoint.integral(r.get("replaced_stop"), -1, 2): return false
	if not RaceCheckpoint.number(r.get("gate"), -1, sim.laps * sim.track.length) or not r.get("order_id") is String or r.order_id.length() > 40: return false
	if r.order_id.is_empty() and (r.gate != -1 or r.own_entry >= 0 or r.status in ["ordered", "executing", "evaluating"]): return false
	if not r.order_id.is_empty() and r.gate < 0: return false
	if r.status == "executing" and r.own_entry < 0: return false
	if r.status == "evaluating" and r.own_exit < 0: return false
	if r.own_stops > sim.cars[id].pit_stops or r.target_stops > sim.cars[int(r.plan.target_id)].pit_stops: return false
	if not r.get("events") is Array or r.events.is_empty() or r.events.size() > EVENT_LIMIT or not r.get("events_truncated") is bool: return false
	var previous = float(r.created_at)
	for event in r.events:
		if not event is Dictionary or event.size() != 3 or event.get("status") not in STATES or not event.get("reason") is String or event.reason.length() > 700: return false
		if not RaceCheckpoint.number(event.get("time"), previous, r.updated_at): return false
		previous = float(event.time)
	if not r.events_truncated:
		var latest = r.events.back()
		if latest.status != r.status or latest.reason != r.reason or absf(float(latest.time) - float(r.updated_at)) > 0.00001: return false
	var f = r.get("forecast")
	if not f is Dictionary or f.size() != 9 or not f.get("key") is String or f.key.length() != 64 or not f.key.is_valid_hex_number(false): return false
	if not f.get("rival_cases") is String or f.rival_cases.length() > 1600: return false
	for key in ["time", "seconds", "pit_loss", "warmup", "traffic"]:
		if not RaceCheckpoint.number(f.get(key), 0, 10000000): return false
	for key in ["gain", "gap"]:
		if not RaceCheckpoint.number(f.get(key), -10000000, 10000000): return false
	return f.time <= r.created_at
