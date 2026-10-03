extends SceneTree
## Independent Stage-A suite; baseline tests continue exercising unchanged movement contracts.
var checks = 0
var failures: Array[String] = []
var geometry: TrackGeometry


func _initialize() -> void:
	call_deferred("run")


func check(condition: bool, description: String) -> void:
	checks += 1
	if not condition:
		failures.append(description)
		push_error(description)


func test_records() -> void:
	var sim = RaceSim.new(geometry, {"laps": 24, "scenario": "dry"})
	var car = sim.cars[3]
	var plan = StrategyPlan.draft(car, sim.laps)
	check(
		StrategyPlan.validate(plan, car, sim.laps).is_empty(),
		"Template produces a valid driver-owned plan"
	)
	check(plan.stops.size() == 1, "Balanced template has an approved-window proposal")
	check(not car.pit_order, "Drafting never orders a physical stop")
	var invalid = plan.duplicate(true)
	invalid.driver_id = 6
	check(
		not StrategyPlan.validate(invalid, car, sim.laps).is_empty(),
		"A teammate's draft cannot target this driver"
	)
	invalid = plan.duplicate(true)
	invalid.stops[0].set_id = plan.starting_set
	check(
		not StrategyPlan.validate(invalid, car, sim.laps).is_empty(),
		"A plan cannot duplicate its starting set"
	)
	invalid = plan.duplicate(true)
	invalid.stops[0].from_lap = sim.laps
	check(
		not StrategyPlan.validate(invalid, car, sim.laps).is_empty(),
		"A final-lap window is rejected"
	)
	invalid = plan.duplicate(true)
	invalid.stops.append(invalid.stops[0].duplicate(true))
	check(
		not StrategyPlan.validate(invalid, car, sim.laps).is_empty(),
		"Overlapping or duplicated stops are rejected"
	)
	check(
		(
			StrategyPlan
			. validate(StrategyPlan.draft(car, sim.laps, "no_stop"), car, sim.laps)
			. is_empty()
		),
		"No-stop is an explicit legal plan"
	)
	var state = RaceJournal.create(sim.cars)
	check(RaceJournal.valid(state, sim.cars, sim.laps), "New policy state validates")
	var first = RaceJournal.append(state, sim, "command", 3, {"action": "approve_plan"})
	var second = RaceJournal.append(
		state,
		sim,
		"pit_exit",
		3,
		{"visit_seconds": 22.0, "predicted_low": 20.0, "predicted_high": 24.0, "residual": 0.0},
		first
	)
	check(
		first != second and state.records[1].related_id == first,
		"Stable journal identifiers link decisions and measured consequences"
	)
	check(
		RaceJournal.valid(JSON.parse_string(JSON.stringify(state)), sim.cars, sim.laps),
		"Policy and journal survive JSON serialization"
	)
	check(
		"Measured pit visit" in "\n".join(RaceJournal.debrief(state)),
		"Debrief distinguishes measured visit from model estimates"
	)
	invalid = state.duplicate(true)
	invalid.policies[3].owners.pit = "mystery"
	check(
		not RaceJournal.valid(invalid, sim.cars, sim.laps),
		"Invalid ownership is rejected on restore"
	)
	invalid = state.duplicate(true)
	invalid.records[1].id = first
	check(not RaceJournal.valid(invalid, sim.cars, sim.laps), "Duplicate journal IDs are rejected")


