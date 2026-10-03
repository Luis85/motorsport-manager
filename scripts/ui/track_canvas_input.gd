class_name TrackCanvasInput
extends RefCounted
## Native pointer interpretation only. The canvas owns presentation state;
## TrackCanvasGesture freezes drag targets and TrackEditorSession commits history.


static func dispatch(canvas: TrackCanvas, event: InputEvent) -> void:
	if event is InputEventMouseButton:
		button(canvas, event)
	elif event is InputEventMouseMotion:
		motion(canvas, event)


static func button(canvas: TrackCanvas, event: InputEventMouseButton) -> void:
	canvas.last_mouse = event.position
	if event.button_index in [MOUSE_BUTTON_WHEEL_UP, MOUSE_BUTTON_WHEEL_DOWN] and event.pressed:
		var before = canvas.world(event.position)
		canvas.zoom = clampf(
			canvas.zoom * (1.15 if event.button_index == MOUSE_BUTTON_WHEEL_UP else 1 / 1.15),
			0.025,
			20
		)
		canvas.center += before - canvas.world(event.position)
		canvas.navigated.emit()
		canvas.queue_redraw()
		canvas.accept_event()
		return
	if event.button_index in [MOUSE_BUTTON_MIDDLE, MOUSE_BUTTON_RIGHT]:
		canvas.panning = event.pressed
		canvas.navigated.emit()
		canvas.accept_event()
		return
	if event.button_index != MOUSE_BUTTON_LEFT:
		return
	canvas.grab_focus()
	if canvas.editing and canvas.mode in ["trace_freehand", "trace_pen"]:
		canvas.sketch_input(event)
		canvas.accept_event()
		return
	if not event.pressed:
		if canvas.marquee_start != Vector2.INF:
			canvas.finish_marquee()
			canvas.accept_event()
			return
		canvas._commit_drag()
		canvas.accept_event()
		return
	press_at(canvas, event)


static func press_at(canvas: TrackCanvas, event: InputEventMouseButton) -> void:
	var p = canvas.world(event.position)
	if _observe_press(canvas, event, p):
		return
	if canvas.mode not in ["measure", "select"] and not canvas.layer_editable(canvas.tool_layer()):
		canvas.accept_event()
		return
	if _place_tool(canvas, event, p):
		return
	if (
		canvas.layer_editable("road")
		and canvas.selection_ids.size() <= 1
		and canvas.selected >= 0
		and canvas.selected < canvas.document.nodes.size()
	):
		for key in ["in", "out"]:
			var n = canvas.document.nodes[canvas.selected]
			if (
				canvas.screen(TrackDocument.point(n) + TrackDocument.handle(n, key)).distance_to(
					event.position
				)
				< 11
			):
				canvas._begin_drag(key, p - TrackDocument.point(n) - TrackDocument.handle(n, key))
				return
	if canvas.mode == "start" and canvas.geometry:
		canvas.edit_started.emit()
		canvas.document.start = canvas.geometry.nearest(p).fraction
		canvas._rebuild_due = true
		canvas.edited.emit()
		return
	if canvas.mode == "draw":
		canvas.edit_started.emit()
		canvas.document.nodes.append(
			TrackDocument.node_at(p, 14.0, TrackDocument.next_node_id(canvas.document.nodes))
		)
		canvas.selected = canvas.document.nodes.size() - 1
		canvas._rebuild_due = true
		canvas.edited.emit()
		canvas.selection_changed.emit()
		canvas.queue_redraw()
		return
	if (
		(canvas.mode == "insert" or event.double_click)
		and canvas.geometry
		and canvas.layer_editable("road")
	):
		var nearest = canvas.geometry.nearest(p)
		if nearest.distance * canvas.zoom < 50:
			canvas.edit_started.emit()
			canvas.selected = TrackDocument.split_segment(
				canvas.document, nearest.segment, clampf(nearest.t, 0.03, 0.97)
			)
			canvas._rebuild_due = true
			canvas.edited.emit()
			canvas.selection_changed.emit()
			canvas.queue_redraw()
			return
	select_at(canvas, event, p)


static func select_at(canvas: TrackCanvas, event: InputEventMouseButton, p: Vector2) -> void:
	var kind = "road"
	var hit = -1
	if canvas.mode != "select_objects":
		for i in range(canvas.document.nodes.size()):
			if (
				canvas.layer_editable("road")
				and (
					canvas.screen(TrackDocument.point(canvas.document.nodes[i])).distance_to(
						event.position
					)
					< 11
				)
			):
				hit = i
				break
	if hit < 0:
		kind = "scenery"
		for i in range(canvas.document.objects.size() - 1, -1, -1):
			if (
				canvas.layer_editable("scenery")
				and (
					canvas.screen(TrackDocument.point(canvas.document.objects[i])).distance_to(
						event.position
					)
					< 14
				)
			):
				hit = i
				break
	if hit >= 0:
		var ids: Array = canvas.selection_ids.duplicate() if canvas.selection_kind == kind else []
		var linked = canvas.group_members(hit) if kind == "scenery" else [hit]
		if event.shift_pressed:
			var remove = hit in ids
			for index in linked:
				if remove:
					ids.erase(index)
				elif index not in ids:
					ids.append(index)
		elif hit not in ids:
			ids = linked
		canvas.select_items(kind, ids)
		if not event.shift_pressed and not canvas.selection_ids.is_empty():
			canvas._begin_drag("multi", p)
	else:
		if not event.shift_pressed:
			canvas.select_items(
				"scenery" if canvas.mode == "select_objects" else canvas.selection_kind, []
			)
		canvas.marquee_start = p
		canvas.marquee_end = p
	canvas.queue_redraw()


