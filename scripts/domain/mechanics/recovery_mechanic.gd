class_name RecoveryMechanic
extends RefCounted
## Authoritative recovery rules; caller supplies state, never a view or singleton.
const RECOVERY_CHECKPOINT_VERSION = 8

func definition() -> Dictionary:
	return {"id": "recovery", "version": 1, "requires": ["strategy", "weather"], "hooks": ["enhanced", "reliability", "recovery_advice", "recovery_stale", "forecast_parameters", "command", "log_recovery_command", "issue_repair", "manage_resources", "engineer", "wear_car", "observe_reliability", "service_random_value", "begin_service", "complete_service", "update_pit", "pit_exit_message", "pit_status", "update_flags", "neutral", "neutral_speed_limit", "constrain_progress", "update_yield", "incident", "retire", "step", "snapshot", "recovery_debrief"]}

func install(sim: RaceSim, geometry: TrackGeometry = null, options: Dictionary = {}) -> void:

	sim.reliability_state = RaceReliability.create(sim.cars, sim.seed_value)
	sim.control_state = WeekendRaceControl.create()
	if geometry != null:
		RaceJournal.append(sim.strategy_state, sim, "recovery_rules", -1, {"reason": "Staged scalar reliability; virtual neutralization. Player emergency repairs default to advice only; authorize each driver explicitly. Calm mode suppresses random faults, not wear.", "version": 1})

func enhanced(sim: RaceSim) -> bool:
	return not sim.reliability_state.is_empty() and sim.reliability_state.mode == "staged"

func reliability(sim: RaceSim, id: int) -> Dictionary:
	return sim.reliability_state.drivers[id]

func recovery_advice(sim: RaceSim, id: int) -> Dictionary:
	if id < 0 or id >= sim.cars.size(): return {}
	return RecoveryForecast.evaluate(RaceForecaster.capture(sim, id, sim.active_plan(id), int(sim.policy(id).revision)), RaceReliability.observation(sim.cars[id], sim.reliability(id)))

func recovery_stale(sim: RaceSim, advice: Dictionary) -> bool:
	if not RaceCheckpoint.integral(advice.get("driver_id"), 0, 11) or not RaceCheckpoint.number(advice.get("time"), 0, sim.total_time): return true
	var id = int(advice.driver_id)
	return sim.total_time - advice.time > RaceForecaster.MAX_AGE or advice.get("key") != RaceForecaster.material_key(sim, id, int(sim.policy(id).revision))

func forecast_parameters(sim: RaceSim, id: int) -> Dictionary:
	if not sim.enhanced(): return {}
	var c = sim.cars[id]; var r = sim.reliability(id)
	var mate_only = false
	for other in sim.cars:
		if other.id != id and other.team == c.team: mate_only = sim.reliability(int(other.id)).repair_only
	return {"key": [sim.control_state.revision, r.revision, int(c.health / 5), int(c.engine_temperature / 5), r.repair_only, mate_only],
		"health_factor": 1.0 - maxf(0, 65 - c.health) * 0.002,
		"thermal_factor": 1.0 - maxf(0, c.engine_temperature - 115) * 0.003,
		"neutral_factor": WeekendRaceControl.PACE_FACTOR if sim.control_state.state != "green" else 1.0,
		"repair_only": r.repair_only, "teammate_repair_only": mate_only,
		"rule_summary": "Current flag held constant for this estimate; a release or new hazard invalidates it. No future incidents are available. Local-yellow sector time is not separately forecast."}

