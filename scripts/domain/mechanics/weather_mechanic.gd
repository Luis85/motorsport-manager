class_name WeatherMechanic
extends "res://scripts/domain/mechanics/weather_observations.gd"


func definition() -> Dictionary:
	return {
		"id": "weather",
		"version": 1,
		"requires": ["strategy"],
		"hooks":
		[
			"weather_observation",
			"weather_outlook",
			"weather_advice",
			"weather_stale",
			"update_surface",
			"weather_issue",
			"command",
			"engineer",
			"snapshot",
			"weather_debrief"
		]
	}


func install(sim: RaceSim, geometry: TrackGeometry = null, options: Dictionary = {}) -> void:
	if geometry == null:
		return
	var mode = options.get("weather_mode", "seeded")
	if mode not in WeekendWeather.MODES:
		mode = "seeded"
	sim.weather_state = WeatherRaceSim.new_weather_state(
		sim.seed_value, sim.scenario, mode, sim.cars.size(), sim.tuning.environment.weather
	)
	if mode == "seeded":
		sim.rain = sim.weather_state.model.rain
	else:
		sim.weather_state.model.rain = sim.rain
	sim.weather_state.history.append(sim.weather_observation())
	sim.weather_state.next_sample = sim.total_time + WeekendWeather.SAMPLE_INTERVAL
	RaceJournal.append(
		sim.strategy_state,
		sim,
		"weather_model",
		-1,
		{
			"mode": mode,
			"version": WeekendWeather.VERSION,
			"reason":
			(
				"Seeded weather; public forecasts cannot read future targets."
				if mode == "seeded"
				else "Explicit scripted training weather; original schedule preserved."
			)
		}
	)


func command(sim: RaceSim, action: String, payload: Dictionary = {}) -> bool:
	if action not in ["weather_box", "weather_hold"]:
		return sim.mechanics.before("weather", "command", [action, payload])
	sim.last_error = ""
	if not RaceCheckpoint.integral(payload.get("id"), 0, sim.cars.size() - 1):
		return sim.fail("Name the weather decision's driver explicitly.")
	var id = int(payload.id)
	var c = sim.cars[id]
	if (
		not c.player
		or c.dnf
		or c.finished
		or sim.phase != "race"
		or c.route != "track"
		or c.pit_order
	):
		return (
			sim
			. fail(
				(
					"Weather decisions require a running Obsidian car without a committed stop."
					if sim.roster_definition == null
					else "Weather decisions require a running car from your team without a committed stop."
				)
			)
		)
	if sim.weather_stale(
		{
			"driver_id": id,
			"time": payload.get("time"),
			"key": payload.get("key"),
			"weather_key": payload.get("weather_key")
		}
	):
		return sim.fail(
			"Weather or rejoin assumptions changed. Refresh the comparison before committing."
		)
	return _weather_decision(sim, action, payload, id)


func engineer(sim: RaceSim, c: RaceCar) -> void:
	# Binding plans, manual ownership, tyre emergencies and damage recovery still use Stage A's transaction rules.
	var p = sim.policy(int(c.id))
	if (
		sim.weather_state.is_empty()
		or sim.weather_state.model.mode == "scripted_training"
		or sim.phase != "race"
		or c.route != "track"
		or c.dnf
		or c.finished
		or not p.plan.is_empty()
		or not StrategyPlan.owns(p, "pit")
		or c.pit_order
		or c.tyre < sim.tuning.environment.weather_policy.fallback_tread
		or c.damage > sim.tuning.environment.weather_policy.fallback_damage
		or not WheelTyres.usable(TyreInventory.find(c, c.set_id))
	):
		sim.mechanics.before("weather", "engineer", [c])
		return
	if (
		sim.rain < sim.tuning.environment.outlook.rain_visible
		and sim.average(sim.water) < sim.tuning.environment.weather_policy.dry_fallback_water
		and not c.tyre_rules.wet(c.compound)
	):
		sim.mechanics.before("weather", "engineer", [c])
		return
	sim.manage_resources(c)
	if sim.total_time < sim.weather_state.reviews[int(c.id)]:
		return
	sim.weather_state.reviews[int(c.id)] = (
		sim.total_time + sim.tuning.environment.weather_policy.review_seconds + float(c.id % 4)
	)
	_review_weather_stop(sim, c, p)


