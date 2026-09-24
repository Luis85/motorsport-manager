extends SceneTree
## Disclosed scenario starts followed by physical formation, service and classification.
var checks=0
var failures: Array[String]=[]
var fixed_steps=0
var outcomes:Array=[]
func _initialize():call_deferred("run")
func check(value:bool,message:String):
	checks+=1
	if not value:failures.append(message);push_error(message)
func advance(sim:PracticeRaceSim,target:String,budget:int=25000)->bool:
	for i in range(budget):
		if sim.phase==target:return true
		sim.step();fixed_steps+=1
	return sim.phase==target
func run():
	var started=Time.get_ticks_msec();var library=Storage.read_catalog().data
	for recipe in RivalScenarios.catalog():
		var initial=RivalScenarios.build(recipe,library)
		check(initial!=null and initial.phase=="race_preparation",recipe.id+" has a disclosed preparation start")
		check(initial.cars.all(func(c):return c.qual_best==0 and c.qual_history.is_empty()),"Curated grid cannot fabricate measured qualifying history")
		check(PracticeRaceSim.restore_practice(initial.snapshot())!=null,"Initial scenario is a valid persisted weekend")
		check(initial.command("formation") and advance(initial,"grid_ready") and initial.command("lights") and advance(initial,"race"),"Formation and start use physical execution and explicit approvals")
		check(initial.cars.all(func(c):return c.set_id.ends_with("M1") and c.tyre<recipe.life),"Physical formation retains the disclosed used starting sets")
		var checkpoint=JSON.parse_string(JSON.stringify(initial.snapshot(),"",false,true))
		for approach in ["conserve","early-offset"]:
			var sim=PracticeRaceSim.restore_practice(checkpoint)
			check(sim!=null,"Race-start checkpoint restores for a disclosed alternative comparison")
			if sim==null:continue
			if approach=="conserve":
				for id in [3,6]:sim.command("pace",{"id":id,"value":0})
			else:
				# One deliberately early manual stop, not a claimed optimal policy.
				sim.command("pit",{"id":3})
				# Keep MOR on a lower-demand intent rather than stacking the same box.
				sim.command("pace",{"id":6,"value":0})
			check(advance(sim,"results"),"Physical race reaches classification: "+recipe.id+" / "+approach)
			check(sim.cars.all(func(c):return c.finished or c.dnf),"No active entrant is lost from classification")
			check(sim.cars[3].finished and sim.cars[6].finished,"Both player approaches retain a viable two-car finish")
			check(PracticeRaceSim.restore_practice(sim.snapshot())!=null,"Completed result and bounded rival state restore")
			check(not sim.rival_styles.history.is_empty() and sim.rival_state.stops.size()>0,"Full race exercises contextual reviews and observed real stops")
			var order=sim.standings()
			outcomes.append({"scenario":recipe.id,"approach":approach,"simulated_time":sim.total_time,
				"players":[3,6].map(func(id):return {"driver":sim.cars[id].short,"position":order.find(sim.cars[id])+1,"laps":sim.cars[id].completed,"finished":sim.cars[id].finished,"stops":sim.cars[id].pit_stops,"tyre":sim.cars[id].tyre}),
				"rival_reviews":sim.rival_styles.drivers.map(func(d):return d.reviews),"retained_choices":sim.rival_styles.history.map(func(d):return {"driver":d.driver_id,"time":d.time,"choice":d.choice})})
	var report={"passed":failures.is_empty(),"checks":checks,"failures":failures,"fixed_steps":fixed_steps,"elapsed_seconds":(Time.get_ticks_msec()-started)/1000.0,"outcomes":outcomes,
		"limits":"Two dry seeds, four full race branches. Approaches are feasible alternatives, not calibrated optima or proof of enjoyment. No injected incident or forced winner."}
	Storage.write_json("res://reports/rival-scenarios.json",report);print("RIVAL_SCENARIOS ",JSON.stringify(report));quit(0 if failures.is_empty() else 1)
