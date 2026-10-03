class_name PracticeMechanic
extends "res://scripts/domain/mechanics/practice_commands.gd"


func definition() -> Dictionary:
	return {
		"id": "practice",
		"version": 1,
		"requires": ["strategy", "weather", "recovery"],
		"hooks":
		[
			"is_run_session",
			"practice_driver",
			"forecast_parameters",
			"run_preview",
			"command",
			"_practice_command",
			"record_practice",
			"launch_run",
			"close_practice",
			"reset_run_counters",
			"qualifying_crossings",
			"step",
			"_practice_step",
			"car_advisories",
			"contextual_rival",
			"review_rival_style",
			"plan_pit_gate",
			"snapshot",
			"manage_resources",
			"engineer"
		]
	}


func install(sim: RaceSim, geometry: TrackGeometry = null, options: Dictionary = {}) -> void:
	sim.practice_state = PracticeEvidence.create(
		sim.cars,
		sim.tuning.practice_duration(sim.track.estimate if geometry != null else 0),
		"available",
		sim.tuning.balance.practice
	)

	sim.rival_styles = RivalStyles.create(
		sim.cars, options.get("rival_styles", true) == true, sim.tuning.competition
	)
	# Explicit new-weekend opt-in preserves historical saves, recipes and recordings.
	sim.duel_state = TacticalDuels.create(sim.cars, options.get("tactical_duels", false) == true)


func is_run_session(sim: RaceSim) -> bool:
	return sim.phase == "practice" or sim.mechanics.before("practice", "is_run_session", [])


func practice_driver(sim: RaceSim, id: int) -> Dictionary:
	return sim.practice_state.drivers[id]


func forecast_parameters(sim: RaceSim, id: int) -> Dictionary:
	var result = sim.mechanics.before("practice", "forecast_parameters", [id])
	if (
		sim.practice_state.is_empty()
		or sim.practice_state.status in ["available", "skipped", "legacy"]
	):
		return result
	var prior = PracticeEvidence.prior(
		sim.practice_state, sim.cars[id], sim.average(sim.water), sim.tuning.balance.practice
	)
	result.practice = prior
	result.key = (
		result.get("key", []).duplicate()
		+ [sim.practice_driver(id).revision, sim.cars[id].car_setup.duplicate(), prior]
	)
	return result


func run_preview(sim: RaceSim, id: int, plan: Dictionary) -> Dictionary:
	var c = sim.cars[id]
	var d = sim.practice_driver(id)
	var rules: Dictionary = sim.tuning.balance.practice
	var lap_count = plan.get("laps", rules.default_laps)
	var valid_laps = RaceCheckpoint.integral(lap_count, 1, PracticeEvidence.MAX_LAPS)
	var duration = (
		(sim.track.estimate / rules.run_transit_factor) * (int(lap_count) + 2 if valid_laps else 4)
		+ sim.track.pit_length / sim.track.pit_limit
		+ rules.run_return_allowance_seconds
	)
	var reason = ""
	if sim.phase != "practice" or sim.practice_state.closed:
		reason = "Start an open practice session first."
	elif c.route != "garage" or c.dnf or c.finished:
		reason = "Wait for this car to return to its garage."
	elif d.runs.size() >= PracticeEvidence.MAX_RUNS:
		reason = "Three runs used; retain the remaining stock for qualifying and racing."
	elif plan.get("objective") not in PracticeEvidence.OBJECTIVES or not valid_laps:
		reason = "Choose a supported objective and one to four measured laps."
	elif plan.has("manual_modes") and not plan.manual_modes is bool:
		reason = "Use an explicit manual-mode choice."
	elif not plan.get("baseline") in PracticeEvidence.BASELINES:
		reason = "Choose a named baseline or the current applied setup."
	elif (
		not plan.get("set_id") is String
		or not WheelTyres.usable(TyreInventory.find(c, plan.set_id))
	):
		reason = "Choose a usable set belonging to this driver."
	elif sim.clock + duration > sim.practice_state.duration:
		reason = "Insufficient session time for this run and its return margin. Shorten the run or finish practice."
	var fuel = sim.tuning.practice_fuel(int(lap_count)) if valid_laps else 0.0
	return {
		"driver_id": id,
		"time": sim.total_time,
		"key": PracticeEvidence.state_key(sim.practice_state, c),
		"revision": d.revision,
		"available": reason.is_empty(),
		"reason": reason,
		"duration": duration,
		"fuel": fuel,
		"remaining": maxf(0, sim.practice_state.duration - sim.clock),
		"limit":
		(
			"Estimate includes out/in laps and pit transit. Slow traffic or wet running can "
			+ "interrupt a run; no completion is guaranteed."
		)
	}


func command(sim: RaceSim, action: String, payload: Dictionary = {}) -> bool:
	sim.last_error = ""
	# Only the outer application command is recorded, not inherited helper commands.
	var recording = sim.input_accepted.has_connections()
	var context = (
		{
			"selected_id": sim.selected_id,
			"paused": sim.paused,
			"speed": sim.speed,
			"accumulator": sim.accumulator
		}
		if recording
		else {}
	)
	var accepted = (
		TacticalDuels.command(sim, action, payload)
		if action in TacticalDuels.ACTIONS
		else sim._practice_command(action, payload)
	)
	if accepted:
		TacticalDuels.after_command(sim, action, payload)
	if accepted and recording:
		sim.input_accepted.emit(
			action, RaceStateValue.read_only(payload), RaceStateValue.read_only(context)
		)
	return accepted


