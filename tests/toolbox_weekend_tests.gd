extends "res://tests/support/toolbox_test_fixture.gd"
## Real SDK commands and clocks remain equivalent to the original application/domain path.
var weekends: DeveloperWeekends


func run() -> void:
	if not prepare():
		finish("toolbox-weekend-tests")
		return
	var files = player_files()
	weekends = DeveloperWeekends.new(catalog)
	await clock_contracts()
	rejection_contracts()
	event_contracts()
	planning_contracts()
	scenario_contracts()
	ownership_contracts()
	session_bounds()
	weekends.close_all()
	same(player_files(), files, "Native SDK leaves all player files untouched")
	finish("toolbox-weekend-tests")


func snapshot(session: String) -> Dictionary:
	var response = weekends.snapshot(session)
	if not accepted(response, "Export " + session):
		return {}
	check(
		response.result.fingerprint == RaceStateValue.fingerprint(response.result.snapshot),
		"Snapshot integrity describes exactly the exported native checkpoint"
	)
	return response.result.snapshot


func command_both(simulation: RaceSim, action: String, payload: Dictionary = {}) -> void:
	check(RaceCommands.new(simulation).execute(action, payload), "Reference accepts " + action)
	accepted(weekends.command("clock", action, payload), "SDK accepts " + action)
	same(snapshot("clock"), simulation.snapshot(), "Command parity: " + action)


func clock_contracts() -> void:
	var settings = configuration()
	var created = weekends.create("clock", settings)
	if not accepted(created, "Create a manually clocked authored weekend"):
		return
	var reference = reference_weekend(settings)
	var simulation: PracticeRaceSim = reference.simulation
	var runner = RaceSessionRunner.new(simulation)
	runner.automatic = false
	check(created.result.phase == "briefing", "Creation requires the real first approval")
	check(created.result.player_ids == simulation.player_ids(), "Ownership comes from the roster")
	check(
		(
			created.result.configuration.track_hash
			== RaceStateValue.fingerprint(simulation.track.document)
		),
		"SDK and original launch freeze the identical source track hash"
	)
	same(snapshot("clock"), simulation.snapshot(), "Initial same-seed checkpoint")
	for frame in range(3):
		await process_frame
	same(
		snapshot("clock"), simulation.snapshot(), "Host frames cannot advance the manual SDK clock"
	)
	var inactive = weekends.step_ticks("clock", 100)
	check(inactive.result.completed == 0, "An inactive briefing cannot spend fixed ticks")
	check(inactive.result.stop_reason == "inactive", "Inactive clock reports its approval boundary")
	same(snapshot("clock"), simulation.snapshot(), "Inactive tick request")
	command_both(simulation, "practice_start")
	for seconds in [0.02, 0.02, 0.01, 0.13]:
		var completed = runner.advance(seconds)
		var response = weekends.advance_elapsed("clock", seconds)
		check(response.result.completed == completed, "Elapsed clock retains fractional residuals")
		same(snapshot("clock"), simulation.snapshot(), "Elapsed partition parity")
	command_both(simulation, "speed", {"value": 16})
	var completed = runner.advance(0.02)
	check(
		weekends.advance_elapsed("clock", 0.02).result.completed == completed,
		"Elapsed advance applies production playback speed"
	)
	same(snapshot("clock"), simulation.snapshot(), "Speed and residual parity")
	var accumulator = simulation.accumulator
	for index in range(7):
		simulation.step()
	var fixed = weekends.step_ticks("clock", 7)
	check(fixed.result.completed == 7, "Fixed ticks count physical steps independently of 16x")
	check(fixed.result.state.accumulator == accumulator, "Fixed ticks preserve elapsed residual")
	same(snapshot("clock"), simulation.snapshot(), "Fixed tick RNG and source parity")
	command_both(simulation, "pause")
	check(weekends.step_ticks("clock", 9).result.completed == 0, "Paused fixed ticks do no work")
	check(
		weekends.advance_elapsed("clock", 0.25).result.completed == 0,
		"Pause also bounds elapsed time"
	)
	same(snapshot("clock"), simulation.snapshot(), "Paused clocks")
	command_both(simulation, "pause")
	command_both(simulation, "practice_end")
	for index in range(20000):
		if simulation.phase not in RaceSim.ACTIVE:
			break
		simulation.step()
	var boundary = weekends.step_ticks("clock", 20000)
	check(boundary.result.phase_after == "practice_results", "Physical returns reach approval")
	check(boundary.result.completed < 20000, "Fixed clock stops at the first inactive approval")
	same(snapshot("clock"), simulation.snapshot(), "Phase boundary parity")
	var record = weekends.recording("clock").result
	check(
		record.steps == reference.record.steps, "Recording observes every completed fixed step once"
	)
	same(record.inputs, reference.record.inputs, "Original accepted-input chronology")
	check(RaceRecord.validate(record).is_empty(), "SDK exports a valid production replay envelope")
	reference.record.detach()


