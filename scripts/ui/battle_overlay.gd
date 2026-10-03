class_name BattleOverlay
extends Control
## Paired outlines and text only. Uses physical projected positions, never screen-distance collisions.
var canvas: TrackCanvas
var enabled = true
var stamp: Array = []
var text_scale = 1.0
var reading: Dictionary = {}
var caption_style = UI.box(UI.PANEL, UI.LINE, 5, 7)


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	clip_contents = true


func _process(_delta: float) -> void:
	if canvas == null:
		return
	reading = canvas.visual_source.capture() if canvas.visual_source != null else {}
	var next: Array = [enabled, canvas.visual_revision, text_scale, reading]
	if next != stamp:
		stamp = next
		queue_redraw()


func _draw() -> void:
	if not enabled or canvas == null:
		return
	var record: Dictionary = reading.get("contest", {})
	if record.is_empty():
		return
	for position in [record.first, record.second]:
		var point = canvas.screen(position)
		draw_arc(point, 15, 0, TAU, 32, UI.ACCENT, 2, true)
		draw_line(point + Vector2(-6, 19), point + Vector2(6, 19), UI.ACCENT, 2, true)
	var caption: String = record.caption
	var rect = Rect2(Vector2(10, 10), Vector2(minf(310 * text_scale, size.x - 20), 46 * text_scale))
	draw_style_box(caption_style, rect)
	draw_string(
		ThemeDB.fallback_font,
		rect.position + Vector2(8, 17) * text_scale,
		caption,
		HORIZONTAL_ALIGNMENT_LEFT,
		rect.size.x - 16,
		ceili(12 * text_scale),
		UI.INK
	)
	draw_string(
		ThemeDB.fallback_font,
		rect.position + Vector2(8, 34) * text_scale,
		"Paired contest · physical movement",
		HORIZONTAL_ALIGNMENT_LEFT,
		rect.size.x - 16,
		ceili(10 * text_scale),
		UI.MUTED
	)