func command(sim: RaceSim, action: String, payload: Dictionary = {}) -> bool:
	if not sim.enhanced(): return sim.mechanics.before("recovery", "command", [action, payload])
	if action not in ["recovery_protect", "recovery_repair", "recovery_retire", "recovery_authority"]:
		if action in ["repair", "select_set", "compound", "pit", "schedule_pit", "weather_box"] and RaceCheckpoint.integral(payload.get("id"), 0, 11):
			var c = sim.cars[int(payload.id)]
			if action == "repair" and c.route == "pit": return sim.fail("The repair choice is locked after pit entry. The current service plan remains unchanged.")
			if sim.reliability(int(c.id)).repair_only and c.pit_order: return sim.fail("Cancel the uncommitted repair-only order before changing its service or tyre plan.")
		var accepted = sim.mechanics.before("recovery", "command", [action, payload])
		if accepted and action in ["cancel_pit", "cancel_schedule"]: sim.reliability(int(payload.id)).repair_only = false
		return accepted
	sim.last_error = ""
	if not RaceCheckpoint.integral(payload.get("id"), 0, 11): return sim.fail("Name the intended recovery driver.")
	var id = int(payload.id); var c = sim.cars[id]; var r = sim.reliability(id)
	if not c.player or c.dnf or c.finished: return sim.fail("Recovery commands require a running Obsidian driver.")
	if action == "recovery_authority":
		if sim.phase not in ["briefing", "race_preparation", "race"] or not RaceCheckpoint.integral(payload.get("revision"), 0, 1000000) or payload.revision != r.revision: return sim.fail("Review the current recovery authority before changing it.")
		if payload.get("value") not in ["advise", "repair"] or not RaceCheckpoint.number(payload.get("budget"), 0, 30): return sim.fail("Choose advice or bounded emergency repair with a 0–30 second repair-work budget.")
		r.emergency = payload.value; r.repair_budget = payload.budget; r.revision += 1
		sim.log_recovery_command(action, payload, "Emergency repair authority changed; pit ownership and approved emergency limits still take precedence.")
		return true
	if sim.phase != "race" or c.route != "track": return sim.fail("Choose a recovery action for a car racing on track.")
	if sim.recovery_stale({"driver_id": id, "time": payload.get("time"), "key": payload.get("key")}): return sim.fail("Recovery conditions, ownership or flags changed. Review the current comparison.")
	if action == "recovery_protect":
		if not sim.mechanics.before("recovery", "command", ["resource_intent", {"id": id, "channel": "engine", "value": 0, "laps": 2}]): return false
		sim.log_recovery_command(action, payload, "Engine saving for two laps; heat falls gradually. Previous engine owner returns afterward; pit ownership is unchanged.")
		return true
	if action == "recovery_retire":
		if payload.get("confirm") != true: return sim.fail("Confirm the named driver's irreversible retirement.")
		sim.log_recovery_command(action, payload, "Confirmed voluntary retirement; classification is retained and no clearance hazard is fabricated.")
		return sim.mechanics.before("recovery", "command", ["retire_car", {"id": id, "confirm": true}])
	var advice = sim.recovery_advice(id)
	if not advice.repair_available: return sim.fail(advice.unavailable_reason)
	if not RaceCheckpoint.number(payload.get("gate"), 0, 100000000) or absf(payload.gate - advice.gate.distance) > 0.001: return sim.fail("The safe repair-entry gate changed; review the deferred entry.")
	sim.issue_repair(c, true, "Manual repair-only call; fitted tyres retained and lifetime health is not restored.")
	sim.log_recovery_command(action, payload, "Repair-only ordered at the displayed safe gate; manual pit ownership. Remaining tyre windows need explicit re-approval.")
	return true

func log_recovery_command(sim: RaceSim, action: String, payload: Dictionary, reason: String) -> void:
	var id = int(payload.id)
	sim.commands.append({"tick": snappedf(sim.total_time, RaceSim.STEP), "action": action, "payload": payload.duplicate(true)})
	RaceJournal.append(sim.strategy_state, sim, "recovery_decision", id, {"action": action, "reason": reason, "observed": RaceReliability.observation(sim.cars[id], sim.reliability(id))}, sim.policy(id).last_order_id)
	sim.post("radio", sim.cars[id].short + " · " + reason)

func issue_repair(sim: RaceSim, c: Dictionary, manual: bool, reason: String) -> void:
	var r = sim.reliability(int(c.id)); var p = sim.policy(int(c.id))
	r.repair_only = true; r.revision += 1; c.repair = true; c.next_set_id = ""; c.next_compound = c.compound; c.scheduled_lap = -1
	var source = RaceForecaster.capture(sim, int(c.id), sim.active_plan(int(c.id)), int(p.revision))
	sim.queue_pit(c)
	if manual:
		p.owners.pit = "player"
		if not p.plan.is_empty(): p.plan_status = "overridden"
	sim.sync_ownership(c)
	p.order_forecast = RaceForecaster.pit_prediction(source, c.pit_gate)
	p.last_order_id = RaceJournal.append(sim.strategy_state, sim, "strategy_order", int(c.id), {"reason": reason, "set_id": "", "gate": c.pit_gate, "prediction": p.order_forecast, "scope": "Own observed aggregate condition; repair-only, retained fitted set."}, p.plan_intent_id)
	sim.post("pit", c.short + " · " + reason + (" Entry deferred to the next safely reachable gate." if c.pit_deferred else ""))

