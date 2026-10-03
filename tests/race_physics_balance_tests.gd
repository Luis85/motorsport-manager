extends SceneTree
## Physical balance probes, frozen identity and legacy fixed-step/RNG equivalence.
var checks = 0
var failures: Array[String] = []
var source: Dictionary
var track: TrackGeometry


func _initialize() -> void:
	call_deferred("run")


func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		print("PHYSICS_BALANCE_FAILURE ", message)


func near(a: float, b: float, message: String) -> void:
	check(absf(a - b) < 0.000001, message)


func make(changes: Dictionary = {}) -> RaceSim:
	var record = source.duplicate(true)
	for group in changes:
		for field in changes[group]:
			record.balance[group][field] = changes[group][field]
	return RaceSim.new(track, {"tuning_definition": record, "scenario": "dry", "seed": 7314})


func run() -> void:
	var loaded = ContentPackLoader.new().load_packs([ContentPackLoader.BUILTIN_ROOT])
	check(loaded.ok, "Production core pack provides complete balance input")
	if not loaded.ok:
		finish()
		return
	source = loaded.catalog.tuning("core.race_tuning.default").to_record()
	track = TrackGeometry.new(Storage.read_json("res://config/circuits/hillside.json").data)
	frozen_and_legacy()
	tyre_probes()
	procedure_probes()
	courtesy_probes()
	pit_probes()
	motion_probes()
	finish()


func frozen_and_legacy() -> void:
	var old_record = source.duplicate(true)
	old_record.erase("balance")
	var old_tuning = RaceTuningDefinition.from_record(old_record)
	check(old_tuning != null, "Authored pre-balance tuning remains readable")
	if old_tuning == null:
		return
	check(old_tuning.to_record() == old_record, "Omitted balance retains exact authored metadata")
	check(
		old_tuning.fingerprint == RaceStateValue.fingerprint(old_record),
		"Omitted balance preserves pre-balance fingerprint"
	)
	for group in RacePhysicsBalance.defaults():
		check(
			old_tuning.balance[group] == RacePhysicsBalance.defaults()[group],
			"Omitted physical group uses exact frozen defaults: " + group
		)
	var record = source.duplicate(true)
	var tuning = RaceTuningDefinition.from_record(record)
	record.balance.tyre_incidents.lockup_damage = 8
	var detached = tuning.to_record()
	detached.balance.motion.minimum_grip = 0.5
	near(tuning.balance.tyre_incidents.lockup_damage, 4, "Caller cannot change frozen damage")
	near(tuning.balance.motion.minimum_grip, 0.16, "Detached record cannot change frozen grip")
	check(tuning.balance.is_read_only(), "Balance root is read-only")
	for group in RacePhysicsBalance.defaults():
		check(tuning.balance[group].is_read_only(), "Physical group is read-only: " + group)
	var before = RaceSim.new(
		track, {"tuning_definition": old_record, "scenario": "dry", "seed": 7314}
	)
	var after = make()
	for sim in [before, after]:
		check(sim.command("qualify"), "Baseline qualifying command accepted")
		check(sim.command("send", {"id": 3}), "Baseline release command accepted")
	for tick in range(500):
		before.step()
		after.step()
	var first = before.snapshot()
	var second = after.snapshot()
	first.erase("tuning_definition")
	second.erase("tuning_definition")
	check(
		RaceRecord.equivalent(first, second),
		"Complete defaults preserve every sporting field and RNG over 500 fixed steps"
	)
	var restored = RaceSim.restore(after.snapshot())
	check(restored != null, "Complete physical balance restores without the source catalog")
	if restored != null:
		for tick in range(100):
			after.step()
			restored.step()
		check(
			RaceRecord.equivalent(after.snapshot(), restored.snapshot()),
			"Frozen physical balance continues with exactly matching RNG and state"
		)


func tyre_probes() -> void:
	var guaranteed = make({"tyre_incidents": {"guaranteed_puncture_tread": 6}})
	var car = guaranteed.cars[3]
	var item = TyreInventory.find(car, car.set_id)
	for key in WheelTyres.KEYS:
		item.wheels[key].life = 5
	var seed = guaranteed.rng_state
	guaranteed.check_tyre_incident(car)
	check(item.wheels[WheelTyres.KEYS[0]].punctured, "Changed guaranteed threshold punctures tyre")
	check(guaranteed.rng_state == seed, "Guaranteed puncture retains the legacy RNG short circuit")
	var no_hazard = make({"tyre_incidents": {"puncture_probability_per_tread": 0}})
	car = no_hazard.cars[3]
	item = TyreInventory.find(car, car.set_id)
	for key in WheelTyres.KEYS:
		item.wheels[key].life = 5
	seed = no_hazard.rng_state
	for draw in range(4):
		seed = (1664525 * seed + 1013904223) & 0xffffffff
	no_hazard.check_tyre_incident(car)
	check(
		not item.wheels[WheelTyres.KEYS[0]].punctured, "Zero hazard prevents discretionary puncture"
	)
	check(no_hazard.rng_state == seed, "Zero hazard still consumes four wheel exposure draws")
	var lockup = make(
		{
			"tyre_incidents":
			{"lockup_probability": 1, "assertive_lockup_factor": 1, "lockup_damage": 8}
		}
	)
	car = lockup.cars[3]
	car.braking = 1
	item = TyreInventory.find(car, car.set_id)
	for key in WheelTyres.KEYS:
		item.wheels[key].core = 50
	seed = (1664525 * lockup.rng_state + 1013904223) & 0xffffffff
	lockup.check_tyre_incident(car)
	near(
		WheelTyres.average(item, "flat"),
		2,
		"Authored lock-up damage creates an eight-point flat spot"
	)
	check(lockup.rng_state == seed, "Lock-up retains its single conditional exposure draw")
	var cadence = make({"tyre_incidents": {"check_interval_seconds": 4}})
	cadence.phase = "race"
	car = cadence.cars[3]
	car.route = "track"
	cadence.wear_car(car, 0, 0)
	near(car.tyre_event_clock, 4, "Vehicle condition consumes authored tyre incident cadence")


