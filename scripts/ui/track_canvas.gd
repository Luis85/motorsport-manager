class_name TrackCanvas
extends Control
## Native 2D projection. Static track and moving cars are drawn on separate canvases.
signal sketch_changed
signal navigated
signal edit_cancelled
signal edit_started
signal edited
signal selection_changed
signal car_selected(id: int)
signal measured(metres: float)
var selection_kind = "road"
var selection_ids: Array[int] = []
var drag_origins: Dictionary = {}
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
var preview_running = false
var preview_distance = 0.0
var preview_laps = 0
var preview_elapsed = 0.0
var dot_scale = 1.0
var rich_scenery = true
var selected_object = -1
var scenery_type = "tree"
var diagnostics: Array = []
var _gesture_changed = false
var _drag_offset = Vector2.ZERO
var surface_layer: SurfaceOverlay
var geometry: TrackGeometry
var document: Dictionary = {}
var sim: RaceSim
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
var center = Vector2.ZERO
var panning = false
var dragging = ""
var last_mouse = Vector2.ZERO
var measure_start = Vector2.INF
var measure_end = Vector2.INF
var backdrop: Texture2D
var backdrop_key = ""
var overlay: CarOverlay
var _rebuild_due = false
var _rebuild_clock = 0.0

class CarOverlay extends Control:
	var host: TrackCanvas
	func _draw():
		if host != null: host.draw_cars(self)
	func _process(_delta):
		if host != null and (host.sim != null or host.preview_running): queue_redraw()

class SurfaceOverlay extends Control:
	var host: TrackCanvas
	var clock = 0.0
	var shown = false
	func _process(delta):
		clock -= delta
		if clock <= 0:
			clock = 0.3
			if host != null and (host.show_surface or shown):
				shown = host.show_surface; queue_redraw()
	func _draw():
		if host != null: host.draw_surface(self)

func _ready() -> void:
	clip_contents = true
	rich_scenery = App.settings.get("scenery_detail", "rich") == "rich"
	dot_scale = float(App.settings.get("dot_scale", 1.0))
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
	resized.connect(queue_redraw)

func set_track(g: TrackGeometry, live_document: Dictionary = {}) -> void:
	geometry = g
	preview_running = false
	_rebuild_due = false
	document = live_document if not live_document.is_empty() else g.document
	_load_backdrop()
	if world_layer:
		world_layer.configure(g, document, rich_scenery)
		world_layer.reference_texture = backdrop; world_layer.reference_visible = editing and layer_visible("reference")
	queue_redraw()
	if overlay: overlay.queue_redraw()

