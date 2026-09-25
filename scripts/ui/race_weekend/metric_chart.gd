class_name RaceMetricChart
extends Control
## Lightweight native line chart for measured telemetry/strategy series.
var title := ""
var unit := ""
var series: Array = []
var minimum := 0.0
var maximum := 1.0

func _ready() -> void:
	custom_minimum_size = Vector2(260, 150)

func present(next_title: String, next_unit: String, next_series: Array, low: float, high: float) -> void:
	title = next_title; unit = next_unit; series = next_series; minimum = low; maximum = maxf(low + 0.001, high); queue_redraw()

func _draw() -> void:
	draw_style_box(UI.box(UI.RACE_CREAM, UI.LINE, 5, 10), Rect2(Vector2.ZERO, size))
	draw_string(ThemeDB.fallback_font, Vector2(12, 20), title.to_upper(), HORIZONTAL_ALIGNMENT_LEFT, -1, 11, UI.ACCENT)
	var area = Rect2(12, 32, maxf(1, size.x - 24), maxf(1, size.y - 48))
	for i in range(4):
		var y = area.position.y + area.size.y * i / 3.0
		draw_line(Vector2(area.position.x, y), Vector2(area.end.x, y), UI.LINE, 1)
	if series.size() < 2: return
	var points = PackedVector2Array()
	for i in range(series.size()):
		var value = float(series[i])
		var x = area.position.x + area.size.x * i / maxf(1, series.size() - 1)
		var y = area.end.y - clampf((value - minimum) / (maximum - minimum), 0, 1) * area.size.y
		points.append(Vector2(x, y))
	draw_polyline(points, UI.PRIMARY, 2.0, true)
	draw_string(ThemeDB.fallback_font, Vector2(area.position.x, size.y - 6), "%s %.1f–%.1f" % [unit, minimum, maximum], HORIZONTAL_ALIGNMENT_LEFT, -1, 9, UI.MUTED)
