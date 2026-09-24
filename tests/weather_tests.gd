extends SceneTree
## GDD RW-12/13, V-01/02/03/04/06/07/10/11/12/13/17/20.
var checks = 0
var failures: Array[String] = []
var geometry: TrackGeometry
var measurements: Dictionary = {}
func _initialize() -> void: call_deferred("run")
func check(value: bool, message: String) -> void:
	checks += 1
	if not value: failures.append(message); push_error(message)
func run() -> void:
	var started = Time.get_ticks_msec()
	geometry = TrackGeometry.new(Storage.read_catalog().data[7])
	test_weather_process()
	test_information_boundary()
	test_crossover_relationships()
	test_commands()
	test_persistence()
	test_physical_execution()
	test_scenarios()
	var report = {"passed": failures.is_empty(), "checks": checks, "failures": failures, "engine": Engine.get_version_info().string,
		"elapsed_seconds": (Time.get_ticks_msec() - started) / 1000.0, "measurements": measurements,
		"limitations": "Deterministic contract and qualitative relationship fixtures, not calibrated probability coverage or human enjoyment validation."}
	Storage.write_json("res://reports/weather-tests.json", report); print("WEATHER_TESTS ", JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)

func fixture(laps: int = 24, scenario: String = "changeable", mode: String = "seeded") -> WeatherRaceSim:
	var sim = WeatherRaceSim.new(geometry, {"laps": laps, "scenario": scenario, "weather_mode": mode, "seed": 2026, "intensity": "calm"})
	sim.command("prepare_race"); sim.command("formation")
	for c in sim.cars: c.formation_done = true
	sim.step(); sim.command("lights")
	for i in range(125): sim.step()
	for id in [3, 6]: sim.command("delegation", {"id": id, "channel": "pit", "owner": "player"})
	return sim

func request(advice: Dictionary) -> Dictionary:
	return {"id": advice.driver_id, "time": advice.time, "key": advice.key, "weather_key": advice.weather_key, "set_id": advice.replacement_id, "gate": advice.gate.distance}

func set_water(sim: RaceSim, amount: float) -> void:
	for column in sim.surface:
		for lane in column.lanes: lane.water = amount
	RaceSurface.profiles(sim.surface, sim.water, sim.rubber)

func test_weather_process() -> void:
	var a = WeekendWeather.create(42, "changeable")
	var b = a.duplicate(true); var different = WeekendWeather.create(43, "changeable")
	var trace_a: Array = []; var trace_b: Array = []; var trace_c: Array = []
	for i in range(12000):
		WeekendWeather.advance(a, "changeable", RaceSim.STEP); WeekendWeather.advance(b, "changeable", RaceSim.STEP); WeekendWeather.advance(different, "changeable", RaceSim.STEP)
		if i % 200 == 0: trace_a.append(a.rain); trace_b.append(b.rain); trace_c.append(different.rain)
	check(trace_a == trace_b and a == b, "Weather depends on equal seed and fixed-step count, not observation frequency")
	check(trace_a != trace_c, "Different seeds create different rain histories, not one memorized schedule")
	check(WeekendWeather.valid(a), "Weather process remains finite and bounded after 600 simulated seconds")
	var dry = WeekendWeather.create(42, "dry")
	for i in range(2000): WeekendWeather.advance(dry, "dry", RaceSim.STEP)
	check(dry.rain == 0, "Disclosed dry format stays dry")
	var sim = fixture(); var race_rng = sim.rng_state
	for i in range(200): sim.total_time += RaceSim.STEP; sim.update_surface()
	check(sim.rng_state == race_rng, "Authoritative weather consumes no driving/service random state")
	check(RaceSurface.valid(sim.surface, sim.water, sim.rubber), "Rain and surface overlays share the same authoritative field")
	check(sim.weather_state.history.size() >= 2, "Public measured samples accumulate at the simulation cadence")
	var saved = JSON.parse_string(JSON.stringify(a, "", false, true)); saved.rng = int(saved.rng)
	for i in range(1000): WeekendWeather.advance(a, "changeable", RaceSim.STEP); WeekendWeather.advance(saved, "changeable", RaceSim.STEP)
	check(equivalent(a, saved) and a.rng == saved.rng, "Saving the isolated weather stream cannot reroll its next transition")
	measurements.weather_trace_42 = trace_a

