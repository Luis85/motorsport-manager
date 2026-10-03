extends RaceMechanic
## Authoritative weather rules; caller supplies state, never a view or singleton.
const CHECKPOINT_VERSION = 7
## Authoritative weather evolution and detached observations.


func weather_observation(sim: RaceSim) -> Dictionary:
	var cloud = (
		sim.weather_state.model.cloud
		if not sim.weather_state.is_empty() and sim.weather_state.model.mode == "seeded"
		else -1.0
	)
	return WeekendWeather.observe(sim.surface, sim.rain, cloud, sim.total_time)


func weather_outlook(sim: RaceSim) -> Dictionary:
	return WeatherOutlook.evaluate(
		sim.weather_state.history,
		sim.weather_observation(),
		sim.track.estimate,
		sim.weather_state.model.mode,
		sim.tuning.environment.outlook
	)


func weather_advice(sim: RaceSim, id: int) -> Dictionary:
	if id < 0 or id >= sim.cars.size():
		return {}
	return WeatherStrategy.evaluate(
		RaceForecaster.capture(sim, id, sim.active_plan(id), int(sim.policy(id).revision)),
		sim.weather_outlook()
	)


func weather_stale(sim: RaceSim, advice: Dictionary) -> bool:
	if (
		advice.is_empty()
		or not RaceCheckpoint.integral(advice.get("driver_id"), 0, sim.cars.size() - 1)
	):
		return true
	var id = int(advice.driver_id)
	return (
		not RaceCheckpoint.number(advice.get("time"), 0, sim.total_time)
		or sim.total_time - advice.time > RaceForecaster.MAX_AGE
		or advice.get("key") != RaceForecaster.material_key(sim, id, int(sim.policy(id).revision))
		or advice.get("weather_key") != sim.weather_outlook().key
	)


func update_surface(sim: RaceSim) -> void:
	if sim.weather_state.is_empty():
		sim.mechanics.before("weather", "update_surface", [])
		return
	if sim.weather_state.model.mode == "scripted_training":
		sim.mechanics.before("weather", "update_surface", [])
		sim.weather_state.model.rain = sim.rain
	else:
		WeekendWeather.advance(
			sim.weather_state.model, sim.scenario, RaceSim.STEP, sim.tuning.environment.weather
		)
		sim.rain = sim.weather_state.model.rain
		var description = (
			"Heavy rain"
			if sim.rain >= sim.tuning.environment.outlook.rain_heavy
			else (
				"Rain"
				if sim.rain >= sim.tuning.environment.outlook.rain_visible
				else "No rain observed"
			)
		)
		if description != sim.weather_name:
			sim.weather_name = description
			sim.post("weather", description + ". Surface water changes gradually.")
		sim.surface_accumulator += RaceSim.STEP
		if sim.surface_accumulator >= RaceSurface.INTERVAL:
			RaceSurface.evolve(
				sim.surface,
				sim.rain,
				sim.surface_accumulator,
				sim.total_time,
				sim.tuning.environment.surface
			)
			RaceSurface.profiles(sim.surface, sim.water, sim.rubber)
			sim.surface_accumulator = 0.0
	if sim.total_time + 0.000001 >= sim.weather_state.next_sample:
		var observed = sim.weather_observation()
		sim.weather_state.history.append(observed)
		if sim.weather_state.history.size() > WeekendWeather.HISTORY_LIMIT:
			sim.weather_state.history.pop_front()
		sim.weather_state.next_sample = sim.total_time + WeekendWeather.SAMPLE_INTERVAL
		for id in sim.player_ids():
			var car = sim.cars[id]
			var issue = sim.weather_issue(id)
			if issue.is_empty():
				sim.weather_state.notices[id] = ""
				continue
			# Deduplicate by condition family, not every tiny forecast revision.
			var notice = (
				issue
				+ ":"
				+ WeatherOutlook.condition(observed.mean, sim.tuning.environment.outlook)
			)
			if notice == sim.weather_state.notices[id] or car.dnf or car.finished:
				continue
			sim.weather_state.notices[id] = notice
			RaceJournal.append(
				sim.strategy_state,
				sim,
				"weather_warning",
				id,
				{
					"reason": issue,
					"observed": observed,
					"fallback": "Approved plans and current pit ownership remain unchanged."
				}
			)
			sim.post(
				"radio",
				car.short + " · " + issue + ". Compare Weather; your current plan remains active."
			)


func weather_issue(sim: RaceSim, id: int) -> String:
	var c = sim.cars[id]
	if sim.phase != "race" or c.route != "track" or c.dnf or c.finished:
		return ""
	var observed = sim.weather_observation()
	if (
		not c.tyre_rules.wet(c.compound)
		and observed.peak > sim.tuning.environment.weather_policy.slick_warning_water
	):
		return "Wet sections on slick tyres"
	if (
		c.tyre_rules.wet(c.compound)
		and observed.mean < sim.tuning.environment.weather_policy.wet_warning_water
	):
		return "Wet tyres on a drying line"
	if (
		sim.rain >= sim.tuning.environment.outlook.rain_visible
		and observed.mean < sim.tuning.environment.weather_policy.rain_warning_water
	):
		return "Rain arriving; surface crossover uncertain"
	return ""


func weather_debrief(sim: RaceSim) -> String:
	var lines: Array[String] = []
	for record in sim.strategy_state.records:
		if record.kind != "weather_decision" or record.driver_id not in sim.player_ids():
			continue
		var evidence = record.evidence
		var line = (
			"%s · %.0fs · %s\nObserved rain %.0f%%; measured line water %.0f%%. %s"
			% [
				sim.cars[int(record.driver_id)].short,
				record.time,
				evidence.action.replace("_", " "),
				evidence.observed.rain * 100,
				evidence.observed.mean * 100,
				evidence.reason
			]
		)
		if evidence.has("gain_low"):
			line += (
				(
					"\nAt-call estimated gain %.0f to %.0fs across stress cases, not a measured "
					+ "alternative result. See the measured pit visit below."
				)
				% [evidence.gain_low, evidence.gain_high]
			)
		lines.append(line)
	return (
		"Weather decision evidence\n\n"
		+ (
			"No weather decisions recorded."
			if lines.is_empty()
			else "\n\n".join(lines.slice(maxi(0, lines.size() - 6)))
		)
	)
