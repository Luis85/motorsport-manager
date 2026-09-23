class_name TrackCanvas
extends Control
## Native 2D projection. Static track and moving cars are drawn on separate canvases.
signal navigated
signal edit_cancelled
signal edit_started
signal edited
signal selection_changed
signal car_selected(id: int)
signal measured(metres: float)
var show_surface = false
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
		if host != null and host.sim != null: queue_redraw()

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
	_rebuild_due = false
	document = live_document if not live_document.is_empty() else g.document
	_load_backdrop()
	queue_redraw()
	if overlay: overlay.queue_redraw()

func fit() -> void:
	if geometry == null or geometry.points.is_empty(): return
	center = geometry.bounds.get_center()
	zoom = minf(maxf(100, size.x - 100) / maxf(20, geometry.bounds.size.x), maxf(100, size.y - 150) / maxf(20, geometry.bounds.size.y))
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
	_rebuild_clock -= delta
	if _rebuild_due and _rebuild_clock <= 0 and document.get("nodes", []).size() >= 4:
		_rebuild_due = false; _rebuild_clock = 0.06
		geometry = TrackGeometry.new(document, geometry.preset if geometry else "Formula", true)
		queue_redraw()

func _draw() -> void:
	if surface_layer: surface_layer.queue_redraw()
	if overlay: overlay.queue_redraw()
	draw_rect(Rect2(Vector2.ZERO, size), Color("101d24"))
	var font = ThemeDB.fallback_font
	if show_grid:
		var grid = 50.0
		while grid * zoom < 35: grid *= 2
		while grid * zoom > 140: grid *= 0.5
		var lo = world(Vector2(0, size.y)); var hi = world(Vector2(size.x, 0))
		var x = floor(lo.x / grid) * grid
		while x < hi.x:
			draw_line(screen(Vector2(x, lo.y)), screen(Vector2(x, hi.y)), Color("1a2a32"), 1); x += grid
		var y = floor(lo.y / grid) * grid
		while y < hi.y:
			draw_line(screen(Vector2(lo.x, y)), screen(Vector2(hi.x, y)), Color("1a2a32"), 1); y += grid
	if backdrop != null:
		var ref = document.reference
		var w = float(ref.get("width", 1000)); var h = w * backdrop.get_height() / float(backdrop.get_width())
		var p = Vector2(ref.get("x", 0), ref.get("y", 0))
		draw_texture_rect(backdrop, Rect2(screen(p + Vector2(-w * 0.5, h * 0.5)), Vector2(w, h) * zoom), false, Color(1, 1, 1, ref.get("opacity", 0.35)))
	if geometry == null or geometry.points.is_empty():
		draw_string(font, Vector2(36, 70), "Click to lay out your circuit. Add at least four points.", HORIZONTAL_ALIGNMENT_LEFT, -1, 18, UI.MUTED)
	else:
		_draw_scenery()
		var n = geometry.points.size()
		_draw_road()
		for feature in document.get("features", []): _draw_feature(feature)
		if geometry.pit_points.size() > 1:
			var route = PackedVector2Array()
			for p in geometry.pit_points: route.append(screen(p))
			draw_polyline(route, Color("baaf87"), maxf(3, 6 * zoom), true)
			draw_polyline(route, Color("4a5050"), maxf(1.5, 4.7 * zoom), true)
			var box = geometry.pit_sample(geometry.pit_length * 0.5)
			draw_string(font, screen(box.p + box.n * 24), "PIT LANE", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, UI.ACCENT)
		if show_line and not geometry.preview_only:
			for i in range(n):
				var color = Color("83b79e") if geometry.speeds[i] > 45 else Color("dfaa74")
				draw_line(screen(geometry.line_point(i)), screen(geometry.line_point((i + 1) % n)), color, 1.7, true)
		var start = geometry.sample(0)
		var left = start.p + start.n * start.w * 0.55
		var right = start.p - start.n * start.w * 0.55
		draw_line(screen(left), screen(right), UI.INK, 3, true)
		draw_string(font, screen(left) + Vector2(7, -7), "START / FINISH", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, UI.INK)
		for sector in range(1, 3):
			var p = geometry.sample(geometry.sector_ends[sector - 1])
			draw_circle(screen(p.p), 4, Color("82a7bc"))
			draw_string(font, screen(p.p) + Vector2(8, -6), "S%d" % sector, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color("82a7bc"))
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
	if editing: _draw_editor()
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

