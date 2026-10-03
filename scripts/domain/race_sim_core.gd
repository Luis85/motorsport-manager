class_name RaceSimCore
extends "res://scripts/domain/race_sim_motion.gd"


func _base_command(action: String, payload: Dictionary = {}) -> bool:
	last_error = ""
	# Target validation precedes every base command, including clock/unknown input.
	var target = payload.get("id", selected_id)
	if not RaceCheckpoint.integral(target, 0, cars.size() - 1):
		return fail("Unknown driver.")
	var car = cars[int(target)]
	var error = ""
	if action in RaceSessionOrders.ACTIONS:
		error = RaceSessionOrders.apply(self, action, payload)
	elif action in RaceDriverOrders.ACTIONS or action in RacePitOrders.ACTIONS:
		error = _driver_command_error(car)
		if not error.is_empty():
			return fail(error)
		if action in RacePitOrders.ACTIONS:
			error = RacePitOrders.apply(self, car, action, payload)
		else:
			error = RaceDriverOrders.apply(self, car, action, payload)
		if not error.is_empty():
			return fail(error)
		post(
			"radio",
			"%s · %s %s" % [car.short, action.replace("_", " "), str(payload.get("value", ""))]
		)
	else:
		return fail("Unknown command: " + action)
	if not error.is_empty():
		return fail(error)
	commands.append(
		{"tick": snappedf(total_time, STEP), "action": action, "payload": payload.duplicate(true)}
	)
	return true


func _base_step() -> void:
	if paused or phase not in ACTIVE:
		return
	clock += STEP
	total_time += STEP
	if phase == "lights":
		if clock >= 6.0:
			transition("race")
			race_time = 0.0
			for c in cars:
				c.distance = -(c.grid - 1) * track.grid_spacing
				c.previous_distance = c.distance
				c.speed = 0.0
				c.lap_start = 0.0
				c.sector_start = 0.0
			for c in cars:
				record_stint(c)
			post("flag", "Lights out. Race distance and timing start now.")
		return
	if phase == "race":
		race_time = clock
	update_surface()
	if phase == "qualifying" and clock >= qual_duration and not qual_closed:
		qual_closed = true
		post("flag", "Qualifying chequered. Completing existing flying laps.")
	update_flags()
	var old: Array = []
	for c in cars:
		old.append(
			{
				"distance": c.distance,
				"lane": c.lane,
				"speed": c.speed,
				"route": c.route,
				"pit_d": c.pit_d,
				"pit_stage": c.pit_stage,
				"qual_state": c.qual_state
			}
		)
		c.crossed_at = -1.0
	for c in cars:
		_step_car(c, old)
	_settle_session()


func _base_update_flags() -> void:
	# Legacy procedure remains unchanged; newer rulesets override this tick-boundary seam.
	if flag != "GREEN" and clock >= flag_until:
		if flag == "SAFETY CAR":
			flag = "RESTART"
			flag_until = clock + tuning.operations.control.ending_seconds
		else:
			flag = "GREEN"
			yellow_sector = -1
		post("flag", flag)


func _base_forecast_parameters(_driver_id: int) -> Dictionary:
	# Allow-listed observable model parameters; never expose a random stream or future event.
	return {}


func _base_neutral_speed_limit(_c: RaceCar, _sample: Dictionary) -> float:
	return (
		tuning.operations.control.local_yellow_speed_mps
		if flag == "YELLOW"
		else tuning.operations.control.legacy_neutral_speed_mps
	)


func _base_constrain_progress(_c: RaceCar, next: float, _old: Array, _nearest: int) -> float:
	return next


func _base_update_surface() -> void:
	var training = WeekendWeather.training(
		scenario, phase, clock, track.estimate * laps, tuning.environment.training
	)
	var label: String = training.label
	rain = training.rain
	if label != weather_name:
		weather_name = label
		post("weather", label + ". Surface water changes gradually.")
	surface_accumulator += STEP
	if surface_accumulator + 0.0000001 >= RaceSurface.INTERVAL:
		surface_accumulator = maxf(0, surface_accumulator - RaceSurface.INTERVAL)
		RaceSurface.evolve(
			surface, rain, RaceSurface.INTERVAL, total_time, tuning.environment.surface
		)
		RaceSurface.profiles(surface, water, rubber)


