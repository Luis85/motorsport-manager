extends "res://tests/ui_finish_observation_tests.gd"
## Native reading and footer contracts share the exact urgent-action fixture.


func reading_ui_tests() -> void:
	for viewport in [Vector2i(1440, 900), Vector2i(1100, 720)]:
		for scale in [1.0, 1.15, 1.3]:
			root.size = viewport
			root.content_scale_size = root.size
			app.settings.pitwall_text_scale = scale
			model = race_fixture()
			await reset()
			check(
				inside(view.race_read_button),
				"P08 reading is reachable on the native map toolbar at %s/%s" % [viewport, scale]
			)
			for control in view.map_controls.get_children():
				if control is Control and control.is_visible_in_tree():
					check(
						inside(control),
						(
							"P08 all map actions remain inside the viewport: %s/%s/%s"
							% [viewport, scale, control.name]
						)
					)
			var before = JSON.stringify(model.snapshot())
			await click(view.race_read_button)
			var dialog: AcceptDialog
			for child in view.get_children():
				if child is AcceptDialog and child.visible and child.title == "Read the race":
					dialog = child
			check(dialog != null, "P08 real pointer input opens the reading window")
			if dialog == null:
				continue
			check(
				before == JSON.stringify(model.snapshot()),
				"P08 reading does not pause, change speed, select a driver, issue commands or consume RNG"
			)
			check(
				Rect2i(Vector2i.ZERO, root.size).encloses(Rect2i(dialog.position, dialog.size)),
				"P08 reading window and dismissal fit at %s/%s" % [viewport, scale]
			)
			var content = dialog.find_children("*", "RichTextLabel", true, false)[0]
			check(
				content.text.contains("Daniel Mercer") and content.text.contains("Lucas Moreau"),
				"P08 both complete driver identities are retained in the reading"
			)
			var frozen = content.text
			model.cars[3].fuel = 1.0
			view.forecast_cache.clear()
			view.refresh()
			await settle()
			check_reading_footer(viewport, scale, "urgent fuel actions")
			check(
				content.text == frozen,
				"P08 live state changes do not overwrite the reading snapshot"
			)
			for attempt in range(6):
				if content.has_focus():
					break
				await key(KEY_TAB)
			check(content.has_focus(), "P08 native Tab reaches the selectable reading text")
			var scroll_before = content.get_v_scroll_bar().value
			await key(KEY_PAGEDOWN)
			check(
				content.get_v_scroll_bar().value > scroll_before,
				"P08 native Page Down reaches evidence beyond the first page"
			)
			await key(KEY_PAGEUP)
			var paused = model.paused
			await key(KEY_SPACE)
			check(
				model.paused == paused and dialog.visible,
				"P08 focused reading blocks gameplay pause hotkeys without dismissing the window"
			)
			await capture(
				"polish-reading-%dx%d-%d" % [viewport.x, viewport.y, roundi(scale * 100)],
				"Native pointer-opened reading snapshot; full identity and fixed reading time, synthetic race-entry fixture"
			)
			await key(KEY_ESCAPE)
			await settle()
			check(
				view.race_read_button.has_focus(),
				"P08 Escape returns focus to the exact reading invoker"
			)
			view.open_topic(6)
			await settle()
			check_reading_footer(viewport, scale, "strategy inspector")
			check(
				inside(view.race_read_button),
				"P08 reading remains reachable with the strategy inspector open"
			)
	root.size = Vector2i(1440, 900)
	root.content_scale_size = root.size
	app.settings.pitwall_text_scale = 1.0
	model = race_fixture()
	await reset()
	view.refresh()
	await capture(
		"polish-observation",
		"Native wide observation; accurate queue and contextual race reading, synthetic race-entry fixture"
	)
	var before = JSON.stringify(model.snapshot())
	view.open_destination(2, 1)
	await settle()
	check(
		before == JSON.stringify(model.snapshot()),
		"P08 Find's reading route has the same read-only contract"
	)
	await key(KEY_ESCAPE)
	model.paused = false
	view.set_process(true)
	root.get_node("App").session_runner.automatic = true
	view.race_read_button.grab_focus()
	await key(KEY_ENTER)
	var opened_at = model.total_time
	await settle(40)
	check(
		model.total_time > opened_at and not model.paused,
		"P08 the real production frame loop continues beneath the fixed reading window"
	)
	await key(KEY_ESCAPE)
	view.set_process(false)
	root.get_node("App").session_runner.automatic = false
	model.paused = true


func check_reading_footer(viewport: Vector2i, scale: float, state: String) -> void:
	for control in [view.radio_label, view.radio_label.get_parent()]:
		check(
			inside(control),
			(
				"P08 the whole help/footer remains visible at %s/%s (%s): %s"
				% [viewport, scale, state, control.get_global_rect()]
			)
		)
	check(
		view.radio_label.get_theme_font_size("font_size") == roundi(11 * scale),
		"P08 fitting the help/footer preserves the requested text size"
	)
	check(
		inside(view.canvas) and view.canvas.size.y >= 120,
		"P08 fitting the help/footer retains a usable circuit map"
	)
	for card in view.car_cards.values():
		check(inside(card.panel), "P08 both complete driver cards remain inside the viewport")
