extends Control
## Native scene shell. Screen changes never reset a live weekend implicitly.
var content: VBoxContainer
var global_header: HBoxContainer
var location_label: Label
var version_label: Label
var screen_name = "menu"
var editor: TrackEditor
var library_canvas: TrackCanvas
var selected_track: Dictionary
var config = {"laps": 24, "qual_duration": 480, "scenario": "dry", "intensity": "standard", "seed": 7314}
var vehicle = "Formula"
var editor_draft: Dictionary = {}
var draft_signature = ""
var return_editor_button: Button

func _ready() -> void:
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
	return_editor_button = UI.button("Return to editor", func(): show_editor())
	header.add_child(return_editor_button)
	header.add_child(UI.button("How to play", show_help))
	header.add_child(UI.button("Main menu", go_home))
	content = UI.vbox(shell, true)
	show_menu()

func clear_screen(name: String) -> void:
	global_header.visible = name != "weekend"
	if screen_name == "weekend" and App.weekend != null:
		App.weekend.paused = App.weekend.phase in RaceSim.ACTIVE
		var error = App.save_weekend()
		if not error.is_empty(): UI.notify(self, "Checkpoint warning", error)
	return_editor_button.visible = not editor_draft.is_empty() and name != "track_editor"
	editor = null; screen_name = name; location_label.text = name.replace("_", " ").to_upper(); UI.clear(content)

func show_menu() -> void:
	clear_screen("main_menu")
	var row = UI.hbox(content, true)
	var menu_panel = UI.panel(); menu_panel.custom_minimum_size.x = 440; row.add_child(menu_panel)
	var menu = UI.vbox(menu_panel, true)
	menu.add_child(UI.label("THE RACE STARTS WITH YOU", 12, UI.ACCENT))
	menu.add_child(UI.label("Your circuit.\nYour decisions.", 35))
	menu.add_child(UI.paragraph("Design a circuit. Qualify your drivers. Settle into the pit wall and make the calls. A complete race weekend, rebuilt natively in Godot."))
	var gp = UI.button("GRAND PRIX WEEKEND\nChoose a circuit · Qualify · Race", show_library, true); gp.custom_minimum_size.y = 58; menu.add_child(gp)
	var track_editor_button = UI.button("TRACK EDITOR\nShape the road · Build your track library", func(): show_editor()); track_editor_button.custom_minimum_size.y = 54; menu.add_child(track_editor_button)
	var continue_button = UI.button("CONTINUE WEEKEND\nResume your saved pit wall", continue_weekend); continue_button.custom_minimum_size.y = 52
	continue_button.disabled = App.weekend == null and not FileAccess.file_exists(App.checkpoint_path); menu.add_child(continue_button)
	var scenarios = UI.hbox(menu)
	scenarios.add_child(UI.button("Dry scenarios", show_strategy_scenarios))
	scenarios.add_child(UI.button("Weather", show_weather_scenarios))
	scenarios.add_child(UI.button("Recovery", show_recovery_scenarios))
	menu.add_child(UI.button("SETTINGS", show_settings))
	menu.add_child(UI.button("QUIT", request_quit))
	var spacer = Control.new(); spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL; menu.add_child(spacer)
	menu.add_child(UI.paragraph("LOCAL-FIRST · NO ACCOUNT · NO WEB RUNTIME\nTracks and checkpoints are stored on this device.", UI.MUTED))
	if not App.load_errors.is_empty(): menu.add_child(UI.paragraph("Library warnings: " + "; ".join(App.load_errors), UI.DANGER))
	var showcase = UI.vbox(row, true)
	showcase.add_child(UI.label("FROM CIRCUIT ATELIER TO THE PIT WALL", 12, UI.MUTED))
	if not App.library.is_empty():
		var canvas = TrackCanvas.new(); canvas.show_line = true; canvas.show_grid = false
		canvas.set_track(TrackGeometry.new(App.library[mini(7, App.library.size() - 1)])); showcase.add_child(canvas)
		canvas.call_deferred("fit")
	showcase.add_child(UI.label("01 / AUTHOR     02 / QUALIFY     03 / RACE", 16, UI.ACCENT))
	showcase.add_child(UI.paragraph("Seven geographic layouts plus Pinecrest Motor Park. Every library track is editable and immediately usable for a weekend."))

