class_name PitwallWorkspace
extends RecoveryWeekendView
## Task-oriented native shell over the existing controls and command boundary.
const GROUPS = {"Strategy": [6], "Car": [0, 3, 4], "Team": [8], "Conditions": [9, 10, 5], "Review": [1, 2, 7]}
var group_buttons: Dictionary = {}
var group_memory: Dictionary = {}
var context_navigation: HBoxContainer
var find_button: Button
var messages_button: Button
var navigator: PitwallNavigator
var car_cards: Dictionary = {}
var comparison: PitwallComparison
var messages: Array[String] = []
var text_scale = 1.0
var workspace_ready = false
var exit_dialog: ConfirmationDialog
var last_invoker: Control

var weekend_menu: MenuButton
var phase_actions: VBoxContainer
var header_context: VBoxContainer
var utility_commands: Array[Button] = []
var results_panel: SessionResultsPanel
var results_page_index = -1

func _ready() -> void:
	super._ready()
	text_scale = float(App.settings.get("pitwall_text_scale", 1.0))
	set_meta("pitwall_text_scale", text_scale)
	detail_picker.add_item("Session results")
	var results_page = tab_page("Session results")
	results_page_index = tabs.get_tab_count() - 1
	results_panel = SessionResultsPanel.new(); results_panel.configure(sim); results_page.add_child(results_panel)
	register_topic("Results", results_page_index)
	build_navigation()
	build_header()
	compact_inspector()
	for id in [3, 6]:
		var card = PitwallCarCard.new()
		card.build(decision_controls[id].compare.get_parent().get_parent().get_parent(), decision_controls[id], sim.cars[id], func(): show_driver_details(id))
		car_cards[id] = card
	comparison = PitwallComparison.new(); strategy_desk.estimates.get_parent().add_child(comparison)
	strategy_desk.estimates.get_parent().move_child(comparison, strategy_desk.estimates.get_index())
	strategy_desk.estimates.visible = false
	strategy_desk.rejoin.visible = false
	strategy_desk.preview_changed.connect(func(value): comparison.present(value, strategy_desk.dirty.get(strategy_desk.driver_id, false)))
	comparison.present(strategy_desk.preview, strategy_desk.dirty.get(strategy_desk.driver_id, false))
	var footer = UI.hbox(self)
	radio_label.reparent(footer); radio_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	messages_button = UI.button("Messages", show_messages); navigation.add_child(messages_button)
	navigation.move_child(messages_button, find_button.get_index())
	PitwallDesign.linear_focus([watch_button] + group_buttons.values() + [messages_button, find_button])
	messages_button.tooltip_text = "Read this view's last 50 command acknowledgements and errors. Race radio remains in Review / Radio."
	navigator = PitwallNavigator.new(); add_child(navigator); navigator.configure(sim is WeatherRaceSim, text_scale, sim is RecoveryRaceSim)
	navigator.destination_requested.connect(open_destination)
	# Catalog/dialog controls are scaled separately on construction.
	for child in get_children():
		if child != navigator: PitwallDesign.scale_controls(child, text_scale)
	for card in car_cards.values(): card.issue.custom_minimum_size.y = ceilf(30 * text_scale)
	workspace_ready = true
	resized.connect(adapt_layout)
	wire_control_help(self)
	refresh(); close_detail()

func build_navigation() -> void:
	context_navigation = UI.hbox(detail_nav_host); detail_nav_host.move_child(context_navigation, 0)
	for index in topic_buttons: topic_buttons[index].reparent(context_navigation)
	for group in GROUPS:
		var valid = GROUPS[group].filter(func(index): return topic_buttons.has(index))
		if valid.is_empty(): continue
		group_memory[group] = valid[0]
		var button = UI.button(group, func(): last_invoker = group_buttons[group]; open_topic(group_memory[group]))
		button.tooltip_text = group + " views: " + ", ".join(valid.map(func(index): return topic_buttons[index].text))
		navigation.add_child(button); group_buttons[group] = button
	var spacer = Control.new(); spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL; navigation.add_child(spacer)
	find_button = UI.button("Find · Ctrl+K", show_navigator); navigation.add_child(find_button)
	find_button.tooltip_text = "Search or browse every pit-wall view. Navigation only; no commands are executed."
	PitwallDesign.linear_focus([watch_button] + group_buttons.values() + [find_button])