func _draw_road() -> void:
	var n = geometry.points.size()
	var left = PackedVector2Array(); var right = PackedVector2Array()
	for i in range(n):
		left.append(screen(geometry.points[i] + geometry.normals[i] * geometry.widths[i] * 0.5))
		right.append(screen(geometry.points[i] - geometry.normals[i] * geometry.widths[i] * 0.5))
	# Two simple triangles per sample avoid polygon self-intersection in tight hairpins.
	# No antialiasing on internal edges: there are no segment seams across the asphalt.
	for i in range(n):
		var j = (i + 1) % n
		draw_colored_polygon(PackedVector2Array([left[i], left[j], right[j]]), Color("3b4b51"))
		draw_colored_polygon(PackedVector2Array([left[i], right[j], right[i]]), Color("3b4b51"))
	left.append(left[0]); right.append(right[0])
	draw_polyline(left, Color("9aaba7"), 1.2, true)
	draw_polyline(right, Color("9aaba7"), 1.2, true)
	# Visible grid slots and the shared team-box positions are sourced from the same geometry.
	for i in range(12):
		var g = geometry.sample(-i * geometry.grid_spacing)
		var at: Vector2 = g.p + g.n * (-2 if i % 2 == 0 else 2)
		var tangent = Vector2(g.n.y, -g.n.x)
		draw_line(screen(at - g.n), screen(at + g.n), Color("bec4b780"), 1, true)
		draw_line(screen(at - g.n), screen(at - g.n - tangent * 4), Color("bec4b770"), 1, true)
		draw_line(screen(at + g.n), screen(at + g.n - tangent * 4), Color("bec4b770"), 1, true)

func _draw_scenery() -> void:
	for object in document.get("objects", []):
		var p = screen(Vector2(object.get("x", 0), object.get("y", 0)))
		if not Rect2(Vector2(-100, -100), size + Vector2(200, 200)).has_point(p): continue
		var scale_m = clampf(float(object.get("scale", 1)), 0.2, 8)
		var type = str(object.get("type", "tree"))
		draw_set_transform(p, -deg_to_rad(float(object.get("rotation", 0))), Vector2.ONE * maxf(0.1, zoom) * scale_m)
		if type in ["tree", "woodland"]:
			draw_circle(Vector2(3, 4), 8, Color("0b151a"))
			draw_circle(Vector2.ZERO, 7.5, Color("2d5144"))
			draw_circle(Vector2(-2, -2), 4.5, Color("3b6250"))
		elif type in ["water", "pool", "yacht"]:
			draw_rect(Rect2(-14, -8, 28, 16), Color("264d5c"))
			if type == "yacht": draw_colored_polygon(PackedVector2Array([Vector2(-10, -4), Vector2(9, -4), Vector2(14, 0), Vector2(9, 4), Vector2(-10, 4)]), Color("c7c9b7"))
		else:
			var metres = Vector2(38, 19) if type == "grandstand" else (Vector2(26, 16) if type == "garage" else Vector2(14, 12))
			draw_rect(Rect2(-metres * 0.5 + Vector2(4, 5), metres), Color("0b171ddd"))
			draw_rect(Rect2(-metres * 0.5, metres), Color("52666a") if type == "grandstand" else Color("536060"))
			draw_rect(Rect2(-metres * 0.5, metres), Color("84938b"), false, 0.6)
			if type == "grandstand":
				for j in range(4): draw_line(Vector2(-17, -6 + j * 4), Vector2(17, -6 + j * 4), Color("9b8e70"), 1.3)
			else:
				for j in range(3): draw_rect(Rect2(-metres.x * 0.4 + j * metres.x * 0.3, metres.y * 0.3, metres.x * 0.18, 2), Color("c6b887"))
		draw_set_transform(Vector2.ZERO)

func draw_surface(target: Control) -> void:
	if not show_surface or sim == null or geometry == null: return
	for i in range(96):
		var color = Color(0.27, 0.65, 0.85, sim.water[i] * 0.55)
		var a = geometry.sample(i * geometry.length / 96)
		var b = geometry.sample((i + 1) * geometry.length / 96)
		# Short pieces follow the road rather than drawing chords through tight corners.
		for j in range(6):
			var p = geometry.sample((i + j / 6.0) * geometry.length / 96)
			var q = geometry.sample((i + (j + 1) / 6.0) * geometry.length / 96)
			target.draw_line(screen(p.p), screen(q.p), color, maxf(2, p.w * zoom * 0.85), true)
	target.draw_style_box(UI.box(Color("10202ce8")), Rect2(Vector2(16, 16), Vector2(238, 46)))
	target.draw_string(ThemeDB.fallback_font, Vector2(28, 44), "SURFACE WATER  %d%%  ·  blue = wet" % int(sim.average(sim.water) * 100), HORIZONTAL_ALIGNMENT_LEFT, -1, 12, UI.INK)

