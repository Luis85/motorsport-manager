class_name PracticeMechanic
extends RaceMechanic
## Authoritative practice rules; caller supplies state, never a view or singleton.
const PRACTICE_CHECKPOINT_VERSION = 10

func definition() -> Dictionary:
	return {"id": "practice", "version": 1, "requires": ["strategy", "weather", "recovery"], "hooks": ["is_run_session", "practice_driver", "forecast_parameters", "run_preview", "command", "_practice_command", "record_practice", "launch_run", "close_practice", "reset_run_counters", "qualifying_crossings", "step", "_practice_step", "car_advisories", "contextual_rival", "review_rival_style", "plan_pit_gate", "snapshot", "manage_resources", "engineer"]}

func install(sim: RaceSim, geometry: TrackGeometry = null, options: Dictionary = {}) -> void:

	sim.practice_state = PracticeEvidence.create(sim.cars, clampf(maxf(600, sim.track.estimate * 7) if geometry != null else 600, 120, 1800))

	sim.rival_styles = RivalStyles.create(sim.cars, options.get("rival_styles", true) == true)
	# Explicit new-weekend opt-in preserves historical saves, recipes and recordings.
	sim.duel_state = TacticalDuels.create(sim.cars, options.get("tactical_duels", false) == true)

func is_run_session(sim: RaceSim) -> bool:
	return sim.phase == "practice" or sim.mechanics.before("practice", "is_run_session", [])

func practice_driver(sim: RaceSim, id: int) -> Dictionary:
	return sim.practice_state.drivers[id]

func forecast_parameters(sim: RaceSim, id: int) -> Dictionary:
	var result = sim.mechanics.before("practice", "forecast_parameters", [id])
	if sim.practice_state.is_empty() or sim.practice_state.status in ["available", "skipped", "legacy"]: return result
	var prior = PracticeEvidence.prior(sim.practice_state, sim.cars[id], sim.average(sim.water))
	result.practice = prior
	result.key = result.get("key", []).duplicate() + [sim.practice_driver(id).revision, sim.cars[id].car_setup.duplicate(), prior]
	return result

func run_preview(sim: RaceSim, id: int, plan: Dictionary) -> Dictionary:
	var c = sim.cars[id]; var d = sim.practice_driver(id)
	var lap_count = plan.get("laps", 2)
	var valid_laps = RaceCheckpoint.integral(lap_count, 1, PracticeEvidence.MAX_LAPS)
	var duration = (sim.track.estimate / 0.70) * (int(lap_count) + 2 if valid_laps else 4) + sim.track.pit_length / sim.track.pit_limit + 12.0
	var reason = ""
	if sim.phase != "practice" or sim.practice_state.closed: reason = "Start an open practice session first."
	elif c.route != "garage" or c.dnf or c.finished: reason = "Wait for this car to return to its garage."
	elif d.runs.size() >= PracticeEvidence.MAX_RUNS: reason = "Three runs used; retain the remaining stock for qualifying and racing."
	elif plan.get("objective") not in PracticeEvidence.OBJECTIVES or not valid_laps: reason = "Choose a supported objective and one to four measured laps."
	elif plan.has("manual_modes") and not plan.manual_modes is bool: reason = "Use an explicit manual-mode choice."
	elif not plan.get("baseline") in PracticeEvidence.BASELINES: reason = "Choose a named baseline or the current applied setup."
	elif not plan.get("set_id") is String or not WheelTyres.usable(TyreInventory.find(c, plan.set_id)): reason = "Choose a usable set belonging to this driver."
	elif sim.clock + duration > sim.practice_state.duration: reason = "Insufficient session time for this run and its return margin. Shorten the run or finish practice."
	var fuel = float(lap_count) * 1.14 + 3.0 if valid_laps else 0.0
	return {"driver_id": id, "time": sim.total_time, "key": PracticeEvidence.state_key(sim.practice_state, c),
		"revision": d.revision, "available": reason.is_empty(), "reason": reason, "duration": duration,
		"fuel": fuel, "remaining": maxf(0, sim.practice_state.duration - sim.clock),
		"limit": "Estimate includes out/in laps and pit transit. Slow traffic or wet running can interrupt a run; no completion is guaranteed."}

