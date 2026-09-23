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
		failures.append(description); push_error(description)

func near(a: float, b: float, epsilon: float, description: String) -> void:
	check(absf(a - b) <= epsilon, description + " (%s vs %s)" % [a, b])

func ticks(sim: RaceSim, count: int) -> void:
	for i in range(count): sim.step()

func until_phase(sim: RaceSim, phase: String, maximum: int = 50000) -> bool:
	for i in range(maximum):
		if sim.phase == phase: return true
		sim.step()
	return false

func blank_race(g: TrackGeometry, options: Dictionary = {}) -> RaceSim:
	var sim = RaceSim.new(g, options)
	sim.command("prepare_race"); sim.command("formation")
	# Fixture bypasses elapsed formation, not the public state-transition contract.
	for car in sim.cars: car.formation_done = true
	sim.step(); sim.command("lights")
	until_phase(sim, "race", 200)
	return sim

func run() -> void:
	started = Time.get_ticks_msec()
	var catalog = Storage.read_catalog()
	check(catalog.ok and catalog.data is Array, "Bundled catalog parses")
	if not catalog.ok: finish(); return
	tracks = catalog.data
	check(tracks.size() == 8, "Eight circuits are bundled")
	for source in tracks:
		check(TrackDocument.validate(source).is_empty(), source.name + ": authoring schema")
		var g = TrackGeometry.new(source); geometries.append(g)
		check(g.length > 1000 and g.length < 15000, source.name + ": reasonable arc length")
		check(g.points.size() >= 64 and g.points.size() <= 4096, source.name + ": bounded bake size")
		near(g.sample(0).p.distance_to(g.sample(g.length).p), 0, 0.001, source.name + ": loop closes")
		near(g.sample(-13).p.distance_to(g.sample(g.length - 13).p), 0, 0.001, source.name + ": negative station wraps")
		check(g.pit_exit > g.pit_entry and g.pit_length > 30, source.name + ": usable unwrapped pit route")
		check(g.sector_ends.size() == 3 and g.sector_ends[0] < g.sector_ends[1], source.name + ": timing gates compiled")
		var valid = true
		for i in range(g.points.size()):
			if not is_finite(g.speeds[i]) or g.speeds[i] <= 0 or g.speeds[i] > 89.001 or absf(g.offsets[i]) > g.widths[i] * 0.5 - 1.49: valid = false
		check(valid, source.name + ": finite speed profile and bounded racing line")
		if source.get("reference_length", 0) > 0: near(g.length, source.reference_length, source.reference_length * 0.005, source.name + ": source length within 0.5%")
		var roundtrip = JSON.parse_string(JSON.stringify(g.document, "", false, true))
		check(TrackDocument.validate(roundtrip).is_empty(), source.name + ": JSON round trip remains valid")
		var runtime = g.runtime_export()
		check(runtime.samples.size() == g.points.size() and runtime.kind == "motorsport-manager-runtime", source.name + ": self-describing runtime export")
		results.append({"track": source.name, "metres": g.length, "samples": g.points.size(), "reference_lap_seconds": g.estimate})
	print("Geometry matrix complete")
	test_authoring()
	test_storage()
	test_transitions_and_weekend()
	test_determinism_and_checkpoint()
	test_flags_and_finish()
	test_wet_and_vehicle()
	load("res://tests/foundation_tests.gd").new().run(self)
	load("res://tests/iteration3_tests.gd").new().run(self)
	finish()

