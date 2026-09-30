extends SceneTree
## Real native controls and pointer events; no synthetic history implementation.
var checks: int = 0
var failures: Array[String] = []
var editor: TrackEditor
var captures: Array[String] = []

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func settle() -> void:
	for frame in range(4):
		await process_frame

func fixture() -> void:
	var document = TrackEditorSession.blank_document()
	document.objects = [
		{"type": "tree", "x": -100.0, "y": 40.0, "h": 0, "scale": 1.0, "rotation": 0.0},
		{"type": "tree", "x": 100.0, "y": 40.0, "h": 0, "scale": 1.0, "rotation": 0.0}]
	editor.replace_document(document)
	editor.set_tool(10)
	editor.canvas.center = Vector2.ZERO
	editor.canvas.zoom = 1.0

func button(point: Vector2, pressed: bool) -> void:
	var event = InputEventMouseButton.new()
	event.position = point
	event.button_index = MOUSE_BUTTON_LEFT
	event.pressed = pressed
	editor.canvas._gui_input(event)

func motion(point: Vector2, relative: Vector2 = Vector2(24, -18)) -> void:
	var event = InputEventMouseMotion.new()
	event.position = point
	event.relative = relative
	editor.canvas._gui_input(event)

func start_drag() -> Vector2:
	var at = editor.canvas.screen(TrackDocument.point(editor.document.objects[0]))
	button(at, true)
	return at

func move_once() -> void:
	var at = start_drag()
	motion(at + Vector2(24, -18))
	button(at + Vector2(24, -18), false)

func run() -> void:
	root.size = Vector2i(1440, 900)
	root.content_scale_size = root.size
	editor = TrackEditor.new()
	editor.configure(TrackEditorSession.blank_document())
	root.add_child(editor)
	editor.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	await settle()
	for dimensions in [Vector2i(1440, 900), Vector2i(1100, 720)]:
		for scale in [1.0, 1.15, 1.3]:
			root.size = dimensions
			root.content_scale_size = dimensions
			editor.set_meta("pitwall_text_scale", scale)
			fixture()
			await settle()
			transaction_cases()
			var filename = "gesture-%dx%d-%d.png" % [dimensions.x, dimensions.y, roundi(scale * 100)]
			await RenderingServer.frame_post_draw
			var error = root.get_texture().get_image().save_png("res://reports/" + filename)
			check(error == OK, "Native gesture evidence is saved")
			captures.append(filename)
	pure_moves()
	overlay_geometry_cache()
	await lifecycle()
	var report = {"passed": failures.is_empty(), "checks": checks, "failures": failures,
		"engine": Engine.get_version_info().string, "captures": captures,
		"focus_policy": "Window focus loss commits once; Escape/target changes cancel; document replacement invalidates."}
	Storage.write_json("res://reports/editor-gesture-tests.json", report)
	print("EDITOR_GESTURES ", JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)

func transaction_cases() -> void:
	fixture()
	var initial = editor.session.read_document()
	var at = start_drag()
	var observed = editor.document_revision
	check(editor.canvas.gesture.revision == observed, "Gesture captures the displayed revision at pointer-down")
	button(at, false)
	check(editor.undo_stack.is_empty(), "Selection click creates no history transaction")
	at = start_drag()
	for i in range(1, 6):
		motion(at + Vector2(24, -18) * i)
	check(editor.session.read_document() == initial, "Motion changes only the temporary draft")
	button(at + Vector2(120, -90), false)
	check(editor.undo_stack.size() == 1, "Many motion events commit exactly one history transaction")
	check(editor.document.objects[0].x == initial.objects[0].x + 120, "Frozen origin avoids cumulative multi-drag drift")
	var moved = editor.document.duplicate(true)
	editor.undo()
	check(editor.document == initial and editor.redo_stack.size() == 1, "Undo restores the whole gesture with a retained redo")
	at = start_drag()
	motion(at + Vector2(24, -18))
	var escape = InputEventKey.new()
	escape.pressed = true
	escape.keycode = KEY_ESCAPE
	editor.canvas._unhandled_key_input(escape)
	check(editor.document == initial and editor.redo_stack.size() == 1, "Escape cancels without consuming the redo branch")
	editor.redo()
	check(editor.document == moved, "The cancelled gesture leaves redo executable")
	at = start_drag()
	motion(at + Vector2(24, -18))
	editor.canvas.select_items("scenery", [1])
	check(editor.document == moved and editor.canvas.dragging.is_empty(), "Changing selection cancels rather than retargeting the draft")
	motion(at + Vector2(60, 20))
	button(at, false)
	check(editor.document == moved, "Late motion and release cannot move the newly selected target")
	# Undo changes document identity and history before the pointer is released.
	at = start_drag()
	motion(at + Vector2(24, -18))
	editor.undo()
	var history = editor.session.history()
	motion(at + Vector2(48, -36))
	button(at, false)
	check(editor.document == initial and editor.session.history() == history, "Undo invalidates an in-flight drag; late release preserves redo")
	editor.redo()
	# Replacement can also happen before the first movement.
	at = start_drag()
	var replacement = initial.duplicate(true)
	replacement.name = "Replacement – Nürburgring"
	editor.replace_document(replacement)
	motion(at + Vector2(24, -18))
	button(at, false)
	check(editor.document.name == replacement.name and editor.undo_stack.is_empty(), "Replacement before first motion cannot acquire a stale gesture")
	check(editor.document.objects == initial.objects, "A stale pointer cannot mutate replacement positions")
	fixture()
	at = start_drag()
	motion(at + Vector2(24, -18))
	editor.canvas.notification(Node.NOTIFICATION_WM_WINDOW_FOCUS_OUT)
	check(editor.undo_stack.size() == 1 and editor.canvas.dragging.is_empty(), "Window focus loss preserves the existing commit-once policy")
	button(at, false)
	check(editor.undo_stack.size() == 1, "Focus-loss followed by release cannot commit twice")
	# The session still rejects a frozen revision if its history moved without UI refresh.
	at = start_drag()
	observed = editor.canvas.gesture.revision
	editor.session.undo()
	motion(at + Vector2(24, -18))
	button(at, false)
	check(editor.document == initial and editor.redo_stack.size() == 1, "Application authority rejects an old gesture even without a presentation refresh")
	check(editor.document_revision > observed, "Recovery displays the new revision without reviving the old gesture")
	var canonical_geometry = editor.session.compile_draft(editor.session.read_document())
	check(editor.canvas.geometry.document == canonical_geometry.document and editor.canvas.geometry.points == canonical_geometry.points, "Rejected-gesture recovery rebuilds the canonical geometry, not a stale preview")

