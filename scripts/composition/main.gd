extends Control
var presentation_services: RacePresentationServices
## Native scene shell. Screen changes never reset a live weekend implicitly.
var launch_draft: WeekendLaunch = WeekendLaunch.new()
var replay_controller: ReplayController
var content: VBoxContainer
var global_header: HBoxContainer
var location_label: Label
var version_label: Label
var screen_name = "menu"
var editor: TrackEditor
var library_canvas: TrackCanvas
var selected_track: Dictionary
var config = {"laps": 24, "qual_duration": 480, "scenario": "dry", "intensity": "standard", "seed": 7314, "tactical_duels": true}
var vehicle = "Formula"
var editor_draft: Dictionary = {}
var draft_signature = ""
var return_editor_button: Button

func _ready() -> void:
	launch_draft = WeekendLaunch.new(App.content_catalog)
	presentation_services = LocalRacePresentationServices.new(App)
	theme = UI.theme()
	get_tree().auto_accept_quit = false
	var margin = MarginContainer.new(); add_child(margin); margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for side in ["left", "right", "top", "bottom"]: margin.add_theme_constant_override("margin_" + side, 10)
	var shell = UI.vbox(margin, true); shell.add_theme_constant_override("separation", 6)
	var header = UI.hbox(shell); global_header = header
	header.add_child(UI.label("MM /", 14, UI.ACCENT))
	header.add_child(UI.label("MOTORSPORT MANAGER", 14, UI.ACCENT))
	location_label = UI.label("MAIN MENU", 12, UI.MUTED); header.add_child(location_label)
	var spacer = Control.new(); spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL; header.add_child(spacer)
	version_label = UI.label("NATIVE GODOT  ·  " + str(ProjectSettings.get_setting("application/config/version", "development")), 12, UI.MUTED)
	header.add_child(version_label)
	return_editor_button = UI.button("Return to editor", func():
		if not _leave_settings(show_editor): show_editor())
	header.add_child(return_editor_button)
	header.add_child(UI.button("How to play", show_help))
	header.add_child(UI.button("Main menu", go_home))
	content = UI.vbox(shell, true)
	replay_controller = ReplayController.new(); replay_controller.configure(self); add_child(replay_controller)
	get_viewport().size_changed.connect(_scale_header)
	show_menu()
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--standalone-smoke="):
			var probe = load("res://scripts/composition/standalone_smoke.gd").new()
			add_child(probe)
			probe.start(self, arg.get_slice("=", 1))

func clear_screen(name: String) -> void:
	_scale_header()
	App.stop_session()
	App.editor_session = null
	global_header.visible = name != "weekend"
	if screen_name == "weekend" and App.weekend != null:
		App.weekend.paused = App.weekend.phase in RaceSim.ACTIVE
		var error = App.save_weekend()
		if not error.is_empty(): UI.notify(self, "Checkpoint warning", error)
	return_editor_button.visible = not editor_draft.is_empty() and name != "track_editor"
	editor = null; screen_name = name; location_label.text = name.replace("_", " ").to_upper(); UI.clear(content)

func show_menu() -> void:
	clear_screen("main_menu")
	var menu = MainMenuView.new()
	var geometry = TrackGeometry.new(App.library[mini(7, App.library.size() - 1)]) if not App.library.is_empty() else null
	menu.configure({"can_continue": App.weekend != null or App.has_saved_weekend(), "can_resume_sandbox": App.has_saved_sandbox(), "warnings": "; ".join(App.load_errors) + App.content_warnings()}, App.settings, geometry)
	var actions = {"weekend": show_library, "continue": continue_weekend, "editor": show_editor, "settings": show_settings, "quit": request_quit}
	menu.action_requested.connect(func(action): actions[action].call())
	menu.scenario_requested.connect(func(index):
		[show_strategy_scenarios, show_weather_scenarios, show_recovery_scenarios, show_practice_scenarios, show_rival_scenarios, show_duel_scenarios][index].call())
	menu.replay_requested.connect(func(index, invoker):
		if index == 0: replay_controller.import_record()
		elif index == 1: replay_controller.resume_sandbox()
		else: NotebookWindow.open(self, null, CircuitNotebook.PATH, invoker))
	content.add_child(menu)

func go_home() -> void:
	if screen_name == "weekend" and content.get_child_count() > 0 and content.get_child(0).has_method("confirm_leave"):
		content.get_child(0).confirm_leave(_go_home_saved); return
	_go_home_saved()