func build_header() -> void:
	# One stable status/time strip. Secondary file/navigation actions share a native
	# menu; their original callbacks retain save/exit safety and confirmation rules.
	var old_heading = title_label.get_parent().get_parent()
	var old_strip = pause_button.get_parent()
	var banner = UI.panel(); add_child(banner); move_child(banner, old_heading.get_index())
	banner.add_theme_stylebox_override("panel", UI.box(UI.INK, UI.INK, 5, 5))
	var header = UI.hbox(banner)
	header.add_theme_constant_override("separation", 12)
	header_context = UI.vbox(header); header_context.custom_minimum_size.x = 150
	header_context.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header_context.add_theme_constant_override("separation", 1)
	title_label.reparent(header_context); session_label.reparent(header_context)
	title_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	title_label.tooltip_text = sim.track.document.name
	title_label.add_theme_font_size_override("font_size", 18)
	session_label.add_theme_font_size_override("font_size", 11)
	for label in [title_label, session_label]: label.add_theme_color_override("font_color", UI.ON_PRIMARY)
	var timing = UI.vbox(header); timing.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	timing.add_theme_constant_override("separation", 1)
	clock_label.reparent(timing); clock_label.custom_minimum_size.x = 0
	clock_label.add_theme_color_override("font_color", UI.ON_PRIMARY)
	var conditions = UI.hbox(timing); conditions.add_theme_constant_override("separation", 10)
	flag_label.reparent(conditions); weather_label.reparent(conditions)
	flag_label.custom_minimum_size.x = 0
	weather_label.add_theme_color_override("font_color", UI.ON_PRIMARY)
	phase_actions = UI.vbox(header)
	pause_button.reparent(header); speed_control.reparent(header)
	pause_button.custom_minimum_size.x = 85
	weekend_menu = MenuButton.new(); weekend_menu.text = "Weekend"
	weekend_menu.focus_mode = Control.FOCUS_ALL
	weekend_menu.flat = false; weekend_menu.custom_minimum_size.y = 32
	weekend_menu.tooltip_text = "Save checkpoint, export the race log, resume the guide, or return to the menu. Opening this menu does not pause."
	header.add_child(weekend_menu)
	for child in old_strip.get_children():
		if child is Button:
			utility_commands.append(child); child.hide()
			weekend_menu.get_popup().add_item({"Save": "Save checkpoint", "Export log": "Export race log", "Guide": "Resume guide", "Menu": "Main menu"}.get(child.text, child.text))
	old_strip.hide()
	weekend_menu.get_popup().id_pressed.connect(func(index):
		if index >= 0 and index < utility_commands.size(): utility_commands[index].pressed.emit())
	weekend_menu.get_popup().popup_hide.connect(func(): PitwallDesign.focus_later(weekend_menu))
	primary_button.reparent(phase_actions); primary_button.custom_minimum_size.x = 150
	old_heading.hide()
	timing_panel.custom_minimum_size.x = ceilf(244 * text_scale)
	tower.add_theme_constant_override("v_separation", 2)
	for i in range(5): tower.set_column_custom_minimum_width(i, ceili([24, 37, 61, 26, 38][i] * text_scale))

func compact_inspector() -> void:
	# Put targeting and pane controls on one line; avoid a second redundant title row.
	var row = teammate_buttons[0].get_parent()
	var old_row = detail_caption.get_parent()
	expand_button.reparent(row)
	for child in old_row.get_children():
		if child is Button and child != detail_picker: child.reparent(row)
	old_row.hide()

func group_for(index: int) -> String:
	if index == results_page_index: return "Review"
	for group in GROUPS:
		if index in GROUPS[group]: return group
	return ""

