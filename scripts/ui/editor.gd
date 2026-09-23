class_name TrackEditor
extends VBoxContainer
signal test_requested(document: Dictionary)
var document: Dictionary = {}
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
var saved_signature = ""

func configure(d: Dictionary) -> void:
	document = TrackDocument.normalize(d)
	saved_signature = JSON.stringify(document)

func _ready() -> void:
	size_flags_vertical = Control.SIZE_EXPAND_FILL; size_flags_horizontal = Control.SIZE_EXPAND_FILL
	if document.is_empty(): configure(App.library[7] if App.library.size() > 7 else App.library[0])
	geometry = TrackGeometry.new(document, vehicle)
	var title_row = UI.hbox(self)
	title_row.add_child(UI.label("CIRCUIT ATELIER", 23))
	dirty_label = UI.label("SAVED", 12, UI.GOOD); title_row.add_child(dirty_label)
	var space = Control.new(); space.size_flags_horizontal = Control.SIZE_EXPAND_FILL; title_row.add_child(space)
	title_row.add_child(UI.label("AUTHOR → VALIDATE → DRIVE", 12, UI.MUTED))
	var actions = HFlowContainer.new(); add_child(actions)
	var choices: Array = ["Load a library circuit…"]
	for track in App.library: choices.append(track.name)
	var library = UI.option(choices, func(index):
		if index > 0: confirm_discard(func(): replace_document(App.library[index - 1])))
	library.custom_minimum_size.x = 260; actions.add_child(library)
	actions.add_child(UI.button("New circuit", new_document))
	actions.add_child(UI.button("Save to library", save_document, true))
	actions.add_child(UI.button("Import JSON", import_document))
	actions.add_child(UI.button("Export JSON", export_document))
	actions.add_child(UI.button("Bake runtime", export_runtime))
	actions.add_child(UI.button("Test weekend", func():
		var errors = TrackDocument.validate(document)
		if errors.is_empty(): test_requested.emit(document.duplicate(true))
		else: UI.notify(self, "Track needs attention", "\n".join(errors))))
	var tools = HFlowContainer.new(); add_child(tools)
	tools.add_child(UI.option(["Select / move", "Insert point", "Draw points", "Edit pit lane", "Set start / finish", "Place scenery", "Measure", "Move reference"], func(index):
		canvas.mode = ["select", "insert", "draw", "pit", "start", "scenery", "measure", "reference"][index]
		canvas.dragging = ""; refresh_inspector(); canvas.queue_redraw()))
	tools.add_child(UI.button("Undo", undo))
	tools.add_child(UI.button("Redo", redo))
	tools.add_child(UI.button("Fit circuit", func(): canvas.fit()))
	tools.add_child(UI.check("Racing line", true, func(value): canvas.show_line = value; canvas.queue_redraw()))
	tools.add_child(UI.check("Elevation profile", false, func(value): canvas.show_profile = value; canvas.queue_redraw()))
	tools.add_child(UI.label("Drag handles · Ctrl: snap 5 m · Wheel: zoom · Right-drag: pan", 12, UI.MUTED))
	var content = UI.hbox(self, true)
	canvas = TrackCanvas.new(); canvas.editing = true; canvas.show_line = true
	canvas.set_track(geometry, document); content.add_child(canvas)
	canvas.edit_started.connect(checkpoint)
	canvas.edited.connect(func(): dirty = true; geometry = TrackGeometry.new(document, vehicle) if document.nodes.size() >= 4 else geometry; canvas.set_track(geometry, document); update_status())
	canvas.selection_changed.connect(refresh_inspector)
	canvas.measured.connect(func(distance): status.text = "Measured %.2f metres. The ruler uses the same metre coordinates as the simulation." % distance)
	inspector = TabContainer.new(); inspector.custom_minimum_size.x = 330; content.add_child(inspector)
	status = UI.label("", 12, UI.MUTED); add_child(status)
	refresh_inspector(); update_status()
	call_deferred("fit_canvas")

func fit_canvas() -> void:
	canvas.fit()

func checkpoint() -> void:
	var snapshot = document.duplicate(true)
	if undo_stack.is_empty() or JSON.stringify(undo_stack.back()) != JSON.stringify(snapshot):
		undo_stack.append(snapshot)
		if undo_stack.size() > 50: undo_stack.pop_front()
	redo_stack.clear(); dirty = true

