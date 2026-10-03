extends Control
var presentation_services: RacePresentationServices
## Native scene shell. Screen changes never reset a live weekend implicitly.
var launch_draft: WeekendLaunch = WeekendLaunch.new()
var replay_controller: ReplayController
var campaign_screens: CampaignScreens
var content: VBoxContainer
var global_header: HBoxContainer
var location_label: Label
var version_label: Label
var screen_name = "menu"
var editor: TrackEditor
var library_canvas: TrackCanvas
var selected_track: Dictionary
var config = {
	"laps": 24,
	"qual_duration": 480,
	"scenario": "dry",
	"intensity": "standard",
	"seed": 7314,
	"tactical_duels": true
}
var vehicle = "Formula"
var editor_draft: Dictionary = {}
var draft_signature = ""
var return_editor_button: Button


func _ready() -> void:
	launch_draft = WeekendLaunch.new(App.content_catalog)
	presentation_services = LocalRacePresentationServices.new(App)
	theme = UI.theme()
	get_tree().auto_accept_quit = false
	var margin = MarginContainer.new()
	add_child(margin)
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for side in ["left", "right", "top", "bottom"]:
		margin.add_theme_constant_override("margin_" + side, 10)
	var shell = UI.vbox(margin, true)
	shell.add_theme_constant_override("separation", 6)
	var header = UI.hbox(shell)
	global_header = header
	header.add_child(UI.label("MM /", 14, UI.ACCENT))
	header.add_child(UI.label("MOTORSPORT MANAGER", 14, UI.ACCENT))
	location_label = UI.label("MAIN MENU", 12, UI.MUTED)
	header.add_child(location_label)
	var spacer = Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(spacer)
	version_label = UI.label(
		(
			"NATIVE GODOT  ·  "
			+ str(ProjectSettings.get_setting("application/config/version", "development"))
		),
		12,
		UI.MUTED
	)
	header.add_child(version_label)
	return_editor_button = UI.button(
		"Return to editor",
		func():
			if not _leave_settings(show_editor):
				show_editor()
	)
	header.add_child(return_editor_button)
	header.add_child(UI.button("How to play", show_help))
	header.add_child(UI.button("Main menu", go_home))
	content = UI.vbox(shell, true)
	replay_controller = ReplayController.new()
	replay_controller.configure(self)
	add_child(replay_controller)
	campaign_screens = CampaignScreens.new(self)
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
	if screen_name == "weekend" and name != "weekend" and App.weekend != null:
		App.weekend.paused = App.weekend.phase in RaceSim.ACTIVE
		var error = App.save_weekend()
		if not error.is_empty():
			UI.notify(self, "Checkpoint warning", error)
	return_editor_button.visible = not editor_draft.is_empty() and name != "track_editor"
	editor = null
	screen_name = name
	location_label.text = name.replace("_", " ").to_upper()
	UI.clear(content)


func show_menu() -> void:
	MainMenuScreen.show_menu(self)


func go_home() -> void:
	if (
		screen_name == "weekend"
		and content.get_child_count() > 0
		and content.get_child(0).has_method("confirm_leave")
	):
		content.get_child(0).confirm_leave(_go_home_saved)
		return
	_go_home_saved()


func _go_home_saved() -> void:
	if _leave_settings(show_menu):
		return
	if editor:
		editor.confirm_discard(
			func():
				editor_draft.clear()
				draft_signature = ""
				show_menu()
		)
		return
	if App.weekend != null and screen_name == "weekend":
		App.weekend.paused = App.weekend.phase in RaceSim.ACTIVE
		var error = App.save_weekend()
		if not error.is_empty():
			UI.notify(self, "Could not save weekend", error + " You are still at the pitwall.")
			return
	show_menu()


func show_campaign() -> void:
	campaign_screens.show_campaign()


