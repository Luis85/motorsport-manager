class_name TacticalPlanPanel
extends VBoxContainer
## Native Plan -> Review -> Follow-up. Display state never grants race authority.
signal command_requested(action: String, payload: Dictionary)
signal driver_selected(id: int)
signal reading_requested(title: String, text: String, invoker: Control)
var model: PracticeRaceSim
var driver_id = 3
var text_scale = 1.0
var drafts: Dictionary = {}
var edited: Dictionary = {}
var loading = false
var stage = "plan"
var preview: Dictionary = {}
var reviewed_plan: Dictionary = {}
var reviewed_revision = -1
var reviewed_policy_revision = -1
var picker: OptionButton
var kind: OptionButton
var rival: OptionButton
var replacement: OptionButton
var authority: OptionButton
var first: SpinBox
var last: SpinBox
var wait: SpinBox
var fuel: SpinBox
var floor_life: SpinBox
var traffic: CheckButton
var rival_first: CheckButton
var live_label: Label
var draft_label: Label
var comparison: Label
var commit_bar: VBoxContainer
var refresh_button: Button
var approve_button: Button
var end_button: Button
var evidence_button: Button
var team_button: Button
var edit_button: Button
var reset_button: Button
var limits_button: Button
var limits_summary: Label
var authority_help: Label
var intention_help: Label
var stage_label: Label
var status_copy: Label
var case_copy: Label
var plan_body: VBoxContainer
var review_body: VBoxContainer
var status_body: VBoxContainer
var limits_body: VBoxContainer
var extension_row: VBoxContainer
var option_rows: Array = []
var confirm_dialog: ConfirmationDialog
var pending: Dictionary = {}
var notice = ""
var reveal_serial = 0

func configure(sim: PracticeRaceSim) -> void: model = sim

func field(title: String, control: Control, parent: Node = null) -> void:
	var container = parent if parent != null else plan_body
	container.add_child(UI.label(title, 11, UI.MUTED)); container.add_child(control)
	control.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	control.accessibility_name = title
	if control is SpinBox: control.get_line_edit().accessibility_name = title

