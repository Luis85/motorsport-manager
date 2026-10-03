class_name DirectorStyle
extends RefCounted
## Race Director presentation only. Cached styles never enter sporting state.
const BACKGROUND = GameTheme.BG
const SURFACE = GameTheme.PANEL
const RAISED = GameTheme.RAISED
const LINE = GameTheme.LINE
const TEXT = GameTheme.TEXT
const MUTED = GameTheme.MUTED
const ACCENT = GameTheme.ACCENT
const WARNING = GameTheme.DANGER
static var styles: Dictionary = {}


static func panel(padding: int = 12) -> PanelContainer:
	var p = PanelContainer.new()
	var key = "panel-" + str(padding)
	if not styles.has(key):
		styles[key] = UI.box(SURFACE, LINE, 6, padding)
	p.add_theme_stylebox_override("panel", styles[key])
	return p


static func label(text: String = "", points: int = 14, color: Color = TEXT) -> Label:
	return UI.label(text, points, color)


static func paragraph(text: String = "", color: Color = MUTED) -> Label:
	var l = UI.paragraph(text, color)
	l.add_theme_font_size_override("font_size", 13)
	return l


static func button(text: String, callback: Callable, primary: bool = false) -> Button:
	var b = UI.button(text, callback)
	style_button(b, primary)
	return b


static func style_button(b: Button, primary: bool = false) -> void:
	for state in ["normal", "hover", "pressed", "hover_pressed", "disabled", "focus"]:
		var key = "button-" + state + str(primary)
		if not styles.has(key):
			var bg = ACCENT if primary else RAISED
			var border = ACCENT if primary else LINE
			if state in ["hover", "hover_pressed"]:
				bg = ACCENT.lightened(0.15) if primary else GameTheme.HOVER
				border = ACCENT
			if state == "pressed":
				bg = GameTheme.SELECTED if not primary else ACCENT.darkened(0.1)
			if state == "disabled":
				bg = SURFACE
				border = LINE
			if state == "focus":
				bg = Color.TRANSPARENT
				border = ACCENT
			var style = UI.action_box(bg, border)
			if state == "focus":
				style.set_border_width_all(2)
			styles[key] = style
		b.add_theme_stylebox_override(state, styles[key])
	for state in [
		"font_color",
		"font_hover_color",
		"font_pressed_color",
		"font_hover_pressed_color",
		"font_focus_color"
	]:
		b.add_theme_color_override(state, BACKGROUND if primary else TEXT)
	b.add_theme_color_override("font_disabled_color", MUTED)
