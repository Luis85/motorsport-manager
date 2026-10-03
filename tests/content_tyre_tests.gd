extends SceneTree
## Data-only sixth compound, variable finite stock, frozen setup and real pit service.
const COMPOUND = "local.club.tyre.endurance"
const ALLOCATION = "local.club.tyre_allocation.endurance"
const SETUP = "local.club.setup.club"
var checks = 0
var failures: Array[String] = []


class Store:
	extends WeekendEntryStore

	func save_record(record: RaceRecord) -> String:
		return RaceRecord.validate(record.seal())


func _initialize() -> void:
	call_deferred("run")


func check(value: bool, label: String) -> void:
	checks += 1
	if not value:
		failures.append(label)
		print("TYRE_CONTENT_FAILURE ", label)


func run() -> void:
	var loaded = ContentPackLoader.new().load_packs(
		["res://config", "res://content/examples/club-racing"]
	)
	check(loaded.ok, "Resolve every shipped and example definition")
	if not loaded.ok:
		print(JSON.stringify(loaded))
		finish()
		return
	var catalog: ContentCatalog = loaded.catalog
	var rules = catalog.tyres(ALLOCATION)
	check(rules != null, "Compile closed allocation")
	if rules == null:
		finish()
		return
	validation(catalog, rules)
	var document: Dictionary = Storage.read_json("res://config/circuits/hillside.json").data
	document.grid.count = 14
	var launch = WeekendLaunch.new(catalog)
	var options = {
		"laps": 4,
		"scenario": "dry",
		"intensity": "calm",
		"seed": 7314,
		"roster_id": "local.club.roster.privateer",
		"tyre_allocation_id": ALLOCATION,
		"setup_id": SETUP
	}
	check(
		launch.stage(document, options),
		"Stage independent roster, tyre and setup references: " + launch.last_error
	)
	if launch.capture().is_empty():
		finish()
		return
	var staged = launch.session_options()
	check(
		staged.tyre_definition.allocation.id == ALLOCATION and staged.setup_definition.id == SETUP,
		"Launch never concatenates setup and allocation IDs"
	)
	for field in ["tyre_allocation_id", "setup_id"]:
		var bad = options.duplicate(true)
		bad[field] = "missing.definition"
		check(
			not launch.stage(document, bad) and staged == launch.session_options(),
			"Invalid " + field + " preserves staged data"
		)
	var committed = launch.commit(int(launch.capture().revision), Store.new())
	check(
		committed.ok,
		"Initial real practice persists new content: " + str(committed.get("error", ""))
	)
	if not committed.ok:
		finish()
		return
	var sim: RaceSim = committed.simulation
	var recording: RaceRecord = committed.record
	var car = sim.cars[12]
	check(
		car.compound == COMPOUND and car.tyre_sets.size() == 10,
		"Independent fourteen-car roster uses ten-set allocation"
	)
	check(
		car.car_setup.wing == 3 and sim.setup_definition.to_record().id == SETUP,
		"Authored setup defaults reach typed entrants"
	)
	unique_stock(sim)
	var before = sim.snapshot()
	check(
		not sim.command("select_set", {"id": 12, "set_id": sim.cars[13].set_id}),
		"No access to teammate stock"
	)
	check(
		not sim.command("setup", {"id": 12, "value": 1}),
		"Profile-specific setup lower limit enforced"
	)
	check(
		RaceRecord.equivalent(before, sim.snapshot()),
		"Rejected content commands do not change resources, journals or RNG"
	)
	check(sim.command("setup", {"id": 12, "value": 4}), "Valid profile control applies")
	var view = RaceViewQuery.new(sim)
	var reading = view.car(12)
	check(
		view.tyre_info(COMPOUND).short == "CE" and view.compound_choices().size() == 6,
		"Detached query lists new compound without an enum edit"
	)
	check(
		view.set_label(reading, reading.set_id) == "CE1",
		"Display label is not parsed from the stable ID"
	)
	check(
		view.setup_profile().specs.wing.slice(0, 2) == [2, 7], "Detached setup bounds match runtime"
	)
	check(
		view.setup_effects(reading, 0.0) == CarSetup.effects(car),
		"Draft calculation binds the exact tyre and setup definitions"
	)
	var broken = reading.duplicate(true)
	broken.tyre_sets[0].erase("wheels")
	check(
		view.setup_effects(broken, 0.0).is_empty(),
		"Malformed detached wheel data is rejected without an engine error"
	)
	var draft = reading.duplicate(true)
	draft.car_setup.wing = 5
	draft.setup = 5
	before = sim.snapshot()
	check(not view.setup_effects(draft, 0.0).is_empty(), "Valid unapplied setup can be compared")
	check(
		RaceRecord.equivalent(before, sim.snapshot()),
		"Comparing a draft leaves live state unchanged"
	)
	check(
		view.practice_setup(reading, "low_drag").wing == 2,
		"Practice baseline resolves through the frozen setup profile"
	)
	var forecast = RaceForecaster.capture(sim, 12)
	check(
		forecast.tyre_context.compounds[COMPOUND].wear == 2.7,
		"Forecast consumes the same compound wear input"
	)
	var reloaded = PracticeRaceSim.restore_practice(
		JSON.parse_string(JSON.stringify(sim.snapshot(), "", true, true))
	)
	check(
		reloaded != null and RaceRecord.equivalent(sim.snapshot(), reloaded.snapshot()),
		"Full content-aware checkpoint round-trip"
	)
	if reloaded != null:
		check(
			(
				reloaded.cars[12].tyre_rules.spec(COMPOUND).wear == 2.7
				and reloaded.cars[12].setup_definition.specs().wing[0] == 2
			),
			"Restored typed entrants retain immutable dependencies"
		)
	# Close unused practice through ordinary commands; this test focuses on physical
	# formation and two stops. Qualifying coverage lives in the retained roster suites.
	check(sim.command("practice_end"), "Explicitly close optional practice")
	for index in range(30000):
		if sim.phase != "practice":
			break
		sim.step()
	check(
		sim.command("practice_finish") and sim.command("prepare_race"),
		"Enter preparation without fabricating a grid result"
	)
	check(sim.command("formation"), "Mount configured starting set before physical formation")
	for index in range(18000):
		if sim.phase != "formation":
			break
		sim.step()
	check(sim.phase == "grid_ready" and sim.command("lights"), "Physical field forms before lights")
	physical_stops(sim)
	var result = WeekendResult.build(recording)
	check(
		not result.is_empty() and WeekendResult.validate(result).is_empty(),
		"Finished event returns validated variable stock"
	)
	if not result.is_empty():
		check(
			(
				result.returned_resources.size() == 14
				and result.returned_resources[12].tyres.size() == 10
			),
			"All 140 sets accounted for after the race"
		)
		var invalid = result.duplicate(true)
		invalid.returned_resources[12].tyres[0].mounts = -1
		invalid.erase("digest")
		invalid.digest = RaceRecord.fingerprint(invalid)
		check(
			not WeekendResult.validate(invalid).is_empty(),
			"Recomputed digest cannot legitimize invalid returned stock"
		)
	var notebook = NotebookEntry.build(recording)
	check(
		not notebook.is_empty() and NotebookEntry.validate(notebook),
		"Notebook retains the content-aware result context"
	)
	var sealed = recording.seal()
	check(
		RaceRecord.validate(sealed).is_empty(),
		"Final record pins transitive tyre/setup definitions"
	)
	var replay = RaceReplay.new()
	check(
		replay.load_record(sealed).is_empty(), "Independent replay accepts the complete recording"
	)
	for batch in range(5000):
		if replay.verified or not replay.error.is_empty():
			break
		replay.tick(64)
	check(replay.verified, "Data-driven pit/remount commands replay exactly: " + replay.error)
	recording.detach()
	finish()


