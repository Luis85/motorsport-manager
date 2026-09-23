extends RefCounted
## Exercise real native input, stable controls and explicit draft transactions.
var h

func run(harness) -> void:
	h = harness
	h.root.size = Vector2i(1440, 900)
	h.game.show_editor(); await h.settle()
	await selection_tests(h.game.editor)
	await sketch_tests(h.game.editor)
	await guide_tests(h.game.editor)
	await race_tests()

func check(value: bool, text: String) -> void:
	h.check(value, "Iteration 4 UI: " + text)

func click(canvas, at: Vector2, shift: bool = false) -> void:
	var event = InputEventMouseButton.new()
	event.position = at; event.button_index = MOUSE_BUTTON_LEFT; event.pressed = true; event.shift_pressed = shift
	canvas._gui_input(event)
	event = event.duplicate(); event.pressed = false; canvas._gui_input(event)

func fixture(editor) -> void:
	var d = h.root.get_node("App").library[7].duplicate(true)
	d.objects = []
	for p in [Vector2(-100, 40), Vector2(0, 65), Vector2(160, 40)]:
		d.objects.append({"type": "tree", "x": p.x, "y": p.y, "h": 0, "scale": 1.0, "rotation": 0.0})
	editor.replace_document(d)
	editor.canvas.center = Vector2.ZERO; editor.canvas.zoom = 1.0

func selection_tests(editor) -> void:
	fixture(editor); editor.set_tool(10); await h.settle()
	var canvas = editor.canvas
	click(canvas, canvas.screen(Vector2(-100, 40)))
	click(canvas, canvas.screen(Vector2(0, 65)), true)
	check(canvas.selection_ids == [0, 1] and editor.context_bar.visible, "Shift-click selects two scenery objects and reveals contextual actions")
	editor.context_bar.get_child(2).pressed.emit()
	check(editor.document.objects[0].group == editor.document.objects[1].group, "contextual Group button persists membership")
	canvas.select_items("scenery", [])
	click(canvas, canvas.screen(TrackDocument.point(editor.document.objects[0])))
	check(canvas.selection_ids == [0, 1], "clicking a grouped object selects its members")
	var original = editor.document.duplicate(true); var history = editor.undo_stack.size()
	var at = canvas.screen(TrackDocument.point(editor.document.objects[0]))
	h.mouse_button(canvas, at, true); h.mouse_drag(canvas, at, at + Vector2(24, -18)); h.mouse_button(canvas, at + Vector2(24, -18), false)
	check(editor.undo_stack.size() == history + 1, "group drag commits one undo entry")
	check(is_equal_approx(editor.document.objects[0].x, original.objects[0].x + 24) and is_equal_approx(editor.document.objects[1].y, original.objects[1].y + 18), "group drag uses authored metre coordinates")
	editor.undo(); check(editor.document == original, "undo restores the entire group")
	editor.redo(); original = editor.document.duplicate(true)
	at = canvas.screen(TrackDocument.point(editor.document.objects[0]))
	h.mouse_button(canvas, at, true); h.mouse_drag(canvas, at, at + Vector2(19, 10))
	var escape = InputEventKey.new(); escape.pressed = true; escape.keycode = KEY_ESCAPE
	canvas._unhandled_key_input(escape)
	check(editor.document == original and canvas.dragging.is_empty(), "Escape cancels a group drag without retaining partial movement")
	canvas.select_items("scenery", [0, 1]); editor.selection_action("duplicate")
	check(editor.document.objects.size() == 5 and canvas.selection_ids == [3, 4], "Duplicate selects the new scenery only")
	editor.undo(); canvas.select_items("scenery", [])
	at = canvas.screen(Vector2(-180, 115)); var end = canvas.screen(Vector2(220, -20))
	h.mouse_button(canvas, at, true); h.mouse_drag(canvas, at, end); h.mouse_button(canvas, end, false)
	check(canvas.selection_ids.size() == 3, "marquee selects all three enclosed objects")
	editor.inspector.current_tab = 0
	await h.capture("20-editor-multi-selection")
	check(h.is_visible_inside(editor.section_picker), "inspector topic selector stays inside the viewport")
	canvas.layer_state.scenery.locked = true; original = editor.document.duplicate(true)
	editor.selection_action("delete")
	check(editor.document == original, "locked scenery rejects contextual delete")
	canvas.layer_state.scenery.locked = false

