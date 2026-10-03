extends RefCounted
var h


func check(value: bool, text: String) -> void:
	h.check(value, "Iteration 4: " + text)


func mounted(sim: RaceSim) -> Dictionary:
	return TyreInventory.find(sim.cars[3], sim.cars[3].set_id)


func input_state() -> Dictionary:
	return {
		"speed": 55.0,
		"curve": -0.013,
		"bias": 0.56,
		"brake": 0.8,
		"throttle": 0.2,
		"slip": 0.08,
		"water": 0.0,
		"push": 1.0,
		"neutral": false,
		"care": 85,
		"wear": 0.03,
		"lap": 0.005
	}


func test_wheels() -> void:
	var sim = RaceSim.new(h.geometries[7])
	var c = sim.cars[3]
	var item = mounted(sim)
	check(
		WheelTyres.OPTIMUM == {"S": 84.0, "M": 89.0, "H": 94.0, "I": 73.0, "W": 65.0},
		"compound target temperatures match the source sandbox"
	)
	check(item.wheels.keys() == WheelTyres.KEYS, "four named contact patches per set")
	item.wheels.FL.flat = 14.0
	check(item.wheels.FR.flat == 0, "wheel records are independent, not shared dictionaries")
	var stock = item.duplicate(true)
	WheelTyres.update(item, input_state(), 1.0)
	check(
		item.wheels.FL.load > item.wheels.FR.load and item.wheels.RL.load > item.wheels.RR.load,
		"outside wheels carry more load in a right-hand turn"
	)
	check(item.wheels.FL.life < item.wheels.FR.life, "loaded and flat-spotted wheel wears faster")
	check(
		item.wheels.FL.surface > item.wheels.FL.core, "surface heat responds faster than the core"
	)
	check(
		item.wheels.FL.pressure != stock.wheels.FL.pressure,
		"core heating changes normalized pressure"
	)
	check(WheelTyres.valid(item), "normal wheel update keeps inventory valid")
	WheelTyres.publish(item)
	c.tyre = item.life
	c.temperature = item.temperature
	var worn = item.duplicate(true)
	var id = item.id
	TyreInventory.mount(c, "3-S2")
	TyreInventory.mount(c, id)
	check(
		mounted(sim).wheels == worn.wheels,
		"remount preserves individual contact-patch damage and temperatures"
	)
	var before = WheelTyres.grip_wheel(item.wheels.FR, item.compound)
	item.wheels.FR.grain = 50
	check(
		WheelTyres.grip_wheel(item.wheels.FR, item.compound) < before,
		"graining reduces available wheel grip"
	)
	check(
		WheelTyres.lockup(item, 0.52, 5) == "RL" and item.wheels.RL.flat == 5,
		"rearward brake bias locates a rear flat spot"
	)
	check(
		WheelTyres.lockup(item, 0.6, 5) == "FL" and item.wheels.FL.flat > 14,
		"forward brake bias locates a front flat spot"
	)
	c.temperature = item.temperature
	for key in WheelTyres.KEYS:
		item.wheels[key].core = 100
		item.wheels[key].surface = 102
	WheelTyres.publish(item)
	WheelTyres.update(item, input_state(), 0.05)
	check(item.heat_cycles == 1 and item.heated, "heating records a cycle once")
	WheelTyres.update(item, input_state(), 0.05)
	check(item.heat_cycles == 1, "a hot running set does not gain a cycle every tick")
	WheelTyres.cool(item, 5000)
	check(
		not item.heated and item.wheels.FL.flat > 0,
		"cool-down re-arms the cycle without repairing flat spots"
	)
	var race = h.blank_race(h.geometries[7], {"laps": 5, "intensity": "calm"})
	c = race.cars[3]
	c.auto = false
	item = mounted(race)
	item.wheels.FL.life = 0
	WheelTyres.publish(item)
	c.tyre = item.life
	race.check_tyre_incident(c)
	check(
		item.wheels.FL.punctured and not race.paused,
		"exhausted wheel punctures without pausing the session"
	)
	check(not WheelTyres.usable(item), "a punctured set cannot be selected as service stock")
	check(
		not race.command("select_set", {"id": 3, "set_id": item.id}),
		"public command rejects a punctured replacement"
	)
	check(
		race.car_advisories(c)[0].contains("PUNCTURE"),
		"pit-wall advisory identifies the affected wheel"
	)
	race.engineer(c)
	check(not c.pit_order, "manual strategy is not overridden by an advisory")


