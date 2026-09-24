class_name ReplayStorage
extends RefCounted
## Imports are observational. Only App's existing local continuation path resumes
## original authority; a shared recording can create sandbox experiments, not prizes.
const SESSION_KIND = "motorsport-manager-session"

static func save_session(path: String, record: RaceRecord) -> String:
	var data = record.seal()
	if data.is_empty(): return "The recording source is unavailable."
	return Storage.write_json(path, {"kind": SESSION_KIND, "version": 1, "record": data})

static func restore_session(data: Variant, sandbox: bool = false) -> Dictionary:
	if not data is Dictionary or data.get("kind") != SESSION_KIND or data.get("version") != 1: return {"ok": false, "error": "Unsupported session envelope."}
	var error = RaceRecord.validate(data.get("record"))
	if not error.is_empty(): return {"ok": false, "error": error}
	if (data.record.origin == "sandbox") != sandbox: return {"ok": false, "error": "Original and sandbox continuation slots cannot replace one another."}
	var sim = PracticeRaceSim.restore_practice(RaceRecord.apply_types(data.record.endpoint, data.record.endpoint_integers))
	var record = RaceRecord.resume(data.record, sim)
	return {"ok": true, "sim": sim, "record": record}
