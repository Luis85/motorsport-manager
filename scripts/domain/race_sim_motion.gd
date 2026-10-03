extends "res://scripts/domain/race_sim_movement_intent.gd"


func _base_move_car(c: RaceCar, old: Array) -> void:
	var s = track.sample(c.distance)
	var cell = int(fposmod(c.distance / track.length, 1) * 96)
	var local = surface_at(c)
	var g = grip(c, cell, local)
	var effects = CarSetup.effects(c, local.water)
	var desired = _desired_speed(c, s, local, g, effects)
	var intent = _session_movement(c, s, desired)
	desired = intent.desired
	var target_lane: float = intent.lane
	var traffic = _traffic_movement(c, old, s, local, desired, target_lane)
	var nearest_id: int = traffic.nearest_id
	var ahead_distance: float = traffic.ahead_distance
	var passing: bool = traffic.passing
	desired = traffic.desired
	target_lane = traffic.lane
	c.lane = move_toward(
		c.lane,
		clampf(target_lane, -s.w * 0.5 + 1.1, s.w * 0.5 - 1.1),
		STEP * tuning.competition.movement.lateral_speed_mps
	)
	var limits = track.vehicle_definition.parameters().duplicate(true)
	if not performance_profiles.is_empty():
		for key in RacePerformanceProfile.KEYS:
			limits[key] *= _performance_factor(c, key)
	var grade = (track.sample(c.distance + 10).h - track.sample(c.distance - 10).h) / 20.0
	var accel = maxf(
		tuning.balance.motion.minimum_acceleration_mps2,
		limits.accel * g * effects.traction - 9.81 * grade
	)
	var brake = maxf(
		tuning.balance.motion.minimum_braking_mps2, limits.brake * g * effects.brake + 9.81 * grade
	)
	var must_pit = phase == "race" and c.pit_order or is_run_session() and c.qual_state == "inlap"
	if must_pit:
		if c.pit_gate <= c.distance:
			plan_pit_gate(c)
		desired = minf(
			desired,
			sqrt(
				(
					track.pit_limit ** 2
					+ (
						2.0
						* brake
						* maxf(
							0, c.pit_gate - c.distance - tuning.balance.motion.pit_approach_margin_m
						)
					)
				)
			)
		)
	# A wet/worn car must brake *before* the corner, not chase a dry envelope through it.
	var lookahead = minf(
		300, c.speed * c.speed / (2 * brake) + tuning.balance.motion.braking_anticipation_m
	)
	var scan = 15.0
	while scan <= lookahead:
		var future = track.sample(c.distance + scan / s.path_scale)
		var corner_speed = minf(
			limits.top,
			sqrt(
				(
					maxf(tuning.balance.motion.minimum_lateral_mps2, limits.lat * g)
					/ maxf(0.00001, absf(future.curvature))
				)
			)
		)
		desired = minf(desired, sqrt(corner_speed * corner_speed + 2 * brake * scan))
		scan += 20
	if is_run_session() and c.qual_state == "hotlap" and neutral(c):
		c.hot_valid = false
		c.invalid_reason = "Neutralized sector during the flying lap"
	var old_speed = c.speed
	c.speed = move_toward(
		c.speed,
		clampf(desired, 0, RaceCheckpoint.MAX_SPEED_MPS),
		STEP * (accel if desired > c.speed else brake)
	)
	var next = c.distance + c.speed * STEP / s.path_scale
	if (
		nearest_id >= 0
		and (neutral(c) or traffic.block_pass or absf(c.lane - old[nearest_id].lane) < 2.6)
	):
		# Snapshot-based longitudinal constraint: never teleport ahead through a car.
		var limit = (
			c.distance
			+ ahead_distance
			- 6.2
			+ (
				old[nearest_id].speed
				* STEP
				/ maxf(0.1, track.sample(old[nearest_id].distance).path_scale)
			)
		)
		if next > limit:
			next = maxf(c.distance, limit)
			c.speed = maxf(0, (next - c.distance) * s.path_scale / STEP)
	var permitted_next = constrain_progress(c, next, old, nearest_id)
	if permitted_next < next:
		next = maxf(c.distance, permitted_next)
		c.speed = maxf(0, (next - c.distance) * s.path_scale / STEP)
	next = _commit_route(c, next, must_pit)
	c.throttle = clampf((c.speed - old_speed) / maxf(0.001, STEP * accel), 0, 1)
	c.braking = clampf((old_speed - c.speed) / maxf(0.001, STEP * brake), 0, 1)
	var moved = maxf(0, next - c.distance)
	var old_distance = c.distance
	c.distance = next
	wear_car(c, moved * s.path_scale, cell, effects, local)
	if c.previous_route == "track":
		var touched = RaceSurface.deposit(
			surface, track.length, c, old_distance, next, s.curvature, tuning.environment.surface
		)
		if not touched.is_empty():
			RaceSurface.profiles(surface, water, rubber, touched)
	if phase == "race":
		race_crossings(c, old_distance, next)
	elif is_run_session():
		qualifying_crossings(c, old_distance, next)
	_observe_movement(c, old, local, nearest_id, ahead_distance, passing, moved, old_speed)