func test_information_boundary() -> void:
	var sim = fixture()
	var before = JSON.stringify(sim.snapshot())
	var first = sim.weather_advice(3)
	var start = Time.get_ticks_usec()
	for i in range(5):
		var repeated = sim.weather_advice(3)
		check(repeated == first, "Repeated weather comparison is deterministic %d" % i)
	measurements.five_comparisons_milliseconds = (Time.get_ticks_usec() - start) / 1000.0
	check(before == JSON.stringify(sim.snapshot()), "Comparing weather alternatives never changes live state, journal or either RNG")
	check(first.outlook.confidence.contains("baseline") and first.outlook.arrival.is_empty(), "Missing observations produce an explicit lower-information baseline, not invented timing")
	var observed = sim.weather_outlook()
	sim.weather_state.model.target = 1.0 - sim.weather_state.model.target
	sim.weather_state.model.remaining = 1
	sim.weather_state.model.rng = 99
	check(observed == sim.weather_outlook(), "Changing secret future targets and RNG cannot change the public forecast")
	check(first.options == sim.weather_advice(3).options, "Crossover advice cannot read secret weather targets")
	sim.cars[0].next_set_id = "0-W1"; sim.policy(0).plan = {"secret": true}
	check(first.options == sim.weather_advice(3).options, "Uncommitted rival plans do not leak into weather alternatives")
	var public = sim.weather_outlook()
	for key in ["rng", "target", "remaining", "seed", "future", "model"]: check(not public.has(key) and not public.observed.has(key), "Public boundary excludes " + key)
	var copied = public.observed.sectors.duplicate(); public.observed.sectors[0] = 1
	check(sim.weather_outlook().observed.sectors == copied, "Changing a returned observation cannot mutate the surface or observation history")
	var old = sim.weather_advice(3); sim.cars[0].route = "pit"
	check(sim.weather_stale(old), "A rival entering the pits invalidates weather rejoin advice")
	sim.cars[0].route = "track"; old = sim.weather_advice(3); sim.flag = "SAFETY CAR"
	check(sim.weather_stale(old), "A flag change invalidates a weather stop forecast")
	sim.flag = "GREEN"; old = sim.weather_advice(3); set_water(sim, 0.5)
	check(sim.weather_stale(old), "A changed surface invalidates stale green recommendations")
	old = sim.weather_advice(3); sim.total_time += 6
	check(sim.weather_stale(old), "Weather snapshots older than five simulated seconds are stale")
	var revision_sim = fixture(); revision_sim.total_time = 60
	revision_sim.weather_state.history.clear()
	var prior = revision_sim.weather_advice(3)
	var sample = revision_sim.weather_observation(); sample.time = 0
	sample.mean = 0.8; sample.sectors = [0.8, 0.8, 0.8]; sample.peak = 0.8; sample.off_line_peak = 0.8
	revision_sim.weather_state.history.append(sample)
	check(revision_sim.weather_stale(prior), "New trend evidence invalidates a displayed baseline even when current rain and surface are unchanged")
	prior = revision_sim.weather_advice(3)
	revision_sim.weather_state.history[0].mean = 0.0; revision_sim.weather_state.history[0].sectors = [0.0, 0.0, 0.0]
	check(revision_sim.weather_stale(prior), "Materially revised public trend invalidates a crossover without needing a current-rain change")
	var current = sim.weather_observation(); var anchor = current.duplicate(true)
	anchor.time = 0; anchor.mean = 0.7; anchor.sectors = [0.7, 0.7, 0.7]; anchor.cloud = 0.2
	current.time = 60; current.mean = 0.4; current.sectors = [0.3, 0.4, 0.5]; current.cloud = 0.55; current.rain = 0
	var trend = WeatherOutlook.evaluate([anchor], current, 32, "seeded")
	check(trend.trend == "drying" and trend.worst_sector == 2, "Forecast distinguishes falling rain from retained sector water")
	check(not trend.arrival.is_empty() and trend.arrival.low < trend.arrival.high, "Observed cloud trend produces an uncertain window, not a future schedule")

