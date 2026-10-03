extends SceneTree
## Environment authoring, frozen continuation and pre-refactor numerical characterization.
const CORE = "core.race_tuning.default"
const ROOT = "user://environment-content-tests"
var checks = 0
var failures: Array[String] = []


class Store:
	extends WeekendEntryStore

	func save_record(record: RaceRecord) -> String:
		return RaceRecord.validate(record.seal())


func _initialize() -> void:
	call_deferred("run")


func check(value: bool, description: String) -> void:
	checks += 1
	if not value:
		failures.append(description)
		print("ENVIRONMENT_FAILURE ", description)


func near(a: float, b: float, description: String) -> void:
	check(absf(a - b) < 0.000001, description)


func run() -> void:
	var loaded = ContentPackLoader.new().load_packs(["res://config"])
	check(loaded.ok, "Bundled environment validates through the production loader")
	if not loaded.ok:
		print(JSON.stringify(loaded))
		finish()
		return
	var catalog: ContentCatalog = loaded.catalog
	var record = catalog.record(CORE)
	var document = Storage.read_json("res://config/circuits/hillside.json").data
	var track = TrackGeometry.new(document)
	validation(record)
	characterization(track, record)
	consumers(track, record)
	publication(catalog, document)
	finish()


func validation(record: Dictionary) -> void:
	var definition = RaceTuningDefinition.from_record(record)
	check(
		definition.environment == LegacyEnvironment.VALUES,
		"Every bundled environment default is numerically the frozen prior value"
	)
	check(
		(
			definition.environment.is_read_only()
			and definition.environment.surface.grip.is_read_only()
		),
		"Nested environment inputs are immutable"
	)
	var old = record.duplicate(true)
	old.erase("environment")
	var legacy_record = RaceTuningDefinition.from_record(old)
	check(
		legacy_record != null and legacy_record.to_record() == old,
		"Old v1 records are not rewritten when loading the optional environment extension"
	)
	check(
		(
			legacy_record.environment == LegacyEnvironment.VALUES
			and not legacy_record.view().has("environment")
		),
		"Missing environment uses immutable compatibility values, not current installed content"
	)
	invalid_fields(record, EnvironmentTuningSchema.LIMITS, [])
	var edits = [
		["weather", "target_wet_base", 1.0],
		["weather", "transition_span_seconds", 144.0],
		["training", "wet_dry_seconds", 10.0],
		["training", "changeable_heavy_end", 0.99],
		["surface", "initial", "dust_per_strip", 0.33],
		["surface", "grip", "maximum", 0.5],
		["surface", "evolution", "rain_minimum", 2.0],
		["surface", "evolution", "evaporation_base", 0.0],
		["surface", "contact", "temperature_limit_c", 1.0],
		["outlook", "condition_dry", 0.9],
		["outlook", "minimum_trend_seconds", 60.0],
		["outlook", "horizon_maximum_seconds", 10.0],
		["outlook", "arrival_high_maximum_seconds", 10.0],
		["outlook", "arrival_cloud_slope", 0.0001],
		["weather_policy", "safe_tread", 99.0]
	]
	for edit in edits:
		var changed = record.duplicate(true)
		var path = edit.slice(0, edit.size() - 1)
		put(changed.environment, path, edit.back())
		if path == ["surface", "grip", "maximum"]:
			changed.environment.surface.grip.minimum = 0.8
		check(
			RaceTuningDefinition.from_record(changed) == null,
			"Cross-field physical constraint rejects " + str(path)
		)
	var bad = record.duplicate(true)
	bad.environment.model = "load-script"
	check(
		RaceTuningDefinition.from_record(bad) == null,
		"A new executable environment model cannot be introduced by data"
	)
	bad = record.duplicate(true)
	bad.environment.surface.unused_bonus = 1
	check(
		RaceTuningDefinition.from_record(bad) == null,
		"Unknown nested tuning is rejected rather than silently ignored"
	)
	bad = record.duplicate(true)
	bad.environment.erase("outlook")
	check(
		RaceTuningDefinition.from_record(bad) == null,
		"An explicit environment cannot partially inherit mutable installed defaults"
	)


func invalid_fields(record: Dictionary, limits: Dictionary, path: Array) -> void:
	for key in limits:
		var child = path + [key]
		if limits[key] is Dictionary:
			invalid_fields(record, limits[key], child)
			continue
		for invalid in [true, float(limits[key][0]) - 1, float(limits[key][1]) + 1]:
			var changed = record.duplicate(true)
			put(changed.environment, child, invalid)
			check(
				RaceTuningDefinition.from_record(changed) == null,
				"Type/range rejection at /environment/" + "/".join(child)
			)


