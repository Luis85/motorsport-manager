class_name PitwallWorkspace
extends PitwallWorkspaceState


func _ready() -> void:
	super._ready()
	PitwallWorkspaceBuilder._ready(self)


func group_for(index: int) -> String:
	if index == results_page_index:
		return "Review"
	if index == decision_page_index:
		return "Strategy"
	for group in groups:
		if index in groups[group]:
			return group
	return ""


func refresh_navigation() -> void:
	super.refresh_navigation()
	if not workspace_ready:
		return
	var current = group_for(tabs.current_tab)
	if analysis_workspace and full_workspace == analysis_workspace:
		var title = topic_buttons[tabs.current_tab].text
		if tabs.current_tab == 6:
			title = strategy_desk.topic_buttons[strategy_desk.topic].text
		if tabs.current_tab == 8:
			title = team_panel.topic_buttons[team_panel.topics.selected].text
		analysis_workspace.heading.text = (current + " / " + title).to_upper()
	if not current.is_empty() and tabs.current_tab != decision_page_index:
		group_memory[current] = tabs.current_tab
	for group in group_buttons:
		PitwallDesign.navigation(group_buttons[group], right_panel.visible and group == current)
	PitwallDesign.navigation(watch_button, not right_panel.visible)
	var visible_count = 0
	for index in topic_buttons:
		topic_buttons[index].visible = group_for(index) == current
		PitwallDesign.navigation(topic_buttons[index], tabs.current_tab == index)
		if topic_buttons[index].visible:
			visible_count += 1
	context_navigation.visible = visible_count > 1 and current != "Strategy"
	if right_panel.visible:
		detail_caption.text = current + " / " + topic_buttons[tabs.current_tab].text
	adapt_layout()


func open_topic(index: int) -> void:
	if (
		is_instance_valid(full_workspace)
		and full_workspace.visible
		and full_workspace != analysis_workspace
	):
		close_session_workspace()
	if workspace_ready and not right_panel.visible:
		var focused = get_viewport().gui_get_focus_owner()
		if focused != null and not right_panel.is_ancestor_of(focused):
			last_invoker = focused
	super.open_topic(index)


func close_detail() -> void:
	if is_instance_valid(full_workspace) and full_workspace.visible:
		close_session_workspace()
	super.close_detail()
	if workspace_ready and is_instance_valid(last_invoker) and last_invoker.is_visible_in_tree():
		PitwallDesign.focus_later(last_invoker)


func refresh() -> void:
	super.refresh()
	if not workspace_ready:
		return
	primary_button.visible = not primary_button.disabled
	phase_actions.visible = primary_button.visible or sim.phase == "briefing"
	steps[0].get_parent().hide()  # Phase and next approval are already in the status strip.
	session_label.text = "%s · %s" % [sim.track.preset, sim.phase.replace("_", " ").capitalize()]
	session_label.tooltip_text = "Seed %d · %s" % [sim.seed_value, sim.track.document.name]
	compact_resources.visible = false
	teammate_buttons[0].get_parent().visible = full_workspace != analysis_workspace
	for button in teammate_buttons:
		button.visible = tabs.current_tab != recovery_page_index
	strategy_desk.plan_status.visible = false
	strategy_desk.issue_text.visible = false  # Recipient/approval state are already adjacent to the comparison.
	strategy_desk.rejoin.visible = false
	for id in car_cards:
		car_cards[id].refresh(strategy_model, id)
	if decision_queue:
		decision_queue.present(strategy_model, forecast_cache)
	if race_read_panel and race_read_panel.is_visible_in_tree():
		race_read_panel.present(strategy_model.race_read_model_capture(forecast_cache))
	if decision_drawer:
		decision_drawer.commit_bar.visible = (
			right_panel.visible and tabs.current_tab == decision_page_index
		)
		if decision_drawer.commit_bar.visible:
			decision_drawer.refresh_state()
	if (
		is_instance_valid(full_workspace)
		and full_workspace.visible
		and full_workspace.has_method("present")
	):
		full_workspace.present()
	if right_panel.visible and tabs.current_tab == results_page_index:
		results_panel.refresh()
	if session_workspace_button:
		session_workspace_button.visible = (
			sim.phase in ["qualifying_results", "practice_results", "results"]
		)
		session_workspace_button.text = "Session results"
	messages_button.text = "Messages" if messages.is_empty() else "Messages (%d)" % messages.size()
	# Empty, already-approved drafts are not presented as a new commitment.
	if not strategy_desk.dirty.get(strategy_desk.driver_id, true):
		strategy_desk.apply_button.disabled = true


func show_navigator() -> void:
	if navigator.visible:
		return
	navigator.show_picker(
		(
			get_viewport().gui_get_focus_owner()
			if get_viewport().gui_get_focus_owner()
			else find_button
		)
	)


