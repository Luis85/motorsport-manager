class_name MinimalDriverCard
extends PanelContainer
## Read-only instrument card: stable native labels, no hidden drawers or actions.
var driver_id: int
var text_scale = 1.0
var identity: Label
var name_label: Label
var status_label: Label
var selected_label: Label
var lap_label: Label
var lap_value: Label
var context_label: Label
var orders_label: Label
var engine_label: Label
var speed_label: Label
var metrics: Dictionary = {}
var styles: Dictionary = {}
var last_data: Dictionary = {}
var last_selected = false
var assignments = 0
var meters: Dictionary = {}
var compact = false
var stack: VBoxContainer
var detail_row: HBoxContainer

func text(value: String, points: int, muted: bool = false) -> Label:
	return MinimalRaceStyle.label(value, points, text_scale, muted)

func configure(id: int, scale: float) -> void:
	driver_id = id; text_scale = scale
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	mouse_filter = Control.MOUSE_FILTER_PASS
	for selected in [false, true]:
		var box = MinimalRaceStyle.surface(MinimalRaceStyle.PANEL, MinimalRaceStyle.ACCENT if selected else MinimalRaceStyle.LINE, roundi(10 * scale))
		box.border_width_top = 2; box.shadow_color = Color(0,0,0,0.13); box.shadow_size = 3
		styles[selected] = box
	add_theme_stylebox_override("panel", styles[false])
	stack = VBoxContainer.new(); stack.add_theme_constant_override("separation", roundi(6 * scale)); add_child(stack)
	var heading = HBoxContainer.new(); heading.add_theme_constant_override("separation", roundi(9*scale)); stack.add_child(heading)
	var badge = PanelContainer.new(); badge.add_theme_stylebox_override("panel", MinimalRaceStyle.surface(MinimalRaceStyle.RAISED, Color.TRANSPARENT, roundi(6 * scale))); heading.add_child(badge)
	identity = text("", 20); badge.add_child(identity)
	var names = VBoxContainer.new(); names.add_theme_constant_override("separation", 0); names.size_flags_horizontal = Control.SIZE_EXPAND_FILL; heading.add_child(names)
	var title_row = HBoxContainer.new(); title_row.add_theme_constant_override("separation", roundi(6*scale)); names.add_child(title_row)
	name_label = text("", 16); name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL; title_row.add_child(name_label)
	status_label = text("", 11, true); names.add_child(status_label)
	var laps = VBoxContainer.new(); laps.custom_minimum_size.x = 80*scale; laps.add_theme_constant_override("separation", 0); heading.add_child(laps)
	lap_label = text("LAST LAP", 10, true); lap_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT; laps.add_child(lap_label)
	lap_value = text("—", 16); lap_value.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT; laps.add_child(lap_value)
	selected_label = text("", 10); selected_label.add_theme_color_override("font_color", MinimalRaceStyle.ACCENT)
	# Selection remains explicit as text as well as the border, without adding a tab.
	title_row.add_child(selected_label)
	var row = HBoxContainer.new(); row.add_theme_constant_override("separation", roundi(6 * scale)); stack.add_child(row)
	for spec in [["tyre", "TYRES · MIN"], ["fuel", "FUEL"], ["health", "CAR"], ["stress", "STRESS · EST."]]:
		var panel = PanelContainer.new(); panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		panel.add_theme_stylebox_override("panel", MinimalRaceStyle.surface(Color("1e2e35"), Color.TRANSPARENT, roundi(5*scale))); row.add_child(panel)
		var column = VBoxContainer.new(); column.add_theme_constant_override("separation", roundi(2 * scale)); panel.add_child(column)
		var title = text(spec[1], 10, true); column.add_child(title)
		var value = text("—", 18); column.add_child(value)
		var meter = MinimalStatusGauge.new(); meter.custom_minimum_size.y = 5*scale; meter.stroke = 3*scale; meter.segmented = spec[0] == "stress"
		column.add_child(meter); meters[spec[0]] = meter
		if spec[0] == "fuel": meter.modulate.a = 0
		var note = text("", 11, true); column.add_child(note)
		metrics[spec[0]] = {"title":title, "value":value, "note":note}
	context_label = text("", 11); context_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS; stack.add_child(context_label)
	detail_row = HBoxContainer.new(); detail_row.add_theme_constant_override("separation", roundi(10*scale)); stack.add_child(detail_row)
	orders_label = text("", 11, true); orders_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL; detail_row.add_child(orders_label)
	engine_label = text("", 11, true); detail_row.add_child(engine_label)
	speed_label = text("", 11, true); detail_row.add_child(speed_label)
	accessibility_name = "Driver condition, read only"

