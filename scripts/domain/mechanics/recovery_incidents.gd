extends "res://scripts/domain/mechanics/recovery_operations.gd"
## Race-control restrictions, incident response and factual recovery projections.


func update_flags(sim: RaceSim) -> void:
	if not sim.enhanced():
		sim.mechanics.before("recovery", "update_flags", [])
		return
	var change = WeekendRaceControl.tick(
		sim.control_state, sim.total_time, sim.tuning.operations.control
	)
	sim.flag = WeekendRaceControl.flag_value(sim.control_state)
	sim.yellow_sector = (
		int(sim.control_state.zones[0].sector) if not sim.control_state.zones.is_empty() else -1
	)
	sim.flag_until = sim.clock + maxf(0, sim.control_state.until - sim.total_time)
	if not change.is_empty():
		RaceJournal.append(sim.strategy_state, sim, "race_control", -1, change)
		sim.post(
			"flag",
			(
				(
					"Virtual neutralization ending: %s seconds, still no passing."
					% (
						"eight"
						if sim.tuning.operations.control.ending_seconds == 8.0
						else (
							String
							. num(sim.tuning.operations.control.ending_seconds, 2)
							. trim_suffix(".0")
						)
					)
				)
				if sim.control_state.state == "ending"
				else sim.flag + " · " + sim.control_state.reason
			)
		)


func neutral(sim: RaceSim, c: RaceCar) -> bool:
	if not sim.enhanced():
		return sim.mechanics.before("recovery", "neutral", [c])
	return (
		sim.phase == "formation"
		or WeekendRaceControl.restricted(
			sim.control_state,
			sim.track.length,
			c.distance,
			c.distance + maxf(0, c.speed) * RaceSim.STEP / sim.track.sample(c.distance).path_scale
		)
	)


func neutral_speed_limit(sim: RaceSim, c: RaceCar, sample: Dictionary) -> float:
	if not sim.enhanced() or sim.phase == "formation":
		return sim.mechanics.before("recovery", "neutral_speed_limit", [c, sample])
	return (
		sample.speed * sim.tuning.operations.control.virtual_pace_factor
		if sim.control_state.state != "green"
		else sim.tuning.operations.control.local_yellow_speed_mps
	)


func constrain_progress(sim: RaceSim, c: RaceCar, next: float, old: Array, nearest: int) -> float:
	if (
		not sim.enhanced()
		or nearest < 0
		or not WeekendRaceControl.restricted(sim.control_state, sim.track.length, c.distance, next)
	):
		return next
	# Conservative pre-step bound, independent of roster iteration and the leader's braking.
	# It can stop a follower but never rewinds or pulls a distant car toward the field.
	var gap = fposmod(old[nearest].distance - old[int(c.id)].distance, sim.track.length)
	return minf(next, maxf(c.distance, c.distance + gap - 0.05))


func update_yield(sim: RaceSim, c: RaceCar, old: Array) -> float:
	if sim.enhanced() and sim.neutral(c):
		c.yield_to = -1
		c.yield_side = 0.0
		c.yield_clock = 0.0
		return sim.track.sample(c.distance).line
	return sim.mechanics.before("recovery", "update_yield", [c, old])


