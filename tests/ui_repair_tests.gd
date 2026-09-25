extends SceneTree
## Regression fixtures for the failing PR, plus native composition and input.
var checks = 0
var failures: Array[String] = []
var screenshots = 0
var game
var app
var view
var model: PracticeRaceSim

func _initialize() -> void: call_deferred("run")
func check(value: bool, message: String) -> void:
	checks += 1
	if not value: failures.append(message); push_error(message)
func settle(frames: int = 5) -> void:
	for i in range(frames): await process_frame
func inside(control: Control) -> bool:
	if not control.is_visible_in_tree() or not root.get_visible_rect().encloses(control.get_global_rect()): return false
	var parent = control.get_parent()
	while parent:
		if parent is Control and parent.clip_contents and not parent.get_global_rect().encloses(control.get_global_rect()): return false
		parent = parent.get_parent()
	return true
func key(code: Key) -> void:
	for pressed in [true, false]:
		var event = InputEventKey.new(); event.keycode = code; event.pressed = pressed; Input.parse_input_event(event); await settle(2)
func click(control: Control) -> void:
	var point = control.get_global_rect().get_center()
	var move = InputEventMouseMotion.new(); move.position = point; Input.parse_input_event(move)
	for pressed in [true, false]:
		var event = InputEventMouseButton.new(); event.position = point; event.button_index = MOUSE_BUTTON_LEFT; event.pressed = pressed; Input.parse_input_event(event); await settle(2)
func capture(name: String) -> void:
	await settle(); await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://reports/ui-repair-" + name + ".png"); screenshots += 1
func luminance(color: Color) -> float:
	var c = color.srgb_to_linear(); return c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722
func contrast(a: Color, b: Color) -> float:
	return (maxf(luminance(a), luminance(b)) + 0.05) / (minf(luminance(a), luminance(b)) + 0.05)

