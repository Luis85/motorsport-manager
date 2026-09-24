class_name WeatherRaceSim
extends StrategyRaceSim
## Stage C extension. Old saves retain their scripted training weather; new weekends use seeded evolution.
const CHECKPOINT_VERSION = 7
var weather_state: Dictionary = {}

func _init(geometry: TrackGeometry = null, options: Dictionary = {}) -> void:
	super(geometry, options)
	if geometry == null: return
	var mode = options.get("weather_mode", "seeded")
	if mode not in WeekendWeather.MODES: mode = "seeded"
	weather_state = new_weather_state(seed_value, scenario, mode)
	if mode == "seeded": rain = weather_state.model.rain
	else: weather_state.model.rain = rain
	weather_state.history.append(weather_observation())
	weather_state.next_sample = total_time + WeekendWeather.SAMPLE_INTERVAL
	RaceJournal.append(strategy_state, self, "weather_model", -1, {"mode": mode, "version": WeekendWeather.VERSION,
		"reason": "Seeded weather; public forecasts cannot read future targets." if mode == "seeded" else "Explicit scripted training weather; original schedule preserved."})

static func new_weather_state(seed: int, scenario_name: String, mode: String) -> Dictionary:
	var notices: Array = []; var held: Array = []; var reviews: Array = []
	for i in range(12): notices.append(""); held.append(""); reviews.append(0.0)
	return {"version": 1, "model": WeekendWeather.create(seed, scenario_name, mode), "history": [],
		"next_sample": 0.0, "notices": notices, "held": held, "reviews": reviews}

func weather_observation() -> Dictionary:
	var cloud = weather_state.model.cloud if not weather_state.is_empty() and weather_state.model.mode == "seeded" else -1.0
	return WeekendWeather.observe(surface, rain, cloud, total_time)

func weather_outlook() -> Dictionary:
	return WeatherOutlook.evaluate(weather_state.history, weather_observation(), track.estimate, weather_state.model.mode)

func weather_advice(id: int) -> Dictionary:
	if id < 0 or id >= cars.size(): return {}
	return WeatherStrategy.evaluate(RaceForecaster.capture(self, id, active_plan(id), int(policy(id).revision)), weather_outlook())

func weather_stale(advice: Dictionary) -> bool:
	if advice.is_empty() or not RaceCheckpoint.integral(advice.get("driver_id"), 0, 11): return true
	var id = int(advice.driver_id)
	return not RaceCheckpoint.number(advice.get("time"), 0, total_time) or total_time - advice.time > RaceForecaster.MAX_AGE or advice.get("key") != RaceForecaster.material_key(self, id, int(policy(id).revision)) or advice.get("weather_key") != WeatherOutlook.signature(weather_observation())

func update_surface() -> void:
	if weather_state.is_empty(): super.update_surface(); return
	if weather_state.model.mode == "scripted_training":
		super.update_surface()
		weather_state.model.rain = rain
	else:
		WeekendWeather.advance(weather_state.model, scenario, STEP)
		rain = weather_state.model.rain
		var description = "Heavy rain" if rain >= 0.60 else ("Rain" if rain >= 0.08 else "No rain observed")
		if description != weather_name:
			weather_name = description; post("weather", description + ". Surface water changes gradually.")
		surface_accumulator += STEP
		if surface_accumulator >= RaceSurface.INTERVAL:
			RaceSurface.evolve(surface, rain, surface_accumulator, total_time)
			RaceSurface.profiles(surface, water, rubber); surface_accumulator = 0.0
	if total_time + 0.000001 >= weather_state.next_sample:
		var observed = weather_observation()
		weather_state.history.append(observed)
		if weather_state.history.size() > WeekendWeather.HISTORY_LIMIT: weather_state.history.pop_front()
		weather_state.next_sample = total_time + WeekendWeather.SAMPLE_INTERVAL
		for id in [3, 6]:
			var car = cars[id]
			var issue = weather_issue(id)
			if issue.is_empty(): weather_state.notices[id] = ""; continue
			# Deduplicate by condition family, not every tiny forecast revision.
			var notice = issue + ":" + WeatherOutlook.condition(observed.mean)
			if notice == weather_state.notices[id] or car.dnf or car.finished: continue
			weather_state.notices[id] = notice
			RaceJournal.append(strategy_state, self, "weather_warning", id, {"reason": issue,
				"observed": observed, "fallback": "Approved plans and current pit ownership remain unchanged."})
			post("radio", car.short + " · " + issue + ". Compare Weather; your current plan remains active.")

