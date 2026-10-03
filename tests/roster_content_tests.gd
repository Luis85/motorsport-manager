extends SceneTree
## File-only seventh team, shifted player IDs, physical weekend and exact continuation.
var checks = 0
var failures: Array = []


class Store:
	extends WeekendEntryStore

	func save_record(record: RaceRecord) -> String:
		return RaceRecord.validate(record.seal())


func _initialize() -> void:
	call_deferred("run")


func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		print("ROSTER_FAILURE ", message)


func run() -> void:
	var loaded = ContentPackLoader.new().load_packs(
		["res://content/packs/core", "res://content/examples/club-racing"]
	)
	check(loaded.ok, "Data-only expanded catalog validates")
	if not loaded.ok:
		print(JSON.stringify(loaded))
		finish()
		return
	var catalog: ContentCatalog = loaded.catalog
	var roster = catalog.roster("local.club.roster.expanded")
	check(
		roster != null and roster.size == 14 and roster.players() == [12, 13],
		"Fourteen entries, including explicit final-slot player identities"
	)
	var document: Dictionary = TrackDocument.normalize(
		Storage.read_json("res://data/tracks/hillside.json").data
	)
	var launch = WeekendLaunch.new(catalog)
	var options = {
		"laps": 2,
		"scenario": "dry",
		"intensity": "calm",
		"seed": 7314,
		"roster_id": roster.id,
		"tactical_duels": true
	}
	check(
		not launch.stage(document, options, "local.club.vehicle.sport"),
		"A twelve-slot circuit rejects a fourteen-car field"
	)
	document.grid.count = 14
	check(
		launch.stage(document, options, "local.club.vehicle.sport"),
		"Authored fourteen-slot circuit stages the field"
	)
	var commit = launch.commit(launch.capture().revision, Store.new())
	check(commit.ok, "Real launch commits expanded frozen data: " + str(commit.get("error", "")))
	if not commit.ok:
		finish()
		return
	var sim: RaceSim = commit.simulation
	var record: RaceRecord = commit.record
	check(
		sim.cars.size() == 14 and sim.selected_id == 12,
		"Factory and initial selection use the frozen roster"
	)
	check(
		sim.cars[12].player and not sim.cars[3].player,
		"Authority follows selected team ID, not Obsidian name or old slot"
	)
	check(
		sim.cars[12].team == "local.club.team.workshop", "Pit ownership uses stable team identity"
	)
	check(
		sim.weather_state.reviews.size() == 14 and sim.duel_state.drivers.size() == 14,
		"Composed systems size their state from the field"
	)
	var view = RaceViewQuery.new(sim)
	check(
		view.player_ids() == [12, 13] and view.teammate_id(12) == 13,
		"Detached queries expose the correct player pair"
	)
	check(view.player_labels()[0].contains("Avery Shaw"), "Selectors use authored driver labels")
	check(
		RaceChartQuery.stints(sim).player_ids == [12, 13],
		"Chart projection preserves shifted player IDs"
	)
	var before = RaceStateValue.fingerprint(sim.snapshot())
	check(
		not sim.command("pace", {"id": 3, "value": 2}), "Former player slot cannot control a rival"
	)
	check(
		before == RaceStateValue.fingerprint(sim.snapshot()),
		"Rejected ownership command preserves sporting state"
	)
	var clone = roster.to_record()
	clone.teams[-1].name = "Obsidian"
	var renamed = RosterDefinition.from_snapshot(clone)
	check(
		renamed.ok and renamed.definition.players() == [12, 13],
		"A duplicate display name does not change identity or permissions"
	)
	var invalid = roster.to_record()
	invalid.roster.entries[13].driver_id = invalid.roster.entries[12].driver_id
	check(not RosterDefinition.from_snapshot(invalid).ok, "Duplicate driver assignment is rejected")
	invalid = roster.to_record()
	invalid.roster.pit_assignments[-1].fraction = invalid.roster.pit_assignments[0].fraction
	check(not RosterDefinition.from_snapshot(invalid).ok, "Duplicate pit assignment is rejected")
	var controls = MinimalRaceControls.new()
	controls.configure(sim)
	check(controls.send_out(12), "Shipping control sends the externally authored first driver")
	check(controls.send_out(13), "Shipping control sends the externally authored teammate")
	check(controls.play(), "Explicit play starts physical practice")
	var steps = 0
	while sim.phase == "practice" and steps < 40000:
		sim.step()
		steps += 1
		if sim.clock > 200 and not sim.practice_state.closed:
			sim.command("practice_end")
	check(sim.phase == "practice_results", "Physical practice completes for the expanded field")
	check(
		sim.command("practice_finish") and sim.command("qualify"),
		"Qualifying begins through accepted commands"
	)
	check(
		controls.send_out(12) and controls.send_out(13),
		"Shifted player pair executes real qualifying runs"
	)
	while sim.phase == "qualifying" and steps < 80000:
		sim.step()
		steps += 1
		if sim.clock > 240 and not sim.qual_closed:
			sim.command("close_qualifying")
	check(sim.phase == "qualifying_results", "Expanded qualifying reaches classification")
	check(
		sim.cars[12].qual_best > 0 and sim.cars[13].qual_best > 0,
		"Both authored drivers have measured qualifying laps"
	)
	check(
		sim.command("prepare_race") and sim.command("formation"),
		"Expanded field enters physical formation"
	)
	while sim.phase == "formation" and steps < 110000:
		sim.step()
		steps += 1
	check(
		sim.phase == "grid_ready" and sim.command("lights"),
		"All fourteen cars form the grid before the start"
	)
	var stopped = false
	while sim.phase != "results" and steps < 170000:
		sim.step()
		steps += 1
		if sim.phase == "race" and sim.cars[12].distance > sim.track.length * 0.15 and not stopped:
			stopped = sim.command("pit", {"id": 12})
	check(
		sim.phase == "results",
		"Fourteen-car race reaches final classification through physical steps"
	)
	check(
		stopped and sim.cars[12].pit_stops > 0,
		"Externally authored player completes a real shared-box pit transaction"
	)
	var result = WeekendResult.build(record)
	check(
		not result.is_empty() and WeekendResult.validate(result).is_empty(),
		"Expanded result and all owned resources validate"
	)
	check(result.get("classification", []).size() == 14, "Classification includes every entrant")
	var notebook = NotebookEntry.build(record)
	check(
		not notebook.is_empty() and NotebookEntry.validate(notebook),
		"Notebook accepts actual new player identities"
	)
	var checkpoint = sim.snapshot()
	var restored = PracticeRaceSim.restore_practice(
		JSON.parse_string(JSON.stringify(checkpoint, "", false, true))
	)
	check(
		restored != null and RaceRecord.equivalent(checkpoint, restored.snapshot()),
		"Expanded terminal checkpoint restores exactly without catalog lookup"
	)
	var tampered = checkpoint.duplicate(true)
	tampered.cars[12].skill += 1
	check(
		PracticeRaceSim.restore_practice(tampered) == null,
		"Frozen authored abilities cannot change independently of their definition"
	)
	var sealed = record.seal()
	check(RaceRecord.validate(sealed).is_empty(), "Complete expanded replay record validates")
	var replay = RaceReplay.new()
	check(replay.load_record(sealed).is_empty(), "Expanded replay loads independently")
	for batch in range(6000):
		if replay.verified or not replay.error.is_empty():
			break
		replay.tick(64)
	check(
		replay.verified,
		"Expanded replay reproduces accepted commands and endpoint: " + replay.error
	)
	record.detach()
	finish()


func finish() -> void:
	var result = {"passed": failures.is_empty(), "checks": checks, "failures": failures}
	Storage.write_json("res://reports/roster-content-tests.json", result)
	print("ROSTER_CONTENT_TESTS ", JSON.stringify(result))
	quit(0 if failures.is_empty() else 1)
