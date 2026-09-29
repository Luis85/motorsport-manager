class_name RaceVehicleCondition
extends RefCounted
## Four-wheel wear, fuel consumption and aggregate thermal/condition integration in fixed simulation steps.
## Invoke cross-system work through the aggregate so inherited rule-set hooks remain active.

static func wear_car(sim: RaceSim, car: RaceCar, distance: float, cell: int, effects: Dictionary = {}, local: Dictionary = {}) -> void:
	if local.is_empty():
		local = sim.surface_at(car)
	var fraction = distance / sim.track.length
	var effort = 0.55 if sim.phase == "formation" else (1.25 if car.pace == 2 else (0.78 if car.pace == 0 else 1.0))
	var spec = car.tyre_rules.spec(car.compound)
	var mismatch = spec.thermal.wet_dry_wear_multiplier if car.tyre_rules.wet(car.compound) and local.water < spec.thermal.wet_dry_water_threshold else 1.0
	var item = TyreInventory.find(car, car.set_id)
	var curve = sim.track.sample(car.distance).curvature if car.route == "track" else 0.0
	if effects.is_empty():
		effects = CarSetup.effects(car, local.water)
	WheelTyres.update(item, {"speed": car.speed, "curve": curve, "bias": car.car_setup.bias / 100.0, "brake": car.braking, "throttle": car.throttle, "slip": absf(effects.balance), "water": local.water, "push": effort, "neutral": sim.neutral(car), "care": car.consistency, "wear": spec.wear * fraction * effort * mismatch, "lap": fraction}, RaceSim.STEP, spec)
	car.tyre = item.life
	car.temperature = item.temperature
	var engine_target = 91 + car.engine * 8 - (car.car_setup.cooling - 5) * 3 + car.throttle * 12 - local.water * 8
	car.engine_temperature = lerpf(car.engine_temperature, engine_target, 1 - exp(-RaceSim.STEP * 0.035))
	car.brake_temperature = lerpf(car.brake_temperature, 100 + car.braking * 680 + car.speed * 0.6, 1 - exp(-RaceSim.STEP * 0.09))
	if sim.phase == "race" and not sim.neutral(car) and sim.total_time >= car.tyre_event_clock:
		car.tyre_event_clock = sim.total_time + 2.0
		sim.check_tyre_incident(car)
	var fuel_rate = 0.60 if sim.phase == "formation" or sim.is_run_session() and car.qual_state != "hotlap" else ([0.84, 1.0, 1.14][car.engine])
	car.fuel = maxf(0, car.fuel - fraction * fuel_rate)
	car.health = maxf(0, car.health - fraction * (0.4 if car.engine < 2 else 0.65) * (1 + maxf(0, car.engine_temperature - 112) * 0.04))
	TyreInventory.sync(car)
	if car.fuel <= 0.00001 and sim.phase == "race":
		sim.retire(car, "Out of fuel")
