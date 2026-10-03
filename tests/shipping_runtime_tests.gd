extends "res://tests/weekend_lifecycle_tests.gd"
## A physically populated shipping fixture and separate controlled/wall-time experiments.
## Timings are evidence, never universal thresholds in the regression gate.
const Probe = preload("res://tests/support/runtime_probe.gd")
var timings: Array = []
var sustained: Array = []
var controlled: Array = []
var seconds: float = 8.0
var monitored_steps: int = 0
var monitored_queries: int = 0


func display_settings_contracts() -> void:
	check(
		OS.get_cmdline_user_args().has("--disable-vsync"),
		"Native runner forwards consumed engine VSync override to the application"
	)
	app.restore_settings({"vsync": true})
	check(app.settings.vsync, "Restore the saved enabled VSync preference")
	check(app.save_settings().is_empty(), "Save display preferences under the launch override")
	var saved = Storage.read_json("user://settings.json")
	check(saved.ok and saved.data.vsync, "Launch override preserves enabled VSync on disk")
	for repetition in range(3):
		app.apply_settings()
		check(
			DisplayServer.window_get_vsync_mode() == DisplayServer.VSYNC_DISABLED,
			"Repeated settings application honors disabled engine VSync"
		)
		check(app.settings.vsync, "Repeated application retains the stored enabled preference")


func measure(name: String, operation: Callable, count: int = 24) -> void:
	for warmup in range(4):
		operation.call()
	var values: Array = []
	for index in range(count):
		var started = Time.get_ticks_usec()
		operation.call()
		values.append(Time.get_ticks_usec() - started)
	var row = Probe.statistics(values)
	row.workload = name
	row.warmup_calls = 4
	row.measured_calls = count
	timings.append(row)
	print("SHIPPING_SAMPLE ", name, " median_us=", row.median_us)


func simulation_batch(simulation: RaceSim, count: int) -> void:
	for index in range(count):
		simulation.step()


func controlled_frames(checkpoint: Dictionary) -> void:
	for speed in [1, 16]:
		var observed = MinimalRaceSession.new(PracticeRaceSim.restore_practice(checkpoint))
		var quiet = MinimalRaceSession.new(PracticeRaceSim.restore_practice(checkpoint))
		for binding in [observed, quiet]:
			binding.view.controls.set_speed(speed)
			binding.view.controls.play()
		var expected = 0
		var actual = 0
		var discarded = 0.0
		for index in range(120):
			var elapsed: float = [1.0 / 60.0, 0.3, 0.01, 0.08][index % 4]
			actual += observed.runner.advance(elapsed)
			expected += quiet.runner.advance(elapsed)
			observed.view.query.capture()
			observed.view.visual_source.capture()
			discarded += maxf(0.0, elapsed - RaceStepClock.MAX_FRAME_SECONDS)
		var a: RaceSim = observed.runner._simulation
		var b: RaceSim = quiet.runner._simulation
		check(
			actual == expected and RaceRecord.equivalent(a.snapshot(), b.snapshot()),
			"Controlled frame inputs preserve outcome despite different observation schedules"
		)
		controlled.append(
			{
				"speed": speed,
				"input_frames": 120,
				"fixed_steps": actual,
				"frame_cap_discarded_seconds": discarded,
				"outcome_hash": RaceStateValue.fingerprint(RaceRecord.sporting(a.snapshot()))
			}
		)


