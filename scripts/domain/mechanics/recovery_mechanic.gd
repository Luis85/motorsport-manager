class_name RecoveryMechanic
extends "res://scripts/domain/mechanics/recovery_commands.gd"


func definition() -> Dictionary:
	return {
		"id": "recovery",
		"version": 1,
		"requires": ["strategy", "weather"],
		"hooks":
		[
			"enhanced",
			"reliability",
			"recovery_advice",
			"recovery_stale",
			"forecast_parameters",
			"command",
			"log_recovery_command",
			"issue_repair",
			"manage_resources",
			"engineer",
			"wear_car",
			"observe_reliability",
			"service_random_value",
			"begin_service",
			"complete_service",
			"update_pit",
			"pit_exit_message",
			"pit_status",
			"update_flags",
			"neutral",
			"neutral_speed_limit",
			"constrain_progress",
			"update_yield",
			"incident",
			"retire",
			"step",
			"snapshot",
			"recovery_debrief"
		]
	}


func install(sim: RaceSim, geometry: TrackGeometry = null, _options: Dictionary = {}) -> void:
	sim.reliability_state = RaceReliability.create(
		sim.cars, sim.seed_value, "staged", sim.tuning.operations.reliability
	)
	sim.control_state = WeekendRaceControl.create()
	if geometry != null:
		(
			RaceJournal
			. append(
				sim.strategy_state,
				sim,
				"recovery_rules",
				-1,
				{
					"reason":
					(
						"Staged scalar reliability; virtual neutralization. Player emergency repairs default "
						+ "to advice only; authorize each driver explicitly. Calm mode suppresses random faults, not wear."
					),
					"version": 1
				}
			)
		)


func enhanced(sim: RaceSim) -> bool:
	return not sim.reliability_state.is_empty() and sim.reliability_state.mode == "staged"


func reliability(sim: RaceSim, id: int) -> Dictionary:
	return sim.reliability_state.drivers[id]


func recovery_advice(sim: RaceSim, id: int) -> Dictionary:
	if id < 0 or id >= sim.cars.size():
		return {}
	return RecoveryForecast.evaluate(
		RaceForecaster.capture(sim, id, sim.active_plan(id), int(sim.policy(id).revision)),
		RaceReliability.observation(
			sim.cars[id], sim.reliability(id), sim.tuning.operations.reliability
		)
	)


func recovery_stale(sim: RaceSim, advice: Dictionary) -> bool:
	if (
		not RaceCheckpoint.integral(advice.get("driver_id"), 0, sim.cars.size() - 1)
		or not RaceCheckpoint.number(advice.get("time"), 0, sim.total_time)
	):
		return true
	var id = int(advice.driver_id)
	return (
		sim.total_time - advice.time > RaceForecaster.MAX_AGE
		or advice.get("key") != RaceForecaster.material_key(sim, id, int(sim.policy(id).revision))
	)


func forecast_parameters(sim: RaceSim, id: int) -> Dictionary:
	if not sim.enhanced():
		return {}
	var c = sim.cars[id]
	var r = sim.reliability(id)
	var mate_only = false
	for other in sim.cars:
		if other.id != id and other.team_identity() == c.team_identity():
			mate_only = sim.reliability(int(other.id)).repair_only
	return {
		"key":
		[
			sim.control_state.revision,
			r.revision,
			int(c.health / 5),
			int(c.engine_temperature / 5),
			r.repair_only,
			mate_only
		],
		"health_factor":
		(
			1.0
			- (
				maxf(0, sim.tuning.condition.health_reference - c.health)
				* sim.tuning.condition.health_speed_loss
			)
		),
		"thermal_factor":
		(
			1.0
			- (
				maxf(0, c.engine_temperature - sim.tuning.condition.heat_reference_c)
				* sim.tuning.condition.heat_speed_loss
			)
		),
		"neutral_factor":
		(
			sim.tuning.operations.control.virtual_pace_factor
			if sim.control_state.state != "green"
			else 1.0
		),
		"repair_only": r.repair_only,
		"teammate_repair_only": mate_only,
		"rule_summary":
		(
			"Current flag held constant for this estimate; a release or new hazard invalidates "
			+ "it. No future incidents are available. Local-yellow sector time is not separately forecast."
		)
	}


