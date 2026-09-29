class_name TrackEditor
extends VBoxContainer
var presentation_services: RacePresentationServices = RacePresentationServices.new()
signal test_requested(document: Dictionary)
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
var _refreshing_inspector = false
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
	get: return session.saved_signature()
	set(value): session.restore_saved_signature(value)

func configure(d: Dictionary, port: TrackEditorPort = null, presentation: Dictionary = {}) -> void:
	if port != null: storage = port
	catalog = storage.catalog()
	preferences = presentation.duplicate(true)
	session = TrackEditorSession.new(d)
	document = session.read_document(); document_revision = session.revision

func _ready() -> void:
	set_meta("pitwall_text_scale", float(preferences.get("pitwall_text_scale", 1.0)))
	theme = UI.theme()
	size_flags_vertical = Control.SIZE_EXPAND_FILL; size_flags_horizontal = Control.SIZE_EXPAND_FILL
	if document.is_empty(): configure(catalog[mini(7, catalog.size() - 1)] if not catalog.is_empty() else TrackEditorSession.blank_document(), storage, preferences)
	geometry = session.compile_draft(document, vehicle)
	TrackEditorToolbar.build(self)
	var content = UI.hbox(self, true)
	canvas = TrackCanvas.new(); canvas.configure_presentation(preferences); canvas.editing = true; canvas.show_line = true
	canvas.draft_compiler = session.compile_draft
	canvas.reference_preview = session.preview
	canvas.document_revision = document_revision
	canvas.set_track(geometry, document); content.add_child(canvas)
	canvas.edit_started.connect(checkpoint)
	canvas.edit_cancelled.connect(cancel_gesture)
	canvas.edited.connect(recompile)
	canvas.gesture_committed.connect(recompile)
	canvas.selection_changed.connect(refresh_inspector)
	canvas.sketch_changed.connect(func(): sketch_result.clear(); update_sketch_panel(); update_status())
	canvas.measured.connect(func(distance): status.text = "Measured %.2f metres. Image calibration is available in Reference." % distance; refresh_inspector())
	var side = UI.vbox(content); side.custom_minimum_size.x = 330
	section_picker = UI.option(["Point & selection", "Circuit & pit lane", "Features & scenery", "Reference image", "Checks", "World & layers", "Draw new layout"], func(index): inspector.current_tab = index)
	side.add_child(section_picker)
	inspector = TabContainer.new(); inspector.tabs_visible = false; inspector.size_flags_vertical = Control.SIZE_EXPAND_FILL; side.add_child(inspector)
	inspector.tab_changed.connect(func(index):
		if index >= 0: section_picker.select(index)
		if sketch_actions: sketch_actions.visible = index == 6)
	# Keep the two commit-path actions outside the scrollable authoring fields.
	sketch_actions = UI.vbox(side); sketch_actions.visible = false
	var sketch_action_row = UI.hbox(sketch_actions)
	sketch_preview_button = UI.button("Preview road", preview_sketch)
	sketch_apply_button = UI.button("Replace road", apply_sketch, true)
	for button in [sketch_preview_button, sketch_apply_button]:
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL; sketch_action_row.add_child(button)
	var sketch_hint = UI.paragraph("Preview changes nothing. Replace asks for confirmation.")
	sketch_hint.add_theme_font_size_override("font_size", 12); sketch_actions.add_child(sketch_hint)
	status = UI.label("", 12, UI.MUTED); status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART; add_child(status)
	recompile(); refresh_inspector(); update_status()
	setup_guide()
	PitwallDesign.scale_controls(self, UI.text_scale(self))
	PitwallDesign.focus_later(tool_picker)
	call_deferred("fit_canvas")

func setup_guide() -> void:
	guide = ContextGuide.new(); guide.presentation_services = presentation_services
	var actions = {
		"shape": {"target": func(): return canvas, "reveal": func(): set_tool(0)},
		"scenery": {"target": func(): return inspector, "reveal": func(): set_tool(10); inspector.current_tab = 0},
		"trace": {"target": func(): return inspector, "reveal": func(): set_tool(8); inspector.current_tab = 6},
		"checks": {"target": func(): return inspector, "reveal": func(): set_tool(0); inspector.current_tab = 4},
		"handoff": {"target": func(): return test_button, "reveal": func(): inspector.current_tab = 1},
	}
	var steps: Array = []
	for copy in session.guide_steps():
		if not actions.has(copy.key): continue
		var step = {"title": copy.title, "body": copy.body}
		step.merge(actions[copy.key])
		steps.append(step)
	guide.configure("editor", steps)
	add_child(guide)

