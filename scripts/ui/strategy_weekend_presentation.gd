class_name StrategyWeekendPresentation
extends StrategyWeekendControls
## Native presentation responsibilities; inherited state remains per instance.


func refresh() -> void:
	super.refresh()
	if strategy_model == null or strategy_desk == null or decision_bar == null:
		return
	_refresh_driver_decisions()
	if right_panel.visible and tabs.current_tab == 6:
		strategy_desk.live_preview = forecast_cache[strategy_desk.driver_id]
		strategy_desk.refresh()
	if right_panel.visible and tabs.current_tab == 8:
		team_panel.refresh()
	# Fixed driver cards own race actions; the inspector contains only the selected task.
	send_button.get_parent().visible = false
	team_panel.commit_bar.visible = tabs.current_tab == 8
	trace.visible = right_panel.visible and tabs.current_tab == 1
	pit_note.visible = false
	box_button.get_parent().visible = false
	driver_status_card.visible = right_panel.visible and sim.selected_id not in sim.player_ids()
	resource_row.visible = false
	compact_resources.visible = false
	teammate_buttons[0].get_parent().visible = tabs.current_tab != 8
	if tabs.current_tab == 8:
		driver_status_card.visible = false
	strategy_desk.commit_bar.visible = tabs.current_tab == 6 and strategy_desk.topic != 2
	refresh_navigation()
	if (
		right_panel.visible
		and tabs.current_tab == 7
		and int(strategy_model.strategy_state.sequence) != debrief_sequence
	):
		debrief_sequence = int(strategy_model.strategy_state.sequence)
		var subset = strategy_model.strategy_state.records.filter(
			func(record): return record.driver_id in [-1] + strategy_model.player_ids()
		)
		var view = {
			"truncated": strategy_model.strategy_state.truncated,
			"records": subset.slice(maxi(0, subset.size() - 100))
		}
		debrief_text.text = (
			strategy_model.weekend_scenarios_team_result()
			+ "\n\n"
			+ "\n\n".join(RaceJournal.debrief(view, sim.cars))
		)
		if subset.size() > 100:
			debrief_text.text += "\n\nShowing the latest 100 team records. Export retains the full journal."
	if sim.phase == "results":
		primary_button.text = "Another weekend"


