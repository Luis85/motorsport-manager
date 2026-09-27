extends SceneTree
## Construction contracts, profile composition and saved-state ownership.
var checks: int = 0
var failures: Array[String] = []

class Probe:
	extends RefCounted
	var installations: int = 0
	func definition() -> Dictionary:
		return {"id": "probe", "version": 1, "requires": [], "hooks": ["forecast_parameters"]}
	func install(_sim: RaceSim, _geometry: TrackGeometry, _options: Dictionary) -> void:
		installations += 1
	func forecast_parameters(_sim: RaceSim, id: int) -> Dictionary:
		return {"driver_id": id, "probe": true}

func check(value: bool, label: String) -> void:
	checks += 1
	if not value:
		failures.append(label)
		push_error(label)

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var track = TrackGeometry.new(Storage.read_json("res://data/tracks/hillside.json").data)
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
	var weak = weakref(raw)
	raw = null
	check(weak.get_ref() == null, "Installed mechanic dispatch does not create an aggregate reference cycle")
	var report = {"passed": failures.is_empty(), "checks": checks, "failures": failures}
	Storage.write_json("res://reports/mechanics-tests.json", report)
	print("MECHANICS_TESTS ", JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
