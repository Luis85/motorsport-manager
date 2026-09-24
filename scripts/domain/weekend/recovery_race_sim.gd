class_name RecoveryRaceSim
extends WeatherRaceSim
## RW-14/15: staged scalar recovery and one complete fictional virtual-neutralization procedure.
const RECOVERY_CHECKPOINT_VERSION = 8
var reliability_state: Dictionary = {}
var control_state: Dictionary = {}

func _init(geometry: TrackGeometry = null, options: Dictionary = {}) -> void:
	super(geometry, options)
	reliability_state = RaceReliability.create(cars, seed_value)
	control_state = WeekendRaceControl.create()
	if geometry != null:
		RaceJournal.append(strategy_state, self, "recovery_rules", -1, {"reason": "Staged scalar reliability; virtual neutralization. Player emergency repairs default to advice only; authorize each driver explicitly. Calm mode suppresses random faults, not wear.", "version": 1})

func enhanced() -> bool:
	return not reliability_state.is_empty() and reliability_state.mode == "staged"

func reliability(id: int) -> Dictionary:
	return reliability_state.drivers[id]

func recovery_advice(id: int) -> Dictionary:
	if id < 0 or id >= cars.size(): return {}
	return RecoveryForecast.evaluate(RaceForecaster.capture(self, id, active_plan(id), int(policy(id).revision)), RaceReliability.observation(cars[id], reliability(id)))

func recovery_stale(advice: Dictionary) -> bool:
	if not RaceCheckpoint.integral(advice.get("driver_id"), 0, 11) or not RaceCheckpoint.number(advice.get("time"), 0, total_time): return true
	var id = int(advice.driver_id)
	return total_time - advice.time > RaceForecaster.MAX_AGE or advice.get("key") != RaceForecaster.material_key(self, id, int(policy(id).revision))

func forecast_parameters(id: int) -> Dictionary:
	if not enhanced(): return {}
	var c = cars[id]; var r = reliability(id)
	var mate_only = false
	for other in cars:
		if other.id != id and other.team == c.team: mate_only = reliability(int(other.id)).repair_only
	return {"key": [control_state.revision, r.revision, int(c.health / 5), int(c.engine_temperature / 5), r.repair_only, mate_only],
		"health_factor": 1.0 - maxf(0, 65 - c.health) * 0.002,
		"thermal_factor": 1.0 - maxf(0, c.engine_temperature - 115) * 0.003,
		"neutral_factor": WeekendRaceControl.PACE_FACTOR if control_state.state != "green" else 1.0,
		"repair_only": r.repair_only, "teammate_repair_only": mate_only,
		"rule_summary": "Current flag held constant for this estimate; a release or new hazard invalidates it. No future incidents are available. Local-yellow sector time is not separately forecast."}

