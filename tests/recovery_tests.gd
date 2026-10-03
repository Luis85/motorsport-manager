extends "res://tests/support/recovery_service_contracts.gd"


func run() -> void:
	var started = Time.get_ticks_msec()
	geometry = TrackGeometry.new(Storage.read_catalog().data[7])
	test_stages_and_exposure()
	test_observational_forecasts()
	test_commands_and_authority()
	test_physical_service()
	test_shared_repair_and_terminal_edges()
	test_control_procedure()
	test_physical_restrictions()
	test_migration_and_validation()
	var report = {
		"passed": failures.is_empty(),
		"checks": checks,
		"failures": failures,
		"metrics": metrics,
		"engine": Engine.get_version_info().string,
		"cpu": OS.get_processor_name(),
		"elapsed_seconds": (Time.get_ticks_msec() - started) / 1000.0,
		"limitations":
		"Deterministic contract fixtures, not calibrated failure probabilities, broad balance or human playtesting."
	}
	Storage.write_json("res://reports/recovery-tests.json", report)
	print("RECOVERY_TESTS ", JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)


func test_physical_restrictions() -> void:
	var sim = fixture()
	isolate_pair(sim)
	WeekendRaceControl.enqueue(
		sim.control_state,
		0,
		0,
		true,
		38,
		sim.total_time,
		"fixture-hazard",
		"Adversarial side-by-side deployment"
	)
	var legal = true
	var forward = true
	var both_moved = true
	for i in range(400):
		var a = sim.cars[3].distance
		var b = sim.cars[6].distance
		sim.step()
		legal = legal and sim.cars[3].distance <= sim.cars[6].distance
		forward = forward and sim.cars[3].distance >= a and sim.cars[6].distance >= b
	both_moved = sim.cars[3].distance > 100 and sim.cars[6].distance > 101
	check(
		legal and forward and both_moved,
		"A faster alongside follower cannot pass or rewind under virtual neutralization"
	)
	check(sim.stats.passes == 0, "No prohibited pass is credited by the battle journal")
	var a = fixture()
	var b = fixture()
	# Large gaps are not deliberately closed by a catch-up state or a grid reset.
	for s in [a, b]:
		for c in s.cars:
			if c.id not in [3, 6]:
				c.dnf = true
				c.speed = 0.0
		s.cars[3].distance = 100
		s.cars[6].distance = 100 + s.track.length * 0.5
		WeekendRaceControl.enqueue(
			s.control_state, 0, 0, true, 38, s.total_time, "spread", "Spread-out field"
		)
	b.speed = 16
	for i in range(200):
		a.step()
		b.step()
		if i % 30 == 0:
			b.recovery_advice(3)
			b.weather_advice(6)
	check(
		(
			RaceCar.records(a.cars) == RaceCar.records(b.cars)
			and a.control_state == b.control_state
			and a.reliability_state == b.reliability_state
		),
		"Equivalent fixed steps ignore playback speed and observation frequency"
	)
	check(
		a.cars[6].distance - a.cars[3].distance > geometry.length * 0.25,
		"Virtual running does not collapse a spread field into a safety-car train"
	)
	var entry = fixture()
	var c = entry.cars[3]
	c.damage = 40
	synchronize(entry)
	entry.command("recovery_repair", request(entry.recovery_advice(3)))
	c.distance = c.pit_gate - 0.2
	c.speed = 20
	entry.retire(entry.cars[0], "Barrier impact")
	entry.step()
	check(
		c.route == "pit" and entry.flag == "VIRTUAL",
		"Pit entry and neutralization in the same step retain physical entry legality"
	)
	var records = entry.strategy_state.records
	var control_index = -1
	var entry_index = -1
	for i in range(records.size()):
		if records[i].kind == "race_control":
			control_index = i
		if records[i].kind == "pit_entry" and records[i].driver_id == 3:
			entry_index = i
	check(
		control_index >= 0 and entry_index > control_index,
		"Control is journaled before same-step physical pit entry"
	)
	var loaded = RecoveryRaceSim.restore_recovery(
		JSON.parse_string(JSON.stringify(entry.snapshot(), "", false, true))
	)
	check(
		loaded != null and loaded.flag == "VIRTUAL",
		"A new virtual procedure restores through the explicitly versioned adapter"
	)
	if loaded != null:
		for i in range(200):
			entry.step()
			loaded.step()
		check(
			(
				equivalent(entry.cars, loaded.cars)
				and equivalent(entry.control_state, loaded.control_state)
				and equivalent(entry.reliability_state, loaded.reliability_state)
			),
			"Virtual deployment plus committed pit continuation survives JSON restore"
		)


