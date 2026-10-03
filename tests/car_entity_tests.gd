extends SceneTree
## Runtime entrants are typed domain entities; records cross save/read boundaries.
var checks: int = 0
var failures: Array[String] = []


class TypedProbe:
	extends RaceMechanic
	var observed: Array[int] = []

	func definition() -> Dictionary:
		return {
			"id": "typed-probe", "version": 1, "requires": ["strategy"], "hooks": ["leave_garage"]
		}

	func leave_garage(sim: RaceSim, car: RaceCar) -> void:
		observed.append(car.id)
		sim.mechanics.before("typed-probe", "leave_garage", [car])


class RecordProbe:
	extends RaceMechanic

	func definition() -> Dictionary:
		return {"id": "record-probe", "version": 1, "requires": [], "hooks": ["leave_garage"]}

	func leave_garage(_sim: RaceSim, _car: Dictionary) -> void:
		pass


func _initialize() -> void:
	call_deferred("run")


func check(value: bool, description: String) -> void:
	checks += 1
	if not value:
		failures.append(description)
		push_error(description)


func run() -> void:
	var track = TrackGeometry.new(Storage.read_json("res://config/circuits/hillside.json").data)
	var sim = PracticeRaceSim.new(track, {"scenario": "dry", "seed": 7314})
	var original = RaceStateValue.fingerprint(sim.snapshot())
	check(
		sim.cars.is_typed() and sim.cars.get_typed_script() == RaceCar,
		"The aggregate stores typed entrants rather than dictionary proxies"
	)
	for car in sim.cars:
		check(
			car is RaceCar and car.id >= 0 and car.id < 12,
			"All constructed entrants have explicit typed identity"
		)
	var fields: Array[String] = []
	var bindings: Array[String] = []
	var expected_bindings: Array[String] = ["entry_definition", "setup_definition", "tyre_rules"]
	for property in sim.cars[3].get_property_list():
		if property.usage & PROPERTY_USAGE_SCRIPT_VARIABLE:
			if property.name in expected_bindings:
				bindings.append(property.name)
				check(
					property.type == TYPE_OBJECT,
					"Session content dependencies remain typed Object bindings"
				)
			else:
				fields.append(property.name)
	fields.sort()
	bindings.sort()
	expected_bindings.sort()
	check(
		bindings == expected_bindings,
		"Only the three frozen session inputs are outside the mutable car-state codec"
	)
	var declared = RaceCar.FIELDS.duplicate()
	declared.sort()
	check(
		fields == declared and sim.cars[3].to_record().size() == fields.size(),
		"Every mutable typed field is represented once in the codec contract"
	)
	check(fields.size() == 91, "The compatible car save contract still has exactly 91 fields")
	for binding in expected_bindings:
		check(
			not sim.cars[3].to_record().has(binding),
			"Frozen content remains session-owned: " + binding
		)
	var record = sim.cars[3].to_record()
	var decoded = RaceCar.from_record(JSON.parse_string(JSON.stringify(record, "", true, true)))
	check(
		decoded != null and decoded.id is int and decoded.pace is int and decoded.distance is float,
		"JSON numbers regain their declared runtime types"
	)
	check(
		RaceStateValue.fingerprint(decoded.to_record()) == RaceStateValue.fingerprint(record),
		"The typed codec preserves all serialized values"
	)
	decoded.fuel = 0.0
	decoded.tyre_sets[0].wheels.FL.life = 0.0
	check(
		original == RaceStateValue.fingerprint(sim.snapshot()),
		"Decoded and original cars do not share nested wheel or resource state"
	)
	record.car_setup.wing = 9
	record.tyre_sets[0].wheels.FL.life = 0.0
	check(
		original == RaceStateValue.fingerprint(sim.snapshot()),
		"Outgoing records cannot rewrite the live entity"
	)
	var copy = sim.cars[6].detached_copy()
	copy.tyre_sets[0].wheels.FR.life = 1.0
	copy.history.append({"time": 9.0})
	check(
		original == RaceStateValue.fingerprint(sim.snapshot()),
		"Entity cloning owns its entire nested allocation and history"
	)
	for edit in [
		{"id": 3.5}, {"fuel": NAN}, {"fuel": INF}, {"finished": 1}, {"tyre_sets": {}}, {"name": 5}
	]:
		var invalid = sim.cars[3].to_record()
		invalid.merge(edit, true)
		check(
			RaceCar.from_record(invalid) == null,
			"Invalid scalar/collection types are rejected before constructing a car"
		)
	var unknown = sim.cars[3].to_record()
	unknown.unversioned_rule = true
	check(
		RaceCar.from_record(unknown) == null,
		"Unversioned unknown fields cannot silently disappear during codec round trips"
	)
	unknown = sim.cars[3].to_record()
	unknown.erase("fuel")
	check(
		RaceCar.from_record(unknown) == null,
		"Missing fields cannot silently acquire guessed resource values"
	)
	var object_value = sim.cars[3].to_record()
	object_value.history.append(RefCounted.new())
	check(
		RaceCar.from_record(object_value) == null,
		"Nested engine objects cannot enter an external car record"
	)
	var query = RaceViewQuery.new(sim)
	var all = query.cars
	all[3].fuel = 1.0
	var order = query.standings()
	order[0].tyre_sets.clear()
	check(
		query.car(3) is Dictionary and original == RaceStateValue.fingerprint(sim.snapshot()),
		"Public car and classification projections serialize entities instead of copying Object references"
	)
	check(
		query.car_position({}).is_empty() and query.car_advisories({}).is_empty(),
		"Malformed diagnostic records fail safely without resolving live authority"
	)
	check(
		query.pit_status({}).is_empty() and query.strategy_advice({}).is_empty(),
		"Unavailable record feedback cannot trigger a domain call with a null entrant"
	)
	var tactic = query.tactical_forecast_draft(3)
	check(
		(
			query.tactical_plan_error(tactic, 3)
			== TacticalForecast.validate_plan(tactic, sim.cars, 3, sim.laps)
		),
		"Diagnostic tactical validation uses the typed application boundary"
	)
	check(
		not query.tactical_plan_error(tactic, -1).is_empty(),
		"Unknown tactical driver is rejected without dereferencing an entrant"
	)
	check(
		original == RaceStateValue.fingerprint(sim.snapshot()),
		"Draft validation cannot mutate the original race"
	)
	# Default pit-service callers without an old traffic snapshot still read only
	# the three queue fields from each typed entrant.
	var queue_fixture = RaceSim.new(track)
	queue_fixture.phase = "qualifying"
	var queue_car = queue_fixture.cars[3]
	queue_car.route = "pit"
	queue_car.pit_stage = "entry"
	queue_car.pit_d = 0.0
	queue_fixture.update_pit(queue_car)
	check(
		queue_car.pit_d >= 0.0 and queue_car.route == "pit",
		"Physical pit service accepts typed entrants without a supplied traffic snapshot"
	)
	var checkpoint = sim.snapshot()
	var restored = PracticeRaceSim.restore_practice(checkpoint)
	check(
		restored != null and restored.cars[3] is RaceCar,
		"Production restore rebuilds typed entrants under the existing save version"
	)
	if restored != null:
		check(
			RaceRecord.equivalent(checkpoint, restored.snapshot()),
			"Production restore retains the full checkpoint and RNG"
		)
		check(
			restored.cars[3] != sim.cars[3],
			"Restored entrants have independent identity and lifetime"
		)
	var invalid_owner = RaceSim.new(track)
	check(
		not invalid_owner.mechanics.configure([RecordProbe.new()]),
		"Mechanic contracts reject a dictionary where an authoritative RaceCar is required"
	)
	var candidate = RaceSim.new(track)
	var probe = TypedProbe.new()
	var providers = RaceMechanicProfiles.build("strategy")
	providers.append(probe)
	check(
		candidate.mechanics.configure(providers) and candidate.mechanics.install(track, {}),
		"A typed mechanic installs without another simulation subclass"
	)
	check(
		candidate.command("qualify") and candidate.command("send", {"id": 3}),
		"Existing legal commands reach the typed dispatch boundary"
	)
	check(
		probe.observed == [3] and candidate.cars[3].route == "pit",
		"Typed hook receives the intended entrant and preserves physical garage release"
	)
	var retained = weakref(sim)
	sim = null
	check(
		retained.get_ref() == null and not query.available(),
		"A copied entity or read model cannot retain the discarded aggregate"
	)
	var report = {"passed": failures.is_empty(), "checks": checks, "failures": failures}
	Storage.write_json("res://reports/car-entity-tests.json", report)
	print("CAR_ENTITY_TESTS ", JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