func put(value: Dictionary, path: Array, replacement: Variant) -> void:
	var current = value
	for index in range(path.size() - 1):
		current = current[path[index]]
	current[path.back()] = replacement


func characterization(track: TrackGeometry, record: Dictionary) -> void:
	var fixture = (
		Storage.read_json("res://tests/fixtures/environment-v1-characterization.json").data
	)
	check(
		fixture.source_commit == "177aa7911fbf0c614ec0885ab770cd436673dea4",
		"Characterization was captured before environment extraction"
	)
	var expected: Dictionary = fixture.values
	var environment = RaceTuningDefinition.from_record(record).environment
	for scenario in ["dry", "wet", "changeable"]:
		var weather = WeekendWeather.create(7314, scenario, "seeded", environment.weather)
		var states: Array = [weather.duplicate(true)]
		for tick in range(5000):
			WeekendWeather.advance(weather, scenario, RaceSim.STEP, environment.weather)
			if tick in [0, 499, 999, 2499, 4999]:
				states.append(weather.duplicate(true))
		check(
			RaceRecord.equivalent(states, expected[scenario]),
			"Exact prior 250-second weather trajectory and RNG: " + scenario
		)
	var sim = RaceSim.new(
		track, {"scenario": "wet", "intensity": "calm", "tuning_definition": record}
	)
	check(
		RaceStateValue.fingerprint(sim.surface) == expected.surface_initial,
		"Original surface initial-state hash is unchanged"
	)
	for tick in range(80):
		RaceSurface.evolve(
			sim.surface, 0.4, RaceSurface.INTERVAL, tick * RaceSurface.INTERVAL, environment.surface
		)
	check(
		RaceStateValue.fingerprint(sim.surface) == expected.surface_evolved,
		"Original surface evolution hash is unchanged"
	)
	RaceSurface.deposit(
		sim.surface, track.length, sim.cars[3], 10.0, 450.0, 0.1, environment.surface
	)
	check(
		RaceStateValue.fingerprint(sim.surface) == expected.surface_contact,
		"Original contact-deposit hash is unchanged"
	)
	RaceSurface.contaminate(sim.surface, 0.2, 0.0, 0.2, true, environment.surface.incident)
	check(
		RaceStateValue.fingerprint(sim.surface) == expected.surface_contaminated,
		"Original incident contamination hash is unchanged"
	)
	near(
		RaceSurface.grip(sim.surface[22].lanes[3], environment.surface.grip),
		expected.grip,
		"Original grip output is unchanged"
	)
	var observed = WeekendWeather.observe(sim.surface, 0.4, 0.5, 100.0)
	var past = observed.duplicate(true)
	past.time = 70.0
	past.mean -= 0.03
	past.cloud -= 0.06
	var outlook = WeatherOutlook.evaluate(
		[past], observed, track.estimate, "seeded", environment.outlook
	)
	outlook.erase("condition")
	outlook.erase("sector_conditions")
	check(
		RaceRecord.equivalent(outlook, expected.outlook),
		"Default public forecasts preserve previous cases, arrival, trend and key"
	)
	var training = WeekendWeather.training("wet", "race", 200, 1000, environment.training)
	near(training.rain, 0.18, "Original training easing value is retained")
	training = WeekendWeather.training("changeable", "race", 320, 1000, environment.training)
	near(training.rain, 0.2, "Exclusive training window boundary remains exclusive")


