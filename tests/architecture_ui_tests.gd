extends "res://tests/minimal_ui_tests.gd"
## Real native controls plus explicit scheduling ownership; no synthetic racing results.

func choose_option(control: OptionButton, index: int) -> void:
	control.select(index)
	control.item_selected.emit(index)
	await settle(3)

func capture_settings(label: String, provenance: String) -> void:
	await settle()
	await RenderingServer.frame_post_draw
	var filename = "finish-" + label + ".png"
	root.get_texture().get_image().save_png("res://reports/" + filename)
	captures.append({"file": filename, "scope": "settings",
		"viewport": [root.size.x, root.size.y],
		"text_scale": app.settings.pitwall_text_scale,
		"provenance": provenance})

func interface_mode_journey() -> void:
	# Persistence accepts the two historic advanced variants, a public alias, and
	# falls back safely when an unsupported value is read.
	app.settings.pitwall_layout = "minimal"
	app.restore_settings({"pitwall_layout": "director"})
	check(app.settings.pitwall_layout == "director" and app.settings.advanced_pitwall_layout == "director", "Saved Race Director preference survives settings restoration")
	app.restore_settings({"pitwall_layout": "engineering"})
	check(app.settings.pitwall_layout == "engineering" and app.settings.advanced_pitwall_layout == "engineering", "Saved Engineering preference survives settings restoration")
	app.restore_settings({"pitwall_layout": "advanced"})
	check(app.settings.pitwall_layout == "director" and app.settings.advanced_pitwall_layout == "director", "Public Advanced alias migrates to the approachable Race Director start")
	app.restore_settings({"pitwall_layout": "minimal", "advanced_pitwall_layout": "engineering"})
	check(app.settings.pitwall_layout == "minimal" and app.settings.advanced_pitwall_layout == "engineering", "Minimal can retain an independent preferred Advanced start")
	app.restore_settings({"pitwall_layout": "unsupported"})
	check(app.settings.pitwall_layout == "minimal", "Unsupported interface preference falls back to Minimal")

	game.show_settings()
	await settle(8)
	var settings = game.content.get_child(0)
	check(settings.layout_choice.selected == 0 and settings.draft.pitwall_layout == "minimal", "Settings expose Minimal as the default race interface")
	check(settings.advanced_choice.disabled and settings.racing_line_choice.disabled, "Advanced-only preferences are unavailable while Minimal is selected")
	var application_before = app.settings.duplicate(true)
	await choose_option(settings.layout_choice, 1)
	check(settings.draft.pitwall_layout == "director" and not settings.advanced_choice.disabled, "Selecting Advanced stages Race Director without rebuilding the current screen")
	check(not settings.racing_line_choice.disabled, "Advanced selection exposes its circuit overlay preference")
	await choose_option(settings.advanced_choice, 1)
	check(settings.draft.pitwall_layout == "engineering" and settings.draft.advanced_pitwall_layout == "engineering", "Advanced start can be changed explicitly to Engineering")
	await choose_option(settings.layout_choice, 0)
	check(settings.draft.pitwall_layout == "minimal" and settings.draft.advanced_pitwall_layout == "engineering", "Returning to Minimal retains the staged Advanced starting surface")
	check(settings.advanced_choice.disabled and settings.racing_line_choice.disabled, "Returning to Minimal disables advanced-only controls")
	check(app.settings == application_before, "Interface preview does not mutate application settings before Apply")
	await capture_settings("architecture-interface-selector", "Native staged Minimal / Advanced setting; no live weekend mutation")
	await click(settings.save_button)
	check(not settings.has_changes() and app.settings.pitwall_layout == "minimal" and app.settings.advanced_pitwall_layout == "engineering", "Apply persists Minimal and its independent preferred Advanced start")
	var stored = Storage.read_json("user://settings.json")
	check(stored.ok and stored.data.pitwall_layout == "minimal" and stored.data.advanced_pitwall_layout == "engineering", "Both interface preferences are read back from real settings storage")

	game.show_settings()
	await settle(8)
	settings = game.content.get_child(0)
	check(settings.advanced_choice.selected == 1 and settings.advanced_choice.disabled, "Reopened Settings remembers Engineering while Minimal remains active")
	await choose_option(settings.layout_choice, 1)
	check(settings.draft.pitwall_layout == "engineering", "Switching back to Advanced restores the saved Engineering start")
	await click(settings.save_button)
	check(app.settings.pitwall_layout == "engineering", "Apply activates the restored Advanced interface preference")

	# Both advanced starts mount on the same authoritative weekend and share its
	# recording, commands and scheduler. Recomposition is presentation-only.
	var advanced_model = PracticeRaceSim.new(TrackGeometry.new(app.library[7]), {"laps": 6, "scenario": "dry", "intensity": "calm", "seed": 7314})
	advanced_model.paused = false
	app.weekend = advanced_model
	var before = RaceStateValue.fingerprint(advanced_model.snapshot())
	game.show_weekend()
	await settle(8)
	var advanced_view = game.content.get_child(0)
	check(advanced_view is RaceDirectorWorkspace and not advanced_view.director_enabled, "Engineering preference opens the retained full advanced workspace")
	check(before == RaceStateValue.fingerprint(advanced_model.snapshot()), "Opening Engineering does not mutate weekend state or RNG")
	app.settings.pitwall_layout = "director"
	app.settings.advanced_pitwall_layout = "director"
	game.show_weekend()
	await settle(8)
	advanced_view = game.content.get_child(0)
	check(advanced_view is RaceDirectorWorkspace and advanced_view.director_enabled, "Race Director preference opens the approachable advanced surface")
	check(before == RaceStateValue.fingerprint(advanced_model.snapshot()), "Switching advanced starting surface preserves the same weekend state and RNG")
	app.stop_session()
	app.settings.pitwall_layout = "minimal"
	check(app.save_settings().is_empty(), "Test restores and persists the Minimal default")
	game.show_menu()
	await settle(6)

