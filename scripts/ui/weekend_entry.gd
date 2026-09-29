class_name WeekendEntryView
extends VBoxContainer
## Welcome surface receives detached values and emits explicit navigation/commit intent.
signal start_requested(revision: int)
signal back_requested
var data: Dictionary = {}
var track: TrackGeometry
var scale_factor: float = 1.0
var start_button: Button
var back_button: Button
var preview: TrackCanvas
var notice: Label

func configure(value: Dictionary, geometry: TrackGeometry, scale: float = 1.0) -> void:
	data = value.duplicate(true)
	track = geometry.detached_copy()
	scale_factor = scale

func _ready() -> void:
	theme = MinimalRaceStyle.theme(scale_factor)
	set_meta("pitwall_text_scale", scale_factor)
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	add_theme_constant_override("separation", 14)
	var header = PanelContainer.new(); add_child(header)
	var heading = VBoxContainer.new(); header.add_child(heading)
	var title_actions = HBoxContainer.new(); heading.add_child(title_actions)
	var kicker = MinimalRaceStyle.label("RACE WEEKEND / WELCOME", 12, scale_factor, true)
	kicker.size_flags_horizontal = Control.SIZE_EXPAND_FILL; title_actions.add_child(kicker)
	if data.has("scenario_brief"):
		title_actions.add_child(MinimalRaceStyle.button("Read scenario brief", func():
			UI.notify(self, "Scenario brief", ScenarioBrief.describe(data.scenario_brief)), scale_factor))
	var title = MinimalRaceStyle.label(data.name, 27, scale_factor)
	title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	heading.add_child(title)
	var metadata = MinimalRaceStyle.label("%.2f km  ·  %d race laps  ·  %s  ·  %s reference lap %s" % [data.length / 1000, data.laps, data.weather.capitalize(), data.get("vehicle_name", data.vehicle), data.reference_lap], 14, scale_factor, true)
	metadata.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	heading.add_child(metadata)
	var body = HBoxContainer.new(); body.size_flags_vertical = Control.SIZE_EXPAND_FILL; add_child(body)
	preview = TrackCanvas.new(); preview.show_grid = false; preview.set_track(track); body.add_child(preview)
	var panel = PanelContainer.new(); panel.custom_minimum_size.x = 330; body.add_child(panel)
	var steps = VBoxContainer.new(); steps.add_theme_constant_override("separation", 16); panel.add_child(steps)
	for step in [["01  PRACTICE", "Send each driver on a measured run. Both return automatically."], ["02  QUALIFYING", "Out lap → flying lap → in lap. The best valid lap sets the grid."], ["03  RACE", "Approve formation and the start, then manage your two drivers."]]:
		var section = VBoxContainer.new(); section.add_theme_constant_override("separation", 8); steps.add_child(section)
		section.add_child(MinimalRaceStyle.label(step[0], 16, scale_factor))
		var copy = MinimalRaceStyle.label(step[1], 14, scale_factor, true)
		copy.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART; copy.custom_minimum_size.x = 270; section.add_child(copy)
	var footer = PanelContainer.new(); add_child(footer)
	var actions = HBoxContainer.new(); footer.add_child(actions)
	notice = MinimalRaceStyle.label("Nothing starts until you choose Start practice. Your previous weekend is still safe.", 13, scale_factor, true)
	notice.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART; notice.size_flags_horizontal = Control.SIZE_EXPAND_FILL; actions.add_child(notice)
	back_button = MinimalRaceStyle.button("Back to configuration", func(): back_requested.emit(), scale_factor); actions.add_child(back_button)
	start_button = MinimalRaceStyle.button("Start practice", func(): start_requested.emit(data.revision), scale_factor)
	MinimalRaceStyle.primary(start_button, scale_factor); actions.add_child(start_button)
	actions.move_child(back_button, 0)
	PitwallDesign.focus_later(start_button); preview.call_deferred("fit")

func show_error(message: String) -> void:
	notice.text = message
	notice.add_theme_color_override("font_color", MinimalRaceStyle.DANGER)

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), MinimalRaceStyle.BG)