func validation(catalog: ContentCatalog, rules: RaceTyreRules) -> void:
	check(
		rules.compounds().size() == 6 and rules.inventory_entries(12).size() == 10,
		"Allocation is not restricted to five compounds or twelve sets"
	)
	var original = rules.to_snapshot()
	for count in [true, 1.5, 0, 65]:
		var invalid = original.duplicate(true)
		invalid.allocation.sets[0].count = count
		check(
			RaceTyreRules.from_snapshot(invalid) == null,
			"Reject invalid allocated count: " + str(count)
		)
	var invalid = original.duplicate(true)
	invalid.allocation.sets.append(invalid.allocation.sets[0])
	check(RaceTyreRules.from_snapshot(invalid) == null, "Duplicate compound allocation is rejected")
	invalid = original.duplicate(true)
	invalid.thermal_profiles.clear()
	check(RaceTyreRules.from_snapshot(invalid) == null, "Thermal dependency is required")
	invalid = original.duplicate(true)
	invalid.allocation.selection.wet = COMPOUND
	check(
		RaceTyreRules.from_snapshot(invalid) == null,
		"Selection must match the implemented weather family"
	)
	invalid = original.duplicate(true)
	invalid.allocation.selection.race.append("missing.tyre")
	check(
		RaceTyreRules.from_snapshot(invalid) == null, "Missing AI preference reference is rejected"
	)
	invalid = original.duplicate(true)
	invalid.thermal_profiles[0].parameters.core_rate_per_s = INF
	check(RaceTyreRules.from_snapshot(invalid) == null, "Non-finite coefficient rejected")
	invalid = original.duplicate(true)
	invalid.compounds[4].surface_response.inter_base = 0
	invalid.compounds[4].surface_response.inter_loss = 2
	check(
		RaceTyreRules.from_snapshot(invalid) == null,
		"Negative wet-grip curve rejected before activation"
	)
	var setup = catalog.setup(SETUP).to_record()
	setup.controls.wing.default = 8
	check(SetupDefinition.from_record(setup) == null, "Default outside authored bounds rejected")
	setup = catalog.setup(SETUP).to_record()
	setup.effects.wing_drag_loss = 1
	check(
		SetupDefinition.from_record(setup) == null,
		"Nonphysical negative straight-line multiplier rejected"
	)
	invalid = original.duplicate(true)
	invalid.compounds[3].wear = 1.4
	var alternate = RaceTyreRules.from_snapshot(invalid)
	check(
		alternate != null and rules.spec(COMPOUND).wear == 2.7,
		"Editing detached source cannot mutate an existing rules object"
	)


