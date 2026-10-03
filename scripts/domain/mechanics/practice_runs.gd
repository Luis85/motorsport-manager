extends RaceMechanic
## Physical practice run lifecycle, crossings and fixed-step completion.
const PRACTICE_CHECKPOINT_VERSION = 10


func record_practice(sim: RaceSim, action: String, id: int, evidence: Dictionary) -> void:
	evidence.action = action
	sim.commands.append(
		{
			"tick": snappedf(sim.total_time, RaceSim.STEP),
			"action": action,
			"payload": {"id": id, "evidence": evidence.duplicate(true)}
		}
	)
	RaceJournal.append(sim.strategy_state, sim, "practice_command", id, evidence)
	sim.post("practice", (sim.cars[id].short + " · " if id >= 0 else "") + evidence.reason)


func launch_run(sim: RaceSim, id: int, plan: Dictionary) -> void:
	var c = sim.cars[id]
	var d = sim.practice_driver(id)
	var run = {
		"id": "P%d-%d" % [id, d.runs.size() + 1],
		"objective": plan.objective,
		"target": int(plan.laps),
		"set_id": plan.set_id,
		"compound": TyreInventory.find(c, plan.set_id).compound,
		"setup": PracticeEvidence.setup_for(c, plan.baseline),
		"pace":
		(
			c.pace
			if plan.get("manual_modes", false) == true
			else (2 if plan.objective == "qualifying" else 1)
		),
		"engine":
		(
			c.engine
			if plan.get("manual_modes", false) == true
			else (2 if plan.objective == "qualifying" else 1)
		),
		"previous_pace": c.pace,
		"previous_engine": c.engine,
		"samples": [],
		"end": {},
		"reason": "Running; return after the requested measured laps."
	}
	c.car_setup = run.setup.duplicate()
	c.setup = c.car_setup.wing
	c.pace = run.pace
	c.engine = run.engine
	c.next_set_id = plan.set_id
	c.next_compound = run.compound
	sim.depart_on_planned_set(c)
	c.qual_runs = 0  # practice cannot consume qualifying attempts
	c.fuel = sim.tuning.practice_fuel(int(plan.laps))
	c.previous_route = c.route
	c.previous_distance = c.distance
	c.previous_pit_d = c.pit_d
	run.start = PracticeEvidence.observation(sim, c)
	d.runs.append(run)
	d.active = {
		"run_id": run.id,
		"anchor": {},
		"tainted": false,
		"water_sum": 0.0,
		"ticks": 0,
		"returning": false
	}
	d.revision += 1
	sim.record_practice(
		"practice_run",
		id,
		{
			"reason":
			(
				"Approved "
				+ PracticeEvidence.OBJECTIVES[run.objective]
				+ " on "
				+ run.set_id
				+ "; actual setup and physical run applied."
			),
			"run_id": run.id,
			"plan": plan.duplicate(true)
		}
	)


func close_practice(sim: RaceSim, reason: String) -> void:
	sim.practice_state.closed = true
	for c in sim.cars:
		var d = sim.practice_driver(int(c.id))
		if d.active.is_empty():
			continue
		d.runs.back().reason = reason
		if c.qual_state == "outlap":
			d.active.returning = true
			c.qual_state = "inlap"
			c.pit_gate = -1.0
	sim.post("practice", reason)


func reset_run_counters(sim: RaceSim) -> void:
	for c in sim.cars:
		c.qual_runs = 0
		c.qual_best = 0.0
		c.qual_laps = 0
		c.qual_history.clear()
		c.qual_state = "garage"
		c.qual_sectors = [0.0, 0.0, 0.0]
		c.sectors = [0.0, 0.0, 0.0]
		c.last_lap = 0.0
		c.qual_sector_start = 0.0
		c.hot_start = 0.0
		c.hot_valid = true
		c.invalid_reason = ""
		c.next_qual = (
			sim.tuning.sessions.release_offset_seconds
			+ c.id * sim.tuning.sessions.release_spacing_seconds
		)
		c.fuel = sim.tuning.race_fuel(sim.laps)
		c.pit_gate = -1.0
		c.yield_to = -1
		c.yield_side = 0.0
		c.yield_clock = 0.0
	sim.qual_closed = false


