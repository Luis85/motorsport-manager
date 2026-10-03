class_name StrategyDeskPresentation
extends StrategyDeskDraft
## Native presentation responsibilities; inherited state remains per instance.


func refresh(force: bool = false) -> void:
	if model == null or draft_status == null or not drafts.has(driver_id):
		return
	var c = model.car(driver_id)
	var policy = model.policy(driver_id)
	var draft = drafts[driver_id]
	var error = model.strategy_plan_error(
		draft,
		c,
		model.laps,
		maxi(1, int(floor(c.distance / model.track.length)) + 1) if model.phase == "race" else 0
	)
	if int(revisions[driver_id]) != int(policy.revision):
		error = "A newer plan is active. Discard/reload before applying."
	var legal = (
		model.phase in ["briefing", "race_preparation", "race"]
		and c.route != "pit"
		and not c.pit_order
		and not c.dnf
		and not c.finished
	)
	apply_button.disabled = not legal or not error.is_empty() or not dirty[driver_id]
	clear_button.disabled = not legal or policy.plan.is_empty()
	apply_button.text = "Approve %s plan · delegate pits" % c.short
	apply_button.tooltip_text = (
		error if not error.is_empty() else "Approve only when no physical stop is already ordered."
	)
	draft_status.text = (
		("UNAPPLIED · " if dirty[driver_id] else "APPROVED · ")
		+ (
			error
			if not error.is_empty()
			else (
				"Only approval changes the active plan."
				if dirty[driver_id]
				else "No unapplied changes."
			)
		)
	)
	plan_status.text = (
		"%s · %s · revision %d" % [c.short, policy.plan_status.replace("_", " "), policy.revision]
	)
	_refresh_overlap(draft)
	starting_set.disabled = model.phase == "race"
	for channel in ownership_controls:
		ownership_controls[channel].select(0 if policy.owners[channel] == "engineer" else 1)
		ownership_controls[channel].disabled = c.dnf or c.finished
	var active: Array[String] = []
	for channel in policy.overrides:
		active.append(
			(
				"%s: %.1f laps left, then %s"
				% [
					channel.capitalize(),
					(
						maxf(0, policy.overrides[channel].until_distance - c.distance)
						/ model.track.length
					),
					policy.owners[channel]
				]
			)
		)
	override_label.text = (
		"No temporary override. Direct modes remain manual until returned."
		if active.is_empty()
		else "\n".join(active)
	)
	for button in action_buttons:
		button.disabled = model.phase != "race" or c.dnf or c.finished
	_refresh_forecast(force, policy, draft)
	briefing_text.visible = model.phase in ["briefing", "race_preparation", "qualifying_results"]
	if briefing_text.visible:
		briefing_text.tooltip_text = model.weekend_scenarios_briefing()
		briefing_text.text = "Plan both cars before formation. Starting sets and fuel have real weekend costs."
	if (
		live_preview.is_empty()
		or model.race_forecaster_stale(live_preview, int(policy.revision))
		or model.total_time - live_preview.time >= 3
	):
		live_preview = model.forecast(driver_id)
	var current_cards = model.decision_feed_for_driver(driver_id, policy, live_preview)
	var descriptions: Array[String] = []
	for card in current_cards:
		descriptions.append(
			(
				("Acknowledged · " if card.acknowledged else "")
				+ card.title
				+ "\n"
				+ card.evidence
				+ "\n"
				+ card.fallback
			)
		)
	issue_text.tooltip_text = "\n\n".join(descriptions)
	issue_text.text = (
		""
		if current_cards.is_empty()
		else (
			("Acknowledged · " if current_cards[0].acknowledged else "")
			+ current_cards[0].title
			+ "\nIgnored: "
			+ current_cards[0].fallback
		)
	)
	issue_text.visible = not compact_host and not descriptions.is_empty()
	if timeline and timeline.visible:
		timeline.present(
			model.race_chart_query_strategy(
				driver_id, preview, str(drafts.get(driver_id, {}).get("starting_set", ""))
			)
		)
	var pit = preview.pit
	rejoin.text = (
		"%s · rejoin estimate P%d–P%d\nNet pit loss %.1f–%.1fs · box wait ~%.1fs\n%s"
		% [
			c.short,
			pit.position_low,
			pit.position_high,
			pit.loss_low,
			pit.loss_high,
			pit.queue,
			(
				"Traffic: " + ", ".join(pit.traffic)
				if not pit.traffic.is_empty()
				else "No close rejoin traffic in this snapshot."
			)
		]
	)
	if c.route == "pit":
		rejoin.text = (
			"COMMITTED PIT VISIT · Service uses the frozen plan. Future strategy comparisons "
			+ "resume after rejoin."
		)
	var lines: Array[String] = [
		"UNAPPLIED DRAFT COMPARISON" if dirty[driver_id] else "CURRENT PLAN COMPARISON"
	]
	for option in preview.options:
		if not option.available:
			lines.append(option.title + " · " + option.reason)
			continue
		lines.append(
			(
				"%s\n~%.0f–%.0fs remaining · %s risk · %+.1fs vs baseline"
				% [option.title, option.low, option.high, option.risk, option.gain]
			)
		)
	lines.append("Snapshot tick %d · current conditions only" % preview.tick)
	estimates.text = "\n".join(lines)
	box_now.disabled = (
		model.phase != "race"
		or c.route != "track"
		or c.pit_order
		or c.dnf
		or c.finished
		or preview.replacement_id.is_empty()
		or preview.gate.distance >= model.laps * model.track.length
	)
	box_now.text = (
		"Box %s · %s · lap %d"
		% [c.short, preview.replacement_id.get_slice("-", 1), preview.gate.lap]
	)
	box_now.tooltip_text = (
		"This explicit action changes only pit ownership and commits the displayed "
		+ "replacement at the safe entry."
	)
	extend_draft.disabled = true
	for option in preview.options:
		if option.id == "extend" and option.available:
			extend_draft.disabled = false


