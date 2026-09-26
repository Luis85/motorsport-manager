class_name UI
extends RefCounted
const BG = Color("e9e6d8")
const PANEL = Color("f7f3e7")
const CARD = Color("efeedf")
const INK = Color("2c473a")
const MUTED = Color("536650")
const ACCENT = Color("7d5b2c")
const LINE = Color("c5cdb7")
const GOOD = Color("4f795c")
const DANGER = Color("943f32")
const HOVER = Color("e0e7d4")
const SELECTED = Color("d5e1c6")
const PRIMARY = Color("173e35")
const ON_PRIMARY = Color("fff3d8")
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
	var style = box(color, border, 4, 8)
	style.content_margin_top = 5; style.content_margin_bottom = 5
	return style

static func box(color: Color, border: Color = LINE, radius: int = 6, padding: int = 12) -> StyleBoxFlat:
	var s = StyleBoxFlat.new(); s.bg_color = color; s.border_color = border
	s.set_border_width_all(1); s.set_corner_radius_all(radius)
	s.content_margin_left = padding; s.content_margin_right = padding; s.content_margin_top = padding; s.content_margin_bottom = padding
	return s

static func theme() -> Theme:
	var t = Theme.new(); t.default_font_size = 13
	for type in ["Label", "Button", "CheckButton", "CheckBox", "OptionButton", "LineEdit", "TextEdit", "SpinBox", "Tree", "ItemList", "TabBar", "RichTextLabel", "PopupMenu", "TooltipLabel"]:
		for state in ["font_color", "font_focus_color", "font_pressed_color", "font_selected_color", "font_hover_color", "font_hover_pressed_color"]: t.set_color(state, type, INK)
		t.set_color("font_disabled_color", type, MUTED)
		t.set_color("font_outline_color", type, Color.TRANSPARENT)
	for type in ["Button", "OptionButton", "LineEdit", "TextEdit"]:
		t.set_stylebox("normal", type, action_box(CARD))
		t.set_stylebox("hover", type, action_box(HOVER, MUTED))
		t.set_stylebox("pressed", type, action_box(SELECTED, ACCENT))
		t.set_stylebox("hover_pressed", type, action_box(SELECTED, ACCENT))
		var focus = box(Color.TRANSPARENT, ACCENT, 4, 0); focus.set_border_width_all(2)
		t.set_stylebox("focus", type, focus)
		t.set_stylebox("disabled", type, action_box(PANEL))
	for type in ["CheckButton", "CheckBox"]:
		for state in ["normal", "pressed", "disabled"]: t.set_stylebox(state, type, action_box(Color.TRANSPARENT, Color.TRANSPARENT))
		for state in ["hover", "hover_pressed"]: t.set_stylebox(state, type, action_box(HOVER, MUTED))
		t.set_stylebox("focus", type, t.get_stylebox("focus", "Button"))
	t.set_color("font_placeholder_color", "LineEdit", MUTED)
	t.set_color("caret_color", "LineEdit", INK)
	t.set_color("selection_color", "LineEdit", SELECTED)
	t.set_stylebox("panel", "PanelContainer", box(PANEL, LINE, 4, 8))
	# PopupMenu and TooltipLabel do not inherit the Button text palette.
	t.set_stylebox("panel", "PopupMenu", box(PANEL, LINE, 4, 6))
	t.set_stylebox("hover", "PopupMenu", action_box(PRIMARY, PRIMARY))
	t.set_color("font_hover_color", "PopupMenu", ON_PRIMARY)
	t.set_color("font_accelerator_color", "PopupMenu", MUTED)
	t.set_color("font_separator_color", "PopupMenu", MUTED)
	t.set_constant("v_separation", "PopupMenu", 8)
	t.set_stylebox("panel", "TooltipPanel", box(INK, ACCENT, 4, 9))
	t.set_color("font_color", "TooltipLabel", ON_PRIMARY)
	t.set_font_size("font_size", "TooltipLabel", 13)
	t.set_stylebox("panel", "AcceptDialog", box(PANEL))
	# RichTextLabel uses default_color, not Control/Label's font_color.
	t.set_color("default_color", "RichTextLabel", INK)
	t.set_color("font_selected_color", "RichTextLabel", INK)
	t.set_color("selection_color", "RichTextLabel", SELECTED)
	for type in ["Tree", "ItemList"]:
		t.set_stylebox("panel", type, box(PANEL, LINE, 4, 3))
		for state in ["selected", "selected_focus"]: t.set_stylebox(state, type, box(SELECTED, ACCENT, 2, 3))
		t.set_stylebox("hover", type, box(HOVER, MUTED, 2, 3))
		t.set_color("font_selected_color", type, INK)
	for state in ["normal", "hover", "pressed"]: t.set_stylebox("title_button_" + state, "Tree", box(SELECTED, LINE, 2, 3))
	t.set_color("title_button_color", "Tree", INK)
	t.set_constant("v_separation", "Tree", 4)
	for type in ["VBoxContainer", "HBoxContainer", "HFlowContainer", "VFlowContainer"]: t.set_constant("separation", type, 6)
	for key in ["h_separation", "v_separation"]: t.set_constant(key, "GridContainer", 6)
	for type in ["TabContainer", "TabBar"]:
		t.set_stylebox("tab_selected", type, action_box(SELECTED, ACCENT))
		t.set_stylebox("tab_unselected", type, action_box(PANEL))
		t.set_stylebox("tab_hovered", type, action_box(HOVER, MUTED))
		t.set_color("font_selected_color", type, INK); t.set_color("font_unselected_color", type, MUTED)
		t.set_font_size("font_size", type, 12)
	t.set_stylebox("panel", "TabContainer", box(PANEL, LINE, 4, 0))
	return t