func _ready() -> void:
	add_theme_constant_override("separation", 7)
	picker = UI.option(["MER · Daniel Mercer", "MOR · Lucas Moreau"], func(index): choose_driver([3, 6][index]); driver_selected.emit(driver_id))
	field("Tactical driver", picker, self)
	stage_label = UI.label("", 14, UI.INK); add_child(stage_label)
	live_label = UI.paragraph(""); add_child(live_label)
	plan_body = UI.vbox(self)
	kind = UI.option(["Undercut · stop before this rival", "Extend · stay out, then stop"], func(_index): change_kind())
	field("What are we trying to do?", kind)
	intention_help = UI.paragraph(""); plan_body.add_child(intention_help)
	rival = UI.option([], func(_index): changed(), -1); field("Against which rival?", rival)
	for c in model.cars:
		if c.player: continue
		rival.add_item(c.name); rival.set_item_metadata(rival.item_count - 1, int(c.id))
	replacement = UI.option([], func(_index): changed(), -1); field("Fit this replacement set", replacement)
	var window = UI.hbox(plan_body)
	first = UI.spin(2, 1, maxi(1, model.laps - 1), 1, func(_v): changed())
	last = UI.spin(4, 1, maxi(1, model.laps - 1), 1, func(_v): changed())
	for pair in [["Earliest lap", first], ["Latest lap", last]]:
		var column = UI.vbox(window); column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		field(pair[0], pair[1], column)
	extension_row = UI.vbox(plan_body)
	wait = UI.spin(2, 1, 2, 1, func(_v): changed()); field("Pit entries to skip before stopping", wait, extension_row)
	authority = UI.option(["Advice only · no new authority", "Delegate this pit tactic only"], func(_index): changed())
	field("Who may make the pit call?", authority)
	authority_help = UI.paragraph(""); plan_body.add_child(authority_help)
	limits_button = UI.button("Show limits & contingencies", toggle_limits); plan_body.add_child(limits_button)
	limits_summary = UI.paragraph(""); plan_body.add_child(limits_summary)
	limits_body = UI.vbox(plan_body); limits_body.hide()
	fuel = UI.spin(0.35, 0, 3, 0.05, func(_v): changed()); field("Minimum fuel remaining (laps)", fuel, limits_body)
	floor_life = UI.spin(15, 5, 50, 1, func(_v): changed()); field("Minimum limiting-wheel tread (%)", floor_life, limits_body)
	traffic = UI.check("Wait for a clear rejoin / pit box", true, func(_v): changed()); limits_body.add_child(traffic)
	rival_first = UI.check("Review if the rival stops first", true, func(_v): changed()); limits_body.add_child(rival_first)
	limits_body.add_child(UI.paragraph("Existing pace and engine owners keep control. Their engineers may conserve toward these reserves. No automatic push, pause or speed change."))
	reset_button = UI.button("Reset this draft…", reset_draft); limits_body.add_child(reset_button)
	review_body = UI.vbox(self)
	comparison = UI.paragraph("", UI.INK); comparison.focus_mode = Control.FOCUS_ALL; review_body.add_child(comparison)
	comparison.accessibility_name = "Captured tactical comparison. Page Up and Page Down read evidence."
	comparison.gui_input.connect(reading_input.bind(comparison))
	reading_focus(comparison)
	for i in range(3):
		var card = UI.panel(); review_body.add_child(card)
		var column = UI.vbox(card)
		var heading = UI.label("", 13, UI.INK); column.add_child(heading)
		var body = UI.paragraph(""); column.add_child(body)
		option_rows.append({"card": card, "heading": heading, "body": body})
	case_copy = UI.paragraph(""); review_body.add_child(case_copy)
	status_body = UI.vbox(self)
	status_copy = UI.paragraph("", UI.INK); status_copy.focus_mode = Control.FOCUS_ALL; status_body.add_child(status_copy)
	status_copy.accessibility_name = "Tactical follow-up. Page Up and Page Down read the receipt."
	status_copy.gui_input.connect(reading_input.bind(status_copy))
	reading_focus(status_copy)
	var tools = UI.hbox(self)
	evidence_button = UI.button("Plan evidence", show_evidence); tools.add_child(evidence_button)
	team_button = UI.button("Both cars", func(): reading_requested.emit("Two-car comparison", TacticalForecast.team_compare(model), team_button)); tools.add_child(team_button)
	commit_bar = UI.vbox(self)
	draft_label = UI.paragraph(""); draft_label.add_theme_font_size_override("font_size", 11); commit_bar.add_child(draft_label)
	var actions = UI.hbox(commit_bar)
	edit_button = UI.button("Edit draft", edit_draft); actions.add_child(edit_button)
	refresh_button = UI.button("Compare options", compare_now, true); actions.add_child(refresh_button)
	end_button = UI.button("End tactic…", end_plan); actions.add_child(end_button)
	for control in [edit_button, refresh_button, end_button]: control.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	refresh_button.tooltip_text = "Compare this driver's draft. Reading estimates never issues a race command."
	end_button.tooltip_text = "Review ending this tactic. An accepted physical pit stop is not cancelled."
	approve_button = UI.button("Approve tactical plan", approve, true); commit_bar.add_child(approve_button)
	choose_driver(3)

func choose_driver(id: int) -> void:
	if id not in [3, 6]: return
	driver_id = id
	if not drafts.has(id): drafts[id] = TacticalForecast.draft(model, id); edited[id] = false
	var p = drafts[id]
	loading = true
	picker.select([3, 6].find(id)); kind.select(TacticalForecast.KINDS.find(p.kind))
	rival.select(-1)
	for i in range(rival.item_count):
		if rival.get_item_metadata(i) == int(p.target_id): rival.select(i)
	replacement.clear()
	for item in model.cars[id].tyre_sets:
		var why = " · fitted" if item.id == model.cars[id].set_id else (" · unusable" if not WheelTyres.usable(item) else (" · wet-weather" if item.compound in ["I", "W"] else ""))
		replacement.add_item("%s · %.0f%%%s" % [item.id.get_slice("-", 1), item.life, why])
		replacement.set_item_metadata(replacement.item_count - 1, item.id)
		if item.id == p.set_id: replacement.select(replacement.item_count - 1)
	first.value = p.from_lap; last.value = p.to_lap; wait.value = p.wait_laps
	authority.select(TacticalForecast.AUTHORITIES.find(p.authority)); fuel.value = p.fuel_reserve; floor_life.value = p.tyre_floor
	traffic.button_pressed = p.avoid_traffic; rival_first.button_pressed = p.rival_first
	loading = false; preview = {}; reviewed_plan = {}; notice = ""
	stage = "status" if not TacticalDuels.current(model, id).is_empty() and not edited.get(id, false) else "plan"
	refresh()