func weather_issue(id: int) -> String:
	var c = cars[id]
	if phase != "race" or c.route != "track" or c.dnf or c.finished: return ""
	var observed = weather_observation()
	if c.compound not in ["I", "W"] and observed.peak > 0.30: return "Wet sections on slick tyres"
	if c.compound in ["I", "W"] and observed.mean < 0.15: return "Wet tyres on a drying line"
	if rain >= 0.08 and observed.mean < 0.24: return "Rain arriving; surface crossover uncertain"
	return ""

func command(action: String, payload: Dictionary = {}) -> bool:
	if action not in ["weather_box", "weather_hold"]: return super.command(action, payload)
	last_error = ""
	if not RaceCheckpoint.integral(payload.get("id"), 0, 11): return fail("Name the weather decision's driver explicitly.")
	var id = int(payload.id); var c = cars[id]
	if not c.player or c.dnf or c.finished or phase != "race" or c.route != "track" or c.pit_order: return fail("Weather decisions require a running Obsidian car without a committed stop.")
	if weather_stale({"driver_id": id, "time": payload.get("time"), "key": payload.get("key"), "weather_key": payload.get("weather_key")}): return fail("Weather or rejoin assumptions changed. Refresh the comparison before committing.")
	var advice = weather_advice(id)
	if action == "weather_hold":
		weather_state.held[id] = WeatherStrategy.decision_key(advice)
		commands.append({"tick": snappedf(total_time, STEP), "action": action, "payload": payload.duplicate(true)})
		RaceJournal.append(strategy_state, self, "weather_decision", id, {"reason": "Deliberately retained the approved plan; review after another material observation.", "action": "hold", "observed": advice.outlook.observed})
		return true
	if not payload.get("set_id") is String or payload.set_id != advice.replacement_id or advice.replacement_id.is_empty(): return fail("The proposed weather set is no longer the current feasible option.")
	if not RaceCheckpoint.number(payload.get("gate"), 0, 100000000) or absf(payload.gate - advice.gate.distance) > 0.001: return fail("The safe pit gate changed. Review the explicitly deferred entry.")
	var pit_payload = {"id": id, "set_id": payload.set_id, "forecast_key": advice.key, "forecast_time": advice.time, "expected_gate": advice.gate.distance}
	if not super.command("pit", pit_payload): return false
	var option = advice.options[1]
	RaceJournal.append(strategy_state, self, "weather_decision", id, {"action": "box", "set_id": payload.set_id,
		"reason": "Manual weather crossover call; alternatives were estimates, not promised positions.",
		"observed": advice.outlook.observed, "gain_low": option.get("gain_low", 0), "gain_high": option.get("gain_high", 0),
		"cases": advice.outlook.cases, "model_version": WeatherStrategy.VERSION}, policy(id).last_order_id)
	return true

func engineer(c: Dictionary) -> void:
	# Binding plans, manual ownership, tyre emergencies and damage recovery still use Stage A's transaction rules.
	var p = policy(int(c.id))
	if weather_state.is_empty() or weather_state.model.mode == "scripted_training" or phase != "race" or c.route != "track" or c.dnf or c.finished or not p.plan.is_empty() or not StrategyPlan.owns(p, "pit") or c.pit_order or c.tyre < 18 or c.damage > 24 or not WheelTyres.usable(TyreInventory.find(c, c.set_id)):
		super.engineer(c); return
	if rain < 0.08 and average(water) < 0.10 and c.compound not in ["I", "W"]:
		super.engineer(c); return
	manage_resources(c)
	if total_time < weather_state.reviews[int(c.id)]: return
	weather_state.reviews[int(c.id)] = total_time + 15.0 + float(c.id % 4)
	var advice = weather_advice(int(c.id))
	if weather_state.held[int(c.id)] == WeatherStrategy.decision_key(advice): return
	if advice.options.size() < 2: return
	var option = advice.options[1]
	if not option.available or not option.has("gain_low") or option.risk == "high": return
	var nominal = advice.options[0].seconds - option.seconds
	var worthwhile = option.gain_low > 2 or nominal > maxf(4, advice.pit.loss * 0.25) and option.gain_low > -advice.pit.loss * 0.5
	if not worthwhile or TeamOrders.defer_stop(self, c): return
	var item = TyreInventory.find(c, advice.replacement_id)
	if not WheelTyres.usable(item): return
	order_stop(c, item, "Observed weather crossover; estimated case gain %.0f to %.0fs, duration uncertain" % [option.gain_low, option.gain_high])
	RaceJournal.append(strategy_state, self, "weather_decision", int(c.id), {"action": "delegated_box", "set_id": item.id,
		"reason": "Same public weather comparison used by every team; no future targets available.",
		"observed": advice.outlook.observed, "gain_low": option.gain_low, "gain_high": option.gain_high,
		"cases": advice.outlook.cases, "model_version": WeatherStrategy.VERSION}, p.last_order_id)