func _go_home_saved() -> void:
	if _leave_settings(show_menu): return
	if editor:
		editor.confirm_discard(func(): editor_draft.clear(); draft_signature = ""; show_menu()); return
	if App.weekend != null and screen_name == "weekend":
		App.weekend.paused = App.weekend.phase in RaceSim.ACTIVE
		var error = App.save_weekend()
		if not error.is_empty(): UI.notify(self, "Could not save weekend", error + " You are still at the pitwall."); return
	show_menu()

func show_editor(d: Dictionary = {}) -> void:
	clear_screen("track_editor")
	editor = TrackEditor.new(); editor.presentation_services = presentation_services
	var editor_port = LocalTrackEditorPort.new(func(): return App.library, App.save_track)
	if not d.is_empty(): editor.configure(d, editor_port, App.settings)
	elif not editor_draft.is_empty():
		editor.configure(editor_draft, editor_port, App.settings)
		editor.saved_signature = draft_signature
	else: editor.configure(App.library[mini(7, App.library.size() - 1)] if not App.library.is_empty() else TrackEditorSession.blank_document(), editor_port, App.settings)
	editor.session.content_catalog = App.content_catalog
	content.add_child(editor)
	App.editor_session = editor.session
	editor.test_requested.connect(func(track):
		# Keep the unsaved editor draft while its separate snapshot is test-driven.
		editor_draft = track.duplicate(true); draft_signature = editor.saved_signature; vehicle = editor.vehicle
		show_library(track))

