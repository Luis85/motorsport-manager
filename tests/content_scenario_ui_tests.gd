extends SceneTree
## Native preset selection and real staged approval, with keyboard input and live controls.
var checks = 0
var failures: Array[String] = []
var captures: Array = []
var game: Control
var app: Node


func _initialize() -> void:
	call_deferred("run")


func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		print("SCENARIO_UI_FAILURE ", message)


func settle(count: int = 8) -> void:
	for index in range(count):
		await process_frame


func key(code: Key, window_id: int = 0) -> void:
	for down in [true, false]:
		var event = InputEventKey.new()
		event.keycode = code
		event.pressed = down
		event.window_id = window_id
		Input.parse_input_event(event)
		await settle(2)


func inside(control: Control) -> bool:
	return (
		control != null
		and Rect2(Vector2.ZERO, Vector2(root.size)).grow(1).encloses(control.get_global_rect())
	)


func button(text: String) -> Button:
	for node in game.find_children("*", "Button", true, false):
		if node.text == text:
			return node
	return null


func run() -> void:
	root.size = Vector2i(1440, 900)
	root.content_scale_size = root.size
	app = root.get_node("App")
	check(
		app.reload_content(["res://content/examples/club-racing"]),
		"Activate the external scenario pack"
	)
	game = load("res://scenes/main.tscn").instantiate()
	root.add_child(game)
	await settle()
	for size in [Vector2i(1440, 900), Vector2i(1100, 720)]:
		root.size = size
		root.content_scale_size = size
		app.settings.pitwall_text_scale = 1.3
		game.show_library()
		await settle(12)
		var selector: OptionButton = game.find_child("ContentScenario", true, false)
		check(
			selector != null and selector.item_count == 2,
			"Native setup discovers the external scenario"
		)
		if selector == null:
			finish()
			return
		check(button("Review scenario").disabled, "No scenario is implicitly selected")
		selector.grab_focus()
		await key(KEY_ENTER)
		var popup = selector.get_popup()
		check(popup.visible, "Scenario chooser supports keyboard input")
		await key(KEY_HOME, popup.get_window_id())
		await key(KEY_DOWN, popup.get_window_id())
		await key(KEY_ENTER, popup.get_window_id())
		await settle()
		check(not button("Review scenario").disabled, "Choosing a scenario enables explicit review")
		check(
			app.weekend == null and game.launch_draft.capture().is_empty(),
			"Selection alone cannot create gameplay or replace a save"
		)
		for control in [
			selector,
			button("Review scenario"),
			button("Read brief"),
			button("Review weekend"),
			game.library_canvas
		]:
			check(
				inside(control),
				"Setup control is visible at " + str(size) + ": " + str(control.name)
			)
		await RenderingServer.frame_post_draw
		var image = "content-scenario-setup-%dx%d.png" % [size.x, size.y]
		root.get_texture().get_image().save_png("res://reports/" + image)
		captures.append({"file": image, "scope": "Native scenario selection and circuit preview."})
		button("Review scenario").grab_focus()
		await key(KEY_ENTER)
		await settle(12)
		check(
			game.screen_name == "weekend_welcome" and app.weekend == null,
			"Review freezes a draft but does not start a race"
		)
		var captured = game.launch_draft.capture()
		check(
			captured.name == "Club Training Circuit" and captured.laps == 8,
			"Scenario uses its own circuit and weekend, not the custom form"
		)
		check(
			captured.scenario_brief.title == "Your first club weekend",
			"Welcome retains the authored brief"
		)
		for control in [
			button("Start practice"), button("Back to configuration"), button("Read scenario brief")
		]:
			check(inside(control), "Welcome control stays reachable at " + str(size))
		await RenderingServer.frame_post_draw
		image = "content-scenario-welcome-%dx%d.png" % [size.x, size.y]
		root.get_texture().get_image().save_png("res://reports/" + image)
		captures.append(
			{"file": image, "scope": "Native authored-scenario approval before simulation."}
		)
	button("Start practice").grab_focus()
	await key(KEY_ENTER)
	app.session_runner.automatic = false
	await settle(12)
	check(
		app.weekend != null and app.weekend.phase == "practice",
		"Explicit approval starts the existing native practice"
	)
	if app.weekend != null:
		check(
			app.weekend.track.document.id == "local.club.training",
			"Gameplay uses the authored circuit"
		)
		check(
			app.weekend.cars.size() == 14 and app.weekend.player_ids() == [12, 13],
			"Scenario applies its legal roster and player ownership"
		)
		check(
			game.content.get_child(0) is MinimalRaceWorkspace,
			"Content does not replace the shipping pitwall"
		)
		app.stop_session()
	finish()


func finish() -> void:
	var result = {
		"passed": failures.is_empty(), "checks": checks, "failures": failures, "captures": captures
	}
	Storage.write_json("res://reports/content-scenario-ui-tests.json", result)
	print("CONTENT_SCENARIO_UI_TESTS ", JSON.stringify(result))
	quit(0 if failures.is_empty() else 1)