func show_editor(d: Dictionary = {}) -> void:
	clear_screen("track_editor")
	editor = TrackEditor.new()
	editor.presentation_services = presentation_services
	var editor_port = LocalTrackEditorPort.new(func(): return App.library, App.save_track)
	if not d.is_empty():
		editor.configure(d, editor_port, App.settings)
	elif not editor_draft.is_empty():
		editor.configure(editor_draft, editor_port, App.settings)
		editor.saved_signature = draft_signature
	else:
		editor.configure(
			(
				App.library[mini(7, App.library.size() - 1)]
				if not App.library.is_empty()
				else TrackEditorSession.blank_document()
			),
			editor_port,
			App.settings
		)
	editor.session.content_catalog = App.content_catalog
	content.add_child(editor)
	App.editor_session = editor.session
	editor.test_requested.connect(
		func(track):
			# Keep the unsaved editor draft while its separate snapshot is test-driven.
			editor_draft = track.duplicate(true)
			draft_signature = editor.saved_signature
			vehicle = editor.vehicle
			show_library(track)
	)


func show_library(test_track: Dictionary = {}) -> void:
	WeekendLibraryScreen.show_library(self, test_track)


func show_welcome() -> void:
	clear_screen("weekend_welcome")
	var welcome = WeekendEntryView.new()
	welcome.configure(
		launch_draft.capture(),
		launch_draft.visual_track(),
		float(App.settings.get("pitwall_text_scale", 1.0))
	)
	welcome.back_requested.connect(func(): show_library())
	welcome.start_requested.connect(
		func(revision):
			var commit = func():
				var error = App.commit_weekend_entry(launch_draft, revision)
				if not error.is_empty():
					welcome.show_error("Practice could not start: " + error)
					return
				show_weekend()
			if App.requires_entry_confirmation():
				(
					UI
					. confirm(
						welcome,
						"Start a new weekend?",
						(
							"Starting practice replaces your previous saved weekend. Back or Cancel keeps it "
							+ "unchanged."
						),
						"Start practice",
						commit
					)
				)
			else:
				commit.call()
	)
	content.add_child(welcome)


func show_weekend_end() -> void:
	if campaign_screens._settle_campaign_weekend():
		return
	var summary = WeekendSummary.capture(App.weekend)
	if summary.is_empty():
		return
	var error = App.save_weekend()
	if not error.is_empty():
		UI.notify(self, "Could not save final results", error)
		return
	clear_screen("weekend_complete")
	var review = WeekendEndView.new()
	review.configure(summary, float(App.settings.get("pitwall_text_scale", 1.0)))
	review.menu_requested.connect(show_menu)
	review.new_weekend_requested.connect(func(): show_library())
	review.track_requested.connect(func(): show_weekend())
	content.add_child(review)


func show_weekend(layout: String = "") -> void:
	clear_screen("weekend")
	var chosen_layout = (
		layout if not layout.is_empty() else App.settings.get("pitwall_layout", "minimal")
	)
	var view
	if (
		(App.weekend is RaceSim and App.weekend.has_mechanic("practice"))
		and chosen_layout == "minimal"
	):
		view = MinimalRaceWorkspace.new()
	else:
		view = (
			RaceDirectorWorkspace.new()
			if (App.weekend is RaceSim and App.weekend.has_mechanic("practice"))
			else (
				PitwallWorkspace.new()
				if (App.weekend is RaceSim and App.weekend.has_mechanic("strategy"))
				else WeekendView.new()
			)
		)
		if view is RaceDirectorWorkspace:
			view.director_enabled = chosen_layout != "engineering"
	var binding
	if view is MinimalRaceWorkspace:
		binding = MinimalRaceSession.new(App.weekend)
		view.configure(binding.view, App.settings)
	else:
		view.presentation_services = presentation_services
		binding = RaceViewSession.new(App.weekend)
		view.configure(binding.view)
	if view is PracticeWeekendView or view is MinimalRaceWorkspace:
		view.recording = App.ensure_recording()
	content.add_child(view)
	App.activate_session(
		binding.runner,
		view.recording if view is PracticeWeekendView or view is MinimalRaceWorkspace else null
	)
	if view is PracticeWeekendView:
		view.replay_requested.connect(
			func():
				var error = replay_controller.open_data(view.recording.seal())
				if not error.is_empty():
					UI.notify(self, "Replay unavailable", error)
		)
	if view is MinimalRaceWorkspace:
		view.results_requested.connect(show_weekend_end)
	var campaign_event_active = false
	if not App.campaign_checkpoint.is_empty():
		var campaign = CampaignCheckpoint.restore(App.campaign_checkpoint)
		campaign_event_active = campaign.ok and not campaign.active_manifest.is_empty()
	view.new_weekend_requested.connect(show_campaign if campaign_event_active else show_library)
	view.menu_requested.connect(go_home)


