class_name RaceForecaster
extends "res://scripts/domain/weekend/race_forecast_evaluation.gd"


static func fuel_margin(sim: RaceSim, car: RaceCar) -> float:
	var remaining = (
		maxf(0, sim.laps - maxf(0, car.distance) / sim.track.length)
		if sim.phase in ["race", "results"]
		else float(sim.laps)
	)
	var formation = (
		sim.tuning.fuel.reduced_rate
		if (
			sim.phase
			in [
				"briefing",
				"practice",
				"practice_results",
				"qualifying",
				"qualifying_results",
				"race_preparation"
			]
		)
		else (
			sim.tuning.fuel.reduced_rate * maxf(0, 1 - car.distance / sim.track.length)
			if sim.phase == "formation"
			else 0.0
		)
	)
	# Qualifying has a separate four-lap fuel load. Do not call it a race shortfall.
	var available = (
		sim.tuning.race_fuel(sim.laps)
		if sim.phase in ["practice", "practice_results", "qualifying", "qualifying_results"]
		else float(car.fuel)
	)
	return available - remaining * sim.tuning.fuel.engine_rates[car.engine] - formation


static func reachable_gate(sim: RaceSim, car: RaceCar) -> Dictionary:
	var gate = (
		(floor((car.distance - sim.track.pit_entry) / sim.track.length) + 1) * sim.track.length
		+ sim.track.pit_entry
	)
	var limits = RacePerformanceProfile.limits(
		sim.performance_profile(car), sim.track.vehicle_definition
	)
	var stopping = (
		(
			maxf(0, car.speed ** 2 - sim.track.pit_limit ** 2)
			/ (2 * float(limits.brake) * sim.tuning.balance.pit_motion.entry_braking_factor)
		)
		+ sim.tuning.balance.pit_motion.entry_braking_margin_m
	)
	var deferred = gate - car.distance < stopping
	if deferred:
		gate += sim.track.length
	return {
		"distance": gate,
		"lap": int(round((gate - sim.track.pit_entry) / sim.track.length)) + 1,
		"deferred": deferred,
		"deadline": maxf(0, gate - car.distance - stopping) / maxf(5, car.speed)
	}


static func material_key(sim: RaceSim, driver_id: int, revision: int = 0) -> String:
	var c = sim.cars[driver_id]
	var facts: Array = [
		sim.phase,
		sim.flag,
		sim.yellow_sector,
		int(sim.average(sim.water) * 20),
		c.set_id,
		c.next_set_id,
		c.next_compound,
		c.pit_order,
		c.pit_gate,
		c.pace,
		c.engine,
		c.repair,
		int(c.damage),
		int(c.tyre / 5),
		int(fuel_margin(sim, c) * 5),
		reachable_gate(sim, c).distance,
		revision,
		sim.performance_profile(c).digest
	]
	facts.append(sim.forecast_parameters(driver_id).get("key", []))
	if sim.tuning.authored():
		facts.append(sim.tuning.fingerprint)
	if (sim is RaceSim and sim.has_mechanic("strategy")) and c.player:
		facts.append(
			[sim.team_state.revision, sim.team_state.pit_priority.get("deferred_gate", -1)]
		)
	for item in c.tyre_sets:
		facts.append([item.id, WheelTyres.usable(item)])
	for other in sim.cars:
		facts.append([other.id, other.route, other.pit_stops, other.dnf, other.finished])
		if other.team_identity() == c.team_identity():
			facts.append([other.pit_order, other.pit_gate, other.pit_stage, int(other.pit_timer)])
	return JSON.stringify(facts).sha256_text()


