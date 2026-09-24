extends SceneTree
## Full native qualification-to-result runs. Findings are calibration evidence, not a balance claim.
var checks = 0
var failures: Array[String] = []
var runs: Array = []
var total_steps = 0
func _initialize() -> void: call_deferred("run")
func check(value: bool, message: String) -> void:
	checks += 1
	if not value: failures.append(message); push_error(message)
func advance(sim: RaceSim, target: String, budget: int) -> bool:
	for i in range(budget):
		if sim.phase == target: return true
		sim.step(); total_steps += 1
	return sim.phase == target
func run() -> void:
	var started = Time.get_ticks_msec()
	var recipe = WeekendScenarios.catalog()[0]
	var base = WeekendScenarios.build(recipe, Storage.read_catalog().data)
	check(base.command("qualify"), "A strategy scenario starts ordinary physical qualifying")
	check(advance(base, "qualifying_results", 40000), "Delegated qualifying completes with the new release forecast")
	check(base.cars[3].qual_best > 0 and base.cars[6].qual_best > 0, "Both player drivers bank valid measured qualifying attempts")
	var source = base.snapshot()
	for variant in ["split_one_stop", "hard_no_stop"]:
		var sim = StrategyRaceSim.restore_weekend(source)
		check(sim != null and sim.command("prepare_race"), "Saved qualifying state branches into preparation: " + variant)
		if variant == "hard_no_stop":
			var plan = StrategyPlan.draft(sim.cars[3], sim.laps, "no_stop"); plan.starting_set = "3-H1"; plan.objective = "protect_finish"
			check(sim.command("approve_plan", {"id":3,"revision":sim.policy(3).revision,"plan":plan}), "The alternate route is an explicit new strategy, not a hidden performance change")
		check(sim.command("formation") and advance(sim,"grid_ready",15000), "Physical formation reaches approval gate: " + variant)
		check(sim.command("lights") and advance(sim,"results",80000), "The full 24-lap race classifies every entrant: " + variant)
		check(sim.cars[3].finished and not sim.cars[3].dnf and sim.cars[6].finished and not sim.cars[6].dnf, "Both player strategies remain capable of finishing this dry scenario: " + variant)
		check(sim.cars[3].pit_stops == (1 if variant == "split_one_stop" else 0), "Physical stop count matches the selected strategy: " + variant)
		check(sim.policy(6).next_stop == 1, "The second driver's approved window executes independently: " + variant)
		check(StrategyRaceSim.restore_weekend(sim.snapshot()) != null, "Completed strategy and classification save validates: " + variant)
		var visits: Array = []
		for record in sim.strategy_state.records:
			if record.kind == "pit_exit" and record.driver_id in [3,6]: visits.append(record.evidence.duplicate(true))
		runs.append({"variant":variant,"track":sim.track.document.id,"laps":sim.laps,"seed":sim.seed_value,"mer_position":sim.standings().find(sim.cars[3])+1,"mer_finish_time":sim.cars[3].finish_time,"mor_finish_time":sim.cars[6].finish_time,"mer_stops":sim.cars[3].pit_stops,"visits":visits,"journal_records":sim.strategy_state.records.size()})
	check(runs.size() == 2 and runs[0].mer_finish_time != runs[1].mer_finish_time, "Two explicit viable approaches have different measured outcomes; no winner is scripted")
	var report = {"passed":failures.is_empty(),"checks":checks,"errors":failures,"engine":Engine.get_version_info().string,"cpu":OS.get_processor_name(),"elapsed_seconds":(Time.get_ticks_msec()-started)/1000.0,"fixed_steps":total_steps,"runs":runs,"limitations":"One declared circuit and seed; branches alter tyre state and competitive exposure. Not a calibrated probability test, universal balance result, or campaign-settlement replay feature."}
	Storage.write_json("res://reports/strategy-scenarios.json",report)
	print("STRATEGY_SCENARIOS ",JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
