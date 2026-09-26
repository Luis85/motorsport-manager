class_name PitwallWorkspace
extends RecoveryWeekendView
## Task-oriented native shell over the existing controls and command boundary.
# The optional recovery/results/practice pages have per-instance indices.
var GROUPS = {"Strategy": [6], "Car": [0, 3, 4], "Team": [8], "Conditions": [9, 5], "Review": [1, 2, 7]}
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
var driver_rail: VBoxContainer
var radio_digest: Label
var rail_radio_button: Button
var layout_changes = 0
var adapting = false
var decision_queue: RaceDecisionQueue
var decision_drawer: RaceDecisionDrawer
var decision_page_index = -1
var full_workspace: Control
var results_workspace: RaceResultsWorkspace
var results_home: Node
var session_workspace_button: Button
var gamepad_navigation: RaceGamepadNavigation
var analysis_workspace: RaceAnalysisWorkspace
var inspector_home: Node
var focus_button: Button
var full_invoker: Control

func _ready() -> void:
	super._ready()
	text_scale = float(App.settings.get("pitwall_text_scale", 1.0))
	set_meta("pitwall_text_scale", text_scale)
	detail_picker.add_item("Session results")
	var results_page = tab_page("Session results")
	results_page_index = tabs.get_tab_count() - 1
	GROUPS.Review.append(results_page_index)
	if recovery_page_index >= 0: GROUPS.Conditions.insert(1, recovery_page_index)
	results_panel = SessionResultsPanel.new(); results_panel.configure(sim); results_page.add_child(results_panel)
	register_topic("Results", results_page_index)
	detail_picker.add_item("Decision review")
	var decision_page = tab_page("Decision review"); decision_page_index = tabs.get_tab_count()-1
	decision_drawer = RaceDecisionDrawer.new(); decision_drawer.configure(strategy_model); decision_page.add_child(decision_drawer)
	decision_drawer.commit_bar.reparent(detail_actions)
	decision_drawer.command_requested.connect(_decision_command)
	decision_drawer.refresh_requested.connect(func(id): open_decision(id, true))
	decision_drawer.detail_requested.connect(open_strategy)
	register_topic("Decision",decision_page_index)
	build_navigation()
	build_header()
	compact_inspector()
	strategy_desk.compact_host = true
	for id in [3, 6]:
		var card = PitwallCarCard.new()
		card.build(decision_controls[id].compare.get_parent().get_parent().get_parent(), decision_controls[id], sim.cars[id], func(): show_driver_details(id))
		car_cards[id] = card
	team_panel.plan_requested.connect(open_strategy)
	for button in team_panel.topic_buttons: button.pressed.connect(refresh_navigation)
	for id in [3,6]:
		var popup = decision_controls[id].more.get_popup()
		popup.add_item("Open pit service",2)
		popup.id_pressed.connect(func(action_id):
			if action_id == 2: select_driver(id); open_topic(8); team_panel.show_topic(2))
	build_driver_rail()
	inspector_home=right_panel.get_parent()
	analysis_workspace=RaceAnalysisWorkspace.new();analysis_workspace.configure(strategy_model);add_child(analysis_workspace);move_child(analysis_workspace,race_workspace.get_index()+1);analysis_workspace.hide()
	analysis_workspace.close_requested.connect(close_session_workspace);analysis_workspace.driver_requested.connect(select_driver)
	focus_button=UI.button("Focus",open_analysis_workspace);teammate_buttons[0].get_parent().add_child(focus_button)
	focus_button.tooltip_text="Open this task in a full workspace. The same drafts and explicit commit actions are retained."

	results_home = results_panel.get_parent()
	results_workspace = RaceResultsWorkspace.new(); results_workspace.configure(sim); add_child(results_workspace); move_child(results_workspace,race_workspace.get_index()+1); results_workspace.hide()
	results_workspace.close_requested.connect(close_session_workspace)
	results_workspace.action_requested.connect(_result_action)
	debrief_text.get_parent().add_child(UI.button("Structured decision evidence",open_journal_workspace))
	session_workspace_button = UI.button("Session workspace",open_session_workspace)
	navigation.add_child(session_workspace_button)

	decision_queue = RaceDecisionQueue.new(); add_child(decision_queue)
	move_child(decision_queue, navigation.get_index()+1)
	decision_queue.review_requested.connect(open_decision)
	decision_queue.hold_requested.connect(_queue_hold)
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
	navigator.catalog.append([8, 2, "Team / Pit service", "accepted approach entry queue frozen service actual exit cancel stop"])
	navigator.catalog.append([8, 3, "Team / Accepted plans", "shared windows bounded pace fuel engine override timeline"])
	navigator.catalog.append([results_page_index, 0, "Review / Results", "results classification qualifying practice race laps retired finish"])
	navigator.catalog.append([decision_page_index,0,"Strategy / Decision review","decision evidence confirm deadline acknowledgement"])
	navigator.filter_views("")
	# Catalog/dialog controls are scaled separately on construction.
	for child in get_children():
		if child != navigator: PitwallDesign.scale_controls(child, text_scale)
	for card in car_cards.values(): card.issue.custom_minimum_size.y = ceilf(18 * text_scale)
	gamepad_navigation=RaceGamepadNavigation.new();gamepad_navigation.configure(self);add_child(gamepad_navigation)
	RaceAccessibility.describe(self)
	configure_finishing_guide()
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
	header_context = session_header.header_context
	phase_actions = session_header.phase_actions
	weekend_menu = session_header.weekend_menu
	timing_panel.custom_minimum_size.x = ceilf(PitwallDesign.TIMING_WIDTH * text_scale)
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
	if index == decision_page_index: return "Strategy"
	for group in GROUPS:
		if index in GROUPS[group]: return group
	return ""

