extends "res://tests/support/content_operations_contracts.gd"


func run() -> void:
	var loaded = ContentPackLoader.new().load_packs(
		["res://config", "res://content/examples/club-racing"]
	)
	check(loaded.ok, "All bundled and example operations definitions validate")
	if not loaded.ok:
		print(JSON.stringify(loaded))
		finish()
		return
	var catalog: ContentCatalog = loaded.catalog
	var record = catalog.record(CORE)
	var document = Storage.read_json("res://config/circuits/hillside.json").data
	geometry = TrackGeometry.new(document)
	validation(record)
	characterization(record)
	consumers(record)
	publication(catalog, document)
	roster_debrief(catalog)
	finish()


func consumers(record: Dictionary) -> void:
	var tuned = record.duplicate(true)
	tuned.service.repair_seconds_per_damage = 0.05
	tuned.operations.reliability.damage_warning = 2
	tuned.operations.reliability.damage_degraded = 4
	tuned.operations.reliability.damage_critical = 9
	tuned.operations.reliability.fault_threshold_base = 200
	tuned.operations.reliability.fault_threshold_span = 0
	tuned.operations.reliability.terminal_threshold_base = 300
	tuned.operations.reliability.terminal_threshold_span = 0
	tuned.operations.reliability.default_repair_budget_seconds = 3
	tuned.operations.reliability.repair_minimum_tread = 70
	tuned.operations.control.virtual_pace_factor = 0.45
	tuned.operations.control.ending_seconds = 11
	tuned.operations.control.local_yellow_speed_mps = 19
	tuned.operations.control.local_incident_seconds = 21
	tuned.operations.control.retired_car_seconds = 44
	tuned.operations.incidents.barrier_probability = 0
	tuned.operations.incidents.lost_seconds_base = 4
	tuned.operations.incidents.lost_seconds_span = 0
	tuned.operations.incidents.damage_base = 7
	tuned.operations.incidents.damage_span = 0
	tuned.operations.incidents.tread_loss = 3
	var sim = fixture(tuned)
	var c = sim.cars[3]
	var r = sim.reliability(3)
	near(r.fault_threshold, 200, "Install uses the external scalar-fault threshold")
	near(r.terminal_threshold, 300, "Install uses the external terminal threshold")
	near(r.repair_budget, 3, "Initial work budget follows authored content")
	check(
		r.emergency == "advise",
		"A larger or smaller authored budget does not grant player emergency authority"
	)
	var legacy_rng = RaceReliability.create(sim.cars, 7314).drivers[3].rng
	check(r.rng == legacy_rng, "Zero threshold spans retain their original random draws")
	c.damage = 10
	sim.observe_reliability(c)
	check(
		(
			r.stage == "critical"
			and (
				(
					RaceViewQuery
					. new(sim)
					. reliability_observation(c.to_record(), r.duplicate(true))
					. stage
				)
				== "critical"
			)
		),
		"Runtime and detached UI share authored condition thresholds"
	)
	var before = sim.snapshot()
	var advice = sim.recovery_advice(3)
	near(
		advice.repair_seconds,
		0.5,
		"Repair-work display uses actual selected service calibration, not legacy 0.14"
	)
	check(
		advice.repair_available,
		"A sound fitted tyre qualifies for the authored repair-only minimum"
	)
	check(
		RaceRecord.equivalent(before, sim.snapshot()),
		"Recovery comparisons do not alter resources, policies, journal or RNG"
	)
	r.rng = 123
	r.fault_threshold = 200
	r.terminal_threshold = 300
	sim.weather_state.model.target = 0.99
	check(
		sim.recovery_advice(3) == advice,
		"Hidden fault RNG/thresholds and future weather do not enter recovery advice"
	)
	sim.engineer(c)
	check(
		not c.pit_order and r.emergency == "advise",
		"Critical author-defined damage cannot fall through to a legacy automatic stop"
	)
	var fitted = TyreInventory.find(c, c.set_id)
	fitted.wheels.FL.life = 69
	WheelTyres.publish(fitted)
	c.tyre = fitted.life
	c.temperature = fitted.temperature
	TyreInventory.sync(c)
	check(
		not sim.recovery_advice(3).repair_available,
		"Limiting wheel below the selected repair threshold blocks repair-only service"
	)
	fitted.wheels.FL.life = 80
	WheelTyres.publish(fitted)
	c.tyre = fitted.life
	c.temperature = fitted.temperature
	TyreInventory.sync(c)
	var life_before = fitted.life
	var race_rng = sim.rng_state
	var weather_rng = sim.weather_state.model.rng
	sim.incident(c)
	near(c.damage, 17, "Non-terminal incident applies authored scalar damage")
	near(c.loss, 4, "Non-terminal incident applies authored time loss")
	near(
		TyreInventory.find(c, c.set_id).life,
		life_before - 3,
		"Incident spends the retained fitted wheel life"
	)
	check(
		sim.control_state.pending[0].duration == 21 and sim.control_state.state == "green",
		"Clearance is authored but still queued before the next field step"
	)
	check(
		sim.rng_state != race_rng and sim.weather_state.model.rng == weather_rng,
		"Driving draw consumption does not consume weather randomness"
	)
	sim.update_flags()
	near(
		sim.neutral_speed_limit(c, {"speed": 70}),
		19,
		"Local-yellow runtime target uses the selected speed cap"
	)
	sim.retire(sim.cars[0], "Fixture on-track retirement")
	check(
		sim.control_state.pending[0].duration == 44,
		"An actual retirement queues the authored virtual clearance interval"
	)
	sim.update_flags()
	near(
		sim.neutral_speed_limit(c, {"speed": 70}),
		31.5,
		"Virtual runtime target uses 45 percent of the reference envelope"
	)
	near(
		sim.forecast_parameters(3).neutral_factor,
		0.45,
		"Forecast uses the same virtual pace factor"
	)
	var public = RaceViewQuery.new(sim).control_observation()
	near(public.pace_factor, 0.45, "Detached race-control panel exposes the actual selected rule")
	check(
		(
			"45%" in public.rules
			and "11 simulated seconds" in public.rules
			and "19 m/s" in public.rules
		),
		"Rule explanation never advertises the old 60 percent, eight seconds or 25 m/s"
	)
	var control = sim.control_state.duplicate(true)
	var now = control.until
	WeekendRaceControl.tick(control, now, sim.tuning.operations.control)
	near(control.until - now, 11, "Ending interval follows the frozen data")
	check(
		control.state == "ending" and WeekendRaceControl.restricted(control, geometry.length, 0, 1),
		"Data does not disable ending no-passing authority"
	)
	WeekendRaceControl.tick(control, now + 11, sim.tuning.operations.control)
	check(control.state == "green", "No-passing releases only at the configured time")
	physical_repair(tuned)
	var cap = RaceSim.new(geometry, {"tuning_definition": tuned, "intensity": "calm"})
	cap.cars[3].damage = 999
	cap.incident(cap.cars[3])
	near(
		cap.cars[3].damage,
		1000,
		"Legacy non-terminal damage accumulation cannot exceed the protected serialized bound"
	)


