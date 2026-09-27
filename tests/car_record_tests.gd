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
	finish()

func finish() -> void:
	var report = {"passed": failures.is_empty(), "checks": checks, "failures": failures}
	Storage.write_json("res://reports/car-record-tests.json", report)
	print("CAR_RECORD_TESTS ", JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
