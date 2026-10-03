class_name StrategyDesk
extends StrategyDeskPresentation
## Native presentation responsibilities; inherited state remains per instance.


func _ready() -> void:
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	add_theme_constant_override("separation", 5)
	target_picker = UI.option(
		model.player_labels(), func(index): select_driver(model.player_ids()[index])
	)
	add_child(target_picker)
	target_picker.visible = false
	var topics = UI.hbox(self)
	for title in ["Compare", "Plan", "Control"]:
		var index = topic_buttons.size()
		var button = UI.button(title, func(): show_topic(index))
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		topics.add_child(button)
		topic_buttons.append(button)
		compact_button(button)
	plan_status = UI.paragraph("")
	plan_status.add_theme_font_size_override("font_size", 12)
	add_child(plan_status)
	for i in range(3):
		topic_panels.append(UI.vbox(self))
	var compare_panel = topic_panels[0]
	var plan_panel = topic_panels[1]
	var control_panel = topic_panels[2]
	var nav = UI.hbox(plan_panel)
	for template in ["balanced", "alternate", "no_stop"]:
		var b = UI.button(template.replace("_", " ").capitalize(), func(): new_draft(template))
		nav.add_child(b)
		compact_button(b)
	var discard = UI.button("Reload", func(): load_current(true))
	discard.tooltip_text = "Discard this driver's unapplied edits and reload the approved plan."
	nav.add_child(discard)
	compact_button(discard)
	draft_status = UI.paragraph("")
	draft_status.add_theme_font_size_override("font_size", 12)
	plan_panel.add_child(draft_status)
	objective = UI.option(
		["Balanced result", "Protect the finish", "Chase a position"], func(_v): changed()
	)
	stack_field(plan_panel, "Objective", objective)
	starting_set = UI.option(["Select a set"], func(_v): changed())
	starting_set.tooltip_text = "Starting set is fitted at formation, never by editing this draft."
	stack_field(plan_panel, "Start on", starting_set)
	stop_count = UI.spin(1, 0, 3, 1, func(_v): changed())
	stack_field(plan_panel, "Stops · first / last lap", stop_count)
	for i in range(3):
		var row = UI.hbox(plan_panel)
		row.add_child(UI.label(str(i + 1), 12, UI.MUTED))
		var first = UI.spin(2 + i * 3, 1, maxi(1, model.laps - 1), 1, func(_v): changed())
		first.custom_minimum_size.x = 52
		row.add_child(first)
		var last = UI.spin(3 + i * 3, 1, maxi(1, model.laps - 1), 1, func(_v): changed())
		last.custom_minimum_size.x = 52
		row.add_child(last)
		var item = UI.option(["Select a set"], func(_v): changed())
		item.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(item)
		first.tooltip_text = "Earliest racing lap in stop window %d" % (i + 1)
		last.tooltip_text = "Latest racing lap in stop window %d" % (i + 1)
		stop_rows.append({"row": row, "first": first, "last": last, "set": item})
	details_toggle = UI.button(
		"Reserves & contingencies ▸",
		func():
			policy_fields.visible = not policy_fields.visible
			details_toggle.text = (
				"Reserves & contingencies ▾"
				if policy_fields.visible
				else "Reserves & contingencies ▸"
			),
	)
	plan_panel.add_child(details_toggle)
	policy_fields = UI.vbox(plan_panel)
	policy_fields.visible = false
	avoid_traffic = UI.check("Avoid traffic inside the window", true, func(_v): changed())
	policy_fields.add_child(avoid_traffic)
	emergency = UI.check("Permit emergency tyre recovery", true, func(_v): changed())
	emergency.tooltip_text = "Only for engineer-owned pits. Manual pit ownership always stays manual."
	policy_fields.add_child(emergency)
	tyre_target = UI.spin(22, 5, 50, 1, func(_v): changed())
	stack_field(policy_fields, "Tread reserve (%)", tyre_target)
	fuel_target = UI.spin(0.35, 0, 3, 0.05, func(_v): changed())
	stack_field(policy_fields, "Fuel reserve (laps)", fuel_target)
	# Commit controls are reparented into the inspector's fixed action area by the host.
	commit_bar = UI.vbox(self)
	compare_actions = UI.hbox(commit_bar)
	plan_actions = UI.vbox(commit_bar)
	apply_button = UI.button("Approve plan", apply, true)
	plan_actions.add_child(apply_button)
	clear_button = UI.button(
		"Clear plan · take manual pits",
		func(): command_requested.emit("clear_plan", {"id": driver_id})
	)
	plan_actions.add_child(clear_button)
	clear_button.tooltip_text = (
		"Clear only this driver's approved windows. Pace, engine and racecraft owners "
		+ "remain unchanged."
	)
	control_panel.add_child(UI.label("CONTROL OWNER · LIVE, NOT A DRAFT", 11, UI.ACCENT))
	for channel in StrategyPlan.CHANNELS:
		var choice = UI.option(
			["Engineer", "Player"],
			func(index):
				command_requested.emit(
					"delegation",
					{"id": driver_id, "channel": channel, "owner": ["engineer", "player"][index]}
				),
		)
		choice.custom_minimum_size.x = 155
		stack_field(control_panel, channel.capitalize(), choice)
		ownership_controls[channel] = choice
	override_label = UI.paragraph("")
	override_label.add_theme_font_size_override("font_size", 12)
	control_panel.add_child(override_label)
	var attacks = GridContainer.new()
	attacks.columns = 2
	control_panel.add_child(attacks)
	for entry in [
		["Push 2 laps", "pace", 2],
		["Save tyres 2 laps", "pace", 0],
		["Engine attack 2 laps", "engine", 2],
		["Save fuel 2 laps", "engine", 0]
	]:
		var button = UI.button(
			entry[0],
			func():
				command_requested.emit(
					"resource_intent",
					{"id": driver_id, "channel": entry[1], "value": entry[2], "laps": 2}
				),
		)
		attacks.add_child(button)
		action_buttons.append(button)
		compact_button(button)
		button.tooltip_text = (
			(
				"Temporary %s intent for this driver. Returns to the previous owner after two "
				+ "laps; other channels remain unchanged."
			)
			% entry[1]
		)
	briefing_text = UI.paragraph("")
	briefing_text.add_theme_font_size_override("font_size", 12)
	compare_panel.add_child(briefing_text)
	issue_text = UI.paragraph("")
	issue_text.add_theme_font_size_override("font_size", 12)
	compare_panel.add_child(issue_text)
	rejoin = UI.paragraph("")
	rejoin.add_theme_font_size_override("font_size", 12)
	compare_panel.add_child(rejoin)
	estimates = UI.paragraph("")
	estimates.add_theme_font_size_override("font_size", 12)
	compare_panel.add_child(estimates)
	box_now = UI.button("Box from forecast", commit_preview, true)
	compare_actions.add_child(box_now)
	compact_button(box_now)
	extend_draft = UI.button("Draft extension", draft_extension)
	compare_actions.add_child(extend_draft)
	compact_button(extend_draft)
	extend_draft.tooltip_text = (
		"Put an available extension into an unapplied draft. Nothing is ordered until "
		+ "approval."
	)
	var caveat = UI.paragraph(
		(
			"Estimates, not promises. Current conditions held constant; future stops and "
			+ "weather unknown."
		)
	)
	caveat.add_theme_font_size_override("font_size", 11)
	compare_panel.add_child(caveat)
	compare_panel.add_child(
		UI.button(
			"Why / assumptions",
			func():
				UI.notify(
					self,
					"Strategy context · " + model.car(driver_id).short,
					(
						issue_text.tooltip_text
						+ "\n\n"
						+ "\n".join(preview.get("assumptions", []))
						+ "\n\n"
						+ model.weekend_scenarios_briefing()
					)
				),
		)
	)
	timeline_toggle = UI.button("Stint timeline ▸", _toggle_timeline)
	compare_panel.add_child(timeline_toggle)
	timeline = RaceStrategyChart.new()
	compare_panel.add_child(timeline)
	timeline.hide()
	load_current(true)
	show_topic(0)


func stack_field(parent: Node, text: String, control: Control) -> void:
	var row = UI.hbox(parent)
	var label = UI.label(text, 12, UI.MUTED)
	label.custom_minimum_size.x = 108
	row.add_child(label)
	control.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(control)


func show_topic(index: int) -> void:
	topic = index
	plan_status.visible = index != 1 and not compact_host
	for i in range(topic_panels.size()):
		topic_panels[i].visible = i == index
		UI.set_active(topic_buttons[i], i == index)
	if commit_bar:
		commit_bar.visible = index != 2
		compare_actions.visible = index == 0
		plan_actions.visible = index == 1
	refresh()
