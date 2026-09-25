class_name RaceDriverEmblem
extends Control
## Original vector helmet/number identity, not a photograph or licensed portrait.
var number = 0
var tint = Color("d4ad58")
func _ready() -> void:
	custom_minimum_size=Vector2(34,32);mouse_filter=Control.MOUSE_FILTER_IGNORE
func _draw() -> void:
	var c=Vector2(17,15)
	draw_circle(c,13,tint);draw_arc(c,13,PI,TAU,20,UI.RACE_INK,2,true)
	draw_rect(Rect2(6,11,23,7),UI.RACE_INK)
	draw_line(Vector2(7,22),Vector2(25,24),UI.RACE_INK,2,true)
	draw_string(get_theme_font("font"),Vector2(10,31),str(number),HORIZONTAL_ALIGNMENT_LEFT,26,10,UI.INK)