func command(action: String, payload: Dictionary = {}) -> bool:
	if not enhanced(): return super.command(action, payload)
	if action not in ["recovery_protect", "recovery_repair", "recovery_retire", "recovery_authority"]:
		if action in ["repair", "select_set", "compound", "pit", "schedule_pit", "weather_box"] and RaceCheckpoint.integral(payload.get("id"), 0, 11):
			var c = cars[int(payload.id)]
			if action == "repair" and c.route == "pit": return fail("The repair choice is locked after pit entry. The current service plan remains unchanged.")
			if reliability(int(c.id)).repair_only and c.pit_order: return fail("Cancel the uncommitted repair-only order before changing its service or tyre plan.")
		var accepted = super.command(action, payload)
		if accepted and action in ["cancel_pit", "cancel_schedule"]: reliability(int(payload.id)).repair_only = false
		return accepted
	last_error = ""
	if not RaceCheckpoint.integral(payload.get("id"), 0, 11): return fail("Name the intended recovery driver.")
	var id = int(payload.id); var c = cars[id]; var r = reliability(id)
	if not c.player or c.dnf or c.finished: return fail("Recovery commands require a running Obsidian driver.")
	if action == "recovery_authority":
		if phase not in ["briefing", "race_preparation", "race"] or not RaceCheckpoint.integral(payload.get("revision"), 0, 1000000) or payload.revision != r.revision: return fail("Review the current recovery authority before changing it.")
		if payload.get("value") not in ["advise", "repair"] or not RaceCheckpoint.number(payload.get("budget"), 0, 30): return fail("Choose advice or bounded emergency repair with a 0–30 second repair-work budget.")
		r.emergency = payload.value; r.repair_budget = payload.budget; r.revision += 1
		log_recovery_command(action, payload, "Emergency repair authority changed; pit ownership and approved emergency limits still take precedence.")
		return true
	if phase != "race" or c.route != "track": return fail("Choose a recovery action for a car racing on track.")
	if recovery_stale({"driver_id": id, "time": payload.get("time"), "key": payload.get("key")}): return fail("Recovery conditions, ownership or flags changed. Review the current comparison.")
	if action == "recovery_protect":
		if not super.command("resource_intent", {"id": id, "channel": "engine", "value": 0, "laps": 2}): return false
		log_recovery_command(action, payload, "Engine saving for two laps; heat falls gradually. Previous engine owner returns afterward; pit ownership is unchanged.")
		return true
	if action == "recovery_retire":
		if payload.get("confirm") != true: return fail("Confirm the named driver's irreversible retirement.")
		log_recovery_command(action, payload, "Confirmed voluntary retirement; classification is retained and no clearance hazard is fabricated.")
		return super.command("retire_car", {"id": id, "confirm": true})
	var advice = recovery_advice(id)
	if not advice.repair_available: return fail(advice.unavailable_reason)
	if not RaceCheckpoint.number(payload.get("gate"), 0, 100000000) or absf(payload.gate - advice.gate.distance) > 0.001: return fail("The safe repair-entry gate changed; review the deferred entry.")
	issue_repair(c, true, "Manual repair-only call; fitted tyres retained and lifetime health is not restored.")
	log_recovery_command(action, payload, "Repair-only ordered at the displayed safe gate; manual pit ownership. Remaining tyre windows need explicit re-approval.")
	return true

func log_recovery_command(action: String, payload: Dictionary, reason: String) -> void:
	var id = int(payload.id)
	commands.append({"tick": snappedf(total_time, STEP), "action": action, "payload": payload.duplicate(true)})
	RaceJournal.append(strategy_state, self, "recovery_decision", id, {"action": action, "reason": reason, "observed": RaceReliability.observation(cars[id], reliability(id))}, policy(id).last_order_id)
	post("radio", cars[id].short + " · " + reason)

func issue_repair(c: Dictionary, manual: bool, reason: String) -> void:
	var r = reliability(int(c.id)); var p = policy(int(c.id))
	r.repair_only = true; r.revision += 1; c.repair = true; c.next_set_id = ""; c.next_compound = c.compound; c.scheduled_lap = -1
	var source = RaceForecaster.capture(self, int(c.id), active_plan(int(c.id)), int(p.revision))
	queue_pit(c)
	if manual:
		p.owners.pit = "player"
		if not p.plan.is_empty(): p.plan_status = "overridden"
	sync_ownership(c)
	p.order_forecast = RaceForecaster.pit_prediction(source, c.pit_gate)
	p.last_order_id = RaceJournal.append(strategy_state, self, "strategy_order", int(c.id), {"reason": reason, "set_id": "", "gate": c.pit_gate, "prediction": p.order_forecast, "scope": "Own observed aggregate condition; repair-only, retained fitted set."}, p.plan_intent_id)
	post("pit", c.short + " · " + reason + (" Entry deferred to the next safely reachable gate." if c.pit_deferred else ""))

