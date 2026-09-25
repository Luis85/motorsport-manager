class_name StrategyWeekendView
extends WeekendView
## A playable strategy surface around the existing native pit wall, not another simulation.
var strategy_model: StrategyRaceSim
var strategy_desk: StrategyDesk
var rejoin_overlay: RejoinOverlay
var forecast_cache: Dictionary = {}
var decision_controls: Dictionary = {}
var decision_bar: HBoxContainer
var debrief_text: Label
var debrief_sequence = -1
var team_panel: TeamOrdersPanel
var battle_overlay: BattleOverlay
var team_summary_label: Label

func _ready() -> void:
	super._ready()
	strategy_model = sim as StrategyRaceSim
	if strategy_model == null: return
	canvas.custom_minimum_size.y = 170
	add_theme_constant_override("separation", 6)
	detail_picker.add_item("Strategy desk")
	var strategy_page = tab_page("Strategy")
	strategy_desk = StrategyDesk.new(); strategy_desk.configure(strategy_model); strategy_page.add_child(strategy_desk)
	strategy_desk.command_requested.connect(targeted_command)
	detail_picker.add_item("Decision debrief")
	var debrief_page = tab_page("Debrief")
	debrief_page.add_child(UI.label("DECISIONS & CONSEQUENCES", 12, UI.ACCENT))
	debrief_page.add_child(UI.paragraph("A good call can have a poor result. Compare the assumptions recorded at the time with measured outcomes; no alternate finishing position is presented as fact."))
	debrief_page.add_child(UI.button("Export decision evidence", export_evidence))
	debrief_text = UI.paragraph(""); debrief_text.add_theme_font_size_override("font_size", 12); debrief_page.add_child(debrief_text)
	detail_picker.add_item("Team & battles")
	var team_page = tab_page("Team & battles")
	team_panel = TeamOrdersPanel.new(); team_panel.configure(strategy_model); team_page.add_child(team_panel)
	team_panel.command_requested.connect(targeted_command)
	team_panel.watch_requested.connect(func(id): select_driver(id); set_follow(true))
	battle_overlay = BattleOverlay.new(); battle_overlay.canvas = canvas; canvas.add_child(battle_overlay)
	rejoin_overlay = RejoinOverlay.new(); rejoin_overlay.enabled = false; rejoin_overlay.canvas = canvas; canvas.add_child(rejoin_overlay)
	add_layer("Pit rejoin estimate", false, func(value): rejoin_overlay.enabled = value; rejoin_overlay.queue_redraw())
	decision_bar = HBoxContainer.new(); decision_bar.add_theme_constant_override("separation", 8); add_child(decision_bar)
	move_child(decision_bar, hint.get_index()); hint.visible = false
	for id in [3, 6]:
		var panel = UI.race_panel(false, 8); panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL; panel.size_flags_stretch_ratio = 1.0; decision_bar.add_child(panel)
		var body = UI.vbox(panel); body.add_theme_constant_override("separation", 4); body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var heading = UI.label("", 12, UI.ACCENT); heading.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS; body.add_child(heading)
		var summary = UI.label("", 11, UI.MUTED); summary.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS; body.add_child(summary)
		var detail = UI.label("", 11); detail.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS; body.add_child(detail)
		var actions = HBoxContainer.new(); actions.add_theme_constant_override("separation", 5); body.add_child(actions)
		var compare = UI.button("Compare", func(): open_strategy(id)); compare.size_flags_horizontal = Control.SIZE_EXPAND_FILL; actions.add_child(compare)
		var box = UI.button("Box this lap", func(): box_from_card(id), true); box.size_flags_horizontal = Control.SIZE_EXPAND_FILL; actions.add_child(box)
		var send = UI.button("Release now", func(): targeted_command("send", {"id": id}), true); send.size_flags_horizontal = Control.SIZE_EXPAND_FILL; actions.add_child(send)
		var recall = UI.button("Recall", func(): targeted_command("recall", {"id": id})); recall.size_flags_horizontal = Control.SIZE_EXPAND_FILL; actions.add_child(recall)
		var hold = UI.button("Keep plan", func(): keep_plan(id)); hold.size_flags_horizontal = Control.SIZE_EXPAND_FILL; actions.add_child(hold)
		var more = MenuButton.new(); more.text = "More"; more.custom_minimum_size.y = 30; actions.add_child(more)
		more.get_popup().add_item("Save fuel for 2 laps", 0)
		more.get_popup().add_item("Cancel accepted pit order", 1)
		more.get_popup().id_pressed.connect(func(action_id):
			if action_id == 0: targeted_command("resource_intent", {"id": id, "channel": "engine", "value": 0, "laps": 2})
			elif action_id == 1: targeted_command("cancel_pit", {"id": id}))
		for button in [compare, box, hold, send, recall]: StrategyDesk.compact_button(button)
		var save = UI.button("Save fuel", func(): targeted_command("resource_intent", {"id": id, "channel": "engine", "value": 0, "laps": 2})); save.visible = false
		var cancel = UI.button("Cancel pit", func(): targeted_command("cancel_pit", {"id": id})); cancel.visible = false
		var battle = UI.label("", 11, UI.ACCENT); battle.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS; body.add_child(battle)
		decision_controls[id] = {"send": send, "recall": recall, "cancel": cancel, "battle": battle, "heading": heading, "summary": summary, "detail": detail, "box": box, "hold": hold, "save": save, "card": {}, "compare": compare, "panel": panel, "more": more}
	team_summary_label = UI.label("TWO CARS · ONE TEAM", 10, UI.MUTED); team_summary_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; add_child(team_summary_label)
	move_child(team_summary_label, decision_bar.get_index() + 1)
	pit_note.max_lines_visible = 2
	radio_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	automate.text = "Delegate all domains (reset overrides)"
	register_topic("Strategy", 6, 2); register_topic("Team", 8, 4); register_topic("Debrief", 7)
	pin_navigation(6, strategy_desk.topic_buttons[0].get_parent())
	pin_navigation(8, team_panel.topic_bar)
	team_panel.commit_bar.reparent(detail_actions)
	strategy_desk.commit_bar.reparent(detail_actions)
	tabs.tab_changed.connect(func(index): strategy_desk.commit_bar.visible = index == 6 and strategy_desk.topic != 2)
	tabs.current_tab = 6; refresh(); close_detail()

