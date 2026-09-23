extends RefCounted
var h
func run(harness) -> void:
	h = harness
	test_wheels()
	test_setup()
	test_continuation()
	test_selection()
	test_sketch()
	test_surface()
	test_incident_wheel_integrity()
	test_emergency_strategy()
	test_group_identifier_validation()

func check(value: bool, text: String) -> void:
	h.check(value, "Iteration 4: " + text)

func mounted(sim: RaceSim) -> Dictionary:
	return TyreInventory.find(sim.cars[3], sim.cars[3].set_id)

func input_state() -> Dictionary:
	return {"speed": 55.0, "curve": -0.013, "bias": 0.56, "brake": 0.8, "throttle": 0.2, "slip": 0.08, "water": 0.0, "push": 1.0, "neutral": false, "care": 85, "wear": 0.03, "lap": 0.005}

func test_wheels() -> void:
	var sim = RaceSim.new(h.geometries[7]); var c = sim.cars[3]; var item = mounted(sim)
	check(WheelTyres.OPTIMUM == {"S": 84.0, "M": 89.0, "H": 94.0, "I": 73.0, "W": 65.0}, "compound target temperatures match the source sandbox")
	check(item.wheels.keys() == WheelTyres.KEYS, "four named contact patches per set")
	item.wheels.FL.flat = 14.0
	check(item.wheels.FR.flat == 0, "wheel records are independent, not shared dictionaries")
	var stock = item.duplicate(true)
	WheelTyres.update(item, input_state(), 1.0)
	check(item.wheels.FL.load > item.wheels.FR.load and item.wheels.RL.load > item.wheels.RR.load, "outside wheels carry more load in a right-hand turn")
	check(item.wheels.FL.life < item.wheels.FR.life, "loaded and flat-spotted wheel wears faster")
	check(item.wheels.FL.surface > item.wheels.FL.core, "surface heat responds faster than the core")
	check(item.wheels.FL.pressure != stock.wheels.FL.pressure, "core heating changes normalized pressure")
	check(WheelTyres.valid(item), "normal wheel update keeps inventory valid")
	WheelTyres.publish(item); c.tyre = item.life; c.temperature = item.temperature
	var worn = item.duplicate(true); var id = item.id
	TyreInventory.mount(c, "3-S2"); TyreInventory.mount(c, id)
	check(mounted(sim).wheels == worn.wheels, "remount preserves individual contact-patch damage and temperatures")
	var before = WheelTyres.grip_wheel(item.wheels.FR, item.compound)
	item.wheels.FR.grain = 50
	check(WheelTyres.grip_wheel(item.wheels.FR, item.compound) < before, "graining reduces available wheel grip")
	check(WheelTyres.lockup(item, 0.52, 5) == "RL" and item.wheels.RL.flat == 5, "rearward brake bias locates a rear flat spot")
	check(WheelTyres.lockup(item, 0.6, 5) == "FL" and item.wheels.FL.flat > 14, "forward brake bias locates a front flat spot")
	c.temperature = item.temperature
	for key in WheelTyres.KEYS: item.wheels[key].core = 100; item.wheels[key].surface = 102
	WheelTyres.publish(item); WheelTyres.update(item, input_state(), 0.05)
	check(item.heat_cycles == 1 and item.heated, "heating records a cycle once")
	WheelTyres.update(item, input_state(), 0.05)
	check(item.heat_cycles == 1, "a hot running set does not gain a cycle every tick")
	WheelTyres.cool(item, 5000)
	check(not item.heated and item.wheels.FL.flat > 0, "cool-down re-arms the cycle without repairing flat spots")
	var race = h.blank_race(h.geometries[7], {"laps": 5, "intensity": "calm"}); c = race.cars[3]; c.auto = false
	item = mounted(race); item.wheels.FL.life = 0
	WheelTyres.publish(item); c.tyre = item.life
	race.check_tyre_incident(c)
	check(item.wheels.FL.punctured and not race.paused, "exhausted wheel punctures without pausing the session")
	check(not WheelTyres.usable(item), "a punctured set cannot be selected as service stock")
	check(not race.command("select_set", {"id": 3, "set_id": item.id}), "public command rejects a punctured replacement")
	check(race.car_advisories(c)[0].contains("PUNCTURE"), "pit-wall advisory identifies the affected wheel")
	race.engineer(c)
	check(not c.pit_order, "manual strategy is not overridden by an advisory")

