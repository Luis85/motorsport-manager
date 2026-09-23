extends SceneTree
var game
var errors: Array[String] = []
var checks = 0
var screenshots = 0
func _initialize():
	call_deferred("run")
func check(value: bool, text: String):
	checks += 1
	if not value: errors.append(text); push_error(text)
func settle():
	for i in range(8): await process_frame
func capture(name: String):
	await settle()
	await RenderingServer.frame_post_draw
	var image = root.get_texture().get_image()
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://reports"))
	image.save_png("res://reports/" + name + ".png")
	screenshots += 1
func run():
	root.size = Vector2i(1440, 900)
	game = load("res://scenes/main.tscn").instantiate()
	root.add_child(game)
	await capture("01-main-menu")
	check(game.screen_name == "main_menu", "Main menu starts")
	game.show_editor()
	await capture("02-track-editor")
	check(game.editor.canvas.size.x > 400, "Editor canvas has usable width")
	game.editor.canvas.selected = 0
	game.editor.refresh_inspector()
	await capture("03-point-inspector")
	var original_x = game.editor.document.nodes[0].x
	game.editor.perform(func(): game.editor.document.nodes[0].x += 12)
	check(game.editor.dirty, "Editor marks a changed node dirty")
	game.editor.undo()
	check(is_equal_approx(game.editor.document.nodes[0].x, original_x), "Editor undo restores node")
	game.editor.redo()
	check(is_equal_approx(game.editor.document.nodes[0].x, original_x + 12), "Editor redo reapplies node")
	await test_editor_transactions(game.editor)
	game.editor.test_requested.emit(game.editor.document.duplicate(true))
	await settle()
	check(game.screen_name == "grand_prix_setup" and not game.editor_draft.is_empty(), "Test weekend preserves unsaved editor draft")
	game.show_editor()
	await settle()
	check(game.editor.dirty and is_equal_approx(game.editor.document.nodes[0].x, original_x + 12), "Return to editor restores unsaved changes")
	game.editor.document.name = "UI test circuit"
	game.editor.name_field.text = "UI test circuit"
	game.editor.save_document()
	check(not game.editor.dirty and not game.editor.document.builtin, "Editor saves an independent custom track")
	check(root.get_node("App").library.size() == 9, "Custom circuit enters the shared library")
	game.show_settings()
	await capture("04-settings")
	game.show_library()
	await capture("05-grand-prix-setup")
	var app = root.get_node("App")
	app.restore_settings(JSON.parse_string('{"speed":8,"labels":false}'))
	check(app.settings.speed == 8 and not app.settings.labels, "Saved JSON speed restores correctly despite numeric float decoding")
	app.restore_settings({"speed": 1.5}); check(app.settings.speed == 8, "Invalid fractional default speed is ignored")
	app.restore_settings({"speed": 1, "labels": true})
	app.weekend = RaceSim.new(TrackGeometry.new(app.library[7]), {"laps": 3, "scenario": "changeable", "intensity": "calm"})
	game.show_weekend()
	await capture("06-weekend-briefing")
	var view = game.content.get_child(0)
	view.primary_action()
	for i in range(1800): app.weekend.step()
	app.weekend.paused = true
	await capture("07-qualifying")
	check(app.weekend.phase == "qualifying", "Qualifying is visible")
	app.weekend.paused = false
	for i in range(30000):
		app.weekend.step()
		if app.weekend.phase == "qualifying_results": break
	check(app.weekend.phase == "qualifying_results", "Qualifying reaches results")
	view.refresh()
	await capture("08-qualifying-results")
	view.tabs.current_tab = 1
	await capture("12-qualifying-splits")
	check("S1" in view.telemetry_label.text or "SECTOR" in view.telemetry_label.text, "Telemetry exposes measured sector information")
	view.tabs.current_tab = 0
	view.primary_action(); view.primary_action()
	for i in range(15000):
		app.weekend.step()
		if app.weekend.phase == "grid_ready": break
	check(app.weekend.phase == "grid_ready", "Formation returns to grid")
	view.primary_action()
	for i in range(950): app.weekend.step()
	app.weekend.paused = true
	view.refresh()
	await capture("09-race")
	check(app.weekend.phase == "race", "Race is visible")
	var tree_ids = view.rank_rows.map(func(item): return item.get_instance_id())
	view.select_driver(6)
	for i in range(30): view.refresh()
	check(tree_ids == view.rank_rows.map(func(item): return item.get_instance_id()), "Thirty telemetry refreshes retain the same timing TreeItems")
	check(app.weekend.selected_id == 6, "Timing refresh preserves the chosen driver")
	view.select_driver(3)
	view.set_follow(true); view.canvas.navigated.emit()
	check(not view.follow and not view.follow_control.button_pressed, "Manual navigation releases the follow camera and its toggle")
	var paused_clock = app.weekend.clock
	view.tabs.current_tab = 1; view.canvas.show_surface = true
	await capture("13-live-telemetry")
	check(is_visible_inside(view.box_button), "Pit action stays visible while telemetry is open")
	check(app.weekend.clock == paused_clock, "Opening telemetry does not advance a paused simulation")
	view.tabs.current_tab = 2
	await capture("14-race-control")
	check(is_visible_inside(view.box_button), "Pit action stays visible while radio is open")
	view.dispatch("speed", {"value": 8})
	check(view.speed_control.selected == 3, "Simulation speed and selector stay synchronized")
	view.dispatch("speed", {"value": 1}); view.tabs.current_tab = 0
	view.dispatch("pace", {"value": 2})
	check(not app.weekend.cars[3].auto and not view.automate.button_pressed, "Manual pace change updates delegation immediately")
	check(not view.get_children().any(func(node): return node is AcceptDialog and node.visible), "Routine commands do not open blocking dialogs")
	view.dispatch("compound", {"value": "S"}); view.dispatch("pit")
	app.weekend.paused = false
	for i in range(50000):
		app.weekend.step()
		if app.weekend.phase == "results": break
	view.refresh()
	await capture("10-race-results")
	check(app.weekend.phase == "results", "Race completes")
	# Native actual window-size change; controls must stay within the root viewport.
	root.size = Vector2i(1100, 720)
	await capture("11-small-window")
	check(view.canvas.size.x > 220, "Small-window canvas remains usable")
	check(is_visible_inside(view.box_button), "Pit action remains inside the small-window viewport")
	check(tower_positions(view), "Timing tower exposes positions for all twelve cars")
	check(app.save_weekend().is_empty(), "Weekend UI checkpoint saves")
	app.weekend = null
	check(app.load_weekend().is_empty() and app.weekend.phase == "results", "Completed weekend resumes from disk")
	var report = {"passed": errors.is_empty(), "checks": checks, "errors": errors, "screenshots": screenshots}
	Storage.write_json("res://reports/ui-smoke.json", report)
	print("UI_SMOKE ", JSON.stringify(report))
	quit(0 if errors.is_empty() else 1)