func log_recovery_command(
	sim: RaceSim, action: String, payload: Dictionary, reason: String
) -> void:
	var id = int(payload.id)
	sim.commands.append(
		{
			"tick": snappedf(sim.total_time, RaceSim.STEP),
			"action": action,
			"payload": payload.duplicate(true)
		}
	)
	RaceJournal.append(
		sim.strategy_state,
		sim,
		"recovery_decision",
		id,
		{
			"action": action,
			"reason": reason,
			"observed":
			RaceReliability.observation(
				sim.cars[id], sim.reliability(id), sim.tuning.operations.reliability
			)
		},
		sim.policy(id).last_order_id
	)
	sim.post("radio", sim.cars[id].short + " · " + reason)


func issue_repair(sim: RaceSim, c: RaceCar, manual: bool, reason: String) -> void:
	var r = sim.reliability(int(c.id))
	var p = sim.policy(int(c.id))
	r.repair_only = true
	r.revision += 1
	c.repair = true
	c.next_set_id = ""
	c.next_compound = c.compound
	c.scheduled_lap = -1
	var source = RaceForecaster.capture(sim, int(c.id), sim.active_plan(int(c.id)), int(p.revision))
	sim.queue_pit(c)
	if manual:
		p.owners.pit = "player"
		if not p.plan.is_empty():
			p.plan_status = "overridden"
	sim.sync_ownership(c)
	p.order_forecast = RaceForecaster.pit_prediction(source, c.pit_gate)
	p.last_order_id = RaceJournal.append(
		sim.strategy_state,
		sim,
		"strategy_order",
		int(c.id),
		{
			"reason": reason,
			"set_id": "",
			"gate": c.pit_gate,
			"prediction": p.order_forecast,
			"scope": "Own observed aggregate condition; repair-only, retained fitted set."
		},
		p.plan_intent_id
	)
	sim.post(
		"pit",
		(
			c.short
			+ " · "
			+ reason
			+ (" Entry deferred to the next safely reachable gate." if c.pit_deferred else "")
		)
	)


func manage_resources(sim: RaceSim, c: RaceCar, only_channel: String = "") -> void:
	sim.mechanics.before("recovery", "manage_resources", [c, only_channel])
	if not sim.enhanced():
		return
	var stage = RaceReliability.stage(
		c, sim.reliability(int(c.id)), sim.tuning.operations.reliability
	)
	if (
		stage in ["degraded", "critical"]
		and only_channel in ["", "engine"]
		and StrategyPlan.owns(sim.policy(int(c.id)), "engine")
	):
		c.engine = 0


func engineer(sim: RaceSim, c: RaceCar) -> void:
	if not sim.enhanced():
		sim.mechanics.before("recovery", "engineer", [c])
		return
	var r = sim.reliability(int(c.id))
	var p = sim.policy(int(c.id))
	var critical = RaceReliability.stage(c, r, sim.tuning.operations.reliability) == "critical"
	if (
		sim.phase == "race"
		and c.route == "track"
		and not c.dnf
		and not c.finished
		and not c.pit_order
		and critical
	):
		sim.manage_resources(c)
		if (
			StrategyPlan.owns(p, "pit")
			and r.emergency == "repair"
			and p.plan.get("allow_emergency", true)
			and c.damage > 0
			and c.damage * sim.tuning.service.repair_seconds_per_damage <= r.repair_budget
		):
			var advice = sim.recovery_advice(int(c.id))
			if advice.repair_available:
				(
					sim
					. issue_repair(
						c,
						false,
						(
							"Authorized critical repair within %.0fs work budget; finite fitted tyres retained."
							% r.repair_budget
						)
					)
				)
				return
		# Damage alone must not reach the legacy damage>24 automatic stop path and bypass authority.
		if (
			c.tyre >= sim.tuning.environment.weather_policy.fallback_tread
			and WheelTyres.usable(TyreInventory.find(c, c.set_id))
			and p.plan.is_empty()
		):
			return
	if (
		sim.phase == "race"
		and c.damage > sim.tuning.environment.weather_policy.fallback_damage
		and p.plan.is_empty()
		and c.tyre >= sim.tuning.environment.weather_policy.fallback_tread
		and WheelTyres.usable(TyreInventory.find(c, c.set_id))
	):
		sim.manage_resources(c)
		return
	sim.mechanics.before("recovery", "engineer", [c])
