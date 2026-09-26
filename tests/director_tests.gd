extends SceneTree
## Real fixed-step pacing, command ownership and replay; synthetic edges are named.
var checks = 0
var failures: Array[String] = []
var base: Dictionary
var observed: Dictionary = {}
func _initialize() -> void: call_deferred("run")
func check(value: bool, message: String) -> void:
	checks += 1
	if not value: failures.append(message); push_error(message)
func fresh() -> PracticeRaceSim: return PracticeRaceSim.restore_practice(base)
func make_model() -> PracticeRaceSim:
	return PracticeRaceSim.new(TrackGeometry.new(Storage.read_catalog().data[7]), {"laps":12,"scenario":"dry","intensity":"calm","seed":7314,"tactical_duels":true})
func reach(sim: PracticeRaceSim, condition: Callable, limit: int = 20000) -> bool:
	for i in range(limit):
		if condition.call(): return true
		if sim.paused or sim.phase not in RaceSim.ACTIVE: break
		sim.step()
	return condition.call()
func json_copy(value): return JSON.parse_string(JSON.stringify(value,"",false,true))
func receipt_update(sim: PracticeRaceSim, receipt: Dictionary) -> Dictionary:
	var progress = RaceDecisionViewModel.receipt_progress(sim,receipt)
	if progress.terminal: receipt.outcome = progress
	else:
		receipt.record_offset = sim.strategy_state.records.size()
		for key in ["entry_id","recalled"]:
			if progress.has(key): receipt[key] = progress[key]
	return progress
func verify_replay(record: RaceRecord, label: String) -> void:
	var data = json_copy(record.seal())
	var replay = RaceReplay.new()
	check(RaceRecord.validate(data).is_empty(), label+" recording is valid")
	check(replay.load_record(data).is_empty(), label+" reconstruction loads")
	for i in range(20000):
		if replay.verified or not replay.error.is_empty(): break
		replay.tick(64)
	check(replay.verified,label+" exact sporting replay: "+replay.error)
	replay = null
