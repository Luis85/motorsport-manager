class_name MinimalDriverReadout
extends RefCounted
## Observational player-car data only. Never synchronizes, mounts or repairs a set.
const COMPOUNDS = {"S":"Soft", "M":"Medium", "H":"Hard", "I":"Inter", "W":"Wet"}

static func capture(sim: PracticeRaceSim, id: int) -> Dictionary:
	if id < 0 or id >= sim.cars.size() or not sim.cars[id].player: return {}
	var car = sim.cars[id]; var fitted = TyreInventory.find(car, car.get("set_id", ""))
	var tyre = "Unavailable"; var detail = "No fitted-set data"; var life = -1.0; var issue = false
	if not fitted.is_empty() and fitted.get("wheels", {}).size() == 4:
		life = 100.0; var limiting = "FL"; var punctures: Array[String] = []
		for key in WheelTyres.KEYS:
			var wheel = fitted.wheels[key]
			if wheel.life < life: life = wheel.life; limiting = key
			if wheel.punctured: punctures.append(key)
		life = clampf(life, 0, 100)
		tyre = "%s · %.0f%%" % [COMPOUNDS.get(fitted.compound, fitted.compound), floorf(life)]
		detail = "%s · %.0f°C avg" % [fitted.label, WheelTyres.average(fitted, "surface")]
		if not punctures.is_empty(): detail = "Puncture · " + ", ".join(punctures); issue = true
		elif life <= 25: detail = "Low tread · " + limiting; issue = true
	var fuel = maxf(0, float(car.fuel))
	var fuel_detail = "Lap-equivalent units"; var fuel_issue = false
	if sim.phase == "race" and not car.dnf and not car.finished:
		var remaining = maxf(0, sim.laps - maxf(0, car.distance) / sim.track.length)
		var margin = fuel - remaining * [0.84, 1.0, 1.14][car.engine]
		fuel_detail = "~%+.1f to finish" % margin; fuel_issue = margin < 0
	elif car.finished or car.dnf: fuel_detail = "Remaining at finish" if car.finished else "Remaining at retirement"
	var health = clampf(car.health, 0, 100); var damage = clampf(car.damage, 0, 100)
	return {"id":id, "name":car.name, "short":car.short, "number":car.number, "state":MinimalRaceTiming.state(sim, car),
		"tyre":tyre, "tyre_detail":detail, "tyre_life":life, "tyre_issue":issue, "set_id":car.get("set_id", ""),
		"fuel":"%.1f laps" % fuel, "fuel_detail":fuel_detail, "fuel_issue":fuel_issue,
		"health":"%.0f%%" % floorf(health), "health_value":health,
		"car_detail":"Damage %.0f%%" % ceilf(damage) if damage > 0 else "No damage", "car_issue":health < 65 or damage > 0,
		"retire_reason":car.retire_reason if car.dnf else ""}
