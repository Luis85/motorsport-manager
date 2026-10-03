extends SceneTree
## Frozen authored inputs, real commands and isolated model probes. No golden rewrites.
const ROOTS = ["res://content/packs/core", "res://content/examples/club-racing"]
const PRESET = "local.club.weekend.sprint"
const TUNING = "local.club.race_tuning.sprint"
var checks = 0
var failures: Array[String] = []


class Store:
	extends WeekendEntryStore
	var saved: Dictionary

	func save_record(record: RaceRecord) -> String:
		saved = record.seal()
		return RaceRecord.validate(saved)


func _initialize() -> void:
	call_deferred("run")


func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		print("TUNING_FAILURE ", message)


func near(a: float, b: float, message: String) -> void:
	check(absf(a - b) < 0.000001, message)


func run() -> void:
	var loaded = ContentPackLoader.new().load_packs(ROOTS)
	check(loaded.ok, "All authored configurations validate through production loader")
	if not loaded.ok:
		print(JSON.stringify(loaded))
		finish()
		return
	var catalog: ContentCatalog = loaded.catalog
	var document = Storage.read_json("res://data/tracks/hillside.json").data
	var track = TrackGeometry.new(document)
	validation(catalog)
	default_equivalence(catalog, track)
	model_inputs(catalog, track)
	repair_receipts(catalog, track)
	launch_and_restore(catalog, document)
	preload("res://tests/support/content_duration_contracts.gd").run(check, catalog, document)
	finish()


func validation(catalog: ContentCatalog) -> void:
	var standard = catalog.tuning("core.race_tuning.default")
	var original_tables = standard.view()
	original_tables.erase("environment")
	original_tables.erase("operations")
	original_tables.erase("competition")
	check(
		standard != null and original_tables == LegacyRaceTuning.VALUES,
		"External defaults exactly preserve the compatibility coefficient tables"
	)
	check(
		(
			catalog.weekend("core.weekend.standard") != null
			and catalog.weekend("core.weekend.quick") != null
			and catalog.weekend(PRESET) != null
			and catalog.weekend("local.club.weekend.strategy_sprint") != null
		),
		"Original and additional weekends remain available solely through manifest content"
	)
	var source = standard.to_record()
	for group in LegacyRaceTuning.VALUES:
		for field in source[group]:
			var changed = source.duplicate(true)
			changed[group][field] = true
			check(
				RaceTuningDefinition.from_record(changed) == null,
				"Wrong type rejected: " + group + "/" + field
			)
	var changed = source.duplicate(true)
	changed.fuel.engine_rates = [0.9, 0.8, 1.1]
	check(RaceTuningDefinition.from_record(changed) == null, "Mode arrays require documented order")
	changed = source.duplicate(true)
	changed.pace.speed_modes.append(1.1)
	check(
		RaceTuningDefinition.from_record(changed) == null,
		"A fourth mode cannot silently invent a behavior"
	)
	changed = source.duplicate(true)
	changed.model = "eval(user-code)"
	check(
		RaceTuningDefinition.from_record(changed) == null,
		"Authored tuning cannot execute a new model"
	)
	changed = source.duplicate(true)
	changed.fuel.unused_bonus = 1
	check(
		RaceTuningDefinition.from_record(changed) == null,
		"Unsupported field is rejected rather than ignored"
	)
	changed = source.duplicate(true)
	changed.service.repair_seconds_per_damage = 1
	check(
		RaceTuningDefinition.from_record(changed) == null,
		"Combined service coefficients cannot exceed the saved-duration safety limit"
	)
	changed = source.duplicate(true)
	changed.condition.engine_base_c = 120
	changed.condition.engine_mode_c = 15
	changed.condition.cooling_reference = 9
	changed.condition.cooling_c = 5
	changed.condition.throttle_c = 20
	check(
		RaceTuningDefinition.from_record(changed) == null,
		"Thermal endpoint validation rejects a combination above the supported temperature bound"
	)
	var view = standard.view()
	view.fuel.engine_rates[0] = 999
	check(
		standard.fuel.engine_rates[0] == 0.84,
		"Detached forecast values cannot mutate the running definition"
	)
	var broken = catalog.record(PRESET)
	broken.race_tuning_id = "missing.race_tuning"
	var candidate = ContentCatalog.new()
	for kind in ContentSchema.KINDS:
		for item in catalog.entries(kind):
			candidate.add(
				broken if item.id == PRESET else item,
				{"file": "test.json", "root": "test", "pack": "test"}
			)
	var errors = candidate.seal()
	check(
		not errors.is_empty() and errors[0].field == "/race_tuning_id",
		"Broken preset reference reports its exact field before catalog activation"
	)