func consumers(track: TrackGeometry, record: Dictionary) -> void:
	var changed = record.duplicate(true)
	changed.environment.weather.initial_cloud_wet = 0.1
	changed.environment.weather.initial_rain_wet = 0.0
	changed.environment.weather.target_wet_base = 1.0
	changed.environment.weather.target_wet_span = 0.0
	changed.environment.weather.cloud_response_per_second = 0.02
	changed.environment.surface.initial.wet_water = 0.4
	changed.environment.surface.grip.base = 0.8
	changed.environment.outlook.horizon_laps = 1.0
	var sim = WeatherRaceSim.new(
		track, {"scenario": "wet", "intensity": "calm", "tuning_definition": changed}
	)
	near(sim.weather_state.model.cloud, 0.1, "Actual weather install uses external initial cloud")
	near(sim.rain, 0.0, "Actual weather install uses external initial rain")
	near(sim.average(sim.water), 0.4, "Actual initial surface uses external water")
	var normal = WeekendWeather.create(7314, "wet")
	check(
		normal.rng == sim.weather_state.model.rng,
		"Zero target jitter does not skip the preserved random draw"
	)
	var old_rng = sim.rng_state
	for tick in range(20):
		sim.update_surface()
	near(
		sim.weather_state.model.cloud,
		0.12,
		"Real mechanic advances cloud at the external per-second response"
	)
	check(sim.rng_state == old_rng, "Weather does not consume the race/service random stream")
	var before = sim.snapshot()
	var reading = RaceChartQuery.new(sim).surface("grip", 0, 3)
	near(
		reading.cell.grip,
		RaceSurface.grip(sim.surface[0].lanes[3], sim.tuning.environment.surface.grip),
		"Surface inspector uses the actual tuned grip function"
	)
	near(
		reading.values[0][3],
		reading.cell.grip / sim.tuning.environment.surface.grip.maximum,
		"Grip overlay uses the same tuned function and normalization"
	)
	var sample = sim.surface_at(sim.cars[3])
	var raw = sample.duplicate(true)
	raw.erase("grip")
	near(
		sample.grip,
		RaceSurface.grip(raw, sim.tuning.environment.surface.grip),
		"Runtime contact grip uses frozen environment tuning"
	)
	var outlook = sim.weather_outlook()
	near(
		outlook.horizon_seconds,
		clampf(track.estimate, 60, 240),
		"Public forecast uses authored time horizon"
	)
	check(
		RaceRecord.equivalent(before, sim.snapshot()),
		"Reading forecasts and surface overlays leaves all state and RNG unchanged"
	)
	sim.weather_state.model.target = 0.8
	sim.weather_state.model.rng = 12345
	check(
		sim.weather_outlook() == outlook,
		"Changing hidden target and RNG cannot change an observation-only outlook"
	)
	var column = sim.surface[0].duplicate(true)
	for index in range(7):
		column.lanes[index].water = 1.0 if index % 2 == 0 else 0.0
	var original_water = 0.0
	for lane in column.lanes:
		original_water += lane.water
	var runoff = sim.tuning.environment.surface.runoff.duplicate(true)
	runoff.diffusion_per_second = 1.0
	runoff.advection_per_second = 1.0
	for tick in range(20):
		RaceSurface.runoff(column, 5.0, runoff)
	var after_water = 0.0
	for lane in column.lanes:
		after_water += lane.water
		check(
			lane.water >= 0 and lane.water <= 1, "Extreme permitted runoff keeps every cell bounded"
		)
	near(
		after_water, original_water, "Extreme runoff remains conservative across adjacent exchanges"
	)
	var public_rules = sim.tuning.environment.outlook.duplicate(true)
	public_rules.condition_dry = 0.2
	var labels = WeatherOutlook.evaluate(
		[],
		{"time": 0, "rain": 0, "cloud": 0.1, "mean": 0.1, "peak": 0.1, "sectors": [0.1, 0.2, 0.3]},
		90,
		"seeded",
		public_rules
	)
	check(
		labels.condition == "dry" and labels.sector_conditions == ["dry", "damp", "wet"],
		"Presentation labels come from the same public calibration"
	)
	var alternative = WeatherOutlook.evaluate([], labels.observed, 90, "seeded")
	check(
		labels.key != alternative.key,
		"Different public calibration invalidates a forecast key without reading a hidden target"
	)
	# Frozen own-private crossover parameters, not direct access to a process record.
	var forecast = RaceForecaster.capture(sim, 3)
	var plan = WeatherStrategy.candidate(forecast, outlook, "current", "Current", [])
	forecast.tuning_context.environment.weather_policy.model_allowance_seconds = 9.0
	var wider = WeatherStrategy.candidate(forecast, outlook, "current", "Current", [])
	near(
		wider.high - plan.high, 6.0, "Crossover model consumes the configured uncertainty allowance"
	)


