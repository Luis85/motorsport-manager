class_name WeatherMechanic
extends RefCounted
## Authoritative weather rules; caller supplies state, never a view or singleton.
const CHECKPOINT_VERSION = 7

func definition() -> Dictionary:
	return {"id": "weather", "version": 1, "requires": ["strategy"], "hooks": ["weather_observation", "weather_outlook", "weather_advice", "weather_stale", "update_surface", "weather_issue", "command", "engineer", "snapshot", "weather_debrief"]}

func install(sim: RaceSim, geometry: TrackGeometry = null, options: Dictionary = {}) -> void:

	if geometry == null: return
	var mode = options.get("weather_mode", "seeded")
	if mode not in WeekendWeather.MODES: mode = "seeded"
	sim.weather_state = WeatherRaceSim.new_weather_state(sim.seed_value, sim.scenario, mode)
	if mode == "seeded": sim.rain = sim.weather_state.model.rain
	else: sim.weather_state.model.rain = sim.rain
	sim.weather_state.history.append(sim.weather_observation())
	sim.weather_state.next_sample = sim.total_time + WeekendWeather.SAMPLE_INTERVAL
	RaceJournal.append(sim.strategy_state, sim, "weather_model", -1, {"mode": mode, "version": WeekendWeather.VERSION,
		"reason": "Seeded weather; public forecasts cannot read future targets." if mode == "seeded" else "Explicit scripted training weather; original schedule preserved."})

func weather_observation(sim: RaceSim) -> Dictionary:
	var cloud = sim.weather_state.model.cloud if not sim.weather_state.is_empty() and sim.weather_state.model.mode == "seeded" else -1.0
	return WeekendWeather.observe(sim.surface, sim.rain, cloud, sim.total_time)

func weather_outlook(sim: RaceSim) -> Dictionary:
	return WeatherOutlook.evaluate(sim.weather_state.history, sim.weather_observation(), sim.track.estimate, sim.weather_state.model.mode)

func weather_advice(sim: RaceSim, id: int) -> Dictionary:
	if id < 0 or id >= sim.cars.size(): return {}
	return WeatherStrategy.evaluate(RaceForecaster.capture(sim, id, sim.active_plan(id), int(sim.policy(id).revision)), sim.weather_outlook())

func weather_stale(sim: RaceSim, advice: Dictionary) -> bool:
	if advice.is_empty() or not RaceCheckpoint.integral(advice.get("driver_id"), 0, 11): return true
	var id = int(advice.driver_id)
	return not RaceCheckpoint.number(advice.get("time"), 0, sim.total_time) or sim.total_time - advice.time > RaceForecaster.MAX_AGE or advice.get("key") != RaceForecaster.material_key(sim, id, int(sim.policy(id).revision)) or advice.get("weather_key") != sim.weather_outlook().key

