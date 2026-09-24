extends SceneTree
## Native regression of the researched task architecture, not a static mockup.
var checks = 0
var failures: Array[String] = []
var screenshots = 0
var game
var app
var view
var model: WeatherRaceSim
func _initialize(): call_deferred("run")
func check(value: bool, text: String) -> void:
	checks += 1
	if not value: failures.append(text); push_error(text)
func settle(frames: int = 5) -> void:
	for i in range(frames): await process_frame
func inside(control: Control) -> bool:
	if not control.is_visible_in_tree() or not root.get_visible_rect().encloses(control.get_global_rect()): return false
	var parent = control.get_parent()
	while parent:
		if parent is Control and parent.clip_contents and not parent.get_global_rect().encloses(control.get_global_rect()): return false
		parent = parent.get_parent()
	return true
func capture(name: String) -> void:
	await settle(); await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://reports/ux-" + name + ".png"); screenshots += 1
func key(code: Key, ctrl: bool = false) -> void:
	var event = InputEventKey.new(); event.keycode = code; event.ctrl_pressed = ctrl; event.pressed = true
	Input.parse_input_event(event); await settle(2)
	event = InputEventKey.new(); event.keycode = code; event.ctrl_pressed = ctrl
	Input.parse_input_event(event); await settle(2)
func reset_view(scale_factor: float) -> void:
	app.settings.pitwall_text_scale = scale_factor
	game.show_weekend(); view = game.content.get_child(0); view.set_process(false)
	await settle(); view.canvas.fit(); await settle()
func has_horizontal_scroll(node: Node) -> bool:
	if node is HScrollBar and node.is_visible_in_tree(): return true
	for child in node.get_children(true):
		if has_horizontal_scroll(child): return true
	return false
func dialog_inside(dialog: Window) -> bool:
	return root.get_visible_rect().encloses(Rect2(Vector2(dialog.position), Vector2(dialog.size)))