func go_home() -> void:
	if screen_name == "weekend" and content.get_child_count() > 0 and content.get_child(0) is PitwallWorkspace:
		content.get_child(0).confirm_leave(_go_home_saved); return
	_go_home_saved()

func _go_home_saved() -> void:
	if editor:
		editor.confirm_discard(func(): editor_draft.clear(); draft_signature = ""; show_menu()); return
	if App.weekend != null and screen_name == "weekend":
		App.weekend.paused = App.weekend.phase in RaceSim.ACTIVE
		var error = App.save_weekend()
		if not error.is_empty(): UI.notify(self, "Checkpoint warning", error)
	show_menu()

func show_editor(d: Dictionary = {}) -> void:
	clear_screen("track_editor")
	editor = TrackEditor.new()
	if not d.is_empty(): editor.configure(d)
	elif not editor_draft.is_empty():
		editor.configure(editor_draft)
		editor.saved_signature = draft_signature
	content.add_child(editor)
	editor.test_requested.connect(func(track):
		# Keep the unsaved editor draft while its separate snapshot is test-driven.
		editor_draft = track.duplicate(true); draft_signature = editor.saved_signature; vehicle = editor.vehicle
		show_library(track))

func show_library(test_track: Dictionary = {}) -> void:
	clear_screen("grand_prix_setup")
	App.load_library()
	var candidates = App.library.duplicate()
	if not test_track.is_empty(): candidates.push_front(test_track)
	if candidates.is_empty(): content.add_child(UI.paragraph("No valid circuits are available. Open the track editor to create one.")); return
	selected_track = candidates[0]
	content.add_child(UI.label("Choose your Grand Prix", 30))
	content.add_child(UI.paragraph("A weekend progresses through qualifying, race preparation, formation, start lights and the race. You approve each session transition."))
	var body = UI.hbox(content, true)
	var side = UI.panel(); side.custom_minimum_size.x = 295; body.add_child(side)
	var left = UI.vbox(side, true); left.add_child(UI.label("TRACK LIBRARY", 14, UI.ACCENT))
	var list = ItemList.new(); list.size_flags_vertical = Control.SIZE_EXPAND_FILL; list.add_theme_constant_override("v_separation", 13); left.add_child(list)
	for track in candidates: list.add_item(track.name + (" [custom]" if not track.get("builtin", false) else ""))
	list.select(0)
	var preview = UI.vbox(body, true)
	var details = UI.label("", 17, UI.ACCENT); preview.add_child(details)
	library_canvas = TrackCanvas.new(); library_canvas.show_line = true; preview.add_child(library_canvas)
	var refresh = func():
		var geometry = TrackGeometry.new(selected_track, vehicle)
		library_canvas.set_track(geometry); library_canvas.call_deferred("fit")
		details.text = "%s  ·  %.3f km  ·  %s reference %s" % [selected_track.name, geometry.length / 1000, vehicle, RaceSim.format_time(geometry.estimate)]
	list.item_selected.connect(func(index): selected_track = candidates[index]; refresh.call())
	left.add_child(UI.button("Edit selected circuit", func(): show_editor(selected_track)))
	left.add_child(UI.paragraph("Edited tracks saved in Circuit Atelier appear here. Race sessions use their own compiled copy, so editing cannot change a running weekend."))
	var setup_panel = UI.panel(); content.add_child(setup_panel)
	var controls = HFlowContainer.new(); setup_panel.add_child(controls)
	controls.add_child(UI.label("CAR", 12, UI.MUTED))
	controls.add_child(UI.option(TrackGeometry.PRESETS.keys(), func(index): vehicle = TrackGeometry.PRESETS.keys()[index]; refresh.call(), TrackGeometry.PRESETS.keys().find(vehicle)))
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
	launch.add_child(UI.paragraph("Qualifying is automatically extended when necessary to allow complete out/hot/in laps. Presets are game estimates, not licensed vehicle models."))
	launch.add_child(UI.button("Open weekend briefing", func():
		var start = func():
			var geometry = TrackGeometry.new(selected_track, vehicle)
			var findings = TrackDiagnostics.inspect(geometry)
			if TrackDiagnostics.blocking(findings):
				UI.notify(self, "Circuit needs attention", "The circuit has a blocking crossing. Open it in the editor and review Checks before driving."); return
			App.weekend = RecoveryRaceSim.new(geometry, config)
			App.weekend.speed = App.settings.speed
			show_weekend()
		if App.weekend != null and App.weekend.phase not in ["results", "briefing"]:
			var dialog = ConfirmationDialog.new(); dialog.title = "Replace current weekend?"; dialog.dialog_text = "This starts a new weekend and replaces the active checkpoint. Export the current race log first to retain its history."
			add_child(dialog); dialog.confirmed.connect(func(): dialog.queue_free(); start.call()); dialog.canceled.connect(dialog.queue_free); dialog.popup_centered(Vector2i(510, 180))
		else: start.call(), true))
	refresh.call()

