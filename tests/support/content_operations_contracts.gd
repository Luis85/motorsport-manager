extends SceneTree
## Authored scalar condition/control, preserved random streams, and physical repair contracts.
const CORE = "core.race_tuning.default"
const ROOT = "user://operations-content-tests"
var checks = 0
var failures: Array[String] = []
var geometry: TrackGeometry


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
		print("OPERATIONS_FAILURE ", description)


func near(a: float, b: float, description: String) -> void:
	check(absf(a - b) < 0.000001, description)


func validation(record: Dictionary) -> void:
	var definition = RaceTuningDefinition.from_record(record)
	check(
		definition.operations == LegacyOperations.VALUES,
		"Every authored default preserves its pre-extraction numerical value"
	)
	check(
		definition.operations.is_read_only() and definition.operations.reliability.is_read_only(),
		"Nested runtime operations definitions are frozen"
	)
	var old = record.duplicate(true)
	old.erase("operations")
	var legacy = RaceTuningDefinition.from_record(old)
	check(
		legacy != null and legacy.to_record() == old and not legacy.view().has("operations"),
		"Pre-extension v1 records retain their exact identity, not a rewritten default"
	)
	check(
		legacy.operations == LegacyOperations.VALUES,
		"Old content falls back to immutable compatibility values"
	)
	var count = 0
	for group in OperationsTuningSchema.LIMITS:
		for field in OperationsTuningSchema.LIMITS[group]:
			count += 1
			var limits = OperationsTuningSchema.LIMITS[group][field]
			for invalid in [true, float(limits[0]) - 1, float(limits[1]) + 1]:
				var bad = record.duplicate(true)
				bad.operations[group][field] = invalid
				check(
					RaceTuningDefinition.from_record(bad) == null,
					"Type/range rejection at /operations/" + group + "/" + field
				)
	check(count == 60, "All sixty supported numerical operation fields are covered")
	for edit in [
		["reliability", "damage_warning", 30],
		["reliability", "damage_degraded", 70],
		["reliability", "health_critical", 70],
		["reliability", "health_degraded", 90],
		["reliability", "temperature_warning_reset_c", 150],
		["reliability", "engine_save", 2],
		["reliability", "engine_normal", 2],
		["reliability", "minimum_critical_exposure", 8],
		["reliability", "observed_rising_exposure", 8],
		["reliability", "fault_threshold_span", 10000],
		["reliability", "terminal_threshold_span", 10000],
		["reliability", "fault_damage_span", 1000],
		["reliability", "fault_health_span", 100],
		["incidents", "patient_factor", 2],
		["incidents", "balanced_factor", 2],
		["incidents", "barrier_probability", 0.5],
		["incidents", "lost_seconds_span", 120],
		["incidents", "damage_span", 1000]
	]:
		var bad = record.duplicate(true)
		bad.operations[edit[0]][edit[1]] = edit[2]
		check(
			RaceTuningDefinition.from_record(bad) == null,
			"Cross-field bound rejected for " + str(edit.slice(0, 2))
		)
	var extreme = record.duplicate(true)
	for field in [
		"base_exposure_per_second",
		"consistency_factor",
		"reliability_factor",
		"push_factor",
		"water_factor",
		"low_tread_reference",
		"low_tread_factor",
		"patient_factor",
		"balanced_factor",
		"assertive_factor",
		"volatile_factor"
	]:
		extreme.operations.incidents[field] = OperationsTuningSchema.LIMITS.incidents[field][1]
	check(
		RaceTuningDefinition.from_record(extreme) == null,
		"Combined worst-case per-step incident probability cannot exceed one"
	)
	for edit in [{"model": "run-user-script"}, {"speed_bonus": 2.0}, {"reliability": {}}]:
		var bad = record.duplicate(true)
		bad.operations.merge(edit, true)
		check(
			RaceTuningDefinition.from_record(bad) == null,
			"Unknown model, unused field or incomplete explicit operations are rejected"
		)


func characterization(record: Dictionary) -> void:
	var fixture = Storage.read_json("res://tests/fixtures/operations-v1-characterization.json").data
	check(
		fixture.source_commit == "177aa7911fbf0c614ec0885ab770cd436673dea4",
		"Golden condition/control trajectory comes from before extraction"
	)
	for implicit in [true, false]:
		var value = record.duplicate(true)
		if implicit:
			value.erase("operations")
		var rules = RaceTuningDefinition.from_record(value).operations
		var sim = PracticeRaceSim.new(geometry, {"seed": 7314})
		var car = sim.cars[3].detached_copy()
		car.engine_temperature = 123
		car.health = 72
		car.damage = 18
		car.engine = 1
		var r = RaceReliability.create([car], 7314, "staged", rules.reliability).drivers[0]
		var rows: Array = [
			{
				"step": -1,
				"state": r.duplicate(true),
				"observation": RaceReliability.observation(car, r, rules.reliability)
			}
		]
		var faults: Array = []
		for tick in range(5000):
			if tick == 1000:
				car.engine = 0
				car.engine_temperature = 105
			if tick == 2000:
				car.engine = 2
				car.engine_temperature = 130
			var outcome = RaceReliability.advance(r, car, RaceSim.STEP, true, rules.reliability)
			if not outcome.is_empty():
				faults.append({"step": tick, "outcome": outcome})
			var stage = RaceReliability.stage(car, r, rules.reliability)
			if stage != r.stage:
				r.stage = stage
				r.stage_since = (tick + 1) * 0.05
				r.revision += 1
			if outcome.get("retire", false):
				car.dnf = true
			if tick in [0, 499, 999, 1999, 2999, 4999]:
				rows.append(
					{
						"step": tick,
						"state": r.duplicate(true),
						"observation": RaceReliability.observation(car, r, rules.reliability)
					}
				)
		check(
			RaceRecord.equivalent(rows, fixture.reliability),
			"Pre-refactor reliability states and public observations: implicit=" + str(implicit)
		)
		check(
			(
				faults.size() == fixture.faults_count
				and RaceStateValue.fingerprint(faults) == fixture.faults_hash
			),
			"All prior scalar faults, retirements and RNG draws match: implicit=" + str(implicit)
		)
		var control = WeekendRaceControl.create()
		WeekendRaceControl.enqueue(control, 6, 1, false, 18, 0, "local", "Local")
		WeekendRaceControl.enqueue(control, 3, 2, true, 38, 0, "global", "Global")
		var controls: Array = []
		for now in [0.05, 18.05, 38.05, 46.05]:
			var change = WeekendRaceControl.tick(control, now, rules.control)
			controls.append(
				{
					"time": now,
					"change": change,
					"state": control.duplicate(true),
					"view": WeekendRaceControl.public_view(control, now, rules.control)
				}
			)
		check(
			RaceRecord.equivalent(controls, fixture.control),
			"Pre-refactor control order, timing and public wording: implicit=" + str(implicit)
		)


func fixture(record: Dictionary, roster: RosterDefinition = null) -> RecoveryRaceSim:
	var sim = RecoveryRaceSim.new(
		geometry, {"seed": 7314, "intensity": "calm", "tuning_definition": record}, roster
	)
	check(
		sim.command("prepare_race") and sim.command("formation"),
		"Legal preparation and formation entry"
	)
	for car in sim.cars:
		car.formation_done = true
	sim.step()
	check(sim.command("lights"), "Explicit grid approval")
	for tick in range(125):
		sim.step()
	check(sim.phase == "race", "Fixture reached race through normal phase commands")
	return sim
