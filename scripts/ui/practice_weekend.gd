class_name PracticeWeekendView
extends PracticeWeekendReview
## Native presentation responsibilities; inherited state remains per instance.


func _ready() -> void:
	super._ready()
	if not (sim is RaceViewQuery and sim.has_mechanic("practice")):
		return
	detail_picker.add_item("Practice")
	practice_panel = PracticePanel.new()
	practice_panel.presentation_services = presentation_services
	practice_panel.configure(sim)
	tabs.add_child(practice_panel)
	practice_page_index = tabs.get_tab_count() - 1
	register_topic("Practice", practice_page_index)
	strategy_navigation = strategy_desk.topic_buttons[0].get_parent()
	topic_buttons[practice_page_index].reparent(strategy_navigation)
	topic_buttons[practice_page_index].size_flags_horizontal = Control.SIZE_EXPAND_FILL
	PitwallDesign.scale_controls(topic_buttons[practice_page_index], text_scale)
	for i in range(strategy_desk.topic_buttons.size()):
		var button = strategy_desk.topic_buttons[i]
		for connection in button.pressed.get_connections():
			button.pressed.disconnect(connection.callable)
		button.pressed.connect(
			func():
				open_topic(6)
				strategy_desk.show_topic(i)
				refresh_navigation(),
		)
	practice_panel.command_requested.connect(targeted_command)
	practice_button = UI.button("Optional practice", func(): open_practice(sim.player_ids()[0]))
	primary_button.get_parent().add_child(practice_button)
	for id in sim.player_ids():
		var link = UI.button("Practice", func(): open_practice(id))
		car_cards[id].actions.add_child(link)
		practice_links[id] = link
		PitwallDesign.scale_controls(link, text_scale)
	navigator.catalog.append(
		[
			practice_page_index,
			0,
			"Strategy / Practice",
			"optional learning tyre life qualifying setup comparison measured run recall"
		]
	)
	navigator.filter_views("")
	group_buttons.Strategy.tooltip_text += ", optional Practice"
	guide.steps.append(
		{
			"title": "Learn before spending your best set",
			"body":
			(
				"Practice is optional. Choose a run objective, a real tyre set and a setup "
				+ "trade-off. Run spends tyre condition, fuel, health and time. Interrupted runs "
				+ "retain partial evidence. Only comparable clean laps inform forecast estimates; "
				+ "no hidden setup score or performance bonus exists. End and review before "
				+ "qualifying."
			),
			"target": func(): return practice_panel,
			"reveal": func(): open_practice(sim.player_ids()[0])
		}
	)
	PitwallDesign.scale_controls(practice_panel, text_scale)
	PitwallDesign.scale_controls(practice_button, text_scale)
	public_inspector = PublicRivalInspector.new()
	public_inspector.configure(self)
	for label in public_inspector.masks.values():
		PitwallDesign.scale_controls(label, text_scale)
	rivals_button = UI.button(
		"Rival field",
		func():
			show_reading("Rival field · public profiles", sim.public_rival_field(), rivals_button),
	)
	team_panel.commit_pages[1].add_child(rivals_button)
	PitwallDesign.scale_controls(rivals_button, text_scale)
	rivals_button.tooltip_text = (
		"Read public tendencies and actual pit entries. No rival's private plan, fuel, "
		+ "condition or scores are exposed."
	)
	navigator.catalog.append(
		[
			8,
			1,
			"Team / Rival field",
			"rivals profiles protector undercutter conservator adaptive observed tendencies"
		]
	)
	guide.steps.append(
		{
			"title": "Read a rival, not a secret plan",
			"body":
			(
				"Team / Battles opens the rival field. Profiles are tendencies, not guaranteed "
				+ "stop laps. Compare your own options and watch actual pit entries. A safe wait, "
				+ "an early stop and a later tyre offset can each be sensible. Lower risk with "
				+ "existing racecraft or resource intents; no encouragement meter is required."
			),
			"target": func(): return rivals_button,
			"reveal": _reveal_guide_0
		}
	)
	practice_workspace = RacePracticeWorkspace.new()
	practice_workspace.configure(sim)
	add_child(practice_workspace)
	move_child(practice_workspace, race_workspace.get_index() + 1)
	practice_workspace.hide()
	for id in practice_workspace.panels:
		practice_workspace.panels[id].drafts = practice_panel.drafts
		practice_workspace.panels[id].edited = practice_panel.edited
		practice_workspace.panels[id].choose_driver(id)
	for step in guide.steps:
		if step.title == "Learn before spending your best set":
			step.target = func(): return practice_workspace.panels[sim.player_ids()[0]]
			step.reveal = open_practice_workspace
	practice_workspace.command_requested.connect(targeted_command)
	practice_workspace.close_requested.connect(close_session_workspace)
	practice_dashboard_button = UI.button("Dashboard", open_practice_workspace)
	strategy_navigation.add_child(practice_dashboard_button)
	PitwallDesign.scale_controls(practice_workspace, text_scale)
	PitwallDesign.scale_controls(practice_dashboard_button, text_scale)
	build_replay_actions()
	if sim.duel_state.get("enabled", false):
		duel_workspace = DuelWorkspace.new()
		duel_workspace.configure(self)
	RaceAccessibility.describe(self)
	wire_control_help(practice_panel)
	wire_control_help(rivals_button)
	refresh()
	if sim.phase in ["practice", "practice_results"]:
		open_practice(sim.player_ids()[0])