func car_advisories(sim: RaceSim, c: RaceCar) -> Array[String]:
	if sim.phase not in ["practice", "practice_results"]:
		return sim.mechanics.before("practice", "car_advisories", [c])
	var messages: Array[String] = []
	for key in WheelTyres.KEYS:
		var wheel = TyreInventory.find(c, c.set_id).wheels[key]
		if wheel.punctured:
			messages.append(key + " punctured; recall/physical return, then choose a usable set.")
		elif wheel.life < 15:
			messages.append(key + " tread low; recall or retain remaining laps for later sessions.")
	if c.engine_temperature > sim.tuning.condition.heat_reference_c:
		messages.append("Engine hot; recall to cool before committing another run.")
	if c.route != "garage" and c.fuel < sim.tuning.balance.practice.fuel_return_reserve_laps:
		messages.append("Run fuel reserve low; physical return requested.")
	return messages


func contextual_rival(sim: RaceSim, car: RaceCar) -> bool:
	return not sim.rival_styles.is_empty() and sim.rival_styles.enabled and not car.player


func review_rival_style(
	sim: RaceSim, car: RaceCar, source: Dictionary, comparison: Dictionary
) -> bool:
	if not sim.contextual_rival(car):
		return false
	var driver = sim.rival_styles.drivers[int(car.id)]
	if sim.flag != "GREEN":
		return true  # No discretionary style order under a restriction.
	if driver.hold_gate >= source.gate.distance:
		return true
	var decision = (
		DuelRivalPolicy.decide(source, sim.rival_state.stops, driver, comparison)
		if sim.duel_state.get("enabled", false)
		else RivalStyles.decide(source, sim.rival_state.stops, driver, comparison)
	)
	if decision.is_empty():
		return true
	RivalStyles.record(sim.rival_styles, decision)
	if decision.choice == "box" and not TeamOrders.defer_stop(sim, car):
		sim.order_stop(car, TyreInventory.find(car, decision.set_id), decision.reason)
	return true


func plan_pit_gate(sim: RaceSim, car: RaceCar) -> void:
	if not sim.contextual_rival(car):
		sim.mechanics.before("practice", "plan_pit_gate", [car])
		return
	# Same physical gate calculation as RaceSim. Suppress only the private rival
	# order acknowledgement; actual pit entries/exits remain public events.
	var gate = RaceForecaster.reachable_gate(sim, car)
	car.pit_gate = gate.distance
	car.pit_deferred = gate.deferred


func snapshot(sim: RaceSim) -> Dictionary:
	var data = sim.mechanics.before("practice", "snapshot", [])
	data.version = PRACTICE_CHECKPOINT_VERSION
	data.practice_state = sim.practice_state.duplicate(true)
	data.rival_styles = sim.rival_styles.duplicate(true)
	if sim.duel_state.get("enabled", false):
		data.version = (
			TacticalDuels.CHECKPOINT_VERSION
			if not sim.performance_profiles.is_empty()
			else TacticalDuels.LEGACY_CHECKPOINT_VERSION
		)
		data.duel_state = sim.duel_state.duplicate(true)
	return data


func manage_resources(sim: RaceSim, c: RaceCar, only_channel: String = "") -> void:
	sim.mechanics.before("practice", "manage_resources", [c, only_channel])
	if not sim.duel_state.is_empty():
		TacticalDuels.resource_targets(sim, c, only_channel)


func engineer(sim: RaceSim, c: RaceCar) -> void:
	var record = TacticalDuels.current(sim, int(c.id))
	if (
		TacticalDuels.owns(record)
		and sim.phase == "race"
		and c.route == "track"
		and not c.dnf
		and not c.finished
		and not c.pit_order
	):
		var sound = WheelTyres.usable(TyreInventory.find(c, c.set_id))
		var dry_safe = (
			c.tyre >= sim.tuning.environment.weather_policy.fallback_tread
			and c.damage <= sim.tuning.environment.weather_policy.fallback_damage
			and sound
			and sim.average(sim.water) <= sim.tuning.environment.weather_policy.dry_fallback_water
			and sim.rain < sim.tuning.environment.outlook.rain_visible
			and not c.tyre_rules.wet(c.compound)
			and (
				RaceReliability.stage(
					c, sim.reliability(int(c.id)), sim.tuning.operations.reliability
				)
				not in ["degraded", "critical"]
			)
		)
		if not dry_safe:
			# A narrow dry mandate cannot create previously absent emergency consent.
			# Restore the real previous owner before the existing recovery/weather logic.
			(
				TacticalDuels
				. finish(
					sim,
					int(c.id),
					"review",
					(
						"Outside the dry tactic's resource/reliability envelope. Previous pit ownership "
						+ "resumes; review recovery or weather strategy."
					)
				)
			)
		else:
			sim.manage_resources(c)
			if TacticalDuels.review(sim, c):
				return
	sim.mechanics.before("practice", "engineer", [c])
