class_name RaceStatusBadge
extends PanelContainer
## Text-first status badge; color is redundant, never the only state cue.
var label: Label

func _ready() -> void:
	label = UI.label("", 10, UI.INK); add_child(label)
	custom_minimum_size.y = 24

func present(text: String, tone: String = "neutral") -> void:
	if label == null: return
	label.text = text.to_upper()
	var fill = {"good": Color("dce9dc"), "warning": Color("f2e5bd"), "danger": Color("f3d9d2"), "info": UI.SELECTED}.get(tone, UI.CARD)
	var border = {"good": UI.GOOD, "warning": UI.ACCENT, "danger": UI.DANGER, "info": UI.PRIMARY}.get(tone, UI.LINE)
	add_theme_stylebox_override("panel", UI.box(fill, border, 3, 5))
	label.add_theme_color_override("font_color", UI.DANGER if tone == "danger" else UI.INK)
