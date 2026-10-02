class_name TrackCanvas
extends Control
## Native 2D projection. Static track and moving cars are drawn on separate canvases.
signal sketch_changed
signal navigated
signal edit_cancelled
signal edit_started
signal edited
signal gesture_committed(observed_revision: int)
signal selection_changed
signal car_selected(id: int)
signal measured(metres: float)
var selection_kind = "road"
var selection_ids: Array[int] = []
var marquee_start = Vector2.INF
var marquee_end = Vector2.INF
var sketch = TrackSketch.new()
var sketch_preview: TrackGeometry
var stroke = PackedVector2Array()
var pen_anchor = Vector2.INF
var sketch_note = "Trace a new loop without altering the current circuit."
var show_surface = false
var world_layer: CircuitWorld
var layer_state = {"road": {"visible": true, "locked": false}, "pits": {"visible": true, "locked": false}, "scenery": {"visible": true, "locked": false}, "features": {"visible": true, "locked": false}, "reference": {"visible": true, "locked": false}}
var reference_preview: TrackPreviewHandle
var draft_compiler: Callable
var preview_running = false
var preview_distance = 0.0
var preview_laps = 0
var preview_elapsed = 0.0
var dot_scale = 1.0
var rich_scenery = true
var selected_object = -1
var scenery_type = "tree"
var scenery_preset: Dictionary = {}
var diagnostics: Array = []
var gesture = TrackCanvasGesture.new()
var document_revision: int = 0
var surface_layer: SurfaceOverlay
var geometry: TrackGeometry
var document: Dictionary = {}
var visual_source: RaceVisualPort
var visual_frame: Dictionary = {}
var editing = false
var show_line = false
var show_labels = true
var show_grid = true
var show_profile = false
var surface_channel = "water"
var inspected_fraction = -1.0
var mode = "select"
var selected = -1
var selected_pit = -1
var zoom = 1.0
var fit_view_enabled = true
# Presentation padding; the editor and Engineering layout retain the original inset.
var fit_padding = Vector2(90, 110)
var center = Vector2.ZERO
var panning = false
var dragging: String:
	get: return gesture.kind
var last_mouse = Vector2.ZERO
var measure_start = Vector2.INF
var measure_end = Vector2.INF
var backdrop: Texture2D
var backdrop_key = ""
var overlay: CarOverlay
var _rebuild_due = false
var _rebuild_clock = 0.0
var visual_revision = 0
var _visual_stamp: Array = []
var _surface_geometry: TrackGeometry
var _surface_segments: Array = []
var surface_geometry_builds = 0
var _car_label_style = UI.box(Color("f5eedacc"), Color("b1bca280"), 3, 0)
var _surface_legend_style = UI.box(Color("f7f2e4ee"))

class CarOverlay extends Control:
	var host: TrackCanvas
	func _draw():
		if host != null: host.draw_cars(self)

class SurfaceOverlay extends Control:
	var host: TrackCanvas
	var clock = 0.0
	var stamp: Array = []
	func _process(delta):
		clock -= delta
		if host == null or clock > 0: return
		clock = 0.3
		var next = [host.show_surface, host.surface_channel, host.inspected_fraction, host.center, host.zoom, host.size, host.geometry]
		if host.show_surface and host.visual_source: next.append(host.visual_frame.get("total_time", 0.0))
		if next != stamp: stamp = next; queue_redraw()
	func _draw():
		if host != null: host.draw_surface(self)

func configure_presentation(preferences: Dictionary) -> void:
	rich_scenery = preferences.get("scenery_detail", "rich") == "rich"
	dot_scale = float(preferences.get("dot_scale", 1.0))