func refresh_navigation() -> void:
	super.refresh_navigation()
	if not workspace_ready: return
	var current = group_for(tabs.current_tab)
	if analysis_workspace and full_workspace==analysis_workspace:
		var title=topic_buttons[tabs.current_tab].text
		if tabs.current_tab==6:title=strategy_desk.topic_buttons[strategy_desk.topic].text
		if tabs.current_tab==8:title=team_panel.topic_buttons[team_panel.topics.selected].text
		analysis_workspace.heading.text=(current+" / "+title).to_upper()
	if not current.is_empty() and tabs.current_tab != decision_page_index: group_memory[current] = tabs.current_tab
	for group in group_buttons: PitwallDesign.navigation(group_buttons[group], right_panel.visible and group == current)
	PitwallDesign.navigation(watch_button, not right_panel.visible)
	var visible_count = 0
	for index in topic_buttons:
		topic_buttons[index].visible = group_for(index) == current
		PitwallDesign.navigation(topic_buttons[index], tabs.current_tab == index)
		if topic_buttons[index].visible: visible_count += 1
	context_navigation.visible = visible_count > 1 and current != "Strategy"
	if right_panel.visible: detail_caption.text = current + " / " + topic_buttons[tabs.current_tab].text
	adapt_layout()

func build_driver_rail() -> void:
	driver_rail = VBoxContainer.new(); timing_panel.get_parent().add_child(driver_rail)
	driver_rail.size_flags_vertical = Control.SIZE_EXPAND_FILL
	driver_rail.add_theme_constant_override("separation", PitwallDesign.SPACE_2)
	var panel = UI.race_panel(false, 8); driver_rail.add_child(panel)
	var body = UI.vbox(panel)
	body.add_child(UI.label("RACE CONTROL", 11, UI.ACCENT))
	radio_digest = UI.paragraph("Race messages appear here. Full history remains in Review / Radio.")
	radio_digest.max_lines_visible = 4; radio_digest.custom_minimum_size.y = 62
	body.add_child(radio_digest)
	rail_radio_button = UI.button("Open race radio", func(): open_topic(2)); body.add_child(rail_radio_button)
	driver_rail.hide()

