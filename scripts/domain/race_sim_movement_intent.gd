extends "res://scripts/domain/race_sim_foundation.gd"

## Fixed-step session, surface, strategy and on-track movement implementation.
## Fixed-step on-track movement and traffic calculations.
## Existing handling, session limits and snapshot-based traffic intent.


func grip(c: RaceCar, _cell: int, local: Dictionary = {}) -> float:
	if local.is_empty():
		local = surface_at(c)
	var wet = local.water
	var match_factor = 1.0
	match_factor = TyreSurfaceResponse.factor(tyre_rules.spec(c.compound), wet)
	var wheel_factor = WheelTyres.grip(TyreInventory.find(c, c.set_id), tyre_rules.spec(c.compound))
	return clampf(
		local.grip * tyre_rules.spec(c.compound).grip * match_factor * wheel_factor,
		tuning.balance.motion.minimum_grip,
		tuning.balance.motion.maximum_grip
	)


func _desired_speed(
	c: RaceCar, s: Dictionary, local: Dictionary, g: float, effects: Dictionary
) -> float:
	var handling = (
		(1.0 + (c.skill - tuning.pace.skill_reference) * tuning.pace.skill_factor)
		* lerpf(
			1.0,
			effects.corner,
			clampf(absf(s.curvature) * tuning.balance.motion.corner_blend_curvature_scale, 0, 1)
		)
	)
	handling *= (
		1.0
		+ (
			(c.wet_skill - tuning.competition.movement.wet_skill_reference)
			* tuning.competition.movement.wet_skill_factor
			* local.water
		)
	)
	var desired = (
		s.speed
		* _performance_line_factor(c, s.curvature)
		* sqrt(g)
		* handling
		* (1 - c.damage * tuning.condition.damage_speed_loss)
		* tuning.pace.speed_modes[c.pace]
	)
	desired *= tuning.pace.engine_modes[c.engine]
	desired *= (
		(
			1.0
			- (
				maxf(0, tuning.condition.health_reference - c.health)
				* tuning.condition.health_speed_loss
			)
		)
		/ (1.0 + c.fuel * tuning.fuel.runtime_mass_factor)
	)
	if absf(s.curvature) < tuning.competition.movement.straight_curvature_per_m:
		desired *= effects.straight
	desired *= (
		1.0
		- (
			maxf(0, c.engine_temperature - tuning.condition.heat_reference_c)
			* tuning.condition.heat_speed_loss
		)
	)
	if not WheelTyres.usable(TyreInventory.find(c, c.set_id)):
		desired = minf(desired, tuning.competition.movement.damaged_tyre_speed_mps)
	return desired


func _session_movement(c: RaceCar, s: Dictionary, desired: float) -> Dictionary:
	var target_lane = s.line
	if is_run_session() and c.qual_state != "hotlap":
		desired = minf(
			desired * tuning.competition.movement.run_transit_factor,
			tuning.competition.movement.run_transit_speed_mps
		)
	if phase == "formation":
		desired = minf(
			desired * tuning.competition.movement.formation_speed_factor,
			tuning.competition.movement.formation_speed_mps
		)
		var goal = track.length - (c.grid - 1) * track.grid_spacing
		var remaining = maxf(0, goal - c.distance)
		desired = minf(
			desired, sqrt(2 * tuning.balance.procedure.formation_braking_mps2 * remaining)
		)
		if remaining < tuning.balance.motion.formation_lane_distance_m:
			target_lane = (-1 if c.grid % 2 else 1) * 2.0
		if clock < (c.grid - 1) * tuning.competition.movement.formation_release_seconds:
			desired = 0.0
	if neutral(c):
		desired = minf(desired, neutral_speed_limit(c, s))
	if (
		phase == "race"
		and (
			clock
			< (
				tuning.competition.movement.start_reaction_seconds
				+ (100 - c.skill) * tuning.competition.movement.start_skill_seconds
			)
		)
	):
		desired = 0.0
	if phase == "race" and clock < tuning.balance.procedure.grid_lane_hold_seconds:
		target_lane = (-1 if c.grid % 2 else 1) * 2.0
	return {"desired": desired, "lane": target_lane}


func _traffic_movement(
	c: RaceCar, old: Array, s: Dictionary, local: Dictionary, desired: float, target_lane: float
) -> Dictionary:
	var nearest_id = -1
	var ahead_distance = INF
	var was_blue = c.blue
	var courtesy_target = update_yield(c, old)
	c.blue = c.yield_to >= 0 and phase == "race"
	if c.yield_to >= 0:
		target_lane = courtesy_target
		if absf(c.lane - old[c.yield_to].lane) > 2.6:
			desired = minf(desired, tuning.competition.movement.yield_speed_mps)
	for other in cars:
		if other.id == c.id or other.dnf or other.finished or old[other.id].route != "track":
			continue
		var delta = fposmod(old[other.id].distance - old[c.id].distance, track.length)
		if delta > 0.005 and delta < ahead_distance:
			ahead_distance = delta
			nearest_id = other.id
	if c.blue and not was_blue:
		stats.blue_flags += 1
		post("flag", c.short + " yields under blue flags.")
	var passing = false
	if nearest_id >= 0 and ahead_distance < tuning.competition.movement.wake_distance_m:
		if phase == "race" and not neutral(c):
			desired *= (
				tuning.competition.movement.slipstream_factor
				if absf(s.curvature) < tuning.competition.movement.slipstream_curvature_per_m
				else tuning.competition.movement.dirty_air_factor
			)
	var traffic = traffic_instruction(
		c, old, nearest_id, ahead_distance, desired, target_lane, s, local
	)
	desired = traffic.desired
	target_lane = traffic.lane
	if traffic.attempt and nearest_id >= 0:
		passing = absf(c.lane - old[nearest_id].lane) >= 2.6
	if (
		nearest_id >= 0
		and ahead_distance < tuning.competition.movement.wake_distance_m
		and not passing
		and (
			ahead_distance
			< maxf(12, c.speed * tuning.competition.movement.following_headway_seconds)
		)
	):
		desired = minf(
			desired,
			maxf(
				0,
				(
					old[nearest_id].speed
					+ (
						(ahead_distance - 7)
						* tuning.competition.movement.following_response_per_second
					)
				)
			)
		)
	target_lane = _clear_lane(c, old, target_lane)
	return {
		"nearest_id": nearest_id,
		"ahead_distance": ahead_distance,
		"passing": passing,
		"desired": desired,
		"lane": target_lane,
		"block_pass": traffic.block_pass
	}


func _clear_lane(c: RaceCar, old: Array, target_lane: float) -> float:
	# Do not sweep across an occupied lateral lane.
	for other in cars:
		if other.id == c.id or other.dnf or old[other.id].route != "track":
			continue
		var longitudinal = (
			fposmod(old[other.id].distance - old[c.id].distance + track.length * 0.5, track.length)
			- track.length * 0.5
		)
		if absf(longitudinal) < 7:
			var separation: float = c.lane - old[other.id].lane
			var clearance = track.vehicle_definition.width_m + 0.25
			# Keep occupied lanes separated without ever displacing an already overlapping car.
			if separation > 0:
				target_lane = maxf(target_lane, minf(c.lane, old[other.id].lane + clearance))
			elif separation < 0:
				target_lane = minf(target_lane, maxf(c.lane, old[other.id].lane - clearance))
	return target_lane
