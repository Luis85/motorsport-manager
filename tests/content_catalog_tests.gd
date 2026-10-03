extends SceneTree
## Production catalog, legacy track parity, authored scenarios and frozen continuation.
const SCENARIO = "local.club.scenario.first-weekend"
const CIRCUIT = "local.club.circuit.training"
const PATH = "user://catalog-session.json"
var checks = 0
var failures: Array[String] = []
var catalog: ContentCatalog


class Store:
	extends WeekendEntryStore

	func save_record(record: RaceRecord) -> String:
		return ReplayStorage.save_session(PATH, record)


func _initialize() -> void:
	call_deferred("run")


func check(condition: bool, label: String) -> void:
	checks += 1
	if not condition:
		failures.append(label)
		print("CATALOG_FAILURE ", label)


func candidate(id: String, replacement: Dictionary) -> ContentCatalog:
	var result = ContentCatalog.new()
	var shape_errors: Array = []
	for kind in ContentSchema.KINDS:
		for entry in catalog.entries(kind):
			var value = replacement if entry.id == id else entry
			var errors = result.add(
				value, {"file": entry.id + ".json", "root": "test", "pack": "test"}
			)
			shape_errors.append_array(errors)
	check(
		shape_errors.is_empty(), "Candidate records retain valid shape before semantic validation"
	)
	return result


func contracts() -> void:
	var loaded = ContentPackLoader.new().load_packs(
		["res://config", "res://content/examples/club-racing"]
	)
	check(loaded.ok, "Shared loader accepts core and authored catalog")
	if not loaded.ok:
		print(JSON.stringify(loaded))
		return
	catalog = loaded.catalog
	check(
		catalog.entries("circuit").size() == 9, "Eight retained circuits and one file-only addition"
	)
	check(
		catalog.entries("campaign").size() == 1,
		"Core publishes one authored Team Principal campaign"
	)
	var campaign = catalog.default_campaign()
	check(
		campaign != null and campaign.weekend_id == "core.weekend.campaign-starter",
		"Catalog resolves the default campaign through a validated weekend reference"
	)
	if campaign != null:
		var detached_campaign = campaign.to_record()
		detached_campaign.career.opening_cash_minor = 1
		check(
			campaign.to_record().career.opening_cash_minor == 150000,
			"Campaign definitions are detached projections rather than mutable authority"
		)
	var manifest = Storage.read_json("res://config/circuits/catalog.json").data
	for filename in manifest.files:
		var source = Storage.read_json("res://config/circuits/" + filename).data
		var definition = catalog.circuit("core.circuit." + source.id)
		check(definition != null, "Existing track receives a catalog identity: " + source.id)
		if definition == null:
			continue
		var old = TrackGeometry.new(source)
		var fresh = TrackGeometry.new(
			definition.document(),
			"core.vehicle.formula",
			false,
			catalog.vehicle("core.vehicle.formula")
		)
		check(
			old.speeds == fresh.speeds and old.length == fresh.length,
			"Catalog keeps exact legacy solver output: " + source.id
		)
		check(
			catalog.explain(definition.id).source.file == filename,
			"Track provenance is the single original file"
		)
	var circuit = catalog.circuit(CIRCUIT)
	check(
		RaceRecord.equivalent(
			circuit.document().visual, {"environment": "woodland", "season": "autumn", "seed": 1975}
		),
		"Style is resolved through the catalog"
	)
	var document = circuit.document()
	document.name = "Detached edit"
	check(
		circuit.document().name == "Club Training Circuit",
		"Editing a projection cannot change a catalog definition"
	)
	var editor = TrackEditorSession.new(circuit.document())
	editor.content_catalog = catalog
	var original = editor.read_document()
	var draft = editor.read_document()
	draft.name = "My track variant"
	var revision = editor.revision
	check(editor.commit(draft, revision), "Authored circuit supports ordinary editor transactions")
	check(editor.undo() == original, "Undo restores the original authored circuit")
	check(editor.redo() == draft, "Redo restores the edited copy")
	check(not editor.commit(original, revision), "A stale editor transaction is rejected")
	var preview = editor.compile_draft(draft, "local.club.vehicle.sport")
	check(
		preview != null and preview.runtime_export().visual == original.visual,
		"Editor compilation/export retain resolved style"
	)
	check(
		catalog.circuit(CIRCUIT).document() == original,
		"Editor history never mutates the shared catalog"
	)