func manage_resources(sim: RaceSim, c: Dictionary, only_channel: String = "") -> void:
	sim.mechanics.before("recovery", "manage_resources", [c, only_channel])
	if not sim.enhanced(): return
	var stage = RaceReliability.stage(c, sim.reliability(int(c.id)))
	if stage in ["degraded", "critical"] and only_channel in ["", "engine"] and StrategyPlan.owns(sim.policy(int(c.id)), "engine"): c.engine = 0

func engineer(sim: RaceSim, c: Dictionary) -> void:
	if not sim.enhanced(): sim.mechanics.before("recovery", "engineer", [c]); return
	var r = sim.reliability(int(c.id)); var p = sim.policy(int(c.id))
	var critical = RaceReliability.stage(c, r) == "critical"
	if sim.phase == "race" and c.route == "track" and not c.dnf and not c.finished and not c.pit_order and critical:
		sim.manage_resources(c)
		if StrategyPlan.owns(p, "pit") and r.emergency == "repair" and p.plan.get("allow_emergency", true) and c.damage > 0 and c.damage * RaceReliability.REPAIR_SECONDS_PER_DAMAGE <= r.repair_budget:
			var advice = sim.recovery_advice(int(c.id))
			if advice.repair_available:
				sim.issue_repair(c, false, "Authorized critical repair within %.0fs work budget; finite fitted tyres retained." % r.repair_budget)
				return
		# Damage alone must not reach the legacy damage>24 automatic stop path and bypass authority.
		if c.tyre >= 18 and WheelTyres.usable(TyreInventory.find(c, c.set_id)) and p.plan.is_empty(): return
	if sim.phase == "race" and c.damage > 24 and p.plan.is_empty() and c.tyre >= 18 and WheelTyres.usable(TyreInventory.find(c, c.set_id)):
		sim.manage_resources(c); return
	sim.mechanics.before("recovery", "engineer", [c])

func wear_car(sim: RaceSim, c: Dictionary, distance: float, cell: int, effects: Dictionary = {}, local: Dictionary = {}) -> void:
	sim.mechanics.before("recovery", "wear_car", [c, distance, cell, effects, local])
	if not sim.enhanced() or sim.phase != "race" or c.route != "track" or c.dnf or c.finished: return
	var r = sim.reliability(int(c.id))
	var result = RaceReliability.advance(r, c, RaceSim.STEP, sim.intensity != "calm")
	if not result.is_empty():
		result.observed = RaceReliability.observation(c, r); result.location = c.distance; result.sector = sim.track.sector_at(c.distance)
		RaceJournal.append(sim.strategy_state, sim, "recovery_fault", int(c.id), result)
		if result.get("retire", false): sim.retire(c, result.reason)
	sim.observe_reliability(c)

func observe_reliability(sim: RaceSim, c: Dictionary) -> void:
	var r = sim.reliability(int(c.id)); var stage = RaceReliability.stage(c, r)
	if stage == r.stage: return
	var before = r.stage; r.stage = stage; r.stage_since = sim.total_time; r.revision += 1
	var reason = "%s → %s; damage %.0f, health %.0f%%, observed heat %.0f°C." % [before, stage, c.damage, c.health, c.engine_temperature]
	RaceJournal.append(sim.strategy_state, sim, "recovery_stage", int(c.id), {"from": before, "to": stage, "reason": reason, "observed": RaceReliability.observation(c, r)})
	if c.player: sim.post("radio", c.short + " · " + reason + " Inspect Recovery; current authority remains in force.")

func service_random_value(sim: RaceSim) -> float:
	return RaceReliability.draw(sim.reliability_state.service_stream) if sim.enhanced() else sim.mechanics.before("recovery", "service_random_value", [])

func begin_service(sim: RaceSim, c: Dictionary) -> void:
	if not sim.enhanced(): sim.mechanics.before("recovery", "begin_service", [c]); return
	var r = sim.reliability(int(c.id))
	if r.repair_only:
		c.service_set_id = ""; c.service_compound = c.compound; c.service_repair = true
		c.pit_timer = 2.0 + sim.service_random_value() + c.damage * RaceReliability.REPAIR_SECONDS_PER_DAMAGE
	else: sim.mechanics.before("recovery", "begin_service", [c])
	var job = {"started": sim.total_time, "duration": c.pit_timer, "damage_before": c.damage, "health_before": c.health,
		"repair_seconds": c.damage * RaceReliability.REPAIR_SECONDS_PER_DAMAGE if c.service_repair else 0.0,
		"repair": c.service_repair, "repair_only": r.repair_only, "set_before": c.set_id}
	job.event_id = RaceJournal.append(sim.strategy_state, sim, "recovery_service", int(c.id), {"reason": "Physical shared-box service started; repair plan frozen.", "stage": "started", "job": job.duplicate(true)}, sim.policy(int(c.id)).last_order_id)
	r.service = job

