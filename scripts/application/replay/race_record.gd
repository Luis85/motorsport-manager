class_name RaceRecord
extends RaceRecordFormat
## Optional observer: one exact outer-command trace, independent of the evidence journal.
## Bounded snapshots are captured only at explicit bookmarks, save/export and race start.
var source: WeakRef
var event_id = ""
var origin = "standalone"
var parent: Dictionary = {}
var initial: Dictionary = {}
var inputs: Array = []
var marks: Array = []
var steps = 0
var incomplete = ""
var last_phase = ""


static func identity() -> String:
	# Identity is a service concern, never a draw from a sporting random stream.
	return Crypto.new().generate_random_bytes(16).hex_encode()


func attach(sim: RaceSim, mode: String = "standalone", lineage: Dictionary = {}) -> void:
	detach()
	inputs.clear()
	marks.clear()
	steps = 0
	incomplete = ""
	source = weakref(sim)
	origin = mode
	parent = lineage.duplicate(true)
	event_id = identity()
	initial = sim.snapshot()
	last_phase = sim.phase
	_connect(sim)


func detach() -> void:
	var sim = source.get_ref() if source != null else null
	if sim != null:
		if sim.input_accepted.is_connected(_accepted):
			sim.input_accepted.disconnect(_accepted)
		if sim.fixed_step_completed.is_connected(_stepped):
			sim.fixed_step_completed.disconnect(_stepped)
	source = null


func _connect(sim: RaceSim) -> void:
	source = weakref(sim)
	sim.input_accepted.connect(_accepted)
	sim.fixed_step_completed.connect(_stepped)


func _accepted(action: String, payload: Dictionary, context: Dictionary) -> void:
	if not incomplete.is_empty():
		return
	if inputs.size() >= MAX_INPUTS:
		incomplete = (
			"Recording limit reached (4096 accepted inputs). Saved snapshots "
			+ "remain usable; continuous replay is unavailable."
		)
		return
	inputs.append(
		{
			"step": steps,
			"action": action,
			"payload": payload.duplicate(true),
			"context": context.duplicate(true),
			"integers": integer_paths(payload)
		}
	)


func _stepped() -> void:
	steps += 1
	if steps > MAX_STEPS:
		incomplete = (
			"Recording step limit reached. Saved snapshots remain usable; "
			+ "continuous replay is unavailable."
		)
	var sim = source.get_ref() if source != null else null
	if sim.phase != last_phase:
		last_phase = sim.phase
		if sim.phase == "race" and marks.size() < MAX_MARKS:
			bookmark("Race start")


func bookmark(label: String) -> String:
	if marks.size() >= MAX_MARKS:
		return (
			"Four checkpoints retained. Export this recording before starting a "
			+ "separate experiment."
		)
	var sim = source.get_ref() if source != null else null
	if sim == null:
		return "The source weekend is no longer available."
	var title = label.strip_edges()
	if title.is_empty() or title.length() > 64:
		return "Name the checkpoint using 1–64 characters."
	var snapshot = sim.snapshot()
	marks.append(
		{
			"label": title,
			"step": steps,
			"cursor": inputs.size(),
			"snapshot": snapshot,
			"integers": integer_paths(snapshot)
		}
	)
	return ""


func seal() -> Dictionary:
	var sim = source.get_ref() if source != null else null
	if sim == null:
		return {}
	var endpoint = sim.snapshot()
	var manifest = manifest_for(initial)
	var data = {
		"kind": KIND,
		"version": VERSION,
		"model": model_for(initial),
		"engine": Engine.get_version_info().string,
		"event_id": event_id,
		"origin": origin,
		"parent": parent.duplicate(true),
		"manifest": manifest,
		"initial": initial.duplicate(true),
		"inputs": inputs.duplicate(true),
		"initial_integers": integer_paths(initial),
		"endpoint_integers": integer_paths(endpoint),
		"marks": marks.duplicate(true),
		"steps": steps,
		"incomplete": incomplete,
		"endpoint": endpoint
	}
	data.digest = fingerprint(data)
	return data


static func validate(data: Variant) -> String:
	if (
		not data is Dictionary
		or (not data.get("kind") is String or data.kind != KIND)
		or not RaceCheckpoint.integral(data.get("version"), VERSION, VERSION)
	):
		return "Unsupported replay format."
	if (
		not valid_id(data.get("event_id"))
		or data.get("origin") not in ["standalone", "legacy", "sandbox"]
	):
		return "Invalid recording identity or provenance."
	if not data.get("parent") is Dictionary or not data.get("manifest") is Dictionary:
		return "Missing recording provenance."
	if data.origin == "sandbox" and not valid_id(data.parent.get("event_id")):
		return "Sandbox parent identity is missing."
	if not ContentScenarioDefinition.valid_record_context(data):
		return "Saved scenario context does not match its weekend or circuit."
	if data.parent.has("scenario") and not ScenarioBrief.validate(data.parent.scenario).is_empty():
		return "Invalid saved scenario brief."
	if not data.get("model") is String or data.model.length() > 100:
		return "Missing simulation model version."
	if not data.get("engine") is String or data.engine.length() > 100:
		return "Missing engine version."
	var record_integrity_error = _record_integrity(data)
	if not record_integrity_error.is_empty():
		return record_integrity_error
	var checkpoint_consistency_error = _checkpoint_consistency(data)
	if not checkpoint_consistency_error.is_empty():
		return checkpoint_consistency_error
	return _input_chronology(data)


