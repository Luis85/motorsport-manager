extends "res://tests/practice_tests.gd"
## Focused command/state tests for the new minimal screen, using production physics.
var controls: MinimalRaceControls
func controller(sim: PracticeRaceSim) -> MinimalRaceControls:
	var result=MinimalRaceControls.new(); result.configure(sim); return result
func test_observation_and_ownership() -> void:
	var sim=fixture(); controls=controller(sim)
	var before=JSON.stringify(sim.snapshot())
	for i in range(20):
		controls.stage(); controls.send_reason(3); controls.box_reason(6); controls.mode_reason(3); MinimalRaceTiming.rows(sim)
	check(before==JSON.stringify(sim.snapshot()),"All minimal presentation queries preserve complete state/RNG")
	check(controls.advance_stage() and sim.phase=="practice","One explicit action starts practice")
	for id in [3,6]:
		for channel in ["qualifying","pit","pace","engine"]: check(sim.policy(id).owners[channel]=="player","Visible channel is player-owned: "+str(id)+"/"+channel)
	check(controls.pause() and sim.paused,"Pause works in practice")
	check(controls.set_speed(8) and sim.paused,"Speed selection does not play")
	for value in [3,0,32]:
		before=JSON.stringify(sim.snapshot())
		check(not controls.set_speed(value) and before==JSON.stringify(sim.snapshot()),"Invalid speed is atomic: "+str(value))
	before=JSON.stringify(sim.snapshot())
	check(not controls.mode(0,"pace",2) and before==JSON.stringify(sim.snapshot()),"Rival command rejected without side effect")
	check(not controls.mode(3,"pace",9) and before==JSON.stringify(sim.snapshot()),"Invalid mode rejected without side effect")
	check(controls.mode(3,"pace",0) and controls.mode(3,"engine",0),"Practice accepts explicit Calm and Save")
	check(sim.cars[3].pace==0 and sim.cars[6].pace==1,"Teammate settings stay independent")
	check(controls.send_out(3),"Single Send out creates validated default run")
	check(sim.practice_driver(3).runs.back().pace==0 and sim.cars[3].pace==0,"Sending preserves chosen modes")
	before=JSON.stringify(sim.snapshot())
	check(not controls.send_out(3) and before==JSON.stringify(sim.snapshot()),"Duplicate release rejected")
	check(controls.play(),"Explicit Play runs the chosen practice modes")
	check(advance_until(sim,func(): return sim.cars[3].qual_state=="hotlap"),"Outlap reaches physical measured lap")
	check(controls.mode(3,"pace",2) and controls.mode(3,"engine",2),"Live practice modes are accepted and visible to physics")
	var saved=sim.snapshot(); var loaded=PracticeRaceSim.restore_practice(JSON.parse_string(JSON.stringify(saved,"",false,true)))
	check(loaded!=null,"Mixed-mode live run checkpoint validates")
	if loaded:
		for i in range(200): sim.step(); loaded.step()
		check(same(sim.snapshot(),loaded.snapshot()),"Mid-run restore continues with identical state and RNG")
	check(advance_until(sim,func(): return sim.practice_driver(3).active.is_empty()),"Run physically returns without hidden UI")
	var run=sim.practice_driver(3).runs.back()
	check(not run.samples.is_empty() and run.samples.all(func(sample): return not sample.clean),"Mixed-mode laps cannot contaminate clean forecast priors")
	check(sim.cars[3].pace==2 and sim.cars[3].engine==2,"Latest explicit orders survive garage return")
	check(sim.cars[3].qual_best==0 and MinimalRaceTiming.practice_best(sim,3)>0,"Practice tower uses actual practice times, never qualifying")
	check(sim.cars[3].telemetry.size()>0 and sim.cars[3].tyre<100,"Hidden telemetry and real tyre costs still run")
	check(controls.advance_stage(),"End practice accepted")
	check(advance_until(sim,func(): return sim.phase=="practice_results"),"Practice closure waits for real returns")
	check(sim.phase not in RaceSim.ACTIVE and controls.advance_stage() and sim.phase=="qualifying","One approval begins qualifying from practice results")
	check(controls.send_out(3),"Qualifying send requires no tyre menu")
	check(advance_until(sim,func(): return sim.cars[3].qual_laps>0 and sim.cars[3].route=="garage"),"Qualifying completes a real out/flying/in lap")
	check(sim.cars[3].qual_best>0,"Only measured qualifying lap sets grid time")
	check(controls.advance_stage(),"End qualifying accepted")
	check(advance_until(sim,func(): return sim.phase=="qualifying_results"),"Qualifying waits for physical returns")
	check(controls.advance_stage() and sim.phase=="formation","Preparation and formation need one explicit approval")
	check(advance_until(sim,func(): return sim.phase=="grid_ready"),"Formation physically reaches grid")
	check(controls.advance_stage() and sim.phase=="lights","Race start explicitly begins actual lights")
	check(advance_until(sim,func(): return sim.phase=="race"),"Lights progress without phase injection")
	check(PracticeRaceSim.restore_practice(sim.snapshot())!=null,"Whole simplified session path remains saveable")
	metrics.weekend_time=sim.total_time