func qualifying_crossings(sim: RaceSim, c: RaceCar, before: float, after: float) -> void:
	if sim.phase != "practice":
		sim.mechanics.before("practice", "qualifying_crossings", [c, before, after])
		return
	var d = sim.practice_driver(int(c.id))
	if d.active.is_empty() or floor(before / sim.track.length) == floor(after / sim.track.length):
		return
	var run = d.runs.back()
	var a = d.active
	var gate = floor(after / sim.track.length) * sim.track.length
	var at = sim.total_time - RaceSim.STEP * (after - gate) / maxf(0.000001, after - before)
	var observed = PracticeEvidence.observation(sim, c)
	observed.time = at
	observed.distance = gate
	if c.qual_state == "hotlap" and not a.anchor.is_empty():
		var seconds = at - a.anchor.time
		var water_mean = a.water_sum / maxi(1, a.ticks)
		var wear = maxf(0, a.anchor.life - observed.life)
		var snapshot = RaceForecaster.capture(sim, int(c.id))
		snapshot.model_context.erase("practice")  # comparison residual must not learn from itself
		snapshot.water = water_mean
		snapshot.own.projected_fuel = (a.anchor.fuel + c.fuel) * 0.5
		var item = TyreInventory.find(c, c.set_id)
		var predicted = RaceForecaster.lap_time(snapshot, item, (a.anchor.life + c.tyre) * 0.5)
		var reference_wear = (
			c.tyre_rules.spec(c.compound).wear
			* sim.tuning.pace.wear_modes[c.pace]
			* sim.tuning.pace.forecast_wear_factor
			* (
				c.tyre_rules.spec(c.compound).thermal.wet_dry_wear_multiplier
				if (
					c.tyre_rules.wet(c.compound)
					and water_mean < c.tyre_rules.spec(c.compound).thermal.wet_dry_water_threshold
				)
				else 1.0
			)
		)
		var clean = (
			not a.tainted
			and c.pace == run.pace
			and c.engine == run.engine
			and c.hot_valid
			and absf(observed.water - a.anchor.water) < 0.10
			and absf(observed.damage - a.anchor.damage) < 0.001
		)
		var sample = {
			"time": at,
			"seconds": seconds,
			"wear": wear,
			"wear_ratio": wear / reference_wear,
			"model_ratio": seconds / maxf(1, predicted),
			"water": water_mean,
			"fuel": a.anchor.fuel,
			"health": observed.health,
			"damage": observed.damage,
			"clean": clean,
			"reason":
			(
				"Measured full lap in comparable conditions."
				if clean
				else "Traffic, neutralization or changed conditions: retain as observation, exclude from forecast prior."
			)
		}
		run.samples.append(sample)
		d.revision += 1
		RaceJournal.append(
			sim.strategy_state,
			sim,
			"practice_lap",
			int(c.id),
			{"reason": sample.reason, "run_id": run.id, "sample": sample.duplicate(true)}
		)
		sim.post(
			"practice",
			(
				"%s · measured %s · %d/%d laps; %s"
				% [
					c.short,
					RaceSim.format_time(seconds),
					run.samples.size(),
					run.target,
					"clean sample" if clean else "context-limited sample"
				]
			)
		)
		if run.samples.size() >= run.target or sim.practice_state.closed:
			a.returning = true
			c.qual_state = "inlap"
			c.pit_gate = -1.0
			return
	if c.qual_state in ["outlap", "hotlap"] and not a.returning:
		c.qual_state = "hotlap"
		c.hot_valid = true
		c.invalid_reason = ""
		a.anchor = observed
		a.tainted = false
		a.water_sum = 0.0
		a.ticks = 0


func step(sim: RaceSim) -> void:
	var previous_time = sim.total_time
	sim._practice_step()
	if sim.total_time > previous_time:
		TacticalDuels.after_step(sim)
		sim.fixed_step_completed.emit()


func _practice_step(sim: RaceSim) -> void:
	if sim.phase != "practice":
		sim.mechanics.before("practice", "step", [])
		return
	if sim.paused:
		return
	if not sim.practice_state.closed and sim.clock + RaceSim.STEP >= sim.practice_state.duration:
		sim.close_practice(
			"Practice clock expired; existing measured laps may finish. Partial findings retained."
		)
	_prepare_practice_step(sim)
	sim.mechanics.before("practice", "step", [])
	for c in sim.cars:
		var d = sim.practice_driver(int(c.id))
		if d.active.is_empty():
			continue
		if c.route == "garage" or c.dnf:
			var run = d.runs.back()
			run.end = PracticeEvidence.observation(sim, c)
			if run.samples.size() == run.target:
				run.reason = "Run completed; all requested laps measured."
			elif not run.reason.begins_with("Recalled"):
				run.reason = "Run ended early; partial evidence retained."
			c.pace = run.previous_pace
			c.engine = run.previous_engine
			RaceJournal.append(
				sim.strategy_state,
				sim,
				"practice_return",
				int(c.id),
				{
					"reason": run.reason,
					"run_id": run.id,
					"measured_laps": run.samples.size(),
					"end": run.end.duplicate(true)
				}
			)
			d.active = {}
			d.revision += 1
		elif c.fuel < 1.1 or not WheelTyres.usable(TyreInventory.find(c, c.set_id)):
			d.active.returning = true
			d.active.tainted = true
			c.qual_state = "inlap"
			c.hot_valid = false
	if sim.practice_state.closed and sim.cars.all(func(c): return c.route == "garage" or c.dnf):
		sim.practice_state.status = "complete"
		sim.transition("practice_results")
		(
			sim
			. post(
				"practice",
				"Practice complete. Review what was actually measured; the next session needs your approval."
			)
		)


func _prepare_practice_step(sim: RaceSim) -> void:
	for c in sim.cars:
		var d = sim.practice_driver(int(c.id))
		if (
			not c.player
			and d.runs.is_empty()
			and sim.clock >= d.next_release
			and not sim.practice_state.closed
		):
			var item = TyreInventory.choose(
				c, sim.tyre_rules.practice_start(sim.average(sim.water))
			)
			var plan = {
				"objective": "tyre_life",
				"laps": 2,
				"set_id": item.get("id", ""),
				"baseline": "current"
			}
			if sim.run_preview(int(c.id), plan).available:
				sim.launch_run(int(c.id), plan)
		if not d.active.is_empty() and c.route == "track" and c.qual_state == "hotlap":
			d.active.water_sum += sim.surface_at(c).water
			d.active.ticks += 1
			if (
				sim.neutral(c)
				or c.loss > 0
				or not WheelTyres.usable(TyreInventory.find(c, c.set_id))
			):
				d.active.tainted = true
			for other in sim.cars:
				if other.id == c.id or other.route != "track" or other.dnf:
					continue
				var gap = fposmod(other.distance - c.distance, sim.track.length)
				if gap < maxf(25, c.speed * 1.5):
					d.active.tainted = true
