class_name GameTheme
extends RefCounted
## Shared native chrome. Illustrated terrain and sporting/team colors are separate.
const BG = Color("10191d")
const PANEL = Color("172329")
const RAISED = Color("24363e")
const LINE = Color("3e535d")
const TEXT = Color("eff4f2")
const MUTED = Color("b0c1c5")
const ACCENT = Color("9bdfc8")
const WARNING = Color("f0c780")
const DANGER = Color("ffa79a")
const HOVER = Color("334c54")
const SELECTED = Color("28443f")
const DISABLED = Color("8fa3aa")
const ON_ACCENT = BG
const BODY_SIZE = 14
const ACTION_HEIGHT = 36
const COMPACT_BODY_SIZE = 13
const COMPACT_ACTION_HEIGHT = 32

static func surface(color: Color = PANEL, border: Color = LINE, radius: int = 6, padding: int = 12) -> StyleBoxFlat:
	var style = StyleBoxFlat.new()
	style.bg_color = color
	style.border_color = border
	style.set_border_width_all(1)
	style.set_corner_radius_all(radius)
	style.corner_detail = 6
	for side in [SIDE_LEFT, SIDE_RIGHT, SIDE_TOP, SIDE_BOTTOM]:
		style.set_content_margin(side, padding)
	return style

static func action(color: Color, border: Color = LINE, scale: float = 1.0) -> StyleBoxFlat:
	var style = surface(color, border, 6, roundi(9 * scale))
	style.content_margin_top = 5 * scale
	style.content_margin_bottom = 5 * scale
	return style