func snapshot(sim: RaceSim) -> Dictionary:
	var data = sim.mechanics.before("weather", "snapshot", [])
	data.version = CHECKPOINT_VERSION
	data.weather_state = sim.weather_state.duplicate(true)
	return data


func _weather_decision(sim: RaceSim, action: String, payload: Dictionary, id: int) -> bool:
	var advice = sim.weather_advice(id)
	if action == "weather_hold":
		sim.weather_state.held[id] = WeatherStrategy.decision_key(advice)
		sim.commands.append(
			{
				"tick": snappedf(sim.total_time, RaceSim.STEP),
				"action": action,
				"payload": payload.duplicate(true)
			}
		)
		(
			RaceJournal
			. append(
				sim.strategy_state,
				sim,
				"weather_decision",
				id,
				{
					"reason":
					"Deliberately retained the approved plan; review after another material observation.",
					"action": "hold",
					"observed": advice.outlook.observed
				}
			)
		)
		return true
	if (
		not payload.get("set_id") is String
		or payload.set_id != advice.replacement_id
		or advice.replacement_id.is_empty()
	):
		return sim.fail("The proposed weather set is no longer the current feasible option.")
	if (
		not RaceCheckpoint.number(payload.get("gate"), 0, 100000000)
		or absf(payload.gate - advice.gate.distance) > 0.001
	):
		return sim.fail("The safe pit gate changed. Review the explicitly deferred entry.")
	var pit_payload = {
		"id": id,
		"set_id": payload.set_id,
		"forecast_key": advice.key,
		"forecast_time": advice.time,
		"expected_gate": advice.gate.distance
	}
	if not sim.mechanics.before("weather", "command", ["pit", pit_payload]):
		return false
	var option = advice.options[1]
	RaceJournal.append(
		sim.strategy_state,
		sim,
		"weather_decision",
		id,
		{
			"action": "box",
			"set_id": payload.set_id,
			"reason":
			"Manual weather crossover call; alternatives were estimates, not promised positions.",
			"observed": advice.outlook.observed,
			"gain_low": option.get("gain_low", 0),
			"gain_high": option.get("gain_high", 0),
			"cases": advice.outlook.cases,
			"model_version": WeatherStrategy.VERSION
		},
		sim.policy(id).last_order_id
	)
	return true


func _review_weather_stop(sim: RaceSim, c: RaceCar, p: Dictionary) -> void:
	var advice = sim.weather_advice(int(c.id))
	if sim.weather_state.held[int(c.id)] == WeatherStrategy.decision_key(advice):
		return
	if advice.options.size() < 2:
		return
	var option = advice.options[1]
	if not option.available or not option.has("gain_low") or option.risk == "high":
		return
	var nominal = advice.options[0].seconds - option.seconds
	var worthwhile = (
		option.gain_low > sim.tuning.environment.weather_policy.minimum_case_gain_seconds
		or (
			(
				nominal
				> maxf(
					sim.tuning.environment.weather_policy.nominal_gain_seconds,
					advice.pit.loss * sim.tuning.environment.weather_policy.nominal_pit_loss_factor
				)
			)
			and (
				option.gain_low
				> -advice.pit.loss * sim.tuning.environment.weather_policy.maximum_case_loss_factor
			)
		)
	)
	if not worthwhile or TeamOrders.defer_stop(sim, c):
		return
	var item = TyreInventory.find(c, advice.replacement_id)
	if not WheelTyres.usable(item):
		return
	sim.order_stop(
		c,
		item,
		(
			"Observed weather crossover; estimated case gain %.0f to %.0fs, duration uncertain"
			% [option.gain_low, option.gain_high]
		)
	)
	RaceJournal.append(
		sim.strategy_state,
		sim,
		"weather_decision",
		int(c.id),
		{
			"action": "delegated_box",
			"set_id": item.id,
			"reason":
			"Same public weather comparison used by every team; no future targets available.",
			"observed": advice.outlook.observed,
			"gain_low": option.gain_low,
			"gain_high": option.gain_high,
			"cases": advice.outlook.cases,
			"model_version": WeatherStrategy.VERSION
		},
		p.last_order_id
	)