func perform(action: Callable, rebuild_inspector: bool = false) -> void:
	checkpoint(); action.call(); recompile()
	if rebuild_inspector: refresh_inspector()

func recompile() -> void:
	if document.nodes.size() >= 4:
		geometry = TrackGeometry.new(document, vehicle); canvas.set_track(geometry, document)
	else: canvas.document = document; canvas.queue_redraw()
	update_status()

func undo() -> void:
	if undo_stack.is_empty(): return
	redo_stack.append(document.duplicate(true)); document = undo_stack.pop_back()
	canvas.selected = mini(canvas.selected, document.nodes.size() - 1)
	recompile(); refresh_inspector()

func redo() -> void:
	if redo_stack.is_empty(): return
	undo_stack.append(document.duplicate(true)); document = redo_stack.pop_back()
	recompile(); refresh_inspector()

func update_status() -> void:
	dirty = JSON.stringify(document) != saved_signature
	dirty_label.text = "UNSAVED CHANGES" if dirty else ("LIBRARY SOURCE" if document.get("builtin", false) else "SAVED")
	dirty_label.add_theme_color_override("font_color", UI.ACCENT if dirty else UI.GOOD)
	var errors = TrackDocument.validate(document)
	if not errors.is_empty():
		status.text = "DRAFT  ·  " + " · ".join(errors); status.add_theme_color_override("font_color", UI.ACCENT)
	else:
		status.text = "%d control points  ·  %.3f km  ·  %s reference lap %s  ·  Native authoring format v1" % [document.nodes.size(), geometry.length / 1000, vehicle, RaceSim.format_time(geometry.estimate)]
		status.add_theme_color_override("font_color", UI.MUTED)

func inspector_page(title: String) -> VBoxContainer:
	var scroll = ScrollContainer.new(); scroll.name = title; scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED; inspector.add_child(scroll)
	var margin = MarginContainer.new(); margin.size_flags_horizontal = Control.SIZE_EXPAND_FILL; scroll.add_child(margin)
	for side in ["left", "right", "top", "bottom"]: margin.add_theme_constant_override("margin_" + side, 12)
	return UI.vbox(margin, true)

