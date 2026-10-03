class_name MinimalDriverReadout
extends RefCounted
## Observational player-car data only. Never synchronizes, mounts or repairs a set.
const COMPOUNDS = {"S": "Soft", "M": "Medium", "H": "Hard", "I": "Inter", "W": "Wet"}


static func capture(sim: RaceSim, id: int) -> Dictionary:
	if id < 0 or id >= sim.cars.size() or not sim.cars[id].player:
		return {}
	var car = sim.cars[id]
	var presentation: Dictionary = sim.tuning.balance.presentation
	var fitted = TyreInventory.find(car, car.set_id)
	var punctured = false
	var wheels: Array = []
	var puncture_count = 0
	var tyre = "Unavailable"
	var detail = "No fitted-set data"
	var life = -1.0
	var issue = false
	if not fitted.is_empty() and fitted.get("wheels", {}).size() == 4:
		life = 100.0
		var limiting = "FL"
		var punctures: Array[String] = []
		for key in WheelTyres.KEYS:
			var wheel = fitted.wheels[key]
			wheels.append(
				{"key": key, "life": float(wheel.life), "punctured": bool(wheel.punctured)}
			)
			if wheel.life < life:
				life = wheel.life
				limiting = key
			if wheel.punctured:
				punctures.append(key)
		life = clampf(life, 0, 100)
		tyre = (
			"%s · %.0f%%"
			% [car.tyre_rules.spec(fitted.compound).get("name", "Tyres"), floorf(life)]
		)
		detail = "%s · %.0f°C avg" % [fitted.label, WheelTyres.average(fitted, "surface")]
		puncture_count = punctures.size()
		punctured = not punctures.is_empty()
		if punctured:
			detail = "Puncture · " + ", ".join(punctures)
			issue = true
		elif life <= presentation.low_tread_percent:
			detail = "Low tread · " + limiting
			issue = true
	var fuel = maxf(0, float(car.fuel))
	var fuel_detail = "Lap-equivalent units"
	var fuel_issue = false
	if sim.phase == "race" and not car.dnf and not car.finished:
		var remaining = maxf(0, sim.laps - maxf(0, car.distance) / sim.track.length)
		var margin = fuel - remaining * sim.tuning.fuel.engine_rates[car.engine]
		fuel_detail = "~%+.1f to finish" % margin
		fuel_issue = margin < 0
	elif car.finished or car.dnf:
		fuel_detail = "Remaining at finish" if car.finished else "Remaining at retirement"
	var health = clampf(car.health, 0, 100)
	var damage = clampf(car.damage, 0, 100)
	var stress = MinimalDriverContext.stress(sim, car, life, punctured)
	var lap = MinimalDriverContext.lap_context(sim, car)
	var tyre_value = "%d%%" % floori(life) if life >= 0 else "—"
	var tyre_title = (
		str(car.tyre_rules.spec(fitted.get("compound", "")).get("name", "Tyres")).to_upper()
		+ " · MIN"
	)
	var fuel_note = (
		fuel_detail
		. replace("Lap-equivalent units", "Lap equiv.")
		. replace("Remaining at finish", "At finish")
		. replace("Remaining at retirement", "At retirement")
	)
	return {
		"id": id,
		"name": car.name,
		"short": car.short,
		"number": car.number,
		"state": MinimalRaceTiming.state(sim, car),
		"tyre": tyre,
		"tyre_detail": detail,
		"tyre_life": life,
		"tyre_issue": issue,
		"set_id": car.set_id,
		"fuel": "%.1f laps" % fuel,
		"fuel_detail": fuel_detail,
		"fuel_issue": fuel_issue,
		"health": "%.0f%%" % floorf(health),
		"health_value": health,
		"car_detail": "Damage %.0f%%" % ceilf(damage) if damage > 0 else "No damage",
		"car_issue": health < sim.tuning.condition.health_reference or damage > 0,
		"retire_reason": car.retire_reason if car.dnf else "",
		"color": car.color,
		"tyre_title": tyre_title,
		"wheels": wheels,
		"tyre_note":
		(
			"%d punctures" % puncture_count
			if puncture_count > 1
			else (detail if life >= 0 else "No data")
		),
		"tyre_value": tyre_value,
		"compound": car.tyre_rules.spec(fitted.get("compound", "")).get("short", "?"),
		"fuel_note": fuel_note,
		"stress": stress,
		"lap": lap,
		"context": MinimalDriverContext.race_context(sim, car),
		"orders":
		(
			"%s · %s"
			% [["Calm", "Normal", "Push"][car.pace], ["Save", "Standard", "Power"][car.engine]]
		),
		"engine_temp": "Engine %.0f°C" % car.engine_temperature,
		"engine_hot": car.engine_temperature > sim.tuning.condition.heat_reference_c,
		"speed": "%.0f km/h" % (maxf(0, car.speed) * 3.6),
		"stops": car.pit_stops
	}
