extends SceneTree
## Development-only input ownership and rejection contract, not a shipping mechanic.
var checks: int = 0
var failures: Array[String] = []

class DraftProbe:
	extends RaceMechanic
	func definition() -> Dictionary:
		return {"id": "draft_probe", "version": 1, "requires": [], "hooks": ["command"]}
	func command(sim: RaceSim, action: String, payload: Dictionary = {}) -> bool:
		payload.metadata.items[0] = "provider-local"
		return sim.mechanics.before("draft_probe", "command", [action, payload])

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, label: String) -> void:
	checks += 1
	if not value:
		failures.append(label)
		push_error(label)

func run() -> void:
	var track = TrackGeometry.new(Storage.read_json("res://data/tracks/hillside.json").data)
	var profiles: Array = [RaceSim.new(track), StrategyRaceSim.new(track), WeatherRaceSim.new(track), RecoveryRaceSim.new(track), PracticeRaceSim.new(track)]
	for sim in profiles:
		rejections(sim)
		typed_rejections(sim)
		check(sim.command("practice_start" if sim.has_mechanic("practice") else "qualify"), "Fixture enters a real active session")
		for index in range(20): sim.step()
		rejections(sim)
		typed_rejections(sim)
		var payload = {"value": 2, "metadata": {"items": ["caller"], "optional": null}}
		check(sim.command("speed", payload), "Valid serialized metadata keeps the accepted command format")
		payload.metadata.items[0] = "changed afterwards"
		check(sim.commands.back().payload.metadata.items[0] == "caller", "Accepted history does not retain a caller draft")
	var probe_owner = RaceSim.new(track)
	check(probe_owner.mechanics.configure([DraftProbe.new()]) and probe_owner.mechanics.install(track, {}), "Development fixture installs explicitly without a shipping profile")
	var draft = {"value": 2, "metadata": {"items": ["caller"]}}
	check(RaceCommands.new(probe_owner).execute("speed", draft), "Application commands reach the aggregate-owned boundary")
	check(draft.metadata.items[0] == "caller", "A provider cannot mutate the caller's nested command draft")
	check(probe_owner.commands.back().payload.metadata.items[0] == "provider-local", "The provider receives a separate working payload")
	base_compatibility(track)
	shape_policy()
	var report = {"passed": failures.is_empty(), "checks": checks, "failures": failures}
	Storage.write_json("res://reports/command-contract-tests.json", report)
	print("COMMAND_CONTRACT_TESTS ", JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)

func rejections(sim: RaceSim) -> void:
	var cycle: Array = []; cycle.append(cycle)
	var dictionary_cycle: Dictionary = {}; dictionary_cycle["self"] = dictionary_cycle
	var oversized: Array = []; oversized.resize(20001)
	var deep: Variant = "leaf"
	for index in range(25): deep = [deep]
	var inputs: Array = [RefCounted.new(), NAN, INF, -INF, Vector2.ZERO, PackedByteArray([1]), {1: "numeric key"}, cycle, dictionary_cycle, oversized, deep]
	var accepted_inputs: Array = []
	var listener = func(action, _payload, _context): accepted_inputs.append(action)
	sim.input_accepted.connect(listener)
	var commands = RaceCommands.new(sim)
	for invalid in inputs:
		var payload = {"value": 2, "metadata": invalid}
		var before = RaceStateValue.fingerprint(sim.snapshot())
		check(not sim.command("speed", payload), "Invalid structural values are rejected by every profile before command dispatch")
		check(not sim.last_error.is_empty(), "Structural rejection explains the failed contract")
		check(before == RaceStateValue.fingerprint(sim.snapshot()), "Rejected input preserves all authoritative values, RNG and accepted journals")
		check(not commands.execute("speed", payload) and commands.last_error == sim.last_error, "Application reports the same rejection without copying invalid input first")
		check(before == RaceStateValue.fingerprint(sim.snapshot()), "Application rejection also preserves the complete state")
	check(accepted_inputs.is_empty(), "Rejected payloads cannot emit replay input records")
	sim.input_accepted.disconnect(listener)
	cycle.clear(); dictionary_cycle.clear()

func shape_policy() -> void:
	for value in [null, true, false, 1, 1.5, "text", &"name", [], {}, {"values": [null, 2.0, &"name"]}]:
		check(RaceStateValue.serializable(value) and TrackDocument.serializable(value), "Car/editor/command shape policy accepts existing serialized value types")
	var exact: Variant = "leaf"
	for index in range(24): exact = [exact]
	check(RaceStateValue.serializable(exact), "The existing maximum record depth remains supported")
	check(not RaceStateValue.serializable([exact]), "Depth beyond the existing record bound is rejected")
	var allowed: Array = []; allowed.resize(20000)
	check(RaceStateValue.serializable(allowed), "The existing collection count remains supported")
	allowed.append(null)
	check(not RaceStateValue.serializable(allowed), "The existing collection count is enforced")

func typed_rejections(sim: RaceSim) -> void:
	var before = RaceStateValue.fingerprint(sim.snapshot())
	var accepted: Array = []
	var listener = func(action, _payload, _context): accepted.append(action)
	sim.input_accepted.connect(listener)
	for action in ["speed", "pace", "engine"]:
		for value in [null, true, false, "2", [], {}, 1.5, -1, 17]:
			check(not sim.command(action, {"id": 3, "value": value}), "Scalar commands reject malformed types/ranges before conversion: " + action)
			check(not sim.last_error.is_empty(), "Malformed scalar feedback is explicit")
			check(before == RaceStateValue.fingerprint(sim.snapshot()), "Rejected scalar leaves all resources, ownership and RNG unchanged")
	for action in ["repair", "auto"]:
		for value in [null, "false", 0, 1, [], {}]:
			check(not sim.command(action, {"id": 3, "value": value}), "Boolean choices require actual Boolean values: " + action)
			check(before == RaceStateValue.fingerprint(sim.snapshot()), "Rejected Boolean cannot alter service, ownership, history or RNG")
	for target in [null, true, "3", [], {}, 3.5, -1, 12]:
		check(not sim.command("pace", {"id": target, "value": 2}), "Driver targets are integral identities, not coerced values")
		check(before == RaceStateValue.fingerprint(sim.snapshot()), "Invalid targeting leaves both teammates and accepted history unchanged")
	check(accepted.is_empty(), "Semantic command rejection emits no accepted replay input")
	sim.input_accepted.disconnect(listener)

func base_compatibility(track: TrackGeometry) -> void:
	# Absent base-only defaults and JSON integral floats remain the legacy contract.
	var sim = RaceSim.new(track)
	check(sim.command("speed") and sim.speed == 1, "Base speed keeps its absent-value default")
	check(sim.command("pace", {"id": 3.0, "value": 2.0}) and sim.cars[3].pace == 2, "Integral JSON numeric values remain valid")
	check(sim.commands.back().payload == {"id": 3.0, "value": 2.0}, "Accepted command records preserve their original payload")
	check(sim.command("pace", {"id": 3}) and sim.cars[3].pace == 1, "Base driving mode keeps its absent-value default")
	var original = sim.cars[3].auto
	check(sim.command("auto", {"id": 3}) and sim.cars[3].auto != original, "Base no-value auto keeps its legacy toggle")
	check(sim.command("repair", {"id": 3}) and sim.cars[3].repair, "Base repair keeps its absent-value default")
	check(sim.command("repair", {"id": 3, "value": false}) and not sim.cars[3].repair, "An explicit false is a valid service choice")
	check(sim.cars[6].pace == 1, "Valid explicit targeting still leaves the teammate independent")