func procedure_probes() -> void:
	var quick = make({"procedure": {"lights_seconds": 0.1}})
	quick.phase = "lights"
	quick.paused = false
	quick.step()
	check(quick.phase == "lights", "Lights honor the exact first fixed step")
	quick.step()
	check(quick.phase == "race", "Authored lights duration starts the physical race")
	var turn = make({"procedure": {"garage_turnaround_seconds": 42}})
	turn.phase = "qualifying"
	var car = turn.cars[3]
	car.route = "pit"
	car.pit_stage = "entry"
	car.pit_d = car.box_d
	turn.update_pit(car)
	near(car.next_qual, turn.clock + 42, "Physical garage return uses authored turnaround")
	var runs = make({"procedure": {"qualifying_maximum_runs": 3}})
	runs.phase = "qualifying"
	runs.paused = false
	car = runs.cars[3]
	car.route = "garage"
	car.auto = true
	car.qual_runs = 2
	car.next_qual = 0
	runs.step()
	check(
		car.route == "pit" and car.qual_runs == 3, "Authored maximum allows a third autonomous run"
	)


func courtesy_probes() -> void:
	var ordinary = make()
	var shorter = make({"courtesy": {"acquire_distance_m": 40, "immediate_distance_m": 40}})
	for sim in [ordinary, shorter]:
		sim.phase = "qualifying"
		for car in sim.cars:
			car.route = "garage"
		var car = sim.cars[3]
		car.route = "track"
		car.qual_state = "outlap"
		car.distance = 1000
		car.speed = 20
		var priority = sim.cars[4]
		priority.route = "track"
		priority.qual_state = "hotlap"
		priority.distance = 950
		priority.speed = 30
		var old: Array = []
		for other in sim.cars:
			old.append(other.to_record())
		sim.update_yield(car, old)
	check(ordinary.cars[3].yield_to == 4, "Default courtesy acquires the approaching flying lap")
	check(shorter.cars[3].yield_to == -1, "Changed courtesy distance defers acquisition")


func pit_probes() -> void:
	var ordinary = make()
	var faster = make({"pit_motion": {"acceleration_mps2": 10}})
	for sim in [ordinary, faster]:
		sim.phase = "qualifying"
		var car = sim.cars[3]
		car.route = "pit"
		car.pit_stage = "exit"
		car.pit_d = car.box_d
		car.speed = 0
		sim.update_pit(car)
	near(
		ordinary.cars[3].speed, 0.25, "Default pit acceleration preserves its fixed-step increment"
	)
	near(faster.cars[3].speed, 0.5, "Authored pit acceleration changes actual physical movement")
	var earlier = make({"pit_motion": {"entry_braking_factor": 1, "entry_braking_margin_m": 0}})
	var stopping = (
		(
			maxf(0, 50.0 ** 2 - track.pit_limit ** 2)
			/ (2 * track.vehicle_definition.braking_mps2 * 0.5)
		)
		+ 8
	)
	for sim in [ordinary, earlier]:
		var car = sim.cars[3]
		car.distance = track.pit_entry - stopping * 0.75
		car.speed = 50
		sim.plan_pit_gate(car)
	check(ordinary.cars[3].pit_deferred, "Default late-braking fixture defers physical pit entry")
	check(
		not earlier.cars[3].pit_deferred, "Changed effective braking allows the current pit entry"
	)


func motion_probes() -> void:
	var fixed = make({"motion": {"minimum_grip": 0.5, "maximum_grip": 0.5}})
	var car = fixed.cars[3]
	near(fixed.grip(car, 0), 0.5, "Authored grip clamps alter the physical handling envelope")
	var ordinary = make()
	var shorter = make({"motion": {"formation_lane_distance_m": 50}})
	for sim in [ordinary, shorter]:
		sim.phase = "formation"
		car = sim.cars[3]
		car.distance = track.length - (car.grid - 1) * track.grid_spacing - 75
		var movement = sim._session_movement(car, {"line": 0.0}, 20)
		check(
			movement.lane == (2.0 if sim == ordinary else 0.0),
			"Formation lane alignment consumes authored approach distance"
		)


func finish() -> void:
	var result = {"passed": failures.is_empty(), "checks": checks, "failures": failures}
	Storage.write_json("res://reports/race-physics-balance-tests.json", result)
	print("RACE_PHYSICS_BALANCE_TESTS ", JSON.stringify(result))
	quit(0 if failures.is_empty() else 1)
