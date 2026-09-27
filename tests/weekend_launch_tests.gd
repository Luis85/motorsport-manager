extends SceneTree
var checks: int = 0
var failures: Array[String] = []
class FakeStore:
	extends WeekendEntryStore
	var fail_write: bool = true
	var writes: int = 0
	var snapshots: Array = []
	func save_record(record: RaceRecord) -> String:
		writes += 1
		snapshots.append(record.source.get_ref().snapshot())
		return "Injected storage failure" if fail_write else ""
class ReentrantStore:
	extends WeekendEntryStore
	var launch: WeekendLaunch
	var revision: int
	var document: Dictionary
	var writes: int = 0
	var nested: Dictionary
	var restaged: bool = true
	func save_record(_record: RaceRecord) -> String:
		writes += 1
		if writes == 1:
			nested = launch.commit(revision, self)
			restaged = launch.stage(document, {"laps": 8})
		return ""

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message); push_error(message)
func _initialize() -> void:
	call_deferred("run")
func run() -> void:
	var source = Storage.read_json("res://data/tracks/hillside.json").data
	var options = {"laps": 6, "qual_duration": 240, "scenario": "dry", "intensity": "calm", "seed": 7314, "tactical_duels": true}
	var launch = WeekendLaunch.new()
	var store = FakeStore.new()
	check(launch.capture().is_empty(), "No fabricated entry before configuration")
	check(launch.stage(source, options), "Supported configuration stages a weekend")
	var original = launch.capture(); var revision = original.revision
	check(not original.consumed and store.writes == 0, "Staging does not persist or start an event")
	options.laps = 99; source.name = "Changed source"
	check(launch.capture() == original, "Staged entry owns detached configuration and track values")
	var display = launch.capture(); display.name = "Changed UI"
	var track = launch.visual_track(); track.document.name = "Changed map"
	check(launch.capture() == original, "Visual inspection cannot edit the pending entry")
	var valid = {"laps": 6, "qual_duration": 240, "scenario": "dry", "intensity": "calm", "seed": 7314}
	for invalid in [{"laps": -1}, {"laps": NAN}, {"seed": INF}, {"scenario": "invalid"}, {"qual_duration": 0}]:
		var config = valid.duplicate(true); config.merge(invalid, true)
		check(not launch.stage(track.document, config) and launch.capture() == original, "Invalid settings preserve the existing staged entry")
	var rejected = launch.commit(revision - 1, store)
	check(not rejected.ok and store.writes == 0, "A stale welcome cannot start another revision")
	check(not launch.commit(revision, store, 3).ok and store.writes == 0, "Invalid playback speed is rejected before persistence")
	var failure = launch.commit(revision, store)
	check(not failure.ok and not launch.capture().consumed and store.writes == 1, "Failed persistence leaves the staged entry retryable")
	store.fail_write = false
	var result = launch.commit(revision, store)
	check(result.ok and result.simulation.phase == "practice", "Successful explicit commit enters actual practice")
	check(result.simulation.has_mechanic("practice") and result.simulation.cars.size() == 12, "Entry uses the composed production model")
	check(RaceRecord.equivalent(store.snapshots[0], store.snapshots[1]), "Retry after a failed write reproduces the same authoritative initial practice")
	check(not launch.commit(revision, store).ok and store.writes == 2, "Duplicate activation cannot create or write another weekend")
	check(PracticeRaceSim.restore_practice(result.simulation.snapshot()) != null, "Committed initial practice restores through the production validator")
	var nested_launch = WeekendLaunch.new()
	var nested_store = ReentrantStore.new()
	nested_store.launch = nested_launch
	nested_store.document = track.document
	nested_launch.stage(track.document, valid)
	nested_store.revision = nested_launch.capture().revision
	var committed = nested_launch.commit(nested_store.revision, nested_store)
	check(committed.ok and nested_store.writes == 1 and not nested_store.nested.ok, "Reentrant commit cannot create a duplicate save or second race")
	check(not nested_store.restaged and nested_launch.capture().laps == 6 and nested_launch.capture().consumed, "Storage callbacks cannot replace an entry while its approval is being committed")
	var simulation: RaceSim = result.simulation
	check(WeekendSummary.capture(simulation).is_empty(), "An unfinished weekend cannot produce a final summary")
	# Synthetic terminal fixture only; the native full-weekend suite proves physical finishing.
	simulation.phase = "results"
	for car in simulation.cars:
		car.finished = true; car.completed = 6; car.finish_time = 1000.0 + car.id; car.best_lap = 90.0 + car.id
	simulation.cars[6].dnf = true; simulation.cars[6].finished = false; simulation.cars[6].retire_reason = "Recorded retirement"; simulation.cars[6].completed = 4
	var before = RaceStateValue.fingerprint(simulation.snapshot())
	var summary = WeekendSummary.capture(simulation)
	check(summary.rows.size() == 12 and summary.managed.size() == 2, "Summary includes the complete classification and both managed drivers")
	check(summary.managed[1].status == "Retired" and summary.managed[1].laps == 4, "Retirement and completed laps remain explicit")
	summary.rows.clear(); summary.managed[0].name = "UI edit"
	check(before == RaceStateValue.fingerprint(simulation.snapshot()), "Results are a detached observation with no sporting or reward side effects")
	var report = {"passed": failures.is_empty(), "checks": checks, "failures": failures}
	Storage.write_json("res://reports/weekend-launch-tests.json", report)
	print("WEEKEND_LAUNCH_TESTS ", JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
