class_name WeekendWorkspaceBuilder
extends RefCounted
## Read-only presentation and control composition for its owning view.


static func _ready(view) -> void:
	# Retained Engineering tools keep their established compact type and spacing.
	# Player-facing menus and the Minimal pitwall use regular density.
	view.theme = GameTheme.build(1.0, true)
	view.size_flags_vertical = Control.SIZE_EXPAND_FILL
	view.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	view.add_theme_constant_override("separation", 5)
	view.session_header = RaceSessionHeader.new()
	view.session_header.configure(view.sim)
	view.add_child(view.session_header)
	view.session_strip = view.session_header
	view.session_header.action_requested.connect(view.dispatch)
	view.session_header.utility_requested.connect(view.weekend_action)
	view.session_header.advance_requested.connect(view.primary_action)
	view.title_label = view.session_header.title_label
	view.session_label = view.session_header.session_label
	view.clock_label = view.session_header.clock_label
	view.flag_label = view.session_header.flag_label
	view.weather_label = view.session_header.weather_label
	view.race_context_label = view.session_header.context_label
	view.primary_button = view.session_header.primary_button
	view.pause_button = view.session_header.pause_button
	view.speed_control = view.session_header.speed_control
	view.top_secondary_actions = view.session_header.weekend_menu
	view.steps = view.session_header.steps
	view.navigation = UI.hbox(view)
	view.navigation.add_theme_constant_override("separation", 3)
	view.watch_button = UI.button("Race view", view.close_detail)
	view.watch_button.tooltip_text = "Close the inspector and give the circuit more space. No orders or time changes."
	view.navigation.add_child(view.watch_button)
	view.race_workspace = RaceObservationWorkspace.new()
	view.add_child(view.race_workspace)
	var body = view.race_workspace
	view.timing_view = RaceTimingTower.new()
	view.timing_view.configure(view.sim)
	body.add_child(view.timing_view)
	view.timing_panel = view.timing_view
	view.tower = view.timing_view.tower
	view.rows = view.timing_view.rows
	view.rank_rows = view.timing_view.rank_rows
	view.rendered_rows = view.timing_view.rendered_rows
	view.timing_view.driver_selected.connect(view.select_driver)
	var visual = UI.vbox(body, true)
	view.qualifying_workspace = RaceQualifyingWorkspace.new()
	view.qualifying_workspace.configure(view.sim)
	visual.add_child(view.qualifying_workspace)
	view.qualifying_workspace.hide()
	view.qualifying_workspace.inspect_requested.connect(view._inspect_qualifying)
	var view_row = HBoxContainer.new()
	view.map_controls = view_row
	visual.add_child(view_row)
	view_row.add_child(
		UI.button(
			"Fit · F",
			func():
				view.set_follow(false)
				view.canvas.fit(),
		)
	)
	view.follow_control = UI.check("Follow", false, view.set_follow)
	view_row.add_child(view.follow_control)
	view.layers_menu = MenuButton.new()
	view.layers_menu.text = "Layers"
	view.layers_menu.flat = false
	view.layers_menu.custom_minimum_size.y = 32
	view.layers_menu.tooltip_text = (
		"Optional racing line, driver labels and surface overlays. These never change "
		+ "race conditions."
	)
	view_row.add_child(view.layers_menu)
	view.add_layer(
		"Racing line",
		view.presentation_services.preferences.racing_line,
		func(value):
			view.canvas.show_line = value
			view.canvas.queue_redraw(),
	)
	view.add_layer(
		"Driver labels",
		view.presentation_services.preferences.labels,
		func(value):
			view.canvas.show_labels = value
			view.canvas.queue_redraw(),
	)
	view.surface_control = view.add_layer(
		"Track surface",
		false,
		func(value):
			view.canvas.show_surface = value
			view.canvas.queue_redraw(),
	)
	view.layers_menu.get_popup().hide_on_checkable_item_selection = false
	view.layers_menu.get_popup().id_pressed.connect(
		func(id):
			var control = view.layer_controls[id]
			control.button_pressed = not control.button_pressed
			view.layers_menu.get_popup().set_item_checked(id, control.button_pressed),
	)
	view.layers_menu.get_popup().about_to_popup.connect(
		func():
			for i in range(view.layer_controls.size()):
				view.layers_menu.get_popup().set_item_checked(
					i, view.layer_controls[i].button_pressed
				),
	)
	view.canvas = TrackCanvas.new()
	view.canvas.configure_presentation(view.presentation_services.preferences)
	view.canvas.visual_source = view.sim.visuals
	view.canvas.show_line = view.presentation_services.preferences.racing_line
	view.canvas.show_labels = view.presentation_services.preferences.labels
	view.canvas.show_grid = false
	view.canvas.set_track(view.sim.track)
	visual.add_child(view.canvas)
	view.canvas.car_selected.connect(view.select_driver)
	view.canvas.navigated.connect(func(): view.set_follow(false))
	view.right_panel = UI.race_panel(false, 8)
	view.right_panel.custom_minimum_size.x = 360
	body.add_child(view.right_panel)
	var wall = view._build_driver_inspector()
	view._build_driver_tabs(wall)
	view.decision_strip = UI.race_panel(false, 7)
	view.add_child(view.decision_strip)
	var decision_row = UI.hbox(view.decision_strip)
	decision_row.add_child(UI.label("DECISION QUEUE", 11, UI.ACCENT))
	view.decision_badge = UI.label("CLEAR", 10, UI.GOOD)
	view.decision_badge.custom_minimum_size.x = 54
	decision_row.add_child(view.decision_badge)
	view.decision_text = UI.label("No urgent decision · stay on plan", 12, UI.MUTED)
	view.decision_text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	decision_row.add_child(view.decision_text)
	view.decision_review = UI.button("Review", view.review_decision)
	view.decision_review.tooltip_text = (
		"Open the most relevant control surface for this issue. Reviewing never changes "
		+ "the race."
	)
	decision_row.add_child(view.decision_review)
	view.decision_hold = UI.button("Keep plan", view.hold_decision)
	view.decision_hold.tooltip_text = "Acknowledge this state until the underlying condition materially changes."
	decision_row.add_child(view.decision_hold)
	view.hint = UI.paragraph("")
	view.hint.add_theme_font_size_override("font_size", 12)
	view.add_child(view.hint)
	view.radio_label = UI.label("", 11, UI.MUTED)
	view.add_child(view.radio_label)
	view.refresh()
	view.setup_guide()
	view.call_deferred("wire_control_help", view)
	view.call_deferred("fit_canvas")


