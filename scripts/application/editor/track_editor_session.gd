class_name TrackEditorSession
extends RefCounted
## Owns the committed authoring aggregate and bounded transaction history.
## Pointer drafts and reference previews are disposable copies, never shared authority.
const HISTORY_LIMIT: int = 50
var revision: int = 0
var last_error: String = ""
var _document: Dictionary = {}
var _past: Array = []
var _future: Array = []
var _saved_signature: String = ""
var _transaction_revision: int = -1
var preview: TrackReferencePreview = TrackReferencePreview.new()

func _init(document: Dictionary = {}) -> void:
	if not document.is_empty():
		replace(document)

static func blank_document() -> Dictionary:
	var nodes: Array = []
	for point in [Vector2(-300, -150), Vector2(300, -150), Vector2(300, 150), Vector2(-300, 150)]:
		nodes.append(TrackDocument.node_at(point))
	var value = TrackDocument.normalize({"name": "My new circuit", "nodes": nodes, "closed": true})
	for index in range(4):
		TrackDocument.smooth_node(value, index)
	return value

static func draft_errors(value: Dictionary) -> Array[String]:
	var errors: Array[String] = []
	if not _serializable(value, 0):
		errors.append("Track drafts require finite, bounded serialized values.")
		return errors
	if not value.get("nodes") is Array or value.nodes.size() > TrackDocument.MAX_NODES:
		errors.append("The track requires a bounded road-point collection.")
		return errors
	for key in ["visual", "grid", "provenance"]:
		if not value.get(key, {}) is Dictionary:
			errors.append("Invalid draft metadata: " + key)
	for key in ["features", "pits", "objects", "timingGates", "cornerMarkers"]:
		if not value.get(key, []) is Array:
			errors.append("Invalid draft collection: " + key)
	for node in value.nodes:
		if not node is Dictionary:
			errors.append("Every draft road point requires named coordinates.")
			break
		for axis in ["x", "y"]:
			if not TrackDocument.valid_number(node.get(axis), -100000, 100000):
				errors.append("Road coordinates must be finite numbers within the authoring bounds.")
		for handle in ["in", "out"]:
			if not node.get(handle, {}) is Dictionary:
				errors.append("Invalid control handle.")
				continue
			for axis in ["x", "y"]:
				if not TrackDocument.valid_number(node.get(handle, {}).get(axis, 0), -10000, 10000):
					errors.append("Invalid control handle coordinate.")
	if not errors.is_empty():
		return errors
	# Reuse the track contract for nested metadata. Replace only the unfinished
	# road in this validation copy: an open/short draft is legal editing state,
	# but malformed pits, scenery, dimensions or references are not.
	var structural = value.duplicate(true)
	structural.nodes = [
		{"x": -100.0, "y": -100.0}, {"x": 100.0, "y": -100.0},
		{"x": 100.0, "y": 100.0}, {"x": -100.0, "y": 100.0}]
	structural.closed = true
	structural.name = "Draft validation"
	errors.append_array(TrackDocument.validate(structural))
	for node in value.nodes:
		if not TrackDocument.valid_number(node.get("h", 0), -1000, 10000):
			errors.append("Road height must remain within the authoring bounds.")
		if not TrackDocument.valid_number(node.get("w", 14), 5, 40):
			errors.append("Road width must remain between 5 and 40 metres.")
		if not TrackDocument.valid_number(node.get("bank", 0), -45, 45):
			errors.append("Road banking must remain within ±45 degrees.")
	if not value.get("closed", true) is bool or not value.get("name", "") is String:
		errors.append("Track name and closed state have invalid types.")
	if JSON.stringify(value).length() > 12000000:
		errors.append("The authoring document is too large.")
	return errors

static func _serializable(value: Variant, depth: int) -> bool:
	if depth > 24:
		return false
	match typeof(value):
		TYPE_NIL, TYPE_BOOL, TYPE_INT, TYPE_STRING, TYPE_STRING_NAME:
			return true
		TYPE_FLOAT:
			return is_finite(value)
		TYPE_ARRAY:
			if value.size() > 20000: return false
			for item in value:
				if not _serializable(item, depth + 1): return false
			return true
		TYPE_DICTIONARY:
			if value.size() > 20000: return false
			for key in value:
				if typeof(key) not in [TYPE_STRING, TYPE_STRING_NAME] or not _serializable(value[key], depth + 1): return false
			return true
	return false

func read_document() -> Dictionary:
	return _document.duplicate(true)