func show_weekend() -> void:
	clear_screen("weekend")
	var view = PitwallWorkspace.new() if App.weekend is StrategyRaceSim else WeekendView.new()
	view.configure(App.weekend); content.add_child(view)
	view.new_weekend_requested.connect(show_library)
	view.menu_requested.connect(go_home)

func continue_weekend() -> void:
	if App.weekend == null:
		var error = App.load_weekend()
		if not error.is_empty(): UI.notify(self, "Could not resume", error); return
	show_weekend()

func show_settings() -> void:
	clear_screen("settings")
	content.add_child(UI.label("Settings", 28))
	content.add_child(UI.paragraph("Changes are staged until Apply. Visual preferences do not change the race model."))
	var draft = App.settings.duplicate(true)
	var columns = UI.hbox(content)
	var left = UI.panel(); left.size_flags_horizontal = Control.SIZE_EXPAND_FILL; columns.add_child(left)
	var list = UI.vbox(left)
	list.add_child(UI.label("DISPLAY & DEFAULTS", 14, UI.ACCENT))
	var text_sample = UI.label("MER · Finish fuel +2.4 laps", 13)
	var text_choice = UI.option(["100%", "115%", "130%"], func(index): draft.pitwall_text_scale = PitwallDesign.TEXT_SCALES[index]; text_sample.add_theme_font_size_override("font_size", roundi(13 * draft.pitwall_text_scale)), PitwallDesign.TEXT_SCALES.find(draft.get("pitwall_text_scale", 1.0)))
	text_choice.tooltip_text = "Native pit-wall text. Circuit labels and track-editor text are unchanged. Applied when reopening the weekend."
	UI.field(list, "Pit-wall text", text_choice); list.add_child(text_sample)
	text_sample.add_theme_font_size_override("font_size", roundi(13 * draft.get("pitwall_text_scale", 1.0)))
	list.add_child(UI.check("Fullscreen", draft.fullscreen, func(value): draft.fullscreen = value))
	list.add_child(UI.check("Vertical synchronization", draft.vsync, func(value): draft.vsync = value))
	list.add_child(UI.check("Show driver labels by default", draft.labels, func(value): draft.labels = value))
	list.add_child(UI.check("Show racing line by default", draft.racing_line, func(value): draft.racing_line = value))
	UI.field(list, "Default simulation speed", UI.option(["1×", "2×", "4×", "8×", "16×"], func(index): draft.speed = [1, 2, 4, 8, 16][index], [1, 2, 4, 8, 16].find(draft.speed)))
	var right = UI.panel(); right.size_flags_horizontal = Control.SIZE_EXPAND_FILL; columns.add_child(right)
	list = UI.vbox(right)
	list.add_child(UI.label("CIRCUIT PRESENTATION", 14, UI.ACCENT))
	UI.field(list, "Scenery detail", UI.option(["Rich illustration", "Simple / fewer trees"], func(index): draft.scenery_detail = ["rich", "simple"][index], 0 if draft.scenery_detail == "rich" else 1))
	UI.field(list, "Car dot size", UI.option(["Standard", "Large", "Extra large"], func(index): draft.dot_scale = [1.0, 1.3, 1.6][index], [1.0, 1.3, 1.6].find(draft.dot_scale)))
	list.add_child(UI.check("Reduced motion / direct follow camera", draft.reduced_motion, func(value): draft.reduced_motion = value))
	list.add_child(UI.paragraph("Presentation choices apply when a view opens. Use Layers on the map for immediate line, label and surface changes. Simple scenery reduces decorative trees; it never changes grip, weather or driving."))
	var data_panel = UI.panel(); content.add_child(data_panel); list = UI.vbox(data_panel)
	list.add_child(UI.label("LOCAL DATA", 14, UI.ACCENT))
	list.add_child(UI.paragraph("Tracks, settings and the active weekend are stored on this device. Atomic saves retain the previous file as .bak. Bundled circuits are never overwritten."))
	var path = ProjectSettings.globalize_path("user://")
	var path_label = UI.paragraph(path); path_label.add_theme_font_size_override("font_size", 12); list.add_child(path_label)
	var data_actions = UI.hbox(list)
	data_actions.add_child(UI.button("Copy data path", func(): DisplayServer.clipboard_set(path)))
	data_actions.add_child(UI.button("Open data folder", func(): OS.shell_open(path)))
	content.add_child(UI.paragraph("Godot 4.7.2 · Native GDScript · Compatibility renderer · No browser or external plugin required."))
	var spacer = Control.new(); spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL; content.add_child(spacer)
	var note = UI.paragraph("Space pauses a live weekend. Enter activates a focused button. Text fields keep normal editing behavior."); content.add_child(note)
	var actions = UI.hbox(content)
	actions.add_child(UI.button("Apply and save settings", func():
		var previous = App.settings.duplicate(true); App.settings = draft.duplicate(true)
		var error = App.save_settings()
		if not error.is_empty(): App.settings = previous; App.apply_settings()
		note.text = "Settings saved. Display defaults apply when you reopen a view." if error.is_empty() else "Settings were not saved: " + error, true))
	actions.add_child(UI.button("Back without applying", show_menu))

