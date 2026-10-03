class_name StrategyWeekendView
extends StrategyWeekendPresentation
## Native presentation responsibilities; inherited state remains per instance.


func _ready() -> void:
	super._ready()
	strategy_model = sim as RaceViewQuery
	if strategy_model == null:
		return
	decision_strip.hide()
	canvas.custom_minimum_size.y = 170
	add_theme_constant_override("separation", 6)
	detail_picker.add_item("Strategy desk")
	var strategy_page = tab_page("Strategy")
	strategy_desk = StrategyDesk.new()
	strategy_desk.configure(strategy_model)
	strategy_page.add_child(strategy_desk)
	strategy_desk.command_requested.connect(targeted_command)
	detail_picker.add_item("Decision debrief")
	var debrief_page = tab_page("Debrief")
	debrief_page.add_child(UI.label("DECISIONS & CONSEQUENCES", 12, UI.ACCENT))
	debrief_page.add_child(
		UI.paragraph(
			(
				"A good call can have a poor result. Compare the assumptions recorded at the "
				+ "time with measured outcomes; no alternate finishing position is presented as "
				+ "fact."
			)
		)
	)
	debrief_page.add_child(UI.button("Export decision evidence", export_evidence))
	debrief_text = UI.paragraph("")
	debrief_text.add_theme_font_size_override("font_size", 12)
	debrief_page.add_child(debrief_text)
	detail_picker.add_item("Team & battles")
	var team_page = tab_page("Team & battles")
	team_panel = TeamOrdersPanel.new()
	team_panel.configure(strategy_model)
	team_page.add_child(team_panel)
	team_panel.command_requested.connect(targeted_command)
	team_panel.watch_requested.connect(
		func(id):
			select_driver(id)
			set_follow(true),
	)
	battle_overlay = BattleOverlay.new()
	battle_overlay.text_scale = float(
		presentation_services.preferences.get("pitwall_text_scale", 1.0)
	)
	battle_overlay.canvas = canvas
	canvas.add_child(battle_overlay)
	rejoin_overlay = RejoinOverlay.new()
	rejoin_overlay.enabled = false
	rejoin_overlay.canvas = canvas
	canvas.add_child(rejoin_overlay)
	add_layer(
		"Pit rejoin estimate",
		false,
		func(value):
			rejoin_overlay.enabled = value
			rejoin_overlay.queue_redraw(),
	)
	decision_bar = HBoxContainer.new()
	decision_bar.add_theme_constant_override("separation", 8)
	add_child(decision_bar)
	move_child(decision_bar, hint.get_index())
	hint.visible = false
	for id in sim.player_ids():
		var panel = UI.race_panel(false, 8)
		panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		panel.size_flags_stretch_ratio = 1.0
		decision_bar.add_child(panel)
		var body = UI.vbox(panel)
		body.add_theme_constant_override("separation", 4)
		body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var heading = UI.label("", 12, UI.ACCENT)
		heading.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		body.add_child(heading)
		var summary = UI.label("", 11, UI.MUTED)
		summary.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		body.add_child(summary)
		var detail = UI.label("", 11)
		detail.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		body.add_child(detail)
		var actions = HBoxContainer.new()
		actions.add_theme_constant_override("separation", 5)
		body.add_child(actions)
		var compare = UI.button("Compare", func(): open_strategy(id))
		compare.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		actions.add_child(compare)
		var box = UI.button("Box this lap", func(): box_from_card(id), true)
		box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		actions.add_child(box)
		var send = UI.button("Release now", func(): targeted_command("send", {"id": id}), true)
		send.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		actions.add_child(send)
		var recall = UI.button("Recall", func(): targeted_command("recall", {"id": id}))
		recall.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		actions.add_child(recall)
		var hold = UI.button("Keep plan", func(): keep_plan(id))
		hold.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		actions.add_child(hold)
		var more = MenuButton.new()
		more.text = "More"
		more.flat = false
		more.focus_mode = Control.FOCUS_ALL
		more.custom_minimum_size.y = 30
		actions.add_child(more)
		more.get_popup().add_item("Save fuel for 2 laps", 0)
		more.get_popup().add_item("Cancel accepted pit order", 1)
		more.get_popup().id_pressed.connect(
			func(action_id):
				if action_id == 0:
					targeted_command(
						"resource_intent", {"id": id, "channel": "engine", "value": 0, "laps": 2}
					)
				elif action_id == 1:
					targeted_command("cancel_pit", {"id": id}),
		)
		for button in [compare, box, hold, send, recall]:
			StrategyDesk.compact_button(button)
		# Retain compatibility references as owned hidden controls, not orphan Nodes.
		var save = UI.button(
			"Save fuel",
			func():
				targeted_command(
					"resource_intent", {"id": id, "channel": "engine", "value": 0, "laps": 2}
				),
		)
		actions.add_child(save)
		actions.move_child(save, more.get_index())
		save.hide()
		var cancel = UI.button("Cancel pit", func(): targeted_command("cancel_pit", {"id": id}))
		body.add_child(cancel)
		cancel.hide()
		more.get_popup().about_to_popup.connect(func(): update_more_actions(id))
		var battle = UI.label("", 11, UI.ACCENT)
		battle.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		body.add_child(battle)
		decision_controls[id] = {
			"send": send,
			"recall": recall,
			"cancel": cancel,
			"battle": battle,
			"heading": heading,
			"summary": summary,
			"detail": detail,
			"box": box,
			"hold": hold,
			"save": save,
			"card": {},
			"compare": compare,
			"panel": panel,
			"more": more
		}
	team_summary_label = UI.label("TWO CARS · ONE TEAM", 10, UI.MUTED)
	team_summary_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(team_summary_label)
	move_child(team_summary_label, decision_bar.get_index() + 1)
	pit_note.max_lines_visible = 2
	radio_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	automate.text = "Delegate all domains (reset overrides)"
	register_topic("Strategy", 6, 2)
	register_topic("Team", 8, 4)
	register_topic("Debrief", 7)
	pin_navigation(6, strategy_desk.topic_buttons[0].get_parent())
	pin_navigation(8, team_panel.topic_bar)
	team_panel.commit_bar.reparent(detail_actions)
	strategy_desk.commit_bar.reparent(detail_actions)
	tabs.tab_changed.connect(
		func(index): strategy_desk.commit_bar.visible = index == 6 and strategy_desk.topic != 2
	)
	tabs.current_tab = 6
	refresh()
	close_detail()
