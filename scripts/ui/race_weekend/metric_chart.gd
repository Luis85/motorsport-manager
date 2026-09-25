class_name RaceMetricChart
extends Control
## Measured traces and independent scenario comparisons use different encodings.
## A scenario category is never drawn as a future time sample.
var title = ""
var unit = ""
var series: Array = []
var minimum = 0.0
var maximum = 1.0
var categories: Array = []
var mode = "trace"
var update_count = 0
var panel_style: StyleBoxFlat

func _ready() -> void:
	panel_style = UI.box(UI.RACE_CREAM, UI.LINE, 5, 10)
	focus_mode = Control.FOCUS_ALL
	_update_minimum()

func _notification(what: int) -> void:
	if what == NOTIFICATION_THEME_CHANGED and is_node_ready(): _update_minimum(); queue_redraw()

func _update_minimum() -> void:
	custom_minimum_size = Vector2(250, ceilf(155 * get_theme_font_size("font_size") / 13.0))

func present(next_title: String, next_unit: String, next_series: Array, low: float, high: float) -> void:
	_set_data(next_title, next_unit, next_series, low, high, [], "trace")

func present_cases(next_title: String, labels: Array, values: Array, low: float = 0.0, high: float = 100.0) -> void:
	_set_data(next_title, "% water", values, low, high, labels, "cases")

func _set_data(next_title: String, next_unit: String, values: Array, low: float, high: float, labels: Array, next_mode: String) -> void:
	var safe_values: Array = []
	for value in values:
		if (typeof(value) == TYPE_FLOAT or typeof(value) == TYPE_INT) and is_finite(float(value)): safe_values.append(float(value))
	if not is_finite(low) or not is_finite(high): low = 0.0; high = 1.0
	high = maxf(low + 0.001, high)
	if [title, unit, series, minimum, maximum, categories, mode] == [next_title, next_unit, safe_values, low, high, labels, next_mode]: return
	title = next_title; unit = next_unit; series = safe_values; minimum = low; maximum = high
	categories = labels.duplicate(); mode = next_mode; update_count += 1
	tooltip_text = title + (". Independent same-horizon stress cases, not probabilities or a timeline." if mode == "cases" else ". Measured samples in chronological order; no future prediction.")
	queue_redraw()

func _draw() -> void:
	if panel_style == null: return
	draw_style_box(panel_style, Rect2(Vector2.ZERO, size))
	var font = get_theme_font("font")
	var scale_factor = get_theme_font_size("font_size") / 13.0
	var caption = maxi(11, roundi(11 * scale_factor))
	var text_size = maxi(12, roundi(12 * scale_factor))
	draw_string(font, Vector2(12, 21 * scale_factor), title, HORIZONTAL_ALIGNMENT_LEFT, size.x - 24, caption, UI.ACCENT)
	var area = Rect2(12, 37 * scale_factor, maxf(1, size.x - 24), maxf(1, size.y - 71 * scale_factor))
	for i in range(4):
		var y = area.position.y + area.size.y * i / 3.0
		draw_line(Vector2(area.position.x, y), Vector2(area.end.x, y), UI.LINE, 1)
	if series.is_empty():
		draw_string(font, area.position + Vector2(4, 25 * scale_factor), "No measured samples yet", HORIZONTAL_ALIGNMENT_LEFT, area.size.x - 8, text_size, UI.MUTED)
	elif mode == "cases":
		var width = area.size.x / series.size()
		for i in range(series.size()):
			var h = clampf((series[i] - minimum) / (maximum - minimum), 0, 1) * area.size.y
			var x = area.position.x + width * i
			draw_rect(Rect2(x + width * 0.2, area.end.y - maxf(1, h), width * 0.6, maxf(1, h)), UI.GOOD if i == 0 else UI.ACCENT)
			draw_string(font, Vector2(x, maxf(area.position.y + text_size, area.end.y - h - 4)), "%.0f%%" % series[i], HORIZONTAL_ALIGNMENT_CENTER, width, text_size, UI.INK)
			draw_string(font, Vector2(x, area.end.y + 18 * scale_factor), str(categories[i]) if i < categories.size() else str(i + 1), HORIZONTAL_ALIGNMENT_CENTER, width, caption, UI.INK)
	else:
		var points = PackedVector2Array()
		for i in range(series.size()):
			points.append(Vector2(area.position.x + area.size.x * i / maxf(1, series.size() - 1), area.end.y - clampf((series[i] - minimum) / (maximum - minimum), 0, 1) * area.size.y))
		if points.size() > 1: draw_polyline(points, UI.PRIMARY, 2.0, true)
		else: draw_circle(points[0], 2.5, UI.PRIMARY)
		draw_string(font, Vector2(12, size.y - 10), "%s · %.0f–%.0f · older → latest" % [unit, minimum, maximum], HORIZONTAL_ALIGNMENT_LEFT, size.x - 24, caption, UI.MUTED)
