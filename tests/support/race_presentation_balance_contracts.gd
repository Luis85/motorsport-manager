class_name RacePresentationBalanceContracts
extends RefCounted


static func run(check: Callable) -> void:
	var loaded = ContentPackLoader.new().load_packs([ContentPackLoader.BUILTIN_ROOT])
	check.call(loaded.ok, "Presentation balance fixture loads production tuning")
	if not loaded.ok:
		return
	var record: Dictionary = loaded.catalog.tuning("core.race_tuning.default").to_record()
	record.erase("balance")
	var legacy = RaceTuningDefinition.from_record(record)
	check.call(
		(
			legacy != null
			and legacy.to_record() == record
			and legacy.balance.presentation == RacePresentationBalance.LEGACY
		),
		"Omitted presentation policy preserves frozen records and legacy observational defaults"
	)
	if legacy == null:
		return
	check.call(
		legacy.balance.presentation.is_read_only(),
		"Presentation defaults cannot mutate legacy tuning"
	)
	record["balance"] = GameBalanceSchema.defaults()
	var values: Dictionary = record.balance.presentation
	values.low_tread_percent = 50.0
	values.practice_reuse_tread_percent = 70.0
	values.demand_base = 2.0
	values.demand_push = 5.0
	values.demand_tread_threshold_percent = 50.0
	values.demand_tread_points = 10.0
	values.demand_raised = 10.0
	values.demand_high = 20.0
	values.moment_water_raised = 0.3
	values.moment_water_high = 0.6
	values.moment_tread_low_percent = 50.0
	values.moment_tread_critical_percent = 30.0
	record.fuel.engine_rates = [0.5, 0.7, 0.9]
	record.condition.health_reference = 80.0
	record.condition.heat_reference_c = 100.0
	var tuning = RaceTuningDefinition.from_record(record)
	check.call(
		tuning != null, "Complete authored presentation policy validates with the frozen tuning"
	)
	if tuning == null:
		return
	var sim = _simulation(tuning)
	var car = sim.cars[3]
	var fitted = TyreInventory.find(car, car.set_id)
	for key in WheelTyres.KEYS:
		fitted.wheels[key].life = 45.0
	WheelTyres.publish(fitted)
	car.tyre = fitted.life
	car.pace = 2
	car.engine = 1
	car.health = 75.0
	car.engine_temperature = 110.0
	car.fuel = 5.0
	var before = RaceStateValue.fingerprint(sim.snapshot())
	var reading = MinimalDriverReadout.capture(sim, 3)
	check.call(
		reading.tyre_issue and reading.car_issue and reading.engine_hot and not reading.fuel_issue,
		"Readout uses authored tread policy and authoritative health, heat and fuel inputs"
	)
	check.call(
		is_equal_approx(reading.stress.value, 8.0) and reading.stress.band == "Low",
		"Current demand uses authored base, Push and tread contributions"
	)
	var watch = RaceMomentDirector.new()
	watch.configure(sim)
	check.call(
		(
			watch.water_band(0.2) == 0
			and watch.water_band(0.4) == 1
			and watch.tyre_band(45.0) == 1
			and watch.tyre_band(29.0) == 2
		),
		"Moment check-in bands use authored observational thresholds"
	)
	var facts = watch.facts()
	facts.drivers[3].tyre = 0
	check.call(watch.facts().drivers[3].tyre == 1, "Moment facts are detached application values")
	watch.detach()
	check.call(
		RaceStateValue.fingerprint(sim.snapshot()) == before,
		"Repeated authored observations consume no race ticks, RNG or authority"
	)
	# Save a valid freshly constructed session; the race observations above use
	# intentionally posed read-model states rather than a completed sporting journey.
	var saved_session = PracticeRaceSim.new(
		sim.track, {"laps": 6, "seed": 7314, "tuning_definition": tuning.to_record()}
	)
	var restored = PracticeRaceSim.restore_practice(saved_session.snapshot())
	check.call(restored != null, "Authored observational policy restores with the session")
	if restored == null:
		return
	var frozen_reading = MinimalDriverReadout.capture(restored, 3)
	record.balance.presentation.low_tread_percent = 0.0
	record.fuel.engine_rates = [1.0, 1.2, 1.4]
	check.call(
		(
			MinimalDriverReadout.capture(restored, 3) == frozen_reading
			and restored.tuning.to_record() == tuning.to_record()
		),
		"Later source edits cannot change restored readout or demand policy"
	)
	_practice(tuning, check)
	_invalid(record, check)


static func _simulation(tuning: RaceTuningDefinition) -> PracticeRaceSim:
	var document: Dictionary = (
		Storage.read_json(ContentPackLoader.BUILTIN_ROOT + "/circuits/hillside.json").data
	)
	var sim = PracticeRaceSim.new(
		TrackGeometry.new(document),
		{"laps": 6, "seed": 7314, "tuning_definition": tuning.to_record()}
	)
	sim.phase = "race"
	for car in sim.cars:
		car.route = "garage"
		car.damage = 0.0
		car.loss = 0.0
	var player = sim.cars[3]
	player.route = "track"
	player.speed = 40.0
	return sim


static func _practice(tuning: RaceTuningDefinition, check: Callable) -> void:
	var sim = _simulation(tuning)
	sim.phase = "practice"
	var car = sim.cars[3]
	car.route = "garage"
	car.compound = "M"
	var fitted = TyreInventory.find(car, car.set_id)
	for key in WheelTyres.KEYS:
		fitted.wheels[key].life = 60.0
	WheelTyres.publish(fitted)
	var controls = MinimalRaceControls.new()
	controls.configure(sim)
	var before = RaceStateValue.fingerprint(sim.snapshot())
	check.call(
		controls.replacement(3, false).id != fitted.id,
		"Authored practice reuse floor prefers a fresh set over sixty-percent fitted tread"
	)
	check.call(
		RaceStateValue.fingerprint(sim.snapshot()) == before,
		"Tyre availability query does not mount or mutate inventory"
	)


static func _invalid(record: Dictionary, check: Callable) -> void:
	for field in ["demand_high", "moment_water_high", "moment_tread_critical_percent"]:
		var broken = record.duplicate(true)
		broken.balance.presentation[field] = {
			"demand_high": 1.0, "moment_water_high": 0.1, "moment_tread_critical_percent": 90.0
		}[field]
		check.call(
			RaceTuningDefinition.from_record(broken) == null,
			"Inverted presentation band rejects " + field
		)
	var broken = record.duplicate(true)
	broken.balance.presentation.erase("low_tread_percent")
	check.call(
		RaceTuningDefinition.from_record(broken) == null,
		"Incomplete authored presentation policy rejects"
	)
	broken = record.duplicate(true)
	broken.balance.presentation.demand_tread_threshold_percent = 0.0
	check.call(
		RaceTuningDefinition.from_record(broken) == null,
		"Zero tread denominator rejects before use"
	)
