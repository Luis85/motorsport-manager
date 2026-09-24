extends SceneTree
## Actual qualifying/formation/race, exact reconstruction, and independent altered race.
var checks = 0
var failures: Array[String] = []
var steps = 0
func _initialize(): call_deferred("run")
func check(value: bool, message: String):
	checks += 1
	if not value: failures.append(message); push_error(message)
func until(sim: PracticeRaceSim, predicate: Callable, limit: int = 25000) -> bool:
	for i in range(limit):
		if predicate.call(): return true
		var before = sim.total_time; sim.step()
		if sim.total_time > before: steps += 1
	return predicate.call()
func run():
	var start = Time.get_ticks_msec()
	var sim = PracticeRaceSim.new(TrackGeometry.new(Storage.read_catalog().data[7]), {"laps":4,"scenario":"dry","seed":7314,"intensity":"calm","qual_duration":120})
	var record = RaceRecord.new(); record.attach(sim)
	check(sim.command("qualify"), "Skip optional practice and explicitly approve qualifying")
	check(until(sim, func(): return sim.phase == "qualifying_results"), "Real qualifying returns the field")
	check(sim.cars[3].qual_best > 0 and sim.cars[6].qual_best > 0, "Both cars record actual hot laps")
	check(sim.command("prepare_race") and sim.command("formation"), "Preparation and formation have recorded approvals")
	check(until(sim, func(): return sim.phase == "grid_ready") and sim.command("lights"), "Physical formation reaches approved lights")
	check(until(sim, func(): return sim.phase == "race"), "Physical race starts with an automatic decision checkpoint")
	var race_mark = record.marks.size()-1
	check(race_mark >= 0 and record.marks[race_mark].label == "Race start", "Race-start checkpoint names actual phase change")
	check(until(sim, func(): return sim.phase == "results"), "Original race reaches final classification")
	check(sim.cars[3].finished and sim.cars[6].finished, "Both original player cars finish")
	var original = sim.snapshot(); var sealed = record.seal()
	check(RaceRecord.validate(sealed).is_empty(), "Full original archive validates: " + RaceRecord.validate(sealed))
	var replay = RaceReplay.new()
	check(replay.load_record(JSON.parse_string(JSON.stringify(sealed,"",true,true))).is_empty(), "Full JSON recording reconstructs")
	for i in range(1000):
		if replay.verified or not replay.error.is_empty(): break
		replay.tick(64)
	check(replay.verified, "Full fixed-step input history reproduces sporting endpoint: " + replay.error)
	check(replay.step_index == record.steps, "Replay proves the same actual step count")
	check(RaceRecord.equivalent(original, sim.snapshot()), "Full replay leaves original and all its streams unchanged")
	check(replay.seek(race_mark), "Experiment selects recorded real race start")
	var sandbox = replay.branch(); var sandbox_record = RaceRecord.new()
	var lineage = replay.lineage(); lineage.scenario = ScenarioBrief.defaults(); lineage.scenario.goal = "finish_both"
	var authored = ReplayScenario.build(sandbox, replay.lineage(), lineage.scenario)
	check(ReplayScenario.validate(authored).is_empty(), "Actual race-start state supports a validated authored challenge")
	sandbox_record.attach(sandbox, "sandbox", lineage)
	check(sandbox.paused and sandbox.command("pause"), "Experiment starts separately paused and explicitly resumes")
	check(sandbox.command("pace", {"id":3,"value":0}), "Alternate conserve command addresses Mercer only")
	check(sandbox.command("pit", {"id":3}), "Alternate early pit order uses the physical entry path")
	check(until(sandbox, func(): return sandbox.phase == "results"), "Altered branch completes a physical race")
	check(sandbox.cars[3].pit_stops >= 1, "Altered branch pays for real service, not an outcome rewrite")
	check(sandbox.cars[3].finished and sandbox.cars[6].finished, "Both sandbox player cars finish")
	check(RaceRecord.equivalent(original, sim.snapshot()), "Changed branch, pit call and result never replace original")
	var receipt_path = "user://rw19-full-receipts.json"
	if FileAccess.file_exists(receipt_path): DirAccess.remove_absolute(ProjectSettings.globalize_path(receipt_path))
	var accepted = ResultReceipts.accept(record, receipt_path)
	check(accepted.ok and not accepted.already_accepted, "Original result receives one durable receipt")
	var first_bytes = FileAccess.get_file_as_string(receipt_path)
	var repeated = ResultReceipts.accept(record, receipt_path)
	check(repeated.ok and repeated.already_accepted and first_bytes == FileAccess.get_file_as_string(receipt_path), "Identical event is a no-op without rewriting the ledger")
	check(not ResultReceipts.accept(sandbox_record, receipt_path).ok and first_bytes == FileAccess.get_file_as_string(receipt_path), "Completed sandbox cannot settle a second original result")
	var restored = ReplayStorage.restore_session({"kind":ReplayStorage.SESSION_KIND,"version":1,"record":JSON.parse_string(JSON.stringify(sealed,"",true,true))})
	check(restored.ok and ResultReceipts.accept(restored.record, receipt_path).already_accepted, "Reloaded original retains its event ID and accepted receipt")
	var notebook_path = "user://notebook-complete-races.json"
	if FileAccess.file_exists(notebook_path): DirAccess.remove_absolute(ProjectSettings.globalize_path(notebook_path))
	var remembered = CircuitNotebook.remember(record, notebook_path)
	check(remembered.ok, "Actual completed original can be remembered")
	var alternate = CircuitNotebook.remember(sandbox_record, notebook_path)
	check(alternate.ok and alternate.entry.facts.origin == "sandbox", "Physical alternate finish retains sandbox provenance in notebook")
	check(alternate.ok and alternate.entry.facts.challenge.outcome == "met", "Authored finish-both goal uses actual final classification")
	check(remembered.ok and remembered.entry.facts.players[0].qualifying_best == sim.cars[3].qual_best, "Notebook retains measured qualifying rather than invented driver contributions")
	check(alternate.ok and alternate.entry.facts.players[0].laps == sandbox.cars[3].completed and alternate.entry.facts.players[0].stops == sandbox.cars[3].pit_stops, "Lapped finish and physical service counts remain explicit")
	check(CircuitNotebook.save_note(record.event_id, "An observation, not proof that another plan is faster.", 0, notebook_path).ok, "Complete original accepts a separate personal interpretation")
	var notebook_bytes = FileAccess.get_file_as_string(notebook_path)
	check(CircuitNotebook.remember(restored.record, notebook_path).already_recorded and notebook_bytes == FileAccess.get_file_as_string(notebook_path), "JSON-restored event does not duplicate notebook history or erase note")
	check(first_bytes == FileAccess.get_file_as_string(receipt_path) and RaceRecord.equivalent(original, sim.snapshot()), "Remembering both runs changes neither original receipt nor sporting state")
	Storage.write_json("res://reports/notebook-example.json", CircuitNotebook.read(notebook_path).data)
	restored.sim.cars[3].damage += 1 # Deliberate conflicting-result fixture, not shipped gameplay.
	check(not ResultReceipts.accept(restored.record,receipt_path).ok and first_bytes == FileAccess.get_file_as_string(receipt_path), "Different result for accepted ID fails without overwriting facts")
	accepted.result.classification.clear()
	check(ResultReceipts.valid(Storage.read_json(receipt_path).data), "Caller mutation cannot modify the durable receipt")
	var corrupt_path = "user://rw19-corrupt-ledger.json"
	Storage.write_json(corrupt_path,{"broken":true})
	check(not ResultReceipts.accept(record,corrupt_path).ok and Storage.read_json(corrupt_path).data.has("broken"), "Corrupt ledger is retained for recovery, not silently reset")
	var all = PracticeRaceSim.new(sim.track)
	for car in all.cars: car.dnf = true
	all.phase = "results" # Test-only all-retired classification fixture.
	var retired = RaceRecord.new(); retired.attach(all)
	var result = WeekendResult.build(retired)
	check(result.classification.size()==12 and result.classification.all(func(row): return row.status=="retired"), "All-retired result remains finite and factual")
	var report = {"passed":failures.is_empty(),"checks":checks,"failures":failures,"engine":Engine.get_version_info().string,"cpu":OS.get_processor_name(),"fixed_steps_original":record.steps,"fixed_steps_replay":replay.record.steps,"fixed_steps_all_physical_runs":steps,"elapsed_seconds":(Time.get_ticks_msec()-start)/1000.0,"archive_bytes":JSON.stringify(sealed,"",true,true).to_utf8_buffer().size(),"original":sim.standings().map(func(c): return {"driver":c.short,"laps":c.completed,"stops":c.pit_stops}),"sandbox":sandbox.standings().map(func(c): return {"driver":c.short,"laps":c.completed,"stops":c.pit_stops}),"limits":"One dry four-lap fixture. Same supported engine. Not strategy balance, forecast calibration, cross-platform equality or campaign settlement."}
	Storage.write_json("res://reports/replay-scenario.json",report); print("REPLAY_SCENARIO ",JSON.stringify(report)); quit(0 if failures.is_empty() else 1)