func changed() -> void:
	if loading or authority == null or traffic == null or rival_first == null: return
	drafts[driver_id] = {"kind": TacticalForecast.KINDS[kind.selected], "target_id": int(rival.get_selected_metadata()) if rival.selected >= 0 else -1,
		"set_id": str(replacement.get_selected_metadata()) if replacement.selected >= 0 else "", "from_lap": int(first.value), "to_lap": int(last.value), "wait_laps": int(wait.value),
		"authority": TacticalForecast.AUTHORITIES[authority.selected], "fuel_reserve": fuel.value, "tyre_floor": floor_life.value,
		"avoid_traffic": traffic.button_pressed, "rival_first": rival_first.button_pressed}
	edited[driver_id] = true; preview = {}; reviewed_plan = {}; notice = ""; stage = "plan"; refresh()

func change_kind() -> void:
	if loading: return
	loading = true
	if kind.selected == 1: last.value = mini(model.laps - 1, maxi(int(last.value), int(first.value + wait.value)))
	loading = false; changed()

func toggle_limits() -> void:
	# Move focus before hiding controls; never leave it inside a collapsed section.
	limits_button.grab_focus(); limits_body.visible = not limits_body.visible; refresh()

func edit_draft() -> void:
	stage = "plan"; notice = ""; refresh(); reveal_control(kind)

func reset_draft() -> void:
	request_confirmation("reset", "Reset %s's draft?" % model.cars[driver_id].short,
		"Replace this driver's unapplied choices with current defaults?\n\nThe active tactic, race orders and the other driver's draft stay unchanged.", "Reset draft", reset_button)

func show_evidence() -> void:
	reading_requested.emit("Tactical evidence", TacticalDuels.debrief(model), evidence_button)

func compare_now() -> void:
	var error = TacticalForecast.validate_plan(drafts[driver_id], model.cars, driver_id, model.laps)
	if not error.is_empty():
		notice = "Latest lap must be at or after earliest lap." if drafts[driver_id].from_lap > drafts[driver_id].to_lap else error
		stage = "plan"; refresh(); reveal_control(first_invalid_control()); return
	reviewed_plan = drafts[driver_id].duplicate(true)
	preview = TacticalForecast.preview(model, driver_id, reviewed_plan)
	reviewed_revision = int(model.duel_state.drivers[driver_id].revision)
	reviewed_policy_revision = int(model.policy(driver_id).revision)
	var lines: Array[String] = ["%s · %s" % [model.cars[driver_id].name, TacticalForecast.LABELS[reviewed_plan.kind]],
		"Against %s · laps %d–%d · %s" % [model.cars[int(reviewed_plan.target_id)].name, reviewed_plan.from_lap, reviewed_plan.to_lap, str(reviewed_plan.set_id).get_slice("-", 1)],
		authority_copy(reviewed_plan), "FIXED COMPARISON · %.1fs simulated time" % preview.time]
	if not preview.available: lines.append("Cannot approve: " + preview.reason)
	else:
		var gain = float(preview.candidate.gain)
		lines.append("Estimated %.1fs %s than the current plan. Not a finish prediction." % [absf(gain), "faster" if gain >= 0 else "slower"])
		lines.append("Fuel reserve %.2f laps · tread floor %.0f%%.\nClear rejoin / pit box: %s. Rival stops first: %s." % [reviewed_plan.fuel_reserve, reviewed_plan.tyre_floor, "wait" if reviewed_plan.avoid_traffic else "do not wait", ("review" if reviewed_plan.rival_first else "continue") if reviewed_plan.kind == "undercut" else "not applicable"])
		if reviewed_plan.kind == "extend": lines.append("Skip %d pit entries from the start of the window." % reviewed_plan.wait_laps)
	comparison.text = "\n\n".join(lines)
	for i in range(option_rows.size()):
		var row = option_rows[i]; row.card.visible = i < preview.options.size()
		if not row.card.visible: continue
		var option = preview.options[i]
		row.heading.text = option.title + (" · selected" if (i == 1 and reviewed_plan.kind == "undercut") or (i == 2 and reviewed_plan.kind == "extend") else "")
		row.body.text = "Unavailable" if not option.available else "%.1fs remaining · %s risk\nModel range %.1f–%.1fs" % [option.seconds, option.risk, option.low, option.high]
	case_copy.text = ""
	if preview.available:
		case_copy.text = "STOP COSTS · ESTIMATES\nPit loss ~%.1fs · warm-up ~%.1fs · queue ~%.1fs\nTarget gap estimate %+.1fs\n\n%s\n\n%s" % [preview.pit.loss, preview.pit.warmup, preview.pit.queue, preview.gap, preview.rival_cases, preview.assumptions]
	stage = "review"; notice = ""; refresh(); comparison.grab_focus(); reveal_comparison.call_deferred()

