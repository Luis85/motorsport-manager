extends SceneTree
## Production environment loading, compiled parameters and old/new frozen checkpoints.
var checks = 0
var failures: Array[String] = []
var catalog: ContentCatalog
var track: TrackGeometry
const GROUPS = ["weather", "surface", "weather_forecast"]
const ROOT = "user://environment-content-proof"

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		print("ENVIRONMENT_FAILURE ", message)

func near(a: float, b: float, message: String) -> void:
	check(absf(a - b) < 0.000001, message)

func run() -> void:
	var loaded = ContentPackLoader.new().load_packs(["res://content/packs/core"])
	check(loaded.ok, "The complete core environment loads through the production validator")
	if not loaded.ok:
		print(JSON.stringify(loaded)); finish(); return
	catalog = loaded.catalog
	track = TrackGeometry.new(Storage.read_json("res://data/tracks/hillside.json").data)
	validation()
	compatibility()
	weather_and_forecasts()
	surface_models()
	external_freezing()
	finish()

func validation() -> void:
	var source = catalog.tuning("core.race_tuning.default").to_record()
	var schema = ContentSchema.definition("race_tuning")
	for group in GROUPS:
		var item = source.duplicate(true)
		item[group] = []
		check(RaceTuningDefinition.from_record(item) == null, "Wrong group type fails closed: " + group)
		item = source.duplicate(true); item[group]["unused_boost"] = 1
		check(RaceTuningDefinition.from_record(item) == null, "Unsupported fields fail closed: " + group)
		for field in source[group]:
			item = source.duplicate(true)
			item[group][field] = schema.properties[group].properties[field].maximum + 1
			check(RaceTuningDefinition.from_record(item) == null, "Upper field bound: " + group + "/" + field)
			item = source.duplicate(true)
			item[group].erase(field)
			check(RaceTuningDefinition.from_record(item) == null, "A present group cannot guess a missing field: " + group + "/" + field)
	for changes in [
		{"weather": {"wet_target_base": 0.9, "wet_target_span": 0.9}},
		{"weather": {"target_base_seconds": 500.0, "target_jitter_seconds": 500.0}},
		{"weather": {"training_heavy_from": 0.9}},
		{"weather": {"training_dry_at_seconds": 5.0}},
		{"surface": {"initial_dust": 1.0, "edge_dust_per_lane": 0.3}},
		{"surface": {"minimum_grip": 1.0, "maximum_grip": 0.2}},
		{"surface": {"evaporation_reference_c": 79.0}},
		{"surface": {"maximum_temperature_c": 10.0}},
		{"weather_forecast": {"minimum_horizon_seconds": 600.0, "maximum_horizon_seconds": 100.0}},
		{"weather_forecast": {"dry_water_limit": 0.9, "wet_water_limit": 0.1}},
		{"weather_forecast": {"minimum_trend_seconds": 200.0}},
		{"weather_forecast": {"arrival_low_floor_seconds": 100.0, "arrival_high_floor_seconds": 20.0}}
	]:
		var item = source.duplicate(true)
		for group in changes: item[group].merge(changes[group], true)
		check(RaceTuningDefinition.from_record(item) == null, "Interdependent parameter constraints: " + str(changes))

	var invalid = source.duplicate(true)
	invalid.weather.target_base_seconds = 500.0; invalid.weather.target_jitter_seconds = 500.0
	var candidate = ContentCatalog.new()
	for kind in ContentSchema.KINDS:
		for item in catalog.entries(kind):
			candidate.add(invalid if item.id == source.id else item, {"root": ROOT, "file": "weather.json", "pack": "local.environment"})
	var diagnostics = candidate.seal()
	check(not diagnostics.is_empty() and diagnostics[0].field == "/weather/target_jitter_seconds" and diagnostics[0].file == "weather.json", "Interdependent failures retain an actionable field and source file")

func compatibility() -> void:
	var source = catalog.tuning("core.race_tuning.default").to_record()
	for group in GROUPS: source.erase(group)
	var prior = RaceTuningDefinition.from_record(source)
	check(prior != null, "The previous five-group v1 record remains supported")
	if prior == null: return
	check(prior.view() == LegacyRaceTuning.VALUES, "Omitted groups resolve immutable historical values, not editable core files")
	check(prior.to_record() == source and prior.fingerprint == RaceStateValue.fingerprint(source), "Resolving compatible defaults does not rewrite old record identity")
	var original = WeatherRaceSim.new(track, {"tuning_definition": source, "scenario": "changeable", "seed": 913})
	var baseline = WeatherRaceSim.new(track, {"scenario": "changeable", "seed": 913})
	check(original.command("qualify") and baseline.command("qualify"), "Both compatibility inputs start the real qualifying lifecycle")
	check(original.command("send", {"id": 3}) and baseline.command("send", {"id": 3}), "Both compatibility inputs release the same car")
	for tick in range(600): original.step(); baseline.step()
	var saved = original.snapshot(); saved.erase("tuning_definition")
	check(RaceRecord.equivalent(saved, baseline.snapshot()), "Old authored input preserves 600 seeded steps, surface and both RNGs")
	var restored = WeatherRaceSim.restore_weather(JSON.parse_string(JSON.stringify(original.snapshot(), "", true, true)))
	check(restored != null and RaceRecord.equivalent(restored.snapshot(), original.snapshot()), "Old authored checkpoint restores without adding fields to its tuning identity")

