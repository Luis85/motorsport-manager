class_name MinimalRaceDriverPresenter
extends RefCounted
## Read-only presentation and control composition for its owning view.


static func _adapt_compact_layout(view) -> void:
	var compact = int(view.get_viewport_rect().size.y <= 760)
	if compact != view.compact_profile:
		view.compact_profile = compact
		view.pit_right.add_theme_constant_override(
			"separation", roundi((2 if compact else 7) * view.text_scale)
		)
		view.pit_masthead.visible = not compact
		view.engine_description.visible = not compact
		var pad = roundi((2 if compact else 8) * view.text_scale)
		view.pit_selected_panel.add_theme_stylebox_override(
			"panel", MinimalRaceStyle.surface(Color("1e3036"), Color.TRANSPARENT, pad)
		)
		view.tower.add_theme_constant_override(
			"v_separation",
			roundi(
				(
					(0 if compact and view.text_scale >= 1.25 else (1 if compact else 3))
					* view.text_scale
				)
			)
		)
		view.timing_stack.add_theme_constant_override(
			"separation", roundi((4 if compact else 8) * view.text_scale)
		)
		view.timing_panel.add_theme_stylebox_override(
			"panel",
			MinimalRaceStyle.surface(
				MinimalRaceStyle.PANEL,
				MinimalRaceStyle.LINE,
				roundi((6 if compact else 12) * view.text_scale)
			)
		)
		view.receipt_label.max_lines_visible = 1 if compact else 2
		view.hint_label.max_lines_visible = 1 if compact else 2
		for card in view.driver_cards.values():
			card.set_compact(compact == 1)


static func _present_selected_driver(view) -> void:
	var car = view.frame.cars[view.selected_id]
	view.strategy_button.disabled = view.frame.phase != "race" or car.dnf or car.finished
	view.strategy_button.tooltip_text = (
		(
			"Open a read-only current-plan comparison; no order, pause, speed change or "
			+ "automatic refresh."
		)
		if not view.strategy_button.disabled
		else (
			"This car is no longer running."
			if car.dnf or car.finished
			else "Available during the live race."
		)
	)
	if view.strategy_popup.visible and view.strategy_button.disabled:
		view.strategy_popup.hide()
	for id in view.driver_buttons:
		view.driver_buttons[id].set_pressed_no_signal(id == view.selected_id)
	view.name_label.text = car.name
	view.state_label.text = car.state
	view.state_label.tooltip_text = view.state_label.text
	view.pit_identity.text = "#%02d" % car.number
	view.pit_identity.add_theme_color_override("font_color", Color(car.color))
	view.engine_description.text = [
		"Less fuel · less power", "Balanced fuel use", "More fuel · more heat"
	][car.engine]
	view.send_button.disabled = not view.controls.send_reason(view.selected_id).is_empty()
	view.send_button.tooltip_text = (
		view.controls.send_reason(view.selected_id)
		if view.send_button.disabled
		else (
			"Release "
			+ car.name
			+ (
				". Practice: two measured laps. Qualifying: one flying lap. Automatic physical "
				+ "return."
			)
		)
	)
	view.box_button.disabled = not view.controls.box_reason(view.selected_id).is_empty()
	view.box_button.tooltip_text = (
		view.controls.box_reason(view.selected_id)
		if view.box_button.disabled
		else (
			"Return to the garage; the unfinished timed lap is abandoned."
			if view.frame.phase != "race"
			else (
				"Pit at this lap's safe entry. Crew chooses available tyres for the observed "
				+ "conditions."
			)
		)
	)
	var reason = view.controls.mode_reason(view.selected_id)
	view.push_button.disabled = not reason.is_empty()
	view.calm_button.disabled = not reason.is_empty()
	view.engine_control.disabled = not reason.is_empty()
	view.push_button.set_pressed_no_signal(car.pace == 2)
	view.calm_button.set_pressed_no_signal(car.pace == 0)
	view.pace_label.text = "Pace · " + ["Calm", "Normal", "Push"][car.pace]
	view.push_button.tooltip_text = (
		reason
		if not reason.is_empty()
		else "More pace, more wear. Press again to return to Normal."
	)
	view.calm_button.tooltip_text = (
		reason
		if not reason.is_empty()
		else "Reduce pace and tyre wear. Press again to return to Normal."
	)
	if not view.engine_control.get_popup().visible:
		view.engine_control.select(car.engine)
	view.engine_control.tooltip_text = (
		reason
		if not reason.is_empty()
		else (
			"Save reduces fuel use; Power spends more fuel and heat. Standard is the normal "
			+ "setting."
		)
	)
	view.receipt_label.text = (
		view.global_message
		if not view.global_message.is_empty()
		else view.receipts.get(view.selected_id, "")
	)
	view.receipt_label.visible = not view.receipt_label.text.is_empty()
	view.receipt_label.tooltip_text = view.receipt_label.text
	view.hint_label.text = view.instruction()
	view.hint_label.tooltip_text = view.hint_label.text
	view.hint_label.visible = not view.receipt_label.visible