func first_invalid_control() -> Control:
	var p = drafts[driver_id]
	if p.target_id < 0: return rival
	if p.set_id.is_empty(): return replacement
	return last

func reveal_control(control: Control) -> void:
	reveal_serial += 1
	var request = reveal_serial
	await get_tree().process_frame
	if request != reveal_serial or not is_instance_valid(control) or not control.is_visible_in_tree(): return
	var target = control.get_line_edit() if control is SpinBox else control
	target.grab_focus()
	# Let ScrollContainer follow_focus and the newly shown layout settle first.
	# Revealing both synchronously can add the same scroll offset twice.
	await get_tree().process_frame
	await get_tree().process_frame
	if request != reveal_serial or not is_instance_valid(control) or not control.is_visible_in_tree() or not target.has_focus(): return
	var scroll = comparison_scroll()
	if scroll != null:
		var reveal = control.get_parent() as Control if control == first or control == last else control
		if reveal.size.y > scroll.size.y: scroll.scroll_vertical += roundi(reveal.global_position.y - scroll.global_position.y)
		else: scroll.ensure_control_visible(reveal)

func comparison_scroll() -> ScrollContainer:
	var ancestor = get_parent()
	while ancestor != null and not ancestor is ScrollContainer: ancestor = ancestor.get_parent()
	return ancestor as ScrollContainer

func reveal_comparison() -> void:
	reveal_serial += 1
	var request = reveal_serial
	await get_tree().process_frame
	if request != reveal_serial or not comparison.has_focus(): return
	var scroll = comparison_scroll()
	if scroll != null and comparison.is_visible_in_tree(): scroll.scroll_vertical += roundi(comparison.global_position.y - scroll.global_position.y)

func reading_input(event: InputEvent, reader: Control) -> void:
	if not event is InputEventKey or not event.pressed: return
	var scroll = comparison_scroll()
	if scroll == null: return
	var stride = maxi(30, roundi(scroll.size.y * 0.8))
	match event.keycode:
		KEY_PAGEDOWN: scroll.scroll_vertical += stride
		KEY_PAGEUP: scroll.scroll_vertical -= stride
		KEY_HOME: scroll.scroll_vertical += roundi(reader.global_position.y - scroll.global_position.y)
		KEY_END: scroll.scroll_vertical = int(scroll.get_v_scroll_bar().max_value)
		_: return
	# A delayed focus reveal must never undo the player's own reading navigation.
	reveal_serial += 1
	reader.accept_event()

func approve() -> void:
	# Button state and domain revision/key guards both protect duplicate/stale input.
	if stage != "review" or approve_button.disabled or preview.is_empty() or reviewed_plan.is_empty(): return
	command_requested.emit("duel_approve", {"id": driver_id, "plan": reviewed_plan.duplicate(true), "revision": reviewed_revision,
		"policy_revision": reviewed_policy_revision, "key": preview.key, "time": preview.time})
	var record = TacticalDuels.current(model, driver_id)
	if not record.is_empty() and record.plan == reviewed_plan and int(model.duel_state.drivers[driver_id].revision) != reviewed_revision:
		edited[driver_id] = false; stage = "status"; notice = ""; refresh(); reveal_control(status_copy)
	else: refresh()