func changed_definition() -> Dictionary:
	var source = catalog.tuning("core.race_tuning.default").to_record()
	source.id = "local.environment.race_tuning.storm"
	source.name = "Long front / wet surface"
	source.weather.wet_initial_cloud = 0.8
	source.weather.wet_initial_rain = 0.4
	source.weather.wet_initial_water = 0.7
	source.weather.target_base_seconds = 300.0
	source.weather.target_jitter_seconds = 0.0
	source.weather.cloud_response_per_second = 0.0
	source.weather.observation_interval_seconds = 2.0
	source.weather_forecast.review_interval_seconds = 40.0
	source.weather_forecast.horizon_laps = 1.0
	source.weather_forecast.minimum_horizon_seconds = 20.0
	source.weather_forecast.maximum_horizon_seconds = 90.0
	source.weather_forecast.dry_water_limit = 0.2
	source.weather_forecast.damp_water_limit = 0.5
	source.surface.base_grip = 0.75
	source.surface.maximum_grip = 0.95
	source.surface.initial_dust = 0.2
	return source

func weather_and_forecasts() -> void:
	var source = changed_definition()
	var tuning = RaceTuningDefinition.from_record(source)
	check(tuning != null, "An expanded environment profile validates without production-code changes")
	if tuning == null: return
	var model = WeekendWeather.create(123, "wet", "seeded", tuning.weather)
	near(model.rain, 0.4, "Authored initial rain reaches the weather process")
	near(model.remaining, 300, "Transition duration above the legacy 145 seconds is represented")
	check(WeekendWeather.valid(model, tuning.weather) and not WeekendWeather.valid(model), "Checkpoint validation derives duration from the correct frozen model")
	var rng = model.rng
	for tick in range(50): WeekendWeather.advance(model, "wet", RaceSim.STEP, tuning.weather)
	near(model.cloud, 0.8, "A zero cloud response actually holds the cloud state")
	check(model.rng == rng, "No transition draw occurs before the configured deadline")
	var sim = WeatherRaceSim.new(track, {"tuning_definition": source, "scenario": "wet", "seed": 123})
	near(sim.water[0], 0.7, "The authored initial water reaches the same surface used by cars")
	near(sim.surface[0].lanes[3].dust, 0.2, "The authored initial deposit reaches the physical surface")
	check(sim.command("qualify"), "The environment fixture advances through a real phase command")
	for tick in range(120): sim.step()
	check(sim.weather_state.history.size() >= 3, "The configured observation cadence produces measured samples")
	var observation = sim.weather_outlook()
	near(observation.horizon_seconds, clampf(track.estimate, 20, 90), "The public forecast uses the configured reference-lap horizon")
	check(observation.condition == WeatherOutlook.condition(observation.observed.mean, tuning.weather_forecast), "The UI label uses the same public threshold contract")
	var before = sim.snapshot()
	sim.weather_advice(sim.player_ids()[0])
	check(RaceRecord.equivalent(before, sim.snapshot()), "Forecasting consumes neither random stream and cannot mutate the race")
	sim.weather_state.model.target = 0.03; sim.weather_state.model.rng = 42
	check(observation == sim.weather_outlook(), "Configured forecasts still cannot observe secret targets or RNG")
	var query = RaceChartQuery.new(sim).surface("grip", 0, 3)
	near(query.cell.grip, RaceSurface.grip(sim.surface[0].lanes[3], tuning.surface), "Surface inspector reports the actual tuned grip")
	var grid = RaceVisualSource.new(sim).surface_values("grip")
	near(grid[0][3], query.cell.grip / tuning.surface.maximum_grip, "Grip overlay uses the same tuned model and normalization")
	check(RaceSurface.valid(sim.surface, sim.water, sim.rubber), "Running surface remains inside the serialized physical bounds")
	sim.weather_state.reviews[3] = sim.total_time + 40
	check(WeatherRaceSim.valid_weather(sim.weather_state, sim.total_time, sim.rain, sim.cars.size(), tuning.weather, tuning.weather_forecast), "Restoration supports the configured public-policy review interval")