func test_pit_deadlines() -> void:
	var sim=fixture(); sim.phase="race"; sim.paused=true
	for car in sim.cars: car.route="track"; car.distance=300+(12-car.id)*24; car.previous_distance=car.distance; car.speed=40
	controls=controller(sim)
	check(controls.box_reason(3).is_empty() and controls.box(3),"Early pit request pins real available replacement and gate")
	check(sim.cars[3].pit_order and not sim.cars[6].pit_order,"Pit order targets one named driver")
	var before=JSON.stringify(sim.snapshot())
	check(not controls.box(3) and before==JSON.stringify(sim.snapshot()),"Accepted stop cannot duplicate")
	controls.play()
	check(advance_until(sim,func(): return sim.cars[3].pit_stops==1 and sim.cars[3].route=="track"),"Real entry, service, replacement and exit execute")
	check(not sim.cars[3].pit_order and sim.cars[3].set_id!="3-M1","Completed stop fits a distinct finite set")
	var car=sim.cars[6]
	# Synthetic boundary probe, distinct from the physical stop above.
	car.distance=sim.track.length-1; car.previous_distance=car.distance
	before=JSON.stringify(sim.snapshot())
	check(not controls.box_reason(6).is_empty() and not controls.box(6) and before==JSON.stringify(sim.snapshot()),"Late box-this-lap cannot silently become a next-lap order")
	car.dnf=true; before=JSON.stringify(sim.snapshot())
	check(not controls.box(6) and not controls.mode(6,"engine",2) and before==JSON.stringify(sim.snapshot()),"Retired car rejects all live orders")

func test_recorded_modes() -> void:
	var sim=fixture();var c=controller(sim);var record=RaceRecord.new();record.attach(sim)
	c.advance_stage();c.mode(3,"pace",0);c.mode(3,"engine",0);c.send_out(3)
	for i in range(80):sim.step()
	c.mode(3,"pace",2);c.mode(3,"engine",2)
	for i in range(40):sim.step()
	var sealed=JSON.parse_string(JSON.stringify(record.seal(),"",false,true))
	check(RaceRecord.validate(sealed).is_empty(),"New live-mode recording survives JSON validation")
	var replay=RaceReplay.new();check(replay.load_record(sealed).is_empty(),"New live-mode recording loads independently")
	for i in range(10):replay.tick(64)
	check(replay.verified,"Recorded manual release and live modes re-simulate exactly: "+replay.error)
	var invalid=sim.snapshot();invalid.practice_state.drivers[3].active.live_modes.engine=4
	check(PracticeRaceSim.restore_practice(invalid)==null,"Invalid stored live mode is rejected")
	invalid=sim.snapshot();invalid.practice_state.drivers[3].active.live_modes.engine=0
	check(PracticeRaceSim.restore_practice(invalid)==null,"Stored live mode must match the actual car")

func run() -> void:
	var started=Time.get_ticks_msec(); geometry=TrackGeometry.new(Storage.read_catalog().data[7])
	test_observation_and_ownership(); test_pit_deadlines(); test_recorded_modes()
	var report={"passed":failures.is_empty(),"checks":checks,"failures":failures,"metrics":metrics,"elapsed_seconds":(Time.get_ticks_msec()-started)/1000.0}
	Storage.write_json("res://reports/minimal-tests.json",report);print("MINIMAL_TESTS ",JSON.stringify(report));quit(0 if failures.is_empty() else 1)
