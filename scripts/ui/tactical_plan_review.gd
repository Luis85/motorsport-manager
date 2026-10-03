class_name TacticalPlanReview
extends TacticalPlanDraft
## Native presentation responsibilities; inherited state remains per instance.


func compare_now() -> void:
	var error = model.tactical_plan_error(drafts[driver_id], driver_id)
	if not error.is_empty():
		notice = (
			"Latest lap must be at or after earliest lap."
			if drafts[driver_id].from_lap > drafts[driver_id].to_lap
			else error
		)
		stage = "plan"
		call("refresh")
		call("reveal_control", call("first_invalid_control"))
		return
	reviewed_plan = drafts[driver_id].duplicate(true)
	preview = model.tactical_forecast_preview(driver_id, reviewed_plan)
	reviewed_revision = int(model.duel_state.drivers[driver_id].revision)
	reviewed_policy_revision = int(model.policy(driver_id).revision)
	var lines: Array[String] = [
		"%s · %s" % [model.car(driver_id).name, TacticalForecast.LABELS[reviewed_plan.kind]],
		(
			"Against %s · laps %d–%d · %s"
			% [
				model.car(int(reviewed_plan.target_id)).name,
				reviewed_plan.from_lap,
				reviewed_plan.to_lap,
				str(reviewed_plan.set_id).get_slice("-", 1)
			]
		),
		authority_copy(reviewed_plan),
		"FIXED COMPARISON · %.1fs simulated time" % preview.time
	]
	if not preview.available:
		lines.append("Cannot approve: " + preview.reason)
	else:
		var gain = float(preview.candidate.gain)
		lines.append(
			(
				"Estimated %.1fs %s than the current plan. Not a finish prediction."
				% [absf(gain), "faster" if gain >= 0 else "slower"]
			)
		)
		(
			lines
			. append(
				(
					(
						"Fuel reserve %.2f laps · tread floor %.0f%%.\nClear rejoin / pit box: %s. Rival "
						+ "stops first: %s."
					)
					% [
						reviewed_plan.fuel_reserve,
						reviewed_plan.tyre_floor,
						"wait" if reviewed_plan.avoid_traffic else "do not wait",
						(
							("review" if reviewed_plan.rival_first else "continue")
							if reviewed_plan.kind == "undercut"
							else "not applicable"
						)
					]
				)
			)
		)
		if reviewed_plan.kind == "extend":
			lines.append(
				"Skip %d pit entries from the start of the window." % reviewed_plan.wait_laps
			)
	comparison.text = "\n\n".join(lines)
	for i in range(option_rows.size()):
		var row = option_rows[i]
		row.card.visible = i < preview.options.size()
		if not row.card.visible:
			continue
		var option = preview.options[i]
		row.heading.text = (
			option.title
			+ (
				" · selected"
				if (
					(i == 1 and reviewed_plan.kind == "undercut")
					or (i == 2 and reviewed_plan.kind == "extend")
				)
				else ""
			)
		)
		row.body.text = (
			"Unavailable"
			if not option.available
			else (
				"%.1fs remaining · %s risk\nModel range %.1f–%.1fs"
				% [option.seconds, option.risk, option.low, option.high]
			)
		)
	case_copy.text = ""
	if preview.available:
		case_copy.text = (
			(
				"STOP COSTS · ESTIMATES\nPit loss ~%.1fs · warm-up ~%.1fs · queue ~%.1fs\nTarget "
				+ "gap estimate %+.1fs\n\n%s\n\n%s"
			)
			% [
				preview.pit.loss,
				preview.pit.warmup,
				preview.pit.queue,
				preview.gap,
				preview.rival_cases,
				preview.assumptions
			]
		)
	stage = "review"
	notice = ""
	call("refresh")
	comparison.grab_focus()
	Callable(self, "reveal_comparison").call_deferred()


func approve() -> void:
	# Button state and domain revision/key guards both protect duplicate/stale input.
	if (
		stage != "review"
		or approve_button.disabled
		or preview.is_empty()
		or reviewed_plan.is_empty()
	):
		return
	command_requested.emit(
		"duel_approve",
		{
			"id": driver_id,
			"plan": reviewed_plan.duplicate(true),
			"revision": reviewed_revision,
			"policy_revision": reviewed_policy_revision,
			"key": preview.key,
			"time": preview.time
		}
	)
	var record = model.tactical_current(driver_id)
	if (
		not record.is_empty()
		and record.plan == reviewed_plan
		and int(model.duel_state.drivers[driver_id].revision) != reviewed_revision
	):
		edited[driver_id] = false
		stage = "status"
		notice = ""
		call("refresh")
		call("reveal_control", status_copy)
	else:
		call("refresh")


func end_plan() -> void:
	if not TacticalDuels.live(model.tactical_current(driver_id)):
		return
	request_confirmation(
		"end",
		"End %s's tactic?" % model.car(driver_id).short,
		(
			"Stop following this tactical plan and release its remaining pit "
			+ "authority.\n\nAny accepted pit stop STAYS VALID. To cancel that stop, use Pit "
			+ "service before entry.\n\nThe other driver is unaffected. The session keeps its "
			+ "current time controls."
		),
		"End tactic",
		end_button
	)


func request_confirmation(
	action: String, title: String, text: String, accept: String, invoker: Control
) -> void:
	if is_instance_valid(confirm_dialog):
		return
	var record = model.tactical_current(driver_id)
	pending = {
		"action": action,
		"id": driver_id,
		"revision": int(model.duel_state.drivers[driver_id].revision),
		"plan_id": record.get("id", ""),
		"draft": drafts[driver_id].duplicate(true)
	}
	confirm_dialog = ConfirmationDialog.new()
	confirm_dialog.title = title
	confirm_dialog.dialog_text = text
	confirm_dialog.ok_button_text = accept
	confirm_dialog.cancel_button_text = "Keep current choices"
	add_child(confirm_dialog)
	confirm_dialog.get_label().autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	confirm_dialog.get_label().custom_minimum_size.x = 460
	PitwallDesign.scale_controls(confirm_dialog, text_scale)
	confirm_dialog.confirmed.connect(func(): finish_confirmation(true, invoker))
	confirm_dialog.canceled.connect(func(): finish_confirmation(false, invoker))
	confirm_dialog.popup_centered(Vector2i(560, 270))
	PitwallDesign.focus_later(confirm_dialog.get_cancel_button())


func finish_confirmation(accept: bool, invoker: Control) -> void:
	var request = pending.duplicate(true)
	pending.clear()
	confirm_dialog.queue_free()
	confirm_dialog = null
	if accept and not request.is_empty():
		var id = int(request.id)
		if (
			id != driver_id
			or int(model.duel_state.drivers[id].revision) != int(request.revision)
			or drafts[id] != request.draft
		):
			notice = "The driver, tactic or draft changed. Review the current choices before trying again."
		elif request.action == "reset":
			drafts[id] = model.tactical_forecast_draft(id)
			edited[id] = false
			choose_driver(id)
			stage = "plan"
		else:
			command_requested.emit(
				"duel_cancel", {"id": id, "revision": request.revision, "plan_id": request.plan_id}
			)
			if not TacticalDuels.live(model.tactical_current(id)):
				stage = "plan"
				preview = {}
				reviewed_plan = {}
				notice = "Tactic ended. Any accepted pit stop stays valid."
	call("refresh")
	if is_instance_valid(invoker) and invoker.is_visible_in_tree() and not invoker.disabled:
		PitwallDesign.focus_later(invoker)
	else:
		call("reveal_control", kind if stage == "plan" else status_copy)
