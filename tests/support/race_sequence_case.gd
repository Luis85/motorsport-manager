extends RefCounted
## Exercises the shipping application APIs. The source trace remains RaceRecord.
var sim: RaceSim
var session: MinimalRaceSession
var commands: RaceCommands
var record: RaceRecord
var trace: RaceReproduction
var checks = 0
var failures: Array = []
var index = -1
var operations: Array = []
var sequence_seed = 0
var observation_multiplier = 0
var restore_enabled = true
var retired_sources: Array[WeakRef] = []
var stats = {"accepted": 0, "rejected": 0, "restores": 0, "steps": 0, "observations": 0, "phases": []}

func check(value: bool, invariant: String, evidence: Dictionary = {}) -> void:
	checks += 1
	if not value:
		failures.append({"index": index, "invariant": invariant, "evidence": evidence})

func configure(initial: Dictionary, recipe: Array, seed_value: int,
		observers: int = 0, restores: bool = true) -> void:
	operations = recipe.duplicate(true)
	sequence_seed = seed_value
	observation_multiplier = observers
	restore_enabled = restores
	sim = PracticeRaceSim.restore_practice(initial)
	check(sim != null, "Initial practice checkpoint restores")
	if sim == null:
		return
	record = RaceRecord.new()
	record.attach(sim)
	bind_views()

func bind_views() -> void:
	session = MinimalRaceSession.new(sim)
	session.runner.automatic = false
	commands = RaceCommands.new(sim)
	trace = RaceReproduction.new()
	var revision = OS.get_environment("MOTORSPORT_SOURCE_REVISION")
	if revision.is_empty(): revision = OS.get_environment("GITHUB_SHA")
	if revision.is_empty(): revision = "local-sequence-fixture; source revision was not supplied"
	check(trace.attach(record, revision), "Developer evidence attaches to the current authoritative record")

func run() -> Dictionary:
	if sim == null:
		return {"passed": false, "checks": checks, "failures": failures}
	for next in operations.size():
		index = next
		for observation in observation_multiplier:
			observe()
		apply(operations[index])
		if sim.phase not in stats.phases: stats.phases.append(sim.phase)
		check(retired_sources.all(func(source): return source.get_ref() == null), "Restored sources are not retained by view or diagnostic adapters")
		if not failures.is_empty(): break
	var state = sim.snapshot()
	var accepted = record.inputs.duplicate(true)
	var bundle = trace.seal({"sequence_seed": sequence_seed, "operations": operations,
		"failures": failures, "domain": "race", "restore_enabled": restore_enabled,
		"observation_multiplier": observation_multiplier})
	var diagnostic = RaceReproduction.diagnose(bundle)
	check(diagnostic.get("ok", false) and diagnostic.get("matched", false), "Independent replay preserves the generated accepted-command outcome", diagnostic)
	var result = {"passed": failures.is_empty(), "checks": checks, "failures": failures,
		"stats": stats, "state": state, "inputs": accepted, "reproduction": bundle}
	trace.detach()
	record.detach()
	return result

func observe() -> void:
	var before = sim.snapshot()
	var count = record.inputs.size()
	var observation = session.view.query.capture()
	observation.clear()
	session.view.controls.stage()
	for driver in [3, 6]:
		session.view.controls.send_reason(driver)
		session.view.controls.box_reason(driver)
		session.view.controls.mode_reason(driver)
	check(RaceRecord.equivalent(before, sim.snapshot()) and count == record.inputs.size(), "Observation and caller mutation preserve state, gameplay RNG and accepted history")
	stats.observations += 1

func apply(operation: Dictionary) -> void:
	var before = sim.snapshot()
	var count = record.inputs.size()
	var accepted = true
	var controls = session.view.controls
	match operation.op:
		"select":
			accepted = controls.select_driver(int(operation.id))
			check(RaceRecord.equivalent(RaceRecord.sporting(before), RaceRecord.sporting(sim.snapshot())) and count == record.inputs.size(), "Driver selection has no sporting or accepted-history effects")
		"mode": accepted = controls.mode(int(operation.id), operation.channel, int(operation.value))
		"speed": accepted = controls.set_speed(int(operation.value))
		"pause": accepted = controls.pause()
		"play": accepted = controls.play()
		"stage": accepted = controls.advance_stage()
		"send": accepted = controls.send_out(int(operation.id))
		"box": accepted = controls.box(int(operation.id))
		"raw":
			accepted = commands.execute(operation.action, operation.payload)
			if not accepted:
				check(RaceRecord.equivalent(before, sim.snapshot()) and count == record.inputs.size(), "Rejected aggregate command preserves complete state, resources, gameplay RNG and accepted history")
		"observe":
			for observation in int(operation.count): observe()
		"advance":
			for frame in int(operation.frames):
				stats.steps += session.runner.advance(float(operation.delta))
				for observation in observation_multiplier: observe()
		"restore": restore()
		_:
			check(false, "Unknown operation in an explicitly bounded test recipe", operation)
			return
	if not accepted:
		stats.rejected += 1
		# Composite application actions can contain earlier accepted orders. Only a
		# wholly rejected operation has the aggregate's noninterference guarantee.
		if record.inputs.size() == count:
			check(RaceRecord.equivalent(before, sim.snapshot()), "Wholly rejected application input has no checkpoint effect")
	else:
		stats.accepted += 1
	trace.note_attempt(operation.op, operation, accepted, commands.last_error if operation.op == "raw" else controls.message)

func restore() -> void:
	var before = sim.snapshot()
	var archived = JSON.parse_string(JSON.stringify({"kind": ReplayStorage.SESSION_KIND,
		"version": 1, "record": record.seal()}, "", false, true))
	if not restore_enabled:
		check(RaceRecord.validate(archived.record).is_empty(), "Uninterrupted reference validates the same save boundary")
		return
	var restored = ReplayStorage.restore_session(archived)
	check(restored.ok, "Generated sequence resumes through the production session adapter", {"error": restored.get("error", "")})
	if not restored.ok: return
	trace.detach()
	record.detach()
	retired_sources.append(weakref(sim))
	sim = restored.sim
	record = restored.record
	bind_views()
	stats.restores += 1
	check(RaceRecord.equivalent(before, sim.snapshot()), "JSON save/restore retains complete checkpoint and numeric meaning")
