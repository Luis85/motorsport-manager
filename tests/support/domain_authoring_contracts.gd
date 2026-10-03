extends SceneTree
## Dependency-free deterministic regression suite. Every failed assertion affects exit status.
var failures: Array[String] = []
var checks = 0
var tracks: Array = []
var geometries: Array = []
var results: Array = []
var started = 0


func _initialize() -> void:
	call_deferred("run")


func check(condition: bool, description: String) -> void:
	checks += 1
	if not condition:
		failures.append(description)
		push_error(description)


func near(a: float, b: float, epsilon: float, description: String) -> void:
	check(absf(a - b) <= epsilon, description + " (%s vs %s)" % [a, b])


func ticks(sim: RaceSim, count: int) -> void:
	for i in range(count):
		sim.step()


func until_phase(sim: RaceSim, phase: String, maximum: int = 50000) -> bool:
	for i in range(maximum):
		if sim.phase == phase:
			return true
		sim.step()
	return false


func blank_race(g: TrackGeometry, options: Dictionary = {}) -> RaceSim:
	var sim = RaceSim.new(g, options)
	sim.command("prepare_race")
	sim.command("formation")
	# Fixture bypasses elapsed formation, not the public state-transition contract.
	for car in sim.cars:
		car.formation_done = true
	sim.step()
	sim.command("lights")
	until_phase(sim, "race", 200)
	return sim


func test_authoring() -> void:
	var d = TrackDocument.normalize(tracks[7])
	var before = TrackGeometry.new(d)
	test_pit_nodes_import(before.document)
	var i = 2
	var t = 0.37
	var a = d.nodes[i]
	var b = d.nodes[(i + 1) % d.nodes.size()]
	var original = [
		TrackDocument.point(a),
		TrackDocument.point(a) + TrackDocument.handle(a, "out"),
		TrackDocument.point(b) + TrackDocument.handle(b, "in"),
		TrackDocument.point(b)
	]
	var middle = TrackDocument.split_segment(d, i, t)
	check(middle == i + 1 and d.nodes.size() == 15, "Split inserts exactly one control point")
	var split = TrackGeometry.new(d)
	near(before.length, split.length, 0.15, "De Casteljau split preserves total arc length")
	var shape_error = 0.0
	for j in range(101):
		var f = float(j) / 100
		var expected = original[0].bezier_interpolate(original[1], original[2], original[3], f)
		var na = d.nodes[i if f <= t else i + 1]
		var nb = d.nodes[i + 1 if f <= t else i + 2]
		var local_t = f / t if f <= t else (f - t) / (1 - t)
		var actual = TrackDocument.point(na).bezier_interpolate(
			TrackDocument.point(na) + TrackDocument.handle(na, "out"),
			TrackDocument.point(nb) + TrackDocument.handle(nb, "in"),
			TrackDocument.point(nb),
			local_t
		)
		shape_error = maxf(shape_error, expected.distance_to(actual))
	near(shape_error, 0, 0.002, "Split is shape preserving across the full cubic")
	var auto = TrackDocument.normalize(tracks[7])
	for node in auto.nodes:
		node.erase("in")
		node.erase("out")
	auto.kind = "circuit-atelier-project"
	auto.version = 4
	var automatic = TrackGeometry.new(auto)
	near(
		automatic.length,
		before.length,
		0.2,
		"Circuit Atelier automatic centripetal handles are reconstructed"
	)
	var copy = before.document.duplicate(true)
	copy.nodes[0].x += 10
	check(
		before.document.nodes[0].x != copy.nodes[0].x, "Compiled document is isolated from editing"
	)
	var bad_cases: Array = [null, [], {}, {"name": "Broken", "nodes": []}]
	for modify in [
		func(x): x.version = 99,
		func(x): x.nodes[0].x = NAN,
		func(x): x.nodes[0].w = 0,
		func(x): x.nodes[0]["in"] = [],
		func(x): x.pits[0].speed = "wrong",
		func(x): x.features[0].width = {},
		func(x): x.reference = "wrong",
		func(x): x.grid = "wrong",
		func(x): x.start = 2.0,
		func(x): x.timingGates = [{"f": "bad"}],
		func(x): x.nodes = [x.nodes[0], x.nodes[0], x.nodes[0], x.nodes[0]]
	]:
		var invalid = before.document.duplicate(true)
		modify.call(invalid)
		bad_cases.append(invalid)
	for invalid in bad_cases:
		check(not TrackDocument.validate(invalid).is_empty(), "Reject malformed authoring input")
	var gt = TrackGeometry.new(tracks[1], "GT")
	check(gt.estimate > geometries[1].estimate, "GT reference pace is slower than Formula on Monza")
	near(
		geometries[3].sector_ends[0] / geometries[3].length,
		0.33,
		0.001,
		"Silverstone sectors respect rotated start/finish"
	)


func test_pit_nodes_import(document: Dictionary) -> void:
	var editor = TrackEditorSession.new(document)
	var original = editor.read_document()
	var revision = editor.revision
	var history = editor.history()
	var cases: Array = [{"entry": 0.1, "exit": 0.2}]
	for nodes in [null, false, 0, "wrong", {}]:
		cases.append({"entry": 0.1, "exit": 0.2, "nodes": nodes})
	for pit in cases:
		var imported = document.duplicate(true)
		imported.pits = [pit]
		var fingerprint = RaceStateValue.fingerprint(imported)
		check(
			TrackDocument.validate(imported) == ["Invalid pit lane."],
			"Imported pit lane requires an explicit point array"
		)
		check(
			TrackDocument.publication_errors(imported) == ["Invalid pit lane."],
			"Malformed pit points cannot reach publication or geometry compilation"
		)
		check(not editor.replace(imported), "Malformed pit import is rejected by the editor")
		check(
			(
				editor.read_document() == original
				and editor.revision == revision
				and editor.history() == history
			),
			"Rejected pit import retains the document, revision and undo history"
		)
		check(
			RaceStateValue.fingerprint(imported) == fingerprint,
			"Pit validation and rejected import preserve the caller's input"
		)
	var empty_lane = document.duplicate(true)
	empty_lane.pits = [{"entry": 0.1, "exit": 0.2, "nodes": []}]
	check(
		TrackDocument.validate(empty_lane).is_empty(),
		"An explicit empty pit-point array retains the supported direct-join lane"
	)


func test_storage() -> void:
	var path = "user://tests/atomic.json"
	check(Storage.write_json(path, {"value": 1}).is_empty(), "First atomic write succeeds")
	check(Storage.write_json(path, {"value": 2}).is_empty(), "Second atomic write succeeds")
	check(Storage.read_json(path).data.value == 2, "Current version contains replacement")
	check(
		Storage.read_json(path + ".bak").data.value == 1, "Atomic backup preserves previous version"
	)
	var f = FileAccess.open("user://tests/broken.json", FileAccess.WRITE)
	f.store_string("{bad}")
	f.close()
	check(
		not Storage.read_json("user://tests/broken.json").ok,
		"Malformed JSON is reported, not silently replaced"
	)
	check(not Storage.read_json("user://tests/missing.json").ok, "Missing file is reported")
