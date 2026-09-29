class_name TrackCanvasGesture
extends RefCounted
## A pointer gesture owns only a temporary draft and frozen presentation targets.
## No session/aggregate is retained. Canonical mutation belongs to the editor session.
var kind: String = ""
var revision: int = -1
var changed: bool = false
var _draft: Dictionary = {}
var _targets: Array = []
var _offset: Vector2 = Vector2.ZERO
var _origins: Dictionary = {}

func begin(canvas: TrackCanvas, drag_kind: String, offset: Vector2) -> void:
	cancel(canvas)
	kind = drag_kind
	revision = canvas.document_revision
	_draft = canvas.document
	_targets = targets(canvas)
	_offset = offset
	changed = false
	if kind == "multi":
		var items: Array = _draft.nodes if canvas.selection_kind == "road" else _draft.objects
		for index in canvas.selection_ids:
			_origins[index] = TrackDocument.point(items[index])
	canvas.preview_running = false
	if canvas.reference_preview:
		canvas.reference_preview.stop()

func targets(canvas: TrackCanvas) -> Array:
	return [canvas.mode, canvas.selection_kind, canvas.selection_ids.duplicate(),
		canvas.selected, canvas.selected_pit, canvas.selected_object]

func current(canvas: TrackCanvas) -> bool:
	return (revision == canvas.document_revision and is_same(_draft, canvas.document)
		and _targets == targets(canvas) and canvas.layer_editable(layer(canvas)))

func layer(canvas: TrackCanvas) -> String:
	if kind == "multi":
		return canvas.selection_kind
	return {"reference": "reference", "pit": "pits", "object": "scenery"}.get(kind, "road")

func move(canvas: TrackCanvas, event: InputEventMouseMotion) -> void:
	if kind.is_empty():
		return
	if not current(canvas):
		cancel(canvas)
		return
	if not changed and event.relative.length_squared() < 0.25:
		return
	var p = canvas.world(event.position) - _offset
	if event.ctrl_pressed:
		p = p.snapped(Vector2(5, 5))
	var result = movement(canvas, p, Vector2(event.relative.x, -event.relative.y) / canvas.zoom)
	if not result.ok or result.document == canvas.document:
		return
	if not changed:
		canvas.edit_started.emit()
		changed = true
	# Preserve the draft's identity shared with its editor, never the canonical record.
	canvas.document.clear()
	canvas.document.merge(result.document)
	canvas._rebuild_due = layer(canvas) in ["road", "pits"]
	canvas.queue_redraw()
	if layer(canvas) in ["reference", "scenery"] and canvas.world_layer:
		canvas.world_layer.queue_redraw()

func movement(canvas: TrackCanvas, p: Vector2, relative: Vector2) -> Dictionary:
	match kind:
		"multi":
			var positions: Dictionary = {}
			for index in _origins:
				positions[index] = _origins[index] + p
			return TrackEdit.move_positions(canvas.document, canvas.selection_kind, positions)
		"reference":
			return TrackEdit.move_reference(canvas.document, relative)
		"object":
			return TrackEdit.move_positions(canvas.document, "scenery", {canvas.selected_object: p})
		"pit":
			return TrackEdit.move_positions(canvas.document, "pits", {canvas.selected_pit: p})
		"node":
			return TrackEdit.move_positions(canvas.document, "road", {canvas.selected: p})
		"in", "out":
			return TrackEdit.move_handle(canvas.document, canvas.selected, kind, p)
	return TrackEdit.failure("Unknown pointer gesture.")

func commit(canvas: TrackCanvas) -> void:
	if kind.is_empty():
		return
	if not current(canvas):
		cancel(canvas)
		return
	var observed_revision = revision
	var modified = changed
	reset()
	canvas._rebuild_due = false
	if modified:
		# The observed revision comes from pointer-down, never from pointer-up.
		canvas.gesture_committed.emit(observed_revision)
		canvas.selection_changed.emit()
	canvas.queue_redraw()

func cancel(canvas: TrackCanvas) -> void:
	var modified = changed
	reset()
	canvas._rebuild_due = false
	if modified:
		canvas.edit_cancelled.emit()
	canvas.queue_redraw()

func reset() -> void:
	kind = ""
	revision = -1
	changed = false
	_draft = {}
	_targets.clear()
	_origins.clear()
	_offset = Vector2.ZERO
