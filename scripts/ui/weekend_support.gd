class_name WeekendViewSupport
extends WeekendViewState


func select_driver(id: int) -> void:
	if id < 0 or id >= sim.car_count:
		return
	commands.select_driver(id)
	refresh()


func feedback(text: String) -> void:
	radio_label.text = text
	feedback_until = Time.get_ticks_msec() / 1000.0 + 5


func dispatch(action: String, payload: Dictionary = {}) -> void:
	payload.id = sim.selected_id
	if not commands.execute(action, payload):
		feedback(sim.last_error)
	elif action not in ["pause", "speed"]:
		feedback(
			"%s · %s acknowledged" % [sim.car(sim.selected_id).short, action.replace("_", " ")]
		)
	refresh()


func primary_action() -> void:
	match sim.phase:
		"briefing":
			dispatch("qualify")
		"qualifying":
			var confirm = ConfirmationDialog.new()
			confirm.title = "Close qualifying?"
			confirm.dialog_text = (
				"No new flying laps may start. Existing hot laps can finish; all cars then "
				+ "return to the garage."
			)
			add_child(confirm)
			confirm.confirmed.connect(
				func():
					confirm.queue_free()
					dispatch("close_qualifying")
			)
			confirm.canceled.connect(confirm.queue_free)
			confirm.popup_centered(Vector2i(490, 170))
		"qualifying_results":
			dispatch("prepare_race")
		"race_preparation":
			dispatch("formation")
		"grid_ready":
			dispatch("lights")
		"results":
			new_weekend_requested.emit()


func refresh() -> void:
	pass


func review_decision() -> void:
	var issue = current_decision(sim.car(sim.selected_id))
	if issue.signature.is_empty():
		return
	open_topic(issue.topic)


func hold_decision() -> void:
	if decision_signature.is_empty():
		return
	decision_snoozed_signature = decision_signature
	feedback("Plan retained · this prompt returns only after the underlying condition changes")
	refresh()


func weekend_action(id: int) -> void:
	match id:
		0:
			save_checkpoint()
		1:
			export_log()
		2:
			guide.open_guide()
		3:
			menu_requested.emit()


func save_checkpoint() -> void:
	var error = presentation_services.save_live()
	feedback("Weekend saved. Continue resumes this checkpoint." if error.is_empty() else error)


func export_log() -> void:
	var dialog = UI.file_dialog(
		self,
		true,
		["*.json ; Weekend analysis log"],
		func(path):
			var data = {
				"kind": "motorsport-manager-race-log",
				"version": 2,
				"track": sim.track.document.name,
				"seed": sim.seed_value,
				"events": sim.events,
				"commands": sim.commands,
				"classification": sim.standings(),
				"phase": sim.phase,
				"stats": sim.stats
			}
			var error = presentation_services.export_value(path, data)
			feedback("Race log exported." if error.is_empty() else error)
	)
	dialog.current_file = "weekend-log.json"


func _unhandled_key_input(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed or event.echo:
		return
	var focus = get_viewport().gui_get_focus_owner()
	if (
		event.keycode == KEY_F1
		and is_instance_valid(help_target)
		and not help_target.tooltip_text.is_empty()
	):
		UI.notify(self, "Control help", help_target.tooltip_text)
		get_viewport().set_input_as_handled()
		return
	if focus is LineEdit or focus is TextEdit:
		return
	if event.keycode == KEY_ESCAPE and right_panel.visible:
		close_detail()
		get_viewport().set_input_as_handled()
	elif event.keycode == KEY_SPACE and sim.phase in RaceViewQuery.ACTIVE:
		dispatch("pause")
		get_viewport().set_input_as_handled()
	elif event.keycode == KEY_B and not box_button.disabled:
		dispatch("pit")
		get_viewport().set_input_as_handled()
	elif event.keycode == KEY_TAB and event.ctrl_pressed:
		select_driver(sim.teammate_id(sim.selected_id))
		get_viewport().set_input_as_handled()
	elif event.keycode == KEY_F:
		set_follow(false)
		canvas.fit()
		get_viewport().set_input_as_handled()
	elif event.keycode >= KEY_1 and event.keycode <= KEY_5:
		dispatch("speed", {"value": [1, 2, 4, 8, 16][event.keycode - KEY_1]})
		get_viewport().set_input_as_handled()


func show_tyres(index: int) -> void:
	open_detail()
	tyre_topic = clampi(index, 0, 2)
	tabs.current_tab = 3
	for i in range(tyre_pages.size()):
		tyre_pages[i].visible = i == tyre_topic
		UI.set_active(tyre_nav[i], i == tyre_topic)
	tabs.get_tab_control(3).scroll_vertical = 0


func set_detail_expanded(value: bool) -> void:
	detail_expanded = value
	timing_panel.visible = not value
	right_panel.custom_minimum_size.x = 520 if value else 360
	driver_status_card.visible = not value
	resource_row.visible = not value
	compact_resources.visible = value
	expand_button.text = "Narrow" if value else "Widen"
	open_detail()
	# A layout change is presentation only. Preserve the camera's world-space center.
	refresh()


func add_layer(title: String, value: bool, callback: Callable) -> CheckButton:
	var control = UI.check(title, value, callback)
	# Keep one source of state for the menu and surface inspector without duplicate visible controls.
	map_controls.add_child(control)
	control.visible = false
	layers_menu.get_popup().add_check_item(title, layer_controls.size())
	layer_controls.append(control)
	return control


func _input(event: InputEvent) -> void:
	# Space pauses instead of activating a focused Box; F1 also works inside text fields.
	if not event is InputEventKey or not event.pressed or event.echo:
		return
	for window in get_viewport().get_embedded_subwindows():
		if window.visible:
			return
	var focus = get_viewport().gui_get_focus_owner()
	if event.keycode == KEY_F1:
		var target = (
			focus if focus is Control and not focus.tooltip_text.is_empty() else help_target
		)
		if is_instance_valid(target) and not target.tooltip_text.is_empty():
			UI.notify(self, "Control help", target.tooltip_text)
			get_viewport().set_input_as_handled()
		return
	if event.keycode != KEY_SPACE or sim == null or sim.phase not in RaceViewQuery.ACTIVE:
		return
	if focus is LineEdit or focus is TextEdit:
		return
	dispatch("pause")
	get_viewport().set_input_as_handled()


func _inspect_qualifying(id: int) -> void:
	select_driver(id)
	open_topic(0)


func _set_radio_filter(index: int) -> void:
	radio_filter = ["all", "flags", "pit", "tyre", "weather"][index]
	last_event_count = -1
	refresh()
