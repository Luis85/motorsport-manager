class_name ContentRuntimeProbe
extends RefCounted
## Explicit developer acceptance route in the exported executable, never auto-run.
## Uses the real launch/persistence paths in an isolated user directory supplied by the runner.
const PATH = "user://content-acceptance-session.json"

class ProbeStore:
	extends WeekendEntryStore
	func save_record(record: RaceRecord) -> String:
		return ReplayStorage.save_session(ContentRuntimeProbe.PATH, record)

static func start(catalog: ContentCatalog, vehicle: String) -> Dictionary:
	if catalog == null:
		return {"ok": false, "error": "No valid content catalog."}
	var read = Storage.read_json("res://data/tracks/hillside.json")
	if not read.ok: return read
	var launch = WeekendLaunch.new(catalog)
	if not launch.stage(read.data, {"laps": 2, "scenario": "dry", "intensity": "calm"}, vehicle):
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
		"checkpoint_hash": RaceStateValue.fingerprint(sim.snapshot())}
	restored.record.detach()
	return result