static func resume(data: Dictionary, sim: RaceSim) -> RaceRecord:
	# Caller validates the complete envelope before replacing any application state.
	var record = RaceRecord.new()
	record.event_id = data.event_id
	record.origin = data.origin
	record.parent = data.parent.duplicate(true)
	record.initial = apply_types(data.initial, data.initial_integers)
	record.inputs = data.inputs.duplicate(true)
	record.marks = data.marks.duplicate(true)
	record.steps = int(data.steps)
	record.incomplete = data.incomplete
	record.last_phase = sim.phase
	record._connect(sim)
	return record


static func _input_chronology(data: Dictionary) -> String:
	var previous = 0
	for entry in data.inputs:
		if (
			not entry is Dictionary
			or not RaceCheckpoint.integral(entry.get("step"), previous, data.steps)
		):
			return "Invalid command chronology."
		previous = int(entry.step)
		if (
			not entry.get("action") is String
			or entry.action.is_empty()
			or entry.action.length() > 64
			or not entry.get("payload") is Dictionary
		):
			return "Invalid recorded input."
		if not valid_types(entry.payload, entry.get("integers")):
			return "Invalid input numeric types."
		var context = entry.get("context")
		if not context is Dictionary or context.size() != 4:
			return "Invalid input context."
		if (
			not RaceCheckpoint.integral(context.get("selected_id"), 0, data.initial.cars.size() - 1)
			or not context.get("paused") is bool
			or (
				not RaceCheckpoint.integral(context.get("speed"), 1, 16)
				or int(context.speed) not in [1, 2, 4, 8, 16]
			)
			or not RaceCheckpoint.number(context.get("accumulator"), 0, 100)
		):
			return "Invalid input context."
	var mark_chronology_error = _mark_chronology(data)
	if not mark_chronology_error.is_empty():
		return mark_chronology_error
	return ""


static func _mark_chronology(data: Dictionary) -> String:
	var previous = 0
	var cursor = 0
	for mark in data.marks:
		if (
			not mark is Dictionary
			or not mark.get("label") is String
			or mark.label.is_empty()
			or mark.label.length() > 64
		):
			return "Invalid checkpoint name."
		if (
			not RaceCheckpoint.integral(mark.get("step"), previous, data.steps)
			or not RaceCheckpoint.integral(mark.get("cursor"), cursor, data.inputs.size())
		):
			return "Invalid checkpoint chronology."
		previous = int(mark.step)
		cursor = int(mark.cursor)
		if (
			cursor > 0 and data.inputs[cursor - 1].step > mark.step
			or cursor < data.inputs.size() and data.inputs[cursor].step < mark.step
		):
			return "Checkpoint input cursor is inconsistent."
		if (
			not mark.get("snapshot") is Dictionary
			or not valid_types(mark.snapshot, mark.get("integers"))
			or PracticeRaceSim.restore_practice(mark.snapshot) == null
		):
			return "Invalid saved decision checkpoint."
		if (
			not equivalent(static_identity(mark.snapshot), static_identity(data.initial))
			or (
				absf(mark.snapshot.total_time - data.initial.total_time - mark.step * RaceSim.STEP)
				> 0.00001
			)
		):
			return "Checkpoint differs from recording chronology or track."
	return ""


static func _checkpoint_consistency(data: Dictionary) -> String:
	for key in ["initial", "endpoint"]:
		if (
			not data.get(key) is Dictionary
			or not valid_types(data[key], data.get(key + "_integers"))
			or PracticeRaceSim.restore_practice(data[key]) == null
		):
			return "Invalid " + key + " checkpoint."
	if (
		not RaceCheckpoint.integral(data.initial.version, 10, 12)
		or data.endpoint.version != data.initial.version
	):
		return (
			"Replay requires matching native v10–v12 snapshots. Import older saves "
			+ "through Continue Weekend first."
		)
	if not equivalent(static_identity(data.initial), static_identity(data.endpoint)):
		return "Recording changes its frozen track, roster or rules."
	if (
		absf(
			(
				float(data.endpoint.total_time)
				- float(data.initial.total_time)
				- float(data.steps) * RaceSim.STEP
			)
		)
		> 0.00001
	):
		return "Recorded time and fixed-step count disagree."
	if not equivalent(data.manifest, manifest_for(data.initial)):
		return "Scenario metadata does not match the recorded initial state."
	return ""


static func _record_integrity(data: Dictionary) -> String:
	if not data.get("incomplete") is String or data.incomplete.length() > 256:
		return "Invalid continuity status."
	if not RaceCheckpoint.integral(data.get("steps"), 0, 2147483647):
		return "Invalid recorded step count."
	if data.steps > MAX_STEPS and data.incomplete.is_empty():
		return "A recording beyond the replay limit must disclose incomplete continuity."
	if (
		not data.get("inputs") is Array
		or data.inputs.size() > MAX_INPUTS
		or not data.get("marks") is Array
		or data.marks.size() > MAX_MARKS
	):
		return "Recording exceeds its collection limits."
	var content = data.duplicate(true)
	content.erase("digest")
	if not data.get("digest") is String or data.digest != fingerprint(content):
		return "Recording integrity check failed. The source was not replaced."
	return ""