func sketch_tests(editor) -> void:
	fixture(editor); editor.set_tool(8); await h.settle()
	var canvas = editor.canvas; canvas.zoom = 0.8
	var original = editor.document.duplicate(true)
	var points = [Vector2(-260, -160), Vector2(230, -160), Vector2(310, 0), Vector2(230, 170), Vector2(-260, 170)]
	var at = canvas.screen(points[0]); h.mouse_button(canvas, at, true)
	for p in points.slice(1):
		var next = canvas.screen(p); h.mouse_drag(canvas, at, next); at = next
	h.mouse_button(canvas, at, false)
	check(canvas.sketch.strokes.size() == 1 and editor.document == original, "freehand drawing is a transient trace, not an immediate road replacement")
	check(editor.dirty and editor.test_button.disabled, "pending trace is protected and cannot be used as a completed weekend circuit")
	editor.undo(); check(canvas.sketch.strokes.is_empty() and editor.document == original, "toolbar undo targets the active trace")
	editor.redo(); check(canvas.sketch.strokes.size() == 1, "toolbar redo restores the trace")
	check(not editor.race_errors().is_empty(), "runtime entry guard detects unfinished drawing")
	editor.set_tool(9); await h.settle()
	click(canvas, canvas.screen(points[-1])); click(canvas, canvas.screen(points[0]))
	check(canvas.sketch.strokes.size() == 2, "pen mode continues the existing freehand endpoint")
	editor.confirm_clear_trace()
	var dialogs = editor.get_children().filter(func(node): return node is ConfirmationDialog and node.visible)
	check(dialogs.size() == 1, "clearing a nonempty trace requires confirmation")
	if not dialogs.is_empty(): dialogs[0].get_cancel_button().pressed.emit(); dialogs[0].hide()
	check(canvas.sketch.strokes.size() == 2, "cancelling Clear retains the draft")
	check(canvas.sketch.close_loop(), "trace closes explicitly")
	editor.invalidate_sketch(); editor.preview_sketch(); await h.settle()
	check(editor.sketch_result.get("ok", false) and editor.document == original and canvas.sketch_preview != null, "preview validates a candidate without replacing the authored road")
	check(not editor.sketch_apply_button.disabled, "valid preview enables Apply")
	await h.capture("21-editor-trace-preview")
	check(h.is_visible_inside(editor.sketch_preview_button) and h.is_visible_inside(editor.sketch_apply_button), "trace preview and replacement stay visible outside the scrolling inspector")
	check(editor.sketch_close_button.disabled and editor.sketch_close_button.text == "Loop closed", "closed-loop state is explicit and cannot accidentally invalidate the preview")
	var action_ids = [editor.sketch_preview_button.get_instance_id(), editor.sketch_apply_button.get_instance_id()]
	editor.refresh_inspector(); await h.settle()
	check(action_ids == [editor.sketch_preview_button.get_instance_id(), editor.sketch_apply_button.get_instance_id()], "trace commit controls retain identity across inspector rebuilds")
	h.root.size = Vector2i(1100, 720); await h.settle()
	check(h.is_visible_inside(editor.sketch_preview_button) and h.is_visible_inside(editor.sketch_apply_button), "trace actions stay reachable at the minimum desktop viewport")
	h.root.size = Vector2i(1440, 900); await h.settle()
	editor.apply_sketch()
	dialogs = editor.get_children().filter(func(node): return node is ConfirmationDialog and node.visible)
	check(dialogs.size() == 1 and editor.document == original, "replacement is confirmed before modifying the circuit")
	if not dialogs.is_empty(): dialogs[0].get_cancel_button().pressed.emit(); dialogs[0].hide()
	check(editor.document == original, "cancelling Apply leaves the original circuit untouched")
	editor.perform(func(): editor.document.objects[0].x += 3)
	check(editor.sketch_result.is_empty() and editor.sketch_apply_button.disabled, "a document edit invalidates a stale preview")
	original = editor.document.duplicate(true)
	editor.preview_sketch(); editor.apply_sketch()
	dialogs = editor.get_children().filter(func(node): return node is ConfirmationDialog and node.visible)
	if not dialogs.is_empty(): dialogs[0].confirmed.emit(); dialogs[0].hide()
	check(canvas.sketch.strokes.is_empty() and editor.document.nodes != original.nodes, "confirmed Apply replaces the road and clears the transient trace")
	check(editor.document.objects == original.objects and editor.document.features.is_empty(), "replacement retains scenery and removes old road-attached features")
	editor.undo(); check(editor.document == original, "one undo restores the entire road replacement")

func guide_tests(editor) -> void:
	var before = editor.document.duplicate(true)
	editor.guide.open_guide(); editor.guide.show_step(2)
	await h.capture("22-editor-guide")
	check(editor.guide.visible and h.is_visible_inside(editor.guide.card), "editor walkthrough fits within the workspace")
	editor.guide.dismiss(); editor.guide.open_guide(); await h.settle()
	check(editor.guide.step_index == 2 and editor.inspector.current_tab == 6, "editor walkthrough resumes and reveals its explained surface")
	check(editor.document == before, "walkthrough navigation does not edit the circuit")
	editor.guide.dismiss()

