class_name RaceMetricChart
extends Control
## Observed sample domains and independent categories are never interchangeable.
## Null samples keep their original position. Inspection is UI-only and focus-stable.
var title = ""
var unit = ""
var series: Array = []
var comparison: Array = []
var comparison_name = ""
var minimum = 0.0
var maximum = 1.0
var categories: Array = []
var x_values: Array = []
var x_labels: Array = []
var domain = "Sample"
var mode = "trace"
var cursor = -1
var update_count = 0
var panel_style: StyleBoxFlat

func _ready() -> void:
	panel_style = PitwallDesign.chart_surface()
	focus_mode = Control.FOCUS_ALL
	mouse_default_cursor_shape = Control.CURSOR_CROSS
	_update_minimum()

func _notification(what: int) -> void:
	if what == NOTIFICATION_THEME_CHANGED and is_node_ready(): _update_minimum(); queue_redraw()
	elif what in [NOTIFICATION_FOCUS_ENTER, NOTIFICATION_FOCUS_EXIT]: queue_redraw()

func _update_minimum() -> void:
	custom_minimum_size = Vector2(250, ceilf((182 + (20 if not comparison_name.is_empty() else 0)) * get_theme_font_size("font_size") / 13.0))

static func finite_value(value: Variant) -> bool:
	return (typeof(value) == TYPE_FLOAT or typeof(value) == TYPE_INT) and is_finite(float(value))

static func padded_range(values: Array) -> Vector2:
	var valid: Array = []
	for value in values:
		if finite_value(value): valid.append(float(value))
	if valid.is_empty(): return Vector2(0, 1)
	var low = float(valid.min()); var high = float(valid.max())
	var pad = maxf((high - low) * 0.12, maxf(absf(high) * 0.002, 0.05))
	return Vector2(low - pad, high + pad)

func present(next_title: String, next_unit: String, next_series: Array, low: float, high: float) -> void:
	_set_data(next_title, next_unit, next_series, low, high, [], "trace", [], [], "Sample")

func present_samples(next_title: String, next_unit: String, values: Array, low: float, high: float, positions: Array, labels: Array = [], axis: String = "Elapsed s", secondary: Array = [], secondary_name: String = "") -> void:
	_set_data(next_title, next_unit, values, low, high, [], "trace", positions, labels, axis, secondary, secondary_name)

func present_cases(next_title: String, labels: Array, values: Array, low: float = 0.0, high: float = 100.0) -> void:
	_set_data(next_title, "% water", values, low, high, labels, "cases", [], [], "Independent case")

func _set_data(next_title: String, next_unit: String, values: Array, low: float, high: float, labels: Array, next_mode: String, positions: Array, sample_labels: Array, axis: String, secondary: Array = [], secondary_name: String = "") -> void:
	var safe_values: Array = []
	for i in range(maxi(values.size(), labels.size())):
		var value: Variant = values[i] if i < values.size() else null
		safe_values.append(float(value) if finite_value(value) else null)
	if not is_finite(low) or not is_finite(high): low = 0.0; high = 1.0
	if high <= low:
		var bounds = padded_range([low]); low = bounds.x; high = bounds.y
	var safe_positions: Array = []
	if positions.size() == safe_values.size():
		for i in range(positions.size()):
			if not finite_value(positions[i]) or (i > 0 and float(positions[i]) < float(positions[i - 1])):
				safe_positions.clear(); break
			safe_positions.append(float(positions[i]))
	var safe_comparison: Array = []
	if not secondary_name.is_empty():
		for i in range(safe_values.size()):
			var value: Variant = secondary[i] if i < secondary.size() else null
			safe_comparison.append(float(value) if finite_value(value) else null)
	var safe_axis = axis if not safe_positions.is_empty() or next_mode == "cases" else "Sample"
	if [title, unit, series, minimum, maximum, categories, mode, x_values, x_labels, domain, comparison, comparison_name] == [next_title, next_unit, safe_values, low, high, labels, next_mode, safe_positions, sample_labels, safe_axis, safe_comparison, secondary_name]: return
	var follow_latest = cursor < 0 or cursor == series.size() - 1
	title = next_title; unit = next_unit; series = safe_values; minimum = low; maximum = high
	categories = labels.duplicate(); mode = next_mode; x_values = safe_positions
	x_labels = sample_labels.duplicate(); domain = safe_axis; update_count += 1
	comparison = safe_comparison; comparison_name = secondary_name; _update_minimum()
	cursor = series.size() - 1 if follow_latest else clampi(cursor, -1, series.size() - 1)
	tooltip_text = title + (". Independent same-horizon stress cases; not probabilities or a timeline." if mode == "cases" else ". Recorded evidence; gaps are unavailable, not zero. No future prediction.") + " Left/Right inspect; Home/End select first/latest."
	accessibility_name = title
	_update_description(); queue_redraw()