func fit_canvas() -> void:
	canvas.fit()

func checkpoint() -> void:
	session.begin()

func sync_history() -> void:
	var state = session.history()
	undo_stack = state.past
	redo_stack = state.future

func perform(action: Callable, rebuild_inspector: bool = false) -> void:
	checkpoint(); action.call(); recompile()
	if rebuild_inspector: refresh_inspector()

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
		sketch_result.clear(); canvas.sketch_preview = null; canvas.sketch_note = "Document changed. Preview the trace again before replacing the road."
		update_sketch_panel()
	canvas.selection_ids = TrackEdit.indices(document, canvas.selection_kind, canvas.selection_ids)
	if document.nodes.size() >= 4:
		geometry = session.compile_draft(document, vehicle); findings = session.diagnostics(geometry); canvas.diagnostics = findings; canvas.set_track(geometry, document)
	else: canvas.document = document; canvas.queue_redraw()
	update_status()
	if not error.is_empty():
		refresh_inspector()
		if status: status.text = error

func undo() -> void:
	if canvas.mode.begins_with("trace_"): canvas.sketch.undo(); canvas.pen_anchor = Vector2.INF; invalidate_sketch(); return
	if undo_stack.is_empty(): return
	document = session.undo(); document_revision = session.revision
	canvas.selected = mini(canvas.selected, document.nodes.size() - 1)
	canvas.selected_object = mini(canvas.selected_object, document.objects.size() - 1)
	recompile(); refresh_inspector()

func redo() -> void:
	if canvas.mode.begins_with("trace_"): canvas.sketch.redo(); canvas.pen_anchor = Vector2.INF; invalidate_sketch(); return
	if redo_stack.is_empty(): return
	document = session.redo(); document_revision = session.revision
	recompile(); refresh_inspector()

func update_status() -> void:
	var tracing = canvas.mode.begins_with("trace_")
	if undo_button:
		undo_button.disabled = canvas.sketch.strokes.is_empty() if tracing else undo_stack.is_empty()
		undo_button.text = "Undo stroke" if tracing else "Undo"
	if redo_button:
		redo_button.disabled = canvas.sketch.future.is_empty() and not canvas.sketch.redo_closed if tracing else redo_stack.is_empty()
		redo_button.text = "Redo stroke" if tracing else "Redo"
	dirty = JSON.stringify(document) != saved_signature or not canvas.sketch.strokes.is_empty()
	dirty_label.text = "UNAPPLIED TRACE" if not canvas.sketch.strokes.is_empty() else "UNSAVED CHANGES" if dirty else ("LIBRARY SOURCE" if document.get("builtin", false) else "SAVED")
	dirty_label.add_theme_color_override("font_color", UI.ACCENT if dirty else UI.GOOD)
	var errors = TrackDocument.validate(document)
	if not errors.is_empty():
		status.text = "DRAFT  ·  " + " · ".join(errors); status.add_theme_color_override("font_color", UI.ACCENT)
	else:
		status.text = "%d control points  ·  %.3f km  ·  %s reference lap %s  ·  Bake %.0f ms · %d findings" % [document.nodes.size(), geometry.length / 1000, vehicle, MinimalRaceTiming.format_time(geometry.estimate), session.compile_usec / 1000.0, findings.size()]
		status.add_theme_color_override("font_color", UI.MUTED)
	if test_button:
		test_button.disabled = TrackDiagnostics.blocking(findings) or not errors.is_empty() or not canvas.sketch.strokes.is_empty()
		test_button.tooltip_text = "Resolve Checks and apply or clear the trace before driving." if test_button.disabled else "Test an isolated copy; your unsaved editor draft is preserved."

