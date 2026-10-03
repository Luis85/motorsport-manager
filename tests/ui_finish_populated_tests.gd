extends "res://tests/support/ui_finish_lineage_fixture.gd"


func render_profile(profile: Array) -> void:
	root.size = Vector2i(profile[0], profile[1])
	root.content_scale_size = root.size
	app.settings.pitwall_text_scale = profile[2]
	var suffix = str(profile)
	for state in [
		"briefing",
		"qualifying-garage",
		"qualifying-hotlap",
		"qualifying-closed",
		"formation",
		"grid"
	]:
		await restore_state(state)
		view.close_detail()
		await settle()
		header_and_drivers(state + suffix)
		await shoot(state, state)
		if state == "qualifying-hotlap":
			check(view.qualifying_workspace.visible, "G04 qualifying context is visible: " + suffix)
	await practice_profile(suffix)
	await restore_state("preparation")
	view.open_topic(4)
	view.open_analysis_workspace()
	await settle()
	check(
		reachable(view.racecraft.apply_button) and reachable(view.racecraft.reset_button),
		"G10 setup actions stay outside scrolling content " + suffix
	)
	for key in view.racecraft.sliders:
		check(
			reachable(view.racecraft.sliders[key]),
			"G10 all five setup axes reachable in focus: " + key + suffix
		)
	await shoot("setup", "preparation")
	await restore_state("race")
	view.close_detail()
	await settle()
	header_and_drivers("race" + suffix)
	await shoot("race", "race")
	var signature = race_fingerprint()
	await click(view.car_cards[3].name_label)
	await settle()
	check(
		reachable(view.decision_drawer.box) and reachable(view.decision_drawer.refresh_button),
		"G01 review/commit controls remain fixed " + suffix
	)
	await shoot("decision", "race")
	await click(view.group_buttons.Strategy)
	await settle()
	check(
		view.tabs.current_tab == 6, "G15 Strategy navigation escapes a historical decision drawer"
	)
	view.strategy_desk._toggle_timeline()
	await click(view.focus_button)
	await settle()
	header_and_drivers("strategy" + suffix)
	check(
		reachable(view.strategy_desk.box_now),
		"G06 focused Strategy keeps its action boundary visible " + suffix
	)
	await shoot("strategy", "race")
	view.close_session_workspace()
	view.open_topic(1)
	await click(view.focus_button)
	await settle()
	var telemetry = view.telemetry_inspector
	for channel in range(4):
		await choose(telemetry.selector, channel)
		telemetry.chart.grab_focus()
		await key(KEY_HOME)
		check(
			(
				telemetry.chart.series.size() > 0
				and telemetry.chart.series.any(func(value): return value != null)
			),
			"G08 channel contains actual retained samples: " + str(channel) + suffix
		)
		check(
			telemetry.chart.domain == "Elapsed s" and reachable(telemetry.chart),
			"G08 populated chart has a visible elapsed-time domain: " + suffix
		)
		await shoot("telemetry-" + str(channel), "race")
	await click(telemetry.compare)
	await shoot("telemetry-comparison", "race")
	view.close_session_workspace()
	view.open_topic(3)
	view.show_tyres(0)
	await click(view.focus_button)
	await settle()
	check(reachable(view.tyre_readout), "G10 fitted and planned identities visible " + suffix)
	await shoot("tyres", "race")
	view.show_tyres(1)
	await settle()
	await shoot("wheels", "race")
	view.close_session_workspace()
	view.open_topic(8)
	view.team_panel.show_topic(0)
	await settle()
	check(
		reachable(view.team_panel.apply_button),
		"G12 team instruction commitment stays visible " + suffix
	)
	await shoot("team", "race")
	await click(view.team_panel.topic_buttons[3])
	await click(view.focus_button)
	await settle()
	check(
		reachable(view.team_panel.intent_timeline),
		"G12 accepted windows fit focused chart " + suffix
	)
	await shoot("plans", "race")
	view.close_session_workspace()
	view.open_topic(2)
	await click(view.focus_button)
	await settle()
	var radio = view.radio_inspector
	await shoot("radio-live", "race")
	if not radio.older.disabled:
		await scroll_to(radio.older)
		check(reachable(radio.older), "G13 native scrolling reaches Older")
		await click(radio.older)
		var frozen = radio.frozen.duplicate(true)
		var focus = root.gui_get_focus_owner()
		for i in range(8):
			view.refresh()
		check(
			radio.history_mode and frozen == radio.frozen and root.gui_get_focus_owner() == focus,
			"G13 history and focus survive refresh " + suffix
		)
		await shoot("radio-history", "race")
	check(
		signature == race_fingerprint(),
		(
			"G16 all analytical navigation and native chart inputs preserve race, commands, pause and RNG "
			+ suffix
		)
	)
	for state in ["service", "rejoined"]:
		await restore_state(state)
		await open_box()
		await click(view.focus_button)
		await settle()
		header_and_drivers(state + suffix)
		for id in [3, 6]:
			check(
				reachable(view.team_panel.cancel_stop_buttons[id]),
				"G11 service cancellation remains reachable (disabled after entry) " + suffix
			)
		await shoot("pit-" + state, state)
	await restore_state("weather")
	view.open_weather(3)
	await click(view.focus_button)
	await settle()
	check(
		reachable(view.weather_panel.box) and reachable(view.weather_panel.hold),
		"G07 weather action footer remains visible " + suffix
	)
	check(
		view.weather_panel.advice.outlook.observed.mean > 0,
		"G07 weather capture has physically observed water"
	)
	check(
		(
			view.weather_panel.outlook_chart.mode == "cases"
			and view.weather_panel.outlook_chart.categories == ["Now", "Drier", "Trend", "Wetter"]
		),
		"G07 independent cases are not a future trace"
	)
	await shoot("weather", "weather")
	view.close_session_workspace()
	view.open_topic(5)
	await click(view.focus_button)
	await settle()
	await shoot("surface", "weather")
	view.close_session_workspace()
	view.open_topic(view.recovery_page_index)
	await settle()
	check(
		(
			reachable(view.recovery_panel.protect_button)
			and reachable(view.recovery_panel.retire_button)
		),
		"G16 recovery choices stay outside long rules " + suffix
	)
	await shoot("recovery", "weather")
	for state in ["qualifying-results", "results"]:
		await restore_state(state)
		view.open_results_workspace()
		await settle()
		for page in range(4):
			await click(view.results_workspace.buttons[page])
			await settle()
			check(
				reachable(view.results_workspace.next_button),
				"G14 Next remains separate from long result evidence " + suffix
			)
			if page == 1:
				check(
					view.results_workspace.laps.series.size() > 0,
					"G14 result lap chart is populated by actual session laps"
				)
				await click(view.results_workspace.compare)
			if state == "results" and page == 2:
				var results = view.results_workspace
				check(
					results.pit_visits.size() >= 2,
					"G14 result retains both drivers' correlated physical pit visits"
				)
				await scroll_to(results.pit_visit_selector)
				var before = race_fingerprint()
				await choose(results.pit_visit_selector, mini(1, results.pit_visits.size() - 1))
				check(
					(
						results.pit_visit_detail.text.contains("MEASURED VISIT")
						and before == race_fingerprint()
					),
					"G14 native visit selection reports recorded evidence without a command"
				)
			await shoot(state + "-" + str(page), state)
	Storage.write_json(
		"res://reports/ui-finish-populated-progress.json",
		{"inspected": inspected, "checks": checks, "errors": failures}
	)


