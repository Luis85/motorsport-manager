extends Control
## Native scene shell. Screen changes never reset a live weekend implicitly.
var content: VBoxContainer
var location_label: Label
var screen_name = "menu"
var editor: TrackEditor
var library_canvas: TrackCanvas
var selected_track: Dictionary
var config = {"laps": 12, "qual_duration": 480, "scenario": "changeable", "intensity": "standard", "seed": 7314}
var vehicle = "Formula"
var editor_draft: Dictionary = {}
var draft_signature = ""
var return_editor_button: Button

func _ready() -> void:
	theme = UI.theme()
	get_tree().auto_accept_quit = false
	var margin = MarginContainer.new(); add_child(margin); margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for side in ["left", "right", "top", "bottom"]: margin.add_theme_constant_override("margin_" + side, 16)
	var shell = UI.vbox(margin, true)
	var header = UI.hbox(shell)
	header.add_child(UI.button("MM /", go_home))
	header.add_child(UI.label("MOTORSPORT MANAGER", 16, UI.ACCENT))
	location_label = UI.label("MAIN MENU", 12, UI.MUTED); header.add_child(location_label)
	var spacer = Control.new(); spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL; header.add_child(spacer)
	header.add_child(UI.label("NATIVE GODOT  ·  0.4.0", 12, UI.MUTED))
	return_editor_button = UI.button("Return to editor", func(): show_editor())
	header.add_child(return_editor_button)
	header.add_child(UI.button("How to play", show_help))
	header.add_child(UI.button("Main menu", go_home))
	content = UI.vbox(shell, true)
	show_menu()

func clear_screen(name: String) -> void:
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
	menu.add_child(UI.label("Your circuit.\nYour decisions.", 43))
	menu.add_child(UI.paragraph("Design a circuit. Qualify your drivers. Settle into the pit wall and make the calls. A complete race weekend, rebuilt natively in Godot."))
	var gp = UI.button("GRAND PRIX WEEKEND\nChoose a circuit · Qualify · Race", show_library, true); gp.custom_minimum_size.y = 80; menu.add_child(gp)
	var track_editor_button = UI.button("TRACK EDITOR\nShape the road · Build your track library", func(): show_editor()); track_editor_button.custom_minimum_size.y = 80; menu.add_child(track_editor_button)
	var continue_button = UI.button("CONTINUE WEEKEND\nResume your saved pit wall", continue_weekend); continue_button.custom_minimum_size.y = 72
	continue_button.disabled = App.weekend == null and not FileAccess.file_exists(App.checkpoint_path); menu.add_child(continue_button)
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
	controls.add_child(UI.option(["Changing skies", "Dry", "Wet → drying"], func(index): config.scenario = ["changeable", "dry", "wet"][index], ["changeable", "dry", "wet"].find(config.scenario)))
	controls.add_child(UI.label("LAPS", 12, UI.MUTED)); controls.add_child(UI.spin(config.laps, 1, 100, 1, func(value): config.laps = int(value)))
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
			App.weekend = RaceSim.new(geometry, config)
			App.weekend.speed = App.settings.speed
			show_weekend()
		if App.weekend != null and App.weekend.phase not in ["results", "briefing"]:
			var dialog = ConfirmationDialog.new(); dialog.title = "Replace current weekend?"; dialog.dialog_text = "This starts a new weekend and replaces the active checkpoint. Export the current race log first to retain its history."
			add_child(dialog); dialog.confirmed.connect(func(): dialog.queue_free(); start.call()); dialog.canceled.connect(dialog.queue_free); dialog.popup_centered(Vector2i(510, 180))
		else: start.call(), true))
	refresh.call()

func show_weekend() -> void:
	clear_screen("weekend")
	var view = WeekendView.new(); view.configure(App.weekend); content.add_child(view)
	view.new_weekend_requested.connect(show_library)

func continue_weekend() -> void:
	if App.weekend == null:
		var error = App.load_weekend()
		if not error.is_empty(): UI.notify(self, "Could not resume", error); return
	show_weekend()