func inspector_page(title: String) -> VBoxContainer:
	var scroll = ScrollContainer.new(); scroll.name = title; scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED; inspector.add_child(scroll)
	var margin = MarginContainer.new(); margin.size_flags_horizontal = Control.SIZE_EXPAND_FILL; scroll.add_child(margin)
	for side in ["left", "right", "top", "bottom"]: margin.add_theme_constant_override("margin_" + side, 12)
	return UI.vbox(margin, true)

func refresh_inspector() -> void:
	TrackEditorInspector.render(self)
	PitwallDesign.scale_controls(inspector, UI.text_scale(self))

func coordinate_fields(parent: Node, node: Dictionary, road: bool) -> void:
	for field in [["X metres", "x", -100000, 100000, 0.1], ["Y metres", "y", -100000, 100000, 0.1], ["Height metres", "h", -1000, 10000, 0.1]]:
		UI.field(parent, field[0], UI.spin(float(node.get(field[1], 0)), field[2], field[3], field[4], func(value): perform(func(): node[field[1]] = value)))
	if road:
		UI.field(parent, "Width metres", UI.spin(node.w, 5, 40, 0.1, func(value): perform(func(): node.w = value)))
		UI.field(parent, "Banking °", UI.spin(node.bank, -45, 45, 0.5, func(value): perform(func(): node.bank = value)))

func delete_point() -> void:
	var layer = "scenery" if canvas.selected_object >= 0 else ("pits" if canvas.mode == "pit" else "road")
	if not canvas.layer_editable(layer): status.text = "Layer is hidden or locked. Unlock it in World."; return
	if canvas.selection_ids.size() > 1:
		selection_action("delete"); return
	if canvas.selected_object >= 0 and canvas.selected_object < document.objects.size():
		perform(func(): document.objects.remove_at(canvas.selected_object); canvas.selected_object = -1, true); return
	if canvas.mode == "pit" and canvas.selected_pit >= 0 and not document.pits.is_empty():
		perform(func(): document.pits[0].nodes.remove_at(canvas.selected_pit); canvas.selected_pit = -1, true); return
	if canvas.selected < 0: return
	if document.nodes.size() <= 4: UI.notify(self, "Keep a closed circuit", "A circuit must retain at least four points."); return
	perform(func(): document.nodes.remove_at(canvas.selected); canvas.selected = -1, true)

func save_document() -> void:
	if name_field: document.name = name_field.text.strip_edges()
	var result = session.save(storage, document, document_revision)
	if result.ok:
		document = session.read_document(); document_revision = session.revision; recompile(); invalidate_sketch(); update_status()
		status.text = "Committed road saved. Your unapplied trace is still temporary; apply it before leaving." if not canvas.sketch.strokes.is_empty() else "Saved to the track library. The Grand Prix selector will include this circuit."
	else: update_status(); UI.notify(self, "Could not save circuit", result.error)

func export_document() -> void:
	var errors = TrackDocument.validate(document)
	if not errors.is_empty(): UI.notify(self, "Track needs attention", "\n".join(errors)); return
	var dialog = UI.file_dialog(self, true, ["*.json ; Track authoring JSON"], func(path):
		var error = session.export_authoring(storage, path, document)
		UI.notify(self, "Export circuit", "Track exported." if error.is_empty() else error))
	dialog.current_file = document.name.validate_filename() + ".json"

func export_runtime() -> void:
	var errors = race_errors()
	if not errors.is_empty(): UI.notify(self, "Track needs attention", "\n".join(errors)); return
	var dialog = UI.file_dialog(self, true, ["*.json ; Baked runtime JSON"], func(path):
		var error = session.export_runtime(storage, path, document, vehicle)
		UI.notify(self, "Bake runtime", "Runtime package exported with geometry, racing line, speed profile, pit lane and authoring metadata." if error.is_empty() else error))
	dialog.current_file = document.name.validate_filename() + "-runtime.json"

func import_document() -> void:
	UI.file_dialog(self, false, ["*.json ; Native or Circuit Atelier project"], func(path):
		var result = storage.load_authoring(path)
		if not result.ok: UI.notify(self, "Import failed", result.error); return
		var errors = TrackDocument.validate(result.data)
		if not errors.is_empty(): UI.notify(self, "Import failed", "\n".join(errors)); return
		confirm_discard(func(): replace_document(result.data); document.builtin = false; saved_signature = ""; update_status()))

