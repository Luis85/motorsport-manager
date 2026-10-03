extends "res://tests/support/ui_editor_smoke_contracts.gd"


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
	check(
		is_equal_approx(game.editor.document.nodes[0].x, original_x + 12),
		"Editor redo reapplies node"
	)
	await test_editor_transactions(game.editor)
	await test_illustrated_editor(game.editor)
	game.editor.test_requested.emit(game.editor.document.duplicate(true))
	await settle()
	check(
		game.screen_name == "grand_prix_setup" and not game.editor_draft.is_empty(),
		"Test weekend preserves unsaved editor draft"
	)
	game.show_editor()
	await settle()
	check(
		game.editor.dirty and is_equal_approx(game.editor.document.nodes[0].x, original_x + 12),
		"Return to editor restores unsaved changes"
	)
	game.editor.document.name = "UI test circuit"
	game.editor.name_field.text = "UI test circuit"
	game.editor.save_document()
	check(
		not game.editor.dirty and not game.editor.document.builtin,
		"Editor saves an independent custom track"
	)
	check(root.get_node("App").library.size() == 9, "Custom circuit enters the shared library")
	game.show_settings()
	await capture("04-settings")
	game.show_library()
	await capture("05-grand-prix-setup")
	var app = root.get_node("App")
	app.restore_settings(JSON.parse_string('{"speed":8,"labels":false}'))
	check(
		app.settings.speed == 8 and not app.settings.labels,
		"Saved JSON speed restores correctly despite numeric float decoding"
	)
	app.restore_settings({"speed": 1.5})
	check(app.settings.speed == 8, "Invalid fractional default speed is ignored")
	app.restore_settings({"speed": 1, "labels": true})
	app.weekend = RaceSim.new(
		TrackGeometry.new(app.library[7]),
		{"laps": 3, "scenario": "changeable", "intensity": "calm"}
	)
	game.show_weekend()
	await capture("06-weekend-briefing")
	var view = game.content.get_child(0)
	view.primary_action()
	for i in range(1800):
		app.weekend.step()
	app.weekend.paused = true
	await capture("07-qualifying")
	check(app.weekend.phase == "qualifying", "Qualifying is visible")
	app.weekend.paused = false
	for i in range(30000):
		app.weekend.step()
		if app.weekend.phase == "qualifying_results":
			break
	check(app.weekend.phase == "qualifying_results", "Qualifying reaches results")
	view.refresh()
	await capture("08-qualifying-results")
	view.tabs.current_tab = 1
	await capture("12-qualifying-splits")
	check(
		"S1" in view.telemetry_label.text or "SECTOR" in view.telemetry_label.text,
		"Telemetry exposes measured sector information"
	)
	view.tabs.current_tab = 0
	view.primary_action()
	view.primary_action()
	for i in range(15000):
		app.weekend.step()
		if app.weekend.phase == "grid_ready":
			break
	check(app.weekend.phase == "grid_ready", "Formation returns to grid")
	view.primary_action()
	for i in range(950):
		app.weekend.step()
	app.weekend.paused = true
	view.refresh()
	await capture("09-race")
	check(app.weekend.phase == "race", "Race is visible")
	await test_tyre_wall(view, app)
	var tree_ids = view.rank_rows.map(func(item): return item.get_instance_id())
	view.select_driver(6)
	for i in range(30):
		view.refresh()
	check(
		tree_ids == view.rank_rows.map(func(item): return item.get_instance_id()),
		"Thirty telemetry refreshes retain the same timing TreeItems"
	)
	check(app.weekend.selected_id == 6, "Timing refresh preserves the chosen driver")
	view.select_driver(3)
	view.set_follow(true)
	view.canvas.navigated.emit()
	check(
		not view.follow and not view.follow_control.button_pressed,
		"Manual navigation releases the follow camera and its toggle"
	)
	var paused_clock = app.weekend.clock
	view.tabs.current_tab = 1
	view.canvas.show_surface = true
	await capture("13-live-telemetry")
	check(is_visible_inside(view.box_button), "Pit action stays visible while telemetry is open")
	check(
		app.weekend.clock == paused_clock, "Opening telemetry does not advance a paused simulation"
	)
	view.tabs.current_tab = 2
	await capture("14-race-control")
	check(is_visible_inside(view.box_button), "Pit action stays visible while radio is open")
	view.dispatch("speed", {"value": 8})
	check(view.speed_control.selected == 3, "Simulation speed and selector stay synchronized")
	view.dispatch("speed", {"value": 1})
	view.tabs.current_tab = 0
	view.dispatch("pace", {"value": 2})
	check(
		not app.weekend.cars[3].auto and not view.automate.button_pressed,
		"Manual pace change updates delegation immediately"
	)
	check(
		not view.get_children().any(func(node): return node is AcceptDialog and node.visible),
		"Routine commands do not open blocking dialogs"
	)
	view.dispatch("compound", {"value": "S"})
	view.dispatch("pit")
	app.weekend.paused = false
	for i in range(50000):
		app.weekend.step()
		if app.weekend.phase == "results":
			break
	view.refresh()
	await capture("10-race-results")
	check(app.weekend.phase == "results", "Race completes")
	# Native actual window-size change; controls must stay within the root viewport.
	root.size = Vector2i(1100, 720)
	await capture("11-small-window")
	check(view.canvas.size.x > 220, "Small-window canvas remains usable")
	check(is_visible_inside(view.box_button), "Pit action remains inside the small-window viewport")
	check(tower_positions(view), "Timing tower exposes positions for all twelve cars")
	check(
		view.tower.get_column_width(0) >= 26, "Timing positions reserve space for two-digit ranks"
	)
	check(
		view.tower.get_column_width(1) >= 42,
		"Timing identities reserve space for complete three-letter codes"
	)
	check(app.save_weekend().is_empty(), "Weekend UI checkpoint saves")
	app.weekend = null
	check(
		app.load_weekend().is_empty() and app.weekend.phase == "results",
		"Completed weekend resumes from disk"
	)
	await load("res://tests/iteration4_ui.gd").new().run(self)
	var report = {
		"passed": errors.is_empty(), "checks": checks, "errors": errors, "screenshots": screenshots
	}
	Storage.write_json("res://reports/ui-smoke.json", report)
	print("UI_SMOKE ", JSON.stringify(report))
	quit(0 if errors.is_empty() else 1)


