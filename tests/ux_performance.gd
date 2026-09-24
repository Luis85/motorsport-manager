extends SceneTree
## Repeatable workload, not an FPS guarantee. Run the same script on both revisions.
var game
var view
var results: Array = []
var draws = {"cars": 0, "battle": 0, "rejoin": 0, "surface": 0}
func _initialize(): call_deferred("run")
func distribution(values: Array) -> Dictionary:
	var sorted = values.duplicate(); sorted.sort()
	return {"median_us": sorted[sorted.size() / 2], "p95_us": sorted[mini(sorted.size() - 1, int(sorted.size() * 0.95))]}
func measure(label: String, work: Callable, repetitions: int = 100) -> void:
	for i in range(10): work.call()
	var values: Array = []
	for i in range(repetitions):
		var start = Time.get_ticks_usec(); work.call(); values.append(Time.get_ticks_usec() - start)
	var result = distribution(values); result.workload = label; result.samples = values.size(); results.append(result)
func run():
	root.size = Vector2i(1100, 720); root.content_scale_size = root.size
	game = load("res://scenes/main.tscn").instantiate(); root.add_child(game)
	var sim = StrategyRaceSim.new(TrackGeometry.new(root.get_node("App").library[0]), {"laps": 24, "scenario": "dry", "intensity": "calm", "seed": 7314})
	sim.phase = "race"; sim.paused = true
	for car in sim.cars:
		car.distance = 300 + (12 - car.id) * 24; car.previous_distance = car.distance; car.speed = 40
	root.get_node("App").weekend = sim; game.show_weekend(); view = game.content.get_child(0); view.set_process(false)
	for i in range(10): await process_frame
	view.tabs.current_tab = 8; view.refresh()
	var original = JSON.stringify(sim.snapshot())
	measure("team panel / paused refresh", view.refresh)
	view.tabs.current_tab = 6; view.refresh()
	measure("strategy / paused refresh", view.refresh)
	view.tabs.current_tab = 0; view.refresh()
	measure("commands / paused refresh", view.refresh)
	measure("uncached forecast / one driver", func(): sim.forecast(3), 30)
	var unchanged = original == JSON.stringify(sim.snapshot())
	if view.has_method("close_detail"): view.close_detail()
	measure("watch / paused refresh", view.refresh)
	view.canvas.overlay.draw.connect(func(): draws.cars += 1)
	view.battle_overlay.draw.connect(func(): draws.battle += 1)
	view.rejoin_overlay.draw.connect(func(): draws.rejoin += 1)
	view.canvas.surface_layer.draw.connect(func(): draws.surface += 1)
	for i in range(10): await process_frame
	for key in draws: draws[key] = 0
	var frames: Array = []
	for i in range(60):
		var start = Time.get_ticks_usec(); await process_frame; frames.append(Time.get_ticks_usec() - start)
	var frame_result = distribution(frames); frame_result.workload = "paused / 60 native frames"; results.append(frame_result)
	var paused_draws = draws.duplicate()
	var paused_calls = Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)
	var active: Array = []
	for factor in [1, 16]:
		sim.command("speed", {"value": factor}); sim.paused = false
		var shadow = StrategyRaceSim.restore_weekend(sim.snapshot())
		if shadow == null: unchanged = false; break
		var start_tick = roundi(sim.total_time / RaceSim.STEP)
		var frame_times: Array = []; var update_times: Array = []
		for frame in range(120):
			var started = Time.get_ticks_usec()
			sim.advance(1.0 / 60.0)
			if frame % 12 == 0: view.refresh()
			update_times.append(Time.get_ticks_usec() - started)
			await process_frame
			frame_times.append(Time.get_ticks_usec() - started)
		# Replay after measurement, with no UI and identical input deltas/accepted speed command.
		for frame in range(120): shadow.advance(1.0 / 60.0)
		var deterministic = JSON.stringify(sim.snapshot()) == JSON.stringify(shadow.snapshot())
		unchanged = unchanged and deterministic
		active.append({"speed":factor, "input_delta_seconds":1.0 / 60.0, "input_frames":120,
			"fixed_steps":roundi(sim.total_time / RaceSim.STEP) - start_tick,
			"native_frame":distribution(frame_times), "advance_and_ui":distribution(update_times),
			"matches_headless":deterministic, "outcome_hash":JSON.stringify(sim.snapshot()).sha256_text()})
		sim.paused = true
	var label = "current"
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("label="): label = arg.trim_prefix("label=")
	var report = {"passed": unchanged, "label": label, "engine": Engine.get_version_info().string,
		"cpu": OS.get_processor_name(), "renderer": RenderingServer.get_video_adapter_name(), "display": DisplayServer.get_name(),
		"viewport": "1100x720", "track": sim.track.document.name, "cars": sim.cars.size(), "seed": 7314,
		"results": results, "paused_redraws": paused_draws, "node_count": get_node_count(), "draw_calls": paused_calls, "observational": unchanged, "active_workloads": active,
		"limitations":"Controlled 1/60s input frames, not achieved real-time multipliers. Software-rendered measurements vary; no universal FPS threshold."}
	Storage.write_json("res://reports/ux-performance-" + label + ".json", report)
	print("UX_PERFORMANCE ", JSON.stringify(report)); quit(0 if unchanged else 1)