func adapt_layout() -> void:
	if not workspace_ready or adapting: return
	adapting = true
	if is_instance_valid(full_workspace) and full_workspace.visible:
		race_workspace.hide(); driver_rail.hide(); decision_bar.hide(); decision_queue.hide(); team_summary_label.hide()
		if full_workspace == analysis_workspace: teammate_buttons[0].get_parent().hide()
		adapting = false; return
	race_workspace.show();team_summary_label.show()
	if decision_queue: decision_queue.visible = decision_queue.pending_count > 0 or size.y >= 790
	var enlarged = text_scale > 1.0
	right_panel.custom_minimum_size.x = (560 if detail_expanded else 490) if enlarged else (PitwallDesign.DRIVER_RAIL_EXPANDED if detail_expanded else PitwallDesign.DRIVER_RAIL_WIDTH)
	timing_panel.visible = not right_panel.visible or not (detail_expanded or enlarged and size.x < 1300)
	# Preserve the same controls and explicit driver bindings across layouts.
	# Wide observation uses the concept's right rail; analysis/compact modes keep
	# both cars below the map, so the inspector never creates a four-column squeeze.
	var use_rail = not right_panel.visible and size.x >= 1360 and size.y >= 790 and text_scale <= 1.15
	if driver_rail:
		driver_rail.custom_minimum_size.x = ceilf(340 * text_scale)
		var destination = driver_rail if use_rail else decision_bar
		for id in [3, 6]:
			var panel = car_cards[id].panel
			car_cards[id].set_stacked(use_rail)
			car_cards[id].status.custom_minimum_size.x = 0
			car_cards[id].rival.visible = not (right_panel.visible and size.y <= 800)
			car_cards[id].issue.custom_minimum_size.y = ceilf((0 if right_panel.visible and size.y <= 800 else 30) * text_scale)
			if panel.get_parent() != destination:
				var focus = get_viewport().gui_get_focus_owner()
				var restore = focus != null and panel.is_ancestor_of(focus)
				panel.reparent(destination)
				if use_rail: destination.move_child(panel, 0 if id == 3 else 1)
				layout_changes += 1
				if restore: PitwallDesign.focus_later(focus)
		driver_rail.visible = use_rail
		decision_bar.visible = not use_rail
	adapting = false

func open_topic(index: int) -> void:
	if is_instance_valid(full_workspace) and full_workspace.visible and full_workspace!=analysis_workspace: close_session_workspace()
	if workspace_ready and not right_panel.visible:
		var focused = get_viewport().gui_get_focus_owner()
		if focused != null and not right_panel.is_ancestor_of(focused): last_invoker = focused
	super.open_topic(index)

func close_detail() -> void:
	if is_instance_valid(full_workspace) and full_workspace.visible: close_session_workspace()
	super.close_detail()
	if workspace_ready and is_instance_valid(last_invoker) and last_invoker.is_visible_in_tree(): PitwallDesign.focus_later(last_invoker)

func refresh() -> void:
	super.refresh()
	if not workspace_ready: return
	primary_button.visible = not primary_button.disabled
	phase_actions.visible = primary_button.visible or sim.phase == "briefing"
	steps[0].get_parent().hide() # Phase and next approval are already in the status strip.
	session_label.text = "%s · %s" % [sim.track.preset, sim.phase.replace("_", " ").capitalize()]
	session_label.tooltip_text = "Seed %d · %s" % [sim.seed_value, sim.track.document.name]
	flag_label.add_theme_color_override("font_color", UI.ON_PRIMARY)
	compact_resources.visible = false
	teammate_buttons[0].get_parent().visible = full_workspace != analysis_workspace
	for button in teammate_buttons: button.visible = tabs.current_tab != recovery_page_index
	strategy_desk.plan_status.visible = false
	strategy_desk.issue_text.visible = false # Recipient/approval state are already adjacent to the comparison.
	strategy_desk.rejoin.visible = false
	for id in car_cards: car_cards[id].refresh(strategy_model, id)
	if radio_digest and not sim.events.is_empty():
		var latest = sim.events.back()
		radio_digest.text = "%02d:%02d · %s" % [int(latest.time / 60), int(fmod(latest.time, 60)), latest.text]
		radio_digest.tooltip_text = radio_digest.text
	if decision_queue: decision_queue.present(strategy_model,forecast_cache)
	if decision_drawer:
		decision_drawer.commit_bar.visible = right_panel.visible and tabs.current_tab == decision_page_index
		if decision_drawer.commit_bar.visible: decision_drawer.refresh_state()
	if is_instance_valid(full_workspace) and full_workspace.visible and full_workspace.has_method("present"): full_workspace.present()
	if right_panel.visible and tabs.current_tab == results_page_index: results_panel.refresh()
	if session_workspace_button:
		session_workspace_button.visible = sim.phase in ["qualifying_results","practice_results","results"]
		session_workspace_button.text = "Session results"
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
	open_decision(id)

