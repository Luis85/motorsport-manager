extends SceneTree
## Complete physical qualification/formation, paired recovery runs, and live neutralization.
var checks = 0
var failures: Array[String] = []
var steps = 0
var runs: Array = []
func _initialize() -> void: call_deferred("run")
func check(value: bool, message: String) -> void:
	checks += 1
	if not value: failures.append(message); push_error(message)
func until(sim: RaceSim, phase: String, limit: int) -> bool:
	for i in range(limit):
		if sim.phase == phase: return true
		sim.step(); steps += 1
	return sim.phase == phase
func start_race(sim: RaceSim) -> void:
	check(sim.command("prepare_race") and sim.command("formation"), "Preparation and formation approvals succeed")
	check(until(sim, "grid_ready", 18000) and sim.command("lights") and until(sim, "race", 200), "Physical formation and lights reach the racing phase")
func report_run(sim: RecoveryRaceSim, name: String) -> void:
	runs.append({"name":name,"laps":sim.laps,"race_time":sim.race_time,"faults":sim.reliability_state.drivers.reduce(func(n,r): return n+r.faults,0),
		"classification":sim.standings().map(func(c): return {"id":c.id,"driver":c.short,"finished":c.finished,"retired":c.dnf,"reason":c.retire_reason,"time":c.finish_time,"laps":c.completed,"stops":c.pit_stops,"health":c.health,"damage":c.damage})})
func run() -> void:
	var started = Time.get_ticks_msec(); var library = Storage.read_catalog().data
	var recipes = RecoveryScenarios.catalog()
	check(recipes.size() == 2, "Two playable, disclosed recovery premises are installed")
	for recipe in recipes:
		check(RecoveryScenarios.valid(recipe) and RecoveryScenarios.build(recipe,library) != null, "Scenario validates: " + recipe.id)
	var sim = RecoveryScenarios.build(recipes[0], library)
	check(sim.command("qualify") and until(sim,"qualifying_results",40000), "Damaged cars finish physical out/hot/in qualifying")
	check(sim.cars[3].qual_best > 0 and sim.cars[6].qual_best > 0, "Both player cars bank valid measured laps")
	sim = RecoveryRaceSim.restore_recovery(JSON.parse_string(JSON.stringify(sim.snapshot(), "", false, true)))
	check(sim != null, "Damaged qualifying state reloads at the approval gate")
	if sim == null: finish(started); return
	start_race(sim)
	var checkpoint = sim.snapshot(); var branch = RecoveryRaceSim.restore_recovery(checkpoint)
	var advice = branch.recovery_advice(3)
	check(branch.command("recovery_repair", {"id":3,"time":advice.time,"key":advice.key,"gate":advice.gate.distance}), "Repair branch makes one named physical repair call")
	check(until(sim,"results",60000) and until(branch,"results",60000), "Both protect/repair branches reach final classification")
	for pair in [[sim,"keep orders"],[branch,"repair MER"]]:
		var model = pair[0]
		check(model.cars.all(func(c): return c.finished or c.dnf), "No unclassified entrant or deadlock in " + pair[1])
		check(model.cars[3].finished and model.cars[6].finished, "Both damaged cars can finish in " + pair[1])
		check(RecoveryRaceSim.restore_recovery(model.snapshot()) != null, "Final recovery result restores in " + pair[1])
		report_run(model,pair[1])
	check(branch.cars[3].pit_stops > sim.cars[3].pit_stops and branch.cars[3].damage < sim.cars[3].damage, "Repair branch pays for an additional measured visit and removes damage")
	check(not is_equal_approx(sim.cars[3].finish_time,branch.cars[3].finish_time), "Alternative decisions produce genuinely different measured results")
	# One standard-incidence run exercises staged evolution rather than only calm learning content.
	var standard = RecoveryRaceSim.new(TrackGeometry.new(library[7]), {"laps":12,"seed":811,"scenario":"dry","intensity":"standard"})
	start_race(standard)
	standard.cars[3].damage = 56; standard.cars[3].health = 70; standard.observe_reliability(standard.cars[3])
	standard.command("recovery_authority", {"id":3,"revision":standard.reliability(3).revision,"value":"repair","budget":12})
	standard.retire(standard.cars[0],"Barrier impact") # Explicit adversarial fixture, not a shipped scripted event.
	check(until(standard,"results",60000), "Standard staged recovery and a real clearance hazard complete without deadlock")
	check(standard.strategy_state.records.any(func(r): return r.kind == "race_control" and r.evidence.after.state == "virtual") and standard.strategy_state.records.any(func(r): return r.kind == "race_control" and r.evidence.after.state == "ending"), "The completed fixture exercised virtual deployment and its ending phase")
	check(standard.cars[3].pit_stops > 0 and standard.cars[3].damage < 55, "Bounded delegated critical repair performs an actual service")
	check(RecoveryRaceSim.restore_recovery(standard.snapshot()) != null, "Standard outcome retains fault streams, rule state and journal")
	report_run(standard,"standard / disclosed test hazard")
	finish(started)
func finish(started: int) -> void:
	var report = {"passed":failures.is_empty(),"checks":checks,"failures":failures,"runs":runs,"fixed_steps":steps,"elapsed_seconds":(Time.get_ticks_msec()-started)/1000.0,"engine":Engine.get_version_info().string,"cpu":OS.get_processor_name(),"limitations":"Small deterministic suite, not a balance study. A test-only barrier retirement and critical condition exercise recovery/control; shipped recipes disclose initial condition and do not force hazards or winners."}
	Storage.write_json("res://reports/recovery-scenarios.json",report); print("RECOVERY_SCENARIOS ",JSON.stringify(report));quit(0 if failures.is_empty() else 1)