func test_authoring() -> void:
	var d = TrackDocument.normalize(tracks[7])
	var before = TrackGeometry.new(d)
	var i = 2; var t = 0.37
	var a = d.nodes[i]; var b = d.nodes[(i + 1) % d.nodes.size()]
	var original = [TrackDocument.point(a), TrackDocument.point(a) + TrackDocument.handle(a, "out"), TrackDocument.point(b) + TrackDocument.handle(b, "in"), TrackDocument.point(b)]
	var middle = TrackDocument.split_segment(d, i, t)
	check(middle == i + 1 and d.nodes.size() == 15, "Split inserts exactly one control point")
	var split = TrackGeometry.new(d)
	near(before.length, split.length, 0.15, "De Casteljau split preserves total arc length")
	var shape_error = 0.0
	for j in range(101):
		var f = float(j) / 100
		var expected = original[0].bezier_interpolate(original[1], original[2], original[3], f)
		var na = d.nodes[i if f <= t else i + 1]; var nb = d.nodes[i + 1 if f <= t else i + 2]
		var local_t = f / t if f <= t else (f - t) / (1 - t)
		var actual = TrackDocument.point(na).bezier_interpolate(TrackDocument.point(na) + TrackDocument.handle(na, "out"), TrackDocument.point(nb) + TrackDocument.handle(nb, "in"), TrackDocument.point(nb), local_t)
		shape_error = maxf(shape_error, expected.distance_to(actual))
	near(shape_error, 0, 0.002, "Split is shape preserving across the full cubic")
	var auto = TrackDocument.normalize(tracks[7])
	for node in auto.nodes: node.erase("in"); node.erase("out")
	auto.kind = "circuit-atelier-project"; auto.version = 4
	var automatic = TrackGeometry.new(auto)
	near(automatic.length, before.length, 0.2, "Circuit Atelier automatic centripetal handles are reconstructed")
	var copy = before.document.duplicate(true); copy.nodes[0].x += 10
	check(before.document.nodes[0].x != copy.nodes[0].x, "Compiled document is isolated from editing")
	var bad_cases: Array = [null, [], {}, {"name": "Broken", "nodes": []}]
	for modify in [func(x): x.version = 99, func(x): x.nodes[0].x = NAN, func(x): x.nodes[0].w = 0, func(x): x.nodes[0]["in"] = [], func(x): x.pits[0].speed = "wrong", func(x): x.features[0].width = {}, func(x): x.reference = "wrong", func(x): x.grid = "wrong", func(x): x.start = 2.0, func(x): x.timingGates = [{"f": "bad"}], func(x): x.nodes = [x.nodes[0], x.nodes[0], x.nodes[0], x.nodes[0]]]:
		var invalid = before.document.duplicate(true); modify.call(invalid); bad_cases.append(invalid)
	for invalid in bad_cases: check(not TrackDocument.validate(invalid).is_empty(), "Reject malformed authoring input")
	var gt = TrackGeometry.new(tracks[1], "GT")
	check(gt.estimate > geometries[1].estimate, "GT reference pace is slower than Formula on Monza")
	near(geometries[3].sector_ends[0] / geometries[3].length, 0.33, 0.001, "Silverstone sectors respect rotated start/finish")

func test_storage() -> void:
	var path = "user://tests/atomic.json"
	check(Storage.write_json(path, {"value": 1}).is_empty(), "First atomic write succeeds")
	check(Storage.write_json(path, {"value": 2}).is_empty(), "Second atomic write succeeds")
	check(Storage.read_json(path).data.value == 2, "Current version contains replacement")
	check(Storage.read_json(path + ".bak").data.value == 1, "Atomic backup preserves previous version")
	var f = FileAccess.open("user://tests/broken.json", FileAccess.WRITE); f.store_string("{bad}"); f.close()
	check(not Storage.read_json("user://tests/broken.json").ok, "Malformed JSON is reported, not silently replaced")
	check(not Storage.read_json("user://tests/missing.json").ok, "Missing file is reported")

