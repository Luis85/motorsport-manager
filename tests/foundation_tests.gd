extends RefCounted
## Targeted iteration-two regression scenarios. No rendering or scene-tree dependencies.
var h
func run(harness) -> void:
	h = harness
	test_geometry()
	test_qualifying()
	test_finishing()
	test_pits_and_courtesy()
	test_checkpoint()
	test_long_run_matrix()
	h = null

func check(value: bool, text: String) -> void:
	h.check(value, "Foundation: " + text)

func test_geometry() -> void:
	var timings: Array = []
	for i in range(h.tracks.size()):
		var g = h.geometries[i]
		var preview = TrackGeometry.new(h.tracks[i], "Formula", true)
		check(preview.preview_only and preview.estimate == 0, g.document.name + ": drag preview never advertises a solved line")
		check(preview.points.size() <= g.points.size(), g.document.name + ": drag preview uses a bounded cheaper mesh")
		check(g.estimate <= g.centre_estimate + 0.00001, g.document.name + ": selected candidate is no slower than centreline reference")
		check(not TrackDiagnostics.blocking(TrackDiagnostics.inspect(g)), g.document.name + ": circuit passes sampled crossing validation")
		timings.append({"track": g.document.name, "full_ms": g.compile_usec / 1000.0, "preview_ms": preview.compile_usec / 1000.0})
		var sample = g.sample(g.length * 0.123456, true)
		var projected = g.nearest(sample.p)
		check(projected.distance < 0.002, g.document.name + ": nearest point projects onto segments without station snapping")
	var exported = h.geometries[0].runtime_export()
	check(exported.version == 2 and exported.samples[0].has("line_arc_to_next_m"), "runtime v2 declares actual line-arc distances")
	var invalid_gates = h.tracks[7].duplicate(true)
	invalid_gates.timingGates = [{"type": "sector", "f": 0.2}, {"type": "sector", "f": 0.2}]
	var g = TrackGeometry.new(invalid_gates)
	h.near(g.sector_ends[0] / g.length, 1.0 / 3.0, 0.00001, "Coincident sectors fall back to thirds")
	check(TrackDiagnostics.inspect(g).any(func(x): return x.code == "timing"), "invalid sectors have an actionable warning")
	var flat = crossing_document(false)
	var raised = crossing_document(true)
	check(TrackDiagnostics.blocking(TrackDiagnostics.inspect(TrackGeometry.new(flat))), "flat figure-eight is blocked")
	check(not TrackDiagnostics.blocking(TrackDiagnostics.inspect(TrackGeometry.new(raised))), "grade-separated figure-eight is allowed")
	var preview = TrackGeometry.new(h.tracks[7], "GT", true)
	var sim = RaceSim.new(preview)
	check(not sim.track.preview_only and sim.track.estimate > 0, "simulation promotes a preview to a full immutable bake")
	Storage.write_json("res://reports/bake-performance.json", {"measurements": timings, "note": "Single-process local timings, not a cross-device performance guarantee."})

func crossing_document(raised: bool) -> Dictionary:
	var nodes: Array = []
	for p in [Vector2(-200, -160), Vector2(200, 160), Vector2(-200, 160), Vector2(200, -160)]:
		var node = TrackDocument.node_at(p)
		TrackDocument.set_handle(node, "in", Vector2.ZERO); TrackDocument.set_handle(node, "out", Vector2.ZERO)
		node.h = 12.0 if raised and nodes.size() < 2 else 0.0
		nodes.append(node)
	return TrackDocument.normalize({"name": "Crossing fixture", "nodes": nodes, "closed": true})

func test_qualifying() -> void:
	var d = h.tracks[7].duplicate(true); d.start = 0.21
	d.timingGates = [{"type": "sector", "f": 0.31}, {"type": "sector", "f": 0.83}]
	var sim = RaceSim.new(TrackGeometry.new(d), {"scenario": "dry", "intensity": "calm", "qual_duration": 120})
	sim.command("qualify")
	check(h.until_phase(sim, "qualifying_results", 15000), "custom-sector qualifying returns to garages")
	for car in sim.cars:
		check(not car.qual_history.is_empty(), car.short + ": timed run has sector history")
		if car.qual_history.is_empty(): continue
		var lap = car.qual_history[0]
		check(lap.valid and lap.sectors.all(func(v): return v > 0), car.short + ": all three custom sectors measured")
		h.near(lap.sectors[0] + lap.sectors[1] + lap.sectors[2], lap.time, 0.0001, car.short + ": sectors sum to timed lap")
	var qbest: float = sim.cars[3].qual_best
	sim.command("prepare_race")
	check(sim.cars[3].last_lap == 0 and not sim.cars[3].pit_lap and sim.cars[3].qual_best == qbest, "race preparation clears race timing but retains qualifying records")
	var c = sim.cars[3]
	sim.phase = "qualifying"; sim.qual_closed = true; c.qual_state = "hotlap"; c.hot_start = 20; c.qual_sector_start = 40; c.hot_valid = true; c.qual_sectors = [10.0, 10.0, 0.0]
	var before = c.qual_laps; sim.clock = 50
	sim.qualifying_crossings(c, sim.track.length - 0.1, sim.track.length + 0.1)
	check(c.qual_laps == before + 1 and c.qual_state == "inlap", "flying lap may finish after qualifying chequered")
	c.qual_state = "outlap"; sim.qualifying_crossings(c, sim.track.length - 0.1, sim.track.length + 0.1)
	check(c.qual_state == "inlap", "out lap cannot start a flying lap after chequered")
	c.qual_state = "hotlap"; c.hot_valid = false; c.invalid_reason = "Fixture yellow"; before = c.qual_laps
	sim.qualifying_crossings(c, sim.track.length - 0.1, sim.track.length + 0.1)
	check(c.qual_laps == before and not c.qual_history.back().valid, "invalid flying lap is recorded but not classified")
	sim.phase = "race"; sim.flag = "YELLOW"; sim.yellow_sector = 1
	c.distance = sim.track.length * 0.15
	check(sim.neutral(c), "yellow flags use authored boundaries rather than equal thirds")