func complete_service(sim: RaceSim, c: Dictionary) -> void:
	if not sim.enhanced(): sim.mechanics.before("recovery", "complete_service", [c]); return
	var r = sim.reliability(int(c.id)); var job = r.service
	if job.repair_only:
		c.damage = 0.0; c.scheduled_lap = -1; c.next_set_id = ""
		sim.post("pit", c.short + " · Repair completed; the same fitted set and wear are retained.")
	else: sim.mechanics.before("recovery", "complete_service", [c])
	if job.repair:
		r.stress = 0.0; r.critical_load = 0.0; r.critical_seconds = 0.0
		# Lifetime health is intentionally not replenished. No thresholds are redrawn by repair.
	RaceJournal.append(sim.strategy_state, sim, "recovery_service", int(c.id), {"reason": "Measured scalar service completed; health was not replenished.", "stage": "completed",
		"elapsed": sim.total_time - job.started + RaceSim.STEP, "damage_before": job.damage_before, "damage_after": c.damage,
		"health_before": job.health_before, "health_after": c.health, "set_before": job.set_before, "set_after": c.set_id}, job.event_id)
	sim.observe_reliability(c)

func update_pit(sim: RaceSim, c: Dictionary, old: Array = []) -> void:
	var before = c.route
	sim.mechanics.before("recovery", "update_pit", [c, old])
	if not sim.enhanced(): return
	var r = sim.reliability(int(c.id))
	if c.pit_stage == "service" and r.repair_only: c.intent = "Repairing scalar damage · retaining fitted tyres"
	if before == "pit" and c.route == "track": r.repair_only = false; r.service = {}; r.revision += 1

func pit_exit_message(sim: RaceSim, c: Dictionary) -> String:
	if sim.enhanced() and sim.reliability(int(c.id)).repair_only: return c.short + " rejoins with the same retained tyre set and its actual wear."
	return sim.mechanics.before("recovery", "pit_exit_message", [c])

func pit_status(sim: RaceSim, c: Dictionary) -> String:
	if sim.enhanced() and sim.reliability(int(c.id)).repair_only and c.route == "pit" and c.pit_stage == "service":
		return "Repairing scalar damage · %.1fs remaining\nFitted %s retained; no tyre change" % [maxf(0, c.pit_timer), c.set_id]
	return sim.mechanics.before("recovery", "pit_status", [c])

func update_flags(sim: RaceSim) -> void:
	if not sim.enhanced(): sim.mechanics.before("recovery", "update_flags", []); return
	var change = WeekendRaceControl.tick(sim.control_state, sim.total_time)
	sim.flag = WeekendRaceControl.flag_value(sim.control_state)
	sim.yellow_sector = int(sim.control_state.zones[0].sector) if not sim.control_state.zones.is_empty() else -1
	sim.flag_until = sim.clock + maxf(0, sim.control_state.until - sim.total_time)
	if not change.is_empty():
		RaceJournal.append(sim.strategy_state, sim, "race_control", -1, change)
		sim.post("flag", "Virtual neutralization ending: eight seconds, still no passing." if sim.control_state.state == "ending" else sim.flag + " · " + sim.control_state.reason)

func neutral(sim: RaceSim, c: Dictionary) -> bool:
	if not sim.enhanced(): return sim.mechanics.before("recovery", "neutral", [c])
	return sim.phase == "formation" or WeekendRaceControl.restricted(sim.control_state, sim.track.length, c.distance, c.distance + maxf(0, c.speed) * RaceSim.STEP / sim.track.sample(c.distance).path_scale)

func neutral_speed_limit(sim: RaceSim, c: Dictionary, sample: Dictionary) -> float:
	if not sim.enhanced() or sim.phase == "formation": return sim.mechanics.before("recovery", "neutral_speed_limit", [c, sample])
	return sample.speed * WeekendRaceControl.PACE_FACTOR if sim.control_state.state != "green" else 25.0

func constrain_progress(sim: RaceSim, c: Dictionary, next: float, old: Array, nearest: int) -> float:
	if not sim.enhanced() or nearest < 0 or not WeekendRaceControl.restricted(sim.control_state, sim.track.length, c.distance, next): return next
	# Conservative pre-step bound, independent of roster iteration and the leader's braking.
	# It can stop a follower but never rewinds or pulls a distant car toward the field.
	var gap = fposmod(old[nearest].distance - old[int(c.id)].distance, sim.track.length)
	return minf(next, maxf(c.distance, c.distance + gap - 0.05))

