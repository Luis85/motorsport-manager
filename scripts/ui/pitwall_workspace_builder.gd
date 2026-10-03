class_name PitwallWorkspaceBuilder
extends RefCounted
## Read-only presentation and control composition for its owning view.


static func _ready(view) -> void:
	view.text_scale = float(view.presentation_services.preferences.get("pitwall_text_scale", 1.0))
	view.set_meta("pitwall_text_scale", view.text_scale)
	view.detail_picker.add_item("Session results")
	var results_page = view.tab_page("Session results")
	view.results_page_index = view.tabs.get_tab_count() - 1
	view.groups.Review.append(view.results_page_index)
	if view.recovery_page_index >= 0:
		view.groups.Conditions.insert(1, view.recovery_page_index)
	view.results_panel = SessionResultsPanel.new()
	view.results_panel.configure(view.sim)
	results_page.add_child(view.results_panel)
	view.register_topic("Results", view.results_page_index)
	view.detail_picker.add_item("Decision review")
	var decision_page = view.tab_page("Decision review")
	view.decision_page_index = view.tabs.get_tab_count() - 1
	view.decision_drawer = RaceDecisionDrawer.new()
	view.decision_drawer.configure(view.strategy_model)
	decision_page.add_child(view.decision_drawer)
	view.decision_drawer.commit_bar.reparent(view.detail_actions)
	view.decision_drawer.command_requested.connect(view._decision_command)
	view.decision_drawer.refresh_requested.connect(func(id): view.open_decision(id, true))
	view.decision_drawer.detail_requested.connect(view.open_strategy)
	view.register_topic("Decision", view.decision_page_index)
	view.build_navigation()
	view.build_header()
	view.compact_inspector()
	view.strategy_desk.compact_host = true
	for id in view.sim.player_ids():
		var card = PitwallCarCard.new()
		card.build(
			view.decision_controls[id].compare.get_parent().get_parent().get_parent(),
			view.decision_controls[id],
			view.sim.car(id),
			func(): view.show_driver_details(id)
		)
		view.car_cards[id] = card
	view.team_panel.plan_requested.connect(view.open_strategy)
	for button in view.team_panel.topic_buttons:
		button.pressed.connect(view.refresh_navigation)
	for id in view.sim.player_ids():
		var popup = view.decision_controls[id].more.get_popup()
		popup.add_item("Open pit service", 2)
		popup.id_pressed.connect(
			func(action_id):
				if action_id == 2:
					view.select_driver(id)
					view.open_topic(8)
					view.team_panel.show_topic(2),
		)
	view.build_driver_rail()
	view.race_read_button = UI.button("Race read", view.show_race_read)
	view.map_controls.add_child(view.race_read_button)
	view.race_read_button.tooltip_text = (
		"Read both drivers’ current stakes and trade-offs in a fixed snapshot. "
		+ "Observation only; the race keeps its current time controls."
	)
	view.inspector_home = view.right_panel.get_parent()
	view.analysis_workspace = RaceAnalysisWorkspace.new()
	view.analysis_workspace.configure(view.strategy_model)
	view.add_child(view.analysis_workspace)
	view.move_child(view.analysis_workspace, view.race_workspace.get_index() + 1)
	view.analysis_workspace.hide()
	view.analysis_workspace.close_requested.connect(view.close_session_workspace)
	view.analysis_workspace.driver_requested.connect(view.select_driver)
	view.focus_button = UI.button("Full view", view.open_analysis_workspace)
	view.teammate_buttons[0].get_parent().add_child(view.focus_button)
	view.focus_button.tooltip_text = (
		"Open this task in a full workspace. The same drafts and explicit commit actions "
		+ "are retained."
	)

	view.results_home = view.results_panel.get_parent()
	view.results_workspace = RaceResultsWorkspace.new()
	view.results_workspace.configure(view.sim)
	view.add_child(view.results_workspace)
	view.move_child(view.results_workspace, view.race_workspace.get_index() + 1)
	view.results_workspace.hide()
	view.results_workspace.close_requested.connect(view.close_session_workspace)
	view.results_workspace.action_requested.connect(view._result_action)
	view.debrief_text.get_parent().add_child(
		UI.button("Structured decision evidence", view.open_journal_workspace)
	)
	view.session_workspace_button = UI.button("Session workspace", view.open_session_workspace)
	view.navigation.add_child(view.session_workspace_button)

	view.decision_queue = RaceDecisionQueue.new()
	view.decision_queue.driver_ids = view.sim.player_ids()
	view.add_child(view.decision_queue)
	view.move_child(view.decision_queue, view.navigation.get_index() + 1)
	view.decision_queue.review_requested.connect(view.open_decision)
	view.decision_queue.hold_requested.connect(view._queue_hold)
	view.comparison = PitwallComparison.new()
	view.strategy_desk.estimates.get_parent().add_child(view.comparison)
	view.strategy_desk.estimates.get_parent().move_child(
		view.comparison, view.strategy_desk.estimates.get_index()
	)
	view.strategy_desk.estimates.visible = false
	view.strategy_desk.rejoin.visible = false
	view.strategy_desk.preview_changed.connect(
		func(value):
			view.comparison.present(
				value, view.strategy_desk.dirty.get(view.strategy_desk.driver_id, false)
			),
	)
	view.comparison.present(
		view.strategy_desk.preview,
		view.strategy_desk.dirty.get(view.strategy_desk.driver_id, false)
	)
	var footer = UI.hbox(view)
	view.radio_label.reparent(footer)
	view.radio_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	view.messages_button = UI.button("Messages", view.show_messages)
	view.navigation.add_child(view.messages_button)
	view.navigation.move_child(view.messages_button, view.find_button.get_index())
	PitwallDesign.linear_focus(
		[view.watch_button] + view.group_buttons.values() + [view.messages_button, view.find_button]
	)
	view.messages_button.tooltip_text = (
		"Read this view's last 50 command acknowledgements and errors. Race radio "
		+ "remains in Review / Radio."
	)
	view.navigator = PitwallNavigator.new()
	view.add_child(view.navigator)
	view.navigator.configure(
		view.sim is RaceViewQuery and view.sim.has_mechanic("weather"),
		view.text_scale,
		view.sim is RaceViewQuery and view.sim.has_mechanic("recovery")
	)
	view.navigator.destination_requested.connect(view.open_destination)
	view.navigator.catalog.append(
		[
			8,
			2,
			"Team / Pit service",
			"accepted approach entry queue frozen service actual exit cancel stop"
		]
	)
	view.navigator.catalog.append(
		[8, 3, "Team / Accepted plans", "shared windows bounded pace fuel engine override timeline"]
	)
	view.navigator.catalog.append(
		[
			2,
			1,
			"Review / Read the race",
			"stakes trade-offs next decision both drivers observed evidence story snapshot"
		]
	)
	view.navigator.catalog.append(
		[
			view.results_page_index,
			0,
			"Review / Results",
			"results classification qualifying practice race laps retired finish"
		]
	)
	view.navigator.catalog.append(
		[
			view.decision_page_index,
			0,
			"Strategy / Decision review",
			"decision evidence confirm deadline acknowledgement"
		]
	)
	view.navigator.filter_views("")
	# Catalog/dialog controls are scaled separately on construction.
	for child in view.get_children():
		if child != view.navigator:
			PitwallDesign.scale_controls(child, view.text_scale)
	for card in view.car_cards.values():
		card.issue.custom_minimum_size.y = ceilf(18 * view.text_scale)
	view.gamepad_navigation = RaceGamepadNavigation.new()
	view.gamepad_navigation.configure(view)
	view.add_child(view.gamepad_navigation)
	RaceAccessibility.describe(view)
	view.configure_finishing_guide()
	view.workspace_ready = true
	view.resized.connect(view.adapt_layout)
	view.wire_control_help(view)
	view.refresh()
	view.close_detail()


