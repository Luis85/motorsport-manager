extends SceneTree
## The record boundary works before and after an aggregate adopts typed entrants.
var checks: int = 0
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, description: String) -> void:
	checks += 1
	if not value:
		failures.append(description)
		push_error(description)

func run() -> void:
	var geometry = TrackGeometry.new(Storage.read_json("res://data/tracks/hillside.json").data)
	var source = RaceSim.new(geometry).snapshot().cars[3]
	var expected = RaceStateValue.fingerprint(source)
	var car = RaceCar.from_record(source)
	check(car != null, "The production checkpoint record decodes into a typed entrant")
	if car == null:
		finish()
		return
	check(car.id == 3 and car.id is int and car.distance is float, "Runtime identity and physical values have declared scalar types")
	check(RaceStateValue.fingerprint(car.to_record()) == expected, "The codec preserves every checkpoint field")
	var restored = RaceCar.from_record(JSON.parse_string(JSON.stringify(source, "", true, true)))
	check(restored != null and RaceStateValue.fingerprint(restored.to_record()) == expected, "Full-precision JSON retains all values and reconstructs scalar types")
	var outgoing = car.to_record()
	outgoing.fuel = 0.0; outgoing.tyre_sets[0].wheels.FL.life = 0.0
	check(RaceStateValue.fingerprint(car.to_record()) == expected, "Outgoing records cannot mutate entity resources or nested wheel state")
	source.tyre_sets[0].wheels.FR.life = 0.0
	check(RaceStateValue.fingerprint(car.to_record()) == expected, "Incoming records are detached from caller-owned collections")
	var cloned = car.detached_copy()
	cloned.car_setup.wing = 9; cloned.history.append({"time": 5.0})
	check(RaceStateValue.fingerprint(car.to_record()) == expected, "Cloned entities own independent setup and history")
	for change in [{"id": 3.5}, {"fuel": NAN}, {"fuel": INF}, {"finished": 1}, {"tyre_sets": {}}, {"name": 7}]:
		var invalid = car.to_record(); invalid.merge(change, true)
		check(RaceCar.from_record(invalid) == null, "Invalid scalar or collection type is rejected")
	var missing = car.to_record(); missing.erase("fuel")
	check(RaceCar.from_record(missing) == null, "Missing resource fields never acquire guessed defaults")
	var extra = car.to_record(); extra.unversioned_rule = true
	check(RaceCar.from_record(extra) == null, "Unknown fields require an explicit schema decision")
	var object_record = car.to_record(); object_record.history.append(RefCounted.new())
	check(RaceCar.from_record(object_record) == null, "Nested engine objects cannot cross the record boundary")
	var nonfinite = car.to_record(); nonfinite.history.append({"time": INF})
	check(RaceCar.from_record(nonfinite) == null, "Nested non-finite measurements are rejected")
	var cycle: Array = []; cycle.append(cycle)
	var cyclic_record = car.to_record(); cyclic_record.history = cycle
	check(RaceCar.from_record(cyclic_record) == null, "Cyclic records are rejected before duplication")
	cycle.clear()
	var fields: Array[String] = []
	for property in car.get_property_list():
		if property.usage & PROPERTY_USAGE_SCRIPT_VARIABLE: fields.append(property.name)
	fields.sort()
	var serialized = RaceCar.FIELDS.duplicate(); serialized.sort()
	check(fields == serialized, "The declared codec covers every entity field exactly once")
	checkpoint_preparation_tests(geometry)
	finish()

func finish() -> void:
	var report = {"passed": failures.is_empty(), "checks": checks, "failures": failures}
	Storage.write_json("res://reports/car-record-tests.json", report)
	print("CAR_RECORD_TESTS ", JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)

