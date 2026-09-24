class_name PracticeRaceSim
extends RecoveryRaceSim
## RW-17. Optional session, real finite-resource runs, and observation-derived forecast priors.
signal input_accepted(action: String, payload: Dictionary, context: Dictionary)
signal fixed_step_completed
const PRACTICE_CHECKPOINT_VERSION = 10
var practice_state: Dictionary = {}
var rival_styles: Dictionary = {}

func _init(geometry: TrackGeometry = null, options: Dictionary = {}) -> void:
	super(geometry, options)
	practice_state = PracticeEvidence.create(cars, clampf(maxf(600, track.estimate * 7) if geometry != null else 600, 120, 1800))

	rival_styles = RivalStyles.create(cars, options.get("rival_styles", true) == true)

func is_run_session() -> bool:
	return phase == "practice" or super.is_run_session()

func practice_driver(id: int) -> Dictionary:
	return practice_state.drivers[id]

func forecast_parameters(id: int) -> Dictionary:
	var result = super.forecast_parameters(id)
	if practice_state.is_empty() or practice_state.status in ["available", "skipped", "legacy"]: return result
	var prior = PracticeEvidence.prior(practice_state, cars[id], average(water))
	result.practice = prior
	result.key = result.get("key", []).duplicate() + [practice_driver(id).revision, cars[id].car_setup.duplicate(), prior]
	return result

func run_preview(id: int, plan: Dictionary) -> Dictionary:
	var c = cars[id]; var d = practice_driver(id)
	var lap_count = plan.get("laps", 2)
	var valid_laps = RaceCheckpoint.integral(lap_count, 1, PracticeEvidence.MAX_LAPS)
	var duration = (track.estimate / 0.70) * (int(lap_count) + 2 if valid_laps else 4) + track.pit_length / track.pit_limit + 12.0
	var reason = ""
	if phase != "practice" or practice_state.closed: reason = "Start an open practice session first."
	elif c.route != "garage" or c.dnf or c.finished: reason = "Wait for this car to return to its garage."
	elif d.runs.size() >= PracticeEvidence.MAX_RUNS: reason = "Three runs used; retain the remaining stock for qualifying and racing."
	elif plan.get("objective") not in PracticeEvidence.OBJECTIVES or not valid_laps: reason = "Choose a supported objective and one to four measured laps."
	elif not plan.get("baseline") in PracticeEvidence.BASELINES: reason = "Choose a named baseline or the current applied setup."
	elif not plan.get("set_id") is String or not WheelTyres.usable(TyreInventory.find(c, plan.set_id)): reason = "Choose a usable set belonging to this driver."
	elif clock + duration > practice_state.duration: reason = "Insufficient session time for this run and its return margin. Shorten the run or finish practice."
	var fuel = float(lap_count) * 1.14 + 3.0 if valid_laps else 0.0
	return {"driver_id": id, "time": total_time, "key": PracticeEvidence.state_key(practice_state, c),
		"revision": d.revision, "available": reason.is_empty(), "reason": reason, "duration": duration,
		"fuel": fuel, "remaining": maxf(0, practice_state.duration - clock),
		"limit": "Estimate includes out/in laps and pit transit. Slow traffic or wet running can interrupt a run; no completion is guaranteed."}

func command(action: String, payload: Dictionary = {}) -> bool:
	# Only the outer application command is recorded, not inherited helper commands.
	var recording = input_accepted.has_connections()
	var context = {"selected_id": selected_id, "paused": paused, "speed": speed, "accumulator": accumulator} if recording else {}
	var accepted = _practice_command(action, payload)
	if accepted and recording: input_accepted.emit(action, payload.duplicate(true), context)
	return accepted