func show_settings() -> void:
	clear_screen("settings")
	content.add_child(UI.label("Settings", 32))
	var scroll = ScrollContainer.new(); scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL; scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED; content.add_child(scroll)
	var panel = UI.panel(); panel.custom_minimum_size.x = 640; panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL; scroll.add_child(panel)
	var list = UI.vbox(panel)
	list.add_child(UI.label("DISPLAY", 15, UI.ACCENT))
	list.add_child(UI.check("Fullscreen", App.settings.fullscreen, func(value): App.settings.fullscreen = value))
	list.add_child(UI.check("Vertical synchronization", App.settings.vsync, func(value): App.settings.vsync = value))
	list.add_child(UI.check("Show driver labels by default", App.settings.labels, func(value): App.settings.labels = value))
	list.add_child(UI.check("Show racing line by default", App.settings.racing_line, func(value): App.settings.racing_line = value))
	UI.field(list, "Default simulation speed", UI.option(["1×", "2×", "4×", "8×", "16×"], func(index): App.settings.speed = [1, 2, 4, 8, 16][index], [1, 2, 4, 8, 16].find(App.settings.speed)))
	list.add_child(UI.label("CALM CIRCUIT PRESENTATION", 15, UI.ACCENT))
	UI.field(list, "Scenery detail", UI.option(["Rich illustration", "Simple / fewer trees"], func(index): App.settings.scenery_detail = ["rich", "simple"][index], 0 if App.settings.scenery_detail == "rich" else 1))
	UI.field(list, "Car dot size", UI.option(["Standard", "Large", "Extra large"], func(index): App.settings.dot_scale = [1.0, 1.3, 1.6][index], [1.0, 1.3, 1.6].find(App.settings.dot_scale)))
	list.add_child(UI.check("Reduced motion / direct follow camera", App.settings.reduced_motion, func(value): App.settings.reduced_motion = value))
	list.add_child(UI.paragraph("Scenery and dot size change presentation only, never racing results. Display choices apply when a view is opened."))
	list.add_child(UI.button("Apply and save settings", func():
		var error = App.save_settings()
		UI.notify(self, "Settings", "Settings saved." if error.is_empty() else error), true))
	list.add_child(UI.label("LOCAL DATA", 15, UI.ACCENT))
	list.add_child(UI.paragraph("Track library, settings and the active weekend checkpoint are stored in Godot's user-data directory. Atomic saves retain the previous file as .bak. Bundled circuits are never overwritten."))
	var path = ProjectSettings.globalize_path("user://")
	var path_label = UI.paragraph(path); list.add_child(path_label)
	var actions = UI.hbox(list)
	actions.add_child(UI.button("Copy data path", func(): DisplayServer.clipboard_set(path)))
	actions.add_child(UI.button("Open data folder", func(): OS.shell_open(path)))
	list.add_child(UI.label("ABOUT THIS BUILD", 15, UI.ACCENT))
	list.add_child(UI.paragraph("Godot 4.7.2 · Standard GDScript · Compatibility renderer\nTrack authoring and top-down weekend simulation. No browser, npm, .NET or external plugins are required. Company management is not part of this iteration."))

func show_help() -> void:
	UI.notify(self, "Your first Grand Prix", "1. Grand Prix Weekend: choose a track, vehicle, weather and race length.\n\n2. Start qualifying. Delegated engineers run two out/hot/in-lap attempts. Switch delegation off to send cars yourself. Only hot laps set grid times.\n\n3. Prepare the race, select starting tyres, then start the formation lap. Once all cars are on the grid, release the start lights.\n\n4. Manage MER and MOR: pace, engine mode, tyre sets and pit calls. The Tyres tab plans a fresh or used set without fitting it; Send, formation or actual service performs the fit. Schedule a stop on a reachable racing lap. Rain changes the surface gradually. A pit call turns automatic strategy off.\n\n5. Space pauses. 1–5 change simulation speed. F fits the circuit. Save weekend records an exact checkpoint; Main menu pauses and saves.\n\nTrack editor: select and drag points/handles; double-click inserts a point. World provides illustration presets and layer locks. Preview lap runs a reference dot, not a full tyre simulation. Save to library makes the circuit available for weekends.")

func request_quit() -> void:
	if editor:
		editor.confirm_discard(func(): get_tree().quit()); return
	if App.weekend != null:
		var error = App.save_weekend()
		if not error.is_empty(): UI.notify(self, "Could not save before quitting", error); return
	get_tree().quit()

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST: request_quit()
