extends SceneTree
## Actual native weather controls at both supported desktop sizes, not a browser mockup.
var checks = 0
var failures: Array[String] = []
var screenshots = 0
var game
var view
var model: WeatherRaceSim
func _initialize() -> void: call_deferred("run")
func check(value: bool, message: String) -> void:
	checks += 1
	if not value: failures.append(message); push_error(message)
func settle() -> void:
	for i in range(10): await process_frame
func capture(name: String) -> void:
	await settle(); await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://reports/weather-" + name + ".png"); screenshots += 1
func inside(control: Control) -> bool:
	if not control.is_visible_in_tree() or not control.get_viewport_rect().encloses(control.get_global_rect()): return false
	var parent = control.get_parent()
	while parent != null:
		if parent is Control and parent.clip_contents and not parent.get_global_rect().encloses(control.get_global_rect()): return false
		parent = parent.get_parent()
	return true
func run() -> void:
	root.size = Vector2i(1440, 900); root.content_scale_size = root.size
	game = load("res://scenes/main.tscn").instantiate(); root.add_child(game)
	var app = root.get_node("App")
	game.show_weather_scenarios(); await capture("scenarios")
	check(game.screen_name == "weather_scenarios", "Three weather scenarios are reachable in native navigation")
	model = WeatherScenarios.build(WeatherScenarios.catalog()[1], app.library)
	app.weekend = model; game.show_weekend(); view = game.content.get_child(0); view.set_process(false)
	check(view.get_script().resource_path.ends_with("pitwall_workspace.gd") and not view.right_panel.visible and inside(view.group_buttons["Conditions"]) and inside(view.weather_links[3]), "Weather-aware application opens on the circuit with direct Weather navigation")
	view.open_weather(3); view.close_detail(); view.weather_links[3].pressed.emit(); await capture("briefing")
	check(view.right_panel.visible and view.tabs.current_tab == 9, "Weather action reopens the same previously closed topic")
	var link = view.weather_links[3]
	check(link.get_theme_stylebox("normal").bg_color == UI.CARD and link.get_theme_stylebox("hover").bg_color == UI.HOVER, "Pre-tree weather actions use the shared readable palette, not engine fallback styles")
	var panel = view.weather_panel
	check(panel.box.disabled and panel.hold.disabled, "Briefing comparison cannot issue a premature weather stop")
	check("Seeded weather" in panel.summary.text and "baseline" in panel.outlook_label.text, "Native UI labels the mode and initial evidence limit")
	model.command("prepare_race"); model.command("formation")
	for c in model.cars: c.formation_done = true
	model.step(); model.command("lights")
	for i in range(125): model.step()
	model.command("speed", {"value":8}); model.command("delegation", {"id":3,"channel":"pit","owner":"player"})
	view.open_weather(3); await settle()
	var before = JSON.stringify(model.snapshot())
	for i in range(30): view.refresh()
	check(before == JSON.stringify(model.snapshot()), "Thirty native weather refreshes are observational including both random streams")
	panel.box.grab_focus(); await settle(); var focused = root.gui_get_focus_owner()
	var instance = panel.box.get_instance_id()
	for i in range(30): view.refresh()
	check(root.gui_get_focus_owner() == focused and panel.box.get_instance_id() == instance, "Weather refresh retains stable buttons and keyboard focus")
	check("Not probabilities" in panel.cases_label.text and "unknown" in panel.outlook_label.text, "Stress cases and unknown rain duration are labeled rather than implied certainty")
	check("simulated" in panel.options[1].text and "at 8×" in panel.options[1].text, "Pit decision deadline includes simulated and selected-speed real-time units")
	panel.hold.pressed.emit()
	check(not model.cars[3].pit_order and model.policy(3).owners.pit == "player" and panel.hold.text == "Plan retained", "Native Keep plan visibly acknowledges without changing ownership")
	check(not model.paused and model.speed == 8, "Weather acknowledgement does not seize time controls")
	view.select_driver(0)
	check(panel.driver_id == 3, "Inspecting a rival cannot redirect the weather panel's driver")
	before = JSON.stringify(model.snapshot())
	model.rain = 0.2; model.weather_state.model.rain = 0.2
	before = JSON.stringify(model.snapshot())
	panel.submit_box()
	check(before == JSON.stringify(model.snapshot()) and "changed" in model.last_error, "Actual stale weather button activation rejects with an explanation and no order")
	view.open_weather(6); view.select_driver(0); panel.box.pressed.emit()
	check(model.cars[6].pit_order and not model.cars[3].pit_order, "Native weather Box names MOR even while another car is selected")
	check(model.policy(6).owners.pit == "player" and model.policy(6).owners.engine == "engineer", "Native weather Box changes only pit ownership")
	check(panel.box.disabled and panel.hold.disabled, "An executing pit order cannot be replaced through weather controls")
	view.open_weather(3)
	for column in model.surface:
		for lane in column.lanes: lane.water = 0.03
	RaceSurface.profiles(model.surface, model.water, model.rubber)
	view.refresh(); await capture("live")
	check("Weather !" == view.weather_links[3].text and "Weather !" == view.weather_links[6].text, "Both cars independently expose the drying-line warning")
	for size in [Vector2i(1440,900), Vector2i(1100,720)]:
		root.size = size; root.content_scale_size = size; await settle(); view.refresh(); await settle()
		for id in [3,6]:
			check(inside(view.weather_links[id]) and inside(view.decision_controls[id].box), "Weather and existing pit actions remain reachable for %d at %dx%d" % [id,size.x,size.y])
		check(inside(panel.box) and inside(panel.hold), "Weather commit and keep actions are not clipped at %dx%d" % [size.x,size.y])
		check(inside(view.pause_button) and inside(view.speed_control), "Time controls remain reachable at %dx%d" % [size.x,size.y])
		check(view.canvas.size.x >= 300 and view.canvas.size.y >= 170, "Race map remains usable at %dx%d" % [size.x,size.y])
	await capture("compact")
	view.guide.open_guide(); view.guide.show_step(6); await capture("guide")
	check("Rain is not the road" == view.guide.title_label.text and view.tabs.current_tab == 9, "Resumable contextual guide teaches actual weather controls")
	check(not model.paused and model.speed == 8, "Weather onboarding never pauses or slows the simulation")
	view.guide.dismiss()
	check(app.save_weekend().is_empty(), "Application saves version-seven weather weekend")
	check(app.load_weekend().is_empty() and app.weekend is WeatherRaceSim and app.weekend.cars[6].pit_order, "Application restores weather identity, ownership and physical pending orders")
	view.tabs.current_tab = 7; view.refresh(); await capture("debrief")
	check("Weather decision evidence" in view.debrief_text.text and "not a measured alternative" in view.debrief_text.text, "Native debrief separates observed conditions from estimated alternate gains")
	var report = {"passed":failures.is_empty(),"checks":checks,"failures":failures,"screenshots":screenshots}
	Storage.write_json("res://reports/weather-ui.json", report); print("WEATHER_UI ", JSON.stringify(report)); quit(0 if failures.is_empty() else 1)
