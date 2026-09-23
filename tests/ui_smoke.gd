extends SceneTree
var game
var errors: Array[String] = []
var checks = 0
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
	check(tower_positions(view), "Timing tower exposes positions for all twelve cars")
	check(app.save_weekend().is_empty(), "Weekend UI checkpoint saves")
	app.weekend = null
	check(app.load_weekend().is_empty() and app.weekend.phase == "results", "Completed weekend resumes from disk")
	var report = {"passed": errors.is_empty(), "checks": checks, "errors": errors, "screenshots": 11}
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
