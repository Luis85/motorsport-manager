class_name PracticeWeekendView
extends PitwallWorkspace
## Extends the merged task navigation; no replacement race shell or hidden time control.
var practice_panel: PracticePanel
var practice_page_index = -1
var practice_button: Button
var practice_links: Dictionary = {}
var practice_debrief_prefix = ""

func _ready() -> void:
	super._ready()
	if not sim is PracticeRaceSim: return
	detail_picker.add_item("Practice")
	practice_panel = PracticePanel.new(); practice_panel.configure(sim); tabs.add_child(practice_panel)
	practice_page_index = tabs.get_tab_count() - 1
	register_topic("Practice", practice_page_index)
	topic_buttons[practice_page_index].reparent(context_navigation)
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
	wire_control_help(practice_panel); refresh()
	if sim.phase in ["practice", "practice_results"]: open_practice(3)

func group_for(index: int) -> String:
	if practice_page_index >= 0 and index == practice_page_index: return "Strategy"
	return super.group_for(index)

func open_practice(id: int) -> void:
	if practice_panel == null: return
	select_driver(id); practice_panel.choose_driver(id); open_topic(practice_page_index); refresh()

func primary_action() -> void:
	if sim.phase == "practice": practice_panel.finish_session()
	elif sim.phase == "practice_results": targeted_command("practice_finish", {})
	else: super.primary_action()

func refresh() -> void:
	if debrief_text != null and not practice_debrief_prefix.is_empty(): debrief_text.text = debrief_text.text.trim_prefix(practice_debrief_prefix)
	super.refresh()
	if practice_panel == null: return
	var during = sim.phase in ["practice", "practice_results"]
	practice_button.visible = sim.phase == "briefing" and sim.practice_state.status == "available"
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
			car_cards[id].facts[2].get_parent().get_child(0).text = "NEXT STOP"
	if right_panel.visible and tabs.current_tab == 7:
		var inherited = debrief_text.text.trim_prefix(practice_debrief_prefix)
		practice_debrief_prefix = "PRACTICE NOTEBOOK\n\n" + "\n\n".join([3, 6].map(func(id): return sim.cars[id].short + "\n" + PracticeEvidence.report(sim.practice_state,id))) + "\n\n"
		debrief_text.text = practice_debrief_prefix + inherited
