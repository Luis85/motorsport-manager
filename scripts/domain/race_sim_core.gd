class_name RaceSimCore
extends "res://scripts/domain/race_sim_foundation.gd"
## Fixed-step session, surface, strategy and on-track movement implementation.
func _base_command(action: String, payload: Dictionary = {}) -> bool:
	last_error = ""
	# Target validation precedes every base command, including clock/unknown input.
	var target = payload.get("id", selected_id)
	if not RaceCheckpoint.integral(target, 0, cars.size() - 1): return fail("Unknown driver.")
	var car = cars[int(target)]
	var error = ""
	if action in RaceSessionOrders.ACTIONS:
		error = RaceSessionOrders.apply(self, action, payload)
	elif action in RaceDriverOrders.ACTIONS or action in RacePitOrders.ACTIONS:
		if not car.player: return fail("You manage the two %s drivers only." % player_team_label())
		if car.dnf or car.finished: return fail("This car is no longer running.")
		if action in RacePitOrders.ACTIONS:
			error = RacePitOrders.apply(self, car, action, payload)
		else:
			error = RaceDriverOrders.apply(self, car, action, payload)
		if not error.is_empty(): return fail(error)
		post("radio", "%s · %s %s" % [car.short, action.replace("_", " "), str(payload.get("value", ""))])
	else:
		return fail("Unknown command: " + action)
	if not error.is_empty(): return fail(error)
	commands.append({"tick": snappedf(total_time, STEP), "action": action, "payload": payload.duplicate(true)})
	return true

func _base_step() -> void:
	if paused or phase not in ACTIVE: return
	clock += STEP; total_time += STEP
	if phase == "lights":
		if clock >= 6.0:
			transition("race"); race_time = 0.0
			for c in cars:
				c.distance = -(c.grid - 1) * track.grid_spacing; c.previous_distance = c.distance; c.speed = 0.0; c.lap_start = 0.0; c.sector_start = 0.0
			for c in cars: record_stint(c)
			post("flag", "Lights out. Race distance and timing start now.")
		return
	if phase == "race": race_time = clock
	update_surface()
	if phase == "qualifying" and clock >= qual_duration and not qual_closed:
		qual_closed = true; post("flag", "Qualifying chequered. Completing existing flying laps.")
	update_flags()
	var old: Array = []
	for c in cars: old.append({"distance": c.distance, "lane": c.lane, "speed": c.speed, "route": c.route, "pit_d": c.pit_d, "pit_stage": c.pit_stage, "qual_state": c.qual_state}); c.crossed_at = -1.0
	for c in cars:
		c.previous_distance = c.distance; c.previous_pit_d = c.pit_d; c.previous_lane = c.lane; c.previous_route = c.route
		if c.dnf or c.finished: continue
		c.ai_clock -= STEP
		if c.ai_clock <= 0:
			c.ai_clock = 1.5; TyreInventory.cool_spares(c, 1.5); engineer(c)
		if c.route == "garage":
			var stored_set = TyreInventory.find(c, c.set_id)
			WheelTyres.cool(stored_set, STEP, tyre_rules.spec(stored_set.compound)); c.tyre = stored_set.life; c.temperature = stored_set.temperature
			if phase == "qualifying" and not qual_closed and c.auto and c.qual_runs < 2 and clock >= c.next_qual: leave_garage(c)
			continue
		if c.route == "pit": update_pit(c, old); continue
		if phase == "formation" and c.formation_done: continue
		if c.loss > 0:
			c.loss = maxf(0.0, c.loss - STEP); c.speed = 0.0; continue
		move_car(c, old)
	if phase == "qualifying":
		var settled = true
		for c in cars:
			if c.route != "garage" and not c.dnf: settled = false
		if qual_closed and settled: finish_qualifying()
	if phase == "formation":
		var ready = true
		for c in cars:
			if not c.formation_done: ready = false
		if ready: transition("grid_ready")
	if phase == "race":
		resolve_finishes()
		var done = true
		for c in cars:
			if not c.finished and not c.dnf: done = false
		if done: transition("results"); post("finish", "Weekend complete. Classification and event log are ready.")

