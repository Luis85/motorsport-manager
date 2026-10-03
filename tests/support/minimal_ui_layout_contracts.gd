extends "res://tests/ui_finish_observation_tests.gd"

## Native minimal-screen acceptance. Synthetic race fixtures are only for layout;
## the separate weekend journey uses real commands and fixed steps throughout.


func reset() -> void:
	app.weekend = model
	game.show_weekend()
	view = game.content.get_child(0)
	view.set_process(false)
	root.get_node("App").session_runner.automatic = false
	await settle(8)


func text_fits(control: Control) -> bool:
	var points = control.get_theme_font_size("font_size")
	var needed = (
		control
		. get_theme_font("font")
		. get_string_size(control.text, HORIZONTAL_ALIGNMENT_LEFT, -1, points)
		. x
	)
	return (
		needed
		<= (
			control.size.x
			- (
				control.get_theme_stylebox("normal").get_minimum_size().x
				if control is Button
				else 0
			)
			+ 1
		)
	)


func profiles() -> void:
	for scale in [1.0, 1.15, 1.3]:
		for viewport in [Vector2i(1440, 900), Vector2i(1100, 720)]:
			root.size = viewport
			root.content_scale_size = viewport
			app.settings.pitwall_text_scale = scale
			model = race_fixture()
			await reset()
			var tag = "%dx%d-%d" % [viewport.x, viewport.y, roundi(scale * 100)]
			check(
				view.get_script().get_global_name() == "MinimalRaceWorkspace",
				"Independent minimal root: " + tag
			)
			check(
				view.canvas.size.x >= 300 and view.canvas.size.y >= 300 and inside(view.canvas),
				"Race viewport usable: " + tag
			)
			check(
				inside(view.timing_panel) and inside(view.pitwall) and inside(view.toolbar),
				"Four regions contained: " + tag
			)
			for node in [
				view.play_button,
				view.pause_button,
				view.speed_control,
				view.strategy_button,
				view.send_button,
				view.box_button,
				view.push_button,
				view.calm_button,
				view.engine_control,
				view.name_label
			]:
				check(
					inside(node) and text_fits(node),
					"Visible complete label: " + node.text + " / " + tag
				)
			check(
				view.driver_buttons.size() == 2 and view.tower.columns == 4,
				"Only two drivers and four timing columns: " + tag
			)
			var columns = 0.0
			for i in range(4):
				columns += view.tower.get_column_width(i)
			check(columns <= view.tower.size.x, "Timing columns fit: " + tag)
			var last = view.rank_rows.back()
			check(
				view.tower.get_item_area_rect(last).end.y <= view.tower.size.y,
				"Full field visible: " + tag
			)
			check(
				inside(view.driver_row) and view.driver_cards.size() == 2,
				"Both read-only driver cards stay inside the window: " + tag
			)
			for card in view.driver_cards.values():
				check(
					inside(card) and inside(card.name_label) and text_fits(card.name_label),
					"Named driver card fits: " + tag
				)
				for metric in card.metrics.values():
					check(
						(
							inside(metric.title)
							and text_fits(metric.title)
							and inside(metric.value)
							and text_fits(metric.value)
							and inside(metric.note)
							and text_fits(metric.note)
						),
						"Full card value and unit/note fit: " + tag + "/" + metric.value.text
					)
			var first_row = view.rank_rows.back()
			var position_width = (
				view
				. tower
				. get_theme_font("font")
				. get_string_size(
					first_row.get_text(0),
					HORIZONTAL_ALIGNMENT_LEFT,
					-1,
					view.tower.get_theme_font_size("font_size")
				)
				. x
			)
			check(
				position_width + 12 * scale <= view.tower.get_column_width(0),
				"Two-digit position has text and cell padding: " + tag
			)
			var before = JSON.stringify(model.snapshot())
			var updates = view.table_updates
			for i in range(20):
				view.refresh()
			check(before == JSON.stringify(model.snapshot()), "Refreshing is observational: " + tag)
			check(updates == view.table_updates, "Stable timing rows reused: " + tag)
			await capture(
				"minimal-" + tag,
				"Synthetic race-entry state for layout only; real native production screen"
			)


