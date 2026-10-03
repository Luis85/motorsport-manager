extends SceneTree
## Changed-policy probes and real command/restore continuation. Original golden suites stay intact.
var checks = 0
var failures: Array[String] = []
var geometry: TrackGeometry


func _initialize() -> void:
	call_deferred("run")


func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		print("PLANNING_BALANCE_FAILURE ", message)


func near(a: float, b: float, message: String) -> void:
	check(absf(a - b) < 0.000001, message)


func tuning_record(with_balance: bool = true) -> Dictionary:
	var record = LegacyRaceTuning.VALUES.duplicate(true)
	record.merge(
		{
			"kind": "race_tuning",
			"schema_version": 1,
			"id": "test.race_tuning.planning",
			"name": "Planning model probe",
			"description": "Bounded native test configuration.",
			"model": "path-race-v1"
		}
	)
	if with_balance:
		record.balance = GameBalanceSchema.defaults()
	return record


func run() -> void:
	var loaded = Storage.read_json(
		ContentPackLoader.BUILTIN_ROOT.path_join("circuits/hillside.json")
	)
	check(loaded.ok, "Planning fixture reads the circuit from the sole config root")
	if not loaded.ok:
		quit(1)
		return
	geometry = TrackGeometry.new(loaded.data)
	validation()
	baseline()
	practice_and_drafts()
	forecast_inputs()
	frozen_continuation()
	var result = {"passed": failures.is_empty(), "checks": checks, "failures": failures}
	Storage.write_json("res://reports/content-planning-balance-tests.json", result)
	print("CONTENT_PLANNING_BALANCE_TESTS ", JSON.stringify(result))
	quit(0 if failures.is_empty() else 1)


func validation() -> void:
	var record = tuning_record()
	check(RaceTuningDefinition.from_record(record) != null, "Complete planning balance validates")
	for group in RacePlanningBalance.TABLES:
		for field in RacePlanningBalance.TABLES[group]:
			var broken = record.duplicate(true)
			broken.balance[group][field] = true
			check(
				RaceTuningDefinition.from_record(broken) == null,
				"Planning scalar type remains strict: " + group + "/" + field
			)
		var partial = record.duplicate(true)
		partial.balance[group].erase(RacePlanningBalance.TABLES[group].keys()[0])
		check(
			RaceTuningDefinition.from_record(partial) == null,
			"A supplied balance cannot omit a field in " + group
		)
	var broken = record.duplicate(true)
	broken.balance.forecast.high_risk_tread = 30
	broken.balance.forecast.moderate_risk_tread = 20
	check(RaceTuningDefinition.from_record(broken) == null, "Risk bands must be ordered")
	broken = record.duplicate(true)
	broken.balance.forecast.performance_top_weight = 0.5
	check(RaceTuningDefinition.from_record(broken) == null, "Capability weights must sum to one")
	broken = record.duplicate(true)
	broken.balance.practice.prior_reliable_uncertainty = 0.2
	check(
		RaceTuningDefinition.from_record(broken) == null,
		"Reliable uncertainty cannot exceed baseline"
	)
	broken = record.duplicate(true)
	broken.balance.forecast.maximum_age_seconds = 6
	check(
		RaceTuningDefinition.from_record(broken) == null, "Config cannot relax command expiry bound"
	)


func baseline() -> void:
	var old_record = tuning_record(false)
	var old_definition = RaceTuningDefinition.from_record(old_record)
	check(
		old_definition.to_record() == old_record,
		"Omitted historical balance keeps its record shape"
	)
	check(
		old_definition.balance.practice == RacePlanningBalance.defaults().practice,
		"Omitted balance resolves the frozen practice baseline"
	)
	var original = RaceSim.new(geometry, {"laps": 4, "scenario": "dry", "seed": 7314})
	var extracted = RaceSim.new(
		geometry, {"laps": 4, "scenario": "dry", "seed": 7314, "tuning_definition": tuning_record()}
	)
	check(original.command("qualify") and extracted.command("qualify"), "Both baselines qualify")
	check(
		original.command("send", {"id": 3}) and extracted.command("send", {"id": 3}),
		"Both baselines release through the physical command"
	)
	for tick in range(500):
		original.step()
		extracted.step()
	var authored = extracted.snapshot()
	authored.erase("tuning_definition")
	check(
		RaceRecord.equivalent(original.snapshot(), authored),
		"Complete default balance preserves five hundred physical steps and RNG exactly"
	)