func refresh_navigation() -> void:
	super.refresh_navigation()
	if not workspace_ready: return
	var current = group_for(tabs.current_tab)
	if not current.is_empty(): group_memory[current] = tabs.current_tab
	for group in group_buttons: PitwallDesign.navigation(group_buttons[group], right_panel.visible and group == current)
	PitwallDesign.navigation(watch_button, not right_panel.visible)
	var visible_count = 0
	for index in topic_buttons:
		topic_buttons[index].visible = group_for(index) == current
		PitwallDesign.navigation(topic_buttons[index], tabs.current_tab == index)
		if topic_buttons[index].visible: visible_count += 1
	context_navigation.visible = visible_count > 1
	if right_panel.visible: detail_caption.text = current + " / " + topic_buttons[tabs.current_tab].text
	adapt_layout()

func adapt_layout() -> void:
	if not workspace_ready: return
	var enlarged = text_scale > 1.0
	right_panel.custom_minimum_size.x = (560 if detail_expanded else 490) if enlarged else (520 if detail_expanded else 400)
	timing_panel.visible = not right_panel.visible or not (detail_expanded or enlarged and size.x < 1300)

func open_topic(index: int) -> void:
	if workspace_ready and not right_panel.visible:
		var focused = get_viewport().gui_get_focus_owner()
		if focused != null and not right_panel.is_ancestor_of(focused): last_invoker = focused
	super.open_topic(index)

func close_detail() -> void:
	super.close_detail()
	if workspace_ready and is_instance_valid(last_invoker) and last_invoker.is_visible_in_tree(): PitwallDesign.focus_later(last_invoker)

func refresh() -> void:
	super.refresh()
	if not workspace_ready: return
	primary_button.visible = not primary_button.disabled
	phase_actions.visible = primary_button.visible or sim.phase == "briefing"
	steps[0].get_parent().hide() # Phase and next approval are already in the status strip.
	session_label.text = "%s · seed %d" % [sim.track.preset, sim.seed_value]
	flag_label.add_theme_color_override("font_color", UI.ON_PRIMARY)
	compact_resources.visible = false
	teammate_buttons[0].get_parent().visible = true
	for button in teammate_buttons: button.visible = tabs.current_tab != recovery_page_index
	strategy_desk.plan_status.visible = false
	strategy_desk.issue_text.visible = false # Recipient/approval state are already adjacent to the comparison.
	strategy_desk.rejoin.visible = false
	for id in car_cards: car_cards[id].refresh(strategy_model, id)
	if results_panel:
		results_panel.visible = sim.phase in ["qualifying_results", "practice_results", "results"] or tabs.current_tab == results_page_index
		if results_panel.visible: results_panel.refresh()
	topic_buttons[results_page_index].visible = group_for(results_page_index) == group_for(tabs.current_tab) and sim.phase in ["qualifying_results", "practice_results", "results"]
	messages_button.text = "Messages" if messages.is_empty() else "Messages (%d)" % messages.size()
	# Empty, already-approved drafts are not presented as a new commitment.
	if not strategy_desk.dirty.get(strategy_desk.driver_id, true): strategy_desk.apply_button.disabled = true

func show_navigator() -> void:
	if navigator.visible: return
	navigator.show_picker(get_viewport().gui_get_focus_owner() if get_viewport().gui_get_focus_owner() else find_button)

func open_destination(index: int, subtopic: int) -> void:
	if not topic_buttons.has(index): return
	open_topic(index)
	match index:
		6: strategy_desk.show_topic(subtopic)
		0: show_drive(subtopic)
		3: show_tyres(subtopic)
		8: team_panel.show_topic(subtopic)
	refresh()
	var group = group_for(index)
	if group_buttons.has(group): PitwallDesign.focus_later(group_buttons[group])

