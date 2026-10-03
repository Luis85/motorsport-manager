class_name ReplayStorage
extends RefCounted
## Imports are observational. Only App's existing local continuation path resumes
## original authority; a shared recording can create sandbox experiments, not prizes.
const SESSION_KIND = RecordedWeekendContinuation.SESSION_KIND


static func save_session(path: String, record: RaceRecord) -> String:
	var data = record.seal()
	if data.is_empty():
		return "The recording source is unavailable."
	return Storage.write_json(path, {"kind": SESSION_KIND, "version": 1, "record": data})


static func restore_session(data: Variant, sandbox: bool = false) -> Dictionary:
	return RecordedWeekendContinuation.restore_session(data, sandbox)