func open_destination(index: int, subtopic: int) -> void:
	if index == 2 and subtopic == 1:
		show_race_read()
		return
	if not topic_buttons.has(index):
		return
	open_topic(index)
	match index:
		6:
			strategy_desk.show_topic(subtopic)
		0:
			show_drive(subtopic)
		3:
			show_tyres(subtopic)
		8:
			team_panel.show_topic(subtopic)
	refresh()
	var group = group_for(index)
	if group_buttons.has(group):
		PitwallDesign.focus_later(group_buttons[group])


func open_decision(id: int, new_review: bool = false) -> void:
	if id not in sim.player_ids() or decision_drawer == null:
		return
	select_driver(id)
	forecast_cache[id] = strategy_model.forecast(id)
	var evidence = strategy_model.race_decision_view_model_capture(id, forecast_cache[id])
	evidence.battle = decision_controls[id].battle.text
	evidence.battle_detail = decision_controls[id].battle.tooltip_text
	decision_drawer.present(evidence, new_review)
	open_topic(decision_page_index)
	PitwallDesign.focus_later(decision_drawer.refresh_button)


func _decision_command(action: String, payload: Dictionary) -> void:
	var accepted = commands.execute(action, payload)
	decision_drawer.command_result(accepted, strategy_model.last_error, action)
	feedback(
		(
			("Accepted · " if accepted else "Rejected · ")
			+ sim.car(int(payload.id)).short
			+ " · "
			+ (action.replace("_", " ") if accepted else strategy_model.last_error)
		)
	)
	forecast_cache.clear()
	refresh()
	PitwallDesign.focus_later(decision_drawer.refresh_button)


func _queue_hold(id: int) -> void:
	var entry = decision_queue.entries.get(id, {})
	if entry.is_empty():
		return
	targeted_command("hold_decision", {"id": id, "issue": entry.issue, "key": entry.key})
	PitwallDesign.focus_later(decision_queue.slots[id].review)


func feedback(text: String) -> void:
	super.feedback(text)
	if text.is_empty():
		return
	messages.append(
		"%s · %.1f simulated seconds\n%s" % [sim.phase.capitalize(), sim.total_time, text]
	)
	if messages.size() > 50:
		messages.pop_front()
	if messages_button:
		messages_button.text = "Messages (%d)" % messages.size()


func show_race_read() -> void:
	var invoker = get_viewport().gui_get_focus_owner()
	if invoker == null:
		invoker = race_read_button
	var origin = "SESSION OBSERVATION · not a race result\n\n"
	if get("recording") is RaceRecord and get("recording").origin == "sandbox":
		origin = "SANDBOX OBSERVATION · not the original race result\n\n"
	show_reading(
		"Read the race",
		origin + RaceReadModel.reading(strategy_model.race_read_model_capture(forecast_cache)),
		invoker
	)


func show_messages() -> void:
	var lines = messages.duplicate()
	lines.reverse()
	show_reading(
		"Command messages",
		(
			"No commands or errors in this view yet. Race events are in Review / Radio."
			if lines.is_empty()
			else (
				"Local UI history · latest first · not a race outcome record\n\n"
				+ "\n\n".join(lines)
			)
		),
		messages_button
	)


func _input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		for window in get_viewport().get_embedded_subwindows():
			if window.visible:
				return
		if event.keycode == KEY_K and (event.ctrl_pressed or event.meta_pressed):
			show_navigator()
			get_viewport().set_input_as_handled()
			return
	super._input(event)


func _unhandled_key_input(event: InputEvent) -> void:
	if (
		event is InputEventKey
		and event.pressed
		and event.keycode == KEY_ESCAPE
		and is_instance_valid(full_workspace)
		and full_workspace.visible
	):
		close_session_workspace()
		get_viewport().set_input_as_handled()
		return
	var focused = get_viewport().gui_get_focus_owner()
	if (
		focused is LineEdit
		or focused is TextEdit
		or focused is OptionButton
		or focused is Range
		or focused is ItemList
		or focused is Tree
	):
		if not (event is InputEventKey and event.keycode in [KEY_F1, KEY_ESCAPE]):
			return
	super._unhandled_key_input(event)


func _result_action(action: String) -> void:
	match action:
		"next":
			close_session_workspace()
			primary_action()
		"debrief":
			open_topic(7)
		"export":
			export_evidence()
		"notebook":
			open_destination(7, 21)
		"replay":
			if has_signal("replay_requested"):
				emit_signal("replay_requested")


func _process(delta: float) -> void:
	var before = sim.phase
	super._process(delta)
	if sim.phase != before and sim.phase in ["qualifying_results", "practice_results", "results"]:
		open_session_workspace()


func configure_finishing_guide() -> void:
	PitwallFinishingGuide.configure(self)