static func label(text: String, size: int = 13, color: Color = INK) -> Label:
	var l = Label.new(); l.text = text; l.add_theme_font_size_override("font_size", size); l.add_theme_color_override("font_color", color)
	if size >= 23:
		var heading_font = SystemFont.new(); heading_font.font_names = PackedStringArray(["Georgia", "Noto Serif", "DejaVu Serif"]); l.add_theme_font_override("font", heading_font)
	return l

static func paragraph(text: String, color: Color = MUTED) -> Label:
	var l = label(text, 13, color); l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART; l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return l

static func button(text: String, callback: Callable, primary: bool = false) -> Button:
	var b = Button.new(); b.text = text; b.custom_minimum_size.y = 32; b.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND; b.pressed.connect(callback)
	if primary:
		b.add_theme_stylebox_override("normal", action_box(PRIMARY, PRIMARY))
		b.add_theme_stylebox_override("hover", action_box(Color("446b50"), ACCENT))
		b.add_theme_stylebox_override("pressed", action_box(Color("294b38"), ACCENT))
		b.add_theme_stylebox_override("hover_pressed", action_box(Color("294b38"), ACCENT))
		for state in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color", "font_hover_pressed_color"]: b.add_theme_color_override(state, ON_PRIMARY)
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
	var name_label = label(text, 13, MUTED); name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(name_label); row.add_child(control)

static func notify(parent: Node, title: String, text: String) -> void:
	var dialog = AcceptDialog.new(); dialog.title = title; dialog.dialog_text = text; dialog.min_size = Vector2i(440, 180)
	parent.add_child(dialog)
	var ancestor = parent; var factor = 1.0
	while ancestor:
		if ancestor.has_meta("pitwall_text_scale"): factor = float(ancestor.get_meta("pitwall_text_scale")); break
		ancestor = ancestor.get_parent()
	PitwallDesign.scale_controls(dialog, factor)
	var invoker = parent.get_viewport().gui_get_focus_owner() if parent is CanvasItem else null
	var dismiss = func():
		dialog.hide(); dialog.queue_free()
		if is_instance_valid(invoker): PitwallDesign.focus_later(invoker)
	dialog.confirmed.connect(dismiss); dialog.canceled.connect(dismiss); dialog.popup_centered()
	PitwallDesign.focus_later(dialog.get_ok_button())

static func file_dialog(parent: Node, save: bool, filters: PackedStringArray, callback: Callable) -> FileDialog:
	var d = FileDialog.new(); d.file_mode = FileDialog.FILE_MODE_SAVE_FILE if save else FileDialog.FILE_MODE_OPEN_FILE
	d.access = FileDialog.ACCESS_FILESYSTEM; d.filters = filters; d.size = Vector2i(900, 600)
	parent.add_child(d)
	d.file_selected.connect(func(path): callback.call(path); d.queue_free())
	d.canceled.connect(d.queue_free); d.popup_centered()
	return d