func manage_resources(c: Dictionary, only_channel: String = "") -> void:
	super.manage_resources(c, only_channel)
	if not enhanced(): return
	var stage = RaceReliability.stage(c, reliability(int(c.id)))
	if stage in ["degraded", "critical"] and only_channel in ["", "engine"] and StrategyPlan.owns(policy(int(c.id)), "engine"): c.engine = 0

func engineer(c: Dictionary) -> void:
	if not enhanced(): super.engineer(c); return
	var r = reliability(int(c.id)); var p = policy(int(c.id))
	var critical = RaceReliability.stage(c, r) == "critical"
	if phase == "race" and c.route == "track" and not c.dnf and not c.finished and not c.pit_order and critical:
		manage_resources(c)
		if StrategyPlan.owns(p, "pit") and r.emergency == "repair" and p.plan.get("allow_emergency", true) and c.damage > 0 and c.damage * RaceReliability.REPAIR_SECONDS_PER_DAMAGE <= r.repair_budget:
			var advice = recovery_advice(int(c.id))
			if advice.repair_available:
				issue_repair(c, false, "Authorized critical repair within %.0fs work budget; finite fitted tyres retained." % r.repair_budget)
				return
		# Damage alone must not reach the legacy damage>24 automatic stop path and bypass authority.
		if c.tyre >= 18 and WheelTyres.usable(TyreInventory.find(c, c.set_id)) and p.plan.is_empty(): return
	if phase == "race" and c.damage > 24 and p.plan.is_empty() and c.tyre >= 18 and WheelTyres.usable(TyreInventory.find(c, c.set_id)):
		manage_resources(c); return
	super.engineer(c)

func wear_car(c: Dictionary, distance: float, cell: int, effects: Dictionary = {}, local: Dictionary = {}) -> void:
	super.wear_car(c, distance, cell, effects, local)
	if not enhanced() or phase != "race" or c.route != "track" or c.dnf or c.finished: return
	var r = reliability(int(c.id))
	var result = RaceReliability.advance(r, c, STEP, intensity != "calm")
	if not result.is_empty():
		result.observed = RaceReliability.observation(c, r); result.location = c.distance; result.sector = track.sector_at(c.distance)
		RaceJournal.append(strategy_state, self, "recovery_fault", int(c.id), result)
		if result.get("retire", false): retire(c, result.reason)
	observe_reliability(c)

func observe_reliability(c: Dictionary) -> void:
	var r = reliability(int(c.id)); var stage = RaceReliability.stage(c, r)
	if stage == r.stage: return
	var before = r.stage; r.stage = stage; r.stage_since = total_time; r.revision += 1
	var reason = "%s → %s; damage %.0f, health %.0f%%, observed heat %.0f°C." % [before, stage, c.damage, c.health, c.engine_temperature]
	RaceJournal.append(strategy_state, self, "recovery_stage", int(c.id), {"from": before, "to": stage, "reason": reason, "observed": RaceReliability.observation(c, r)})
	if c.player: post("radio", c.short + " · " + reason + " Inspect Recovery; current authority remains in force.")

func service_random_value() -> float:
	return RaceReliability.draw(reliability_state.service_stream) if enhanced() else super.service_random_value()

func begin_service(c: Dictionary) -> void:
	if not enhanced(): super.begin_service(c); return
	var r = reliability(int(c.id))
	if r.repair_only:
		c.service_set_id = ""; c.service_compound = c.compound; c.service_repair = true
		c.pit_timer = 2.0 + service_random_value() + c.damage * RaceReliability.REPAIR_SECONDS_PER_DAMAGE
	else: super.begin_service(c)
	var job = {"started": total_time, "duration": c.pit_timer, "damage_before": c.damage, "health_before": c.health,
		"repair_seconds": c.damage * RaceReliability.REPAIR_SECONDS_PER_DAMAGE if c.service_repair else 0.0,
		"repair": c.service_repair, "repair_only": r.repair_only, "set_before": c.set_id}
	job.event_id = RaceJournal.append(strategy_state, self, "recovery_service", int(c.id), {"reason": "Physical shared-box service started; repair plan frozen.", "stage": "started", "job": job.duplicate(true)}, policy(int(c.id)).last_order_id)
	r.service = job