func test_forecasts() -> void:
	var sim = RaceSim.new(geometry, {"laps": 24, "scenario": "dry", "seed": 21})
	sim.phase = "race"
	var car = sim.cars[3]
	car.distance = geometry.length * 4.2
	car.speed = 40.0
	var before = JSON.stringify(sim.snapshot())
	var rng = sim.rng_state
	var source = RaceForecaster.capture(sim, 3)
	var forecast = RaceForecaster.evaluate(source)
	check(
		forecast.options.size() == 3, "Current, immediate and extended alternatives are available"
	)
	check(
		before == JSON.stringify(sim.snapshot()) and rng == sim.rng_state,
		"Forecasts change neither authoritative state nor live RNG"
	)
	check(
		forecast.tick == roundi(sim.total_time / RaceSim.STEP) and not forecast.key.is_empty(),
		"Forecast identifies its source tick and material hash"
	)
	check(not RaceForecaster.stale(sim, forecast), "Fresh forecast is current")
	sim.cars[0].route = "pit"
	check(
		RaceForecaster.stale(sim, forecast), "Observed rival stop invalidates the rejoin assumption"
	)
	sim.cars[0].route = "track"
	sim.flag = "SAFETY CAR"
	check(RaceForecaster.stale(sim, forecast), "Flag changes invalidate the forecast")
	sim.flag = "GREEN"
	sim.total_time += 6
	check(
		RaceForecaster.stale(sim, forecast), "An old snapshot cannot masquerade as current advice"
	)
	var fair = true
	for rival in source.public:
		for key in [
			"tyre_sets", "fuel", "temperature", "next_set_id", "pit_gate", "pit_order", "rng_state"
		]:
			if rival.has(key):
				fair = false
	check(
		fair and not source.has("weather_future"),
		"Rival information boundary excludes private stock, plans and hidden weather"
	)
	source.own.inventory[0].life = 2
	check(
		sim.cars[3].tyre_sets[0].life != 2,
		"Information snapshot owns a deep copy of the player's inventory"
	)
	var stop = forecast.options[1]
	check(
		stop.pit_cost > 0 and stop.warmup_cost > 0,
		"An additional stop pays its full net pit cost and warm-up"
	)
	check(
		(
			forecast.pit.position_low <= forecast.pit.position_high
			and forecast.pit.visit_low < forecast.pit.visit_high
		),
		"Rejoin and visit estimates are bounded ranges"
	)
	var snapshot = RaceForecaster.capture(sim, 3)
	snapshot.own.distance = snapshot.gate.distance
	snapshot.own.box_d = 0
	snapshot.teammate = {}
	var empty = RaceForecaster.pit_prediction(snapshot)
	snapshot.teammate = {
		"route": "pit", "pit_stage": "service", "pit_timer": 8.0, "damage": 0.0, "repair": true
	}
	var stacked = RaceForecaster.pit_prediction(snapshot)
	check(
		stacked.queue > 0 and stacked.loss > empty.loss,
		"Shared-box occupancy creates a real predicted waiting cost"
	)
	car.distance = geometry.pit_entry - 1
	car.speed = 60
	var gate = RaceForecaster.reachable_gate(sim, car)
	check(
		gate.deferred and gate.distance > geometry.pit_entry,
		"An unsafe immediate call previews the next reachable gate"
	)
	var expected = gate.distance
	sim.queue_pit(car)
	check(
		absf(car.pit_gate - expected) < 0.00001,
		"Rejoin preview and physical pit command use the same gate"
	)
	sim.phase = "qualifying"
	car.route = "garage"
	sim.clock = sim.qual_duration - 1
	check(
		not RaceForecaster.qualifying_release(sim, car).can_start_hotlap,
		"Release advice never advertises a last-second flying lap"
	)
	sim.phase = "race_preparation"
	car.fuel = float(sim.laps)
	check(
		RaceForecaster.fuel_margin(sim, car) < 0,
		"Fuel projection explicitly includes formation reserve"
	)


func race_fixture(laps: int = 8) -> StrategyRaceSim:
	var sim = StrategyRaceSim.new(
		geometry, {"laps": laps, "scenario": "dry", "intensity": "calm", "seed": 112}
	)
	sim.command("prepare_race")
	sim.command("formation")
	for car in sim.cars:
		car.formation_done = true
	sim.step()
	sim.command("lights")
	for i in range(121):
		sim.step()
	return sim


func ticks(sim: RaceSim, count: int) -> void:
	for i in range(count):
		sim.step()


func equivalent(a: Variant, b: Variant) -> bool:
	return preload("res://tests/support/state_comparison.gd").equivalent(
		a, b, 0.00000001, false, true
	)


func before_rejected_forecast(sim: StrategyRaceSim, f: Dictionary) -> void:
	var before = JSON.stringify(sim.snapshot())
	check(
		not sim.command(
			"pit",
			{
				"id": 3,
				"forecast_key": f.key,
				"forecast_time": f.time,
				"expected_gate": f.gate.distance
			}
		),
		"A stale opportunity cannot issue an obsolete pit order"
	)
	check(
		before == JSON.stringify(sim.snapshot()),
		"Stale advice rejection neither cancels nor replaces the current plan"
	)
