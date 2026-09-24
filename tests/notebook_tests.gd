extends SceneTree
## Synthetic terminal fixtures isolate history/storage contracts, not race balance.
var checks = 0
var failures: Array[String] = []
var keep_alive: Array = []
var path = "user://notebook-contract-tests.json"
func _initialize(): call_deferred("run")
func check(value: bool, message: String):
	checks += 1
	if not value: failures.append(message); push_error(message)
func copy(data): return JSON.parse_string(JSON.stringify(data, "", true, true))
func redigest(entry): entry.digest = RaceRecord.fingerprint(entry.facts); return entry
func fixture(origin: String = "standalone", goal: String = "", finishes: bool = false) -> RaceRecord:
	var sim = PracticeRaceSim.new(TrackGeometry.new(Storage.read_catalog().data[7]), {"laps":4, "intensity":"calm"})
	keep_alive.append(sim)
	var parent = {}
	if origin == "sandbox": parent.event_id = RaceRecord.identity()
	if not goal.is_empty(): parent.scenario = ScenarioBrief.defaults(); parent.scenario.goal = goal
	var record = RaceRecord.new(); record.attach(sim, origin, parent)
	for car in sim.cars: car.dnf = true
	if finishes:
		for id in [3, 6]:
			sim.cars[id].dnf = false; sim.cars[id].finished = true; sim.cars[id].completed = 4; sim.cars[id].finish_time = 20 + id
	sim.phase = "results"
	return record