func race_tests() -> void:
	var app = h.root.get_node("App")
	app.weekend = RaceSim.new(TrackGeometry.new(app.library[7]), {"laps": 6, "scenario": "wet", "intensity": "calm"})
	h.game.show_weekend(); await h.settle()
	var view = h.game.content.get_child(0)
	view.select_driver(3); view.tabs.current_tab = 4; view.refresh(); await h.settle()
	view.set_detail_expanded(true); await h.settle()
	var panel = view.racecraft; var before = app.weekend.cars[3].car_setup.duplicate()
	panel.fields.wing.value = 8; panel.fields.bias.value = 59; panel.fields.cooling.value = 7
	for i in range(20): view.refresh()
	check(app.weekend.cars[3].car_setup == before and panel.fields.wing.value == 8, "setup controls stage an independent draft through live refreshes")
	view.select_driver(6); view.select_driver(3)
	check(panel.fields.wing.value == 8, "switching teammates preserves per-driver setup drafts")
	await h.capture("23-staged-setup")
	check(h.is_visible_inside(panel.apply_button) and h.is_visible_inside(panel.reset_button), "Apply and Revert remain outside scrollable setup fields")
	check(not view.timing_panel.visible and view.canvas.visible, "expanded detail makes room without replacing the race map")
	panel.apply_button.pressed.emit(); view.refresh()
	check(app.weekend.cars[3].car_setup.wing == 8 and panel.apply_button.disabled, "Apply commits the complete setup and clears draft dirtiness")
	view.select_driver(0); view.refresh()
	check(not panel.fields.wing.editable and panel.apply_button.disabled, "rival setup stays inspect-only")
	view.select_driver(3)
	app.weekend.command("prepare_race"); app.weekend.command("formation")
	for car in app.weekend.cars: car.formation_done = true
	app.weekend.step(); app.weekend.command("lights")
	for i in range(450): app.weekend.step()
	app.weekend.paused = true; view.refresh()
	check(not panel.fields.wing.editable and panel.bias.editable, "mechanical setup locks on track while live brake bias remains available")
	panel.bias.value = 61; panel.bias_button.pressed.emit(); view.refresh()
	check(app.weekend.cars[3].car_setup.bias == 61, "live brake-bias action affects the selected car")
	view.show_tyres(1); view.refresh(); await h.settle()
	var ids = view.wheel_dashboard.cards.values().map(func(control): return control.get_instance_id())
	view.wheel_dashboard.cards.RR.pressed.emit()
	for i in range(20): view.refresh()
	check(ids == view.wheel_dashboard.cards.values().map(func(control): return control.get_instance_id()), "wheel controls keep stable identities during telemetry refresh")
	check(view.wheel_dashboard.details.text.begins_with("RR"), "wheel selection exposes the chosen contact-patch details")
	await h.capture("24-four-wheel-tyres")
	view.tabs.current_tab = 5; view.refresh(); await h.settle()
	var clock = app.weekend.clock; var rng = app.weekend.rng_state
	var chart = view.surface_lab.chart
	var area = chart.field_rect()
	click(chart, area.position + area.size * Vector2(0.42, 0.8))
	check(chart.station == 40 and chart.lane == 5, "surface heatmap click selects the addressed station and lateral strip")
	check(app.weekend.clock == clock and app.weekend.rng_state == rng, "surface inspection leaves simulation time and randomness untouched")
	view.surface_lab.picker.select(2); view.surface_lab.picker.item_selected.emit(2)
	view.canvas.show_surface = true
	await h.capture("25-surface-laboratory")
	check(view.canvas.surface_channel == "grip", "laboratory channel drives the map overlay")
	view.guide.open_guide(); view.guide.show_step(3)
	await h.capture("26-pit-wall-guide")
	check(h.is_visible_inside(view.guide.card) and app.weekend.clock == clock, "pit-wall walkthrough fits without changing simulation time")
	view.guide.dismiss(); view.guide.open_guide(); await h.settle()
	check(view.guide.step_index == 3 and view.tabs.current_tab == 3, "pit-wall walkthrough resumes the tyre-management step")
	view.guide.dismiss()
	view.radio_filter = "tyre"; view.last_event_count = -1; view.refresh()
	check(app.weekend.clock == clock and app.weekend.rng_state == rng, "radio filtering is observational")
	view.set_detail_expanded(false); h.root.size = Vector2i(1100, 720)
	view.show_tyres(1); view.refresh()
	await h.capture("27-small-window-tyres")
	check(h.is_visible_inside(view.box_button) and h.is_visible_inside(view.detail_picker), "small-window pit action and topic selector remain reachable")
	check(view.canvas.size.x > 240, "small-window tyre inspection retains a useful race map")
	view.set_detail_expanded(true); view.tabs.current_tab = 4; await h.settle()
	check(h.is_visible_inside(panel.apply_button) and h.is_visible_inside(view.box_button), "expanded small-window setup keeps both commit and primary commands visible")
	check(view.canvas.size.x > 250 and h.is_visible_inside(view.expand_button), "expanded detail remains reversible with a visible circuit")
	view.set_detail_expanded(false)
	app.restore_settings({"guides": {"editor": 2.5, "pit wall": "bad"}})
	check(app.settings.guides.editor == 2, "invalid guide progress cannot replace the last valid step")
