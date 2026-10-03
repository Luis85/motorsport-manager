class_name RaceMetricChart
extends RaceMetricChartData
## Native presentation responsibilities; inherited state remains per instance.


func _ready() -> void:
	panel_style = PitwallDesign.chart_surface()
	focus_mode = Control.FOCUS_ALL
	mouse_default_cursor_shape = Control.CURSOR_CROSS
	_update_minimum()


func _notification(what: int) -> void:
	if what == NOTIFICATION_THEME_CHANGED and is_node_ready():
		_update_minimum()
		queue_redraw()
	elif what in [NOTIFICATION_FOCUS_ENTER, NOTIFICATION_FOCUS_EXIT]:
		queue_redraw()


func _update_minimum() -> void:
	custom_minimum_size = Vector2(
		250,
		ceilf(
			(
				(182 + (20 if not comparison_name.is_empty() else 0))
				* get_theme_font_size("font_size")
				/ 13.0
			)
		)
	)


func sample_label(index: int) -> String:
	if index < 0 or index >= series.size():
		return "No recorded samples"
	if mode == "cases":
		return str(categories[index]) if index < categories.size() else "Case %d" % (index + 1)
	if index < x_labels.size() and not str(x_labels[index]).is_empty():
		return str(x_labels[index])
	return (
		"%s %.1f" % [domain, x_values[index]]
		if not x_values.is_empty()
		else "Sample %d" % (index + 1)
	)


func selected_text() -> String:
	if cursor < 0 or cursor >= series.size():
		return "No recorded samples yet"
	var value = (
		"%s · %s"
		% [
			sample_label(cursor),
			"Unavailable" if series[cursor] == null else "%.2f %s" % [series[cursor], unit]
		]
	)
	if not comparison_name.is_empty():
		value += (
			"\n%s · %s"
			% [
				comparison_name,
				(
					"Unavailable at this position"
					if comparison[cursor] == null
					else "%.2f %s" % [comparison[cursor], unit]
				)
			]
		)
	return value


func _update_description() -> void:
	accessibility_description = (
		"%s %s. %d positions, %d unavailable. Range %.2f to %.2f %s."
		% [tooltip_text, selected_text(), series.size(), series.count(null), minimum, maximum, unit]
	)


func plot_area() -> Rect2:
	var scale_factor = get_theme_font_size("font_size") / 13.0
	return Rect2(
		52 * scale_factor,
		40 * scale_factor,
		maxf(1, size.x - 66 * scale_factor),
		maxf(1, size.y - (107 + (20 if not comparison_name.is_empty() else 0)) * scale_factor)
	)


func x_fraction(index: int) -> float:
	if series.size() <= 1:
		return 0.5
	if mode == "cases":
		return (float(index) + 0.5) / series.size()
	if not x_values.is_empty() and x_values.back() > x_values.front():
		return (
			(float(x_values[index]) - float(x_values.front()))
			/ (float(x_values.back()) - float(x_values.front()))
		)
	return float(index) / (series.size() - 1)


func _gui_input(event: InputEvent) -> void:
	if series.is_empty():
		return
	var selected = cursor
	if event is InputEventKey and event.pressed:
		match event.keycode:
			KEY_LEFT:
				selected = maxi(0, cursor - 1)
			KEY_RIGHT:
				selected = mini(series.size() - 1, cursor + 1)
			KEY_HOME:
				selected = 0
			KEY_END:
				selected = series.size() - 1
			_:
				return
	elif (
		event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT
	):
		grab_focus()
		var fraction = clampf(
			(event.position.x - plot_area().position.x) / plot_area().size.x, 0, 1
		)
		var best = INF
		for i in range(series.size()):
			var distance = absf(x_fraction(i) - fraction)
			if distance < best:
				best = distance
				selected = i
	elif event is InputEventJoypadButton and event.pressed:
		if event.button_index == JOY_BUTTON_DPAD_LEFT:
			selected = maxi(0, cursor - 1)
		elif event.button_index == JOY_BUTTON_DPAD_RIGHT:
			selected = mini(series.size() - 1, cursor + 1)
		else:
			return
	else:
		return
	cursor = selected
	_update_description()
	queue_redraw()
	accept_event()


