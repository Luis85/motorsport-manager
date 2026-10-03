class_name MinimalStatusGauge
extends Control
## Redundant visual cue; the adjacent native labels always carry the actual value.
## Draw calls are cached by Godot and invalidated only when the shown value changes.
var value = -1.0
var ink = MinimalRaceStyle.ACCENT
var segmented = false
var stroke = 4.0
var wheels: Array = []


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	resized.connect(queue_redraw)


func present(amount: float, color: Color) -> void:
	amount = snappedf(amount, 0.5) if amount >= 0 else -1.0
	if amount == value and ink == color:
		return
	value = amount
	ink = color
	queue_redraw()


func present_wheels(values: Array) -> void:
	if wheels == values:
		return
	wheels = values.duplicate(true)
	queue_redraw()


func _draw() -> void:
	var y = size.y * 0.5
	if not wheels.is_empty():
		var gap = 4.0
		var width = maxf(1, (size.x - 3 * gap) / 4)
		for i in range(wheels.size()):
			var start = Vector2(i * (width + gap), y)
			draw_line(start, start + Vector2(width, 0), MinimalRaceStyle.LINE, stroke, true)
			var wheel = wheels[i]
			var color = (
				MinimalRaceStyle.DANGER
				if wheel.punctured
				else (MinimalRaceStyle.WARNING if wheel.life <= 25 else ink)
			)
			var amount = clampf(wheel.life / 100.0, 0, 1)
			if wheel.punctured:
				var center = start + Vector2(width * 0.5, 0)
				draw_line(center - Vector2(3, 3), center + Vector2(3, 3), color, 1.5, true)
				draw_line(center + Vector2(-3, 3), center + Vector2(3, -3), color, 1.5, true)
			elif amount > 0:
				draw_line(start, start + Vector2(width * amount, 0), color, stroke, true)
	elif segmented:
		var gap = 3.0
		var width = maxf(1, (size.x - 9 * gap) / 10)
		for i in range(10):
			var color = ink if value >= (i + 0.5) * 10 else MinimalRaceStyle.LINE
			draw_line(
				Vector2(i * (width + gap), y),
				Vector2(i * (width + gap) + width, y),
				color,
				stroke,
				true
			)
	else:
		draw_line(Vector2(0, y), Vector2(size.x, y), MinimalRaceStyle.LINE, stroke, true)
		if value > 0:
			draw_line(
				Vector2(0, y), Vector2(size.x * clampf(value / 100.0, 0, 1), y), ink, stroke, true
			)