func complete_service(c: Dictionary) -> void:
	if not enhanced(): super.complete_service(c); return
	var r = reliability(int(c.id)); var job = r.service
	if job.repair_only:
		c.damage = 0.0; c.scheduled_lap = -1; c.next_set_id = ""
		post("pit", c.short + " · Repair completed; the same fitted set and wear are retained.")
	else: super.complete_service(c)
	if job.repair:
		r.stress = 0.0; r.critical_load = 0.0; r.critical_seconds = 0.0
		# Lifetime health is intentionally not replenished. No thresholds are redrawn by repair.
	RaceJournal.append(strategy_state, self, "recovery_service", int(c.id), {"reason": "Measured scalar service completed; health was not replenished.", "stage": "completed",
		"elapsed": total_time - job.started + STEP, "damage_before": job.damage_before, "damage_after": c.damage,
		"health_before": job.health_before, "health_after": c.health, "set_before": job.set_before, "set_after": c.set_id}, job.event_id)
	observe_reliability(c)

func update_pit(c: Dictionary, old: Array = []) -> void:
	var before = c.route
	super.update_pit(c, old)
	if not enhanced(): return
	var r = reliability(int(c.id))
	if c.pit_stage == "service" and r.repair_only: c.intent = "Repairing scalar damage · retaining fitted tyres"
	if before == "pit" and c.route == "track": r.repair_only = false; r.service = {}; r.revision += 1

func pit_exit_message(c: Dictionary) -> String:
	if enhanced() and reliability(int(c.id)).repair_only: return c.short + " rejoins with the same retained tyre set and its actual wear."
	return super.pit_exit_message(c)

func pit_status(c: Dictionary) -> String:
	if enhanced() and reliability(int(c.id)).repair_only and c.route == "pit" and c.pit_stage == "service":
		return "Repairing scalar damage · %.1fs remaining\nFitted %s retained; no tyre change" % [maxf(0, c.pit_timer), c.set_id]
	return super.pit_status(c)

func update_flags() -> void:
	if not enhanced(): super.update_flags(); return
	var change = WeekendRaceControl.tick(control_state, total_time)
	flag = WeekendRaceControl.flag_value(control_state)
	yellow_sector = int(control_state.zones[0].sector) if not control_state.zones.is_empty() else -1
	flag_until = clock + maxf(0, control_state.until - total_time)
	if not change.is_empty():
		RaceJournal.append(strategy_state, self, "race_control", -1, change)
		post("flag", "Virtual neutralization ending: eight seconds, still no passing." if control_state.state == "ending" else flag + " · " + control_state.reason)

func neutral(c: Dictionary) -> bool:
	if not enhanced(): return super.neutral(c)
	return phase == "formation" or WeekendRaceControl.restricted(control_state, track.length, c.distance, c.distance + maxf(0, c.speed) * STEP / track.sample(c.distance).path_scale)

func neutral_speed_limit(c: Dictionary, sample: Dictionary) -> float:
	if not enhanced() or phase == "formation": return super.neutral_speed_limit(c, sample)
	return sample.speed * WeekendRaceControl.PACE_FACTOR if control_state.state != "green" else 25.0

func constrain_progress(c: Dictionary, next: float, old: Array, nearest: int) -> float:
	if not enhanced() or nearest < 0 or not WeekendRaceControl.restricted(control_state, track.length, c.distance, next): return next
	# Conservative pre-step bound, independent of roster iteration and the leader's braking.
	# It can stop a follower but never rewinds or pulls a distant car toward the field.
	var gap = fposmod(old[nearest].distance - old[int(c.id)].distance, track.length)
	return minf(next, maxf(c.distance, c.distance + gap - 0.05))