func sample_label(index: int) -> String:
	if index < 0 or index >= series.size(): return "No recorded samples"
	if mode == "cases": return str(categories[index]) if index < categories.size() else "Case %d" % (index + 1)
	if index < x_labels.size() and not str(x_labels[index]).is_empty(): return str(x_labels[index])
	return "%s %.1f" % [domain, x_values[index]] if not x_values.is_empty() else "Sample %d" % (index + 1)

func selected_text() -> String:
	if cursor < 0 or cursor >= series.size(): return "No recorded samples yet"
	var value = "%s · %s" % [sample_label(cursor), "Unavailable" if series[cursor] == null else "%.2f %s" % [series[cursor], unit]]
	if not comparison_name.is_empty(): value += "\n%s · %s" % [comparison_name, "Unavailable at this position" if comparison[cursor] == null else "%.2f %s" % [comparison[cursor], unit]]
	return value

func _update_description() -> void:
	accessibility_description = "%s %s. %d positions, %d unavailable. Range %.2f to %.2f %s." % [tooltip_text, selected_text(), series.size(), series.count(null), minimum, maximum, unit]

func plot_area() -> Rect2:
	var scale_factor = get_theme_font_size("font_size") / 13.0
	return Rect2(52 * scale_factor, 40 * scale_factor, maxf(1, size.x - 66 * scale_factor), maxf(1, size.y - (107 + (20 if not comparison_name.is_empty() else 0)) * scale_factor))

func x_fraction(index: int) -> float:
	if series.size() <= 1: return 0.5
	if mode == "cases": return (float(index) + 0.5) / series.size()
	if not x_values.is_empty() and x_values.back() > x_values.front():
		return (float(x_values[index]) - float(x_values.front())) / (float(x_values.back()) - float(x_values.front()))
	return float(index) / (series.size() - 1)

func _gui_input(event: InputEvent) -> void:
	if series.is_empty(): return
	var selected = cursor
	if event is InputEventKey and event.pressed:
		match event.keycode:
			KEY_LEFT: selected = maxi(0, cursor - 1)
			KEY_RIGHT: selected = mini(series.size() - 1, cursor + 1)
			KEY_HOME: selected = 0
			KEY_END: selected = series.size() - 1
			_: return
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		grab_focus()
		var fraction = clampf((event.position.x - plot_area().position.x) / plot_area().size.x, 0, 1)
		var best = INF
		for i in range(series.size()):
			var distance = absf(x_fraction(i) - fraction)
			if distance < best: best = distance; selected = i
	elif event is InputEventJoypadButton and event.pressed:
		if event.button_index == JOY_BUTTON_DPAD_LEFT: selected = maxi(0, cursor - 1)
		elif event.button_index == JOY_BUTTON_DPAD_RIGHT: selected = mini(series.size() - 1, cursor + 1)
		else: return
	else: return
	cursor = selected; _update_description(); queue_redraw(); accept_event()

