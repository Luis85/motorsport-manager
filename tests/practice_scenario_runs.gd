extends SceneTree
## Real practice -> qualifying -> formation -> race. No forced pass or winning outcome.
var checks = 0
var failures: Array[String] = []
var steps = 0
func _initialize() -> void: call_deferred("run")
func check(value: bool, message: String) -> void:
	checks += 1
	if not value: failures.append(message); push_error(message)
func advance(sim: PracticeRaceSim, predicate: Callable, budget: int = 40000) -> bool:
	for i in range(budget):
		if predicate.call(): return true
		sim.step(); steps += 1
	return predicate.call()
func run() -> void:
	var started = Time.get_ticks_msec()
	var sim = PracticeScenarios.build(PracticeScenarios.catalog()[0],Storage.read_catalog().data)
	check(sim != null and sim.command("practice_start"), "Curated practice recipe starts only through explicit approval")
	for id in [3,6]:
		var candidate = {"objective":"tyre_life" if id == 3 else "qualifying","set_id":"%d-M1"%id,"laps":2 if id==3 else 1,"baseline":"current"}
		var preview = sim.run_preview(id,candidate)
		check(sim.command("practice_run",{"id":id,"plan":candidate,"revision":preview.revision,"time":preview.time,"key":preview.key}), "Both drivers receive distinct explicit run objectives")
	check(advance(sim,func(): return sim.practice_driver(3).active.is_empty() and sim.practice_driver(6).active.is_empty()), "Both practice plans finish through the normal physical field")
	var measured = [sim.practice_driver(3).runs[0].samples.size(),sim.practice_driver(6).runs[0].samples.size()]
	check(measured == [2,1], "Independent measured objectives are completed, not copied across drivers")
	check(sim.cars[3].qual_best==0 and sim.cars[6].qual_best==0, "Practice times cannot populate the qualifying grid")
	check(sim.command("practice_end") and advance(sim,func(): return sim.phase=="practice_results"), "Explicit practice ending returns every participating car")
	var source = JSON.parse_string(JSON.stringify(sim.snapshot(),"",false,true))
	sim = PracticeRaceSim.restore_practice(source)
	check(sim != null, "Complete practice state restores at its review gate")
	if sim == null: finish(started,{},measured); return
	check(sim.command("practice_finish") and sim.command("qualify"), "Player review preserves the original qualifying approval")
	check(advance(sim,func(): return sim.phase=="qualifying_results"), "Actual timed qualifying completes after practice")
	check(sim.cars[3].qual_best>0 and sim.cars[6].qual_best>0 and sim.cars[3].qual_runs>0, "Both qualifying results come from subsequent measured flying laps")
	check(sim.command("prepare_race") and sim.command("formation"), "Race preparation and formation remain explicit")
	check(advance(sim,func(): return sim.phase=="grid_ready") and sim.command("lights"), "Physical formation reaches player-approved start lights")
	check(advance(sim,func(): return sim.phase=="results"), "Complete practice-to-race weekend reaches stable classification")
	check(sim.cars[3].finished and sim.cars[6].finished, "Both player cars finish the calm 12-lap practice scenario")
	check(PracticeRaceSim.restore_practice(sim.snapshot())!=null, "Race results retain a valid practice notebook and physical resource history")
	check(sim.practice_driver(3).runs[0].samples.size()==2 and sim.practice_driver(6).runs[0].samples.size()==1, "Race completion does not overwrite prior practice evidence")
	var outcome = {"classification":sim.standings().map(func(c): return {"driver":c.short,"laps":c.completed,"finished":c.finished,"retired":c.dnf,"stops":c.pit_stops}),"journal_records":sim.strategy_state.records.size()}
	finish(started,outcome,measured)
func finish(started: int, outcome: Dictionary, measured: Array) -> void:
	var report = {"passed":failures.is_empty(),"checks":checks,"failures":failures,"fixed_steps":steps,"elapsed_seconds":(Time.get_ticks_msec()-started)/1000.0,"engine":Engine.get_version_info().string,"cpu":OS.get_processor_name(),"measured_player_laps":measured,"outcome":outcome,"limitations":"One dry scenario and seed. Does not prove broad balance, forecast coverage, human comprehension or universal practice advantage."}
	Storage.write_json("res://reports/practice-scenario.json",report);print("PRACTICE_SCENARIO ",JSON.stringify(report));quit(0 if failures.is_empty() else 1)
