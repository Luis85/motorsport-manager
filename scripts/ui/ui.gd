class_name UI
extends RefCounted
const BG = GameTheme.BG
const PANEL = GameTheme.PANEL
const CARD = GameTheme.RAISED
const INK = GameTheme.TEXT
const MUTED = GameTheme.MUTED
const ACCENT = GameTheme.ACCENT
const LINE = GameTheme.LINE
const GOOD = GameTheme.ACCENT
const DANGER = GameTheme.DANGER
const HOVER = GameTheme.HOVER
const SELECTED = GameTheme.SELECTED
const PRIMARY = GameTheme.ACCENT
const ON_PRIMARY = GameTheme.ON_ACCENT
const RACE_DARK = PitwallDesign.RACE_DARK
const RACE_DARK_2 = PitwallDesign.RACE_DARK_2
const RACE_DARK_3 = PitwallDesign.RACE_DARK_3
const GOLD = PitwallDesign.GOLD
const RACE_CREAM = PitwallDesign.RACE_CREAM
const RACE_INK = PitwallDesign.RACE_INK
# Controls share immutable state styles; never mutate these returned resources.
static var state_styles: Dictionary = {}
static var style_assignments = 0

static func set_active(button: Button, active: bool, danger: bool = false) -> void:
	var key = ("danger" if danger else ("active" if active else "normal"))
	if button.get_meta("visual_state", "") == key: return
	if not state_styles.has(key): state_styles[key] = box(SELECTED if active else CARD, DANGER if danger else (ACCENT if active else LINE), 4, 6)
	button.add_theme_stylebox_override("normal", state_styles[key])
	button.set_meta("visual_state", key); style_assignments += 1

# Compatibility delegates; new race components use PitwallDesign directly.
static func race_panel(dark: bool = true, padding: int = 10) -> PanelContainer:
	return PitwallDesign.race_panel(dark, padding)

static func race_label(text: String, size: int = 12, accent: bool = false) -> Label:
	return PitwallDesign.race_label(text, size, accent)

static func race_button(text: String, callback: Callable, selected: bool = false) -> Button:
	return PitwallDesign.race_button(text, callback, selected)

static func race_card_state(panel: PanelContainer, state: String) -> void:
	PitwallDesign.race_card_state(panel, state)

static func resource_state(bar: ProgressBar, value: Label, risk: bool) -> void:
	if bar.has_meta("resource_risk") and bar.get_meta("resource_risk") == risk: return
	var key = "resource_" + str(risk)
	if not state_styles.has(key): state_styles[key] = box(DANGER if risk else GOOD, DANGER if risk else GOOD, 2, 0)
	bar.add_theme_stylebox_override("fill", state_styles[key]); value.add_theme_color_override("font_color", DANGER if risk else INK)
	bar.set_meta("resource_risk", risk); style_assignments += 1

static func action_box(color: Color, border: Color = LINE) -> StyleBoxFlat:
	return GameTheme.action(color, border)

static func box(color: Color, border: Color = LINE, radius: int = 6, padding: int = 12) -> StyleBoxFlat:
	return GameTheme.surface(color, border, radius, padding)

static func theme() -> Theme:
	return GameTheme.build()

static func label(text: String, size: int = 14, color: Color = INK) -> Label:
	var l = Label.new(); l.text = text; l.add_theme_font_size_override("font_size", size); l.add_theme_color_override("font_color", color)
	return l

static func paragraph(text: String, color: Color = MUTED) -> Label:
	var l = label(text, 13, color); l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART; l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return l

static func button(text: String, callback: Callable, primary: bool = false) -> Button:
	var b = Button.new(); b.text = text; b.custom_minimum_size.y = GameTheme.COMPACT_ACTION_HEIGHT; b.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND; b.pressed.connect(callback)
	if primary: GameTheme.primary(b)
	return b

static func option(items: Array, callback: Callable, selected: int = 0) -> OptionButton:
	var o = OptionButton.new(); o.custom_minimum_size.y = 32; o.fit_to_longest_item = false
	for item in items: o.add_item(str(item))
	o.select(selected); o.item_selected.connect(callback)
	return o

static func spin(value: float, minimum: float, maximum: float, step: float, callback: Callable) -> SpinBox:
	var s = SpinBox.new(); s.min_value = minimum; s.max_value = maximum; s.step = step; s.value = value; s.custom_minimum_size = Vector2(90, 32)
	s.value_changed.connect(callback)
	return s