func checkpoint_preparation_tests(geometry: TrackGeometry) -> void:
	var model = RaceSim.new(geometry, {"scenario": "dry", "intensity": "calm"})
	check(model.command("qualify"), "Checkpoint preparation fixture enters an active session")
	for index in range(40): model.step()
	var current = model.snapshot()
	var original = RaceStateValue.fingerprint(current)
	var defaults = RaceSim.CAR_V2.duplicate(true)
	var defaults_before = RaceStateValue.fingerprint(defaults)
	var prepared = RaceCheckpoint.prepare_base(current, defaults, RaceSim.TYRES)
	check(RaceStateValue.fingerprint(prepared) == original, "Current base records require no invented migration fields or version changes")
	prepared.cars[3].history.append({"time": 1.0}); prepared.track.nodes[0].x += 50
	check(RaceStateValue.fingerprint(current) == original, "Prepared records never retain caller-owned track or car collections")
	for version in [1, 2, 3]:
		var legacy = current.duplicate(true); legacy.version = version
		legacy.erase("surface"); legacy.erase("surface_accumulator")
		for car in legacy.cars:
			if version == 1:
				for key in RaceSim.CAR_V2: car.erase(key)
			if version < 3:
				for key in ["tyre_sets", "set_id", "next_set_id", "service_set_id", "scheduled_lap", "stints"]: car.erase(key)
			else:
				for item in car.tyre_sets:
					for key in ["wheels", "heat_cycles", "heated"]: item.erase(key)
			for key in ["car_setup", "battle_mode", "engine_temperature", "brake_temperature", "tyre_event_clock"]: car.erase(key)
		var prior = RaceStateValue.fingerprint(legacy)
		var migrated = RaceCheckpoint.prepare_base(legacy, defaults, RaceSim.TYRES)
		check(not migrated.is_empty(), "Supported legacy base records have an explicit preparation path")
		if migrated.is_empty(): continue
		check(migrated.version == version and migrated.rng_state == legacy.rng_state, "Preparation preserves source version and gameplay RNG rather than hiding migration work")
		check(migrated.cars[3].tyre == legacy.cars[3].tyre and migrated.cars[3].temperature == legacy.cars[3].temperature, "Legacy tyre aggregate condition is retained")
		check(RaceSurface.valid(migrated.surface, migrated.water, migrated.rubber), "Legacy surface reconstruction remains owned and valid")
		check(RaceCheckpoint.valid(migrated) and RaceSim.restore(legacy) != null, "Prepared legacy data still passes semantic and complete aggregate restoration")
		migrated.cars[3].qual_history.append({"time": 1.0})
		migrated.cars[3].tyre_sets[0].wheels.FL.life = 0.0
		check(prior == RaceStateValue.fingerprint(legacy), "Legacy migrations never mutate their input or share nested state")
	check(RaceStateValue.fingerprint(defaults) == defaults_before, "Migration defaults are not a mutable shared record template")
	for change in [{"kind": "wrong"}, {"version": 0}, {"version": 5}, {"version": 1.5}, {"cars": []}, {"water": []}, {"phase": "unknown"}]:
		var invalid = current.duplicate(true); invalid.merge(change, true)
		var prior = RaceStateValue.fingerprint(invalid)
		check(RaceCheckpoint.prepare_base(invalid, defaults, RaceSim.TYRES).is_empty(), "Malformed or unsupported base envelopes fail before preparation")
		check(prior == RaceStateValue.fingerprint(invalid), "Rejected preparation preserves the supplied values")
	var semantically_invalid = current.duplicate(true); semantically_invalid.selected_id = 3.5
	check(not RaceCheckpoint.prepare_base(semantically_invalid, defaults, RaceSim.TYRES).is_empty(), "Structural preparation does not pretend to replace semantic validation")
	check(RaceSim.restore(semantically_invalid) == null, "The aggregate still rejects invalid semantics after structural preparation")
	var profile = PracticeRaceSim.new(geometry)
	var checkpoint = profile.snapshot()
	check(RaceCheckpoint.prepare_base(checkpoint, defaults, RaceSim.TYRES).is_empty(), "A profile checkpoint cannot silently bypass its own versioned reader")
	var restored = PracticeRaceSim.restore_practice(checkpoint)
	check(restored != null and restored.has_mechanic("practice") and restored.has_mechanic("recovery"), "Profile restoration retains its explicitly installed mechanics")
	check(original == RaceStateValue.fingerprint(model.snapshot()), "Migration, validation and restoration do not mutate the original running session or RNG")
