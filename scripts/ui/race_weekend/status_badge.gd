class_name RaceStatusBadge
extends PanelContainer
## Text-first status badge; color is redundant, never the only state cue.
var label: Label
var last_tone=""
static var styles: Dictionary = {}

func _ready() -> void:
	label = UI.label("", 10, UI.INK); add_child(label)
	custom_minimum_size.y = 24

func present(text: String, tone: String = "neutral") -> void:
	if label == null: return
	label.text = text.to_upper()
	accessibility_name=label.text
	if tone==last_tone:return
	last_tone=tone
	var fill = {"good": Color("dce9dc"), "warning": Color("f2e5bd"), "danger": Color("f3d9d2"), "info": UI.SELECTED}.get(tone, UI.CARD)
	var border = {"good": UI.GOOD, "warning": UI.ACCENT, "danger": UI.DANGER, "info": UI.PRIMARY}.get(tone, UI.LINE)
	if not styles.has(tone):styles[tone]=UI.box(fill,border,3,5)
	add_theme_stylebox_override("panel",styles[tone])
	label.add_theme_color_override("font_color", UI.DANGER if tone == "danger" else UI.INK)
