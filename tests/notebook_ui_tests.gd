extends SceneTree
## Native input and dialog bounds. Terminal fixture is explicitly synthetic.
var checks = 0
var failures: Array[String] = []
var screenshots = 0
var app
var game
var view
var sim: PracticeRaceSim
var book
var path = "user://notebook-native.json"
func _initialize(): call_deferred("run")
func check(value: bool, message: String):
	checks += 1
	if not value: failures.append(message); push_error(message)
func settle(count: int = 6):
	for i in range(count): await process_frame
func point_for(control: Control) -> Vector2:
	var point = control.get_global_rect().get_center()
	var viewport = control.get_viewport()
	# Embedded dialogs use root-space Window.position, including nested dialogs.
	if viewport is Window and viewport != root: point += Vector2(viewport.position)
	return point
func click(control: Control):
	var point = point_for(control)
	var motion = InputEventMouseMotion.new(); motion.position = point; Input.parse_input_event(motion)
	for pressed in [true, false]:
		var event = InputEventMouseButton.new(); event.position = point; event.button_index = MOUSE_BUTTON_LEFT; event.pressed = pressed; Input.parse_input_event(event); await settle(2)
func key(code: Key, ctrl: bool = false):
	for pressed in [true, false]:
		var event = InputEventKey.new(); event.keycode = code; event.ctrl_pressed = ctrl; event.pressed = pressed; Input.parse_input_event(event); await settle(2)
func type_text(text: String):
	for character in text:
		var event = InputEventKey.new(); event.unicode = character.unicode_at(0); event.pressed = true; Input.parse_input_event(event)
	await settle()
func inside(c: Control) -> bool:
	if not c.is_visible_in_tree() or not c.get_viewport().get_visible_rect().encloses(c.get_global_rect()): return false
	var parent = c.get_parent()
	while parent is Control:
		if parent.clip_contents and not parent.get_global_rect().encloses(c.get_global_rect()): return false
		parent = parent.get_parent()
	return true
func capture(name: String):
	await settle(); await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://reports/notebook-" + name + ".png"); screenshots += 1
func current_book():
	for window in root.get_embedded_subwindows():
		if window.has_meta("circuit_notebook") and window.visible: return window
	return null
func open_find():
	await key(KEY_K, true); view.navigator.search.text = "Circuit notebook"; view.navigator.filter_views("Circuit notebook"); await key(KEY_ENTER); await settle()
	book = current_book()
