class_name RaceInspectorPage
extends ScrollContainer
## Shared scrolling content boundary. Host-owned commit actions stay outside it.
var body: VBoxContainer
func _ready() -> void:
	follow_focus = true
	horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED
	var margin=MarginContainer.new();margin.size_flags_horizontal=Control.SIZE_EXPAND_FILL;add_child(margin)
	for side in ["left","right","top","bottom"]:margin.add_theme_constant_override("margin_"+side,PitwallDesign.SPACE_1)
	body=UI.vbox(margin);body.add_theme_constant_override("separation",PitwallDesign.SPACE_2)