func refresh_inspector() -> void:
	if inspector == null: return
	var tab = inspector.current_tab
	UI.clear(inspector)
	var point = inspector_page("Point")
	if canvas.mode == "pit" and canvas.selected_pit >= 0 and not document.pits.is_empty() and canvas.selected_pit < document.pits[0].nodes.size():
		var node = document.pits[0].nodes[canvas.selected_pit]
		point.add_child(UI.label("PIT POINT %d" % (canvas.selected_pit + 1), 16, UI.ACCENT))
		coordinate_fields(point, node, false)
		point.add_child(UI.button("Delete pit point", func(): perform(func(): document.pits[0].nodes.remove_at(canvas.selected_pit); canvas.selected_pit = -1, true)))
		point.add_child(UI.paragraph("Drag the gold pit handles. Shift-click empty space to append a point. Entry and exit gates are edited in Track."))
	elif canvas.selected >= 0 and canvas.selected < document.nodes.size():
		var node = document.nodes[canvas.selected]
		point.add_child(UI.label("CONTROL POINT %d" % (canvas.selected + 1), 16, UI.ACCENT))
		coordinate_fields(point, node, true)
		point.add_child(UI.check("Aligned handles", node.get("mode", "aligned") == "aligned", func(value): perform(func(): node.mode = "aligned" if value else "free")))
		point.add_child(UI.button("Smooth this corner", func(): perform(func(): TrackDocument.smooth_node(document, canvas.selected), true)))
		point.add_child(UI.button("Make a sharp corner", func(): perform(func(): node.mode = "free"; TrackDocument.set_handle(node, "in", Vector2.ZERO); TrackDocument.set_handle(node, "out", Vector2.ZERO), true)))
		point.add_child(UI.button("Split next segment", func(): perform(func(): canvas.selected = TrackDocument.split_segment(document, canvas.selected), true)))
		point.add_child(UI.button("Delete control point", delete_point))
		point.add_child(UI.paragraph("The square handles shape the exact Bézier curve. Insertion splits that curve without changing its shape. Banking and height are interpolated along the circuit."))
	else:
		point.add_child(UI.label("DIRECT MANIPULATION", 16, UI.ACCENT))
		point.add_child(UI.paragraph("Click a control point to inspect it. Drag the point or its square handles. Double-click the road to insert a shape-preserving point."))
		point.add_child(UI.paragraph("New circuits begin as a four-corner starter. Draw points appends new corners; the circuit stays closed. Use Smooth all only on a new rough outline—not on a surveyed template."))
		point.add_child(UI.button("Smooth all points", func(): perform(func():
			for i in range(document.nodes.size()): TrackDocument.smooth_node(document, i))))
		point.add_child(UI.paragraph("Navigation\nWheel: zoom at cursor\nRight or middle drag: pan\nCtrl while dragging: snap to 5 m\nF: fit\nCtrl+Z / Ctrl+Y: undo / redo\nCtrl+S: save\nDelete: delete selected point"))
	var track = inspector_page("Track")
	track.add_child(UI.label("CIRCUIT", 16, UI.ACCENT))
	name_field = LineEdit.new(); name_field.text = document.name; name_field.placeholder_text = "Circuit name"; track.add_child(name_field)
	name_field.text_submitted.connect(func(value): perform(func(): document.name = value.strip_edges()))
	name_field.focus_exited.connect(func():
		if is_instance_valid(name_field) and document.name != name_field.text: perform(func(): document.name = name_field.text.strip_edges()))
	track.add_child(UI.option(TrackGeometry.PRESETS.keys(), func(index): vehicle = TrackGeometry.PRESETS.keys()[index]; recompile(), TrackGeometry.PRESETS.keys().find(vehicle)))
	UI.field(track, "Start / finish %", UI.spin(document.start * 100, 0, 99.99, 0.01, func(value): perform(func(): document.start = value / 100)))
	track.add_child(UI.paragraph("Set start / finish lets you click the road. Race distance zero and the grid follow this gate, not control point one."))
	track.add_child(UI.label("PIT LANE", 16, UI.ACCENT))
	if not document.pits.is_empty():
		var pit = document.pits[0]
		UI.field(track, "Entry %", UI.spin(pit.entry * 100, 0, 99.99, 0.01, func(value): perform(func(): pit.entry = value / 100)))
		UI.field(track, "Exit %", UI.spin(pit.exit * 100, 0, 99.99, 0.01, func(value): perform(func(): pit.exit = value / 100)))
		UI.field(track, "Limit km/h", UI.spin(pit.get("speed", 80), 30, 100, 5, func(value): perform(func(): pit.speed = value)))
		track.add_child(UI.paragraph("Entry and exit are absolute fractions of the authored circuit. The pit exit may wrap across start / finish. Use Edit pit lane to move its points."))
	track.add_child(UI.button("Generate service lane", func(): perform(func():
		document.pits = []
		var compiled = TrackGeometry.new(document, vehicle)
		document.pits = compiled.document.pits.duplicate(true), true)))
	track.add_child(UI.label("VALIDATION", 16, UI.ACCENT))
	var issues = TrackDocument.validate(document)
	if geometry: issues.append_array(geometry.warnings)
	track.add_child(UI.paragraph("Authoring data is valid." if issues.is_empty() else "\n".join(issues), UI.GOOD if issues.is_empty() else UI.ACCENT))
	track.add_child(UI.paragraph("Lap estimates are a heuristic reference, not a guaranteed fastest lap. Geographic layouts are unofficial reconstructions. Clearance metadata does not certify safety."))
	if not document.provenance.is_empty(): track.add_child(UI.paragraph(str(document.provenance.get("notice", document.provenance.get("planSource", "")))))
	var features = inspector_page("Features")
	features.add_child(UI.label("ROAD FEATURES", 16, UI.ACCENT))
	var feature_names: Array = ["Select a feature…"]
	for f in document.features: feature_names.append("%s  %.1f–%.1f%%" % [str(f.type).capitalize(), f.a * 100, f.b * 100])
	features.add_child(UI.option(feature_names, func(index): feature_index = index - 1; refresh_inspector(), mini(feature_index + 1, feature_names.size() - 1)))
	if feature_index >= 0 and feature_index < document.features.size():
		var f = document.features[feature_index]
		UI.field(features, "From %", UI.spin(f.a * 100, 0, 99.99, 0.1, func(value): perform(func(): f.a = value / 100)))
		UI.field(features, "To %", UI.spin(f.b * 100, 0, 99.99, 0.1, func(value): perform(func(): f.b = value / 100)))
		UI.field(features, "Width m", UI.spin(f.get("width", 1), 0.2, 20, 0.1, func(value): perform(func(): f.width = value)))
		UI.field(features, "Clearance m", UI.spin(f.get("clearance", 5), 1, 20, 0.1, func(value): perform(func(): f.clearance = value)))
		features.add_child(UI.option(["Both sides", "Left side", "Right side"], func(index): perform(func(): f.side = ["both", "left", "right"][index]), ["both", "left", "right"].find(f.get("side", "both"))))
		features.add_child(UI.button("Remove this feature", func(): perform(func(): document.features.remove_at(feature_index); feature_index = -1, true)))
	features.add_child(UI.label("ADD A FEATURE", 14, UI.MUTED))
	for type in ["curb", "runoff", "barrier", "tunnel", "bridge"]:
		features.add_child(UI.button("+ " + type.capitalize(), func(): perform(func():
			var a = geometry.nearest(TrackDocument.point(document.nodes[canvas.selected])).fraction if canvas.selected >= 0 else 0.0
			document.features.append({"type": type, "a": a, "b": fposmod(a + 0.04, 1), "side": "both", "width": 1, "clearance": 5, "thickness": 1})
			feature_index = document.features.size() - 1, true)))
	features.add_child(UI.paragraph("Feature ranges wrap around the lap. Bridges and tunnels are top-down annotations; the road height controls the elevation profile and runtime data."))
	features.add_child(UI.label("SCENERY", 16, UI.ACCENT))
	features.add_child(UI.paragraph("Place scenery adds trees with a click. Existing imported garages, grandstands and other props are preserved and drawn."))
	features.add_child(UI.button("Remove last scenery object", func():
		if not document.objects.is_empty(): perform(func(): document.objects.pop_back())))
	var reference = inspector_page("Reference")
	reference.add_child(UI.label("TRACE AN IMAGE", 16, UI.ACCENT))
	reference.add_child(UI.button("Import PNG / JPG", import_reference))
	reference.add_child(UI.paragraph("The image is embedded in track exports, so it travels with the circuit. Use an image you have rights to share. Move reference drags it without changing the road."))
	if document.has("reference"):
		var ref = document.reference
		UI.field(reference, "Image width m", UI.spin(ref.width, 10, 20000, 1, func(value): perform(func(): ref.width = value)))
		UI.field(reference, "Center X", UI.spin(ref.x, -100000, 100000, 1, func(value): perform(func(): ref.x = value)))
		UI.field(reference, "Center Y", UI.spin(ref.y, -100000, 100000, 1, func(value): perform(func(): ref.y = value)))
		UI.field(reference, "Opacity", UI.spin(ref.opacity, 0.05, 0.9, 0.05, func(value): perform(func(): ref.opacity = value)))
		reference.add_child(UI.paragraph("Calibration: measure a known distance on the image, then multiply Image width by known distance / measured distance."))
		reference.add_child(UI.button("Remove reference", func(): perform(func(): document.erase("reference"), true)))
	inspector.current_tab = clampi(tab, 0, inspector.get_tab_count() - 1)