func wall_sample(checkpoint: Dictionary, speed: int) -> void:
	model = PracticeRaceSim.restore_practice(checkpoint)
	app.weekend = model
	game.show_weekend()
	bind_view()
	var record = app.ensure_recording()
	var runner = Probe.Runner.new(model)
	var query = Probe.Query.new(model)
	var visual = Probe.Visual.new(model)
	view.session.query = query
	view.canvas.visual_source = visual
	app.activate_session(runner, record)
	view.session.status = RaceSessionStatus.new(runner)
	view.session_status = view.session.status
	view.set_process(true)
	view.controls.set_speed(maxi(1, speed))
	if speed > 0:
		view.controls.play()
	else:
		view.controls.pause()
	# Startup import, binding and initial autosave are outside sustained measurements.
	var warmup = Time.get_ticks_usec()
	while Time.get_ticks_usec() - warmup < 2000000:
		await process_frame
	runner.reset()
	query.calls = 0
	query.usec = 0
	visual.calls = 0
	visual.usec = 0
	var initial_time = model.total_time
	var initial_updates = view.table_updates
	var before_memory = int(Performance.get_monitor(Performance.MEMORY_STATIC))
	var begin = Time.get_ticks_usec()
	var previous = begin
	var frames: Array = []
	var draw_calls: Array = []
	while Time.get_ticks_usec() - begin < seconds * 1000000 and frames.size() < 25000:
		await process_frame
		var now = Time.get_ticks_usec()
		frames.append(now - previous)
		previous = now
		draw_calls.append(
			int(Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME))
		)
		monitored_steps = runner.ticks
		monitored_queries = query.calls
	var elapsed = (Time.get_ticks_usec() - begin) / 1000000.0
	var simulated = model.total_time - initial_time
	runner.automatic = false
	view.set_process(false)
	view.controls.pause()
	check(
		frames.size() < 25000 and elapsed >= seconds,
		"Sustained workload completed its declared wall-time window"
	)
	check(model.phase == "race", "Sustained timing did not substitute a terminal-session no-op")
	check(
		absf(simulated - runner.ticks * RaceSim.STEP) < 0.00001,
		"Delivered simulated time reconciles with observed fixed steps"
	)
	check(
		query.calls > 0 and visual.calls > 0,
		"Shipping controls and visuals were observed during the sample"
	)
	var frame_stats = Probe.statistics(frames)
	# Keep bounded summary and raw frame intervals for repeatable spike inspection.
	draw_calls.sort()
	sustained.append(
		{
			"requested_speed": speed,
			"wall_seconds": elapsed,
			"delivered_simulated_seconds": simulated,
			"delivered_speed": simulated / elapsed,
			"native_supplied_active_seconds": runner.supplied_seconds,
			"clock_discarded_wall_seconds": runner.clamped_seconds,
			"step_cap_frames": runner.step_cap_frames,
			"fixed_steps": runner.ticks,
			"scheduler_calls": runner.calls,
			"scheduler_cpu_us": runner.usec,
			"query_calls": query.calls,
			"query_cpu_us": query.usec,
			"visual_calls": visual.calls,
			"visual_cpu_us": visual.usec,
			"timing_row_updates": view.table_updates - initial_updates,
			"frame_intervals": frame_stats,
			"median_draw_calls": draw_calls[draw_calls.size() / 2],
			"retained_static_bytes_delta":
			int(Performance.get_monitor(Performance.MEMORY_STATIC)) - before_memory,
			"allocation_note":
			"Retained Godot static bytes, not total allocated bytes or OS resident memory."
		}
	)
	print(
		"SHIPPING_WALL speed=",
		speed,
		" delivered=",
		simulated / elapsed,
		" frame_p95_us=",
		frame_stats.p95_us
	)


func editor_costs(document: Dictionary) -> void:
	var authored = document.duplicate(true)
	# Declared authoring load, not a fabricated race history or result.
	for index in range(120):
		authored.objects.append(
			{
				"type": "tree",
				"x": float(index % 20) * 15,
				"y": float(index / 20) * 15,
				"h": 0,
				"scale": 1,
				"rotation": 0
			}
		)
	game.show_editor(authored)
	await settle()
	var editor: TrackEditor = game.editor
	# The extracted canvas overlay painter must retain the one-build-per-geometry
	# contract; observation must never mutate the editor's canonical document.
	var before_overlay = editor.session.read_document()
	var canvas: TrackCanvas = editor.canvas
	check(canvas.geometry != null, "Shipping editor has compiled geometry for overlay validation")
	if canvas.geometry != null:
		var previous_builds = canvas.surface_geometry_builds
		canvas.build_surface_geometry()
		check(
			canvas.surface_geometry_builds == previous_builds + 1,
			"Overlay compiles its surface cache once for a new geometry"
		)
		check(
			canvas._surface_segments.size() == RaceVisualPort.SURFACE_STATIONS,
			"Overlay cache retains exactly the configured longitudinal stations"
		)
		if canvas._surface_segments.size() == RaceVisualPort.SURFACE_STATIONS:
			check(
				(
					canvas._surface_segments[0].size() == RaceVisualPort.SURFACE_LANES
					and canvas._surface_segments[0][0].size() == 4
				),
				"Overlay retains all lateral strips and four subsegments per station"
			)
		canvas.build_surface_geometry()
		check(
			canvas.surface_geometry_builds == previous_builds + 1,
			"Re-reading an unchanged circuit does not rebuild surface geometry"
		)
	check(
		editor.session.read_document() == before_overlay,
		"Overlay cache inspection leaves canonical editor history unchanged"
	)
	measure("editor/full_compile", func(): editor.session.compile_draft(authored, "Formula"), 8)
	measure(
		"editor/preview_compile", func(): editor.session.compile_draft(authored, "Formula", true), 8
	)
	measure(
		"editor/pure_move", func(): TrackEdit.move_positions(authored, "road", {0: Vector2(40, 50)})
	)
	measure("editor/inspector_refresh", editor.refresh_inspector, 8)
	var before = editor.session.read_document()
	var frame_times: Array = []
	for index in range(60):
		var started = Time.get_ticks_usec()
		editor.canvas.center.x += 0.2
		editor.canvas.queue_redraw()
		await RenderingServer.frame_post_draw
		frame_times.append(Time.get_ticks_usec() - started)
	var result = Probe.statistics(frame_times)
	result.workload = "editor/pan_frame_including_render_and_wait"
	timings.append(result)
	check(
		editor.session.read_document() == before,
		"Profiling editor queries, compilation and pan preserves canonical history"
	)