func fit() -> void:
	if geometry == null or geometry.points.is_empty(): return
	var visible_bounds = geometry.bounds
	for p in geometry.pit_points: visible_bounds = visible_bounds.expand(p)
	for i in range(6):
		var station = geometry.pit_sample(geometry.pit_length * (0.30 + i * 0.055))
		var roof = station.p + station.n * 18
		visible_bounds = visible_bounds.expand(roof + Vector2(30, 30)).expand(roof - Vector2(30, 30))
	visible_bounds = visible_bounds.grow(20)
	center = visible_bounds.get_center()
	zoom = minf(maxf(100, size.x - 90) / maxf(20, visible_bounds.size.x), maxf(100, size.y - 110) / maxf(20, visible_bounds.size.y))
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
	if preview_running and geometry and not geometry.preview_only:
		var sample = geometry.sample(preview_distance)
		preview_distance += sample.speed * minf(delta, 0.1) / sample.path_scale
		preview_elapsed += minf(delta, 0.1)
		if preview_distance >= geometry.length: preview_distance -= geometry.length; preview_laps += 1
	_rebuild_clock -= delta
	if _rebuild_due and _rebuild_clock <= 0 and document.get("nodes", []).size() >= 4:
		_rebuild_due = false; _rebuild_clock = 0.06
		geometry = TrackGeometry.new(document, geometry.preset if geometry else "Formula", true)
		if world_layer: world_layer.configure(geometry, document, rich_scenery)
		queue_redraw()

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
		draw_string(font, Vector2(36, 70), "Click to lay out your circuit. Add at least four points.", HORIZONTAL_ALIGNMENT_LEFT, -1, 18, UI.MUTED)
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
			draw_circle(p, 2, UI.MUTED)
			if zoom > 0.3: draw_string(font, p + Vector2(6, -4), str(marker.get("number", "")), HORIZONTAL_ALIGNMENT_LEFT, -1, 10, UI.MUTED)
		if editing and not geometry.preview_only:
			for finding in diagnostics:
				if finding.severity != "error": continue
				var p = screen(geometry.sample(finding.fraction * geometry.length, true).p)
				draw_circle(p, 10, UI.DANGER); draw_string(font, p + Vector2(-2, 5), "!", HORIZONTAL_ALIGNMENT_LEFT, -1, 15, UI.BG)
		if show_profile: _draw_profile()
	if editing: _draw_editor(); draw_selection(); draw_sketch()
	if measure_start != Vector2.INF:
		var end = measure_end if measure_end != Vector2.INF else world(last_mouse)
		draw_line(screen(measure_start), screen(end), UI.ACCENT, 2, true)
		draw_circle(screen(measure_start), 5, UI.ACCENT); draw_circle(screen(end), 5, UI.ACCENT)
		draw_string(font, (screen(measure_start) + screen(end)) * 0.5 + Vector2(5, -9), "%.1f m" % measure_start.distance_to(end), HORIZONTAL_ALIGNMENT_LEFT, -1, 14, UI.ACCENT)
	draw_rect(Rect2(Vector2.ZERO, size), UI.LINE, false, 1)
	var scale_metres = pow(10, floor(log(100 / zoom) / log(10)))
	if scale_metres * zoom < 50: scale_metres *= 5
	var at = Vector2(24, size.y - 27)
	draw_line(at, at + Vector2(scale_metres * zoom, 0), UI.MUTED, 2)
	draw_string(font, at + Vector2(0, -9), "%d m" % int(scale_metres), HORIZONTAL_ALIGNMENT_LEFT, -1, 11, UI.MUTED)
	draw_string(font, Vector2(size.x - 36, 36), "N", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, UI.MUTED)
	draw_line(Vector2(size.x - 30, 60), Vector2(size.x - 30, 43), UI.MUTED, 1.5)

func draw_surface(target: Control) -> void:
	if not show_surface or sim == null or geometry == null: return
	for i in range(RaceSurface.STATIONS):
		for lane in range(RaceSurface.LANES):
			var data = sim.surface[i].lanes[lane]
			var value = RaceSurface.grip(data) / 1.14 if surface_channel == "grip" else (data.temperature / 60 if surface_channel == "temperature" else data[surface_channel])
			var color = Color("4a97b4") if surface_channel == "water" else (Color("629162") if surface_channel == "grip" else Color("a77641"))
			color.a = clampf(value, 0, 1) * 0.68
			for j in range(4):
				var p = geometry.sample((i + j / 4.0) * geometry.length / RaceSurface.STATIONS)
				var q = geometry.sample((i + (j + 1) / 4.0) * geometry.length / RaceSurface.STATIONS)
				var lateral = (lane + 0.5) / RaceSurface.LANES - 0.5
				target.draw_line(screen(p.p + p.n * p.w * lateral), screen(q.p + q.n * q.w * lateral), color, maxf(0.75, p.w * zoom / RaceSurface.LANES), true)
	target.draw_style_box(UI.box(Color("f7f2e4ee")), Rect2(Vector2(16, 16), Vector2(260, 46)))
	target.draw_string(ThemeDB.fallback_font, Vector2(28, 44), "%s  ·  seven lateral strips" % surface_channel.to_upper(), HORIZONTAL_ALIGNMENT_LEFT, -1, 12, UI.INK)
	if inspected_fraction >= 0:
		var s = geometry.sample(inspected_fraction * geometry.length)
		target.draw_circle(screen(s.p), 13, UI.ACCENT, false, 2, true)