func _ready() -> void:
	clip_contents = true
	world_layer = CircuitWorld.new(); world_layer.show_behind_parent = true; add_child(world_layer)
	if geometry: world_layer.configure(geometry, document, rich_scenery)
	world_layer.reference_texture = backdrop; world_layer.reference_visible = editing and layer_visible("reference")
	mouse_default_cursor_shape = Control.CURSOR_CROSS if editing else Control.CURSOR_ARROW
	focus_mode = Control.FOCUS_ALL
	custom_minimum_size = Vector2(300, 300)
	size_flags_horizontal = Control.SIZE_EXPAND_FILL; size_flags_vertical = Control.SIZE_EXPAND_FILL
	surface_layer = SurfaceOverlay.new(); surface_layer.host = self; surface_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(surface_layer); surface_layer.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	overlay = CarOverlay.new(); overlay.host = self; overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(overlay); overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	resized.connect(func():
		queue_redraw()
		if fit_view_enabled: call_deferred("fit"))
	navigated.connect(func(): fit_view_enabled = false)

func set_track(g: TrackGeometry, live_document: Dictionary = {}) -> void:
	# Replacement/undo/redo never retarget an in-flight pointer operation.
	gesture.reset()
	marquee_start = Vector2.INF
	marquee_end = Vector2.INF
	geometry = g if not live_document.is_empty() else g.detached_copy()
	if reference_preview: reference_preview.stop()
	preview_running = false
	_rebuild_due = false
	document = live_document if not live_document.is_empty() else geometry.document
	_load_backdrop()
	if world_layer:
		world_layer.configure(geometry, document, rich_scenery)
		world_layer.reference_texture = backdrop; world_layer.reference_visible = editing and layer_visible("reference")
	queue_redraw()
	if overlay: overlay.queue_redraw()

func fit() -> void:
	fit_view_enabled = true
	if geometry == null or geometry.points.is_empty(): return
	var visible_bounds = geometry.bounds
	for p in geometry.pit_points: visible_bounds = visible_bounds.expand(p)
	for marker in geometry.pit_markers():
		var station = geometry.pit_sample(geometry.pit_length * marker.fraction)
		var roof = station.p + station.n * 18
		visible_bounds = visible_bounds.expand(roof + Vector2(30, 30)).expand(roof - Vector2(30, 30))
	visible_bounds = visible_bounds.grow(20)
	center = visible_bounds.get_center()
	zoom = minf(maxf(100, size.x - fit_padding.x) / maxf(20, visible_bounds.size.x), maxf(100, size.y - fit_padding.y) / maxf(20, visible_bounds.size.y))
	zoom = clampf(zoom, 0.04, 12)
	queue_redraw()

func world(p: Vector2) -> Vector2:
	var v = (p - size * 0.5) / zoom
	return center + Vector2(v.x, -v.y)

func screen(p: Vector2) -> Vector2:
	var v = (p - center) * zoom
	return size * 0.5 + Vector2(v.x, -v.y)

func _load_backdrop() -> void:
	var key = str(document.get("reference", {}).get("png", ""))
	if key == backdrop_key: return
	backdrop_key = key; backdrop = null
	if key.is_empty() or key.length() > 11000000: return
	var bytes = Marshalls.base64_to_raw(key)
	var image = Image.new()
	if image.load_png_from_buffer(bytes) == OK: backdrop = ImageTexture.create_from_image(image)

func _process(delta: float) -> void:
	if reference_preview:
		var preview_frame = reference_preview.capture()
		preview_running = preview_frame.running
		preview_distance = preview_frame.distance
		preview_elapsed = preview_frame.elapsed
		preview_laps = preview_frame.laps
	_rebuild_clock -= delta
	if _rebuild_due and _rebuild_clock <= 0 and document.get("nodes", []).size() >= 4:
		_rebuild_due = false; _rebuild_clock = 0.06
		if draft_compiler.is_valid():
			var draft_geometry = draft_compiler.call(document, geometry.preset if geometry else "Formula", true)
			if draft_geometry: geometry = draft_geometry
		if world_layer: world_layer.configure(geometry, document, rich_scenery)
		queue_redraw()

	# The query port returns detached values; drawing cannot mutate the live aggregate.
	visual_frame = visual_source.capture() if visual_source != null else {}
	var stamp: Array = [center, zoom, size, show_labels, dot_scale, preview_running, preview_distance, geometry, visual_frame]
	if stamp != _visual_stamp:
		_visual_stamp = stamp; visual_revision += 1
		if overlay: overlay.queue_redraw()

