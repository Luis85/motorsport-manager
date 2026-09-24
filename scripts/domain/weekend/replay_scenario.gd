class_name ReplayScenario
extends RefCounted
## A shareable starting state plus inert author intent. Never an executable script.
const KIND = "motorsport-manager-scenario"

static func build(sim: PracticeRaceSim, lineage: Dictionary, brief: Dictionary) -> Dictionary:
	if sim == null or sim.phase == "results" or not ScenarioBrief.validate(brief).is_empty(): return {}
	if not RaceRecord.valid_id(lineage.get("event_id")): return {}
	var parent = lineage.duplicate(true); parent.scenario = brief.duplicate(true)
	var recorder = RaceRecord.new(); recorder.attach(sim, "sandbox", parent)
	var data = {"kind": KIND, "version": 1, "brief": brief.duplicate(true), "record": recorder.seal()}
	recorder.detach()
	data.digest = RaceRecord.fingerprint(data)
	return data

static func validate(data: Variant) -> String:
	if not data is Dictionary or (not data.get("kind") is String or data.kind != KIND) or not RaceCheckpoint.integral(data.get("version"), 1, 1): return "Unsupported scenario format."
	var error = ScenarioBrief.validate(data.get("brief"))
	if not error.is_empty(): return error
	error = RaceRecord.validate(data.get("record"))
	if not error.is_empty(): return error
	var record: Dictionary = data.record
	if record.origin != "sandbox" or int(record.steps) != 0 or not record.inputs.is_empty() or not record.marks.is_empty(): return "A scenario must contain one independent sandbox starting state."
	if record.initial.phase == "results": return "Choose a checkpoint before the result to author a scenario."
	if not RaceRecord.equivalent(record.initial, record.endpoint) or not RaceRecord.equivalent(record.parent.get("scenario"), data.brief): return "Scenario briefing and frozen source disagree."
	var content = data.duplicate(true); content.erase("digest")
	if (not data.get("digest") is String or data.digest != RaceRecord.fingerprint(content)): return "Scenario integrity check failed."
	return ""
