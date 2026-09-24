extends SceneTree
var checks = 0
var failures: Array[String] = []
var geometry: TrackGeometry
var metrics: Dictionary = {}
func _initialize() -> void: call_deferred("run")
func check(value: bool, message: String) -> void:
	checks += 1
	if not value: failures.append(message); push_error(message)
func fixture() -> PracticeRaceSim:
	return PracticeRaceSim.new(geometry, {"laps": 12, "scenario": "dry", "intensity": "calm", "seed": 2026})
func plan(id: int = 3, objective: String = "tyre_life", count: int = 3) -> Dictionary:
	return {"objective": objective, "set_id": "%d-M1" % id, "laps": count, "baseline": "current"}
func request(sim: PracticeRaceSim, id: int, value: Dictionary) -> Dictionary:
	var preview = sim.run_preview(id, value)
	return {"id": id, "plan": value, "revision": preview.revision, "time": preview.time, "key": preview.key}
func advance_until(sim: PracticeRaceSim, condition: Callable, budget: int = 16000) -> bool:
	for i in range(budget):
		if condition.call(): return true
		sim.step()
	return condition.call()
func same(a: Variant, b: Variant) -> bool:
	if a is Dictionary and b is Dictionary:
		if a.size() != b.size(): return false
		for key in a:
			if not b.has(key) or not same(a[key], b[key]): return false
		return true
	if a is Array and b is Array:
		if a.size() != b.size(): return false
		for i in range(a.size()):
			if not same(a[i], b[i]): return false
		return true
	if (a is float or a is int) and (b is float or b is int): return absf(float(a) - float(b)) < 0.00000001
	return a == b
func run() -> void:
	var started = Time.get_ticks_msec()
	geometry = TrackGeometry.new(Storage.read_catalog().data[7])
	test_skip_and_permissions()
	test_physical_run()
	test_recall_and_close()
	test_migration()
	test_deadlines_and_evidence()
	test_objectives_and_matching()
	var report = {"passed": failures.is_empty(), "checks": checks, "failures": failures, "metrics": metrics, "elapsed_seconds": (Time.get_ticks_msec() - started)/1000.0}
	Storage.write_json("res://reports/practice-tests.json", report); print("PRACTICE_TESTS ", JSON.stringify(report)); quit(0 if failures.is_empty() else 1)
func test_skip_and_permissions() -> void:
	var sim = fixture(); var base = RecoveryRaceSim.new(geometry, {"laps":12,"scenario":"dry","intensity":"calm","seed":2026})
	check(sim.command("qualify") and base.command("qualify"), "Skipping practice can start normal qualifying")
	check(sim.practice_state.status == "skipped" and sim.cars == base.cars and sim.total_time == base.total_time and sim.rng_state == base.rng_state and sim.weather_state == base.weather_state, "Skip charges no resource, time, weather or performance penalty")
	var before = JSON.stringify(sim.snapshot())
	check(not sim.command("practice_start") and before == JSON.stringify(sim.snapshot()), "Practice cannot be started after qualifying begins")
	sim = fixture(); check(sim.command("practice_start"), "Practice starts explicitly from briefing")
	before = JSON.stringify(sim.snapshot())
	check(not sim.command("practice_run", request(sim, 0, plan(0))) and before == JSON.stringify(sim.snapshot()), "Player cannot issue a rival practice command")
	var wrong = plan(); wrong.set_id = "6-M1"
	check(not sim.command("practice_run", request(sim,3,wrong)) and before == JSON.stringify(sim.snapshot()), "Practice cannot borrow teammate tyres")
	for value in [0,5,1.5]:
		wrong = plan(); wrong.laps = value
		check(not sim.command("practice_run", request(sim,3,wrong)) and before == JSON.stringify(sim.snapshot()), "Invalid lap count rejected atomically: " + str(value))
	var payload = request(sim,3,plan()); payload.key = "stale"
	check(not sim.command("practice_run", payload) and before == JSON.stringify(sim.snapshot()), "Changed run assumptions cannot silently execute")
	check(not sim.command("prepare_race") and before == JSON.stringify(sim.snapshot()), "A running practice session cannot be skipped into race preparation")
	var preview = sim.run_preview(3, plan())
	for i in range(20): sim.run_preview(3,plan()); sim.forecast(3)
	check(before == JSON.stringify(sim.snapshot()), "Practice previews and forecast queries are observational")
	metrics.run_duration_estimate = preview.duration
