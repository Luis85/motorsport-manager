extends SceneTree
## Boundary fixtures: real simulation objects, detached values, no rendering required.
var checks = 0
var failures: Array[String] = []
var geometry: TrackGeometry


func _initialize() -> void:
	call_deferred("run")


func check(value: bool, description: String) -> void:
	checks += 1
	if not value:
		failures.append(description)
		push_error(description)


func fixture() -> PracticeRaceSim:
	return PracticeRaceSim.new(
		geometry, {"laps": 6, "scenario": "dry", "intensity": "calm", "seed": 7314}
	)


func fingerprint(simulation: RaceSim) -> String:
	return RaceStateValue.fingerprint(simulation.snapshot())


func test_geometry_and_restore() -> void:
	var original = geometry.document.duplicate(true)
	var sim = fixture()
	check(sim.track != geometry, "Weekend owns a detached compiled geometry")
	geometry.document.name = "Changed editor name"
	check(
		sim.track.document.name != geometry.document.name,
		"Editing a source document cannot rename an active race"
	)
	geometry.document = original
	var shared = sim.snapshot()
	var restored = PracticeRaceSim.restore_practice(shared)
	check(restored != null, "Unmodified boundary fixture restores through the production validator")
	if restored == null:
		return
	var before = fingerprint(restored)
	shared.cars[3].fuel = 0.0
	shared.cars[3].tyre_sets[0].wheels.FL.life = 0.0
	shared.events[0].text = "Changed external record"
	check(
		before == fingerprint(restored),
		"Restored nested cars, wheels and events do not alias the caller"
	)
	var snapshot = sim.snapshot()
	var source_before = fingerprint(sim)
	snapshot.cars[6].fuel = 0.0
	snapshot.surface[0].lanes[0].water = 0.9
	check(
		source_before == fingerprint(sim),
		"Exported snapshot mutations cannot change the active car or surface"
	)
	var renderer_track = RaceVisualSource.new(sim).detached_track()
	renderer_track.document.name = "Renderer changed name"
	renderer_track.length += 100.0
	check(
		source_before == fingerprint(sim),
		"Renderer geometry is detached from sporting and source geometry"
	)


func test_signals() -> void:
	var sim = fixture()
	var observed: Array = []
	sim.event_posted.connect(func(entry): observed.append(entry))
	sim.post("test", "Read-only event")
	check(
		observed.size() == 1 and observed[0].is_read_only(),
		"Event subscribers receive a read-only value"
	)
	var mutable_copy = observed[0].duplicate(true)
	mutable_copy.text = "Observer local edit"
	check(
		sim.events.back().text == "Read-only event",
		"Subscriber-owned event copy cannot rewrite authoritative history"
	)
	var accepted: Array = []
	sim.input_accepted.connect(func(_action, payload, context): accepted.append([payload, context]))
	var payload = {"id": 3, "value": 0, "observer_fixture": {"nested": [1, 2]}}
	check(sim.command("pace", payload), "Command fixture accepted through normal validation")
	check(accepted.size() == 1, "Exactly one outer accepted command is observed")
	if not accepted.is_empty():
		check(
			accepted[0][0].is_read_only() and accepted[0][1].is_read_only(),
			"Accepted command and playback context are read-only"
		)
		check(
			(
				accepted[0][0].observer_fixture.is_read_only()
				and accepted[0][0].observer_fixture.nested.is_read_only()
			),
			"Nested event collections cannot corrupt a later subscriber"
		)
		payload.observer_fixture.nested[0] = 42
		check(
			accepted[0][0].observer_fixture.nested[0] == 1,
			"Command observation does not alias caller payload"
		)


func test_query_isolation() -> void:
	var sim = fixture()
	var visual = RaceVisualSource.new(sim)
	var query = MinimalWeekendQuery.new(sim)
	var initial = fingerprint(sim)
	var screen = query.capture()
	screen.cars[3].name = "Other person"
	screen.readouts[3].fuel = "Invented fuel"
	screen.timing_rows.clear()
	var map = visual.capture()
	map.cars[0].position = Vector2(-900, -900)
	map.cars.clear()
	var surface = visual.surface_values("water")
	surface[0][0] = 0.99
	var stints = RaceChartQuery.stints(sim)
	stints.cars[3].stints.clear()
	check(
		initial == fingerprint(sim),
		"Mutating UI, map, surface and chart values cannot affect the race"
	)
	check(
		query.capture().cars[3].name == sim.cars[3].name,
		"A fresh card capture retains actual identity"
	)
	check(
		visual.capture().cars.size() == 12, "A fresh map capture retains the complete public field"
	)
	check(
		not screen.cars[0].has("tyre_sets") and not visual.capture().cars[0].has("fuel"),
		"Public identity/map projections do not leak rival resource dictionaries"
	)
	for i in range(40):
		query.capture()
		visual.capture()
	check(
		initial == fingerprint(sim), "Repeated observation neither advances clocks nor consumes RNG"
	)
	var weak = weakref(sim)
	sim = null
	check(weak.get_ref() == null, "Read-only sources do not retain an otherwise released session")
	check(
		query.capture().is_empty() and visual.capture().is_empty(),
		"Expired data sources become unavailable rather than stale authority"
	)