func test_crossover_relationships() -> void:
	var sim = fixture(24, "dry")
	set_water(sim, 0.8)
	var source = RaceForecaster.capture(sim, 3)
	var outlook = sim.weather_outlook()
	# Controlled constant-water stress fixtures test model relationships, not forecast calibration.
	for weather_case in outlook.cases: weather_case.water = 0.8
	var result = WeatherStrategy.evaluate(source, outlook)
	check(result.options.size() == 3 and result.options[1].compound in ["I", "W"], "Sustained wet running makes a legal wet-family replacement a relevant alternative")
	check(result.options[1].seconds < result.options[0].seconds, "Over enough distance a suitable wet tyre can recover full pit loss")
	var planned = result.options[1].stops
	var no_queue = WeatherStrategy.score(source, outlook, planned, 0.8)
	var blocked = source.duplicate(true)
	blocked.teammate = {"route":"pit", "pit_stage":"service", "pit_timer":100.0, "damage":0, "repair":false}
	var with_queue = WeatherStrategy.score(blocked, outlook, planned, 0.8)
	check(with_queue.seconds > no_queue.seconds and with_queue.pit_cost > no_queue.pit_cost, "A physically occupied teammate box reduces crossover value")
	check(source.own.inventory == RaceForecaster.capture(sim, 3).own.inventory, "Weather comparison spends no real tyre stock")
	var last = source.duplicate(true); last.own.distance = (sim.laps - 0.05) * sim.track.length
	last.gate.distance = (sim.laps + 0.1) * sim.track.length
	var late = WeatherStrategy.evaluate(last, outlook)
	check(late.replacement_id.is_empty() and late.options.size() == 1, "No weather stop is advertised after the final reachable entry")
	var no_stock = source.duplicate(true)
	for item in no_stock.own.inventory:
		if item.id != no_stock.own.starting_set:
			for wheel in item.wheels.values(): wheel.punctured = true
	check(WeatherStrategy.evaluate(no_stock, outlook).replacement_id.is_empty(), "Empty usable inventory yields no magical wet replacement")
	var long_race = source.duplicate(true); long_race.laps = 100
	var bounded = WeatherStrategy.evaluate(long_race, outlook)
	check(bounded.partial_horizon and bounded.horizon_laps == 24, "Long custom races disclose the bounded partial-horizon comparison")
	var private_rival = sim.weather_advice(0)
	check(private_rival.driver_id == 0 and private_rival.scope.contains("Observed"), "Rivals use the same observation-only weather model with their own resources")