func _draw_editor() -> void:
	var font = ThemeDB.fallback_font
	for i in range(document.get("nodes", []).size()):
		if not layer_visible("road"): continue
		var node = document.nodes[i]
		var p = screen(TrackDocument.point(node))
		if not Rect2(Vector2(-15, -15), size + Vector2(30, 30)).has_point(p): continue
		var chosen = i == selected or selection_kind == "road" and i in selection_ids
		draw_circle(p, 6 if chosen else 3.5, UI.ACCENT if chosen else Color("9eb8bd"))
		draw_circle(p, 2, UI.BG)
		if chosen and (selection_ids.size() <= 1 or i == selected):
			draw_string(font, p + Vector2(8, -12), "POINT %d" % (i + 1), HORIZONTAL_ALIGNMENT_LEFT, -1, 12, UI.ACCENT)
			for key in ["in", "out"]:
				var h = screen(TrackDocument.point(node) + TrackDocument.handle(node, key))
				draw_line(p, h, UI.ACCENT, 1, true)
				draw_rect(Rect2(h - Vector2(4, 4), Vector2(8, 8)), UI.ACCENT, false, 1.5)
	if selected_object >= 0 and selected_object < document.objects.size():
		var obj = document.objects[selected_object]
		var p = screen(Vector2(obj.x, obj.y))
		draw_rect(Rect2(p - Vector2(15, 15), Vector2(30, 30)), UI.ACCENT, false, 1.5)
		draw_string(font, p + Vector2(18, -12), str(obj.type).to_upper(), HORIZONTAL_ALIGNMENT_LEFT, -1, 12, UI.ACCENT)
	if mode == "pit" and layer_visible("pits") and not document.get("pits", []).is_empty():
		for i in range(document.pits[0].nodes.size()):
			var p = screen(TrackDocument.point(document.pits[0].nodes[i]))
			draw_circle(p, 5 if i == selected_pit else 3, UI.ACCENT)
			if i == selected_pit: draw_string(font, p + Vector2(8, -8), "PIT POINT %d" % (i + 1), HORIZONTAL_ALIGNMENT_LEFT, -1, 12, UI.ACCENT)

func _draw_profile() -> void:
	var r = Rect2(Vector2(20, size.y - 126), Vector2(size.x - 40, 75))
	draw_style_box(UI.box(Color("f7f2e4ee")), r)
	var low = geometry.heights[0]; var high = low
	for value in geometry.heights: low = minf(low, value); high = maxf(high, value)
	var line = PackedVector2Array()
	for i in range(geometry.heights.size()):
		line.append(Vector2(r.position.x + 8 + (r.size.x - 16) * i / geometry.heights.size(), r.end.y - 8 - (r.size.y - 30) * (geometry.heights[i] - low) / maxf(1, high - low)))
	draw_polyline(line, UI.GOOD, 2, true)
	draw_string(ThemeDB.fallback_font, r.position + Vector2(10, 18), "ELEVATION   %.1f–%.1f m" % [low, high], HORIZONTAL_ALIGNMENT_LEFT, -1, 11, UI.MUTED)

func draw_cars(target: Control) -> void:
	if geometry == null: return
	if preview_running and sim == null:
		var sample = geometry.sample(preview_distance)
		var p = screen(sample.p + sample.n * sample.line)
		target.draw_circle(p, 8, Color("fcf3d8"), true, -1, true)
		target.draw_circle(p, 5, Color("466d52"), true, -1, true)
		target.draw_style_box(UI.box(UI.PANEL), Rect2(Vector2(16, 16), Vector2(268, 55)))
		target.draw_string(ThemeDB.fallback_font, Vector2(28, 39), "REFERENCE LAP  ·  %d km/h" % int(sample.speed * 3.6), HORIZONTAL_ALIGNMENT_LEFT, -1, 12, UI.INK)
		target.draw_string(ThemeDB.fallback_font, Vector2(28, 58), "Heuristic preview · not a race simulation", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, UI.MUTED)
		return
	if sim == null: return
	var font = ThemeDB.fallback_font
	var occupied: Array[Rect2] = []
	var display_cars = sim.cars.duplicate()
	display_cars.sort_custom(func(a, b): return a.id == sim.selected_id if a.id != b.id else false)
	for c in display_cars:
		var alpha = clampf(sim.accumulator / RaceSim.STEP, 0, 1) if sim.phase in RaceSim.ACTIVE and not sim.paused else 1.0
		var at = sim.car_position(c, alpha)
		var p = screen(at.p)
		if not Rect2(Vector2(-30, -30), size + Vector2(60, 60)).has_point(p): continue
		var radius = clampf(4.6 + zoom * 0.35, 4.6, 7.5) * dot_scale
		var color = Color(c.color)
		if c.dnf: color = Color("697278")
		if c.id == sim.selected_id:
			target.draw_arc(p, radius + 5, 0, TAU, 24, UI.ACCENT, 1.8, true)
			target.draw_circle(p, radius + 9, Color(0.9, 0.75, 0.45, 0.09))
		target.draw_circle(p + Vector2(1, 2), radius + 2, Color("30493633"), true, -1, true)
		target.draw_circle(p, radius + 2.2, Color("4e6454"), true, -1, true)
		target.draw_circle(p, radius + 1.6, Color("fff7df"), true, -1, true)
		target.draw_circle(p, radius, color, true, -1, true)
		if show_labels:
			for offset in [Vector2(radius + 5, -radius - 3), Vector2(-40, -radius - 3), Vector2(radius + 5, radius + 15), Vector2(-40, radius + 15), Vector2(0, -radius - 24)]:
				var text_pos = p + offset
				var rect = Rect2(text_pos - Vector2(1, 12), Vector2(35, 15))
				var available = true
				for previous in occupied:
					if rect.intersects(previous): available = false; break
				if not available or not Rect2(Vector2(3, 3), size - Vector2(6, 6)).encloses(rect): continue
				occupied.append(rect)
				target.draw_style_box(UI.box(Color("f5eedacc"), Color("b1bca280"), 3, 0), rect.grow(2))
				target.draw_string(font, text_pos, c.short, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color("294934"))
				break
		if c.blue: target.draw_circle(p + Vector2(-radius - 3, -radius - 3), 3, Color("619acc"))
	if sim.phase == "lights":
		var count = mini(5, int(sim.clock))
		var x = size.x * 0.5 - 100
		target.draw_style_box(UI.box(Color("091116")), Rect2(Vector2(x - 24, 32), Vector2(250, 64)))
		for i in range(5): target.draw_circle(Vector2(x + i * 48, 64), 17, Color("d96858") if i < count else Color("392929"))