func update_surface(sim: RaceSim) -> void:
	if sim.weather_state.is_empty(): sim.mechanics.before("weather", "update_surface", []); return
	if sim.weather_state.model.mode == "scripted_training":
		sim.mechanics.before("weather", "update_surface", [])
		sim.weather_state.model.rain = sim.rain
	else:
		WeekendWeather.advance(sim.weather_state.model, sim.scenario, RaceSim.STEP)
		sim.rain = sim.weather_state.model.rain
		var description = "Heavy rain" if sim.rain >= 0.60 else ("Rain" if sim.rain >= 0.08 else "No rain observed")
		if description != sim.weather_name:
			sim.weather_name = description; sim.post("weather", description + ". Surface water changes gradually.")
		sim.surface_accumulator += RaceSim.STEP
		if sim.surface_accumulator >= RaceSurface.INTERVAL:
			RaceSurface.evolve(sim.surface, sim.rain, sim.surface_accumulator, sim.total_time)
			RaceSurface.profiles(sim.surface, sim.water, sim.rubber); sim.surface_accumulator = 0.0
	if sim.total_time + 0.000001 >= sim.weather_state.next_sample:
		var observed = sim.weather_observation()
		sim.weather_state.history.append(observed)
		if sim.weather_state.history.size() > WeekendWeather.HISTORY_LIMIT: sim.weather_state.history.pop_front()
		sim.weather_state.next_sample = sim.total_time + WeekendWeather.SAMPLE_INTERVAL
		for id in [3, 6]:
			var car = sim.cars[id]
			var issue = sim.weather_issue(id)
			if issue.is_empty(): sim.weather_state.notices[id] = ""; continue
			# Deduplicate by condition family, not every tiny forecast revision.
			var notice = issue + ":" + WeatherOutlook.condition(observed.mean)
			if notice == sim.weather_state.notices[id] or car.dnf or car.finished: continue
			sim.weather_state.notices[id] = notice
			RaceJournal.append(sim.strategy_state, sim, "weather_warning", id, {"reason": issue,
				"observed": observed, "fallback": "Approved plans and current pit ownership remain unchanged."})
			sim.post("radio", car.short + " · " + issue + ". Compare Weather; your current plan remains active.")

func weather_issue(sim: RaceSim, id: int) -> String:
	var c = sim.cars[id]
	if sim.phase != "race" or c.route != "track" or c.dnf or c.finished: return ""
	var observed = sim.weather_observation()
	if c.compound not in ["I", "W"] and observed.peak > 0.30: return "Wet sections on slick tyres"
	if c.compound in ["I", "W"] and observed.mean < 0.15: return "Wet tyres on a drying line"
	if sim.rain >= 0.08 and observed.mean < 0.24: return "Rain arriving; surface crossover uncertain"
	return ""

func command(sim: RaceSim, action: String, payload: Dictionary = {}) -> bool:
	if action not in ["weather_box", "weather_hold"]: return sim.mechanics.before("weather", "command", [action, payload])
	sim.last_error = ""
	if not RaceCheckpoint.integral(payload.get("id"), 0, 11): return sim.fail("Name the weather decision's driver explicitly.")
	var id = int(payload.id); var c = sim.cars[id]
	if not c.player or c.dnf or c.finished or sim.phase != "race" or c.route != "track" or c.pit_order: return sim.fail("Weather decisions require a running Obsidian car without a committed stop.")
	if sim.weather_stale({"driver_id": id, "time": payload.get("time"), "key": payload.get("key"), "weather_key": payload.get("weather_key")}): return sim.fail("Weather or rejoin assumptions changed. Refresh the comparison before committing.")
	var advice = sim.weather_advice(id)
	if action == "weather_hold":
		sim.weather_state.held[id] = WeatherStrategy.decision_key(advice)
		sim.commands.append({"tick": snappedf(sim.total_time, RaceSim.STEP), "action": action, "payload": payload.duplicate(true)})
		RaceJournal.append(sim.strategy_state, sim, "weather_decision", id, {"reason": "Deliberately retained the approved plan; review after another material observation.", "action": "hold", "observed": advice.outlook.observed})
		return true
	if not payload.get("set_id") is String or payload.set_id != advice.replacement_id or advice.replacement_id.is_empty(): return sim.fail("The proposed weather set is no longer the current feasible option.")
	if not RaceCheckpoint.number(payload.get("gate"), 0, 100000000) or absf(payload.gate - advice.gate.distance) > 0.001: return sim.fail("The safe pit gate changed. Review the explicitly deferred entry.")
	var pit_payload = {"id": id, "set_id": payload.set_id, "forecast_key": advice.key, "forecast_time": advice.time, "expected_gate": advice.gate.distance}
	if not sim.mechanics.before("weather", "command", ["pit", pit_payload]): return false
	var option = advice.options[1]
	RaceJournal.append(sim.strategy_state, sim, "weather_decision", id, {"action": "box", "set_id": payload.set_id,
		"reason": "Manual weather crossover call; alternatives were estimates, not promised positions.",
		"observed": advice.outlook.observed, "gain_low": option.get("gain_low", 0), "gain_high": option.get("gain_high", 0),
		"cases": advice.outlook.cases, "model_version": WeatherStrategy.VERSION}, sim.policy(id).last_order_id)
	return true