func test_commands() -> void:
	var sim = fixture(); sim.speed = 8
	var advice = sim.weather_advice(3); var before = JSON.stringify(sim.snapshot())
	var invalid = request(advice); invalid.id = 0
	check(not sim.command("weather_box", invalid), "Player weather command cannot target a rival")
	check(before == JSON.stringify(sim.snapshot()), "Permission rejection leaves live gameplay unchanged")
	invalid = request(advice); invalid.set_id = "6-W1"
	check(not sim.command("weather_box", invalid) and before == JSON.stringify(sim.snapshot()), "Borrowing a teammate's weather set is rejected atomically")
	invalid = request(advice); invalid.gate += sim.track.length
	check(not sim.command("weather_box", invalid) and before == JSON.stringify(sim.snapshot()), "Stale safe-entry gate cannot silently redirect the stop")
	sim.cars[0].pit_stops += 1; before = JSON.stringify(sim.snapshot())
	check(not sim.command("weather_box", request(advice)) and before == JSON.stringify(sim.snapshot()), "An old weather card cannot issue an order after a rival stop")
	advice = sim.weather_advice(3)
	var owners = sim.policy(3).owners.duplicate(true); var plan = sim.policy(3).plan.duplicate(true)
	check(sim.command("weather_hold", request(advice)), "Keep plan acknowledges a current weather decision")
	check(sim.policy(3).owners == owners and sim.policy(3).plan == plan and not sim.cars[3].pit_order, "Weather acknowledgement changes neither ownership nor approved plans")
	check(not sim.paused and sim.speed == 8 and sim.weather_state.held[3] == WeatherStrategy.decision_key(advice), "A warning or hold never pauses or slows the race")
	advice = sim.weather_advice(6); var mounted = sim.cars[6].set_id
	check(sim.command("weather_box", request(advice)), "A fresh weather call orders the named driver's real next safe entry")
	check(sim.cars[6].pit_order and not sim.cars[3].pit_order and sim.cars[6].set_id == mounted, "Weather call retains mounted set until physical service and cannot drift to selection")
	check(sim.policy(6).owners.pit == "player" and sim.policy(6).owners.engine == "engineer" and sim.policy(6).owners.pace == "engineer", "Only pit ownership is taken by a manual weather stop")
	check(sim.strategy_state.records.any(func(r): return r.kind == "weather_decision" and r.driver_id == 6 and r.evidence.has("gain_low")), "Journal records at-call observations and estimated alternatives")
	check("not a measured alternative" in sim.weather_debrief(), "Debrief never labels a forecast gain as a measured alternate result")
	before = JSON.stringify(sim.snapshot())
	check(not sim.command("weather_hold", request(sim.weather_advice(6))) and before == JSON.stringify(sim.snapshot()), "A committed pit order cannot be canceled through Keep plan")
	var planned_sim = fixture(); var p = StrategyPlan.draft(planned_sim.cars[3], planned_sim.laps, "no_stop"); p.starting_set = planned_sim.cars[3].set_id
	check(planned_sim.command("approve_plan", {"id":3,"revision":0,"plan":p}), "Explicit no-stop ownership fixture is approved")
	set_water(planned_sim, 0.85); planned_sim.engineer(planned_sim.cars[3])
	check(not planned_sim.cars[3].pit_order and planned_sim.policy(3).plan == p, "Weather AI cannot rewrite a binding approved plan")
	var delegated = fixture(12, "wet")
	delegated.command("delegation", {"id":3,"channel":"pit","owner":"engineer"})
	delegated.manage_resources(delegated.cars[3])
	var kept = delegated.weather_advice(3)
	check(delegated.command("weather_hold", request(kept)), "Keep plan is also available without taking delegated pit ownership")
	delegated.engineer(delegated.cars[3])
	check(not delegated.cars[3].pit_order and delegated.policy(3).owners.pit == "engineer", "A retained unplanned weather choice is honored until material assumptions change")

func test_persistence() -> void:
	var sim = fixture()
	for i in range(80): sim.step()
	var data = JSON.parse_string(JSON.stringify(sim.snapshot(), "", false, true))
	var loaded = WeatherRaceSim.restore_weather(data)
	check(data.version == 7 and loaded != null, "Checkpoint v7 restores weather, live policies, teams and battles")
	if loaded != null:
		for i in range(500): sim.step(); loaded.step()
		check(equivalent(sim.weather_state, loaded.weather_state) and sim.rng_state == loaded.rng_state, "Save/load preserves weather targets, observation cadence and both random streams")
		check(equivalent(sim.cars, loaded.cars), "Restored fixed-step continuation preserves car outcomes within 1e-8 numeric tolerance")
		check(equivalent(sim.strategy_state, loaded.strategy_state), "Restored observations and decisions retain stable journal identity")
	for key in ["rng", "remaining", "cloud", "target", "rain"]:
		var corrupt = data.duplicate(true); corrupt.weather_state.model[key] = -1
		check(WeatherRaceSim.restore_weather(corrupt) == null, "Corrupt weather " + key + " is rejected before replacing the session")
	var corrupt = data.duplicate(true); corrupt.weather_state.history[0].time = data.total_time + 1
	check(WeatherRaceSim.restore_weather(corrupt) == null, "Future-dated observations cannot be loaded")
	corrupt = data.duplicate(true); corrupt.weather_state.reviews.pop_back()
	check(WeatherRaceSim.restore_weather(corrupt) == null, "Malformed per-driver weather ownership memory is rejected")
	var old = StrategyRaceSim.new(geometry, {"laps":12,"scenario":"wet","seed":123})
	var migrated = WeatherRaceSim.restore_weather(old.snapshot())
	check(migrated != null and migrated.weather_state.model.mode == "scripted_training" and migrated.weather_state.history.is_empty(), "v6 migration explicitly retains legacy schedule without fabricated old observations")
	if migrated != null:
		old.command("prepare_race"); migrated.command("prepare_race"); old.command("formation"); migrated.command("formation")
		for i in range(400): old.step(); migrated.step()
		check(old.rain == migrated.rain and old.surface == migrated.surface and old.rng_state == migrated.rng_state and old.cars == migrated.cars, "Legacy migration cannot reroll physical weather, inventory or movement")
		check(WeatherRaceSim.restore_weather(migrated.snapshot()) != null, "Migrated v7 checkpoint is valid")
	var native = RaceSim.new(geometry, {"scenario":"dry"})
	check(WeatherRaceSim.restore_weather(native.snapshot()) != null, "Native v4 saves remain loadable through the application weather loader")

