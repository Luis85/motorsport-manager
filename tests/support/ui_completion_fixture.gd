extends SceneTree
## Integration acceptance for the actual UI plan components and command boundaries.
var checks = 0
var failures: Array[String] = []
var screenshots = 0
var game
var app
var view
var model: PracticeRaceSim


func _initialize():
	call_deferred("run")


func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)


func settle(frames: int = 5) -> void:
	for i in range(frames):
		await process_frame


func inside(control: Control) -> bool:
	if (
		not control.is_visible_in_tree()
		or not root.get_visible_rect().encloses(control.get_global_rect())
	):
		return false
	var ancestor = control.get_parent()
	while ancestor:
		if (
			ancestor is Control
			and ancestor.clip_contents
			and not ancestor.get_global_rect().encloses(control.get_global_rect())
		):
			return false
		ancestor = ancestor.get_parent()
	return true


func capture(name: String) -> void:
	await settle()
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://reports/completion-" + name + ".png")
	screenshots += 1


func joy(button: JoyButton) -> void:
	for down in [true, false]:
		var event = InputEventJoypadButton.new()
		event.button_index = button
		event.pressed = down
		Input.parse_input_event(event)
		await settle(2)


func key(code: Key) -> void:
	for down in [true, false]:
		var event = InputEventKey.new()
		event.keycode = code
		event.pressed = down
		Input.parse_input_event(event)
		await settle(2)


func fixture() -> PracticeRaceSim:
	var m = PracticeRaceSim.new(
		TrackGeometry.new(app.library[7]),
		{"laps": 24, "scenario": "dry", "intensity": "calm", "seed": 7314}
	)
	m.phase = "race"
	m.paused = true
	for c in m.cars:
		c.route = "track"
		c.distance = 300 + (12 - c.id) * 24
		c.previous_distance = c.distance
		c.speed = 40
	return m


func reset(scale_factor: float = 1.0) -> void:
	app.settings.pitwall_text_scale = scale_factor
	app.weekend = model
	game.show_weekend()
	view = game.content.get_child(0)
	view.set_process(false)
	root.get_node("App").session_runner.automatic = false
	await settle(10)
