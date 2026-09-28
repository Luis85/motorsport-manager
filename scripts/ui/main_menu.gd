class_name MainMenuView
extends HBoxContainer
## Pure navigation surface; never opens storage or starts a session itself.
signal action_requested(action: String)
signal scenario_requested(index: int)
signal replay_requested(index: int, invoker: Control)
var data: Dictionary = {}
var preferences: Dictionary = {}
var geometry: TrackGeometry
var primary_button: Button
var continue_button: Button
var preview: TrackCanvas

func configure(context: Dictionary, options: Dictionary, track: TrackGeometry) -> void:
	data = context.duplicate(true)
	preferences = options.duplicate(true)
	geometry = track

func _ready() -> void:
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	var panel = UI.panel()
	panel.custom_minimum_size.x = 400
	add_child(panel)
	var menu = UI.vbox(panel, true)
	menu.add_child(UI.label("THE RACE STARTS WITH YOU", 12, UI.ACCENT))
	var title = UI.label("Make the next call.", 29)
	title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	menu.add_child(title)
	menu.add_child(UI.paragraph("Choose a circuit, prepare your two drivers, then manage the race. Building your own track is optional."))
	primary_button = _action(menu, "GRAND PRIX WEEKEND\nConfigure · Practice · Qualify · Race", "weekend", true)
	primary_button.custom_minimum_size.y = 58
	continue_button = _action(menu, "CONTINUE WEEKEND\nResume your saved pit wall", "continue")
	continue_button.custom_minimum_size.y = 52
	continue_button.disabled = not data.get("can_continue", false)
	continue_button.tooltip_text = "Resume your checkpoint, including the final classification." if not continue_button.disabled else "No saved weekend yet. Start a Grand Prix to create one."
	if continue_button.disabled:
		menu.add_child(UI.paragraph("No saved weekend yet. Start a Grand Prix above."))
	var editor_button = _action(menu, "TRACK EDITOR\nCreate or edit a circuit", "editor")
	editor_button.custom_minimum_size.y = 52
	if preferences.get("pitwall_layout", "minimal") != "minimal":
		_build_development_menu(menu)
	var utilities = UI.hbox(menu)
	for entry in [["Settings", "settings"], ["Quit", "quit"]]:
		var button = _action(utilities, entry[0], entry[1])
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var spacer = Control.new()
	spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	menu.add_child(spacer)
	menu.add_child(UI.paragraph("LOCAL-FIRST · NO ACCOUNT\nTracks and checkpoints stay on this device."))
	if not str(data.get("warnings", "")).is_empty():
		menu.add_child(UI.paragraph("Library needs attention: " + data.warnings, UI.DANGER))
	var showcase = UI.vbox(self, true)
	showcase.add_child(UI.label("YOUR NEXT WEEKEND", 12, UI.MUTED))
	if geometry:
		preview = TrackCanvas.new()
		preview.configure_presentation(preferences)
		preview.show_line = true
		preview.show_grid = false
		preview.set_track(geometry)
		showcase.add_child(preview)
		preview.call_deferred("fit")
	showcase.add_child(UI.paragraph("01  CONFIGURE   →   02  PRACTICE   →   03  QUALIFY   →   04  RACE", UI.ACCENT))
	showcase.add_child(UI.paragraph("You approve each new session. Play controls time; Send out releases the selected driver."))
	var scale = float(preferences.get("pitwall_text_scale", 1.0))
	set_meta("pitwall_text_scale", scale)
	PitwallDesign.scale_controls(self, scale)
	PitwallDesign.focus_later(continue_button if not continue_button.disabled else primary_button)

func _action(parent: Node, text: String, action: String, primary: bool = false) -> Button:
	var button = UI.button(text, func(): action_requested.emit(action), primary)
	button.custom_minimum_size.y = GameTheme.ACTION_HEIGHT
	parent.add_child(button)
	return button

func _build_development_menu(parent: Node) -> void:
	var scenarios = MenuButton.new()
	scenarios.text = "Scenario challenges"
	scenarios.flat = false
	scenarios.focus_mode = Control.FOCUS_ALL
	parent.add_child(scenarios)
	for title in ["Dry strategy", "Weather", "Recovery", "Practice", "Rival styles", "Strategic duels"]:
		scenarios.get_popup().add_item(title)
	scenarios.get_popup().id_pressed.connect(func(index): scenario_requested.emit(index))
	var replays = MenuButton.new()
	replays.text = "Replays & experiments"
	replays.flat = false
	replays.focus_mode = Control.FOCUS_ALL
	parent.add_child(replays)
	for title in ["Open recording or scenario…", "Resume saved sandbox", "Circuit notebook"]:
		replays.get_popup().add_item(title)
	replays.get_popup().set_item_disabled(1, not data.get("can_resume_sandbox", false))
	replays.get_popup().id_pressed.connect(func(index): replay_requested.emit(index, replays))