func run() -> void:
	var requested = OS.get_environment("MOTORSPORT_RUNTIME_SECONDS")
	if not requested.is_empty():
		check(
			requested.is_valid_float() and float(requested) >= 2 and float(requested) <= 60,
			"Wall-time sample duration is explicitly bounded"
		)
		if not failures.is_empty():
			quit(1)
			return
		seconds = float(requested)
	root.size = Vector2i(1440, 900)
	root.content_scale_size = root.size
	game = load("res://scenes/main.tscn").instantiate()
	root.add_child(game)
	app = root.get_node("App")
	await settle()
	display_settings_contracts()
	if DisplayServer.window_get_vsync_mode() != DisplayServer.VSYNC_DISABLED:
		DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_DISABLED)
	Engine.max_fps = 120
	if not await start_weekend(24):
		quit(1)
		return
	await leave_and_resume()
	if not await prepare_race():
		quit(1)
		return
	var checkpoint = model.snapshot()
	var initial_hash = RaceStateValue.fingerprint(RaceRecord.sporting(checkpoint))
	var record: RaceRecord = app.ensure_recording()
	var sealed = record.seal()
	var diagnostic = RaceViewQuery.new(model)
	var supplied: Dictionary = model.cars[3].to_record()
	measure("shipping/query", view.session.query.capture)
	measure("shipping/visual_query", view.session.visual_source.capture)
	measure("shipping/native_timing_controls", view.present_timing)
	measure("shipping/full_refresh", view.refresh)
	measure("persistence/snapshot", model.snapshot)
	measure("persistence/integer_paths", func(): RaceRecord.integer_paths(checkpoint))
	measure("persistence/seal", record.seal, 12)
	var contract_predicate_0 = func():
		check(
			Storage.write_json("user://profile-save.json", sealed).is_empty(),
			"Measured filesystem write succeeds"
		)
	measure("persistence/write_sealed", contract_predicate_0, 12)
	var contract_predicate_1 = func():
		check(
			ReplayStorage.save_session("user://profile-session.json", record).is_empty(),
			"Measured session save succeeds"
		)
	measure("persistence/save_session", contract_predicate_1, 12)
	measure("diagnostic/supplied_record_advisory", func(): diagnostic.car_advisories(supplied))
	check(
		RaceRecord.equivalent(model.snapshot(), checkpoint),
		"All paused observation and persistence workloads preserve complete state and RNG"
	)
	var simulation = PracticeRaceSim.restore_practice(checkpoint)
	simulation.paused = false
	var begin = Time.get_ticks_usec()
	simulation_batch(simulation, 1000)
	var simulation_us = Time.get_ticks_usec() - begin
	check(
		absf(simulation.total_time - checkpoint.total_time - 50.0) < 0.00001,
		"Simulation-only measurement executes exactly 1,000 real steps"
	)
	controlled_frames(checkpoint)
	Performance.add_custom_monitor("RuntimeConfidence/fixed_steps", func(): return monitored_steps)
	Performance.add_custom_monitor(
		"RuntimeConfidence/query_calls", func(): return monitored_queries
	)
	for speed in [0, 1, 16]:
		await wall_sample(checkpoint, speed)
	Performance.remove_custom_monitor("RuntimeConfidence/fixed_steps")
	Performance.remove_custom_monitor("RuntimeConfidence/query_calls")
	check(
		not Performance.has_custom_monitor("RuntimeConfidence/fixed_steps"),
		"Developer monitor is disposed"
	)
	await editor_costs(checkpoint.track)
	var report = {
		"passed": failures.is_empty(),
		"checks": checks,
		"failures": failures,
		"source_revision": OS.get_environment("MOTORSPORT_SOURCE_REVISION"),
		"engine": Engine.get_version_info().string,
		"cpu": OS.get_processor_name(),
		"renderer": RenderingServer.get_current_rendering_method(),
		"rendering_driver": RenderingServer.get_current_rendering_driver_name(),
		"adapter": RenderingServer.get_video_adapter_name(),
		"viewport": "1440x900",
		"text_scale": 1.0,
		"fps_limit": Engine.max_fps,
		"vsync_requested": "disabled",
		"vsync_reported": DisplayServer.window_get_vsync_mode(),
		"seed": 7314,
		"track": checkpoint.track.name,
		"cars": checkpoint.cars.size(),
		"preparation_steps": steps,
		"journal_records": checkpoint.strategy_state.records.size(),
		"initial_sporting_hash": initial_hash,
		"timings": timings,
		"sustained": sustained,
		"controlled": controlled,
		"simulation":
		{
			"steps": 1000,
			"simulated_seconds": 50.0,
			"cpu_us": simulation_us,
			"outcome_hash": RaceStateValue.fingerprint(RaceRecord.sporting(simulation.snapshot()))
		},
		"limitations":
		(
			"Physical practice/qualifying/formation fixture; test-only timers call "
			+ "ordinary shipping APIs. Wall-time outcomes need not match because "
			+ "delivered steps differ. Frame intervals include render/wait/OS cost, not "
			+ "isolated GPU time. No universal speed or FPS guarantee."
		)
	}
	Storage.write_json("res://reports/shipping-runtime-tests.json", report)
	print("SHIPPING_RUNTIME passed=", report.passed, " checks=", checks)
	quit(0 if failures.is_empty() else 1)
