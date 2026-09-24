extends SceneTree
## One complete seeded wet weekend plus a same-checkpoint continuation under changed presentation.
var checks = 0
var failures: Array[String] = []
var steps = 0
func _initialize() -> void: call_deferred("run")
func check(value: bool, message: String) -> void:
	checks += 1
	if not value: failures.append(message); push_error(message)
func advance(sim: RaceSim, phase: String, budget: int) -> bool:
	for i in range(budget):
		if sim.phase == phase: return true
		sim.step(); steps += 1
	return sim.phase == phase
func run() -> void:
	var started = Time.get_ticks_msec()
	var recipe = WeatherScenarios.catalog()[1]
	var sim = WeatherScenarios.build(recipe, Storage.read_catalog().data)
	check(sim.command("qualify") and advance(sim, "qualifying_results", 40000), "Seeded wet qualifying completes through physical out/hot/in laps")
	check(sim.cars[3].qual_best > 0 and sim.cars[6].qual_best > 0, "Both drivers record a measured wet qualifying time")
	var source = JSON.parse_string(JSON.stringify(sim.snapshot(), "", false, true))
	sim = WeatherRaceSim.restore_weather(source)
	check(sim != null and sim.command("prepare_race"), "Weather, inventory and public history restore at the qualifying approval gate")
	check(sim.command("formation") and advance(sim, "grid_ready", 15000), "Physical wet formation reaches explicit grid approval")
	check(sim.command("lights") and advance(sim, "race", 200), "The player releases the start lights without weather auto-pause")
	var saved = sim.snapshot()
	var observed = WeatherRaceSim.restore_weather(saved)
	observed.speed = 16
	for i in range(250):
		sim.step(); observed.step()
		if i % 50 == 0: observed.weather_advice(3); observed.weather_advice(6)
	check(sim.cars == observed.cars and sim.weather_state == observed.weather_state and sim.rng_state == observed.rng_state, "Equal fixed steps ignore display speed and repeated forecast queries")
	check(advance(sim, "results", 80000), "The full 24-lap seeded weather race reaches stable classification")
	check(sim.cars.all(func(c): return c.finished or c.dnf), "Every entrant finishes or is classified retired without deadlock")
	check(WeatherRaceSim.restore_weather(sim.snapshot()) != null, "Completed wet race including decision evidence is a valid checkpoint")
	var calls = sim.strategy_state.records.filter(func(r): return r.kind == "weather_decision")
	var visits = sim.strategy_state.records.filter(func(r): return r.kind == "pit_exit")
	check(not calls.is_empty() and not visits.is_empty(), "Seeded full-weekend play exercises actual crossover calls and physical stops")
	var report = {"passed":failures.is_empty(),"checks":checks,"failures":failures,"engine":Engine.get_version_info().string,
		"cpu":OS.get_processor_name(),"fixed_steps":steps,"elapsed_seconds":(Time.get_ticks_msec()-started)/1000.0,
		"scenario":recipe.id,"seed":recipe.seed,"laps":sim.laps,"weather_calls":calls.size(),"pit_visits":visits.size(),
		"classification":sim.standings().map(func(c): return {"driver":c.short,"finished":c.finished,"retired":c.dnf,"laps":c.completed,"stops":c.pit_stops}),
		"limitations":"One seeded scenario; neither a balance proof, an accessibility certification nor calibrated weather probability coverage."}
	Storage.write_json("res://reports/weather-scenario.json",report);print("WEATHER_SCENARIO ",JSON.stringify(report));quit(0 if failures.is_empty() else 1)
