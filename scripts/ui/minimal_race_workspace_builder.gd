class_name MinimalRaceWorkspaceBuilder
extends RefCounted
## Read-only presentation and control composition for its owning view.


static func build_toolbar(view) -> void:
	view.toolbar = PanelContainer.new()
	view.toolbar.add_theme_stylebox_override(
		"panel",
		MinimalRaceStyle.surface(
			MinimalRaceStyle.PANEL, MinimalRaceStyle.LINE, roundi(9 * view.text_scale)
		)
	)
	view.add_child(view.toolbar)
	var row = HBoxContainer.new()
	view.toolbar.add_child(row)
	var menu_button = view.button("Menu", func(): view.menu_requested.emit())
	row.add_child(menu_button)
	menu_button.tooltip_text = "Pause, save this weekend and return to the menu."
	var identity = VBoxContainer.new()
	identity.add_theme_constant_override("separation", 1)
	row.add_child(identity)
	view.session_label = view.label("WEEKEND", 11, true)
	identity.add_child(view.session_label)
	view.clock_label = view.label("Ready", 18)
	identity.add_child(view.clock_label)
	var spacer = Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(spacer)
	view.playback_label = view.label("Paused", 12, true)
	row.add_child(view.playback_label)
	view.pause_button = view.button(
		"Pause",
		func():
			view.controls.pause()
			view.refresh(),
		true
	)
	row.add_child(view.pause_button)
	view.play_button = view.button(
		"Play",
		func():
			view.controls.play()
			view.refresh(),
		true
	)
	row.add_child(view.play_button)
	view.pause_button.tooltip_text = "Pause simulation · Space"
	view.play_button.tooltip_text = "Run at the selected speed · Space"
	view.speed_control = OptionButton.new()
	view.speed_control.custom_minimum_size = Vector2(70 * view.text_scale, 36 * view.text_scale)
	for speed in [1, 2, 4, 8, 16]:
		view.speed_control.add_item(str(speed) + "×", speed)
	view.speed_control.item_selected.connect(
		func(index):
			view.controls.set_speed(view.speed_control.get_item_id(index))
			view.refresh(),
	)
	view.speed_control.accessibility_name = "Simulation speed"
	row.add_child(view.speed_control)
	view.strategy_button = view.button("Strategy", view.show_strategy_comparison)
	row.add_child(view.strategy_button)
	view.primary_button = view.button("Start practice", view.advance_stage)
	MinimalRaceStyle.primary(view.primary_button, view.text_scale)
	row.add_child(view.primary_button)


