extends SceneTree
## Repeatable same-engine workload, not an FPS guarantee or a substitute for native UI profiling.
const STEPS = 1000
const REPEATS = 3
const EXTRA_VEHICLES = 500
var checks = 0
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, message: String) -> void:
	checks += 1
	if not value: failures.append(message)

func run() -> void:
	var start = Time.get_ticks_usec()
	var loaded = ContentPackLoader.new().load_packs(["res://content/packs/core"])
	check(loaded.ok, "Benchmark requires a validated core catalog")
	if not loaded.ok: quit(1); return
	var small: ContentCatalog = loaded.catalog
	var load_ms = (Time.get_ticks_usec() - start) / 1000.0
	start = Time.get_ticks_usec()
	var large = ContentCatalog.new()
	for kind in ContentSchema.KINDS:
		for record in small.entries(kind): large.add(record, {"pack": "benchmark"})
	var vehicle = small.entries("vehicle")[0]
	for index in range(EXTRA_VEHICLES):
		var copy = vehicle.duplicate(true); copy.id = "benchmark.vehicle.preset_" + str(index)
		check(large.add(copy, {"pack": "benchmark"}).is_empty(), "Additional valid content compiles")
	check(large.seal().is_empty(), "Expanded catalog validates as a whole")
	var prepare_ms = (Time.get_ticks_usec() - start) / 1000.0
	var geometry = TrackGeometry.new(Storage.read_json("res://data/tracks/hillside.json").data)
	var timings = {"legacy": [], "authored": [], "expanded_catalog": []}
	var hashes: Dictionary = {}
	# Rotate run order across repetitions to reduce a systematic warm-up/order advantage.
	var kinds = ["legacy", "authored", "expanded_catalog"]
	for repeat in range(REPEATS):
		for offset in range(kinds.size()):
			var kind: String = kinds[(offset + repeat) % kinds.size()]
			var options = {"laps": 100, "scenario": "dry", "intensity": "calm", "seed": 7314}
			if kind != "legacy":
				options.tuning_definition = (large if kind == "expanded_catalog" else small).tuning("core.race_tuning.default").to_record()
			var sim = RaceSim.new(geometry, options)
			# Deliberately specified race-state fixture: never described as a played weekend.
			sim.phase = "race"; sim.paused = false; sim.clock = 10; sim.race_time = 10
			for car in sim.cars:
				car.route = "track"; car.distance = geometry.length * 0.25 - car.id * 12
				car.speed = 20; car.fuel = 100
			for step in range(100): sim.step()
			start = Time.get_ticks_usec()
			for step in range(STEPS): sim.step()
			timings[kind].append((Time.get_ticks_usec() - start) / 1000.0)
			var snapshot = sim.snapshot(); snapshot.erase("tuning_definition")
			hashes[kind] = RaceStateValue.fingerprint(snapshot)
	check(hashes.legacy == hashes.authored and hashes.authored == hashes.expanded_catalog, "Unused definitions cannot change fixed-step outcome or RNG")
	var medians: Dictionary = {}
	for kind in timings:
		var values = timings[kind].duplicate(); values.sort(); medians[kind] = values[REPEATS / 2]
	var report = {"passed": failures.is_empty(), "checks": checks, "failures": failures,
		"engine": Engine.get_version_info().string, "cpu": OS.get_processor_name(), "processors": OS.get_processor_count(),
		"steps": STEPS, "repeats": REPEATS, "cars": 12, "additional_unused_vehicles": EXTRA_VEHICLES,
		"core_load_ms": load_ms, "expanded_catalog_prepare_ms": prepare_ms,
		"milliseconds": timings, "median_ms": medians, "state_hashes": hashes,
		"scope": "Native headless 12-car fixed-step fixture on this machine; timings are measurements, not cross-machine thresholds. Catalog preparation is outside measured stepping. No rendering/FPS or human usability claim."}
	Storage.write_json("res://reports/content-performance-tests.json", report)
	print("CONTENT_PERFORMANCE_TESTS ", JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