func physical_stops(sim: RaceSim) -> void:
	var car = sim.cars[12]
	var first = car.set_id
	var second: String = (
		car
		. tyre_sets
		. filter(func(item): return item.compound == COMPOUND and item.id != first)[0]
		. id
	)
	var requested_first = false
	var requested_return = false
	var restored_in_service = false
	var used_life = 100.0
	var observed_remount = false
	for step in range(40000):
		if sim.phase == "results":
			break
		sim.step()
		if sim.phase != "race":
			continue
		if not requested_first and car.distance > sim.track.length * 0.12:
			used_life = TyreInventory.find(car, first).life
			requested_first = sim.command("pit", {"id": 12, "set_id": second})
			check(
				requested_first,
				"Physical first pit request accepts the new compound: " + sim.last_error
			)
		if car.pit_stage == "service" and not restored_in_service:
			var restored = PracticeRaceSim.restore_practice(sim.snapshot())
			check(
				restored != null and RaceRecord.equivalent(sim.snapshot(), restored.snapshot()),
				"Content-aware checkpoint restores inside physical service"
			)
			restored_in_service = true
		if requested_first and not requested_return and car.route == "track" and car.pit_stops >= 1:
			check(car.set_id == second, "Completed service physically fits CE2")
			used_life = TyreInventory.find(car, first).life
			requested_return = sim.command("pit", {"id": 12, "set_id": first})
			check(requested_return, "A used allocated set can be scheduled again")
		if (
			requested_return
			and not observed_remount
			and car.route == "track"
			and car.pit_stops >= 2
		):
			var fitted = TyreInventory.find(car, first)
			check(
				car.set_id == first and fitted.life <= used_life and fitted.life < 100,
				"Remount keeps depleted condition instead of refreshing stock"
			)
			check(fitted.mounts >= 2 and fitted.used, "Physical remount retains usage history")
			observed_remount = true
	check(
		(
			sim.phase == "results"
			and requested_first
			and requested_return
			and restored_in_service
			and observed_remount
		),
		"Physical four-lap event closes with both validated services"
	)


func finish() -> void:
	var result = {"passed": failures.is_empty(), "checks": checks, "failures": failures}
	Storage.write_json("res://reports/content-tyre-tests.json", result)
	print("CONTENT_TYRE_TESTS ", JSON.stringify(result))
	quit(0 if failures.is_empty() else 1)


func unique_stock(sim: RaceSim) -> void:
	var all_sets: Dictionary = {}
	for entrant in sim.cars:
		for item in entrant.tyre_sets:
			all_sets[item.id] = true
	check(all_sets.size() == 140, "All 140 physical set identities are unique across owners")
