extends SceneTree
## Exercise authored ownership through launch, physical sessions, saves and replay.
var checks = 0
var failures: Array[String] = []


class CheckedStore:
	extends WeekendEntryStore
	var writes = 0

	func save_record(record: RaceRecord) -> String:
		writes += 1
		return RaceRecord.validate(record.seal())


func _initialize() -> void:
	call_deferred("run")


func check(value: bool, label: String) -> void:
	checks += 1
	if not value:
		failures.append(label)
		print("ROSTER_FAILURE ", label)


func run() -> void:
	var loaded = ContentPackLoader.new().load_packs(
		["res://content/packs/core", "res://content/examples/club-racing"]
	)
	check(loaded.ok, "Core and expansion resolve their cross-file references")
	if not loaded.ok:
		print(JSON.stringify(loaded))
		finish()
		return
	var catalog: ContentCatalog = loaded.catalog
	default_parity(catalog)
	var definition = catalog.roster("local.club.roster.privateer")
	check(definition != null and definition.count == 14, "Fourteen entrants compiled from data")
	if definition == null:
		finish()
		return
	check(
		definition.player_ids() == [12, 13], "Ownership is explicit, not fixed slots or team names"
	)
	var altered = invalid_roster_records(definition)
	var track: Dictionary = Storage.read_json("res://data/tracks/hillside.json").data
	for invalid_count in [true, 14.5, -1, 65, "14"]:
		var bad_track = track.duplicate(true)
		bad_track.grid.count = invalid_count
		check(
			(
				not TrackDocument.validate(bad_track).is_empty()
				and not TrackDocument.draft_errors(bad_track).is_empty()
			),
			"Malformed grid capacity is rejected before rendering: " + str(invalid_count)
		)
	var launch = WeekendLaunch.new(catalog)
	var options = {
		"laps": 2, "scenario": "dry", "intensity": "calm", "seed": 7314, "roster_id": definition.id
	}
	check(not launch.stage(track, options), "Too-small authored grid rejected before launch")
	track.grid.count = 14
	check(
		launch.stage(track, options),
		"Expanded authored grid stages with chosen roster: " + launch.last_error
	)
	if launch.capture().is_empty():
		finish()
		return
	var staged = launch.capture()
	var invalid = options.duplicate(true)
	invalid.roster_id = "missing.roster"
	check(
		not launch.stage(track, invalid) and launch.capture() == staged,
		"Missing roster preserves staged launch"
	)
	var store = CheckedStore.new()
	var committed = launch.commit(int(staged.revision), store)
	check(
		committed.ok and store.writes == 1,
		"Real launch persists full frozen entry: " + str(committed.get("error", ""))
	)
	if not committed.ok:
		finish()
		return
	var sim: RaceSim = committed.simulation
	var recording: RaceRecord = committed.record
	check(
		sim.player_ids() == [12, 13] and sim.selected_id == 12,
		"Initial selection belongs to the entered team"
	)
	check(
		sim.weather_state.notices.size() == 14 and sim.practice_state.drivers.size() == 14,
		"Mechanic state follows roster size"
	)
	check(
		sim.cars[12].entry_definition.driver_id == "local.club.driver.driver0",
		"Runtime slot maps to persistent driver ID"
	)
	var copied = sim.cars[12].detached_copy()
	check(
		copied.team_identity() == "local.club.team.seventh",
		"Detached typed car retains frozen identity"
	)
	var before = RaceRecord.sporting(sim.snapshot())
	check(
		not sim.command("pace", {"id": 3, "value": 2}),
		"Original hard-coded player slot is now a rival"
	)
	check(
		RaceRecord.equivalent(before, RaceRecord.sporting(sim.snapshot())),
		"Rejected rival order leaves sporting state and RNG unchanged"
	)
	check(
		sim.command("pace", {"id": 12, "value": 2}), "Added driver accepts ordinary player commands"
	)
	var controls = MinimalRaceControls.new()
	controls.configure(sim)
	var query = MinimalWeekendQuery.new(sim).capture()
	check(
		query.cars.size() == 14 and query.readouts.keys() == [12, 13],
		"Shipping readout includes complete field and correct controls"
	)
	var view = RaceViewQuery.new(sim)
	check(
		view.player_labels()[0].begins_with("LAN") and view.teammate_id(12) == 13,
		"Diagnostic queries expose dynamic labels and teammate"
	)
	check(
		RaceChartQuery.stints(sim).player_ids == [12, 13], "Chart projection preserves player order"
	)
	altered.drivers[0].name = "Edited source"
	check(
		sim.cars[0].name != "Edited source", "Source edits cannot alter the frozen running roster"
	)
	check(
		controls.send_out(12),
		"Added first driver sends out in physical practice: " + controls.message
	)
	check(
		controls.send_out(13),
		"Added second driver sends out in physical practice: " + controls.message
	)
	var steps = 0
	while sim.phase == "practice" and steps < 24000:
		if sim.clock > 280 and not sim.practice_state.closed:
			check(sim.command("practice_end"), "Close physical practice")
		sim.step()
		steps += 1
	check(sim.phase == "practice_results", "All fourteen cars return from physical practice")
	check(
		not sim.practice_driver(12).runs.is_empty() and not sim.practice_driver(13).runs.is_empty(),
		"Both added drivers retain measured run history"
	)
	if sim.phase != "practice_results":
		recording.detach()
		finish()
		return
	check(controls.advance_stage(), "Practice-to-qualifying approval uses current players")
	check(
		controls.send_out(12) and controls.send_out(13),
		"Both added drivers start physical qualifying"
	)
	steps = 0
	while sim.phase == "qualifying" and steps < 24000:
		sim.step()
		steps += 1
	check(sim.phase == "qualifying_results", "Fourteen-car qualifying completes")
	check(controls.advance_stage(), "Formation approval uses frozen allocation and ownership")
	steps = 0
	while sim.phase == "formation" and steps < 12000:
		sim.step()
		steps += 1
	check(sim.phase == "grid_ready", "Physical formation reaches grid")
	check(controls.advance_stage(), "Start approval enters actual lights")
	steps = 0
	while sim.phase in ["lights", "race"] and steps < 30000:
		sim.step()
		steps += 1
	check(sim.phase == "results", "Fourteen-car physical race finishes without deadlock")
	var saved = sim.snapshot()
	var restored = PracticeRaceSim.restore_practice(
		JSON.parse_string(JSON.stringify(saved, "", true, true))
	)
	check(restored != null, "Expanded completed weekend restores from full-precision JSON")
	if restored != null:
		check(
			RaceRecord.equivalent(saved, restored.snapshot()),
			"Frozen roster and sporting state survive continuation"
		)
		check(
			(
				restored.player_ids() == [12, 13]
				and restored.cars[12].team_identity() == sim.cars[12].team_identity()
			),
			"Restored permissions and pit authority use frozen IDs"
		)
	var tampered = saved.duplicate(true)
	tampered.cars[12].skill += 1
	check(
		PracticeRaceSim.restore_practice(tampered) == null,
		"Saved car cannot diverge from its frozen rating"
	)
	tampered = saved.duplicate(true)
	tampered.cars[12].box_d += 1
	check(
		PracticeRaceSim.restore_practice(tampered) == null,
		"Saved service location cannot diverge from entry"
	)
	var result = WeekendResult.build(recording)
	check(
		WeekendResult.validate(result).is_empty(),
		"Complete expanded result validates: " + WeekendResult.validate(result)
	)
	check(
		(
			result.get("classification", []).size() == 14
			and result.get("returned_resources", []).size() == 14
		),
		"Every entrant and retained inventory is returned"
	)
	var notebook = NotebookEntry.build(recording)
	check(
		NotebookEntry.validate(notebook), "Notebook accepts facts for the actual controlled drivers"
	)
	if not notebook.is_empty():
		check(
			notebook.facts.players[0].id == 12,
			"Notebook no longer assumes Mercer occupies player slot three"
		)
	var replay = RaceReplay.new()
	check(replay.load_record(recording.seal()).is_empty(), "Full expanded recording is accepted")
	steps = 0
	while not replay.verified and replay.error.is_empty() and steps < 120000:
		replay.tick(64)
		steps += 64
	check(replay.verified, "Expanded event replay reproduces endpoint: " + replay.error)
	recording.detach()
	finish()