func group_for(index: int) -> String:
	if duel_workspace != null and index == duel_workspace.index:
		return "Strategy"
	if practice_page_index >= 0 and index == practice_page_index:
		return "Strategy"
	return super.group_for(index)


func refresh_navigation() -> void:
	super.refresh_navigation()
	if strategy_navigation == null:
		return
	var in_strategy = (
		tabs.current_tab in [6, practice_page_index, decision_page_index]
		or (duel_workspace != null and tabs.current_tab == duel_workspace.index)
	)
	strategy_navigation.visible = in_strategy
	if in_strategy:
		context_navigation.hide()
	for i in range(strategy_desk.topic_buttons.size()):
		PitwallDesign.navigation(
			strategy_desk.topic_buttons[i], tabs.current_tab == 6 and strategy_desk.topic == i
		)
	PitwallDesign.navigation(
		topic_buttons[practice_page_index], tabs.current_tab == practice_page_index
	)


func open_practice(id: int) -> void:
	if practice_panel == null:
		return
	select_driver(id)
	practice_panel.choose_driver(id)
	open_topic(practice_page_index)
	refresh()


func primary_action() -> void:
	if sim.phase == "practice":
		practice_panel.finish_session()
	elif sim.phase == "practice_results":
		targeted_command("practice_finish", {})
	else:
		super.primary_action()


func refresh() -> void:
	if public_inspector:
		public_inspector.restore()
	if debrief_text != null and not practice_debrief_prefix.is_empty():
		debrief_text.text = debrief_text.text.trim_prefix(practice_debrief_prefix)
	super.refresh()
	if practice_panel == null:
		return
	var during = sim.phase in ["practice", "practice_results"]
	if session_workspace_button and during:
		session_workspace_button.show()
		session_workspace_button.text = "Practice dashboard"
	practice_button.visible = sim.phase == "briefing" and sim.practice_state.status == "available"
	refresh_navigation()
	if sim.phase == "practice":
		clock_label.text = "PRACTICE %.0fs" % maxf(0, sim.practice_state.duration - sim.clock)
		primary_button.visible = not sim.practice_state.closed
		flag_label.text = (
			"PAUSED" if sim.paused else ("RETURNING" if sim.practice_state.closed else "PRACTICE")
		)
	if sim.phase == "practice_results":
		clock_label.text = "PRACTICE REVIEW"
	tower.get_parent().get_child(0).text = (
		"PRACTICE · MEASURED LAPS" if during else "LIVE_CLASSIFICATION".replace("_", " ")
	)
	_refresh_practice_timing(during)
	if right_panel.visible and tabs.current_tab == practice_page_index:
		practice_panel.refresh()
		for button in teammate_buttons:
			button.visible = false
		team_panel.commit_bar.visible = false
		strategy_desk.commit_bar.visible = false
	_refresh_practice_cards(during)
	if not during:
		for id in sim.player_ids():
			car_cards[id].facts[1].get_parent().get_child(0).text = "FINISH FUEL · EST."
			car_cards[id].facts[2].get_parent().get_child(0).text = (
				"PITS · "
				+ ("YOU" if strategy_model.policy(id).owners.pit == "player" else "ENGINEER")
			)
	_refresh_practice_debrief()

	if public_inspector:
		public_inspector.present(self)
	if duel_workspace != null:
		duel_workspace.refresh()
	if review_actions:
		review_actions.visible = recording != null and right_panel.visible and tabs.current_tab == 7
		accept_button.disabled = (
			recording == null or recording.origin == "sandbox" or sim.phase != "results"
		)
		bookmark_button.disabled = (
			recording == null or recording.marks.size() >= RaceRecord.MAX_MARKS
		)