static func build_body(view) -> void:
	view.body = HBoxContainer.new()
	view.body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	view.add_child(view.body)
	view.timing_panel = PanelContainer.new()
	view.timing_panel.custom_minimum_size.x = 270 * view.text_scale
	view.body.add_child(view.timing_panel)
	var left = VBoxContainer.new()
	view.timing_stack = left
	view.timing_panel.add_child(left)
	var tower_heading = HBoxContainer.new()
	left.add_child(tower_heading)
	var tower_title = view.label("Timing", 16)
	tower_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tower_heading.add_child(tower_title)
	view.timing_caption = view.label("", 11, true)
	tower_heading.add_child(view.timing_caption)
	view.tower = Tree.new()
	view.tower.hide_root = true
	view.tower.columns = 4
	view.tower.select_mode = Tree.SELECT_ROW
	view.tower.column_titles_visible = true
	view.tower.size_flags_vertical = Control.SIZE_EXPAND_FILL
	view.tower.add_theme_stylebox_override(
		"panel", UI.box(MinimalRaceStyle.PANEL, Color.TRANSPARENT, 0, 0)
	)
	view.tower.add_theme_stylebox_override(
		"selected", MinimalRaceStyle.surface(MinimalRaceStyle.SELECTED, MinimalRaceStyle.ACCENT, 0)
	)
	view.tower.add_theme_stylebox_override(
		"selected_focus", view.tower.get_theme_stylebox("selected")
	)
	view.tower.add_theme_constant_override(
		"v_separation",
		roundi((1 if view.get_viewport_rect().size.y <= 760 else 5) * view.text_scale)
	)
	view.tower.add_theme_constant_override("indent", 0)
	view.tower.add_theme_font_size_override("font_size", roundi(13 * view.text_scale))
	view.tower.add_theme_font_size_override("title_button_font_size", roundi(11 * view.text_scale))
	view.tower.add_theme_color_override("title_button_color", MinimalRaceStyle.MUTED)
	for column in range(4):
		view.tower.set_column_title(column, ["P", "DRIVER", "TIME", "STATE"][column])
		view.tower.set_column_expand(column, column == 2)
		view.tower.set_column_title_alignment(
			column, HORIZONTAL_ALIGNMENT_RIGHT if column == 2 else HORIZONTAL_ALIGNMENT_CENTER
		)
		view.tower.set_column_custom_minimum_width(
			column, [32, 64, 94, 44][column] * view.text_scale
		)
		for state in ["normal", "hover", "pressed"]:
			view.tower.add_theme_stylebox_override(
				"title_button_" + state, UI.box(MinimalRaceStyle.PANEL, Color.TRANSPARENT, 0, 2)
			)
	left.add_child(view.tower)
	var root_item = view.tower.create_item()
	for car in view.frame.cars:
		var item = view.tower.create_item(root_item)
		item.set_metadata(0, car.id)
		view.items_by_id[car.id] = item
		view.rank_rows.append(item)
		item.set_text_alignment(0, HORIZONTAL_ALIGNMENT_CENTER)
		item.set_text_alignment(2, HORIZONTAL_ALIGNMENT_RIGHT)
		item.set_text_alignment(3, HORIZONTAL_ALIGNMENT_CENTER)
		item.set_custom_font_size(3, roundi(10 * view.text_scale))
	view.tower.item_selected.connect(
		func():
			var item = view.tower.get_selected()
			if item and view.controls.owned(int(item.get_metadata(0))):
				view.select_driver(int(item.get_metadata(0))),
	)
	view.tower.accessibility_name = "Timing tower; your drivers are marked with an asterisk"
	left.add_child(view.label("* Your team   ~ Estimated gap", 11, true))
	view.canvas = TrackCanvas.new()
	view.canvas.configure_presentation(view.preferences)
	view.canvas.visual_source = view.session.visual_source
	view.canvas.show_grid = false
	view.canvas.show_line = false
	view.canvas.show_surface = false
	view.canvas.show_labels = view.preferences.get("labels", true)
	view.canvas.fit_padding = Vector2(36, 36)
	view.canvas.set_track(view.session.visual_source.detached_track())
	var circuit = VBoxContainer.new()
	circuit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	circuit.size_flags_vertical = Control.SIZE_EXPAND_FILL
	circuit.add_theme_constant_override("separation", 6)
	view.body.add_child(circuit)
	var title = HBoxContainer.new()
	circuit.add_child(title)
	var track_name = view.label(view.frame.track.document.name, 13, true)
	track_name.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	track_name.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	title.add_child(track_name)
	title.add_child(view.label("F · Fit view", 11, true))
	circuit.add_child(view.canvas)
	view.canvas.car_selected.connect(
		func(id):
			if view.controls.owned(id):
				view.select_driver(id),
	)
	view.canvas.tooltip_text = (
		view.frame.track.document.name
		+ " · Wheel to zoom; drag with the middle mouse button to pan; F to fit."
	)
	view.build_pitwall()