func _draw() -> void:
	if surface_layer: surface_layer.queue_redraw()
	if overlay: overlay.queue_redraw()
	if world_layer:
		world_layer.position = size * 0.5 - Vector2(center.x, -center.y) * zoom
		world_layer.scale = Vector2(zoom, -zoom)
	var font = ThemeDB.fallback_font
	if show_grid:
		var grid = 50.0
		while grid * zoom < 35: grid *= 2
		while grid * zoom > 140: grid *= 0.5
		var lo = world(Vector2(0, size.y)); var hi = world(Vector2(size.x, 0))
		var x = floor(lo.x / grid) * grid
		while x < hi.x:
			draw_line(screen(Vector2(x, lo.y)), screen(Vector2(x, hi.y)), Color("6d875421"), 1); x += grid
		var y = floor(lo.y / grid) * grid
		while y < hi.y:
			draw_line(screen(Vector2(lo.x, y)), screen(Vector2(hi.x, y)), Color("6d875421"), 1); y += grid
	if geometry == null or geometry.points.is_empty():
		draw_string(font, Vector2(36, 70), "Click to lay out your circuit. Add at least four points.", HORIZONTAL_ALIGNMENT_LEFT, -1, 18, CircuitPalette.MUTED)
	else:
		var n = geometry.points.size()
		if show_line and layer_visible("road") and not geometry.preview_only:
			for i in range(n):
				var color = Color("dde6a0") if geometry.speeds[i] > 45 else Color("e2b48d")
				draw_line(screen(geometry.line_point(i)), screen(geometry.line_point((i + 1) % n)), color, 1.7, true)
		var start = geometry.sample(0)
		var left = start.p + start.n * start.w * 0.55
		var right = start.p - start.n * start.w * 0.55
		draw_string(font, screen(left) + Vector2(7, -7), "START / FINISH", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color("2d4b3b"))
		for sector in range(1, 3):
			var p = geometry.sample(geometry.sector_ends[sector - 1])
			draw_circle(screen(p.p), 4, Color("48756c"))
			draw_string(font, screen(p.p) + Vector2(8, -6), "S%d" % sector, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color("48756c"))
		for marker in document.get("cornerMarkers", []):
			if not marker.has("x") or not marker.has("y"): continue
			var p = screen(Vector2(marker.x, marker.y))
			draw_circle(p, 2, CircuitPalette.MUTED)
			if zoom > 0.3: draw_string(font, p + Vector2(6, -4), str(marker.get("number", "")), HORIZONTAL_ALIGNMENT_LEFT, -1, 10, CircuitPalette.MUTED)
		if editing and not geometry.preview_only:
			for finding in diagnostics:
				if finding.severity != "error": continue
				var p = screen(geometry.sample(finding.fraction * geometry.length, true).p)
				draw_circle(p, 10, CircuitPalette.DANGER); draw_string(font, p + Vector2(-2, 5), "!", HORIZONTAL_ALIGNMENT_LEFT, -1, 15, CircuitPalette.BG)
		if show_profile: _draw_profile()
	if editing: _draw_editor(); draw_selection(); draw_sketch()
	if measure_start != Vector2.INF:
		var end = measure_end if measure_end != Vector2.INF else world(last_mouse)
		draw_line(screen(measure_start), screen(end), CircuitPalette.ACCENT, 2, true)
		draw_circle(screen(measure_start), 5, CircuitPalette.ACCENT); draw_circle(screen(end), 5, CircuitPalette.ACCENT)
		draw_string(font, (screen(measure_start) + screen(end)) * 0.5 + Vector2(5, -9), "%.1f m" % measure_start.distance_to(end), HORIZONTAL_ALIGNMENT_LEFT, -1, 14, CircuitPalette.ACCENT)
	draw_rect(Rect2(Vector2.ZERO, size), CircuitPalette.LINE, false, 1)
	var scale_metres = pow(10, floor(log(100 / zoom) / log(10)))
	if scale_metres * zoom < 50: scale_metres *= 5
	var at = Vector2(24, size.y - 27)
	draw_line(at, at + Vector2(scale_metres * zoom, 0), CircuitPalette.MUTED, 2)
	draw_string(font, at + Vector2(0, -9), "%d m" % int(scale_metres), HORIZONTAL_ALIGNMENT_LEFT, -1, 11, CircuitPalette.MUTED)
	draw_string(font, Vector2(size.x - 36, 36), "N", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, CircuitPalette.MUTED)
	draw_line(Vector2(size.x - 30, 60), Vector2(size.x - 30, 43), CircuitPalette.MUTED, 1.5)

