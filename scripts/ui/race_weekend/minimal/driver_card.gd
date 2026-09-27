class_name MinimalDriverCard
extends PanelContainer
## Persistent read-only card. There are deliberately no buttons or hidden drawers.
var driver_id: int
var text_scale = 1.0
var identity: Label
var name_label: Label
var status_label: Label
var selected_label: Label
var metrics: Dictionary = {}
var styles: Dictionary = {}
var last_data: Dictionary = {}
var last_selected = false
var assignments = 0
var meters: Dictionary = {}

func configure(id: int, scale: float) -> void:
	driver_id = id; text_scale = scale
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	mouse_filter = Control.MOUSE_FILTER_PASS
	for selected in [false, true]:
		var box = MinimalRaceStyle.surface(MinimalRaceStyle.PANEL, MinimalRaceStyle.ACCENT if selected else MinimalRaceStyle.LINE, roundi(8 * scale))
		box.border_width_top = 3
		styles[selected] = box
	add_theme_stylebox_override("panel", styles[false])
	var stack = VBoxContainer.new(); stack.add_theme_constant_override("separation", roundi(5 * scale)); add_child(stack)
	var heading = HBoxContainer.new(); stack.add_child(heading)
	var badge = PanelContainer.new(); badge.add_theme_stylebox_override("panel", MinimalRaceStyle.surface(MinimalRaceStyle.RAISED, MinimalRaceStyle.LINE, roundi(6 * scale))); heading.add_child(badge)
	identity = MinimalRaceStyle.label("", 16, scale); identity.add_theme_color_override("font_color", MinimalRaceStyle.ACCENT); badge.add_child(identity)
	var names = VBoxContainer.new(); names.add_theme_constant_override("separation", 0); names.size_flags_horizontal = Control.SIZE_EXPAND_FILL; heading.add_child(names)
	name_label = MinimalRaceStyle.label("", 14, scale); names.add_child(name_label)
	status_label = MinimalRaceStyle.label("", 12, scale, true); names.add_child(status_label)
	selected_label = MinimalRaceStyle.label("", 11, scale, true); heading.add_child(selected_label)
	var row = HBoxContainer.new(); row.add_theme_constant_override("separation", roundi(8 * scale)); stack.add_child(row)
	for spec in [["tyre", "TYRES · MIN TREAD"], ["fuel", "FUEL"], ["health", "CAR"]]:
		var column = VBoxContainer.new(); column.add_theme_constant_override("separation", roundi(2 * scale)); column.size_flags_horizontal = Control.SIZE_EXPAND_FILL; row.add_child(column)
		column.add_child(MinimalRaceStyle.label(spec[1], 11, scale, true))
		var value = MinimalRaceStyle.label("—", 16, scale); column.add_child(value)
		var meter = ProgressBar.new(); meter.show_percentage = false; meter.custom_minimum_size.y = 3
		meter.mouse_filter = Control.MOUSE_FILTER_IGNORE; meter.step = 0.01
		meter.add_theme_stylebox_override("background", UI.box(MinimalRaceStyle.RAISED, Color.TRANSPARENT, 1, 0))
		meter.add_theme_stylebox_override("fill", UI.box(MinimalRaceStyle.ACCENT, Color.TRANSPARENT, 1, 0))
		column.add_child(meter); meters[spec[0]] = meter
		if spec[0] == "fuel": meter.modulate.a = 0
		var note = MinimalRaceStyle.label("", 11, scale, true); column.add_child(note)
		metrics[spec[0]] = {"value":value, "note":note}
	accessibility_name = "Driver condition, read only"

func present(data: Dictionary, position: int, selected: bool) -> void:
	if data.is_empty(): visible = false; return
	visible = true
	var state = data.duplicate(); state.position = position
	if last_data == state and last_selected == selected: return
	last_data = state; last_selected = selected; assignments += 1
	add_theme_stylebox_override("panel", styles[selected])
	identity.text = data.short
	name_label.text = data.name
	status_label.text = "P%d · %s" % [position, data.state]
	selected_label.text = "Selected" if selected else ""
	metrics.tyre.value.text = data.tyre; metrics.tyre.note.text = data.tyre_detail
	metrics.fuel.value.text = data.fuel; metrics.fuel.note.text = data.fuel_detail
	metrics.health.value.text = data.health; metrics.health.note.text = data.car_detail
	meters.tyre.value = maxf(0, data.tyre_life); meters.health.value = data.health_value
	for key in ["tyre", "fuel", "health"]:
		var issue = data[{"tyre":"tyre_issue", "fuel":"fuel_issue", "health":"car_issue"}[key]]
		metrics[key].note.add_theme_color_override("font_color", MinimalRaceStyle.WARNING if issue else MinimalRaceStyle.MUTED)
		metrics[key].value.add_theme_color_override("font_color", MinimalRaceStyle.TEXT)
	metrics.tyre.value.tooltip_text = "Fitted tyres: minimum tread remaining across all four wheels. Planned tyres appear only after the physical fitting."
	metrics.tyre.note.tooltip_text = "Set identity, average measured surface temperature, and lowest-tread wheel. FL/FR/RL/RR = front/rear left/right."
	metrics.fuel.value.tooltip_text = "Fuel uses lap-equivalent units, not litres or kilograms. It is not a guaranteed number of drivable laps."
	metrics.fuel.note.tooltip_text = "Finish margin is a current engine-rate estimate. It excludes future mode changes, incidents and traffic."
	metrics.health.value.tooltip_text = "Aggregate mechanical condition, not individual component health or a probability of finishing."
	metrics.health.note.tooltip_text = "Separate aggregate damage. No component-level diagnosis is inferred."
	tooltip_text = data.retire_reason

func set_compact(value: bool) -> void:
	for meter in meters.values(): meter.visible = not value
