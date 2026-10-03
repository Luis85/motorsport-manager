extends SceneTree
var game
var errors: Array[String] = []
var checks = 0
var screenshots = 0


func _initialize():
	call_deferred("run")


func check(value: bool, text: String):
	checks += 1
	if not value:
		errors.append(text)
		push_error(text)


func settle():
	for i in range(8):
		await process_frame


func capture(name: String):
	await settle()
	await RenderingServer.frame_post_draw
	var image = root.get_texture().get_image()
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://reports"))
	image.save_png("res://reports/" + name + ".png")
	screenshots += 1


func tower_positions(view) -> bool:
	var item = view.tower.get_root().get_first_child()
	var expected = 1
	while item != null:
		if item.get_text(0) != str(expected):
			return false
		expected += 1
		item = item.get_next()
	return expected == 13


func is_visible_inside(control: Control) -> bool:
	return (
		control.is_visible_in_tree()
		and control.get_viewport_rect().encloses(control.get_global_rect())
	)


func mouse_button(canvas, at: Vector2, pressed: bool) -> void:
	var event = InputEventMouseButton.new()
	event.position = at
	event.button_index = MOUSE_BUTTON_LEFT
	event.pressed = pressed
	canvas._gui_input(event)


func mouse_drag(canvas, from: Vector2, to: Vector2) -> void:
	var event = InputEventMouseMotion.new()
	event.position = to
	event.relative = to - from
	event.button_mask = MOUSE_BUTTON_MASK_LEFT
	canvas._gui_input(event)


func test_editor_transactions(editor) -> void:
	editor.undo()
	await settle()
	var original = editor.document.duplicate(true)
	var redo_count = editor.redo_stack.size()
	var undo_count = editor.undo_stack.size()
	var canonical = editor.session.read_document()
	var observed_revision = editor.session.revision
	editor.perform(func(): editor.document.nodes[0].w = 4)
	check(
		(
			editor.session.read_document() == canonical
			and editor.session.revision == observed_revision
		),
		"Native rejected authoring edit cannot change the canonical document or revision"
	)
	check(
		(
			editor.document == canonical
			and editor.undo_stack.size() == undo_count
			and editor.redo_stack.size() == redo_count
		),
		"Native validation rejection restores the canvas draft without destroying redo"
	)
	check(
		editor.status.text.contains("Road width"),
		"Native editor reports the domain-owned draft failure"
	)
	await capture("17-editor-draft-rejection")
	var canvas = editor.canvas
	canvas.selected = -1
	canvas.mode = "select"
	var at = canvas.screen(TrackDocument.point(editor.document.nodes[0]))
	mouse_button(canvas, at, true)
	mouse_button(canvas, at, false)
	check(
		editor.undo_stack.size() == undo_count and editor.redo_stack.size() == redo_count,
		"Selecting without moving preserves both edit histories"
	)
	mouse_button(canvas, at, true)
	mouse_drag(canvas, at, at + Vector2(18, 12))
	canvas._process(0.2)
	check(canvas.geometry.preview_only, "Pointer drag uses the lightweight preview")
	check(
		editor.document.nodes[0].x != original.nodes[0].x,
		"Pointer motion edits the selected authoring point"
	)
	var escape = InputEventKey.new()
	escape.pressed = true
	escape.keycode = KEY_ESCAPE
	canvas._unhandled_key_input(escape)
	check(
		editor.document == original and editor.redo_stack.size() == redo_count,
		"Escape rolls back only the active gesture and restores redo"
	)
	check(
		not editor.geometry.preview_only and not canvas.geometry.preview_only,
		"Cancelled gesture restores a full baked track"
	)
	mouse_button(canvas, at, true)
	mouse_drag(canvas, at, at + Vector2(14, -8))
	mouse_button(canvas, at + Vector2(14, -8), false)
	check(
		editor.undo_stack.size() == undo_count + 1 and not canvas.geometry.preview_only,
		"A committed drag records one undo action and one final bake"
	)
	editor.undo()
	editor.redo()  # Reapply committed pointer edit to exercise both directions.
	check(not editor.geometry.preview_only, "Undo and redo never expose a preview to testing")
	# Restore the original test's +12m edit, leaving a predictable document for the roundtrip.
	editor.document = original.duplicate(true)
	editor.recompile()
	editor.refresh_inspector()
	editor.perform(func(): editor.document.nodes[0].x += 12)
	var image = Image.create_empty(16, 16, false, Image.FORMAT_RGBA8)
	image.fill(Color(0.6, 0.6, 0.6, 1))
	var nodes_before = editor.document.nodes.duplicate(true)
	var contract_predicate_0 = func():
		editor.document.reference = {
			"png": Marshalls.raw_to_base64(image.save_png_to_buffer()),
			"width": 100.0,
			"x": 10.0,
			"y": 20.0,
			"opacity": 0.3
		}
	editor.perform(contract_predicate_0, true)
	canvas.measure_start = Vector2.ZERO
	canvas.measure_end = Vector2(50, 0)
	editor.known_distance = 100
	editor.calibrate_reference()
	check(
		(
			editor.document.reference.width == 200
			and editor.document.reference.x == 20
			and editor.document.reference.y == 40
		),
		"Two-point calibration scales the image about the measured anchor"
	)
	check(
		editor.document.nodes == nodes_before, "Reference calibration does not move road geometry"
	)
	editor.undo()
	editor.undo()  # Remove calibration and test image, preserving the point edit.
	canvas.measure_start = Vector2.INF
	canvas.measure_end = Vector2.INF
	editor.inspector.current_tab = 4
	await capture("15-editor-checks")
	check(
		editor.inspector.get_tab_title(4) == "Checks" and not editor.test_button.disabled,
		"Designer has a validation workspace and enabled test handoff"
	)
	editor.inspector.current_tab = 0


