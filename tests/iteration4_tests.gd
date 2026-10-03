extends "res://tests/support/iteration4_physics_contracts.gd"


func run(harness) -> void:
	h = harness
	test_wheels()
	test_setup()
	test_continuation_comparison()
	test_continuation()
	test_selection()
	test_sketch()
	test_surface()
	test_incident_wheel_integrity()
	test_emergency_strategy()
	test_group_identifier_validation()


func scenery_document() -> Dictionary:
	var d = h.geometries[7].document.duplicate(true)
	d.objects = []
	for p in [Vector2(0, 0), Vector2(100, 20), Vector2(300, 50)]:
		d.objects.append({"type": "tree", "x": p.x, "y": p.y, "rotation": 0.0, "scale": 1.0})
	return d


func test_selection() -> void:
	var d = scenery_document()
	var original = d.duplicate(true)
	var result = TrackEdit.transform(d, "scenery", [0, 1], Vector2(20, 30), 90, 2)
	check(
		result.ok and d == original,
		"selection transform is transactional and leaves its input untouched"
	)
	h.near(
		TrackDocument.point(result.document.objects[0]).distance_to(
			TrackDocument.point(result.document.objects[1])
		),
		Vector2(100, 20).length() * 2,
		0.001,
		"group transform preserves scaled spacing"
	)
	check(
		result.document.objects[0].scale == 2 and result.document.objects[1].rotation == 90,
		"object rotations and scales follow the group transform"
	)
	check(
		not TrackEdit.transform(d, "scenery", [0, 1], Vector2(100001, 0)).ok and d == original,
		"out-of-bounds transform is atomic"
	)
	check(
		not TrackEdit.transform(d, "scenery", [0], Vector2.ZERO, 0, 9).ok,
		"unrepresentable object scale rejected"
	)
	result = TrackEdit.arrange(d, "scenery", [0, 1, 2], "x", true)
	check(
		result.ok and result.document.objects[1].x == 150, "distribution uses equal center spacing"
	)
	result = TrackEdit.arrange(d, "scenery", [0, 1, 2], "y")
	check(
		result.ok and result.document.objects[0].y == result.document.objects[2].y,
		"alignment places selection centers on one axis"
	)
	check(
		not TrackEdit.arrange(d, "scenery", [0, 1], "x", true).ok,
		"distribution explains its three-object minimum"
	)
	result = TrackEdit.group(d, [0, 1])
	d = result.document
	check(
		d.objects[0].group == d.objects[1].group and not d.objects[2].has("group"),
		"group membership is scoped to the selection"
	)
	var cloned = TrackEdit.duplicate_scenery(d, [0, 1])
	check(
		cloned.ok and cloned.document.objects.size() == 5,
		"duplicate produces exactly the selected objects"
	)
	check(
		(
			cloned.document.objects[3].group == cloned.document.objects[4].group
			and cloned.document.objects[3].group != d.objects[0].group
		),
		"duplicated group has independent membership"
	)
	check(TrackDocument.validate(cloned.document).is_empty(), "groups survive the authoring schema")
	check(
		not TrackEdit.group(d, [0, 1], true).document.objects[0].has("group"),
		"ungroup removes membership, not geometry"
	)
	result = TrackEdit.transform(d, "road", [0, 1], Vector2.ZERO, 90, 1.5)
	check(
		(
			result.ok
			and result.document.nodes[0].w == d.nodes[0].w
			and result.document.nodes[0].h == d.nodes[0].h
		),
		"plan-view road transforms retain road width and elevation"
	)
	h.near(
		TrackDocument.handle(result.document.nodes[0], "out").length(),
		TrackDocument.handle(d.nodes[0], "out").length() * 1.5,
		0.0001,
		"road handles scale with transformed nodes"
	)