func command(sim: RaceSim, action: String, payload: Dictionary = {}) -> bool:
	sim.last_error = ""
	# Only the outer application command is recorded, not inherited helper commands.
	var recording = sim.input_accepted.has_connections()
	var context = {"selected_id": sim.selected_id, "paused": sim.paused, "speed": sim.speed, "accumulator": sim.accumulator} if recording else {}
	var accepted = TacticalDuels.command(sim, action, payload) if action in TacticalDuels.ACTIONS else sim._practice_command(action, payload)
	if accepted: TacticalDuels.after_command(sim, action, payload)
	if accepted and recording:
		sim.input_accepted.emit(action, RaceStateValue.read_only(payload), RaceStateValue.read_only(context))
	return accepted

func _practice_command(sim: RaceSim, action: String, payload: Dictionary) -> bool:
	sim.last_error = ""
	if action == "practice_start":
		if sim.phase != "briefing" or sim.practice_state.status != "available": return sim.fail("Practice is optional and available once, before qualifying.")
		sim.practice_state.status = "running"
		for c in sim.cars:
			c.route = "garage"; c.qual_state = "garage"; c.speed = 0.0
		sim.transition("practice"); sim.record_practice(action, -1, {"reason": "Optional practice started. Each approved run spends time, tyre condition and lifetime health; no performance bonus."})
		return true
	if action == "practice_end":
		if sim.phase != "practice" or sim.practice_state.closed: return sim.fail("Practice is not open.")
		sim.close_practice("Closed by the player; current measured laps may finish, then return physically.")
		sim.record_practice(action, -1, {"reason": "End requested; completed and partial observations retained."})
		return true
	if action == "practice_finish":
		if sim.phase != "practice_results": return sim.fail("Wait for all running cars to return before reviewing the next session.")
		sim.reset_run_counters()
		sim.transition("briefing"); sim.record_practice(action, -1, {"reason": "Practice reviewed. Finite tyres and lifetime wear retained; race fuel allocation restored in the garage."})
		return true
	if action in ["practice_run", "practice_recall"]:
		if not RaceCheckpoint.integral(payload.get("id"), 0, sim.cars.size() - 1): return sim.fail("Name the practice driver explicitly.")
		var id = int(payload.id); var c = sim.cars[id]; var d = sim.practice_driver(id)
		if not c.player or c.dnf or c.finished: return sim.fail("Only your running team drivers can receive a practice order.")
		if sim.phase != "practice": return sim.fail("Practice run commands are available only during practice.")
		if action == "practice_recall":
			if d.active.is_empty() or c.route not in ["track", "pit"] or c.pit_stage == "entry" or d.active.returning: return sim.fail("There is no run available to recall before return commitment.")
			d.active.returning = true; d.active.tainted = true
			d.runs.back().reason = "Recalled by the player; partial evidence retained."
			c.qual_state = "inlap"; c.hot_valid = false; c.pit_gate = -1.0
			d.revision += 1; sim.record_practice(action, id, {"reason": d.runs.back().reason, "run_id": d.active.run_id})
			return true
		var plan = payload.get("plan")
		if not plan is Dictionary: return sim.fail("A practice run needs an explicit objective, set, lap count and setup baseline.")
		var preview = sim.run_preview(id, plan)
		if not preview.available: return sim.fail(preview.reason)
		if payload.get("revision") != preview.revision or payload.get("key") != preview.key: return sim.fail("The run assumptions changed. Review the draft before release.")
		if not RaceCheckpoint.number(payload.get("time"), 0, sim.total_time) or sim.total_time - payload.time > RaceForecaster.MAX_AGE: return sim.fail("The release estimate expired. Review the current session time.")
		sim.launch_run(id, plan)
		return true
	if sim.phase == "practice" and action in ["pace", "engine"]:
		# Explicit live modes use the same validated, recorded command path as racing.
		# A mixed-mode practice lap must never become a clean calibration sample.
		if not sim.mechanics.before("practice", "command", [action, payload]): return false
		var id = int(payload.id); var d = sim.practice_driver(id)
		if not d.active.is_empty():
			d.active.tainted = true
			d.active.live_modes = {"pace": sim.cars[id].pace, "engine": sim.cars[id].engine}
			d.runs.back()["previous_" + action] = sim.cars[id][action]
			d.revision += 1
		return true
	if sim.phase == "practice" and action not in ["pause", "speed", "setup", "setup_all", "select_set", "compound"]:
		return sim.fail("During practice use Run, Recall or End practice. Race orders and ownership remain unchanged.")
	if sim.phase == "practice" and action in ["setup", "setup_all", "select_set", "compound"]:
		if not RaceCheckpoint.integral(payload.get("id"), 0, sim.cars.size() - 1) or sim.cars[int(payload.id)].route != "garage": return sim.fail("Return to the garage before changing a practice setup or tyre plan.")
	if action in ["qualify", "prepare_race"] and sim.phase == "briefing":
		# Skipping adds only provenance; do not advance time, consume stock or change policies.
		if sim.practice_state.status == "available":
			if not sim.mechanics.before("practice", "command", [action, payload]): return false
			sim.practice_state.status = "skipped"
			sim.record_practice("practice_skipped", -1, {"reason": "Practice skipped. Baseline estimates and normal delegation retained; no hidden performance penalty."})
			return true
	return sim.mechanics.before("practice", "command", [action, payload])