static func motion(canvas: TrackCanvas, event: InputEventMouseMotion) -> void:
	canvas.last_mouse = event.position
	if canvas.panning:
		canvas.center -= Vector2(event.relative.x, -event.relative.y) / canvas.zoom
		canvas.queue_redraw()
		return
	if canvas.editing and canvas.mode == "trace_freehand" and not canvas.stroke.is_empty():
		var point = canvas.world(event.position)
		if canvas.stroke[-1].distance_to(point) * canvas.zoom > 3 and canvas.stroke.size() < 12000:
			canvas.stroke.append(point)
		canvas.queue_redraw()
		return
	if canvas.marquee_start != Vector2.INF:
		canvas.marquee_end = canvas.world(event.position)
		canvas.queue_redraw()
		return
	if not canvas.dragging.is_empty():
		canvas.gesture.move(canvas, event)
	elif canvas.mode == "measure" and canvas.measure_start != Vector2.INF:
		canvas.queue_redraw()


static func _observe_press(canvas: TrackCanvas, event: InputEventMouseButton, p: Vector2) -> bool:
	if (
		canvas.editing
		and canvas.show_profile
		and canvas.geometry
		and Rect2(Vector2(20, canvas.size.y - 126), Vector2(canvas.size.x - 40, 75)).has_point(
			event.position
		)
	):
		var fraction = clampf((event.position.x - 28) / maxf(1, canvas.size.x - 56), 0, 0.9999)
		canvas.selected = canvas.geometry.source_segments[int(
			fraction * canvas.geometry.points.size()
		)]
		canvas.selected_object = -1
		canvas.selection_changed.emit()
		canvas.queue_redraw()
		return true
	if not canvas.editing:
		if canvas.visual_source != null:
			var current = canvas.visual_source.capture()
			var best = 22.0
			var id = -1
			for c in current.get("cars", []):
				var distance = canvas.screen(c.current_position).distance_to(event.position)
				if distance < best:
					best = distance
					id = c.id
			if id >= 0:
				canvas.car_selected.emit(id)
		return true
	if canvas.mode == "measure":
		if canvas.measure_start == Vector2.INF or canvas.measure_end != Vector2.INF:
			canvas.measure_start = p
			canvas.measure_end = Vector2.INF
		else:
			canvas.measure_end = p
			canvas.measured.emit(canvas.measure_start.distance_to(p))
		canvas.queue_redraw()
		return true
	return false


static func _place_tool(canvas: TrackCanvas, event: InputEventMouseButton, p: Vector2) -> bool:
	if canvas.mode == "reference":
		if canvas.document.has("reference"):
			canvas._begin_drag("reference", p)
		return true
	if canvas.mode == "scenery":
		var preset = canvas.scenery_preset.duplicate(true)
		if preset.is_empty():
			preset = {"object_type": canvas.scenery_type, "scale": 1.0, "rotation_deg": 0.0}
		var object = EditorProfileDefinition.placement_object(preset, p)
		if object.is_empty():
			return true
		canvas.edit_started.emit()
		canvas.document.objects.append(object)
		canvas.selected_object = canvas.document.objects.size() - 1
		canvas.selected = -1
		canvas.edited.emit()
		canvas.selection_changed.emit()
		canvas.queue_redraw()
		return true
	if canvas.mode == "pit":
		if canvas.document.pits.is_empty():
			return true
		canvas.selected_pit = -1
		for i in range(canvas.document.pits[0].nodes.size()):
			if (
				canvas.screen(TrackDocument.point(canvas.document.pits[0].nodes[i])).distance_to(
					event.position
				)
				< 12
			):
				canvas.selected_pit = i
				break
		if canvas.selected_pit >= 0:
			canvas._begin_drag(
				"pit", p - TrackDocument.point(canvas.document.pits[0].nodes[canvas.selected_pit])
			)
		elif event.shift_pressed:
			canvas.edit_started.emit()
			canvas.document.pits[0].nodes.append(
				TrackDocument.node_at(
					p, 5, TrackDocument.next_node_id(canvas.document.pits[0].nodes)
				)
			)
			canvas._rebuild_due = true
			canvas.edited.emit()
		canvas.selection_changed.emit()
		canvas.queue_redraw()
		return true
	return false