func present(data: Dictionary, position: int, selected: bool) -> void:
	if data.is_empty(): visible = false; return
	visible = true
	var state = data.duplicate(); state.position = position
	if last_data == state and last_selected == selected: return
	last_data = state; last_selected = selected; assignments += 1
	add_theme_stylebox_override("panel", styles[selected])
	identity.text = data.short; identity.add_theme_color_override("font_color", Color(data.color))
	name_label.text = data.name
	status_label.text = "P%d · %s" % [position, data.state]
	selected_label.text = "Selected" if selected else ""
	lap_label.text = data.lap.label; lap_value.text = data.lap.last
	lap_value.tooltip_text = "Last measured lap; pit laps are explicitly identified. Best: " + data.lap.best
	metrics.tyre.title.text = data.tyre_title
	metrics.tyre.value.text = data.tyre_value; metrics.tyre.note.text = data.tyre_note
	metrics.fuel.value.text = data.fuel; metrics.fuel.note.text = data.fuel_note
	metrics.health.value.text = data.health; metrics.health.note.text = data.car_detail
	metrics.stress.value.text = data.stress.text
	var cause = {"Low tread":"Tyres", "Wet track":"Wet", "Clear running":"Clear", "Calm pace":"Calm", "Recovering":"Recovery"}.get(data.stress.cause, data.stress.cause)
	metrics.stress.note.text = (data.stress.band if compact else data.stress.band + " · " + cause) if data.stress.value >= 0 else "Not driving"
	var stress_ink = MinimalRaceStyle.DANGER if data.stress.value >= 65 else (MinimalRaceStyle.WARNING if data.stress.value >= 35 else MinimalRaceStyle.ACCENT)
	meters.tyre.present_wheels(data.wheels)
	meters.tyre.present(data.tyre_life, MinimalRaceStyle.ACCENT)
	meters.health.present(data.health_value, MinimalRaceStyle.WARNING if data.car_issue else MinimalRaceStyle.ACCENT)
	meters.stress.present(data.stress.value, stress_ink)
	metrics.stress.value.add_theme_color_override("font_color", stress_ink if data.stress.value >= 0 else MinimalRaceStyle.MUTED)
	metrics.stress.note.add_theme_color_override("font_color", stress_ink if data.stress.value >= 0 else MinimalRaceStyle.MUTED)
	for key in ["tyre", "fuel", "health"]:
		var issue = data[{"tyre":"tyre_issue", "fuel":"fuel_issue", "health":"car_issue"}[key]]
		metrics[key].note.add_theme_color_override("font_color", MinimalRaceStyle.WARNING if issue else MinimalRaceStyle.MUTED)
	metrics.tyre.value.tooltip_text = data.tyre + ". Actually fitted tyres; minimum tread across all four wheels. Planned tyres appear only after fitting."
	metrics.tyre.note.tooltip_text = data.tyre_detail + ". Set, average surface temperature, or limiting wheel. FL/FR/RL/RR = front/rear left/right."
	metrics.fuel.value.tooltip_text = "Fuel is in lap-equivalent units, not litres, kilograms or guaranteed drivable laps."
	metrics.fuel.note.tooltip_text = data.fuel_detail + ". Current engine-rate estimate; excludes future mode changes, incidents and traffic."
	metrics.health.value.tooltip_text = "Aggregate mechanical condition, not individual component health or finishing probability."
	metrics.health.note.tooltip_text = "Separate aggregate damage; no invented component diagnosis."
	metrics.stress.value.tooltip_text = data.stress.reason; metrics.stress.note.tooltip_text = data.stress.reason
	context_label.text = data.context; context_label.tooltip_text = "Live gaps are distance-derived estimates to neighboring classified cars, not a prediction of a pass. " + data.context
	orders_label.text = data.orders
	engine_label.text = data.engine_temp; engine_label.add_theme_color_override("font_color", MinimalRaceStyle.WARNING if data.engine_hot else MinimalRaceStyle.MUTED)
	speed_label.text = data.speed
	tooltip_text = data.retire_reason
	accessibility_description = "%s. %s. %s. Stress %s: %s" % [data.name,status_label.text,data.context,data.stress.text,data.stress.reason]

func set_compact(value: bool) -> void:
	compact = value
	last_data = {}
	for style in styles.values():
		style.content_margin_top = roundi((4 if compact else 10)*text_scale)
		style.content_margin_bottom = roundi((4 if compact else 10)*text_scale)
	add_theme_stylebox_override("panel", styles[last_selected])
	# Preserve native text sizes and all numeric information. Only spacing changes.
	stack.add_theme_constant_override("separation", roundi((3 if compact else 6)*text_scale))