func _draw_feature(f: Dictionary) -> void:
	var kind = str(f.get("type", "curb"))
	var a = float(f.get("a", 0)); var b = float(f.get("b", 0))
	var span = fposmod(b - a, 1.0)
	var count = clampi(int(ceil(span * geometry.length / 5.0)), 2, 1500)
	for i in range(count):
		var s = geometry.sample((a + span * i / count) * geometry.length, true)
		var t = geometry.sample((a + span * (i + 1) / count) * geometry.length, true)
		if kind in ["tunnel", "bridge"]:
			var color = Color("18242b") if kind == "tunnel" else Color("748081")
			draw_line(screen(s.p), screen(t.p), color, maxf(3, s.w * zoom * (0.7 if kind == "tunnel" else 1.25)), true)
			if i % 6 == 0: draw_line(screen(s.p - s.n * s.w * 0.6), screen(s.p + s.n * s.w * 0.6), Color("a1a899"), 1)
		else:
			for side in [-1, 1]:
				if f.get("side", "both") == "left" and side == -1 or f.get("side", "both") == "right" and side == 1: continue
				var offset = s.w * 0.5 + float(f.get("width", 1)) * 0.5
				var color = (Color("b75950") if i % 2 == 0 else Color("cad0c8")) if kind == "curb" else (Color("7e8172") if kind == "barrier" else Color("526750"))
				draw_line(screen(s.p + s.n * offset * side), screen(t.p + t.n * offset * side), color, maxf(1.5, float(f.get("width", 1)) * zoom), true)

func _draw_editor() -> void:
	var font = ThemeDB.fallback_font
	for i in range(document.get("nodes", []).size()):
		var node = document.nodes[i]
		var p = screen(TrackDocument.point(node))
		if not Rect2(Vector2(-15, -15), size + Vector2(30, 30)).has_point(p): continue
		var chosen = i == selected
		draw_circle(p, 6 if chosen else 3.5, UI.ACCENT if chosen else Color("9eb8bd"))
		draw_circle(p, 2, UI.BG)
		if chosen:
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
	if mode == "pit" and not document.get("pits", []).is_empty():
		for i in range(document.pits[0].nodes.size()):
			var p = screen(TrackDocument.point(document.pits[0].nodes[i]))
			draw_circle(p, 5 if i == selected_pit else 3, UI.ACCENT)
			if i == selected_pit: draw_string(font, p + Vector2(8, -8), "PIT POINT %d" % (i + 1), HORIZONTAL_ALIGNMENT_LEFT, -1, 12, UI.ACCENT)

func _draw_profile() -> void:
	var r = Rect2(Vector2(20, size.y - 126), Vector2(size.x - 40, 75))
	draw_style_box(UI.box(Color("10202cee")), r)
	var low = geometry.heights[0]; var high = low
	for value in geometry.heights: low = minf(low, value); high = maxf(high, value)
	var line = PackedVector2Array()
	for i in range(geometry.heights.size()):
		line.append(Vector2(r.position.x + 8 + (r.size.x - 16) * i / geometry.heights.size(), r.end.y - 8 - (r.size.y - 30) * (geometry.heights[i] - low) / maxf(1, high - low)))
	draw_polyline(line, UI.GOOD, 2, true)
	draw_string(ThemeDB.fallback_font, r.position + Vector2(10, 18), "ELEVATION   %.1f–%.1f m" % [low, high], HORIZONTAL_ALIGNMENT_LEFT, -1, 11, UI.MUTED)

