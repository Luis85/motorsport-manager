extends SceneTree
## The presentation holds capabilities and detached values, never a live race aggregate.
var checks: int = 0
var failures: Array[String] = []
func _initialize() -> void:
	call_deferred("run")
func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)
func run() -> void:
	var document = Storage.read_json("res://data/tracks/hillside.json").data
	var raw = PracticeRaceSim.new(TrackGeometry.new(document), {"laps":6, "seed":7314, "intensity":"calm"})
	var query = RaceViewQuery.new(raw)
	var commands = RaceCommands.new(raw)
	var before = RaceStateValue.fingerprint(raw.snapshot())
	var cars = query.cars
	cars[3].fuel = 0.0
	cars[3].tyre_sets[0].wheels.FL.life = 0.0
	query.track.document.name = "Read-only viewer geometry"
	query.policy(3).owners.engine = "other"
	query.practice_driver(3).runs.clear()
	check(before == RaceStateValue.fingerprint(raw.snapshot()), "Displayed car, wheel, policy, practice and geometry values cannot write the race")
	check(query.car(3).fuel == raw.cars[3].fuel and query.car_count == 12, "Individual car queries return current owned values")
	check(query.car(-1).is_empty() and query.car(12).is_empty(), "Invalid car identities return unavailable, not another driver")
	for forbidden in ["command", "step", "advance", "tick", "restore"]:
		check(not query.has_method(forbidden), "Read handle has no " + forbidden + " authority")
	for id in [3,6]:
		query.forecast(id)
		query.forecast_parameters(id)
		query.weather_advice(id)
		query.recovery_advice(id)
		query.tactical_current(id)
		query.team_orders_preview()
		query.standings()
	check(before == RaceStateValue.fingerprint(raw.snapshot()), "Legacy diagnostic queries remain observational, including RNG and journal")
	var payload = {"id":3, "value":2}
	commands.select_driver(6)
	check(commands.execute("pace", payload) and raw.cars[3].pace == 2 and raw.cars[6].pace != 2, "Commands keep explicit recipients even after a different car is selected")
	check(payload == {"id":3,"value":2}, "Accepted commands cannot mutate caller payloads")
	before = RaceStateValue.fingerprint(raw.snapshot())
	check(not commands.execute("pace", {"id":0,"value":2}) and not commands.last_error.is_empty(), "Rival commands are rejected with actionable feedback")
	check(before == RaceStateValue.fingerprint(raw.snapshot()), "Rejected rival commands do not alter the saved sporting state")
	var weak = weakref(raw)
	raw = null
	check(weak.get_ref() == null and not query.available(), "Readers and command handles do not keep a discarded session alive")
	check(query.cars.is_empty() and query.car(3).is_empty() and not commands.execute("pause"), "Expired handles fail safely without stale simulation authority")
	var lifetime_model = PracticeRaceSim.new(TrackGeometry.new(document))
	var lifetime = weakref(lifetime_model)
	var session = RaceViewSession.new(lifetime_model)
	lifetime_model = null
	check(lifetime.get_ref() != null, "The application binding owns its active simulation")
	session = null
	check(lifetime.get_ref() == null, "Discarding a binding disconnects the optional director and releases its simulation")
	var plain = {"name":"Deterministic road", "nodes":[{"x":-100,"y":-100},{"x":100,"y":-100},{"x":100,"y":100},{"x":-100,"y":100}]}
	var a = TrackDocument.normalize(plain)
	var b = TrackDocument.normalize(plain)
	check(a == b, "Normalizing a document does not depend on the wall clock")
	var identity = TrackDocument.next_node_id(a.nodes)
	a.nodes.append(TrackDocument.node_at(Vector2.ZERO, 14.0, identity))
	check(TrackDocument.next_node_id(a.nodes) != identity, "New road points receive unused document-local identities")
	var report = {"passed":failures.is_empty(), "checks":checks, "failures":failures}
	Storage.write_json("res://reports/presentation-boundary-tests.json", report)
	print("PRESENTATION_BOUNDARY_TESTS ", JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
