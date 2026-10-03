class_name RaceChartNavigation
extends RefCounted
## Shares the same four inspection directions between keyboard and controller.


static func direction(event: InputEvent) -> int:
	if event is InputEventKey and event.pressed and not event.echo:
		return event.keycode if event.keycode in [KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT] else 0
	if event is InputEventJoypadButton and event.pressed:
		return (
			{
				JOY_BUTTON_DPAD_UP: KEY_UP,
				JOY_BUTTON_DPAD_DOWN: KEY_DOWN,
				JOY_BUTTON_DPAD_LEFT: KEY_LEFT,
				JOY_BUTTON_DPAD_RIGHT: KEY_RIGHT
			}
			. get(event.button_index, 0)
		)
	return 0
