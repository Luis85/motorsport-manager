class_name TrackEditorState
extends VBoxContainer
signal test_requested(document: Dictionary)
var presentation_services: RacePresentationServices = RacePresentationServices.new()
var section_picker: OptionButton
var sketch_result: Dictionary = {}
var sketch_summary: Label
var context_bar: HFlowContainer
var guide: ContextGuide
var selection_summary: Label
var sketch_preview_button: Button
var sketch_apply_button: Button
var sketch_close_button: Button
var sketch_actions: VBoxContainer
var undo_button: Button
var redo_button: Button
var tool_picker: OptionButton
var test_button: Button
var findings: Array = []
var gesture_redo: Array = []
var known_distance = 100.0
var document: Dictionary = {}
# Revision of the displayed draft, not the current session at commit time.
var document_revision: int = 0
var geometry: TrackGeometry
var canvas: TrackCanvas
var inspector: TabContainer
var status: Label
var dirty_label: Label
var dirty = false
var undo_stack: Array = []
var redo_stack: Array = []
var feature_index = -1
var vehicle = "Formula"
var name_field: LineEdit
var session: TrackEditorSession = TrackEditorSession.new()
var storage: TrackEditorPort = TrackEditorPort.new()
var catalog: Array = []
var preferences: Dictionary = {}
var saved_signature: String:
	get:
		return session.saved_signature()
	set(value):
		session.restore_saved_signature(value)

var _refreshing_inspector = false


func configure(d: Dictionary, port: TrackEditorPort = null, presentation: Dictionary = {}) -> void:
	if port != null:
		storage = port
	catalog = storage.catalog()
	preferences = presentation.duplicate(true)
	session = TrackEditorSession.new(d)
	document = session.read_document()
	document_revision = session.revision


func checkpoint() -> void:
	session.begin()


func sync_history() -> void:
	var state = session.history()
	undo_stack = state.past
	redo_stack = state.future


func perform(action: Callable, rebuild_inspector: bool = false) -> void:
	checkpoint()
	action.call()
	recompile()
	if rebuild_inspector:
		call("refresh_inspector")


func recompile(observed_revision: int = -1) -> void:
	var expected = document_revision if observed_revision < 0 else observed_revision
	var error = ""
	if not session.commit(document, expected):
		error = session.last_error
		document = session.cancel()

	document_revision = session.revision
	canvas.document_revision = document_revision
	canvas.gesture.reset()
	sync_history()
	if not sketch_result.is_empty():
		sketch_result.clear()
		canvas.sketch_preview = null
		canvas.sketch_note = "Document changed. Preview the trace again before replacing the road."
		call("update_sketch_panel")
	canvas.selection_ids = TrackEdit.indices(document, canvas.selection_kind, canvas.selection_ids)
	if document.nodes.size() >= 4:
		geometry = session.compile_draft(document, vehicle)
		findings = session.diagnostics(geometry)
		canvas.diagnostics = findings
		canvas.set_track(geometry, document)
	else:
		canvas.document = document
		canvas.queue_redraw()
	update_status()
	if not error.is_empty():
		call("refresh_inspector")
		if status:
			status.text = error


func undo() -> void:
	if canvas.mode.begins_with("trace_"):
		canvas.sketch.undo()
		canvas.pen_anchor = Vector2.INF
		call("invalidate_sketch")
		return
	if undo_stack.is_empty():
		return
	document = session.undo()
	document_revision = session.revision
	canvas.selected = mini(canvas.selected, document.nodes.size() - 1)
	canvas.selected_object = mini(canvas.selected_object, document.objects.size() - 1)
	recompile()
	call("refresh_inspector")


func redo() -> void:
	if canvas.mode.begins_with("trace_"):
		canvas.sketch.redo()
		canvas.pen_anchor = Vector2.INF
		call("invalidate_sketch")
		return
	if redo_stack.is_empty():
		return
	document = session.redo()
	document_revision = session.revision
	recompile()
	call("refresh_inspector")


func update_status() -> void:
	var tracing = canvas.mode.begins_with("trace_")
	if undo_button:
		undo_button.disabled = (
			canvas.sketch.strokes.is_empty() if tracing else undo_stack.is_empty()
		)
		undo_button.text = "Undo stroke" if tracing else "Undo"
	if redo_button:
		redo_button.disabled = (
			canvas.sketch.future.is_empty() and not canvas.sketch.redo_closed
			if tracing
			else redo_stack.is_empty()
		)
		redo_button.text = "Redo stroke" if tracing else "Redo"
	dirty = JSON.stringify(document) != saved_signature or not canvas.sketch.strokes.is_empty()
	dirty_label.text = (
		"UNAPPLIED TRACE"
		if not canvas.sketch.strokes.is_empty()
		else (
			"UNSAVED CHANGES"
			if dirty
			else ("LIBRARY SOURCE" if document.get("builtin", false) else "SAVED")
		)
	)
	dirty_label.add_theme_color_override("font_color", UI.ACCENT if dirty else UI.GOOD)
	var errors = TrackDocument.validate(document)
	if not errors.is_empty():
		status.text = "DRAFT  ·  " + " · ".join(errors)
		status.add_theme_color_override("font_color", UI.ACCENT)
	else:
		status.text = (
			"%d control points  ·  %.3f km  ·  %s reference lap %s  ·  Bake %.0f ms · %d findings"
			% [
				document.nodes.size(),
				geometry.length / 1000,
				vehicle,
				MinimalRaceTiming.format_time(geometry.estimate),
				session.compile_usec / 1000.0,
				findings.size()
			]
		)
		status.add_theme_color_override("font_color", UI.MUTED)
	if test_button:
		test_button.disabled = (
			TrackDiagnostics.blocking(findings)
			or not errors.is_empty()
			or not canvas.sketch.strokes.is_empty()
		)
		test_button.tooltip_text = (
			"Resolve Checks and apply or clear the trace before driving."
			if test_button.disabled
			else "Test an isolated copy; your unsaved editor draft is preserved."
		)


func cancel_gesture() -> void:
	document = session.cancel()
	document_revision = session.revision
	recompile()
	call("refresh_inspector")


func race_errors() -> Array[String]:
	if not canvas.sketch.strokes.is_empty():
		return ["Apply or clear the unapplied trace before testing or exporting runtime data."]
	var errors = TrackDocument.validate(document)
	if errors.is_empty():
		for finding in findings:
			if finding.severity == "error":
				errors.append(finding.message)
	return errors
