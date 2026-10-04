extends Control
## Desktop shell: detached values in, validated intents and explicit clock out.
const RuntimeBridge = preload("res://native/bridge.gd")
const NativeWorld = preload("res://native/world.gd")
const FloorInspector = preload("res://native/floors.gd")
const TutorialGuide = preload("res://native/guide.gd")
var bridge = RuntimeBridge.new()
var world = NativeWorld.new()
var floors = FloorInspector.new()
var guide = TutorialGuide.new()
var view: Dictionary = {}
var actor_ids: Array[String] = []
var actor_signature := ""
var connections: Array[String] = []
var commands: Array = []
var clips: Array = []
var selected_actor := ""
var ticking := false
var awaiting_step := false
var accumulator := 0.0
var speed := 1
var playback: Dictionary = {}
var awaiting_sample := false
var playback_generation := 0
var sample_generation := 0
var status := Label.new()
var actor_picker := OptionButton.new()
var scene_picker := OptionButton.new()
var command_picker := OptionButton.new()
var clip_picker := OptionButton.new()
var command_args := LineEdit.new()
var console := TextEdit.new()
var details := RichTextLabel.new()
var log := RichTextLabel.new()
var file_dialog := FileDialog.new()
var file_action := ""
var story_to_save: Variant
var play_button: Button
var selected_command: Dictionary = {}
var viewport: SubViewport

func _ready() -> void:
	_build_ui()
	add_child(bridge)
	bridge.response.connect(_response)
	bridge.rejected.connect(_error)
	if bridge.launch():
		bridge.request("discover")
		bridge.request("inspect")
		bridge.request("storytelling.inspect")

func _button(text: String, action: Callable, parent: Node) -> Button:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size.y = 36
	button.pressed.connect(action)
	parent.add_child(button)
	return button

func _build_ui() -> void:
	var native_theme := Theme.new()
	native_theme.set_color("font_color", "Label", Color("#294f40"))
	native_theme.set_color("default_color", "RichTextLabel", Color("#294f40"))
	theme = native_theme
	var background := ColorRect.new()
	background.color = Color("#f4f3e9")
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(background)
	var margin := MarginContainer.new()
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for side in ["left", "right", "top", "bottom"]:
		margin.add_theme_constant_override("margin_" + side, 16)
	add_child(margin)
	var page := VBoxContainer.new()
	margin.add_child(page)
	var header := HBoxContainer.new()
	page.add_child(header)
	var title := Label.new()
	title.text = "WILDLANDS · Littlewild"
	title.add_theme_color_override("font_color", Color("#294f40"))
	title.add_theme_font_size_override("font_size", 24)
	header.add_child(title)
	status.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	status.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	status.add_theme_color_override("font_color", Color("#294f40"))
	header.add_child(status)
	var toolbar := HBoxContainer.new()
	page.add_child(toolbar)
	play_button = _button("Start", _toggle_clock, toolbar)
	_button("Step 1 second", _step_second, toolbar)
	var speeds := OptionButton.new()
	for rate in [1, 2, 4, 8, 16]:
		speeds.add_item(str(rate) + "×", rate)
	speeds.item_selected.connect(func(index): speed = speeds.get_item_id(index))
	toolbar.add_child(speeds)
	_button("Save story", func(): file_action = "save"; bridge.request("story"), toolbar)
	_button("Load story", func(): ticking = false; _choose_file("load"), toolbar)
	_button("Orbit left", func(): world.orbit(-0.25), toolbar)
	_button("Orbit right", func(): world.orbit(0.25), toolbar)
	_button("Zoom +", func(): world.magnify(0.8), toolbar)
	_button("Zoom −", func(): world.magnify(1.25), toolbar)
	var split := HSplitContainer.new()
	split.size_flags_vertical = Control.SIZE_EXPAND_FILL
	page.add_child(split)
	var viewport_container := SubViewportContainer.new()
	viewport_container.stretch = true
	viewport_container.custom_minimum_size = Vector2(600, 400)
	viewport_container.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	split.add_child(viewport_container)
	viewport = SubViewport.new()
	viewport.size = Vector2i(900, 700)
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	viewport_container.add_child(viewport)
	viewport.add_child(world)
	var scrolling := ScrollContainer.new()
	scrolling.custom_minimum_size.x = 390
	scrolling.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	split.add_child(scrolling)
	var panel := VBoxContainer.new()
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scrolling.add_child(panel)
	actor_picker.item_selected.connect(_select_actor)
	panel.add_child(actor_picker)
	var care := HBoxContainer.new()
	panel.add_child(care)
	for action in ["feed", "water", "bond", "praise"]:
		_button(action.capitalize(), func(): _command({"id": "care", "actorId": selected_actor, "args": [action]}), care)
	panel.add_child(floors)
	floors.configure(bridge, world, func(): return selected_actor)
	panel.add_child(guide)
	var project: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://wildlands.project.json"))
	if project is Dictionary:
		guide.configure(project)
	panel.add_child(scene_picker)
	_button("Enter selected connection", _enter_scene, panel)
	details.custom_minimum_size.y = 170
	details.scroll_active = true
	details.size_flags_vertical = Control.SIZE_EXPAND_FILL
	panel.add_child(details)
	panel.add_child(clip_picker)
	_button("Play authored cutscene", _play_clip, panel)
	_button("Stop cutscene", _stop_clip, panel)
	var command_label := Label.new()
	command_label.text = "Gameplay command · JSON argument array"
	panel.add_child(command_label)
	command_picker.item_selected.connect(_select_command)
	panel.add_child(command_picker)
	command_args.text = "[]"
	command_args.placeholder_text = "[]"
	panel.add_child(command_args)
	_button("Run command", _run_selected_command, panel)
	var protocol_label := Label.new()
	protocol_label.text = "Runtime request · queries and authoring"
	panel.add_child(protocol_label)
	console.text = '{"method":"inspect","params":{}}'
	console.custom_minimum_size.y = 75
	console.wrap_mode = TextEdit.LINE_WRAPPING_BOUNDARY
	panel.add_child(console)
	_button("Send request", _send_console, panel)
	log.custom_minimum_size.y = 80
	log.scroll_following = true
	panel.add_child(log)
	file_dialog.access = FileDialog.ACCESS_FILESYSTEM
	file_dialog.filters = PackedStringArray(["*.json ; Wildlands story"])
	file_dialog.file_selected.connect(_file_selected)
	add_child(file_dialog)