func practice_and_drafts() -> void:
	var record = tuning_record()
	record.balance.practice.release_offset_seconds = 20
	record.balance.practice.release_spacing_seconds = 2
	record.balance.practice.run_return_allowance_seconds = 30
	record.balance.practice.qualifying_pace = 0
	record.balance.practice.qualifying_engine = 0
	record.balance.practice.prior_sample_weight = 1
	record.balance.strategy_defaults.balanced_stop_fraction = 0.3
	record.balance.strategy_defaults.tyre_reserve = 35
	record.balance.strategy_defaults.fuel_reserve_laps = 1.0
	record.balance.tactical_policy.initial_stop_fraction = 0.3
	record.balance.tactical_policy.tyre_floor = 30
	var sim = PracticeRaceSim.new(geometry, {"laps": 24, "tuning_definition": record})
	near(
		sim.practice_driver(3).next_release,
		26,
		"Autonomous practice timing uses selected coefficients"
	)
	var draft = RaceViewQuery.new(sim).strategy_draft(sim.cars[3].to_record(), sim.laps)
	check(
		draft.stops[0].from_lap == 7 and draft.tyre_reserve == 35 and draft.fuel_reserve == 1,
		"Production draft query uses frozen strategy defaults"
	)
	check(not sim.cars[3].pit_order, "Draft policy does not create a pit command")
	var tactic = TacticalForecast.draft(sim, 3)
	check(
		tactic.from_lap == 7 and tactic.tyre_floor == 30 and tactic.fuel_reserve == 1,
		"Tactical suggestions share authored fuel reserve and selected tactic thresholds"
	)
	var c = sim.cars[3]
	var sample_state = PracticeEvidence.create(sim.cars, 600)
	sample_state.drivers[3].runs.append(
		{
			"compound": c.compound,
			"setup": c.car_setup,
			"pace": c.pace,
			"engine": c.engine,
			"samples":
			[
				{
					"clean": true,
					"water": 0,
					"health": c.health,
					"damage": c.damage,
					"wear_ratio": 2.0,
					"model_ratio": 1.1
				}
			]
		}
	)
	var legacy_prior = PracticeEvidence.prior(sample_state, c, 0)
	var authored_prior = PracticeEvidence.prior(sample_state, c, 0, sim.tuning.balance.practice)
	near(
		legacy_prior[c.compound].wear_factor,
		1.2,
		"Direct prior API retains its legacy sample weight"
	)
	near(
		authored_prior[c.compound].wear_factor, 1.5, "Selected evidence blend changes forecast wear"
	)
	check(sim.command("practice_start"), "Practice starts through its authoritative command")
	var plan = {"laps": 1, "objective": "qualifying", "baseline": "current", "set_id": c.set_id}
	var preview = sim.run_preview(3, plan)
	near(
		preview.duration,
		geometry.estimate / 0.70 * 3 + geometry.pit_length / geometry.pit_limit + 30,
		"Practice preview uses its selected physical-return allowance"
	)
	check(
		sim.command(
			"practice_run",
			{
				"id": 3,
				"plan": plan,
				"key": preview.key,
				"time": preview.time,
				"revision": preview.revision
			}
		),
		"Approved practice run remains a real recorded command"
	)
	check(c.pace == 0 and c.engine == 0, "Practice objective modes consume selected policy")