func _practice_command(action: String, payload: Dictionary) -> bool:
	last_error = ""
	if action == "practice_start":
		if phase != "briefing" or practice_state.status != "available": return fail("Practice is optional and available once, before qualifying.")
		practice_state.status = "running"
		for c in cars:
			c.route = "garage"; c.qual_state = "garage"; c.speed = 0.0
		transition("practice"); record_practice(action, -1, {"reason": "Optional practice started. Each approved run spends time, tyre condition and lifetime health; no performance bonus."})
		return true
	if action == "practice_end":
		if phase != "practice" or practice_state.closed: return fail("Practice is not open.")
		close_practice("Closed by the player; current measured laps may finish, then return physically.")
		record_practice(action, -1, {"reason": "End requested; completed and partial observations retained."})
		return true
	if action == "practice_finish":
		if phase != "practice_results": return fail("Wait for all running cars to return before reviewing the next session.")
		reset_run_counters()
		transition("briefing"); record_practice(action, -1, {"reason": "Practice reviewed. Finite tyres and lifetime wear retained; race fuel allocation restored in the garage."})
		return true
	if action in ["practice_run", "practice_recall"]:
		if not RaceCheckpoint.integral(payload.get("id"), 0, cars.size() - 1): return fail("Name the practice driver explicitly.")
		var id = int(payload.id); var c = cars[id]; var d = practice_driver(id)
		if not c.player or c.dnf or c.finished: return fail("Only your running Obsidian drivers can receive a practice order.")
		if phase != "practice": return fail("Practice run commands are available only during practice.")
		if action == "practice_recall":
			if d.active.is_empty() or c.route not in ["track", "pit"] or c.pit_stage == "entry" or d.active.returning: return fail("There is no run available to recall before return commitment.")
			d.active.returning = true; d.active.tainted = true
			d.runs.back().reason = "Recalled by the player; partial evidence retained."
			c.qual_state = "inlap"; c.hot_valid = false; c.pit_gate = -1.0
			d.revision += 1; record_practice(action, id, {"reason": d.runs.back().reason, "run_id": d.active.run_id})
			return true
		var plan = payload.get("plan")
		if not plan is Dictionary: return fail("A practice run needs an explicit objective, set, lap count and setup baseline.")
		var preview = run_preview(id, plan)
		if not preview.available: return fail(preview.reason)
		if payload.get("revision") != preview.revision or payload.get("key") != preview.key: return fail("The run assumptions changed. Review the draft before release.")
		if not RaceCheckpoint.number(payload.get("time"), 0, total_time) or total_time - payload.time > RaceForecaster.MAX_AGE: return fail("The release estimate expired. Review the current session time.")
		launch_run(id, plan)
		return true
	if phase == "practice" and action not in ["pause", "speed", "setup", "setup_all", "select_set", "compound"]:
		return fail("During practice use Run, Recall or End practice. Race orders and ownership remain unchanged.")
	if phase == "practice" and action in ["setup", "setup_all", "select_set", "compound"]:
		if not RaceCheckpoint.integral(payload.get("id"), 0, 11) or cars[int(payload.id)].route != "garage": return fail("Return to the garage before changing a practice setup or tyre plan.")
	if action in ["qualify", "prepare_race"] and phase == "briefing":
		# Skipping adds only provenance; do not advance time, consume stock or change policies.
		if practice_state.status == "available":
			if not super.command(action, payload): return false
			practice_state.status = "skipped"
			record_practice("practice_skipped", -1, {"reason": "Practice skipped. Baseline estimates and normal delegation retained; no hidden performance penalty."})
			return true
	return super.command(action, payload)

func record_practice(action: String, id: int, evidence: Dictionary) -> void:
	evidence.action = action
	commands.append({"tick": snappedf(total_time, STEP), "action": action, "payload": {"id": id, "evidence": evidence.duplicate(true)}})
	RaceJournal.append(strategy_state, self, "practice_command", id, evidence)
	post("practice", (cars[id].short + " · " if id >= 0 else "") + evidence.reason)