func test_transitions_and_weekend() -> void:
	var sim = RaceSim.new(geometries[7], {"laps": 5, "qual_duration": 180, "scenario": "dry", "intensity": "calm"})
	check(not sim.command("lights"), "Cannot release lights before formation")
	check(not sim.command("pace", {"id": 0, "value": 2}), "Spectator cannot command an AI driver")
	check(sim.command("qualify"), "Briefing starts qualifying")
	check(not sim.command("prepare_race"), "Cannot skip an active qualifying session")
	check(sim.command("auto", {"id": 3, "value": false}), "Manual qualifying release is supported")
	check(sim.command("send", {"id": 3}), "Manual send-out leaves the garage")
	check(not sim.command("send", {"id": 3}), "Duplicate send-out is rejected")
	check(until_phase(sim, "qualifying_results", 16000), "Qualifying runs finish and return to garages")
	var times = true; var garages = true
	for car in sim.cars:
		if car.qual_best <= 0 or car.qual_laps < 1: times = false
		if car.route != "garage": garages = false
	check(times, "Every driver sets a measured flying lap")
	check(garages, "All qualifying cars return to garages")
	var order = sim.standings(true)
	for i in range(1, order.size()): check(order[i].qual_best >= order[i - 1].qual_best and order[i].grid == i + 1, "Qualifying grid follows measured times")
	var old_clock = sim.clock; ticks(sim, 20); near(sim.clock, old_clock, 0, "Results wait for player approval")
	var surface = sim.rubber.duplicate()
	check(sim.command("prepare_race"), "Player advances into race preparation")
	check(sim.rubber == surface, "Qualifying surface carries into race preparation")
	check(sim.command("formation"), "Player starts formation")
	check(until_phase(sim, "grid_ready", 12000), "Physical formation returns all cars to the grid")
	var ready = true
	for car in sim.cars:
		if not car.formation_done or car.completed != 0 or car.speed != 0: ready = false
	check(ready, "Formation warms tyres but counts zero racing laps")
	check(sim.cars[0].temperature > 65 and sim.cars[0].fuel < 5 * 1.13 + 1.5, "Formation consumes fuel and warms tyres")
	check(sim.command("lights") and until_phase(sim, "race", 200), "Five lights lead to a standing race start")
	check(sim.command("pace", {"id": 3, "value": 2}), "Player can command push pace")
	sim.engineer(sim.cars[3]); check(sim.cars[3].pace == 2 and not sim.cars[3].auto, "Engineer does not overwrite a manual command")
	ticks(sim, 300)
	check(sim.command("compound", {"id": 3, "value": "S"}) and sim.command("pit", {"id": 3}), "Tyre selection and pit call are accepted")
	check(sim.command("compound", {"id": 6, "value": "H"}) and sim.command("pit", {"id": 6}), "Both teammates can request the shared box")
	var entered = false; var limited = true; var monotonic = true
	for tick in range(30000):
		var previous = sim.cars.map(func(c): return c.distance)
		sim.step()
		for car in sim.cars:
			if car.distance + 0.00001 < previous[car.id]: monotonic = false
			if car.route == "pit":
				entered = true
				if car.speed > sim.track.pit_limit + 0.01: limited = false
		if sim.phase == "results": break
	check(entered, "Cars traverse the physical pit lane")
	check(limited, "Pit speed limit is enforced")
	check(monotonic, "Race station never moves backwards, including pit wrapping")
	check(sim.cars[3].pit_stops >= 1 and sim.cars[6].pit_stops >= 1, "Both teammates complete service")
	check(sim.cars[3].compound == "S" and sim.cars[6].compound == "H", "Requested compounds are fitted")
	check(sim.phase == "results" and sim.finish_count == 12, "Full weekend ends with twelve classified finishers")
	order = sim.standings()
	for i in range(order.size()): check(order[i].finished and order[i].finish_position == i + 1 and order[i].completed > 0, "Final classification is complete and ordered")
	check(sim.events.any(func(e): return e.kind == "pit") and sim.commands.size() > 5, "Race log records events and commands")
	print("Full qualifying/formation/race/pit lifecycle complete")

func test_determinism_and_checkpoint() -> void:
	var a = blank_race(geometries[7], {"laps": 12, "scenario": "changeable", "seed": 4481})
	var b = blank_race(geometries[7], {"laps": 12, "scenario": "changeable", "seed": 4481})
	for i in range(500): a.advance(0.02)
	for i in range(200): b.advance(0.05)
	near(a.clock, b.clock, 0.000001, "Frame partitioning produces identical fixed-step time")
	near(a.cars[3].distance, b.cars[3].distance, 0.000001, "Frame partitioning produces identical motion")
	check(a.rng_state == b.rng_state, "Frame partitioning preserves seeded random state")
	var path = "user://tests/checkpoint.json"
	check(Storage.write_json(path, a.snapshot()).is_empty(), "Checkpoint serializes successfully")
	var restored = RaceSim.restore(Storage.read_json(path).data)
	check(restored != null, "Checkpoint restores from real JSON, including numeric conversions")
	if restored != null:
		ticks(a, 700); ticks(restored, 700)
		for i in range(12): near(a.cars[i].distance, restored.cars[i].distance, 0.00001, "Restored driver motion remains deterministic")
		check(a.rng_state == restored.rng_state and a.water == restored.water, "Restored RNG and surface remain identical")
	var before = a.clock; a.command("pause"); a.advance(0.2); near(a.clock, before, 0, "Pause stops simulation time")
	a.command("pause")
	var invalid = a.snapshot(); invalid.cars[0].compound = "INVALID"
	check(RaceSim.restore(invalid) == null, "Reject invalid checkpoint tyre enum")
	invalid = a.snapshot(); invalid.cars.pop_back()
	check(RaceSim.restore(invalid) == null, "Reject incomplete checkpoint roster")
	invalid = a.snapshot(); invalid.water[0] = -1
	check(RaceSim.restore(invalid) == null, "Reject invalid surface state")
	invalid = a.snapshot(); invalid.version = 99
	check(RaceSim.restore(invalid) == null, "Reject future checkpoint version")