func update_yield(sim: RaceSim, c: Dictionary, old: Array) -> float:
	if sim.enhanced() and sim.neutral(c):
		c.yield_to = -1; c.yield_side = 0.0; c.yield_clock = 0.0
		return sim.track.sample(c.distance).line
	return sim.mechanics.before("recovery", "update_yield", [c, old])

func incident(sim: RaceSim, c: Dictionary) -> void:
	if not sim.enhanced(): sim.mechanics.before("recovery", "incident", [c]); return
	if c.dnf or c.finished: return
	var observed = RaceReliability.observation(c, sim.reliability(int(c.id)))
	sim.stats.incidents += 1
	RaceSurface.contaminate(sim.surface, c.distance / sim.track.length, c.lane, 0.20, c.health < 50)
	if sim.random_value() < 0.08:
		sim.retire(c, "Barrier impact"); return
	c.loss = 3.0 + sim.random_value() * 7.0; c.damage = minf(1000, c.damage + 4.0 + sim.random_value() * 10.0)
	var fitted = TyreInventory.find(c, c.set_id)
	for wheel in WheelTyres.KEYS: fitted.wheels[wheel].life = maxf(0, fitted.wheels[wheel].life - 5.0)
	WheelTyres.publish(fitted); c.tyre = fitted.life; c.temperature = fitted.temperature; TyreInventory.sync(c)
	var reason = "Driving error with aggregate damage; local-yellow clearance queued for the next field step."
	var event = RaceJournal.append(sim.strategy_state, sim, "driving_incident", int(c.id), {"reason": reason, "observed": observed, "damage_after": c.damage, "location": c.distance, "sector": sim.track.sector_at(c.distance)})
	WeekendRaceControl.enqueue(sim.control_state, int(c.id), sim.track.sector_at(c.distance), false, 18.0, sim.total_time, event, reason)
	sim.post("incident", c.short + " · " + reason)
	sim.observe_reliability(c)

func retire(sim: RaceSim, c: Dictionary, reason: String) -> void:
	if c.dnf or c.finished: return
	sim.mechanics.before("recovery", "retire", [c, reason])
	if not sim.enhanced(): return
	var r = sim.reliability(int(c.id)); r.repair_only = false; r.service = {}
	var event = RaceJournal.append(sim.strategy_state, sim, "recovery_retirement", int(c.id), {"reason": reason, "observed": RaceReliability.observation(c, r), "location": c.distance, "sector": sim.track.sector_at(c.distance)})
	if sim.phase == "race" and c.route == "track" and reason != "Retired by the pit wall":
		WeekendRaceControl.enqueue(sim.control_state, int(c.id), sim.track.sector_at(c.distance), true, 38.0, sim.total_time, event, "Retired car requires a virtual clearance interval. No physical safety car is simulated.")
	sim.observe_reliability(c)

func step(sim: RaceSim) -> void:
	if sim.paused or sim.phase not in RaceSim.ACTIVE: return
	sim.mechanics.before("recovery", "step", [])
	if sim.enhanced():
		for c in sim.cars: sim.observe_reliability(c)

func snapshot(sim: RaceSim) -> Dictionary:
	var data = sim.mechanics.before("recovery", "snapshot", []); data.version = RECOVERY_CHECKPOINT_VERSION
	data.reliability_state = sim.reliability_state.duplicate(true); data.control_state = sim.control_state.duplicate(true)
	return data

func recovery_debrief(sim: RaceSim) -> String:
	var lines: Array[String] = ["RECOVERY AND RACE CONTROL", "Service durations are measured. Break-even estimates are not alternate results. Repair never replenishes lifetime health."]
	var records = sim.strategy_state.records.filter(func(r): return r.kind in ["recovery_stage", "recovery_fault", "recovery_decision", "recovery_retirement", "recovery_service", "race_control"] and r.driver_id in [-1, 3, 6])
	for record in records.slice(maxi(0, records.size() - 16)):
		var e = record.evidence; var who = sim.cars[int(record.driver_id)].short if record.driver_id >= 0 else "CONTROL"
		var text = "%.1fs · %s · %s" % [record.time, who, e.reason]
		if record.kind == "recovery_service" and e.stage == "completed": text += " Measured service %.2fs; damage %.0f → %.0f; health %.0f%% → %.0f%%." % [e.elapsed, e.damage_before, e.damage_after, e.health_before, e.health_after]
		lines.append(text)
	return "\n\n".join(lines)