func test_physical_run() -> void:
	var sim = fixture(); sim.command("practice_start")
	# Isolate the clean-air measurement contract; another fixture tests ordinary traffic.
	for d in sim.practice_state.drivers: d.next_release = sim.practice_state.duration + 1
	var owners = sim.policy(3).duplicate(true)
	check(sim.command("practice_run", request(sim,3,plan())), "Real tyre-life run accepted")
	check(sim.cars[3].route == "pit" and sim.cars[3].pit_stage == "exit", "Release uses the physical pit route")
	check(not sim.command("setup_all", {"id":3,"values":{"wing":1}}), "Setup cannot change after release")
	check(advance_until(sim,func(): return sim.practice_driver(3).active.is_empty()), "Three measured laps and a physical in-lap return to garage")
	var run = sim.practice_driver(3).runs[0]
	check(run.samples.size() == 3, "Requested full laps are measured at timing-line crossings")
	check(run.end.life < run.start.life and run.end.health < run.start.health and run.end.fuel < run.start.fuel, "Practice consumes actual tread, fuel and lifetime condition")
	check(sim.cars[3].qual_best == 0 and sim.cars[3].qual_runs == 0 and sim.cars[3].qual_history.is_empty(), "Practice cannot bank a qualifying time or use qualifying attempts")
	check(sim.policy(3) == owners, "Practice does not take over unrelated strategy domains")
	var learned = sim.forecast_parameters(3).get("practice", {})
	check(not learned.is_empty(), "Comparable real practice samples inform forecast priors")
	metrics.samples = run.samples; metrics.prior = learned
	var snapshot = sim.snapshot()
	var loaded = PracticeRaceSim.restore_practice(JSON.parse_string(JSON.stringify(snapshot,"",false,true)))
	check(loaded != null, "Completed practice run restores from version nine JSON")
	if loaded != null:
		for i in range(100): sim.step(); loaded.step()
		check(same(sim.cars,loaded.cars) and same(sim.practice_state,loaded.practice_state) and sim.rng_state == loaded.rng_state, "Loaded run continuation preserves state and randomness")
	var p = sim.forecast_parameters(3)
	sim.weather_state.model.target = 1 - sim.weather_state.model.target
	check(p == sim.forecast_parameters(3), "Learning cannot read the secret future weather target")
	sim.cars[3].car_setup.wing = 1; sim.cars[3].setup = 1
	check(sim.forecast_parameters(3).practice.is_empty(), "Setup change invalidates mismatched practice evidence")
	sim.cars[3].car_setup = run.setup.duplicate(); sim.cars[3].setup = run.setup.wing
	check(sim.command("practice_end"), "Practice can end early on explicit request")
	check(advance_until(sim,func(): return sim.phase == "practice_results"), "Closing waits for physical returns, then stops at results approval")
	var inventory = sim.cars[3].tyre_sets.duplicate(true); var health = sim.cars[3].health
	check(sim.command("practice_finish") and sim.phase == "briefing", "Practice review returns to briefing without auto-starting qualifying")
	check(sim.cars[3].tyre_sets == inventory and sim.cars[3].health == health, "Review preserves finite sets and all condition wear")
	check(sim.command("qualify"), "Actual qualifying remains available after practice review")
func test_recall_and_close() -> void:
	var sim = fixture(); sim.command("practice_start"); sim.command("practice_run", request(sim,3,plan()))
	check(sim.command("practice_recall",{"id":3}), "Recall is accepted even while departing the garage")
	check(advance_until(sim,func(): return sim.practice_driver(3).active.is_empty()), "Early recall returns physically without a new lap")
	var run = sim.practice_driver(3).runs[0]
	check(run.samples.is_empty() and not run.end.is_empty() and run.end.life < run.start.life, "Interrupted zero-full-lap run retains partial cost evidence")
	check(sim.forecast_parameters(3).practice.is_empty(), "Partial run cannot fabricate full-lap confidence")
	check("Partial" in PracticeEvidence.describe(run) or "partial" in PracticeEvidence.describe(run), "Partial evidence is disclosed")
	sim.command("practice_end"); var time = sim.total_time; sim.command("pause")
	for i in range(10): sim.step()
	check(sim.total_time == time and sim.paused, "Explicit pause remains authoritative during practice")
	sim.command("pause")
	check(advance_until(sim,func(): return sim.phase == "practice_results"), "Interrupted runs cannot deadlock session closure")
