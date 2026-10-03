extends "res://tests/support/compact_ui_fixture.gd"


func run() -> void:
	root.size = Vector2i(1100, 720)
	root.content_scale_size = root.size
	game = load("res://scenes/main.tscn").instantiate()
	root.add_child(game)
	app = root.get_node("App")
	await settle()
	if not await settings_draft_journey():
		return
	game.show_strategy_scenarios()
	await settle()
	var starts = collect(game.content, "Button").filter(
		func(item): return item.text.begins_with("Open ")
	)
	check(
		starts.size() == 4 and starts.all(func(item): return inside(item)),
		"All four scenario launch actions fit at 1100×720"
	)
	check(
		collect(game.content, "ScrollContainer").is_empty(),
		"Scenario navigation has no scrolling menu"
	)
	await capture("scenarios")
	game.show_weather_scenarios()
	await settle()
	starts = collect(game.content, "Button").filter(
		func(item): return item.text.begins_with("Open ")
	)
	check(
		starts.size() == 3 and starts.all(func(item): return inside(item)),
		"All merged weather scenario launch actions fit without scrolling"
	)
	check(
		collect(game.content, "ScrollContainer").is_empty(),
		"Weather scenario choices use the same visible card navigation"
	)
	model = StrategyRaceSim.new(
		TrackGeometry.new(app.library[7]),
		{"laps": 24, "scenario": "dry", "intensity": "calm", "seed": 7314}
	)
	model.phase = "race"
	model.paused = true
	for car in model.cars:
		car.distance = 300 + (12 - car.id) * 24
		car.previous_distance = car.distance
		car.speed = 40
	app.weekend = model
	game.show_weekend()
	view = game.content.get_child(0)
	view.set_process(false)
	root.get_node("App").session_runner.automatic = false
	await settle()
	view.canvas.fit()
	await settle()
	check(
		not view.right_panel.visible and inside(view.watch_button),
		"A weekend opens circuit-first with a visible Watch action"
	)
	check(
		not game.global_header.visible,
		"The race has one session header rather than a duplicated application banner"
	)
	check(
		view.canvas.size.x >= 650 and view.canvas.size.y >= 330,
		"Watch gives the circuit useful space at the minimum desktop size"
	)
	for group in view.group_buttons:
		check(
			inside(view.group_buttons[group]),
			"Primary task navigation fits without scrolling: " + group
		)
	await capture("watch")
	var before = JSON.stringify(model.snapshot())
	var identity = view.decision_controls[6].box.get_instance_id()
	for size in [Vector2i(1100, 720), Vector2i(1280, 720), Vector2i(1440, 900)]:
		root.size = size
		root.content_scale_size = size
		await settle()
		for index in [0, 6, 3, 8, 4, 1, 2, 5, 7]:
			view.open_topic(index)
			await settle()
			check(
				inside(view.decision_controls[3].box) and inside(view.decision_controls[6].box),
				"Both Box actions stay outside detail scrolling at %s / topic %d" % [size, index]
			)
			check(
				inside(view.pause_button) and inside(view.speed_control),
				"Time controls stay reachable at %s / topic %d" % [size, index]
			)
		view.open_strategy(3)
		view.strategy_desk.show_topic(1)
		view.strategy_desk.stop_count.value = 3
		await settle()
		view.tabs.get_tab_control(6).scroll_vertical = 10000
		await settle()
		check(
			inside(view.strategy_desk.apply_button) and inside(view.strategy_desk.clear_button),
			"Plan approval and clearing are fixed while a long draft scrolls at " + str(size)
		)
		view.open_topic(8)
		for i in range(3):
			view.team_panel.show_topic(i)
			view.tabs.get_tab_control(8).scroll_vertical = 10000
			await settle()
			var action = (
				view.team_panel.apply_button
				if i == 0
				else (
					view.team_panel.watch_buttons[3]
					if i == 1
					else view.team_panel.priority_buttons[3]
				)
			)
			check(inside(action), "Team commit stays pinned for topic %d at %s" % [i, size])
	check(
		before == JSON.stringify(model.snapshot()),
		"Every task and draft navigation is observational"
	)
	root.size = Vector2i(1100, 720)
	root.content_scale_size = root.size
	view.open_topic(0)
	view.show_drive(0)
	await settle()
	check(
		inside(view.pace) and inside(view.engine) and inside(view.battle_picker),
		"Ordinary driving modes need no scroll"
	)
	view.show_drive(1)
	await settle()
	check(
		inside(view.compound) and inside(view.repair), "Pit-service configuration needs no scroll"
	)
	view.open_strategy(3)
	view.strategy_desk.show_topic(1)
	view.strategy_desk.new_draft("balanced")
	await settle()
	view.tabs.get_tab_control(6).scroll_vertical = 0
	await settle()
	check(
		(
			inside(view.strategy_desk.stop_rows[0].first)
			and inside(view.strategy_desk.stop_rows[0].last)
		),
		"A normal one-stop window is editable without scrolling"
	)
	view.strategy_desk.objective.grab_focus()
	var focus = root.gui_get_focus_owner()
	var nodes = get_node_count()
	var styles = UI.style_assignments
	for i in range(100):
		view.refresh()
	check(
		(
			root.gui_get_focus_owner() == focus
			and identity == view.decision_controls[6].box.get_instance_id()
		),
		"Telemetry refresh preserves focus and target-bound controls"
	)
	check(
		nodes == get_node_count() and styles == UI.style_assignments,
		"Steady telemetry refresh adds no nodes or state styles"
	)
	await capture("plan")
	view.open_topic(8)
	view.team_panel.show_topic(0)
	await capture("team")
	var normal = view.decision_controls[3].compare
	var primary = view.decision_controls[3].box
	for candidate in [normal, primary]:
		for pair in [
			["normal", "font_color"],
			["hover", "font_hover_color"],
			["pressed", "font_pressed_color"],
			["hover", "font_focus_color"]
		]:
			check(
				(
					contrast(
						candidate.get_theme_stylebox(pair[0]).bg_color,
						candidate.get_theme_color(pair[1])
					)
					>= 4.5
				),
				"Readable enabled button state %s / %s" % [candidate.text, pair[0]]
			)
	var menu = view.layers_menu.get_popup()
	check(menu.item_count == 4, "Layers is a short four-option menu")
	check(
		(
			contrast(
				menu.get_theme_stylebox("hover").bg_color, menu.get_theme_color("font_hover_color")
			)
			>= 4.5
		),
		"Popup highlighted text has explicit readable contrast"
	)
	check(
		(
			contrast(
				game.theme.get_stylebox("panel", "TooltipPanel").bg_color,
				game.theme.get_color("font_color", "TooltipLabel")
			)
			>= 4.5
		),
		"Tooltips use a coherent background and text palette"
	)
	view.close_detail()
	await settle()
	menu.popup(
		Rect2i(
			Vector2i(view.layers_menu.get_global_rect().position + Vector2(0, 32)),
			Vector2i(235, 10)
		)
	)
	menu.set_focused_item(2)
	await capture("layers-hover")
	check(menu.size.y < 260, "Layers popup fits as a menu, not a scrollable panel")
	menu.id_pressed.emit(3)
	check(view.rejoin_overlay.enabled, "The Layers action controls the real rejoin overlay")
	menu.hide()
	view.decision_controls[3].box.grab_focus()
	var command_count = model.commands.size()
	await send_key(KEY_SPACE)
	check(
		(
			not model.paused
			and model.commands.size() == command_count + 1
			and model.commands.back().action == "pause"
			and not model.cars[3].pit_order
		),
		"Space with Box focused pauses/resumes instead of issuing a pit command"
	)
	model.paused = true
	view.refresh()
	view.open_strategy(3)
	view.strategy_desk.show_topic(1)
	view.strategy_desk.stop_rows[0].first.get_line_edit().grab_focus()
	await settle()
	await send_key(KEY_SPACE)
	check(model.paused, "Space in an editable field retains text-editing behavior")
	view.help_target = view.strategy_desk.stop_rows[0].first.get_line_edit()
	before = JSON.stringify(model.snapshot())
	await send_key(KEY_F1)
	var help_dialogs = view.get_children().filter(
		func(node): return node is AcceptDialog and node.visible
	)
	check(
		help_dialogs.size() == 1 and before == JSON.stringify(model.snapshot()),
		"F1 exposes persistent control help without applying a draft or changing time"
	)
	if not help_dialogs.is_empty():
		help_dialogs[0].confirmed.emit()
	view.close_detail()
	await settle(12)
	var hidden = view.detail_refresh_count
	for i in range(40):
		view.refresh()
	check(
		view.detail_refresh_count == hidden,
		"Hidden tyre and setup inspectors do no detail refresh work"
	)
	view.canvas.overlay.draw.connect(func(): draw_counts.cars += 1)
	view.battle_overlay.draw.connect(func(): draw_counts.battle += 1)
	view.rejoin_overlay.draw.connect(func(): draw_counts.rejoin += 1)
	await settle(5)
	for key in draw_counts:
		draw_counts[key] = 0
	before = JSON.stringify(model.snapshot())
	await settle(20)
	check(
		draw_counts.cars == 0 and draw_counts.battle == 0 and draw_counts.rejoin == 0,
		"Unchanged paused overlays reuse retained drawing commands"
	)
	check(
		before == JSON.stringify(model.snapshot()),
		"Retained rendering changes no race state or random stream"
	)
	var world = view.canvas.world_layer
	var builds = world.build_count
	var road_builds = world.road_batch_builds
	view.canvas.center += Vector2(25, 0)
	view.canvas.queue_redraw()
	await settle()
	check(
		draw_counts.cars > 0 and draw_counts.battle > 0,
		"Camera changes invalidate moving overlays even while paused"
	)
	check(
		world.build_count == builds and world.road_batch_builds == road_builds,
		"Panning regenerates neither scenery nor road batches"
	)
	check(
		(
			world.road_batches.size() == 2
			and world.road_batches[0].indices.size() == model.track.points.size() * 6
		),
		"Road batches retain two triangles per section and both original passes"
	)
	road_triangle_contract(world)
	view.canvas.show_surface = true
	view.canvas.queue_redraw()
	await settle(12)
	var surface_builds = view.canvas.surface_geometry_builds
	view.canvas.surface_channel = "grip"
	view.canvas.surface_layer.queue_redraw()
	await settle()
	check(
		view.canvas.surface_geometry_builds == surface_builds,
		"Changing surface channels reuses geometry, not surface values"
	)
	view.canvas.show_surface = false
	view.canvas.queue_redraw()
	model.phase = "qualifying"
	model.qual_closed = false
	model.clock = 0
	for car in model.cars:
		car.route = "garage"
		car.dnf = false
		car.finished = false
	view.refresh()
	await settle()
	check(
		(
			inside(view.decision_controls[3].send)
			and inside(view.decision_controls[6].send)
			and inside(view.decision_controls[6].recall)
		),
		"Both cars can be released and recalled without opening an inspector"
	)
	view.select_driver(0)
	view.decision_controls[6].send.pressed.emit()
	check(
		model.cars[6].route == "pit" and model.cars[3].route == "garage",
		"Fixed qualifying release keeps its driver even when a rival is inspected"
	)
	model.clock = model.qual_duration - 1
	view.refresh()
	check(
		view.decision_controls[3].send.disabled,
		"The fixed release action rejects an infeasible last attempt"
	)
	await capture("qualifying")
	finish()