static func build_pitwall(view) -> void:
	view.pitwall = PanelContainer.new()
	view.pitwall.add_theme_stylebox_override(
		"panel",
		MinimalRaceStyle.surface(
			MinimalRaceStyle.PANEL, MinimalRaceStyle.LINE, roundi(10 * view.text_scale)
		)
	)
	view.pitwall.custom_minimum_size.x = 244 * view.text_scale
	view.body.add_child(view.pitwall)
	var right = VBoxContainer.new()
	view.pit_right = right
	right.add_theme_constant_override("separation", roundi(7 * view.text_scale))
	view.pitwall.add_child(right)
	var masthead = HBoxContainer.new()
	view.pit_masthead = masthead
	right.add_child(masthead)
	var title = view.label("PITWALL", 11, true)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	masthead.add_child(title)
	masthead.add_child(view.label("MANUAL", 10, true))
	var choices = HBoxContainer.new()
	choices.add_theme_constant_override("separation", 3)
	right.add_child(choices)
	for car in view.frame.cars:
		if not car.player:
			continue
		var id = int(car.id)
		var choice = view.button(car.short, func(): view.select_driver(id), true)
		choice.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		choice.tooltip_text = car.name
		choice.accessibility_name = "Select " + car.name
		choices.add_child(choice)
		view.driver_buttons[id] = choice
	var selected_panel = PanelContainer.new()
	view.pit_selected_panel = selected_panel
	selected_panel.add_theme_stylebox_override(
		"panel",
		MinimalRaceStyle.surface(Color("1e3036"), Color.TRANSPARENT, roundi(8 * view.text_scale))
	)
	right.add_child(selected_panel)
	var selected_row = HBoxContainer.new()
	selected_panel.add_child(selected_row)
	view.pit_identity = view.label("", 22)
	selected_row.add_child(view.pit_identity)
	var names = VBoxContainer.new()
	names.add_theme_constant_override("separation", 0)
	names.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	selected_row.add_child(names)
	view.name_label = view.label("", 14)
	names.add_child(view.name_label)
	view.state_label = view.label("", 11, true)
	names.add_child(view.state_label)
	right.add_child(view.label("PIT OPERATIONS", 10, true))
	var pit_actions = HBoxContainer.new()
	pit_actions.add_theme_constant_override("separation", roundi(5 * view.text_scale))
	right.add_child(pit_actions)
	view.send_button = view.button("Send out", func(): view.driver_action("send"))
	pit_actions.add_child(view.send_button)
	view.box_button = view.button("Box this lap", func(): view.driver_action("box"))
	pit_actions.add_child(view.box_button)
	for node in [view.send_button, view.box_button]:
		node.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		for state in ["normal", "hover", "pressed", "disabled"]:
			var style = node.get_theme_stylebox(state).duplicate()
			style.content_margin_left = 6 * view.text_scale
			style.content_margin_right = 6 * view.text_scale
			node.add_theme_stylebox_override(state, style)
	view.pace_label = view.label("Pace · Normal", 12, true)
	right.add_child(view.pace_label)
	var pace_row = HBoxContainer.new()
	pace_row.add_theme_constant_override("separation", roundi(5 * view.text_scale))
	right.add_child(pace_row)
	view.push_button = view.button("Push", func(): view.driver_action("push"), true)
	pace_row.add_child(view.push_button)
	view.calm_button = view.button("Calm", func(): view.driver_action("calm"), true)
	pace_row.add_child(view.calm_button)
	for node in [view.push_button, view.calm_button]:
		node.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	right.add_child(view.label("ENGINE MODE", 10, true))
	view.engine_control = OptionButton.new()
	view.engine_control.custom_minimum_size.y = 36 * view.text_scale
	for text in ["Save", "Standard", "Power"]:
		view.engine_control.add_item(text)
	view.engine_control.get_popup().about_to_popup.connect(
		func():
			view.engine_target_id = view.selected_id
			view.engine_target_phase = view.controls.current_phase(),
	)
	view.engine_control.item_selected.connect(
		func(index):
			if (
				view.engine_target_id == view.selected_id
				and view.engine_target_phase == view.controls.current_phase()
			):
				view.controls.mode(view.engine_target_id, "engine", index)
				view.remember_message()
			view.refresh(),
	)
	view.engine_control.accessibility_name = "Engine mode for selected driver"
	right.add_child(view.engine_control)
	view.engine_description = view.label("", 11, true)
	right.add_child(view.engine_description)
	right.add_child(HSeparator.new())
	view.receipt_label = view.label("", 12)
	view.receipt_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	view.receipt_label.size.x = 220 * view.text_scale
	view.receipt_label.max_lines_visible = 2
	view.receipt_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	right.add_child(view.receipt_label)
	view.hint_label = view.label("", 12, true)
	view.hint_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	view.hint_label.size.x = 220 * view.text_scale
	view.hint_label.max_lines_visible = 2
	view.hint_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	right.add_child(view.hint_label)
	var space = Control.new()
	space.size_flags_vertical = Control.SIZE_EXPAND_FILL
	right.add_child(space)