func continue_weekend() -> void:
	if App.campaign_checkpoint.is_empty() and App.has_saved_campaign():
		var campaign_error = App.load_campaign()
		if campaign_error.is_empty():
			var restored = CampaignCheckpoint.restore(App.campaign_checkpoint)
			if restored.ok and not restored.active_manifest.is_empty():
				if App.weekend == null:
					var active_error = App.load_weekend()
					if not active_error.is_empty():
						UI.notify(self, "Could not resume campaign weekend", active_error)
						return
				if App.weekend.phase == "results":
					show_weekend_end()
				else:
					show_weekend("minimal")
				return
	if App.weekend == null:
		var error = App.load_weekend()
		if not error.is_empty():
			UI.notify(self, "Could not resume", error)
			return
	if (
		App.weekend.phase == "results"
		and App.settings.get("pitwall_layout", "minimal") == "minimal"
	):
		show_weekend_end()
	else:
		show_weekend()


func show_settings() -> void:
	clear_screen("settings")
	var settings = SettingsView.new()
	settings.configure(App.settings, ProjectSettings.globalize_path("user://"))
	settings.back_requested.connect(show_menu)
	settings.save_requested.connect(
		func(draft):
			var previous = App.settings.duplicate(true)
			App.settings = draft.duplicate(true)
			var error = App.save_settings()
			if not error.is_empty():
				App.settings = previous
				App.apply_settings()
			settings.save_result(error)
			_scale_header()
	)
	content.add_child(settings)


func _scale_header() -> void:
	var factor = float(App.settings.get("pitwall_text_scale", 1.0))
	set_meta("pitwall_text_scale", factor)
	PitwallDesign.scale_controls(global_header, factor)
	version_label.visible = get_viewport_rect().size.x >= 1280 and factor <= 1.15


func _leave_settings(callback: Callable) -> bool:
	if screen_name != "settings" or content.get_child_count() == 0:
		return false
	var settings = content.get_child(0)
	if settings is SettingsView and settings.has_changes():
		settings.confirm_discard(callback)
		return true
	return false


func _unhandled_key_input(event: InputEvent) -> void:
	if not event.is_action_pressed("ui_cancel") or event.is_echo():
		return
	if screen_name == "weekend_welcome":
		show_library()
	elif screen_name in ["settings", "grand_prix_setup", "weekend_complete", "campaign"]:
		go_home()
	else:
		return
	get_viewport().set_input_as_handled()


func show_help() -> void:
	MainMenuScreen.show_help(self)


func request_quit() -> void:
	if _leave_settings(_quit_saved):
		return
	if replay_controller and replay_controller.workspace:
		var active = replay_controller.workspace
		if active.sandbox_view:
			active.sandbox_view.confirm_leave(
				func():
					var error = active.save_sandbox()
					if not error.is_empty():
						UI.notify(self, "Could not save experiment", error)
						return
					replay_controller.close()
					request_quit()
			)
			return
		replay_controller.close()
	if (
		screen_name == "weekend"
		and content.get_child_count() > 0
		and content.get_child(0).has_method("confirm_leave")
	):
		content.get_child(0).confirm_leave(_quit_saved)
		return
	_quit_saved()


func _quit_saved() -> void:
	if editor:
		editor.confirm_discard(func(): get_tree().quit())
		return
	if App.weekend != null:
		var error = App.save_weekend()
		if not error.is_empty():
			UI.notify(self, "Could not save before quitting", error)
			return
	get_tree().quit()


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST:
		request_quit()


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
