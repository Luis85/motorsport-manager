extends SceneTree
## Render the actual editor with a validated authored profile and exercise transactions.
var checks := 0
var failures: Array[String] = []
var captures: Array[String] = []
var editor: TrackEditor


func _initialize() -> void:
	call_deferred("run")


func check(ok: bool, message: String) -> void:
	checks += 1
	if not ok:
		failures.append(message)
		push_error(message)


func settle(frames: int = 8) -> void:
	for i in range(frames):
		await process_frame


func source(path: String) -> Dictionary:
	var result = Storage.read_json(path)
	return result.data if result.ok and result.data is Dictionary else {}


func catalog_with_override() -> ContentCatalog:
	var vehicle = source("res://content/packs/core/vehicles/formula.json")
	var original = source("res://content/packs/core/editor_profiles/default.json")
	var changed = original.duplicate(true)
	changed.placements[0].name = "Paddock canopy"
	changed.placements[0].object_type = "tent"
	changed.placements[0].scale = 1.35
	changed.placements[0].rotation_deg = 35.0
	changed.placement_help = "Select your paddock canopy, then click the map."
	changed.guide[0].title = "Shape without side effects"
	changed.guide[0].body = (
		"Long but inert guide copy: " + "Read the canvas and controls. ".repeat(23)
	)
	var catalog = ContentCatalog.new()
	var meta = {"pack": "core", "version": "1.0.0", "root": "test", "file": "fixture.json"}
	var problems: Array = []
	problems.append_array(catalog.add(vehicle, meta))
	problems.append_array(catalog.add(original, meta))
	problems.append_array(
		catalog.add(
			changed,
			{"pack": "test", "version": "1.0.0", "root": "test", "file": "custom.json"},
			RaceStateValue.fingerprint(original)
		)
	)
	if problems.is_empty():
		problems.append_array(catalog.seal())
	check(problems.is_empty(), "Override plus vehicle form an accepted production catalog")
	return catalog


func mouse_click(position: Vector2) -> void:
	for pressed in [true, false]:
		var event = InputEventMouseButton.new()
		event.position = position
		event.button_index = MOUSE_BUTTON_LEFT
		event.pressed = pressed
		editor.canvas._gui_input(event)


func point_inside_viewport(control: Control) -> bool:
	var rect = control.get_global_rect()
	return (
		rect.size.x > 0
		and rect.size.y > 0
		and Rect2(Vector2.ZERO, Vector2(root.size)).grow(2).encloses(rect)
	)


