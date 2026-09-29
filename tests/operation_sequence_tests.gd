extends SceneTree
## Seeds are exploratory recipes. No run rewrites pinned regression fixtures.
const Recipe = preload("res://tests/support/operation_recipe.gd")
const RaceCase = preload("res://tests/support/race_sequence_case.gd")
const EditorCase = preload("res://tests/support/editor_sequence_case.gd")
var checks = 0
var failures: Array = []
var cases: Array = []
var source_revision = ""

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, invariant: String, evidence: Dictionary = {}) -> void:
	checks += 1
	if not value: failures.append({"invariant": invariant, "evidence": evidence})

func run() -> void:
	source_revision = OS.get_environment("MOTORSPORT_SOURCE_REVISION")
	if source_revision.is_empty(): source_revision = OS.get_environment("GITHUB_SHA")
	var input_path = ""
	for argument in OS.get_cmdline_user_args():
		if argument.begins_with("--sequence="): input_path = argument.trim_prefix("--sequence=")
	if input_path.is_empty():
		for seed_value in [1709, 2719, 7919]:
			var sim = PracticeRaceSim.new(TrackGeometry.new(Storage.read_json("res://data/tracks/hillside.json").data),
				{"seed": 7314, "scenario": "dry", "intensity": "calm", "laps": 6})
			var initial = sim.snapshot()
			var race_operations = Recipe.race(seed_value)
			var editor_operations = Recipe.editor(seed_value)
			check(RaceRecord.equivalent(initial, sim.snapshot()), "Recipe generation never consumes the gameplay random stream")
			run_race(initial, race_operations, seed_value)
			run_editor(TrackEditorSession.blank_document(), editor_operations, seed_value)
		transition_sequence()
	else:
		var loaded = Storage.read_json(input_path)
		check(loaded.ok and loaded.data is Dictionary, "Sequence evidence is readable")
		if loaded.ok and loaded.data is Dictionary:
			var data = loaded.data
			if data.get("kind") == RaceReproduction.KIND:
				var error = RaceReproduction.validate(data)
				var valid = error.is_empty() and data.failure.get("operations") is Array and RaceCheckpoint.integral(data.failure.get("sequence_seed"), 0, 2147483647)
				check(valid, "Race test recipe and underlying record validate", {"error": error})
				if valid: run_race(RaceRecord.apply_types(data.record.initial, data.record.initial_integers), data.failure.operations, int(data.failure.sequence_seed))
			elif data.get("kind") == "motorsport-manager-editor-test-sequence":
				var valid = data.get("initial") is Dictionary and data.get("operations") is Array and RaceCheckpoint.integral(data.get("sequence_seed"), 0, 2147483647)
				if valid: valid = TrackDocument.draft_errors(data.initial).is_empty()
				check(valid, "Editor test recipe contains a valid initial draft and bounded seed")
				if valid: run_editor(data.initial, data.operations, int(data.sequence_seed))
			else: check(false, "Unknown developer test recipe; sporting saves are not operation sequences")
	check(not Recipe.valid([{"op": "select", "id": 1.5}], "race"), "Malformed replay input is not silently truncated")
	check(not Recipe.valid([{"op": "transform", "dx": 3}], "editor"), "Incomplete editor recipes fail closed")
	check(not Recipe.valid([{"op": "unknown"}], "race"), "Unknown recipe operations fail closed")
	var report = {"passed": failures.is_empty(), "checks": checks, "failures": failures,
		"source_revision": source_revision, "engine": Engine.get_version_info().string,
		"cases": cases, "fixture_policy": "Exploration never rewrites pinned sporting or regression fixtures."}
	Storage.write_json("res://reports/operation-sequence-tests.json", report)
	print("OPERATION_SEQUENCES ", JSON.stringify(report))
	for failure in failures: push_error(str(failure))
	quit(0 if failures.is_empty() else 1)

func run_race(initial: Dictionary, operations: Array, seed_value: int) -> void:
	check(Recipe.valid(operations, "race"), "Race recipe is finite and bounded")
	if not Recipe.valid(operations, "race"): return
	var reference: Dictionary = {}
	for variant in range(3):
		var runner = RaceCase.new()
		runner.configure(initial, operations, seed_value, 2 if variant == 2 else 0, variant != 0)
		var result = runner.run()
		checks += result.checks
		check(result.passed, "Generated race sequence properties hold", {"seed": seed_value, "variant": variant, "failures": result.failures})
		if variant == 0: reference = result
		else:
			check(RaceRecord.equivalent(reference.state, result.state), "Restore and observation schedules preserve subsequent complete state", {"seed": seed_value, "difference": StateDivergence.first(reference.state, result.state)})
			check(RaceRecord.equivalent(reference.inputs, result.inputs), "Restore and observation schedules preserve accepted command history", {"seed": seed_value})
		var failed = not result.passed or not RaceRecord.equivalent(reference.state, result.state) or not RaceRecord.equivalent(reference.inputs, result.inputs)
		var evidence_path = ""
		if failed:
			evidence_path = "res://reports/race-sequence-%d-%d.json" % [seed_value, variant]
			result.reproduction.failure.failures = result.failures
			result.reproduction.failure.comparison = StateDivergence.first(reference.state, result.state)
			check(Storage.write_json(evidence_path, result.reproduction).is_empty(), "Failure emits a replay plus the exact test-input sequence")
		cases.append({"domain": "race", "seed": seed_value, "variant": variant, "operations": operations.size(),
			"recipe_sha256": RaceStateValue.fingerprint(operations), "stats": result.stats, "failure_file": evidence_path})

func run_editor(initial: Dictionary, operations: Array, seed_value: int) -> void:
	check(Recipe.valid(operations, "editor"), "Editor recipe is finite and bounded")
	if not Recipe.valid(operations, "editor"): return
	var runner = EditorCase.new()
	runner.configure(initial, operations)
	var result = runner.run()
	checks += result.checks
	check(result.passed, "Generated editor sequence properties hold", {"seed": seed_value, "failures": result.failures})
	var evidence_path = ""
	if not result.passed:
		evidence_path = "res://reports/editor-sequence-%d.json" % seed_value
		var evidence = {"kind": "motorsport-manager-editor-test-sequence", "version": 1,
			"source_revision": source_revision, "engine": Engine.get_version_info().string,
			"sequence_seed": seed_value, "initial": initial, "operations": operations, "result": result}
		check(Storage.write_json(evidence_path, evidence).is_empty(), "Editor failure emits the exact initial document and operation sequence")
	cases.append({"domain": "editor", "seed": seed_value, "operations": operations.size(),
		"recipe_sha256": RaceStateValue.fingerprint(operations), "stats": result.stats, "failure_file": evidence_path})

func transition_sequence() -> void:
	# Empty sessions isolate approval sequencing. Physical full-weekend acceptance
	# is retained separately; this is explicitly not a substitute for driving laps.
	var sim = PracticeRaceSim.new(TrackGeometry.new(Storage.read_json("res://data/tracks/hillside.json").data), {"seed": 7314})
	var operations: Array = [{"op": "stage"}, {"op": "stage"},
		{"op": "advance", "delta": 0.05, "frames": 1}, {"op": "restore"},
		{"op": "stage"}, {"op": "stage"},
		{"op": "advance", "delta": 0.05, "frames": 1}, {"op": "restore"},
		{"op": "stage"}, {"op": "pause"}, {"op": "restore"}]
	run_race(sim.snapshot(), operations, 0)