func _draw() -> void:
	if panel_style == null: return
	draw_style_box(panel_style, Rect2(Vector2.ZERO, size))
	if has_focus(): draw_rect(Rect2(Vector2(2, 2), size - Vector2(4, 4)), UI.PRIMARY, false, 2)
	var font = get_theme_font("font")
	var scale_factor = get_theme_font_size("font_size") / 13.0
	var caption = maxi(11, roundi(11 * scale_factor))
	var text_size = maxi(12, roundi(12 * scale_factor))
	draw_string(font, Vector2(12, 21 * scale_factor), title, HORIZONTAL_ALIGNMENT_LEFT, size.x - 24, caption, UI.ACCENT)
	var area = plot_area()
	for i in range(3):
		var fraction = i / 2.0
		var y = area.position.y + area.size.y * fraction
		draw_line(Vector2(area.position.x, y), Vector2(area.end.x, y), UI.LINE, 1)
		draw_string(font, Vector2(4, y + caption * 0.35), "%.1f" % lerpf(maximum, minimum, fraction), HORIZONTAL_ALIGNMENT_RIGHT, area.position.x - 10, caption, UI.MUTED)
	if series.is_empty():
		draw_string(font, area.position + Vector2(4, 25 * scale_factor), "No recorded samples yet", HORIZONTAL_ALIGNMENT_LEFT, area.size.x - 8, text_size, UI.MUTED)
	elif mode == "cases":
		var width = area.size.x / series.size()
		for i in range(series.size()):
			var x = area.position.x + width * i
			if series[i] != null:
				var h = clampf((series[i] - minimum) / (maximum - minimum), 0, 1) * area.size.y
				draw_rect(Rect2(x + width * 0.2, area.end.y - maxf(1, h), width * 0.6, maxf(1, h)), UI.GOOD if i == 0 else UI.ACCENT)
				draw_string(font, Vector2(x, maxf(area.position.y + text_size, area.end.y - h - 4)), "%.0f%%" % series[i], HORIZONTAL_ALIGNMENT_CENTER, width, text_size, UI.INK)
			else:
				draw_string(font, Vector2(x, area.get_center().y), "N/A", HORIZONTAL_ALIGNMENT_CENTER, width, text_size, UI.MUTED)
			draw_string(font, Vector2(x, area.end.y + 18 * scale_factor), sample_label(i), HORIZONTAL_ALIGNMENT_CENTER, width, caption, UI.INK)
	else:
		var previous: Variant = null
		for i in range(series.size()):
			if series[i] == null: previous = null; continue
			var point = Vector2(area.position.x + area.size.x * x_fraction(i), area.end.y - clampf((series[i] - minimum) / (maximum - minimum), 0, 1) * area.size.y)
			if previous != null: draw_line(previous, point, UI.PRIMARY, 2.0, true)
			draw_circle(point, 3 if i == cursor else 2, UI.PRIMARY)
			previous = point
		if not comparison.is_empty():
			previous = null
			for i in range(comparison.size()):
				if comparison[i] == null: previous = null; continue
				var point = Vector2(area.position.x + area.size.x * x_fraction(i), area.end.y - clampf((comparison[i] - minimum) / (maximum - minimum), 0, 1) * area.size.y)
				if previous != null: draw_dashed_line(previous, point, UI.ACCENT, 2.0, 4.0, true)
				var radius = 3 if i == cursor else 2
				draw_rect(Rect2(point - Vector2(radius,radius),Vector2(radius*2,radius*2)),UI.ACCENT)
				previous = point
		if cursor >= 0:
			var x = area.position.x + area.size.x * x_fraction(cursor)
			draw_line(Vector2(x, area.position.y), Vector2(x, area.end.y), UI.ACCENT, 1)
		draw_string(font, Vector2(area.position.x, area.end.y + 18 * scale_factor), sample_label(0), HORIZONTAL_ALIGNMENT_LEFT, area.size.x * 0.5, caption, UI.MUTED)
		if series.size() > 1: draw_string(font, Vector2(area.get_center().x, area.end.y + 18 * scale_factor), sample_label(series.size() - 1), HORIZONTAL_ALIGNMENT_RIGHT, area.size.x * 0.5, caption, UI.MUTED)
	var readout = selected_text().split("\n")
	for i in range(readout.size()):
		draw_string(font, Vector2(12, size.y - (25 + (readout.size() - 1 - i) * 20) * scale_factor), readout[i], HORIZONTAL_ALIGNMENT_LEFT, size.x - 24, text_size, UI.INK)
	draw_string(font, Vector2(12, size.y - 8 * scale_factor), "%s · %d positions · %d unavailable · ←/→ inspect" % [domain, series.size(), series.count(null)], HORIZONTAL_ALIGNMENT_LEFT, size.x - 24, caption, UI.MUTED)

static func align_recordings(first_x: Array, first_y: Array, second_x: Array, second_y: Array) -> Dictionary:
	# Exact common coordinates only: never interpolate an absent measurement.
	# Duplicate/invalid coordinates are ambiguous; preserve the unpaired first series.
	var maps: Array = []
	for pair in [[first_x, first_y], [second_x, second_y]]:
		if pair[0].size() != pair[1].size(): return {}
		var values: Dictionary = {}
		for i in range(pair[0].size()):
			if not finite_value(pair[0][i]) or values.has(float(pair[0][i])): return {}
			values[float(pair[0][i])] = pair[1][i]
		maps.append(values)
	var positions = maps[0].keys()
	for at in maps[1]:
		if not positions.has(at): positions.append(at)
	positions.sort()
	return {"x":positions, "first":positions.map(func(at): return maps[0].get(at)), "second":positions.map(func(at): return maps[1].get(at))}