func launch_run(id: int, plan: Dictionary) -> void:
	var c = cars[id]; var d = practice_driver(id)
	var run = {"id": "P%d-%d" % [id, d.runs.size() + 1], "objective": plan.objective,
		"target": int(plan.laps), "set_id": plan.set_id, "compound": TyreInventory.find(c, plan.set_id).compound,
		"setup": PracticeEvidence.setup_for(c, plan.baseline), "pace": 2 if plan.objective == "qualifying" else 1,
		"engine": 2 if plan.objective == "qualifying" else 1, "previous_pace": c.pace, "previous_engine": c.engine,
		"samples": [], "end": {}, "reason": "Running; return after the requested measured laps."}
	c.car_setup = run.setup.duplicate(); c.setup = c.car_setup.wing; c.pace = run.pace; c.engine = run.engine
	c.next_set_id = plan.set_id; c.next_compound = run.compound
	depart_on_planned_set(c); c.qual_runs = 0 # practice cannot consume qualifying attempts
	c.fuel = int(plan.laps) * 1.14 + 3.0
	c.previous_route = c.route; c.previous_distance = c.distance; c.previous_pit_d = c.pit_d
	run.start = PracticeEvidence.observation(self, c)
	d.runs.append(run); d.active = {"run_id": run.id, "anchor": {}, "tainted": false, "water_sum": 0.0, "ticks": 0, "returning": false}; d.revision += 1
	record_practice("practice_run", id, {"reason": "Approved " + PracticeEvidence.OBJECTIVES[run.objective] + " on " + run.set_id + "; actual setup and physical run applied.", "run_id": run.id, "plan": plan.duplicate(true)})

func close_practice(reason: String) -> void:
	practice_state.closed = true
	for c in cars:
		var d = practice_driver(int(c.id))
		if d.active.is_empty(): continue
		d.runs.back().reason = reason
		if c.qual_state == "outlap": d.active.returning = true; c.qual_state = "inlap"; c.pit_gate = -1.0
	post("practice", reason)

func reset_run_counters() -> void:
	for c in cars:
		c.qual_runs = 0; c.qual_best = 0.0; c.qual_laps = 0; c.qual_history.clear(); c.qual_state = "garage"
		c.qual_sectors = [0.0, 0.0, 0.0]; c.sectors = [0.0, 0.0, 0.0]; c.last_lap = 0.0
		c.qual_sector_start = 0.0; c.hot_start = 0.0; c.hot_valid = true; c.invalid_reason = ""
		c.next_qual = 2.0 + c.id * 3.8; c.fuel = laps * 1.13 + 1.5; c.pit_gate = -1.0
		c.yield_to = -1; c.yield_side = 0.0; c.yield_clock = 0.0
	qual_closed = false

