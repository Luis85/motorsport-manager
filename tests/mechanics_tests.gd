extends SceneTree
## Construction contracts, profile composition and saved-state ownership.
var checks: int = 0
var failures: Array[String] = []

class Probe:
	extends RaceMechanic
	var installations: int = 0
	func definition() -> Dictionary:
		return {"id": "probe", "version": 1, "requires": [], "hooks": ["forecast_parameters"]}
	func install(_sim: RaceSim, _geometry: TrackGeometry = null, _options: Dictionary = {}) -> void:
		installations += 1
	func forecast_parameters(_sim: RaceSim, id: int) -> Dictionary:
		return {"driver_id": id, "probe": true}

class Malformed:
	extends RaceMechanic
	var record: Dictionary = {}
	func definition() -> Dictionary:
		return record

class WrongArguments:
	extends Probe
	func definition() -> Dictionary:
		return {"id": "bad-arguments", "version": 1, "requires": [], "hooks": ["weather_advice"]}
	func weather_advice(_sim: RaceSim) -> Dictionary:
		return {}

class WrongType:
	extends Probe
	func definition() -> Dictionary:
		return {"id": "bad-type", "version": 1, "requires": [], "hooks": ["weather_advice"]}
	func weather_advice(_sim: RaceSim, _id: String) -> Dictionary:
		return {}

class WrongReturn:
	extends Probe
	func definition() -> Dictionary:
		return {"id": "bad-return", "version": 1, "requires": [], "hooks": ["weather_advice"]}
	func weather_advice(_sim: RaceSim, _id: int) -> int:
		return 0

class UnknownHook:
	extends Probe
	func definition() -> Dictionary:
		return {"id": "unused-hook", "version": 1, "requires": [], "hooks": ["never_dispatched"]}
	func never_dispatched(_sim: RaceSim) -> void:
		pass

class UndispatchedHelper:
	extends Probe
	func definition() -> Dictionary:
		return {"id": "helper", "version": 1, "requires": [], "hooks": ["random_value"]}
	func random_value(_sim: RaceSim) -> float:
		return 1.0

class VoidReturn:
	extends Probe
	func definition() -> Dictionary:
		return {"id": "void-return", "version": 1, "requires": [], "hooks": ["weather_advice"]}
	func weather_advice(_sim: RaceSim, _id: int) -> void:
		pass

class MutatingInstall:
	extends Probe
	func install(_sim: RaceSim, geometry: TrackGeometry = null, options: Dictionary = {}) -> void:
		installations += 1
		geometry.document.name = "Provider-local geometry"
		options.nested.value = 99