func open_decision(id: int, new_review: bool = false) -> void:
	if id not in [3,6] or decision_drawer == null: return
	select_driver(id)
	forecast_cache[id] = strategy_model.forecast(id)
	var evidence = RaceDecisionViewModel.capture(strategy_model,id,forecast_cache[id])
	evidence.battle = decision_controls[id].battle.text
	evidence.battle_detail = decision_controls[id].battle.tooltip_text
	decision_drawer.present(evidence, new_review)
	open_topic(decision_page_index)
	PitwallDesign.focus_later(decision_drawer.refresh_button)

func _decision_command(action: String, payload: Dictionary) -> void:
	var accepted = strategy_model.command(action,payload)
	decision_drawer.command_result(accepted,strategy_model.last_error,action)
	feedback(("Accepted · " if accepted else "Rejected · ") + sim.cars[int(payload.id)].short + " · " + (action.replace("_"," ") if accepted else strategy_model.last_error))
	forecast_cache.clear(); refresh()
	PitwallDesign.focus_later(decision_drawer.refresh_button)

func _queue_hold(id: int) -> void:
	var entry = decision_queue.entries.get(id,{})
	if entry.is_empty(): return
	targeted_command("hold_decision",{"id":id,"issue":entry.issue,"key":entry.key})
	PitwallDesign.focus_later(decision_queue.slots[id].review)

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
	var kinds = unapplied_draft_kinds()
	if kinds.is_empty(): proceed.call(); return
	exit_dialog = ConfirmationDialog.new(); exit_dialog.title = "Leave unapplied edits?"
	exit_dialog.dialog_text = "Your active race is saved separately. Unapplied %s edits will be discarded when this view closes.\n\nStay to review or approve them, or leave without applying." % ", ".join(kinds)
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
	if event is InputEventKey and event.pressed and event.keycode==KEY_ESCAPE and is_instance_valid(full_workspace) and full_workspace.visible:
		close_session_workspace();get_viewport().set_input_as_handled();return
	var focused = get_viewport().gui_get_focus_owner()
	if focused is LineEdit or focused is TextEdit or focused is OptionButton or focused is Range or focused is ItemList or focused is Tree:
		if not (event is InputEventKey and event.keycode in [KEY_F1, KEY_ESCAPE]): return
	super._unhandled_key_input(event)

func open_session_workspace() -> void:
	open_results_workspace()

func open_results_workspace() -> void:
	if results_workspace == null: return
	var invoker=get_viewport().gui_get_focus_owner()
	close_session_workspace();full_invoker=invoker
	full_workspace = results_workspace
	results_workspace.attach(results_panel); results_workspace.show(); results_workspace.present()
	adapt_layout()
	PitwallDesign.focus_later(results_workspace.buttons[0])

func close_session_workspace() -> void:
	var closing=is_instance_valid(full_workspace) and full_workspace.visible
	if is_instance_valid(full_workspace): full_workspace.hide()
	full_workspace = null
	if inspector_home and right_panel.get_parent()!=inspector_home:
		right_panel.reparent(inspector_home);inspector_home.move_child(right_panel,mini(2,inspector_home.get_child_count()-1))
		right_panel.size_flags_horizontal=Control.SIZE_FILL
	if results_panel and results_home and results_panel.get_parent() != results_home: results_panel.reparent(results_home)
	adapt_layout()
	if closing:PitwallDesign.focus_later(full_invoker if is_instance_valid(full_invoker) and full_invoker.is_visible_in_tree() else watch_button)

func _result_action(action: String) -> void:
	match action:
		"next": close_session_workspace(); primary_action()
		"debrief": open_topic(7)
		"export": export_evidence()
		"notebook":open_destination(7,21)
		"replay":
			if has_signal("replay_requested"): emit_signal("replay_requested")

func _process(delta: float) -> void:
	var before = sim.phase
	super._process(delta)
	if sim.phase != before and sim.phase in ["qualifying_results","practice_results","results"]: open_session_workspace()

func open_analysis_workspace() -> void:
	if analysis_workspace==null:return
	var invoker=get_viewport().gui_get_focus_owner()
	close_session_workspace();full_invoker=invoker;full_workspace=analysis_workspace
	analysis_workspace.attach(right_panel);refresh_navigation()
	analysis_workspace.show();analysis_workspace.present();adapt_layout()
	PitwallDesign.focus_later(analysis_workspace.drivers[3])