func test_clock() -> void:
	var sim = fixture()
	check(sim.command("qualify"), "Scheduling fixture enters real qualifying")
	var before = fingerprint(sim)
	for invalid in [-1.0, NAN, INF, -INF]:
		check(
			RaceStepClock.advance(sim, invalid) == 0 and fingerprint(sim) == before,
			"Invalid elapsed time is rejected atomically: " + str(invalid)
		)
	sim.paused = true
	before = fingerprint(sim)
	check(
		RaceStepClock.advance(sim, 0.25) == 0 and before == fingerprint(sim),
		"Paused scheduling does not accumulate hidden time"
	)
	sim.paused = false
	var snapshot = sim.snapshot()
	var a = PracticeRaceSim.restore_practice(snapshot)
	var b = PracticeRaceSim.restore_practice(snapshot)
	var steps_a = 0
	var steps_b = 0
	for i in range(40):
		steps_a += RaceStepClock.advance(a, 0.05)
	for i in range(200):
		steps_b += RaceStepClock.advance(b, 0.01)
	check(
		steps_a == 40 and steps_b == 40,
		"Different display cadences execute the same fixed-step count"
	)
	check(
		RaceRecord.equivalent(a.snapshot(), b.snapshot()),
		"Equivalent elapsed partitions preserve complete state and remainder"
	)
	for speed in [1, 2, 4, 8, 16]:
		var fast = PracticeRaceSim.restore_practice(snapshot)
		fast.speed = speed
		var ticks = 0
		for i in range(40):
			ticks += RaceStepClock.advance(fast, 0.05 / speed)
		check(
			(
				ticks == 40
				and RaceRecord.equivalent(
					RaceRecord.sporting(fast.snapshot()), RaceRecord.sporting(a.snapshot())
				)
			),
			"Playback speed cannot change equivalent sporting steps: " + str(speed)
		)
	var paused_in_tick = PracticeRaceSim.restore_practice(snapshot)
	paused_in_tick.speed = 16
	# Capture a WeakRef, not the RefCounted owner, in its own signal callback.
	var target = weakref(paused_in_tick)
	paused_in_tick.fixed_step_completed.connect(func(): target.get_ref().paused = true)
	check(
		RaceStepClock.advance(paused_in_tick, 0.25) == 1,
		"Pause raised at a fixed-step boundary prevents all later ticks in the same frame"
	)
	var capped = PracticeRaceSim.restore_practice(snapshot)
	check(
		RaceStepClock.advance(capped, 10.0) == 5,
		"Documented frame-spike cap is preserved; no unbounded catch-up"
	)


func test_observed_progression() -> void:
	var reference = fixture()
	reference.command("qualify")
	var observed = PracticeRaceSim.restore_practice(reference.snapshot())
	var runner = RaceSessionRunner.new(observed)
	var initial_phases: Array = []
	runner.phase_changed.connect(func(phase): initial_phases.append(phase))
	runner.observe_phase()
	runner.observe_phase()
	check(
		initial_phases == [observed.phase],
		"A newly owned session publishes its initial phase once, including while paused"
	)
	var query = MinimalWeekendQuery.new(observed)
	var visual = RaceVisualSource.new(observed)
	for i in range(160):
		reference.step()
		runner.advance(RaceSim.STEP)
		if i % 3 == 0:
			query.capture()
		if i % 7 == 0:
			visual.capture()
	check(
		RaceRecord.equivalent(reference.snapshot(), observed.snapshot()),
		"Runner plus irregular visualization exactly matches bare fixed-step simulation"
	)
	var changes: Array = []
	runner.phase_changed.connect(func(phase): changes.append(phase))
	observed.phase = "qualifying_results"  # Deliberate application-notification boundary fixture.
	runner.observe_phase()
	runner.observe_phase()
	check(
		changes == ["qualifying_results"],
		"Phase notifications occur once per observed transition, not once per UI refresh"
	)
	var weak = weakref(observed)
	observed = null
	check(weak.get_ref() != null, "Active application session owns its simulation lifetime")
	runner = null
	check(weak.get_ref() == null, "Releasing the application session releases the simulation")


func run() -> void:
	var data = Storage.read_json("res://data/tracks/hillside.json")
	geometry = TrackGeometry.new(data.data)
	test_geometry_and_restore()
	test_signals()
	test_query_isolation()
	test_clock()
	test_observed_progression()
	var report = {
		"passed": failures.is_empty(),
		"checks": checks,
		"failures": failures,
		"scope": "Headless boundary fixtures; full physical lifecycle is covered separately"
	}
	Storage.write_json("res://reports/architecture-tests.json", report)
	print("ARCHITECTURE_TESTS ", JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