func show_library(test_track: Dictionary = {}) -> void:
	clear_screen("grand_prix_setup")
	launch_draft = WeekendLaunch.new(App.content_catalog)
	if App.content_catalog == null:
		content.add_child(UI.paragraph("New weekends are unavailable until the content errors are fixed. " + App.content_warnings()))
		return
	App.load_library()
	var candidates = App.library.duplicate()
	if not test_track.is_empty(): candidates.push_front(test_track)
	if candidates.is_empty():
		content.add_child(UI.label("No circuits available", 28))
		content.add_child(UI.paragraph("Create a circuit in the editor, save it to your library, then return here."))
		var create = UI.button("Create a circuit", func(): show_editor(), true)
		content.add_child(create); PitwallDesign.focus_later(create)
		return
	var selected_index = 0
	if test_track.is_empty() and selected_track != null:
		for index in range(candidates.size()):
			if candidates[index].id == selected_track.get("id", ""): selected_index = index
	selected_track = candidates[selected_index]
	content.add_child(UI.label("Choose your Grand Prix", 30))
	content.add_child(UI.paragraph("Practice → Qualifying → Race. Keep the same screen and controls throughout; start the next session when ready."))
	var body = UI.hbox(content, true)
	var side = UI.panel(); side.custom_minimum_size.x = 295; body.add_child(side)
	var left = UI.vbox(side, true); left.add_child(UI.label("TRACK LIBRARY", 14, UI.ACCENT))
	var list = ItemList.new(); list.size_flags_vertical = Control.SIZE_EXPAND_FILL; list.add_theme_constant_override("v_separation", 13); left.add_child(list)
	for track in candidates: list.add_item(track.name + (" [custom]" if not track.get("builtin", false) else ""))
	list.select(selected_index)
	var preview = UI.vbox(body, true)
	var details = UI.label("", 17, UI.ACCENT); details.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART; preview.add_child(details)
	library_canvas = TrackCanvas.new(); library_canvas.configure_presentation(App.settings); library_canvas.show_line = true; preview.add_child(library_canvas)
	var refresh = func():
		var geometry = TrackGeometry.new(selected_track, vehicle, false, App.content_catalog.vehicle(vehicle if "." in vehicle else "core.vehicle." + vehicle.to_lower()))
		library_canvas.set_track(geometry); library_canvas.call_deferred("fit")
		details.text = "%s  ·  %.3f km  ·  %s reference %s" % [selected_track.name, geometry.length / 1000, vehicle, RaceSim.format_time(geometry.estimate)]
	list.item_selected.connect(func(index): selected_track = candidates[index]; refresh.call())
	left.add_child(UI.button("Edit selected circuit", func(): show_editor(selected_track)))
	left.add_child(UI.paragraph("Edited tracks saved in Circuit Atelier appear here. Race sessions use their own compiled copy, so editing cannot change a running weekend."))
	var setup_panel = UI.panel(); content.add_child(setup_panel)
	var controls = HFlowContainer.new(); setup_panel.add_child(controls)
	var roster_rows = App.content_catalog.entries("roster")
	if roster_rows.size() > 1:
		var roster_ids = roster_rows.map(func(row): return row.id)
		controls.add_child(UI.label("FIELD", 12, UI.MUTED))
		controls.add_child(UI.option(roster_rows.map(func(row): return row.name), func(index): config.roster_id = roster_ids[index]; refresh.call(), maxi(0, roster_ids.find(config.get("roster_id", "core.roster.default")))))
	var allocation_rows = App.content_catalog.entries("tyre_allocation")
	var allocation_ids = allocation_rows.map(func(item): return item.id)
	if not allocation_ids.has(config.get("tyre_allocation_id", "core.tyre_allocation.default")): config.tyre_allocation_id = "core.tyre_allocation.default"
	if allocation_rows.size() > 1:
		controls.add_child(UI.label("ALLOCATION", 12, UI.MUTED))
		controls.add_child(UI.option(allocation_rows.map(func(item): return item.name), func(index): config.tyre_allocation_id = allocation_ids[index]; refresh.call(), allocation_ids.find(config.get("tyre_allocation_id", "core.tyre_allocation.default"))))
	var setup_rows = App.content_catalog.entries("setup")
	var setup_ids = setup_rows.map(func(item): return item.id)
	if setup_rows.size() > 1:
		controls.add_child(UI.label("SETUP PROFILE", 12, UI.MUTED))
		controls.add_child(UI.option(setup_rows.map(func(item): return item.name), func(index): config.setup_id = setup_ids[index], maxi(0, setup_ids.find(config.get("setup_id", "core.setup.balanced")))))
	var vehicle_rows = App.content_catalog.entries("vehicle")
	var vehicle_ids = vehicle_rows.map(func(v): return v.id)
	var vehicle_index = vehicle_ids.find(vehicle if "." in vehicle else "core.vehicle." + vehicle.to_lower())
	controls.add_child(UI.label("CAR", 12, UI.MUTED))
	controls.add_child(UI.option(vehicle_rows.map(func(v): return v.name), func(index): vehicle = vehicle_ids[index]; refresh.call(), maxi(0, vehicle_index)))
	if App.settings.get("pitwall_layout", "minimal") == "minimal":
		controls.add_child(UI.label("WEATHER", 12, UI.MUTED))
		controls.add_child(UI.option(["Dry", "Changing skies", "Rain-prone"], func(index): config.scenario = ["dry", "changeable", "wet"][index], ["dry", "changeable", "wet"].find(config.scenario)))
		controls.add_child(UI.label("RACE LAPS", 12, UI.MUTED))
		controls.add_child(UI.spin(config.laps, 1, 100, 1, func(value): config.laps = int(value)))
	else:
		controls.add_child(UI.label("WEATHER", 12, UI.MUTED))
		controls.add_child(UI.option(["Changing skies", "Dry", "Rain-prone"], func(index): config.scenario = ["changeable", "dry", "wet"][index], ["changeable", "dry", "wet"].find(config.scenario)))
		controls.add_child(UI.option(["Seeded weather", "Scripted training / legacy"], func(index): config.weather_mode = WeekendWeather.MODES[index], 0 if config.get("weather_mode", "seeded") == "seeded" else 1))
		controls.add_child(UI.label("LAPS", 12, UI.MUTED))
		var lap_input = UI.spin(config.laps, 1, 100, 1, func(value): config.laps = int(value)); controls.add_child(lap_input)
		controls.add_child(UI.option(["Standard · 24 laps", "Quick · 12 laps", "Custom · uncalibrated"], func(index):
			if index < 2: lap_input.value = [24, 12][index], 0 if config.laps == 24 else (1 if config.laps == 12 else 2)))
		controls.add_child(UI.label("QUAL MIN", 12, UI.MUTED)); controls.add_child(UI.spin(config.qual_duration / 60, 2, 30, 1, func(value): config.qual_duration = value * 60))
		controls.add_child(UI.option(["Standard incidents", "Calm / testing", "Volatile"], func(index): config.intensity = ["standard", "calm", "volatile"][index], ["standard", "calm", "volatile"].find(config.intensity)))
		controls.add_child(UI.label("SEED", 12, UI.MUTED)); controls.add_child(UI.spin(config.seed, 0, 4294967295, 1, func(value): config.seed = int(value)))
	var launch = UI.hbox(content)
	launch.add_child(UI.button("Back", go_home))
	launch.add_child(UI.paragraph("Review your choices before practice starts. Your existing weekend is not replaced here."))
	if App.settings.get("pitwall_layout", "minimal") == "minimal":
		launch.add_child(UI.button("Review weekend", func():
			if not launch_draft.stage(selected_track, config, vehicle):
				UI.notify(self, "Weekend needs attention", launch_draft.last_error); return
			show_welcome(), true))
	else:
		launch.add_child(UI.button("Open weekend briefing", func():
			var start = func():
				if not launch_draft.stage(selected_track, config, vehicle):
					UI.notify(self, "Weekend needs attention", launch_draft.last_error); return
				App.weekend = PracticeRaceSim.new(launch_draft.visual_track(), launch_draft.session_options())
				App.weekend.speed = App.settings.speed
				show_weekend()
			if App.requires_entry_confirmation():
				var dialog = ConfirmationDialog.new(); dialog.title = "Replace current weekend?"; dialog.dialog_text = "This starts a new weekend and replaces the active checkpoint. Cancel to keep the current weekend."
				add_child(dialog); dialog.confirmed.connect(func(): dialog.queue_free(); start.call()); dialog.canceled.connect(dialog.queue_free); dialog.popup_centered(Vector2i(510, 180))
			else: start.call(), true))
	refresh.call()
	PitwallDesign.scale_controls(content, UI.text_scale(self))
	PitwallDesign.focus_later(list)