func end_plan() -> void:
	if not TacticalDuels.live(TacticalDuels.current(model, driver_id)): return
	request_confirmation("end", "End %s's tactic?" % model.cars[driver_id].short,
		"Stop following this tactical plan and release its remaining pit authority.\n\nAny accepted pit stop STAYS VALID. To cancel that stop, use Pit service before entry.\n\nThe other driver is unaffected. The session keeps its current time controls.", "End tactic", end_button)

func request_confirmation(action: String, title: String, text: String, accept: String, invoker: Control) -> void:
	if is_instance_valid(confirm_dialog): return
	var record = TacticalDuels.current(model, driver_id)
	pending = {"action": action, "id": driver_id, "revision": int(model.duel_state.drivers[driver_id].revision), "plan_id": record.get("id", ""), "draft": drafts[driver_id].duplicate(true)}
	confirm_dialog = ConfirmationDialog.new(); confirm_dialog.title = title
	confirm_dialog.dialog_text = text; confirm_dialog.ok_button_text = accept; confirm_dialog.cancel_button_text = "Keep current choices"
	add_child(confirm_dialog)
	confirm_dialog.get_label().autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	confirm_dialog.get_label().custom_minimum_size.x = 460
	PitwallDesign.scale_controls(confirm_dialog, text_scale)
	confirm_dialog.confirmed.connect(func(): finish_confirmation(true, invoker))
	confirm_dialog.canceled.connect(func(): finish_confirmation(false, invoker))
	confirm_dialog.popup_centered(Vector2i(560, 270)); PitwallDesign.focus_later(confirm_dialog.get_cancel_button())

func finish_confirmation(accept: bool, invoker: Control) -> void:
	var request = pending.duplicate(true); pending.clear()
	confirm_dialog.queue_free(); confirm_dialog = null
	if accept and not request.is_empty():
		var id = int(request.id)
		if id != driver_id or int(model.duel_state.drivers[id].revision) != int(request.revision) or drafts[id] != request.draft:
			notice = "The driver, tactic or draft changed. Review the current choices before trying again."
		elif request.action == "reset":
			drafts[id] = TacticalForecast.draft(model, id); edited[id] = false; choose_driver(id); stage = "plan"
		else:
			command_requested.emit("duel_cancel", {"id": id, "revision": request.revision, "plan_id": request.plan_id})
			if not TacticalDuels.live(TacticalDuels.current(model, id)): stage = "plan"; preview = {}; reviewed_plan = {}; notice = "Tactic ended. Any accepted pit stop stays valid."
	refresh()
	if is_instance_valid(invoker) and invoker.is_visible_in_tree() and not invoker.disabled: PitwallDesign.focus_later(invoker)
	else: reveal_control(kind if stage == "plan" else status_copy)

func authority_copy(plan: Dictionary) -> String:
	return "Approval delegates pit timing for this tactic only. Other controls keep their existing owners." if plan.authority == "execute" else "Advice only. No new execution authority; existing pit ownership and orders stay unchanged."

