class_name TrackEditorSession
extends RefCounted
## Owns the committed authoring aggregate and bounded transaction history.
## Pointer drafts and reference previews are disposable copies, never shared authority.
const HISTORY_LIMIT: int = 50
var content_catalog: ContentCatalog
var _revision: int = 0
var revision: int:
	get: return _revision
var last_error: String = ""
var compile_usec: int = 0
var _document: Dictionary = {}
var _past: Array = []
var _future: Array = []
var _saved_signature: String = ""
var _transaction_revision: int = -1
var _saving: bool = false
var _preview = TrackReferencePreview.new()
var preview: TrackPreviewHandle = TrackPreviewHandle.new(_preview)

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
		_transaction_revision = _revision

func commit(draft: Dictionary, expected_revision: int) -> bool:
	last_error = ""
	if expected_revision != _revision or (_transaction_revision >= 0 and _transaction_revision != _revision):
		last_error = "The editing transaction is stale. Start from the current document."
		return false
	var errors = TrackDocument.draft_errors(draft)
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
	_revision += 1
	_preview.stop()
	return true

func cancel() -> Dictionary:
	_transaction_revision = -1
	return read_document()

func undo() -> Dictionary:
	_transaction_revision = -1
	if not _past.is_empty():
		_future.append(_document.duplicate(true))
		_document = _past.pop_back()
		_revision += 1
		_preview.stop()
	return read_document()

func redo() -> Dictionary:
	_transaction_revision = -1
	if not _future.is_empty():
		_past.append(_document.duplicate(true))
		_document = _future.pop_back()
		_revision += 1
		_preview.stop()
	return read_document()

func replace(value: Dictionary, saved: bool = true) -> bool:
	# Legacy imports use positional nodes; validate those before normalizing.
	# Native drafts may be semantically unfinished (for example, an open road).
	var errors = TrackDocument.draft_errors(value)
	if not errors.is_empty():
		if not TrackDocument.serializable(value):
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
	_revision += 1
	_saved_signature = JSON.stringify(_document) if saved else ""
	_preview.stop()
	return true

func _mark_saved(value: Dictionary) -> void:
	_document = value.duplicate(true)
	_saved_signature = JSON.stringify(_document)
	_transaction_revision = -1
	_revision += 1

func save(port: TrackEditorPort, draft: Dictionary, expected_revision: int) -> Dictionary:
	if _saving:
		return {"ok": false, "error": "A track save is already in progress."}
	var errors = TrackDocument.publication_errors(draft)
	if not errors.is_empty():
		return {"ok": false, "error": "\n".join(errors)}
	if port == null:
		return {"ok": false, "error": "No track repository is available."}
	if not commit(draft, expected_revision):
		return {"ok": false, "error": last_error}
	var saving_revision = _revision
	var submitted = read_document()
	_saving = true
	var result = port.save_authoring(submitted.duplicate(true))
	_saving = false
	if result.get("ok") != true:
		return result
	if not result.get("document") is Dictionary or not TrackDocument.draft_errors(result.document).is_empty():
		return {"ok": false, "error": "The track repository returned invalid saved data."}
	# A repository may assign local identity, not silently change the authored road.
	var returned: Dictionary = result.document.duplicate(true)
	for key in ["id", "builtin"]:
		if submitted.has(key): returned[key] = submitted[key]
		else: returned.erase(key)
	if returned != submitted:
		return {"ok": false, "error": "The track repository changed the submitted authoring document."}
	if _revision != saving_revision:
		return {"ok": false, "saved": true, "error": "The earlier revision was saved. Your newer edits are still unsaved and have been retained."}
	_mark_saved(result.document)
	return result.duplicate(true)

func compile_draft(draft: Dictionary, vehicle: String = "Formula", fast: bool = false) -> TrackGeometry:
	var definition: VehicleDefinition
	if content_catalog != null:
		definition = content_catalog.vehicle(vehicle if "." in vehicle else "core.vehicle." + vehicle.to_lower())
	if (content_catalog != null and definition == null) or (content_catalog == null and vehicle not in VehicleDefinition.LEGACY):
		return null
	if not TrackDocument.draft_errors(draft).is_empty() or draft.nodes.size() < 4:
		return null
	var started = Time.get_ticks_usec()
	var geometry = TrackGeometry.new(draft.duplicate(true), vehicle, fast, definition)
	compile_usec = Time.get_ticks_usec() - started
	return geometry

func diagnostics(geometry: TrackGeometry) -> Array:
	return TrackDiagnostics.inspect(geometry) if geometry else []

func advance_preview(elapsed: float) -> void:
	_preview.advance(elapsed)

func export_authoring(port: TrackEditorPort, path: String, draft: Dictionary) -> String:
	var errors = TrackDocument.publication_errors(draft)
	if not errors.is_empty():
		return "\n".join(errors)
	return port.export_value(path, draft.duplicate(true)) if port else "No track repository is available."

func export_runtime(port: TrackEditorPort, path: String, draft: Dictionary, vehicle: String) -> String:
	var errors = TrackDocument.publication_errors(draft)
	if not errors.is_empty():
		return "\n".join(errors)
	var geometry = compile_draft(draft, vehicle)
	if geometry == null or TrackDiagnostics.blocking(diagnostics(geometry)):
		return "Resolve the circuit's blocking checks before exporting runtime data."
	return port.export_value(path, geometry.runtime_export()) if port else "No track repository is available."

func vehicle_choices() -> Array:
	if content_catalog != null:
		return content_catalog.entries("vehicle").map(func(v): return {"id": v.id, "name": v.name})
	return VehicleDefinition.LEGACY.keys().map(func(id): return {"id": id, "name": id})