func forecast_inputs() -> void:
	var record = tuning_record()
	record.balance.forecast.high_risk_tread = 25
	record.balance.forecast.moderate_risk_tread = 35
	record.balance.forecast.traffic_seconds_per_car = 1.6
	record.balance.forecast.base_uncertainty = 0.1
	record.balance.forecast.performance_top_weight = 1.0
	record.balance.forecast.performance_accel_weight = 0.0
	record.balance.forecast.performance_lat_weight = 0.0
	record.balance.forecast.performance_brake_weight = 0.0
	var sim = PracticeRaceSim.new(geometry, {"laps": 8, "tuning_definition": record})
	sim.phase = "race"
	var source = RaceForecaster.capture(sim, 3)
	source.teammate = {}
	source.public = []
	var start = RaceForecaster.set_by_id(source, source.own.starting_set)
	for key in WheelTyres.KEYS:
		start.wheels[key].life = 20
	WheelTyres.publish(start)
	var before = sim.snapshot()
	var predicted = RaceForecaster.evaluate_candidate(source, "current", "Current", [])
	check(predicted.risk == "high", "Selected remaining-stint bands affect ordinary forecast risk")
	check(
		RaceRecord.equivalent(before, sim.snapshot()),
		"Changed forecasting policy remains observational and consumes no RNG"
	)
	var profile = RacePerformanceProfile.build({"top": 1000})
	near(
		RacePerformanceProfile.forecast_lap_factor(profile, sim.tuning.balance.forecast),
		1.0 / 1.1,
		"Selected upgrade weights change the coarse forecast without changing bounded capability"
	)
	var item = RaceForecaster.replacement(source)
	var stop = {"at": source.gate.distance / source.length, "set_id": item.id}
	var empty_prediction = RaceForecaster.pit_prediction(source)
	var velocity = source.length / source.reference_lap
	source.public.append(
		{
			"dnf": false,
			"finished": false,
			"short": "OBS",
			"lap_seconds": source.reference_lap,
			"distance":
			(
				empty_prediction.exit_station
				- velocity * (empty_prediction.entry_eta + empty_prediction.visit)
			)
		}
	)
	var traffic = RaceForecaster.evaluate_candidate(source, "stop", "Stop", [stop])
	near(
		traffic.traffic_cost,
		1.6,
		"Selected traffic allowance is consumed by ordinary stint evaluation"
	)
	var old_key = source.key
	var changed = record.duplicate(true)
	changed.balance.forecast.traffic_seconds_per_car = 1
	var other = PracticeRaceSim.new(geometry, {"laps": 8, "tuning_definition": changed})
	other.phase = "race"
	check(
		old_key != RaceForecaster.material_key(other, 3),
		"Balance coefficients participate in strategy material identity"
	)


func frozen_continuation() -> void:
	var record = tuning_record()
	record.balance.practice.release_offset_seconds = 12
	record.balance.practice.run_return_allowance_seconds = 20
	var sim = PracticeRaceSim.new(geometry, {"laps": 8, "seed": 113, "tuning_definition": record})
	var observer = RaceRecord.new()
	observer.attach(sim)
	check(sim.command("practice_start"), "Frozen continuation starts physical practice")
	var plan = {
		"laps": 1, "objective": "tyre_life", "baseline": "current", "set_id": sim.cars[3].set_id
	}
	var preview = sim.run_preview(3, plan)
	check(
		sim.command(
			"practice_run",
			{
				"id": 3,
				"plan": plan,
				"key": preview.key,
				"time": preview.time,
				"revision": preview.revision
			}
		),
		"Frozen continuation approves a driver-owned physical run"
	)
	for tick in range(240):
		sim.step()
	var checkpoint = sim.snapshot()
	var restored = PracticeRaceSim.restore_practice(checkpoint)
	check(restored != null, "Balance-bearing moving checkpoint restores without source files")
	record.balance.practice.run_return_allowance_seconds = 100
	near(
		sim.tuning.balance.practice.run_return_allowance_seconds,
		20,
		"Source edits cannot mutate selected rules"
	)
	if restored != null:
		for tick in range(120):
			sim.step()
			restored.step()
		check(
			RaceRecord.equivalent(sim.snapshot(), restored.snapshot()),
			"Restored continuation retains exact frozen planning rules, physical state and RNG"
		)
	var replay = observer.seal()
	check(RaceRecord.validate(replay).is_empty(), "Replay seals the frozen balance dependency")
	replay.endpoint.tuning_definition.balance.practice.run_return_allowance_seconds = 30
	replay.erase("digest")
	replay.digest = RaceRecord.fingerprint(replay)
	check(
		not RaceRecord.validate(replay).is_empty(),
		"Recomputed replay digest cannot authorize a mid-recording balance change"
	)
	observer.detach()