func show_welcome() -> void:
	clear_screen("weekend_welcome")
	var welcome = WeekendEntryView.new()
	welcome.configure(launch_draft.capture(), launch_draft.visual_track(), float(App.settings.get("pitwall_text_scale", 1.0)))
	welcome.back_requested.connect(func(): show_library())
	welcome.start_requested.connect(func(revision):
		var commit = func():
			var error = App.commit_weekend_entry(launch_draft, revision)
			if not error.is_empty(): welcome.show_error("Practice could not start: " + error); return
			show_weekend()
		if App.requires_entry_confirmation():
			UI.confirm(welcome, "Start a new weekend?", "Starting practice replaces your previous saved weekend. Back or Cancel keeps it unchanged.", "Start practice", commit)
		else: commit.call())
	content.add_child(welcome)

func show_weekend_end() -> void:
	var summary = WeekendSummary.capture(App.weekend)
	if summary.is_empty(): return
	var error = App.save_weekend()
	if not error.is_empty(): UI.notify(self, "Could not save final results", error); return
	clear_screen("weekend_complete")
	var review = WeekendEndView.new()
	review.configure(summary, float(App.settings.get("pitwall_text_scale", 1.0)))
	review.menu_requested.connect(show_menu)
	review.new_weekend_requested.connect(func(): show_library())
	review.track_requested.connect(func(): show_weekend())
	content.add_child(review)

func show_weekend(layout: String = "") -> void:
	clear_screen("weekend")
	var chosen_layout = layout if not layout.is_empty() else App.settings.get("pitwall_layout", "minimal")
	var view
	if (App.weekend is RaceSim and App.weekend.has_mechanic("practice")) and chosen_layout == "minimal": view = MinimalRaceWorkspace.new()
	else:
		view = RaceDirectorWorkspace.new() if (App.weekend is RaceSim and App.weekend.has_mechanic("practice")) else (PitwallWorkspace.new() if (App.weekend is RaceSim and App.weekend.has_mechanic("strategy")) else WeekendView.new())
		if view is RaceDirectorWorkspace: view.director_enabled = chosen_layout != "engineering"
	var binding
	if view is MinimalRaceWorkspace:
		binding = MinimalRaceSession.new(App.weekend)
		view.configure(binding.view, App.settings)
	else:
		view.presentation_services = presentation_services
		binding = RaceViewSession.new(App.weekend)
		view.configure(binding.view)
	if view is PracticeWeekendView or view is MinimalRaceWorkspace: view.recording = App.ensure_recording()
	content.add_child(view)
	App.activate_session(binding.runner, view.recording if view is PracticeWeekendView or view is MinimalRaceWorkspace else null)
	if view is PracticeWeekendView: view.replay_requested.connect(func():
		var error = replay_controller.open_data(view.recording.seal())
		if not error.is_empty(): UI.notify(self, "Replay unavailable", error))
	if view is MinimalRaceWorkspace: view.results_requested.connect(show_weekend_end)
	view.new_weekend_requested.connect(show_library)
	view.menu_requested.connect(go_home)

func continue_weekend() -> void:
	if App.weekend == null:
		var error = App.load_weekend()
		if not error.is_empty(): UI.notify(self, "Could not resume", error); return
	if App.weekend.phase == "results" and App.settings.get("pitwall_layout", "minimal") == "minimal": show_weekend_end()
	else: show_weekend()

func show_settings() -> void:
	clear_screen("settings")
	var settings = SettingsView.new()
	settings.configure(App.settings, ProjectSettings.globalize_path("user://"))
	settings.back_requested.connect(show_menu)
	settings.save_requested.connect(func(draft):
		var previous = App.settings.duplicate(true)
		App.settings = draft.duplicate(true)
		var error = App.save_settings()
		if not error.is_empty(): App.settings = previous; App.apply_settings()
		settings.save_result(error)
		_scale_header())
	content.add_child(settings)

