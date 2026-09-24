class_name PitwallDesign
extends RefCounted
## Native presentation tokens. Never read by the race domain.
const TEXT_SCALES = [1.0, 1.15, 1.3]
const MUTED = Color("536650")
const FOCUS = Color("775220")
static var nav_styles: Dictionary = {}

static func navigation(button: Button, selected: bool) -> void:
	if button.get_meta("pitwall_selected", -1) == selected: return
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
	for child in root.get_children(): scale_controls(child, factor)

static func linear_focus(controls: Array) -> void:
	if controls.is_empty(): return
	for i in range(controls.size()):
		controls[i].focus_next = controls[i].get_path_to(controls[(i + 1) % controls.size()])
		controls[i].focus_previous = controls[i].get_path_to(controls[posmod(i - 1, controls.size())])
		controls[i].focus_neighbor_right = controls[i].focus_next
		controls[i].focus_neighbor_left = controls[i].focus_previous