func draw_cars(target: Control) -> void:
	if sim == null or geometry == null: return
	var font = ThemeDB.fallback_font
	var occupied: Array[Rect2] = []
	var display_cars = sim.cars.duplicate()
	display_cars.sort_custom(func(a, b): return a.id == sim.selected_id if a.id != b.id else false)
	for c in display_cars:
		var alpha = clampf(sim.accumulator / RaceSim.STEP, 0, 1) if sim.phase in RaceSim.ACTIVE and not sim.paused else 1.0
		var at = sim.car_position(c, alpha)
		var p = screen(at.p)
		if not Rect2(Vector2(-30, -30), size + Vector2(60, 60)).has_point(p): continue
		var radius = maxf(3.5, 2.3 * zoom)
		var color = Color(c.color)
		if c.dnf: color = Color("697278")
		if c.id == sim.selected_id:
			target.draw_arc(p, radius + 5, 0, TAU, 24, UI.ACCENT, 1.8, true)
			target.draw_circle(p, radius + 9, Color(0.9, 0.75, 0.45, 0.09))
		target.draw_circle(p + Vector2(1, 2), radius + 1.2, Color("091116"))
		target.draw_circle(p, radius, color)
		var tangent = Vector2(at.n.y, -at.n.x)
		var screen_tangent = Vector2(tangent.x, -tangent.y)
		target.draw_line(p, p + screen_tangent * (radius + 2), color.lightened(0.2), 1.8, true)
		if show_labels:
			for offset in [Vector2(radius + 5, -radius - 3), Vector2(-40, -radius - 3), Vector2(radius + 5, radius + 15), Vector2(-40, radius + 15), Vector2(0, -radius - 24)]:
				var text_pos = p + offset
				var rect = Rect2(text_pos - Vector2(1, 12), Vector2(35, 15))
				var available = true
				for previous in occupied:
					if rect.intersects(previous): available = false; break
				if not available: continue
				occupied.append(rect)
				target.draw_string(font, text_pos + Vector2(1, 1), c.short, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, UI.BG)
				target.draw_string(font, text_pos, c.short, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, color)
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
		if not event.pressed:
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
		if selected >= 0 and selected < document.nodes.size():
			for key in ["in", "out"]:
				var n = document.nodes[selected]
				if screen(TrackDocument.point(n) + TrackDocument.handle(n, key)).distance_to(event.position) < 11:
					_begin_drag(key, p - TrackDocument.point(n) - TrackDocument.handle(n, key)); return
		if mode == "start" and geometry:
			edit_started.emit(); document.start = geometry.nearest(p).fraction; _rebuild_due = true; edited.emit(); return
		if mode == "draw":
			edit_started.emit(); document.nodes.append(TrackDocument.node_at(p)); selected = document.nodes.size() - 1
			_rebuild_due = true; edited.emit(); selection_changed.emit(); queue_redraw(); return
		if (mode == "insert" or event.double_click) and geometry:
			var nearest = geometry.nearest(p)
			if nearest.distance * zoom < 50:
				edit_started.emit(); selected = TrackDocument.split_segment(document, nearest.segment, clampf(nearest.t, 0.03, 0.97)); _rebuild_due = true; edited.emit(); selection_changed.emit(); queue_redraw(); return
		selected = -1; selected_object = -1
		for i in range(document.nodes.size()):
			if screen(TrackDocument.point(document.nodes[i])).distance_to(event.position) < 11: selected = i; break
		if selected >= 0: _begin_drag("node", p - TrackDocument.point(document.nodes[selected]))
		else:
			for i in range(document.objects.size() - 1, -1, -1):
				var object = document.objects[i]
				if screen(Vector2(object.x, object.y)).distance_to(event.position) < 14:
					selected_object = i; _begin_drag("object", p - Vector2(object.x, object.y)); break
		selection_changed.emit(); queue_redraw()
	elif event is InputEventMouseMotion:
		last_mouse = event.position
		if panning:
			center -= Vector2(event.relative.x, -event.relative.y) / zoom; queue_redraw(); return
		if not dragging.is_empty():
			var p = world(event.position) - _drag_offset
			if not _gesture_changed:
				if event.relative.length_squared() < 0.25: return
				edit_started.emit(); _gesture_changed = true
			if event.ctrl_pressed: p = p.snapped(Vector2(5, 5))
			if dragging == "reference":
				document.reference.x += event.relative.x / zoom; document.reference.y -= event.relative.y / zoom
			elif dragging == "object":
				document.objects[selected_object].x = p.x; document.objects[selected_object].y = p.y
			elif dragging == "pit":
				document.pits[0].nodes[selected_pit].x = p.x; document.pits[0].nodes[selected_pit].y = p.y
			elif selected >= 0:
				var n = document.nodes[selected]
				if dragging == "node": n.x = p.x; n.y = p.y
				else: TrackDocument.set_handle(n, dragging, p - TrackDocument.point(n))
			_rebuild_due = dragging not in ["reference", "object"]; queue_redraw()
		elif mode == "measure" and measure_start != Vector2.INF: queue_redraw()

func _begin_drag(kind: String, offset: Vector2) -> void:
	dragging = kind; _drag_offset = offset; _gesture_changed = false

func _commit_drag() -> void:
	if dragging.is_empty(): return
	dragging = ""; _rebuild_due = false
	if _gesture_changed:
		_gesture_changed = false; edited.emit(); selection_changed.emit()
	queue_redraw()

func _unhandled_key_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and event.keycode == KEY_ESCAPE and not dragging.is_empty():
		dragging = ""; _rebuild_due = false
		if _gesture_changed: _gesture_changed = false; edit_cancelled.emit()
		queue_redraw(); get_viewport().set_input_as_handled()

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_WINDOW_FOCUS_OUT: panning = false; _commit_drag()