func _refresh_driver_decisions() -> void:
	for id in sim.player_ids():
		var c = sim.car(id)
		var p = strategy_model.policy(id)
		if (
			not forecast_cache.has(id)
			or sim.race_forecaster_stale(forecast_cache[id], int(p.revision))
			or sim.total_time - forecast_cache[id].time >= 3
		):
			forecast_cache[id] = strategy_model.forecast(id)
		var f = forecast_cache[id]
		var cards = sim.decision_feed_for_driver(id, p, f)
		var card = DecisionFeed.primary(cards)
		var controls = decision_controls[id]
		controls.card = card
		UI.race_card_state(
			controls.panel,
			(
				"warning"
				if card.get("priority", 0) >= 90
				else ("selected" if sim.selected_id == id else "normal")
			)
		)
		var status = (
			"Finished"
			if c.finished
			else (
				"Retired"
				if c.dnf
				else (
					"Pit order executing"
					if c.pit_order
					else "On plan · " + p.plan.get("objective", "balanced").replace("_", " ")
				)
			)
		)
		controls.heading.text = (
			"%s · %s"
			% [c.short, ("! " if card.get("priority", 0) >= 90 else "") + card.get("title", status)]
		)
		controls.summary.text = (
			"%s %.0f%% · fuel %+.1f laps · %s"
			% [
				sim.set_label(c, c.set_id),
				c.tyre,
				sim.race_forecaster_fuel_margin(c),
				StrategyPlan.ownership_text(p)
			]
		)
		controls.detail.text = (
			sim.decision_feed_deadline_text(card)
			if not card.is_empty()
			else (
				"Rejoin ~P%d–%d · pit loss %.0f–%.0fs · %s"
				% [
					f.pit.position_low,
					f.pit.position_high,
					f.pit.loss_low,
					f.pit.loss_high,
					"manual pits" if p.owners.pit == "player" else "engineer pits"
				]
			)
		)
		if c.route == "pit":
			controls.detail.text = "Pit visit in progress · physical queue / frozen service plan"
		var explanation = (
			card.get("evidence", "The current strategy and ownership remain active.")
			+ "\n"
			+ card.get("fallback", "No new command is implied.")
		)
		controls.heading.tooltip_text = explanation
		controls.detail.tooltip_text = explanation
		controls.summary.tooltip_text = controls.summary.text
		controls.box.disabled = (
			sim.phase != "race"
			or c.route != "track"
			or c.pit_order
			or c.dnf
			or c.finished
			or f.replacement_id.is_empty()
			or f.gate.distance >= sim.laps * sim.track.length
		)
		controls.box.tooltip_text = (
			(
				"Fit %s at the next safe entry on lap %d. Estimate P%d–%d; ignoring this button "
				+ "retains the current owner."
			)
			% [f.replacement_id, f.gate.lap, f.pit.position_low, f.pit.position_high]
		)
		controls.compare.text = "Compare details" if not card.is_empty() else "Strategy"
		controls.box.text = (
			"Box this lap"
			if f.gate.lap <= int(c.distance / sim.track.length) + 1
			else "Box lap %d" % f.gate.lap
		)
		var qualifying = sim.phase in ["qualifying", "qualifying_results"]
		controls.box.visible = not qualifying
		controls.hold.visible = not qualifying
		controls.send.visible = qualifying
		controls.recall.visible = qualifying
		var release = sim.race_forecaster_qualifying_release(c) if qualifying else {}
		controls.send.disabled = (
			not qualifying
			or c.dnf
			or c.finished
			or c.route != "garage"
			or not release.get("can_start_hotlap", false)
		)
		controls.send.tooltip_text = (
			(
				"Release %s on the planned set. The estimate checks whether a legal flying lap "
				+ "can begin."
			)
			% c.short
		)
		if qualifying and not release.get("can_start_hotlap", false):
			controls.send.tooltip_text = (
				"Not enough qualifying time to begin a flying lap. Already-started flying laps "
				+ "may finish."
			)
		controls.recall.disabled = not qualifying or c.dnf or c.finished or c.route != "track"
		controls.recall.tooltip_text = (
			"Recall %s to the garage; actual entry and tyre wear remain physical." % c.short
		)
		controls.cancel.visible = false
		controls.cancel.disabled = c.route != "track" or c.dnf or c.finished
		controls.cancel.tooltip_text = (
			(
				"Cancel %s's accepted pit order before physical commitment. Committed entries "
				+ "cannot be canceled."
			)
			% c.short
		)
		# A critical fuel shortfall promotes its recovery action out of More.
		controls.save.visible = (
			sim.phase == "race"
			and not c.dnf
			and not c.finished
			and sim.race_forecaster_fuel_margin(c) < 0
		)
		controls.more.visible = not qualifying
		controls.more.disabled = c.dnf or c.finished
		update_more_actions(id)
		controls.hold.disabled = card.is_empty()
		controls.hold.tooltip_text = "Acknowledge this issue without changing the plan or time controls."
		controls.save.disabled = sim.phase != "race" or c.dnf or c.finished
		var battle = strategy_model.battle_state.drivers[id]
		controls.battle.text = (
			"Team & battles: "
			+ (
				RacecraftController.LABELS[battle.phase]
				+ (" " + sim.car(int(battle.target_id)).short if battle.target_id >= 0 else "")
			)
		)
		controls.battle.tooltip_text = RacecraftController.describe(
			strategy_model.battle_state, id, sim.cars
		)
		if TeamOrders.active(strategy_model.team_state.track_order):
			controls.battle.text = (
				"Team "
				+ strategy_model.team_state.track_order.kind
				+ " · "
				+ strategy_model.team_state.track_order.reason
			)
			controls.battle.tooltip_text = controls.battle.text
		if qualifying:
			controls.detail.text = (
				"%s · %s"
				% [
					c.qual_state.to_upper(),
					(
						"Flying lap can start"
						if release.get("can_start_hotlap", false)
						else "No new timed attempt"
					)
				]
			)
			controls.battle.text = "Qualifying owner: " + p.owners.qualifying
		if c.dnf or c.finished:
			controls.battle.text = "Contest ended · " + ("retired" if c.dnf else "finished")
	if team_summary_label:
		var occupant = sim.pit_box_occupant(sim.player_ids()[0])
		var arrivals: Array[String] = []
		for id in sim.player_ids():
			if sim.car(id).route == "pit" and sim.car(id).pit_stage == "entry":
				arrivals.append(sim.car(id).short)
		team_summary_label.text = (
			"SHARED PIT BOX · "
			+ (sim.car(occupant).short + " in service" if occupant >= 0 else "No car in service")
		)
		if not arrivals.is_empty():
			team_summary_label.text += " · Approaching: " + ", ".join(arrivals)
	if sim.selected_id in sim.player_ids():
		rejoin_overlay.forecast = forecast_cache[sim.selected_id]
	else:
		rejoin_overlay.forecast = {}
