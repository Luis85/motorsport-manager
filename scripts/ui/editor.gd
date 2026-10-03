class_name TrackEditor
extends TrackEditorAuthoring
## Native presentation responsibilities; inherited state remains per instance.


func _ready() -> void:
	set_meta("pitwall_text_scale", float(preferences.get("pitwall_text_scale", 1.0)))
	theme = UI.theme()
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	if document.is_empty():
		configure(
			(
				catalog[mini(7, catalog.size() - 1)]
				if not catalog.is_empty()
				else TrackEditorSession.blank_document()
			),
			storage,
			preferences
		)
	geometry = session.compile_draft(document, vehicle)
	TrackEditorToolbar.build(self)
	var content = UI.hbox(self, true)
	canvas = TrackCanvas.new()
	canvas.configure_presentation(preferences)
	canvas.editing = true
	canvas.show_line = true
	canvas.draft_compiler = session.compile_draft
	canvas.reference_preview = session.preview
	canvas.document_revision = document_revision
	canvas.set_track(geometry, document)
	content.add_child(canvas)
	canvas.edit_started.connect(checkpoint)
	canvas.edit_cancelled.connect(cancel_gesture)
	canvas.edited.connect(recompile)
	canvas.gesture_committed.connect(recompile)
	canvas.selection_changed.connect(refresh_inspector)
	canvas.sketch_changed.connect(
		func():
			sketch_result.clear()
			update_sketch_panel()
			update_status(),
	)
	canvas.measured.connect(
		func(distance):
			status.text = (
				"Measured %.2f metres. Image calibration is available in Reference." % distance
			)
			refresh_inspector(),
	)
	var side = UI.vbox(content)
	side.custom_minimum_size.x = 330
	section_picker = UI.option(
		[
			"Point & selection",
			"Circuit & pit lane",
			"Features & scenery",
			"Reference image",
			"Checks",
			"World & layers",
			"Draw new layout"
		],
		func(index): inspector.current_tab = index
	)
	side.add_child(section_picker)
	inspector = TabContainer.new()
	inspector.tabs_visible = false
	inspector.size_flags_vertical = Control.SIZE_EXPAND_FILL
	side.add_child(inspector)
	inspector.tab_changed.connect(
		func(index):
			if index >= 0:
				section_picker.select(index)
			if sketch_actions:
				sketch_actions.visible = index == 6,
	)
	# Keep the two commit-path actions outside the scrollable authoring fields.
	sketch_actions = UI.vbox(side)
	sketch_actions.visible = false
	var sketch_action_row = UI.hbox(sketch_actions)
	sketch_preview_button = UI.button("Preview road", preview_sketch)
	sketch_apply_button = UI.button("Replace road", apply_sketch, true)
	for button in [sketch_preview_button, sketch_apply_button]:
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		sketch_action_row.add_child(button)
	var sketch_hint = UI.paragraph("Preview changes nothing. Replace asks for confirmation.")
	sketch_hint.add_theme_font_size_override("font_size", 12)
	sketch_actions.add_child(sketch_hint)
	status = UI.label("", 12, UI.MUTED)
	status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	add_child(status)
	recompile()
	refresh_inspector()
	update_status()
	setup_guide()
	PitwallDesign.scale_controls(self, UI.text_scale(self))
	PitwallDesign.focus_later(tool_picker)
	call_deferred("fit_canvas")


func setup_guide() -> void:
	guide = ContextGuide.new()
	guide.presentation_services = presentation_services
	var actions = {
		"shape": {"target": func(): return canvas, "reveal": func(): set_tool(0)},
		"scenery": {"target": func(): return inspector, "reveal": _reveal_scenery},
		"trace": {"target": func(): return inspector, "reveal": _reveal_trace},
		"checks": {"target": func(): return inspector, "reveal": _reveal_checks},
		"handoff":
		{"target": func(): return test_button, "reveal": func(): inspector.current_tab = 1},
	}
	var steps: Array = []
	for copy in session.guide_steps():
		if not actions.has(copy.key):
			continue
		var step = {"title": copy.title, "body": copy.body}
		step.merge(actions[copy.key])
		steps.append(step)
	guide.configure("editor", steps)
	add_child(guide)


func _reveal_scenery() -> void:
	set_tool(10)
	inspector.current_tab = 0


func _reveal_trace() -> void:
	set_tool(8)
	inspector.current_tab = 6