func test_setup() -> void:
	var sim = RaceSim.new(h.geometries[7])
	var c = sim.cars[3]
	var baseline = c.car_setup.duplicate()
	var before = CarSetup.effects(c)
	check(
		sim.command(
			"setup_all",
			{
				"id": 3,
				"values": {"wing": 9, "balance": 2, "suspension": 7, "cooling": 7, "bias": 58}
			}
		),
		"five setup values commit in the garage"
	)
	var after = CarSetup.effects(c)
	check(
		after.corner > before.corner and after.straight < before.straight,
		"high wing has a support-versus-straight trade-off"
	)
	check(c.setup == 9 and CarSetup.valid(c.to_record()), "legacy wing alias remains synchronized")
	var applied = c.car_setup.duplicate()
	check(
		(
			not sim.command("setup_all", {"id": 3, "values": {"wing": 2, "bias": 99}})
			and c.car_setup == applied
		),
		"invalid setup rejects the entire batch, not just the last field"
	)
	check(
		not sim.command("setup_all", {"id": 3, "values": {"turbo": 9}}),
		"unknown setup fields rejected"
	)
	check(
		not sim.command("setup_all", {"id": 0, "values": baseline}), "rival setup is inspect-only"
	)
	check(sim.command("qualify"), "setup fixture enters qualifying")
	check(
		sim.command("setup_all", {"id": 3, "values": baseline}),
		"setup remains editable before garage release"
	)
	sim.command("auto", {"id": 3, "value": false})
	sim.command("send", {"id": 3})
	check(
		not sim.command("setup_all", {"id": 3, "values": applied}),
		"on-track qualifying cannot change mechanical setup"
	)
	var race = h.blank_race(h.geometries[7], {"laps": 5, "intensity": "calm"})
	check(not race.command("setup", {"id": 3, "value": 8}), "race mechanical setup is locked")
	check(
		race.command("brake_bias", {"id": 3, "value": 60}) and race.cars[3].car_setup.bias == 60,
		"race brake bias changes immediately"
	)
	check(
		not race.command("brake_bias", {"id": 3, "value": 60.5}),
		"fractional brake bias is rejected"
	)
	for mode in ["patient", "balanced", "assertive"]:
		check(race.command("battle_mode", {"id": 3, "value": mode}), "racecraft accepts " + mode)
	check(
		not race.command("battle_mode", {"id": 3, "value": "teleport"}),
		"unknown tactics are rejected"
	)
	var a = RaceSim.new(h.geometries[7])
	var b = RaceSim.new(h.geometries[7])
	a.cars[3].car_setup.cooling = 1
	b.cars[3].car_setup.cooling = 9
	for model in [a, b]:
		model.phase = "race"
		model.cars[3].speed = 55
	for i in range(200):
		a.wear_car(a.cars[3], 2.75, 0)
		b.wear_car(b.cars[3], 2.75, 0)
	check(
		a.cars[3].engine_temperature > b.cars[3].engine_temperature,
		"cooling aperture changes thermal evolution"
	)


func continuation_equivalent(a: Variant, b: Variant) -> bool:
	return preload("res://tests/support/state_comparison.gd").equivalent(
		a, b, 0.0000001, true, true
	)


