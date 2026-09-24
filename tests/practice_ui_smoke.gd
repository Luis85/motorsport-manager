extends SceneTree
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
func settle() -> void:
	for i in range(6): await process_frame
func inside(control: Control) -> bool:
	if not control.is_visible_in_tree() or not root.get_visible_rect().encloses(control.get_global_rect()): return false
	var parent = control.get_parent()
	while parent != null:
		if parent is Control and parent.clip_contents and not parent.get_global_rect().encloses(control.get_global_rect()): return false
		parent = parent.get_parent()
	return true
func capture(name: String) -> void:
	await settle(); await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://reports/practice-" + name + ".png"); screenshots += 1
func run() -> void:
	root.size = Vector2i(1440,900); root.content_scale_size = root.size
	game = load("res://scenes/main.tscn").instantiate(); root.add_child(game); app = root.get_node("App")
	await settle(); game.show_practice_scenarios(); await capture("scenarios")
	check(game.screen_name == "practice_scenarios", "Practice scenarios are reachable from native menu")
	model = PracticeScenarios.build(PracticeScenarios.catalog()[0], app.library)
	app.weekend = model; game.show_weekend(); view = game.content.get_child(0); view.set_process(false); await settle()
	check(view.get_script().resource_path.ends_with("practice_weekend.gd") and inside(view.practice_button), "New normal practice workspace retains merged shell and visible opt-in")
	var before = JSON.stringify(model.snapshot())
	view.practice_button.pressed.emit(); await settle()
	check(before == JSON.stringify(model.snapshot()) and view.group_for(view.practice_page_index) == "Strategy", "Opening optional practice is observational within Strategy navigation")
	var panel = view.practice_panel
	panel.lap_count.value = 3; panel.baseline.select(2); panel.baseline.item_selected.emit(2)
	view.open_practice(6); panel.lap_count.value = 1; view.open_practice(3)
	check(panel.lap_count.value == 3 and panel.baseline.selected == 2 and before == JSON.stringify(model.snapshot()), "Unapplied run drafts are independent per driver and survive switching")
	check("low" in panel.baseline.get_item_text(2).to_lower() and "wing 2" in panel.setup_summary.text, "Actual intended setup is shown before committing a run")
	panel.start.pressed.emit(); await settle()
	check(model.phase == "practice" and not model.paused, "Native Start practice enters the explicit live phase")
	model.command("speed",{"value":8}); view.refresh()
	before = JSON.stringify(model.snapshot())
	for i in range(20): view.refresh()
	check(before == JSON.stringify(model.snapshot()), "Twenty native refreshes preserve full authoritative state")
	panel.run.grab_focus(); await settle(); var focused = root.gui_get_focus_owner(); var identity = panel.run.get_instance_id()
	view.refresh(); check(root.gui_get_focus_owner() == focused and panel.run.get_instance_id() == identity, "Practice refresh preserves stable keyboard focus and button identity")
	var stale = panel.preview.duplicate(true); model.cars[3].car_setup.wing = 3; model.cars[3].setup = 3
	before = JSON.stringify(model.snapshot()); panel.submit_run()
	check(before == JSON.stringify(model.snapshot()) and "changed" in model.last_error, "Native stale run activation is rejected without applying another setup")
	view.open_practice(3); view.select_driver(0); panel.run.pressed.emit(); await settle()
	check(model.cars[3].route == "pit" and model.cars[6].route == "garage" and model.cars[3].car_setup.wing == 2, "Native Run explicitly targets MER and applies only its displayed run setup")
	check(not model.paused and model.speed == 8 and model.policy(3).owners.engine == "engineer", "Practice release preserves playback and race ownership")
	panel.recall.pressed.emit(); view.open_practice(6)
	check(model.practice_driver(3).active.returning and model.practice_driver(6).active.is_empty(), "Native Recall uses the correct driver's physical return")
	panel.finish_session(); await settle(); before = JSON.stringify(model.snapshot())
	check(panel.confirmation.visible and not model.paused and model.speed == 8, "Session-close confirmation changes no time control")
	panel.confirmation.canceled.emit(); panel.confirmation.hide(); await settle()
	check(before == JSON.stringify(model.snapshot()), "Canceling practice closure has no gameplay effect")
	for dimensions in [Vector2i(1440,900),Vector2i(1100,720)]:
		for scale_factor in [1.0,1.15,1.3]:
			root.size = dimensions; root.content_scale_size = dimensions; app.settings.pitwall_text_scale = scale_factor
			game.show_weekend(); view = game.content.get_child(0); view.set_process(false); view.open_practice(6)
			panel = view.practice_panel; await settle(); view.refresh(); await settle()
			check(inside(panel.run) and inside(panel.recall) and inside(panel.finish), "Practice actions reachable at %s and %.0f%% text" % [dimensions,scale_factor*100])
			check(inside(view.practice_links[3]) and inside(view.practice_links[6]) and inside(view.pause_button) and inside(view.speed_control), "Both cars and time controls reachable at %s and %.0f%% text" % [dimensions,scale_factor*100])
			check(panel.scroll.size.y >= 55, "Practice form and evidence keep a usable scrolling viewport")
			for input_control in [panel.purpose, panel.sets, panel.lap_count, panel.baseline]:
				panel.scroll.ensure_control_visible(input_control); await settle()
				check(inside(input_control), "Each run input can be reached in the scrolling form at %s / %.0f%%" % [dimensions,scale_factor*100])
			panel.scroll.scroll_vertical = 100000; await settle()
			check(inside(panel.run) and inside(panel.finish), "Scrolling evidence cannot hide run or end commands")
			if scale_factor in [1.0,1.3]: await capture("%dx%d-text%d" % [dimensions.x,dimensions.y,scale_factor*100])
	view.show_navigator(); await settle(); view.navigator.search.text = "practice"; view.navigator.search.text_changed.emit("practice"); await settle()
	check(view.navigator.matches.size() == 1, "Find view searches the new Practice destination")
	view.navigator.open_selected(); await settle()
	check(view.tabs.current_tab == view.practice_page_index, "Find view opens the actual practice panel")
	view.guide.open_guide(); view.guide.show_step(view.guide.steps.size()-1); await capture("guide")
	check("Learn before" in view.guide.title_label.text and model.speed == 8, "Resumable tutorial teaches optional runs without slowing simulation")
	view.guide.dismiss()
	check(app.save_weekend().is_empty() and app.load_weekend().is_empty() and app.weekend is PracticeRaceSim, "Application persists a version-nine live practice weekend")
	view.open_topic(7); view.refresh(); var text = view.debrief_text.text
	for i in range(20): view.refresh()
	check("PRACTICE NOTEBOOK" in text and text == view.debrief_text.text, "Practice notebook is included once in the stable causal debrief")
	var report = {"passed": failures.is_empty(),"checks":checks,"failures":failures,"screenshots":screenshots}
	Storage.write_json("res://reports/practice-ui.json",report); print("PRACTICE_UI ",JSON.stringify(report)); quit(0 if failures.is_empty() else 1)
