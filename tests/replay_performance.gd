extends SceneTree
## Serial matched enabled/disabled observer workloads; measure actual work, not FPS labels.
var checks=0
var failures: Array[String]=[]
func _initialize(): call_deferred("run")
func check(value: bool,message: String):
	checks+=1
	if not value: failures.append(message);push_error(message)
func run():
	var seed_sim=RivalScenarios.build(RivalScenarios.catalog()[0],Storage.read_catalog().data)
	seed_sim.command("formation")
	# Preparation work precedes measurement; this real snapshot retains all profiles.
	while seed_sim.phase!="grid_ready": seed_sim.step()
	seed_sim.command("lights")
	while seed_sim.phase!="race": seed_sim.step()
	var source=seed_sim.snapshot()
	var results: Array=[]
	var costs: Array=[]
	for pair in range(3):
		var hashes: Array=[]
		for enabled in ([false,true] if pair%2==0 else [true,false]):
			var sim=PracticeRaceSim.restore_practice(source)
			var recorder: RaceRecord
			if enabled: recorder=RaceRecord.new();recorder.attach(sim)
			var before=sim.total_time;var start=Time.get_ticks_usec()
			for i in range(1000): sim.step()
			var elapsed=(Time.get_ticks_usec()-start)/1000000.0
			var seconds=sim.total_time-before
			check(absf(seconds-50)<0.000001,"Matched workload executes 1000 real steps, enabled="+str(enabled))
			hashes.append(RaceRecord.fingerprint(RaceRecord.sporting(sim.snapshot())))
			results.append({"pair":pair,"recording":enabled,"steps":1000,"simulated_seconds":seconds,"wall_seconds":elapsed,"sim_seconds_per_wall_second":seconds/elapsed})
			if enabled:
				check(recorder.steps==1000,"Observer counts every authoritative step")
				start=Time.get_ticks_usec();recorder.bookmark("Measured checkpoint");var mark_usec=Time.get_ticks_usec()-start
				start=Time.get_ticks_usec();var data=recorder.seal();var seal_usec=Time.get_ticks_usec()-start
				start=Time.get_ticks_usec();var error=RaceRecord.validate(data);var validate_usec=Time.get_ticks_usec()-start
				check(error.is_empty(),"Populated measured archive validates: "+error)
				costs.append({"bookmark_ms":mark_usec/1000.0,"seal_ms":seal_usec/1000.0,"validate_ms":validate_usec/1000.0,"archive_bytes":JSON.stringify(data,"",true,true).to_utf8_buffer().size()})
		check(hashes[0]==hashes[1],"Matched enabled/disabled observer has exact sporting outcome hash")
	var report={"passed":failures.is_empty(),"checks":checks,"failures":failures,"engine":Engine.get_version_info().string,"cpu":OS.get_processor_name(),"workloads":results,"operations":costs,"limitations":"Three serial pairs, alternating order; same 0.12 code with recording disabled/enabled, not an engine or 0.11 speedup comparison. 12 cars, Pinecrest dry calm seed7314; current rival policy; no graphics. Exact sporting hashes include RNG/journal, exclude only selection/pause/speed/accumulator. No FPS, full-record-size or cross-platform guarantee."}
	Storage.write_json("res://reports/replay-performance.json",report);print("REPLAY_PERFORMANCE ",JSON.stringify(report));quit(0 if failures.is_empty() else 1)
