extends SceneTree
## Reproducible full-race comparisons. Curated starts, not scripted outcomes.
var checks = 0
var failures: Array[String] = []
var runs: Array = []
var total_steps = 0
func _initialize() -> void: call_deferred("run")
func check(value: bool, message: String) -> void:
	checks += 1
	if not value: failures.append(message); push_error(message)
func advance(sim, phase: String, budget: int) -> bool:
	for i in range(budget):
		if sim.phase == phase: return true
		sim.step(); total_steps += 1
	return sim.phase == phase
func json_copy(value): return JSON.parse_string(JSON.stringify(value,"",false,true))
func run_case(recipe: Dictionary, policy: String, legacy: bool) -> void:
	var sim = DuelScenarios.build(recipe, Storage.read_catalog().data)
	if sim == null: check(false,"Scenario construction: " + recipe.id); return
	# Optional baseline retains exactly the declared grid/resources but uses legacy AI
	# and explicit ordinary pit windows rather than retrofitting an old replay.
	if legacy: sim.duel_state = TacticalDuels.create(sim.cars,false)
	var expected = {}
	for id in [3,6]:
		check(sim.command("pace",{"id":id,"value":0}), "Explicit conserve baseline")
		check(sim.command("engine",{"id":id,"value":0}), "Explicit fuel-saving baseline")
	var start = maxi(1, int(recipe.laps*0.25))
	if policy != "retain":
		var p = TacticalForecast.draft(sim,3, "undercut" if policy == "early" else "extend")
		p.from_lap=start; p.to_lap=mini(sim.laps-1,start+3); p.target_id=0
		p.authority="execute"; p.rival_first=false; p.avoid_traffic=false; p.fuel_reserve=0.0; p.tyre_floor=5.0
		var forecast=TacticalForecast.preview(sim,3,p)
		expected=forecast.duplicate(true)
		check(forecast.available,"Candidate can be compared: " + recipe.id + "/" + policy)
		if legacy:
			var normal=StrategyPlan.draft(sim.cars[3],sim.laps,"no_stop")
			var lap=start+(0 if policy=="early" else 2)
			normal.stops=[{"from_lap":lap,"to_lap":lap,"set_id":p.set_id}];normal.branches=[]
			check(sim.command("approve_plan",{"id":3,"revision":sim.policy(3).revision,"plan":normal}),"Ordinary baseline window accepted")
		else:
			check(sim.command("duel_approve",{"id":3,"plan":p,"revision":sim.duel_state.drivers[3].revision,"policy_revision":sim.policy(3).revision,"key":forecast.key,"time":forecast.time}),"Tactical policy explicitly accepted")
	check(sim.command("formation") and advance(sim,"grid_ready",20000),"Formation physically completes: " + recipe.id)
	check(sim.command("lights") and advance(sim,"race",1000),"Explicit lights reach the race")
	var record=RaceRecord.new();record.attach(sim)
	check(advance(sim,"results",100000),"Full race terminates: " + recipe.id + "/" + policy)
	check(sim.cars.all(func(c):return c.finished or c.dnf),"Every car has an authoritative terminal status")
	check(PracticeRaceSim.restore_practice(json_copy(sim.snapshot()))!=null,"Final state validates, including tactical lifecycle and rival diagnostics")
	var result=WeekendResult.build(record)
	check(not result.is_empty() and WeekendResult.validate(json_copy(result)).is_empty(),"Completed v10/v11 result envelope validates")
	check(NotebookEntry.validate(json_copy(NotebookEntry.build(record))),"Completed race remains compatible with the existing opt-in notebook")
	var players: Array=[]
	for id in [3,6]:
		var c=sim.cars[id];var r=TacticalDuels.current(sim,id)
		players.append({"driver":c.short,"position":sim.standings().find(c)+1,"laps":c.completed,"finished":c.finished,"retired":c.dnf,
			"finish_time":c.finish_time,"tyre":c.tyre,"fuel":c.fuel,"stops":c.pit_stops,"tactic_status":r.get("status","none"),"reason":r.get("reason","")})
	var visits: Array=[]
	for e in sim.strategy_state.records:
		if e.kind=="pit_exit" and e.driver_id==3:visits.append(e.evidence)
	var output={"scenario":recipe.id,"track_hash":RaceRecord.fingerprint(sim.track.document),"laps":recipe.laps,"seed":recipe.seed,"fitted_tread":recipe.life,
		"policy":policy,"legacy":legacy,"model":RaceRecord.model_for(sim.snapshot()),"players":players,"visits":visits,
		"forecast":expected.get("candidate",{}),"rival_responses":sim.rival_styles.history.map(func(d):return {"driver":d.driver_id,"choice":d.choice,"reason":d.reason})}
	runs.append(output)
	Storage.write_json("res://reports/duel-matrix-progress.json",runs)
	print("DUEL_RUN ",JSON.stringify({"scenario":recipe.id,"policy":policy,"legacy":legacy,"players":players}))
func run() -> void:
	var started=Time.get_ticks_msec()
	var legacy=OS.get_cmdline_user_args().has("--legacy-baseline")
	for recipe in DuelScenarios.catalog():
		for policy in ["retain","early","extend"]:run_case(recipe,policy,legacy)
	check(runs.size()==12,"Four disclosed circuits/formats each exercise three explicit policies")
	var report={"passed":failures.is_empty(),"checks":checks,"errors":failures,"runs":runs,"fixed_steps":total_steps,
		"elapsed_seconds":(Time.get_ticks_msec()-started)/1000.0,"cpu":OS.get_processor_name(),"engine":Engine.get_version_info().string,
		"scope":"Four recipes, three geometries, 6/12/16/24 laps; one seed per recipe. Different distances must not be compared as equal-distance race times. No universal balance, calibrated probabilities or human engagement claim."}
	Storage.write_json("res://reports/duel-baseline-matrix.json" if legacy else "res://reports/duel-scenarios.json",report)
	print("DUEL_SCENARIOS ",JSON.stringify({"passed":report.passed,"checks":checks,"errors":failures,"fixed_steps":total_steps,"elapsed_seconds":report.elapsed_seconds}))
	quit(0 if failures.is_empty() else 1)