func import_reference() -> void:
	UI.file_dialog(self, false, ["*.png,*.jpg,*.jpeg ; Reference image"], func(path):
		var result = storage.read_reference(path)
		if not result.ok: UI.notify(self, "Image unavailable", result.error); return
		perform(func(): document.reference = {"png": result.png, "width": geometry.bounds.size.x, "x": geometry.bounds.get_center().x, "y": geometry.bounds.get_center().y, "opacity": 0.35}, true))

func new_document() -> void:
	confirm_discard(func():
		var nodes: Array = []
		for p in [Vector2(-300, -150), Vector2(300, -150), Vector2(300, 150), Vector2(-300, 150)]: nodes.append(TrackDocument.node_at(p))
		var d = TrackDocument.normalize({"name": "My new circuit", "nodes": nodes, "closed": true})
		for i in range(4): TrackDocument.smooth_node(d, i)
		replace_document(d); saved_signature = ""; update_status())

func replace_document(d: Dictionary) -> void:
	if not session.replace(d): UI.notify(self, "Could not replace circuit", session.last_error); return
	canvas.sketch.clear(); canvas.selection_ids.clear(); canvas.sketch_preview = null; sketch_result.clear(); canvas.stroke.clear(); canvas.pen_anchor = Vector2.INF
	document = session.read_document(); document_revision = session.revision; sync_history(); canvas.selected = -1; canvas.selected_pit = -1; canvas.selected_object = -1; feature_index = -1
	saved_signature = JSON.stringify(document); recompile(); refresh_inspector(); canvas.fit()

func confirm_discard(callback: Callable) -> void:
	if not dirty: callback.call(); return
	UI.confirm(self, "Unsaved circuit changes", "Discard unsaved circuit changes and any unapplied trace? Saved library files will not be deleted.", "Discard changes", callback)

