extends RaceMechanic
## Authoritative recovery rules; caller supplies state, never a view or singleton.
const RECOVERY_CHECKPOINT_VERSION = 8
## Reliability progression and frozen pit-service execution.


func wear_car(
	sim: RaceSim,
	c: RaceCar,
	distance: float,
	cell: int,
	effects: Dictionary = {},
	local: Dictionary = {}
) -> void:
	sim.mechanics.before("recovery", "wear_car", [c, distance, cell, effects, local])
	if not sim.enhanced() or sim.phase != "race" or c.route != "track" or c.dnf or c.finished:
		return
	var r = sim.reliability(int(c.id))
	var result = RaceReliability.advance(
		r, c, RaceSim.STEP, sim.intensity != "calm", sim.tuning.operations.reliability
	)
	if not result.is_empty():
		result.observed = RaceReliability.observation(c, r, sim.tuning.operations.reliability)
		result.location = c.distance
		result.sector = sim.track.sector_at(c.distance)
		RaceJournal.append(sim.strategy_state, sim, "recovery_fault", int(c.id), result)
		if result.get("retire", false):
			sim.retire(c, result.reason)
	sim.observe_reliability(c)


func observe_reliability(sim: RaceSim, c: RaceCar) -> void:
	var r = sim.reliability(int(c.id))
	var stage = RaceReliability.stage(c, r, sim.tuning.operations.reliability)
	if stage == r.stage:
		return
	var before = r.stage
	r.stage = stage
	r.stage_since = sim.total_time
	r.revision += 1
	var reason = (
		"%s → %s; damage %.0f, health %.0f%%, observed heat %.0f°C."
		% [before, stage, c.damage, c.health, c.engine_temperature]
	)
	RaceJournal.append(
		sim.strategy_state,
		sim,
		"recovery_stage",
		int(c.id),
		{
			"from": before,
			"to": stage,
			"reason": reason,
			"observed": RaceReliability.observation(c, r, sim.tuning.operations.reliability)
		}
	)
	if c.player:
		sim.post(
			"radio",
			c.short + " · " + reason + " Inspect Recovery; current authority remains in force."
		)


func service_random_value(sim: RaceSim) -> float:
	return (
		RaceReliability.draw(sim.reliability_state.service_stream)
		if sim.enhanced()
		else sim.mechanics.before("recovery", "service_random_value", [])
	)


func begin_service(sim: RaceSim, c: RaceCar) -> void:
	if not sim.enhanced():
		sim.mechanics.before("recovery", "begin_service", [c])
		return
	var r = sim.reliability(int(c.id))
	if r.repair_only:
		c.service_set_id = ""
		c.service_compound = c.compound
		c.service_repair = true
		c.pit_timer = (
			sim.tuning.service.repair_base_seconds
			+ sim.service_random_value() * sim.tuning.service.repair_jitter_seconds
			+ c.damage * sim.tuning.service.repair_seconds_per_damage
		)
	else:
		sim.mechanics.before("recovery", "begin_service", [c])
	var job = {
		"started": sim.total_time,
		"duration": c.pit_timer,
		"damage_before": c.damage,
		"health_before": c.health,
		"repair_seconds":
		c.damage * sim.tuning.service.repair_seconds_per_damage if c.service_repair else 0.0,
		"repair": c.service_repair,
		"repair_only": r.repair_only,
		"set_before": c.set_id
	}
	job.event_id = RaceJournal.append(
		sim.strategy_state,
		sim,
		"recovery_service",
		int(c.id),
		{
			"reason": "Physical shared-box service started; repair plan frozen.",
			"stage": "started",
			"job": job.duplicate(true)
		},
		sim.policy(int(c.id)).last_order_id
	)
	r.service = job


func complete_service(sim: RaceSim, c: RaceCar) -> void:
	if not sim.enhanced():
		sim.mechanics.before("recovery", "complete_service", [c])
		return
	var r = sim.reliability(int(c.id))
	var job = r.service
	if job.repair_only:
		c.damage = 0.0
		c.scheduled_lap = -1
		c.next_set_id = ""
		sim.post("pit", c.short + " · Repair completed; the same fitted set and wear are retained.")
	else:
		sim.mechanics.before("recovery", "complete_service", [c])
	if job.repair:
		r.stress = 0.0
		r.critical_load = 0.0
		r.critical_seconds = 0.0
		# Lifetime health is intentionally not replenished. No thresholds are redrawn by repair.
	RaceJournal.append(
		sim.strategy_state,
		sim,
		"recovery_service",
		int(c.id),
		{
			"reason": "Measured scalar service completed; health was not replenished.",
			"stage": "completed",
			"elapsed": sim.total_time - job.started + RaceSim.STEP,
			"damage_before": job.damage_before,
			"damage_after": c.damage,
			"health_before": job.health_before,
			"health_after": c.health,
			"set_before": job.set_before,
			"set_after": c.set_id
		},
		job.event_id
	)
	sim.observe_reliability(c)


func update_pit(sim: RaceSim, c: RaceCar, old: Array = []) -> void:
	var before = c.route
	sim.mechanics.before("recovery", "update_pit", [c, old])
	if not sim.enhanced():
		return
	var r = sim.reliability(int(c.id))
	if c.pit_stage == "service" and r.repair_only:
		c.intent = "Repairing scalar damage · retaining fitted tyres"
	if before == "pit" and c.route == "track":
		r.repair_only = false
		r.service = {}
		r.revision += 1


func pit_exit_message(sim: RaceSim, c: RaceCar) -> String:
	if sim.enhanced() and sim.reliability(int(c.id)).repair_only:
		return c.short + " rejoins with the same retained tyre set and its actual wear."
	return sim.mechanics.before("recovery", "pit_exit_message", [c])


func pit_status(sim: RaceSim, c: RaceCar) -> String:
	if (
		sim.enhanced()
		and sim.reliability(int(c.id)).repair_only
		and c.route == "pit"
		and c.pit_stage == "service"
	):
		return (
			"Repairing scalar damage · %.1fs remaining\nFitted %s retained; no tyre change"
			% [maxf(0, c.pit_timer), c.set_id]
		)
	return sim.mechanics.before("recovery", "pit_status", [c])
