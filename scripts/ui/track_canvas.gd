class_name TrackCanvas
extends TrackCanvasAuthoring
## Native presentation responsibilities; inherited state remains per instance.


func _ready() -> void:
	clip_contents = true
	world_layer = CircuitWorld.new()
	world_layer.show_behind_parent = true
	add_child(world_layer)
	if geometry:
		world_layer.configure(geometry, document, rich_scenery)
	world_layer.reference_texture = backdrop
	world_layer.reference_visible = editing and layer_visible("reference")
	mouse_default_cursor_shape = Control.CURSOR_CROSS if editing else Control.CURSOR_ARROW
	focus_mode = Control.FOCUS_ALL
	custom_minimum_size = Vector2(300, 300)
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	surface_layer = SurfaceOverlay.new()
	surface_layer.host = self
	surface_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(surface_layer)
	surface_layer.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	overlay = CarOverlay.new()
	overlay.host = self
	overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(overlay)
	overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	resized.connect(
		func():
			queue_redraw()
			if fit_view_enabled:
				call_deferred("fit"),
	)
	navigated.connect(func(): fit_view_enabled = false)


func _draw() -> void:
	if surface_layer:
		surface_layer.queue_redraw()
	if overlay:
		overlay.queue_redraw()
	if world_layer:
		world_layer.position = size * 0.5 - Vector2(center.x, -center.y) * zoom
		world_layer.scale = Vector2(zoom, -zoom)
	var font = ThemeDB.fallback_font
	_draw_grid()
	if geometry == null or geometry.points.is_empty():
		draw_string(
			font,
			Vector2(36, 70),
			"Click to lay out your circuit. Add at least four points.",
			HORIZONTAL_ALIGNMENT_LEFT,
			-1,
			18,
			CircuitPalette.MUTED
		)
	else:
		var n = geometry.points.size()
		if show_line and layer_visible("road") and not geometry.preview_only:
			for i in range(n):
				var color = Color("dde6a0") if geometry.speeds[i] > 45 else Color("e2b48d")
				draw_line(
					screen(geometry.line_point(i)),
					screen(geometry.line_point((i + 1) % n)),
					color,
					1.7,
					true
				)
		var start = geometry.sample(0)
		var left = start.p + start.n * start.w * 0.55
		var right = start.p - start.n * start.w * 0.55
		draw_string(
			font,
			screen(left) + Vector2(7, -7),
			"START / FINISH",
			HORIZONTAL_ALIGNMENT_LEFT,
			-1,
			11,
			Color("2d4b3b")
		)
		for sector in range(1, 3):
			var p = geometry.sample(geometry.sector_ends[sector - 1])
			draw_circle(screen(p.p), 4, Color("48756c"))
			draw_string(
				font,
				screen(p.p) + Vector2(8, -6),
				"S%d" % sector,
				HORIZONTAL_ALIGNMENT_LEFT,
				-1,
				12,
				Color("48756c")
			)
		_draw_corner_markers(font)
		if editing and not geometry.preview_only:
			for finding in diagnostics:
				if finding.severity != "error":
					continue
				var p = screen(geometry.sample(finding.fraction * geometry.length, true).p)
				draw_circle(p, 10, CircuitPalette.DANGER)
				draw_string(
					font,
					p + Vector2(-2, 5),
					"!",
					HORIZONTAL_ALIGNMENT_LEFT,
					-1,
					15,
					CircuitPalette.BG
				)
		if show_profile:
			_draw_profile()
	if editing:
		_draw_editor()
		draw_selection()
		draw_sketch()
	_draw_measurement(font)
	draw_rect(Rect2(Vector2.ZERO, size), CircuitPalette.LINE, false, 1)
	var scale_metres = pow(10, floor(log(100 / zoom) / log(10)))
	if scale_metres * zoom < 50:
		scale_metres *= 5
	var at = Vector2(24, size.y - 27)
	draw_line(at, at + Vector2(scale_metres * zoom, 0), CircuitPalette.MUTED, 2)
	draw_string(
		font,
		at + Vector2(0, -9),
		"%d m" % int(scale_metres),
		HORIZONTAL_ALIGNMENT_LEFT,
		-1,
		11,
		CircuitPalette.MUTED
	)
	draw_string(
		font, Vector2(size.x - 36, 36), "N", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, CircuitPalette.MUTED
	)
	draw_line(Vector2(size.x - 30, 60), Vector2(size.x - 30, 43), CircuitPalette.MUTED, 1.5)


func build_surface_geometry() -> void:
	TrackCanvasOverlayRenderer.build_surface_geometry(self)


func draw_surface(target: Control) -> void:
	TrackCanvasOverlayRenderer.draw_surface(self, target)