static func _build_driver_inspector(view) -> VBoxContainer:
	var wall = UI.vbox(view.right_panel, true)
	wall.add_theme_constant_override("separation", 5)

	var teammates = UI.hbox(wall)
	for id in view.sim.player_ids():
		var b = UI.button("", func(): view.select_driver(id))
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.add_theme_font_size_override("font_size", 12)
		teammates.add_child(b)
		view.teammate_buttons.append(b)
	view.driver_status_card = UI.race_panel(false, 6)
	wall.add_child(view.driver_status_card)
	var driver_status = UI.vbox(view.driver_status_card)
	var driver_heading = UI.hbox(driver_status)
	view.driver_label = UI.label("", 14, UI.ACCENT)
	view.driver_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	driver_heading.add_child(view.driver_label)
	view.driver_position_label = UI.label("", 18, UI.INK)
	driver_heading.add_child(view.driver_position_label)
	view.driver_rival_label = UI.label("", 11, UI.MUTED)
	driver_status.add_child(view.driver_rival_label)
	view.intent_label = UI.label("", 12, UI.MUTED)
	view.intent_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	driver_status.add_child(view.intent_label)
	view.driver_plan_label = UI.label("", 11, UI.MUTED)
	view.driver_plan_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	driver_status.add_child(view.driver_plan_label)
	view.resource_row = UI.hbox(wall)
	for title in ["TYRES", "FUEL", "INTEGRITY"]:
		var cell = UI.vbox(view.resource_row)
		cell.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		cell.add_theme_constant_override("separation", 3)
		cell.add_child(UI.label(title, 10, UI.MUTED))
		var value = UI.label("", 14)
		cell.add_child(value)
		view.resource_labels.append(value)
		var bar = ProgressBar.new()
		bar.show_percentage = false
		bar.custom_minimum_size = Vector2(55, 4)
		bar.add_theme_stylebox_override("background", UI.box(UI.LINE, UI.LINE, 2, 0))
		bar.add_theme_stylebox_override("fill", UI.box(UI.GOOD, UI.GOOD, 2, 0))
		cell.add_child(bar)
		view.resource_bars.append(bar)
	view.compact_resources = UI.label("", 12, UI.MUTED)
	view.compact_resources.visible = false
	wall.add_child(view.compact_resources)
	view.advisory_button = UI.button("No team advisories", func(): view.show_tyres(1))
	view.advisory_button.add_theme_font_size_override("font_size", 11)
	view.advisory_button.custom_minimum_size.y = 28
	view.advisory_button.visible = false
	wall.add_child(view.advisory_button)
	view.detail_picker = UI.option(
		[
			"Commands",
			"Telemetry & lap history",
			"Race control & radio",
			"Tyres & strategy",
			"Setup & handling",
			"Track surface lab"
		],
		func(index): view.tabs.current_tab = index
	)
	view.detail_picker.tooltip_text = "Inspect one topic at a time. Primary pit actions remain below."
	var topic_row = UI.hbox(wall)
	view.detail_picker.visible = false
	topic_row.add_child(view.detail_picker)
	view.detail_caption = UI.label("Drive", 13, UI.ACCENT)
	view.detail_caption.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	topic_row.add_child(view.detail_caption)
	view.expand_button = UI.button(
		"Widen", func(): view.set_detail_expanded(not view.detail_expanded)
	)
	view.expand_button.add_theme_font_size_override("font_size", 12)
	view.expand_button.tooltip_text = (
		"Give this topic more space. The timing tower is temporarily hidden; the map and "
		+ "pit actions stay available."
	)
	topic_row.add_child(view.expand_button)
	var close_button = UI.button("Close", view.close_detail)
	close_button.tooltip_text = "Return to watching. Drafts remain unapplied and are retained."
	topic_row.add_child(close_button)
	view.detail_nav_host = UI.vbox(wall)
	view.tabs = TabContainer.new()
	view.tabs.tabs_visible = false
	view.tabs.size_flags_vertical = Control.SIZE_EXPAND_FILL
	wall.add_child(view.tabs)
	view.tabs.tab_changed.connect(
		func(index):
			view.detail_picker.select(index)
			if view.setup_commit:
				view.setup_commit.visible = index == 4
			view.open_detail()
			view.refresh_navigation()
			if view.radio_label:
				view.refresh(),
	)
	return wall