func test_setup() -> void:
	var sim = RaceSim.new(h.geometries[7]); var c = sim.cars[3]; var baseline = c.car_setup.duplicate()
	var before = CarSetup.effects(c)
	check(sim.command("setup_all", {"id": 3, "values": {"wing": 9, "balance": 2, "suspension": 7, "cooling": 7, "bias": 58}}), "five setup values commit in the garage")
	var after = CarSetup.effects(c)
	check(after.corner > before.corner and after.straight < before.straight, "high wing has a support-versus-straight trade-off")
	check(c.setup == 9 and CarSetup.valid(c), "legacy wing alias remains synchronized")
	var applied = c.car_setup.duplicate()
	check(not sim.command("setup_all", {"id": 3, "values": {"wing": 2, "bias": 99}}) and c.car_setup == applied, "invalid setup rejects the entire batch, not just the last field")
	check(not sim.command("setup_all", {"id": 3, "values": {"turbo": 9}}), "unknown setup fields rejected")
	check(not sim.command("setup_all", {"id": 0, "values": baseline}), "rival setup is inspect-only")
	check(sim.command("qualify"), "setup fixture enters qualifying")
	check(sim.command("setup_all", {"id": 3, "values": baseline}), "setup remains editable before garage release")
	sim.command("auto", {"id": 3, "value": false}); sim.command("send", {"id": 3})
	check(not sim.command("setup_all", {"id": 3, "values": applied}), "on-track qualifying cannot change mechanical setup")
	var race = h.blank_race(h.geometries[7], {"laps": 5, "intensity": "calm"})
	check(not race.command("setup", {"id": 3, "value": 8}), "race mechanical setup is locked")
	check(race.command("brake_bias", {"id": 3, "value": 60}) and race.cars[3].car_setup.bias == 60, "race brake bias changes immediately")
	check(not race.command("brake_bias", {"id": 3, "value": 60.5}), "fractional brake bias is rejected")
	for mode in ["patient", "balanced", "assertive"]: check(race.command("battle_mode", {"id": 3, "value": mode}), "racecraft accepts " + mode)
	check(not race.command("battle_mode", {"id": 3, "value": "teleport"}), "unknown tactics are rejected")
	var a = RaceSim.new(h.geometries[7]); var b = RaceSim.new(h.geometries[7])
	a.cars[3].car_setup.cooling = 1; b.cars[3].car_setup.cooling = 9
	for model in [a, b]: model.phase = "race"; model.cars[3].speed = 55
	for i in range(200): a.wear_car(a.cars[3], 2.75, 0); b.wear_car(b.cars[3], 2.75, 0)
	check(a.cars[3].engine_temperature > b.cars[3].engine_temperature, "cooling aperture changes thermal evolution")

func test_continuation() -> void:
	var sim = h.blank_race(h.geometries[7], {"laps": 6, "intensity": "calm"}); h.ticks(sim, 250)
	sim.command("brake_bias", {"id": 3, "value": 59}); sim.command("battle_mode", {"id": 3, "value": "patient"})
	var data = sim.snapshot(); var restored = RaceSim.restore(JSON.parse_string(JSON.stringify(data, "", true, true)))
	check(data.version == 4 and restored != null, "version 4 stores wheel, setup and tactic state")
	if restored:
		h.ticks(sim, 150); h.ticks(restored, 150)
		check(load("res://tests/foundation_tests.gd").new().equivalent(sim.cars, restored.cars) and sim.rng_state == restored.rng_state, "per-wheel JSON continuation preserves numeric tolerance and RNG")
	for mutation in [func(d): d.cars[3].tyre_sets[0].wheels.erase("FL"), func(d): d.cars[3].tyre_sets[0].wheels.FL.pressure = -2, func(d): d.cars[3].tyre_sets[0].wheels.FL.punctured = "yes", func(d): d.cars[3].tyre_sets[0].wheels.FL.life = 101, func(d): d.cars[3].tyre_sets[0].heat_cycles = 1.2, func(d): d.cars[3].tyre_sets[0].heated = 7, func(d): d.cars[3].car_setup.wing = 4.5, func(d): d.cars[3].car_setup.bias = 65, func(d): d.cars[3].battle_mode = "bad", func(d): d.cars[3].engine_temperature = INF]:
		var invalid = data.duplicate(true); mutation.call(invalid)
		check(RaceSim.restore(invalid) == null, "malformed wheel/setup checkpoint rejected")
	var old = data.duplicate(true); old.version = 3
	for car in old.cars:
		for key in ["car_setup", "battle_mode", "engine_temperature", "brake_temperature", "tyre_event_clock"]: car.erase(key)
		for item in car.tyre_sets:
			for key in ["wheels", "heat_cycles", "heated"]: item.erase(key)
	var migrated = RaceSim.restore(JSON.parse_string(JSON.stringify(old, "", true, true)))
	check(migrated != null, "genuine aggregate v3 checkpoint migrates")
	if migrated:
		h.near(migrated.cars[3].tyre, old.cars[3].tyre, 0.00001, "v3 tread is preserved")
		check(migrated.cars[3].car_setup.wing == old.cars[3].setup and migrated.cars[3].car_setup.bias == 56, "legacy wing retained; missing setup has explicit defaults")
		check(mounted(migrated).wheels.FL.life == mounted(migrated).wheels.FR.life, "unrecorded historic wheel asymmetry is not invented")