func show_help() -> void:
	UI.notify(self, "Your first Grand Prix", "1. Grand Prix Weekend: choose a track, vehicle, weather and race length.\n\n2. Start qualifying. Delegated engineers run feasible out/hot/in-lap attempts. Switch delegation off to send cars yourself. Only hot laps set grid times.\n\n3. Prepare the race, select starting tyres, then start the formation lap. Once all cars are on the grid, release the start lights.\n\n4. Manage MER and MOR: pace, engine mode, tyre sets and pit calls. The Tyres tab plans a fresh or used set without fitting it; Send, formation or actual service performs the fit. Schedule a stop on a reachable racing lap. Rain changes the surface gradually. A pit call takes only pit ownership. Use Strategy → Plan for approved windows, Control for domain ownership and temporary overrides, and Debrief for measured consequences.\n\n5. Space pauses. 1–5 change simulation speed. F fits the circuit. Save weekend records an exact checkpoint; Main menu pauses and saves.\n\nTrack editor: select and drag points/handles; double-click inserts a point. World provides illustration presets and layer locks. Preview lap runs a reference dot, not a full tyre simulation. Save to library makes the circuit available for weekends.")

func request_quit() -> void:
	if screen_name == "weekend" and content.get_child_count() > 0 and content.get_child(0) is PitwallWorkspace:
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
	clear_screen("strategy_scenarios")
	content.add_child(UI.label("Strategy, not scripted victories", 30))
	content.add_child(UI.paragraph("Dry calibration scenarios begin at briefing with disclosed approved plans. You can change them. All twelve cars retain normal resources and rules; calm incident mode is disclosed, not a hidden advantage."))
	var entries = GridContainer.new(); entries.columns = 2; entries.size_flags_vertical = Control.SIZE_EXPAND_FILL; content.add_child(entries)
	for recipe in WeekendScenarios.catalog():
		if not WeekendScenarios.valid(recipe): continue
		var panel = UI.panel(); panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL; panel.size_flags_vertical = Control.SIZE_EXPAND_FILL; entries.add_child(panel); var body = UI.vbox(panel)
		body.add_child(UI.label(recipe.title, 20, UI.ACCENT))
		body.add_child(UI.paragraph(recipe.objective + "\n" + recipe.hint))
		var spacer = Control.new(); spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL; body.add_child(spacer)
		body.add_child(UI.button("Open %d-lap scenario · seed %d" % [recipe.laps, recipe.seed], func():
			var start = func():
				var candidate = WeekendScenarios.build(recipe, App.library)
				if candidate == null: UI.notify(self, "Scenario unavailable", "The scenario, track or initial plan is invalid."); return
				App.weekend = candidate; App.weekend.speed = App.settings.speed; show_weekend()
			if App.weekend != null and App.weekend.phase not in ["results", "briefing"]:
				var confirm = ConfirmationDialog.new(); confirm.title = "Replace the active weekend?"; confirm.dialog_text = "A scenario starts a new weekend. Export the current evidence before replacing it."
				add_child(confirm); confirm.confirmed.connect(func(): confirm.queue_free(); start.call()); confirm.canceled.connect(confirm.queue_free); confirm.popup_centered()
			else: start.call(), true))