func open_session_workspace() -> void:
	if sim.phase in ["practice", "practice_results"]:
		open_practice_workspace()
	else:
		super.open_session_workspace()


func open_practice_workspace() -> void:
	if practice_workspace == null:
		return
	var invoker = get_viewport().gui_get_focus_owner()
	close_session_workspace()
	full_invoker = invoker
	full_workspace = practice_workspace
	practice_workspace.show()
	practice_workspace.present()
	adapt_layout()
	PitwallDesign.focus_later(
		practice_workspace.panels[sim.player_ids()[0]].objective_buttons.tyre_life
	)


func _refresh_practice_timing(during: bool) -> void:
	if during:
		for c in sim.cars:
			var times: Array = []
			for recorded_run in sim.practice_driver(int(c.id)).runs:
				for lap in recorded_run.samples:
					times.append(lap.seconds)
			rows[c.id].set_text(0, "—")
			rows[c.id].set_text(
				2, "—" if times.is_empty() else RaceViewQuery.format_time(times.min())
			)
			rows[c.id].set_tooltip_text(
				2, "Measured practice lap only; it cannot set the qualifying grid."
			)


func _refresh_practice_cards(during: bool) -> void:
	for id in sim.player_ids():
		practice_links[id].visible = during
		if not during:
			continue
		var c = sim.car(id)
		var d = sim.practice_driver(id)
		var controls = decision_controls[id]
		var card = car_cards[id]
		for key in ["box", "hold", "save", "send", "recall", "cancel"]:
			controls[key].visible = false
		card.position.text = "—"
		card.status.text = c.qual_state.to_upper()
		card.facts[1].get_parent().get_child(0).text = "RUN FUEL · LAP UNITS"
		card.facts[1].text = "%.2f laps" % c.fuel
		card.facts[2].get_parent().get_child(0).text = "PRACTICE RUN"
		card.facts[2].text = "%d / 3 runs" % d.runs.size()
		card.issue.text = (
			"Choose a purpose or keep this set for qualifying"
			if d.active.is_empty()
			else (
				"%s · %d/%d measured laps"
				% [
					PracticeEvidence.OBJECTIVES[d.runs.back().objective],
					d.runs.back().samples.size(),
					d.runs.back().target
				]
			)
		)
		card.issue.tooltip_text = PracticeEvidence.report(sim.practice_state, id)


func _refresh_practice_debrief() -> void:
	if right_panel.visible and tabs.current_tab == 7:
		var inherited = debrief_text.text.trim_prefix(practice_debrief_prefix)
		if practice_report_stamp != int(sim.strategy_state.sequence):
			practice_report_stamp = int(sim.strategy_state.sequence)
			practice_debrief_prefix = (
				"PRACTICE NOTEBOOK\n\n"
				+ "\n\n".join(
					sim.player_ids().map(
						func(id):
							return (
								sim.car(id).short
								+ "\n"
								+ PracticeEvidence.report(sim.practice_state, id)
							),
					)
				)
				+ "\n\n"
				+ sim.public_rival_field()
				+ "\n\n"
			)
		debrief_text.text = practice_debrief_prefix + inherited


func _reveal_guide_0() -> void:
	open_topic(8)
	team_panel.show_topic(1)
