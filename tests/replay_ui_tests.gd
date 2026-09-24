extends SceneTree
## Native input through the application shell, source isolation and independent save slots.
var checks = 0
var failures: Array[String] = []
var screenshots = 0
var app
var game
var view
var sim: PracticeRaceSim
func _initialize(): call_deferred("run")
func check(value: bool, message: String):
	checks += 1
	if not value: failures.append(message); push_error(message)
func settle(count: int = 6):
	for i in range(count): await process_frame
func inside(c: Control) -> bool:
	if not c.is_visible_in_tree() or not root.get_visible_rect().encloses(c.get_global_rect()): return false
	var parent = c.get_parent()
	while parent:
		if parent is Control and parent.clip_contents and not parent.get_global_rect().encloses(c.get_global_rect()): return false
		parent = parent.get_parent()
	return true
func click(c: Control):
	var position = c.get_global_rect().get_center()
	var motion = InputEventMouseMotion.new(); motion.position = position; Input.parse_input_event(motion)
	for pressed in [true, false]:
		var event = InputEventMouseButton.new(); event.position = position; event.pressed = pressed; event.button_index = MOUSE_BUTTON_LEFT; Input.parse_input_event(event); await settle(2)
func key(code: Key, ctrl: bool = false):
	for pressed in [true, false]:
		var event = InputEventKey.new(); event.keycode = code; event.pressed = pressed; event.ctrl_pressed = ctrl; Input.parse_input_event(event); await settle(2)
func capture(name: String):
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://reports/replay-" + name + ".png"); screenshots += 1
func build(size: Vector2i, scale: float):
	if game:
		root.remove_child(game); game.queue_free(); await settle()
	root.size = size; root.content_scale_size = size; DisplayServer.window_set_size(size); app.settings.pitwall_text_scale = scale
	game = load("res://scenes/main.tscn").instantiate(); root.add_child(game); await settle()
	sim = RivalScenarios.build(RivalScenarios.catalog()[0], Storage.read_catalog().data)
	app.weekend = sim; game.show_weekend(); await settle()
	view = game.content.get_child(0); view.set_process(false); view.guide.hide()
	view.open_topic(7); await settle()
	# Record actual work through the real approval before exercising playback.
	sim.command("formation")
	for i in range(5): sim.step()
	sim.command("pause"); view.refresh(); await settle()
