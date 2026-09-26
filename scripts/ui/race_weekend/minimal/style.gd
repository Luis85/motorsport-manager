class_name MinimalRaceStyle
extends RefCounted
## Isolated native theme: no editor or legacy-workspace palette changes.
const BG = Color("11171c")
const PANEL = Color("192128")
const RAISED = Color("243039")
const LINE = Color("3c4d59")
const TEXT = Color("f3f6f7")
const MUTED = Color("b3bfc8")
const ACCENT = Color("98d6c3")

static func theme(scale: float) -> Theme:
	var result = UI.theme()
	result.default_font_size = roundi(14 * scale)
	for type in ["Label", "Button", "OptionButton", "PopupMenu", "Tree", "TooltipLabel"]:
		result.set_font_size("font_size", type, roundi(14 * scale))
		for key in ["font_color", "font_hover_color", "font_pressed_color", "font_hover_pressed_color", "font_focus_color", "font_selected_color"]: result.set_color(key, type, TEXT)
		result.set_color("font_disabled_color", type, MUTED)
	for type in ["Button", "OptionButton"]:
		for state in ["normal", "hover", "pressed", "hover_pressed", "disabled", "focus"]:
			var color = PANEL if state == "disabled" else (RAISED if state == "normal" else Color("334d52"))
			var box = UI.box(Color.TRANSPARENT if state == "focus" else color, ACCENT if state in ["focus", "pressed", "hover_pressed"] else LINE, 4, roundi(8 * scale))
			box.content_margin_top = 5 * scale; box.content_margin_bottom = 5 * scale
			if state == "focus": box.set_border_width_all(2)
			result.set_stylebox(state, type, box)
	result.set_stylebox("panel", "PanelContainer", UI.box(PANEL, LINE, 5, roundi(12 * scale)))
	result.set_stylebox("panel", "PopupMenu", UI.box(PANEL, LINE, 4, 8))
	result.set_stylebox("hover", "PopupMenu", UI.box(RAISED, ACCENT, 3, 5))
	result.set_color("font_hover_color", "PopupMenu", TEXT)
	result.set_stylebox("panel", "TooltipPanel", UI.box(PANEL, LINE, 4, 10))
	for type in ["HBoxContainer", "VBoxContainer"]: result.set_constant("separation", type, roundi(8 * scale))
	return result

static func label(text: String, size: int, scale: float, muted: bool = false) -> Label:
	var result = Label.new(); result.text = text
	result.add_theme_font_size_override("font_size", roundi(size * scale))
	result.add_theme_color_override("font_color", MUTED if muted else TEXT)
	return result

static func button(text: String, callback: Callable, scale: float, toggle: bool = false) -> Button:
	var result = Button.new(); result.text = text; result.toggle_mode = toggle
	result.custom_minimum_size.y = ceilf(36 * scale)
	result.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	result.pressed.connect(callback)
	return result