func _base_update_flags() -> void:
	# Legacy procedure remains unchanged; newer rulesets override this tick-boundary seam.
	if flag != "GREEN" and clock >= flag_until:
		if flag == "SAFETY CAR": flag = "RESTART"; flag_until = clock + tuning.operations.control.ending_seconds
		else: flag = "GREEN"; yellow_sector = -1
		post("flag", flag)

func _base_forecast_parameters(_driver_id: int) -> Dictionary:
	# Allow-listed observable model parameters; never expose a random stream or future event.
	return {}

func _base_neutral_speed_limit(_c: RaceCar, _sample: Dictionary) -> float:
	return tuning.operations.control.local_yellow_speed_mps if flag == "YELLOW" else tuning.operations.control.legacy_neutral_speed_mps

func _base_constrain_progress(_c: RaceCar, next: float, _old: Array, _nearest: int) -> float:
	return next

func _base_update_surface() -> void:
	var training = WeekendWeather.training(scenario, phase, clock, track.estimate * laps, tuning.environment.training)
	var label: String = training.label
	rain = training.rain
	if label != weather_name: weather_name = label; post("weather", label + ". Surface water changes gradually.")
	surface_accumulator += STEP
	if surface_accumulator + 0.0000001 >= RaceSurface.INTERVAL:
		surface_accumulator = maxf(0, surface_accumulator - RaceSurface.INTERVAL)
		RaceSurface.evolve(surface, rain, RaceSurface.INTERVAL, total_time, tuning.environment.surface)
		RaceSurface.profiles(surface, water, rubber)

func _base_engineer(c: RaceCar) -> void:
	if not c.auto or phase != "race" or c.route != "track" or c.dnf or c.finished: return
	var remaining = maxf(0, laps - c.distance / track.length)
	var emergency = not WheelTyres.usable(TyreInventory.find(c, c.set_id))
	c.pace = 0 if emergency or c.tyre < tuning.competition.policy.conserve_tread or flag != "GREEN" else 1
	c.engine = 0 if emergency or c.fuel < remaining * tuning.competition.policy.fuel_reserve_factor else 1
	var recommended = recommended_compound()
	var ordinary_stop = remaining > tuning.competition.policy.stop_remaining_laps and c.distance > track.length * tuning.competition.policy.stop_start_laps and (c.tyre < tuning.competition.policy.stop_tread or c.compound != recommended and (tyre_rules.wet(recommended) or tyre_rules.wet(c.compound)) or c.damage > tuning.competition.policy.repair_damage)
	if not emergency and not ordinary_stop: return
	# A failed tyre is not a routine strategy stop: first-lap and late-lap gates
	# must not suppress recovery. Only delegated control may revise a future stop.
	if c.pit_order and (not emergency or c.scheduled_lap < 0): return
	var replacement = TyreInventory.choose(c, recommended, true)
	if replacement.is_empty(): replacement = TyreInventory.choose(c, c.compound, true)
	if replacement.is_empty() and emergency:
		for compound in tyre_rules.compounds():
			replacement = TyreInventory.choose(c, compound, true)
			if not replacement.is_empty(): break
	if replacement.is_empty():
		c.intent = "No sound replacement available; protecting the car"
		return
	c.next_compound = replacement.compound; c.next_set_id = replacement.id
	c.scheduled_lap = -1; queue_pit(c)
	post("pit", "%s: engineer calls %s tyres%s." % [c.short, c.next_compound, " for a damaged tyre; next safe entry" if emergency else ""])

func grip(c: RaceCar, _cell: int, local: Dictionary = {}) -> float:
	if local.is_empty(): local = surface_at(c)
	var wet = local.water
	var match_factor = 1.0
	match_factor = TyreSurfaceResponse.factor(tyre_rules.spec(c.compound), wet)
	var wheel_factor = WheelTyres.grip(TyreInventory.find(c, c.set_id), tyre_rules.spec(c.compound))
	return clampf(local.grip * tyre_rules.spec(c.compound).grip * match_factor * wheel_factor, 0.16, 1.1)

