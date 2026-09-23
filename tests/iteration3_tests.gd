extends RefCounted
var h
func run(harness) -> void:
	h = harness
	test_inventory()
	test_qualifying_sets()
	test_planned_stop()
	test_saves()
	test_illustration()

func check(value: bool, text: String) -> void:
	h.check(value, "Iteration 3: " + text)

func test_inventory() -> void:
	var sim = RaceSim.new(h.geometries[7]); var c = sim.cars[3]
	check(c.tyre_sets.size() == 12, "twelve finite driver-owned sets")
	for compound in TyreInventory.ALLOCATION:
		check(c.tyre_sets.filter(func(s): return s.compound == compound).size() == TyreInventory.ALLOCATION[compound], compound + " allocation matches prototype")
	var original = c.set_id
	c.tyre = 47.0; c.temperature = 98.0; TyreInventory.sync(c)
	check(TyreInventory.mount(c, "3-S1"), "fresh alternative can be mounted")
	check(TyreInventory.mount(c, original), "used set can be remounted")
	check(c.tyre == 47 and c.temperature == 98, "remounting never refreshes tread or temperature")
	var mounts = TyreInventory.find(c, original).mounts
	TyreInventory.mount(c, original)
	check(TyreInventory.find(c, original).mounts == mounts, "selecting the fitted set does not create another mount")
	check(not TyreInventory.mount(c, "6-S1"), "another driver's set cannot be mounted")
	TyreInventory.find(c, "3-S1").life = 0.0
	check(not TyreInventory.mount(c, "3-S1"), "exhausted set cannot be mounted")
	check(TyreInventory.choose(c, "S").id == "3-S2", "automatic selection uses a remaining usable set")
	var spare = TyreInventory.find(c, "3-H1"); spare.temperature = 92.0
	TyreInventory.cool_spares(c, 5)
	check(spare.temperature < 92 and spare.temperature > 24, "spare sets cool rather than reset")
	check(c.temperature == 98, "spare cooling does not overwrite mounted temperature")

func test_qualifying_sets() -> void:
	var sim = RaceSim.new(h.geometries[7], {"scenario": "dry", "intensity": "calm"})
	sim.command("qualify"); var c = sim.cars[3]; sim.command("auto", {"id": 3, "value": false})
	var used = TyreInventory.find(c, "3-S3"); used.life = 53.0; used.temperature = 59.0; used.used = true
	check(sim.command("select_set", {"id": 3, "set_id": used.id}), "used qualifying set can be planned")
	check(c.set_id != used.id, "choosing a set does not fit it before release")
	check(sim.command("send", {"id": 3}), "planned run releases from the garage")
	check(c.set_id == used.id and c.tyre == 53 and c.temperature == 59, "garage release fits the real used condition")
	h.ticks(sim, 60)
	check(c.tyre < 53 and TyreInventory.find(c, used.id).life == c.tyre, "physical driving updates the mounted inventory record")
	check(not sim.command("select_set", {"id": 0, "set_id": "0-S1"}), "rivals remain inspect-only")

func test_planned_stop() -> void:
	var sim = h.blank_race(h.geometries[7], {"laps": 6, "scenario": "dry", "intensity": "calm"})
	var c = sim.cars[3]
	check(sim.command("select_set", {"id": 3, "set_id": "3-H1"}), "replacement set selection is accepted")
	check(sim.command("schedule_pit", {"id": 3, "lap": 2}), "future lap stop can be scheduled")
	var gate = sim.track.length + sim.track.pit_entry
	check(c.pit_gate == gate and c.scheduled_lap == 2 and not c.auto, "schedule maps to an exact pit entry and manual strategy")
	var data = sim.snapshot()
	check(not sim.command("schedule_pit", {"id": 3, "lap": 3}) and c.pit_gate == gate, "existing order cannot silently be replaced by another schedule")
	check(sim.command("cancel_schedule", {"id": 3}) and not c.pit_order and c.scheduled_lap == -1, "cancel clears gate and scheduled order together")
	check(not sim.command("schedule_pit", {"id": 3, "lap": 6}), "final-lap planned stop is rejected")
	check(not sim.command("schedule_pit", {"id": 3, "lap": 2.5}), "fractional scheduled lap is rejected")
	check(sim.command("schedule_pit", {"id": 3, "lap": 2}), "schedule can be rebooked")
	var premature = false
	for i in range(10000):
		sim.step()
		if c.route == "pit" and c.distance < gate - 0.001: premature = true
		if c.pit_stops > 0: break
	check(not premature, "scheduled entry never takes an earlier pit branch")
	check(c.pit_stops == 1 and c.compound == "H" and c.set_id == "3-H1", "scheduled stop physically services the chosen set")
	check(c.scheduled_lap == -1 and c.stints.size() == 2, "completed service closes the plan and adds a stint")
	check(c.stints[0].to >= c.stints[0].from, "previous stint has a nonnegative measured span")
	var restored = RaceSim.restore(JSON.parse_string(JSON.stringify(data, "", true, true)))
	check(restored != null and restored.cars[3].scheduled_lap == 2 and restored.cars[3].pit_gate == gate, "scheduled gate survives JSON continuation")
	var fresh = h.blank_race(h.geometries[7], {"laps": 4, "scenario": "dry", "intensity": "calm"})
	c = fresh.cars[3]
	for item in c.tyre_sets:
		if item.id != c.set_id: item.life = 0.0
	check(not fresh.command("pit", {"id": 3}) and not c.pit_order, "empty inventory never manufactures a fresh set")

