extends "res://tests/support/practice_run_contracts.gd"


func run() -> void:
	var started = Time.get_ticks_msec()
	geometry = TrackGeometry.new(Storage.read_catalog().data[7])
	test_skip_and_permissions()
	test_physical_run()
	test_recall_and_close()
	test_migration()
	test_deadlines_and_evidence()
	test_objectives_and_matching()
	var report = {
		"passed": failures.is_empty(),
		"checks": checks,
		"failures": failures,
		"metrics": metrics,
		"elapsed_seconds": (Time.get_ticks_msec() - started) / 1000.0
	}
	Storage.write_json("res://reports/practice-tests.json", report)
	print("PRACTICE_TESTS ", JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)


func test_recall_and_close() -> void:
	var sim = fixture()
	sim.command("practice_start")
	sim.command("practice_run", request(sim, 3, plan()))
	check(
		sim.command("practice_recall", {"id": 3}),
		"Recall is accepted even while departing the garage"
	)
	check(
		advance_until(sim, func(): return sim.practice_driver(3).active.is_empty()),
		"Early recall returns physically without a new lap"
	)
	var run = sim.practice_driver(3).runs[0]
	check(
		run.samples.is_empty() and not run.end.is_empty() and run.end.life < run.start.life,
		"Interrupted zero-full-lap run retains partial cost evidence"
	)
	check(
		sim.forecast_parameters(3).practice.is_empty(),
		"Partial run cannot fabricate full-lap confidence"
	)
	check(
		"Partial" in PracticeEvidence.describe(run) or "partial" in PracticeEvidence.describe(run),
		"Partial evidence is disclosed"
	)
	sim.command("practice_end")
	var time = sim.total_time
	sim.command("pause")
	for i in range(10):
		sim.step()
	check(
		sim.total_time == time and sim.paused,
		"Explicit pause remains authoritative during practice"
	)
	sim.command("pause")
	check(
		advance_until(sim, func(): return sim.phase == "practice_results"),
		"Interrupted runs cannot deadlock session closure"
	)


func test_migration() -> void:
	var old = RecoveryRaceSim.new(geometry, {"scenario": "wet"})
	var migrated = PracticeRaceSim.restore_practice(old.snapshot())
	check(
		migrated != null and migrated.practice_state.status == "legacy",
		"v8 saves gain no fabricated practice data or automatic session"
	)
	if migrated != null:
		check(
			(
				not migrated.command("practice_start")
				and RaceCar.records(migrated.cars) == RaceCar.records(old.cars)
				and migrated.weather_state == old.weather_state
			),
			"Legacy saves preserve prior behavior"
		)
	var sim = fixture()
	sim.command("practice_start")
	sim.command("practice_run", request(sim, 3, plan()))
	check(
		advance_until(sim, func(): return sim.cars[3].qual_state == "hotlap"),
		"Live hotlap reached for persistence fixture"
	)
	var saved = JSON.parse_string(JSON.stringify(sim.snapshot(), "", false, true))
	var loaded = PracticeRaceSim.restore_practice(saved)
	check(loaded != null, "A live measured practice lap saves its timing anchor")
	if loaded != null:
		for i in range(250):
			sim.step()
			loaded.step()
			if i % 50 == 0:
				loaded.forecast(3)
		check(
			same(sim.cars, loaded.cars) and same(sim.practice_state, loaded.practice_state),
			"Opening forecast after reload does not alter the ongoing experiment"
		)
	for key in ["status", "duration", "drivers"]:
		var corrupt = saved.duplicate(true)
		corrupt.practice_state[key] = null
		check(
			PracticeRaceSim.restore_practice(corrupt) == null,
			"Malformed practice " + key + " is rejected"
		)
	var corrupt = saved.duplicate(true)
	corrupt.practice_state.drivers[3].active.anchor.time = saved.total_time + 1
	check(PracticeRaceSim.restore_practice(corrupt) == null, "A future timing anchor is rejected")