static func capture(
	sim: RaceSim, driver_id: int, plan: Dictionary = {}, revision: int = 0
) -> Dictionary:
	var c = sim.cars[driver_id]
	var own: Dictionary = {}
	for key in [
		"id",
		"short",
		"team",
		"distance",
		"speed",
		"compound",
		"set_id",
		"next_set_id",
		"next_compound",
		"tyre",
		"temperature",
		"fuel",
		"damage",
		"health",
		"pace",
		"engine",
		"skill",
		"route",
		"pit_order",
		"pit_gate",
		"scheduled_lap",
		"box_d",
		"repair",
		"dnf",
		"finished"
	]:
		own[key] = c[key]
	own.inventory = c.tyre_sets.duplicate(true)
	own.performance_profile = sim.performance_profile(c).duplicate(true)
	own.starting_set = (
		plan.get("starting_set", c.set_id)
		if (
			sim.phase
			in [
				"briefing",
				"practice",
				"practice_results",
				"qualifying",
				"qualifying_results",
				"race_preparation"
			]
		)
		else c.set_id
	)
	own.projected_fuel = (
		sim.tuning.race_fuel(sim.laps)
		if sim.phase in ["practice", "practice_results", "qualifying", "qualifying_results"]
		else float(c.fuel)
	)
	own.measured_race_wear = false
	own.wear = (
		c.tyre_rules.spec(c.compound).wear
		* sim.tuning.pace.wear_modes[c.pace]
		* sim.tuning.pace.forecast_wear_factor
	)
	if not c.stints.is_empty():
		var stint = c.stints.back()
		var travelled = c.distance / sim.track.length - float(stint.get("from", 0))
		# Actual aggregate depletion is useful after enough running; tiny samples amplify noise.
		if (
			travelled > sim.tuning.balance.forecast.measured_wear_minimum_laps
			and stint.has("start_life")
		):
			own.measured_race_wear = true
			own.wear = clampf(
				(stint.start_life - c.tyre) / travelled,
				own.wear * sim.tuning.balance.forecast.measured_wear_minimum_factor,
				own.wear * sim.tuning.balance.forecast.measured_wear_maximum_factor
			)
	var public: Array = []
	var teammate: Dictionary = {}
	for other in sim.cars:
		if other.id == c.id:
			continue
		var lap_seconds = sim.track.estimate
		var sum = 0.0
		var count = 0
		for i in range(
			other.history.size() - 1,
			maxi(
				-1, other.history.size() - 1 - int(sim.tuning.balance.forecast.observed_lap_samples)
			),
			-1
		):
			var lap = other.history[i]
			if not lap.get("pit_lap", false) and lap.time > 0:
				sum += lap.time
				count += 1
		if count > 0:
			lap_seconds = sum / count
		public.append(
			{
				"id": int(other.id),
				"short": other.short,
				"distance": other.distance,
				"route": other.route,
				"compound": other.compound,
				"stops": other.pit_stops,
				"dnf": other.dnf,
				"finished": other.finished,
				"lap_seconds": maxf(10, lap_seconds)
			}
		)
		# A team's own accepted orders are known to its strategist. Rival plans are never copied.
		if other.team_identity() == c.team_identity():
			teammate = {
				"id": int(other.id),
				"distance": other.distance,
				"speed": other.speed,
				"pit_order": other.pit_order,
				"pit_gate": other.pit_gate,
				"route": other.route,
				"pit_d": other.pit_d,
				"box_d": other.box_d,
				"pit_stage": other.pit_stage,
				"pit_timer": other.pit_timer,
				"damage": other.damage,
				"repair": other.repair
			}
	var gate = reachable_gate(sim, c)
	var result = {
		"tick": roundi(sim.total_time / RaceSim.STEP),
		"time": sim.total_time,
		"phase": sim.phase,
		"key": material_key(sim, driver_id, revision),
		"model_version": MODEL_VERSION,
		"scope": "own private + observed rival timing",
		"own": own,
		"public": public,
		"teammate": teammate,
		"plan": plan.duplicate(true),
		"laps": sim.laps,
		"length": sim.track.length,
		"reference_lap": sim.track.estimate,
		"pit_length": sim.track.pit_length,
		"pit_limit": sim.track.pit_limit,
		"pit_entry": sim.track.pit_entry,
		"pit_exit": sim.track.pit_exit,
		"water": sim.average(sim.water),
		"flag": sim.flag,
		"gate": gate,
		"fuel_margin": fuel_margin(sim, c),
		"model_context": sim.forecast_parameters(driver_id)
	}
	if c.tyre_rules.authored():
		result.tyre_context = c.tyre_rules.view()
	if sim.tuning.authored():
		result.tuning_context = sim.tuning.view()
	return result


static func stale(sim: RaceSim, forecast: Dictionary, revision: int = 0) -> bool:
	if forecast.is_empty():
		return true
	return (
		sim.total_time - forecast.time > sim.tuning.balance.forecast.maximum_age_seconds
		or forecast.key != material_key(sim, int(forecast.driver_id), revision)
	)


static func qualifying_release(sim: RaceSim, car: RaceCar) -> Dictionary:
	var rules: Dictionary = sim.tuning.balance.procedure
	var transit = (
		maxf(0, sim.track.pit_length - car.box_d) / sim.track.pit_limit
		+ rules.qualifying_release_transit_seconds
	)
	var outlap = (
		sim.track.estimate
		* RacePerformanceProfile.forecast_lap_factor(
			sim.performance_profile(car), sim.tuning.balance.forecast
		)
		/ rules.qualifying_outlap_speed_factor
	)
	var needed = transit + outlap + rules.qualifying_release_margin_seconds
	return {
		"required_seconds": needed,
		"latest_release": sim.qual_duration - needed,
		"can_start_hotlap":
		(
			sim.phase == "qualifying"
			and not sim.qual_closed
			and car.route == "garage"
			and sim.clock + needed < sim.qual_duration
		),
		"label":
		(
			"Estimate includes pit transit, an out-lap and %ss margin; traffic may delay release."
			% String.num(rules.qualifying_release_margin_seconds, 2).rstrip("0").rstrip(".")
		)
	}