func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		last_mouse = event.position
		if event.button_index in [MOUSE_BUTTON_WHEEL_UP, MOUSE_BUTTON_WHEEL_DOWN] and event.pressed:
			var before = world(event.position)
			zoom = clampf(zoom * (1.15 if event.button_index == MOUSE_BUTTON_WHEEL_UP else 1 / 1.15), 0.025, 20)
			center += before - world(event.position); navigated.emit(); queue_redraw(); accept_event(); return
		if event.button_index in [MOUSE_BUTTON_MIDDLE, MOUSE_BUTTON_RIGHT]: panning = event.pressed; navigated.emit(); accept_event(); return
		if event.button_index != MOUSE_BUTTON_LEFT: return
		grab_focus()
		if editing and mode in ["trace_freehand", "trace_pen"]:
			sketch_input(event); accept_event(); return
		if not event.pressed:
			if marquee_start != Vector2.INF:
				finish_marquee(); accept_event(); return
			_commit_drag()
			accept_event(); return
		var p = world(event.position)
		if editing and show_profile and geometry and Rect2(Vector2(20, size.y - 126), Vector2(size.x - 40, 75)).has_point(event.position):
			var fraction = clampf((event.position.x - 28) / maxf(1, size.x - 56), 0, 0.9999)
			selected = geometry.source_segments[int(fraction * geometry.points.size())]
			selected_object = -1; selection_changed.emit(); queue_redraw(); return
		if not editing:
			if sim:
				var best = 22.0; var id = -1
				for c in sim.cars:
					var distance = screen(sim.car_position(c).p).distance_to(event.position)
					if distance < best: best = distance; id = c.id
				if id >= 0: sim.selected_id = id; car_selected.emit(id)
			return
		if mode == "measure":
			if measure_start == Vector2.INF or measure_end != Vector2.INF: measure_start = p; measure_end = Vector2.INF
			else: measure_end = p; measured.emit(measure_start.distance_to(p))
			queue_redraw(); return
		if mode not in ["measure", "select"] and not layer_editable(tool_layer()): accept_event(); return
		if mode == "reference":
			if document.has("reference"): _begin_drag("reference", p)
			return
		if mode == "scenery":
			edit_started.emit(); document.objects.append({"type": scenery_type, "x": p.x, "y": p.y, "h": 0, "scale": 1, "rotation": 0}); selected_object = document.objects.size() - 1; selected = -1; edited.emit(); selection_changed.emit(); queue_redraw(); return
		if mode == "pit":
			if document.pits.is_empty(): return
			selected_pit = -1
			for i in range(document.pits[0].nodes.size()):
				if screen(TrackDocument.point(document.pits[0].nodes[i])).distance_to(event.position) < 12: selected_pit = i; break
			if selected_pit >= 0: _begin_drag("pit", p - TrackDocument.point(document.pits[0].nodes[selected_pit]))
			elif event.shift_pressed:
				edit_started.emit(); document.pits[0].nodes.append(TrackDocument.node_at(p, 5)); _rebuild_due = true; edited.emit()
			selection_changed.emit(); queue_redraw(); return
		if layer_editable("road") and selection_ids.size() <= 1 and selected >= 0 and selected < document.nodes.size():
			for key in ["in", "out"]:
				var n = document.nodes[selected]
				if screen(TrackDocument.point(n) + TrackDocument.handle(n, key)).distance_to(event.position) < 11:
					_begin_drag(key, p - TrackDocument.point(n) - TrackDocument.handle(n, key)); return
		if mode == "start" and geometry:
			edit_started.emit(); document.start = geometry.nearest(p).fraction; _rebuild_due = true; edited.emit(); return
		if mode == "draw":
			edit_started.emit(); document.nodes.append(TrackDocument.node_at(p)); selected = document.nodes.size() - 1
			_rebuild_due = true; edited.emit(); selection_changed.emit(); queue_redraw(); return
		if (mode == "insert" or event.double_click) and geometry and layer_editable("road"):
			var nearest = geometry.nearest(p)
			if nearest.distance * zoom < 50:
				edit_started.emit(); selected = TrackDocument.split_segment(document, nearest.segment, clampf(nearest.t, 0.03, 0.97)); _rebuild_due = true; edited.emit(); selection_changed.emit(); queue_redraw(); return
		var kind = "road"; var hit = -1
		if mode != "select_objects":
			for i in range(document.nodes.size()):
				if layer_editable("road") and screen(TrackDocument.point(document.nodes[i])).distance_to(event.position) < 11: hit = i; break
		if hit < 0:
			kind = "scenery"
			for i in range(document.objects.size() - 1, -1, -1):
				if layer_editable("scenery") and screen(TrackDocument.point(document.objects[i])).distance_to(event.position) < 14: hit = i; break
		if hit >= 0:
			var ids: Array = selection_ids.duplicate() if selection_kind == kind else []
			var linked = group_members(hit) if kind == "scenery" else [hit]
			if event.shift_pressed:
				var remove = hit in ids
				for index in linked:
					if remove: ids.erase(index)
					elif index not in ids: ids.append(index)
			elif hit not in ids: ids = linked
			select_items(kind, ids)
			if not event.shift_pressed and not selection_ids.is_empty():
				drag_origins.clear()
				var items: Array = document.nodes if kind == "road" else document.objects
				for index in selection_ids: drag_origins[index] = TrackDocument.point(items[index])
				_begin_drag("multi", p)
		else:
			if not event.shift_pressed: select_items("scenery" if mode == "select_objects" else selection_kind, [])
			marquee_start = p; marquee_end = p
		queue_redraw()
	elif event is InputEventMouseMotion:
		last_mouse = event.position
		if panning:
			center -= Vector2(event.relative.x, -event.relative.y) / zoom; queue_redraw(); return
		if editing and mode == "trace_freehand" and not stroke.is_empty():
			var point = world(event.position)
			if stroke[-1].distance_to(point) * zoom > 3 and stroke.size() < 12000: stroke.append(point)
			queue_redraw(); return
		if marquee_start != Vector2.INF:
			marquee_end = world(event.position); queue_redraw(); return
		if not dragging.is_empty():
			var p = world(event.position) - _drag_offset
			if not _gesture_changed:
				if event.relative.length_squared() < 0.25: return
				edit_started.emit(); _gesture_changed = true
			if event.ctrl_pressed: p = p.snapped(Vector2(5, 5))
			if dragging == "multi":
				var items: Array = document.nodes if selection_kind == "road" else document.objects
				for index in drag_origins:
					var target: Vector2 = drag_origins[index] + p
					if absf(target.x) > 100000 or absf(target.y) > 100000: return
				for index in drag_origins:
					var target: Vector2 = drag_origins[index] + p
					items[index].x = target.x; items[index].y = target.y
			elif dragging == "reference":
				document.reference.x += event.relative.x / zoom; document.reference.y -= event.relative.y / zoom
			elif dragging == "object":
				document.objects[selected_object].x = p.x; document.objects[selected_object].y = p.y
			elif dragging == "pit":
				document.pits[0].nodes[selected_pit].x = p.x; document.pits[0].nodes[selected_pit].y = p.y
			elif selected >= 0:
				var n = document.nodes[selected]
				if dragging == "node": n.x = p.x; n.y = p.y
				else: TrackDocument.set_handle(n, dragging, p - TrackDocument.point(n))
			_rebuild_due = dragging not in ["reference", "object"] and not (dragging == "multi" and selection_kind == "scenery"); queue_redraw()
			if (dragging in ["object", "reference"] or dragging == "multi" and selection_kind == "scenery") and world_layer: world_layer.queue_redraw()
		elif mode == "measure" and measure_start != Vector2.INF: queue_redraw()