func run():
	app = root.get_node("App"); app.checkpoint_path = "user://rw19-ui-original.json"; app.sandbox_path = "user://rw19-ui-sandbox.json"
	for size in [Vector2i(1440,900), Vector2i(1100,720)]:
		for scale in [1.0,1.15,1.3]:
			await build(size,scale)
			var tag = "%dx%d-text%d" % [size.x,size.y,roundi(scale*100)]
			check(inside(view.replay_button) and inside(view.bookmark_button) and inside(view.accept_button), "Review fixed actions reachable " + tag)
			check(inside(view.pause_button) and inside(view.speed_control), "Source time controls remain available " + tag)
			var original = sim.snapshot(); var source_view = view
			await click(view.bookmark_button)
			check(app.recording.marks.size()==1 and RaceRecord.equivalent(original,sim.snapshot()), "Bookmark records evidence without changing gameplay " + tag)
			await click(view.replay_button); await settle()
			var w = game.replay_controller.workspace
			check(w != null and not view.visible and view.process_mode==Node.PROCESS_MODE_DISABLED, "Replay suspends original view without replacing it " + tag)
			if w == null: continue
			check(inside(w.play_button) and inside(w.return_button) and inside(w.picker) and inside(w.branch_button), "Replay controls fit " + tag)
			await capture(tag)
			await click(w.play_button); await settle(8)
			check(w.player.verified and RaceRecord.equivalent(original,sim.snapshot()), "Native playback verifies actual recorded steps without consuming source state " + tag)
			await click(w.branch_button); await settle()
			check(w.sandbox_view != null and w.sandbox_view.sim != sim and w.sandbox_view.sim.paused, "Sandbox is a separately paused native weekend " + tag)
			check(app.weekend==sim and app.recording.origin=="standalone", "Sandbox never becomes App original authority " + tag)
			if w.sandbox_view:
				check(inside(w.sandbox_return) and w.mode_title.text.contains("SANDBOX"), "Experiment is clearly labeled with reachable return " + tag)
				check(inside(w.sandbox_view.pause_button) and inside(w.sandbox_view.speed_control), "Sandbox time controls fit " + tag)
				await capture("sandbox-" + tag)
				check(w.save_sandbox().is_empty(), "Separate sandbox slot saves " + tag)
				w._leave_sandbox_saved(); await settle()
			await click(w.return_button); await settle()
			check(game.replay_controller.workspace==null and view==source_view and view.visible and RaceRecord.equivalent(original,sim.snapshot()), "Return restores same original view and exact state " + tag)
			check(root.gui_get_focus_owner()==view.replay_button, "Return restores invoking keyboard focus " + tag)
	await build(Vector2i(1100,720),1.3)
	# A running source retains its time policy; observation must not invent pause.
	sim.paused=false; sim.speed=8
	view.strategy_desk.show_topic(1); view.strategy_desk.drafts[3].objective="protect_finish"
	var draft=view.strategy_desk.drafts[3].duplicate(true); var before=sim.snapshot()
	await key(KEY_K,true); view.navigator.search.text="Replay"; view.navigator.filter_views("Replay"); await key(KEY_ENTER); await settle()
	check(game.replay_controller.workspace!=null, "Ctrl+K/Enter finds Replay without navigating hidden unrelated actions")
	var workspace=game.replay_controller.workspace
	if workspace:
		await settle(12)
		check(RaceRecord.equivalent(before,sim.snapshot()) and not sim.paused and sim.speed==8, "Viewing a running source leaves time policy and all streams unchanged")
		workspace.request_close(); await settle()
		check(view.strategy_desk.drafts[3]==draft, "Unapplied original strategy draft survives replay round-trip")
	# Reordered public timing rows must be addressed by driver identity, not rank.
	for car in sim.cars: car.distance = 200 + (12-int(car.id))*20
	sim.cars[6].distance=600; sim.cars[3].distance=580; sim.phase="race"; sim.paused=true
	view.refresh(); await settle()
	for car in sim.cars:
		if car.player: continue
		check(view.rows[car.id].get_tooltip_text(0).begins_with(car.name) and view.rows[car.id].get_text(4)=="RUN", "Reordered timing row masks the correct rival " + car.short)
	view.select_driver(3); view.open_topic(3); view.show_tyres(1); await settle()
	check(view.wheel_dashboard.is_visible_in_tree(), "Own-driver data remains available after reordered rival masking")
	view.select_driver(0); view.open_topic(3); await settle()
	check(not view.wheel_dashboard.is_visible_in_tree(), "Rival exact wheel data remains private")
	check(app.save_weekend().is_empty(), "Original saves with a versioned session envelope")
	var saved=Storage.read_json(app.checkpoint_path).data
	check(saved.kind==ReplayStorage.SESSION_KIND and saved.record.origin=="standalone" and saved.record.endpoint.version==10, "Session envelope keeps native snapshot schema separate")
	var original_slot=FileAccess.get_file_as_string(app.checkpoint_path)
	game.replay_controller.resume_sandbox(); await settle()
	check(game.replay_controller.workspace!=null and game.replay_controller.workspace.sandbox_record.origin=="sandbox", "Resume sandbox loads only the separate experiment")
	if game.replay_controller.workspace:
		game.replay_controller.workspace.request_close(); await settle()
	check(original_slot==FileAccess.get_file_as_string(app.checkpoint_path), "Saving/resuming an experiment leaves original file bytes unchanged")
	var malformed=saved.duplicate(true); malformed.record.digest="invalid"
	check(not game.replay_controller.open_data(malformed).is_empty() and game.replay_controller.workspace==null and app.weekend==sim, "Malformed import leaves original view and session untouched")
	# Native v10 raw saves remain loadable with explicit partial-history provenance.
	Storage.write_json(app.checkpoint_path,sim.snapshot())
	check(app.load_weekend().is_empty() and app.recording.origin=="legacy" and app.recording.steps==0, "Legacy raw save gains no invented prior command history")
	var report={"passed":failures.is_empty(),"checks":checks,"failures":failures,"screenshots":screenshots,"engine":Engine.get_version_info().string}
	Storage.write_json("res://reports/replay-ui.json",report); print("REPLAY_UI ",JSON.stringify(report)); quit(0 if failures.is_empty() else 1)
