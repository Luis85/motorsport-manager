class_name RaceGamepadNavigation
extends Node
## Native focus bindings are additive; global race commands never reach modal windows.
const FOCUS_BINDINGS = {
	"ui_accept": JOY_BUTTON_A,
	"ui_cancel": JOY_BUTTON_B,
	"ui_left": JOY_BUTTON_DPAD_LEFT,
	"ui_right": JOY_BUTTON_DPAD_RIGHT,
	"ui_up": JOY_BUTTON_DPAD_UP,
	"ui_down": JOY_BUTTON_DPAD_DOWN
}
var host

func configure(value: Control) -> void:
	host = value
	# Engine defaults are not guaranteed to include joypad events. Keep keyboard
	# mappings and any custom bindings, and install each all-device event once.
	for action in FOCUS_BINDINGS:
		if not InputMap.has_action(action): InputMap.add_action(action)
		var binding = InputEventJoypadButton.new()
		binding.device = -1
		binding.button_index = FOCUS_BINDINGS[action]
		if not InputMap.action_has_event(action, binding):
			InputMap.action_add_event(action, binding)

func _input(event: InputEvent) -> void:
	if host == null or not host.is_visible_in_tree() or not event is InputEventJoypadButton or not event.pressed: return
	for window in host.get_viewport().get_embedded_subwindows():
		if window.visible: return
	match event.button_index:
		JOY_BUTTON_START:
			if host.sim.phase in RaceSim.ACTIVE: host.dispatch("pause")
		JOY_BUTTON_LEFT_SHOULDER, JOY_BUTTON_RIGHT_SHOULDER:
			host.select_driver(6 if host.sim.selected_id == 3 else 3)
		JOY_BUTTON_Y:
			host.show_navigator()
		JOY_BUTTON_X:
			host.open_decision(host.sim.selected_id if host.sim.selected_id in [3, 6] else 3)
		JOY_BUTTON_B:
			if is_instance_valid(host.full_workspace) and host.full_workspace.visible: host.close_session_workspace()
			else: host.close_detail()
		_:
			# A and D-pad continue through Godot's normal focus and GUI handling.
			if host.get_viewport().gui_get_focus_owner() == null: PitwallDesign.focus_later(host.watch_button)
			return
	host.get_viewport().set_input_as_handled()