func open_strategy(id: int) -> void:
	select_driver(id); open_topic(6); strategy_desk.select_driver(id); strategy_desk.show_topic(0)

func targeted_command(action: String, payload: Dictionary) -> void:
	if not strategy_model.command(action, payload): feedback(strategy_model.last_error)
	else:
		var id = int(payload.get("id", 3))
		feedback("%s · %s accepted%s" % [sim.cars[id].short, action.replace("_", " "), " · deferred to the next safe entry" if action == "pit" and sim.cars[id].pit_deferred else ""])
	forecast_cache.clear(); refresh()

func box_from_card(id: int) -> void:
	if not forecast_cache.has(id): return
	var f = forecast_cache[id]
	targeted_command("pit", {"id": id, "forecast_key": f.key, "forecast_time": f.time, "expected_gate": f.gate.distance, "set_id": f.replacement_id})

func keep_plan(id: int) -> void:
	var card = decision_controls[id].card
	if card.is_empty(): return
	targeted_command("hold_decision", {"id": id, "issue": card.issue, "key": card.key})

func select_driver(id: int) -> void:
	super.select_driver(id)
	if strategy_desk and id in [3, 6]: strategy_desk.select_driver(id)

func refresh() -> void:
	super.refresh()
	if strategy_model == null or strategy_desk == null or decision_bar == null: return
	for id in [3, 6]:
		var c = sim.cars[id]; var p = strategy_model.policy(id)
		if not forecast_cache.has(id) or RaceForecaster.stale(sim, forecast_cache[id], int(p.revision)) or sim.total_time - forecast_cache[id].time >= 3:
			forecast_cache[id] = strategy_model.forecast(id)
		var f = forecast_cache[id]
		var cards = DecisionFeed.for_driver(sim, id, p, f)
		var card = DecisionFeed.primary(cards)
		var controls = decision_controls[id]; controls.card = card
		var urgent = card.get("priority", 0) >= 90
		controls.panel.add_theme_stylebox_override("panel", UI.box(Color("fff2dc") if urgent else UI.RACE_CREAM, UI.DANGER if urgent else UI.LINE, 6, 8))
		var status = "Finished" if c.finished else ("Retired" if c.dnf else ("Pit order executing" if c.pit_order else "On plan · " + p.plan.get("objective", "balanced").replace("_", " ")))
		controls.heading.text = "%s · %s" % [c.short, ("! " if card.get("priority", 0) >= 90 else "") + card.get("title", status)]
		controls.summary.text = "%s %.0f%% · fuel %+.1f laps · %s" % [c.set_id.get_slice("-", 1), c.tyre, RaceForecaster.fuel_margin(sim, c), StrategyPlan.ownership_text(p)]
		controls.detail.text = DecisionFeed.deadline_text(card, sim) if not card.is_empty() else "Rejoin ~P%d–%d · pit loss %.0f–%.0fs · %s" % [f.pit.position_low, f.pit.position_high, f.pit.loss_low, f.pit.loss_high, "manual pits" if p.owners.pit == "player" else "engineer pits"]
		if c.route == "pit": controls.detail.text = "Pit visit in progress · physical queue / frozen service plan"
		var explanation = card.get("evidence", "The current strategy and ownership remain active.") + "