func snapshot() -> Dictionary:
	var data = super.snapshot(); data.version = CHECKPOINT_VERSION
	data.weather_state = weather_state.duplicate(true)
	return data

static func valid_weather(state: Variant, now: float, current_rain: float) -> bool:
	if not state is Dictionary or state.get("version") != 1 or not WeekendWeather.valid(state.get("model")): return false
	if absf(state.model.rain - current_rain) > 0.00001: return false
	if not state.get("history") is Array or state.history.size() > WeekendWeather.HISTORY_LIMIT: return false
	var previous = -1.0
	for observation in state.history:
		if not WeekendWeather.observation_valid(observation, now) or observation.time <= previous: return false
		previous = observation.time
	if not RaceCheckpoint.number(state.get("next_sample"), maxf(0, previous), now + WeekendWeather.SAMPLE_INTERVAL + 0.0001): return false
	for key in ["notices", "held", "reviews"]:
		if not state.get(key) is Array or state[key].size() != 12: return false
	for i in range(12):
		if not state.notices[i] is String or state.notices[i].length() > 256 or not state.held[i] is String or state.held[i].length() > 64: return false
		if not RaceCheckpoint.number(state.reviews[i], 0, now + 19): return false
	return true

static func valid_weather_records(records: Array, entrants: Array) -> bool:
	for record in records:
		if record.kind not in ["weather_model", "weather_warning", "weather_decision"]: continue
		var e = record.evidence
		if not e.get("reason") is String: return false
		if record.kind == "weather_model":
			if e.get("mode") not in WeekendWeather.MODES or e.get("version") != WeekendWeather.VERSION: return false
			continue
		if not WeekendWeather.observation_valid(e.get("observed"), record.time): return false
		if record.kind == "weather_warning":
			if not e.get("fallback") is String: return false
			continue
		if record.driver_id < 0 or e.get("action") not in ["hold", "box", "delegated_box"]: return false
		if e.action == "hold": continue
		if not e.get("set_id") is String or TyreInventory.find(entrants[int(record.driver_id)], e.set_id).is_empty(): return false
		if not RaceCheckpoint.number(e.get("gain_low"), -100000000, 100000000) or not RaceCheckpoint.number(e.get("gain_high"), e.gain_low, 100000000): return false
		if not e.get("cases") is Array or e.cases.size() != 3 or e.get("model_version") != WeatherStrategy.VERSION: return false
		for item in e.cases:
			if not item is Dictionary or not item.get("name") is String or not RaceCheckpoint.number(item.get("water"), 0, 1): return false
	return true

static func restore_weather(data: Dictionary) -> WeatherRaceSim:
	if not RaceCheckpoint.integral(data.get("version"), 1, CHECKPOINT_VERSION): return null
	var native = int(data.version) == CHECKPOINT_VERSION
	var legacy = data.duplicate(true)
	if native: legacy.version = 6; legacy.erase("weather_state")
	var base = StrategyRaceSim.restore_weekend(legacy)
	if base == null or not valid_weather_records(base.strategy_state.records, base.cars): return null
	var state: Dictionary
	if native:
		if not valid_weather(data.get("weather_state"), base.total_time, base.rain): return null
		state = data.weather_state.duplicate(true)
	else:
		# Migration must not alter the already running weather schedule or invent old observations.
		state = new_weather_state(base.seed_value, base.scenario, "scripted_training")
		state.model.rain = base.rain; state.next_sample = base.total_time + WeekendWeather.SAMPLE_INTERVAL
	var restored = WeatherRaceSim.new(base.track)
	for key in base.snapshot():
		if key not in ["kind", "version", "track", "vehicle"]: restored.set(key, base.get(key))
	restored.weather_state = state
	restored.weather_state.model.rng = int(state.model.rng)
	return restored

func weather_debrief() -> String:
	var lines: Array[String] = []
	for record in strategy_state.records:
		if record.kind != "weather_decision" or record.driver_id not in [3, 6]: continue
		var evidence = record.evidence
		var line = "%s · %.0fs · %s\nObserved rain %.0f%%; measured line water %.0f%%. %s" % [cars[int(record.driver_id)].short, record.time, evidence.action.replace("_", " "), evidence.observed.rain * 100, evidence.observed.mean * 100, evidence.reason]
		if evidence.has("gain_low"): line += "\nAt-call estimated gain %.0f to %.0fs across stress cases, not a measured alternative result. See the measured pit visit below." % [evidence.gain_low, evidence.gain_high]
		lines.append(line)
	return "Weather decision evidence\n\n" + ("No weather decisions recorded." if lines.is_empty() else "\n\n".join(lines.slice(maxi(0, lines.size() - 6))))