func refresh() -> void:
	if live_label == null or not drafts.has(driver_id): return
	var c = model.cars[driver_id]; var r = TacticalDuels.current(model, driver_id); var p = drafts[driver_id]
	var active = TacticalDuels.live(r)
	plan_body.visible = stage == "plan"; review_body.visible = stage == "review"; status_body.visible = stage == "status"
	stage_label.text = {"plan": "1 · Plan your next stop", "review": "2 · Review before approval", "status": "3 · Follow the outcome"}[stage]
	live_label.visible = stage == "plan" and active
	live_label.text = "An active tactic is still retained. Editing this draft changes no orders."
	extension_row.visible = p.kind == "extend"
	intention_help.text = "Trade track position for fresh tyres before the rival stops." if p.kind == "undercut" else "Keep track position longer, then stop within the agreed window."
	authority_help.text = authority_copy(p)
	limits_button.text = ("Hide" if limits_body.visible else "Show") + " limits & contingencies"
	limits_summary.text = "Fuel ≥ %.2f laps · tread ≥ %.0f%%\nClear rejoin: %s · rival stops first: %s" % [p.fuel_reserve, p.tyre_floor, "wait" if p.avoid_traffic else "do not wait", ("review" if p.rival_first else "continue") if p.kind == "undercut" else "not applicable"]
	wait.editable = p.kind == "extend"; rival_first.visible = p.kind == "undercut"
	if not r.is_empty():
		var headings = {"approved": "Tactic approved", "preparing": "Watching for the opportunity", "ordered": "Pit order accepted", "executing": "Pit stop in progress", "evaluating": "Comparing the completed pit cycle", "review": "Your review is needed", "completed": "Tactic completed", "abandoned": "Tactic ended"}
		status_copy.text = "%s · %s\n\n%s against %s · laps %d–%d\n\n%s\n\n%s\n\nOpen Plan evidence for the sequence of decisions and the observed outcome." % [c.name, headings.get(r.status, r.status), TacticalForecast.LABELS[r.plan.kind], model.cars[int(r.plan.target_id)].name, r.plan.from_lap, r.plan.to_lap, "Approved with: " + ("pit-timing authority" if r.plan.authority == "execute" else "advice only") + ". Current pit owner: " + str(model.policy(driver_id).owners.pit) + ".", r.reason]
	var error = TacticalForecast.validate_plan(p, model.cars, driver_id, model.laps)
	var stale = preview.is_empty() or model.total_time - preview.get("time", -100) > RaceForecaster.MAX_AGE
	if not preview.is_empty(): stale = stale or preview.key != RaceForecaster.material_key(model, driver_id, int(model.policy(driver_id).revision)) or reviewed_revision != int(model.duel_state.drivers[driver_id].revision)
	var ready = not stale and preview.get("available", false) and error.is_empty() and (not active or r.status == "review") and not c.finished and not c.dnf
	approve_button.visible = stage == "review"; approve_button.disabled = not ready
	approve_button.text = "Approve %s · %s" % [c.short, "pit tactic" if p.authority == "execute" else "advice only"]
	end_button.visible = active; end_button.disabled = not active
	edit_button.visible = stage != "plan"; edit_button.text = "Edit draft" if stage == "review" else "Review draft"
	refresh_button.visible = stage != "status"; refresh_button.text = "Compare options" if stage == "plan" else "Refresh estimates"
	# Only one primary action per stage; changing hierarchy does not allocate on refresh.
	set_compare_primary(stage == "plan" or not ready)
	var reason = "Changes stay in this draft. Compare options next."
	if stage == "status": reason = "No duplicate approval needed. Review evidence or edit a separate draft."
	elif not error.is_empty(): reason = error
	elif stage == "review":
		if active and r.status != "review": reason = "An active tactic is retained. End or resolve it before a new approval."
		elif not preview.get("available", false): reason = preview.get("reason", "Comparison unavailable. Edit the draft and try again.")
		elif stale: reason = "Estimates are out of date. Refresh before approval."
		elif c.finished or c.dnf: reason = "This driver's session has ended. No new tactic can be approved."
		else: reason = "Review captured at %.1fs. Approval affects %s only." % [preview.time, c.short]
	if not notice.is_empty(): reason = notice
	draft_label.text = "%s · %s" % [c.short, reason]
	approve_button.tooltip_text = draft_label.text

func set_compare_primary(primary: bool) -> void:
	if refresh_button.get_meta("compare_primary", true) == primary: return
	refresh_button.set_meta("compare_primary", primary)
	if primary:
		for state in ["normal", "hover", "pressed", "hover_pressed"]: refresh_button.add_theme_stylebox_override(state, approve_button.get_theme_stylebox(state))
		for state in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color", "font_hover_pressed_color"]: refresh_button.add_theme_color_override(state, UI.ON_PRIMARY)
	else:
		for state in ["normal", "hover", "pressed", "hover_pressed"]: refresh_button.remove_theme_stylebox_override(state)
		for state in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color", "font_hover_pressed_color"]: refresh_button.remove_theme_color_override(state)

func reading_focus(control: Control) -> void:
	var outline = UI.box(Color.TRANSPARENT, PitwallDesign.FOCUS, 2, 0); outline.set_border_width_all(2)
	control.focus_entered.connect(control.queue_redraw); control.focus_exited.connect(control.queue_redraw)
	control.draw.connect(func():
		if control.has_focus(): control.draw_style_box(outline, Rect2(Vector2.ZERO, control.size)))