func update_yield(c: Dictionary, old: Array) -> float:
	if enhanced() and neutral(c):
		c.yield_to = -1; c.yield_side = 0.0; c.yield_clock = 0.0
		return track.sample(c.distance).line
	return super.update_yield(c, old)

func incident(c: Dictionary) -> void:
	if not enhanced(): super.incident(c); return
	if c.dnf or c.finished: return
	var observed = RaceReliability.observation(c, reliability(int(c.id)))
	stats.incidents += 1
	RaceSurface.contaminate(surface, c.distance / track.length, c.lane, 0.20, c.health < 50)
	if random_value() < 0.08:
		retire(c, "Barrier impact"); return
	c.loss = 3.0 + random_value() * 7.0; c.damage = minf(1000, c.damage + 4.0 + random_value() * 10.0)
	var fitted = TyreInventory.find(c, c.set_id)
	for wheel in WheelTyres.KEYS: fitted.wheels[wheel].life = maxf(0, fitted.wheels[wheel].life - 5.0)
	WheelTyres.publish(fitted); c.tyre = fitted.life; c.temperature = fitted.temperature; TyreInventory.sync(c)
	var reason = "Driving error with aggregate damage; local-yellow clearance queued for the next field step."
	var event = RaceJournal.append(strategy_state, self, "driving_incident", int(c.id), {"reason": reason, "observed": observed, "damage_after": c.damage, "location": c.distance, "sector": track.sector_at(c.distance)})
	WeekendRaceControl.enqueue(control_state, int(c.id), track.sector_at(c.distance), false, 18.0, total_time, event, reason)
	post("incident", c.short + " · " + reason)
	observe_reliability(c)

func retire(c: Dictionary, reason: String) -> void:
	if c.dnf or c.finished: return
	super.retire(c, reason)
	if not enhanced(): return
	var r = reliability(int(c.id)); r.repair_only = false; r.service = {}
	var event = RaceJournal.append(strategy_state, self, "recovery_retirement", int(c.id), {"reason": reason, "observed": RaceReliability.observation(c, r), "location": c.distance, "sector": track.sector_at(c.distance)})
	if phase == "race" and c.route == "track" and reason != "Retired by the pit wall":
		WeekendRaceControl.enqueue(control_state, int(c.id), track.sector_at(c.distance), true, 38.0, total_time, event, "Retired car requires a virtual clearance interval. No physical safety car is simulated.")
	observe_reliability(c)

func step() -> void:
	if paused or phase not in ACTIVE: return
	super.step()
	if enhanced():
		for c in cars: observe_reliability(c)

func snapshot() -> Dictionary:
	var data = super.snapshot(); data.version = RECOVERY_CHECKPOINT_VERSION
	data.reliability_state = reliability_state.duplicate(true); data.control_state = control_state.duplicate(true)
	return data

static func restore_recovery(data: Dictionary) -> RecoveryRaceSim:
	if not RaceCheckpoint.integral(data.get("version"), 1, RECOVERY_CHECKPOINT_VERSION): return null
	var native = int(data.version) == RECOVERY_CHECKPOINT_VERSION
	var legacy = data.duplicate(true)
	if native:
		legacy.version = 7; legacy.erase("reliability_state"); legacy.erase("control_state")
		# The old checkpoint validator knows the compatibility enum, not the new procedure.
		if legacy.get("flag") == "VIRTUAL": legacy.flag = "SAFETY CAR"
	var base = WeatherRaceSim.restore_weather(legacy)
	if base == null: return null
	var reliability = data.get("reliability_state") if native else RaceReliability.create(base.cars, base.seed_value, "legacy")
	var control = data.get("control_state") if native else WeekendRaceControl.create()
	if not RaceReliability.valid(reliability, base.cars, base.total_time) or not WeekendRaceControl.valid(control, base.total_time): return null
	if native and reliability.mode == "staged" and data.get("flag") != WeekendRaceControl.flag_value(control): return null
	if reliability.mode == "legacy" and (data.get("flag") == "VIRTUAL" or control != WeekendRaceControl.create()): return null
	if not valid_recovery_records(base.strategy_state.records): return null
	var sim = RecoveryRaceSim.new(base.track)
	for key in base.snapshot():
		if key not in ["kind", "version", "track", "vehicle"]: sim.set(key, base.get(key))
	sim.reliability_state = reliability.duplicate(true); sim.control_state = control.duplicate(true)
	if native: sim.flag = data.flag
	return sim