func engineer(sim: RaceSim, c: Dictionary) -> void:
	# Binding plans, manual ownership, tyre emergencies and damage recovery still use Stage A's transaction rules.
	var p = sim.policy(int(c.id))
	if sim.weather_state.is_empty() or sim.weather_state.model.mode == "scripted_training" or sim.phase != "race" or c.route != "track" or c.dnf or c.finished or not p.plan.is_empty() or not StrategyPlan.owns(p, "pit") or c.pit_order or c.tyre < 18 or c.damage > 24 or not WheelTyres.usable(TyreInventory.find(c, c.set_id)):
		sim.mechanics.before("weather", "engineer", [c]); return
	if sim.rain < 0.08 and sim.average(sim.water) < 0.10 and c.compound not in ["I", "W"]:
		sim.mechanics.before("weather", "engineer", [c]); return
	sim.manage_resources(c)
	if sim.total_time < sim.weather_state.reviews[int(c.id)]: return
	sim.weather_state.reviews[int(c.id)] = sim.total_time + 15.0 + float(c.id % 4)
	var advice = sim.weather_advice(int(c.id))
	if sim.weather_state.held[int(c.id)] == WeatherStrategy.decision_key(advice): return
	if advice.options.size() < 2: return
	var option = advice.options[1]
	if not option.available or not option.has("gain_low") or option.risk == "high": return
	var nominal = advice.options[0].seconds - option.seconds
	var worthwhile = option.gain_low > 2 or nominal > maxf(4, advice.pit.loss * 0.25) and option.gain_low > -advice.pit.loss * 0.5
	if not worthwhile or TeamOrders.defer_stop(sim, c): return
	var item = TyreInventory.find(c, advice.replacement_id)
	if not WheelTyres.usable(item): return
	sim.order_stop(c, item, "Observed weather crossover; estimated case gain %.0f to %.0fs, duration uncertain" % [option.gain_low, option.gain_high])
	RaceJournal.append(sim.strategy_state, sim, "weather_decision", int(c.id), {"action": "delegated_box", "set_id": item.id,
		"reason": "Same public weather comparison used by every team; no future targets available.",
		"observed": advice.outlook.observed, "gain_low": option.gain_low, "gain_high": option.gain_high,
		"cases": advice.outlook.cases, "model_version": WeatherStrategy.VERSION}, p.last_order_id)

func snapshot(sim: RaceSim) -> Dictionary:
	var data = sim.mechanics.before("weather", "snapshot", []); data.version = CHECKPOINT_VERSION
	data.weather_state = sim.weather_state.duplicate(true)
	return data

func weather_debrief(sim: RaceSim) -> String:
	var lines: Array[String] = []
	for record in sim.strategy_state.records:
		if record.kind != "weather_decision" or record.driver_id not in [3, 6]: continue
		var evidence = record.evidence
		var line = "%s · %.0fs · %s\nObserved rain %.0f%%; measured line water %.0f%%. %s" % [sim.cars[int(record.driver_id)].short, record.time, evidence.action.replace("_", " "), evidence.observed.rain * 100, evidence.observed.mean * 100, evidence.reason]
		if evidence.has("gain_low"): line += "\nAt-call estimated gain %.0f to %.0fs across stress cases, not a measured alternative result. See the measured pit visit below." % [evidence.gain_low, evidence.gain_high]
		lines.append(line)
	return "Weather decision evidence\n\n" + ("No weather decisions recorded." if lines.is_empty() else "\n\n".join(lines.slice(maxi(0, lines.size() - 6))))
