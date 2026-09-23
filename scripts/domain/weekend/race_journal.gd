class_name RaceJournal
extends RefCounted
## Append-only evidence; observational queries never write here or consume live RNG.
const LIMIT = 50000

static func create(cars: Array) -> Dictionary:
	var policies: Array = []
	for car in cars: policies.append(StrategyPlan.policy(car))
	return {"version": 1, "sequence": 0, "records": [], "policies": policies, "truncated": false}

static func append(state: Dictionary, sim: RaceSim, kind: String, driver_id: int, evidence: Dictionary = {}, related: String = "") -> String:
	state.sequence += 1
	var id = "rw-%d" % int(state.sequence)
	if state.records.size() >= LIMIT:
		# Explicitly disclose the bound; never discard earlier decisions silently.
		state.truncated = true
		return id
	state.records.append({"id": id, "tick": roundi(sim.total_time / RaceSim.STEP), "time": sim.total_time,
		"phase": sim.phase, "kind": kind, "driver_id": driver_id, "related_id": related,
		"provenance": "observed" if kind in ["pit_entry", "pit_exit", "result", "handback"] else "command_or_model",
		"evidence": evidence.duplicate(true)})
	return id

static func valid(state: Variant, cars: Array, laps: int) -> bool:
	if not state is Dictionary or state.get("version") != 1: return false
	if not RaceCheckpoint.integral(state.get("sequence"), 0, 100000000) or not state.get("truncated") is bool: return false
	if not state.get("records") is Array or state.records.size() > LIMIT: return false
	var previous = 0
	for record in state.records:
		if not record is Dictionary or not record.get("id") is String or not record.id.begins_with("rw-"): return false
		var sequence = int(record.id.trim_prefix("rw-"))
		if record.id != "rw-%d" % sequence or sequence <= previous or sequence > state.sequence: return false
		previous = sequence
		if not RaceCheckpoint.integral(record.get("tick"), 0, 2000000000) or not RaceCheckpoint.number(record.get("time"), 0, 100000000): return false
		if not RaceCheckpoint.integral(record.get("driver_id"), -1, 11): return false
		for key in ["kind", "phase", "related_id", "provenance"]:
			if not record.get(key) is String: return false
		if not record.get("evidence") is Dictionary: return false
		if record.kind == "scenario":
			for key in ["id", "title", "objective", "hint", "track_hash", "ruleset", "assists"]:
				if not record.evidence.get(key) is String: return false
		if record.kind == "pit_exit":
			if not RaceCheckpoint.number(record.evidence.get("visit_seconds"), 0, 100000000): return false
			if record.evidence.has("predicted_low"):
				for key in ["predicted_low", "predicted_high", "residual"]:
					if not RaceCheckpoint.number(record.evidence.get(key), -100000000, 100000000): return false
	if not state.get("policies") is Array or state.policies.size() != cars.size(): return false
	for i in range(cars.size()):
		var p = state.policies[i]
		if not p is Dictionary or p.get("driver_id") != i: return false
		if not p.get("owners") is Dictionary or p.owners.size() != StrategyPlan.CHANNELS.size(): return false
		for channel in StrategyPlan.CHANNELS:
			if p.owners.get(channel) not in ["engineer", "player"]: return false
		if not p.get("overrides") is Dictionary or p.overrides.size() > 2: return false
		for channel in p.overrides:
			var intent = p.overrides[channel]
			if channel not in ["pace", "engine"] or not intent is Dictionary: return false
			if not RaceCheckpoint.number(intent.get("until_distance"), 0, 100000000) or not intent.get("id") is String: return false
			if not RaceCheckpoint.integral(intent.get("value"), 0, 2) or not RaceCheckpoint.integral(intent.get("previous_value"), 0, 2): return false
		if not RaceCheckpoint.integral(p.get("revision"), 0, 1000000) or not RaceCheckpoint.integral(p.get("next_stop"), 0, 3): return false
		if p.get("plan_status") not in ["unplanned", "approved", "overridden", "blocked", "completed"]: return false
		if not p.get("plan") is Dictionary: return false
		if not p.plan.is_empty() and not StrategyPlan.validate(p.plan, cars[i], laps, 0, false).is_empty(): return false
		if p.next_stop > p.plan.get("stops", []).size(): return false
		if not RaceCheckpoint.number(p.get("next_review"), 0, 100000000): return false
		for key in ["last_order_id", "plan_intent_id", "blocked_reason"]:
			if not p.get(key) is String: return false
		if not p.get("order_forecast") is Dictionary: return false
		if not valid_prediction(p.order_forecast): return false
		if not p.get("held") is Dictionary or p.held.size() > 8 or not p.get("visit") is Dictionary: return false
		if not p.get("notices", {}) is Dictionary or p.get("notices", {}).size() > 8: return false
		for key in p.get("notices", {}):
			if not key is String or not p.notices[key] is String: return false
		for key in p.held:
			if not key is String or not p.held[key] is String: return false
		if not p.visit.is_empty():
			if not RaceCheckpoint.number(p.visit.get("entered_at"), 0, 100000000) or not p.visit.get("prediction") is Dictionary or not p.visit.get("entry_id") is String or not valid_prediction(p.visit.prediction): return false
	return true

static func valid_prediction(prediction: Dictionary) -> bool:
	if prediction.is_empty(): return true
	for key in ["visit", "visit_low", "visit_high", "loss", "loss_low", "loss_high", "queue", "gate", "entry_eta", "warmup", "exit_station"]:
		if not RaceCheckpoint.number(prediction.get(key), 0, 100000000): return false
	for key in ["position", "position_low", "position_high"]:
		if not RaceCheckpoint.integral(prediction.get(key), 1, 12): return false
	if prediction.visit_low > prediction.visit_high or prediction.position_low > prediction.position_high: return false
	if not prediction.get("traffic") is Array or prediction.traffic.size() > 11: return false
	for name in prediction.traffic:
		if not name is String: return false
	return true

static func debrief(state: Dictionary) -> Array[String]:
	var lines: Array[String] = ["DECISION DEBRIEF", "Measured outcomes are observations. Strategy alternatives are uncalibrated model estimates, not alternate race results."]
	if state.truncated: lines.append("Journal capacity reached. Later decisions are not available in this record.")
	for record in state.records:
		var who = RaceSim.ROSTER[int(record.driver_id)][0] if record.driver_id >= 0 else "TEAM"
		var e = record.evidence
		if record.kind == "command":
			lines.append("%.1fs · %s · %s accepted" % [record.time, who, str(e.get("action", "intent")).replace("_", " ")])
		elif record.kind == "pit_exit":
			var text = "%.1fs · %s · Measured pit visit %.1fs" % [record.time, who, float(e.get("visit_seconds", 0))]
			if e.has("predicted_low"): text += " · prior estimate %.1f–%.1fs · residual %+.1fs" % [e.predicted_low, e.predicted_high, e.residual]
			lines.append(text + " (visit duration, not net race-time loss)")
		elif record.kind in ["handback", "strategy_order", "plan_blocked", "warning"]:
			lines.append("%.1fs · %s · %s" % [record.time, who, e.get("reason", record.kind.replace("_", " "))])
	return lines