func surface_models() -> void:
	var water: Array = []; water.resize(96); water.fill(0.0)
	var rubber: Array = []; rubber.resize(96); rubber.fill(0.0)
	var p = SurfaceTuning.DEFAULTS.duplicate(true)
	var base = RaceSurface.create(track, water, rubber, p)
	var wet = base.duplicate(true)
	p.rain_collection_rate *= 2
	RaceSurface.evolve(base, 0.7, 0.25, 0)
	RaceSurface.evolve(wet, 0.7, 0.25, 0, p)
	check(wet[0].lanes[3].water > base[0].lanes[3].water, "Authored collection rate changes measured water accumulation")
	var column: Dictionary = wet[0].duplicate(true)
	column.lanes[3].water = 0.8; column.lanes[2].water = 0.1
	var before = 0.0
	for cell in column.lanes: before += cell.water
	p.lateral_exchange_rate = 0.2; p.camber_flow_gain = 1.0; p.water_flow_gain = 1.0
	RaceSurface.runoff(column, 0.25, p)
	var after = 0.0
	for cell in column.lanes: after += cell.water
	near(before, after, "Changing runoff coefficients does not bypass pairwise water conservation")
	var first = RaceSurface.create(track, water, rubber)
	var second = first.duplicate(true)
	var car = RaceSim.new(track).cars[3]
	p = SurfaceTuning.DEFAULTS.duplicate(true); p.rubber_deposit *= 2
	RaceSurface.deposit(first, track.length, car, 0, 10, 0)
	RaceSurface.deposit(second, track.length, car, 0, 10, 0, p)
	check(second[0].lanes[3].rubber > first[0].lanes[3].rubber, "Authored tyre deposition changes the real field")
	p.incident_oil_deposit = 0.2
	RaceSurface.contaminate(second, 0, 0, 0.2, true, p)
	near(second[0].lanes[3].oil, 0.2, "Incident contamination consumes configured oil quantity")

func external_freezing() -> void:
	var source = changed_definition()
	Storage.write_json(ROOT + "/pack.json", {"kind": "motorsport-manager-content-pack", "schema_version": 1,
		"id": "local.environment", "version": "1", "runtime_contract": 1,
		"dependencies": [{"id": "core", "version": "1.0.0"}], "files": ["weather.json"], "overrides": []})
	Storage.write_json(ROOT + "/weather.json", source)
	var loaded = ContentPackLoader.new().load_packs(["res://content/packs/core", ROOT])
	check(loaded.ok, "A file-only environment expansion is accepted by the production loader")
	if not loaded.ok: return
	var launch = WeekendLaunch.new(loaded.catalog)
	check(launch.stage(track.document, {"laps": 2, "race_tuning_id": source.id, "scenario": "wet", "weather_mode": "seeded"}, "core.vehicle.formula"), "The real weekend launch resolves the environment profile")
	var sim = PracticeRaceSim.new(track, launch.session_options())
	check(sim.command("practice_start"), "The launched profile enters real practice")
	var recorder = RaceRecord.new(); recorder.attach(sim)
	for tick in range(150): sim.step()
	var saved = recorder.seal(); recorder.detach()
	check(RaceRecord.validate(saved).is_empty(), "The active environment weekend produces a valid frozen replay envelope")
	var expected = sim.snapshot()
	DirAccess.remove_absolute(ProjectSettings.globalize_path(ROOT + "/weather.json"))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(ROOT + "/pack.json"))
	var restored = ReplayStorage.restore_session(JSON.parse_string(JSON.stringify({"kind": ReplayStorage.SESSION_KIND, "version": 1, "record": saved}, "", true, true)))
	check(restored.ok, "The complete environment restores after source files have been deleted: " + str(restored.get("error", "")))
	if restored.ok:
		check(RaceRecord.equivalent(expected, restored.sim.snapshot()), "Deleted-source restore retains exact environment state and definition")
		for tick in range(200): sim.step(); restored.sim.step()
		check(RaceRecord.equivalent(sim.snapshot(), restored.sim.snapshot()), "Continued restored practice keeps surface, weather and both RNGs equivalent")
		restored.record.detach()
	var corrupted = expected.duplicate(true)
	corrupted.tuning_definition.weather.target_base_seconds = 10
	corrupted.tuning_definition.weather.target_jitter_seconds = 0
	check(PracticeRaceSim.restore_practice(corrupted) == null, "A shorter substituted transition definition cannot validate a longer saved transition")

func finish() -> void:
	var result = {"passed": failures.is_empty(), "checks": checks, "failures": failures}
	Storage.write_json("res://reports/content-environment-tests.json", result)
	print("CONTENT_ENVIRONMENT_TESTS ", JSON.stringify(result))
	quit(0 if failures.is_empty() else 1)