func primary_profile(profile: Array) -> void:
	# Complete the cross-product of supported text preferences on primary tasks,
	# plus both wide profiles, using the same physically generated source states.
	root.size = Vector2i(profile[0], profile[1])
	root.content_scale_size = root.size
	app.settings.pitwall_text_scale = profile[2]
	var tag = "matrix-%d-" % roundi(profile[2] * 100)
	await restore_state("race")
	view.close_detail()
	await settle()
	header_and_drivers(tag + str(profile))
	var before = race_fingerprint()
	for id in [3, 6]:
		check(
			reachable(view.decision_controls[id].box),
			"G16 both native pit actions fit " + tag + str(profile)
		)
	await shoot(tag + "race", "race")
	await click(view.car_cards[3].name_label)
	await settle()
	await click(view.decision_drawer.box)
	check(
		view.decision_drawer.stage == "CONFIRM" and before == race_fingerprint(),
		"G16 native staging is still observation at " + tag + str(profile)
	)
	check(
		reachable(view.decision_drawer.box) and reachable(view.decision_drawer.cancel),
		"G16 Confirm and Back remain outside scrolling at " + tag + str(profile)
	)
	await shoot(tag + "confirmation", "race")
	view.close_detail()
	view.open_strategy(3)
	await click(view.focus_button)
	await settle()
	header_and_drivers(tag + "strategy")
	check(
		reachable(view.strategy_desk.box_now),
		"G16 strategy action stays fixed " + tag + str(profile)
	)
	await shoot(tag + "strategy", "race")
	check(
		before == race_fingerprint(),
		"G16 cross-profile review cannot issue a command " + tag + str(profile)
	)
	await restore_state("practice-results")
	view.open_practice_workspace()
	await settle()
	for id in [3, 6]:
		check(
			reachable(view.practice_workspace.panels[id].summary),
			"G16 both populated practice summaries fit " + tag + str(profile)
		)
	check(
		reachable(view.practice_workspace.finish),
		"G16 practice continuation stays fixed " + tag + str(profile)
	)
	await shoot(tag + "practice", "practice-results")
	await restore_state("results")
	view.open_results_workspace()
	await click(view.results_workspace.buttons[1])
	await settle()
	var chart = view.results_workspace.laps
	chart.grab_focus()
	await key(KEY_HOME)
	var at = chart.cursor
	before = race_fingerprint()
	root.size = Vector2i(maxi(1100, profile[0] - 40), maxi(720, profile[1] - 40))
	root.content_scale_size = root.size
	await settle(8)
	root.size = Vector2i(profile[0], profile[1])
	root.content_scale_size = root.size
	await settle(8)
	check(
		root.gui_get_focus_owner() == chart and chart.cursor == at,
		"G16 live resize preserves chart focus and selected evidence " + tag + str(profile)
	)
	check(
		reachable(chart) and reachable(view.results_workspace.next_button),
		"G16 populated result chart and fixed Next fit " + tag + str(profile)
	)
	check(
		before == race_fingerprint(),
		"G16 resizing focused results leaves the original race unchanged " + tag + str(profile)
	)
	await shoot(tag + "results", "results")


