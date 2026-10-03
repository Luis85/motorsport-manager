class_name RaceReproduction
extends RefCounted
## Opt-in developer sidecar around the EXISTING RaceRecord and RaceReplay.
## Never connected by player composition; rejected attempts never enter RaceRecord.
const KIND = "motorsport-manager-reproduction"
const MAX_BOUNDARIES = 64
const MAX_ATTEMPTS = 64
const MAX_STATE_BYTES = 6000000
var dropped_boundaries = 0
var dropped_attempts = 0

var _record: RaceRecord
var _source: WeakRef
var _revision = ""
var _mechanics: Array = []
var _boundaries: Array = []
var _attempts: Array = []
var _bytes = 0


func attach(record: RaceRecord, revision: String) -> bool:
	detach()
	var sim = record.source.get_ref() if record != null and record.source != null else null
	if sim == null or revision.is_empty():
		return false
	_record = record
	_source = weakref(sim)
	_revision = revision
	_mechanics = sim.mechanics.describe()
	_boundaries.clear()
	_attempts.clear()
	_bytes = 0
	dropped_boundaries = 0
	dropped_attempts = 0
	# The recorder was attached first; its counters identify each completed boundary.
	sim.input_accepted.connect(_accepted)
	sim.fixed_step_completed.connect(_capture)
	_capture()
	return true


func detach() -> void:
	var sim = _source.get_ref() if _source != null else null
	if sim != null:
		if sim.input_accepted.is_connected(_accepted):
			sim.input_accepted.disconnect(_accepted)
		if sim.fixed_step_completed.is_connected(_capture):
			sim.fixed_step_completed.disconnect(_capture)
	_source = null
	_record = null


func _accepted(_action: String, _payload: Dictionary, _context: Dictionary) -> void:
	_capture()


func _capture() -> void:
	var sim = _source.get_ref() if _source != null else null
	if sim == null or _record == null:
		return
	var state = RaceRecord.sporting(sim.snapshot())
	var size = JSON.stringify(state, "", false, true).to_utf8_buffer().size()
	if size > MAX_STATE_BYTES:
		dropped_boundaries += 1
		return
	while (
		not _boundaries.is_empty()
		and (_boundaries.size() >= MAX_BOUNDARIES or _bytes + size > MAX_STATE_BYTES)
	):
		_bytes -= int(_boundaries.pop_front().bytes)
		dropped_boundaries += 1
	_boundaries.append(
		{"step": _record.steps, "cursor": _record.inputs.size(), "state": state, "bytes": size}
	)
	_bytes += size


func note_attempt(action: String, payload: Dictionary, accepted: bool, error: String) -> void:
	if _record == null:
		return
	# Invalid/cyclic/object payloads are described, never deep-copied or serialized.
	var safe = RaceStateValue.serializable(payload)
	var text = JSON.stringify(payload, "", false, true) if safe else ""
	var retained = safe and text.length() <= 4096
	_attempts.append(
		{
			"step": _record.steps,
			"cursor": _record.inputs.size(),
			"action": action.left(64),
			"accepted": accepted,
			"error": error.left(512),
			"payload_retained": retained,
			"payload": payload.duplicate(true) if retained else {},
			"omission":
			"" if retained else "Payload is non-serializable or exceeds 4096 characters."
		}
	)
	if _attempts.size() > MAX_ATTEMPTS:
		_attempts.pop_front()
		dropped_attempts += 1


func seal(failure: Dictionary) -> Dictionary:
	if _record == null or not RaceStateValue.serializable(failure):
		return {}
	var record = _record.seal()
	if record.is_empty():
		return {}
	return {
		"kind": KIND,
		"version": 1,
		"source_revision": _revision,
		"mechanics": _mechanics.duplicate(true),
		"record": record,
		"failure": failure.duplicate(true),
		"boundaries": _boundaries.duplicate(true),
		"attempts": _attempts.duplicate(true),
		"dropped_boundaries": dropped_boundaries,
		"dropped_attempts": dropped_attempts,
		"coverage": "First divergence among retained step/input boundaries, not inferred cause."
	}


static func validate(bundle: Variant) -> String:
	if not bundle is Dictionary or not RaceStateValue.serializable(bundle):
		return "Reproduction requires bounded finite serialized data."
	if bundle.get("kind") != KIND or not RaceCheckpoint.integral(bundle.get("version"), 1, 1):
		return "Unsupported developer reproduction bundle."
	if (
		not bundle.get("source_revision") is String
		or (bundle.source_revision.is_empty() or bundle.source_revision.length() > 256)
	):
		return "Source revision is required."
	if not bundle.get("failure") is Dictionary or not bundle.get("mechanics") is Array:
		return "Missing failure evidence or mechanic description."
	if not bundle.get("record") is Dictionary:
		return "Missing authoritative replay record."
	var error = RaceRecord.validate(bundle.record)
	if not error.is_empty():
		return error
	if not bundle.get("boundaries") is Array or bundle.boundaries.size() > MAX_BOUNDARIES:
		return "Invalid diagnostic boundary window."
	if not bundle.get("attempts") is Array or bundle.attempts.size() > MAX_ATTEMPTS:
		return "Invalid diagnostic attempt window."
	for key in ["dropped_boundaries", "dropped_attempts"]:
		if not RaceCheckpoint.integral(bundle.get(key), 0, 2147483647):
			return "Invalid dropped-evidence count."
	var attempts_valid_error = _attempts_valid(bundle)
	if not attempts_valid_error.is_empty():
		return attempts_valid_error
	return _boundaries_valid(bundle)