func scenery_document() -> Dictionary:
	var d = h.geometries[7].document.duplicate(true)
	d.objects = []
	for p in [Vector2(0, 0), Vector2(100, 20), Vector2(300, 50)]:
		d.objects.append({"type": "tree", "x": p.x, "y": p.y, "rotation": 0.0, "scale": 1.0})
	return d

func test_selection() -> void:
	var d = scenery_document(); var original = d.duplicate(true)
	var result = TrackEdit.transform(d, "scenery", [0, 1], Vector2(20, 30), 90, 2)
	check(result.ok and d == original, "selection transform is transactional and leaves its input untouched")
	h.near(TrackDocument.point(result.document.objects[0]).distance_to(TrackDocument.point(result.document.objects[1])), Vector2(100, 20).length() * 2, 0.001, "group transform preserves scaled spacing")
	check(result.document.objects[0].scale == 2 and result.document.objects[1].rotation == 90, "object rotations and scales follow the group transform")
	check(not TrackEdit.transform(d, "scenery", [0, 1], Vector2(100001, 0)).ok and d == original, "out-of-bounds transform is atomic")
	check(not TrackEdit.transform(d, "scenery", [0], Vector2.ZERO, 0, 9).ok, "unrepresentable object scale rejected")
	result = TrackEdit.arrange(d, "scenery", [0, 1, 2], "x", true)
	check(result.ok and result.document.objects[1].x == 150, "distribution uses equal center spacing")
	result = TrackEdit.arrange(d, "scenery", [0, 1, 2], "y")
	check(result.ok and result.document.objects[0].y == result.document.objects[2].y, "alignment places selection centers on one axis")
	check(not TrackEdit.arrange(d, "scenery", [0, 1], "x", true).ok, "distribution explains its three-object minimum")
	result = TrackEdit.group(d, [0, 1]); d = result.document
	check(d.objects[0].group == d.objects[1].group and not d.objects[2].has("group"), "group membership is scoped to the selection")
	var cloned = TrackEdit.duplicate_scenery(d, [0, 1])
	check(cloned.ok and cloned.document.objects.size() == 5, "duplicate produces exactly the selected objects")
	check(cloned.document.objects[3].group == cloned.document.objects[4].group and cloned.document.objects[3].group != d.objects[0].group, "duplicated group has independent membership")
	check(TrackDocument.validate(cloned.document).is_empty(), "groups survive the authoring schema")
	check(not TrackEdit.group(d, [0, 1], true).document.objects[0].has("group"), "ungroup removes membership, not geometry")
	result = TrackEdit.transform(d, "road", [0, 1], Vector2.ZERO, 90, 1.5)
	check(result.ok and result.document.nodes[0].w == d.nodes[0].w and result.document.nodes[0].h == d.nodes[0].h, "plan-view road transforms retain road width and elevation")
	h.near(TrackDocument.handle(result.document.nodes[0], "out").length(), TrackDocument.handle(d.nodes[0], "out").length() * 1.5, 0.0001, "road handles scale with transformed nodes")