func test_finishing() -> void:
	var sim = h.blank_race(h.geometries[7], {"laps": 3, "intensity": "calm"})
	for c in sim.cars: c.dnf = true
	for i in range(3): sim.cars[i].dnf = false
	var winner = sim.cars[0]; var second = sim.cars[1]; var lapped = sim.cars[2]
	winner.completed = 3; winner.distance = sim.track.length * 3; winner.crossed_at = 100.0
	second.completed = 2; second.distance = sim.track.length * 3 - 20
	lapped.completed = 2; lapped.distance = sim.track.length * 2; lapped.crossed_at = 100.02
	sim.resolve_finishes()
	check(sim.standings()[1].id == second.id, "a lapped finisher does not jump ahead of a lead-lap runner")
	second.completed = 3; second.crossed_at = 103.0; second.distance = sim.track.length * 3
	sim.resolve_finishes()
	check(second.finish_position == 2 and lapped.finish_position == 3, "classification ranks completed laps before crossing order")
	var clean = h.blank_race(h.geometries[7], {"laps": 3, "intensity": "calm"})
	var car = clean.cars[3]; car.pit_lap = true; clean.clock = 30
	clean.race_crossings(car, clean.track.length - 0.1, clean.track.length + 0.1)
	check(clean.fastest == 0 and car.best_lap == 0 and car.history.back().pit_lap, "pit-route laps do not set fastest-lap records")

func traffic(sim: RaceSim) -> Array:
	return sim.cars.map(func(c): return {"distance": c.distance, "lane": c.lane, "speed": c.speed, "route": c.route, "qual_state": c.qual_state, "pit_d": c.pit_d, "pit_stage": c.pit_stage})

func test_pits_and_courtesy() -> void:
	var sim = h.blank_race(h.geometries[7], {"laps": 5, "intensity": "calm"})
	for c in sim.cars: c.dnf = true
	var slow = sim.cars[6]; var fast = sim.cars[3]
	slow.dnf = false; fast.dnf = false; slow.distance = 500; fast.distance = sim.track.length + 480
	slow.speed = 30; fast.speed = 50; slow.lane = 0; fast.lane = 1
	sim.update_yield(slow, traffic(sim)); var side = slow.yield_side
	check(slow.yield_to == fast.id, "blue-flag courtesy identifies approaching priority traffic")
	fast.distance += 25; fast.lane = -1; sim.update_yield(slow, traffic(sim))
	check(slow.yield_to == fast.id and slow.yield_side == side, "yield side stays stable during a side-by-side pass")
	fast.distance += 30; sim.update_yield(slow, traffic(sim))
	check(slow.yield_to == -1, "courtesy releases after the priority car clears")
	fast.distance = sim.track.pit_entry - 2; fast.speed = 70; sim.queue_pit(fast)
	check(fast.pit_deferred and "Deferred" in sim.pit_status(fast), "late pit call exposes a deferred-entry explanation")
	# Frozen service plan and an independently moving lane queue.
	fast.route = "pit"; fast.pit_stage = "entry"; fast.pit_d = fast.box_d; fast.next_compound = "H"; fast.repair = false; fast.damage = 8
	slow.route = "garage"
	sim.update_pit(fast, traffic(sim)); fast.next_compound = "S"; fast.repair = true
	check(fast.pit_stage == "service" and not fast.service_repair and fast.service_compound == "H", "service locks the accepted tyre/repair plan")
	for i in range(130): sim.update_pit(fast, traffic(sim))
	check(fast.compound == "H" and fast.damage == 8 and fast.pit_stops == 1, "mid-service changes cannot retroactively alter the serviced plan")
	fast.route = "pit"; fast.pit_stage = "entry"; fast.pit_d = fast.box_d - 10; fast.speed = sim.track.pit_limit
	slow.route = "garage"; var old_speed: float = fast.speed
	sim.update_pit(fast, traffic(sim))
	check(fast.speed < old_speed and fast.pit_d <= fast.box_d, "car brakes before reaching its pit box")
	fast.pit_d = 100; fast.pit_stage = "exit"; fast.speed = 0
	slow.route = "pit"; slow.pit_stage = "exit"; slow.pit_d = 93.5; slow.speed = 20
	sim.update_pit(slow, traffic(sim))
	check(slow.pit_d <= fast.pit_d - 6.5 + 0.001, "snapshot-based pit queue preserves minimum spacing")