func run() -> void:
	var sim = make_model()
	var watch = RaceMomentDirector.new(); watch.configure(sim)
	var before = RaceRecord.fingerprint(sim.snapshot())
	check(not watch.start(3),"No unapproved session is started by Next moment")
	check(before == RaceRecord.fingerprint(sim.snapshot()),"Rejected idle watch is atomic")
	check(sim.command("prepare_race") and sim.command("formation"),"Preparation and formation are explicit approvals")
	sim.command("speed",{"value":4}); check(watch.start(3),"Formation can be watched")
	check(reach(sim,func(): return not watch.armed),"Physical formation produces a bounded check-in")
	while sim.phase == "formation":
		if not watch.armed: watch.start(3)
		if not reach(sim,func():return not watch.armed): break
	check(sim.phase == "grid_ready" and sim.speed == 4,"Formation cannot silently approve the start; previous speed returns")
	check(sim.command("lights") and watch.start(3),"Lights remain an explicit approval")
	check(reach(sim,func(): return not watch.armed),"Lights-to-race transition is watched")
	check(sim.phase == "race" and sim.paused and sim.speed == 4,"Lights out pauses before another gameplay segment")
	for id in [3,6]: check(sim.command("auto",{"id":id,"value":false}),"Declare manual ownership for isolated command tests")
	base = sim.snapshot(); watch.detach()
	# Observation has no sporting effect or future-rival-resource access.
	sim = fresh(); watch.configure(sim)
	before = RaceRecord.fingerprint(sim.snapshot())
	var facts = JSON.stringify(watch.facts()); var card = DirectorReadModel.car(sim,3)
	for i in range(32): watch.facts(); DirectorReadModel.spotlight(sim,{})
	check(before == RaceRecord.fingerprint(sim.snapshot()),"32 unarmed reads preserve complete sporting state and RNG")
	sim.cars[0].fuel = 123456; sim.cars[0].health = 0.123
	check(facts == JSON.stringify(watch.facts()),"Watcher cannot inspect opponent private fuel/health")
	check(card == DirectorReadModel.car(sim,3),"Own car reader cannot disclose opponent private resources")
	sim = fresh(); watch.configure(sim); before = RaceRecord.fingerprint(sim.snapshot())
	check(not watch.start(0) and not watch.start(-1),"Watching requires a stable owned driver identity")
	check(before == RaceRecord.fingerprint(sim.snapshot()),"Invalid identity has no time or order effect")
	var count = sim.commands.size(); check(watch.start(3),"Watch explicitly starts real time")
	check(sim.speed == 8 and not sim.paused,"8x is a disclosed temporary speed")
	check(sim.commands.size() == count+2,"Only speed and unpause were issued")
	count = sim.commands.size(); check(not watch.start(6) and sim.commands.size() == count,"Repeated activation cannot rearm or retarget")
	check(sim.command("speed",{"value":2}),"Manual speed accepted")
	check(not watch.armed and sim.speed == 2 and not sim.paused,"Manual speed wins; it cancels the watch")
	check(watch.start(6) and sim.command("pause"),"Manual pause during a watch is accepted")
	check(not watch.armed and sim.paused and sim.speed == 2,"Manual pause returns the temporary watch to its prior speed")
	# Same unchanged warning is not an automatic interruption loop.
	sim = fresh(); sim.cars[3].fuel = 0.5; watch.configure(sim); watch.start(3)
	sim.advance(0.01)
	check(watch.armed,"Already-negative fuel is visible but does not immediately re-pause every resume")
	watch.stop(); watch.detach()
	# Explicit synthetic threshold and fixed-frame boundary regression.
	sim = fresh(); watch.configure(sim); watch.start(3)
	TyreInventory.find(sim.cars[6],sim.cars[6].set_id).wheels.FL.punctured = true
	var time = sim.total_time; sim.advance(0.25)
	check(not watch.armed and sim.paused,"New teammate puncture interrupts a selected-driver watch")
	check(watch.last_moment.driver_id == 6,"The interruption names the actual affected teammate")
	check(absf(sim.total_time-time-RaceSim.STEP)<0.000001,"A frame with 8x backlog stops on the exact first watched fixed step")
	check(sim.accumulator > 1.0,"Unconsumed frame backlog is retained, not silently discarded after pause")
	var paused = RaceRecord.fingerprint(sim.snapshot()); sim.advance(0.25)
	check(paused == RaceRecord.fingerprint(sim.snapshot()),"Paused rendering cannot drain time or accumulator")
	watch.detach()
	# Bounded segment uses the real model and records only ordinary inputs.
	sim = fresh(); var recorder = RaceRecord.new(); recorder.attach(sim)
	watch.configure(sim); var start = sim.total_time; watch.start(3)
	for i in range(30000):
		if not watch.armed: break
		sim.advance(0.05)
	check(not watch.armed and sim.paused,"A real race segment yields to the player")
	check(sim.total_time > start and sim.total_time-start <= 180.0+RaceSim.STEP,"No fake jump: bounded simulation time actually elapses")
	check(not sim.cars[3].pit_order and not sim.cars[6].pit_order,"A check-in cannot order a stop")
	verify_replay(recorder,"Watched frame segment")
	watch.detach(); recorder.detach()
	# Both cars: real two-lap resource intent and correct per-channel handback.
	for id in [3,6]:
		sim = fresh(); var ownership = sim.policy(id).owners.duplicate(true)
		var other = 6 if id == 3 else 3; var other_policy = sim.policy(other).duplicate(true)
		var snapshot = RaceDecisionViewModel.capture(sim,id,sim.forecast(id)); var seq = sim.strategy_state.sequence
		var payload = {"id":id,"channel":"pace","value":2,"laps":2}
		recorder.attach(sim)
		check(sim.command("resource_intent",payload),"Real two-lap radio call accepted for "+str(id))
		var receipt = RaceDecisionViewModel.accepted_receipt(sim,snapshot,"resource_intent",payload,seq)
		check(not receipt.command_id.is_empty() and receipt.driver_id == id,"Receipt is tied to an accepted, named command")
		watch.configure(sim)
		for segment in range(12):
			if receipt_update(sim,receipt).terminal: break
			watch.start(id); reach(sim,func():return not watch.armed)
		check(receipt_update(sim,receipt).label == "Completed","Physical two-lap expiry produces a matching handback, not inferred benefit")
		check(sim.cars[id].distance >= receipt.until_distance,"Expiry waits for physical distance")
		check(sim.policy(id).owners == ownership and sim.policy(id).overrides.is_empty(),"Previous channel ownership returns after expiry")
		check(sim.policy(other).owners == other_policy.owners and sim.policy(other).overrides.is_empty(),"No teammate radio instruction is invented")
		check(not sim.cars[id].pit_order,"Pace call leaves pit timing untouched")
		verify_replay(recorder,"Radio + watched handback "+str(id))
		watch.detach(); recorder.detach()
	# Finite tyre stock and physical entry/service/exit with opt-in event check-ins.
	sim = fresh(); recorder.attach(sim); watch.configure(sim)
	var snapshot = RaceDecisionViewModel.capture(sim,3,sim.forecast(3)); var seq = sim.strategy_state.sequence
	var payload = RaceDecisionViewModel.pit_payload(snapshot)
	check(sim.command("pit",payload),"Reviewed replacement and safe gate accepted")
	var receipt = RaceDecisionViewModel.accepted_receipt(sim,snapshot,"pit",payload,seq)
	var stages: Array[String] = []
	for segment in range(30):
		var progress = receipt_update(sim,receipt)
		if progress.terminal: break
		watch.start(3); reach(sim,func():return not watch.armed)
		stages.append(watch.last_moment.title)
	check(receipt_update(sim,receipt).label == "Completed","Actual entry/service/exit produces correlated completion")
	check(sim.cars[3].pit_stops == 1 and sim.cars[3].set_id == payload.set_id,"Exactly one physical stop fits the exact owned replacement")
	check(stages.size() >= 3,"Approach/service/exit are observed, not silently fast-forwarded")
	check(stages.count("MER rejoined the race") == 1,"Rejoin is reported only at physical exit, never just at service completion")
	observed.pit_checkins = stages
	verify_replay(recorder,"Pit call + check-ins")
	watch.detach(); recorder.detach()
	# Actual qualifying release/recall, no invented banker lap.
	sim = make_model(); check(sim.command("qualify"),"Qualifying explicitly approved")
	for id in [3,6]: sim.command("delegation",{"id":id,"channel":"qualifying","owner":"player"})
	snapshot = RaceDecisionViewModel.capture(sim,6,sim.forecast(6)); seq = sim.strategy_state.sequence
	check(sim.command("send",{"id":6}),"Real run release accepted")
	check(reach(sim,func():return sim.cars[6].route == "track"),"Release physically clears the pit lane")
	snapshot = RaceDecisionViewModel.capture(sim,6,sim.forecast(6)); seq = sim.strategy_state.sequence
	check(sim.command("recall",{"id":6}),"A live run can be explicitly recalled")
	receipt = RaceDecisionViewModel.accepted_receipt(sim,snapshot,"recall",{"id":6},seq)
	check(not receipt_update(sim,receipt).terminal,"Recall acceptance is not instantaneous return")
	check(reach(sim,func():return sim.cars[6].route == "garage"),"Recalled car physically returns")
	check(receipt_update(sim,receipt).label == "Canceled","Recall without a measured flying lap is not counted as successful qualifying")
	# Inactive observer does not affect identical continuation.
	sim = fresh(); var twin = fresh(); watch.configure(sim)
	sim.command("pause"); twin.command("pause")
	for i in range(240): sim.step(); twin.step()
	check(RaceRecord.equivalent(sim.snapshot(),twin.snapshot()),"Inactive watcher preserves a matched 240-step complete state and RNG")
	watch.detach(); var old_time = sim.total_time
	watch.configure(twin); watch.start(3); twin.advance(0.05)
	check(sim.total_time == old_time,"Reconfiguration detaches the old model")
	watch.stop(); watch.detach()
	# Honest, isolated descriptive trade-off probe, not a race-balance verdict.
	for mode in [0,1,2]:
		sim = fresh(); sim.command("pace",{"id":3,"value":mode}); sim.command("engine",{"id":3,"value":1}); sim.command("pause")
		var target = sim.cars[3].distance+sim.track.length*2; start = sim.total_time
		check(reach(sim,func():return sim.cars[3].distance>=target),"Two physical lap-distance pace probe completes for mode "+str(mode))
		observed["pace_"+str(mode)] = {"elapsed":sim.total_time-start,"tread":sim.cars[3].tyre,"fuel":sim.cars[3].fuel,"position":sim.standings().find(sim.cars[3])+1}
	var report = {"passed":failures.is_empty(),"checks":checks,"errors":failures,"observed":observed,"engine":Engine.get_version_info().string}
	Storage.write_json("res://reports/director-tests.json",report)
	print("DIRECTOR_TESTS ",JSON.stringify(report)); quit(0 if failures.is_empty() else 1)