func run():
	if FileAccess.file_exists(path): DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
	check(CircuitNotebook.read(path).ok and CircuitNotebook.read(path).data.entries.is_empty(), "Absent notebook is an empty opt-in history")
	var record = fixture()
	var sim = record.source.get_ref(); var original = sim.snapshot()
	var entry = NotebookEntry.build(record)
	check(not entry.is_empty() and NotebookEntry.validate(entry), "Synthetic all-retired evidence validates without a victory")
	check(NotebookEntry.validate(copy(entry)), "Compact entry survives JSON round trip")
	check(entry.facts.players.all(func(c): return c.status == "retired"), "Retirements retain their observed status")
	check(entry.facts.challenge.outcome == "none", "Ordinary weekend invents no authored challenge")
	var saved = CircuitNotebook.remember(record, path)
	check(saved.ok and not saved.already_recorded, "Explicit remember writes one historical entry")
	var first = FileAccess.get_file_as_string(path)
	check(CircuitNotebook.remember(record, path).already_recorded and FileAccess.get_file_as_string(path) == first, "Same event is idempotent without rewriting disk")
	var personal = "The early stop looked expensive; compare traffic next time."
	check(CircuitNotebook.save_note(record.event_id, personal, 0, path).ok, "Personal interpretation is saved independently")
	var noted = CircuitNotebook.read(path).data.entries[0]
	check(noted.facts == copy(entry.facts) and noted.digest == entry.digest and int(noted.revision) == 1, "Notes never alter immutable facts or their digest")
	first = FileAccess.get_file_as_string(path)
	check(CircuitNotebook.save_note(record.event_id, personal, 1, path).ok and FileAccess.get_file_as_string(path) == first, "Unchanged note avoids another write")
	check(not CircuitNotebook.save_note(record.event_id, "stale", 0, path).ok and FileAccess.get_file_as_string(path) == first, "Stale note revision is rejected without overwriting")
	check(not CircuitNotebook.save_note(record.event_id, "x".repeat(1201), 1, path).ok and FileAccess.get_file_as_string(path) == first, "Overlong draft is rejected atomically")
	check(CircuitNotebook.remember(record, path).entry.note == personal and FileAccess.get_file_as_string(path) == first, "Repeated remember preserves personal note and file")
	var changed = fixture(); changed.event_id = record.event_id; changed.source.get_ref().cars[3].damage += 1
	check(not CircuitNotebook.remember(changed, path).ok and FileAccess.get_file_as_string(path) == first, "Conflicting facts for one event never replace its history")
	check(not CircuitNotebook.forget(record.event_id, 0, path).ok, "Stale forget is rejected")
	check(RaceRecord.equivalent(original, sim.snapshot()), "Remembering, noting and conflicts leave all sporting state unchanged")
	var original_slot = "user://notebook-guard-original.json"; Storage.write_json(original_slot, {"original": true})
	var legacy = fixture("legacy"); check(CircuitNotebook.remember(legacy, path).ok, "Legacy continuation is explicitly recordable")
	check(NotebookEntry.describe(NotebookEntry.build(legacy)).contains("Legacy continuation"), "Legacy incomplete-history provenance remains visible")
	for goal in ScenarioBrief.GOALS:
		for finishes in [false, true]:
			var sandbox = fixture("sandbox", goal, finishes)
			var sample = NotebookEntry.build(sandbox)
			check(NotebookEntry.validate(sample), "Challenge evidence validates " + goal + "/" + str(finishes))
			check(sample.facts.challenge.outcome == ("observation" if goal == "observe" else ("met" if finishes else "not_met")), "Goal derives only from final status and position " + goal + "/" + str(finishes))
			check(CircuitNotebook.remember(sandbox, path).ok, "Completed experiment is remembered as sandbox " + goal + "/" + str(finishes))
			check(not ResultReceipts.accept(sandbox, original_slot).ok, "Notebook never grants original result authority " + goal)
	check(FileAccess.get_file_as_string(original_slot).contains("original"), "Remembered challenges cannot alter result/continuation slots")
	var running = PracticeRaceSim.new(sim.track); var pending = RaceRecord.new(); pending.attach(running)
	check(not CircuitNotebook.remember(pending, path).ok, "Unfinished race cannot be remembered as a final result")
	var detached = RaceRecord.new()
	check(not CircuitNotebook.remember(detached, path).ok, "Missing source fails without a runtime error")
	for bad_value in [null, 5, [], {}, {"facts":null}]: check(not NotebookEntry.validate(bad_value), "Malformed entry rejected: " + str(bad_value))
	for key in entry.facts:
		var bad = copy(entry); bad.facts[key] = null; redigest(bad)
		check(not NotebookEntry.validate(bad), "Missing fact rejected: " + key)
	for key in entry.facts.context:
		var bad = copy(entry); bad.facts.context[key] = null; redigest(bad)
		check(not NotebookEntry.validate(bad), "Malformed context rejected: " + key)
	var bad = copy(entry); bad.facts.players[0].laps = 5; redigest(bad)
	check(not NotebookEntry.validate(bad), "Impossible finishing distance rejected")
	bad = copy(entry); bad.facts.players[0].position = bad.facts.players[1].position; redigest(bad)
	check(not NotebookEntry.validate(bad), "Duplicate positions rejected")
	bad = copy(entry); bad.facts.context.track_hash = "a".repeat(64); redigest(bad)
	check(not NotebookEntry.validate(bad), "Circuit snapshot identity must match")
	bad = NotebookEntry.build(fixture("sandbox", "finish_both")); bad.facts.challenge.outcome = "met"; redigest(bad)
	check(not NotebookEntry.validate(bad), "Fabricated completed goal rejected even with a recomputed digest")
	bad = copy(entry); bad.digest = "f".repeat(64)
	check(not NotebookEntry.validate(bad), "Changed evidence digest is rejected")
	var duplicate = CircuitNotebook.empty(); duplicate.entries = [entry, entry.duplicate(true)]
	check(not CircuitNotebook.valid(duplicate), "Duplicate event identities are invalid")
	var corrupt = "user://notebook-corrupt.json"; Storage.write_json(corrupt, {"broken":true})
	check(not CircuitNotebook.remember(record, corrupt).ok and Storage.read_json(corrupt).data.has("broken"), "Corrupt notebook is retained, not reset")
	var full = CircuitNotebook.empty()
	for i in range(CircuitNotebook.MAX_ENTRIES):
		var item = copy(entry); item.facts.event_id = "%032x" % i; item.note = "n".repeat(NotebookEntry.MAX_NOTE); redigest(item); full.entries.append(item)
	var full_path = "user://notebook-full.json"; Storage.write_json(full_path, full)
	check(CircuitNotebook.valid(full), "Bounded full notebook validates")
	var read_cost: Array = []
	for i in range(23):
		var started = Time.get_ticks_usec(); var measured = CircuitNotebook.read(full_path)
		if i >= 3: read_cost.append((Time.get_ticks_usec() - started) / 1000.0)
		if not measured.ok: check(false, "Populated benchmark notebook must validate")
	read_cost.sort()
	var performance = {"cpu": OS.get_processor_name(), "engine": Engine.get_version_info().string, "entries": CircuitNotebook.MAX_ENTRIES, "note_characters_each": NotebookEntry.MAX_NOTE,
		"bytes": FileAccess.get_file_as_bytes(full_path).size(), "samples": read_cost.size(), "median_ms": read_cost[read_cost.size()/2], "p95_ms": read_cost[int(ceil(read_cost.size()*0.95))-1],
		"scope":"Synthetic full compact notebook; synchronous disk read plus validation. Three warm-ups, twenty serial samples. Not a baseline speedup, UI frame time or maximum 16MB replay measurement."}
	Storage.write_json("res://reports/notebook-performance.json", performance)
	first = FileAccess.get_file_as_string(full_path)
	check(not CircuitNotebook.remember(record, full_path).ok and FileAccess.get_file_as_string(full_path) == first, "Full notebook rejects without eviction")
	check(CircuitNotebook.forget(record.event_id, 1, path).ok, "Explicit forget removes only the selected entry")
	check(CircuitNotebook.read(path).data.entries.all(func(e): return e.facts.event_id != record.event_id), "Other histories remain after forget")
	check(RaceRecord.equivalent(original, sim.snapshot()), "Deleting notebook history cannot modify the source race")
	# Authoring contracts absent from the inherited verifier are exercised here.
	var author_source = PracticeRaceSim.new(sim.track); var source_before = author_source.snapshot()
	var brief = ScenarioBrief.defaults(); brief.goal = "finish_both"
	var scenario = ReplayScenario.build(author_source, {"event_id":record.event_id}, brief)
	check(ReplayScenario.validate(scenario).is_empty() and ReplayScenario.validate(copy(scenario)).is_empty(), "Frozen authored scenario validates before and after JSON")
	check(RaceRecord.equivalent(source_before, author_source.snapshot()), "Authoring a challenge leaves its source unchanged")
	check(author_source.input_accepted.get_connections().is_empty(), "Scenario export detaches its temporary recorder")
	var invalid = copy(scenario); invalid.brief.goal = "win_bonus"
	check(not ReplayScenario.validate(invalid).is_empty(), "Unsupported authored rewards/goal cannot execute")
	invalid = copy(scenario); invalid.record.origin = "standalone"
	check(not ReplayScenario.validate(invalid).is_empty(), "Authored data cannot relabel itself an original")
	var legal_modes = fixture(); legal_modes.initial.weather_state.model.mode = "scripted_training"
	legal_modes.source.get_ref().weather_state.model.mode = "scripted_training"
	check(NotebookEntry.validate(NotebookEntry.build(legal_modes)), "Historical scripted-training weather remains recordable")
	var report = {"passed":failures.is_empty(), "checks":checks, "failures":failures, "engine":Engine.get_version_info().string, "scope":"Synthetic terminal fixtures and storage/authoring contracts; complete races tested separately."}
	Storage.write_json("res://reports/notebook-tests.json", report); print("NOTEBOOK_TESTS ", JSON.stringify(report)); quit(0 if failures.is_empty() else 1)