static func build(scale: float = 1.0, compact: bool = false) -> Theme:
	var result = Theme.new()
	var body_size = COMPACT_BODY_SIZE if compact else BODY_SIZE
	result.default_font_size = roundi(body_size * scale)
	var types = ["Label", "Button", "CheckButton", "CheckBox", "OptionButton", "LineEdit", "TextEdit", "SpinBox", "Tree", "ItemList", "TabBar", "RichTextLabel", "PopupMenu", "TooltipLabel"]
	for type in types:
		result.set_font_size("font_size", type, roundi(body_size * scale))
		for key in ["font_color", "font_hover_color", "font_pressed_color", "font_hover_pressed_color", "font_focus_color", "font_selected_color"]:
			result.set_color(key, type, TEXT)
		result.set_color("font_disabled_color", type, DISABLED)
		result.set_color("font_outline_color", type, Color.TRANSPARENT)
	var focus = surface(Color.TRANSPARENT, ACCENT, 6, 0)
	focus.set_border_width_all(2)
	for type in ["Button", "OptionButton", "LineEdit", "TextEdit"]:
		for state in ["normal", "hover", "pressed", "hover_pressed", "disabled"]:
			var fill = {"normal": RAISED, "hover": HOVER, "pressed": SELECTED, "hover_pressed": HOVER, "disabled": PANEL}[state]
			result.set_stylebox(state, type, action(fill, ACCENT if state in ["pressed", "hover_pressed"] else LINE, scale))
		result.set_stylebox("focus", type, focus)
	for type in ["CheckButton", "CheckBox"]:
		for state in ["normal", "pressed", "disabled"]:
			result.set_stylebox(state, type, action(Color.TRANSPARENT, Color.TRANSPARENT, scale))
		for state in ["hover", "hover_pressed"]:
			result.set_stylebox(state, type, action(HOVER, LINE, scale))
		result.set_stylebox("focus", type, focus)
	for type in ["LineEdit", "TextEdit"]:
		result.set_color("font_placeholder_color", type, MUTED)
		result.set_color("caret_color", type, TEXT)
		result.set_color("selection_color", type, SELECTED)
		result.set_stylebox("read_only", type, action(PANEL, LINE, scale))
	result.set_color("default_color", "RichTextLabel", TEXT)
	result.set_color("selection_color", "RichTextLabel", SELECTED)
	result.set_stylebox("panel", "PanelContainer", surface(PANEL, LINE, 6, roundi((8 if compact else 12) * scale)))
	result.set_stylebox("panel", "AcceptDialog", surface(PANEL))
	result.set_stylebox("panel", "PopupMenu", surface(PANEL, LINE, 6, 8))
	result.set_stylebox("hover", "PopupMenu", action(HOVER, ACCENT, scale))
	result.set_color("font_accelerator_color", "PopupMenu", MUTED)
	result.set_color("font_separator_color", "PopupMenu", MUTED)
	result.set_constant("v_separation", "PopupMenu", roundi(8 * scale))
	result.set_stylebox("panel", "TooltipPanel", surface(PANEL, ACCENT, 6, 10))
	for type in ["Tree", "ItemList"]:
		result.set_stylebox("panel", type, surface(PANEL, LINE, 6, 3))
		for state in ["selected", "selected_focus"]:
			result.set_stylebox(state, type, surface(SELECTED, ACCENT, 3, 0))
		for state in ["hover", "hovered", "hovered_dimmed"]:
			result.set_stylebox(state, type, surface(HOVER, Color.TRANSPARENT, 3, 0))
		result.set_stylebox("cursor", type, focus)
		result.set_stylebox("cursor_unfocused", type, surface(Color.TRANSPARENT, LINE, 3, 0))
		result.set_stylebox("focus", type, focus)
	for state in ["normal", "hover", "pressed"]:
		result.set_stylebox("title_button_" + state, "Tree", action(RAISED if state == "normal" else HOVER, LINE, scale))
	result.set_color("title_button_color", "Tree", TEXT)
	result.set_font_size("title_button_font_size", "Tree", roundi(13 * scale))
	result.set_constant("v_separation", "Tree", roundi(4 * scale))
	for type in ["TabContainer", "TabBar"]:
		result.set_stylebox("tab_selected", type, action(SELECTED, ACCENT, scale))
		result.set_stylebox("tab_unselected", type, action(PANEL, LINE, scale))
		result.set_stylebox("tab_hovered", type, action(HOVER, LINE, scale))
		result.set_color("font_selected_color", type, TEXT)
		result.set_color("font_unselected_color", type, MUTED)
	result.set_stylebox("panel", "TabContainer", surface(PANEL, LINE, 6, 0))
	for type in ["VScrollBar", "HScrollBar"]:
		result.set_stylebox("scroll", type, surface(BG, BG, 4, 3))
		result.set_stylebox("scroll_focus", type, focus)
		for state in ["grabber", "grabber_highlight", "grabber_pressed"]:
			result.set_stylebox(state, type, surface(LINE if state == "grabber" else ACCENT, Color.TRANSPARENT, 4, 6))
	for type in ["HBoxContainer", "VBoxContainer", "HFlowContainer", "VFlowContainer"]:
		result.set_constant("separation", type, roundi((6 if compact else 8) * scale))
	for key in ["h_separation", "v_separation"]:
		result.set_constant(key, "GridContainer", roundi((6 if compact else 8) * scale))
	var rule = StyleBoxLine.new()
	rule.color = LINE
	rule.thickness = 1
	result.set_stylebox("separator", "HSeparator", rule)
	return result

static func primary(button: Button, scale: float = 1.0) -> void:
	for state in ["normal", "hover", "pressed", "hover_pressed"]:
		button.add_theme_stylebox_override(state, action(ACCENT if state == "normal" else Color("b7efdc"), ACCENT, scale))
		button.add_theme_color_override("font_" + ("color" if state == "normal" else state + "_color"), ON_ACCENT)
	button.add_theme_color_override("font_focus_color", ON_ACCENT)
	button.add_theme_color_override("font_disabled_color", DISABLED)
	button.add_theme_stylebox_override("disabled", action(PANEL, LINE, scale))

static func ink_on(color: Color) -> Color:
	# Opaque semantic/chart fills are not necessarily theme surfaces. Choose
	# contrasting ink without changing the actual tyre/team identity color.
	var linear = color.srgb_to_linear()
	var light = linear.r * 0.2126 + linear.g * 0.7152 + linear.b * 0.0722
	return Color.BLACK if light >= 0.175 else Color.WHITE
