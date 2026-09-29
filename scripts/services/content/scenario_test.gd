class_name ContentScenarioTest
extends RefCounted
## Bounded, non-persistent execution via the same validated launch/record boundary.
## A passing segment is not a completed race or a balance/visual acceptance test.
class MemoryStore:
	extends WeekendEntryStore
	func save_record(record: RaceRecord) -> String:
		return RaceRecord.validate(record.seal())

static func run(catalog: ContentCatalog, id: String, limit: int) -> Dictionary:
	if limit < 1 or limit > 20000:
		return {"ok": false, "error": "Choose 1–20000 fixed steps.", "simulation_executed": false}
	var launch = WeekendLaunch.new(catalog)
	if not launch.stage_scenario(id):
		return {"ok": false, "error": launch.last_error, "simulation_executed": false}
	var committed = launch.commit(launch.capture().revision, MemoryStore.new())
	if not committed.ok:
		return {"ok": false, "error": committed.error, "simulation_executed": false}
	var sim: RaceSim = committed.simulation
	if sim.paused:
		sim.command("pause")
	var executed = 0
	for index in range(limit):
		if sim.paused or sim.phase not in RaceSim.ACTIVE:
			break
		sim.step()
		executed += 1
	var record = committed.record.seal()
	var data = ContentJson.parse(JSON.stringify({"kind": "motorsport-manager-session", "version": 1, "record": record}, "", true, true), true)
	var restored = ReplayStorage.restore_session(data.data) if data.ok else {"ok": false, "error": data.error}
	var equivalent = restored.ok and RaceRecord.equivalent(sim.snapshot(), restored.sim.snapshot())
	var result = {"ok": equivalent, "scenario_id": id, "simulation_executed": executed > 0,
		"requested_steps": limit, "executed_steps": executed, "phase": sim.phase,
		"simulated_seconds": sim.total_time, "field_size": sim.cars.size(), "player_ids": sim.player_ids(),
		"checkpoint_restored": equivalent, "complete_weekend": sim.phase == "results",
		"checkpoint_hash": RaceStateValue.fingerprint(sim.snapshot()), "seed": sim.seed_value,
		"scope": "Bounded fixed-step segment and saved-state round trip; not balance or visual acceptance."}
	if not equivalent:
		result.error = restored.get("error", "Restored simulation differs from the source.")
	if restored.ok:
		restored.record.detach()
	committed.record.detach()
	return result