func _toggle_clock() -> void:
	if not playback.is_empty():
		_stop_clip()
	ticking = not ticking
	bridge.request("start" if ticking and not view.get("snapshot", {}).get("started", false) else "resume" if ticking else "pause")
	play_button.text = "Pause" if ticking else "Resume"

func _process(delta: float) -> void:
	if not playback.is_empty():
		playback.time = minf(float(playback.time) + minf(delta, 0.1), float(playback.duration))
		if not awaiting_sample:
			awaiting_sample = true
			sample_generation = playback_generation
			bridge.request("storytelling.sample", {"id": playback.id, "time": playback.time})
		return
	if not ticking or awaiting_step:
		return
	accumulator += minf(delta, 0.1) * speed
	var count := mini(32, floori(accumulator / 0.1))
	if count > 0:
		accumulator -= count * 0.1
		awaiting_step = true
		bridge.request("step", {"count": count})

func _response(method: String, result: Variant) -> void:
	if method == "discover":
		commands = result.get("commands", [])
		for command in commands:
			command_picker.add_item(str(command.id))
		if not commands.is_empty():
			_select_command(0)
	elif method == "step":
		awaiting_step = false
		_render(result.get("view", {}))
	elif method in ["session.openStory", "scene.enter", "session.create"]:
		_stop_clip()
		floors.reset()
		world.reset_presentation()
		actor_signature = ""
		_render(result)
		bridge.request("storytelling.inspect")
	elif method in ["inspect", "start", "pause", "resume"]:
		_render(result)
	elif method == "story" and file_action == "save":
		story_to_save = result
		_choose_file("save")
	elif method == "storytelling.inspect":
		clips = result.get("cutscenes", []).filter(func(clip): return str(clip.sceneId) == str(view.get("snapshot", {}).get("sceneId", "")))
		clip_picker.clear()
		for clip in clips:
			clip_picker.add_item(str(clip.name))
	elif method == "storytelling.sample":
		awaiting_sample = false
		if playback.is_empty() or sample_generation != playback_generation:
			return
		world.apply_timeline(result)
		if not playback.is_empty() and float(playback.time) >= float(playback.duration):
			_stop_clip()
	elif method == "query":
		if bridge.last_response_id != floors.last_handled_request:
			_append_log(JSON.stringify(result))
	else:
		_append_log(JSON.stringify(result))
		bridge.request("inspect")