func test_deadlines_and_evidence() -> void:
	var sim = fixture()
	sim.command("practice_start")
	for d in sim.practice_state.drivers:
		d.next_release = sim.practice_state.duration + 1
	sim.command("practice_run", request(sim, 3, plan(3, "qualifying", 4)))
	check(
		advance_until(sim, func(): return sim.cars[3].qual_state == "hotlap"),
		"A qualifying-preparation run physically reaches its measured lap"
	)
	check(
		sim.cars[3].pace == 2 and sim.cars[3].engine == 2,
		"Qualifying preparation explicitly spends attack-mode resources"
	)
	sim.clock = sim.practice_state.duration - RaceSim.STEP
	sim.step()
	check(
		sim.practice_state.closed and not sim.paused and sim.cars[3].qual_state == "hotlap",
		"Clock closure preserves an already-started lap without automatic pause"
	)
	var before = JSON.stringify(sim.snapshot())
	check(
		(
			not sim.command("practice_run", request(sim, 6, plan(6)))
			and before == JSON.stringify(sim.snapshot())
		),
		"No new run starts after the session deadline"
	)
	check(
		advance_until(sim, func(): return sim.phase == "practice_results"),
		"Clock closure permits one full lap and physical return"
	)
	check(
		sim.practice_driver(3).runs[0].samples.size() == 1 and sim.cars[3].qual_best == 0,
		"Partial run yields its actual single lap, never a qualifying score"
	)
	check(
		PracticeRaceSim.restore_practice(sim.snapshot()) != null,
		"Clock-expired practice results pass complete state validation"
	)
	var saved = sim.snapshot()
	var corrupt = saved.duplicate(true)
	corrupt.practice_state.closed = false
	check(
		PracticeRaceSim.restore_practice(corrupt) == null,
		"Completed session with an open run gate is rejected"
	)
	corrupt = saved.duplicate(true)
	corrupt.practice_state.drivers[3].runs[0].samples[0].time = saved.total_time + 10
	check(
		PracticeRaceSim.restore_practice(corrupt) == null,
		"Future or out-of-run observations cannot be loaded"
	)
	corrupt = saved.duplicate(true)
	for record in corrupt.strategy_state.records:
		if record.kind == "practice_lap":
			record.evidence.sample = {}
			break
	check(
		PracticeRaceSim.restore_practice(corrupt) == null,
		"Journal measurements must reference the actual retained practice sample"
	)
	corrupt = saved.duplicate(true)
	for record in corrupt.strategy_state.records:
		if record.kind == "practice_command":
			record.evidence.action = "fabricated"
			break
	check(
		PracticeRaceSim.restore_practice(corrupt) == null,
		"Unknown practice journal commands are rejected atomically on load"
	)
	sim = fixture()
	sim.command("practice_start")
	sim.clock = sim.practice_state.duration - 10
	before = JSON.stringify(sim.snapshot())
	check(
		(
			not sim.run_preview(3, plan()).available
			and not sim.command("practice_run", request(sim, 3, plan()))
			and before == JSON.stringify(sim.snapshot())
		),
		"Insufficient return margin rejects rather than promising an impossible run"
	)


