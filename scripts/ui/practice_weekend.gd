class_name PracticeWeekendView
extends PitwallWorkspace
## Extends the merged task navigation; no replacement race shell or hidden time control.
signal replay_requested
var recording: RaceRecord
var review_actions: VBoxContainer
var replay_button: Button
var bookmark_button: Button
var accept_button: Button
var result_notice: Label
var practice_panel: PracticePanel
var practice_page_index = -1
var practice_button: Button
var practice_links: Dictionary = {}
var practice_debrief_prefix = ""
var strategy_navigation: HBoxContainer
var practice_report_stamp = -1
var rivals_button: Button
var public_inspector: PublicRivalInspector
var practice_workspace: RacePracticeWorkspace
var practice_dashboard_button: Button

func _ready() -> void:
	super._ready()
	if not sim is PracticeRaceSim: return
	detail_picker.add_item("Practice")
	practice_panel = PracticePanel.new(); practice_panel.configure(sim); tabs.add_child(practice_panel)
	practice_page_index = tabs.get_tab_count() - 1
	register_topic("Practice", practice_page_index)
	strategy_navigation = strategy_desk.topic_buttons[0].get_parent()
	topic_buttons[practice_page_index].reparent(strategy_navigation)
	topic_buttons[practice_page_index].size_flags_horizontal = Control.SIZE_EXPAND_FILL
	PitwallDesign.scale_controls(topic_buttons[practice_page_index], text_scale)
	for i in range(strategy_desk.topic_buttons.size()):
		var button = strategy_desk.topic_buttons[i]
		for connection in button.pressed.get_connections(): button.pressed.disconnect(connection.callable)
		button.pressed.connect(func(): open_topic(6); strategy_desk.show_topic(i); refresh_navigation())
	practice_panel.command_requested.connect(targeted_command)
	practice_button = UI.button("Optional practice", func(): open_practice(3))
	primary_button.get_parent().add_child(practice_button)
	for id in [3, 6]:
		var link = UI.button("Practice", func(): open_practice(id))
		car_cards[id].actions.add_child(link); practice_links[id] = link
		PitwallDesign.scale_controls(link, text_scale)
	navigator.catalog.append([practice_page_index, 0, "Strategy / Practice", "optional learning tyre life qualifying setup comparison measured run recall"])
	navigator.filter_views("")
	group_buttons.Strategy.tooltip_text += ", optional Practice"
	guide.steps.append({"title": "Learn before spending your best set", "body": "Practice is optional. Choose a run objective, a real tyre set and a setup trade-off. Run spends tyre condition, fuel, health and time. Interrupted runs retain partial evidence. Only comparable clean laps inform forecast estimates; no hidden setup score or performance bonus exists. End and review before qualifying.", "target": func(): return practice_panel, "reveal": func(): open_practice(3)})
	PitwallDesign.scale_controls(practice_panel, text_scale); PitwallDesign.scale_controls(practice_button, text_scale)
	public_inspector = PublicRivalInspector.new(); public_inspector.configure(self)
	for label in public_inspector.masks.values(): PitwallDesign.scale_controls(label, text_scale)
	rivals_button = UI.button("Rival field", func(): show_reading("Rival field · public profiles", RivalStyles.public_field(sim.rival_styles, sim.cars, sim.rival_state.stops), rivals_button))
	team_panel.commit_pages[1].add_child(rivals_button); PitwallDesign.scale_controls(rivals_button, text_scale)
	rivals_button.tooltip_text = "Read public tendencies and actual pit entries. No rival's private plan, fuel, condition or scores are exposed."
	navigator.catalog.append([8, 1, "Team / Rival field", "rivals profiles protector undercutter conservator adaptive observed tendencies"])
	guide.steps.append({"title": "Read a rival, not a secret plan", "body": "Team / Battles opens the rival field. Profiles are tendencies, not guaranteed stop laps. Compare your own options and watch actual pit entries. A safe wait, an early stop and a later tyre offset can each be sensible. Lower risk with existing racecraft or resource intents; no encouragement meter is required.", "target": func(): return rivals_button, "reveal": func(): open_topic(8); team_panel.show_topic(1)})
	practice_workspace = RacePracticeWorkspace.new(); practice_workspace.configure(sim); add_child(practice_workspace);move_child(practice_workspace,race_workspace.get_index()+1); practice_workspace.hide()
	for id in practice_workspace.panels:
		practice_workspace.panels[id].drafts=practice_panel.drafts
		practice_workspace.panels[id].choose_driver(id)
	practice_workspace.command_requested.connect(targeted_command)
	practice_workspace.close_requested.connect(close_session_workspace)
	practice_dashboard_button = UI.button("Dashboard",open_practice_workspace); strategy_navigation.add_child(practice_dashboard_button)
	PitwallDesign.scale_controls(practice_workspace,text_scale); PitwallDesign.scale_controls(practice_dashboard_button,text_scale)
	build_replay_actions()
	RaceAccessibility.describe(self)
	wire_control_help(practice_panel); wire_control_help(rivals_button); refresh()
	if sim.phase in ["practice", "practice_results"]: open_practice(3)