func run() -> void:
	root.size = Vector2i(1100,720); root.content_scale_size = root.size
	game = load("res://scenes/main.tscn").instantiate(); root.add_child(game); app = root.get_node("App")
	await settle()
	var original_settings = app.settings.duplicate(true)
	for invalid in [0, 2.0, "1.3", -1, {}, null]:
		app.settings.pitwall_text_scale = 1.0; app.restore_settings({"pitwall_text_scale":invalid})
		check(app.settings.pitwall_text_scale == 1.0, "Unsupported text preference leaves the valid default: " + str(invalid))
	app.restore_settings({"pitwall_text_scale":1.3})
	check(app.settings.pitwall_text_scale == 1.3, "Supported text preference restores exactly")
	model = WeatherRaceSim.new(TrackGeometry.new(app.library[7]), {"laps":24,"scenario":"dry","intensity":"calm","seed":7314})
	model.phase = "race"; model.paused = true
	for car in model.cars:
		car.distance = 300 + (12-car.id)*24; car.previous_distance = car.distance; car.speed = 40
	app.weekend = model
	await reset_view(1.0)
	check(view.group_buttons.size() == 5 and inside(view.watch_button), "Six primary tasks including Watch replace the flat topic toolbar")
	check(not view.strategy_desk.has_user_edits(), "An automatically prepared draft is not falsely reported as user editing")
	var before = JSON.stringify(model.snapshot())
	for group in view.group_buttons:
		check(inside(view.group_buttons[group]), "Group always visible: " + group)
		view.group_buttons[group].pressed.emit(); await settle()
		for topic in view.GROUPS[group]:
			if not view.topic_buttons.has(topic): continue
			check(view.tabs.current_tab in view.GROUPS[group], "Group opens the correct context: " + group)
			if view.GROUPS[group].size() > 1:
				check(inside(view.topic_buttons[topic]), "Context destination is visible without scrolling: " + str(topic))
			view.open_topic(topic); await settle()
			check(inside(view.decision_controls[3].box) and inside(view.decision_controls[6].box), "Both driver actions survive topic " + str(topic))
	check(before == JSON.stringify(model.snapshot()), "All task navigation is observational")
	view.close_detail(); await capture("watch")
	view.open_strategy(3); view.refresh(); await settle()
	check(view.comparison.rows.size() == 3 and view.comparison.rows.all(func(row): return inside(row.panel)), "All three strategy alternatives can be compared together at 1100×720")
	check(view.comparison.rows[0].title.text == "Draft plan (unapplied)", "An unapproved baseline is named as a draft, not an active plan")
	check(view.comparison.rows[1].detail.text.contains("slower") or view.comparison.rows[1].detail.text.contains("faster"), "Relative estimate names its direction rather than an ambiguous signed delta")
	await capture("compare")
	view.strategy_desk.show_topic(1); await settle()
	check(inside(view.strategy_desk.stop_rows[0].first) and inside(view.strategy_desk.stop_rows[0].last), "Default one-stop editing needs no scroll")
	view.strategy_desk.new_draft("no_stop")
	check(view.strategy_desk.has_user_edits(), "Deliberate template change is retained as an unapplied edit")
	var draft = view.strategy_desk.drafts.duplicate(true)
	view.open_topic(9); view.open_strategy(3); view.strategy_desk.show_topic(1)
	check(view.strategy_desk.drafts == draft, "Moving between tasks preserves independent draft data")
	await capture("plan")
	view.confirm_leave(func(): failures.append("Canceled leave must not run continuation")); await settle()
	check(view.exit_dialog.visible and view.exit_dialog.get_cancel_button().has_focus(), "Leaving unapplied edits defaults to Stay and review")
	check(dialog_inside(view.exit_dialog) and before == JSON.stringify(model.snapshot()), "Draft warning fits and does not pause or change a plan")
	await capture("leave-warning")
	view.exit_dialog.canceled.emit(); await settle()
	view.find_button.grab_focus(); await key(KEY_TAB)
	check(root.gui_get_focus_owner() != view.watch_button and root.gui_get_focus_owner() not in view.group_buttons.values() and root.gui_get_focus_owner() != view.find_button, "Tab can leave the primary navigation group")
	view.find_button.grab_focus(); before = JSON.stringify(model.snapshot())
	await key(KEY_K, true); await settle()
	check(view.navigator.visible and view.navigator.search.has_focus(), "Ctrl+K opens the catalog with search focus")
	check(dialog_inside(view.navigator), "Navigation dialog is bounded to the viewport")
	view.navigator.search.text = "wheels"; view.navigator.filter_views("wheels")
	check(view.navigator.matches.size() == 1 and view.navigator.matches[0][0] == 3, "Plain-language wheel search resolves its correct view")
	await capture("find")
	view.navigator.open_selected(); await settle()
	check(not view.navigator.visible and view.tabs.current_tab == 3 and view.tyre_topic == 1, "Opening a result navigates to the actual Wheels subview")
	check(before == JSON.stringify(model.snapshot()), "Searching and opening a result creates no order, pause or RNG change")
	view.find_button.grab_focus(); view.show_navigator(); await settle()
	view.navigator.filter_views("no-such-view-92731")
	check(view.navigator.get_ok_button().disabled and view.navigator.matches.is_empty(), "An empty result cannot execute a stale destination")
	view.navigator.close_picker(); await settle()
	check(view.find_button.has_focus(), "Closing the picker restores its visible invoker")
	view.show_navigator(); await settle()
	view.navigator.search.text = "team"; view.navigator.filter_views("team")
	await key(KEY_DOWN); await key(KEY_ENTER); await settle()
	check(not view.navigator.visible and view.tabs.current_tab == 8 and view.team_panel.pages[1].visible, "Down and Enter select the actual Team / Battles view")
	check(before == JSON.stringify(model.snapshot()), "Keyboard navigation never executes a team instruction")
	view.feedback("MER · test rejection: replacement set unavailable")
	check(view.messages.back().contains("replacement set unavailable"), "Full rejection remains available after transient footer feedback")
	view.show_messages(); await settle()
	var dialogs = view.get_children().filter(func(node): return node is AcceptDialog and node.visible)
	check(dialogs.size() == 1 and dialog_inside(dialogs[0]), "Recoverable message history has bounded readable presentation")
	await capture("messages")
	if not dialogs.is_empty(): dialogs[0].confirmed.emit()
	await settle()
	var fitted = TyreInventory.find(model.cars[3], model.cars[3].set_id)
	var saved_wheels = fitted.wheels.duplicate(true); fitted.wheels.FL.life = 19
	view.refresh()
	check(view.car_cards[3].facts[0].text.contains("19% min"), "Card exposes the weakest wheel rather than hiding it behind the average")
	fitted.wheels = saved_wheels
	for scale_factor in PitwallDesign.TEXT_SCALES:
		await reset_view(scale_factor)
		for topic in [0,3,4,5,6,7,8,9]:
			view.open_topic(topic); await settle()
			check(inside(view.decision_controls[3].box) and inside(view.decision_controls[6].box), "Two-car actions fit at %s / topic %d" % [scale_factor,topic])
			check(inside(view.pause_button) and inside(view.find_button), "Time and navigation fit at %s / topic %d" % [scale_factor,topic])
		view.open_strategy(3); view.strategy_desk.show_topic(1); view.tabs.get_tab_control(6).scroll_vertical = 10000; await settle()
		check(inside(view.strategy_desk.apply_button) and inside(view.strategy_desk.clear_button), "Scaled approval remains outside scrolling content: " + str(scale_factor))
		var old_font = view.decision_controls[3].box.get_theme_font_size("font_size")
		PitwallDesign.scale_controls(view.decision_bar, scale_factor)
		check(old_font == view.decision_controls[3].box.get_theme_font_size("font_size"), "Repeated scaling does not compound sizes: " + str(scale_factor))
		view.close_detail(); await settle(); view.canvas.fit()
		check(not has_horizontal_scroll(view.tower), "Timing remains free of horizontal scroll at text scale " + str(scale_factor))
		await capture("text-" + str(roundi(scale_factor * 100)))
		view.show_navigator(); await settle()
		check(dialog_inside(view.navigator), "Find stays inside the viewport at text scale " + str(scale_factor))
		view.navigator.close_picker(); await settle()
	await reset_view(1.0)
	for dimensions in [Vector2i(1280,720),Vector2i(1440,900)]:
		root.size = dimensions; root.content_scale_size = dimensions; await settle(); view.canvas.fit()
		check(inside(view.decision_controls[3].box) and inside(view.decision_controls[6].box), "Actions fit larger desktop " + str(dimensions))
		await capture("desktop-" + str(dimensions.x))
	view.strategy_desk.new_draft("no_stop"); view.strategy_desk.apply()
	check(not view.strategy_desk.has_user_edits() and view.strategy_desk.apply_button.disabled, "Approved unchanged draft no longer offers another approval")
	var allowed = [false]; view.confirm_leave(func(): allowed[0] = true)
	check(allowed[0], "Leaving an approved plan requires no redundant draft warning")
	app.settings = original_settings
	Storage.write_json("res://reports/pitwall-ux.json", {"passed":failures.is_empty(),"checks":checks,"errors":failures,"screenshots":screenshots})
	print("PITWALL_UX ",JSON.stringify({"passed":failures.is_empty(),"checks":checks,"errors":failures,"screenshots":screenshots}))
	quit(0 if failures.is_empty() else 1)