func interactions() -> void:
	root.size = Vector2i(1440, 900)
	root.content_scale_size = root.size
	app.settings.pitwall_text_scale = 1.0
	model = race_fixture()
	await reset()
	await click(view.driver_buttons[6])
	check(
		view.selected_id == 6 and model.selected_id == 6, "Native driver tab selects named teammate"
	)
	var other = model.cars[3].pace
	await click(view.push_button)
	check(
		model.cars[6].pace == 2 and model.cars[3].pace == other, "Push targets only selected driver"
	)
	await click(view.push_button)
	check(model.cars[6].pace == 1, "Pressing active Push restores Normal")
	await click(view.calm_button)
	check(model.cars[6].pace == 0 and view.calm_button.button_pressed, "Calm state is explicit")
	var before = JSON.stringify(model.snapshot())
	view.select_driver(0)
	check(
		before == JSON.stringify(model.snapshot()) and view.selected_id == 6,
		"Rival selection cannot retarget command"
	)
	await click(view.play_button)
	check(not model.paused, "Play explicitly resumes")
	await click(view.pause_button)
	check(model.paused, "Pause explicitly pauses")
	var time = model.total_time
	await key(KEY_4)
	check(
		model.speed == 8 and model.paused and model.total_time == time,
		"Speed does not resume or advance a paused race"
	)
	await key(KEY_SPACE)
	check(not model.paused, "Space resumes")
	await key(KEY_SPACE)
	check(model.paused, "Space pauses")
	view.engine_control.grab_focus()
	await key(KEY_ENTER)
	var popup = view.engine_control.get_popup()
	check(popup.visible, "Engine selector opens via native input")
	for code in [KEY_DOWN, KEY_ENTER]:
		if code == KEY_ENTER:
			for i in range(5):
				view.refresh()
				await settle()
			check(
				popup.get_focused_item() == 2,
				"Telemetry refresh preserves open engine-menu keyboard choice"
			)
		for down in [true, false]:
			var event = InputEventKey.new()
			event.keycode = code
			event.pressed = down
			event.window_id = popup.get_window_id()
			Input.parse_input_event(event)
			await settle(2)
	check(
		model.cars[6].engine == 2 and model.paused,
		"Engine menu changes named driver without playback side effects"
	)
	await click(view.box_button)
	check(
		model.cars[6].pit_order and not model.cars[3].pit_order,
		"Box sends exactly one named physical pit order"
	)
	check(
		view.box_button.disabled and "requested" in view.box_button.tooltip_text,
		"Duplicate stop unavailable with reason"
	)
	await capture(
		"minimal-accepted-box", "Native pit acceptance on disclosed synthetic race fixture"
	)


func phase_layouts() -> void:
	root.size = Vector2i(1100, 720)
	root.content_scale_size = root.size
	app.settings.pitwall_text_scale = 1.3
	for phase in [
		"briefing",
		"practice",
		"practice_results",
		"qualifying",
		"qualifying_results",
		"formation",
		"grid_ready",
		"lights",
		"results"
	]:
		model = race_fixture()
		model.phase = phase
		# Deliberately synthetic visual-state fixture only; the journey suite
		# independently proves real transitions and physical classifications.
		await reset()
		if phase in ["practice", "qualifying"]:
			view.receipts[3] = "MER · returning; unfinished timed lap abandoned."
			view.refresh()
			await settle(6)
		check(
			inside(view.primary_button) and text_fits(view.primary_button),
			"Stage action fits compact enlarged text: " + phase
		)
		check(inside(view.driver_row), "Driver cards fit every compact phase: " + phase)
		check(
			inside(view.canvas) and inside(view.pitwall),
			"Phase copy cannot push panels offscreen: " + phase
		)
		check(
			inside(view.engine_control) and inside(view.send_button),
			"Core actions never require scrolling: " + phase
		)
		check(
			view.strategy_button.disabled,
			"Read-only strategy comparison is unavailable outside a live race: " + phase
		)
		await capture(
			"minimal-phase-" + phase,
			"Synthetic phase-only compact/enlarged-text layout probe; not lifecycle evidence"
		)