func group_for(index: int) -> String:
	if practice_page_index >= 0 and index == practice_page_index: return "Strategy"
	return super.group_for(index)

func refresh_navigation() -> void:
	super.refresh_navigation()
	if strategy_navigation == null: return
	var in_strategy = tabs.current_tab in [6, practice_page_index]
	strategy_navigation.visible = in_strategy
	if in_strategy: context_navigation.hide()
	for i in range(strategy_desk.topic_buttons.size()):
		PitwallDesign.navigation(strategy_desk.topic_buttons[i], tabs.current_tab == 6 and strategy_desk.topic == i)
	PitwallDesign.navigation(topic_buttons[practice_page_index], tabs.current_tab == practice_page_index)

func open_practice(id: int) -> void:
	if practice_panel == null: return
	select_driver(id); practice_panel.choose_driver(id); open_topic(practice_page_index); refresh()

func primary_action() -> void:
	if sim.phase == "practice": practice_panel.finish_session()
	elif sim.phase == "practice_results": targeted_command("practice_finish", {})
	else: super.primary_action()

func refresh() -> void:
	# The inherited phase observer saves App.weekend. A sandbox owns a different
	# continuation slot: acknowledge its local view phase before the base refresh.
	var sandbox_phase_changed = recording != null and recording.origin == "sandbox" and last_phase != sim.phase
	if sandbox_phase_changed: last_phase = sim.phase
	if public_inspector: public_inspector.restore()
	if debrief_text != null and not practice_debrief_prefix.is_empty(): debrief_text.text = debrief_text.text.trim_prefix(practice_debrief_prefix)
	super.refresh()
	if sandbox_phase_changed:
		var error = ReplayStorage.save_session(App.sandbox_path, recording)
		if not error.is_empty(): feedback("Sandbox autosave failed: " + error)
	if practice_panel == null: return
	var during = sim.phase in ["practice", "practice_results"]
	if session_workspace_button and during: session_workspace_button.show(); session_workspace_button.text = "Practice dashboard"
	practice_button.visible = sim.phase == "briefing" and sim.practice_state.status == "available"
	refresh_navigation()
	if sim.phase == "practice":
		clock_label.text = "PRACTICE %.0fs" % maxf(0, sim.practice_state.duration - sim.clock)
		primary_button.visible = not sim.practice_state.closed
		flag_label.text = "PAUSED" if sim.paused else ("RETURNING" if sim.practice_state.closed else "PRACTICE")
	if sim.phase == "practice_results": clock_label.text = "PRACTICE REVIEW"
	tower.get_parent().get_child(0).text = "PRACTICE · MEASURED LAPS" if during else "LIVE CLASSIFICATION"
	if during:
		for c in sim.cars:
			var times: Array = []
			for recorded_run in sim.practice_driver(int(c.id)).runs:
				for lap in recorded_run.samples: times.append(lap.seconds)
			rows[c.id].set_text(0,"—")
			rows[c.id].set_text(2,"—" if times.is_empty() else RaceSim.format_time(times.min()))
			rows[c.id].set_tooltip_text(2,"Measured practice lap only; it cannot set the qualifying grid.")
	if right_panel.visible and tabs.current_tab == practice_page_index:
		practice_panel.refresh()
		for button in teammate_buttons: button.visible = false
		team_panel.commit_bar.visible = false; strategy_desk.commit_bar.visible = false
	for id in [3, 6]:
		practice_links[id].visible = during
		if not during: continue
		var c = sim.cars[id]; var d = sim.practice_driver(id); var controls = decision_controls[id]; var card = car_cards[id]
		for key in ["box", "hold", "save", "send", "recall", "cancel"]: controls[key].visible = false
		card.position.text = "—"; card.status.text = c.qual_state.to_upper()
		card.facts[1].get_parent().get_child(0).text = "RUN FUEL · LAP UNITS"
		card.facts[1].text = "%.2f laps" % c.fuel
		card.facts[2].get_parent().get_child(0).text = "PRACTICE RUN"
		card.facts[2].text = "%d / 3 runs" % d.runs.size()
		card.issue.text = "Choose a purpose or keep this set for qualifying" if d.active.is_empty() else "%s · %d/%d measured laps" % [PracticeEvidence.OBJECTIVES[d.runs.back().objective], d.runs.back().samples.size(), d.runs.back().target]
		card.issue.tooltip_text = PracticeEvidence.report(sim.practice_state, id)
	if not during:
		for id in [3, 6]:
			car_cards[id].facts[1].get_parent().get_child(0).text = "FINISH FUEL · EST."
			car_cards[id].facts[2].get_parent().get_child(0).text = "PITS · " + ("YOU" if strategy_model.policy(id).owners.pit == "player" else "ENGINEER")
	if right_panel.visible and tabs.current_tab == 7:
		var inherited = debrief_text.text.trim_prefix(practice_debrief_prefix)
		if practice_report_stamp != int(sim.strategy_state.sequence):
			practice_report_stamp = int(sim.strategy_state.sequence)
			practice_debrief_prefix = "PRACTICE NOTEBOOK\n\n" + "\n\n".join([3, 6].map(func(id): return sim.cars[id].short + "\n" + PracticeEvidence.report(sim.practice_state,id))) + "\n\n" + RivalStyles.public_field(sim.rival_styles, sim.cars, sim.rival_state.stops) + "\n\n"
		debrief_text.text = practice_debrief_prefix + inherited

	if public_inspector: public_inspector.present(self)
	if review_actions:
		review_actions.visible = recording != null and right_panel.visible and tabs.current_tab == 7
		accept_button.disabled = recording == null or recording.origin == "sandbox" or sim.phase != "results"
		bookmark_button.disabled = recording == null or recording.marks.size() >= RaceRecord.MAX_MARKS


