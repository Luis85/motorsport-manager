extends SceneTree
var checks = 0
var failures: Array[String] = []
var geometry: TrackGeometry
var metrics: Dictionary = {}


func _initialize() -> void:
	call_deferred("run")


func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)


func fixture() -> PracticeRaceSim:
	return PracticeRaceSim.new(
		geometry, {"laps": 12, "scenario": "dry", "intensity": "calm", "seed": 2026}
	)


func plan(id: int = 3, objective: String = "tyre_life", count: int = 3) -> Dictionary:
	return {"objective": objective, "set_id": "%d-M1" % id, "laps": count, "baseline": "current"}


func request(sim: PracticeRaceSim, id: int, value: Dictionary) -> Dictionary:
	var preview = sim.run_preview(id, value)
	return {
		"id": id,
		"plan": value,
		"revision": preview.revision,
		"time": preview.time,
		"key": preview.key
	}


func advance_until(sim: PracticeRaceSim, condition: Callable, budget: int = 16000) -> bool:
	for i in range(budget):
		if condition.call():
			return true
		sim.step()
	return condition.call()


func same(a: Variant, b: Variant) -> bool:
	return preload("res://tests/support/state_comparison.gd").equivalent(a, b, 0.00000001, false)


func test_skip_and_permissions() -> void:
	var sim = fixture()
	var base = RecoveryRaceSim.new(
		geometry, {"laps": 12, "scenario": "dry", "intensity": "calm", "seed": 2026}
	)
	check(
		sim.command("qualify") and base.command("qualify"),
		"Skipping practice can start normal qualifying"
	)
	check(
		(
			sim.practice_state.status == "skipped"
			and RaceCar.records(sim.cars) == RaceCar.records(base.cars)
			and sim.total_time == base.total_time
			and sim.rng_state == base.rng_state
			and sim.weather_state == base.weather_state
		),
		"Skip charges no resource, time, weather or performance penalty"
	)
	var before = JSON.stringify(sim.snapshot())
	check(
		not sim.command("practice_start") and before == JSON.stringify(sim.snapshot()),
		"Practice cannot be started after qualifying begins"
	)
	sim = fixture()
	check(sim.command("practice_start"), "Practice starts explicitly from briefing")
	before = JSON.stringify(sim.snapshot())
	check(
		(
			not sim.command("practice_run", request(sim, 0, plan(0)))
			and before == JSON.stringify(sim.snapshot())
		),
		"Player cannot issue a rival practice command"
	)
	var wrong = plan()
	wrong.set_id = "6-M1"
	check(
		(
			not sim.command("practice_run", request(sim, 3, wrong))
			and before == JSON.stringify(sim.snapshot())
		),
		"Practice cannot borrow teammate tyres"
	)
	for value in [0, 5, 1.5]:
		wrong = plan()
		wrong.laps = value
		check(
			(
				not sim.command("practice_run", request(sim, 3, wrong))
				and before == JSON.stringify(sim.snapshot())
			),
			"Invalid lap count rejected atomically: " + str(value)
		)
	var payload = request(sim, 3, plan())
	payload.key = "stale"
	check(
		not sim.command("practice_run", payload) and before == JSON.stringify(sim.snapshot()),
		"Changed run assumptions cannot silently execute"
	)
	check(
		not sim.command("prepare_race") and before == JSON.stringify(sim.snapshot()),
		"A running practice session cannot be skipped into race preparation"
	)
	var preview = sim.run_preview(3, plan())
	for i in range(20):
		sim.run_preview(3, plan())
		sim.forecast(3)
	check(
		before == JSON.stringify(sim.snapshot()),
		"Practice previews and forecast queries are observational"
	)
	metrics.run_duration_estimate = preview.duration


func test_physical_run() -> void:
	var sim = fixture()
	sim.command("practice_start")
	# Isolate the clean-air measurement contract; another fixture tests ordinary traffic.
	for d in sim.practice_state.drivers:
		d.next_release = sim.practice_state.duration + 1
	var owners = sim.policy(3).duplicate(true)
	check(sim.command("practice_run", request(sim, 3, plan())), "Real tyre-life run accepted")
	check(
		sim.cars[3].route == "pit" and sim.cars[3].pit_stage == "exit",
		"Release uses the physical pit route"
	)
	check(
		not sim.command("setup_all", {"id": 3, "values": {"wing": 1}}),
		"Setup cannot change after release"
	)
	check(
		advance_until(sim, func(): return sim.practice_driver(3).active.is_empty()),
		"Three measured laps and a physical in-lap return to garage"
	)
	var run = sim.practice_driver(3).runs[0]
	check(run.samples.size() == 3, "Requested full laps are measured at timing-line crossings")
	check(
		(
			run.end.life < run.start.life
			and run.end.health < run.start.health
			and run.end.fuel < run.start.fuel
		),
		"Practice consumes actual tread, fuel and lifetime condition"
	)
	check(
		(
			sim.cars[3].qual_best == 0
			and sim.cars[3].qual_runs == 0
			and sim.cars[3].qual_history.is_empty()
		),
		"Practice cannot bank a qualifying time or use qualifying attempts"
	)
	check(sim.policy(3) == owners, "Practice does not take over unrelated strategy domains")
	var learned = sim.forecast_parameters(3).get("practice", {})
	check(not learned.is_empty(), "Comparable real practice samples inform forecast priors")
	metrics.samples = run.samples
	metrics.prior = learned
	var snapshot = sim.snapshot()
	var loaded = PracticeRaceSim.restore_practice(
		JSON.parse_string(JSON.stringify(snapshot, "", false, true))
	)
	check(loaded != null, "Completed practice run restores from version nine JSON")
	if loaded != null:
		for i in range(100):
			sim.step()
			loaded.step()
		check(
			(
				same(sim.cars, loaded.cars)
				and same(sim.practice_state, loaded.practice_state)
				and sim.rng_state == loaded.rng_state
			),
			"Loaded run continuation preserves state and randomness"
		)
	var p = sim.forecast_parameters(3)
	sim.weather_state.model.target = 1 - sim.weather_state.model.target
	check(p == sim.forecast_parameters(3), "Learning cannot read the secret future weather target")
	sim.cars[3].car_setup.wing = 1
	sim.cars[3].setup = 1
	check(
		sim.forecast_parameters(3).practice.is_empty(),
		"Setup change invalidates mismatched practice evidence"
	)
	sim.cars[3].car_setup = run.setup.duplicate()
	sim.cars[3].setup = run.setup.wing
	check(sim.command("practice_end"), "Practice can end early on explicit request")
	check(
		advance_until(sim, func(): return sim.phase == "practice_results"),
		"Closing waits for physical returns, then stops at results approval"
	)
	var inventory = sim.cars[3].tyre_sets.duplicate(true)
	var health = sim.cars[3].health
	check(
		sim.command("practice_finish") and sim.phase == "briefing",
		"Practice review returns to briefing without auto-starting qualifying"
	)
	check(
		sim.cars[3].tyre_sets == inventory and sim.cars[3].health == health,
		"Review preserves finite sets and all condition wear"
	)
	check(sim.command("qualify"), "Actual qualifying remains available after practice review")