func run() -> void:
	root.size = Vector2i(1440, 900)
	root.content_scale_size = root.size
	game = load("res://scenes/main.tscn").instantiate()
	root.add_child(game)
	app = root.get_node("App")
	await settle()
	await interface_mode_journey()
	app.settings.pitwall_layout = "minimal"
	app.settings.pitwall_text_scale = 1.0
	model = PracticeRaceSim.new(TrackGeometry.new(app.library[7]), {"laps": 6, "scenario": "dry", "intensity": "calm", "seed": 7314})
	await reset()
	await click(view.primary_button)
	await click(view.send_button)
	await click(view.pause_button)
	check(model.phase == "practice" and not model.practice_driver(3).active.is_empty(), "Real native practice approval and release remain connected")
	check(app.session_runner != null and view.session_status.available(), "Application owns the runner while the view receives only read-only status")
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
	root.get_node("App").session_runner.automatic = true
	view.controls.play()
	await create_timer(0.45).timeout
	view.controls.pause()
	root.get_node("App").session_runner.automatic = false
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
		check(app.session_runner == null and app.replay_runner == game.replay_controller.binding.playback, "Replay explicitly suspends live scheduling instead of relying on hidden views")
		replay.set_process(false)
		replay.playing = true
		await settle(8)
		check(replay.player.step_index > 0 and replay.player.error.is_empty(), "Replay progresses through application playback even when its UI refresh is disabled")
		check(RaceRecord.equivalent(source, model.snapshot()), "Replay does not change original pause, speed, remainder, cars or RNG")
		replay.playing = false
		replay.seek(-1)
		replay.start_sandbox()
		await settle()
		check(app.session_runner != null and replay.sandbox_view.session_status.available() and app.session_runner != original_runner, "Sandbox is assigned a separate authoritative session runner")
		root.get_node("App").session_runner.automatic = false
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
