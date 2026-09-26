class_name RaceSessionHeader
extends PanelContainer
## A single constructed session header. Signals carry intent, never mutate a race.
signal action_requested(action: String, payload: Dictionary)
signal utility_requested(id: int)
signal advance_requested
var title_label: Label
var session_label: Label
var clock_label: Label
var flag_label: Label
var weather_label: Label
var context_label: Label
var primary_button: Button
var pause_button: Button
var speed_control: OptionButton
var weekend_menu: MenuButton
var phase_actions: VBoxContainer
var header_context: VBoxContainer
var steps: Array[Label] = []
var model: RaceSim

func configure(value: RaceSim) -> void:
	model = value

func _ready() -> void:
	add_theme_stylebox_override("panel", UI.box(PitwallDesign.RACE_DARK_2, PitwallDesign.RACE_DARK_2, PitwallDesign.RADIUS_MD, 8))
	var shell = UI.vbox(self)
	var row = UI.hbox(shell)
	row.add_theme_constant_override("separation", 12)
	header_context = UI.vbox(row); header_context.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header_context.custom_minimum_size.x = 140
	title_label = PitwallDesign.race_label(model.track.document.name.to_upper(), PitwallDesign.TYPE.heading, true)
	title_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	title_label.tooltip_text = model.track.document.name; header_context.add_child(title_label)
	session_label = PitwallDesign.race_label("", 11); header_context.add_child(session_label)
	var timing = UI.vbox(row); timing.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	clock_label = PitwallDesign.race_label("", 14); timing.add_child(clock_label)
	var conditions = UI.hbox(timing)
	flag_label = PitwallDesign.race_label("", 12, true); conditions.add_child(flag_label)
	weather_label = PitwallDesign.race_label("", 12); weather_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	weather_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL; conditions.add_child(weather_label)
	context_label = PitwallDesign.race_label("", 11); context_label.hide(); timing.add_child(context_label)
	phase_actions = UI.vbox(row)
	primary_button = PitwallDesign.race_button("Next session", func(): advance_requested.emit(), true); phase_actions.add_child(primary_button)
	pause_button = PitwallDesign.race_button("Pause", func(): action_requested.emit("pause", {})); pause_button.custom_minimum_size.x = 80; row.add_child(pause_button)
	speed_control = UI.option(["1×", "2×", "4×", "8×", "16×"], _choose_speed); speed_control.custom_minimum_size.x = 65; row.add_child(speed_control)
	weekend_menu = MenuButton.new(); weekend_menu.text = "Weekend"; weekend_menu.flat = false; weekend_menu.focus_mode = Control.FOCUS_ALL; row.add_child(weekend_menu)
	for entry in [["Save checkpoint",0],["Export race log…",1],["Open guide",2],["Main menu",3]]: weekend_menu.get_popup().add_item(entry[0],entry[1])
	weekend_menu.get_popup().id_pressed.connect(func(id): utility_requested.emit(id))
	weekend_menu.get_popup().popup_hide.connect(func(): PitwallDesign.focus_later(weekend_menu))
	var progress = UI.hbox(shell)
	for text in ["01 Qualifying", "02 Preparation", "03 Formation", "04 Start", "05 Race", "06 Results"]:
		var step = PitwallDesign.race_label(text,11); step.size_flags_horizontal = Control.SIZE_EXPAND_FILL; progress.add_child(step); steps.append(step)
	progress.hide()
	pause_button.accessibility_name = "Pause or resume the live session"
	speed_control.accessibility_name = "Simulation speed"
	weekend_menu.tooltip_text = "Save, export, guide and menu. Opening never pauses the session."

func _choose_speed(index: int) -> void:
	action_requested.emit("speed", {"value": [1,2,4,8,16][index]})
