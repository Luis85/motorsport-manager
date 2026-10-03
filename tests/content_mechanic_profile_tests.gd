extends SceneTree
## Real provider construction, selected/frozen plans, and checkpoint/replay rejection.
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
		print("MECHANIC_CONTENT_FAILURE ", label)


func run() -> void:
	var loaded = ContentPackLoader.new().load_packs(["res://content/packs/core"])
	check(loaded.ok, "Core catalog resolves registered mechanic plans")
	if not loaded.ok:
		finish()
		return
	var catalog: ContentCatalog = loaded.catalog
	var profile = catalog.mechanic_profile("core.mechanic_profile.default")
	check(profile != null, "Resolve profile by stable identity")
	if profile == null:
		finish()
		return
	var source = profile.to_record()
	for context in RaceMechanicProfiles.ORDER:
		var selected = RaceMechanicProfiles.build(context, profile)
		var legacy = RaceMechanicProfiles.build(context)
		check(selected.size() == legacy.size(), "Existing prefix length: " + context)
		for index in range(selected.size()):
			check(
				selected[index].definition() == legacy[index].definition(),
				"Unchanged registered provider: " + context
			)
		check(
			selected[0] != RaceMechanicProfiles.build(context, profile)[0],
			"Each simulation owns fresh provider instances: " + context
		)
	invalid_profiles(source)
	var changed = source.duplicate(true)
	changed.id = "test.profiles.alternative"
	changed.name = "Externally named registered composition"
	var candidate = ContentCatalog.new()
	for kind in ContentSchema.KINDS:
		for record in catalog.entries(kind):
			check(
				candidate.add(record, {"root": "", "file": "fixture.json"}).is_empty(),
				"Copy valid " + record.id
			)
	check(
		candidate.add(changed, {"root": "", "file": "profile.json"}).is_empty(),
		"A new profile is ordinary content"
	)
	check(candidate.seal().is_empty(), "Added content seals without engine changes")
	var document: Dictionary = Storage.read_json("res://data/tracks/hillside.json").data
	var launch = WeekendLaunch.new(candidate)
	check(
		launch.stage_preset("core.weekend.quick", document, {"mechanic_profile_id": changed.id}),
		"Select externally named profile through the weekend"
	)
	var selected_options = launch.session_options()
	check(
		selected_options.mechanic_definition.id == changed.id,
		"Freeze selected registered plans in launch options"
	)
	var before = launch.capture()
	check(
		not launch.stage_preset(
			"core.weekend.quick", document, {"mechanic_profile_id": "unknown.profile"}
		),
		"Unknown selection rejected before commit"
	)
	check(
		launch.capture() == before and launch.session_options() == selected_options,
		"Failed selection retains the staged weekend"
	)
	var committed = launch.commit(int(before.revision), Store.new())
	check(
		committed.ok,
		"Selected profile commits a real practice recording: " + str(committed.get("error", ""))
	)
	if not committed.ok:
		finish()
		return
	var sim: RaceSim = committed.simulation
	var recording: RaceRecord = committed.record
	check(
		sim.mechanics.describe().map(func(entry): return entry.id) == RaceMechanicProfiles.ORDER,
		"Actual installed providers match selected plan"
	)
	var driver = int(sim.player_ids()[0])
	var plan = {
		"objective": "tyre_life",
		"set_id": sim.cars[driver].set_id,
		"laps": 2,
		"baseline": "current"
	}
	var preview = sim.run_preview(driver, plan)
	check(
		sim.command(
			"practice_run",
			{
				"id": driver,
				"plan": plan,
				"revision": preview.revision,
				"time": preview.time,
				"key": preview.key
			}
		),
		"Ordinary practice command accepted: " + sim.last_error
	)
	for step in range(120):
		sim.step()
	var snapshot = sim.snapshot()
	var restored = PracticeRaceSim.restore_practice(snapshot)
	check(
		restored != null and RaceRecord.equivalent(snapshot, restored.snapshot()),
		"Profile freezes through exact checkpoint restoration"
	)
	if restored != null:
		for step in range(120):
			sim.step()
			restored.step()
		check(
			RaceRecord.equivalent(sim.snapshot(), restored.snapshot()),
			"Saved composition continues the same physical state and random streams"
		)
	var bad = sim.snapshot()
	bad.mechanic_definition.profiles.practice[0].version = 99
	check(
		PracticeRaceSim.restore_practice(bad) == null,
		"Restore rejects unavailable provider version"
	)
	bad = sim.snapshot()
	bad.erase("mechanic_definition")
	check(
		PracticeRaceSim.restore_practice(bad) == null,
		"Selected weekend cannot silently lose its profile"
	)
	bad = sim.snapshot()
	bad.weekend_definition.mechanic_profile_id = "another.profile"
	check(
		PracticeRaceSim.restore_practice(bad) == null,
		"Snapshot reference must agree with frozen profile"
	)
	var sealed = recording.seal()
	check(
		RaceRecord.validate(sealed).is_empty(), "Complete replay validates with frozen composition"
	)
	var altered = sealed.duplicate(true)
	altered.endpoint.mechanic_definition.name = "Mutated after initial checkpoint"
	altered.erase("digest")
	altered.digest = RaceRecord.fingerprint(altered)
	check(
		not RaceRecord.validate(altered).is_empty(),
		"A recomputed replay digest cannot change frozen provider metadata"
	)
	var replay = RaceReplay.new()
	check(replay.load_record(sealed).is_empty(), "Independent replay accepts selected composition")
	for batch in range(100):
		if replay.verified or not replay.error.is_empty():
			break
		replay.tick(32)
	check(replay.verified, "Selected profile independently replays: " + replay.error)
	recording.detach()
	var legacy = PracticeRaceSim.new(TrackGeometry.new(document, "Formula"), {"laps": 4})
	check(
		not legacy.snapshot().has("mechanic_definition"),
		"Old direct construction retains the old metadata shape"
	)
	check(
		PracticeRaceSim.restore_practice(legacy.snapshot()) != null,
		"Old native saves still restore without profile metadata"
	)
	external_weekends()
	finish()