func open_journal_workspace() -> void:
	open_results_workspace();results_workspace.show_page(3)

func unapplied_draft_kinds() -> Array[String]:
	var kinds: Array[String] = []
	if strategy_desk.has_user_edits(): kinds.append("strategy")
	if racecraft.has_user_edits(): kinds.append("setup")
	return kinds

func configure_finishing_guide() -> void:
	guide.placement_region = func():
		if is_instance_valid(full_workspace) and full_workspace is RacePracticeWorkspace and full_workspace.visible:
			return full_workspace.panels[3].scroll.get_global_rect()
		if is_instance_valid(full_workspace) and full_workspace.visible:
			return Rect2(full_workspace.global_position + Vector2(0,96), Vector2(size.x * 0.45, maxf(230, full_workspace.size.y - 165)))
		return canvas.get_global_rect()
	# Update obsolete wrapper targets after the actual native cards have been composed.
	guide.steps[0].target = func(): return car_cards[3].name_label
	guide.steps[0].reveal = func(): close_detail()
	guide.steps[1].title = "Keep time under your control"
	guide.steps[1].body = "The fixed header identifies this event, session, observed flag and weather. Pause and speed are separate from the next session approval. Opening a guide, reviewing a car or inspecting a chart never changes either. Space pauses; 1–5 selects speed from non-editing controls."
	guide.steps[1].target = func(): return session_header
	guide.steps[1].reveal = func(): close_detail()
	guide.steps[3].body = "Plan stages a driver-owned starting set and zero to three stop windows. Fitted-to-draft changes and validation stay visible. Approve delegates timing within those accepted windows; it does not fit tyres or create an immediate physical Box order. Rejected drafts keep the current plan."
	guide.steps.append({"title":"Stage five setup trade-offs", "body":"Setup has wing, balance, suspension, cooling and brake bias. Sliders and numeric fields edit the same per-driver draft. Each axis shows fitted → draft; estimates hold current tyres and surface constant. Apply is explicit and legal only in the garage or preparation. Live brake bias is a separate race command.","target":func():return racecraft,"reveal":func():open_topic(4)})
	guide.steps.append({"title":"Fitted is not planned", "body":"Tyres shows the fitted finite set, its limiting wheel and the planned replacement. A puncture takes precedence over an average percentage. Selection does not renew or fit a set; release, formation and physical service use the existing ownership and inventory rules.","target":func():return tyre_readout,"reveal":func():open_topic(3);show_tyres(0)})
	guide.steps.append({"title":"Review each issue, then confirm", "body":"The stable MER/MOR queue counts every unacknowledged issue. Choose an issue inside the drawer to review its evidence and exact driver. Confirmation sends only the reviewed action; accepted, executing and completed are different. Refresh stale evidence explicitly. Nothing pauses automatically.","target":func():return decision_drawer,"reveal":func():open_decision(3)})
	guide.steps.append({"title":"Read recorded evidence", "body":"Telemetry offers four recorded channels, a time range and your teammate's compatible samples. Solid circles and dashed squares retain missing values as gaps. Arrow keys inspect samples; inspection never issues a command. Focus opens the same controls in a larger workspace.","target":func():return telemetry_inspector,"reveal":func():open_topic(1)})
	guide.steps.append({"title":"Two cars, one physical box", "body":"Team / Pit box shows actual approach, entry, queue, service and exit. Cancellation ends at entry. The whole-car service timer is not pit-lane time or per-wheel progress. Team / Plans inspects accepted windows and existing bounded overrides; it does not schedule new commands.","target":func():return team_panel.service_view,"reveal":func():open_topic(8);team_panel.show_topic(2)})
	guide.steps.append({"title":"Keep the result and the experiment separate", "body":"Session results retain measured classifications, laps, fitted stints and decision evidence. Original result acceptance remains explicit in Debrief. Replays and sandbox experiments cannot overwrite or settle the original. Export and notebook routes retain that provenance.","target":func():return results_workspace,"reveal":func():open_results_workspace()})

	guide.steps.append({"title":"Focus without making a second draft", "body":"Focus expands the current analysis task, retaining the same controls, per-driver drafts and explicit action footer. Both drivers remain reachable above it. Back to pit wall restores the original inspector; neither transition changes playback speed or orders.","target":func():return analysis_workspace.heading,"reveal":func():open_topic(1);open_analysis_workspace()})
