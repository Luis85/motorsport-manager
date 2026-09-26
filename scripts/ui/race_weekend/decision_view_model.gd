class_name RaceDecisionViewModel
extends RefCounted
## One presentation snapshot, sourced only from the existing public forecaster/feed.
## A rendered option remains bound to its driver, set, safe gate and source revision.
static func capture(model: StrategyRaceSim, id: int, forecast: Dictionary) -> Dictionary:
	if id not in [3, 6] or forecast.is_empty(): return {}
	var car = model.cars[id]; var policy = model.policy(id)
	var entries = DecisionFeed.for_driver(model, id, policy, forecast)
	var primary = DecisionFeed.primary(entries)
	var order = model.standings(model.phase in ["qualifying", "qualifying_results"])
	return {"driver_id":id, "name":car.name, "short":car.short, "phase":model.phase,
		"forecast":forecast.duplicate(true), "decisions":entries.duplicate(true), "primary":primary.duplicate(true),
		"revision":int(policy.revision), "position":order.find(car)+1, "set_id":car.set_id,
		"tyre":car.tyre, "fuel":car.fuel, "fuel_margin":RaceForecaster.fuel_margin(model,car),
		"ownership":StrategyPlan.ownership_text(policy), "pit_stops":car.pit_stops,
		"release":RaceForecaster.qualifying_release(model, car)}

static func pit_payload(value: Dictionary) -> Dictionary:
	var f = value.forecast
	return {"id":value.driver_id, "forecast_key":f.key, "forecast_time":f.time, "expected_gate":f.gate.distance, "set_id":f.replacement_id}

## UI receipt only: references the command journal and physical run/override identity.
## No save data, policy, RNG, orders or simulation time are changed by these queries.
static func accepted_receipt(model: StrategyRaceSim, value: Dictionary, action: String, payload: Dictionary, after_sequence: int) -> Dictionary:
	var id = int(value.driver_id)
	var car = model.cars[id]
	var record: Dictionary = {}
	var records: Array = model.strategy_state.records
	var offset = records.size()
	for i in range(records.size() - 1, -1, -1):
		var candidate = records[i]
		if int(str(candidate.id).trim_prefix("rw-")) <= after_sequence: break
		if candidate.kind == "command" and int(candidate.driver_id) == id and candidate.evidence.get("action") == action:
			record = candidate; offset = i + 1; break
	return {"driver_id": id, "action": action, "command_id": record.get("id", ""),
		"record_offset": offset, "phase": value.phase, "accepted_at": model.total_time,
		"snapshot": value.duplicate(true), "payload": payload.duplicate(true),
		"run": int(car.qual_runs), "set_id": car.set_id, "channel": payload.get("channel", ""),
		"until_distance": model.policy(id).overrides.get(payload.get("channel", ""), {}).get("until_distance", 0.0),
		"outcome": {}, "entry_id": "", "recalled": action == "recall"}

static func terminal(label: String, detail: String) -> Dictionary:
	return {"terminal": true, "label": label, "detail": detail}

static func receipt_progress(model: StrategyRaceSim, receipt: Dictionary) -> Dictionary:
	if not receipt.get("outcome", {}).is_empty(): return receipt.outcome
	var id = int(receipt.driver_id)
	var car = model.cars[id]
	var action: String = receipt.action
	if receipt.command_id.is_empty():
		return terminal("Outcome unavailable", "The accepted command is outside the retained journal. No completion is inferred.")
	# Read only records after this exact command. Unrelated drivers, pit visits and
	# later actions can never be used as evidence that this action completed.
	var entry_id: String = receipt.get("entry_id", "")
	var recalled: bool = receipt.get("recalled", false)
	var records: Array = model.strategy_state.records
	for i in range(int(receipt.record_offset), records.size()):
		var record = records[i]
		if int(record.driver_id) != id: continue
		var evidence: Dictionary = record.evidence
		if action == "pit":
			if record.kind == "pit_entry" and record.related_id == receipt.command_id: entry_id = record.id
			elif record.kind == "pit_exit" and not entry_id.is_empty() and record.related_id == entry_id:
				return terminal("Completed", "Pit visit %.1fs · fitted %s · entry/exit receipts match this order. Visit duration is not net race-time loss." % [evidence.visit_seconds, evidence.fitted_set])
			elif record.kind == "command" and entry_id.is_empty():
				if evidence.get("action") in ["cancel_pit", "cancel_schedule"]:
					return terminal("Canceled", "The approach was explicitly canceled before physical pit entry.")
				if evidence.get("action") in ["pit", "schedule_pit"]:
					return terminal("Superseded", "A later explicit pit order replaced this approach; its outcome is separate.")
		elif action == "resource_intent":
			if record.kind == "handback" and record.related_id == receipt.command_id:
				if car.distance + 0.00001 >= float(receipt.until_distance):
					return terminal("Completed", "Two-lap %s intent ended. %s. This is a control handback, not a measured fuel-saving claim." % [receipt.channel, evidence.get("reason", "Recorded handback")])
				return terminal("Interrupted", "The session or driver ended before the intended distance. Control handback is recorded, not normal completion.")
			if record.kind == "command":
				var replacement: String = evidence.get("action", "")
				var replacement_payload: Dictionary = evidence.get("payload", {})
				if replacement == receipt.channel or replacement == "auto" or (replacement in ["resource_intent", "delegation"] and replacement_payload.get("channel") == receipt.channel):
					return terminal("Superseded", "An explicit %s instruction replaced this bounded intent; no normal handback is claimed." % replacement.replace("_", " "))
		elif action == "send" and record.kind == "command" and evidence.get("action") == "recall":
			recalled = true
		if record.kind == "command" and evidence.get("action") == "retire_car":
			return terminal("Interrupted", "The reviewed driver was explicitly retired before this action completed.")
	if action in ["send", "recall"]:
		var lap: Dictionary = {}
		for candidate in car.qual_history:
			if int(candidate.run) == int(receipt.run): lap = candidate; break
		var returned = car.route == "garage" or model.phase == "qualifying_results" or int(car.qual_runs) > int(receipt.run)
		if returned:
			if not lap.is_empty():
				return terminal("Completed", "Run %d returned · %s%s. Only the recorded lap is reported." % [receipt.run, "valid lap %.3fs" % lap.time if lap.valid else "invalid lap: " + str(lap.get("reason", "Not classified")), " · recalled" if recalled else ""])
			if recalled: return terminal("Canceled", "Run %d was recalled without a recorded flying lap." % receipt.run)
			return terminal("Interrupted", "Run %d returned without a recorded flying lap; no successful lap is inferred." % receipt.run)
	if car.dnf or car.finished or model.phase != receipt.phase:
		return terminal("Interrupted", "Driver/session ended before correlated completion evidence was available.")
	if model.strategy_state.truncated:
		return terminal("Outcome unavailable", "The journal reached its retention limit before completion was recorded.")
	if action == "pit": return {"terminal": false, "label": "Executing", "detail": model.pit_status(car), "entry_id": entry_id}
	if action == "resource_intent":
		if model.policy(id).overrides.get(receipt.channel, {}).get("id") != receipt.command_id:
			return terminal("Outcome unavailable", "The matching override is no longer active, but no retained replacement or handback establishes why.")
		return {"terminal": false, "label": "Executing", "detail": "%s intent · %.2f laps to recorded expiry · prior owner retained" % [receipt.channel.capitalize(), maxf(0, receipt.until_distance - car.distance) / model.track.length]}
	return {"terminal": false, "label": "Executing", "detail": "Run %d · %s · fitted %s" % [receipt.run, car.qual_state, car.set_id], "recalled": recalled}