func _scale_header() -> void:
	var factor = float(App.settings.get("pitwall_text_scale", 1.0))
	set_meta("pitwall_text_scale", factor)
	PitwallDesign.scale_controls(global_header, factor)
	version_label.visible = get_viewport_rect().size.x >= 1280 and factor <= 1.15

func _leave_settings(callback: Callable) -> bool:
	if screen_name != "settings" or content.get_child_count() == 0: return false
	var settings = content.get_child(0)
	if settings is SettingsView and settings.has_changes():
		settings.confirm_discard(callback)
		return true
	return false

func _unhandled_key_input(event: InputEvent) -> void:
	if not event.is_action_pressed("ui_cancel") or event.is_echo(): return
	if screen_name == "weekend_welcome": show_library()
	elif screen_name in ["settings", "grand_prix_setup", "weekend_complete"]: go_home()
	else: return
	get_viewport().set_input_as_handled()

func show_help() -> void:
	if App.settings.get("pitwall_layout", "minimal") == "minimal":
		UI.notify(self, "Your first Grand Prix", "1. Start practice. Choose MER or MOR and Send out. Each run measures two laps and returns automatically. End practice when ready.\n\n2. Start qualifying. Send each driver for an out lap, one flying lap and an in lap. Only the flying lap sets a grid time.\n\n3. Start formation, then Start race when the grid is ready.\n\n4. Choose a driver to Push, Calm, change engine mode or Box this lap. Press an active pace button again for Normal. Crew selects real available tyres; no tyre/setup screens are needed. Box in practice or qualifying abandons an unfinished timed lap.\n\n5. Space plays/pauses; 1–5 change speed; F fits the circuit. Menu pauses and saves. Detailed telemetry and strategy tools are not part of this interface.")
		return
	UI.notify(self, "Your first Grand Prix", "1. Grand Prix Weekend: choose a track, vehicle, weather and race length.\n\n2. Start qualifying. Delegated engineers run feasible out/hot/in-lap attempts. Switch delegation off to send cars yourself. Only hot laps set grid times.\n\n3. Prepare the race, select starting tyres, then start the formation lap. Once all cars are on the grid, release the start lights.\n\n4. Manage MER and MOR: pace, engine mode, tyre sets and pit calls. The Tyres tab plans a fresh or used set without fitting it; Send, formation or actual service performs the fit. Schedule a stop on a reachable racing lap. Rain changes the surface gradually. A pit call takes only pit ownership. Use Strategy → Plan for approved windows, Control for domain ownership and temporary overrides, and Debrief for measured consequences.\n\n5. Space pauses. 1–5 change simulation speed. F fits the circuit. Save weekend records an exact checkpoint; Main menu pauses and saves.\n\nTrack editor: select and drag points/handles; double-click inserts a point. World provides illustration presets and layer locks. Preview lap runs a reference dot, not a full tyre simulation. Save to library makes the circuit available for weekends.")

func request_quit() -> void:
	if _leave_settings(_quit_saved): return
	if replay_controller and replay_controller.workspace:
		var active = replay_controller.workspace
		if active.sandbox_view:
			active.sandbox_view.confirm_leave(func():
				var error = active.save_sandbox()
				if not error.is_empty(): UI.notify(self, "Could not save experiment", error); return
				replay_controller.close(); request_quit())
			return
		replay_controller.close()
	if screen_name == "weekend" and content.get_child_count() > 0 and content.get_child(0).has_method("confirm_leave"):
		content.get_child(0).confirm_leave(_quit_saved); return
	_quit_saved()

func _quit_saved() -> void:
	if editor:
		editor.confirm_discard(func(): get_tree().quit()); return
	if App.weekend != null:
		var error = App.save_weekend()
		if not error.is_empty(): UI.notify(self, "Could not save before quitting", error); return
	get_tree().quit()

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST: request_quit()

func show_strategy_scenarios() -> void:
	ScenarioScreens.show_strategy_scenarios(self)

func show_weather_scenarios() -> void:
	ScenarioScreens.show_weather_scenarios(self)

func show_recovery_scenarios() -> void:
	ScenarioScreens.show_recovery_scenarios(self)

func show_practice_scenarios() -> void:
	ScenarioScreens.show_practice_scenarios(self)

func show_rival_scenarios() -> void:
	ScenarioScreens.show_rival_scenarios(self)

func show_duel_scenarios() -> void:
	ScenarioScreens.show_duel_scenarios(self)
