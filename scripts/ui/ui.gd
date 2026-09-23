class_name UI
extends RefCounted
const BG = Color("0b1218")
const PANEL = Color("111e27")
const CARD = Color("182832")
const INK = Color("e3ecee")
const MUTED = Color("8ea4ac")
const ACCENT = Color("e1b96a")
const LINE = Color("2c414c")
const GOOD = Color("81b6a0")
const DANGER = Color("ed8f80")

static func box(color: Color, border: Color = LINE, radius: int = 6, padding: int = 12) -> StyleBoxFlat:
	var s = StyleBoxFlat.new(); s.bg_color = color; s.border_color = border
	s.set_border_width_all(1); s.set_corner_radius_all(radius)
	s.content_margin_left = padding; s.content_margin_right = padding; s.content_margin_top = padding; s.content_margin_bottom = padding
	return s

static func theme() -> Theme:
	var t = Theme.new(); t.default_font_size = 15
	for type in ["Label", "Button", "CheckButton", "CheckBox", "OptionButton", "LineEdit", "SpinBox", "Tree", "TabBar", "RichTextLabel"]:
		t.set_color("font_color", type, INK)
		t.set_color("font_focus_color", type, INK)
		t.set_color("font_hover_color", type, Color.WHITE)
		t.set_color("font_disabled_color", type, Color("536c78"))
	for type in ["Button", "OptionButton", "LineEdit", "TextEdit"]:
		t.set_stylebox("normal", type, box(CARD))
		t.set_stylebox("hover", type, box(Color("253a45"), MUTED))
		t.set_stylebox("pressed", type, box(Color("3d3c30"), ACCENT))
		t.set_stylebox("focus", type, box(Color(0, 0, 0, 0), ACCENT, 6, 0))
		t.set_stylebox("disabled", type, box(PANEL))
	t.set_stylebox("panel", "PanelContainer", box(PANEL))
	t.set_stylebox("panel", "PopupMenu", box(CARD))
	t.set_stylebox("panel", "AcceptDialog", box(PANEL))
	t.set_stylebox("panel", "Tree", box(BG))
	t.set_stylebox("selected", "Tree", box(Color("334439"), ACCENT, 3, 4))
	t.set_stylebox("selected_focus", "Tree", box(Color("334439"), ACCENT, 3, 4))
	t.set_constant("v_separation", "Tree", 10)
	t.set_constant("separation", "VBoxContainer", 10)
	t.set_constant("separation", "HBoxContainer", 10)
	for type in ["TabContainer", "TabBar"]:
		t.set_stylebox("tab_selected", type, box(CARD, ACCENT, 4, 9))
		t.set_stylebox("tab_unselected", type, box(PANEL, LINE, 4, 9))
		t.set_stylebox("tab_hovered", type, box(Color("253a45"), MUTED, 4, 9))
		t.set_color("font_selected_color", type, ACCENT)
		t.set_color("font_unselected_color", type, MUTED)
		t.set_font_size("font_size", type, 12)
	t.set_stylebox("panel", "TabContainer", box(PANEL, LINE, 4, 4))
	return t

static func label(text: String, size: int = 15, color: Color = INK) -> Label:
	var l = Label.new(); l.text = text; l.add_theme_font_size_override("font_size", size); l.add_theme_color_override("font_color", color)
	return l

static func paragraph(text: String, color: Color = MUTED) -> Label:
	var l = label(text, 14, color); l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART; l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return l

static func button(text: String, callback: Callable, primary: bool = false) -> Button:
	var b = Button.new(); b.text = text; b.custom_minimum_size.y = 40; b.pressed.connect(callback)
	if primary:
		b.add_theme_stylebox_override("normal", box(ACCENT, ACCENT, 6, 10)); b.add_theme_color_override("font_color", BG)
		b.add_theme_color_override("font_hover_color", ACCENT)
	return b

static func option(items: Array, callback: Callable, selected: int = 0) -> OptionButton:
	var o = OptionButton.new(); o.custom_minimum_size.y = 38
	for item in items: o.add_item(str(item))
	o.select(selected); o.item_selected.connect(callback)
	return o

static func spin(value: float, minimum: float, maximum: float, step: float, callback: Callable) -> SpinBox:
	var s = SpinBox.new(); s.min_value = minimum; s.max_value = maximum; s.step = step; s.value = value; s.custom_minimum_size = Vector2(110, 38)
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
	var name_label = label(text, 14, MUTED); name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(name_label); row.add_child(control)

static func notify(parent: Node, title: String, text: String) -> void:
	var dialog = AcceptDialog.new(); dialog.title = title; dialog.dialog_text = text; dialog.min_size = Vector2i(440, 180)
	parent.add_child(dialog); dialog.popup_centered(); dialog.confirmed.connect(dialog.queue_free); dialog.canceled.connect(dialog.queue_free)

static func file_dialog(parent: Node, save: bool, filters: PackedStringArray, callback: Callable) -> FileDialog:
	var d = FileDialog.new(); d.file_mode = FileDialog.FILE_MODE_SAVE_FILE if save else FileDialog.FILE_MODE_OPEN_FILE
	d.access = FileDialog.ACCESS_FILESYSTEM; d.filters = filters; d.size = Vector2i(900, 600)
	parent.add_child(d)
	d.file_selected.connect(func(path): callback.call(path); d.queue_free())
	d.canceled.connect(d.queue_free); d.popup_centered()
	return d