func test_sketch() -> void:
	var d = scenery_document(); var original = d.duplicate(true); var trace = TrackSketch.new()
	check(not trace.compile(d).ok, "open sketches cannot replace a circuit")
	check(trace.add_stroke(PackedVector2Array([Vector2(-300, -200), Vector2(300, -200), Vector2(350, 0)])), "first freehand segment is stored separately")
	check(not trace.add_stroke(PackedVector2Array([Vector2(-200, 100), Vector2(300, 200)])), "disconnected strokes cannot silently bridge the circuit")
	check(trace.add_stroke(PackedVector2Array([Vector2(351, 0), Vector2(300, 200), Vector2(-300, 200), Vector2(-300, -200)])), "continuation snaps to the previous endpoint")
	trace.undo(); check(trace.strokes.size() == 1, "trace undo removes one stroke")
	trace.redo(); check(trace.strokes.size() == 2, "trace redo restores the stroke")
	check(trace.close_loop(), "sufficient trace points close explicitly")
	var result = trace.compile(d)
	check(result.ok and d == original, "preview compiles without touching the active road")
	if result.ok:
		check(result.document.objects == d.objects and result.document.features.is_empty() and result.document.pits.is_empty(), "replacement retains scenery and clears old road-attached annotations")
		check(TrackDocument.validate(result.document).is_empty(), "trace output uses the real authoring schema")
		var g = TrackGeometry.new(result.document)
		check(g.length > 1000 and is_finite(g.estimate), "trace output bakes into a drivable bounded reference profile")
	trace.undo(); check(not trace.closed and trace.strokes.size() == 2, "undoing closure preserves the trace")
	trace.redo(); check(trace.closed and trace.strokes.size() == 2, "redo restores explicit closure without duplicating a stroke")
	trace.undo(); trace.undo(); trace.redo(); trace.redo()
	check(trace.closed and trace.strokes.size() == 2, "redo of multiple undos restores strokes before restoring closure")
	var bad = TrackSketch.new()
	check(not bad.add_stroke(PackedVector2Array([Vector2.ZERO, Vector2(NAN, 0)])), "nonfinite trace rejected before document mutation")
	bad.clear(); check(bad.strokes.is_empty() and bad.future.is_empty(), "clear removes only transient sketch state")

func test_surface() -> void:
	var sim = RaceSim.new(h.geometries[7], {"scenario": "wet"}); var grid = sim.surface
	check(sim.weather_name == "Steady rain", "wet briefing describes its initial weather without needing simulation ticks")
	check(grid.size() == 96 and grid[0].lanes.size() == 7, "spatial field has 96 stations and seven lateral strips")
	var col = grid[0]; col.lanes[0].water = 0.8; col.lanes[1].water = 0.2
	var before = 0.0
	for lane in col.lanes: before += lane.water
	RaceSurface.runoff(col, 0.25)
	var after = 0.0
	for lane in col.lanes: after += lane.water
	h.near(before, after, 0.00000001, "Lateral runoff conserves water before weather sinks/sources")
	var clean = RaceSurface.sample(grid, 0.2, 0)
	RaceSurface.contaminate(grid, 0.2, 0, 0.5, true)
	var dirty = RaceSurface.sample(grid, 0.2, 0)
	check(dirty.oil > clean.oil and dirty.grip < clean.grip, "local contamination reduces local grip")
	var i = 24; var from = i * sim.track.length / 96; var c = sim.cars[3]; c.lane = 0
	var water_before = grid[i].lanes[3].water
	var touched = RaceSurface.deposit(grid, sim.track.length, c, from, from + sim.track.length / 96 * 0.8, -0.02)
	check(i in touched and grid[i].lanes[3].water < water_before, "actual passage displaces water in the occupied strip")
	check(grid[i].lanes[3].water < grid[i].lanes[0].water, "drying is lateral, not a whole-width painted line")
	check(grid[i].lanes[3].rubber > grid[i].lanes[0].rubber, "rubber builds where the car passed")
	RaceSurface.evolve(grid, 0.6, 0.25, 3); RaceSurface.profiles(grid, sim.water, sim.rubber)
	check(RaceSurface.valid(grid, sim.water, sim.rubber), "surface evolves within concentration and alias bounds")
	var snapshot = sim.snapshot(); var restored = RaceSim.restore(JSON.parse_string(JSON.stringify(snapshot, "", true, true)))
	check(restored != null, "multi-lane surface checkpoints round-trip")
	if restored: check(load("res://tests/foundation_tests.gd").new().equivalent(grid, restored.surface), "all lateral channels survive continuation")
	for change in [func(d): d.surface.pop_back(), func(d): d.surface[0].lanes.pop_back(), func(d): d.surface[0].lanes[0].oil = 2, func(d): d.surface[0].lanes[0].temperature = "hot", func(d): d.surface_accumulator = -1, func(d): d.water[0] = 0.99]:
		var bad = snapshot.duplicate(true); change.call(bad)
		check(RaceSim.restore(bad) == null, "invalid surface checkpoint rejected without replacement")
	var old = snapshot.duplicate(true); old.version = 3; old.erase("surface"); old.erase("surface_accumulator")
	var migrated = RaceSim.restore(old)
	check(migrated != null, "legacy longitudinal profiles migrate into explicit uniform-width cells")
	if migrated: h.near(migrated.water[24], snapshot.water[24], 0.00001, "Legacy line-water profile is retained")

