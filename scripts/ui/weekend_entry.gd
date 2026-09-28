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
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	add_theme_constant_override("separation", 14)
	var header = PanelContainer.new(); add_child(header)
	var heading = VBoxContainer.new(); header.add_child(heading)
	heading.add_child(MinimalRaceStyle.label("RACE WEEKEND / WELCOME", 12, scale_factor, true))
	heading.add_child(MinimalRaceStyle.label(data.name, 29, scale_factor))
	heading.add_child(MinimalRaceStyle.label("%.2f km  ·  %d race laps  ·  %s  ·  %s reference lap %s" % [data.length / 1000, data.laps, data.weather.capitalize(), data.vehicle, data.reference_lap], 14, scale_factor, true))
	var body = HBoxContainer.new(); body.size_flags_vertical = Control.SIZE_EXPAND_FILL; add_child(body)
	preview = TrackCanvas.new(); preview.show_grid = false; preview.set_track(track); body.add_child(preview)
	var panel = PanelContainer.new(); panel.custom_minimum_size.x = 330; body.add_child(panel)
	var steps = VBoxContainer.new(); panel.add_child(steps)
	for step in [["01  PRACTICE", "Send each driver for two measured laps. Both return automatically."], ["02  QUALIFYING", "Out lap → flying lap → in lap. The best valid lap sets the grid."], ["03  RACE", "Approve formation and the start, then manage your two drivers."]]:
		steps.add_child(MinimalRaceStyle.label(step[0], 16, scale_factor))
		var copy = MinimalRaceStyle.label(step[1], 14, scale_factor, true)
		copy.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART; copy.custom_minimum_size.x = 270; steps.add_child(copy)
		var spacer = Control.new(); spacer.custom_minimum_size.y = 8; steps.add_child(spacer)
	var footer = PanelContainer.new(); add_child(footer)
	var actions = HBoxContainer.new(); footer.add_child(actions)
	notice = MinimalRaceStyle.label("Nothing starts until you choose Start practice. Your previous weekend is still safe.", 13, scale_factor, true)
	notice.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART; notice.size_flags_horizontal = Control.SIZE_EXPAND_FILL; actions.add_child(notice)
	back_button = MinimalRaceStyle.button("Back to configuration", func(): back_requested.emit(), scale_factor); actions.add_child(back_button)
	start_button = MinimalRaceStyle.button("Start practice", func(): start_requested.emit(data.revision), scale_factor)
	MinimalRaceStyle.primary(start_button, scale_factor); actions.add_child(start_button)
	start_button.call_deferred("grab_focus"); preview.call_deferred("fit")

func show_error(message: String) -> void:
	notice.text = message
	notice.add_theme_color_override("font_color", MinimalRaceStyle.DANGER)

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), MinimalRaceStyle.BG)