func default_parity(catalog: ContentCatalog) -> void:
	var track: Dictionary = Storage.read_json("res://data/tracks/hillside.json").data
	var geometry = TrackGeometry.new(track)
	var standard = catalog.roster("core.roster.default")
	var settings = {
		"laps": 2, "scenario": "dry", "intensity": "calm", "seed": 7314, "tactical_duels": true
	}
	var legacy = PracticeRaceSim.new(geometry, settings)
	settings.roster_definition = standard.to_snapshot()
	var authored = PracticeRaceSim.new(geometry, settings)
	check(
		legacy.command("qualify") and authored.command("qualify"),
		"Both default representations accept the same session command"
	)
	for index in range(2000):
		legacy.step()
		authored.step()
	var actual = RaceRecord.sporting(authored.snapshot())
	actual.erase("roster_definition")
	var normalized_boxes: Dictionary = {}
	for key in actual.pit_boxes:
		var display_name = catalog.record(key).get("name", key)
		normalized_boxes[display_name] = actual.pit_boxes[key]
	actual.pit_boxes = normalized_boxes
	for car in actual.cars:
		car.team = catalog.record(car.team).get("name", car.team)
	check(
		RaceRecord.equivalent(RaceRecord.sporting(legacy.snapshot()), actual),
		(
			"Default extracted roster retains complete sporting state and RNG after "
			+ "2,000 steps, apart from explicit identity metadata"
		)
	)
	var small = standard.to_snapshot()
	small.roster.entries = small.roster.entries.filter(
		func(entry): return entry.team_id == small.roster.player_team_id
	)
	small.roster.pit_assignments = small.roster.pit_assignments.filter(
		func(box): return box.team_id == small.roster.player_team_id
	)
	small.teams = small.teams.filter(func(team): return team.id == small.roster.player_team_id)
	var ids = small.roster.entries.map(func(entry): return entry.driver_id)
	small.drivers = small.drivers.filter(func(driver): return driver.id in ids)
	var reduced = RosterDefinition.decode_snapshot(small)
	check(
		reduced != null and reduced.player_ids() == [0, 1],
		"A two-car field has no implicit slot-three requirement"
	)
	if reduced != null:
		settings.roster_definition = reduced.to_snapshot()
		var session = PracticeRaceSim.new(geometry, settings)
		check(
			session.command("qualify") and session.command("close_qualifying"),
			"Global commands support the minimum authored field"
		)
		check(
			PracticeRaceSim.restore_practice(session.snapshot()) != null,
			"Minimum-field state and mechanics restore"
		)


