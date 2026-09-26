class_name TacticalPlanPanel
extends VBoxContainer
## Stable native controls. Unapplied drafts survive navigation; comparison is frozen.
signal command_requested(action: String, payload: Dictionary)
signal driver_selected(id: int)
signal reading_requested(title: String, text: String, invoker: Control)
var model: PracticeRaceSim
var driver_id = 3
var drafts: Dictionary = {}
var edited: Dictionary = {}
var loading = false
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

func configure(sim: PracticeRaceSim) -> void: model = sim

func field(title: String, control: Control) -> void:
	add_child(UI.label(title, 11, UI.MUTED)); add_child(control)
	control.size_flags_horizontal = Control.SIZE_EXPAND_FILL

func _ready() -> void:
	add_theme_constant_override("separation", 7)
	picker = UI.option(["MER · Daniel Mercer", "MOR · Lucas Moreau"], func(index): choose_driver([3, 6][index]); driver_selected.emit(driver_id))
	field("TACTICAL DRIVER · EXPLICIT TARGET", picker)
	live_label = UI.paragraph(""); add_child(live_label)
	var tools = UI.hbox(self)
	evidence_button = UI.button("Plan evidence", func(): reading_requested.emit("Tactical evidence", TacticalDuels.debrief(model), evidence_button)); tools.add_child(evidence_button)
	team_button = UI.button("Both cars", func(): reading_requested.emit("Two-car comparison", TacticalForecast.team_compare(model), team_button)); tools.add_child(team_button)
	kind = UI.option(["Undercut this rival", "Extend for an opportunity"], func(_index): change_kind())
	field("INTENTION · ONE NEXT STOP", kind)
	rival = UI.option([], func(_index): changed(), -1); field("NAMED RIVAL", rival)
	for c in model.cars:
		if c.player: continue
		rival.add_item(c.name); rival.set_item_metadata(rival.item_count - 1, int(c.id))
	replacement = UI.option([], func(_index): changed(), -1); field("REPLACEMENT SET · RETAINED CONDITION", replacement)
	var window = UI.hbox(self)
	first = UI.spin(2, 1, maxi(1, model.laps - 1), 1, func(_v): changed())
	last = UI.spin(4, 1, maxi(1, model.laps - 1), 1, func(_v): changed())
	for pair in [["From lap", first], ["Through lap", last]]:
		var column = UI.vbox(window); column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		column.add_child(UI.label(pair[0], 11, UI.MUTED)); column.add_child(pair[1])
	wait = UI.spin(2, 1, 2, 1, func(_v): changed()); field("EXTEND · ENTRIES TO SKIP FROM WINDOW START", wait)
	authority = UI.option(["Recommend only · no new authority", "Delegate this pit tactic only"], func(_index): changed())
	field("AUTHORITY", authority)
	add_child(UI.paragraph("Delegated tactics temporarily replace the next pit decision, not the remaining plan. Existing pace/engine owners keep control; their engineers may conserve to the agreed reserves. No automatic push, pause or speed change."))
	fuel = UI.spin(0.35, 0, 3, 0.05, func(_v): changed()); field("MINIMUM PROJECTED FUEL · LAP UNITS", fuel)
	floor_life = UI.spin(15, 5, 50, 1, func(_v): changed()); field("LIMITING-WHEEL TREAD FLOOR (%)", floor_life)
	traffic = UI.check("Wait if rejoin / shared box is congested", true, func(_v): changed()); add_child(traffic)
	rival_first = UI.check("Review if the rival pits before our order", true, func(_v): changed()); add_child(rival_first)
	var reset = UI.button("Reset this unapplied draft", reset_draft); add_child(reset)
	draft_label = UI.paragraph(""); add_child(draft_label)
	comparison = UI.paragraph("Compare before approval. No action is implied by inspecting estimates."); comparison.focus_mode = Control.FOCUS_ALL; add_child(comparison)
	comparison.gui_input.connect(comparison_input)
	commit_bar = UI.vbox(self)
	var review_actions = UI.hbox(commit_bar)
	refresh_button = UI.button("Compare", compare_now); review_actions.add_child(refresh_button)
	end_button = UI.button("End plan", end_plan); review_actions.add_child(end_button)
	for control in [refresh_button, end_button]: control.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	refresh_button.tooltip_text = "Refresh the comparison for this driver's current draft. This never issues a command."
	end_button.tooltip_text = "End the tactical mandate, keeping any already accepted pit stop. Cancel the physical stop separately before entry."
	approve_button = UI.button("Approve tactical plan", approve, true); commit_bar.add_child(approve_button)
	choose_driver(3)