func qualifying_crossings(c: Dictionary, before: float, after: float) -> void:
	if phase != "practice": super.qualifying_crossings(c, before, after); return
	var d = practice_driver(int(c.id))
	if d.active.is_empty() or floor(before / track.length) == floor(after / track.length): return
	var run = d.runs.back(); var a = d.active
	var gate = floor(after / track.length) * track.length
	var at = total_time - STEP * (after - gate) / maxf(0.000001, after - before)
	var observed = PracticeEvidence.observation(self, c); observed.time = at; observed.distance = gate
	if c.qual_state == "hotlap" and not a.anchor.is_empty():
		var seconds = at - a.anchor.time
		var water_mean = a.water_sum / maxi(1, a.ticks)
		var wear = maxf(0, a.anchor.life - observed.life)
		var snapshot = RaceForecaster.capture(self, int(c.id))
		snapshot.model_context.erase("practice") # comparison residual must not learn from itself
		snapshot.water = water_mean; snapshot.own.projected_fuel = (a.anchor.fuel + c.fuel) * 0.5
		var item = TyreInventory.find(c, c.set_id)
		var predicted = RaceForecaster.lap_time(snapshot, item, (a.anchor.life + c.tyre) * 0.5)
		var reference_wear = TYRES[c.compound].wear * [0.78, 1.0, 1.25][c.pace] * 1.05 * (2.2 if c.compound in ["I", "W"] and water_mean < 0.15 else 1.0)
		var clean = not a.tainted and c.hot_valid and absf(observed.water - a.anchor.water) < 0.10 and absf(observed.damage - a.anchor.damage) < 0.001
		var sample = {"time": at, "seconds": seconds, "wear": wear, "wear_ratio": wear / reference_wear,
			"model_ratio": seconds / maxf(1, predicted), "water": water_mean, "fuel": a.anchor.fuel,
			"health": observed.health, "damage": observed.damage, "clean": clean,
			"reason": "Measured full lap in comparable conditions." if clean else "Traffic, neutralization or changed conditions: retain as observation, exclude from forecast prior."}
		run.samples.append(sample); d.revision += 1
		RaceJournal.append(strategy_state, self, "practice_lap", int(c.id), {"reason": sample.reason, "run_id": run.id, "sample": sample.duplicate(true)})
		post("practice", "%s · measured %s · %d/%d laps; %s" % [c.short, format_time(seconds), run.samples.size(), run.target, "clean sample" if clean else "context-limited sample"])
		if run.samples.size() >= run.target or practice_state.closed:
			a.returning = true; c.qual_state = "inlap"; c.pit_gate = -1.0
			return
	if c.qual_state in ["outlap", "hotlap"] and not a.returning:
		c.qual_state = "hotlap"; c.hot_valid = true; c.invalid_reason = ""
		a.anchor = observed; a.tainted = false; a.water_sum = 0.0; a.ticks = 0

func step() -> void:
	var previous_time = total_time
	_practice_step()
	if total_time > previous_time: fixed_step_completed.emit()

func _practice_step() -> void:
	if phase != "practice": super.step(); return
	if paused: return
	if not practice_state.closed and clock + STEP >= practice_state.duration: close_practice("Practice clock expired; existing measured laps may finish. Partial findings retained.")
	for c in cars:
		var d = practice_driver(int(c.id))
		if not c.player and d.runs.is_empty() and clock >= d.next_release and not practice_state.closed:
			var item = TyreInventory.choose(c, "I" if average(water) > 0.24 else "M")
			var plan = {"objective": "tyre_life", "laps": 2, "set_id": item.get("id", ""), "baseline": "current"}
			if run_preview(int(c.id), plan).available: launch_run(int(c.id), plan)
		if not d.active.is_empty() and c.route == "track" and c.qual_state == "hotlap":
			d.active.water_sum += surface_at(c).water; d.active.ticks += 1
			if neutral(c) or c.loss > 0 or not WheelTyres.usable(TyreInventory.find(c, c.set_id)): d.active.tainted = true
			for other in cars:
				if other.id == c.id or other.route != "track" or other.dnf: continue
				var gap = fposmod(other.distance - c.distance, track.length)
				if gap < maxf(25, c.speed * 1.5): d.active.tainted = true
	super.step()
	for c in cars:
		var d = practice_driver(int(c.id))
		if d.active.is_empty(): continue
		if c.route == "garage" or c.dnf:
			var run = d.runs.back(); run.end = PracticeEvidence.observation(self, c)
			if run.samples.size() == run.target: run.reason = "Run completed; all requested laps measured."
			elif not run.reason.begins_with("Recalled"): run.reason = "Run ended early; partial evidence retained."
			c.pace = run.previous_pace; c.engine = run.previous_engine
			RaceJournal.append(strategy_state, self, "practice_return", int(c.id), {"reason": run.reason, "run_id": run.id, "measured_laps": run.samples.size(), "end": run.end.duplicate(true)})
			d.active = {}; d.revision += 1
		elif c.fuel < 1.1 or not WheelTyres.usable(TyreInventory.find(c, c.set_id)):
			d.active.returning = true; d.active.tainted = true; c.qual_state = "inlap"; c.hot_valid = false
	if practice_state.closed and cars.all(func(c): return c.route == "garage" or c.dnf):
		practice_state.status = "complete"; transition("practice_results")
		post("practice", "Practice complete. Review what was actually measured; the next session needs your approval.")