func test_migration() -> void:
	var old = RecoveryRaceSim.new(geometry, {"scenario":"wet"})
	var migrated = PracticeRaceSim.restore_practice(old.snapshot())
	check(migrated != null and migrated.practice_state.status == "legacy", "v8 saves gain no fabricated practice data or automatic session")
	if migrated != null:
		check(not migrated.command("practice_start") and migrated.cars == old.cars and migrated.weather_state == old.weather_state, "Legacy saves preserve prior behavior")
	var sim = fixture(); sim.command("practice_start"); sim.command("practice_run",request(sim,3,plan()))
	check(advance_until(sim,func(): return sim.cars[3].qual_state == "hotlap"), "Live hotlap reached for persistence fixture")
	var saved = JSON.parse_string(JSON.stringify(sim.snapshot(),"",false,true))
	var loaded = PracticeRaceSim.restore_practice(saved)
	check(loaded != null, "A live measured practice lap saves its timing anchor")
	if loaded != null:
		for i in range(250): sim.step(); loaded.step(); loaded.forecast(3) if i % 50 == 0 else null
		check(same(sim.cars,loaded.cars) and same(sim.practice_state,loaded.practice_state), "Opening forecast after reload does not alter the ongoing experiment")
	for key in ["status","duration","drivers"]:
		var corrupt = saved.duplicate(true); corrupt.practice_state[key] = null
		check(PracticeRaceSim.restore_practice(corrupt) == null, "Malformed practice " + key + " is rejected")
	var corrupt = saved.duplicate(true); corrupt.practice_state.drivers[3].active.anchor.time = saved.total_time + 1
	check(PracticeRaceSim.restore_practice(corrupt) == null, "A future timing anchor is rejected")

func test_deadlines_and_evidence() -> void:
	var sim = fixture(); sim.command("practice_start")
	for d in sim.practice_state.drivers: d.next_release = sim.practice_state.duration + 1
	sim.command("practice_run",request(sim,3,plan(3,"qualifying",4)))
	check(advance_until(sim,func(): return sim.cars[3].qual_state == "hotlap"), "A qualifying-preparation run physically reaches its measured lap")
	check(sim.cars[3].pace == 2 and sim.cars[3].engine == 2, "Qualifying preparation explicitly spends attack-mode resources")
	sim.clock = sim.practice_state.duration - RaceSim.STEP
	sim.step()
	check(sim.practice_state.closed and not sim.paused and sim.cars[3].qual_state == "hotlap", "Clock closure preserves an already-started lap without automatic pause")
	var before = JSON.stringify(sim.snapshot())
	check(not sim.command("practice_run",request(sim,6,plan(6))) and before == JSON.stringify(sim.snapshot()), "No new run starts after the session deadline")
	check(advance_until(sim,func(): return sim.phase == "practice_results"), "Clock closure permits one full lap and physical return")
	check(sim.practice_driver(3).runs[0].samples.size() == 1 and sim.cars[3].qual_best == 0, "Partial run yields its actual single lap, never a qualifying score")
	check(PracticeRaceSim.restore_practice(sim.snapshot()) != null, "Clock-expired practice results pass complete state validation")
	var saved = sim.snapshot()
	var corrupt = saved.duplicate(true); corrupt.practice_state.closed = false
	check(PracticeRaceSim.restore_practice(corrupt) == null, "Completed session with an open run gate is rejected")
	corrupt = saved.duplicate(true); corrupt.practice_state.drivers[3].runs[0].samples[0].time = saved.total_time + 10
	check(PracticeRaceSim.restore_practice(corrupt) == null, "Future or out-of-run observations cannot be loaded")
	corrupt = saved.duplicate(true)
	for record in corrupt.strategy_state.records:
		if record.kind == "practice_lap": record.evidence.sample = {}; break
	check(PracticeRaceSim.restore_practice(corrupt) == null, "Journal measurements must reference the actual retained practice sample")
	corrupt = saved.duplicate(true)
	for record in corrupt.strategy_state.records:
		if record.kind == "practice_command": record.evidence.action = "fabricated"; break
	check(PracticeRaceSim.restore_practice(corrupt) == null, "Unknown practice journal commands are rejected atomically on load")
	sim = fixture(); sim.command("practice_start"); sim.clock = sim.practice_state.duration - 10
	before = JSON.stringify(sim.snapshot())
	check(not sim.run_preview(3,plan()).available and not sim.command("practice_run",request(sim,3,plan())) and before == JSON.stringify(sim.snapshot()), "Insufficient return margin rejects rather than promising an impossible run")