func pure_moves() -> void:
	var document = TrackEditorSession.blank_document()
	var original = document.duplicate(true)
	var result = TrackEdit.move_positions(document, "road", {0: Vector2(40, 50), 1: Vector2(60, 70)})
	check(result.ok and document == original, "Position transformation is pure")
	check(result.document.nodes[0]["in"] == original.nodes[0]["in"], "Position-only transformation does not normalize handles")
	check(result.document.nodes[2] == original.nodes[2], "Unrelated points remain unchanged")
	result = TrackEdit.move_positions(document, "road", {0: Vector2(40, 50), 1: Vector2(INF, 70)})
	check(not result.ok and document == original, "Invalid last target cannot partially move the first")
	result = TrackEdit.move_handle(document, 0, "out", TrackDocument.point(document.nodes[0]) + Vector2(20, 30))
	check(result.ok and document == original, "Handle transformation preserves its input document")
	check(TrackDocument.handle(result.document.nodes[0], "out") == Vector2(20, 30), "Handle transformation retains authored coordinates")

func overlay_geometry_cache() -> void:
	fixture()
	var g: TrackGeometry = editor.canvas.geometry
	var segments = TrackCanvasOverlays.surface_geometry(g)
	check(segments.size() == RaceVisualPort.SURFACE_STATIONS, "Surface painter compiles every longitudinal station")
	check(segments[0].size() == RaceVisualPort.SURFACE_LANES and segments[0][0].size() == 4,
		"Surface painter preserves lane and quarter-station sampling")
	var p = g.sample(0.0)
	var q = g.sample(g.length / (RaceVisualPort.SURFACE_STATIONS * 4))
	var lateral = 0.5 / RaceVisualPort.SURFACE_LANES - 0.5
	check(segments[0][0][0][0].is_equal_approx(p.p + p.n * p.w * lateral) and
		segments[0][0][0][1].is_equal_approx(q.p + q.n * q.w * lateral),
		"Extracted surface painter uses the exact original lateral/longitudinal sample points")
	editor.canvas._surface_geometry = null
	var builds = editor.canvas.surface_geometry_builds
	editor.canvas.build_surface_geometry()
	check(editor.canvas.surface_geometry_builds == builds + 1 and editor.canvas._surface_segments == segments,
		"Canvas retains equivalent cache values and increments only for a new geometry")
	editor.canvas.build_surface_geometry()
	check(editor.canvas.surface_geometry_builds == builds + 1,
		"Repeated drawing preparation does not rebuild an unchanged circuit")

func lifecycle() -> void:
	# Warm up before comparing retained node/resource counts; do not assert OS bytes.
	editor.queue_free()
	await settle()
	var counts: Array = []
	for cycle in range(8):
		var candidate = TrackEditor.new()
		candidate.configure(TrackEditorSession.blank_document())
		root.add_child(candidate)
		await settle()
		var session_ref = weakref(candidate.session)
		var preview = candidate.canvas.reference_preview
		candidate.canvas.toggle_preview()
		candidate.session.advance_preview(0.1)
		candidate.canvas.toggle_preview()
		check(not preview.capture().running, "Preview cancellation stops before disposal")
		candidate.queue_free()
		candidate = null
		await settle()
		check(session_ref.get_ref() == null, "Closing the editor releases its session despite a retained preview handle")
		counts.append({"nodes": int(Performance.get_monitor(Performance.OBJECT_NODE_COUNT)),
			"resources": int(Performance.get_monitor(Performance.OBJECT_RESOURCE_COUNT)),
			"orphans": int(Performance.get_monitor(Performance.OBJECT_ORPHAN_NODE_COUNT))})
		if cycle >= 2:
			check(counts[cycle] == counts[2], "After warm-up editor reopen does not accumulate nodes, resources or orphans")