static func valid_recovery_records(records: Array) -> bool:
	for record in records:
		if record.kind not in ["recovery_rules", "recovery_stage", "recovery_fault", "recovery_decision", "recovery_retirement", "recovery_service", "race_control", "driving_incident"]: continue
		var e = record.evidence
		if not e.get("reason") is String: return false
		if record.kind in ["recovery_stage", "recovery_fault", "recovery_decision", "recovery_retirement", "driving_incident"]:
			if not e.get("observed") is Dictionary or record.driver_id < 0: return false
			var o = e.observed
			if o.get("driver_id") != record.driver_id or o.get("stage") not in RaceReliability.STAGES: return false
			for field in [["health", 0, 100], ["damage", 0, 1000], ["temperature", 0, 200], ["distance", -100000000, 100000000]]:
				if not RaceCheckpoint.number(o.get(field[0]), field[1], field[2]): return false
		if record.kind == "recovery_rules" and e.get("version") != 1: return false
		if record.kind == "recovery_decision" and e.get("action") not in ["recovery_authority", "recovery_repair", "recovery_protect", "recovery_retire"]: return false
		if record.kind == "recovery_stage" and (e.get("from") not in RaceReliability.STAGES or e.get("to") not in RaceReliability.STAGES): return false
		if record.kind == "recovery_service":
			if e.get("stage") not in ["started", "completed"]: return false
			if e.stage == "started":
				if not e.get("job") is Dictionary: return false
				for field in [["started", 0, record.time], ["duration", 0, 200], ["damage_before", 0, 1000], ["health_before", 0, 100], ["repair_seconds", 0, 140]]:
					if not RaceCheckpoint.number(e.job.get(field[0]), field[1], field[2]): return false
				if not e.job.get("repair") is bool or not e.job.get("repair_only") is bool or not e.job.get("set_before") is String: return false
			else:
				for field in [["elapsed", 0, 200], ["damage_before", 0, 1000], ["damage_after", 0, 1000], ["health_before", 0, 100], ["health_after", 0, 100]]:
					if not RaceCheckpoint.number(e.get(field[0]), field[1], field[2]): return false
				if not e.get("set_before") is String or not e.get("set_after") is String: return false
		if record.kind == "race_control":
			if e.get("rule_version") != WeekendRaceControl.VERSION or not e.get("before") is Dictionary or not e.get("after") is Dictionary: return false
	return true

func recovery_debrief() -> String:
	var lines: Array[String] = ["RECOVERY AND RACE CONTROL", "Service durations are measured. Break-even estimates are not alternate results. Repair never replenishes lifetime health."]
	var records = strategy_state.records.filter(func(r): return r.kind in ["recovery_stage", "recovery_fault", "recovery_decision", "recovery_retirement", "recovery_service", "race_control"] and r.driver_id in [-1, 3, 6])
	for record in records.slice(maxi(0, records.size() - 16)):
		var e = record.evidence; var who = cars[int(record.driver_id)].short if record.driver_id >= 0 else "CONTROL"
		var text = "%.1fs · %s · %s" % [record.time, who, e.reason]
		if record.kind == "recovery_service" and e.stage == "completed": text += " Measured service %.2fs; damage %.0f → %.0f; health %.0f%% → %.0f%%." % [e.elapsed, e.damage_before, e.damage_after, e.health_before, e.health_after]
		lines.append(text)
	return "\n\n".join(lines)