func choose_driver(id: int) -> void:
	if id not in [3, 6]: return
	driver_id = id
	if not drafts.has(id): drafts[id] = TacticalForecast.draft(model, id); edited[id] = false
	var p = drafts[id]
	loading = true
	picker.select([3, 6].find(id)); kind.select(TacticalForecast.KINDS.find(p.kind))
	for i in range(rival.item_count):
		if rival.get_item_metadata(i) == int(p.target_id): rival.select(i)
	replacement.clear()
	for item in model.cars[id].tyre_sets:
		replacement.add_item("%s · %.0f%% %s" % [item.id.get_slice("-", 1), item.life, "unusable" if not WheelTyres.usable(item) else ""])
		replacement.set_item_metadata(replacement.item_count - 1, item.id)
		if item.id == p.set_id: replacement.select(replacement.item_count - 1)
	first.value = p.from_lap; last.value = p.to_lap; wait.value = p.wait_laps
	authority.select(TacticalForecast.AUTHORITIES.find(p.authority)); fuel.value = p.fuel_reserve; floor_life.value = p.tyre_floor
	traffic.button_pressed = p.avoid_traffic; rival_first.button_pressed = p.rival_first
	loading = false; preview = {}; reviewed_plan = {}; refresh()

func changed() -> void:
	if loading or authority == null or traffic == null or rival_first == null: return
	drafts[driver_id] = {"kind": TacticalForecast.KINDS[kind.selected], "target_id": int(rival.get_selected_metadata()),
		"set_id": str(replacement.get_selected_metadata()), "from_lap": int(first.value), "to_lap": int(last.value), "wait_laps": int(wait.value),
		"authority": TacticalForecast.AUTHORITIES[authority.selected], "fuel_reserve": fuel.value, "tyre_floor": floor_life.value,
		"avoid_traffic": traffic.button_pressed, "rival_first": rival_first.button_pressed}
	edited[driver_id] = true; preview = {}; reviewed_plan = {}; refresh()

func change_kind() -> void:
	if loading: return
	loading = true
	if kind.selected == 1: last.value = mini(model.laps - 1, maxi(int(last.value), int(first.value + wait.value)))
	loading = false; changed()

func reset_draft() -> void:
	drafts[driver_id] = TacticalForecast.draft(model, driver_id); edited[driver_id] = false; choose_driver(driver_id)

func compare_now() -> void:
	reviewed_plan = drafts[driver_id].duplicate(true)
	preview = TacticalForecast.preview(model, driver_id, reviewed_plan)
	reviewed_revision = int(model.duel_state.drivers[driver_id].revision)
	reviewed_policy_revision = int(model.policy(driver_id).revision)
	var lines: Array[String] = ["FIXED COMPARISON · %.1fs · %s" % [preview.time, model.cars[driver_id].name]]
	if not preview.available: lines.append(preview.reason)
	else:
		lines.append("%s · target gap estimate %+.1fs" % [model.cars[int(reviewed_plan.target_id)].name, preview.gap])
		for option in preview.options:
			lines.append(option.title + (": unavailable" if not option.available else ": %.1fs remaining (model range %.1f–%.1f) · %s risk" % [option.seconds, option.low, option.high, option.risk]))
		lines.append("Selected tactic: estimated gain %+.1fs vs current plan. Pit loss ~%.1fs; warm-up ~%.1fs; queue ~%.1fs." % [preview.candidate.gain, preview.pit.loss, preview.pit.warmup, preview.pit.queue])
		lines.append(preview.rival_cases)
		lines.append(preview.assumptions)
	comparison.text = "\n\n".join(lines); refresh()
	comparison.focus_mode = Control.FOCUS_ALL
	comparison.grab_focus()
	reveal_comparison.call_deferred()