func default_equivalence(catalog: ContentCatalog, track: TrackGeometry) -> void:
	var options = {"laps": 4, "scenario": "dry", "intensity": "calm", "seed": 7314}
	var original = RaceSim.new(track, options)
	options.tuning_definition = catalog.tuning("core.race_tuning.default").to_record()
	var extracted = RaceSim.new(track, options)
	check(
		original.command("qualify") and extracted.command("qualify"),
		"Both baseline configurations start qualifying through commands"
	)
	check(
		original.command("send", {"id": 3}) and extracted.command("send", {"id": 3}),
		"Both baseline configurations release the same driver"
	)
	for tick in range(500):
		original.step()
		extracted.step()
	var snapshot = extracted.snapshot()
	snapshot.erase("tuning_definition")
	check(
		RaceRecord.equivalent(original.snapshot(), snapshot),
		"Five hundred default fixed steps preserve every field and the RNG after only removing content metadata"
	)


func model_inputs(catalog: ContentCatalog, track: TrackGeometry) -> void:
	var record = catalog.tuning(TUNING).to_record()
	var sim = RaceSim.new(
		track, {"laps": 8, "scenario": "dry", "intensity": "calm", "tuning_definition": record}
	)
	var car = sim.cars[3]
	near(car.fuel, 8 * 1.2 + 3, "Initial fuel uses authored load and reserve")
	check(
		sim.command("qualify") and sim.command("send", {"id": 3}),
		"Physical qualifying release remains legal"
	)
	near(
		car.fuel, sim.tuning.fuel.qualifying_load_laps, "Qualifying receives its own authored load"
	)
	# Explicit isolated resource probe, not a claim of a completed lap or result.
	sim.phase = "race"
	car.engine = 2
	car.fuel = 10.0
	car.engine_temperature = 90.0
	var before = car.fuel
	sim.wear_car(car, track.length * 0.02, 0)
	near(before - car.fuel, 0.02 * 1.05, "Runtime consumes the authored attack-mode rate")
	sim.phase = "formation"
	before = car.fuel
	sim.wear_car(car, track.length * 0.02, 0)
	near(
		before - car.fuel,
		0.02 * sim.tuning.fuel.reduced_rate,
		"Formation consumes the same rate included in fuel forecasts"
	)
	sim.phase = "race"
	car.damage = 0.0
	car.repair = true
	var seed = sim.rng_state
	var expected_seed = (1664525 * seed + 1013904223) & 0xffffffff
	sim.begin_service(car)
	near(car.pit_timer, 6.0, "Physical tyre service uses the authored base and zero jitter")
	check(
		sim.rng_state == expected_seed,
		"Zero jitter preserves one service RNG draw rather than reshuffling future outcomes"
	)
	var snapshot = RaceForecaster.capture(sim, 3)
	snapshot.teammate = {}
	var prediction = RaceForecaster.pit_prediction(snapshot)
	near(
		prediction.visit,
		track.pit_length / track.pit_limit + 6.0 + 3.0,
		"Pit forecast derives service duration from the same authored inputs"
	)
	var live = sim.snapshot()
	RaceForecaster.evaluate(snapshot)
	check(
		RaceRecord.equivalent(live, sim.snapshot()),
		"Forecasting leaves all authoritative values and RNG unchanged"
	)
	var second = record.duplicate(true)
	second.service.tyre_base_seconds = 7
	var other = RaceSim.new(
		track, {"tuning_definition": second, "laps": 8, "scenario": "dry", "intensity": "calm"}
	)
	check(
		sim.tuning.fingerprint != other.tuning.fingerprint,
		"Changing tuning under the same ID changes the frozen fingerprint"
	)
	var practice = PracticeRaceSim.new(
		track, {"tuning_definition": record, "scenario": "dry", "intensity": "calm"}
	)
	check(practice.command("practice_start"), "Real practice starts with authored tuning")
	var plan = {
		"laps": 1,
		"objective": "tyre_life",
		"baseline": "current",
		"set_id": practice.cars[3].set_id
	}
	var preview = practice.run_preview(3, plan)
	check(preview.available, "Practice run is feasible before approval")
	if preview.available:
		check(
			practice.command(
				"practice_run",
				{
					"id": 3,
					"plan": plan,
					"key": preview.key,
					"time": preview.time,
					"revision": preview.revision
				}
			),
			"Practice approval uses the normal recorded command"
		)
		near(
			practice.cars[3].fuel,
			preview.fuel,
			"Displayed practice fuel and actual released fuel are identical"
		)


