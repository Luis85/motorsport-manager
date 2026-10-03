class_name RecordedWeekendContinuation
extends RefCounted
## Pure production session validation and reconstruction; services retain file I/O.
const SESSION_KIND = "motorsport-manager-session"


static func restore_session(data: Variant, sandbox: bool = false) -> Dictionary:
	if not RaceStateValue.serializable(data):
		return {"ok": false, "error": "Session envelope requires bounded finite JSON values."}
	if (
		not data is Dictionary
		or (not data.get("kind") is String or data.kind != SESSION_KIND)
		or not RaceCheckpoint.integral(data.get("version"), 1, 1)
	):
		return {"ok": false, "error": "Unsupported session envelope."}
	var error = RaceRecord.validate(data.get("record"))
	if not error.is_empty():
		return {"ok": false, "error": error}
	if (
		data.record.engine != Engine.get_version_info().string
		or not RaceRecord.model_supported(data.record)
	):
		return {
			"ok": false,
			"error":
			(
				"Saved engine or model differs. Open it as a replay to inspect or "
				+ "create a new labeled sandbox; original continuation was not changed."
			)
		}
	if (data.record.origin == "sandbox") != sandbox:
		return {
			"ok": false,
			"error": "Original and sandbox continuation slots cannot replace one another."
		}
	var sim = PracticeRaceSim.restore_practice(
		RaceRecord.apply_types(data.record.endpoint, data.record.endpoint_integers)
	)
	if sim == null or not sim.last_error.is_empty():
		return {"ok": false, "error": "The recording endpoint could not restore a valid weekend."}
	var record = RaceRecord.resume(data.record, sim)
	return {"ok": true, "sim": sim, "record": record}