func test_checkpoint() -> void:
	var sim = h.blank_race(h.geometries[7], {"laps": 10, "scenario": "wet", "intensity": "calm"})
	h.ticks(sim, 600)
	var copy = sim.snapshot(); copy.track.nodes[0].x += 20
	check(copy.track.nodes[0].x != sim.track.document.nodes[0].x, "checkpoint snapshots cannot mutate the live track")
	var old = sim.snapshot(); old.version = 1
	for car in old.cars:
		for key in RaceSim.CAR_V2: car.erase(key)
	var restored = RaceSim.restore(JSON.parse_string(JSON.stringify(old)))
	check(restored != null and restored.cars[3].has("qual_history"), "v1 JSON checkpoints acquire safe native-v2 defaults")
	var bad: Array = [func(d): d.selected_id = 1.5, func(d): d.cars[0].telemetry = [[1]], func(d): d.cars[0].qual_sectors = [0, "bad", 0], func(d): d.cars[0].player = true, func(d): d.cars[0].name = "Unknown", func(d): d.stats.pits = "bad", func(d): d.pit_boxes.Obsidian = 3, func(d): d.cars[1].grid = d.cars[0].grid, func(d): d.commands.append({"action": 1}), func(d): d.cars[0].history = [{"time": 1, "sectors": []}]]
	for mutate in bad:
		var data = sim.snapshot(); mutate.call(data)
		check(RaceSim.restore(data) == null, "malformed nested checkpoint is rejected without UI exposure")
	var car = sim.cars[3]; car.route = "pit"; car.pit_stage = "entry"; car.pit_d = car.box_d
	car.next_compound = "H"; car.repair = false
	sim.update_pit(car)
	var legacy_service = sim.snapshot(); legacy_service.version = 1
	for legacy_car in legacy_service.cars:
		for key in RaceSim.CAR_V2: legacy_car.erase(key)
	var migrated = RaceSim.restore(JSON.parse_string(JSON.stringify(legacy_service)))
	check(migrated != null and migrated.cars[3].service_compound == "H" and not migrated.cars[3].service_repair, "legacy service migration retains the accepted compound and repair choice")
	restored = RaceSim.restore(JSON.parse_string(JSON.stringify(sim.snapshot(), "", true, true)))
	check(restored != null, "occupied pit box survives JSON checkpoint restoration")
	if restored != null:
		h.ticks(sim, 400); h.ticks(restored, 400)
		check(equivalent(sim.cars, restored.cars) and sim.rng_state == restored.rng_state, "JSON service continuation preserves discrete state and numerics within 1e-7")

func equivalent(a: Variant, b: Variant) -> bool:
	if typeof(a) in [TYPE_FLOAT, TYPE_INT] and typeof(b) in [TYPE_FLOAT, TYPE_INT]: return absf(float(a) - float(b)) <= 0.0000001
	if typeof(a) != typeof(b): return false
	if a is Array:
		if a.size() != b.size(): return false
		for i in range(a.size()):
			if not equivalent(a[i], b[i]): return false
		return true
	if a is Dictionary:
		if a.size() != b.size(): return false
		for key in a:
			if not b.has(key) or not equivalent(a[key], b[key]): return false
		return true
	return a == b

func test_long_run_matrix() -> void:
	var matrix: Array = []
	for config in [[4, "Formula", "dry", 819], [6, "Touring", "changeable", 1209], [5, "Kart", "wet", 7834]]:
		var g = TrackGeometry.new(h.tracks[config[0]], config[1])
		var sim = h.blank_race(g, {"laps": 2, "scenario": config[2], "seed": config[3], "intensity": "standard"})
		sim.command("pit", {"id": 3})
		var started = Time.get_ticks_usec(); var count = 0; var bounded = true
		while sim.phase != "results" and count < 45000:
			sim.step(); count += 1
			if count % 200 == 0:
				for car in sim.cars:
					if not is_finite(car.distance) or not is_finite(car.speed) or car.speed < 0 or car.fuel < 0 or car.tyre < 0: bounded = false
		check(sim.phase == "results", "%s %s %s reaches classification" % [g.document.name, config[1], config[2]])
		check(bounded, "long-run car values stay finite and nonnegative")
		check(sim.cars[3].pit_stops == 1 or sim.cars[3].dnf, "manual pit stop executes once unless the driver retires")
		matrix.append({"track": g.document.name, "vehicle": config[1], "weather": config[2], "seed": config[3], "ticks": count, "wall_seconds": (Time.get_ticks_usec() - started) / 1000000.0, "finishers": sim.finish_count})
	Storage.write_json("res://reports/race-matrix.json", {"passed": matrix.all(func(row): return row.finishers > 0), "cases": matrix})