func _base_traffic_instruction(
	c: RaceCar,
	old: Array,
	nearest: int,
	gap: float,
	desired: float,
	lane: float,
	sample: Dictionary,
	local: Dictionary
) -> Dictionary:
	var result = {"desired": desired, "lane": lane, "attempt": false, "block_pass": false}
	var battle: Dictionary = tuning.competition.battle
	if nearest < 0 or gap >= battle.prepare_distance_m:
		return result
	if (
		c.yield_to < 0
		and not neutral(c)
		and phase != "formation"
		and absf(sample.curvature) < battle.maximum_curvature_per_m
		and sample.w > battle.minimum_road_width_m
		and desired > old[nearest].speed + battle[c.battle_mode + "_speed_advantage_mps"]
		and not (c.battle_mode == "patient" and local.water > battle.patient_maximum_water)
	):
		var side = -1 if old[nearest].lane >= 0 else 1
		result.lane = clampf(
			old[nearest].lane + side * 3.0, -sample.w * 0.5 + 1.4, sample.w * 0.5 - 1.4
		)
		result.attempt = true
	return result


func _base_record_track_pass(c: RaceCar, other: RaceCar) -> void:
	stats.passes += 1
	post("pass", "%s passes %s on track." % [c.short, other.short])


func _observe_movement(
	c: RaceCar,
	old: Array,
	local: Dictionary,
	nearest_id: int,
	ahead_distance: float,
	passing: bool,
	moved: float,
	old_speed: float
) -> void:
	if (
		passing
		and nearest_id >= 0
		and (
			ahead_distance
			< (
				moved
				- old[nearest_id].speed * STEP / track.sample(old[nearest_id].distance).path_scale
			)
		)
		and phase == "race"
	):
		record_track_pass(c, cars[nearest_id])
	c.intent = (
		"Blue flag · yielding"
		if c.blue
		else (
			pit_status(c)
			if c.pit_order
			else (
				"Formation · hold order"
				if phase == "formation"
				else (c.qual_state.capitalize() if is_run_session() else "Racing")
			)
		)
	)
	if phase == "race" and intensity != "calm" and not neutral(c) and c.route == "track":
		var incidents: Dictionary = tuning.operations.incidents
		var risk = (
			incidents.base_exposure_per_second
			* (1 + (100 - c.consistency) * incidents.consistency_factor)
			* (1 + (100 - c.reliability) * incidents.reliability_factor)
			* (incidents.push_factor if c.pace == 2 else 1.0)
			* (
				1
				+ local.water * incidents.water_factor
				+ maxf(0, incidents.low_tread_reference - c.tyre) * incidents.low_tread_factor
			)
		)
		risk *= {
			"patient": incidents.patient_factor,
			"balanced": incidents.balanced_factor,
			"assertive": incidents.assertive_factor
		}[c.battle_mode]
		if (
			random_value()
			< risk * STEP * (incidents.volatile_factor if intensity == "volatile" else 1)
		):
			incident(c)
	if total_time - c.last_trace >= 1:
		c.last_trace = total_time
		c.telemetry.append(
			[total_time, c.speed * 3.6, c.tyre, c.fuel, (c.speed - old_speed) / STEP]
		)
		if c.telemetry.size() > 120:
			c.telemetry.pop_front()


func _commit_route(c: RaceCar, next: float, must_pit: bool) -> float:
	if phase == "formation":
		var goal = track.length - (c.grid - 1) * track.grid_spacing
		if next >= goal - 0.2:
			next = goal
			c.speed = 0.0
			c.formation_done = true
	var gate = c.pit_gate
	if must_pit and next >= gate:
		next = gate
		c.pit_cycle = int(round((gate - track.pit_entry) / track.length))
		c.pit_d = 0.0
		c.pit_stage = "entry"
		c.route = "pit"
		c.speed = minf(c.speed, track.pit_limit)
		c.pit_lap = true
		c.yield_to = -1
		c.blue = false
		post("pit", c.short + " enters the pit lane.")
	return next