func test_sketch() -> void:
	var d = scenery_document()
	var original = d.duplicate(true)
	var trace = TrackSketch.new()
	check(not trace.compile(d).ok, "open sketches cannot replace a circuit")
	check(
		trace.add_stroke(
			PackedVector2Array([Vector2(-300, -200), Vector2(300, -200), Vector2(350, 0)])
		),
		"first freehand segment is stored separately"
	)
	check(
		not trace.add_stroke(PackedVector2Array([Vector2(-200, 100), Vector2(300, 200)])),
		"disconnected strokes cannot silently bridge the circuit"
	)
	check(
		trace.add_stroke(
			PackedVector2Array(
				[Vector2(351, 0), Vector2(300, 200), Vector2(-300, 200), Vector2(-300, -200)]
			)
		),
		"continuation snaps to the previous endpoint"
	)
	trace.undo()
	check(trace.strokes.size() == 1, "trace undo removes one stroke")
	trace.redo()
	check(trace.strokes.size() == 2, "trace redo restores the stroke")
	check(trace.close_loop(), "sufficient trace points close explicitly")
	var result = trace.compile(d)
	check(result.ok and d == original, "preview compiles without touching the active road")
	if result.ok:
		check(
			(
				result.document.objects == d.objects
				and result.document.features.is_empty()
				and result.document.pits.is_empty()
			),
			"replacement retains scenery and clears old road-attached annotations"
		)
		check(
			TrackDocument.validate(result.document).is_empty(),
			"trace output uses the real authoring schema"
		)
		var g = TrackGeometry.new(result.document)
		check(
			g.length > 1000 and is_finite(g.estimate),
			"trace output bakes into a drivable bounded reference profile"
		)
	trace.undo()
	check(not trace.closed and trace.strokes.size() == 2, "undoing closure preserves the trace")
	trace.redo()
	check(
		trace.closed and trace.strokes.size() == 2,
		"redo restores explicit closure without duplicating a stroke"
	)
	trace.undo()
	trace.undo()
	trace.redo()
	trace.redo()
	check(
		trace.closed and trace.strokes.size() == 2,
		"redo of multiple undos restores strokes before restoring closure"
	)
	var bad = TrackSketch.new()
	check(
		not bad.add_stroke(PackedVector2Array([Vector2.ZERO, Vector2(NAN, 0)])),
		"nonfinite trace rejected before document mutation"
	)
	bad.clear()
	check(
		bad.strokes.is_empty() and bad.future.is_empty(),
		"clear removes only transient sketch state"
	)


func test_surface() -> void:
	var sim = RaceSim.new(h.geometries[7], {"scenario": "wet"})
	var grid = sim.surface
	check(
		sim.weather_name == "Steady rain",
		"wet briefing describes its initial weather without needing simulation ticks"
	)
	check(
		grid.size() == 96 and grid[0].lanes.size() == 7,
		"spatial field has 96 stations and seven lateral strips"
	)
	var col = grid[0]
	col.lanes[0].water = 0.8
	col.lanes[1].water = 0.2
	var before = 0.0
	for lane in col.lanes:
		before += lane.water
	RaceSurface.runoff(col, 0.25)
	var after = 0.0
	for lane in col.lanes:
		after += lane.water
	h.near(before, after, 0.00000001, "Lateral runoff conserves water before weather sinks/sources")
	var clean = RaceSurface.sample(grid, 0.2, 0)
	RaceSurface.contaminate(grid, 0.2, 0, 0.5, true)
	var dirty = RaceSurface.sample(grid, 0.2, 0)
	check(
		dirty.oil > clean.oil and dirty.grip < clean.grip, "local contamination reduces local grip"
	)
	var i = 24
	var segment_start = i * sim.track.length / 96
	var c = sim.cars[3]
	c.lane = 0
	var water_before = grid[i].lanes[3].water
	var touched = RaceSurface.deposit(
		grid, sim.track.length, c, segment_start, segment_start + sim.track.length / 96 * 0.8, -0.02
	)
	check(
		i in touched and grid[i].lanes[3].water < water_before,
		"actual passage displaces water in the occupied strip"
	)
	check(
		grid[i].lanes[3].water < grid[i].lanes[0].water,
		"drying is lateral, not a whole-width painted line"
	)
	check(grid[i].lanes[3].rubber > grid[i].lanes[0].rubber, "rubber builds where the car passed")
	RaceSurface.evolve(grid, 0.6, 0.25, 3)
	RaceSurface.profiles(grid, sim.water, sim.rubber)
	check(
		RaceSurface.valid(grid, sim.water, sim.rubber),
		"surface evolves within concentration and alias bounds"
	)
	var snapshot = sim.snapshot()
	var restored = RaceSim.restore(JSON.parse_string(JSON.stringify(snapshot, "", true, true)))
	check(restored != null, "multi-lane surface checkpoints round-trip")
	if restored:
		check(
			preload("res://tests/support/state_comparison.gd").equivalent(
				grid, restored.surface, 0.0000001, true, true
			),
			"all lateral channels survive continuation"
		)
	for change in range(6):
		var bad = snapshot.duplicate(true)
		corrupt_surface(bad, change)
		check(
			RaceSim.restore(bad) == null, "invalid surface checkpoint rejected without replacement"
		)
	var old = snapshot.duplicate(true)
	old.version = 3
	old.erase("surface")
	old.erase("surface_accumulator")
	var migrated = RaceSim.restore(old)
	check(
		migrated != null, "legacy longitudinal profiles migrate into explicit uniform-width cells"
	)
	if migrated:
		h.near(
			migrated.water[24], snapshot.water[24], 0.00001, "Legacy line-water profile is retained"
		)


