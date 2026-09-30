class_name TrackCanvasOverlayRenderer
extends RefCounted
## Stateless presentation helper for TrackCanvas overlays.
## It reads detached/render-only canvas state and never owns editor or race authority.

static func build_surface_geometry(host: TrackCanvas) -> void:
	if host._surface_geometry == host.geometry:
		return
	host._surface_geometry = host.geometry
	host._surface_segments.clear()
	host.surface_geometry_builds += 1
	# Geometry is immutable within a weekend. Water/grip remain live, never cached here.
	var samples: Array = []
	for i in range(RaceVisualPort.SURFACE_STATIONS * 4 + 1):
		samples.append(host.geometry.sample(i * host.geometry.length / (RaceVisualPort.SURFACE_STATIONS * 4)))
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
		host._surface_segments.append(lanes)


static func draw_surface(host: TrackCanvas, target: Control) -> void:
	if not host.show_surface or host.visual_source == null or host.geometry == null:
		return
	var values = host.visual_source.surface_values(host.surface_channel)
	if values.is_empty():
		return
	build_surface_geometry(host)
	for i in range(RaceVisualPort.SURFACE_STATIONS):
		for lane in range(RaceVisualPort.SURFACE_LANES):
			var value: float = values[i][lane]
			var color = Color("4a97b4") if host.surface_channel == "water" else (Color("629162") if host.surface_channel == "grip" else Color("a77641"))
			color.a = clampf(value, 0, 1) * 0.68
			for segment in host._surface_segments[i][lane]:
				target.draw_line(host.screen(segment[0]), host.screen(segment[1]), color, maxf(0.75, segment[2] * host.zoom / RaceVisualPort.SURFACE_LANES), true)
	target.draw_style_box(host._surface_legend_style, Rect2(Vector2(16, 16), Vector2(260, 46)))
	target.draw_string(ThemeDB.fallback_font, Vector2(28, 44), "%s  ·  seven lateral strips" % host.surface_channel.to_upper(), HORIZONTAL_ALIGNMENT_LEFT, -1, 12, CircuitPalette.INK)
	if host.inspected_fraction >= 0:
		var sample = host.geometry.sample(host.inspected_fraction * host.geometry.length)
		target.draw_circle(host.screen(sample.p), 13, CircuitPalette.ACCENT, false, 2, true)


static func draw_profile(host: TrackCanvas) -> void:
	var r = Rect2(Vector2(20, host.size.y - 126), Vector2(host.size.x - 40, 75))
	host.draw_style_box(UI.box(Color("f7f2e4ee")), r)
	var low = host.geometry.heights[0]
	var high = low
	for value in host.geometry.heights:
		low = minf(low, value)
		high = maxf(high, value)
	var line = PackedVector2Array()
	for i in range(host.geometry.heights.size()):
		line.append(Vector2(r.position.x + 8 + (r.size.x - 16) * i / host.geometry.heights.size(), r.end.y - 8 - (r.size.y - 30) * (host.geometry.heights[i] - low) / maxf(1, high - low)))
	host.draw_polyline(line, CircuitPalette.GOOD, 2, true)
	host.draw_string(ThemeDB.fallback_font, r.position + Vector2(10, 18), "ELEVATION   %.1f–%.1f m" % [low, high], HORIZONTAL_ALIGNMENT_LEFT, -1, 11, CircuitPalette.MUTED)


static func draw_cars(host: TrackCanvas, target: Control) -> void:
	if host.geometry == null:
		return
	if host.preview_running and host.visual_source == null:
		var sample = host.geometry.sample(host.preview_distance)
		var p = host.screen(sample.p + sample.n * sample.line)
		target.draw_circle(p, 8, Color("fcf3d8"), true, -1, true)
		target.draw_circle(p, 5, Color("466d52"), true, -1, true)
		target.draw_style_box(UI.box(CircuitPalette.PANEL), Rect2(Vector2(16, 16), Vector2(268, 55)))
		target.draw_string(ThemeDB.fallback_font, Vector2(28, 39), "REFERENCE LAP  ·  %d km/h" % int(sample.speed * 3.6), HORIZONTAL_ALIGNMENT_LEFT, -1, 12, CircuitPalette.INK)
		target.draw_string(ThemeDB.fallback_font, Vector2(28, 58), "Heuristic preview · not a race simulation", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, CircuitPalette.MUTED)
		return
	if host.visual_frame.is_empty():
		return
	var font = ThemeDB.fallback_font
	var occupied: Array[Rect2] = []
	var display_cars = host.visual_frame.cars.duplicate()
	display_cars.sort_custom(func(a, b): return a.id == host.visual_frame.selected_id if a.id != b.id else false)
	for c in display_cars:
		var p = host.screen(c.position)
		if not Rect2(Vector2(-30, -30), host.size + Vector2(60, 60)).has_point(p):
			continue
		var radius = clampf(4.6 + host.zoom * 0.35, 4.6, 7.5) * host.dot_scale
		var color = Color(c.color)
		if c.dnf:
			color = Color("697278")
		if c.id == host.visual_frame.selected_id:
			target.draw_arc(p, radius + 5, 0, TAU, 24, CircuitPalette.ACCENT, 1.8, true)
			target.draw_circle(p, radius + 9, Color(0.9, 0.75, 0.45, 0.09))
		target.draw_circle(p + Vector2(1, 2), radius + 2, Color("30493633"), true, -1, true)
		target.draw_circle(p, radius + 2.2, Color("4e6454"), true, -1, true)
		target.draw_circle(p, radius + 1.6, Color("fff7df"), true, -1, true)
		target.draw_circle(p, radius, color, true, -1, true)
		if host.show_labels:
			for offset in [Vector2(radius + 5, -radius - 3), Vector2(-40, -radius - 3), Vector2(radius + 5, radius + 15), Vector2(-40, radius + 15), Vector2(0, -radius - 24)]:
				var text_pos = p + offset
				var rect = Rect2(text_pos - Vector2(1, 12), Vector2(35, 15))
				var available = true
				for previous in occupied:
					if rect.intersects(previous):
						available = false
						break
				if not available or not Rect2(Vector2(3, 3), host.size - Vector2(6, 6)).encloses(rect):
					continue
				occupied.append(rect)
				target.draw_style_box(host._car_label_style, rect.grow(2))
				target.draw_string(font, text_pos, c.short, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color("294934"))
				break
		if c.blue:
			target.draw_circle(p + Vector2(-radius - 3, -radius - 3), 3, Color("619acc"))
	if host.visual_frame.phase == "lights":
		var count = mini(5, int(host.visual_frame.clock))
		var x = host.size.x * 0.5 - 100
		target.draw_style_box(UI.box(Color("091116")), Rect2(Vector2(x - 24, 32), Vector2(250, 64)))
		for i in range(5):
			target.draw_circle(Vector2(x + i * 48, 64), 17, Color("d96858") if i < count else Color("392929"))
