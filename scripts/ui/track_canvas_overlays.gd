class_name TrackCanvasOverlays
extends RefCounted
## UI-only painters: no editor mutations, no scheduling and no live race entities.
## TrackCanvas retains overlay lifetimes, geometry cache and presentation invalidation.

static func surface_geometry(geometry: TrackGeometry) -> Array:
	# Geometry remains immutable within a weekend; overlay observations stay live.
	var compiled: Array = []
	var samples: Array = []
	for i in range(RaceVisualPort.SURFACE_STATIONS * 4 + 1):
		samples.append(geometry.sample(i * geometry.length / (RaceVisualPort.SURFACE_STATIONS * 4)))
	for i in range(RaceVisualPort.SURFACE_STATIONS):
		var lanes: Array = []
		for lane in range(RaceVisualPort.SURFACE_LANES):
			var segments: Array = []
			var lateral = (lane + 0.5) / RaceVisualPort.SURFACE_LANES - 0.5
			for j in range(4):
				var p = samples[i * 4 + j]
				var q = samples[i * 4 + j + 1]
				segments.append([p.p + p.n * p.w * lateral, q.p + q.n * q.w * lateral, p.w])
			lanes.append(segments)
		compiled.append(lanes)
	return compiled


static func paint_surface(target: Control, segments: Array, values: Array, surface_channel: String,
		inspected_fraction: float, geometry: TrackGeometry, zoom: float,
		legend_style: StyleBox, screen: Callable) -> void:
	for i in range(RaceVisualPort.SURFACE_STATIONS):
		for lane in range(RaceVisualPort.SURFACE_LANES):
			var value: float = values[i][lane]
			var color = (
				Color("4a97b4") if surface_channel == "water"
				else (Color("629162") if surface_channel == "grip" else Color("a77641"))
			)
			color.a = clampf(value, 0, 1) * 0.68
			for segment in segments[i][lane]:
				target.draw_line(
					screen.call(segment[0]),
					screen.call(segment[1]),
					color,
					maxf(0.75, segment[2] * zoom / RaceVisualPort.SURFACE_LANES),
					true
				)
	target.draw_style_box(legend_style, Rect2(Vector2(16, 16), Vector2(260, 46)))
	target.draw_string(
		ThemeDB.fallback_font,
		Vector2(28, 44),
		"%s  ·  seven lateral strips" % surface_channel.to_upper(),
		HORIZONTAL_ALIGNMENT_LEFT,
		-1,
		12,
		CircuitPalette.INK
	)
	if inspected_fraction >= 0:
		var sample = geometry.sample(inspected_fraction * geometry.length)
		target.draw_circle(screen.call(sample.p), 13, CircuitPalette.ACCENT, false, 2, true)


static func paint_profile(target: Control, geometry: TrackGeometry, size: Vector2) -> void:
	var r = Rect2(Vector2(20, size.y - 126), Vector2(size.x - 40, 75))
	target.draw_style_box(UI.box(Color("f7f2e4ee")), r)
	var low = geometry.heights[0]
	var high = low
	for value in geometry.heights:
		low = minf(low, value)
		high = maxf(high, value)
	var line = PackedVector2Array()
	for i in range(geometry.heights.size()):
		line.append(Vector2(
			r.position.x + 8 + (r.size.x - 16) * i / geometry.heights.size(),
			r.end.y - 8 - (r.size.y - 30) * (geometry.heights[i] - low) / maxf(1, high - low)
		))
	target.draw_polyline(line, CircuitPalette.GOOD, 2, true)
	target.draw_string(
		ThemeDB.fallback_font,
		r.position + Vector2(10, 18),
		"ELEVATION   %.1f–%.1f m" % [low, high],
		HORIZONTAL_ALIGNMENT_LEFT,
		-1,
		11,
		CircuitPalette.MUTED
	)


