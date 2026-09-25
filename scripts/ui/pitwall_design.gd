class_name PitwallDesign
extends RefCounted
## Native presentation tokens. Never read by the race domain.
const TEXT_SCALES = [1.0, 1.15, 1.3]
const MUTED = Color("536650")
const FOCUS = Color("775220")
# Race-weekend layout contract (1440x900 reference, scales down through host adaptation).
const HEADER_HEIGHT = 64
const TOOLBAR_HEIGHT = 42
const TIMING_WIDTH = 236
const DRIVER_RAIL_WIDTH = 400
const DRIVER_RAIL_EXPANDED = 520
const DECISION_MIN_HEIGHT = 72
const BREAKPOINT_COMPACT = 1280
const BREAKPOINT_CONDENSED = 1100
const SPACE_1 = 4
const SPACE_2 = 8
const SPACE_3 = 12
const SPACE_4 = 16
const SPACE_5 = 24
const RADIUS_SM = 3
const RADIUS_MD = 5
const RADIUS_LG = 8
static var nav_styles: Dictionary = {}
static var popup_themes: Dictionary = {}

static func navigation(button: Button, selected: bool) -> void:
	if button.has_meta("pitwall_selected") and button.get_meta("pitwall_selected") == selected: return
	button.set_meta("pitwall_selected", selected)
	for state in ["normal", "hover", "pressed", "hover_pressed"]:
		var key = state + str(selected)
		if not nav_styles.has(key):
			var style = UI.action_box(UI.SELECTED if selected else (UI.HOVER if state == "hover" else UI.PANEL), Color.TRANSPARENT)
			style.border_color = UI.PRIMARY if selected else Color.TRANSPARENT
			style.set_border_width_all(0); style.border_width_bottom = 3 if selected else 0
			nav_styles[key] = style
		button.add_theme_stylebox_override(state, nav_styles[key])
	for state in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
		button.add_theme_color_override(state, UI.INK)

static func scale_controls(root: Node, factor: float) -> void:
	# Run on construction/preferences, not in refresh. Retain bases so repeated calls are idempotent.
	if root is Control:
		for key in ["font_size", "normal_font_size", "bold_font_size", "title_button_font_size"]:
			if key != "font_size" and not (root is RichTextLabel or root is Tree): continue
			var meta = "pitwall_base_" + key
			if not root.has_meta(meta): root.set_meta(meta, root.get_theme_font_size(key))
			root.add_theme_font_size_override(key, maxi(1, roundi(float(root.get_meta(meta)) * factor)))
		if root is BaseButton or root is SpinBox or root is LineEdit:
			if not root.has_meta("pitwall_base_height"): root.set_meta("pitwall_base_height", maxf(32, root.custom_minimum_size.y))
			root.custom_minimum_size.y = ceilf(float(root.get_meta("pitwall_base_height")) * factor)
	if root is OptionButton or root is MenuButton:
		if not popup_themes.has(factor):
			var popup_theme = UI.theme(); popup_theme.set_font_size("font_size", "PopupMenu", roundi(13 * factor))
			popup_themes[factor] = popup_theme
		root.get_popup().theme = popup_themes[factor]
	if root is SpinBox: scale_controls(root.get_line_edit(), factor)
	if root is AcceptDialog:
		scale_controls(root.get_ok_button(), factor); scale_controls(root.get_label(), factor)
		if root is ConfirmationDialog: scale_controls(root.get_cancel_button(), factor)
	for child in root.get_children(): scale_controls(child, factor)

static func linear_focus(controls: Array) -> void:
	if controls.is_empty(): return
	for i in range(controls.size()):
		controls[i].focus_next = controls[i].get_path_to(controls[i + 1]) if i + 1 < controls.size() else NodePath()
		controls[i].focus_previous = controls[i].get_path_to(controls[i - 1]) if i > 0 else NodePath()
		# Arrow navigation wraps within this group; Tab must be able to leave it.
		controls[i].focus_neighbor_right = controls[i].get_path_to(controls[(i + 1) % controls.size()])
		controls[i].focus_neighbor_left = controls[i].get_path_to(controls[posmod(i - 1, controls.size())])

static func focus_later(control: Control) -> void:
	# A view may close before the deferred focus request executes.
	_restore_focus.call_deferred(weakref(control))

static func _restore_focus(reference: WeakRef) -> void:
	var control = reference.get_ref()
	if is_instance_valid(control) and control.is_inside_tree() and control.is_visible_in_tree() and not control.is_queued_for_deletion(): control.grab_focus()