" + card.get("fallback", "No new command is implied.")
		controls.heading.tooltip_text = explanation; controls.detail.tooltip_text = explanation; controls.summary.tooltip_text = controls.summary.text
		controls.box.disabled = sim.phase != "race" or c.route != "track" or c.pit_order or c.dnf or c.finished or f.replacement_id.is_empty() or f.gate.distance >= sim.laps * sim.track.length
		controls.box.tooltip_text = "Fit %s at the next safe entry on lap %d. Estimate P%d–%d; ignoring this button retains the current owner." % [f.replacement_id, f.gate.lap, f.pit.position_low, f.pit.position_high]
		controls.compare.text = "Compare details" if not card.is_empty() else "Strategy"
		controls.box.text = "Box this lap" if f.gate.lap <= int(c.distance / sim.track.length) + 1 else "Box lap %d" % f.gate.lap
		var qualifying = sim.phase in ["qualifying", "qualifying_results"]
		controls.box.visible = not qualifying; controls.hold.visible = not qualifying
		controls.send.visible = qualifying; controls.recall.visible = qualifying
		var release = RaceForecaster.qualifying_release(sim, c) if qualifying else {}
		controls.send.disabled = not qualifying or c.dnf or c.finished or c.route != "garage" or not release.get("can_start_hotlap", false)
		controls.send.tooltip_text = "Release %s on the planned set. The estimate checks whether a legal flying lap can begin." % c.short
		if qualifying and not release.get("can_start_hotlap", false): controls.send.tooltip_text = "Not enough qualifying time to begin a flying lap. Already-started flying laps may finish."
		controls.recall.disabled = not qualifying or c.dnf or c.finished or c.route != "track"
		controls.recall.tooltip_text = "Recall %s to the garage; actual entry and tyre wear remain physical." % c.short
		controls.cancel.visible = false; controls.cancel.disabled = c.route != "track" or c.dnf or c.finished
		controls.cancel.tooltip_text = "Cancel %s's accepted pit order before physical commitment. Committed entries cannot be canceled." % c.short
		controls.save.visible = false
		controls.more.visible = not qualifying
		controls.more.disabled = c.dnf or c.finished
		controls.hold.disabled = card.is_empty(); controls.hold.tooltip_text = "Acknowledge this issue without changing the plan or time controls."
		controls.save.disabled = sim.phase != "race" or c.dnf or c.finished
		var battle = strategy_model.battle_state.drivers[id]
		controls.battle.text = "Team & battles: " + (RacecraftController.LABELS[battle.phase] + (" " + sim.cars[int(battle.target_id)].short if battle.target_id >= 0 else ""))
		controls.battle.tooltip_text = RacecraftController.describe(strategy_model.battle_state, id, sim.cars)
		if TeamOrders.active(strategy_model.team_state.track_order):
			controls.battle.text = "Team " + strategy_model.team_state.track_order.kind + " · " + strategy_model.team_state.track_order.reason
			controls.battle.tooltip_text = controls.battle.text
		if qualifying:
			controls.detail.text = "%s · %s" % [c.qual_state.to_upper(), "Flying lap can start" if release.get("can_start_hotlap", false) else "No new timed attempt"]
			controls.battle.text = "Qualifying owner: " + p.owners.qualifying
		if c.dnf or c.finished: controls.battle.text = "Contest ended · " + ("retired" if c.dnf else "finished")
	if team_summary_label:
		var a = sim.cars[3]; var b = sim.cars[6]
		team_summary_label.text = "TWO CARS · ONE TEAM   ·   %s %s   /   %s %s   ·   Shared box: %s" % [a.short, "P%d" % (sim.standings().find(a) + 1), b.short, "P%d" % (sim.standings().find(b) + 1), "coordinate stops" if a.scheduled_lap > 0 and b.scheduled_lap > 0 else "clear"]
	if sim.selected_id in [3, 6]: rejoin_overlay.forecast = forecast_cache[sim.selected_id]
	else: rejoin_overlay.forecast = {}
	if right_panel.visible and tabs.current_tab == 6:
		strategy_desk.live_preview = forecast_cache[strategy_desk.driver_id]
		strategy_desk.refresh()
	if right_panel.visible and tabs.current_tab == 8: team_panel.refresh()
	# Fixed driver cards own race actions; the inspector contains only the selected task.
	send_button.get_parent().visible = false
	team_panel.commit_bar.visible = tabs.current_tab == 8
	trace.visible = right_panel.visible and tabs.current_tab == 1
	pit_note.visible = false; box_button.get_parent().visible = false
	driver_status_card.visible = right_panel.visible and sim.selected_id not in [3, 6]
	resource_row.visible = false; compact_resources.visible = false
	teammate_buttons[0].get_parent().visible = tabs.current_tab != 8
	if tabs.current_tab == 8: driver_status_card.visible = false
	strategy_desk.commit_bar.visible = tabs.current_tab == 6 and strategy_desk.topic != 2
	refresh_navigation()
	if right_panel.visible and tabs.current_tab == 7 and int(strategy_model.strategy_state.sequence) != debrief_sequence:
		debrief_sequence = int(strategy_model.strategy_state.sequence)
		var subset = strategy_model.strategy_state.records.filter(func(record): return record.driver_id in [-1, 3, 6])
		var view = {"truncated": strategy_model.strategy_state.truncated, "records": subset.slice(maxi(0, subset.size() - 100))}
		debrief_text.text = WeekendScenarios.team_result(strategy_model) + "\n\n" + "\n\n".join(RaceJournal.debrief(view))
		if subset.size() > 100: debrief_text.text += "