func show_weather_scenarios() -> void:
	clear_screen("weather_scenarios")
	content.add_child(UI.label("Forecast, choose, watch the road", 30))
	content.add_child(UI.paragraph("Seeded conditions use observed-only forecasts. Training explicitly preserves the original schedule. Neither version forces results. All scenarios retain qualifying and start approvals."))
	var entries = GridContainer.new(); entries.columns = 2; entries.size_flags_horizontal = Control.SIZE_EXPAND_FILL; content.add_child(entries)
	for recipe in WeatherScenarios.catalog():
		if not WeatherScenarios.valid(recipe): continue
		var panel = UI.panel(); panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL; entries.add_child(panel); var body = UI.vbox(panel)
		body.add_child(UI.label(recipe.title, 20, UI.ACCENT))
		body.add_child(UI.paragraph(recipe.objective + "\n" + recipe.hint))
		body.add_child(UI.button("Open %d laps · %s · seed %d" % [recipe.laps, recipe.weather_mode, recipe.seed], func():
			var start = func():
				var candidate = WeatherScenarios.build(recipe, App.library)
				if candidate == null: UI.notify(self, "Scenario unavailable", "The weather scenario or track is invalid."); return
				App.weekend = candidate; App.weekend.speed = App.settings.speed; show_weekend()
			if App.weekend != null and App.weekend.phase not in ["briefing", "results"]:
				var confirm = ConfirmationDialog.new(); confirm.title = "Replace active weekend?"; confirm.dialog_text = "This creates a new weekend. Export existing evidence before replacing it."
				add_child(confirm); confirm.confirmed.connect(func(): confirm.queue_free(); start.call()); confirm.canceled.connect(confirm.queue_free); confirm.popup_centered()
			else: start.call(), true))

func show_recovery_scenarios() -> void:
	clear_screen("recovery_scenarios")
	content.add_child(UI.label("Protect the result, or pay for a repair", 30))
	content.add_child(UI.paragraph("Disclosed scalar condition, ordinary physical racing and no guaranteed outcome. Both scenarios start at briefing; qualifying, preparation and start approvals remain yours."))
	var scroll = ScrollContainer.new(); scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL; scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED; content.add_child(scroll)
	var entries = UI.vbox(scroll, true)
	for recipe in RecoveryScenarios.catalog():
		if not RecoveryScenarios.valid(recipe): continue
		var panel = UI.panel(); entries.add_child(panel); var body = UI.vbox(panel)
		body.add_child(UI.label(recipe.title, 20, UI.ACCENT)); body.add_child(UI.paragraph(recipe.objective + "\n" + recipe.hint))
		body.add_child(UI.button("Open %d laps · seed %d" % [recipe.laps, recipe.seed], func():
			var start = func():
				var candidate = RecoveryScenarios.build(recipe, App.library)
				if candidate == null: UI.notify(self, "Scenario unavailable", "The recovery scenario or track is invalid."); return
				App.weekend = candidate; App.weekend.speed = App.settings.speed; show_weekend()
			if App.weekend != null and App.weekend.phase not in ["briefing", "results"]:
				var confirm = ConfirmationDialog.new(); confirm.title = "Replace active weekend?"; confirm.dialog_text = "This starts a new weekend. Export current evidence before replacing it."
				add_child(confirm); confirm.confirmed.connect(func(): confirm.queue_free(); start.call()); confirm.canceled.connect(confirm.queue_free); confirm.popup_centered()
			else: start.call(), true))