func publication(catalog: ContentCatalog, document: Dictionary) -> void:
	var app = root.get_node("App")
	var record = catalog.record(CORE)
	record.environment.weather.cloud_response_per_second = 0.01
	record.environment.surface.evolution.water_drainage = 0.002
	var manifest = {
		"kind": "motorsport-manager-content-pack",
		"schema_version": 1,
		"id": "test.environment",
		"version": "1.0.0",
		"runtime_contract": 1,
		"dependencies": [{"id": "core", "version": "1.0.0"}],
		"files": ["tuning.json"],
		"overrides": [{"id": CORE, "expected_sha256": catalog.explain(CORE).source.sha256}]
	}
	check(
		(
			Storage.write_json(ROOT + "/pack.json", manifest).is_empty()
			and Storage.write_json(ROOT + "/tuning.json", record).is_empty()
		),
		"External environment pack is authored through files only"
	)
	check(
		app.reload_content([ROOT]), "Production catalog activates the whole valid environment pack"
	)
	var accepted: ContentCatalog = app.content_catalog
	var launch = WeekendLaunch.new(accepted)
	check(
		launch.stage_preset(
			"core.weekend.standard",
			document,
			{"scenario": "wet", "weather_mode": "seeded", "intensity": "calm"}
		),
		"Real weekend launch resolves external environment tuning"
	)
	var committed = launch.commit(int(launch.capture().revision), Store.new())
	check(
		committed.ok,
		(
			"Production checkpoint validation accepts the complete launch: "
			+ str(committed.get("error", ""))
		)
	)
	if not committed.ok:
		return
	var sim: RaceSim = committed.simulation
	if sim.paused:
		sim.command("pause")
	for tick in range(240):
		sim.step()
	var snapshot = JSON.parse_string(JSON.stringify(sim.snapshot(), "", true, true))
	var broken = record.duplicate(true)
	broken.environment.weather.target_wet_base = 1.0
	Storage.write_json(ROOT + "/tuning.json", broken)
	check(
		not app.reload_content([ROOT]) and app.content_catalog == accepted,
		"An impossible external environment cannot partly replace the accepted catalog"
	)
	check(
		app.content_diagnostics[0].field == "/environment/weather/target_wet_span",
		"Cross-field rejection identifies the actionable file field"
	)
	check(
		(
			app.content_diagnostics[0].file == "tuning.json"
			and app.content_diagnostics[0].entity == CORE
		),
		"Semantic rejection retains file and definition provenance"
	)
	DirAccess.remove_absolute(ProjectSettings.globalize_path(ROOT + "/tuning.json"))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(ROOT + "/pack.json"))
	check(app.reload_content([]), "The core catalog recovers after removing the external pack")
	var restored = PracticeRaceSim.restore_practice(snapshot)
	check(restored != null, "JSON save restores after the source pack is removed")
	if restored != null:
		near(
			restored.tuning.environment.weather.cloud_response_per_second,
			0.01,
			"Saved definition wins over currently installed defaults"
		)
		near(
			app.content_catalog.tuning(CORE).environment.weather.cloud_response_per_second,
			0.005,
			"New sessions see the current catalog rather than the old session's override"
		)
		check(
			RaceRecord.equivalent(restored.snapshot(), sim.snapshot()),
			"All weather/surface state, RNG and content metadata round-trip exactly"
		)
		for tick in range(160):
			sim.step()
			restored.step()
		check(
			RaceRecord.equivalent(sim.snapshot(), restored.snapshot()),
			"Continued live and restored sessions remain identical with no source files"
		)
	var sealed = committed.record.seal()
	check(
		RaceRecord.validate(sealed).is_empty(),
		"Replay envelope retains the complete frozen environment dependency"
	)
	var tampered = sealed.duplicate(true)
	tampered.endpoint.tuning_definition.environment.surface.grip.base += 0.01
	tampered.erase("digest")
	tampered.digest = RaceRecord.fingerprint(tampered)
	check(
		not RaceRecord.validate(tampered).is_empty(),
		"Recomputed envelope digest cannot change the environment within a replay"
	)
	tampered = sim.snapshot()
	tampered.tuning_definition.environment.outlook.history_seconds = 0
	check(
		PracticeRaceSim.restore_practice(tampered) == null,
		"Invalid nested environmental settings are rejected on save restoration"
	)
	var legacy = catalog.record(CORE)
	legacy.erase("environment")
	var old_sim = WeatherRaceSim.new(
		TrackGeometry.new(document),
		{"scenario": "wet", "intensity": "calm", "tuning_definition": legacy}
	)
	var old_save = old_sim.snapshot()
	var old_restore = WeatherRaceSim.restore_weather(old_save)
	check(
		old_restore != null and RaceRecord.equivalent(old_save, old_restore.snapshot()),
		"Pre-extension authored saves retain their original metadata and behavior"
	)
	committed.record.detach()


func finish() -> void:
	var result = {"passed": failures.is_empty(), "checks": checks, "failures": failures}
	Storage.write_json("res://reports/content-environment-tests.json", result)
	print("CONTENT_ENVIRONMENT_TESTS ", JSON.stringify(result))
	quit(0 if failures.is_empty() else 1)
