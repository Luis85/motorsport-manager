extends SceneTree
## The former traversal is a test oracle, not a replacement replay representation.
var checks: int = 0
var failures: Array[String] = []
var generator = RandomNumberGenerator.new()


func _initialize() -> void:
	call_deferred("run")


func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)


func reference_paths(value: Variant, path: Array = []) -> Array:
	var result: Array = []
	if value is int:
		result.append(path.duplicate())
	elif value is Dictionary or value is Array:
		for key in value.keys() if value is Dictionary else range(value.size()):
			result.append_array(reference_paths(value[key], path + [key]))
	return result


func sample(depth: int) -> Variant:
	if depth == 0:
		return [null, true, false, 3, 3.0, "3", -1, 0.25][generator.randi_range(0, 7)]
	if generator.randi_range(0, 1) == 0:
		var record: Dictionary = {}
		for index in range(generator.randi_range(0, 4)):
			record["field-%d" % index] = sample(depth - 1)
		return record
	var values: Array = []
	for index in range(generator.randi_range(0, 4)):
		values.append(sample(depth - 1))
	return values


func compare(value: Variant, prefix: Array) -> void:
	var before = JSON.stringify(value)
	var original_prefix = prefix.duplicate(true)
	var paths = RaceRecord.integer_paths(value, prefix)
	check(paths == reference_paths(value, prefix), "Traversal preserves path contents and order")
	check(
		prefix == original_prefix and JSON.stringify(value) == before,
		"Traversal preserves input and supplied prefix"
	)
	if not paths.is_empty():
		var original = paths.duplicate(true)
		paths[0].append("modified by observer")
		check(
			RaceRecord.integer_paths(value, prefix) == original,
			"Returned paths are detached between calls"
		)


func run() -> void:
	for value in [null, true, 4, 4.0, [], {}, {"z": [1, 2.0], "a": {"n": -1}}]:
		compare(value, [])
		compare(value, ["prefix", 2])
	for seed_value in [17, 7314, 9182]:
		generator.seed = seed_value
		for index in range(48):
			compare(sample(4), ["seed-%d" % seed_value])
	var sim = PracticeRaceSim.new(
		TrackGeometry.new(TrackEditorSession.blank_document()),
		{"laps": 6, "qual_duration": 240, "scenario": "dry", "intensity": "calm", "seed": 7314}
	)
	var record = RaceRecord.new()
	record.attach(sim)
	var before = sim.snapshot()
	compare(before, [])
	var data = record.seal()
	check(
		data.initial_integers == reference_paths(data.initial),
		"Initial saved type paths retain the existing contract"
	)
	check(
		data.endpoint_integers == reference_paths(data.endpoint),
		"Endpoint saved type paths retain the existing contract"
	)
	check(sim.snapshot() == before, "Sealing consumes no sporting state or RNG")
	check(
		RaceRecord.validate(data).is_empty(),
		"Normal replay validator accepts the unchanged recording"
	)
	var json_data = JSON.parse_string(JSON.stringify(data, "", false, true))
	check(
		RaceRecord.validate(json_data).is_empty(),
		"JSON serialization retains the existing replay integrity contract"
	)
	var restored = PracticeRaceSim.restore_practice(
		RaceRecord.apply_types(json_data.endpoint, json_data.endpoint_integers)
	)
	check(
		restored != null and RaceRecord.equivalent(before, restored.snapshot()),
		"Production restore retains complete state"
	)
	record.detach()
	var report = {
		"passed": failures.is_empty(),
		"checks": checks,
		"failures": failures,
		"seeds": [17, 7314, 9182],
		"random_stream": "test-only RandomNumberGenerator"
	}
	Storage.write_json("res://reports/record-traversal-tests.json", report)
	print("RECORD_TRAVERSAL ", JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