func _base_neutral(c: RaceCar) -> bool:
	return phase == "formation" or flag in ["SAFETY CAR", "RESTART"] or flag == "YELLOW" and track.sector_at(c.distance) == yellow_sector

func _base_move_car(c: RaceCar, old: Array) -> void:
	var s = track.sample(c.distance)
	var cell = int(fposmod(c.distance / track.length, 1) * 96)
	var local = surface_at(c)
	var g = grip(c, cell, local)
	var effects = CarSetup.effects(c, local.water)
	var handling = (1.0 + (c.skill - tuning.pace.skill_reference) * tuning.pace.skill_factor) * lerpf(1.0, effects.corner, clampf(absf(s.curvature) * 100, 0, 1))
	handling *= 1.0 + (c.wet_skill - tuning.competition.movement.wet_skill_reference) * tuning.competition.movement.wet_skill_factor * local.water
	var desired = s.speed * _performance_line_factor(c, s.curvature) 		* sqrt(g) * handling * (1 - c.damage * tuning.condition.damage_speed_loss) * tuning.pace.speed_modes[c.pace]
	desired *= tuning.pace.engine_modes[c.engine]
	desired *= (1.0 - maxf(0, tuning.condition.health_reference - c.health) * tuning.condition.health_speed_loss) / (1.0 + c.fuel * tuning.fuel.runtime_mass_factor)
	if absf(s.curvature) < tuning.competition.movement.straight_curvature_per_m: desired *= effects.straight
	desired *= 1.0 - maxf(0, c.engine_temperature - tuning.condition.heat_reference_c) * tuning.condition.heat_speed_loss
	if not WheelTyres.usable(TyreInventory.find(c, c.set_id)): desired = minf(desired, tuning.competition.movement.damaged_tyre_speed_mps)
	var target_lane = s.line
	if is_run_session() and c.qual_state != "hotlap": desired = minf(desired * tuning.competition.movement.run_transit_factor, tuning.competition.movement.run_transit_speed_mps)
	if phase == "formation":
		desired = minf(desired * tuning.competition.movement.formation_speed_factor, tuning.competition.movement.formation_speed_mps)
		var goal = track.length - (c.grid - 1) * track.grid_spacing
		var remaining = maxf(0, goal - c.distance)
		desired = minf(desired, sqrt(2 * 6 * remaining))
		if remaining < 100: target_lane = (-1 if c.grid % 2 else 1) * 2.0
		if clock < (c.grid - 1) * tuning.competition.movement.formation_release_seconds: desired = 0.0
	if neutral(c): desired = minf(desired, neutral_speed_limit(c, s))
	if phase == "race" and clock < tuning.competition.movement.start_reaction_seconds + (100 - c.skill) * tuning.competition.movement.start_skill_seconds: desired = 0.0
	if phase == "race" and clock < 3.0: target_lane = (-1 if c.grid % 2 else 1) * 2.0
	var nearest_id = -1; var ahead_distance = INF
	var was_blue = c.blue
	var courtesy_target = update_yield(c, old)
	c.blue = c.yield_to >= 0 and phase == "race"
	if c.yield_to >= 0:
		target_lane = courtesy_target
		if absf(c.lane - old[c.yield_to].lane) > 2.6: desired = minf(desired, tuning.competition.movement.yield_speed_mps)
	for other in cars:
		if other.id == c.id or other.dnf or other.finished or old[other.id].route != "track": continue
		var delta = fposmod(old[other.id].distance - old[c.id].distance, track.length)
		if delta > 0.005 and delta < ahead_distance: ahead_distance = delta; nearest_id = other.id
	if c.blue and not was_blue:
		stats.blue_flags += 1; post("flag", c.short + " yields under blue flags.")
	var passing = false
	if nearest_id >= 0 and ahead_distance < tuning.competition.movement.wake_distance_m:
		if phase == "race" and not neutral(c): desired *= tuning.competition.movement.slipstream_factor if absf(s.curvature) < tuning.competition.movement.slipstream_curvature_per_m else tuning.competition.movement.dirty_air_factor
	var traffic = traffic_instruction(c, old, nearest_id, ahead_distance, desired, target_lane, s, local)
	desired = traffic.desired; target_lane = traffic.lane
	if traffic.attempt and nearest_id >= 0: passing = absf(c.lane - old[nearest_id].lane) >= 2.6
	if nearest_id >= 0 and ahead_distance < tuning.competition.movement.wake_distance_m and not passing and ahead_distance < maxf(12, c.speed * tuning.competition.movement.following_headway_seconds):
		desired = minf(desired, maxf(0, old[nearest_id].speed + (ahead_distance - 7) * tuning.competition.movement.following_response_per_second))
	# Do not sweep across an occupied lateral lane.
	for other in cars:
		if other.id == c.id or other.dnf or old[other.id].route != "track": continue
		var longitudinal = fposmod(old[other.id].distance - old[c.id].distance + track.length * 0.5, track.length) - track.length * 0.5
		if absf(longitudinal) < 7:
			var separation: float = c.lane - old[other.id].lane
			var clearance = track.vehicle_definition.width_m + 0.25
			# Keep occupied lanes separated without ever displacing an already overlapping car.
			if separation > 0: target_lane = maxf(target_lane, minf(c.lane, old[other.id].lane + clearance))
			elif separation < 0: target_lane = minf(target_lane, maxf(c.lane, old[other.id].lane - clearance))
	c.lane = move_toward(c.lane, clampf(target_lane, -s.w * 0.5 + 1.1, s.w * 0.5 - 1.1), STEP * tuning.competition.movement.lateral_speed_mps)
	var limits = track.vehicle_definition.parameters().duplicate(true)
	if not performance_profiles.is_empty():
		for key in RacePerformanceProfile.KEYS:
			limits[key] *= _performance_factor(c, key)
	var grade = (track.sample(c.distance + 10).h - track.sample(c.distance - 10).h) / 20.0
	var accel = maxf(1.0, limits.accel * g * effects.traction - 9.81 * grade)
	var brake = maxf(2.0, limits.brake * g * effects.brake + 9.81 * grade)
	var must_pit = phase == "race" and c.pit_order or is_run_session() and c.qual_state == "inlap"
	if must_pit:
		if c.pit_gate <= c.distance: plan_pit_gate(c)
		desired = minf(desired, sqrt(track.pit_limit ** 2 + 2.0 * brake * maxf(0, c.pit_gate - c.distance - 5)))
	# A wet/worn car must brake *before* the corner, not chase a dry envelope through it.
	var lookahead = minf(300, c.speed * c.speed / (2 * brake) + 25)
	var scan = 15.0
	while scan <= lookahead:
		var future = track.sample(c.distance + scan / s.path_scale)
		var corner_speed = minf(limits.top, sqrt(maxf(3, limits.lat * g) / maxf(0.00001, absf(future.curvature))))
		desired = minf(desired, sqrt(corner_speed * corner_speed + 2 * brake * scan))
		scan += 20
	if is_run_session() and c.qual_state == "hotlap" and neutral(c):
		c.hot_valid = false; c.invalid_reason = "Neutralized sector during the flying lap"
	var old_speed = c.speed
	c.speed = move_toward(c.speed, clampf(desired, 0, RaceCheckpoint.MAX_SPEED_MPS), STEP * (accel if desired > c.speed else brake))
	var next = c.distance + c.speed * STEP / s.path_scale
	if nearest_id >= 0 and (neutral(c) or traffic.block_pass or absf(c.lane - old[nearest_id].lane) < 2.6):
		# Snapshot-based longitudinal constraint: never teleport ahead through a car.
		var limit = c.distance + ahead_distance - 6.2 + old[nearest_id].speed * STEP / maxf(0.1, track.sample(old[nearest_id].distance).path_scale)
		if next > limit: next = maxf(c.distance, limit); c.speed = maxf(0, (next - c.distance) * s.path_scale / STEP)
	var permitted_next = constrain_progress(c, next, old, nearest_id)
	if permitted_next < next:
		next = maxf(c.distance, permitted_next); c.speed = maxf(0, (next - c.distance) * s.path_scale / STEP)
	if phase == "formation":
		var goal = track.length - (c.grid - 1) * track.grid_spacing
		if next >= goal - 0.2:
			next = goal; c.speed = 0.0; c.formation_done = true
	var gate = c.pit_gate
	if must_pit and next >= gate:
		next = gate
		c.pit_cycle = int(round((gate - track.pit_entry) / track.length)); c.pit_d = 0.0; c.pit_stage = "entry"; c.route = "pit"
		c.speed = minf(c.speed, track.pit_limit); c.pit_lap = true; c.yield_to = -1; c.blue = false
		post("pit", c.short + " enters the pit lane.")
	c.throttle = clampf((c.speed - old_speed) / maxf(0.001, STEP * accel), 0, 1)
	c.braking = clampf((old_speed - c.speed) / maxf(0.001, STEP * brake), 0, 1)
	var moved = maxf(0, next - c.distance)
	var old_distance = c.distance
	c.distance = next
	wear_car(c, moved * s.path_scale, cell, effects, local)
	if c.previous_route == "track":
		var touched = RaceSurface.deposit(surface, track.length, c, old_distance, next, s.curvature, tuning.environment.surface)
		if not touched.is_empty(): RaceSurface.profiles(surface, water, rubber, touched)
	if phase == "race": race_crossings(c, old_distance, next)
	elif is_run_session(): qualifying_crossings(c, old_distance, next)
	if passing and nearest_id >= 0 and ahead_distance < moved - old[nearest_id].speed * STEP / track.sample(old[nearest_id].distance).path_scale and phase == "race":
		record_track_pass(c, cars[nearest_id])
	c.intent = "Blue flag · yielding" if c.blue else (pit_status(c) if c.pit_order else ("Formation · hold order" if phase == "formation" else (c.qual_state.capitalize() if is_run_session() else "Racing")))
	if phase == "race" and intensity != "calm" and not neutral(c) and c.route == "track":
		var incidents: Dictionary = tuning.operations.incidents
		var risk = incidents.base_exposure_per_second * (1 + (100 - c.consistency) * incidents.consistency_factor) * (1 + (100 - c.reliability) * incidents.reliability_factor) * (incidents.push_factor if c.pace == 2 else 1.0) * (1 + local.water * incidents.water_factor + maxf(0, incidents.low_tread_reference - c.tyre) * incidents.low_tread_factor)
		risk *= {"patient": incidents.patient_factor, "balanced": incidents.balanced_factor, "assertive": incidents.assertive_factor}[c.battle_mode]
		if random_value() < risk * STEP * (incidents.volatile_factor if intensity == "volatile" else 1): incident(c)
	if total_time - c.last_trace >= 1:
		c.last_trace = total_time
		c.telemetry.append([total_time, c.speed * 3.6, c.tyre, c.fuel, (c.speed - old_speed) / STEP])
		if c.telemetry.size() > 120: c.telemetry.pop_front()

func _base_traffic_instruction(c: RaceCar, old: Array, nearest: int, gap: float, desired: float, lane: float, sample: Dictionary, local: Dictionary) -> Dictionary:
	var result = {"desired": desired, "lane": lane, "attempt": false, "block_pass": false}
	var battle: Dictionary = tuning.competition.battle
	if nearest < 0 or gap >= battle.prepare_distance_m: return result
	if c.yield_to < 0 and not neutral(c) and phase != "formation" and absf(sample.curvature) < battle.maximum_curvature_per_m and sample.w > battle.minimum_road_width_m and desired > old[nearest].speed + battle[c.battle_mode + "_speed_advantage_mps"] and not (c.battle_mode == "patient" and local.water > battle.patient_maximum_water):
		var side = -1 if old[nearest].lane >= 0 else 1
		result.lane = clampf(old[nearest].lane + side * 3.0, -sample.w * 0.5 + 1.4, sample.w * 0.5 - 1.4)
		result.attempt = true
	return result

func _base_record_track_pass(c: RaceCar, other: RaceCar) -> void:
	stats.passes += 1; post("pass", "%s passes %s on track." % [c.short, other.short])