func record_practice(sim: RaceSim, action: String, id: int, evidence: Dictionary) -> void:
	evidence.action = action
	sim.commands.append({"tick": snappedf(sim.total_time, RaceSim.STEP), "action": action, "payload": {"id": id, "evidence": evidence.duplicate(true)}})
	RaceJournal.append(sim.strategy_state, sim, "practice_command", id, evidence)
	sim.post("practice", (sim.cars[id].short + " · " if id >= 0 else "") + evidence.reason)

func launch_run(sim: RaceSim, id: int, plan: Dictionary) -> void:
	var c = sim.cars[id]; var d = sim.practice_driver(id)
	var run = {"id": "P%d-%d" % [id, d.runs.size() + 1], "objective": plan.objective,
		"target": int(plan.laps), "set_id": plan.set_id, "compound": TyreInventory.find(c, plan.set_id).compound,
		"setup": PracticeEvidence.setup_for(c, plan.baseline), "pace": c.pace if plan.get("manual_modes", false) == true else (2 if plan.objective == "qualifying" else 1),
		"engine": c.engine if plan.get("manual_modes", false) == true else (2 if plan.objective == "qualifying" else 1), "previous_pace": c.pace, "previous_engine": c.engine,
		"samples": [], "end": {}, "reason": "Running; return after the requested measured laps."}
	c.car_setup = run.setup.duplicate(); c.setup = c.car_setup.wing; c.pace = run.pace; c.engine = run.engine
	c.next_set_id = plan.set_id; c.next_compound = run.compound
	sim.depart_on_planned_set(c); c.qual_runs = 0 # practice cannot consume qualifying attempts
	c.fuel = int(plan.laps) * 1.14 + 3.0
	c.previous_route = c.route; c.previous_distance = c.distance; c.previous_pit_d = c.pit_d
	run.start = PracticeEvidence.observation(sim, c)
	d.runs.append(run); d.active = {"run_id": run.id, "anchor": {}, "tainted": false, "water_sum": 0.0, "ticks": 0, "returning": false}; d.revision += 1
	sim.record_practice("practice_run", id, {"reason": "Approved " + PracticeEvidence.OBJECTIVES[run.objective] + " on " + run.set_id + "; actual setup and physical run applied.", "run_id": run.id, "plan": plan.duplicate(true)})