func invalid_content() -> void:
	var campaign_record = catalog.record("core.campaign.team-principal")
	campaign_record.weekend_id = "missing.weekend"
	var campaign_errors = candidate("core.campaign.team-principal", campaign_record).seal()
	check(
		not campaign_errors.is_empty() and campaign_errors[0].code == "CONTENT_REFERENCE",
		"A campaign cannot activate with a missing weekend definition"
	)
	campaign_record = catalog.record("core.campaign.team-principal")
	campaign_record.calendar[1].circuit_id = "missing.circuit"
	campaign_errors = candidate("core.campaign.team-principal", campaign_record).seal()
	check(
		not campaign_errors.is_empty() and campaign_errors[0].code == "CONTENT_REFERENCE",
		"Campaign calendar rejects a missing circuit reference before career creation"
	)
	campaign_record = catalog.record("core.campaign.team-principal")
	campaign_record.rivals[0].roster_team_id = campaign_record.player.roster_team_id
	campaign_errors = candidate("core.campaign.team-principal", campaign_record).seal()
	check(
		(
			not campaign_errors.is_empty()
			and campaign_errors[0].code in ["CONTENT_CAMPAIGN", "CONTENT_CAMPAIGN_ROSTER"]
		),
		"Campaign cannot map two organizations to the same authored roster team"
	)
	campaign_record = catalog.record("core.campaign.team-principal")
	campaign_record.player.roster_team_id = "core.team.missing"
	campaign_errors = candidate("core.campaign.team-principal", campaign_record).seal()
	check(
		not campaign_errors.is_empty() and campaign_errors[0].code == "CONTENT_CAMPAIGN_ROSTER",
		"Campaign player mapping must match the selected weekend roster player team"
	)
	campaign_record = catalog.record("core.campaign.team-principal")
	campaign_record.event_finance.position_bonus_minor.pop_back()
	campaign_errors = candidate("core.campaign.team-principal", campaign_record).seal()
	check(
		not campaign_errors.is_empty() and campaign_errors[0].code == "CONTENT_CAMPAIGN",
		"Campaign cross-field finance/scoring mismatch rejects the complete candidate"
	)
	var record = catalog.record(SCENARIO)
	record.circuit_id = "missing.circuit"
	var errors = candidate(SCENARIO, record).seal()
	check(
		not errors.is_empty() and errors[0].code == "CONTENT_REFERENCE",
		"Missing circuit rejects the complete candidate"
	)
	record = catalog.record(CIRCUIT)
	record.document.grid.count = 12
	errors = candidate(CIRCUIT, record).seal()
	check(
		not errors.is_empty() and errors[0].code == "CONTENT_SCENARIO_CAPACITY",
		"A fourteen-car scenario cannot silently enlarge an authored grid"
	)
	record = catalog.record(SCENARIO)
	record.brief.goal = "mer_top_six"
	errors = candidate(SCENARIO, record).seal()
	check(
		not errors.is_empty() and errors[0].code == "CONTENT_SCENARIO_GOAL",
		"Display names cannot redirect a named goal to a different player team"
	)
	record = catalog.record(CIRCUIT)
	record.style_id = "missing.style"
	errors = candidate(CIRCUIT, record).seal()
	check(
		not errors.is_empty() and errors[0].field == "/style_id",
		"Missing style identifies the broken reference"
	)
	record = catalog.record(CIRCUIT)
	record.document.id = "hillside"
	errors = candidate(CIRCUIT, record).seal()
	check(
		not errors.is_empty() and errors[0].code == "CONTENT_DOCUMENT_ID",
		"Duplicate document identities are rejected"
	)
	record = catalog.record(CIRCUIT)
	record.document.id = 42
	errors = candidate(CIRCUIT, record).seal()
	check(
		not errors.is_empty() and "document ID" in errors[0].message,
		"Invalid document identity produces a useful field-level diagnostic"
	)
	check(
		not ContentScenarioDefinition.valid_record_context({"parent": {"content_scenario": []}}),
		"Malformed frozen scenario is rejected without dereferencing it"
	)
	var app = root.get_node("App")
	var previous = app.content_catalog
	var library = app.library.duplicate(true)
	var manifest = {
		"kind": "motorsport-manager-content-pack",
		"schema_version": 1,
		"id": "local.club",
		"version": "1.0.0",
		"runtime_contract": 1,
		"dependencies": [{"id": "core", "version": "1.0.0"}],
		"files": ["scenario.json"],
		"overrides": []
	}
	check(
		Storage.write_json("user://invalid-catalog/pack.json", manifest).is_empty(),
		"Write an invalid-pack test manifest"
	)
	check(
		(
			Storage
			. write_json("user://invalid-catalog/scenario.json", catalog.record(SCENARIO))
			. is_empty()
		),
		"Write a scenario with absent dependencies"
	)
	check(
		not app.reload_content(["user://invalid-catalog"]),
		"A missing scenario dependency rejects atomic reload"
	)
	check(
		app.content_catalog == previous and app.library == library,
		"Failed scenario reload keeps both the previous catalog and library"
	)


