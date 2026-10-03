extends SceneTree
## A deliberate, unjournaled test defect must be localized by ordinary replay.
var checks = 0
var failures: Array[String] = []


func _initialize() -> void:
	call_deferred("run")


func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)


func run() -> void:
	var read = Storage.read_json("res://config/circuits/hillside.json")
	var sim = PracticeRaceSim.new(TrackGeometry.new(read.data), {"seed": 7314, "scenario": "dry"})
	var record = RaceRecord.new()
	record.attach(sim)
	# Connected before the diagnostic observer, after the recorder's step counter.
	var defect = func():
		if record.steps == 5:
			sim.cars[3].fuel -= 0.125
	sim.fixed_step_completed.connect(defect)
	var trace = RaceReproduction.new()
	var revision = OS.get_environment("MOTORSPORT_SOURCE_REVISION")
	if revision.is_empty():
		revision = OS.get_environment("GITHUB_SHA")
	if revision.is_empty():
		revision = "local-test-fixture; source revision was not supplied"
	check(trace.attach(record, revision), "A developer observer attaches to the existing recorder")
	var commands = RaceCommands.new(sim)
	check(commands.execute("practice_start"), "Reproduction starts a real practice session")
	for index in range(12):
		sim.step()
	var before = RaceStateValue.fingerprint(sim.snapshot())
	var count = record.inputs.size()
	var accepted = commands.execute("speed", {"value": 3})
	trace.note_attempt("speed", {"value": 3}, accepted, commands.last_error)
	check(
		not accepted and before == RaceStateValue.fingerprint(sim.snapshot()),
		"Rejected attempt preserves complete sporting state"
	)
	check(record.inputs.size() == count, "Rejected diagnostics are not accepted replay history")
	var bundle = trace.seal({"invariant": "No uncommanded fuel change", "test_defect": true})
	check(
		RaceReproduction.validate(bundle).is_empty(),
		"The failure bundle retains a valid existing replay"
	)
	var result = RaceReproduction.diagnose(bundle)
	check(result.ok and not result.matched, "A fresh replay detects the injected defect")
	check(
		result.first_divergence.get("step") == 5,
		"The first differing fixed step is recorded, not guessed"
	)
	check(
		result.first_divergence.get("path") == "cars[3].fuel",
		"The first meaningful value names the affected field"
	)
	check(
		(
			not result.first_divergence.is_empty()
			and (
				absf(
					(
						float(result.first_divergence.get("observed", 0))
						- float(result.first_divergence.get("expected", 0))
						- 0.125
					)
				)
				< 0.000001
			)
		),
		"Expected and observed are actual recorded values"
	)
	check(
		bundle.attempts.size() == 1 and not bundle.attempts[0].accepted,
		"Rejected input remains solely in the diagnostic sidecar"
	)
	check(
		Storage.write_json("res://reports/reproduction-defect.json", bundle).is_empty(),
		"The developer failure bundle is independently readable"
	)
	var decoded = Storage.read_json("res://reports/reproduction-defect.json")
	var isolated = RaceReproduction.diagnose(decoded.data)
	check(
		RaceRecord.equivalent(
			isolated.get("first_divergence", {}), result.get("first_divergence", {})
		),
		"JSON round-trip reproduces identical first-divergence evidence"
	)
	trace.detach()
	sim.fixed_step_completed.disconnect(defect)
	record.detach()
	# Successful ordinary exploration is evidence, not a replacement pinned fixture.
	record.attach(sim)
	check(trace.attach(record, revision), "New trace starts an independent bounded window")
	for index in range(70):
		sim.step()
	for index in range(70):
		trace.note_attempt("unknown", {}, false, "Unknown command")
	var bounded = trace.seal({})
	check(
		(
			bounded.boundaries.size() <= RaceReproduction.MAX_BOUNDARIES
			and bounded.dropped_boundaries > 0
		),
		"Observation windows disclose truncation"
	)
	check(
		bounded.attempts.size() == RaceReproduction.MAX_ATTEMPTS and bounded.dropped_attempts == 6,
		"Rejected-input diagnostics are bounded"
	)
	check(
		RaceReproduction.diagnose(bounded).matched,
		"Healthy continuation matches even when earlier diagnostics were dropped"
	)
	var cycle: Array = []
	cycle.append(cycle)
	trace.note_attempt("speed", {"value": cycle}, false, "Invalid input")
	check(
		not trace.seal({}).attempts.back().payload_retained,
		"Cyclic rejected payloads are described without unsafe copying"
	)
	cycle.clear()
	var invalid = bounded.duplicate(true)
	invalid.boundaries.append(invalid.boundaries.back())
	check(
		not RaceReproduction.validate(invalid).is_empty(),
		"Malformed diagnostic windows fail closed"
	)
	check(
		StateDivergence.first({"x": null}, {}).expected_present,
		"Missing fields are distinguished from null"
	)
	trace.detach()
	record.detach()
	var report = {
		"passed": failures.is_empty(),
		"checks": checks,
		"failures": failures,
		"defect_evidence": result,
		"bundle": "reproduction-defect.json"
	}
	Storage.write_json("res://reports/reproduction-tests.json", report)
	print("REPRODUCTION_TESTS ", JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
