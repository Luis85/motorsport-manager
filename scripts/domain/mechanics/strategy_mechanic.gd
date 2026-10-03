class_name StrategyMechanic
extends "res://scripts/domain/mechanics/strategy_commands.gd"


func definition() -> Dictionary:
	return {
		"id": "strategy",
		"version": 1,
		"requires": [],
		"hooks":
		[
			"policy",
			"active_plan",
			"forecast",
			"sync_ownership",
			"command",
			"policy_command",
			"manage_resources",
			"engineer",
			"contextual_rival",
			"review_rival_style",
			"order_stop",
			"block_plan",
			"leave_garage",
			"record_stint",
			"step",
			"snapshot",
			"traffic_instruction",
			"record_track_pass",
			"move_car",
			"observe_warnings"
		]
	}


func install(sim: RaceSim, _geometry: TrackGeometry = null, _options: Dictionary = {}) -> void:
	sim.strategy_state = RaceJournal.create(sim.cars)
	sim.battle_state = RacecraftController.create(sim.cars)
	sim.team_state = TeamOrders.create()
	sim.rival_state = RivalStrategy.create(sim.cars)


func policy(sim: RaceSim, id: int) -> Dictionary:
	return sim.strategy_state.policies[id]


func active_plan(sim: RaceSim, id: int) -> Dictionary:
	var p = sim.policy(id)
	var result = p.plan.duplicate(true)
	if not result.is_empty():
		result.stops = result.stops.slice(int(p.next_stop))
	return result


func forecast(sim: RaceSim, id: int, draft: Dictionary = {}) -> Dictionary:
	if id < 0 or id >= sim.cars.size():
		return {}
	return RaceForecaster.evaluate(
		RaceForecaster.capture(
			sim,
			id,
			sim.active_plan(id) if draft.is_empty() else draft,
			int(sim.policy(id).revision)
		)
	)


func sync_ownership(sim: RaceSim, c: RaceCar) -> void:
	var p = sim.policy(c.id)
	c.auto = p.overrides.is_empty()
	for channel in StrategyPlan.CHANNELS:
		if p.owners[channel] != "engineer":
			c.auto = false


func step(sim: RaceSim) -> void:
	if sim.paused or sim.phase not in RaceSim.ACTIVE:
		return
	var previous_phase = sim.phase
	var routes: Array = []
	for car in sim.cars:
		routes.append(car.route)
		if sim.phase == "qualifying":
			car.auto = StrategyPlan.owns(sim.policy(car.id), "qualifying")
	sim.mechanics.before("strategy", "step", [])
	for car in sim.cars:
		var p = sim.policy(car.id)
		_expire_overrides(sim, car, p)
		if previous_phase == "race" and routes[car.id] == "track" and car.route == "pit":
			RivalStrategy.observe_entry(
				sim.rival_state,
				RaceForecaster.capture(sim, (int(car.id) + 1) % sim.cars.size()),
				int(car.id)
			)
			var entry_id = RaceJournal.append(
				sim.strategy_state,
				sim,
				"pit_entry",
				car.id,
				{"gate": car.pit_gate, "set_id": car.next_set_id},
				p.last_order_id
			)
			p.visit = {
				"entered_at": sim.total_time,
				"entry_id": entry_id,
				"prediction": p.order_forecast.duplicate(true)
			}
		elif (
			previous_phase == "race"
			and routes[car.id] == "pit"
			and car.route == "track"
			and not p.visit.is_empty()
		):
			var elapsed = sim.total_time - p.visit.entered_at
			var evidence = {
				"visit_seconds": elapsed, "fitted_set": car.set_id, "stops": car.pit_stops
			}
			var estimate = p.visit.prediction
			if not estimate.is_empty():
				evidence.merge(
					{
						"predicted_low": estimate.visit_low,
						"predicted_high": estimate.visit_high,
						"residual": elapsed - estimate.visit
					}
				)
			RaceJournal.append(
				sim.strategy_state, sim, "pit_exit", car.id, evidence, p.visit.entry_id
			)
			if (
				not p.plan.is_empty()
				and p.next_stop < p.plan.stops.size()
				and car.set_id == p.plan.stops[int(p.next_stop)].set_id
			):
				p.next_stop += 1
				if p.next_stop >= p.plan.stops.size():
					p.plan_status = "completed"
			p.visit = {}
			p.order_forecast = {}
			p.next_review = sim.total_time + sim.tuning.competition.policy.review_seconds
		sim.sync_ownership(car)
	RacecraftController.after_step(sim)
	TeamOrders.after_step(sim)
	if sim.phase == "race" and roundi(sim.total_time / RaceSim.STEP) % 20 == 0:
		for id in sim.player_ids():
			sim.observe_warnings(sim.cars[id])
	if previous_phase != "results" and sim.phase == "results":
		var classification: Array = []
		for car in sim.standings():
			classification.append(
				{
					"id": car.id,
					"position": classification.size() + 1,
					"laps": car.completed,
					"time": car.finish_time,
					"retired": car.dnf
				}
			)
		RaceJournal.append(
			sim.strategy_state, sim, "result", -1, {"classification": classification}
		)


func snapshot(sim: RaceSim) -> Dictionary:
	var data = sim.mechanics.before("strategy", "snapshot", [])
	data.version = 6
	data.strategy_state = sim.strategy_state.duplicate(true)
	data.battle_state = sim.battle_state.duplicate(true)
	data.team_state = sim.team_state.duplicate(true)
	data.rival_state = sim.rival_state.duplicate(true)
	return data


func _expire_overrides(sim: RaceSim, car: RaceCar, p: Dictionary) -> void:
	for channel in p.overrides.keys():
		var intent = p.overrides[channel]
		if car.distance + 0.00001 >= intent.until_distance or car.finished or car.dnf:
			car[channel] = int(intent.previous_value)
			p.overrides.erase(channel)
			if sim.phase == "race" and not car.dnf and not car.finished:
				sim.manage_resources(car, channel)
			RaceJournal.append(
				sim.strategy_state,
				sim,
				"handback",
				car.id,
				{
					"reason":
					(
						"%s intent ended; control returned to %s"
						% [channel.capitalize(), p.owners[channel]]
					)
				},
				intent.id
			)
			sim.post(
				"radio", "%s · %s control returned to %s." % [car.short, channel, p.owners[channel]]
			)