func show_driver_details(id: int) -> void:
	var controls = decision_controls[id]; var c = sim.cars[id]
	var p = strategy_model.policy(id)
	var text = controls.heading.text + "\n\n" + controls.heading.tooltip_text + "\n\n" + controls.detail.text + "\n\n" + controls.battle.text + "\n\n" + StrategyPlan.ownership_text(p)
	var cards = DecisionFeed.for_driver(sim, id, p, forecast_cache[id])
	if cards.size() > 1:
		text += "\n\nOTHER CURRENT DECISIONS"
		for card in cards.slice(1): text += "\n\n" + card.title + "\n" + card.get("evidence", "") + "\n" + card.get("fallback", "")
	text += "\n\nCurrent pace: %s (%s). Engine: %s (%s)." % [["Conserve", "Balanced", "Push"][c.pace], p.owners.pace, ["Save", "Standard", "Attack"][c.engine], p.owners.engine]
	text += "\n\nBox: " + ("Unavailable. " if controls.box.disabled else "Available. ") + controls.box.tooltip_text
	show_reading(c.name + " · current decision", text, car_cards[id].details_button)

func feedback(text: String) -> void:
	super.feedback(text)
	if text.is_empty(): return
	messages.append("%s · %.1f simulated seconds\n%s" % [sim.phase.capitalize(), sim.total_time, text])
	if messages.size() > 50: messages.pop_front()
	if messages_button: messages_button.text = "Messages (%d)" % messages.size()

func show_messages() -> void:
	var lines = messages.duplicate(); lines.reverse()
	show_reading("Command messages", "No commands or errors in this view yet. Race events are in Review / Radio." if lines.is_empty() else "Local UI history · latest first · not a race outcome record\n\n" + "\n\n".join(lines), messages_button)

func show_reading(title: String, text: String, invoker: Control) -> void:
	var dialog = AcceptDialog.new(); dialog.title = title; dialog.size = Vector2i(620, 410)
	add_child(dialog)
	var content = RichTextLabel.new(); content.text = text; content.selection_enabled = true
	content.custom_minimum_size = Vector2(540, 300)
	dialog.add_child(content)
	PitwallDesign.scale_controls(dialog, text_scale)
	var dismiss = func():
		dialog.queue_free()
		if is_instance_valid(invoker) and invoker.is_visible_in_tree(): PitwallDesign.focus_later(invoker)
	dialog.confirmed.connect(dismiss); dialog.canceled.connect(dismiss)
	dialog.popup_centered(); PitwallDesign.focus_later(dialog.get_ok_button())

func confirm_leave(proceed: Callable) -> void:
	if is_instance_valid(exit_dialog): return
	if not strategy_desk.has_user_edits(): proceed.call(); return
	exit_dialog = ConfirmationDialog.new(); exit_dialog.title = "Leave unapplied strategy edits?"
	exit_dialog.dialog_text = "Your active race is saved separately. Unapplied strategy edits will be discarded when this view closes.\n\nStay to review or approve them, or leave without applying."
	exit_dialog.ok_button_text = "Leave without applying"; exit_dialog.cancel_button_text = "Stay and review"
	add_child(exit_dialog); PitwallDesign.scale_controls(exit_dialog, text_scale)
	exit_dialog.confirmed.connect(func(): exit_dialog.queue_free(); proceed.call())
	exit_dialog.canceled.connect(func(): exit_dialog.queue_free(); PitwallDesign.focus_later(find_button))
	exit_dialog.popup_centered(Vector2i(600, 200)); PitwallDesign.focus_later(exit_dialog.get_cancel_button())

func _input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		for window in get_viewport().get_embedded_subwindows():
			if window.visible: return
		if event.keycode == KEY_K and (event.ctrl_pressed or event.meta_pressed):
			show_navigator(); get_viewport().set_input_as_handled(); return
	super._input(event)

func _unhandled_key_input(event: InputEvent) -> void:
	var focused = get_viewport().gui_get_focus_owner()
	if focused is LineEdit or focused is TextEdit or focused is OptionButton or focused is Range or focused is ItemList or focused is Tree:
		if not (event is InputEventKey and event.keycode in [KEY_F1, KEY_ESCAPE]): return
	super._unhandled_key_input(event)