func build_replay_actions() -> void:
	weekend_menu.get_popup().add_separator()
	weekend_menu.get_popup().add_item("Replay / sandbox", 20)
	weekend_menu.get_popup().add_item("Circuit notebook…", 21)
	weekend_menu.get_popup().id_pressed.connect(func(id):
		if id == 20: replay_requested.emit()
		elif id == 21: NotebookWindow.open(self, recording, CircuitNotebook.PATH, weekend_menu))
	navigator.catalog.append([7, 20, "Review / Replay and sandbox", "recording checkpoint try another decision original result"])
	navigator.catalog.append([7, 21, "Review / Circuit notebook", "history observations personal notes remembered challenges"])
	navigator.filter_views("")
	review_actions = VBoxContainer.new(); detail_actions.add_child(review_actions)
	var actions = HFlowContainer.new(); review_actions.add_child(actions)
	replay_button = UI.button("Replay / sandbox", func(): replay_requested.emit()); actions.add_child(replay_button)
	bookmark_button = UI.button("Keep checkpoint", keep_checkpoint); actions.add_child(bookmark_button)
	accept_button = UI.button("Accept original result", accept_result, true); actions.add_child(accept_button)
	result_notice = UI.paragraph("Original results require a completed weekend. Replays and experiments never award campaign rewards.")
	review_actions.add_child(result_notice); PitwallDesign.scale_controls(review_actions, text_scale)

func open_destination(index: int, subtopic: int) -> void:
	if index == 7 and subtopic == 20: replay_requested.emit(); return
	if index == 7 and subtopic == 21: NotebookWindow.open(self, recording, CircuitNotebook.PATH, find_button); return
	super.open_destination(index, subtopic)

func keep_checkpoint() -> void:
	if recording == null: return
	var error = recording.bookmark("%s · %.1fs" % [sim.phase.replace("_", " "), sim.total_time])
	result_notice.text = "Checkpoint kept (%d/4). Save or export to retain it on disk." % recording.marks.size() if error.is_empty() else error
	refresh()

func accept_result() -> void:
	if recording == null: return
	# Keep the same event ID durable before accepting its immutable factual result.
	var error = ReplayStorage.save_session(App.checkpoint_path, recording) if recording.origin != "sandbox" else "Sandbox results cannot be accepted as an original."
	if not error.is_empty(): result_notice.text = error; return
	var result = ResultReceipts.accept(recording); result_notice.text = result.message

func save_checkpoint() -> void:
	if recording != null and recording.origin == "sandbox":
		var error = ReplayStorage.save_session(App.sandbox_path, recording)
		show_reading("Save sandbox", "Experiment saved in a separate slot. The original weekend is unchanged." if error.is_empty() else error, weekend_menu)
	else: super.save_checkpoint()

func open_session_workspace() -> void:
	if sim.phase in ["practice","practice_results"]: open_practice_workspace()
	else: super.open_session_workspace()

func open_practice_workspace() -> void:
	if practice_workspace == null: return
	var invoker=get_viewport().gui_get_focus_owner()
	close_session_workspace();full_invoker=invoker; full_workspace = practice_workspace
	practice_workspace.show(); practice_workspace.present(); adapt_layout()
	PitwallDesign.focus_later(practice_workspace.panels[3].objective_buttons.tyre_life)