func test_objectives_and_matching() -> void:
	var sim = fixture(); sim.command("practice_start")
	for d in sim.practice_state.drivers: d.next_release = sim.practice_state.duration + 1
	for baseline in ["low_drag","balanced"]:
		var candidate = plan(3,"setup",1); candidate.baseline = baseline
		check(sim.command("practice_run",request(sim,3,candidate)), "Complementary setup run accepted: " + baseline)
		check(advance_until(sim,func(): return sim.practice_driver(3).active.is_empty()), "Setup comparison consumes physical running: " + baseline)
	check("measured averages" in PracticeEvidence.report(sim.practice_state,3) and "confound" in PracticeEvidence.report(sim.practice_state,3), "Setup comparison labels measured differences without claiming causal attribution")
	var evidence = sim.practice_driver(3).runs.back()
	check(sim.cars[3].car_setup == CarSetup.DEFAULTS and sim.cars[3].tyre_sets.filter(func(item): return item.used).size() >= 1, "Explicit second baseline remains applied while reused set retains its condition")
	var prior = sim.forecast_parameters(3).practice
	check(prior.has("M") and prior.M.samples == 1, "Only the matching setup contributes to the current forecast")
	check(sim.forecast_parameters(6).practice.is_empty(), "A teammate cannot receive the other driver's private residual as a performance bonus")
	check(PracticeEvidence.prior(sim.practice_state,sim.cars[3],0.8).is_empty(), "Dry measurements do not claim wet-condition knowledge")
	var original_engine = sim.cars[3].engine; sim.cars[3].engine = 0
	check(sim.forecast_parameters(3).practice.is_empty(), "Changed engine policy invalidates comparable evidence")
	sim.cars[3].engine = original_engine
	var source = RaceForecaster.capture(sim,3); var item = RaceForecaster.set_by_id(source,source.own.starting_set)
	var without = source.duplicate(true); without.model_context.erase("practice")
	check(RaceForecaster.lap_time(source,item,item.life) != RaceForecaster.lap_time(without,item,item.life), "Measured residual actually informs the coarse forecast, not just a decorative notebook")
	check(source.model_context.practice.M.uncertainty >= 0.06, "A single full lap cannot falsely narrow the baseline error allowance")
	var twin = PracticeRaceSim.restore_practice(sim.snapshot())
	for recorded_run in twin.practice_driver(3).runs:
		for lap in recorded_run.samples: lap.clean = false
	# Rendering/forecast evidence is never read by movement in practice; suppress later AI
	# decisions by keeping this comparison at the garage before race preparation.
	for i in range(100): sim.step(); twin.step()
	check(sim.cars == twin.cars and sim.rng_state == twin.rng_state, "Removing learned forecasts does not confer or remove physical car performance")
	var wet_plan = plan(3,"wet",1)
	check(sim.command("practice_run",request(sim,3,wet_plan)), "Wet-learning objective can honestly discover that present conditions are dry")
	check(advance_until(sim,func(): return sim.practice_driver(3).active.is_empty()), "Third bounded run returns with retained evidence")
	check("No wet-condition evidence" in PracticeEvidence.describe(sim.practice_driver(3).runs.back()), "Wet-learning report does not invent rain when the actual track was dry")
	var before = JSON.stringify(sim.snapshot())
	check(not sim.command("practice_run",request(sim,3,plan())) and before == JSON.stringify(sim.snapshot()), "Three-run limit prevents unlimited repetitions without modifying inventory")
	var traffic = fixture(); traffic.command("practice_start"); traffic.command("practice_run",request(traffic,3,plan()))
	check(advance_until(traffic,func(): return traffic.practice_driver(3).active.is_empty()), "Ordinary field traffic fixture completes its real run")
	var laps_observed = traffic.practice_driver(3).runs[0].samples
	check(laps_observed.any(func(lap): return not lap.clean), "Real traffic is retained as contaminated evidence, not falsely precise learning")
	metrics.ordinary_traffic_samples = laps_observed.size()
	metrics.ordinary_traffic_clean_samples = laps_observed.filter(func(lap): return lap.clean).size()
	check(PracticeRaceSim.restore_practice(traffic.snapshot()) != null, "Normal rivals' own practice records and resources restore intact")