func test_physical_execution() -> void:
	var sim = fixture(8, "wet")
	var c = sim.cars[3]; var before_set = c.set_id
	var advice = sim.weather_advice(3)
	check(sim.command("weather_box", request(advice)), "Physical integration fixture accepts a weather stop")
	var restored = WeatherRaceSim.restore_weather(JSON.parse_string(JSON.stringify(sim.snapshot(), "", false, true)))
	check(restored != null and restored.cars[3].pit_order, "Pending weather stop and at-call evidence survive JSON reload")
	var completed = false
	for i in range(6000):
		sim.step()
		if c.pit_stops > 0 and c.route == "track": completed = true; break
	check(completed and c.set_id == advice.replacement_id and c.set_id != before_set, "A weather call executes entry, queue, service and exit before mounting the chosen set")
	check(sim.strategy_state.records.any(func(r): return r.kind == "pit_exit" and r.driver_id == 3 and r.evidence.has("visit_seconds")), "Weather debrief is backed by a measured physical visit")
	check(WeatherRaceSim.restore_weather(sim.snapshot()) != null, "Completed weather service, wheel stock and journal restore intact")
	var broken_record = sim.snapshot()
	for record in broken_record.strategy_state.records:
		if record.kind == "weather_decision": record.evidence.erase("observed"); break
	check(WeatherRaceSim.restore_weather(broken_record) == null, "Malformed weather evidence is rejected before it can break the debrief")
	var visits = sim.strategy_state.records.filter(func(r): return r.kind == "pit_exit" and r.driver_id == 3)
	if not visits.is_empty(): measurements.weather_pit_visit = visits[0].evidence

func test_scenarios() -> void:
	var recipes = WeatherScenarios.catalog(); var library = Storage.read_catalog().data
	check(recipes.size() == 3, "Three weather-learning scenarios are installed")
	for recipe in recipes:
		check(WeatherScenarios.valid(recipe), "Weather recipe validates: " + recipe.id)
		var sim = WeatherScenarios.build(recipe, library)
		check(sim != null and sim.phase == "briefing" and sim.intensity == "calm", "Scenario retains approvals and disclosed assists: " + recipe.id)
		if sim == null: continue
		check(sim.policy(3).owners.pit == recipe.pit_owner and sim.policy(6).owners.pit == recipe.pit_owner, "Both cars' intended pit owners are explicit: " + recipe.id)
		check(WeatherRaceSim.restore_weather(sim.snapshot()) != null, "Weather scenario provenance persists: " + recipe.id)
		check(recipe.hint in WeekendScenarios.briefing(sim), "Scenario teaching premise reaches the player: " + recipe.id)
	var invalid = recipes[0].duplicate(true); invalid.weather_mode = "secret_script"
	check(WeatherScenarios.build(invalid, library) == null, "Unknown or undisclosed weather modes cannot enter a scenario")

func equivalent(a: Variant, b: Variant) -> bool:
	# JSON floating-point parsing is compared at the native suite's numerical contract,
	# not falsely described as cross-platform binary identity. Discrete fields remain exact.
	if a is Dictionary and b is Dictionary:
		if a.size() != b.size(): return false
		for key in a:
			if not b.has(key) or not equivalent(a[key], b[key]): return false
		return true
	if a is Array and b is Array:
		if a.size() != b.size(): return false
		for i in range(a.size()):
			if not equivalent(a[i], b[i]): return false
		return true
	if (a is float or a is int) and (b is float or b is int): return absf(float(a) - float(b)) <= 0.00000001
	return a == b
