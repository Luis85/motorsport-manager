extends "res://scripts/domain/mechanics/practice_runs.gd"
## Explicit practice session, run approval and recall commands.


func _practice_command(sim: RaceSim, action: String, payload: Dictionary) -> bool:
	sim.last_error = ""
	if action == "practice_start":
		return _practice_start(sim, action)
	if action == "practice_end":
		return _practice_end(sim, action)
	if action == "practice_finish":
		return _practice_finish(sim, action)
	if action in ["practice_run", "practice_recall"]:
		return _practice_run_order(sim, action, payload)
	return _practice_passthrough(sim, action, payload)


func _practice_start(sim: RaceSim, action: String) -> bool:
	if sim.phase != "briefing" or sim.practice_state.status != "available":
		return sim.fail("Practice is optional and available once, before qualifying.")
	sim.practice_state.status = "running"
	for c in sim.cars:
		c.route = "garage"
		c.qual_state = "garage"
		c.speed = 0.0
	sim.transition("practice")
	sim.record_practice(
		action,
		-1,
		{
			"reason":
			(
				"Optional practice started. Each approved run spends time, tyre condition and "
				+ "lifetime health; no performance bonus."
			)
		}
	)
	return true


func _practice_end(sim: RaceSim, action: String) -> bool:
	if sim.phase != "practice" or sim.practice_state.closed:
		return sim.fail("Practice is not open.")
	sim.close_practice(
		"Closed by the player; current measured laps may finish, then return physically."
	)
	sim.record_practice(
		action, -1, {"reason": "End requested; completed and partial observations retained."}
	)
	return true


func _practice_finish(sim: RaceSim, action: String) -> bool:
	if sim.phase != "practice_results":
		return sim.fail("Wait for all running cars to return before reviewing the next session.")
	sim.reset_run_counters()
	sim.transition("briefing")
	(
		sim
		. record_practice(
			action,
			-1,
			{
				"reason":
				"Practice reviewed. Finite tyres and lifetime wear retained; race fuel allocation restored in the garage."
			}
		)
	)
	return true


func _practice_run_order(sim: RaceSim, action: String, payload: Dictionary) -> bool:
	if not RaceCheckpoint.integral(payload.get("id"), 0, sim.cars.size() - 1):
		return sim.fail("Name the practice driver explicitly.")
	var id = int(payload.id)
	var c = sim.cars[id]
	var d = sim.practice_driver(id)
	if not c.player or c.dnf or c.finished:
		return sim.fail("Only your running player-team drivers can receive a practice order.")
	if sim.phase != "practice":
		return sim.fail("Practice run commands are available only during practice.")
	if action == "practice_recall":
		if (
			d.active.is_empty()
			or c.route not in ["track", "pit"]
			or c.pit_stage == "entry"
			or d.active.returning
		):
			return sim.fail("There is no run available to recall before return commitment.")
		d.active.returning = true
		d.active.tainted = true
		d.runs.back().reason = "Recalled by the player; partial evidence retained."
		c.qual_state = "inlap"
		c.hot_valid = false
		c.pit_gate = -1.0
		d.revision += 1
		sim.record_practice(action, id, {"reason": d.runs.back().reason, "run_id": d.active.run_id})
		return true
	return _approve_practice_run(sim, payload, id)


func _approve_practice_run(sim: RaceSim, payload: Dictionary, id: int) -> bool:
	var plan = payload.get("plan")
	if not plan is Dictionary:
		return sim.fail(
			"A practice run needs an explicit objective, set, lap count and setup baseline."
		)
	var preview = sim.run_preview(id, plan)
	if not preview.available:
		return sim.fail(preview.reason)
	if payload.get("revision") != preview.revision or payload.get("key") != preview.key:
		return sim.fail("The run assumptions changed. Review the draft before release.")
	if (
		not RaceCheckpoint.number(payload.get("time"), 0, sim.total_time)
		or sim.total_time - payload.time > sim.tuning.balance.forecast.maximum_age_seconds
	):
		return sim.fail("The release estimate expired. Review the current session time.")
	sim.launch_run(id, plan)
	return true


func _practice_passthrough(sim: RaceSim, action: String, payload: Dictionary) -> bool:
	if sim.phase == "practice" and action in ["pace", "engine"]:
		# Explicit live modes use the same validated, recorded command path as racing.
		# A mixed-mode practice lap must never become a clean calibration sample.
		if not sim.mechanics.before("practice", "command", [action, payload]):
			return false
		var id = int(payload.id)
		var d = sim.practice_driver(id)
		if not d.active.is_empty():
			d.active.tainted = true
			d.active.live_modes = {"pace": sim.cars[id].pace, "engine": sim.cars[id].engine}
			d.runs.back()["previous_" + action] = sim.cars[id][action]
			d.revision += 1
		return true
	return _practice_navigation_command(sim, action, payload)


func _practice_navigation_command(sim: RaceSim, action: String, payload: Dictionary) -> bool:
	if (
		sim.phase == "practice"
		and action not in ["pause", "speed", "setup", "setup_all", "select_set", "compound"]
	):
		return (
			sim
			. fail(
				"During practice use Run, Recall or End practice. Race orders and ownership remain unchanged."
			)
		)
	if sim.phase == "practice" and action in ["setup", "setup_all", "select_set", "compound"]:
		if (
			not RaceCheckpoint.integral(payload.get("id"), 0, sim.cars.size() - 1)
			or sim.cars[int(payload.id)].route != "garage"
		):
			return sim.fail("Return to the garage before changing a practice setup or tyre plan.")
	if action in ["qualify", "prepare_race"] and sim.phase == "briefing":
		# Skipping adds only provenance; do not advance time, consume stock or change policies.
		if sim.practice_state.status == "available":
			if not sim.mechanics.before("practice", "command", [action, payload]):
				return false
			sim.practice_state.status = "skipped"
			(
				sim
				. record_practice(
					"practice_skipped",
					-1,
					{
						"reason":
						"Practice skipped. Baseline estimates and normal delegation retained; no hidden performance penalty."
					}
				)
			)
			return true
	return sim.mechanics.before("practice", "command", [action, payload])