func physical_repair(record: Dictionary) -> void:
	var sim = fixture(record)
	var c = sim.cars[3]
	var r = sim.reliability(3)
	c.damage = 10
	c.health = 77
	var before = TyreInventory.find(c, c.set_id).duplicate(true)
	var old_rng = r.rng
	r.repair_only = true
	c.repair = true
	c.route = "pit"
	c.pit_stage = "service"
	sim.begin_service(c)
	near(
		r.service.repair_seconds,
		0.5,
		"The physical service receipt matches the forecasted repair-work calibration"
	)
	check(
		c.service_set_id.is_empty() and c.service_repair,
		"Repair-only service freezes the plan without selecting a fresh set"
	)
	sim.complete_service(c)
	near(c.damage, 0, "Completed work repairs scalar damage")
	near(c.health, 77, "Completed repair never replenishes lifetime health")
	check(
		TyreInventory.find(c, c.set_id) == before and r.rng == old_rng,
		"Repair neither redraws failure thresholds nor replaces retained tyre condition"
	)


func publication(catalog: ContentCatalog, document: Dictionary) -> void:
	var app = root.get_node("App")
	var record = catalog.record(CORE)
	record.operations.reliability.fault_threshold_base = 200
	record.operations.reliability.fault_threshold_span = 0
	record.operations.reliability.terminal_threshold_base = 300
	record.operations.reliability.terminal_threshold_span = 0
	record.operations.control.virtual_pace_factor = 0.5
	var manifest = {
		"kind": "motorsport-manager-content-pack",
		"schema_version": 1,
		"id": "test.operations",
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
		"Author an external operations pack through files only"
	)
	check(
		app.reload_content([ROOT]), "Activate the complete production-validated operations catalog"
	)
	var accepted: ContentCatalog = app.content_catalog
	var launch = WeekendLaunch.new(accepted)
	check(
		launch.stage_preset("core.weekend.standard", document, {"intensity": "calm"}),
		"Real launch resolves external operations"
	)
	var committed = launch.commit(int(launch.capture().revision), Store.new())
	check(
		committed.ok,
		(
			"Initial persisted native session accepts non-legacy fault thresholds: "
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
	var bad = record.duplicate(true)
	bad.operations.reliability.damage_warning = 80
	Storage.write_json(ROOT + "/tuning.json", bad)
	check(
		not app.reload_content([ROOT]) and app.content_catalog == accepted,
		"Invalid scalar stage ordering cannot replace the last good catalog"
	)
	check(
		(
			app.content_diagnostics[0].code == "CONTENT_OPERATIONS"
			and app.content_diagnostics[0].field == "/operations/reliability/damage_degraded"
		),
		"Operations diagnostic identifies the conflicting field"
	)
	check(
		(
			app.content_diagnostics[0].file == "tuning.json"
			and app.content_diagnostics[0].entity == CORE
		),
		"Diagnostic preserves authored file and entity provenance"
	)
	DirAccess.remove_absolute(ProjectSettings.globalize_path(ROOT + "/tuning.json"))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(ROOT + "/pack.json"))
	check(app.reload_content([]), "Remove the author pack and reactivate default content")
	var restored = PracticeRaceSim.restore_practice(snapshot)
	check(
		restored != null, "Save restores without source files and outside legacy threshold ranges"
	)
	if restored != null:
		near(
			restored.reliability(3).fault_threshold,
			200,
			"Sampled fault state remains bound to its saved definition"
		)
		near(
			restored.tuning.operations.control.virtual_pace_factor,
			0.5,
			"Saved control tuning wins over currently installed content"
		)
		check(
			RaceRecord.equivalent(restored.snapshot(), sim.snapshot()),
			"Full operations state and metadata round trip"
		)
		for tick in range(160):
			sim.step()
			restored.step()
		check(
			RaceRecord.equivalent(sim.snapshot(), restored.snapshot()),
			"Continued sessions stay identical after deleting the operations pack"
		)
	var sealed = committed.record.seal()
	check(
		RaceRecord.validate(sealed).is_empty(),
		"Replay identity contains the complete transitive operations data"
	)
	var changed = sealed.duplicate(true)
	changed.endpoint.tuning_definition.operations.control.ending_seconds += 1
	changed.erase("digest")
	changed.digest = RaceRecord.fingerprint(changed)
	check(
		not RaceRecord.validate(changed).is_empty(),
		"A recomputed envelope digest cannot change replay rules at its endpoint"
	)
	changed = sim.snapshot()
	changed.reliability_state.drivers[3].fault_threshold = 25
	check(
		PracticeRaceSim.restore_practice(changed) == null,
		"A legacy-range sampled threshold incompatible with the selected rules is rejected"
	)
	changed = sim.snapshot()
	changed.tuning_definition.operations.control.virtual_pace_factor = 2
	check(
		PracticeRaceSim.restore_practice(changed) == null,
		"An out-of-range frozen control definition cannot restore"
	)
	var old = catalog.record(CORE)
	old.erase("operations")
	var legacy = RecoveryRaceSim.new(geometry, {"intensity": "calm", "tuning_definition": old})
	var previous = RecoveryRaceSim.restore_recovery(legacy.snapshot())
	check(
		previous != null and RaceRecord.equivalent(previous.snapshot(), legacy.snapshot()),
		"Old authored save without operations restores with unchanged metadata"
	)
	committed.record.detach()


func roster_debrief(catalog: ContentCatalog) -> void:
	var sim = RecoveryRaceSim.new(geometry, {}, catalog.roster("local.club.roster.privateer"))
	check(sim.player_ids() == [12, 13], "Reordered field exposes its real two controlled drivers")
	RaceJournal.append(
		sim.strategy_state,
		sim,
		"recovery_retirement",
		12,
		{
			"reason": "PLAYER_TWELVE",
			"observed": RaceReliability.observation(sim.cars[12], sim.reliability(12))
		}
	)
	RaceJournal.append(
		sim.strategy_state,
		sim,
		"recovery_retirement",
		13,
		{
			"reason": "PLAYER_THIRTEEN",
			"observed": RaceReliability.observation(sim.cars[13], sim.reliability(13))
		}
	)
	RaceJournal.append(
		sim.strategy_state,
		sim,
		"recovery_retirement",
		3,
		{
			"reason": "RIVAL_THREE",
			"observed": RaceReliability.observation(sim.cars[3], sim.reliability(3))
		}
	)
	var debrief = sim.recovery_debrief()
	check(
		(
			"PLAYER_TWELVE" in debrief
			and "PLAYER_THIRTEEN" in debrief
			and not "RIVAL_THREE" in debrief
		),
		"Recovery debrief follows stable ownership, not historical array positions"
	)


func finish() -> void:
	var result = {"passed": failures.is_empty(), "checks": checks, "failures": failures}
	Storage.write_json("res://reports/content-operations-tests.json", result)
	print("CONTENT_OPERATIONS_TESTS ", JSON.stringify(result))
	quit(0 if failures.is_empty() else 1)
