class_name ContentRuntimeProbe
extends RefCounted
## Explicit developer acceptance route in the exported executable, never auto-run.
## Uses the real launch/persistence paths in an isolated user directory supplied by the runner.
const PATH = "user://content-acceptance-session.json"

class ProbeStore:
	extends WeekendEntryStore
	func save_record(record: RaceRecord) -> String:
		return ReplayStorage.save_session(ContentRuntimeProbe.PATH, record)

static func start(catalog: ContentCatalog, vehicle: String, selection: Dictionary = {}) -> Dictionary:
	if catalog == null:
		return {"ok": false, "error": "No valid content catalog."}
	var read = Storage.read_json("res://data/tracks/hillside.json")
	if not read.ok: return read
	var options = {"laps": 2, "scenario": "dry", "intensity": "calm"}
	for key in selection:
		if key not in ["roster_id", "tyre_allocation_id", "setup_id"]:
			return {"ok": false, "error": "Unknown probe selection: " + str(key)}
		options[key] = selection[key]
	# This is an explicitly sized acceptance circuit, not an automatic fix applied
	# to user tracks. Normal launch still rejects a circuit with insufficient slots.
	if selection.has("roster_id"):
		var roster = catalog.roster(str(selection.roster_id))
		if roster == null: return {"ok": false, "error": "Unknown probe roster."}
		read.data.grid.count = roster.count
	var launch = WeekendLaunch.new(catalog)
	if not launch.stage(read.data, options, vehicle):
		return {"ok": false, "error": launch.last_error}
	var committed = launch.commit(int(launch.capture().revision), ProbeStore.new())
	if not committed.ok: return committed
	var sim: RaceSim = committed.simulation
	if sim.paused: sim.command("pause")
	for index in range(200): sim.step()
	var error = ReplayStorage.save_session(PATH, committed.record)
	committed.record.detach()
	if not error.is_empty(): return {"ok": false, "error": error}
	return restore()

static func restore() -> Dictionary:
	var read = Storage.read_json(PATH)
	if not read.ok: return read
	var restored = ReplayStorage.restore_session(read.data)
	if not restored.ok: return restored
	var sim: RaceSim = restored.sim
	var result = {"ok": true, "vehicle_id": sim.track.preset,
		"top_speed_mps": sim.track.vehicle_definition.top_speed_mps,
		"definition_hash": RaceStateValue.fingerprint(sim.track.authored_vehicle()),
		"phase": sim.phase, "time": sim.total_time,
		"checkpoint_hash": RaceStateValue.fingerprint(sim.snapshot()),
		"field_size": sim.cars.size(), "player_ids": sim.player_ids(),
		"roster_id": sim.roster_definition.id if sim.roster_definition != null else "legacy",
		"allocation_id": sim.tyre_rules.to_snapshot().allocation.id if sim.tyre_rules.authored() else "legacy",
		"compound_count": sim.tyre_rules.compounds().size(),
		"tyre_content_hash": RaceStateValue.fingerprint(sim.tyre_rules.to_snapshot()),
		"setup_id": sim.setup_definition.to_record().id if sim.setup_definition.authored() else "legacy",
		"setup_content_hash": RaceStateValue.fingerprint(sim.setup_definition.to_record())}
	var car: RaceCar = sim.cars[sim.player_ids()[0]]
	result.starting_compound = car.compound
	result.compound_wear = sim.tyre_rules.spec(car.compound).wear
	result.sets_per_driver = car.tyre_sets.size()
	result.wing = car.car_setup.wing
	restored.record.detach()
	return result