func test_incident_wheel_integrity() -> void:
	var race = h.blank_race(h.geometries[7], {"laps": 5, "intensity": "calm"})
	var c = race.cars[3]; var item = mounted(race)
	item.wheels.FL.life = 70; item.wheels.FR.life = 90; item.wheels.FL.flat = 11
	WheelTyres.publish(item); c.tyre = item.life
	# Seed zero gives the recoverable-spin branch with no state-dependent retries.
	race.rng_state = 0; race.incident(c)
	check(not c.dnf and c.loss > 0, "recoverable incident fixture actually spins")
	check(item.wheels.FL.life == 65 and item.wheels.FR.life == 85 and item.wheels.FL.flat == 11, "incident tread loss preserves existing four-wheel asymmetry and damage")
	check(TyreInventory.valid(c, race.laps), "incident leaves wheel/aggregate aliases consistent")

func test_emergency_strategy() -> void:
	var sim = h.blank_race(h.geometries[7], {"laps": 6, "intensity": "calm"})
	var c = sim.cars[3]
	c.distance = sim.track.length * 0.05; c.speed = 10; c.auto = true
	mounted(sim).wheels.FL.punctured = true
	sim.engineer(c)
	check(c.pit_order and c.pace == 0 and c.engine == 0, "delegated first-lap puncture queues recovery rather than waiting for ordinary strategy eligibility")
	check(c.pit_gate > c.distance and c.scheduled_lap == -1, "emergency uses a future safe physical entry")
	check(WheelTyres.usable(TyreInventory.planned(c, true)), "emergency chooses real usable replacement stock")
	var events_before = sim.events.size(); var gate_before = c.pit_gate
	sim.engineer(c)
	check(sim.events.size() == events_before and c.pit_gate == gate_before, "repeated engineer checks do not spam or move a committed emergency stop")
	c.pit_order = true; c.scheduled_lap = 4; c.pit_gate = 3 * sim.track.length + sim.track.pit_entry
	sim.engineer(c)
	check(c.scheduled_lap == -1 and c.pit_gate < 3 * sim.track.length, "delegated puncture advances a future schedule to the next safe entry")
	c.auto = false; c.pit_order = false; c.pit_gate = -1; c.scheduled_lap = -1
	sim.engineer(c)
	check(not c.pit_order, "manual puncture decisions remain under player control")
	c.auto = true
	for item in c.tyre_sets: item.wheels.FL.punctured = true
	sim.engineer(c)
	check(not c.pit_order and c.intent.begins_with("No sound"), "exhausted inventory cannot manufacture emergency stock")

func test_group_identifier_validation() -> void:
	var d = scenery_document()
	for value in [7, [], {}, "g".repeat(81)]:
		var invalid = d.duplicate(true); invalid.objects[0].group = value
		check(not TrackDocument.validate(invalid).is_empty(), "malformed or oversized group IDs are rejected at import")
	d.objects[0].group = "paddock-a"
	check(TrackDocument.validate(d).is_empty(), "a valid simple group identifier survives validation")
