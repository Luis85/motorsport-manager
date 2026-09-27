class_name MinimalRaceStyle
extends RefCounted
## Local design tokens. No theme changes leak into the editor or legacy screens.
const BG = Color("10191d")
const PANEL = Color("172329")
const RAISED = Color("24363e")
const LINE = Color("3e535d")
const TEXT = Color("eff4f2")
const MUTED = Color("b0c1c5")
const ACCENT = Color("9bdfc8")
const WARNING = Color("f0c780")
const DANGER = Color("ffa79a")
const SELECTED = Color("28443f")

static func surface(color: Color = PANEL, border: Color = LINE, padding: int = 12) -> StyleBoxFlat:
	var result = UI.box(color, border, 6, padding)
	result.corner_detail = 6
	return result

static func theme(scale: float) -> Theme:
	var result = UI.theme()
	result.default_font_size = roundi(14 * scale)
	for type in ["Label", "Button", "OptionButton", "PopupMenu", "Tree", "TooltipLabel"]:
		result.set_font_size("font_size", type, roundi(14 * scale))
		for key in ["font_color", "font_hover_color", "font_pressed_color", "font_hover_pressed_color", "font_focus_color", "font_selected_color"]:
			result.set_color(key, type, TEXT)
		result.set_color("font_disabled_color", type, Color("8fa3aa"))
	for type in ["Button", "OptionButton"]:
		for state in ["normal", "hover", "pressed", "hover_pressed", "disabled", "focus"]:
			var color = {"normal": RAISED, "hover": Color("334c54"), "pressed": SELECTED, "hover_pressed": Color("345b50"), "disabled": PANEL, "focus": Color.TRANSPARENT}[state]
			var box = surface(color, ACCENT if state in ["focus", "pressed", "hover_pressed"] else LINE, roundi(9 * scale))
			box.content_margin_top = 5 * scale; box.content_margin_bottom = 5 * scale
			if state == "focus": box.set_border_width_all(2)
			result.set_stylebox(state, type, box)
	result.set_stylebox("panel", "PanelContainer", surface(PANEL, LINE, roundi(12 * scale)))
	result.set_stylebox("panel", "PopupMenu", surface(PANEL, LINE, 8))
	result.set_stylebox("hover", "PopupMenu", surface(RAISED, ACCENT, 5))
	result.set_stylebox("panel", "TooltipPanel", surface(PANEL, LINE, 10))
	for state in ["hover", "hovered", "hovered_dimmed"]:
		result.set_stylebox(state, "Tree", surface(RAISED, Color.TRANSPARENT, 0))
	for state in ["selected", "selected_focus"]:
		result.set_stylebox(state, "Tree", surface(SELECTED, ACCENT, 0))
	result.set_stylebox("cursor", "Tree", surface(Color.TRANSPARENT, ACCENT, 0))
	result.set_stylebox("cursor_unfocused", "Tree", surface(Color.TRANSPARENT, LINE, 0))
	var rule = StyleBoxLine.new(); rule.color = LINE; rule.thickness = 1
	result.set_stylebox("separator", "HSeparator", rule)
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

static func primary(button: Button, scale: float) -> void:
	for state in ["normal", "hover", "pressed", "hover_pressed"]:
		var box = surface(ACCENT if state == "normal" else Color("b7efdc"), ACCENT, roundi(10 * scale))
		box.content_margin_top = 5 * scale; box.content_margin_bottom = 5 * scale
		button.add_theme_stylebox_override(state, box)
		button.add_theme_color_override("font_" + ("color" if state == "normal" else state + "_color"), BG)
	button.add_theme_color_override("font_focus_color", BG)
	var disabled = surface(PANEL, LINE, roundi(10 * scale))
	disabled.content_margin_top = 5 * scale; disabled.content_margin_bottom = 5 * scale
	button.add_theme_stylebox_override("disabled", disabled)