func car_advisories(c: Dictionary) -> Array[String]:
	if phase not in ["practice", "practice_results"]: return super.car_advisories(c)
	var messages: Array[String] = []
	for key in WheelTyres.KEYS:
		var wheel = TyreInventory.find(c,c.set_id).wheels[key]
		if wheel.punctured: messages.append(key + " punctured; recall/physical return, then choose a usable set.")
		elif wheel.life < 15: messages.append(key + " tread low; recall or retain remaining laps for later sessions.")
	if c.engine_temperature > 115: messages.append("Engine hot; recall to cool before committing another run.")
	if c.route != "garage" and c.fuel < 1.1: messages.append("Run fuel reserve low; physical return requested.")
	return messages

func contextual_rival(car: Dictionary) -> bool:
	return not rival_styles.is_empty() and rival_styles.enabled and not car.player

func review_rival_style(car: Dictionary, source: Dictionary, comparison: Dictionary) -> bool:
	if not contextual_rival(car): return false
	var driver = rival_styles.drivers[int(car.id)]
	if flag != "GREEN": return true # No discretionary style order under a restriction.
	if driver.hold_gate >= source.gate.distance: return true
	var decision = RivalStyles.decide(source, rival_state.stops, driver, comparison)
	if decision.is_empty(): return true
	RivalStyles.record(rival_styles, decision)
	if decision.choice == "box" and not TeamOrders.defer_stop(self, car):
		order_stop(car, TyreInventory.find(car, decision.set_id), decision.reason)
	return true

func plan_pit_gate(car: Dictionary) -> void:
	if not contextual_rival(car):
		super.plan_pit_gate(car); return
	# Same physical gate calculation as RaceSim. Suppress only the private rival
	# order acknowledgement; actual pit entries/exits remain public events.
	var gate = RaceForecaster.reachable_gate(self, car)
	car.pit_gate = gate.distance; car.pit_deferred = gate.deferred

func snapshot() -> Dictionary:
	var data = super.snapshot(); data.version = PRACTICE_CHECKPOINT_VERSION
	data.practice_state = practice_state.duplicate(true)
	data.rival_styles = rival_styles.duplicate(true)
	return data

static func restore_practice(data: Dictionary) -> PracticeRaceSim:
	if not RaceCheckpoint.integral(data.get("version"), 1, PRACTICE_CHECKPOINT_VERSION): return null
	var native = int(data.version) >= 9
	var native_styles = int(data.version) == PRACTICE_CHECKPOINT_VERSION
	if not native and data.get("phase") in ["practice", "practice_results"]: return null
	var inherited = data.duplicate(true)
	if native: inherited.version = 8; inherited.erase("practice_state"); inherited.erase("rival_styles")
	var base = RecoveryRaceSim.restore_recovery(inherited)
	if base == null: return null
	var state = data.get("practice_state") if native else PracticeEvidence.create(base.cars, clampf(maxf(600, base.track.estimate * 7), 120, 1800), "legacy")
	if not PracticeEvidence.valid(state, base) or not PracticeEvidence.valid_records(base.strategy_state.records, state): return null
	var styles = data.get("rival_styles") if native_styles else RivalStyles.create(base.cars, false)
	if not RivalStyles.valid(styles, base.cars, base.total_time): return null
	var sim = PracticeRaceSim.new(base.track, {"rival_styles": false})
	for key in base.snapshot():
		if key not in ["kind", "version", "track", "vehicle"]: sim.set(key, base.get(key))
	sim.practice_state = state.duplicate(true)
	sim.rival_styles = styles.duplicate(true)
	return sim