func test_continuation_comparison() -> void:
	check(
		continuation_equivalent(0, 0.0000001) and continuation_equivalent(0, 0.0),
		"continuation accepts mixed numeric types at the inclusive original tolerance"
	)
	check(
		continuation_equivalent(0.0, 0.00000005) and not continuation_equivalent(0.0, 0.0000002),
		"continuation retains its original numeric boundary"
	)
	check(
		continuation_equivalent(
			{"rows": [{"state": "race", "fuel": 0}]},
			{"rows": [{"state": "race", "fuel": 0.0000001}]}
		),
		"continuation applies numeric tolerance recursively"
	)
	check(
		not continuation_equivalent({"rows": [{"state": "race"}]}, {"rows": [{"state": &"race"}]}),
		"continuation rejects equal-text values of different nonnumeric types recursively"
	)
	check(
		(
			not continuation_equivalent([0], [0, 0])
			and not continuation_equivalent({"fuel": 0}, {"tyre": 0})
		),
		"continuation rejects changed collection shape and keys"
	)
	var sim = h.blank_race(h.geometries[7])
	var original = sim.cars[3]
	var restored = original.detached_copy()
	check(
		original != restored and continuation_equivalent([original], [restored]),
		"continuation compares detached entrants by serialized state"
	)
	restored.fuel += 1.0
	check(
		not continuation_equivalent([original], [restored]),
		"continuation rejects a sporting difference in detached entrants"
	)


func test_continuation() -> void:
	var sim = h.blank_race(h.geometries[7], {"laps": 6, "intensity": "calm"})
	h.ticks(sim, 250)
	sim.command("brake_bias", {"id": 3, "value": 59})
	sim.command("battle_mode", {"id": 3, "value": "patient"})
	var data = sim.snapshot()
	var restored = RaceSim.restore(JSON.parse_string(JSON.stringify(data, "", true, true)))
	check(data.version == 4 and restored != null, "version 4 stores wheel, setup and tactic state")
	if restored:
		h.ticks(sim, 150)
		h.ticks(restored, 150)
		check(
			(
				continuation_equivalent(sim.cars, restored.cars)
				and sim.rng_state == restored.rng_state
			),
			"per-wheel JSON continuation preserves numeric tolerance and RNG"
		)
	for mutation in [
		func(d): d.cars[3].tyre_sets[0].wheels.erase("FL"),
		func(d): d.cars[3].tyre_sets[0].wheels.FL.pressure = -2,
		func(d): d.cars[3].tyre_sets[0].wheels.FL.punctured = "yes",
		func(d): d.cars[3].tyre_sets[0].wheels.FL.life = 101,
		func(d): d.cars[3].tyre_sets[0].heat_cycles = 1.2,
		func(d): d.cars[3].tyre_sets[0].heated = 7,
		func(d): d.cars[3].car_setup.wing = 4.5,
		func(d): d.cars[3].car_setup.bias = 65,
		func(d): d.cars[3].battle_mode = "bad",
		func(d): d.cars[3].engine_temperature = INF
	]:
		var invalid = data.duplicate(true)
		mutation.call(invalid)
		check(RaceSim.restore(invalid) == null, "malformed wheel/setup checkpoint rejected")
	var old = data.duplicate(true)
	old.version = 3
	for car in old.cars:
		for key in [
			"car_setup",
			"battle_mode",
			"engine_temperature",
			"brake_temperature",
			"tyre_event_clock"
		]:
			car.erase(key)
		for item in car.tyre_sets:
			for key in ["wheels", "heat_cycles", "heated"]:
				item.erase(key)
	var migrated = RaceSim.restore(JSON.parse_string(JSON.stringify(old, "", true, true)))
	check(migrated != null, "genuine aggregate v3 checkpoint migrates")
	if migrated:
		h.near(migrated.cars[3].tyre, old.cars[3].tyre, 0.00001, "v3 tread is preserved")
		check(
			(
				migrated.cars[3].car_setup.wing == old.cars[3].setup
				and migrated.cars[3].car_setup.bias == 56
			),
			"legacy wing retained; missing setup has explicit defaults"
		)
		check(
			mounted(migrated).wheels.FL.life == mounted(migrated).wheels.FR.life,
			"unrecorded historic wheel asymmetry is not invented"
		)
