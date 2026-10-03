extends SceneTree
## Native action reachability, state contrast, draft isolation and presentation budgets.
var checks = 0
var failures: Array[String] = []
var screenshots = 0
var game
var view
var model: StrategyRaceSim
var app
var draw_counts = {"cars": 0, "battle": 0, "rejoin": 0}


func _initialize():
	call_deferred("run")


func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)


func settle(frames: int = 8) -> void:
	for i in range(frames):
		await process_frame


func inside(control: Control) -> bool:
	if (
		control == null
		or not control.is_visible_in_tree()
		or not root.get_visible_rect().encloses(control.get_global_rect())
	):
		return false
	var parent = control.get_parent()
	while parent:
		if (
			parent is Control
			and parent.clip_contents
			and not parent.get_global_rect().encloses(control.get_global_rect())
		):
			return false
		parent = parent.get_parent()
	return true


func collect(node: Node, type: String) -> Array:
	var found: Array = []
	if node.is_class(type):
		found.append(node)
	for child in node.get_children():
		found.append_array(collect(child, type))
	return found


func button(text: String) -> Button:
	for candidate in collect(game.content, "Button"):
		if candidate.text == text:
			return candidate
	return null


func capture(name: String) -> void:
	await settle()
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://reports/compact-" + name + ".png")
	screenshots += 1


func luminance(color: Color) -> float:
	var c = color.srgb_to_linear()
	return c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722


func contrast(a: Color, b: Color) -> float:
	return (maxf(luminance(a), luminance(b)) + 0.05) / (minf(luminance(a), luminance(b)) + 0.05)


func send_key(key: Key) -> void:
	var event = InputEventKey.new()
	event.keycode = key
	event.pressed = true
	Input.parse_input_event(event)
	await settle(2)
	event = InputEventKey.new()
	event.keycode = key
	event.pressed = false
	Input.parse_input_event(event)
	await settle(2)


func finish() -> void:
	Storage.write_json(
		"res://reports/compact-ui.json",
		{
			"passed": failures.is_empty(),
			"checks": checks,
			"errors": failures,
			"screenshots": screenshots
		}
	)
	print(
		"COMPACT_UI ",
		JSON.stringify(
			{
				"passed": failures.is_empty(),
				"checks": checks,
				"errors": failures,
				"screenshots": screenshots
			}
		)
	)
	quit(0 if failures.is_empty() else 1)