func history() -> Dictionary:
	return {"past": _past.duplicate(true), "future": _future.duplicate(true)}

func saved_signature() -> String:
	return _saved_signature

func restore_saved_signature(signature: String) -> void:
	_saved_signature = signature

func begin() -> void:
	if _transaction_revision < 0:
		_transaction_revision = revision

func commit(draft: Dictionary) -> bool:
	last_error = ""
	if _transaction_revision >= 0 and _transaction_revision != revision:
		last_error = "The editing transaction is stale. Start from the current document."
		return false
	var errors = draft_errors(draft)
	if not errors.is_empty():
		last_error = "\n".join(errors)
		return false
	_transaction_revision = -1
	if draft == _document:
		return true
	_past.append(_document.duplicate(true))
	if _past.size() > HISTORY_LIMIT:
		_past.pop_front()
	_future.clear()
	_document = draft.duplicate(true)
	revision += 1
	preview.stop()
	return true

func cancel() -> Dictionary:
	_transaction_revision = -1
	return read_document()

func undo() -> Dictionary:
	_transaction_revision = -1
	if not _past.is_empty():
		_future.append(_document.duplicate(true))
		_document = _past.pop_back()
		revision += 1
		preview.stop()
	return read_document()

func redo() -> Dictionary:
	_transaction_revision = -1
	if not _future.is_empty():
		_past.append(_document.duplicate(true))
		_document = _future.pop_back()
		revision += 1
		preview.stop()
	return read_document()

func replace(value: Dictionary, saved: bool = true) -> bool:
	# Legacy imports use positional nodes; validate those before normalizing.
	# Native drafts may be semantically unfinished (for example, an open road).
	var errors = draft_errors(value)
	if not errors.is_empty():
		if not _serializable(value, 0):
			last_error = "Track drafts require serialized finite values."
			return false
		errors = TrackDocument.validate(value)
		if not errors.is_empty():
			last_error = "\n".join(errors)
			return false
	_document = TrackDocument.normalize(value).duplicate(true)
	_past.clear()
	_future.clear()
	_transaction_revision = -1
	revision += 1
	_saved_signature = JSON.stringify(_document) if saved else ""
	preview.stop()
	return true

func mark_saved(value: Dictionary) -> void:
	_document = value.duplicate(true)
	_saved_signature = JSON.stringify(_document)
	_transaction_revision = -1
	revision += 1

func save(port: TrackEditorPort, draft: Dictionary) -> Dictionary:
	var errors = draft_errors(draft)
	if errors.is_empty():
		errors = TrackDocument.validate(draft)
	if not errors.is_empty():
		return {"ok": false, "error": "\n".join(errors)}
	if port == null:
		return {"ok": false, "error": "No track repository is available."}
	if not commit(draft):
		return {"ok": false, "error": last_error}
	var result = port.save_authoring(read_document())
	if result.get("ok") == true:
		if not result.get("document") is Dictionary or not draft_errors(result.document).is_empty():
			return {"ok": false, "error": "The track repository returned invalid saved data."}
		mark_saved(result.document)
	return result

func compile_draft(draft: Dictionary, vehicle: String = "Formula", fast: bool = false) -> TrackGeometry:
	if vehicle not in TrackGeometry.PRESETS or not draft_errors(draft).is_empty() or draft.nodes.size() < 4:
		return null
	return TrackGeometry.new(draft.duplicate(true), vehicle, fast)

func diagnostics(geometry: TrackGeometry) -> Array:
	return TrackDiagnostics.inspect(geometry) if geometry else []

func advance_preview(elapsed: float) -> void:
	preview.advance(elapsed)

func export_authoring(port: TrackEditorPort, path: String, draft: Dictionary) -> String:
	var errors = draft_errors(draft)
	if errors.is_empty():
		errors = TrackDocument.validate(draft)
	if not errors.is_empty():
		return "\n".join(errors)
	return port.export_value(path, draft.duplicate(true)) if port else "No track repository is available."

func export_runtime(port: TrackEditorPort, path: String, draft: Dictionary, vehicle: String) -> String:
	var errors = draft_errors(draft)
	if errors.is_empty():
		errors = TrackDocument.validate(draft)
	if not errors.is_empty():
		return "\n".join(errors)
	var geometry = compile_draft(draft, vehicle)
	if geometry == null or TrackDiagnostics.blocking(diagnostics(geometry)):
		return "Resolve the circuit's blocking checks before exporting runtime data."
	return port.export_value(path, geometry.runtime_export()) if port else "No track repository is available."