func external_weekends() -> void:
	var loaded = ContentPackLoader.new().load_packs(
		["res://content/packs/core", "res://content/examples/club-racing"]
	)
	check(loaded.ok, "External pre-profile content remains loadable")
	if not loaded.ok:
		return
	var catalog: ContentCatalog = loaded.catalog
	var preset_id = "local.club.weekend.strategy_sprint"
	var original = catalog.weekend(preset_id).to_record()
	check(
		not original.has("mechanic_profile_id"),
		"Regression fixture omits the optional profile reference"
	)
	var document: Dictionary = Storage.read_json("res://data/tracks/hillside.json").data
	document.grid.count = catalog.roster(original.roster_id).count
	var launch = WeekendLaunch.new(catalog)
	check(
		launch.stage_preset(preset_id, document),
		"Legacy external preset stages with the core profile"
	)
	var frozen: Dictionary = launch.session_options().weekend_definition
	check(
		ContentValidation.check(frozen, ContentSchema.definition("weekend")).is_empty(),
		"Inserted optional profile key remains valid JSON data"
	)
	check(
		frozen.get("mechanic_profile_id") == "core.mechanic_profile.default",
		"Freeze the actual default provider identity"
	)
	check(
		original == catalog.weekend(preset_id).to_record(),
		"Staging never rewrites the original external preset"
	)
	var committed = launch.commit(int(launch.capture().revision), Store.new())
	check(
		committed.ok,
		"External weekend commits a valid recording: " + str(committed.get("error", ""))
	)
	if committed.ok:
		var sim: RaceSim = committed.simulation
		var restored = PracticeRaceSim.restore_practice(sim.snapshot())
		check(
			restored != null and RaceRecord.equivalent(sim.snapshot(), restored.snapshot()),
			"Default-profile external weekend restores without its source pack"
		)
		check(
			RaceRecord.validate(committed.record.seal()).is_empty(),
			"External-profile frozen recording validates before serialization"
		)
		committed.record.detach()
	check(
		launch.stage_preset(
			preset_id, document, {"mechanic_profile_id": "core.mechanic_profile.default"}
		),
		"Optional profile reference can be explicitly selected on older presets"
	)
	var before = launch.capture()
	check(
		not launch.stage_preset(preset_id, document, {"mechanic_profile_id": "missing.profile"}),
		"Invalid optional override still fails closed"
	)
	check(launch.capture() == before, "Rejected optional override preserves the previous draft")
	check(
		not launch.stage_preset(preset_id, document, {"arbitrary_option": true}),
		"Optional-reference support does not permit arbitrary settings"
	)


func finish() -> void:
	var result = {"passed": failures.is_empty(), "checks": checks, "failures": failures}
	Storage.write_json("res://reports/content-mechanic-profile-tests.json", result)
	print("CONTENT_MECHANIC_PROFILE_TESTS ", JSON.stringify(result))
	quit(0 if failures.is_empty() else 1)


func invalid_profiles(source: Dictionary) -> void:
	for kind in ["unknown", "version", "order", "missing", "duplicate", "future_reader", "script"]:
		var invalid = source.duplicate(true)
		match kind:
			"unknown":
				invalid.profiles.practice.append({"id": "unregistered", "version": 1})
			"version":
				invalid.profiles.practice[0].version = 2
			"order":
				invalid.profiles.practice.reverse()
			"missing":
				invalid.profiles.practice.pop_back()
			"duplicate":
				invalid.profiles.practice.append(invalid.profiles.practice[0].duplicate())
			"future_reader":
				invalid.profiles.strategy.append({"id": "weather", "version": 1})
			"script":
				invalid.profiles.practice[0].script = "res://arbitrary.gd"
		check(MechanicProfileDefinition.from_record(invalid) == null, "Fail closed for " + kind)