static func check(text: String, value: bool, callback: Callable) -> CheckButton:
	var c = CheckButton.new(); c.text = text; c.button_pressed = value; c.toggled.connect(callback)
	return c

static func panel() -> PanelContainer:
	return PanelContainer.new()

static func vbox(parent: Node, expand: bool = false) -> VBoxContainer:
	var v = VBoxContainer.new(); parent.add_child(v)
	if expand: v.size_flags_vertical = Control.SIZE_EXPAND_FILL; v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return v

static func hbox(parent: Node, expand: bool = false) -> HBoxContainer:
	var h = HBoxContainer.new(); parent.add_child(h)
	if expand: h.size_flags_vertical = Control.SIZE_EXPAND_FILL; h.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return h

static func clear(parent: Node) -> void:
	for child in parent.get_children(): parent.remove_child(child); child.queue_free()

static func field(parent: Node, text: String, control: Control) -> void:
	var row = HBoxContainer.new(); parent.add_child(row)
	var name_label = label(text, 13, MUTED); name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL; name_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART; name_label.custom_minimum_size.x = 100
	row.add_child(name_label); row.add_child(control)

static func text_scale(parent: Node) -> float:
	var ancestor = parent
	while ancestor:
		if ancestor.has_meta("pitwall_text_scale"):
			return float(ancestor.get_meta("pitwall_text_scale"))
		ancestor = ancestor.get_parent()
	return 1.0

static func prepare_dialog(dialog: AcceptDialog, parent: Node) -> void:
	parent.add_child(dialog)
	dialog.theme = theme()
	PitwallDesign.scale_controls(dialog, text_scale(parent))
	var width = mini(roundi(560 * text_scale(parent)), parent.get_viewport().get_visible_rect().size.x - 48)
	dialog.get_label().autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	dialog.get_label().custom_minimum_size.x = maxi(280, width - 48)
	dialog.popup_centered(Vector2i(width, 180))

static func notify(parent: Node, title: String, text: String) -> void:
	var dialog = AcceptDialog.new()
	dialog.title = title; dialog.dialog_text = text
	var invoker = parent.get_viewport().gui_get_focus_owner()
	var dismiss = func():
		dialog.hide(); dialog.queue_free()
		if is_instance_valid(invoker): PitwallDesign.focus_later(invoker)
	dialog.confirmed.connect(dismiss); dialog.canceled.connect(dismiss)
	prepare_dialog(dialog, parent)
	PitwallDesign.focus_later(dialog.get_ok_button())

static func confirm(parent: Node, title: String, text: String, action: String, callback: Callable) -> ConfirmationDialog:
	# Repeated activation cannot stack confirmations or commit the same draft twice.
	for child in parent.get_children():
		if child is ConfirmationDialog and child.visible:
			PitwallDesign.focus_later(child.get_cancel_button())
			return child
	var dialog = ConfirmationDialog.new()
	dialog.title = title; dialog.dialog_text = text; dialog.ok_button_text = action
	var invoker = parent.get_viewport().gui_get_focus_owner()
	dialog.confirmed.connect(func(): dialog.hide(); dialog.queue_free(); callback.call())
	dialog.canceled.connect(func():
		dialog.hide(); dialog.queue_free()
		if is_instance_valid(invoker): PitwallDesign.focus_later(invoker))
	prepare_dialog(dialog, parent)
	PitwallDesign.focus_later(dialog.get_cancel_button())
	return dialog

static func file_dialog(parent: Node, save: bool, filters: PackedStringArray, callback: Callable) -> FileDialog:
	var dialog = FileDialog.new()
	dialog.file_mode = FileDialog.FILE_MODE_SAVE_FILE if save else FileDialog.FILE_MODE_OPEN_FILE
	dialog.access = FileDialog.ACCESS_FILESYSTEM; dialog.filters = filters
	var invoker = parent.get_viewport().gui_get_focus_owner()
	parent.add_child(dialog)
	dialog.theme = theme()
	PitwallDesign.scale_controls(dialog, text_scale(parent))
	var dismiss = func():
		dialog.hide(); dialog.queue_free()
		if is_instance_valid(invoker): PitwallDesign.focus_later(invoker)
	dialog.file_selected.connect(func(path): dismiss.call(); callback.call(path))
	dialog.canceled.connect(dismiss)
	var available = parent.get_viewport().get_visible_rect().size - Vector2(48, 48)
	dialog.popup_centered(Vector2i(minf(900, available.x), minf(600, available.y)))
	return dialog