func _draw_editor() -> void:
	var font = ThemeDB.fallback_font
	for i in range(document.get("nodes", []).size()):
		if not layer_visible("road"):
			continue
		var node = document.nodes[i]
		var p = screen(TrackDocument.point(node))
		if not Rect2(Vector2(-15, -15), size + Vector2(30, 30)).has_point(p):
			continue
		var chosen = i == selected or selection_kind == "road" and i in selection_ids
		draw_circle(p, 6 if chosen else 3.5, CircuitPalette.ACCENT if chosen else Color("9eb8bd"))
		draw_circle(p, 2, CircuitPalette.BG)
		if chosen and (selection_ids.size() <= 1 or i == selected):
			draw_string(
				font,
				p + Vector2(8, -12),
				"POINT %d" % (i + 1),
				HORIZONTAL_ALIGNMENT_LEFT,
				-1,
				12,
				CircuitPalette.ACCENT
			)
			for key in ["in", "out"]:
				var h = screen(TrackDocument.point(node) + TrackDocument.handle(node, key))
				draw_line(p, h, CircuitPalette.ACCENT, 1, true)
				draw_rect(
					Rect2(h - Vector2(4, 4), Vector2(8, 8)), CircuitPalette.ACCENT, false, 1.5
				)
	if selected_object >= 0 and selected_object < document.objects.size():
		var obj = document.objects[selected_object]
		var p = screen(Vector2(obj.x, obj.y))
		draw_rect(Rect2(p - Vector2(15, 15), Vector2(30, 30)), CircuitPalette.ACCENT, false, 1.5)
		draw_string(
			font,
			p + Vector2(18, -12),
			str(obj.type).to_upper(),
			HORIZONTAL_ALIGNMENT_LEFT,
			-1,
			12,
			CircuitPalette.ACCENT
		)
	if mode == "pit" and layer_visible("pits") and not document.get("pits", []).is_empty():
		for i in range(document.pits[0].nodes.size()):
			var p = screen(TrackDocument.point(document.pits[0].nodes[i]))
			draw_circle(p, 5 if i == selected_pit else 3, CircuitPalette.ACCENT)
			if i == selected_pit:
				draw_string(
					font,
					p + Vector2(8, -8),
					"PIT POINT %d" % (i + 1),
					HORIZONTAL_ALIGNMENT_LEFT,
					-1,
					12,
					CircuitPalette.ACCENT
				)


func _draw_profile() -> void:
	TrackCanvasOverlayRenderer.draw_profile(self)


func draw_cars(target: Control) -> void:
	TrackCanvasOverlayRenderer.draw_cars(self, target)


func _draw_grid() -> void:
	if show_grid:
		var grid = 50.0
		while grid * zoom < 35:
			grid *= 2
		while grid * zoom > 140:
			grid *= 0.5
		var lo = world(Vector2(0, size.y))
		var hi = world(Vector2(size.x, 0))
		var x = floor(lo.x / grid) * grid
		while x < hi.x:
			draw_line(screen(Vector2(x, lo.y)), screen(Vector2(x, hi.y)), Color("6d875421"), 1)
			x += grid
		var y = floor(lo.y / grid) * grid
		while y < hi.y:
			draw_line(screen(Vector2(lo.x, y)), screen(Vector2(hi.x, y)), Color("6d875421"), 1)
			y += grid


func _draw_measurement(font: Font) -> void:
	if measure_start != Vector2.INF:
		var end = measure_end if measure_end != Vector2.INF else world(last_mouse)
		draw_line(screen(measure_start), screen(end), CircuitPalette.ACCENT, 2, true)
		draw_circle(screen(measure_start), 5, CircuitPalette.ACCENT)
		draw_circle(screen(end), 5, CircuitPalette.ACCENT)
		draw_string(
			font,
			(screen(measure_start) + screen(end)) * 0.5 + Vector2(5, -9),
			"%.1f m" % measure_start.distance_to(end),
			HORIZONTAL_ALIGNMENT_LEFT,
			-1,
			14,
			CircuitPalette.ACCENT
		)


func _draw_corner_markers(font: Font) -> void:
	for marker in document.get("cornerMarkers", []):
		if not marker.has("x") or not marker.has("y"):
			continue
		var p = screen(Vector2(marker.x, marker.y))
		draw_circle(p, 2, CircuitPalette.MUTED)
		if zoom > 0.3:
			draw_string(
				font,
				p + Vector2(6, -4),
				str(marker.get("number", "")),
				HORIZONTAL_ALIGNMENT_LEFT,
				-1,
				10,
				CircuitPalette.MUTED
			)