func _base_engineer(c: RaceCar) -> void:
	if not c.auto or phase != "race" or c.route != "track" or c.dnf or c.finished:
		return
	var remaining = maxf(0, laps - c.distance / track.length)
	var emergency = not WheelTyres.usable(TyreInventory.find(c, c.set_id))
	c.pace = (
		0
		if emergency or c.tyre < tuning.competition.policy.conserve_tread or flag != "GREEN"
		else 1
	)
	c.engine = (
		0 if emergency or c.fuel < remaining * tuning.competition.policy.fuel_reserve_factor else 1
	)
	var recommended = recommended_compound()
	var ordinary_stop = (
		remaining > tuning.competition.policy.stop_remaining_laps
		and c.distance > track.length * tuning.competition.policy.stop_start_laps
		and (
			c.tyre < tuning.competition.policy.stop_tread
			or (
				c.compound != recommended
				and (tyre_rules.wet(recommended) or tyre_rules.wet(c.compound))
			)
			or c.damage > tuning.competition.policy.repair_damage
		)
	)
	if not emergency and not ordinary_stop:
		return
	# A failed tyre is not a routine strategy stop: first-lap and late-lap gates
	# must not suppress recovery. Only delegated control may revise a future stop.
	if c.pit_order and (not emergency or c.scheduled_lap < 0):
		return
	var replacement = TyreInventory.choose(c, recommended, true)
	if replacement.is_empty():
		replacement = TyreInventory.choose(c, c.compound, true)
	if replacement.is_empty() and emergency:
		for compound in tyre_rules.compounds():
			replacement = TyreInventory.choose(c, compound, true)
			if not replacement.is_empty():
				break
	if replacement.is_empty():
		c.intent = "No sound replacement available; protecting the car"
		return
	c.next_compound = replacement.compound
	c.next_set_id = replacement.id
	c.scheduled_lap = -1
	queue_pit(c)
	post(
		"pit",
		(
			"%s: engineer calls %s tyres%s."
			% [
				c.short,
				c.next_compound,
				" for a damaged tyre; next safe entry" if emergency else ""
			]
		)
	)


func _base_neutral(c: RaceCar) -> bool:
	return (
		phase == "formation"
		or flag in ["SAFETY CAR", "RESTART"]
		or flag == "YELLOW" and track.sector_at(c.distance) == yellow_sector
	)


func _driver_command_error(car: RaceCar) -> String:
	if not car.player:
		return "You manage the two %s drivers only." % player_team_label()
	if car.dnf or car.finished:
		return "This car is no longer running."
	return ""


func _step_car(c: RaceCar, old: Array) -> void:
	c.previous_distance = c.distance
	c.previous_pit_d = c.pit_d
	c.previous_lane = c.lane
	c.previous_route = c.route
	if c.dnf or c.finished:
		return
	c.ai_clock -= STEP
	if c.ai_clock <= 0:
		c.ai_clock = 1.5
		TyreInventory.cool_spares(c, 1.5)
		engineer(c)
	if c.route == "garage":
		var stored_set = TyreInventory.find(c, c.set_id)
		WheelTyres.cool(stored_set, STEP, tyre_rules.spec(stored_set.compound))
		c.tyre = stored_set.life
		c.temperature = stored_set.temperature
		if (
			phase == "qualifying"
			and not qual_closed
			and c.auto
			and c.qual_runs < 2
			and clock >= c.next_qual
		):
			leave_garage(c)
		return
	if c.route == "pit":
		update_pit(c, old)
		return
	if phase == "formation" and c.formation_done:
		return
	if c.loss > 0:
		c.loss = maxf(0.0, c.loss - STEP)
		c.speed = 0.0
		return
	move_car(c, old)


func _settle_session() -> void:
	if phase == "qualifying":
		var settled = true
		for c in cars:
			if c.route != "garage" and not c.dnf:
				settled = false
		if qual_closed and settled:
			finish_qualifying()
	if phase == "formation":
		var ready = true
		for c in cars:
			if not c.formation_done:
				ready = false
		if ready:
			transition("grid_ready")
	if phase == "race":
		resolve_finishes()
		var done = true
		for c in cars:
			if not c.finished and not c.dnf:
				done = false
		if done:
			transition("results")
			post("finish", "Weekend complete. Classification and event log are ready.")