func test_illustrated_editor(editor) -> void:
	var canvas = editor.canvas
	var before = JSON.stringify(editor.document)
	var history = editor.undo_stack.size()
	canvas.set_layer("road", "locked", true)
	var at = canvas.screen(TrackDocument.point(editor.document.nodes[0]))
	mouse_button(canvas, at, true)
	mouse_drag(canvas, at, at + Vector2(30, 15))
	mouse_button(canvas, at, false)
	check(
		JSON.stringify(editor.document) == before and editor.undo_stack.size() == history,
		"Locked road ignores pointer drags without creating history"
	)
	canvas.selected = 0
	editor.delete_point()
	check(JSON.stringify(editor.document) == before, "Delete respects the road lock")
	canvas.set_layer("road", "locked", false)
	canvas.set_layer("scenery", "visible", false)
	check(
		not canvas.world_layer.scenery_visible and JSON.stringify(editor.document) == before,
		"Hiding scenery changes only the editor view"
	)
	canvas.set_layer("scenery", "visible", true)
	canvas.toggle_preview()
	editor.session.advance_preview(0.08)
	canvas._process(0.08)
	check(
		canvas.preview_running and canvas.preview_distance > 0,
		"Reference dot advances along the baked line"
	)
	check(
		JSON.stringify(editor.document) == before,
		"Reference preview does not mutate the authored track"
	)
	editor.inspector.current_tab = 5
	await capture("16-illustrated-editor")
	canvas.preview_running = false
	canvas.overlay.queue_redraw()
	var nodes = editor.document.nodes.duplicate(true)
	var contract_predicate_1 = func():
		editor.document.visual.season = "autumn"
		editor.document.visual.environment = "woodland"
	editor.perform(contract_predicate_1, true)
	check(editor.document.nodes == nodes, "Illustration controls do not change the road")
	await capture("17-autumn-world")
	editor.undo()
	check(JSON.stringify(editor.document) == before, "World style changes participate in undo")
	editor.inspector.current_tab = 0