func run() -> void:
	root.size = Vector2i(1440, 900); root.content_scale_size = root.size
	game = load("res://scenes/main.tscn").instantiate(); root.add_child(game); app = root.get_node("App")
	await settle()
	model = PracticeRaceSim.new(TrackGeometry.new(app.library[7]), {"laps":24, "scenario":"dry", "intensity":"calm", "seed":7314})
	model.phase = "race"; model.paused = true
	for car in model.cars:
		car.route = "track"; car.distance = 300 + (12 - car.id) * 24; car.previous_distance = car.distance; car.speed = 40
	app.weekend = model; app.settings.pitwall_text_scale = 1.0
	game.show_weekend(); view = game.content.get_child(0); view.set_process(false); await settle(10)
	var before = JSON.stringify(model.snapshot())
	check(view.weekend_menu == view.top_secondary_actions, "Composed header retains the original working utility menu")
	for id in [0, 1, 2, 3]: check(view.weekend_menu.get_popup().get_item_index(id) >= 0, "Utility action preserved: " + str(id))
	check(view.session_header.visible and view.session_strip == view.session_header and not view.decision_strip.visible, "Extracted session header is unique; duplicate heuristic decision strip remains hidden")
	check(view.driver_rail.is_visible_in_tree() and view.car_cards[3].panel.get_parent() == view.driver_rail, "Wide Race view uses the two-car rail")
	for id in [3, 6]:
		check(inside(view.decision_controls[id].box) and inside(view.car_cards[id].details_button), "Wide card and primary action are reachable: " + str(id))
		check(view.decision_controls[id].save.is_inside_tree() and view.decision_controls[id].cancel.is_inside_tree(), "Compatibility controls are owned, not leaked orphan Nodes")
		view.update_more_actions(id)
		check(view.decision_controls[id].more.get_popup().is_item_disabled(1), "Cancel is unavailable without an accepted pit order")
	var stable_node_count = get_node_count(); var stable_styles = UI.style_assignments; var moves = view.layout_changes
	for i in range(30): view.refresh()
	check(stable_node_count == get_node_count() and stable_styles == UI.style_assignments and moves == view.layout_changes, "Steady refresh creates no nodes/styles or repeated reparent operations")
	check(before == JSON.stringify(model.snapshot()), "Overview refresh does not alter authoritative state")
	await capture("race-wide")
	await click(view.weekend_menu)
	check(view.weekend_menu.get_popup().visible, "Native Weekend click opens its actual menu")
	await key(KEY_ESCAPE)
	check(view.weekend_menu.has_focus(), "Closing native menu restores focus")
	for selected in [false, true]:
		var button = UI.race_button("Contrast fixture", func(): pass, selected); view.add_child(button)
		for pair in [["normal", "font_color"], ["hover", "font_hover_color"], ["pressed", "font_pressed_color"], ["hover_pressed", "font_hover_pressed_color"], ["disabled", "font_disabled_color"]]:
			check(contrast(button.get_theme_color(pair[1]), button.get_theme_stylebox(pair[0]).bg_color) >= 4.5, "Readable race-button state %s / selected=%s" % [pair[0], selected])
		button.queue_free()
	await settle()
	view.open_strategy(3); await settle()
	check(not view.driver_rail.visible and view.decision_bar.visible, "Analysis restores both cards below the map instead of squeezing four columns")
	check(inside(view.decision_controls[3].box) and inside(view.decision_controls[6].box), "Both driver actions persist in analysis mode")
	view.open_topic(9); await settle()
	check(view.weather_panel.outlook_chart.mode == "cases" and view.weather_panel.outlook_chart.categories == ["Now", "Drier", "Trend", "Wetter"], "Independent weather scenarios are labeled categories, not a timeline")
	var chart_updates = view.weather_panel.outlook_chart.update_count
	for i in range(10): view.refresh()
	check(chart_updates == view.weather_panel.outlook_chart.update_count, "Unchanged weather observations do not rebuild the chart")
	await capture("weather")
	view.open_topic(1); await settle()
	view.telemetry_sectors.present([{"lap":1,"time":91.2}])
	check(view.telemetry_sectors.cells[0][1].text == "—" and view.telemetry_sectors.cells[0][2].text == "—", "Missing sectors are unavailable, not zero-second measurements")
	view.telemetry_sectors.present([])
	check(view.telemetry_sectors.empty.visible and not view.telemetry_sectors.rows[0].visible, "Switching to an empty lap history clears old rows")
	view.open_topic(view.results_page_index); await settle()
	check(view.results_panel.heading.text == "SESSION RESULTS" and not view.results_panel.classification.visible, "Live race cannot be represented as a final result")
	check(view.results_page_index in view.GROUPS.Review and view.results_page_index not in view.GROUPS.Conditions, "Results index cannot masquerade as optional Recovery")
	check(view.navigator.catalog.any(func(item): return item[0] == view.results_page_index), "Results is in the searchable catalog")
	var result_model = PracticeRaceSim.new(model.track, {"laps":24,"scenario":"dry","intensity":"calm","seed":19})
	result_model.phase = "qualifying_results"
	var result = SessionResultsPanel.presentation(result_model)
	check(result.rows.all(func(row): return row.text[5] == "NO TIME" and row.text[3] != "POLE"), "Untimed qualifying field does not invent a pole sitter")
	result_model.cars[3].qual_best = 91.2; result_model.cars[3].best_lap = 88
	result = SessionResultsPanel.presentation(result_model)
	check(result.rows[0].id == 3 and result.rows[0].text[2] == RaceSim.format_time(91.2), "Qualifying result uses the valid qualifying time, not race best")
	result_model.phase = "practice_results"
	result = SessionResultsPanel.presentation(result_model)
	check(result.rows.all(func(row): return row.text[0] == "—" and row.text[2] == "—"), "Practice has neither invented rank nor missing-sample lap time")
	result_model.phase = "results"
	for car in result_model.cars: car.dnf = true; car.completed = 0
	result_model.cars[0].dnf = false; result_model.cars[0].finished = true; result_model.cars[0].completed = 24; result_model.cars[0].finish_time = 500
	result_model.cars[3].dnf = false; result_model.cars[3].finished = true; result_model.cars[3].completed = 23; result_model.cars[3].finish_time = 490
	result_model.cars[6].completed = 22; result_model.cars[6].distance = 22 * result_model.track.length
	result = SessionResultsPanel.presentation(result_model)
	check(result.rows[1].id == 3 and result.rows[1].text[2] == "+1 L", "Lapped finisher keeps lap deficit rather than a fabricated zero time gap")
	check(result.rows[2].id == 6 and result.rows[2].text[2] == "DNF", "Retired result retains its actual completed distance")
	view.results_panel.model = result_model; view.results_panel.refresh(); await settle()
	var row_instance = view.results_panel.rows[0]; row_instance.select(0)
	var builds = view.results_panel.rebuild_count
	for i in range(20): view.results_panel.refresh()
	check(builds == view.results_panel.rebuild_count and row_instance == view.results_panel.rows[0] and row_instance.is_selected(0), "Result refresh preserves TreeItems and user selection")
	await capture("results")
	view.results_panel.model = model
	check(before == JSON.stringify(model.snapshot()), "All evidence comparisons leave live race and random state unchanged")
	for pair in [[Vector2i(1280,800),1.15],[Vector2i(1100,720),1.3]]:
		root.size = pair[0]; root.content_scale_size = root.size; app.settings.pitwall_text_scale = pair[1]
		game.show_weekend(); view = game.content.get_child(0); view.set_process(false); await settle(10)
		for topic in [0,3,4,5,6,7,8,9,view.recovery_page_index,view.practice_page_index,view.results_page_index]:
			view.open_topic(topic); await settle(3)
			check(inside(view.pause_button) and inside(view.find_button), "Scaled header/finder remain reachable at " + str(pair) + " / " + str(topic))
			check(inside(view.decision_controls[3].box) and inside(view.decision_controls[6].box), "Both primary actions survive scaled topic " + str(topic))
		view.open_strategy(3); view.strategy_desk.show_topic(1); await settle()
		check(inside(view.strategy_desk.apply_button) and inside(view.strategy_desk.clear_button), "Scaled plan commits remain outside scrolling content")
		await capture("compact-" + str(root.size.x))
	var report = {"passed":failures.is_empty(),"checks":checks,"errors":failures,"screenshots":screenshots,"engine":Engine.get_version_info().string}
	Storage.write_json("res://reports/ui-repair.json",report); print("UI_REPAIR ",JSON.stringify(report)); quit(0 if failures.is_empty() else 1)
