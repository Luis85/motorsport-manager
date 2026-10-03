extends SceneTree
## Operating coefficients consume frozen data; engine bounds and four-wheel topology stay fixed.
var checks = 0
var failures: Array[String] = []


func _initialize() -> void:
	call_deferred("run")


func check(value: bool, label: String) -> void:
	checks += 1
	if not value:
		failures.append(label)
		print("WHEEL_OPERATING_FAILURE ", label)


func item(temperature: float = 65.0) -> Dictionary:
	var value = {"compound": "M", "life": 100.0, "temperature": temperature, "laps": 0.0}
	WheelTyres.initialize(value)
	return value


func inputs() -> Dictionary:
	return {
		"speed": 65.0,
		"curve": 0.02,
		"bias": 0.65,
		"brake": 1.0,
		"throttle": 0.8,
		"slip": 2.0,
		"neutral": false,
		"push": 2,
		"water": 0.0,
		"care": 50.0,
		"wear": 0.1,
		"lap": 0.01
	}


func run() -> void:
	var loaded = ContentPackLoader.new().load_packs(["res://config"])
	check(loaded.ok, "Core operating limits compile")
	if not loaded.ok:
		finish()
		return
	var catalog: ContentCatalog = loaded.catalog
	var rules = catalog.tyres("core.tyre_allocation.default")
	var medium = rules.spec("core.tyre.medium")
	check(not medium.is_empty(), "Resolve the shipped medium compound")
	if medium.is_empty():
		finish()
		return
	check(
		medium.operating == TyreOperatingSchema.LEGACY,
		"Shipped settings preserve all previous operating coefficients"
	)
	var legacy = RaceTyreRules.legacy().spec("M").duplicate(true)
	var old_api = legacy.duplicate(true)
	old_api.erase("operating")
	var left = item()
	var right = item()
	for step in range(100):
		WheelTyres.update(left, inputs(), RaceSim.STEP, old_api)
		WheelTyres.update(right, inputs(), RaceSim.STEP, legacy)
	check(
		left == right,
		"Old direct spec and explicit legacy operating values remain bit-for-bit identical"
	)
	var variants = {
		"moving_threshold_mps": 10.0,
		"reference_brake_bias": 0.7,
		"corner_saturation": 0.2,
		"slide_saturation": 0.2,
		"minimum_load": 1.2,
		"maximum_load": 1.1,
		"minimum_pressure": 0.99,
		"maximum_pressure": 1.05,
		"surface_limit_c": 170.0,
		"core_limit_c": 120.0,
		"lockup_front_bias": 0.7
	}
	for field in variants:
		var selected = legacy.duplicate(true)
		selected.operating[field] = variants[field]
		check(
			TyreOperatingSchema.valid(selected.operating), "Supported operating variation " + field
		)
		var temperature = (
			20.0
			if field == "minimum_pressure"
			else (180.0 if field == "surface_limit_c" else 140.0)
		)
		left = item(temperature)
		right = item(temperature)
		var input = inputs()
		if field == "moving_threshold_mps":
			input.speed = 5.0
		if field == "lockup_front_bias":
			WheelTyres.lockup(left, 0.6, 10, legacy)
			WheelTyres.lockup(right, 0.6, 10, selected)
		else:
			WheelTyres.update(left, input, RaceSim.STEP, legacy)
			WheelTyres.update(right, input, RaceSim.STEP, selected)
		check(left != right, "Actual wheel calculation consumes " + field)
		check(
			WheelTyres.valid(right),
			"Changed operating values stay inside checkpoint bounds: " + field
		)
	var frozen = rules.to_snapshot()
	invalid_operating_records(frozen)
	var old = frozen.duplicate(true)
	for thermal in old.thermal_profiles:
		thermal.erase("operating")
	var old_rules = RaceTyreRules.from_snapshot(old)
	check(
		old_rules != null and old_rules.to_snapshot() == old,
		"Old frozen records are not rewritten with new optional fields"
	)
	if old_rules != null:
		check(
			old_rules.spec("core.tyre.medium").operating == TyreOperatingSchema.LEGACY,
			"Omitted operating block selects the exact compatibility values"
		)
	var authored = frozen.duplicate(true)
	authored.thermal_profiles[0].operating.maximum_pressure = 1.1
	var geometry = TrackGeometry.new(
		Storage.read_json("res://config/circuits/hillside.json").data, "Formula"
	)
	var sim = PracticeRaceSim.new(geometry, {"laps": 4, "tyre_definition": authored})
	check(
		sim.last_error.is_empty() and sim.command("practice_start"),
		"A new session receives authored wheel operating data"
	)
	for step in range(100):
		sim.step()
	var restored = PracticeRaceSim.restore_practice(sim.snapshot())
	check(
		restored != null and RaceRecord.equivalent(sim.snapshot(), restored.snapshot()),
		"Optional operating data restores with the saved session"
	)
	if restored != null:
		for step in range(100):
			sim.step()
			restored.step()
		check(
			RaceRecord.equivalent(sim.snapshot(), restored.snapshot()),
			"Frozen wheel settings continue exactly after restoration"
		)
	var forecast = RaceForecaster.capture(sim, int(sim.player_ids()[0]))
	check(
		forecast.tyre_context.compounds["core.tyre.medium"].operating.maximum_pressure == 1.1,
		"Forecast and simulation share the same compiled operating block"
	)
	finish()


func finish() -> void:
	var result = {"passed": failures.is_empty(), "checks": checks, "failures": failures}
	Storage.write_json("res://reports/content-wheel-operating-tests.json", result)
	print("CONTENT_WHEEL_OPERATING_TESTS ", JSON.stringify(result))
	quit(0 if failures.is_empty() else 1)


func invalid_operating_records(frozen: Dictionary) -> void:
	for problem in [
		"reversed_load", "excess_temperature", "pressure", "boolean", "missing", "unknown"
	]:
		var invalid = frozen.duplicate(true)
		var operating: Dictionary = invalid.thermal_profiles[0].operating
		match problem:
			"reversed_load":
				operating.minimum_load = 2.0
			"excess_temperature":
				operating.core_limit_c = 190.0
			"pressure":
				operating.maximum_pressure = 3.0
			"boolean":
				operating.moving_threshold_mps = true
			"missing":
				operating.erase("slide_saturation")
			"unknown":
				operating.script = "anything.gd"
		check(
			RaceTyreRules.from_snapshot(invalid) == null,
			"Invalid wheel operating record fails closed: " + problem
		)