func check(value: bool, label: String) -> void:
	checks += 1
	if not value:
		failures.append(label)
		push_error(label)

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var track = TrackGeometry.new(Storage.read_json("res://data/tracks/hillside.json").data)
	construction_value_contracts(track)
	var raw = RaceSim.new(track)
	var probe = Probe.new()
	check(raw.mechanics.configure([probe]), "A mechanic can be installed without adding a simulation subclass")
	check(raw.mechanics.install(track, {}), "Configured mechanics install once")
	check(not raw.mechanics.install(track, {}) and probe.installations == 1, "Repeated installation cannot reset authoritative state")
	check(raw.forecast_parameters(3) == {"driver_id": 3, "probe": true}, "Configured hook receives explicit caller state and arguments")
	check(raw.has_mechanic("probe") and not raw.has_mechanic("practice"), "Capabilities describe the actual installed systems")
	check(not raw.mechanics.configure([Probe.new()]), "Active composition is not reconfigured after construction")
	var catalog = raw.mechanic_catalog()
	catalog[0].id = "edited"
	check(raw.has_mechanic("probe"), "Catalog editing cannot rewrite installed identities")
	for bad in [[{"id": "bad", "version": 1, "requires": ["missing"], "hooks": []}],
		[{"id": "same", "version": 1, "requires": [], "hooks": []}, {"id": "same", "version": 1, "requires": [], "hooks": []}],
		[{"id": "bad", "version": 0, "requires": [], "hooks": []}],
		[{"id": "bad", "version": 1, "requires": [], "hooks": ["step", "step"]}]]:
		check(not RaceMechanics.validate(bad).is_empty(), "Invalid composition is rejected before installation")
	var rejecting = RaceSim.new(track)
	for invalid in [null, 4, "provider", {}, [], RefCounted.new()]:
		check(not rejecting.mechanics.configure([invalid]), "Wrong provider type is rejected without an engine exception")
		check(not rejecting.mechanics.last_error.is_empty() and rejecting.mechanic_catalog().is_empty(), "Failed configuration explains the problem and publishes nothing")
	var malformed = Malformed.new()
	for definition in [{}, {"id":"invalid", "version":1, "requires":[], "hooks":[123]},
		{"id":"invalid", "version":1, "requires":"no", "hooks":[]},
		{"id":"invalid", "version":1, "requires":[], "hooks":["missing"]}]:
		malformed.record = definition
		check(not rejecting.mechanics.configure([malformed]), "Malformed hook metadata is rejected before reflection or installation")
	check(rejecting.mechanics.configure([Probe.new()]) and rejecting.mechanics.install(track, {}), "Corrected configuration can be retried after rejected proposals")
	check(RaceMechanicProfiles.build("unknown").is_empty(), "Unknown profile does not silently install a different rule set")
	var contract_owner = RaceSim.new(track)
	var before_contract = RaceStateValue.fingerprint(contract_owner.snapshot())
	for invalid in [WrongArguments.new(), WrongType.new(), WrongReturn.new(), UnknownHook.new(), UndispatchedHelper.new(), VoidReturn.new()]:
		check(not contract_owner.mechanics.configure([invalid]), "Incompatible extension contract is rejected before first execution")
		check(invalid.installations == 0 and contract_owner.mechanic_catalog().is_empty(), "Rejected extension never installs partial state")
		check(not contract_owner.mechanics.last_error.is_empty(), "Extension authors receive an actionable contract error")
	check(before_contract == RaceStateValue.fingerprint(contract_owner.snapshot()), "Contract rejection leaves simulation and RNG intact")
	var isolated = RaceSim.new(track)
	var installation_options = {"nested": {"value": 1}}
	var original_name = track.document.name
	check(isolated.mechanics.configure([MutatingInstall.new()]) and isolated.mechanics.install(track, installation_options), "A valid extension installs using detached inputs")
	check(installation_options.nested.value == 1 and track.document.name == original_name, "Installation cannot mutate caller options or editor geometry")
	var profiles: Array = [StrategyRaceSim.new(track), WeatherRaceSim.new(track), RecoveryRaceSim.new(track), PracticeRaceSim.new(track)]
	for index in range(profiles.size()):
		var sim: RaceSim = profiles[index]
		check(sim.mechanic_catalog().size() == index + 1, "Profile installs its documented set of mechanics")
		check(sim.get_script().get_base_script() == RaceSim, "Compatibility profile directly extends the aggregate, not another profile")
	var session: RaceSim = profiles.back()
	var restored = PracticeRaceSim.restore_practice(session.snapshot())
	check(restored != null and restored.has_mechanic("practice"), "Production restore reconstructs composition without changing save schema")
	if restored:
		var before = RaceStateValue.fingerprint(session.snapshot())
		restored.command("practice")
		check(before == RaceStateValue.fingerprint(session.snapshot()), "A restored session cannot mutate its source")
	var before_predecessor = RaceStateValue.fingerprint(session.snapshot())
	check(session.mechanics.before("missing", "command", ["speed", {"value": 2}]) == null, "Unknown predecessor fails without invoking a command")
	check(session.mechanics.last_error.contains("Unknown mechanic predecessor"), "Unknown predecessor reports its identity contract")
	check(raw.mechanics.before("probe", "command", ["speed", {"value": 2}]) == null, "A known provider cannot invoke an undeclared predecessor hook")
	check(raw.mechanics.last_error.contains("undeclared predecessor hook"), "Undeclared predecessor explains the missing ownership declaration")
	check(before_predecessor == RaceStateValue.fingerprint(session.snapshot()), "Invalid predecessor diagnostics leave sporting state and RNG intact")
	check(raw.speed == 1 and raw.commands.is_empty(), "Undeclared predecessor does not execute or record the requested command")
	check(session.mechanics.before("practice", "forecast_parameters", [3]) is Dictionary, "Valid predecessor ordering remains usable after rejected calls")
	check(session.mechanics.last_error.is_empty(), "Successful predecessor lookup clears stale developer diagnostics")
	var weak = weakref(raw)
	raw = null
	check(weak.get_ref() == null, "Installed mechanic dispatch does not create an aggregate reference cycle")
	var report = {"passed": failures.is_empty(), "checks": checks, "failures": failures}
	Storage.write_json("res://reports/mechanics-tests.json", report)
	print("MECHANICS_TESTS ", JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)

func construction_value_contracts(track: TrackGeometry) -> void:
	var owner = RaceSim.new(track)
	var before = RaceStateValue.fingerprint(owner.snapshot())
	var malformed = Malformed.new()
	var cycle: Array = []; cycle.append(cycle)
	for invalid in [RefCounted.new(), NAN, INF, {1: "non-string key"}, cycle]:
		malformed.record = {"id": "metadata_probe", "version": 1, "requires": [], "hooks": [], "metadata": invalid}
		check(not owner.mechanics.configure([malformed]), "Invalid extra metadata is rejected before recursive copying")
		check(owner.mechanics.last_error.contains("serialized values"), "Metadata errors explain the structural contract")
		check(owner.mechanic_catalog().is_empty(), "Invalid metadata cannot publish a partial composition")
		check(RaceStateValue.fingerprint(owner.snapshot()) == before, "Rejected metadata leaves the aggregate and RNG intact")
	for identity in [" leading", "trailing ", "bad identity", "bad\tidentity", "bad\nidentity", "bad\u00a0identity"]:
		malformed.record = {"id": identity, "version": 1, "requires": [], "hooks": []}
		check(not owner.mechanics.configure([malformed]), "Runtime rejects whitespace identities just like the authoring tool")
		check(owner.mechanics.last_error.contains("whitespace"), "Identity rejection has an actionable diagnosis")
	var first = Probe.new()
	check(owner.mechanics.configure([first]), "A correct configuration is retryable after invalid metadata")
	for invalid in [RefCounted.new(), NAN, cycle]:
		check(not owner.mechanics.install(track, {"metadata": invalid}), "Invalid installation options fail before provider execution")
		check(first.installations == 0, "Rejected options cannot run even the first provider")
		check(owner.mechanics.last_error.contains("options") and owner.mechanics.last_error.contains("serialized values"), "Installation error identifies invalid options")
		check(RaceStateValue.fingerprint(owner.snapshot()) == before, "Rejected installation preserves sporting state and RNG")
	check(owner.mechanics.install(track, {}), "A corrected install can retry without reconfiguring providers")
	check(first.installations == 1 and owner.mechanics.last_error.is_empty(), "Corrected installation runs once and clears diagnostics")
	check(not owner.mechanics.install(track, {}) and first.installations == 1, "Retry protection still prevents installing twice")
	cycle.clear()