static func build_navigation(view) -> void:
	view.context_navigation = UI.hbox(view.detail_nav_host)
	view.detail_nav_host.move_child(view.context_navigation, 0)
	for index in view.topic_buttons:
		view.topic_buttons[index].reparent(view.context_navigation)
	for group in view.groups:
		var valid = view.groups[group].filter(func(index): return view.topic_buttons.has(index))
		if valid.is_empty():
			continue
		view.group_memory[group] = valid[0]
		var button = UI.button(
			group,
			func():
				view.last_invoker = view.group_buttons[group]
				view.open_topic(view.group_memory[group]),
		)
		button.tooltip_text = (
			group
			+ " views: "
			+ ", ".join(valid.map(func(index): return view.topic_buttons[index].text))
		)
		view.navigation.add_child(button)
		view.group_buttons[group] = button
	var spacer = Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	view.navigation.add_child(spacer)
	view.find_button = UI.button("Find · Ctrl+K", view.show_navigator)
	view.navigation.add_child(view.find_button)
	view.find_button.tooltip_text = "Search or browse every pit-wall view. Navigation only; no commands are executed."
	PitwallDesign.linear_focus(
		[view.watch_button] + view.group_buttons.values() + [view.find_button]
	)


static func build_header(view) -> void:
	view.header_context = view.session_header.header_context
	view.phase_actions = view.session_header.phase_actions
	view.weekend_menu = view.session_header.weekend_menu
	view.timing_panel.custom_minimum_size.x = ceilf(PitwallDesign.TIMING_WIDTH * view.text_scale)
	view.tower.add_theme_constant_override("v_separation", 2)
	for i in range(5):
		view.tower.set_column_custom_minimum_width(
			i, ceili([24, 37, 61, 26, 38][i] * view.text_scale)
		)


static func compact_inspector(view) -> void:
	# Put targeting and pane controls on one line; avoid a second redundant title row.
	var row = view.teammate_buttons[0].get_parent()
	var old_row = view.detail_caption.get_parent()
	view.expand_button.reparent(row)
	for child in old_row.get_children():
		if child is Button and child != view.detail_picker:
			child.reparent(row)
	old_row.hide()


static func build_driver_rail(view) -> void:
	view.driver_rail = VBoxContainer.new()
	view.timing_panel.get_parent().add_child(view.driver_rail)
	view.driver_rail.size_flags_vertical = Control.SIZE_EXPAND_FILL
	view.driver_rail.add_theme_constant_override("separation", PitwallDesign.SPACE_2)
	view.race_read_panel = RaceReadPanel.new()
	view.driver_rail.add_child(view.race_read_panel)
	view.race_read_panel.reading_requested.connect(view.show_race_read)
	view.race_read_panel.radio_requested.connect(func(): view.open_topic(2))
	view.driver_rail.hide()