func test_tyre_wall(view, app) -> void:
	var c = app.weekend.cars[3]
	view.tabs.current_tab = 3
	view.refresh()
	check(view.tyre_buttons.size() == 12, "Tyre tab exposes all twelve sets")
	await settle()
	check(
		is_visible_inside(view.tyre_buttons[0]),
		"Tyre selection is visible before explanatory prose"
	)
	var ids = view.tyre_buttons.map(func(b): return b.get_instance_id())
	for i in range(20):
		view.refresh()
	check(
		ids == view.tyre_buttons.map(func(b): return b.get_instance_id()),
		"Live tyre conditions reuse existing buttons"
	)
	view.dispatch("select_set", {"set_id": "3-H1"})
	check(
		c.next_set_id == "3-H1" and c.set_id != "3-H1",
		"Tyre selection plans without silently mounting"
	)
	await capture("18-tyre-allocation")
	check(is_visible_inside(view.box_button), "Pit call stays visible with allocation open")
	var stable_clock = app.weekend.clock
	var builds = view.canvas.world_layer.build_count
	await settle()
	var draws = view.canvas.world_layer.draw_count
	var samples: Array = []
	var center = view.canvas.center
	for i in range(45):
		var start = Time.get_ticks_usec()
		view.canvas.center += Vector2(0.2, 0.1)
		view.canvas.queue_redraw()
		await process_frame
		samples.append((Time.get_ticks_usec() - start) / 1000.0)
	samples.sort()
	Storage.write_json(
		"res://reports/render-performance.json",
		{
			"backend": RenderingServer.get_video_adapter_name(),
			"mode": "paused race; 45 camera frames",
			"median_ms": samples[22],
			"p95_ms": samples[42],
			"static_rebuilds": view.canvas.world_layer.build_count - builds,
			"static_draw_reissues": view.canvas.world_layer.draw_count - draws
		}
	)
	check(
		(
			view.canvas.world_layer.build_count == builds
			and view.canvas.world_layer.draw_count == draws
		),
		"Camera transforms reuse cached world drawing"
	)
	check(app.weekend.clock == stable_clock, "Camera and graphics never advance a paused race")
	view.canvas.center = center
	view.canvas.queue_redraw()
	view.tabs.current_tab = 0
	view.refresh()
	view.canvas.center = app.weekend.car_position(c).p
	view.canvas.zoom = 1.25
	view.canvas.queue_redraw()
	await capture("19-trackside-detail")
	view.canvas.fit()