func test_saves() -> void:
	var sim = h.blank_race(h.geometries[7], {"laps": 5, "scenario": "dry", "intensity": "calm"})
	h.ticks(sim, 300)
	var data = sim.snapshot()
	check(data.version == 3, "new checkpoint format is explicitly versioned")
	var restored = RaceSim.restore(JSON.parse_string(JSON.stringify(data, "", true, true)))
	check(restored != null, "v3 JSON checkpoint validates")
	if restored:
		h.ticks(sim, 200); h.ticks(restored, 200)
		check(load("res://tests/foundation_tests.gd").new().equivalent(sim.cars, restored.cars) and sim.rng_state == restored.rng_state, "inventory and stint continuation preserves numeric tolerance and RNG")
	for version in [1, 2]:
		var legacy = sim.snapshot(); legacy.version = version
		for c in legacy.cars:
			for key in ["tyre_sets", "set_id", "next_set_id", "service_set_id", "scheduled_lap", "stints"]: c.erase(key)
		var old = RaceSim.restore(JSON.parse_string(JSON.stringify(legacy)))
		check(old != null, "genuine v%d fields migrate into a finite allocation" % version)
		if old: h.near(old.cars[3].tyre, sim.cars[3].tyre, 0.0001, "Legacy fitted condition preserved")
	for mutate in [func(d): d.cars[3].tyre_sets.pop_back(), func(d): d.cars[3].set_id = "6-M1", func(d): d.cars[3].tyre_sets[0].life = -1, func(d): d.cars[3].next_set_id = "missing", func(d): d.cars[3].scheduled_lap = 3.2, func(d): d.cars[3].scheduled_lap = 0, func(d): d.cars[3].scheduled_lap = 2, func(d): d.cars[3].erase("compound"), func(d): d.cars[3].stints = [{"set_id": "bad", "from": 0, "to": -1}], func(d): d.cars[3].tyre_sets[0].used = 1]:
		var bad = sim.snapshot(); mutate.call(bad)
		check(RaceSim.restore(bad) == null, "malformed inventory/schedule cannot replace a running session")

func test_illustration() -> void:
	var g = h.geometries[7]; var original = g.document.duplicate(true)
	var partial = original.duplicate(true); partial.visual = {"season": "autumn"}
	var normalized = TrackDocument.normalize(partial)
	check(normalized.visual.environment == "meadow" and normalized.visual.has("seed") and normalized.visual.season == "autumn", "partial illustration metadata receives defaults")
	partial.visual.seed = 0.5
	check(not TrackDocument.validate(partial).is_empty(), "fractional scenery seed is rejected")
	var a = CircuitWorld.new(); a.configure(g, g.document, true)
	var b = CircuitWorld.new(); b.configure(g, g.document, true)
	check(a.decorations == b.decorations and a.patches == b.patches, "same scenery seed produces the same illustration")
	check(a.decorations.size() <= 420 and a.patches.size() <= 36, "ambient population is bounded")
	var count = a.build_count; a.configure(g, g.document, true)
	check(a.build_count == count, "unchanged geometry does not regenerate ambient scenery")
	var safe = true
	for tree in a.decorations:
		if a._near_road(tree.p, tree.r): safe = false
	check(safe, "generated trees leave road and pit corridors clear")
	check(g.document == original, "scenery generation never changes the circuit document")
	var d = original.duplicate(true); d.visual.environment = "coastal"; d.visual.season = "autumn"
	check(TrackDocument.validate(d).is_empty(), "visual preferences round-trip in the authoring schema")
	var painted = TrackGeometry.new(d)
	check(painted.speeds == g.speeds and painted.points == g.points, "environment and season have no effect on racing geometry or pace")
	d.visual.environment = "unbounded"
	check(not TrackDocument.validate(d).is_empty(), "unknown environment rejected on import")
	a.free(); b.free()
