extends RefCounted
## Imported race collections reject before reaching trusted physics and profile helpers.


static func run(geometry: TrackGeometry, check: Callable) -> void:
	var model = RaceSim.new(geometry, {"scenario": "dry", "intensity": "calm"})
	model.phase = "race"
	var car: RaceCar = model.cars[3]
	car.route = "pit"
	car.pit_stage = "service"
	car.pit_d = car.box_d
	car.pit_timer = 0.15
	car.service_compound = car.next_compound
	car.service_set_id = TyreInventory.choose(car, car.service_compound, true).id
	model.pit_boxes[car.team_identity()] = car.id
	var current = model.snapshot()
	var service_index = _set_index(current.cars[3].tyre_sets, car.service_set_id)
	for version in [1, 2]:
		var legacy = _legacy(current, version)
		_valid_continuation(legacy, car.service_set_id, check)
		for invalid in [null, true, 7, "scalar", {}, [true], [{}]]:
			var broken = legacy.duplicate(true)
			broken.cars[3].tyre_sets = invalid
			_reject(broken, check)
		for change in [{"compound": true}, {"life": "scalar"}, {"mounts": "scalar"}, {"id": true}]:
			var broken = legacy.duplicate(true)
			broken.cars[3].tyre_sets[service_index].merge(change, true)
			_reject(broken, check)
		for invalid in [null, true, [], {}, {"FL": true}]:
			var broken = legacy.duplicate(true)
			broken.cars[3].tyre_sets[service_index].wheels = invalid
			_reject(broken, check)
		var broken = legacy.duplicate(true)
		broken.cars[3].erase("set_id")
		_reject(broken, check)
	_profile_shapes(geometry, check)


static func _set_index(sets: Array, id: String) -> int:
	for index in range(sets.size()):
		if sets[index].id == id:
			return index
	return -1


static func _profile_shapes(geometry: TrackGeometry, check: Callable) -> void:
	var model = PracticeRaceSim.new(geometry)
	var checkpoint = model.snapshot()
	for _car in model.cars:
		checkpoint.get_or_add("performance_profiles", []).append(RacePerformanceProfile.baseline())
	var restored = PracticeRaceSim.restore_practice(checkpoint)
	check.call(
		restored != null and restored.performance_profiles == checkpoint.performance_profiles,
		"Supported practice checkpoint retains its explicit performance profiles"
	)
	for invalid in [null, true, 7, "scalar", {}]:
		for has_profiles in [false, true]:
			var broken = checkpoint.duplicate(true)
			broken.cars = invalid
			if not has_profiles:
				broken.erase("performance_profiles")
			var before = RaceStateValue.fingerprint(broken)
			check.call(
				PracticeRaceSim.restore_practice(broken) == null,
				"Malformed entrant collection rejects with optional performance profiles"
			)
			check.call(
				RaceStateValue.fingerprint(broken) == before,
				"Practice checkpoint rejection preserves caller records"
			)


static func _legacy(current: Dictionary, version: int) -> Dictionary:
	var legacy = current.duplicate(true)
	legacy.version = version
	legacy.erase("surface")
	legacy.erase("surface_accumulator")
	legacy.cars[3].service_set_id = ""
	for car in legacy.cars:
		if version == 1:
			for key in RaceSim.CAR_V2:
				car.erase(key)
		for item in car.tyre_sets:
			for key in ["wheels", "heat_cycles", "heated"]:
				item.erase(key)
	return legacy


static func _valid_continuation(legacy: Dictionary, expected_set: String, check: Callable) -> void:
	var before = RaceStateValue.fingerprint(legacy)
	var restored = RaceSim.restore(legacy)
	check.call(restored != null, "Legacy service inventory still restores")
	if restored == null:
		return
	check.call(
		restored.cars[3].service_set_id == expected_set and restored.rng_state == legacy.rng_state,
		"Legacy service migration retains replacement selection and gameplay RNG"
	)
	var repeated = RaceSim.restore(legacy)
	for index in range(5):
		restored.step()
		repeated.step()
	check.call(
		(
			RaceStateValue.fingerprint(restored.snapshot())
			== RaceStateValue.fingerprint(repeated.snapshot())
		),
		"Legacy service continuation follows identical deterministic branches"
	)
	check.call(
		RaceStateValue.fingerprint(legacy) == before,
		"Successful legacy service migration owns detached records"
	)


static func _reject(broken: Dictionary, check: Callable) -> void:
	var before = RaceStateValue.fingerprint(broken)
	check.call(
		RaceCheckpoint.prepare_base(broken, RaceSim.CAR_V2, RaceSim.TYRES).is_empty(),
		"Malformed legacy service inventory rejects before tyre selection"
	)
	check.call(RaceSim.restore(broken) == null, "Malformed legacy service cannot restore")
	check.call(
		RaceStateValue.fingerprint(broken) == before,
		"Rejected legacy service migration preserves caller records"
	)
