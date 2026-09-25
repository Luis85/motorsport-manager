extends "res://tests/ui_finish_observation_tests.gd"
## Test-first chart, setup and finite-tyre boundaries. Display-only fixtures are disclosed.

func run() -> void:
	root.size = Vector2i(1440,900); root.content_scale_size = root.size
	game = load("res://scenes/main.tscn").instantiate(); root.add_child(game)
	app = root.get_node("App"); await settle(); app.settings.pitwall_text_scale = 1.0
	model = race_fixture(); await reset()
	# A close-lap display boundary, not a claimed physical finishing order.
	model.phase = "results"
	model.cars[3].history = [{"lap":1,"time":112.32,"sectors":[35.1,35.2,42.02]}, {"lap":2,"time":0}, {"lap":3,"time":112.48,"sectors":[35.2,35.2,42.08]}]
	model.cars[6].history = [{"lap":1,"time":112.65}, {"lap":2,"time":112.71}, {"lap":3,"time":112.55}]
	view.open_results_workspace(); view.results_workspace.show_page(1); await settle()
	var chart = view.results_workspace.laps
	check(chart.series.size() == 3 and chart.series[1] == null, "G14 missing lap retains its original lap position")
	check(chart.domain == "Lap" and chart.x_values == [1.0,2.0,3.0], "G14 result chart uses actual lap identifiers rather than sample indices")
	check(chart.maximum - chart.minimum < 2.0, "G14 close lap differences use a sensible padded measured range")
	check(view.results_workspace.get("compare") != null, "G14 compatible own-driver lap comparison is available")
	await RenderingServer.frame_post_draw
	var area = chart.plot_area()
	var at = chart.global_position + Vector2(area.position.x, area.end.y - (chart.series[0] - chart.minimum) / (chart.maximum - chart.minimum) * area.size.y)
	var pixel = root.get_texture().get_image().get_pixelv(Vector2i(at))
	check(pixel.r < 0.4 and pixel.g < 0.5, "G09 an isolated non-cursor measurement is actually drawn beside a missing sample")
	await click(view.results_workspace.compare)
	check(not chart.comparison.is_empty() and chart.series[1] == null and chart.comparison[1] == 112.71, "G14 native comparison keeps an unmatched own-driver lap unavailable")
	chart.grab_focus(); await key(KEY_HOME); await key(KEY_RIGHT)
	check(chart.selected_text().contains("Unavailable") and chart.selected_text().contains("112.71"), "G14 paired keyboard inspection exposes each actual or unavailable value")
	await capture("lap-range-boundary", "Synthetic close-lap/missing-lap display fixture; not a physical result")
	model = race_fixture(); await reset(); model.total_time = 123
	model.cars[3].telemetry = [[119,100,84,18,-2],[120,112,83,17.9,0],[121,119,82,17.8,2]]
	model.cars[6].telemetry = [[119,102,85,18.2,-1],[121,118,83,18,1.5]]
	view.open_topic(1); await settle()
	check(view.telemetry_inspector.get("compare") != null, "G08 recorded compatible teammate telemetry comparison is available")
	var before = JSON.stringify(model.snapshot())
	await click(view.telemetry_inspector.compare)
	check(view.telemetry_inspector.chart.comparison.size() == 3 and view.telemetry_inspector.chart.comparison[1] == null, "G08 native telemetry comparison aligns by observed timestamp without interpolation")
	check(before == JSON.stringify(model.snapshot()), "G08 comparison is observational, including pause, speed and RNG")
	var tyre = TyreInventory.find(model.cars[3],model.cars[3].set_id)
	tyre.wheels.FL.punctured = true
	view.open_topic(3); view.show_tyres(0); view.refresh(); await settle()
	check(view.tyre_readout.fitted.text.to_lower().contains("puncture"), "G10 fitted tyre summary prioritizes the limiting punctured wheel, not the average")
	await capture("limiting-tyre", "Synthetic punctured-wheel boundary; actual finite owned tyre identity")
	model = PracticeRaceSim.new(model.track,{"laps":24,"scenario":"dry","intensity":"calm","seed":7314}); await reset()
	view.open_topic(4); await settle()
	before = JSON.stringify(model.snapshot()); view.racecraft.sliders.wing.grab_focus(); await key(KEY_RIGHT)
	check(before == JSON.stringify(model.snapshot()), "G10 native setup slider stages without a command")
	check(view.racecraft.get("delta_labels") != null, "G10 each setup axis exposes fitted to draft delta")
	var exits = [0]
	view.confirm_leave(func(): exits[0] += 1); await settle()
	check(exits[0] == 0 and is_instance_valid(view.exit_dialog), "G10 setup-only edits receive a leave-without-applying warning")
	if is_instance_valid(view.exit_dialog):
		await key(KEY_ESCAPE)
		check(exits[0] == 0 and before == JSON.stringify(model.snapshot()), "G10 canceling draft exit leaves the race untouched")
	await capture("setup-delta", "Native keyboard edit of the real shared five-axis setup draft")
	var practice_record = {"id":"test-run-1", "samples":[{"time":501.8,"seconds":112.4}], "objective":"tyre_life"}
	model.practice_driver(3).runs.append(practice_record); model.phase = "practice_results"
	var records = view.results_workspace.lap_records(3)
	check(view.results_workspace.lap_data(records).values == [112.4], "G14 practice evidence charts lap duration, not absolute session crossing time")
	model.practice_driver(3).runs.clear(); model.phase = "briefing"
	view.racecraft.revert(); view.open_strategy(3); view.strategy_desk._toggle_timeline(); view.open_analysis_workspace(); await settle()
	var timeline = view.strategy_desk.timeline
	check(timeline.has_method("selected_text"), "G06 strategy stop inspection exposes a textual selected stop")
	if timeline.has_method("selected_text"):
		timeline.grab_focus(); before = JSON.stringify(model.snapshot()); await key(KEY_DOWN); await key(KEY_RIGHT)
		check(before == JSON.stringify(model.snapshot()) and not timeline.selected_text().is_empty(), "G06 native timeline inspection cannot approve a plan or send a stop")
	await capture("strategy-inspection", "Real forecaster options over an unstarted weekend; forecasts are estimates")
	var report={"passed":failures.is_empty(),"checks":checks,"errors":failures,"captures":captures,"screenshots":captures.size(),"engine":Engine.get_version_info().string}
	Storage.write_json("res://reports/ui-finish-analysis.json",report)
	print("UI_FINISH_ANALYSIS ",JSON.stringify(report)); quit(0 if failures.is_empty() else 1)
