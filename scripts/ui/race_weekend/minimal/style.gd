class_name MinimalRaceStyle
extends RefCounted
## Compatibility adapter: the whole game now shares GameTheme.
const BG = GameTheme.BG
const PANEL = GameTheme.PANEL
const RAISED = GameTheme.RAISED
const LINE = GameTheme.LINE
const TEXT = GameTheme.TEXT
const MUTED = GameTheme.MUTED
const ACCENT = GameTheme.ACCENT
const WARNING = GameTheme.WARNING
const DANGER = GameTheme.DANGER
const SELECTED = GameTheme.SELECTED

static func surface(color: Color = PANEL, border: Color = LINE, padding: int = 12) -> StyleBoxFlat:
	return GameTheme.surface(color, border, 6, padding)

static func theme(scale: float) -> Theme:
	return GameTheme.build(scale)

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
	GameTheme.primary(button, scale)