func _draw() -> void:
	if panel_style == null:
		return
	draw_style_box(panel_style, Rect2(Vector2.ZERO, size))
	if has_focus():
		draw_rect(Rect2(Vector2(2, 2), size - Vector2(4, 4)), UI.PRIMARY, false, 2)
	var font = get_theme_font("font")
	var scale_factor = get_theme_font_size("font_size") / 13.0
	var caption = maxi(11, roundi(11 * scale_factor))
	var text_size = maxi(12, roundi(12 * scale_factor))
	draw_string(
		font,
		Vector2(12, 21 * scale_factor),
		title,
		HORIZONTAL_ALIGNMENT_LEFT,
		size.x - 24,
		caption,
		UI.ACCENT
	)
	var area = plot_area()
	for i in range(3):
		var fraction = i / 2.0
		var y = area.position.y + area.size.y * fraction
		draw_line(Vector2(area.position.x, y), Vector2(area.end.x, y), UI.LINE, 1)
		draw_string(
			font,
			Vector2(4, y + caption * 0.35),
			"%.1f" % lerpf(maximum, minimum, fraction),
			HORIZONTAL_ALIGNMENT_RIGHT,
			area.position.x - 10,
			caption,
			UI.MUTED
		)
	if series.is_empty():
		draw_string(
			font,
			area.position + Vector2(4, 25 * scale_factor),
			"No recorded samples yet",
			HORIZONTAL_ALIGNMENT_LEFT,
			area.size.x - 8,
			text_size,
			UI.MUTED
		)
	elif mode == "cases":
		var width = area.size.x / series.size()
		for i in range(series.size()):
			var x = area.position.x + width * i
			if series[i] != null:
				var h = clampf((series[i] - minimum) / (maximum - minimum), 0, 1) * area.size.y
				draw_rect(
					Rect2(x + width * 0.2, area.end.y - maxf(1, h), width * 0.6, maxf(1, h)),
					UI.GOOD if i == 0 else UI.ACCENT
				)
				draw_string(
					font,
					Vector2(x, maxf(area.position.y + text_size, area.end.y - h - 4)),
					"%.0f%%" % series[i],
					HORIZONTAL_ALIGNMENT_CENTER,
					width,
					text_size,
					UI.INK
				)
			else:
				draw_string(
					font,
					Vector2(x, area.get_center().y),
					"N/A",
					HORIZONTAL_ALIGNMENT_CENTER,
					width,
					text_size,
					UI.MUTED
				)
			draw_string(
				font,
				Vector2(x, area.end.y + 18 * scale_factor),
				sample_label(i),
				HORIZONTAL_ALIGNMENT_CENTER,
				width,
				caption,
				UI.INK
			)
	else:
		var previous: Variant = null
		for i in range(series.size()):
			if series[i] == null:
				previous = null
				continue
			var point = Vector2(
				area.position.x + area.size.x * x_fraction(i),
				area.end.y - clampf((series[i] - minimum) / (maximum - minimum), 0, 1) * area.size.y
			)
			if previous != null:
				draw_line(previous, point, UI.PRIMARY, 2.0, true)
			draw_circle(point, 3 if i == cursor else 2, UI.PRIMARY)
			previous = point
		_draw_comparison(area)
		if cursor >= 0:
			var x = area.position.x + area.size.x * x_fraction(cursor)
			draw_line(Vector2(x, area.position.y), Vector2(x, area.end.y), UI.ACCENT, 1)
		draw_string(
			font,
			Vector2(area.position.x, area.end.y + 18 * scale_factor),
			sample_label(0),
			HORIZONTAL_ALIGNMENT_LEFT,
			area.size.x * 0.5,
			caption,
			UI.MUTED
		)
		if series.size() > 1:
			draw_string(
				font,
				Vector2(area.get_center().x, area.end.y + 18 * scale_factor),
				sample_label(series.size() - 1),
				HORIZONTAL_ALIGNMENT_RIGHT,
				area.size.x * 0.5,
				caption,
				UI.MUTED
			)
	var readout = selected_text().split("\n")
	for i in range(readout.size()):
		draw_string(
			font,
			Vector2(12, size.y - (25 + (readout.size() - 1 - i) * 20) * scale_factor),
			readout[i],
			HORIZONTAL_ALIGNMENT_LEFT,
			size.x - 24,
			text_size,
			UI.INK
		)
	draw_string(
		font,
		Vector2(12, size.y - 8 * scale_factor),
		(
			"%s · %d positions · %d unavailable · ←/→ inspect"
			% [domain, series.size(), series.count(null)]
		),
		HORIZONTAL_ALIGNMENT_LEFT,
		size.x - 24,
		caption,
		UI.MUTED
	)


func _draw_comparison(area: Rect2) -> void:
	if not comparison.is_empty():
		var previous: Variant = null
		for i in range(comparison.size()):
			if comparison[i] == null:
				previous = null
				continue
			var point = Vector2(
				area.position.x + area.size.x * x_fraction(i),
				(
					area.end.y
					- (clampf((comparison[i] - minimum) / (maximum - minimum), 0, 1) * area.size.y)
				)
			)
			if previous != null:
				draw_dashed_line(previous, point, UI.ACCENT, 2.0, 4.0, true)
			var radius = 3 if i == cursor else 2
			draw_rect(
				Rect2(point - Vector2(radius, radius), Vector2(radius * 2, radius * 2)), UI.ACCENT
			)
			previous = point