func settings_draft_journey() -> bool:
	var preferences = app.settings.duplicate(true)
	game.show_settings()
	await settle()
	var settings = game.content.get_child(0)
	check(settings is SettingsView, "Settings use the production staged preference view")
	if not settings is SettingsView:
		finish()
		return false
	check(
		settings.scroll.horizontal_scroll_mode == ScrollContainer.SCROLL_MODE_DISABLED,
		"Long settings have one reading axis, never a scrolling action menu"
	)
	for action in [settings.save_button, settings.back_button]:
		check(
			inside(action) and not settings.scroll.is_ancestor_of(action),
			"Settings primary action stays outside reading scroll: " + action.text
		)
	settings.scroll.scroll_vertical = 10000
	await settle()
	for text in ["Copy data path", "Open data folder"]:
		check(
			inside(button(text)),
			"Secondary local-data action is reachable by vertical reading scroll: " + text
		)
	check(
		inside(settings.save_button) and inside(settings.back_button),
		"Settings Apply and Back stay visible after scrolling to local data"
	)
	settings.scroll.scroll_vertical = 0
	await settle()
	var racing_line = button("Show racing line by default")
	check(racing_line != null, "Retained Engineering settings expose the racing-line preference")
	if racing_line == null:
		finish()
		return false
	racing_line.button_pressed = not preferences.racing_line
	check(
		app.settings == preferences and settings.has_changes(),
		"Editing a settings draft does not silently apply it"
	)
	await capture("settings")
	settings.back_button.pressed.emit()
	await settle()
	var dialogs = settings.get_children().filter(
		func(node): return node is ConfirmationDialog and node.visible
	)
	check(
		dialogs.size() == 1 and game.screen_name == "settings",
		"Leaving a changed draft asks before discarding it"
	)
	if dialogs.size() != 1:
		finish()
		return false
	var confirmation = dialogs[0]
	check(
		confirmation.get_cancel_button().has_focus(),
		"Discarding settings is not the default focused action"
	)
	confirmation.confirmed.emit()
	await settle()
	check(
		game.screen_name == "main_menu" and app.settings == preferences,
		"Confirmed discard returns to the menu without applying the draft"
	)
	game.show_settings()
	await settle()
	check(
		button("Show racing line by default").button_pressed == preferences.racing_line,
		"Reopened settings use the saved value after explicit discard"
	)
	button("Show racing line by default").button_pressed = not preferences.racing_line
	button("Apply and save settings").pressed.emit()
	check(
		app.settings.racing_line != preferences.racing_line,
		"Settings change only through the explicit Apply action"
	)
	app.settings = preferences
	app.save_settings()
	return true


func road_triangle_contract(world: CircuitWorld) -> void:
	var matches = true
	for pass_index in range(2):
		var extra = 2.2 if pass_index == 0 else 0.0
		var batch = world.road_batches[pass_index]
		for i in range(model.track.points.size()):
			var j = (i + 1) % model.track.points.size()
			var a = model.track.points[i]
			var b = model.track.points[j]
			var ai = model.track.normals[i] * (model.track.widths[i] * 0.5 + extra)
			var bi = model.track.normals[j] * (model.track.widths[j] * 0.5 + extra)
			var reference = PackedVector2Array([a + ai, b + bi, b - bi, a + ai, b - bi, a - ai])
			for k in range(6):
				if batch.points[batch.indices[i * 6 + k]] != reference[k]:
					matches = false
	check(
		matches, "Every batched road triangle matches the original per-section vertices and winding"
	)