func coordinate_fields(parent: Node, node: Dictionary, road: bool) -> void:
	for field in [["X metres", "x", -100000, 100000, 0.1], ["Y metres", "y", -100000, 100000, 0.1], ["Height metres", "h", -1000, 10000, 0.1]]:
		UI.field(parent, field[0], UI.spin(float(node.get(field[1], 0)), field[2], field[3], field[4], func(value): perform(func(): node[field[1]] = value)))
	if road:
		UI.field(parent, "Width metres", UI.spin(node.w, 5, 40, 0.1, func(value): perform(func(): node.w = value)))
		UI.field(parent, "Banking °", UI.spin(node.bank, -45, 45, 0.5, func(value): perform(func(): node.bank = value)))

func delete_point() -> void:
	if canvas.selected < 0: return
	if document.nodes.size() <= 4: UI.notify(self, "Keep a closed circuit", "A circuit must retain at least four points."); return
	perform(func(): document.nodes.remove_at(canvas.selected); canvas.selected = -1, true)

func save_document() -> void:
	if name_field: document.name = name_field.text.strip_edges()
	var error = App.save_track(document)
	if error.is_empty(): saved_signature = JSON.stringify(document); update_status(); status.text = "Saved to the track library. The Grand Prix selector will include this circuit."
	else: UI.notify(self, "Could not save circuit", error)