func rejection_contracts() -> void:
	var before = snapshot("clock")
	var trace = weekends.recording("clock").result.inputs
	for value in [null, true, "2", 1.5, -1, 17]:
		rejected(
			weekends.command("clock", "speed", {"value": value}),
			"Malformed speed",
			"DOMAIN_REJECTED"
		)
	for value in [0, true, 1.5, 20001, -1, "2"]:
		rejected(weekends.step_ticks("clock", value), "Malformed tick count", "INVALID_ARGUMENT")
	for value in [-0.01, 0.251, NAN, INF, true, "0.05"]:
		rejected(
			weekends.advance_elapsed("clock", value), "Malformed elapsed time", "INVALID_ARGUMENT"
		)
	rejected(weekends.command("clock", "unknown_mechanic"), "Unknown action", "DOMAIN_REJECTED")
	rejected(weekends.query("clock", "_simulation"), "Unsupported view", "UNSUPPORTED_VIEW")
	for broken in [{}, {"cars": "scalar"}, {"cars": []}]:
		rejected(weekends.restore("clock", broken), "Malformed restore")
		same(snapshot("clock"), before, "Failed restore is atomic")
	same(snapshot("clock"), before, "All rejected inputs")
	same(
		weekends.recording("clock").result.inputs,
		trace,
		"Rejections leave accepted recording intact"
	)
	var exported = snapshot("clock")
	exported.cars[0].fuel = -999.0
	same(snapshot("clock"), before, "Exported checkpoints are detached")
	for view in ["state", "cars", "car", "overview", "weather", "strategy", "mechanics"]:
		var response = weekends.query("clock", view)
		if accepted(response, "Detached view " + view):
			response.result.clear()
	same(snapshot("clock"), before, "Reads cannot advance time, spend RNG or mutate authority")


func event_contracts() -> void:
	if not accepted(weekends.create("events", configuration()), "Create observed weekend"):
		return
	check(
		weekends.events("events").result.events.is_empty(),
		"Creation emits no historical observations"
	)
	accepted(weekends.command("events", "practice_start"), "Observe real phase approval")
	var observed = weekends.events("events").result
	var kinds: Array = []
	for event in observed.events:
		kinds.append(event.kind)
	check(
		"phase" in kinds and "input" in kinds and "event" in kinds,
		"Phase, input and domain facts are observed"
	)
	var baseline = snapshot("events")
	var empty = weekends.events("events").result
	check(empty.events.is_empty(), "Event reads drain observations exactly once")
	check(
		empty.next_sequence == observed.next_sequence,
		"An empty drain does not spend sequence numbers"
	)
	observed.events.clear()
	same(snapshot("events"), baseline, "Draining and editing observations preserve source journals")
	for index in range(1100):
		var response = weekends.command("events", "speed", {"value": 1 if index % 2 else 2})
		check(response.ok, "Overflow fixture uses accepted original commands")
	var overflow = weekends.events("events").result
	check(
		overflow.events.size() == 1024 and overflow.dropped > 0,
		"Observation memory is bounded with explicit loss"
	)
	for index in range(1, overflow.events.size()):
		check(
			overflow.events[index].sequence == overflow.events[index - 1].sequence + 1,
			"Retained event suffix preserves monotonically ordered transport sequence"
		)
	check(
		weekends.events("events").result.dropped == 0, "Drain resets only transport loss accounting"
	)
	check(
		weekends.recording("events").result.inputs.size() == 1101,
		"Transport overflow never truncates the production input trace"
	)


func planning_contracts() -> void:
	if not accepted(weekends.create("practice", configuration()), "Create SDK practice experiment"):
		return
	accepted(weekends.command("practice", "practice_start"), "Approve the actual practice session")
	var id: int = weekends.query("practice").result.player_ids[0]
	var car = weekends.query("practice", "car", {"id": id}).result
	var plan = {
		"objective": "tyre_life", "set_id": car.tyre_sets[0].id, "laps": 1, "baseline": "balanced"
	}
	var before = snapshot("practice")
	for view in [
		"practice",
		"strategy_draft",
		"strategy_forecast",
		"tactical_draft",
		"team_orders",
		"recovery",
		"decisions",
		"setup"
	]:
		var response = weekends.query("practice", view)
		if accepted(response, "Read production planning view " + view):
			response.result.clear()
	var preview = weekends.query("practice", "practice_preview", {"id": id, "plan": plan})
	if not accepted(preview, "Preview an explicit bounded practice plan"):
		return
	check(preview.result.available, "Production preview discloses a genuinely available run")
	same(snapshot("practice"), before, "Planning reads and previews do not consume clock or RNG")
	for parameters in [
		{"id": true, "plan": plan},
		{"id": id, "plan": "scalar"},
		{"id": id, "plan": {"objective": "unsupported"}},
		{"id": id, "plan": plan, "extra": true}
	]:
		rejected(
			weekends.query("practice", "practice_preview", parameters),
			"Malformed practice preview parameters",
			"INVALID_ARGUMENT"
		)
	same(snapshot("practice"), before, "Rejected preview inputs preserve sporting state")
	var payload = {
		"id": id,
		"plan": plan,
		"key": preview.result.key,
		"revision": preview.result.revision,
		"time": preview.result.time
	}
	accepted(
		weekends.command("practice", "practice_run", payload), "Approve the exact public preview"
	)
	var released = snapshot("practice")
	rejected(
		weekends.command("practice", "practice_run", payload),
		"Reused practice preview",
		"DOMAIN_REJECTED"
	)
	same(snapshot("practice"), released, "Stale approval cannot release a second run")
	plan.laps = 4
	check(
		weekends.recording("practice").result.inputs.back().payload.plan.laps == 1,
		"Accepted practice recording retains the detached original plan"
	)
	var advanced = weekends.step_ticks("practice", 15000)
	accepted(advanced, "Run the approved practice experiment through physical fixed ticks")
	var evidence = weekends.query("practice", "practice").result.driver
	check(
		not evidence.runs.is_empty() and not evidence.runs[0].samples.is_empty(),
		"SDK-approved practice produces measured lap evidence rather than injected results"
	)
	check(evidence.active.is_empty(), "Measured practice returns physically to the garage")
	var record = weekends.recording("practice").result
	check(
		RaceRecord.validate(record).is_empty(),
		"Practice approval and steps remain replay compatible"
	)


