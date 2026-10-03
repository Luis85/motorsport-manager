class_name WeekendNavigation
extends RefCounted
## Read-only presentation and control composition for its owning view.


static func setup_guide(view) -> void:
	view.guide = ContextGuide.new()
	view.guide.presentation_services = view.presentation_services
	view.guide.configure(
		"pit wall",
		[
			{
				"title": "Your two drivers",
				"body":
				(
					"MER and MOR are your cars. Select either teammate or click a dot. Rivals can be "
					+ "inspected but cannot receive your commands. Reading this guide does not pause a "
					+ "live session."
				),
				"target": func(): return view.teammate_buttons[0].get_parent()
			},
			{
				"title": "A clear next action",
				"body":
				(
					"Qualifying, preparation, formation, lights and racing are separate phases. "
					+ "Approve the highlighted session action when ready. Space pauses; 1–5 changes "
					+ "speed."
				),
				"target": func(): return view.primary_button
			},
			{
				"title": "Set up the car",
				"body":
				(
					"Open Setup & handling. Stage five adjustments and Apply once. Mechanical "
					+ "changes need the garage; front brake bias remains adjustable while racing. "
					+ "Unapplied values do nothing."
				),
				"target": func(): return view.tabs,
				"reveal": func(): view.open_topic(4)
			},
			{
				"title": "Plan a real tyre set",
				"body":
				(
					"The Tyres page separates four contact patches from the finite allocation. Used "
					+ "sets retain damage. Choosing a set plans it; Send, formation or actual "
					+ "servicing fits it. Schedule one future stop or Box now."
				),
				"target": func(): return view.tabs,
				"reveal": func(): view.open_topic(3)
			},
			{
				"title": "Understand the lap",
				"body":
				(
					"Telemetry keeps measured splits and valid or invalid laps. Flags, tyre damage "
					+ "and pit decisions can be filtered in Radio. Warning chips open tyre detail "
					+ "without taking control of the car."
				),
				"target": func(): return view.tabs,
				"reveal": func(): view.open_topic(1)
			},
			{
				"title": "Read the changing road",
				"body":
				(
					"Track surface lab exposes seven strips across the road: water, rubber, grip and "
					+ "contamination. Click or arrow through cells, then Locate. This is live data, "
					+ "not an illustrated racing-line mask."
				),
				"target": func(): return view.tabs,
				"reveal": func(): view.open_topic(5)
			},
			{
				"title": "Watch or take control",
				"body":
				(
					"Delegate routine runs and strategy to the engineer, or change pace, engine, "
					+ "racecraft and pit calls yourself. The Box and Send controls stay visible while "
					+ "you inspect other topics."
				),
				"target": func(): return view.tabs,
				"reveal": func(): view.open_topic(0)
			}
		]
	)
	view.add_child(view.guide)


static func register_topic(view, title: String, index: int, position: int = -1) -> void:
	var button = UI.button(title, func(): view.open_topic(index))
	button.tooltip_text = (
		{
			0: "Driver modes, release and recall.",
			1: "Measured timing and speed trace.",
			2: "Recoverable race messages and flags.",
			3: "Finite tyre allocation, wheel condition and stop scheduling.",
			4: "Stage garage setup; apply explicitly.",
			5: "Advanced inspection of the authoritative track surface.",
			6: "Compare options, draft a plan or change control ownership.",
			7: "Review measured decisions and outcomes.",
			8: "Cooperate, watch battles or coordinate the shared pit box."
		}
		. get(index, title)
	)
	button.add_theme_font_size_override("font_size", 12)
	view.navigation.add_child(button)
	view.topic_buttons[index] = button
	if position >= 0:
		view.navigation.move_child(button, position)


static func pin_navigation(view, index: int, control: Control) -> void:
	control.reparent(view.detail_nav_host)
	view.pinned_navigation[index] = control
	control.visible = view.tabs.current_tab == index


static func refresh_navigation(view) -> void:
	if not view.navigation or not view.tabs:
		return
	UI.set_active(view.watch_button, not view.right_panel.visible)
	for index in view.topic_buttons:
		UI.set_active(
			view.topic_buttons[index], view.right_panel.visible and view.tabs.current_tab == index
		)
	for index in view.pinned_navigation:
		view.pinned_navigation[index].visible = view.tabs.current_tab == index
	if view.detail_caption:
		view.detail_caption.text = view.detail_picker.get_item_text(view.tabs.current_tab)


static func open_topic(view, index: int) -> void:
	view.open_detail()
	if view.trace:
		view.trace.visible = index == 1
	if view.tabs.current_tab != index:
		view.tabs.current_tab = index
	else:
		view.refresh_navigation()
		view.refresh()


static func open_detail(view) -> void:
	if view.right_panel:
		view.right_panel.visible = true
	view.refresh_navigation()


static func close_detail(view) -> void:
	if not view.right_panel:
		return
	view.detail_expanded = false
	view.timing_panel.visible = true
	view.right_panel.visible = false
	view.right_panel.custom_minimum_size.x = 360
	view.expand_button.text = "Widen"
	view.trace.visible = false
	view.driver_status_card.visible = true
	view.resource_row.visible = true
	view.compact_resources.visible = false
	view.refresh_navigation()
	view.watch_button.grab_focus()


static func wire_control_help(view, node: Node) -> void:
	if node is SpinBox:
		view.wire_control_help(node.get_line_edit())
	# Bind once, not on telemetry refresh. Focus exposes the same explanation as hover.
	if (
		node is Control
		and (node is BaseButton or node is LineEdit)
		and not node.has_meta("help_bound")
	):
		node.set_meta("help_bound", true)
		if node is LineEdit and node.get_parent() is SpinBox and node.tooltip_text.is_empty():
			node.tooltip_text = node.get_parent().tooltip_text
		node.mouse_entered.connect(func(): view.help_target = node)
		node.focus_entered.connect(func(): view.help_target = node)
		node.mouse_exited.connect(
			func():
				if view.help_target == node and not node.has_focus():
					view.help_target = null,
		)
		node.focus_exited.connect(
			func():
				if view.help_target == node:
					view.help_target = null,
		)
	for child in node.get_children():
		view.wire_control_help(child)


static func show_drive(view, index: int) -> void:
	view.drive_topic = index
	for i in range(view.drive_pages.size()):
		view.drive_pages[i].visible = i == index
		UI.set_active(view.drive_buttons[i], i == index)