static func compact_button(button: Button) -> void:
	button.custom_minimum_size.y = 30
	button.add_theme_font_size_override("font_size", 12)
	for state in ["normal", "hover", "pressed", "hover_pressed", "disabled"]:
		# Some controls are compacted before entering the tree; never freeze Godot's fallback palette.
		var colors = {
			"normal": UI.CARD,
			"hover": UI.HOVER,
			"pressed": UI.SELECTED,
			"hover_pressed": UI.SELECTED,
			"disabled": UI.PANEL
		}
		var border = (
			UI.ACCENT
			if state in ["pressed", "hover_pressed"]
			else (UI.MUTED if state == "hover" else UI.LINE)
		)
		var style = (
			button.get_theme_stylebox(state).duplicate()
			if button.has_theme_stylebox_override(state)
			else UI.action_box(colors[state], border)
		)
		style.content_margin_top = 6
		style.content_margin_bottom = 6
		style.content_margin_left = 8
		style.content_margin_right = 8
		button.add_theme_stylebox_override(state, style)


func _toggle_timeline() -> void:
	timeline.visible = not timeline.visible
	timeline_toggle.text = "Stint timeline ▾" if timeline.visible else "Stint timeline ▸"
	if timeline.visible:
		timeline.present(
			model.race_chart_query_strategy(
				driver_id, preview, str(drafts.get(driver_id, {}).get("starting_set", ""))
			)
		)


func _refresh_overlap(draft: Dictionary) -> void:
	var other_plan = model.active_plan(model.teammate_id(driver_id))
	var overlaps: Array[String] = []
	for own_stop in draft.stops:
		for other_stop in other_plan.get("stops", []):
			if own_stop.from_lap <= other_stop.to_lap and other_stop.from_lap <= own_stop.to_lap:
				overlaps.append(
					(
						"laps %d–%d"
						% [
							maxi(own_stop.from_lap, other_stop.from_lap),
							mini(own_stop.to_lap, other_stop.to_lap)
						]
					)
				)
	if not overlaps.is_empty():
		draft_status.text += (
			"\nTEAM BOX · Windows overlap on "
			+ ", ".join(overlaps)
			+ ". A queue is possible, not certain; stagger or accept the exposure."
		)


func _refresh_forecast(force: bool, policy: Dictionary, draft: Dictionary) -> void:
	if (
		force
		or preview.is_empty()
		or model.race_forecaster_stale(preview, int(policy.revision))
		or model.total_time - last_refresh >= 3
	):
		preview = (
			model.forecast(driver_id, draft)
			if dirty[driver_id]
			else (
				live_preview
				if (
					not live_preview.is_empty()
					and not model.race_forecaster_stale(live_preview, int(policy.revision))
				)
				else model.forecast(driver_id)
			)
		)
		last_refresh = model.total_time
		preview_changed.emit(preview)