func test_flags_and_finish() -> void:
	var sim = blank_race(geometries[7], {"laps": 3, "scenario": "dry", "intensity": "calm"})
	for c in sim.cars: c.dnf = true
	var front = sim.cars[0]; var behind = sim.cars[3]
	front.dnf = false; behind.dnf = false; front.distance = 500; behind.distance = 493.5; front.speed = 15; behind.speed = 65; front.lane = 0; behind.lane = 0
	sim.flag = "SAFETY CAR"; sim.flag_until = sim.clock + 200
	for i in range(200):
		sim.step()
		check(behind.distance < front.distance, "No passing under safety car")
	sim.flag = "GREEN"
	front.distance = sim.track.length * 2 + 500; behind.distance = 515; front.speed = 70; behind.speed = 45
	sim.step(); check(behind.blue, "A lapped car yields under blue flags")
	# Two cars cross in one physics tick: the earlier timestamp wins even if processed later.
	var finish = blank_race(geometries[7], {"laps": 1, "scenario": "dry", "intensity": "calm"})
	for c in finish.cars: c.dnf = true
	finish.cars[0].dnf = false; finish.cars[1].dnf = false
	finish.cars[0].completed = 1; finish.cars[1].completed = 1
	finish.cars[0].crossed_at = 60.04; finish.cars[1].crossed_at = 60.01
	finish.resolve_finishes()
	check(finish.cars[1].finish_position == 1 and finish.cars[0].finish_position == 2, "Close finishes use crossing time, not roster order")
	var all_out = blank_race(geometries[7], {"laps": 3, "scenario": "dry", "intensity": "calm"})
	for c in all_out.cars: all_out.retire(c, "Test retirement")
	all_out.step(); check(all_out.phase == "results", "All-DNF race terminates instead of hanging")
	var incident_sim = blank_race(geometries[7], {"laps": 12, "scenario": "dry", "intensity": "calm", "seed": 231})
	incident_sim.incident(incident_sim.cars[3])
	check(incident_sim.stats.incidents == 1 and incident_sim.flag != "GREEN", "Incidents trigger race-control neutralization")
	var late = sim.cars[6]; late.dnf = false; late.distance = sim.track.pit_entry - 5; late.speed = 70
	sim.queue_pit(late)
	check(late.pit_gate > sim.track.pit_entry + 1, "Unsafe late pit calls defer until the next lap")

func test_wet_and_vehicle() -> void:
	var sim = blank_race(geometries[0], {"laps": 2, "scenario": "wet", "intensity": "calm", "seed": 123})
	var c = sim.cars[3]; c.tyre = 100; c.temperature = 80
	c.compound = "S"; var slick_grip = sim.grip(c, 0)
	c.compound = "I"; var wet_grip = sim.grip(c, 0)
	check(wet_grip > slick_grip, "Intermediate tyres outperform slicks on a wet surface")
	var water_before = sim.average(sim.water); ticks(sim, 1000)
	check(sim.average(sim.water) != water_before and sim.rain > 0, "Surface water evolves over time, independently of rain")
	check(until_phase(sim, "results", 40000), "Wet Monaco race reaches classification")
	check(sim.finish_count > 0, "Wet Monaco has classified finishers")
	var gt = TrackGeometry.new(tracks[3], "GT")
	var rotated = blank_race(gt, {"laps": 2, "scenario": "dry", "intensity": "calm"})
	rotated.command("pit", {"id": 3})
	check(until_phase(rotated, "results", 40000), "GT Silverstone completes with a rotated start line")
	check(rotated.cars[3].pit_stops >= 1, "Pit routing works with a rotated start line")
	var weather = blank_race(geometries[7], {"laps": 4, "scenario": "changeable", "intensity": "calm"})
	weather.clock = weather.track.estimate * weather.laps * 0.4; weather.update_surface()
	check(weather.rain > 0.5 and weather.average(weather.water) < 0.01, "A rain onset does not instantly wet the track")
	print("Weather and vehicle matrix complete")

func finish() -> void:
	var elapsed = (Time.get_ticks_msec() - started) / 1000.0
	var report = {"passed": failures.is_empty(), "checks": checks, "failures": failures, "elapsed_seconds": elapsed, "engine": Engine.get_version_info().string, "circuits": results}
	Storage.write_json("res://reports/domain-tests.json", report)
	print("TEST_SUMMARY ", JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
