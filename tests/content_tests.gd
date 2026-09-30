extends SceneTree
## Real production loader, launch, editor and checkpoint paths. No expected hashes regenerated.
var checks: int = 0
var failures: Array = []

class CheckedStore:
	extends WeekendEntryStore
	var saved: Dictionary = {}
	func save_record(record: RaceRecord) -> String:
		saved = record.seal()
		return RaceRecord.validate(saved)

func _initialize() -> void:
	call_deferred("run")

func check(condition: bool, label: String) -> void:
	checks += 1
	if not condition:
		failures.append(label)
		print("CONTENT_FAILURE ", label)

func syntax() -> void:
	for text in ["{\"a\":1,\"a\":2}", "[1,]", "{\"a\":1,}", "01", "1e", "1e999", "NaN", "true false", "\"\\uD800\"", "\"\\uDC00\"", "\"\\uD800\\u0041\"", "\"raw\nnewline\"", "/*comment*/{}"]:
		check(not ContentJson.parse(text).ok, "Strict JSON rejects " + text)
	for text in ["null", "true", "false", "{}", "[]", "[1,-2.5e3]", "{\"a\":[true, null]}", "\"\\uD83D\\uDE00\""]:
		check(ContentJson.parse(text).ok, "Strict JSON accepts " + text)
	check(not ContentJson.parse("[".repeat(26) + "0" + "]".repeat(26)).ok, "Nesting limit")
	check(not ContentValidation.check(true, ContentSchema.integer(0, 2)).is_empty(), "Boolean is not an integer")
	check(not ContentValidation.check(1.5, ContentSchema.integer(0, 2)).is_empty(), "Fraction is not an integer")

func run() -> void:
	syntax()
	var loaded = ContentPackLoader.new().load_packs(["res://content/packs/core", "res://content/examples/club-racing"])
	check(loaded.ok, "Core and example packs validate")
	if not loaded.ok:
		print(JSON.stringify(loaded))
		finish()
		return
	var catalog: ContentCatalog = loaded.catalog
	check(catalog.entries("vehicle").size() == 5, "Fifth vehicle is discovered from a manifest")
	var definition = catalog.vehicle("local.club.vehicle.sport")
	check(definition != null and definition.top_speed_mps == 55.0, "Typed parameters come from external data")
	var record = definition.to_record()
	record.top_speed_mps = 9
	check(definition.top_speed_mps == 55.0, "Author/read-model edits do not mutate definitions")
	record.unrecognised = true
	check(VehicleDefinition.from_record(record) == null, "Unknown fields fail closed")
	check(catalog.vehicle("missing.vehicle") == null, "Unknown ID does not select Formula")
	check(catalog.explain(definition.id).source.file == "vehicles/sport.json", "Value provenance")
	check(not catalog.add(definition.to_record(), {}).is_empty(), "Published catalog is sealed")
	var document: Dictionary = TrackDocument.normalize(Storage.read_json("res://data/tracks/hillside.json").data)
	var editor = TrackEditorSession.new(document)
	editor.content_catalog = catalog
	var preview = editor.compile_draft(document, definition.id)
	check(preview != null and preview.vehicle_definition.top_speed_mps == 55.0, "Editor uses external vehicle")
	check(editor.compile_draft(document, "missing.vehicle") == null, "Editor rejects missing vehicle")
	var launch = WeekendLaunch.new(catalog)
	check(launch.stage(document, {"laps": 2, "scenario": "dry", "tactical_duels": true}, definition.id), "Real launch stages external vehicle")
	var staged = launch.capture()
	check(not launch.stage(document, {"laps": 2}, "missing.vehicle"), "Launch rejects missing vehicle")
	check(launch.capture() == staged, "Rejected stage preserves the previous draft")
	var store = CheckedStore.new()
	var committed = launch.commit(staged.revision, store)
	check(committed.ok, "Commit persists validated initial practice: " + str(committed.get("error", "")))
	if committed.ok:
		var sim: RaceSim = committed.simulation
		check(sim.track.vehicle_definition.to_record() == definition.to_record(), "Launch retains the same definition")
		check(preview != null and sim.track.speeds == preview.speeds, "Editor and race use identical compiled speed profiles")
		var snapshot = sim.snapshot()
		var restored = PracticeRaceSim.restore_practice(snapshot)
		check(restored != null, "Content-aware native checkpoint restores")
		if restored:
			check(RaceRecord.equivalent(restored.snapshot(), snapshot), "Restored native checkpoint is equivalent")
		var json_roundtrip = JSON.parse_string(JSON.stringify(store.saved, "", true, true))
		check(RaceRecord.validate(json_roundtrip).is_empty(), "Full replay envelope accepts content after JSON round trip")
		var changed = snapshot.duplicate(true)
		changed.vehicle_definition.id = "wrong.vehicle"
		check(PracticeRaceSim.restore_practice(changed) == null, "Mismatched frozen vehicle ID is rejected")
		changed = store.saved.duplicate(true)
		changed.endpoint.vehicle_definition.top_speed_mps += 1
		changed.erase("digest")
		changed.digest = RaceRecord.fingerprint(changed)
		check(not RaceRecord.validate(changed).is_empty(), "Replay rejects changed definitions even with a recomputed envelope digest")
		committed.record.detach()
	for name in VehicleDefinition.LEGACY:
		var old = TrackGeometry.new(document, name)
		var fresh = TrackGeometry.new(document, "core.vehicle." + name.to_lower(), false, catalog.vehicle("core.vehicle." + name.to_lower()))
		check(old.speeds == fresh.speeds and old.estimate == fresh.estimate, "Extracted " + name + " preserves solver output")
	finish()

func finish() -> void:
	var result = {"passed": failures.is_empty(), "checks": checks, "failures": failures}
	Storage.write_json("res://reports/content-tests.json", result)
	print("CONTENT_TESTS ", JSON.stringify(result))
	quit(0 if failures.is_empty() else 1)