func run() -> void:
	root.size = Vector2i(1440, 900)
	root.content_scale_size = root.size
	var custom = catalog_with_override()
	editor = TrackEditor.new()
	editor.configure(TrackEditorSession.blank_document())
	editor.session.content_catalog = custom
	root.add_child(editor)
	editor.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	await settle()
	for dimensions in [Vector2i(1440, 900), Vector2i(1100, 720)]:
		for scale in [1.0, 1.3]:
			root.size = dimensions
			root.content_scale_size = dimensions
			editor.set_meta("pitwall_text_scale", scale)
			editor.replace_document(TrackEditorSession.blank_document())
			editor.inspector.current_tab = 2
			editor.refresh_inspector()
			await settle()
			check(
				editor.session.placement_choices()[0].name == "Paddock canopy",
				"Catalog presentation is available at " + str(dimensions) + " scale " + str(scale)
			)
			var selector: OptionButton = null
			for node in editor.inspector.get_child(2).find_children(
				"*", "OptionButton", true, false
			):
				if node.item_count > 0 and node.get_item_text(0) == "Paddock canopy":
					selector = node
					break
			check(selector != null, "Actual scenery selector renders the authored label")
			if selector != null:
				selector.select(0)
				selector.item_selected.emit(0)
			await settle()
			check(
				(
					editor.canvas.mode == "scenery"
					and editor.canvas.scenery_preset.get("object_type") == "tent"
				),
				"Selecting a preset changes authoring UI, not circuit data"
			)
			check(
				(
					editor.document.objects.is_empty()
					and editor.session.read_document().objects.is_empty()
				),
				"Selecting a preset does not create an object"
			)
			# Profile values are authoritative even if this canvas has a cached
			# preset from before a dependency pack was reloaded.
			editor.canvas.scenery_preset = {
				"id": "tree", "object_type": "garage", "scale": 8.0, "rotation_deg": 0.0
			}
			editor.refresh_inspector()
			check(
				(
					editor.canvas.scenery_preset.get("object_type") == "tent"
					and is_equal_approx(float(editor.canvas.scenery_preset.get("scale", 0)), 1.35)
				),
				"Same-ID stale placement transforms are replaced from the current catalog"
			)
			editor.canvas.scenery_preset = {
				"id": "removed", "object_type": "garage", "scale": 1.0, "rotation_deg": 0.0
			}
			editor.refresh_inspector()
			check(
				(
					editor.canvas.scenery_preset.get("id") == "tree"
					and editor.canvas.scenery_type == "tent"
				),
				"Removed placement IDs cannot retain prior renderer authority"
			)
			var location = editor.canvas.size * 0.58
			mouse_click(location)
			await settle()
			var current = editor.session.read_document()
			check(
				current.objects.size() == 1,
				"One native canvas click creates exactly one scenery object"
			)
			if current.objects.size() == 1:
				check(
					(
						current.objects[0].type == "tent"
						and is_equal_approx(current.objects[0].scale, 1.35)
						and is_equal_approx(current.objects[0].rotation, 35.0)
					),
					"Placement uses all frozen authored transform values"
				)
			check(
				editor.undo_stack.size() == 1, "Placement is a single reversible editor transaction"
			)
			editor.undo()
			check(
				editor.session.read_document().objects.is_empty() and editor.redo_stack.size() == 1,
				"Undo removes exactly the placed object"
			)
			editor.redo()
			check(
				editor.session.read_document() == current, "Redo restores the exact authored object"
			)
			editor.canvas.set_layer("scenery", "locked", true)
			var before = editor.session.read_document()
			mouse_click(location + Vector2(36, 20))
			check(
				editor.session.read_document() == before,
				"Locked scenery ignores pointer placement without an unwanted history step"
			)
			editor.canvas.set_layer("scenery", "locked", false)
			var guide_before = editor.session.read_document()
			editor.guide.open_guide()
			await settle()
			check(
				(
					editor.guide.title_label.text == "Shape without side effects"
					and editor.guide.body_label.text.length() > 600
				),
				"Guide displays the override including long source text"
			)
			check(
				editor.session.read_document() == guide_before,
				"Guide opening observes the document instead of mutating it"
			)
			check(
				(
					point_inside_viewport(editor.guide.next_button)
					and point_inside_viewport(editor.guide.back_button)
				),
				"Guide navigation remains reachable at " + str(dimensions) + " scale " + str(scale)
			)
			await RenderingServer.frame_post_draw
			var guide_shot = (
				"editor-guide-%dx%d-%d.png" % [dimensions.x, dimensions.y, roundi(100 * scale)]
			)
			var guide_capture = root.get_texture().get_image().save_png(
				"res://reports/" + guide_shot
			)
			check(guide_capture == OK, "Visible long-guide evidence captured")
			if guide_capture == OK:
				captures.append(guide_shot)
			editor.guide.next_step()
			await settle()
			check(
				editor.guide.step_index == 1 and editor.session.read_document() == guide_before,
				"Guide navigation changes focus/tool only"
			)
			editor.guide.dismiss()
			check(
				not editor.guide.visible and editor.session.read_document() == guide_before,
				"Dismissal preserves the authored circuit"
			)
			var shot = (
				"editor-authored-%dx%d-%d.png" % [dimensions.x, dimensions.y, roundi(100 * scale)]
			)
			await RenderingServer.frame_post_draw
			var capture_error = root.get_texture().get_image().save_png("res://reports/" + shot)
			check(capture_error == OK, "Native preview evidence captured: " + shot)
			if capture_error == OK:
				captures.append(shot)
	var result = {
		"passed": failures.is_empty(),
		"checks": checks,
		"failures": failures,
		"captures": captures,
		"scope":
		(
			"Native editor profile selection, physical canvas clicks and undo/redo; "
			+ "layout at two sizes and text scales. Automated, not human usability "
			+ "acceptance."
		)
	}
	Storage.write_json("res://reports/content-editor-interaction-tests.json", result)
	print("CONTENT_EDITOR_INTERACTIONS ", JSON.stringify(result))
	quit(0 if failures.is_empty() else 1)