func run():
	app = root.get_node("App"); app.checkpoint_path = "user://notebook-ui-original.json"
	game = load("res://scenes/main.tscn").instantiate(); root.add_child(game); await settle()
	var replay_menu
	for button in game.find_children("*", "MenuButton", true, false):
		if button.text == "REPLAYS & EXPERIMENTS": replay_menu = button
	check(replay_menu != null and replay_menu.focus_mode == Control.FOCUS_ALL, "Main-menu notebook invoker accepts ordinary keyboard focus")
	for size in [Vector2i(1440, 900), Vector2i(1100, 720), Vector2i(1920, 1080)]:
		for scale in ([1.3] if size.x == 1920 else [1.0, 1.15, 1.3]):
			root.size = size; root.content_scale_size = size; DisplayServer.window_set_size(size); app.settings.pitwall_text_scale = scale
			if FileAccess.file_exists(CircuitNotebook.PATH): DirAccess.remove_absolute(ProjectSettings.globalize_path(CircuitNotebook.PATH))
			sim = PracticeRaceSim.new(TrackGeometry.new(app.library[7]), {"laps":4, "intensity":"calm"}); app.weekend = sim
			game.show_weekend(); await settle(); view = game.content.get_child(0); view.set_process(false); view.guide.hide()
			for car in sim.cars: car.dnf = true
			sim.phase = "results"; view.refresh(); await settle()
			var original = sim.snapshot(); var original_bytes = FileAccess.get_file_as_string(app.checkpoint_path)
			var tag = "%dx%d-text%d" % [size.x, size.y, roundi(scale * 100)]
			await open_find()
			check(book != null, "Find opens circuit notebook with actual keys " + tag)
			if book == null: continue
			check(Rect2(Vector2.ZERO, Vector2(size)).encloses(Rect2(Vector2(book.position), Vector2(book.size))), "Notebook window fits viewport " + tag)
			check(inside(book.remember_button) and inside(book.save_button) and inside(book.close_button) and inside(book.forget_button), "Notebook primary actions fit " + tag)
			check(not book.remember_button.disabled and book.save_button.disabled, "Completed source can be remembered; empty note cannot be saved " + tag)
			await click(book.remember_button)
			check(book.ledger.entries.size() == 1 and not book.selected.is_empty(), "Real click remembers a result " + tag)
			await click(book.note); await type_text("Review the pit cost next time.")
			check(book.dirty() and book.note.text.contains("pit cost"), "Native text entry creates an unapplied note " + tag)
			await click(book.save_button)
			check(not book.dirty() and CircuitNotebook.read().data.entries[0].note == "Review the pit cost next time.", "Real click saves the personal note " + tag)
			await click(book.note)
			var typed = InputEventKey.new(); typed.keycode = KEY_1; typed.unicode = 49; typed.pressed = true; Input.parse_input_event(typed); await settle()
			typed = InputEventKey.new(); typed.keycode = KEY_1; typed.pressed = false; Input.parse_input_event(typed)
			check(book.dirty() and RaceRecord.equivalent(original, sim.snapshot()), "Typing a race shortcut key edits only the note " + tag)
			await key(KEY_BACKSPACE); await click(book.save_button)
			var note_bytes = FileAccess.get_file_as_string(CircuitNotebook.PATH)
			await click(book.remember_button)
			check(book.notice.text.begins_with("Already remembered") and FileAccess.get_file_as_string(CircuitNotebook.PATH) == note_bytes, "Duplicate click does not rewrite note or history " + tag)
			await capture(tag)
			await click(book.note); await key(KEY_END); await type_text(" Unsaved.")
			await click(book.close_button)
			check(is_instance_valid(book.guard) and book.guard.visible and book.guard.gui_get_focus_owner() == book.guard.get_cancel_button(), "Dirty exit defaults to Stay and review " + tag)
			if is_instance_valid(book.guard): await click(book.guard.get_cancel_button())
			check(book.visible and book.dirty() and not is_instance_valid(book.guard), "Canceling exit dismisses confirmation and retains draft " + tag)
			await click(book.save_button); await click(book.close_button); await settle()
			check(current_book() == null, "Saved note closes through native action " + tag)
			check(root.gui_get_focus_owner() == view.find_button, "Notebook returns focus to Find " + tag)

			check(RaceRecord.equivalent(original, sim.snapshot()) and FileAccess.get_file_as_string(app.checkpoint_path) == original_bytes, "Notebook editing leaves race and original slot unchanged " + tag)
	root.size = Vector2i(1100, 720); root.content_scale_size = root.size; DisplayServer.window_set_size(root.size)
	# Reopen persists data and exercise guarded forget through actual input.
	await open_find()
	if book:
		check(book.note.text.ends_with("Unsaved."), "Personal note survives close/reopen")
		var id = book.selected.facts.event_id; var revision = int(book.selected.revision)
		check(CircuitNotebook.save_note(id, "Externally revised note.", revision).ok, "Concurrent edit fixture changes the stored revision")
		await click(book.note); await type_text(" Keep my draft."); await click(book.save_button)
		check(book.dirty() and book.notice.text.contains("changed since"), "Stale save explains conflict and preserves unsaved draft")
		await click(book.close_button); await click(book.guard.get_ok_button()); await settle(); await open_find()
		check(book.note.text == "Externally revised note.", "Explicit discard and reopen shows latest saved version")
		var safe_data = CircuitNotebook.read().data
		Storage.write_json(CircuitNotebook.PATH, {"corrupt":true})
		await click(book.note); await type_text(" Recovery draft."); await click(book.save_button)
		check(book.dirty() and book.notice.text.contains("invalid") and Storage.read_json(CircuitNotebook.PATH).data.has("corrupt"), "Corrupt-file save failure retains both draft and corrupt data")
		Storage.write_json(CircuitNotebook.PATH, safe_data)
		await click(book.save_button)
		await click(book.forget_button); await click(book.guard.get_cancel_button())
		check(book.ledger.entries.size() == 1, "Cancel forget preserves history")
		await click(book.forget_button); await click(book.guard.get_ok_button()); await settle()
		check(book.ledger.entries.is_empty(), "Confirmed forget removes only notebook history")
		await key(KEY_ESCAPE); await settle()
		check(current_book() == null, "Escape closes clean notebook")
	# Running source is not suspended by notebook; manual fixed steps remain allowed.
	sim = RivalScenarios.build(RivalScenarios.catalog()[0], app.library); app.weekend = sim
	game.show_weekend(); await settle(); view = game.content.get_child(0); view.set_process(false); view.guide.hide()
	sim.command("formation"); sim.speed = 8; sim.paused = false
	var before = sim.snapshot(); await open_find()
	if book:
		check(RaceRecord.equivalent(before, sim.snapshot()) and not sim.paused and sim.speed == 8, "Opening notebook never seizes time controls")
		var seconds = sim.total_time; sim.step()
		check(absf(sim.total_time - seconds - RaceSim.STEP) < 0.000001 and not view.is_processing(), "Independent notebook does not disable authoritative stepping")
		check(book.remember_button.disabled, "Unfinished live source cannot claim a final result")
		await click(book.close_button)
	# Existing native scenario authoring is now exercised rather than only described.
	var source = sim.snapshot(); var author = load("res://scripts/ui/scenario_author.gd").new(); game.add_child(author)
	author.configure(PracticeRaceSim.restore_practice(source), {"event_id":app.recording.event_id})
	await settle()
	check(inside(author.get_ok_button()) and inside(author.get_cancel_button()), "Authoring fixed actions fit at enlarged compact size")
	author.fields.title.text = ""; await click(author.get_ok_button())
	check(author.visible and author.notice.text.contains("title"), "Invalid scenario author draft remains editable")
	await capture("authoring-validation-1100x720-text130")
	await click(author.get_cancel_button()); await settle()
	check(RaceRecord.equivalent(source, sim.snapshot()), "Canceling authoring leaves live state unchanged")
	var report = {"passed":failures.is_empty(), "checks":checks, "failures":failures, "screenshots":screenshots, "engine":Engine.get_version_info().string,
		"scope":"Native keys/mouse and seven size/text combinations; synthetic terminal fixture, not gameplay balance. Authoring validation and source isolation included."}
	Storage.write_json("res://reports/notebook-ui.json", report); print("NOTEBOOK_UI ", JSON.stringify(report)); quit(0 if failures.is_empty() else 1)