func scenario_contracts() -> void:
	var loaded = ContentPackLoader.new().load_packs(
		["res://config", "res://content/examples/club-racing"]
	)
	check(loaded.ok, "Addon scenario resolves against the production core catalog")
	if not loaded.ok:
		return
	var addon = DeveloperWeekends.new(loaded.catalog)
	var selection = {"scenario_id": "local.club.scenario.first-weekend"}
	var response = addon.create("authored-scenario", selection)
	if not accepted(response, "Create a file-authored addon scenario"):
		addon.close_all()
		return
	var launch = WeekendLaunch.new(loaded.catalog)
	check(
		launch.stage_scenario(selection.scenario_id),
		"Original launch resolves the same authored scenario"
	)
	var source = PracticeRaceSim.new(launch.visual_track(), launch.session_options())
	same(
		addon.snapshot("authored-scenario").result.snapshot,
		source.snapshot(),
		"Addon scenario uses the original source configuration and random stream"
	)
	check(
		(
			response.result.player_ids
			== loaded.catalog.roster("local.club.roster.privateer").player_ids()
		),
		"Addon player ownership comes from stable authored entries"
	)
	var recording = addon.recording("authored-scenario").result
	same(
		recording.parent.content_scenario.definition,
		loaded.catalog.scenario(selection.scenario_id).to_record(),
		"Scenario lineage freezes the authored definition"
	)
	rejected(
		addon.create("invalid-scenario", {"scenario_id": selection.scenario_id, "overrides": {}}),
		"Scenario overrides outside the authored contract",
		"INVALID_ARGUMENT"
	)
	addon.close_all()


func ownership_contracts() -> void:
	var source_ref = weekends.owned_record("events").source
	var record_ref = weakref(weekends.owned_record("events"))
	var before = snapshot("events")
	accepted(weekends.restore("events", before), "Valid native restore atomically replaces source")
	check(
		source_ref.get_ref() == null and record_ref.get_ref() == null,
		"Restore releases old simulation and observer"
	)
	same(snapshot("events"), before, "Restored native state")
	check(weekends.events("events").result.events.is_empty(), "Restore does not re-emit old events")
	var current_source = weekends.owned_record("events").source
	var current_record = weakref(weekends.owned_record("events"))
	accepted(weekends.close("events"), "Close releases an owned session")
	accepted(weekends.close("events"), "Repeated close is idempotent")
	check(
		current_source.get_ref() == null and current_record.get_ref() == null,
		"Terminal close releases source and record"
	)
	rejected(weekends.snapshot("events"), "Closed read", "SESSION_CLOSED")
	rejected(weekends.command("events", "speed", {"value": 1}), "Closed command", "SESSION_CLOSED")
	rejected(weekends.restore("events", before), "Closed restore", "SESSION_CLOSED")
	rejected(weekends.create("events", configuration()), "Terminal ID reuse", "SESSION_EXISTS")


func session_bounds() -> void:
	var bounded = DeveloperWeekends.new(catalog)
	for id in ["", " space", "a/b", "a".repeat(65)]:
		rejected(
			bounded.create(id, configuration()), "Invalid process-local ID", "INVALID_ARGUMENT"
		)
	var initial = snapshot("clock")
	for index in range(32):
		accepted(
			bounded.restore("bounded-%d" % index, initial), "Populate bounded session registry"
		)
	rejected(bounded.restore("overflow", initial), "Session capacity", "LIMIT_EXCEEDED")
	accepted(bounded.close("bounded-0"), "Bounded session closes terminally")
	rejected(
		bounded.restore("overflow", initial), "Closed tombstone retains ID bound", "LIMIT_EXCEEDED"
	)
	bounded.close_all()