func build_surface_geometry() -> void:
	TrackCanvasOverlayRenderer.build_surface_geometry(self)

func draw_surface(target: Control) -> void:
	TrackCanvasOverlayRenderer.draw_surface(self, target)

func _draw_editor() -> void:
	var font = ThemeDB.fallback_font
	for i in range(document.get("nodes", []).size()):
		if not layer_visible("road"): continue
		var node = document.nodes[i]
		var p = screen(TrackDocument.point(node))
		if not Rect2(Vector2(-15, -15), size + Vector2(30, 30)).has_point(p): continue
		var chosen = i == selected or selection_kind == "road" and i in selection_ids
		draw_circle(p, 6 if chosen else 3.5, CircuitPalette.ACCENT if chosen else Color("9eb8bd"))
		draw_circle(p, 2, CircuitPalette.BG)
		if chosen and (selection_ids.size() <= 1 or i == selected):
			draw_string(font, p + Vector2(8, -12), "POINT %d" % (i + 1), HORIZONTAL_ALIGNMENT_LEFT, -1, 12, CircuitPalette.ACCENT)
			for key in ["in", "out"]:
				var h = screen(TrackDocument.point(node) + TrackDocument.handle(node, key))
				draw_line(p, h, CircuitPalette.ACCENT, 1, true)
				draw_rect(Rect2(h - Vector2(4, 4), Vector2(8, 8)), CircuitPalette.ACCENT, false, 1.5)
	if selected_object >= 0 and selected_object < document.objects.size():
		var obj = document.objects[selected_object]
		var p = screen(Vector2(obj.x, obj.y))
		draw_rect(Rect2(p - Vector2(15, 15), Vector2(30, 30)), CircuitPalette.ACCENT, false, 1.5)
		draw_string(font, p + Vector2(18, -12), str(obj.type).to_upper(), HORIZONTAL_ALIGNMENT_LEFT, -1, 12, CircuitPalette.ACCENT)
	if mode == "pit" and layer_visible("pits") and not document.get("pits", []).is_empty():
		for i in range(document.pits[0].nodes.size()):
			var p = screen(TrackDocument.point(document.pits[0].nodes[i]))
			draw_circle(p, 5 if i == selected_pit else 3, CircuitPalette.ACCENT)
			if i == selected_pit: draw_string(font, p + Vector2(8, -8), "PIT POINT %d" % (i + 1), HORIZONTAL_ALIGNMENT_LEFT, -1, 12, CircuitPalette.ACCENT)

func _draw_profile() -> void:
	TrackCanvasOverlayRenderer.draw_profile(self)

func draw_cars(target: Control) -> void:
	TrackCanvasOverlayRenderer.draw_cars(self, target)

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

func layer_visible(key: String) -> bool:
	return not editing or layer_state.get(key, {}).get("visible", true)

func layer_editable(key: String) -> bool:
	return layer_visible(key) and not layer_state.get(key, {}).get("locked", false)

func tool_layer() -> String:
	return {"pit": "pits", "scenery": "scenery", "select_objects": "scenery", "reference": "reference"}.get(mode, "road")

func set_layer(key: String, field: String, value: bool) -> void:
	if not layer_state.has(key) or field not in ["visible", "locked"]: return
	_commit_drag()
	layer_state[key][field] = value
	selected = -1; selected_pit = -1; selected_object = -1; selection_ids.clear()
	if world_layer:
		world_layer.road_visible = layer_visible("road")
		world_layer.pits_visible = layer_visible("pits")
		world_layer.scenery_visible = layer_visible("scenery")
		world_layer.features_visible = layer_visible("features")
		world_layer.reference_visible = editing and layer_visible("reference")
		world_layer.queue_redraw()
	selection_changed.emit(); queue_redraw()