func test_incident_wheel_integrity() -> void:
	var race = h.blank_race(h.geometries[7], {"laps": 5, "intensity": "calm"})
	var c = race.cars[3]
	var item = mounted(race)
	item.wheels.FL.life = 70
	item.wheels.FR.life = 90
	item.wheels.FL.flat = 11
	WheelTyres.publish(item)
	c.tyre = item.life
	# Seed zero gives the recoverable-spin branch with no state-dependent retries.
	race.rng_state = 0
	race.incident(c)
	check(not c.dnf and c.loss > 0, "recoverable incident fixture actually spins")
	check(
		item.wheels.FL.life == 65 and item.wheels.FR.life == 85 and item.wheels.FL.flat == 11,
		"incident tread loss preserves existing four-wheel asymmetry and damage"
	)
	check(
		TyreInventory.valid(c.to_record(), race.laps),
		"incident leaves wheel/aggregate aliases consistent"
	)


func test_emergency_strategy() -> void:
	var sim = h.blank_race(h.geometries[7], {"laps": 6, "intensity": "calm"})
	var c = sim.cars[3]
	c.distance = sim.track.length * 0.05
	c.speed = 10
	c.auto = true
	mounted(sim).wheels.FL.punctured = true
	sim.engineer(c)
	check(
		c.pit_order and c.pace == 0 and c.engine == 0,
		"delegated first-lap puncture queues recovery rather than waiting for ordinary strategy eligibility"
	)
	check(
		c.pit_gate > c.distance and c.scheduled_lap == -1,
		"emergency uses a future safe physical entry"
	)
	check(
		WheelTyres.usable(TyreInventory.planned(c, true)),
		"emergency chooses real usable replacement stock"
	)
	var events_before = sim.events.size()
	var gate_before = c.pit_gate
	sim.engineer(c)
	check(
		sim.events.size() == events_before and c.pit_gate == gate_before,
		"repeated engineer checks do not spam or move a committed emergency stop"
	)
	c.pit_order = true
	c.scheduled_lap = 4
	c.pit_gate = 3 * sim.track.length + sim.track.pit_entry
	sim.engineer(c)
	check(
		c.scheduled_lap == -1 and c.pit_gate < 3 * sim.track.length,
		"delegated puncture advances a future schedule to the next safe entry"
	)
	c.auto = false
	c.pit_order = false
	c.pit_gate = -1
	c.scheduled_lap = -1
	sim.engineer(c)
	check(not c.pit_order, "manual puncture decisions remain under player control")
	c.auto = true
	for item in c.tyre_sets:
		item.wheels.FL.punctured = true
	sim.engineer(c)
	check(
		not c.pit_order and c.intent.begins_with("No sound"),
		"exhausted inventory cannot manufacture emergency stock"
	)


func test_group_identifier_validation() -> void:
	var d = scenery_document()
	for value in [7, [], {}, "g".repeat(81)]:
		var invalid = d.duplicate(true)
		invalid.objects[0].group = value
		check(
			not TrackDocument.validate(invalid).is_empty(),
			"malformed or oversized group IDs are rejected at import"
		)
	d.objects[0].group = "paddock-a"
	check(
		TrackDocument.validate(d).is_empty(), "a valid simple group identifier survives validation"
	)


func corrupt_surface(bad: Dictionary, change: int) -> void:
	match change:
		0:
			bad.surface.pop_back()
		1:
			bad.surface[0].lanes.pop_back()
		2:
			bad.surface[0].lanes[0].oil = 2
		3:
			bad.surface[0].lanes[0].temperature = "hot"
		4:
			bad.surface_accumulator = -1
		5:
			bad.water[0] = 0.99