static func diagnose(bundle: Dictionary) -> Dictionary:
	var error = validate(bundle)
	if not error.is_empty():
		return {"ok": false, "error": error}
	var replay = RaceReplay.new()
	error = replay.load_record(bundle.record)
	if not error.is_empty():
		return {"ok": false, "error": error}
	var result = {
		"ok": true,
		"matched": true,
		"checked": 0,
		"first_divergence": {},
		"source_revision": bundle.source_revision,
		"engine": bundle.record.engine,
		"replay_engine": Engine.get_version_info().string,
		"mechanics": bundle.mechanics,
		"failure": bundle.failure,
		"comparison": "Expected is recorded state; observed is independent replay state.",
		"dropped_boundaries": bundle.dropped_boundaries
	}
	var expected: Dictionary = {}
	for boundary in bundle.boundaries:
		expected["%d:%d" % [boundary.step, boundary.cursor]] = boundary.state
	var compare = func(step: int, cursor: int):
		var key = "%d:%d" % [step, cursor]
		if not expected.has(key) or not result.first_divergence.is_empty():
			return
		result.checked += 1
		var difference = StateDivergence.first(
			expected[key], RaceRecord.sporting(replay.sim.snapshot())
		)
		if difference.is_empty():
			return
		difference.step = step
		difference.cursor = cursor
		difference.last_input = bundle.record.inputs[cursor - 1] if cursor > 0 else {}
		result.first_divergence = difference
		result.matched = false
	compare.call(replay.step_index, replay.cursor)
	replay.boundary_reached.connect(compare)
	while not replay.verified and replay.error.is_empty() and result.first_divergence.is_empty():
		replay.tick(1)
	replay.boundary_reached.disconnect(compare)
	result.replay_verified = replay.verified
	result.replay_error = replay.error
	if not replay.error.is_empty():
		result.matched = false
	if result.first_divergence.is_empty() and result.checked != bundle.boundaries.size():
		result.ok = false
		result.error = "Not all retained boundaries were reached."
	return result


static func _attempts_valid(bundle: Dictionary) -> String:
	for attempt in bundle.attempts:
		if not attempt is Dictionary or not attempt.get("accepted") is bool:
			return "Invalid rejected-input diagnostic."
		if not attempt.get("action") is String or attempt.action.length() > 64:
			return "Invalid diagnostic action."
		if not attempt.get("error") is String or attempt.error.length() > 512:
			return "Invalid diagnostic error."
		if not attempt.get("payload") is Dictionary or not attempt.get("payload_retained") is bool:
			return "Invalid diagnostic payload."
		if JSON.stringify(attempt.payload, "", false, true).length() > 4096:
			return "Diagnostic payload exceeds its budget."
		if not RaceCheckpoint.integral(attempt.get("step"), 0, bundle.record.steps):
			return "Invalid diagnostic attempt step."
		if not RaceCheckpoint.integral(attempt.get("cursor"), 0, bundle.record.inputs.size()):
			return "Invalid diagnostic attempt cursor."
	return ""


static func _boundaries_valid(bundle: Dictionary) -> String:
	var step = -1
	var cursor = -1
	var bytes = 0
	for boundary in bundle.boundaries:
		if not boundary is Dictionary or not boundary.get("state") is Dictionary:
			return "Missing observed boundary state."
		if not RaceCheckpoint.integral(boundary.get("step"), maxi(0, step), bundle.record.steps):
			return "Invalid boundary step chronology."
		if not RaceCheckpoint.integral(
			boundary.get("cursor"), maxi(0, cursor), bundle.record.inputs.size()
		):
			return "Invalid boundary input chronology."
		if int(boundary.step) == step and int(boundary.cursor) == cursor:
			return "Duplicate diagnostic boundary."
		step = int(boundary.step)
		cursor = int(boundary.cursor)
		if cursor > 0 and bundle.record.inputs[cursor - 1].step > step:
			return "Boundary precedes an input it claims to include."
		if cursor < bundle.record.inputs.size() and bundle.record.inputs[cursor].step < step:
			return "Boundary omits an earlier accepted input."
		bytes += JSON.stringify(boundary.state, "", false, true).to_utf8_buffer().size()
	if bytes > MAX_STATE_BYTES:
		return "Diagnostic states exceed the bounded window."
	return ""