func test_migration_and_validation() -> void:
	var sim = fixture()
	sim.cars[3].damage = 40
	synchronize(sim)
	var data = JSON.parse_string(JSON.stringify(sim.snapshot(), "", false, true))
	check(
		RecoveryRaceSim.restore_recovery(data) != null and data.version == 8,
		"Version-eight recovery envelope restores all inherited weather/team state"
	)
	for field in ["rng", "fault_threshold", "terminal_threshold", "critical_load", "repair_budget"]:
		var corrupt = data.duplicate(true)
		corrupt.reliability_state.drivers[3][field] = -1
		check(
			RecoveryRaceSim.restore_recovery(corrupt) == null,
			"Invalid recovery " + field + " rejected"
		)
	var bad = data.duplicate(true)
	bad.control_state.state = "physical_safety_car"
	check(RecoveryRaceSim.restore_recovery(bad) == null, "Unsupported sporting procedure rejected")
	bad = data.duplicate(true)
	bad.flag = "VIRTUAL"
	check(
		RecoveryRaceSim.restore_recovery(bad) == null,
		"Inconsistent public flag and authoritative control record rejected"
	)
	bad = data.duplicate(true)
	bad.reliability_state.drivers[3].repair_only = true
	check(
		RecoveryRaceSim.restore_recovery(bad) == null,
		"Repair-only cannot exist without its real pending physical order"
	)
	bad = data.duplicate(true)
	bad.reliability_state.drivers[3].service = {"duration": 3}
	check(
		RecoveryRaceSim.restore_recovery(bad) == null,
		"Malformed frozen repair job rejected before UI exposure"
	)
	bad = data.duplicate(true)
	for record in bad.strategy_state.records:
		if record.kind == "recovery_stage":
			record.evidence.observed.erase("health")
			break
	check(
		RecoveryRaceSim.restore_recovery(bad) == null,
		"Malformed recovery journal observation rejected"
	)
	var old = WeatherRaceSim.new(
		geometry, {"laps": 12, "scenario": "wet", "seed": 86, "intensity": "calm"}
	)
	old.command("prepare_race")
	old.command("formation")
	var migrated = RecoveryRaceSim.restore_recovery(old.snapshot())
	check(
		(
			migrated != null
			and not migrated.enhanced()
			and migrated.weather_state == old.weather_state
		),
		"Version-seven migration preserves old model semantics rather than silently adding faults"
	)
	if migrated != null:
		for i in range(200):
			old.step()
			migrated.step()
		check(
			(
				RaceCar.records(old.cars) == RaceCar.records(migrated.cars)
				and old.rng_state == migrated.rng_state
				and old.weather_state == migrated.weather_state
			),
			"Legacy migration preserves physical outcomes and random streams"
		)
		check(
			RecoveryRaceSim.restore_recovery(migrated.snapshot()) != null,
			"A migrated legacy-mode version-eight checkpoint remains valid"
		)
	for previous in [RaceSim.new(geometry), StrategyRaceSim.new(geometry)]:
		check(
			RecoveryRaceSim.restore_recovery(previous.snapshot()) != null,
			"Supported prior native schema still loads: %d" % previous.snapshot().version
		)