func tower_positions(view) -> bool:
	var item = view.tower.get_root().get_first_child()
	var expected = 1
	while item != null:
		if item.get_text(0) != str(expected): return false
		expected += 1
		item = item.get_next()
	return expected == 13

func is_visible_inside(control: Control) -> bool:
	return control.is_visible_in_tree() and control.get_viewport_rect().encloses(control.get_global_rect())

func mouse_button(canvas, at: Vector2, pressed: bool) -> void:
	var event = InputEventMouseButton.new(); event.position = at; event.button_index = MOUSE_BUTTON_LEFT; event.pressed = pressed
	canvas._gui_input(event)

func mouse_drag(canvas, from: Vector2, to: Vector2) -> void:
	var event = InputEventMouseMotion.new(); event.position = to; event.relative = to - from; event.button_mask = MOUSE_BUTTON_MASK_LEFT
	canvas._gui_input(event)

func test_editor_transactions(editor) -> void:
	editor.undo(); await settle()
	var original = editor.document.duplicate(true)
	var redo_count = editor.redo_stack.size(); var undo_count = editor.undo_stack.size()
	var canvas = editor.canvas
	canvas.selected = -1; canvas.mode = "select"
	var at = canvas.screen(TrackDocument.point(editor.document.nodes[0]))
	mouse_button(canvas, at, true); mouse_button(canvas, at, false)
	check(editor.undo_stack.size() == undo_count and editor.redo_stack.size() == redo_count, "Selecting without moving preserves both edit histories")
	mouse_button(canvas, at, true); mouse_drag(canvas, at, at + Vector2(18, 12))
	canvas._process(0.2)
	check(canvas.geometry.preview_only, "Pointer drag uses the lightweight preview")
	check(editor.document.nodes[0].x != original.nodes[0].x, "Pointer motion edits the selected authoring point")
	var escape = InputEventKey.new(); escape.pressed = true; escape.keycode = KEY_ESCAPE
	canvas._unhandled_key_input(escape)
	check(editor.document == original and editor.redo_stack.size() == redo_count, "Escape rolls back only the active gesture and restores redo")
	check(not editor.geometry.preview_only and not canvas.geometry.preview_only, "Cancelled gesture restores a full baked track")
	mouse_button(canvas, at, true); mouse_drag(canvas, at, at + Vector2(14, -8)); mouse_button(canvas, at + Vector2(14, -8), false)
	check(editor.undo_stack.size() == undo_count + 1 and not canvas.geometry.preview_only, "A committed drag records one undo action and one final bake")
	editor.undo(); editor.redo() # Reapply committed pointer edit to exercise both directions.
	check(not editor.geometry.preview_only, "Undo and redo never expose a preview to testing")
	# Restore the original test's +12m edit, leaving a predictable document for the roundtrip.
	editor.document = original.duplicate(true); editor.recompile(); editor.refresh_inspector()
	editor.perform(func(): editor.document.nodes[0].x += 12)
	var image = Image.create_empty(16, 16, false, Image.FORMAT_RGBA8); image.fill(Color(0.6, 0.6, 0.6, 1))
	var nodes_before = editor.document.nodes.duplicate(true)
	editor.perform(func(): editor.document.reference = {"png": Marshalls.raw_to_base64(image.save_png_to_buffer()), "width": 100.0, "x": 10.0, "y": 20.0, "opacity": 0.3}, true)
	canvas.measure_start = Vector2.ZERO; canvas.measure_end = Vector2(50, 0); editor.known_distance = 100
	editor.calibrate_reference()
	check(editor.document.reference.width == 200 and editor.document.reference.x == 20 and editor.document.reference.y == 40, "Two-point calibration scales the image about the measured anchor")
	check(editor.document.nodes == nodes_before, "Reference calibration does not move road geometry")
	editor.undo(); editor.undo() # Remove calibration and test image, preserving the point edit.
	canvas.measure_start = Vector2.INF; canvas.measure_end = Vector2.INF
	editor.inspector.current_tab = 4
	await capture("15-editor-checks")
	check(editor.inspector.get_tab_title(4) == "Checks" and not editor.test_button.disabled, "Designer has a validation workspace and enabled test handoff")
	editor.inspector.current_tab = 0
