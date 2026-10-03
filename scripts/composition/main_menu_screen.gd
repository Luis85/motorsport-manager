class_name MainMenuScreen
extends RefCounted
## Read-only presentation and control composition for its owning view.


static func show_menu(view) -> void:
	view.clear_screen("main_menu")
	var menu = MainMenuView.new()
	var geometry = (
		TrackGeometry.new(App.library[mini(7, App.library.size() - 1)])
		if not App.library.is_empty()
		else null
	)
	menu.configure(
		{
			"can_continue": App.weekend != null or App.has_saved_weekend(),
			"can_continue_campaign":
			not App.campaign_checkpoint.is_empty() or App.has_saved_campaign(),
			"can_resume_sandbox": App.has_saved_sandbox(),
			"warnings": "; ".join(App.load_errors) + App.content_warnings()
		},
		App.settings,
		geometry
	)
	var actions = {
		"weekend": view.show_library,
		"continue": view.continue_weekend,
		"campaign": view.show_campaign,
		"editor": view.show_editor,
		"settings": view.show_settings,
		"quit": view.request_quit
	}
	menu.action_requested.connect(func(action): actions[action].call())
	menu.scenario_requested.connect(
		func(index):
			(
				[
					view.show_strategy_scenarios,
					view.show_weather_scenarios,
					view.show_recovery_scenarios,
					view.show_practice_scenarios,
					view.show_rival_scenarios,
					view.show_duel_scenarios
				][index]
				. call()
			),
	)
	menu.replay_requested.connect(
		func(index, invoker):
			if index == 0:
				view.replay_controller.import_record()
			elif index == 1:
				view.replay_controller.resume_sandbox()
			else:
				NotebookWindow.open(view, null, CircuitNotebook.PATH, invoker),
	)
	view.content.add_child(menu)


static func show_help(view) -> void:
	if App.settings.get("pitwall_layout", "minimal") == "minimal":
		UI.notify(
			view,
			"Your first Grand Prix",
			(
				"1. Start practice. Choose MER or MOR and Send out. Each run measures two laps "
				+ "and returns automatically. End practice when ready.\n\n2. Start qualifying. "
				+ "Send each driver for an out lap, one flying lap and an in lap. Only the flying "
				+ "lap sets a grid time.\n\n3. Start formation, then Start race when the grid is "
				+ "ready.\n\n4. Choose a driver to Push, Calm, change engine mode or Box this lap. "
				+ "Press an active pace button again for Normal. Crew selects real available "
				+ "tyres; no tyre/setup screens are needed. Box in practice or qualifying abandons "
				+ "an unfinished timed lap.\n\n5. Space plays/pauses; 1–5 change speed; F fits the "
				+ "circuit. Menu pauses and saves. Detailed telemetry and strategy tools are not "
				+ "part of this interface."
			)
		)
		return
	UI.notify(
		view,
		"Your first Grand Prix",
		(
			"1. Grand Prix Weekend: choose a track, vehicle, weather and race length.\n\n2. "
			+ "Start qualifying. Delegated engineers run feasible out/hot/in-lap attempts. "
			+ "Switch delegation off to send cars yourself. Only hot laps set grid "
			+ "times.\n\n3. Prepare the race, select starting tyres, then start the formation "
			+ "lap. Once all cars are on the grid, release the start lights.\n\n4. Manage MER "
			+ "and MOR: pace, engine mode, tyre sets and pit calls. The Tyres tab plans a "
			+ "fresh or used set without fitting it; Send, formation or actual service "
			+ "performs the fit. Schedule a stop on a reachable racing lap. Rain changes the "
			+ "surface gradually. A pit call takes only pit ownership. Use Strategy → Plan for "
			+ "approved windows, Control for domain ownership and temporary overrides, and "
			+ "Debrief for measured consequences.\n\n5. Space pauses. 1–5 change simulation "
			+ "speed. F fits the circuit. Save weekend records an exact checkpoint; Main menu "
			+ "pauses and saves.\n\nTrack editor: select and drag points/handles; double-click "
			+ "inserts a point. World provides illustration presets and layer locks. Preview "
			+ "lap runs a reference dot, not a full tyre simulation. Save to library makes the "
			+ "circuit available for weekends."
		)
	)