func test_objectives_and_matching() -> void:
	var sim = fixture()
	sim.command("practice_start")
	for d in sim.practice_state.drivers:
		d.next_release = sim.practice_state.duration + 1
	for baseline in ["low_drag", "balanced"]:
		var candidate = plan(3, "setup", 1)
		candidate.baseline = baseline
		check(
			sim.command("practice_run", request(sim, 3, candidate)),
			"Complementary setup run accepted: " + baseline
		)
		check(
			advance_until(sim, func(): return sim.practice_driver(3).active.is_empty()),
			"Setup comparison consumes physical running: " + baseline
		)
	check(
		(
			"measured averages" in PracticeEvidence.report(sim.practice_state, 3)
			and "confound" in PracticeEvidence.report(sim.practice_state, 3)
		),
		"Setup comparison labels measured differences without claiming causal attribution"
	)
	var evidence = sim.practice_driver(3).runs.back()
	check(
		(
			sim.cars[3].car_setup == CarSetup.DEFAULTS
			and sim.cars[3].tyre_sets.filter(func(item): return item.used).size() >= 1
		),
		"Explicit second baseline remains applied while reused set retains its condition"
	)
	var prior = sim.forecast_parameters(3).practice
	check(
		prior.has("M") and prior.M.samples == 1,
		"Only the matching setup contributes to the current forecast"
	)
	check(
		sim.forecast_parameters(6).practice.is_empty(),
		"A teammate cannot receive the other driver's private residual as a performance bonus"
	)
	check(
		PracticeEvidence.prior(sim.practice_state, sim.cars[3], 0.8).is_empty(),
		"Dry measurements do not claim wet-condition knowledge"
	)
	var original_engine = sim.cars[3].engine
	sim.cars[3].engine = 0
	check(
		sim.forecast_parameters(3).practice.is_empty(),
		"Changed engine policy invalidates comparable evidence"
	)
	sim.cars[3].engine = original_engine
	var source = RaceForecaster.capture(sim, 3)
	var item = RaceForecaster.set_by_id(source, source.own.starting_set)
	var without = source.duplicate(true)
	without.model_context.erase("practice")
	check(
		(
			RaceForecaster.lap_time(source, item, item.life)
			!= RaceForecaster.lap_time(without, item, item.life)
		),
		"Measured residual actually informs the coarse forecast, not just a decorative notebook"
	)
	check(
		source.model_context.practice.M.uncertainty >= 0.06,
		"A single full lap cannot falsely narrow the baseline error allowance"
	)
	var twin = PracticeRaceSim.restore_practice(sim.snapshot())
	for recorded_run in twin.practice_driver(3).runs:
		for lap in recorded_run.samples:
			lap.clean = false
	# Rendering/forecast evidence is never read by movement in practice; suppress later AI
	# decisions by keeping this comparison at the garage before race preparation.
	for i in range(100):
		sim.step()
		twin.step()
	check(
		RaceCar.records(sim.cars) == RaceCar.records(twin.cars) and sim.rng_state == twin.rng_state,
		"Removing learned forecasts does not confer or remove physical car performance"
	)
	var wet_plan = plan(3, "wet", 1)
	check(
		sim.command("practice_run", request(sim, 3, wet_plan)),
		"Wet-learning objective can honestly discover that present conditions are dry"
	)
	check(
		advance_until(sim, func(): return sim.practice_driver(3).active.is_empty()),
		"Third bounded run returns with retained evidence"
	)
	check(
		(
			"No wet-condition evidence"
			in PracticeEvidence.describe(sim.practice_driver(3).runs.back())
		),
		"Wet-learning report does not invent rain when the actual track was dry"
	)
	var before = JSON.stringify(sim.snapshot())
	check(
		(
			not sim.command("practice_run", request(sim, 3, plan()))
			and before == JSON.stringify(sim.snapshot())
		),
		"Three-run limit prevents unlimited repetitions without modifying inventory"
	)
	var traffic = fixture()
	traffic.command("practice_start")
	traffic.command("practice_run", request(traffic, 3, plan()))
	check(
		advance_until(traffic, func(): return traffic.practice_driver(3).active.is_empty()),
		"Ordinary field traffic fixture completes its real run"
	)
	var laps_observed = traffic.practice_driver(3).runs[0].samples
	check(
		laps_observed.any(func(lap): return not lap.clean),
		"Real traffic is retained as contaminated evidence, not falsely precise learning"
	)
	metrics.ordinary_traffic_samples = laps_observed.size()
	metrics.ordinary_traffic_clean_samples = (
		laps_observed.filter(func(lap): return lap.clean).size()
	)
	check(
		PracticeRaceSim.restore_practice(traffic.snapshot()) != null,
		"Normal rivals' own practice records and resources restore intact"
	)
