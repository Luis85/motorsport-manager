class_name DuelWorkspace
extends RefCounted
## Binds tactical controls to the existing native inspector, driver menus and guide.
var host
var panel: TacticalPlanPanel
var index = -1
func configure(view) -> void:
	host = view
	host.detail_picker.add_item("Tactical plan")
	var page = host.tab_page("Tactical plan"); index = host.tabs.get_tab_count() - 1
	panel = TacticalPlanPanel.new(); panel.configure(host.sim); panel.text_scale = host.text_scale; page.add_child(panel)
	panel.commit_bar.reparent(host.detail_actions)
	host.register_topic("Tactics", index)
	host.topic_buttons[index].reparent(host.strategy_navigation)
	host.topic_buttons[index].size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.command_requested.connect(host.targeted_command)
	panel.driver_selected.connect(host.select_driver)
	panel.reading_requested.connect(func(title, text, invoker):
		var origin = "SANDBOX · " if host.recording != null and host.recording.origin == "sandbox" else "SESSION · "
		host.show_reading(title, origin + "captured at %.1fs. No automatic pause.\n\n" % host.sim.total_time + text, invoker))
	for id in [3, 6]:
		var menu = host.decision_controls[id].more.get_popup()
		menu.add_item("Tactical plan for " + host.sim.cars[id].short, 60)
		menu.id_pressed.connect(func(action):
			if action == 60: open_for(id))
	host.navigator.catalog.append([index, 0, "Strategy / Tactics", "duel undercut extend target rival conditional mandate"])
	host.navigator.catalog.append([index, 1, "Review / Tactical evidence", "intent pit cycle consequence both plans history"])
	host.navigator.filter_views("")
	host.guide.steps.append({"title": "Plan a strategic duel", "body": "Choose a named rival and compare an undercut with extending. Recommend only leaves commands with the existing owners. Delegating a tactic authorizes one bounded pit decision, never a hidden push. Use Compare options, review the captured estimates, then approve the named driver. Limits and contingencies can be expanded without changing them. End tactic asks for confirmation and does not cancel an accepted stop. Use Plan evidence to follow approval, physical execution and the observed outcome.", "target": func(): return panel, "reveal": func(): open_for(3)})
	PitwallDesign.scale_controls(panel, host.text_scale)
	PitwallDesign.scale_controls(panel.commit_bar, host.text_scale)
	PitwallDesign.scale_controls(host.topic_buttons[index], host.text_scale)
	host.wire_control_help(panel)

func open_for(id: int) -> void:
	host.select_driver(id); panel.choose_driver(id); host.open_topic(index)

func refresh() -> void:
	panel.commit_bar.visible = host.right_panel.visible and host.tabs.current_tab == index
	if panel.commit_bar.visible:
		if host.sim.selected_id in [3, 6] and host.sim.selected_id != panel.driver_id: panel.choose_driver(host.sim.selected_id)
		panel.refresh()
	# Keep the existing compact row bounded. The practice dashboard remains reachable
	# through its session header and Find, rather than another permanent race button.
	host.practice_dashboard_button.hide()
	host.topic_buttons[host.practice_page_index].visible = host.strategy_navigation.visible and host.sim.phase in ["briefing", "practice", "practice_results"]
	for id in [3, 6]:
		var r = TacticalDuels.current(host.sim, id)
		if not TacticalDuels.live(r) or host.sim.cars[id].finished or host.sim.cars[id].dnf: continue
		if r.borrowed_pits and r.order_id.is_empty():
			host.car_cards[id].facts[2].text = "Tactic L%d–%d" % [r.plan.from_lap, r.plan.to_lap]
			host.car_cards[id].facts[2].tooltip_text = "Approved tactical window, not a physical pit order. " + r.reason
		var issue = host.decision_controls[id].get("card", {})
		if int(issue.get("priority", 0)) >= 90 or host.sim.cars[id].route == "pit": continue
		var label = host.car_cards[id].issue
		label.text = "%s · %s / %s" % [r.plan.kind.capitalize(), host.sim.cars[int(r.plan.target_id)].short, r.status]
		label.tooltip_text = r.reason + " Open More / Tactical plan for explicit authority and evidence."