func close_practice(sim: RaceSim, reason: String) -> void:
	sim.practice_state.closed = true
	for c in sim.cars:
		var d = sim.practice_driver(int(c.id))
		if d.active.is_empty(): continue
		d.runs.back().reason = reason
		if c.qual_state == "outlap": d.active.returning = true; c.qual_state = "inlap"; c.pit_gate = -1.0
	sim.post("practice", reason)

func reset_run_counters(sim: RaceSim) -> void:
	for c in sim.cars:
		c.qual_runs = 0; c.qual_best = 0.0; c.qual_laps = 0; c.qual_history.clear(); c.qual_state = "garage"
		c.qual_sectors = [0.0, 0.0, 0.0]; c.sectors = [0.0, 0.0, 0.0]; c.last_lap = 0.0
		c.qual_sector_start = 0.0; c.hot_start = 0.0; c.hot_valid = true; c.invalid_reason = ""
		c.next_qual = 2.0 + c.id * 3.8; c.fuel = sim.laps * 1.13 + 1.5; c.pit_gate = -1.0
		c.yield_to = -1; c.yield_side = 0.0; c.yield_clock = 0.0
	sim.qual_closed = false

func qualifying_crossings(sim: RaceSim, c: RaceCar, before: float, after: float) -> void:
	if sim.phase != "practice": sim.mechanics.before("practice", "qualifying_crossings", [c, before, after]); return
	var d = sim.practice_driver(int(c.id))
	if d.active.is_empty() or floor(before / sim.track.length) == floor(after / sim.track.length): return
	var run = d.runs.back(); var a = d.active
	var gate = floor(after / sim.track.length) * sim.track.length
	var at = sim.total_time - RaceSim.STEP * (after - gate) / maxf(0.000001, after - before)
	var observed = PracticeEvidence.observation(sim, c); observed.time = at; observed.distance = gate
	if c.qual_state == "hotlap" and not a.anchor.is_empty():
		var seconds = at - a.anchor.time
		var water_mean = a.water_sum / maxi(1, a.ticks)
		var wear = maxf(0, a.anchor.life - observed.life)
		var snapshot = RaceForecaster.capture(sim, int(c.id))
		snapshot.model_context.erase("practice") # comparison residual must not learn from itself
		snapshot.water = water_mean; snapshot.own.projected_fuel = (a.anchor.fuel + c.fuel) * 0.5
		var item = TyreInventory.find(c, c.set_id)
		var predicted = RaceForecaster.lap_time(snapshot, item, (a.anchor.life + c.tyre) * 0.5)
		var reference_wear = RaceSim.TYRES[c.compound].wear * [0.78, 1.0, 1.25][c.pace] * 1.05 * (2.2 if c.compound in ["I", "W"] and water_mean < 0.15 else 1.0)
		var clean = not a.tainted and c.pace == run.pace and c.engine == run.engine and c.hot_valid and absf(observed.water - a.anchor.water) < 0.10 and absf(observed.damage - a.anchor.damage) < 0.001
		var sample = {"time": at, "seconds": seconds, "wear": wear, "wear_ratio": wear / reference_wear,
			"model_ratio": seconds / maxf(1, predicted), "water": water_mean, "fuel": a.anchor.fuel,
			"health": observed.health, "damage": observed.damage, "clean": clean,
			"reason": "Measured full lap in comparable conditions." if clean else "Traffic, neutralization or changed conditions: retain as observation, exclude from forecast prior."}
		run.samples.append(sample); d.revision += 1
		RaceJournal.append(sim.strategy_state, sim, "practice_lap", int(c.id), {"reason": sample.reason, "run_id": run.id, "sample": sample.duplicate(true)})
		sim.post("practice", "%s · measured %s · %d/%d laps; %s" % [c.short, RaceSim.format_time(seconds), run.samples.size(), run.target, "clean sample" if clean else "context-limited sample"])
		if run.samples.size() >= run.target or sim.practice_state.closed:
			a.returning = true; c.qual_state = "inlap"; c.pit_gate = -1.0
			return
	if c.qual_state in ["outlap", "hotlap"] and not a.returning:
		c.qual_state = "hotlap"; c.hot_valid = true; c.invalid_reason = ""
		a.anchor = observed; a.tainted = false; a.water_sum = 0.0; a.ticks = 0

