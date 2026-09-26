extends "res://tests/rival_styles_tests.gd"
## Additional explicit synthetic boundaries; no result or human-playtest claims.
func approve(sim: PracticeRaceSim, p: Dictionary) -> bool:
	var f = TacticalForecast.preview(sim,3,p)
	return sim.command("duel_approve",{"id":3,"plan":p,"revision":sim.duel_state.drivers[3].revision,"policy_revision":sim.policy(3).revision,"key":f.key,"time":f.time})
func new_fixture() -> PracticeRaceSim:
	var sim=fixture(70)
	sim.duel_state=TacticalDuels.create(sim.cars,true)
	for c in sim.cars: c.route="track"
	sim.command("auto",{"id":3,"value":false})
	return sim
func plan(sim: PracticeRaceSim) -> Dictionary:
	var p=TacticalForecast.draft(sim,3);p.authority="execute";p.avoid_traffic=false;p.rival_first=false;p.fuel_reserve=0.0;p.tyre_floor=5.0
	return p
func run() -> void:
	geometry=TrackGeometry.new(Storage.read_catalog().data[7])
	var sim=fixture();var s=RaceForecaster.capture(sim,1);s.time=10
	var f=RaceForecaster.evaluate(s)
	# Controlled candidate times isolate response logic; live geometry/resources stay intact.
	for option in f.options: option.available=true;option.risk="lower";option.seconds=100.0
	f.pit.traffic=[];f.pit.queue=0;f.pit.position=1
	var event={"event_id":"rw-123","driver_id":0,"short":"VAL","time":10.0,"distance":s.own.distance,"lap_seconds":s.reference_lap}
	var driver={"style":"undercut","weights":RivalStyles.profile("undercut")}
	var gain=RivalStyles.context(s,[],f).fresh_lap_gain
	f.pit.warmup=gain*0.5
	var d=DuelRivalPolicy.decide(s,[event],driver,f)
	check(d.choice=="box" and d.reason.begins_with("Cover"),"Credible observed entry receives a feasible covering response")
	f.pit.warmup=gain*1.5
	d=DuelRivalPolicy.decide(s,[event],driver,f)
	check(d.choice=="extend" and d.reason.begins_with("Decline"),"Warm-up can make extending preferable to covering the same public entry")
	f.pit.warmup=0;f.pit.queue=3
	d=DuelRivalPolicy.decide(s,[],driver,f)
	check(d.choice!="box","Own-team accepted shared service can split a rival response")
	check(d.candidates.any(func(c):return c.id==d.choice),"Refinement never selects outside the legal near-best shortlist")
	for flag in ["YELLOW","SAFETY CAR","RESTART"]:
		var blocked=s.duplicate(true);blocked.flag=flag
		check(DuelRivalPolicy.decide(blocked,[event],driver,f).is_empty(),"Rival response respects " + flag)
	var before=RaceRecord.fingerprint(sim.snapshot());var source=RaceForecaster.capture(sim,1)
	sim.policy(3).plan={"private_draft":"not announced"};sim.cars[3].fuel=888;sim.weather_state.rng_state=77
	check(source==RaceForecaster.capture(sim,1),"Private player draft/resources and future RNG are absent from the rival information snapshot")
	check(not before.is_empty(),"Information audit has an initial state fingerprint")
	for condition in ["puncture","weather","damage","low_tread"]:
		sim=new_fixture();check(approve(sim,plan(sim)),"Boundary mandate accepted: " + condition)
		match condition:
			"puncture":TyreInventory.find(sim.cars[3],sim.cars[3].set_id).wheels.FL.punctured=true
			"weather":sim.rain=0.5
			"damage":sim.cars[3].damage=50.0
			"low_tread":sim.cars[3].tyre=12.0
		sim.engineer(sim.cars[3])
		check(not sim.cars[3].pit_order and sim.policy(3).owners.pit=="player","A dry tactic cannot create previously absent emergency consent: " + condition)
		check(sim.duel_state.drivers[3].active.status=="review","The actual reason remains reviewable: " + condition)
	sim=new_fixture();check(approve(sim,plan(sim)),"Post-order response fixture accepted")
	sim.engineer(sim.cars[3]);var gate=sim.cars[3].pit_gate
	var target=int(sim.duel_state.drivers[3].active.plan.target_id)
	sim.cars[target].route="pit";TacticalDuels.after_step(sim)
	check(sim.cars[3].pit_order and sim.cars[3].pit_gate==gate,"A rival response after acceptance cannot cancel the already issued stop")
	sim=new_fixture();var p=plan(sim);p.rival_first=true;check(approve(sim,p),"Terminal review fixture accepted")
	sim.cars[int(p.target_id)].route="pit";sim.engineer(sim.cars[3]);sim.cars[3].finished=true
	TacticalDuels.after_step(sim)
	check(sim.duel_state.drivers[3].active.status=="completed","A pending review closes when its driver finishes; no stale active tactic")
	# A pre-race set edit supersedes a tactic but has no independent pit delegation effect.
	sim=DuelScenarios.build(DuelScenarios.catalog()[0],Storage.read_catalog().data)
	check(approve(sim,plan(sim)),"Preparation mandate accepted")
	check(sim.command("select_set",{"id":3,"set_id":"3-H1"}),"Native preparation set edit accepted")
	check(sim.policy(3).owners.pit=="player" and sim.duel_state.drivers[3].active.status=="abandoned","Preparation edit restores prior pit owner rather than leaking borrowed authority")
	# Bounded history and stable last evidence, without claiming persistence of unlimited detail.
	sim=new_fixture()
	for i in range(11):
		var q=plan(sim);q.authority="recommend";approve(sim,q)
		var r=TacticalDuels.current(sim,3)
		sim.command("duel_cancel",{"id":3,"revision":sim.duel_state.drivers[3].revision,"plan_id":r.id})
	check(sim.duel_state.drivers[3].history.size()==8 and sim.duel_state.drivers[3].truncated,"Prior tactical history has a disclosed eight-record bound")
	check(PracticeRaceSim.restore_practice(JSON.parse_string(JSON.stringify(sim.snapshot())))!=null,"Bounded terminal history restores from JSON")
	var raw=JSON.parse_string(JSON.stringify(sim.snapshot()));raw.duel_state.enabled=1
	check(PracticeRaceSim.restore_practice(raw)==null,"A number cannot masquerade as the new model-enable boolean")
	var report={"passed":failures.is_empty(),"checks":checks,"errors":failures,"scope":"Synthetic response/cost, safety precedence, public information, history and terminal boundaries. Full physical execution is covered separately."}
	Storage.write_json("res://reports/duel-contracts.json",report);print("DUEL_CONTRACTS ",JSON.stringify(report));quit(0 if failures.is_empty() else 1)