func _begin_drag(kind: String, offset: Vector2) -> void:
	preview_running = false
	dragging = kind; _drag_offset = offset; _gesture_changed = false

func _commit_drag() -> void:
	if dragging.is_empty(): return
	dragging = ""; _rebuild_due = false
	if _gesture_changed:
		_gesture_changed = false; edited.emit(); selection_changed.emit()
	queue_redraw()

func _unhandled_key_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and event.keycode == KEY_ESCAPE:
		if not stroke.is_empty() or pen_anchor != Vector2.INF or marquee_start != Vector2.INF:
			stroke.clear(); pen_anchor = Vector2.INF; marquee_start = Vector2.INF; queue_redraw(); get_viewport().set_input_as_handled(); return
	if event is InputEventKey and event.pressed and event.keycode == KEY_ESCAPE and not dragging.is_empty():
		dragging = ""; _rebuild_due = false
		if _gesture_changed: _gesture_changed = false; edit_cancelled.emit()
		queue_redraw(); get_viewport().set_input_as_handled()

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_WINDOW_FOCUS_OUT: panning = false; _commit_drag()

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
	if geometry == null or geometry.preview_only: return
	preview_running = not preview_running
	if preview_running: preview_distance = 0.0; preview_laps = 0; preview_elapsed = 0.0
	if overlay: overlay.queue_redraw()