func step(sim: RaceSim) -> void:
	var previous_time = sim.total_time
	sim._practice_step()
	if sim.total_time > previous_time:
		TacticalDuels.after_step(sim)
		sim.fixed_step_completed.emit()

func _practice_step(sim: RaceSim) -> void:
	if sim.phase != "practice": sim.mechanics.before("practice", "step", []); return
	if sim.paused: return
	if not sim.practice_state.closed and sim.clock + RaceSim.STEP >= sim.practice_state.duration: sim.close_practice("Practice clock expired; existing measured laps may finish. Partial findings retained.")
	for c in sim.cars:
		var d = sim.practice_driver(int(c.id))
		if not c.player and d.runs.is_empty() and sim.clock >= d.next_release and not sim.practice_state.closed:
			var item = TyreInventory.choose(c, "I" if sim.average(sim.water) > 0.24 else "M")
			var plan = {"objective": "tyre_life", "laps": 2, "set_id": item.get("id", ""), "baseline": "current"}
			if sim.run_preview(int(c.id), plan).available: sim.launch_run(int(c.id), plan)
		if not d.active.is_empty() and c.route == "track" and c.qual_state == "hotlap":
			d.active.water_sum += sim.surface_at(c).water; d.active.ticks += 1
			if sim.neutral(c) or c.loss > 0 or not WheelTyres.usable(TyreInventory.find(c, c.set_id)): d.active.tainted = true
			for other in sim.cars:
				if other.id == c.id or other.route != "track" or other.dnf: continue
				var gap = fposmod(other.distance - c.distance, sim.track.length)
				if gap < maxf(25, c.speed * 1.5): d.active.tainted = true
	sim.mechanics.before("practice", "step", [])
	for c in sim.cars:
		var d = sim.practice_driver(int(c.id))
		if d.active.is_empty(): continue
		if c.route == "garage" or c.dnf:
			var run = d.runs.back(); run.end = PracticeEvidence.observation(sim, c)
			if run.samples.size() == run.target: run.reason = "Run completed; all requested laps measured."
			elif not run.reason.begins_with("Recalled"): run.reason = "Run ended early; partial evidence retained."
			c.pace = run.previous_pace; c.engine = run.previous_engine
			RaceJournal.append(sim.strategy_state, sim, "practice_return", int(c.id), {"reason": run.reason, "run_id": run.id, "measured_laps": run.samples.size(), "end": run.end.duplicate(true)})
			d.active = {}; d.revision += 1
		elif c.fuel < 1.1 or not WheelTyres.usable(TyreInventory.find(c, c.set_id)):
			d.active.returning = true; d.active.tainted = true; c.qual_state = "inlap"; c.hot_valid = false
	if sim.practice_state.closed and sim.cars.all(func(c): return c.route == "garage" or c.dnf):
		sim.practice_state.status = "complete"; sim.transition("practice_results")
		sim.post("practice", "Practice complete. Review what was actually measured; the next session needs your approval.")