func _unhandled_key_input(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed or event.echo: return
	var focus = get_viewport().gui_get_focus_owner()
	if focus is LineEdit or focus is TextEdit: return
	var handled = true
	if event.ctrl_pressed and event.keycode == KEY_S: save_document()
	elif event.ctrl_pressed and event.keycode == KEY_Z:
		if event.shift_pressed: redo()
		else: undo()
	elif event.ctrl_pressed and event.keycode == KEY_Y: redo()
	elif event.ctrl_pressed and event.keycode == KEY_D: selection_action("duplicate")
	elif event.ctrl_pressed and event.keycode == KEY_G: selection_action("ungroup" if event.shift_pressed else "group")
	elif event.keycode == KEY_ESCAPE: canvas.select_items(canvas.selection_kind, [])
	elif event.keycode == KEY_D: set_tool(8)
	elif event.keycode == KEY_S: set_tool(10)
	elif event.keycode == KEY_DELETE: delete_point()
	elif event.keycode == KEY_F: canvas.fit()
	elif event.keycode == KEY_V: set_tool(0)
	elif event.keycode == KEY_I: set_tool(1)
	elif event.keycode == KEY_P: set_tool(3)
	elif event.keycode == KEY_M: set_tool(6)
	elif event.keycode in [KEY_LEFT, KEY_RIGHT, KEY_UP, KEY_DOWN]:
		var direction = {KEY_LEFT: Vector2.LEFT, KEY_RIGHT: Vector2.RIGHT, KEY_UP: Vector2.UP * -1, KEY_DOWN: Vector2.DOWN * -1}[event.keycode]
		var amount = 5.0 if event.shift_pressed else 0.5
		if canvas.selection_ids.size() > 1 and canvas.layer_editable(canvas.selection_kind):
			apply_selection_result(TrackEdit.transform(document, canvas.selection_kind, canvas.selection_ids, direction * amount))
		elif canvas.selected >= 0 and canvas.layer_editable("road"):
			perform(func(): var n = document.nodes[canvas.selected]; n.x += direction.x * amount; n.y += direction.y * amount, true)
		else: handled = false
	else: handled = false
	if handled: get_viewport().set_input_as_handled()

func set_tool(index: int) -> void:
	canvas._commit_drag()
	canvas.mode = ["select", "insert", "draw", "pit", "start", "scenery", "measure", "reference", "trace_freehand", "trace_pen", "select_objects"][index]
	if tool_picker: tool_picker.select(index)
	canvas.selected_object = -1; canvas.selected = -1; canvas.selection_ids.clear(); refresh_inspector(); canvas.queue_redraw()
	if index in [8, 9]: inspector.current_tab = 6
	if index == 10: canvas.selection_kind = "scenery"
	update_status()

func cancel_gesture() -> void:
	document = session.cancel(); document_revision = session.revision
	recompile(); refresh_inspector()

func race_errors() -> Array[String]:
	if not canvas.sketch.strokes.is_empty(): return ["Apply or clear the unapplied trace before testing or exporting runtime data."]
	var errors = TrackDocument.validate(document)
	if errors.is_empty():
		for finding in findings:
			if finding.severity == "error": errors.append(finding.message)
	return errors

func focus_finding(index: int) -> void:
	if index < 0 or index >= findings.size(): return
	var finding = findings[index]
	var p = geometry.sample(finding.fraction * geometry.length, true).p
	canvas.center = p; canvas.zoom = maxf(canvas.zoom, 0.75)
	canvas.selected = geometry.nearest(p).segment; canvas.queue_redraw()
	status.text = finding.message

func set_sector(index: int) -> void:
	if canvas.selected < 0: return
	var fraction: float = geometry.nearest(TrackDocument.point(document.nodes[canvas.selected])).fraction
	perform(func():
		var gates: Array = []
		for i in range(2):
			var f = fposmod(geometry.sector_ends[i] / geometry.length + document.start, 1)
			gates.append({"type": "sector", "f": fraction if i == index else f})
		document.timingGates = gates, true)

func calibrate_reference() -> void:
	if not document.has("reference") or canvas.measure_start == Vector2.INF or canvas.measure_end == Vector2.INF: return
	var measured = canvas.measure_start.distance_to(canvas.measure_end)
	if measured < 0.001: return
	var ratio = known_distance / measured
	var width = document.reference.width * ratio
	if width < 1 or width > 20000: UI.notify(self, "Calibration outside limits", "Image width must remain between 1 and 20,000 metres."); return
	var anchor = canvas.measure_start
	var target_center = anchor + (Vector2(document.reference.x, document.reference.y) - anchor) * ratio
	if absf(target_center.x) > 100000 or absf(target_center.y) > 100000: return
	perform(func():
		var center = Vector2(document.reference.x, document.reference.y)
		center = anchor + (center - anchor) * ratio
		document.reference.width = width; document.reference.x = center.x; document.reference.y = center.y, true)
	canvas.measure_end = anchor + (canvas.measure_end - anchor) * ratio
	canvas.queue_redraw(); status.text = "Reference calibrated to %.2f m. Road geometry was not moved." % known_distance

func disable_inputs(parent: Node) -> void:
	for child in parent.get_children():
		if child is BaseButton: child.disabled = true
		if child is SpinBox: child.editable = false
		if child is LineEdit: child.editable = false
		disable_inputs(child)

func apply_selection_result(result: Dictionary) -> void:
	if not canvas.layer_editable(canvas.selection_kind): status.text = "Unlock and show the selected layer first."; return
	if not result.ok: status.text = result.error; return
	if document == result.document: status.text = "Selection is already arranged that way."; return
	checkpoint(); document = result.document
	canvas.selection_ids = TrackEdit.indices(document, canvas.selection_kind, result.selection)
	canvas.selected = canvas.selection_ids[0] if canvas.selection_kind == "road" and not canvas.selection_ids.is_empty() else -1
	canvas.selected_object = canvas.selection_ids[0] if canvas.selection_kind == "scenery" and not canvas.selection_ids.is_empty() else -1
	recompile(); refresh_inspector()

func selection_action(action: String) -> void:
	var kind = canvas.selection_kind; var ids: Array = canvas.selection_ids.duplicate()
	if ids.is_empty():
		if canvas.selected_object >= 0: kind = "scenery"; ids = [canvas.selected_object]
		elif canvas.selected >= 0: kind = "road"; ids = [canvas.selected]
	canvas.selection_kind = kind
	if not canvas.layer_editable(kind): status.text = "The selected layer is hidden or locked."; return
	if action in ["duplicate", "group", "ungroup"] and kind != "scenery": status.text = "Grouping and duplication apply to scenery, not road topology."; return
	match action:
		"duplicate": apply_selection_result(TrackEdit.duplicate_scenery(document, ids))
		"group", "ungroup": apply_selection_result(TrackEdit.group(document, ids, action == "ungroup"))
		"align_x", "align_y", "distribute_x", "distribute_y": apply_selection_result(TrackEdit.arrange(document, kind, ids, action.right(1), action.begins_with("distribute")))
		"delete":
			var selected_indices = TrackEdit.indices(document, kind, ids)
			if selected_indices.is_empty(): return
			if kind == "road" and document.nodes.size() - selected_indices.size() < 4: status.text = "Keep at least four road points."; return
			var copy = document.duplicate(true); var items: Array = copy.nodes if kind == "road" else copy.objects
			selected_indices.reverse()
			for index in selected_indices: items.remove_at(index)
			apply_selection_result({"ok": true, "document": copy, "selection": []})

func invalidate_sketch() -> void:
	sketch_result.clear(); canvas.sketch_preview = null; canvas.queue_redraw(); update_sketch_panel(); update_status()

func update_sketch_panel() -> void:
	if not sketch_summary or not is_instance_valid(sketch_summary): return
	var points = canvas.sketch.points()
	sketch_close_button.text = "Loop closed" if canvas.sketch.closed else "Close loop"
	sketch_close_button.disabled = canvas.sketch.closed or points.size() < 4
	sketch_summary.text = "%s · %d strokes · %d samples\n%s" % ["CLOSED" if canvas.sketch.closed else "OPEN", canvas.sketch.strokes.size(), points.size(), canvas.sketch_note]
	if sketch_result.get("ok", false): sketch_summary.text += "\nPreview: %d road points · %.2f km" % [sketch_result.nodes, canvas.sketch_preview.length / 1000]
	sketch_preview_button.disabled = not canvas.sketch.closed or not canvas.layer_editable("road")
	sketch_apply_button.disabled = not sketch_result.get("ok", false) or not canvas.layer_editable("road")

func preview_sketch() -> void:
	if not canvas.layer_editable("road"): return
	sketch_result = canvas.sketch.compile(document)
	if sketch_result.ok:
		canvas.sketch_preview = session.compile_draft(sketch_result.document, vehicle)
		var diagnostics = session.diagnostics(canvas.sketch_preview)
		if TrackDiagnostics.blocking(diagnostics):
			sketch_result.ok = false; canvas.sketch_note = "Preview has blocking crossings. Adjust the trace before replacing the road."
		else: canvas.sketch_note = "Teal is the generated road. Nothing has been replaced yet."
	else: canvas.sketch_note = sketch_result.error
	update_sketch_panel(); canvas.queue_redraw()

func apply_sketch() -> void:
	if not sketch_result.get("ok", false) or not canvas.layer_editable("road"): return
	UI.confirm(self, "Replace this road?", "Apply the preview and clear the old pit route, track features and timing markers? Scenery and reference remain. Undo restores the original circuit.", "Replace road", commit_sketch)

func commit_sketch() -> void:
	if not sketch_result.get("ok", false) or not canvas.layer_editable("road"): return
	checkpoint(); document = sketch_result.document.duplicate(true)
	canvas.sketch.clear(); canvas.pen_anchor = Vector2.INF; canvas.sketch_preview = null; sketch_result.clear()
	canvas.selection_ids.clear(); canvas.selected = -1; canvas.selected_object = -1
	recompile(); refresh_inspector(); set_tool(0)
	status.text = "Traced road applied. Review the generated pit lane and timing before driving. Undo restores the original."

func confirm_clear_trace() -> void:
	if canvas.sketch.strokes.is_empty(): return
	UI.confirm(self, "Clear the unapplied trace?", "Discard these drawing strokes and their preview? The existing road and saved library files stay unchanged. This clears trace history.", "Clear trace", func():
		canvas.sketch.clear(); canvas.pen_anchor = Vector2.INF; invalidate_sketch())
