class_name RejoinOverlay
extends Control
## Presentation-only uncertainty at the fixed pit exit. Never moves authoritative cars.
var canvas: TrackCanvas
var forecast: Dictionary = {}
var enabled = true
var stamp: Array = []
var caption_style = UI.box(UI.CARD, UI.LINE, 5, 6)


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	clip_contents = true


func _process(_delta: float) -> void:
	if canvas == null:
		return
	# The exit band is fixed geometry, not another moving car. Validity is rechecked on draw.
	var next: Array = [
		enabled,
		canvas.center,
		canvas.zoom,
		canvas.size,
		forecast.get("key", ""),
		forecast.get("time", -1)
	]
	if canvas.visual_source != null:
		next.append(canvas.visual_source.rejoin(forecast))
	if next != stamp:
		stamp = next
		queue_redraw()


func _draw() -> void:
	if not enabled or canvas == null or canvas.visual_source == null or forecast.is_empty():
		return
	var reading = canvas.visual_source.rejoin(forecast)
	if reading.is_empty():
		return
	var centre = canvas.screen(reading.centre)
	var points = PackedVector2Array()
	for point in reading.points:
		points.append(canvas.screen(point))
	draw_polyline(points, Color(0.75, 0.58, 0.25, 0.36), 14.0, true)
	draw_arc(centre, 11, 0, TAU, 32, UI.ACCENT, 2.0, true)
	var label: String = reading.label
	var position = Vector2(
		clampf(centre.x + 16, 8, maxf(8, size.x - 200)),
		clampf(centre.y - 18, 30, maxf(30, size.y - 48))
	)
	draw_style_box(caption_style, Rect2(position - Vector2(6, 18), Vector2(204, 44)))
	draw_string(ThemeDB.fallback_font, position, label, HORIZONTAL_ALIGNMENT_LEFT, 195, 12, UI.INK)
	draw_string(
		ThemeDB.fallback_font,
		position + Vector2(0, 17),
		"Fixed exit · uncertain traffic timing",
		HORIZONTAL_ALIGNMENT_LEFT,
		195,
		10,
		UI.MUTED
	)
