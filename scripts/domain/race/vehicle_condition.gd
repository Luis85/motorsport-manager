class_name RaceVehicleCondition
extends RefCounted
## Four-wheel wear, fuel consumption and aggregate thermal/condition integration in fixed simulation steps.
## Invoke cross-system work through the aggregate so inherited rule-set hooks remain active.


static func wear_car(
	sim: RaceSimPort,
	car: RaceCar,
	distance: float,
	_cell: int,
	effects: Dictionary = {},
	local: Dictionary = {}
) -> void:
	if local.is_empty():
		local = sim.surface_at(car)
	var fraction = distance / sim.track.length
	var tuning = sim.tuning
	var effort = (
		tuning.pace.formation_wear if sim.phase == "formation" else tuning.pace.wear_modes[car.pace]
	)
	var spec = car.tyre_rules.spec(car.compound)
	var mismatch = (
		spec.thermal.wet_dry_wear_multiplier
		if car.tyre_rules.wet(car.compound) and local.water < spec.thermal.wet_dry_water_threshold
		else 1.0
	)
	var item = TyreInventory.find(car, car.set_id)
	var curve = sim.track.sample(car.distance).curvature if car.route == "track" else 0.0
	if effects.is_empty():
		effects = CarSetup.effects(car, local.water)
	WheelTyres.update(
		item,
		{
			"speed": car.speed,
			"curve": curve,
			"bias": car.car_setup.bias / 100.0,
			"brake": car.braking,
			"throttle": car.throttle,
			"slip": absf(effects.balance),
			"water": local.water,
			"push": effort,
			"neutral": sim.neutral(car),
			"care": car.consistency,
			"wear": spec.wear * fraction * effort * mismatch,
			"lap": fraction
		},
		RaceSimPort.STEP,
		spec
	)
	car.tyre = item.life
	car.temperature = item.temperature
	var engine_target = (
		tuning.condition.engine_base_c
		+ car.engine * tuning.condition.engine_mode_c
		- (car.car_setup.cooling - tuning.condition.cooling_reference) * tuning.condition.cooling_c
		+ car.throttle * tuning.condition.throttle_c
		- local.water * tuning.condition.water_c
	)
	car.engine_temperature = lerpf(
		car.engine_temperature,
		engine_target,
		1 - exp(-RaceSimPort.STEP * tuning.condition.engine_response_per_second)
	)
	car.brake_temperature = lerpf(
		car.brake_temperature,
		(
			tuning.condition.brake_base_c
			+ car.braking * tuning.condition.braking_c
			+ car.speed * tuning.condition.brake_speed_c_per_mps
		),
		1 - exp(-RaceSimPort.STEP * tuning.condition.brake_response_per_second)
	)
	if sim.phase == "race" and not sim.neutral(car) and sim.total_time >= car.tyre_event_clock:
		car.tyre_event_clock = sim.total_time + tuning.balance.tyre_incidents.check_interval_seconds
		sim.check_tyre_incident(car)
	var fuel_rate = (
		tuning.fuel.reduced_rate
		if sim.phase == "formation" or sim.is_run_session() and car.qual_state != "hotlap"
		else tuning.fuel.engine_rates[car.engine]
	)
	car.fuel = maxf(0, car.fuel - fraction * fuel_rate)
	car.health = maxf(
		0,
		(
			car.health
			- (
				fraction
				* (
					tuning.condition.health_wear_normal
					if car.engine < 2
					else tuning.condition.health_wear_attack
				)
				* (
					1
					+ (
						maxf(0, car.engine_temperature - tuning.condition.wear_heat_reference_c)
						* tuning.condition.wear_heat_factor
					)
				)
			)
		)
	)
	TyreInventory.sync(car)
	if car.fuel <= 0.00001 and sim.phase == "race":
		sim.retire(car, "Out of fuel")
