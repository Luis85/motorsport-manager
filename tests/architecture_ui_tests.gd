extends "res://tests/minimal_ui_tests.gd"
## Real native controls plus explicit scheduling ownership; no synthetic racing results.
func run() -> void:
	root.size = Vector2i(1440, 900)
	root.content_scale_size = root.size
	game = load("res://scenes/main.tscn").instantiate()
	root.add_child(game)
	app = root.get_node("App")
	await settle()
	app.settings.pitwall_layout = "minimal"
	app.settings.pitwall_text_scale = 1.0
	model = PracticeRaceSim.new(TrackGeometry.new(app.library[7]), {"laps": 6, "scenario": "dry", "intensity": "calm", "seed": 7314})
	await reset()
	await click(view.primary_button)
	await click(view.send_button)
	await click(view.pause_button)
	check(model.phase == "practice" and not model.practice_driver(3).active.is_empty(), "Real native practice approval and release remain connected")
	check(app.session_runner == view.session_runner, "Application owns the same session runner exposed at composition")
	var saved = Storage.read_json(app.checkpoint_path)
	check(saved.ok, "Phase autosave is produced by application scheduling, not view refresh")
	var before = RaceRecord.sporting(model.snapshot())
	for i in range(12):
		view.refresh()
		view.canvas.queue_redraw()
		await process_frame
	check(RaceRecord.equivalent(before, RaceRecord.sporting(model.snapshot())), "Redrawing and refreshing paused native UI cannot change sporting state")
	var live = model.snapshot()
	var reference = PracticeRaceSim.restore_practice(live)
	check(reference != null, "Current native session is independently restorable")
	view.hide()
	view.process_mode = Node.PROCESS_MODE_DISABLED
	view.session_runner.automatic = true
	view.controls.play()
	await create_timer(0.45).timeout
	view.controls.pause()
	view.session_runner.automatic = false
	var ticks = roundi((model.total_time - float(live.total_time)) / RaceSim.STEP)
	check(ticks > 0, "Hiding and disabling the entire visual tree does not stop the application simulation")
	if reference != null:
		reference.command("pause")
		for i in range(ticks): reference.step()
		reference.command("pause")
		check(RaceRecord.equivalent(RaceRecord.sporting(reference.snapshot()), RaceRecord.sporting(model.snapshot())), "Hidden native playback matches the same count of independent domain ticks")
	view.process_mode = Node.PROCESS_MODE_INHERIT
	view.show()
	view.refresh()
	await settle()
	var source = model.snapshot()
	var original_runner = app.session_runner
	var record = view.recording.seal()
	var error = game.replay_controller.open_data(record)
	check(error.is_empty(), "Actual native recording opens through the production replay controller: " + error)
	if error.is_empty():
		var replay = game.replay_controller.workspace
		check(app.session_runner == null and app.replay_runner == replay.playback, "Replay explicitly suspends live scheduling instead of relying on hidden views")
		replay.set_process(false)
		replay.playing = true
		await settle(8)
		check(replay.player.step_index > 0 and replay.player.error.is_empty(), "Replay progresses through application playback even when its UI refresh is disabled")
		check(RaceRecord.equivalent(source, model.snapshot()), "Replay does not change original pause, speed, remainder, cars or RNG")
		replay.playing = false
		replay.seek(-1)
		replay.start_sandbox()
		await settle()
		check(app.session_runner == replay.sandbox_view.session_runner and app.session_runner != original_runner, "Sandbox is assigned a separate authoritative session runner")
		replay.sandbox_view.session_runner.automatic = false
		check(RaceRecord.equivalent(source, model.snapshot()), "Sandbox creation cannot mutate original state")
		replay._leave_sandbox_saved()
		await settle()
		check(app.session_runner == null, "Returning to replay stops sandbox scheduling")
		game.replay_controller.close()
		await settle()
		check(app.session_runner == original_runner and not original_runner.automatic, "Returning restores the exact original runner and its scheduling preference")
		check(RaceRecord.equivalent(source, model.snapshot()), "Closing replay preserves the full original snapshot")
	# Signals belong to the active application connection, not repeated view refreshes.
	for i in range(4): app.activate_session(original_runner, view.recording)
	check(original_runner.phase_changed.get_connections().size() == 1, "Repeated activation never duplicates the phase/autosave subscription")
	app.stop_session()
	check(original_runner.phase_changed.get_connections().is_empty(), "Stopping a session disconnects its application listener")
	app.activate_session(original_runner, view.recording)
	view.refresh()
	await capture("architecture-isolation", "Actual native practice release; visibility/replay isolation; no fabricated racing result")
	check(app.save_weekend().is_empty(), "Live checkpoint is saved before replacement")
	check(app.load_weekend().is_empty(), "A valid replacement checkpoint loads")
	check(app.session_runner == null and original_runner.phase_changed.get_connections().is_empty(), "Replacing a checkpoint stops the discarded model before the next screen mounts")
	app.activate_session(RaceSessionRunner.new(app.weekend), app.recording)
	var retained = app.weekend
	var retained_runner = app.session_runner
	var original_path = app.checkpoint_path
	app.checkpoint_path = "user://invalid-load-architecture.json"
	Storage.write_json(app.checkpoint_path, {"invalid": true})
	check(not app.load_weekend().is_empty() and app.weekend == retained and app.session_runner == retained_runner, "Rejected checkpoint leaves the active session and scheduler intact")
	app.checkpoint_path = original_path
	var report = {"passed": failures.is_empty(), "checks": checks, "failures": failures,
		"independent_ticks": ticks, "screenshots": captures.size(), "captures": captures}
	Storage.write_json("res://reports/architecture-ui.json", report)
	print("ARCHITECTURE_UI ", JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
