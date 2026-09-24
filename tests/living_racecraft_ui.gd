extends SceneTree
## Actual native controls and framebuffer evidence at both supported desktop sizes.
var checks = 0
var failures: Array[String] = []
var screenshots = 0
var view
var panel: TeamOrdersPanel
var model: StrategyRaceSim

func _initialize() -> void: call_deferred("run")
func check(value: bool, message: String) -> void:
	checks += 1
	if not value: failures.append(message); push_error(message)
func settle() -> void:
	for i in range(10): await process_frame
func capture(name: String) -> void:
	await settle(); await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://reports/living-" + name + ".png"); screenshots += 1
func inside(control: Control) -> bool:
	if not control.is_visible_in_tree() or not control.get_viewport_rect().encloses(control.get_global_rect()): return false
	var parent = control.get_parent()
	while parent:
		if parent is Control and parent.clip_contents and not parent.get_global_rect().encloses(control.get_global_rect()): return false
		parent = parent.get_parent()
	return true

func run() -> void:
	root.size = Vector2i(1440, 900); root.content_scale_size = root.size
	var game = load("res://scenes/main.tscn").instantiate(); root.add_child(game)
	check(game.version_label.text == "NATIVE GODOT  ·  " + str(ProjectSettings.get_setting("application/config/version")), "Native shell shows the configured project version")
	model = StrategyRaceSim.new(TrackGeometry.new(root.get_node("App").library[1]), {"laps": 12, "scenario": "dry", "intensity": "calm", "seed": 7021})
	model.phase = "race"; model.paused = true; model.speed = 8
	for car in model.cars:
		for channel in StrategyPlan.CHANNELS: model.policy(car.id).owners[channel] = "player"
		model.sync_ownership(car)
		car.dnf = car.id not in [3, 6]; car.distance = 100 if car.id == 3 else 80; car.previous_distance = car.distance
		car.speed = 40; car.lane = 0; car.previous_lane = 0
	root.get_node("App").weekend = model; game.show_weekend(); view = game.content.get_child(0); view.set_process(false)
	panel = view.team_panel
	view.detail_picker.select(8); view.detail_picker.item_selected.emit(8); view.refresh(); await settle()
	check(view.tabs.current_tab == 8 and panel.is_visible_in_tree(), "Team and battles is reachable through the existing native topic picker")
	var before = JSON.stringify(model.snapshot())
	panel.kind.select(1); panel.kind.item_selected.emit(1); panel.duration.value = 2
	for i in range(30): view.refresh()
	check(before == JSON.stringify(model.snapshot()), "Team selection, expiry drafts and refreshes issue no orders")
	panel.duration.get_line_edit().grab_focus(); await settle()
	var focused = root.gui_get_focus_owner(); var identity = panel.apply_button.get_instance_id()
	for i in range(30): view.refresh()
	check(root.gui_get_focus_owner() == focused and panel.apply_button.get_instance_id() == identity, "Live team status retains focus and stable button identity")
	view.select_driver(0); panel.apply_button.pressed.emit()
	check(model.team_state.track_order.actor_id == 3 and model.team_state.track_order.teammate_id == 6, "A team draft still names MER and MOR when a rival is inspected")
	check(model.paused and model.speed == 8, "Applying cooperation does not seize pause or playback speed")
	check(panel.apply_button.disabled and "Cancel" in panel.validation.text, "A conflicting instruction is disabled with a readable recovery action")
	await capture("cooperation")
	panel.cancel_buttons.track_order.pressed.emit()
	check(model.team_state.track_order.status == "cancelled", "Native cancellation retains its acknowledgement")
	panel.kind.select(0); panel.kind.item_selected.emit(0); panel.apply_button.pressed.emit()
	var accepted = model.team_state.track_order.duplicate(true)
	model.command("cancel_team_order", {"id": 3, "slot": "track_order", "intent_id": accepted.intent_id, "revision": model.team_state.revision})
	before = JSON.stringify(model.snapshot()); panel.cancel_buttons.track_order.pressed.emit()
	check(before == JSON.stringify(model.snapshot()) and not model.last_error.is_empty(), "A stale native cancellation cannot remove a different instruction")
	model.cars[3].engine = 0; model.cars[6].engine = 2; model.cars[6].pace = 2
	model.paused = false
	for i in range(30): model.step()
	model.paused = true; view.refresh(); panel.show_topic(1)
	check(not panel.watch_buttons[6].disabled, "An actual developing battle enables the watch action")
	panel.watch_buttons[6].pressed.emit()
	check(view.follow and model.selected_id == 6, "Watch follows the explicitly named contest")
	check(model.paused and model.speed == 8, "Watching and battle overlays do not change time controls")
	view.canvas.navigated.emit()
	check(not view.follow, "Manual map navigation releases follow")
	await capture("battle")
	panel.show_topic(2); view.refresh(); await settle()
	check("Estimate" in panel.preview_text.text and "hypothetical" in panel.preview_text.text, "Shared-box advice distinguishes a hypothetical slot from an accepted order")
	panel.priority_buttons[3].pressed.emit()
	check(model.team_state.pit_priority.actor_id == 3 and model.team_state.pit_priority.teammate_id == 6, "Pit-priority buttons name both affected drivers")
	check(model.policy(6).owners.pit == "player" and not model.cars[6].pit_order, "Native priority cannot silently take over manual pit strategy")
	await capture("priority")
	for size in [Vector2i(1440, 900), Vector2i(1100, 720)]:
		root.size = size; root.content_scale_size = size; panel.show_topic(0); await settle(); view.refresh(); await settle(); view.canvas.fit()
		for id in [3, 6]:
			check(inside(view.decision_controls[id].box) and inside(view.decision_controls[id].battle), "Both primary actions and battle statuses fit %dx%d for driver %d" % [size.x, size.y, id])
		check(inside(view.pause_button) and inside(view.speed_control), "Explicit time controls remain reachable at %dx%d" % [size.x, size.y])
		check(inside(panel.apply_button), "Cooperation commit stays reachable at %dx%d" % [size.x, size.y])
		check(view.canvas.size.x >= 300 and view.canvas.size.y >= 170, "Battle workspace remains visible at %dx%d" % [size.x, size.y])
		panel.show_topic(2); await settle()
		check(inside(panel.priority_buttons[3]) and inside(panel.priority_buttons[6]), "Both priority actions are visible without scrolling at %dx%d" % [size.x, size.y])
		panel.show_topic(0); await settle()
		await capture("compact" if size.x == 1100 else "desktop")
	view.guide.open_guide(); await settle()
	check(model.paused and model.speed == 8, "Expanded guide retains the user's selected time controls")
	view.guide.hide()
	view.tabs.current_tab = 7; view.refresh()
	check("Cancelled" in view.debrief_text.text, "Team consequences appear in the existing causal debrief")
	before = JSON.stringify(model.snapshot())
	for i in range(20): view.battle_overlay.queue_redraw(); view.refresh(); await process_frame
	check(before == JSON.stringify(model.snapshot()), "Rendered battle feedback is observational")
	await capture("debrief")
	Storage.write_json("res://reports/living-racecraft-ui.json", {"passed": failures.is_empty(), "checks": checks, "errors": failures, "screenshots": screenshots})
	print("LIVING_UI ", JSON.stringify({"passed": failures.is_empty(), "checks": checks, "errors": failures, "screenshots": screenshots}))
	quit(0 if failures.is_empty() else 1)
