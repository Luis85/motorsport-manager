extends SceneTree
## Native UI, not HTML: stable explicit recipients, cancellation, scroll-independent actions.
var checks = 0
var failures: Array[String] = []
var screenshots = 0
var game
var view
var model: RecoveryRaceSim
func _initialize() -> void: call_deferred("run")
func check(value: bool, message: String) -> void:
	checks += 1
	if not value: failures.append(message); push_error(message)
func settle() -> void:
	for i in range(10): await process_frame
func capture(name: String) -> void:
	await settle(); await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://reports/recovery-" + name + ".png"); screenshots += 1
func inside(control: Control) -> bool:
	if not control.is_visible_in_tree() or not control.get_viewport_rect().encloses(control.get_global_rect()): return false
	var parent = control.get_parent()
	while parent != null:
		if parent is Control and parent.clip_contents and not parent.get_global_rect().encloses(control.get_global_rect()): return false
		parent = parent.get_parent()
	return true
func run() -> void:
	root.size = Vector2i(1440,900); root.content_scale_size = root.size
	game = load("res://scenes/main.tscn").instantiate(); root.add_child(game)
	var app = root.get_node("App")
	game.show_recovery_scenarios(); await capture("scenarios")
	check(game.screen_name == "recovery_scenarios", "Recovery scenarios are reachable in native main navigation")
	model = RecoveryScenarios.build(RecoveryScenarios.catalog()[0], app.library)
	app.weekend = model; game.show_weekend(); view = game.content.get_child(0); view.set_process(false)
	check(view.get_script().resource_path.ends_with("recovery_weekend.gd") and view.tabs.current_tab == 6, "New model uses native recovery view without removing strategy briefing")
	view.open_recovery(3); await capture("briefing")
	var panel = view.recovery_panel
	check(panel.protect_button.disabled and panel.repair_button.disabled and panel.retire_button.disabled, "Briefing cannot issue premature recovery race commands")
	check(view.recovery_links[3].get_theme_stylebox("normal").bg_color == UI.CARD and view.weather_links[3].get_theme_stylebox("hover").bg_color == UI.HOVER, "Detached compact actions inherit the application palette, not fallback gray")
	check("health" in panel.status.text and "DEGRADED" in panel.status.text, "Initial disclosed scalar condition is visible with a text stage")
	var before = JSON.stringify(model.snapshot())
	panel.authority.select(1); panel.authority.item_selected.emit(1); panel.budget.value = 10
	for i in range(12): view.refresh()
	check(before == JSON.stringify(model.snapshot()) and panel.authority.selected == 1 and panel.authority_dirty, "Authority draft survives presentation refresh without becoming a command")
	view.open_recovery(6); view.open_recovery(3)
	check(panel.authority.selected == 1 and panel.budget.value == 10 and panel.authority_dirty, "Unapplied authority is per driver and survives switching the recovery recipient")
	panel.apply_button.pressed.emit()
	check(model.reliability(3).emergency == "repair" and model.reliability(3).repair_budget == 10 and model.policy(3).owners.pit == "player", "Applying bounded recovery authority does not delegate pit ownership")
	model.command("prepare_race"); model.command("formation")
	for c in model.cars: c.formation_done = true
	model.step(); model.command("lights")
	for i in range(125): model.step()
	model.command("speed", {"value":8}); view.open_recovery(3); await settle()
	before = JSON.stringify(model.snapshot())
	for i in range(25): view.refresh()
	check(before == JSON.stringify(model.snapshot()), "Twenty-five native recovery refreshes mutate neither gameplay nor random streams")
	panel.repair_button.grab_focus(); await settle(); var focus = root.gui_get_focus_owner(); var instance = panel.repair_button.get_instance_id()
	for i in range(15): view.refresh()
	check(root.gui_get_focus_owner() == focus and panel.repair_button.get_instance_id() == instance, "Keyboard focus and primary button identity remain stable")
	check("simulated" in panel.execution.text and "at 8×" in panel.execution.text and "Break-even" in panel.comparison.text, "Recovery compares payback and both deadline units without claiming a result")
	panel.confirm_retirement(); await settle(); before = JSON.stringify(model.snapshot())
	check(panel.retirement_dialog.visible and "MER" in panel.retirement_dialog.title, "Irreversible retirement requires a named confirmation")
	panel.retirement_dialog.canceled.emit(); panel.retirement_dialog.hide(); await settle()
	check(before == JSON.stringify(model.snapshot()) and not model.cars[3].dnf, "Canceling retirement has no gameplay consequence")
	view.select_driver(0)
	panel.protect_button.pressed.emit()
	check(model.policy(3).overrides.has("engine") and model.cars[3].engine == 0 and not model.policy(6).overrides.has("engine"), "Protect targets MER even while a rival is inspected")
	view.open_recovery(6); model.cars[6].health -= 6
	before = JSON.stringify(model.snapshot()); panel.submit_repair()
	check(before == JSON.stringify(model.snapshot()) and "changed" in model.last_error, "A stale native repair click is rejected, not silently refreshed into another order")
	view.open_recovery(6); view.select_driver(0); panel.repair_button.pressed.emit()
	check(model.cars[6].pit_order and model.reliability(6).repair_only and not model.cars[3].pit_order, "Repair only targets MOR independently of the inspected rival")
	check(panel.repair_button.disabled and model.cars[6].damage == 20 and "ACCEPTED ORDER" in panel.execution.text, "Accepted order is visible and repairs nothing before physical service")
	view.open_recovery(3)
	for size in [Vector2i(1440,900),Vector2i(1100,720)]:
		root.size = size; root.content_scale_size = size; await settle(); view.refresh(); await settle()
		for id in [3,6]:
			check(inside(view.recovery_links[id]) and inside(view.weather_links[id]) and inside(view.decision_controls[id].box), "Both drivers retain weather, recovery and pit access at %dx%d, car %d" % [size.x,size.y,id])
		check(inside(panel.protect_button) and inside(panel.repair_button) and inside(panel.retire_button), "All recovery actions fit at %dx%d" % [size.x,size.y])
		check(inside(view.pause_button) and inside(view.speed_control) and view.canvas.size.x >= 300 and view.canvas.size.y >= 170, "Map and time controls remain usable at %dx%d" % [size.x,size.y])
		panel.scroll.scroll_vertical = 100000; await settle()
		check(inside(panel.repair_button) and inside(panel.protect_button), "Scrolling evidence cannot hide recovery actions at %dx%d" % [size.x,size.y])
		view.canvas.fit()
		await capture("details-%dx%d" % [size.x,size.y]); panel.scroll.scroll_vertical = 0
	await capture("compact")
	WeekendRaceControl.enqueue(model.control_state,0,1,true,1,model.total_time,"ui-test-hazard","Disclosed UI fixture hazard")
	model.step(); view.refresh(); await capture("virtual")
	check("VIRTUAL" in view.flag_label.text and "No overtaking" in panel.rules.text and not model.paused and model.speed == 8, "Virtual state and persistent rule text preserve user time control")
	for i in range(22): model.step()
	view.refresh()
	check("VIRTUAL ENDING" in view.flag_label.text and "simulated" in panel.rules.text, "Eight-second ending is named honestly, not as a physical safety car")
	view.guide.open_guide(); view.guide.show_step(7); await capture("guide")
	check(view.guide.title_label.text == "Protect the finish" and view.tabs.current_tab == view.recovery_page_index, "Resumable guide reveals actual recovery controls")
	check(not model.paused and model.speed == 8, "Recovery guide never pauses or slows the race")
	view.guide.dismiss()
	check(app.save_weekend().is_empty() and app.load_weekend().is_empty(), "Application saves and reloads a live v8 recovery weekend")
	check(app.weekend is RecoveryRaceSim and app.weekend.reliability(6).repair_only and app.weekend.control_state.state == "ending", "Application restores recovery transaction and exact sporting phase")
	view.tabs.current_tab = 7; view.refresh(); await capture("debrief")
	var text = view.debrief_text.text; view.refresh()
	check("RECOVERY AND RACE CONTROL" in text and text == view.debrief_text.text, "Recovery debrief is stable, not repeatedly appended by refresh")
	var report = {"passed":failures.is_empty(),"checks":checks,"failures":failures,"screenshots":screenshots}
	Storage.write_json("res://reports/recovery-ui.json",report); print("RECOVERY_UI ",JSON.stringify(report)); quit(0 if failures.is_empty() else 1)