func export_document() -> void:
	var errors = TrackDocument.validate(document)
	if not errors.is_empty(): UI.notify(self, "Track needs attention", "\n".join(errors)); return
	var dialog = UI.file_dialog(self, true, ["*.json ; Track authoring JSON"], func(path):
		var error = Storage.write_json(path, document)
		UI.notify(self, "Export circuit", "Track exported." if error.is_empty() else error))
	dialog.current_file = document.name.validate_filename() + ".json"

func export_runtime() -> void:
	var errors = TrackDocument.validate(document)
	if not errors.is_empty(): UI.notify(self, "Track needs attention", "\n".join(errors)); return
	var dialog = UI.file_dialog(self, true, ["*.json ; Baked runtime JSON"], func(path):
		var error = Storage.write_json(path, TrackGeometry.new(document, vehicle).runtime_export())
		UI.notify(self, "Bake runtime", "Runtime package exported with geometry, racing line, speed profile, pit lane and authoring metadata." if error.is_empty() else error))
	dialog.current_file = document.name.validate_filename() + "-runtime.json"

func import_document() -> void:
	UI.file_dialog(self, false, ["*.json ; Native or Circuit Atelier project"], func(path):
		var result = Storage.read_json(path)
		if not result.ok: UI.notify(self, "Import failed", result.error); return
		var errors = TrackDocument.validate(result.data)
		if not errors.is_empty(): UI.notify(self, "Import failed", "\n".join(errors)); return
		confirm_discard(func(): replace_document(result.data); document.builtin = false; saved_signature = ""; update_status()))

func import_reference() -> void:
	UI.file_dialog(self, false, ["*.png,*.jpg,*.jpeg ; Reference image"], func(path):
		var image = Image.new()
		if image.load(path) != OK: UI.notify(self, "Image unavailable", "Could not read this image."); return
		if image.get_width() > 2048 or image.get_height() > 2048:
			var ratio = 2048.0 / maxf(image.get_width(), image.get_height())
			image.resize(int(image.get_width() * ratio), int(image.get_height() * ratio))
		var bytes = image.save_png_to_buffer()
		if bytes.size() > 6000000: UI.notify(self, "Image too large", "Use an image under 6 MB after PNG conversion."); return
		perform(func(): document.reference = {"png": Marshalls.raw_to_base64(bytes), "width": geometry.bounds.size.x, "x": geometry.bounds.get_center().x, "y": geometry.bounds.get_center().y, "opacity": 0.35}, true))

func new_document() -> void:
	confirm_discard(func():
		var nodes: Array = []
		for p in [Vector2(-300, -150), Vector2(300, -150), Vector2(300, 150), Vector2(-300, 150)]: nodes.append(TrackDocument.node_at(p))
		var d = TrackDocument.normalize({"name": "My new circuit", "nodes": nodes, "closed": true})
		for i in range(4): TrackDocument.smooth_node(d, i)
		replace_document(d); saved_signature = ""; update_status())

func replace_document(d: Dictionary) -> void:
	document = TrackDocument.normalize(d); undo_stack.clear(); redo_stack.clear(); canvas.selected = -1; feature_index = -1
	saved_signature = JSON.stringify(document); recompile(); refresh_inspector(); canvas.fit()

func confirm_discard(callback: Callable) -> void:
	if not dirty: callback.call(); return
	var dialog = ConfirmationDialog.new(); dialog.title = "Unsaved circuit changes"; dialog.dialog_text = "Discard unsaved changes to this circuit? Saved library files will not be deleted."
	dialog.ok_button_text = "Discard changes"; add_child(dialog); dialog.confirmed.connect(func(): dialog.queue_free(); callback.call()); dialog.canceled.connect(dialog.queue_free); dialog.popup_centered(Vector2i(500, 180))

func _unhandled_key_input(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed or event.echo: return
	var focus = get_viewport().gui_get_focus_owner()
	if focus is LineEdit or focus is TextEdit: return
	if event.ctrl_pressed and event.keycode == KEY_S: save_document(); get_viewport().set_input_as_handled()
	elif event.ctrl_pressed and event.keycode == KEY_Z: undo(); get_viewport().set_input_as_handled()
	elif event.ctrl_pressed and event.keycode == KEY_Y: redo(); get_viewport().set_input_as_handled()
	elif event.keycode == KEY_DELETE: delete_point(); get_viewport().set_input_as_handled()
	elif event.keycode == KEY_F: canvas.fit(); get_viewport().set_input_as_handled()