func launch_and_restore() -> void:
	var launch = WeekendLaunch.new(catalog)
	check(
		launch.stage_scenario(SCENARIO), "A file-only scenario stages a complete existing weekend"
	)
	var staged = launch.capture()
	check(
		staged.get("scenario_brief", {}).get("title") == "Your first club weekend",
		"Review exposes the authored brief"
	)
	check(
		not launch.stage_scenario("missing.scenario") and launch.capture() == staged,
		"Rejected scenario leaves the previous draft unchanged"
	)
	check(
		not launch.stage_circuit("missing.circuit", {"laps": 8}) and launch.capture() == staged,
		"Rejected circuit leaves the previous draft unchanged"
	)
	var committed = launch.commit(staged.revision, Store.new())
	check(
		committed.ok,
		"Approved scenario commits through production storage: " + str(committed.get("error", ""))
	)
	if not committed.ok:
		return
	var sim: RaceSim = committed.simulation
	check(
		sim.cars.size() == 14 and sim.player_ids() == [12, 13],
		"Scenario launch preserves authored entries and ownership"
	)
	check(
		sim.track.document.id == "local.club.training",
		"The circuit is selected by stable content reference"
	)
	check(
		committed.record.parent.scenario == catalog.scenario(SCENARIO).brief(),
		"The original brief is pinned into record lineage"
	)
	if sim.paused:
		sim.command("pause")
	for index in range(1600):
		sim.step()
	var before = RaceStateValue.fingerprint(sim.snapshot())
	check(
		ReplayStorage.save_session(PATH, committed.record).is_empty(),
		"Save a moving authored scenario"
	)
	var read = Storage.read_json(PATH)
	check(read.ok, "Decode saved authored scenario")
	var app = root.get_node("App")
	check(
		app.reload_content([]) and app.content_catalog.scenario(SCENARIO) == null,
		"Deactivate the source pack without altering the active simulation"
	)
	var restored = ReplayStorage.restore_session(read.data)
	check(
		restored.ok,
		"Restore solely from pinned content after deactivation: " + str(restored.get("error", ""))
	)
	if restored.ok:
		check(
			RaceStateValue.fingerprint(restored.sim.snapshot()) == before,
			"Removed source pack cannot change the saved simulation"
		)
		check(
			restored.record.parent == committed.record.parent,
			"Removed source pack cannot change the authored brief"
		)
		restored.record.detach()
	for change in ["brief", "weekend", "track"]:
		var bad = read.data.record.duplicate(true)
		match change:
			"brief":
				bad.parent.content_scenario.definition.brief.title = "Different instruction"
			"weekend":
				bad.parent.content_scenario.definition.weekend_id = "core.weekend.standard"
			"track":
				bad.parent.content_scenario.track_id = "different-circuit"
		bad.erase("digest")
		bad.digest = RaceRecord.fingerprint(bad)
		check(
			not RaceRecord.validate(bad).is_empty(),
			"Semantic scenario consistency survives a recomputed digest: " + change
		)
	# Synthetic terminal fixture isolates history/receipt contracts; not a claimed race finish.
	var terminal = PracticeRaceSim.new(launch.visual_track(), launch.session_options())
	var history = RaceRecord.new()
	history.attach(terminal, "standalone", committed.record.parent)
	for car in terminal.cars:
		car.dnf = true
	terminal.phase = "results"
	var entry = NotebookEntry.build(history)
	check(
		not entry.is_empty() and NotebookEntry.validate(entry),
		"Completed authored-weekend facts are eligible for opt-in history"
	)
	check(
		entry.get("facts", {}).get("challenge", {}).get("outcome") == "not_met",
		"Synthetic retirements cannot claim the finish-both goal"
	)
	var remembered = CircuitNotebook.remember(history, "user://catalog-notebook.json")
	check(
		remembered.ok and CircuitNotebook.read("user://catalog-notebook.json").ok,
		"Authored scenario notebook round-trips its pinned context"
	)
	check(
		ResultReceipts.accept(history, "user://catalog-results.json").ok,
		"An original authored weekend uses the existing receipt boundary"
	)
	check(
		ResultReceipts.accept(history, "user://catalog-results.json").get(
			"already_accepted", false
		),
		"Repeated acceptance creates no second original result"
	)
	if not entry.is_empty():
		var invalid = entry.duplicate(true)
		invalid.facts.content_scenario.definition.weekend_id = "missing.weekend"
		invalid.digest = RaceRecord.fingerprint(invalid.facts)
		check(
			not NotebookEntry.validate(invalid),
			"Notebook rejects a contradictory frozen scenario even with a new digest"
		)
	history.detach()
	committed.record.detach()


func run() -> void:
	contracts()
	if catalog != null:
		invalid_content()
		launch_and_restore()
	var result = {"passed": failures.is_empty(), "checks": checks, "failures": failures}
	Storage.write_json("res://reports/content-catalog-tests.json", result)
	print("CONTENT_CATALOG_TESTS ", JSON.stringify(result))
	quit(0 if failures.is_empty() else 1)