func _render(next: Variant) -> void:
	if not next is Dictionary or not next.has("snapshot"):
		_append_log(JSON.stringify(next))
		return
	view = next
	var snapshot: Dictionary = view.snapshot
	status.text = "Day %d · %.1f h · %.1f s · %s" % [int(snapshot.day), float(snapshot.hour), float(snapshot.simTime), str(snapshot.sceneId)]
	var ids: Array[String] = []
	var names := ""
	for actor in snapshot.get("actors", []):
		ids.append(str(actor.id))
		names += str(actor.id) + ":" + str(actor.name) + ";"
	if names != actor_signature:
		actor_signature = names
		actor_ids = ids
		actor_picker.clear()
		for actor in snapshot.get("actors", []):
			actor_picker.add_item(str(actor.name))
		if not actor_ids.is_empty():
			selected_actor = actor_ids[0]
	var connection_ids: Array[String] = []
	for connection in view.get("connections", []):
		connection_ids.append(str(connection.id))
	if connection_ids != connections:
		connections = connection_ids
		scene_picker.clear()
		for connection in view.get("connections", []):
			scene_picker.add_item(str(connection.get("label", connection.get("name", connection.id))))
	details.clear()
	for actor in snapshot.get("actors", []):
		if str(actor.id) == selected_actor:
			details.append_text(str(actor.name) + " · " + str(actor.personality) + "\n")
			for need in actor.needs:
				details.append_text(str(need).capitalize() + ": " + str(roundi(float(actor.needs[need]))) + "  ")
			details.append_text("\nInventory: " + JSON.stringify(actor.inventory) + "\nTask: " + JSON.stringify(actor.task))
	details.append_text("\nPlayer: " + JSON.stringify(snapshot.player))
	world.selected = selected_actor
	world.update_view(view)
	floors.update_view(view)
	guide.update_view(view)

func _select_actor(index: int) -> void:
	if index < actor_ids.size():
		selected_actor = actor_ids[index]
		_command({"id": "select-creature", "args": [selected_actor]})

func _select_command(index: int) -> void:
	if index < commands.size():
		selected_command = commands[index]
		command_args.tooltip_text = "Scope: %s. Maximum arguments: %s. Domain validation supplies rejection reasons." % [selected_command.scope, selected_command.maxArgs]

func _run_selected_command() -> void:
	var args: Variant = JSON.parse_string(command_args.text)
	if not args is Array or selected_command.is_empty():
		_error("Enter a valid JSON argument array and select a command.")
		return
	var command := {"id": selected_command.id, "args": args}
	if selected_command.scope == "actor":
		command.actorId = selected_actor
	_command(command)

func _command(command: Dictionary) -> void:
	bridge.request("command", {"command": command})

func _send_console() -> void:
	var request: Variant = JSON.parse_string(console.text)
	if not request is Dictionary or not request.get("method") is String or not request.get("params", {}) is Dictionary:
		_error("Enter {\"method\":\"query\",\"params\":{\"name\":\"constructionOptions\"}} or another discovered request.")
		return
	bridge.request(request.method, request.get("params", {}))

func _enter_scene() -> void:
	var index := scene_picker.selected
	if index >= 0 and index < connections.size():
		bridge.request("scene.enter", {"connectionId": connections[index]})

func _play_clip() -> void:
	var index := clip_picker.selected
	if index < 0 or index >= clips.size():
		_error("This project has no authored cutscene selected.")
		return
	ticking = false
	play_button.text = "Resume"
	bridge.request("pause")
	var clip: Dictionary = clips[index]
	playback_generation += 1
	playback = {"id": clip.id, "time": 0.0, "duration": clip.duration}

func _stop_clip() -> void:
	playback_generation += 1
	playback.clear()
	world.clear_timeline()

func _choose_file(action: String) -> void:
	file_action = action
	file_dialog.file_mode = FileDialog.FILE_MODE_SAVE_FILE if action == "save" else FileDialog.FILE_MODE_OPEN_FILE
	file_dialog.current_file = "littlewild.story.json" if action == "save" else ""
	file_dialog.popup_centered_ratio(0.7)

func _file_selected(path: String) -> void:
	if file_action == "save":
		var temporary := path + ".wildlands-" + str(Time.get_ticks_usec()) + ".tmp"
		var file := FileAccess.open(temporary, FileAccess.WRITE)
		if file == null:
			_error("Cannot write story: " + error_string(FileAccess.get_open_error()))
			return
		file.store_string(JSON.stringify(story_to_save, "\t", true, true) + "\n")
		file.flush()
		var error := file.get_error()
		file.close()
		if error == OK:
			error = DirAccess.rename_absolute(temporary, path)
		if error != OK:
			DirAccess.remove_absolute(temporary)
			_error("Cannot publish story: " + error_string(error))
			return
		_append_log("Saved complete story to " + path)
	else:
		var file := FileAccess.open(path, FileAccess.READ)
		if file == null or file.get_length() > 32 * 1024 * 1024:
			_error("Cannot read story, or story exceeds 32 MiB.")
			return
		# Preserve duplicate keys and original text for the authoritative JSON boundary.
		var story := file.get_as_text()
		file.close()
		bridge.request("session.openStory", {"story": story})
	file_action = ""

func _append_log(message: String) -> void:
	log.append_text(message.left(3000) + "\n")
	if log.get_total_character_count() > 15000:
		log.clear()
		log.append_text(message.left(3000) + "\n")

func _error(message: String) -> void:
	floors.feedback.text = message
	awaiting_step = false
	awaiting_sample = false
	_append_log(message)

func _step_second() -> void:
	if not view.get("snapshot", {}).get("started", false):
		bridge.request("start")
	bridge.request("step", {"count": 10})