static func paint_cars(target: Control, geometry: TrackGeometry, show_preview: bool,
		preview_distance: float, visual_frame: Dictionary, zoom: float, dot_scale: float,
		show_labels: bool, size: Vector2, label_style: StyleBox, screen: Callable) -> void:
	if geometry == null:
		return
	if show_preview:
		var sample = geometry.sample(preview_distance)
		var p = screen.call(sample.p + sample.n * sample.line)
		target.draw_circle(p, 8, Color("fcf3d8"), true, -1, true)
		target.draw_circle(p, 5, Color("466d52"), true, -1, true)
		target.draw_style_box(UI.box(CircuitPalette.PANEL), Rect2(Vector2(16, 16), Vector2(268, 55)))
		target.draw_string(
			ThemeDB.fallback_font,
			Vector2(28, 39),
			"REFERENCE LAP  ·  %d km/h" % int(sample.speed * 3.6),
			HORIZONTAL_ALIGNMENT_LEFT,
			-1,
			12,
			CircuitPalette.INK
		)
		target.draw_string(
			ThemeDB.fallback_font,
			Vector2(28, 58),
			"Heuristic preview · not a race simulation",
			HORIZONTAL_ALIGNMENT_LEFT,
			-1,
			11,
			CircuitPalette.MUTED
		)
		return
	if visual_frame.is_empty():
		return
	var font = ThemeDB.fallback_font
	var occupied: Array[Rect2] = []
	var display_cars = visual_frame.cars.duplicate()
	display_cars.sort_custom(
		func(a, b): return a.id == visual_frame.selected_id if a.id != b.id else false
	)
	for c in display_cars:
		var p = screen.call(c.position)
		if not Rect2(Vector2(-30, -30), size + Vector2(60, 60)).has_point(p):
			continue
		var radius = clampf(4.6 + zoom * 0.35, 4.6, 7.5) * dot_scale
		var color = Color(c.color)
		if c.dnf:
			color = Color("697278")
		if c.id == visual_frame.selected_id:
			target.draw_arc(p, radius + 5, 0, TAU, 24, CircuitPalette.ACCENT, 1.8, true)
			target.draw_circle(p, radius + 9, Color(0.9, 0.75, 0.45, 0.09))
		target.draw_circle(p + Vector2(1, 2), radius + 2, Color("30493633"), true, -1, true)
		target.draw_circle(p, radius + 2.2, Color("4e6454"), true, -1, true)
		target.draw_circle(p, radius + 1.6, Color("fff7df"), true, -1, true)
		target.draw_circle(p, radius, color, true, -1, true)
		if show_labels:
			for offset in [
				Vector2(radius + 5, -radius - 3),
				Vector2(-40, -radius - 3),
				Vector2(radius + 5, radius + 15),
				Vector2(-40, radius + 15),
				Vector2(0, -radius - 24)
			]:
				var text_pos = p + offset
				var rect = Rect2(text_pos - Vector2(1, 12), Vector2(35, 15))
				var available = true
				for previous in occupied:
					if rect.intersects(previous):
						available = false
						break
				if not available or not Rect2(Vector2(3, 3), size - Vector2(6, 6)).encloses(rect):
					continue
				occupied.append(rect)
				target.draw_style_box(label_style, rect.grow(2))
				target.draw_string(
					font,
					text_pos,
					c.short,
					HORIZONTAL_ALIGNMENT_LEFT,
					-1,
					11,
					Color("294934")
				)
				break
		if c.blue:
			target.draw_circle(p + Vector2(-radius - 3, -radius - 3), 3, Color("619acc"))
	if visual_frame.phase == "lights":
		var count = mini(5, int(visual_frame.clock))
		var x = size.x * 0.5 - 100
		target.draw_style_box(UI.box(Color("091116")), Rect2(Vector2(x - 24, 32), Vector2(250, 64)))
		for i in range(5):
			target.draw_circle(
				Vector2(x + i * 48, 64),
				17,
				Color("d96858") if i < count else Color("392929")
			)


static func paint_selection(target: Control, document: Dictionary, selection_kind: String,
		selection_ids: Array[int], marquee_start: Vector2, marquee_end: Vector2,
		screen: Callable) -> void:
	if selection_ids.size() > 1:
		var items: Array = document.nodes if selection_kind == "road" else document.objects
		var rect = Rect2()
		var first = true
		for index in selection_ids:
			if index < 0 or index >= items.size():
				continue
			var p = screen.call(TrackDocument.point(items[index]))
			target.draw_rect(
				Rect2(p - Vector2(8, 8), Vector2(16, 16)),
				CircuitPalette.ACCENT,
				false,
				1.5
			)
			if first:
				rect = Rect2(p, Vector2.ZERO)
				first = false
			else:
				rect = rect.expand(p)
		if not first:
			target.draw_rect(rect.grow(16), CircuitPalette.ACCENT, false, 1.5)
			target.draw_string(
				ThemeDB.fallback_font,
				rect.position + Vector2(0, -23),
				"%d selected · Shift-click to add/remove" % selection_ids.size(),
				HORIZONTAL_ALIGNMENT_LEFT,
				-1,
				12,
				CircuitPalette.INK
			)
	if marquee_start != Vector2.INF:
		var rectangle = Rect2(
			screen.call(marquee_start),
			screen.call(marquee_end) - screen.call(marquee_start)
		).abs()
		target.draw_rect(rectangle, Color("ac965329"))
		target.draw_rect(rectangle, CircuitPalette.ACCENT, false, 1.5)