func toggle_preview() -> void:
	if reference_preview:
		reference_preview.toggle(geometry)
		preview_running = reference_preview.capture().running
	queue_redraw()

func select_items(kind: String, ids: Array) -> void:
	gesture.cancel(self)
	selection_kind = kind; selection_ids = TrackEdit.indices(document, kind, ids)
	selected = selection_ids[0] if kind == "road" and not selection_ids.is_empty() else -1
	selected_object = selection_ids[0] if kind == "scenery" and not selection_ids.is_empty() else -1
	selection_changed.emit(); queue_redraw()

func group_members(index: int) -> Array:
	var group = str(document.objects[index].get("group", ""))
	if group.is_empty(): return [index]
	var ids: Array = []
	for i in range(document.objects.size()):
		if document.objects[i].get("group", "") == group: ids.append(i)
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
					if linked not in ids: ids.append(linked)
	marquee_start = Vector2.INF; marquee_end = Vector2.INF
	select_items(kind, ids)

func draw_selection() -> void:
	TrackCanvasOverlays.paint_selection(self, document, selection_kind, selection_ids,
		marquee_start, marquee_end, Callable(self, "screen"))

func sketch_input(event: InputEventMouseButton) -> void:
	if not layer_editable("road") or sketch.closed: return
	var point = world(event.position); var existing = sketch.points()
	if mode == "trace_pen":
		if not event.pressed: return
		if pen_anchor == Vector2.INF: pen_anchor = point if existing.is_empty() else existing[-1]
		else:
			if event.shift_pressed:
				var delta = point - pen_anchor; point = pen_anchor + Vector2.RIGHT.rotated(snappedf(delta.angle(), PI / 12)) * delta.length()
			if pen_anchor.distance_to(point) > 0.5:
				sketch.add_stroke(PackedVector2Array([pen_anchor, point]), 16 / zoom); pen_anchor = point; sketch_preview = null; sketch_changed.emit()
		queue_redraw(); return
	if event.pressed:
		if not existing.is_empty() and point.distance_to(existing[-1]) * zoom > 20:
			sketch_note = "Continue at the END marker; pan with right-drag between strokes."; sketch_changed.emit(); return
		stroke = PackedVector2Array([point if existing.is_empty() else existing[-1]])
	else:
		if stroke.size() >= 2:
			sketch.add_stroke(stroke, 20 / zoom); sketch_preview = null
			sketch_note = "Stroke saved. Continue at END, or close the loop when ready."
		stroke.clear(); sketch_changed.emit()
	queue_redraw()

func draw_sketch() -> void:
	var points = sketch.points()
	var trace = PackedVector2Array()
	for point in points: trace.append(screen(point))
	if trace.size() >= 2:
		draw_polyline(trace, CircuitPalette.ACCENT, 2.5, true)
		if sketch.closed: draw_dashed_line(trace[-1], trace[0], CircuitPalette.ACCENT, 2, 7)
		for label in [["START", trace[0]], ["END", trace[-1]]]:
			draw_circle(label[1], 7, CircuitPalette.PANEL)
			draw_string(ThemeDB.fallback_font, label[1] + Vector2(9, -9), label[0], HORIZONTAL_ALIGNMENT_LEFT, -1, 12, CircuitPalette.ACCENT)
	var current = PackedVector2Array()
	for point in stroke: current.append(screen(point))
	if current.size() >= 2: draw_polyline(current, CircuitPalette.GOOD, 2, true)
	if pen_anchor != Vector2.INF: draw_line(screen(pen_anchor), last_mouse, CircuitPalette.GOOD, 1.5, true)
	if sketch_preview:
		var preview = PackedVector2Array()
		for point in sketch_preview.points: preview.append(screen(point))
		preview.append(preview[0]); draw_polyline(preview, Color("467c78"), 3, true)