func select_items(kind: String, ids: Array) -> void:
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
	if selection_ids.size() > 1:
		var items: Array = document.nodes if selection_kind == "road" else document.objects
		var rect = Rect2(); var first = true
		for index in selection_ids:
			if index < 0 or index >= items.size(): continue
			var p = screen(TrackDocument.point(items[index]))
			draw_rect(Rect2(p - Vector2(8, 8), Vector2(16, 16)), UI.ACCENT, false, 1.5)
			if first: rect = Rect2(p, Vector2.ZERO); first = false
			else: rect = rect.expand(p)
		if not first:
			draw_rect(rect.grow(16), UI.ACCENT, false, 1.5)
			draw_string(ThemeDB.fallback_font, rect.position + Vector2(0, -23), "%d selected · Shift-click to add/remove" % selection_ids.size(), HORIZONTAL_ALIGNMENT_LEFT, -1, 12, UI.INK)
	if marquee_start != Vector2.INF:
		var rectangle = Rect2(screen(marquee_start), screen(marquee_end) - screen(marquee_start)).abs()
		draw_rect(rectangle, Color("ac965329")); draw_rect(rectangle, UI.ACCENT, false, 1.5)

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
		draw_polyline(trace, UI.ACCENT, 2.5, true)
		if sketch.closed: draw_dashed_line(trace[-1], trace[0], UI.ACCENT, 2, 7)
		for label in [["START", trace[0]], ["END", trace[-1]]]:
			draw_circle(label[1], 7, UI.PANEL)
			draw_string(ThemeDB.fallback_font, label[1] + Vector2(9, -9), label[0], HORIZONTAL_ALIGNMENT_LEFT, -1, 12, UI.ACCENT)
	var current = PackedVector2Array()
	for point in stroke: current.append(screen(point))
	if current.size() >= 2: draw_polyline(current, UI.GOOD, 2, true)
	if pen_anchor != Vector2.INF: draw_line(screen(pen_anchor), last_mouse, UI.GOOD, 1.5, true)
	if sketch_preview:
		var preview = PackedVector2Array()
		for point in sketch_preview.points: preview.append(screen(point))
		preview.append(preview[0]); draw_polyline(preview, Color("467c78"), 3, true)