func _reveal_checks() -> void:
	set_tool(0)
	inspector.current_tab = 4


func fit_canvas() -> void:
	canvas.fit()


func inspector_page(title: String) -> VBoxContainer:
	var scroll = ScrollContainer.new()
	scroll.name = title
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	inspector.add_child(scroll)
	var margin = MarginContainer.new()
	margin.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(margin)
	for side in ["left", "right", "top", "bottom"]:
		margin.add_theme_constant_override("margin_" + side, 12)
	return UI.vbox(margin, true)


func refresh_inspector() -> void:
	TrackEditorInspector.render(self)
	PitwallDesign.scale_controls(inspector, UI.text_scale(self))


func coordinate_fields(parent: Node, node: Dictionary, road: bool) -> void:
	for field in [
		["X metres", "x", -100000, 100000, 0.1],
		["Y metres", "y", -100000, 100000, 0.1],
		["Height metres", "h", -1000, 10000, 0.1]
	]:
		UI.field(
			parent,
			field[0],
			UI.spin(
				float(node.get(field[1], 0)),
				field[2],
				field[3],
				field[4],
				func(value): perform(func(): node[field[1]] = value)
			)
		)
	if road:
		UI.field(
			parent,
			"Width metres",
			UI.spin(node.w, 5, 40, 0.1, func(value): perform(func(): node.w = value))
		)
		UI.field(
			parent,
			"Banking °",
			UI.spin(node.bank, -45, 45, 0.5, func(value): perform(func(): node.bank = value))
		)


func _unhandled_key_input(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed or event.echo:
		return
	var focus = get_viewport().gui_get_focus_owner()
	if focus is LineEdit or focus is TextEdit:
		return
	var handled = true
	if event.ctrl_pressed and event.keycode in [KEY_S, KEY_Z, KEY_Y, KEY_D, KEY_G]:
		_control_shortcut(event)
	elif event.keycode == KEY_ESCAPE:
		canvas.select_items(canvas.selection_kind, [])
	elif event.keycode == KEY_D:
		set_tool(8)
	elif event.keycode == KEY_S:
		set_tool(10)
	elif event.keycode == KEY_DELETE:
		delete_point()
	elif event.keycode == KEY_F:
		canvas.fit()
	elif event.keycode == KEY_V:
		set_tool(0)
	elif event.keycode == KEY_I:
		set_tool(1)
	elif event.keycode == KEY_P:
		set_tool(3)
	elif event.keycode == KEY_M:
		set_tool(6)
	elif event.keycode in [KEY_LEFT, KEY_RIGHT, KEY_UP, KEY_DOWN]:
		handled = _nudge_selection(event)
	else:
		handled = false
	if handled:
		get_viewport().set_input_as_handled()


func disable_inputs(parent: Node) -> void:
	for child in parent.get_children():
		if child is BaseButton:
			child.disabled = true
		if child is SpinBox:
			child.editable = false
		if child is LineEdit:
			child.editable = false
		disable_inputs(child)


func _nudge_selection(event: InputEventKey) -> bool:
	var direction = {
		KEY_LEFT: Vector2.LEFT,
		KEY_RIGHT: Vector2.RIGHT,
		KEY_UP: Vector2.UP * -1,
		KEY_DOWN: Vector2.DOWN * -1
	}[event.keycode]
	var amount = 5.0 if event.shift_pressed else 0.5
	if canvas.selection_ids.size() > 1 and canvas.layer_editable(canvas.selection_kind):
		apply_selection_result(
			TrackEdit.transform(
				document, canvas.selection_kind, canvas.selection_ids, direction * amount
			)
		)
	elif canvas.selected >= 0 and canvas.layer_editable("road"):
		perform(
			func():
				var n = document.nodes[canvas.selected]
				n.x += direction.x * amount
				n.y += direction.y * amount,
			true
		)
	else:
		return false
	return true


func _control_shortcut(event: InputEventKey) -> void:
	if event.keycode == KEY_S:
		save_document()
	elif event.keycode == KEY_Z:
		if event.shift_pressed:
			redo()
		else:
			undo()
	elif event.keycode == KEY_Y:
		redo()
	elif event.keycode == KEY_D:
		selection_action("duplicate")
	elif event.keycode == KEY_G:
		selection_action("ungroup" if event.shift_pressed else "group")