func repair_receipts(catalog: ContentCatalog, track: TrackGeometry) -> void:
	var record = catalog.tuning(TUNING).to_record()
	record.service.repair_seconds_per_damage = 0.16
	var tuning = RaceTuningDefinition.from_record(record)
	check(tuning != null, "A valid authored repair rate above the legacy bound is accepted")
	if tuning == null:
		return
	var sim = RecoveryRaceSim.new(
		track, {"tuning_definition": record, "scenario": "dry", "intensity": "calm"}
	)
	var car = sim.cars[3]
	# Deliberate service-boundary fixture; physical routing is covered by recovery_tests.
	car.route = "pit"
	car.pit_stage = "service"
	car.damage = 900.0
	car.repair = true
	sim.begin_service(car)
	near(
		sim.reliability(3).service.repair_seconds,
		144.0,
		"Frozen receipt uses the approved tuning, not the legacy 140-second maximum"
	)
	check(
		RaceReliability.valid(sim.reliability_state, sim.cars, sim.total_time, tuning),
		"Service state validates using its frozen repair rate"
	)
	check(
		RecoveryRaceSim.valid_recovery_records(sim.strategy_state.records, tuning),
		"Recorded service evidence accepts the same authored repair rate"
	)
	var changed = sim.reliability_state.duplicate(true)
	changed.drivers[3].service.repair_seconds -= 1
	check(
		not RaceReliability.valid(changed, sim.cars, sim.total_time, tuning),
		"A changed service receipt cannot misstate approved repair work"
	)
	var records = sim.strategy_state.records.duplicate(true)
	for entry in records:
		if entry.kind == "recovery_service" and entry.evidence.stage == "started":
			entry.evidence.job.repair_seconds -= 1
	check(
		not RecoveryRaceSim.valid_recovery_records(records, tuning),
		"A changed journal receipt cannot misstate approved repair work"
	)


func launch_and_restore(catalog: ContentCatalog, document: Dictionary) -> void:
	document.grid.count = 14
	var launch = WeekendLaunch.new(catalog)
	check(
		launch.stage_preset(PRESET, document),
		"File-only weekend resolves its complete dependency set"
	)
	var options = launch.session_options()
	check(
		options.weekend_definition.id == PRESET and options.tuning_definition.id == TUNING,
		"Launch freezes named preset and tuning records"
	)
	check(
		(
			options.weather_mode == "scripted_training"
			and options.rival_styles == false
			and options.tactical_duels == false
		),
		"No supported preset settings are silently dropped"
	)
	for bad in [
		{"weather_mode": "oracle"},
		{"rival_styles": 1},
		{"tactical_duels": "false"},
		{"race_tuning_id": "missing.tuning"},
		{"unsupported": 1}
	]:
		check(
			not launch.stage_preset(PRESET, document, bad) and options == launch.session_options(),
			"Invalid preset edit preserves the last valid draft: " + str(bad)
		)
	var store = Store.new()
	var committed = launch.commit(int(launch.capture().revision), store)
	check(
		committed.ok,
		(
			"Production practice/save path accepts the authored weekend: "
			+ str(committed.get("error", ""))
		)
	)
	if not committed.ok:
		return
	var sim: RaceSim = committed.simulation
	check(
		sim.cars.size() == 14 and sim.player_ids() == [12, 13],
		"Preset preserves independent roster ownership"
	)
	check(
		(
			sim.weather_state.model.mode == "scripted_training"
			and not sim.rival_styles.enabled
			and not sim.duel_state.enabled
		),
		"The actual installed mechanics respect preset modes"
	)
	near(sim.cars[12].fuel, 12.6, "Authored eight-lap starting fuel reaches the launched entrant")
	var endpoint = sim.snapshot()
	var restored = PracticeRaceSim.restore_practice(
		JSON.parse_string(JSON.stringify(endpoint, "", true, true))
	)
	check(restored != null, "Restore requires no source pack or catalog")
	if restored != null:
		check(
			RaceRecord.equivalent(endpoint, restored.snapshot()),
			"Frozen tuning, preset, RNG and mutable state round-trip exactly"
		)
		if sim.paused:
			sim.command("pause")
			restored.command("pause")
		for tick in range(120):
			sim.step()
			restored.step()
		check(
			RaceRecord.equivalent(sim.snapshot(), restored.snapshot()),
			"Saved and continued sessions use identical frozen inputs"
		)
	var sealed = committed.record.seal()
	check(
		RaceRecord.validate(sealed).is_empty(),
		"Replay seal includes the transitive tuning and weekend definitions"
	)
	var tampered = endpoint.duplicate(true)
	tampered.tuning_definition.service.tyre_base_seconds = -1
	check(
		PracticeRaceSim.restore_practice(tampered) == null, "Invalid tuning cannot enter via a save"
	)
	tampered = endpoint.duplicate(true)
	tampered.weekend_definition.race_tuning_id = "other.tuning"
	check(
		PracticeRaceSim.restore_practice(tampered) == null,
		"A mismatched root reference cannot enter via a save"
	)
	tampered = endpoint.duplicate(true)
	tampered.weekend_definition.settings.rival_styles = true
	check(
		PracticeRaceSim.restore_practice(tampered) == null,
		"Preset provenance cannot misrepresent installed rival behavior"
	)
	tampered = sealed.duplicate(true)
	tampered.endpoint.tuning_definition.service.tyre_base_seconds += 1
	tampered.erase("digest")
	tampered.digest = RaceRecord.fingerprint(tampered)
	check(
		not RaceRecord.validate(tampered).is_empty(),
		"Recomputing envelope digest cannot alter tuning partway through a replay"
	)
	committed.record.detach()


func finish() -> void:
	var result = {"passed": failures.is_empty(), "checks": checks, "failures": failures}
	Storage.write_json("res://reports/content-tuning-tests.json", result)
	print("CONTENT_TUNING_TESTS ", JSON.stringify(result))
	quit(0 if failures.is_empty() else 1)