func comparison_scroll() -> ScrollContainer:
	var ancestor = get_parent()
	while ancestor != null and not ancestor is ScrollContainer: ancestor = ancestor.get_parent()
	return ancestor as ScrollContainer

func reveal_comparison() -> void:
	# Oversized evidence must open at its heading, not its bottom edge.
	await get_tree().process_frame
	var scroll = comparison_scroll()
	if scroll != null:
		scroll.scroll_vertical += roundi(comparison.global_position.y - scroll.global_position.y)

func comparison_input(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed: return
	var scroll = comparison_scroll()
	if scroll == null: return
	var stride = maxi(30, roundi(scroll.size.y * 0.8))
	match event.keycode:
		KEY_PAGEDOWN: scroll.scroll_vertical += stride
		KEY_PAGEUP: scroll.scroll_vertical -= stride
		KEY_HOME: scroll.scroll_vertical += roundi(comparison.global_position.y - scroll.global_position.y)
		KEY_END: scroll.scroll_vertical = int(scroll.get_v_scroll_bar().max_value)
		_: return
	comparison.accept_event()

func approve() -> void:
	if preview.is_empty() or reviewed_plan.is_empty(): return
	command_requested.emit("duel_approve", {"id": driver_id, "plan": reviewed_plan.duplicate(true), "revision": reviewed_revision,
		"policy_revision": reviewed_policy_revision, "key": preview.key, "time": preview.time})
	var record = TacticalDuels.current(model, driver_id)
	if not record.is_empty() and record.plan == reviewed_plan and int(model.duel_state.drivers[driver_id].revision) != reviewed_revision:
		edited[driver_id] = false
	refresh()

func end_plan() -> void:
	var record = TacticalDuels.current(model, driver_id)
	if not TacticalDuels.live(record): return
	command_requested.emit("duel_cancel", {"id": driver_id, "revision": model.duel_state.drivers[driver_id].revision, "plan_id": record.id})
	refresh()

func refresh() -> void:
	if live_label == null or not drafts.has(driver_id): return
	var c = model.cars[driver_id]; var r = TacticalDuels.current(model, driver_id)
	live_label.text = c.name + " · " + ("no tactical plan" if r.is_empty() else r.status.to_upper() + " / " + model.cars[int(r.plan.target_id)].name)
	if not r.is_empty(): live_label.text += "\n" + r.reason
	var error = TacticalForecast.validate_plan(drafts[driver_id], model.cars, driver_id, model.laps)
	var stale = preview.is_empty() or model.total_time - preview.get("time", -100) > RaceForecaster.MAX_AGE
	if not preview.is_empty(): stale = stale or preview.key != RaceForecaster.material_key(model, driver_id, int(model.policy(driver_id).revision)) or reviewed_revision != int(model.duel_state.drivers[driver_id].revision)
	var ready = not stale and preview.get("available", false) and error.is_empty() and (not TacticalDuels.live(r) or r.status == "review") and not c.finished and not c.dnf
	approve_button.disabled = not ready
	approve_button.text = "Approve %s · %s" % [c.short, "pit authority" if drafts[driver_id].authority == "execute" else "recommend only"]
	end_button.disabled = not TacticalDuels.live(r)
	draft_label.text = "UNAPPLIED · " + (error if not error.is_empty() else ("Compare the current situation before approval." if stale else "Comparison reviewed; approval is explicit."))
	if not edited.get(driver_id, false) and TacticalDuels.live(r): draft_label.text = "ACTIVE RECORD RETAINED · end or review it before a new approval."
	approve_button.tooltip_text = draft_label.text
	wait.editable = drafts[driver_id].kind == "extend"
	rival_first.disabled = drafts[driver_id].kind != "undercut"