func car_advisories(sim: RaceSim, c: RaceCar) -> Array[String]:
	if sim.phase not in ["practice", "practice_results"]: return sim.mechanics.before("practice", "car_advisories", [c])
	var messages: Array[String] = []
	for key in WheelTyres.KEYS:
		var wheel = TyreInventory.find(c,c.set_id).wheels[key]
		if wheel.punctured: messages.append(key + " punctured; recall/physical return, then choose a usable set.")
		elif wheel.life < 15: messages.append(key + " tread low; recall or retain remaining laps for later sessions.")
	if c.engine_temperature > 115: messages.append("Engine hot; recall to cool before committing another run.")
	if c.route != "garage" and c.fuel < 1.1: messages.append("Run fuel reserve low; physical return requested.")
	return messages

func contextual_rival(sim: RaceSim, car: RaceCar) -> bool:
	return not sim.rival_styles.is_empty() and sim.rival_styles.enabled and not car.player

func review_rival_style(sim: RaceSim, car: RaceCar, source: Dictionary, comparison: Dictionary) -> bool:
	if not sim.contextual_rival(car): return false
	var driver = sim.rival_styles.drivers[int(car.id)]
	if sim.flag != "GREEN": return true # No discretionary style order under a restriction.
	if driver.hold_gate >= source.gate.distance: return true
	var decision = DuelRivalPolicy.decide(source, sim.rival_state.stops, driver, comparison) if sim.duel_state.get("enabled", false) else RivalStyles.decide(source, sim.rival_state.stops, driver, comparison)
	if decision.is_empty(): return true
	RivalStyles.record(sim.rival_styles, decision)
	if decision.choice == "box" and not TeamOrders.defer_stop(sim, car):
		sim.order_stop(car, TyreInventory.find(car, decision.set_id), decision.reason)
	return true

func plan_pit_gate(sim: RaceSim, car: RaceCar) -> void:
	if not sim.contextual_rival(car):
		sim.mechanics.before("practice", "plan_pit_gate", [car]); return
	# Same physical gate calculation as RaceSim. Suppress only the private rival
	# order acknowledgement; actual pit entries/exits remain public events.
	var gate = RaceForecaster.reachable_gate(sim, car)
	car.pit_gate = gate.distance; car.pit_deferred = gate.deferred

func snapshot(sim: RaceSim) -> Dictionary:
	var data = sim.mechanics.before("practice", "snapshot", []); data.version = PRACTICE_CHECKPOINT_VERSION
	data.practice_state = sim.practice_state.duplicate(true)
	data.rival_styles = sim.rival_styles.duplicate(true)
	if sim.duel_state.get("enabled", false):
		data.version = TacticalDuels.CHECKPOINT_VERSION
		data.duel_state = sim.duel_state.duplicate(true)
	return data

func manage_resources(sim: RaceSim, c: RaceCar, only_channel: String = "") -> void:
	sim.mechanics.before("practice", "manage_resources", [c, only_channel])
	if not sim.duel_state.is_empty(): TacticalDuels.resource_targets(sim, c, only_channel)

func engineer(sim: RaceSim, c: RaceCar) -> void:
	var record = TacticalDuels.current(sim, int(c.id))
	if TacticalDuels.owns(record) and sim.phase == "race" and c.route == "track" and not c.dnf and not c.finished and not c.pit_order:
		var sound = WheelTyres.usable(TyreInventory.find(c, c.set_id))
		var dry_safe = c.tyre >= 18 and c.damage <= 24 and sound and sim.average(sim.water) <= 0.10 and sim.rain < 0.08 and c.compound not in ["I", "W"] and RaceReliability.stage(c, sim.reliability(int(c.id))) not in ["degraded", "critical"]
		if not dry_safe:
			# A narrow dry mandate cannot create previously absent emergency consent.
			# Restore the real previous owner before the existing recovery/weather logic.
			TacticalDuels.finish(sim, int(c.id), "review", "Outside the dry tactic's resource/reliability envelope. Previous pit ownership resumes; review recovery or weather strategy.")
		else:
			sim.manage_resources(c)
			if TacticalDuels.review(sim, c): return
	sim.mechanics.before("practice", "engineer", [c])