func incident(sim: RaceSim, c: RaceCar) -> void:
	if not sim.enhanced():
		sim.mechanics.before("recovery", "incident", [c])
		return
	if c.dnf or c.finished:
		return
	var observed = RaceReliability.observation(
		c, sim.reliability(int(c.id)), sim.tuning.operations.reliability
	)
	sim.stats.incidents += 1
	RaceSurface.contaminate(
		sim.surface,
		c.distance / sim.track.length,
		c.lane,
		sim.tuning.environment.surface.incident.debris,
		c.health < sim.tuning.environment.surface.incident.oil_health_threshold,
		sim.tuning.environment.surface.incident
	)
	if sim.random_value() < sim.tuning.operations.incidents.barrier_probability:
		sim.retire(c, "Barrier impact")
		return
	c.loss = (
		sim.tuning.operations.incidents.lost_seconds_base
		+ sim.random_value() * sim.tuning.operations.incidents.lost_seconds_span
	)
	c.damage = minf(
		1000,
		(
			c.damage
			+ sim.tuning.operations.incidents.damage_base
			+ sim.random_value() * sim.tuning.operations.incidents.damage_span
		)
	)
	var fitted = TyreInventory.find(c, c.set_id)
	for wheel in WheelTyres.KEYS:
		fitted.wheels[wheel].life = maxf(
			0, fitted.wheels[wheel].life - sim.tuning.operations.incidents.tread_loss
		)
	WheelTyres.publish(fitted)
	c.tyre = fitted.life
	c.temperature = fitted.temperature
	TyreInventory.sync(c)
	var reason = "Driving error with aggregate damage; local-yellow clearance queued for the next field step."
	var event = RaceJournal.append(
		sim.strategy_state,
		sim,
		"driving_incident",
		int(c.id),
		{
			"reason": reason,
			"observed": observed,
			"damage_after": c.damage,
			"location": c.distance,
			"sector": sim.track.sector_at(c.distance)
		}
	)
	WeekendRaceControl.enqueue(
		sim.control_state,
		int(c.id),
		sim.track.sector_at(c.distance),
		false,
		sim.tuning.operations.control.local_incident_seconds,
		sim.total_time,
		event,
		reason
	)
	sim.post("incident", c.short + " · " + reason)
	sim.observe_reliability(c)


func retire(sim: RaceSim, c: RaceCar, reason: String) -> void:
	if c.dnf or c.finished:
		return
	sim.mechanics.before("recovery", "retire", [c, reason])
	if not sim.enhanced():
		return
	var r = sim.reliability(int(c.id))
	r.repair_only = false
	r.service = {}
	var event = RaceJournal.append(
		sim.strategy_state,
		sim,
		"recovery_retirement",
		int(c.id),
		{
			"reason": reason,
			"observed": RaceReliability.observation(c, r, sim.tuning.operations.reliability),
			"location": c.distance,
			"sector": sim.track.sector_at(c.distance)
		}
	)
	if sim.phase == "race" and c.route == "track" and reason != "Retired by the pit wall":
		(
			WeekendRaceControl
			. enqueue(
				sim.control_state,
				int(c.id),
				sim.track.sector_at(c.distance),
				true,
				sim.tuning.operations.control.retired_car_seconds,
				sim.total_time,
				event,
				"Retired car requires a virtual clearance interval. No physical safety car is simulated."
			)
		)
	sim.observe_reliability(c)


func step(sim: RaceSim) -> void:
	if sim.paused or sim.phase not in RaceSim.ACTIVE:
		return
	sim.mechanics.before("recovery", "step", [])
	if sim.enhanced():
		for c in sim.cars:
			sim.observe_reliability(c)


func snapshot(sim: RaceSim) -> Dictionary:
	var data = sim.mechanics.before("recovery", "snapshot", [])
	data.version = RECOVERY_CHECKPOINT_VERSION
	data.reliability_state = sim.reliability_state.duplicate(true)
	data.control_state = sim.control_state.duplicate(true)
	return data


func recovery_debrief(sim: RaceSim) -> String:
	var lines: Array[String] = [
		"RECOVERY AND RACE CONTROL",
		(
			"Service durations are measured. Break-even estimates are not alternate results. "
			+ "Repair never replenishes lifetime health."
		)
	]
	var records = sim.strategy_state.records.filter(
		func(r):
			return (
				(
					r.kind
					in [
						"recovery_stage",
						"recovery_fault",
						"recovery_decision",
						"recovery_retirement",
						"recovery_service",
						"race_control"
					]
				)
				and r.driver_id in [-1] + sim.player_ids()
			)
	)
	for record in records.slice(maxi(0, records.size() - 16)):
		var e = record.evidence
		var who = sim.cars[int(record.driver_id)].short if record.driver_id >= 0 else "CONTROL"
		var text = "%.1fs · %s · %s" % [record.time, who, e.reason]
		if record.kind == "recovery_service" and e.stage == "completed":
			text += (
				" Measured service %.2fs; damage %.0f → %.0f; health %.0f%% → %.0f%%."
				% [e.elapsed, e.damage_before, e.damage_after, e.health_before, e.health_after]
			)
		lines.append(text)
	return "\n\n".join(lines)
