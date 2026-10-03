class_name TrackCanvasAuthoring
extends TrackCanvasState
## Native presentation responsibilities; inherited state remains per instance.


func _gui_input(event: InputEvent) -> void:
	TrackCanvasInput.dispatch(self, event)


func _begin_drag(kind: String, offset: Vector2) -> void:
	gesture.begin(self, kind, offset)


func _commit_drag() -> void:
	gesture.commit(self)


func _unhandled_key_input(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed or event.keycode != KEY_ESCAPE:
		return
	if not stroke.is_empty() or pen_anchor != Vector2.INF or marquee_start != Vector2.INF:
		stroke.clear()
		pen_anchor = Vector2.INF
		marquee_start = Vector2.INF
		queue_redraw()
		get_viewport().set_input_as_handled()
	elif not dragging.is_empty():
		gesture.cancel(self)
		get_viewport().set_input_as_handled()


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_WINDOW_FOCUS_OUT:
		panning = false
		_commit_drag()
	elif what == NOTIFICATION_EXIT_TREE:
		gesture.reset()


func select_items(kind: String, ids: Array) -> void:
	gesture.cancel(self)
	selection_kind = kind
	selection_ids = TrackEdit.indices(document, kind, ids)
	selected = selection_ids[0] if kind == "road" and not selection_ids.is_empty() else -1
	selected_object = selection_ids[0] if kind == "scenery" and not selection_ids.is_empty() else -1
	selection_changed.emit()
	queue_redraw()


func group_members(index: int) -> Array:
	var group = str(document.objects[index].get("group", ""))
	if group.is_empty():
		return [index]
	var ids: Array = []
	for i in range(document.objects.size()):
		if document.objects[i].get("group", "") == group:
			ids.append(i)
	return ids


func finish_marquee() -> void:
	var rectangle = Rect2(marquee_start, marquee_end - marquee_start).abs()
	var kind = "scenery" if mode == "select_objects" else selection_kind
	var ids: Array = selection_ids.duplicate()
	if layer_editable(kind):
		var items: Array = document.nodes if kind == "road" else document.objects
		for i in range(items.size()):
			if rectangle.has_point(TrackDocument.point(items[i])):
				for linked in group_members(i) if kind == "scenery" else [i]:
					if linked not in ids:
						ids.append(linked)
	marquee_start = Vector2.INF
	marquee_end = Vector2.INF
	select_items(kind, ids)


func draw_selection() -> void:
	TrackCanvasOverlays.paint_selection(
		self,
		document,
		selection_kind,
		selection_ids,
		marquee_start,
		marquee_end,
		Callable(self, "screen")
	)


func sketch_input(event: InputEventMouseButton) -> void:
	if not layer_editable("road") or sketch.closed:
		return
	var point = world(event.position)
	var existing = sketch.points()
	if mode == "trace_pen":
		if not event.pressed:
			return
		if pen_anchor == Vector2.INF:
			pen_anchor = point if existing.is_empty() else existing[-1]
		else:
			if event.shift_pressed:
				var delta = point - pen_anchor
				point = (
					pen_anchor
					+ Vector2.RIGHT.rotated(snappedf(delta.angle(), PI / 12)) * delta.length()
				)
			if pen_anchor.distance_to(point) > 0.5:
				sketch.add_stroke(PackedVector2Array([pen_anchor, point]), 16 / zoom)
				pen_anchor = point
				sketch_preview = null
				sketch_changed.emit()
		queue_redraw()
		return
	if event.pressed:
		if not existing.is_empty() and point.distance_to(existing[-1]) * zoom > 20:
			sketch_note = "Continue at the END marker; pan with right-drag between strokes."
			sketch_changed.emit()
			return
		stroke = PackedVector2Array([point if existing.is_empty() else existing[-1]])
	else:
		if stroke.size() >= 2:
			sketch.add_stroke(stroke, 20 / zoom)
			sketch_preview = null
			sketch_note = "Stroke saved. Continue at END, or close the loop when ready."
		stroke.clear()
		sketch_changed.emit()
	queue_redraw()


func draw_sketch() -> void:
	var points = sketch.points()
	var trace = PackedVector2Array()
	for point in points:
		trace.append(screen(point))
	if trace.size() >= 2:
		draw_polyline(trace, CircuitPalette.ACCENT, 2.5, true)
		if sketch.closed:
			draw_dashed_line(trace[-1], trace[0], CircuitPalette.ACCENT, 2, 7)
		for label in [["START", trace[0]], ["END", trace[-1]]]:
			draw_circle(label[1], 7, CircuitPalette.PANEL)
			draw_string(
				ThemeDB.fallback_font,
				label[1] + Vector2(9, -9),
				label[0],
				HORIZONTAL_ALIGNMENT_LEFT,
				-1,
				12,
				CircuitPalette.ACCENT
			)
	var current = PackedVector2Array()
	for point in stroke:
		current.append(screen(point))
	if current.size() >= 2:
		draw_polyline(current, CircuitPalette.GOOD, 2, true)
	if pen_anchor != Vector2.INF:
		draw_line(screen(pen_anchor), last_mouse, CircuitPalette.GOOD, 1.5, true)
	if sketch_preview:
		var preview = PackedVector2Array()
		for point in sketch_preview.points:
			preview.append(screen(point))
		preview.append(preview[0])
		draw_polyline(preview, Color("467c78"), 3, true)