func finish() -> void:
	var result = {"passed": failures.is_empty(), "checks": checks, "failures": failures}
	Storage.write_json("res://reports/content-roster-tests.json", result)
	print("CONTENT_ROSTER_TESTS ", JSON.stringify(result))
	quit(0 if failures.is_empty() else 1)


func invalid_roster_records(definition: RosterDefinition) -> Dictionary:
	var snapshot = definition.to_snapshot()
	var altered = snapshot.duplicate(true)
	altered.roster.entries[0].driver_id = "missing.driver"
	check(not RosterDefinition.snapshot_errors(altered).is_empty(), "Missing driver is rejected")
	altered = snapshot.duplicate(true)
	altered.roster.entries[13].number = altered.roster.entries[0].number
	check(RosterDefinition.decode_snapshot(altered) == null, "Duplicate number rejected")
	altered = snapshot.duplicate(true)
	altered.roster.entries[13].driver_id = altered.roster.entries[0].driver_id
	check(RosterDefinition.decode_snapshot(altered) == null, "Duplicate driver rejected")
	altered = snapshot.duplicate(true)
	altered.roster.player_team_id = "missing.team"
	check(RosterDefinition.decode_snapshot(altered) == null, "Missing two-player team rejected")
	altered = snapshot.duplicate(true)
	altered.roster.pit_assignments[1].fraction = altered.roster.pit_assignments[0].fraction
	check(RosterDefinition.decode_snapshot(altered) == null, "Colliding service positions rejected")
	altered = snapshot.duplicate(true)
	altered.drivers.append(altered.drivers[0])
	check(RosterDefinition.decode_snapshot(altered) == null, "Duplicate frozen dependency rejected")
	altered = snapshot.duplicate(true)
	for team in altered.teams:
		team.name = "Same display name"
	var renamed = RosterDefinition.decode_snapshot(altered)
	check(
		renamed != null and renamed.player_ids() == [12, 13],
		"Display-name collisions never grant authority"
	)
	return altered