Showing the latest 100 team records. Export retains the full journal."
	if sim.phase == "results": primary_button.text = "Another weekend"

func export_evidence() -> void:
	UI.file_dialog(self, true, PackedStringArray(["*.json ; Race decision evidence"]), func(path):
		var error = Storage.write_json(path, {"kind": "motorsport-manager-decision-evidence", "version": 1, "track": sim.track.document.name, "seed": sim.seed_value, "phase": sim.phase, "journal": strategy_model.strategy_state.duplicate(true)})
		feedback("Decision evidence exported." if error.is_empty() else error))

func setup_guide() -> void:
	guide = ContextGuide.new()
	guide.configure("pit wall", [
		{"title": "Your objective and your two cars", "body": "Bring both Obsidian cars home. MER and MOR have separate plans and control owners. Both cards stay visible when you inspect a rival. This guide does not pause the race; use Space for reading time.", "target": func(): return teammate_buttons[0].get_parent(), "reveal": func(): open_strategy(3)},
		{"title": "Read a decision before reacting", "body": "A card connects a current issue to evidence, a trade-off and a deadline. Compare opens details. Keep plan acknowledges the issue without changing an order. No alert changes your speed or pauses automatically.", "target": func(): return decision_bar},
		{"title": "Compare, then commit", "body": "Pit loss, warm-up and possible rejoin traffic are estimates, not promises. A forecast Box call names the driver, set and safe gate. It is rejected if the displayed assumptions become stale.", "target": func(): return tabs, "reveal": func(): open_strategy(3)},
		{"title": "Approve a plan, not a teleport", "body": "In Plan, choose a starting set and up to three windows. Draft edits do nothing until Approve. Approval delegates pit timing inside those windows; physical entry, inventory and the shared box still govern execution.", "target": func(): return tabs, "reveal": func(): open_strategy(3); strategy_desk.show_topic(1)},
		{"title": "Delegate the work, retain intent", "body": "Control separates pace, engine, pit strategy, racecraft and qualifying. A two-lap push returns to the prior owner automatically. It does not disable fuel protection or replace a pit plan.", "target": func(): return tabs, "reveal": func(): open_strategy(3); strategy_desk.show_topic(2)},
		{"title": "Two drivers, one team", "body": "Team & battles provides bounded hold, allow-through and pit-priority instructions. Both drivers are named. Safe road geometry, flags and physical pit commitments take precedence. Battles retain a target and phases; Watch follows the selected contest until you pan or zoom.", "target": func(): return tabs, "reveal": func(): open_topic(8)},
		{"title": "Learn from measured consequences", "body": "The debrief records accepted calls and measured pit visits. It compares actual duration with the estimate recorded at the call. No hypothetical finishing position is claimed as fact. Export keeps the full evidence.", "target": func(): return tabs, "reveal": func(): open_topic(7)}
	])
	add_child(guide)


func _unhandled_key_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_B:
		var focus = get_viewport().gui_get_focus_owner()
		if focus is LineEdit or focus is TextEdit: return
		if sim.selected_id in decision_controls and not decision_controls[sim.selected_id].box.disabled:
			box_from_card(sim.selected_id); get_viewport().set_input_as_handled()
		return
	super._unhandled_key_input(event)
