extends SceneTree
## Actual complete source/reconstruction/alternative runs. No scripted winner.
var checks = 0
var failures: Array[String] = []
var fixed_steps = 0
var outcomes: Array = []
func _initialize(): call_deferred("run")
func check(value: bool, message: String):
	checks += 1
	if not value: failures.append(message); push_error(message)
func copied(data): return JSON.parse_string(JSON.stringify(data, "", false, true))
func redigest(data):
	data.erase("digest"); data.digest = RaceRecord.fingerprint(data); return data
func advance(sim: PracticeRaceSim, target: String, budget: int = 30000) -> bool:
	for i in range(budget):
		if sim.phase == target: return true
		var before = sim.total_time
		sim.step()
		if sim.total_time <= before: return false
		fixed_steps += 1
	return sim.phase == target
func finish_row(sim: RaceSim, label: String) -> Dictionary:
	var order = sim.standings()
	return {"branch": label, "players": [3,6].map(func(id): return {"driver":sim.cars[id].short,"position":order.find(sim.cars[id])+1,"laps":sim.cars[id].completed,"finished":sim.cars[id].finished,"stops":sim.cars[id].pit_stops})}
func run():
	var started = Time.get_ticks_usec()
	var sim = RivalScenarios.build(RivalScenarios.catalog()[0], Storage.read_catalog().data)
	var record = RaceRecord.new(); record.attach(sim)
	check(sim.command("formation") and advance(sim, "grid_ready"), "Original formation follows the physical route")
	check(sim.command("lights") and advance(sim, "race"), "Explicit lights start an actual recorded race")
	check(record.marks.size() == 1 and record.marks[0].label == "Race start", "Race-start checkpoint is captured after a real completed step")
	check(sim.command("pit", {"id":3}), "Original branch accepts a physical early stop")
	check(sim.command("pace", {"id":6,"value":0}), "Second driver retains independent conserve intent")
	check(advance(sim, "results"), "Original reaches actual classification")
	check(sim.cars[3].pit_stops > 0 and sim.cars[3].finished and sim.cars[6].finished, "Original pays for a real pit visit and both players finish")
	outcomes.append(finish_row(sim,"original-early-stop"))
	print("REPLAY_STAGE original classified ", record.steps)
	var endpoint = sim.snapshot(); var sealed = record.seal()
	check(RaceRecord.validate(sealed).is_empty(), "Complete race record validates")
	check(ReplayStorage.save_session("user://original-replay-run.json",record).is_empty(), "Complete original session persists")
	var bytes_before = FileAccess.get_file_as_bytes("user://original-replay-run.json")
	var replay = RaceReplay.new()
	check(replay.load_record(copied(sealed)).is_empty(), "Full JSON replay restores its typed starting state")
	var reconstructed = 0
	for i in range(1000):
		reconstructed += replay.tick(64)
		if replay.verified or not replay.error.is_empty(): break
	fixed_steps += reconstructed
	print("REPLAY_STAGE reconstructed ", reconstructed)
	check(replay.verified and reconstructed == record.steps, "Every original step and accepted command reconstructs: " + replay.error)
	check(RaceRecord.equivalent(endpoint, sim.snapshot()), "Full replay leaves every source field unchanged")
	var result = WeekendResult.build(record)
	check(WeekendResult.validate(copied(result)).is_empty(), "Measured twelve-car result and finite returned inventory validate")
	var accepted = ResultReceipts.accept(record,"user://replay-receipts.json")
	check(accepted.ok and not accepted.get("already_accepted",true), "Original final result is accepted once")
	var receipt_bytes = FileAccess.get_file_as_bytes("user://replay-receipts.json")
	var restored = ReplayStorage.restore_session(Storage.read_json("user://original-replay-run.json").data)
	check(restored.ok and restored.record.event_id == record.event_id, "Reload retains the same event identity before retry")
	var repeated = ResultReceipts.accept(restored.record,"user://replay-receipts.json")
	check(repeated.ok and repeated.get("already_accepted",false), "Acceptance after reloading is an idempotent no-op")
	check(receipt_bytes == FileAccess.get_file_as_bytes("user://replay-receipts.json"), "Idempotent acceptance does not rewrite the ledger")
	check(replay.seek(0), "Educational race-start checkpoint remains selectable")
	var copy = replay.branch(); var parent = replay.lineage()
	var brief = ScenarioBrief.defaults(); brief.title = "Hold or stop?"; brief.goal = "finish_both"
	var challenge = ReplayScenario.build(copy,parent,brief)
	check(not challenge.is_empty() and ReplayScenario.validate(copied(challenge)).is_empty(), "Authoring preserves an exact independent scenario start")
	check(ScenarioBrief.assessment(brief,copy).contains("pending"), "Scenario cannot declare success before the finish")
	check(RaceRecord.equivalent(endpoint,sim.snapshot()), "Scenario creation is observational")
	parent.scenario = brief; var alternate = RaceRecord.new(); alternate.attach(copy,"sandbox",parent)
	for id in [3,6]: check(copy.command("pace",{"id":id,"value":0}), "Alternative uses the ordinary conserve command")
	check(copy.command("pause") and advance(copy,"results"), "Separate sandbox completes with an alternative policy")
	outcomes.append(finish_row(copy,"sandbox-conserve"))
	print("REPLAY_STAGE sandbox classified ", alternate.steps)
	check(copy.cars[3].finished and copy.cars[6].finished and copy.cars[3].pit_stops == 0, "Alternative finishes without the original early stop")
	check(ScenarioBrief.assessment(brief,copy).begins_with("Goal met"), "Goal uses observed completed classification without rewards")
	check(not ResultReceipts.accept(alternate,"user://replay-receipts.json").ok, "Completed sandbox cannot create a second original receipt")
	check(receipt_bytes == FileAccess.get_file_as_bytes("user://replay-receipts.json"), "Sandbox does not replace an accepted original")
	check(bytes_before == FileAccess.get_file_as_bytes("user://original-replay-run.json") and RaceRecord.equivalent(endpoint,sim.snapshot()), "Alternative preserves original memory and disk bytes")
	check(ReplayStorage.save_session("user://replay-sandbox-run.json",alternate).is_empty(), "Sandbox has its own durable continuation")
	var loaded_branch = ReplayStorage.restore_session(Storage.read_json("user://replay-sandbox-run.json").data,true)
	check(loaded_branch.ok and RaceRecord.equivalent(loaded_branch.record.parent.scenario, brief), "Scenario goal and instructions survive sandbox continuation")
	var altered = copied(result); altered.classification[0].driver_id=altered.classification[1].driver_id; redigest(altered)
	check(not WeekendResult.validate(altered).is_empty(), "Re-signed duplicate classification cannot enter a receipt ledger")
	altered=copied(result); altered.returned_resources[3].tyres[0].id="6-S1"; redigest(altered)
	check(not WeekendResult.validate(altered).is_empty(), "A borrowed returned tyre identity is rejected")
	altered=copied(result); altered.classification[0].points_eligibility=true; redigest(altered)
	check(not WeekendResult.validate(altered).is_empty(), "Standalone result cannot invent championship points eligibility")
	var corrupt={"kind":ResultReceipts.KIND,"version":1,"results":{record.event_id:altered}}
	Storage.write_json("user://corrupt-replay-receipts.json",corrupt)
	var corrupt_bytes=FileAccess.get_file_as_bytes("user://corrupt-replay-receipts.json")
	check(not ResultReceipts.accept(record,"user://corrupt-replay-receipts.json").ok and corrupt_bytes==FileAccess.get_file_as_bytes("user://corrupt-replay-receipts.json"), "Corrupt existing receipts are not silently replaced")
	# Test-only changed factual result with the same identity: correction is not settlement.
	var different_sim=PracticeRaceSim.restore_practice(endpoint)
	var different=RaceRecord.new();different.attach(different_sim);different.event_id=record.event_id
	different_sim.stats.passes+=1
	check(not ResultReceipts.accept(different,"user://replay-receipts.json").ok, "Different result for a settled event is rejected rather than paying twice")
	var bad=copied(challenge);bad.brief.approaches[1]=bad.brief.approaches[0];redigest(bad)
	check(not ReplayScenario.validate(bad).is_empty(), "Author must supply two distinct approaches")
	bad=copied(challenge);bad.record.origin="standalone";redigest(bad.record);redigest(bad)
	check(not ReplayScenario.validate(bad).is_empty(), "An authored scenario cannot grant original-result authority")
	bad=copied(challenge);bad.brief.goal="award_money";redigest(bad)
	check(not ReplayScenario.validate(bad).is_empty(), "Authoring cannot introduce executable goals or money rewards")
	var envelope={"kind":ReplayStorage.SESSION_KIND,"version":1,"record":copied(sealed)}
	envelope.record.engine="unsupported-engine";redigest(envelope.record)
	check(not ReplayStorage.restore_session(envelope).ok, "Original continuation rejects incompatible engine rather than resealing new provenance")
	var file=FileAccess.open("user://blocked-receipt-path",FileAccess.WRITE);file.store_string("not a directory");file.close()
	check(not ResultReceipts.accept(record,"user://blocked-receipt-path/receipt.json").ok, "Write failure is reported without an accepted receipt")
	var empty=RaceRecord.new();check(WeekendResult.build(empty).is_empty(), "Detached result source is safely unavailable")
	var report={"passed":failures.is_empty(),"checks":checks,"failures":failures,"fixed_steps":fixed_steps,"original_steps":record.steps,"reconstructed_steps":reconstructed,"archive_bytes":JSON.stringify(sealed,"\t",false,true).to_utf8_buffer().size(),"elapsed_seconds":(Time.get_ticks_usec()-started)/1000000.0,"outcomes":outcomes,"limits":"One disclosed dry twelve-lap source and alternative, not strategy balance or human validation. Invalid-data/correction fixtures are test-only; no campaign settlement exists."}
	Storage.write_json("res://reports/scenario-authoring-runs.json",report);print("SCENARIO_AUTHORING_RUNS ",JSON.stringify(report));quit(0 if failures.is_empty() else 1)