func run() -> void:
	root.size = Vector2i(1440, 900)
	root.content_scale_size = root.size
	game = load("res://scenes/main.tscn").instantiate()
	root.add_child(game)
	app = root.get_node("App")
	await settle()
	app.settings.pitwall_text_scale = 1.0
	await generate_lineage()
	Storage.write_json("res://reports/physical-provenance.json", provenance)
	for profile in [[1440, 900, 1.0], [1280, 800, 1.15], [1100, 720, 1.3]]:
		await render_profile(profile)
	root.size = Vector2i(1920, 1080)
	root.content_scale_size = root.size
	app.settings.pitwall_text_scale = 1.0
	await restore_state("race")
	view.close_detail()
	await settle()
	header_and_drivers("wide")
	await shoot("race", "race")
	for profile in [
		[1440, 900, 1.15],
		[1440, 900, 1.3],
		[1280, 800, 1.0],
		[1280, 800, 1.3],
		[1100, 720, 1.0],
		[1100, 720, 1.15],
		[1920, 1080, 1.0],
		[1920, 1080, 1.3]
	]:
		await primary_profile(profile)
	var report = {
		"passed": failures.is_empty(),
		"checks": checks,
		"errors": failures,
		"captures": captures,
		"screenshots": captures.size(),
		"physical_states": provenance,
		"inspected": inspected,
		"engine": Engine.get_version_info().string
	}
	Storage.write_json("res://reports/ui-finish-populated.json", report)
	print("UI_FINISH_POPULATED ", JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)


func practice_profile(suffix: String) -> void:
	for state in ["practice-progress", "practice-results"]:
		await restore_state(state)
		view.open_practice_workspace()
		await settle()
		header_and_drivers(state + suffix)
		for id in [3, 6]:
			var panel = view.practice_workspace.panels[id]
			check(
				(
					reachable(panel.run)
					if state == "practice-progress"
					else reachable(view.practice_workspace.finish)
				),
				"G05 fixed programme/next actions remain accessible: " + suffix
			)
			check(
				panel.evidence.text.contains("Measured"),
				"G05 populated summary reflects real measurements"
			)
			if state == "practice-results":
				check(
					(
						panel.forecast_text.text.contains("SESSION COMPLETE")
						and not panel.forecast_text.text.contains("session remaining")
					),
					"G05 completed session cannot show a fresh future run budget"
				)
				check(
					(
						panel
						. objective_buttons[model.practice_driver(id).runs.back().objective]
						. text
						. contains("Latest")
					),
					"G05 sealed result highlights the recorded programme, not a new default draft"
				)
		await shoot(state, state)
